'use strict';
/* ==========================================================
   FRONTIER'S END — ses (WebAudio): efektler, ortam, müzik, konuşma
   Karışım: her olay bir kanala gider (silah/foley, ortam, arayüz, müzik,
   konuşma); kanallar ortak bir yapıştırıcı kompresörden ve en sonda bir
   sınırlayıcıdan geçer. Dünyadaki sesler konumlarına göre sağa-sola
   yerleşir, uzaklıkla kısılır ve tizlerini yitirir, duvar arkasından
   boğuk gelir; bulunulan yerin yankısı (oda, saloon, sokak, kanyon,
   orman, açık ova, maden) üzerlerine eklenir. Silah sesi ve konuşma
   müziği ve ortamı kısar (ducking).
   Ses dosyaları audio/sfx/ altındadır (manifest.json, tools/sfx-manifest.js
   yazar); bir olayın dosyası yoksa ya da tarayıcı çözemiyorsa prosedürel
   sese düşülür.
   Konuşmalar audio/vo/<dil>/<anahtar>.ogg|mp3 (bkz. voiceKey).
   ========================================================== */

const Audio_ = {
  ctx: null, master: null, sfx: null, music: null, amb: null,
  noise: null, plucks: new Map(),
  vol: { master: 0.7, sfx: 0.7, music: 0.4, amb: 0.5 },
  loops: {},
  seq: null,

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    // son katman: tepe sınırlayıcı (bozulmayı önler) → ana ses
    this.master = c.createGain();
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    this.master.connect(lim); lim.connect(c.destination);
    this.limiter = lim;
    // yapıştırıcı kompresör: efekt, ortam ve prosedürel müzik birlikte nefes alır
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
    comp.connect(this.master);
    this.glue = comp;
    this.sfx = c.createGain(); this.sfx.connect(comp);
    // ortam ve müzik kısma (ducking) düğümlerinden geçer
    this.duckAmb = c.createGain(); this.duckAmb.connect(comp);
    this.duckMus = c.createGain(); this.duckMus.connect(comp);
    this.music = c.createGain(); this.music.connect(this.duckMus);
    // ortam: içerideyken yağmur ve rüzgâr duvarın ardından boğuk duyulur
    this.ambLP = c.createBiquadFilter(); this.ambLP.type = 'lowpass'; this.ambLP.frequency.value = 20000; this.ambLP.Q.value = 0.4;
    this.ambLP.connect(this.duckAmb);
    this.amb = c.createGain(); this.amb.connect(this.ambLP);
    this.duckRec = c.createGain(); this.duckRec.connect(this.master);
    this.rec = c.createGain(); this.rec.connect(this.duckRec); // kayıtlı müzik (kompresörsüz)
    this.uiBus = c.createGain(); this.uiBus.connect(this.master);
    this.voiceBus = c.createGain(); this.voiceBus.connect(this.master);
    this.buildReverb();
    this.loadBank();
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
    if (this.uiBus) this.uiBus.gain.value = this.vol.sfx * 0.9;
    if (this.voiceBus) this.voiceBus.gain.value = Math.max(this.vol.sfx, 0.6);
  },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  },
  noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; },

  /* kind: pistol | repeater | rifle | shotgun | bow; x, y verilirse konumlu (uzaklık, yön, yankı) */
  shot(kind = 'pistol', v = 1, x, y) {
    if (!this.ctx || v < 0.02) return;
    if (this.play('gun_' + kind, { vol: v, x, y }) || (kind === 'repeater' && this.play('gun_pistol', { vol: v, x, y, rate: 0.92 }))) {
      // yakındaki silah sesi ortamı ve müziği bir an bastırır
      const L = this.listener(), d = x !== undefined && L ? Math.hypot(x - L.x, y - L.y) : 0;
      if (kind !== 'bow' && d < 500) this.duck(0.5 * (1 - d / 500) * v, 0.15, 1.6);
      return;
    }
    if (kind === 'repeater') kind = 'pistol';
    let far = 0;
    if (x !== undefined) { const L = this.listener(); if (L) { const dd = Math.hypot(x - L.x, y - L.y); v *= Math.max(0.1, 1 - dd / 900); far = clamp(dd / 700, 0, 1); } }
    const c = this.ctx, t = c.currentTime, out = c.createGain();
    // uzaktaki atış tizini yitirir
    const air = c.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 9000 - far * 6500;
    out.connect(air); air.connect(this.sfx);
    if (this.revIn) { const sg = c.createGain(); sg.gain.value = 0.35 + far * 0.4; air.connect(sg); sg.connect(this.revIn); }
    const burst = (type, freq, q, a, peak, dcy, rate = 1, off = 0) => {
      const n = this.noiseSrc(); n.playbackRate.value = rate;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = c.createGain(); this.env(g, t + off, a, peak, dcy);
      n.connect(f); f.connect(g); g.connect(out); n.start(t + off, Math.random() * 1.5); n.stop(t + off + a + dcy + 0.05);
    };
    if (kind === 'bow') {
      // kirişin tok "tunk"u ve okun hışırtısı
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.12);
      const og = c.createGain(); this.env(og, t, 0.003, 0.16 * v, 0.14); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.2);
      burst('bandpass', 2600, 1.2, 0.02, 0.05 * v, 0.16, 1, 0.02);
      return;
    }
    const P = { pistol: { crack: 3200, body: 1100, boom: 120, tail: 0.45, k: 2.3 }, rifle: { crack: 2600, body: 850, boom: 95, tail: 0.75, k: 2.5 }, shotgun: { crack: 1900, body: 650, boom: 80, tail: 0.6, k: 2.6 } }[kind] || { crack: 3200, body: 1100, boom: 120, tail: 0.45, k: 2.3 };
    v *= P.k;
    // 1) çatırtı: çok kısa, tiz patlama
    burst('highpass', P.crack, 0.7, 0.0008, 0.5 * v * (1 - far * 0.7), 0.025);
    // 2) gövde: barutun orta frekanslı "pat"ı
    burst('bandpass', P.body, 0.9, 0.001, 0.55 * v, 0.09, 0.8);
    // 3) gümbürtü: göğse vuran alçak darbe
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(P.boom, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const og = c.createGain(); this.env(og, t, 0.002, 0.5 * v, 0.24); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.3);
    // 4) kuyruk: açık havada yuvarlanan, koyu yankı
    burst('lowpass', 700, 0.5, 0.02, 0.16 * v, P.tail, 0.5, 0.01);
    const L = this.listener(), dd = x !== undefined && L ? Math.hypot(x - L.x, y - L.y) : 0;
    if (dd < 500) this.duck(0.35 * (1 - dd / 500) * v, 0.12, 1.4);
  },
  boom(v = 1, x, y) {
    if (!this.ctx) return;
    if (this.play('explosion', { vol: x !== undefined ? 1 : v, x, y })) { this.duck(0.7 * v, 0.4, 2.5); return; }
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); n.playbackRate.value = 0.4;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); n.connect(f); f.connect(g); g.connect(this.sfx);
    if (this.revIn) { const sg = c.createGain(); sg.gain.value = 0.4; g.connect(sg); sg.connect(this.revIn); }
    this.env(g, t, 0.005, 0.8 * v, 1.6); n.start(t); n.stop(t + 1.8);
    const o = c.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    const og = c.createGain(); this.env(og, t, 0.004, 0.7 * v, 0.7); o.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + 0.8);
    this.duck(0.6 * v, 0.3, 2.2);
  },
  thunder() {
    if (!this.ctx) return;
    if (this.play('thunder', { when: 0.3 + Math.random() * 1.2, vol: 0.8 + Math.random() * 0.3 })) return;
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
    // kare ve testere dalgasının sert üst harmonikleri kırpılır: bip yerine yumuşak bir tını
    const harsh = type === 'square' || type === 'sawtooth';
    const g = c.createGain(); this.env(g, t, 0.01, harsh ? v * 0.65 : v, dur);
    if (harsh) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(3200, Math.max(freq, slide || 0) * 2.2); f.Q.value = 0.5;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  thud(v = 0.6, x, y) {
    if (!this.ctx) return;
    if (this.play('thud', { vol: v * 1.4, x, y })) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    const g = c.createGain(); this.env(g, t, 0.003, v, 0.14);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.2);
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
    const ng = c.createGain(); this.env(ng, t, 0.002, v * 0.4, 0.06); n.connect(f); f.connect(ng); ng.connect(this.sfx); n.start(t); n.stop(t + 0.1);
  },
  /* Kalp atışı (düşük sağlık): "lub" daha dolgun, "dub" daha kısa ve tiz */
  heart(v = 0.3, dub) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(dub ? 78 : 64, t); o.frequency.exponentialRampToValueAtTime(dub ? 46 : 36, t + 0.12);
    const g = c.createGain(); this.env(g, t, 0.006, v, dub ? 0.1 : 0.16);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.26);
  },
  /* ayak sesi / toynak: zemin konumdan bulunur (kum, çimen, taş, tahta, çamur, kar, su, toprak) */
  step(v = 0.08, hoof, x, y) {
    if (!this.ctx) return;
    const L = this.listener();
    const px = x !== undefined ? x : L ? L.x : 0, py = y !== undefined ? y : L ? L.y : 0;
    const pre = hoof ? 'hoof_' : 'step_', nm = this.has(pre + this.surface(px, py)) ? pre + this.surface(px, py) : pre + 'dirt';
    if (this.play(nm, { vol: Math.min(1.6, v * (hoof ? 9 : 12)), x: x !== undefined ? x : undefined, y })) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hoof ? 500 : 1400; f.Q.value = hoof ? 3 : 1;
    const g = c.createGain(); this.env(g, t, 0.002, v, hoof ? 0.07 : 0.05);
    n.connect(f); f.connect(g); g.connect(this.sfx); n.start(t, Math.random()); n.stop(t + 0.1);
  },
  ui(kind) {
    if (!this.ctx) return;
    const U = { move: 'ui_move', ok: 'ui_ok', back: 'ui_back', error: 'ui_error', cash: 'coins', pick: 'ui_pick' };
    if (U[kind] && this.play(U[kind])) return;
    if (kind === 'move') this.tone(880, 0.05, 'triangle', 0.05);
    else if (kind === 'ok') { this.tone(660, 0.08, 'triangle', 0.08); this.tone(990, 0.1, 'triangle', 0.06, null, 0.05); }
    else if (kind === 'back') this.tone(440, 0.08, 'triangle', 0.06, null, 0, 330);
    else if (kind === 'error') this.tone(180, 0.2, 'square', 0.05);
    else if (kind === 'cash') { this.tone(1568, 0.1, 'triangle', 0.035, this.uiBus); this.tone(2093, 0.22, 'sine', 0.03, this.uiBus, 0.07); }
    else if (kind === 'pick') this.tone(1200, 0.06, 'sine', 0.08, null, 0, 1600);
  },
  chime() {
    if (!this.ctx) return;
    if (this.play('chime')) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.05, this.uiBus, i * 0.09));
    [1047, 1319].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.02, this.uiBus, 0.4 + i * 0.1));
  },
  discover() {
    if (!this.ctx) return;
    if (this.play('discover')) return;
    [220, 330, 440].forEach((f, i) => this.pluck(f, 0.12, i * 0.12, this.uiBus));
    this.pluck(554, 0.1, 0.42, this.uiBus);
  },
  whistle() {
    if (!this.ctx) return;
    if (this.play('whistle')) return;
    this.tone(1500, 0.18, 'sine', 0.12, null, 0, 2300);
    this.tone(2300, 0.3, 'sine', 0.12, null, 0.22, 1700);
  },
  neigh(x, y) {
    if (!this.ctx) return;
    if (this.play('horse_neigh', { x, y })) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(900, t + 0.15); o.frequency.linearRampToValueAtTime(500, t + 0.8);
    const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
    const g = c.createGain(); this.env(g, t, 0.05, 0.08, 0.8);
    o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t); lfo.start(t); o.stop(t + 0.9); lfo.stop(t + 0.9);
  },
  growl(type, x, y) {
    if (!this.ctx) return;
    if (this.play(type === 'bear' ? 'growl_bear' : type === 'cougar' ? 'cougar' : 'growl', { x, y })) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); n.playbackRate.value = 0.3;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 4;
    const g = c.createGain(); this.env(g, t, 0.05, 0.35, 0.7);
    n.connect(f); f.connect(g); g.connect(this.sfx); n.start(t); n.stop(t + 0.8);
  },
  train(x, y) {
    if (!this.ctx) return;
    if (this.play('train_whistle', { x, y })) return;
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
    this.loops.rain = mk('bandpass', 2600, 0.45);
    this.loops.wind = mk('bandpass', 420, 0.8);
    this.loops.fire = mk('bandpass', 2400, 0.5);
    this.loops.water = mk('bandpass', 700, 0.6);
    this.loops.gallop = mk('lowpass', 300);
  },
  /* ortam döngüsü seviyesi: örnekli döngü hazırsa o çalar, prosedürel olan susar */
  LOOPGAIN: { wind: 0.95, rain: 1.6, fire: 3.9, water: 2.0, crickets: 1.28, crowd: 1.8, storm: 1.2 },
  setLoop(name, v) {
    const S = this.sloops && this.sloops[name], L = this.loops[name], t = this.ctx.currentTime;
    if (S) { S.g.gain.setTargetAtTime(v * (this.LOOPGAIN[name] || 1), t, 0.6); if (L) L.g.gain.setTargetAtTime(0, t, 0.2); return; }
    if (L) L.g.gain.setTargetAtTime(v, t, 0.4);
  },
  ambientTick(env) {
    if (!this.ctx) return;
    this.setLoop('rain', env.rain * (this.sloops.rain ? 0.35 : 0.075));
    this.setLoop('wind', env.wind * 0.3);
    this.setLoop('fire', env.fire * (this.sloops.fire ? 0.12 : 0.06));
    this.setLoop('water', env.water * 0.12);
    this.loops.wind.f.frequency.setTargetAtTime(300 + Math.sin(this.ctx.currentTime * 0.3) * 150, this.ctx.currentTime, 1);
    this.setLoop('storm', env.storm ? 0.25 : Math.max(0, env.wind - 0.5) * 0.3);
    this.setLoop('crickets', env.night && !env.indoor && env.rain < 0.3 ? 0.14 * env.nature : 0);
    this.setLoop('crowd', env.town && !env.night ? 0.1 : env.town ? 0.04 : 0);
    // örnekli tekil ortam sesleri: kuşlar, baykuş, şahin, kurt ve çakal ulumaları (dosyası olan çalar)
    const L = this.listener(), far = (r) => L ? { x: L.x + (Math.random() * 2 - 1) * r, y: L.y + (Math.random() * 2 - 1) * r } : {};
    if (env.night && !env.indoor && Math.random() < 0.004 * env.nature) this.play('owl', far(800));
    if (!env.night && !env.town && Math.random() < 0.002) this.play('hawk', far(900));
    if (env.night && !env.wolves && !env.town && Math.random() < 0.003) this.play('coyote_howl', far(1500));
    // cırcır böcekleri ve kuşlar (dosyası yoksa prosedürel)
    if (!this.sloops.crickets && env.night && Math.random() < 0.08 * env.nature) {
      const f = 4200 + Math.random() * 600;
      for (let k = 0; k < 3; k++) this.tone(f, 0.03, 'sine', 0.018, this.amb, k * 0.06);
    }
    if (!env.night && Math.random() < 0.03 * env.nature && env.rain < 0.2 && !(env.indoor && this.has('bird')) && !this.play('bird', far(500))) {
      const f = 2000 + Math.random() * 1800;
      this.tone(f, 0.12, 'sine', 0.025, this.amb, 0, f * (Math.random() < 0.5 ? 1.4 : 0.7));
      if (Math.random() < 0.5) this.tone(f * 1.2, 0.1, 'sine', 0.02, this.amb, 0.15, f);
    }
    if (env.night && env.wolves && Math.random() < 0.004 && !this.play('wolf_howl', far(1600))) {
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
  /* Yakındaki NPC'lerin, atların ve arabaların adım/toynak sesleri: kat edilen yola göre */
  footTick(e, dt) {
    if (!this.ctx || !(this.bank.step_dirt || this.bank.hoof_dirt)) return;
    if (e._sx === undefined) { e._sx = e.x; e._sy = e.y; e._fa = 0; return; }
    const d = Math.hypot(e.x - e._sx, e.y - e._sy); e._sx = e.x; e._sy = e.y;
    if (d > 40 || d < 0.01) return;      // ışınlanma ya da duruş
    const hoof = e.kind === 'horse' || e.kind === 'wagon' || !!e.mounted, sp = d / Math.max(dt, 0.001);
    if (!this.has(hoof ? 'hoof_dirt' : 'step_dirt')) return;   // örneği yoksa uzaktaki adımlar sessiz
    // atlar: hız kare kare oynar, yumuşatılmış hızla yürüyüş ritmi (adım, tırıs, eşkin, dörtnala)
    if (hoof) { e._sps = (e._sps || sp) + (sp - (e._sps || sp)) * Math.min(1, dt * 6); this.hoofTick(e, dt, e._sps, e.x, e.y, 0.7); return; }
    e._fa += d;
    const stride = hoof ? (sp > 110 ? 30 : 20) : (sp > 60 ? 16 : 12);
    if (e._fa < stride) return;
    e._fa = 0;
    this.step(hoof ? 0.05 + Math.min(0.06, sp / 3000) : 0.035 + Math.min(0.03, sp / 3000), hoof, e.x, e.y);
  },
  /* At yürüyüş ritmi. Hızdan yürüyüş biçimi seçilir; her döngüde o biçimin vuruşları kendi zamanlamasıyla,
     kendi ağırlığıyla çalar (gerçek atta olduğu gibi):
       adım     — dört eşit aralıklı, yumuşak vuruş ("tık-tak-tık-tak")
       tırıs    — iki net vuruş (çapraz bacaklar birlikte basar)
       eşkin    — üç vuruş ve kısa bir boşluk ("ta-ta-tam ... ")
       dörtnala — dört vuruşluk hızlı yuvarlanma, en sonuncusu vurgulu, ardından havada geçen boşluk
     Döngü süresi biçimin içinde hızla kısalır. Döner: bu karede çalan vuruş sayısı (toz efekti için). */
  GAITS: [
    { max: 52,  cyc: [1.2, 0.9],   beats: [[0, 0.8], [0.25, 0.55], [0.5, 0.75], [0.75, 0.55]] },
    { max: 125, cyc: [0.7, 0.54],  beats: [[0, 1], [0.5, 0.85]] },
    { max: 152, cyc: [0.58, 0.5],  beats: [[0, 0.75], [0.17, 0.85], [0.34, 1]] },
    { max: 1e9, cyc: [0.47, 0.4],  beats: [[0, 0.7], [0.12, 0.78], [0.24, 0.86], [0.4, 1]] },
  ],
  hoofTick(e, dt, spd, x, y, gain = 1) {
    if (spd < 8) { e._gait = null; e._gp = 0; e._gb = 0; return 0; }   // durunca döngü baştan başlar
    const Gs = this.GAITS, gi = Gs.findIndex(g => spd < g.max), Gt = Gs[gi];
    const lo = gi ? Gs[gi - 1].max : 8, hi = Gt.max < 1e8 ? Gt.max : 200;
    const cyc = lerp(Gt.cyc[0], Gt.cyc[1], clamp((spd - lo) / (hi - lo), 0, 1));
    if (e._gait !== Gt) { e._gait = Gt; e._gp = 0; e._gb = 0; }
    e._gp += dt / cyc;
    let n = 0;
    const base = (0.055 + Math.min(0.07, spd / 2600)) * gain;
    while (e._gb < Gt.beats.length && e._gp >= Gt.beats[e._gb][0]) { this.step(base * Gt.beats[e._gb][1], true, x, y); e._gb++; n++; }
    if (e._gp >= 1) { e._gp -= 1; e._gb = 0; }
    return n;
  },
  /* silah adından ses türü */
  gunKind(w) { return w === 'rifle' ? 'rifle' : w === 'shotgun' ? 'shotgun' : w === 'repeater' || w === 'winchester' ? 'repeater' : w === 'bow' ? 'bow' : 'pistol'; },
  update(dt) {
    this.clock += dt;
    if (!this.ctx) return;
    this.envUpdate(dt);
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

/* ==========================================================
   Örnek tabanlı ses motoru
   ========================================================== */
/* Mekân yankıları: [süre (sn), sönüm eğrisi, erken yansımalar (sn), ıslaklık, parlaklık (Hz)] */
const REVERBS = {
  open:   { len: 1.2, decay: 2.6, early: [0.09, 0.21], wet: 0.12, lp: 2600 },     // açık ova: uzaktan tek tük yankı
  street: { len: 1.0, decay: 3.2, early: [0.018, 0.035, 0.06, 0.11], wet: 0.24, lp: 3800 },   // kasaba: cephelerden slapback
  canyon: { len: 3.2, decay: 2.0, early: [0.16, 0.31, 0.52, 0.8], wet: 0.4, lp: 2400 },        // kanyon: uzun tekrarlayan yankı
  forest: { len: 1.6, decay: 3.0, early: [0.03, 0.05, 0.08], wet: 0.2, lp: 1800 },             // orman: yaprakta boğulan, yayvan
  room:   { len: 0.5, decay: 4.5, early: [0.006, 0.011, 0.017], wet: 0.28, lp: 5000 },         // küçük oda: tahta, kuru
  hall:   { len: 1.3, decay: 3.4, early: [0.012, 0.024, 0.04], wet: 0.34, lp: 4200 },          // saloon, otel, kilise
  cave:   { len: 2.6, decay: 2.4, early: [0.02, 0.045, 0.07, 0.1], wet: 0.5, lp: 3000 },       // maden
};
Object.assign(Audio_, {
  bank: {}, sloops: {}, man: null, canOgg: true, voices: [], revName: null, envT: 0,
  /* Yankı: iki evrişim arasında yumuşak geçiş */
  buildReverb() {
    const c = this.ctx;
    this.revIn = c.createGain();
    this.revOut = c.createGain(); this.revOut.connect(this.glue);
    this.revA = { conv: c.createConvolver(), g: c.createGain() };
    this.revB = { conv: c.createConvolver(), g: c.createGain() };
    for (const R of [this.revA, this.revB]) { this.revIn.connect(R.conv); R.conv.connect(R.g); R.g.connect(this.revOut); R.g.gain.value = 0; }
    this.irs = {};
    this.setReverb('open', true);
  },
  makeIR(name) {
    if (this.irs[name]) return this.irs[name];
    const P = REVERBS[name], c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * P.len);
    const buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lpv = 0; const a = Math.exp(-2 * Math.PI * P.lp / sr);
      for (let i = 0; i < len; i++) {
        const t = i / sr, e = Math.exp(-t * P.decay) * Math.min(1, t / 0.008);
        lpv = lpv * a + (Math.random() * 2 - 1) * (1 - a);    // basit alçak geçiren: kuyruk koyulaşır
        d[i] = lpv * e * 2.2;
      }
      // erken yansımalar (sağ ve sol kanalda biraz farklı)
      P.early.forEach((tm, k) => { const i = Math.floor((tm * (1 + (ch ? 0.07 : -0.05) * (k + 1))) * sr); if (i < len) d[i] += (0.7 - k * 0.12) * (ch ? 0.9 : 1); });
    }
    return (this.irs[name] = buf);
  },
  setReverb(name, instant) {
    if (!this.ctx || this.revName === name || !REVERBS[name]) return;
    this.revName = name;
    const t = this.ctx.currentTime, P = REVERBS[name];
    const [on, off] = this.revA.on ? [this.revB, this.revA] : [this.revA, this.revB];
    on.conv.buffer = this.makeIR(name); on.on = true; off.on = false;
    on.g.gain.cancelScheduledValues(t); off.g.gain.cancelScheduledValues(t);
    on.g.gain.setTargetAtTime(P.wet, t, instant ? 0.01 : 0.35);
    off.g.gain.setTargetAtTime(0, t, instant ? 0.01 : 0.35);
  },
  /* Oyuncunun bulunduğu yere göre yankı (her yarım saniyede) */
  envUpdate(dt) {
    if (!this.ctx || typeof G === 'undefined' || !G.player || !G.world || G.state !== 'play') return;
    if ((this.envT -= dt) > 0) return;
    this.envT = 0.5;
    const P = G.player, W = G.world, b = G.insideB;
    let r = 'open';
    if (b) r = b.def.mine ? 'cave' : (b.type === 'saloon' || b.type === 'hotel' || b.type === 'church' || b.type === 'gambling' || b.type === 'cantina' || b.def.w >= 11) ? 'hall' : 'room';
    else if (W.townAt(P.x, P.y, 4)) r = 'street';
    else {
      const n = {};
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, bb = W.biomeAt(P.x + Math.cos(a) * 160, P.y + Math.sin(a) * 160); n[bb] = (n[bb] || 0) + 1; }
      if ((n.REDROCK || 0) + (n.MESA || 0) + (n.CLIFF || 0) + (n.ROCK || 0) + (n.SNOWCLIFF || 0) >= 3) r = 'canyon';
      else if ((n.FOREST || 0) >= 4) r = 'forest';
    }
    this.setReverb(r);
    this.listenerIn = b || null;
    this.ambLP.frequency.setTargetAtTime(b ? 700 : 20000, this.ctx.currentTime, 0.25);
  },

  /* ---- örnek bankası ---- */
  loadBank() {
    const a = document.createElement('audio');
    this.canOgg = !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"'));
    if (window.__testNoSfx) return;
    fetch('audio/sfx/manifest.json').then(r => r.ok ? r.json() : null).then(m => {
      if (!m) return;
      this.man = m;
      // önce sık kullanılanlar, sonra hepsi; çözümleme sırayla (ana iş parçacığını boğmadan)
      const pri = ['ui_', 'step_', 'hoof_', 'gun_', 'amb_'];
      const names = Object.keys(m).sort((x, y) => (pri.findIndex(p => x.startsWith(p)) + 1 || 9) - (pri.findIndex(p => y.startsWith(p)) + 1 || 9));
      const queue = [];
      // Safari .ogg açamaz: aynı adlı .mp3 yedeği varsa o yüklenir
      for (const nm of names) for (const f of m[nm].files || []) {
        const g = /\.ogg$/i.test(f) && !this.canOgg ? (m[nm].alt || {})[f] : f;
        if (g) queue.push([nm, g]);
      }
      let busy = 0;
      const next = () => {
        while (busy < 4 && queue.length) {
          const [nm, f] = queue.shift(); busy++;
          fetch('audio/sfx/' + encodeURIComponent(f)).then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
            .then(buf => { if (m[nm].loop && /\.mp3$/i.test(f)) buf = this.trimPad(buf); const B = this.bank[nm] || (this.bank[nm] = { bufs: [], last: -1 }); B.bufs.push(buf); if (m[nm].loop) this.loopReady(nm); })
            .catch(() => {}).finally(() => { busy--; next(); });
        }
      };
      next();
    }).catch(() => {});
  },
  has(name) { const B = this.bank[name]; return !!(B && B.bufs.length); },
  /* MP3 kodlayıcısı başa ve sona birkaç milisaniyelik sessizlik ekler; döngüde bu bir tıkırtı/boşluk olur.
     Baştaki ve sondaki neredeyse sessiz örnekler (en çok ~70 ms) kırpılır. */
  trimPad(buf) {
    const d = buf.getChannelData(0), n = d.length, lim = Math.min(3000, n >> 3), th = 0.0015;
    let a = 0, b = n;
    while (a < lim && Math.abs(d[a]) < th) a++;
    while (n - b < lim && Math.abs(d[b - 1]) < th) b--;
    if (a === 0 && b === n) return buf;
    const out = this.ctx.createBuffer(buf.numberOfChannels, b - a, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a, b));
    return out;
  },
  /* Dinleyici: oyuncu (yoksa kamera) */
  listener() { return typeof G !== 'undefined' && G.player ? G.player : null; },
  /* Bir örneği çal. o: { x, y (dünya konumu), vol, rate, bus, when, loop, dist, rev, muffle }
     Dönen kulp: { src, g, stop(fade) }; banka hazır değilse null (çağıran prosedürel sese düşer) */
  play(name, o = {}) {
    if (!this.ctx || !this.has(name)) return null;
    const c = this.ctx, B = this.bank[name], M = (this.man && this.man[name]) || {};
    // aynı örnek art arda çalmasın
    let k = Math.floor(Math.random() * B.bufs.length);
    if (B.bufs.length > 1 && k === B.last) k = (k + 1 + Math.floor(Math.random() * (B.bufs.length - 1))) % B.bufs.length;
    B.last = k;
    let vol = (o.vol === undefined ? 1 : o.vol) * (M.vol === undefined ? 1 : M.vol);
    // uzamsal: uzaklık, yön, duvar
    let pan = 0, cut = 20000, wet = (M.rev === undefined ? 0.3 : M.rev) * (o.rev === undefined ? 1 : o.rev);
    const L = this.listener();
    if (o.x !== undefined && L) {
      const dx = o.x - L.x, dy = o.y - L.y, d = Math.hypot(dx, dy), maxD = o.dist || M.dist || 900, ref = Math.min(140, maxD * 0.25);
      if (d > maxD) return null;
      const fall = d <= ref ? 1 : Math.pow(ref / d, 1.15);
      vol *= fall * Math.min(1, (maxD - d) / (maxD * 0.25));      // menzilin sonunda yumuşakça kaybolur
      pan = Math.max(-1, Math.min(1, dx / 340)) * 0.8;
      cut = 20000 * Math.pow(1 - Math.min(1, d / maxD), 1.6) + 900;
      wet *= 1 + Math.min(1.5, d / 400);                         // uzaktaki ses daha "odalı"
      // duvar arkası: dinleyici ve kaynak farklı yerlerdeyse boğuk
      const W = G.world, sb = W && W.buildingAtPx(o.x, o.y), lb = G.insideB || null;
      if ((sb || null) !== lb) { cut = Math.min(cut, sb && lb ? 700 : 1100); vol *= 0.55; wet *= 0.6; }
    }
    if (o.muffle) cut = Math.min(cut, o.muffle);
    if (vol < 0.004) return null;
    // aynı sesten aynı anda en fazla
    const maxN = M.max || 4;
    const same = this.voices.filter(v => v.name === name && !v.done);
    if (same.length >= maxN) { same.sort((a, b) => a.t - b.t)[0].stop(0.03); }
    if (this.voices.length > 40) this.voices.filter(v => !v.done).sort((a, b) => a.vol - b.vol)[0].stop(0.03);
    const t = c.currentTime + (o.when || 0);
    const src = c.createBufferSource(); src.buffer = B.bufs[k];
    const pv = M.pitch || 0;
    src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * pv);
    if (o.loop) src.loop = true;
    let node = src;
    if (cut < 19000) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 0.5; node.connect(f); node = f; }
    const g = c.createGain(); g.gain.value = vol * (0.92 + Math.random() * 0.16);
    node.connect(g); node = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    const bus = o.bus || M.bus || 'sfx';
    node.connect(bus === 'ui' ? this.uiBus : bus === 'amb' ? this.amb : bus === 'voice' ? this.voiceBus : bus === 'music' ? this.music : this.sfx);
    if (wet > 0.01 && bus !== 'ui') { const s = c.createGain(); s.gain.value = Math.min(1.5, wet); g.connect(s); s.connect(this.revIn); }
    src.start(t);
    const V = { name, src, g, t: c.currentTime, vol, done: false, stop: (fd = 0.08) => { if (V.done) return; V.done = true; const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, fd / 3); try { src.stop(n + fd); } catch (e) {} } };
    src.onended = () => { V.done = true; this.voices = this.voices.filter(v => v !== V); };
    this.voices.push(V);
    return V;
  },
  /* Ortamı ve müziği kısa süre kıs: amt 0..1 (kısılma oranı), sürede geri gel */
  /* konuşma sürerken müzik ve ortamın oturduğu seviye */
  duckBase(k) { return this.voiceOn ? (k === 'amb' ? 0.6 : 0.4) : 1; },
  duck(amt, hold = 0.2, rel = 1.2, what = 'all') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [n, k] of [[this.duckAmb, 'amb'], [this.duckMus, 'mus'], [this.duckRec, 'mus']]) {
      if (what !== 'all' && what !== k) continue;
      const base = this.duckBase(k), lv = Math.min(base, 1 - amt), cur = n.gain.value;
      n.gain.cancelScheduledValues(t); n.gain.setValueAtTime(cur, t);
      n.gain.linearRampToValueAtTime(Math.min(cur, lv), t + 0.03);
      n.gain.setTargetAtTime(base, t + 0.03 + hold, rel / 3);
    }
  },

  /* ---- zemin ---- */
  surface(x, y) {
    if (typeof G === 'undefined' || !G.world) return 'dirt';
    const W = G.world;
    if (W.indoorPx(x, y)) return 'wood';
    const t = W.tileAtPx(x, y);
    switch (t) {
      case T.GRASS: case T.FOREST: case T.FARM: return 'grass';
      case T.SAND: case T.DESERT: return 'sand';
      case T.ROCK: case T.CLIFF: case T.REDROCK: case T.MESA: case T.SNOWCLIFF: case T.COBBLE: case T.PAVE: return 'stone';
      case T.PLANK: case T.BRIDGE: return 'wood';
      case T.MUD: case T.SWAMP: return 'mud';
      case T.SNOW: return 'snow';
      case T.WATER: case T.DEEP: case T.HOTWATER: return 'water';
      default: return 'dirt';
    }
  },

  /* ---- ortam döngüleri (örnekli): hazır olunca prosedürel döngünün yerini alır ---- */
  LOOPMAP: { wind: 'amb_wind', rain: 'amb_rain', fire: 'amb_fire', water: 'amb_river', crickets: 'amb_crickets', crowd: 'amb_crowd', storm: 'amb_wind_strong' },
  loopReady(nm) {
    const key = Object.keys(this.LOOPMAP).find(k => this.LOOPMAP[k] === nm);
    if (!key) return;
    if (this.sloops[key]) return;
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.bank[nm].bufs[0]; src.loop = true;
    const g = c.createGain(); g.gain.value = 0; src.connect(g); g.connect(this.amb);
    try { src.start(c.currentTime, Math.random() * src.buffer.duration); } catch (e) { src.start(); }
    this.sloops[key] = { src, g };
    if (this.loops[key]) this.loops[key].g.gain.value = 0;
  },

  /* ---- konuşma (seslendirme) ----
     Bir diyalog satırının anahtarı: satırın o dildeki metninden türetilen kısa bir özet (voiceKey).
     Dosya: audio/vo/<dil>/<anahtar>.ogg (ya da .mp3). audio/vo/manifest.json hangi dosyaların
     var olduğunu listeler: { "tr": ["a1b2c3d4", ...], "en": [...] }. tools/vo-script.js bütün
     diyalogları anahtarlarıyla birlikte seslendirme senaryosu olarak dışa aktarır. */
  voiceKey(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  },
  vo: { man: null, bufs: {}, loading: {} },
  voInit() {
    if (this.vo.man !== null) return;
    this.vo.man = false;
    fetch('audio/vo/manifest.json').then(r => r.ok ? r.json() : null).then(m => { this.vo.man = m || {}; }).catch(() => { this.vo.man = {}; });
  },
  voHas(key, lang) { const m = this.vo.man; return !!(m && m[lang] && m[lang].includes(key)); },
  /* Satırın sesini önceden yükle (diyalog kuyruğa girince) */
  voPreload(text, lang) {
    if (!this.ctx) return;
    this.voInit();
    const key = this.voiceKey(text), id = lang + '/' + key;
    if (!this.voHas(key, lang) || this.vo.bufs[id] || this.vo.loading[id]) return;
    const ext = this.canOgg ? 'ogg' : 'mp3';
    this.vo.loading[id] = fetch(`audio/vo/${id}.${ext}`).then(r => r.arrayBuffer()).then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
      .then(b => { this.vo.bufs[id] = b; }).catch(() => {});
  },
  voDur(text, lang) { const b = this.vo.bufs[lang + '/' + this.voiceKey(text)]; return b ? b.duration : 0; },
  /* Satırı seslendir; süresini döndürür (dosya yoksa ya da hazır değilse 0) */
  voice(text, lang, o = {}) {
    if (!this.ctx) return 0;
    const id = lang + '/' + this.voiceKey(text), buf = this.vo.bufs[id];
    if (!buf) { this.voPreload(text, lang); return 0; }
    if (this.voCur) this.voCur.stop(0.05);
    this.bank.__vo = { bufs: [buf], last: -1 };
    const V = this.play('__vo', Object.assign({ bus: 'voice', rev: 0.4 }, o));
    if (!V) return 0;
    this.voCur = V; this.voiceOn = true;
    this.duck(0, 0, 0.5);
    V.src.addEventListener('ended', () => { if (this.voCur === V) { this.voCur = null; this.voiceOn = false; this.duck(0, 0, 1); } });
    return buf.duration;
  },
});
