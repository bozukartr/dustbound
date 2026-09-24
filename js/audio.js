'use strict';
/* ==========================================================
   DUSTBOUND — prosedürel ses (WebAudio): efektler, ortam, müzik
   ========================================================== */

const Audio_ = {
  ctx: null, master: null, sfx: null, music: null, amb: null,
  noise: null, plucks: new Map(),
  vol: { master: 0.8, sfx: 0.8, music: 0.5, amb: 0.6 },
  loops: {},
  seq: null,

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(comp);
    this.music = c.createGain(); this.music.connect(comp);
    this.amb = c.createGain(); this.amb.connect(comp);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startLoops();
    if (this.pendingMusic) { const m = this.pendingMusic; this.pendingMusic = null; this.playMusic(m); }
  },
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfx.gain.value = this.vol.sfx;
    this.music.gain.value = this.vol.music * 0.55;
    this.amb.gain.value = this.vol.amb;
  },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  },
  noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; },

  shot(kind = 'pistol', v = 1) {
    if (!this.ctx || v < 0.02) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); n.playbackRate.value = kind === 'rifle' ? 0.7 : 1;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'shotgun' ? 2600 : kind === 'bow' ? 5000 : 3600;
    const g = c.createGain();
    n.connect(f); f.connect(g); g.connect(this.sfx);
    if (kind === 'bow') { this.env(g, t, 0.005, 0.25 * v, 0.12); n.start(t); n.stop(t + 0.2); return; }
    const dur = kind === 'shotgun' ? 0.55 : kind === 'rifle' ? 0.7 : 0.38;
    this.env(g, t, 0.002, 0.9 * v, dur);
    n.start(t, Math.random()); n.stop(t + dur + 0.1);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'rifle' ? 90 : 130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const og = c.createGain(); this.env(og, t, 0.002, 0.8 * v, 0.25);
    o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 0.3);
    // yankı
    const d = c.createDelay(); d.delayTime.value = 0.18 + Math.random() * 0.08;
    const dg = c.createGain(); dg.gain.value = 0.25;
    g.connect(d); d.connect(dg); dg.connect(this.sfx);
  },
  boom(v = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); n.playbackRate.value = 0.4;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); n.connect(f); f.connect(g); g.connect(this.sfx);
    this.env(g, t, 0.005, 1.2 * v, 1.6); n.start(t); n.stop(t + 1.8);
  },
  thunder() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.3 + Math.random() * 1.2;
    const n = this.noiseSrc(); n.playbackRate.value = 0.25;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = c.createGain(); n.connect(f); f.connect(g); g.connect(this.amb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    n.start(t); n.stop(t + 3.6);
  },
  tone(freq, dur, type = 'sine', v = 0.2, bus, when = 0, slide) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = c.createGain(); this.env(g, t, 0.01, v, dur);
    o.connect(g); g.connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  thud(v = 0.6) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    const g = c.createGain(); this.env(g, t, 0.003, v, 0.14);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.2);
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
    const ng = c.createGain(); this.env(ng, t, 0.002, v * 0.4, 0.06); n.connect(f); f.connect(ng); ng.connect(this.sfx); n.start(t); n.stop(t + 0.1);
  },
  step(v = 0.08, hoof) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hoof ? 500 : 1400; f.Q.value = hoof ? 3 : 1;
    const g = c.createGain(); this.env(g, t, 0.002, v, hoof ? 0.07 : 0.05);
    n.connect(f); f.connect(g); g.connect(this.sfx); n.start(t, Math.random()); n.stop(t + 0.1);
  },
  ui(kind) {
    if (!this.ctx) return;
    if (kind === 'move') this.tone(880, 0.05, 'triangle', 0.05);
    else if (kind === 'ok') { this.tone(660, 0.08, 'triangle', 0.08); this.tone(990, 0.1, 'triangle', 0.06, null, 0.05); }
    else if (kind === 'back') this.tone(440, 0.08, 'triangle', 0.06, null, 0, 330);
    else if (kind === 'error') this.tone(180, 0.2, 'square', 0.05);
    else if (kind === 'cash') { this.tone(1760, 0.12, 'square', 0.04); this.tone(2349, 0.25, 'square', 0.04, null, 0.07); }
    else if (kind === 'pick') this.tone(1200, 0.06, 'sine', 0.08, null, 0, 1600);
  },
  chime() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.12, null, i * 0.09));
    [1047, 1319].forEach((f, i) => this.tone(f, 1.2, 'triangle', 0.05, null, 0.4 + i * 0.1));
  },
  discover() {
    if (!this.ctx) return;
    [220, 330, 440].forEach((f, i) => this.pluck(f, 0.25, i * 0.12));
    this.pluck(554, 0.2, 0.42);
  },
  whistle() {
    if (!this.ctx) return;
    this.tone(1500, 0.18, 'sine', 0.12, null, 0, 2300);
    this.tone(2300, 0.3, 'sine', 0.12, null, 0.22, 1700);
  },
  neigh() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(900, t + 0.15); o.frequency.linearRampToValueAtTime(500, t + 0.8);
    const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
    const g = c.createGain(); this.env(g, t, 0.05, 0.08, 0.8);
    o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t); lfo.start(t); o.stop(t + 0.9); lfo.stop(t + 0.9);
  },
  growl() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); n.playbackRate.value = 0.3;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 4;
    const g = c.createGain(); this.env(g, t, 0.05, 0.35, 0.7);
    n.connect(f); f.connect(g); g.connect(this.sfx); n.start(t); n.stop(t + 0.8);
  },
  train() {
    if (!this.ctx) return;
    [0, 0.05].forEach(w => { this.tone(370, 1.2, 'sawtooth', 0.03, this.amb, w); this.tone(466, 1.2, 'sawtooth', 0.03, this.amb, w); this.tone(554, 1.2, 'sawtooth', 0.025, this.amb, w); });
  },

  /* Karplus-Strong gitar teli */
  pluckBuf(freq) {
    const k = Math.round(freq);
    if (this.plucks.has(k)) return this.plucks.get(k);
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 2.2), N = Math.max(2, Math.round(sr / freq));
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N + 1 < i ? i - N + 1 : i - N]) * 0.4985;
    this.plucks.set(k, buf);
    return buf;
  },
  pluck(freq, v = 0.3, when = 0, bus) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource(); s.buffer = this.pluckBuf(freq);
    const g = this.ctx.createGain(); g.gain.value = v;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
    s.connect(f); f.connect(g); g.connect(bus || this.sfx); s.start(t);
  },

  /* ---- Ortam döngüleri ---- */
  startLoops() {
    const c = this.ctx;
    const mk = (type, freq, q) => {
      const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(this.amb); n.start();
      return { g, f };
    };
    this.loops.rain = mk('highpass', 1800);
    this.loops.wind = mk('bandpass', 420, 0.8);
    this.loops.fire = mk('bandpass', 2400, 0.5);
    this.loops.water = mk('bandpass', 700, 0.6);
    this.loops.gallop = mk('lowpass', 300);
  },
  setLoop(name, v) {
    const L = this.loops[name];
    if (!L) return;
    L.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  },
  ambientTick(env) {
    if (!this.ctx) return;
    this.setLoop('rain', env.rain * 0.35);
    this.setLoop('wind', env.wind * 0.3);
    this.setLoop('fire', env.fire * 0.12);
    this.setLoop('water', env.water * 0.12);
    this.loops.wind.f.frequency.setTargetAtTime(300 + Math.sin(this.ctx.currentTime * 0.3) * 150, this.ctx.currentTime, 1);
    // cırcır böcekleri ve kuşlar
    if (env.night && Math.random() < 0.08 * env.nature) {
      const f = 4200 + Math.random() * 600;
      for (let k = 0; k < 3; k++) this.tone(f, 0.03, 'sine', 0.018, this.amb, k * 0.06);
    }
    if (!env.night && Math.random() < 0.03 * env.nature && env.rain < 0.2) {
      const f = 2000 + Math.random() * 1800;
      this.tone(f, 0.12, 'sine', 0.025, this.amb, 0, f * (Math.random() < 0.5 ? 1.4 : 0.7));
      if (Math.random() < 0.5) this.tone(f * 1.2, 0.1, 'sine', 0.02, this.amb, 0.15, f);
    }
    if (env.night && env.wolves && Math.random() < 0.004) {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(400, t); o.frequency.linearRampToValueAtTime(700, t + 0.6); o.frequency.linearRampToValueAtTime(600, t + 2); o.frequency.linearRampToValueAtTime(380, t + 2.8);
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
      o.connect(g); g.connect(this.amb); o.start(t); o.stop(t + 3);
    }
  },

  /* ---- Müzik (spagetti western) ---- */
  playMusic(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.seq && this.seq.name === name) return;
    this.stopMusic();
    const A = 110, note = (semi, oct = 0) => A * Math.pow(2, semi / 12 + oct);
    let prog, tempo, mel;
    if (name === 'menu') {
      // Am - G - F - E
      prog = [[0, 7, 12, 15, 19, 15, 12, 7], [-2, 5, 10, 14, 17, 14, 10, 5], [-4, 3, 8, 12, 15, 12, 8, 3], [-5, 2, 7, 11, 14, 11, 7, 2]];
      tempo = 0.24; mel = [24, 27, 26, 24, 22, 24, 19, null, 24, 27, 29, 31, 29, 27, 26, 23];
    } else if (name === 'death') {
      prog = [[0, 7, 12, 15], [-4, 3, 8, 12], [-5, 2, 7, 11], [0, 7, 12, 15]]; tempo = 0.5; mel = null;
    } else {
      prog = [[0, 7, 12, 16, 19, 16], [5, 12, 17, 21, 24, 21], [7, 14, 19, 23, 26, 23], [0, 7, 12, 16, 19, 16]]; tempo = 0.32; mel = null;
    }
    const seq = { name, step: 0, next: this.ctx.currentTime + 0.1, alive: true };
    this.seq = seq;
    const tick = () => {
      if (!seq.alive) return;
      while (seq.next < this.ctx.currentTime + 0.3) {
        const bar = Math.floor(seq.step / prog[0].length) % prog.length;
        const n = prog[bar][seq.step % prog[bar].length];
        const when = seq.next - this.ctx.currentTime;
        this.pluck(note(n, 1), 0.22, Math.max(0, when), this.music);
        if (seq.step % prog[0].length === 0) this.pluck(note(n, 0), 0.3, Math.max(0, when), this.music);
        if (mel && seq.step % 2 === 0) {
          const m = mel[(seq.step / 2) % mel.length];
          if (m !== null && m !== undefined && Math.random() < 0.9) this.whistleNote(note(m, 1), tempo * 1.8, Math.max(0, when));
        }
        seq.step++;
        seq.next += tempo * (name === 'explore' && Math.random() < 0.2 ? 2 : 1);
      }
      seq.timer = setTimeout(tick, 100);
    };
    tick();
  },
  whistleNote(freq, dur, when) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = freq * 0.012; lfo.connect(lg); lg.connect(o.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.music); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  },
  stopMusic() { if (this.seq) { this.seq.alive = false; clearTimeout(this.seq.timer); this.seq = null; } this.pendingMusic = null; },
};
