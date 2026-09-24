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
    this.rec = c.createGain(); this.rec.connect(this.master); // kayıtlı müzik (kompresörsüz)
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startLoops();
    if (this.pendingMusic) { const m = this.pendingMusic; this.pendingMusic = null; this.playSeq(m); }
  },
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.sfx.gain.value = this.vol.sfx;
    this.music.gain.value = this.vol.music * 0.55;
    this.amb.gain.value = this.vol.amb;
    this.rec.gain.value = this.vol.music;
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

  harmonica() {
    if (!this.ctx) return 0;
    const A = 220, n = s => A * Math.pow(2, s / 12);
    const riff = [[7, 0.3], [10, 0.3], [12, 0.6], [10, 0.3], [7, 0.3], [5, 0.6], [3, 0.3], [5, 0.3], [7, 0.9], [0, 0.3], [3, 0.3], [5, 0.3], [7, 0.3], [10, 0.6], [7, 1.2]];
    let t = 0;
    for (const [sm, d] of riff) {
      const c = this.ctx, st = c.currentTime + t;
      for (const [mul, typ, v] of [[1, 'square', 0.025], [2, 'sine', 0.02]]) {
        const o = c.createOscillator(); o.type = typ; o.frequency.setValueAtTime(n(sm) * mul * 0.985, st); o.frequency.linearRampToValueAtTime(n(sm) * mul, st + 0.06);
        const lfo = c.createOscillator(); lfo.frequency.value = 6; const lg = c.createGain(); lg.gain.value = n(sm) * 0.01; lfo.connect(lg); lg.connect(o.frequency);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(v * 3, st + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, st + d * 0.95);
        o.connect(f); f.connect(g); g.connect(this.music); o.start(st); lfo.start(st); o.stop(st + d); lfo.stop(st + d);
      }
      t += d * 0.9;
    }
    return t;
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

  /* ---- Müzik ----
     menu: ana tema (döngü). explore: ana tema -> sessizlik -> prosedürel gitar -> sessizlik ...
     death: prosedürel ağıt. Dosya yüklenemezse prosedürel müziğe düşülür. */
  playMusic(name) {
    if (this.mode === name) return;
    this.mode = name;
    this.stopSeq();
    const th = this.tr && this.tr.theme;
    if (name === 'menu') { if (this.themeOk()) this.phase = { k: 'theme', loop: true }; else this.playSeq('menu'); }
    else if (name === 'explore') {
      // menüden gelen tema çalıyorsa kesme: bitene kadar devam etsin
      if (th && th.busy && !th.failed) { th.el.loop = false; this.phase = { k: 'theme', started: true }; }
      else this.phase = { k: 'quiet', until: this.clock + 25 };
    }
    else { this.phase = null; this.playSeq(name); }
  },
  stopMusic() { this.mode = null; this.phase = null; this.stopSeq(); },
  themeOk() { return !(this.tr && this.tr.theme && this.tr.theme.failed); },

  /* ---- Kayıtlı ses dosyaları: HTMLAudio ile akış (belleğe açılmaz), http'de WebAudio'dan geçer ---- */
  FILES: { theme: 'audio/main-theme.mp3', piano: ['audio/saloon-piano-1.mp3', 'audio/saloon-piano-2.mp3', 'audio/saloon-piano-3.mp3'] },
  GAIN: { theme: 0.8, themePlay: 0.42, piano: 0.85 },   // oyun sırasında tema daha kısık
  clock: 0, tr: null, pianoLevel: 0, pianoMuffle: 1, pianoHold: 0,
  track(key, lowpass) {
    this.tr = this.tr || {};
    if (this.tr[key]) return this.tr[key];
    const el = new window.Audio();
    el.preload = 'none';
    const t = { el, key, vol: 0, fade: 0, target: 0, gain: null, filter: null, routed: false, failed: false, busy: false };
    el.addEventListener('error', () => { t.failed = true; t.busy = false; });
    el.addEventListener('ended', () => { t.busy = false; if (t.onEnd) t.onEnd(); });
    if (this.ctx && /^https?:$/.test(location.protocol)) {
      try {
        const src = this.ctx.createMediaElementSource(el);
        let node = src;
        if (lowpass) { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 18000; f.Q.value = 0.5; src.connect(f); node = f; t.filter = f; }
        const g = this.ctx.createGain(); g.gain.value = 0; node.connect(g); g.connect(this.rec);
        t.gain = g; t.routed = true;
      } catch (e) { t.routed = false; }
    }
    this.tr[key] = t;
    return t;
  },
  startEl(t, src, offset) {
    const el = t.el;
    if (src && el.dataset.src !== src) { el.dataset.src = src; el.src = src; }
    t.busy = true;
    if (offset) {
      const seek = () => { try { el.currentTime = Math.min(offset, (el.duration || offset + 1) * 0.85); } catch (e) {} };
      if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
    }
    const pr = el.play();
    if (pr && pr.catch) pr.catch(() => { t.busy = false; });
  },
  applyTrack(t, v, muffle = 0) {
    if (Math.abs(v - t.vol) < 0.0005 && Math.abs(muffle - (t.muf || 0)) < 0.002) return;
    t.vol = v; t.muf = muffle;
    if (t.routed) {
      t.el.volume = 1;
      t.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.06);
      if (t.filter) t.filter.frequency.setTargetAtTime(18000 * Math.pow(900 / 18000, muffle), this.ctx.currentTime, 0.12);
    } else t.el.volume = clamp(v * this.vol.master * this.vol.music * (1 - muffle * 0.35), 0, 1);
  },
  /* Her karede çağrılır: temayı ve saloon piyanosunu yumuşakça yönetir */
  update(dt) {
    this.clock += dt;
    if (!this.ctx) return;
    // saloon piyanosu
    const P = this.track('piano', true);
    this.pianoHold = Math.max(0, this.pianoHold - dt);
    const want = P.failed ? 0 : this.pianoLevel * (this.pianoHold > 0 ? 0.15 : 1);
    P.fade += (want - P.fade) * Math.min(1, dt * 1.6);
    if (want > 0.002 && !P.failed) {
      if (!P.busy && this.clock >= (P.gapUntil || 0)) {
        // uzun süre duyulmadıysa piyano "bu arada" başka bir parçaya geçmiş olsun
        const fresh = !P.el.dataset.src || P.el.ended || (this.clock - (P.pausedAt || 0) > 25);
        if (fresh) {
          let k; do { k = Math.floor(Math.random() * this.FILES.piano.length); } while (k === P.last && this.FILES.piano.length > 1);
          P.last = k;
          this.startEl(P, this.FILES.piano[k], P.natural ? 0 : rnd(0, 60));
          P.natural = false;
        } else this.startEl(P);
        P.onEnd = () => { P.gapUntil = this.clock + rnd(3, 8); P.el.dataset.src = ''; P.natural = true; };
      }
    } else if (P.fade < 0.003 && P.busy && !P.el.paused) { P.el.pause(); P.busy = false; P.pausedAt = this.clock; }
    this.applyTrack(P, P.fade * this.GAIN.piano, this.pianoMuffle);
    // ana tema
    const T = this.track('theme', false);
    if (this.mode === 'menu' && T.failed && !this.seq) this.playSeq('menu');
    const ph = this.phase;
    let tw = 0;
    if (this.mode === 'explore' && ph) {
      if (ph.k === 'quiet' && this.clock > ph.until) {
        if (ph.next === 'guitar' || T.failed) { this.phase = { k: 'guitar', until: this.clock + rnd(50, 90) }; this.playSeq('explore'); }
        else { this.phase = { k: 'theme' }; T.el.dataset.src = ''; }
      } else if (ph.k === 'guitar' && this.clock > ph.until) { this.stopSeq(); this.phase = { k: 'quiet', until: this.clock + rnd(90, 180), next: 'theme' }; }
    }
    if (this.phase && this.phase.k === 'theme' && !T.failed) {
      tw = 1;
      if (!T.busy) {
        if (this.phase.started && !this.phase.loop) { this.phase = { k: 'quiet', until: this.clock + rnd(120, 240), next: 'guitar' }; tw = 0; }
        else { T.el.loop = !!this.phase.loop; this.startEl(T, this.FILES.theme); this.phase.started = true; }
      }
    }
    tw *= 1 - Math.min(1, P.fade * 1.4);            // piyano duyulurken tema kısılır
    T.fade += (tw - T.fade) * Math.min(1, dt * (tw > T.fade ? 0.5 : 0.9));
    if (tw === 0 && T.fade < 0.003 && T.busy && !T.el.paused && (!this.phase || this.phase.k !== 'theme')) { T.el.pause(); T.busy = false; }
    this.applyTrack(T, T.fade * (this.mode === 'menu' ? this.GAIN.theme : this.GAIN.themePlay));
  },
  playSeq(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.seq && this.seq.name === name) return;
    this.stopSeq();
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
  stopSeq() { if (this.seq) { this.seq.alive = false; clearTimeout(this.seq.timer); this.seq = null; } this.pendingMusic = null; },
};
