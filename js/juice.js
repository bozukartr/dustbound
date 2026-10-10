'use strict';
/* ==========================================================
   FRONTIER'S END — "juice": gerçekçiliği bozmayan his efektleri
   Çatışma:  isabet anında mikro duraklama, yönlü geri tepme ve kamera
             tepmesi, vuruşla savrulan cesetler, uçan şapkalar, NPC namlu
             ışığı, dinamitte yanık izi, şok dalgası ve eğilen bitkiler.
   Çevre:    toz şeytanları, ıslak zemin ve su birikintileri (gece ışık
             yansıması), suda parıltı ve sıçrayan balık, süzülen şahin
             gölgesi, ateş böcekleri, güneşe göre uzayıp dönen gölgeler.
   Kasaba:   salınan saloon kapıları, dalgalanan bayraklar ve çamaşırlar,
             gece ilerledikçe sönen pencereler, titreyen lambalar.
   Arayüz:   hasar yönü göstergesi (ekran kenarında kırmızı iz).
   Ayarlar > Ekran sarsıntısı kapalıysa duraklama ve tepme de kapalıdır.
   ========================================================== */

/* Tuval ekrandan bu oranda büyük çizilir (dörtnala uzaklaşma payı) */
const OVERSCAN = 1.08;

const Juice = {
  hats: [], decals: [], flashes: [], blasts: [], devils: [], fish: [], flies: [], hits: [],
  hawk: null, wet: 0, sunDx: 0, sunLen: 0, sunOn: false,

  reset() {
    this.hats.length = 0; this.decals.length = 0; this.flashes.length = 0; this.blasts.length = 0;
    this.devils.length = 0; this.fish.length = 0; this.flies.length = 0; this.hits.length = 0;
    this.hawk = null; this.wet = 0;
  },
  get motion() { return G.settings.shake !== false; },

  /* ================= çatışma ================= */
  hitStop(t) { if (this.motion) G.hitStopT = Math.max(G.hitStopT || 0, t); },
  /* Ateş edenin tersine kısa tepme: oyuncu sprite'ı ve kamera */
  recoil(e, ang, k) {
    e.rec = { x: -Math.cos(ang) * k, y: -Math.sin(ang) * k };
    if (e === G.player && this.motion) { G.fx.kx = (G.fx.kx || 0) - Math.cos(ang) * k * 1.6; G.fx.ky = (G.fx.ky || 0) - Math.sin(ang) * k * 1.6; }
  },
  /* Vuruş yönünde savrulma (ölen kişi/hayvan kayarak düşer, kan izi bırakır) */
  knock(e, ang, pow) {
    if (!e || !e.dead || e.kind === 'horse' || e.kind === 'wagon') return;
    if (e.kind === 'animal') { if (e.def.len > 14) return; pow *= 0.5; }
    e.kb = { vx: Math.cos(ang) * pow, vy: Math.sin(ang) * pow, t: 0.4 };
    if (e.kind === 'npc') e.ang = ang + rnd(-0.35, 0.35);   // baş, vuruş yönüne düşer
  },
  /* Vurulan kişinin şapkası uçar ve yerde kalır */
  hatOff(e, ang, spd = 60) {
    if (!e || e.kind !== 'npc' || !e.look || !e.look.hat || e.look.hat === 'none') return;
    const L = e.look;
    this.hats.push({ x: e.x, y: e.y, z: 7, vz: rnd(30, 55), vx: Math.cos(ang) * spd + rnd(-10, 10), vy: Math.sin(ang) * spd + rnd(-10, 10), rot: e.ang, vr: rnd(-9, 9), hat: L.hat, col: L.hatCol, age: 0 });
    e.look = Object.assign({}, L, { hat: 'none' });
    if (this.hats.length > 30) this.hats.shift();
  },
  /* Namlu ışığı (gece ortamı bir anlığına aydınlatır) */
  muzzle(x, y) { if (this.flashes.length < 24) this.flashes.push({ x, y, t: 0.07 }); },
  /* Dinamit: kalıcı yanık izi, bitkileri dışarı iten şok dalgası, uzun süren toz */
  explosion(x, y) {
    const W = G.world, t = W.tileAtPx(x, y);
    if (!isWaterT(t)) this.decals.push({ x, y, r: rnd(15, 19), seed: Math.random() * 1000, age: 0, life: 420 });
    if (this.decals.length > 20) this.decals.shift();
    this.blasts.push({ x, y, t: 0 });
    const col = DUST_C[t] || '150,130,100';
    for (let k = 0; k < 18; k++) { const a = Math.random() * TAU, s = rnd(10, 45); G.parts.add('dust', x + Math.cos(a) * 6, y + Math.sin(a) * 6, Math.cos(a) * s, Math.sin(a) * s, rnd(2.5, 4.5), rnd(4, 7), col); }
    for (let k = 0; k < 14; k++) { const a = Math.random() * TAU, s = rnd(30, 120), p = G.parts.add('chip', x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(1.2, 2.4), rnd(1, 2), pick(['#4a3a2a', '#6a5a44', '#2a2018'])); if (p) p.vz = rnd(40, 110); }
    this.hitStop(0.08);
    const P = G.player, d = dist(P.x, P.y, x, y);
    if (d < 320 && this.motion) { const a = Math.atan2(P.y - y, P.x - x), k = 5 * (1 - d / 320); G.fx.kx = (G.fx.kx || 0) + Math.cos(a) * k; G.fx.ky = (G.fx.ky || 0) + Math.sin(a) * k; }
  },
  /* Oyuncuya nereden vurulduğu: ekran kenarında kırmızı iz */
  hurtFrom(x, y) { if (this.hits.length < 6) this.hits.push({ a: Math.atan2(y - G.player.y, x - G.player.x), t: 0.9 }); },

  /* ================= at ve binici ================= */
  /* Nal başına toz: hız arttıkça bulut büyür ve geride kalır; suda sıçrama */
  hoof(h, t) {
    const c = Math.cos(h.ang), s = Math.sin(h.ang), k = clamp((h.spd - 60) / 100, 0, 1);
    if (isWaterT(t)) {
      G.parts.add('splash', h.x, h.y, 0, 0, 0.5, 5);
      for (let i = 0; i < 2 + k * 5; i++) { const p = G.parts.add('drop', h.x + rnd(-4, 4), h.y + rnd(-2, 3), -c * rnd(5, 25) + rnd(-12, 12), -s * rnd(5, 25) + rnd(-8, 8), 1, 1); if (p) p.vz = rnd(30, 70) * (0.6 + k); }
      return;
    }
    const col = DUST_C[t];
    if (!col || t === T.MUD || t === T.SWAMP || this.wet > 0.5) return;
    for (let i = 0, n = 1 + Math.round(k * 2); i < n; i++) G.parts.add('dust', h.x - c * 9 + rnd(-3, 3), h.y - s * 9 + rnd(-2, 2), -c * rnd(10, 30) * k + rnd(-8, 8), -s * rnd(10, 30) * k + rnd(-8, 8), rnd(0.7, 1.2) + k * 0.6, rnd(2, 3) + k * 1.5, col);
  },
  /* Sert duruşta ya da çarpmada şahlanma */
  rear(h, big) {
    if (h.rearT > 0) return;
    h.rearT = 0.9; h.spd = 0; Audio_.neigh(h.x, h.y);
    const col = DUST_C[G.world.tileAtPx(h.x, h.y)];
    if (col) for (let i = 0; i < (big ? 7 : 4); i++) G.parts.add('dust', h.x + rnd(-6, 6), h.y + rnd(-3, 3), rnd(-14, 14), rnd(-10, 6), rnd(0.8, 1.4), rnd(2.5, 4), col);
  },
  rearK(h) { return h.rearT > 0 ? Math.sin(Math.PI * Math.min(1, (1 - h.rearT / 0.9) * 1.25)) : 0; },
  /* Bekleme hâlleri: oyuncu etrafa bakar, şapkasını düzeltir; at başını sallar, eşinir */
  idle(e, dt, moving) {
    const k = e._idle || (e._idle = { t: 0, next: rnd(4, 7), act: null, a: 0, base: 0 });
    if (moving || (e.kind !== 'horse' && (e.aiming || e.carry))) { k.t = 0; k.act = null; e.idleA = 0; e.hatK = 0; e.nod = 0; return; }
    k.t += dt;
    if (!k.act && k.t > k.next) {
      k.t = 0; k.next = rnd(5, 10);
      k.act = e.kind === 'horse' ? (Math.random() < 0.6 ? 'shake' : 'paw') : (Math.random() < 0.65 ? 'look' : 'hat');
      k.a = 0; k.base = e.ang; k.dir = Math.random() < 0.5 ? 1 : -1;
    }
    e.idleA = 0; e.hatK = 0; e.nod = 0;
    if (!k.act) return;
    k.a += dt;
    const u = k.a;
    if (k.act === 'look') { e.idleA = k.dir * Math.sin(Math.min(1, u / 2.4) * TAU) * 0.7; if (u > 2.4) k.act = null; }
    else if (k.act === 'hat') { e.hatK = Math.sin(Math.min(1, u / 0.7) * Math.PI); if (u > 0.7) k.act = null; }
    else if (k.act === 'shake') { e.nod = Math.sin(u * 22) * 1.6 * (1 - u / 0.8); if (u > 0.8) k.act = null; }
    else if (k.act === 'paw') {
      if (Math.floor(u / 0.45) !== Math.floor((u - dt) / 0.45)) {
        const c = Math.cos(e.ang), s = Math.sin(e.ang), col = DUST_C[G.world.tileAtPx(e.x, e.y)];
        if (col) G.parts.add('dust', e.x + c * 7, e.y + s * 7, c * 6 + rnd(-4, 4), s * 6 + rnd(-4, 4), 0.8, 1.8, col);
        Audio_.step(0.04, true);
      }
      if (u > 1.4) k.act = null;
    }
  },

  /* ================= güncelleme ================= */
  update(dt) {
    const P = G.player, W = G.world, C = G.cam;
    // oyuncu tepmesi ve kamera tepmesi söner
    if (P.rec) { const f = Math.exp(-dt * 18); P.rec.x *= f; P.rec.y *= f; if (Math.abs(P.rec.x) + Math.abs(P.rec.y) < 0.05) P.rec = null; }
    const kf = Math.exp(-dt * 14); G.fx.kx = (G.fx.kx || 0) * kf; G.fx.ky = (G.fx.ky || 0) * kf;
    for (let i = this.flashes.length - 1; i >= 0; i--) if ((this.flashes[i].t -= dt) <= 0) this.flashes.splice(i, 1);
    for (let i = this.blasts.length - 1; i >= 0; i--) if ((this.blasts[i].t += dt) > 1.4) this.blasts.splice(i, 1);
    for (let i = this.hits.length - 1; i >= 0; i--) if ((this.hits[i].t -= dt) <= 0) this.hits.splice(i, 1);
    for (let i = this.decals.length - 1; i >= 0; i--) if ((this.decals[i].age += dt) > this.decals[i].life) this.decals.splice(i, 1);
    // savrulan cesetler
    for (const e of G.ents) {
      const k = e.kb; if (!k) continue;
      e.move(k.vx * dt, k.vy * dt);
      const f = Math.exp(-dt * 7); k.vx *= f; k.vy *= f;
      if (Math.random() < 0.5 && e.kind === 'npc') G.parts.add('blood', e.x + rnd(-2, 2), e.y + rnd(-2, 2), 0, 0, 1.2, 1.3);
      if ((k.t -= dt) <= 0) e.kb = null;
    }
    // uçan şapkalar: zıplar, döner, yerde durur
    for (let i = this.hats.length - 1; i >= 0; i--) {
      const h = this.hats[i];
      h.age += dt;
      if (h.z > 0 || h.vz > 0) {
        h.vz -= 200 * dt; h.z += h.vz * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
        if (h.z <= 0) { h.z = 0; if (h.vz < -25) { h.vz = -h.vz * 0.3; h.vx *= 0.55; h.vy *= 0.55; h.vr *= 0.5; } else { h.vz = 0; h.vx = 0; h.vy = 0; h.vr = 0; } }
      }
      if (h.age > 900 || Math.abs(h.x - P.x) > 1600 || Math.abs(h.y - P.y) > 1600) this.hats.splice(i, 1);
    }
    // güneşin açısı: sabah gölgeler batıya uzun, öğlen kısa, akşam doğuya
    const hr = G.hour, dl = G.daylight;
    const u = clamp((hr - 6) / 13, 0, 1);
    this.sunDx = -(1 - 2 * u); this.sunLen = Math.abs(1 - 2 * u) * clamp(dl * 1.4, 0, 1);
    // ıslaklık: yağmurda artar, kesilince yavaşça kurur
    const env = G.envCache || {};
    const rain = env.rain || 0;
    if (rain > 0.15) this.wet = Math.min(1, this.wet + dt * 0.06 * rain); else this.wet = Math.max(0, this.wet - dt * 0.0035);
    if (G.insideB || G.state !== 'play') return;
    const x0 = C.ox, y0 = C.oy, vw = G.vw, vh = G.vh, biome = W.areaTile(P.x, P.y), day = dl > 0.6;
    const dryB = biome === T.DESERT || biome === T.DRY || biome === T.REDROCK || biome === T.SAND || biome === T.MESA;
    // toz şeytanı: kurak arazide, öğleden sonra, rüzgârlı ve kuru havada
    if (dryB && day && hr > 11 && hr < 18 && rain < 0.1 && this.devils.length < 1 && Math.random() < dt * 0.02) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.devils.push({ x: dir > 0 ? x0 - 30 : x0 + vw + 30, y: y0 + rnd(40, vh - 20), vx: dir * rnd(10, 22), vy: rnd(-5, 5), t: 0, life: rnd(28, 45), h: rnd(22, 34) });
    }
    for (let i = this.devils.length - 1; i >= 0; i--) {
      const d = this.devils[i];
      d.t += dt; d.x += (d.vx + Math.sin(d.t * 0.7) * 6) * dt; d.y += (d.vy + Math.cos(d.t * 0.5) * 4) * dt;
      if (Math.random() < dt * 6) { const col = DUST_C[W.tileAtPx(d.x, d.y)] || '190,160,120'; G.parts.add('dust', d.x + rnd(-3, 3), d.y + rnd(-2, 2), rnd(-8, 8), rnd(-6, 2), rnd(0.8, 1.4), rnd(1.5, 3), col); }
      if (d.t > d.life || d.x < x0 - 200 || d.x > x0 + vw + 200) this.devils.splice(i, 1);
    }
    // şahin gölgesi: gündüz açık arazide daire çizer
    const open = biome === T.GRASS || biome === T.DRY || biome === T.DESERT || biome === T.REDROCK;
    if (!this.hawk && open && day && rain < 0.2 && Math.random() < dt * 0.01) this.hawk = { cx: P.x + rnd(-120, 120), cy: P.y + rnd(-80, 80), r: rnd(55, 90), a: Math.random() * TAU, w: rnd(0.25, 0.4) * (Math.random() < 0.5 ? 1 : -1), vx: rnd(-8, 8), vy: rnd(-6, 6), t: 0, life: rnd(30, 60) };
    if (this.hawk) {
      const h = this.hawk; h.t += dt; h.a += h.w * dt; h.cx += h.vx * dt; h.cy += h.vy * dt;
      if (h.t > h.life || Math.abs(h.cx - P.x) > 700 || Math.abs(h.cy - P.y) > 500) this.hawk = null;
    }
    // sıçrayan balık
    if (day && this.fish.length < 2 && Math.random() < dt * 0.25) {
      for (let k = 0; k < 8; k++) {
        const x = x0 + rnd(20, vw - 20), y = y0 + rnd(20, vh - 20), tx = x >> 4, ty = y >> 4;
        if (!W.inb(tx, ty) || W.tile[ty * WW + tx] !== T.WATER || (W.flags[ty * WW + tx] & 2) || !W.isWaterPx(x + 12, y) || !W.isWaterPx(x - 12, y)) continue;
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.fish.push({ x, y, dir, t: 0, dur: rnd(0.45, 0.7), len: rnd(10, 16) });
        G.parts.add('splash', x, y, 0, 0, 0.45, 2); FX.ripple(x, y, 1, 8, 1);
        break;
      }
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i]; f.t += dt;
      if (f.t >= f.dur) { const ex = f.x + f.dir * f.len; G.parts.add('splash', ex, f.y, 0, 0, 0.5, 2.5); FX.ripple(ex, f.y, 1, 10, 1.2); this.fish.splice(i, 1); }
    }
    // ateş böcekleri: yaz gecelerinde orman, bataklık ve çayırda
    const night = dl < 0.25, green = biome === T.FOREST || biome === T.SWAMP || biome === T.GRASS;
    if (night && W.season === 1 && green && rain < 0.1) {
      while (this.flies.length < 22) this.flies.push({ x: x0 + rnd(0, vw), y: y0 + rnd(0, vh), vx: rnd(-6, 6), vy: rnd(-6, 6), ph: Math.random() * TAU, sp: rnd(1.2, 2.6) });
    } else if (this.flies.length) this.flies.length = 0;
    for (const f of this.flies) {
      f.vx += rnd(-12, 12) * dt; f.vy += rnd(-12, 12) * dt; f.vx *= 0.98; f.vy *= 0.98;
      f.x += f.vx * dt; f.y += f.vy * dt; f.ph += dt * f.sp;
      if (f.x < x0 - 20) f.x += vw + 40; else if (f.x > x0 + vw + 20) f.x -= vw + 40;
      if (f.y < y0 - 20) f.y += vh + 40; else if (f.y > y0 + vh + 20) f.y -= vh + 40;
    }
  },
  /* Bitkileri dışarı iten şok dalgası (FX.sway çağırır) */
  swayPush(x, y) {
    let k = 0;
    for (const b of this.blasts) {
      const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
      if (d > 110) continue;
      const wave = clamp(1 - Math.abs(d - b.t * 220) / 40, 0, 1) + clamp(1 - b.t / 1.4, 0, 1) * 0.3;
      k += (dx >= 0 ? 1 : -1) * (1 - d / 110) * wave * 0.9;
    }
    return k;
  },

  /* ================= çizim ================= */
  /* Zemin katmanı (varlıkların altında) */
  drawGround(ctx, x0, y0, x1, y1) {
    const W = G.world, t = G.t, dl = G.daylight;
    // ıslak zemin ve su birikintileri
    if (this.wet > 0.02 && !G.insideB) {
      ctx.fillStyle = `rgba(18,22,30,${this.wet * 0.13})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const rain = (G.envCache && G.envCache.rain) || 0;
      for (let ty = Math.max(0, y0 >> 4); ty <= Math.min(WH - 1, y1 >> 4); ty++) for (let tx = Math.max(0, x0 >> 4); tx <= Math.min(WW - 1, x1 >> 4); tx++) {
        const i = ty * WW + tx, tl = W.tile[i];
        if (tl !== T.ROAD && tl !== T.TOWN && tl !== T.MUD && tl !== T.FARM && !isStoneT(tl)) continue;
        if (W.flags[i] & 8) continue;
        const h = hash2(tx, ty, 91);
        if (h > 0.07) continue;
        const cx = tx * TS + 4 + hash2(tx, ty, 92) * 8, cy = ty * TS + 4 + hash2(tx, ty, 93) * 8, rx = 3 + hash2(tx, ty, 94) * 4, ry = rx * 0.55;
        const a = clamp(this.wet * 1.4 - 0.3, 0, 1);
        if (a <= 0) continue;
        ctx.fillStyle = `rgba(62,78,96,${a * 0.75})`; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(190,210,225,${a * 0.25 * (0.4 + dl)})`; ctx.fillRect(cx - rx * 0.5, cy - ry * 0.4, rx * 0.8, 0.8);
        if (rain > 0.2 && Math.sin(t * 7 + h * 400) > 0.93) { ctx.strokeStyle = `rgba(200,220,235,${a * 0.6})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(cx + (h * 97 % 1) * rx - rx / 2, cy, 1.5, 0.8, 0, 0, TAU); ctx.stroke(); }
      }
    }
    // dinamit yanık izleri
    for (const d of this.decals) {
      if (d.x < x0 - 30 || d.x > x1 + 30 || d.y < y0 - 30 || d.y > y1 + 30) continue;
      const a = Math.min(1, (d.life - d.age) / 60) * 0.55;
      // dışa savrulmuş is çizgileri
      ctx.fillStyle = `rgba(30,24,16,${a * 0.45})`;
      for (let k = 0; k < 11; k++) {
        const ang = k / 11 * TAU + Math.sin(d.seed + k * 7.1) * 0.25, L = d.r * (1.15 + 0.55 * (0.5 + 0.5 * Math.sin(d.seed * 1.7 + k * 3.3))), w = 0.16;
        ctx.beginPath(); ctx.moveTo(d.x + Math.cos(ang - w) * d.r * 0.6, d.y + Math.sin(ang - w) * d.r * 0.42);
        ctx.lineTo(d.x + Math.cos(ang) * L, d.y + Math.sin(ang) * L * 0.7); ctx.lineTo(d.x + Math.cos(ang + w) * d.r * 0.6, d.y + Math.sin(ang + w) * d.r * 0.42); ctx.fill();
      }
      ctx.fillStyle = `rgba(24,18,12,${a})`;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) { const ang = k / 16 * TAU, r = d.r * (0.75 + 0.25 * Math.sin(ang * 3 + d.seed) * Math.cos(ang * 5 + d.seed * 0.7)); const px = d.x + Math.cos(ang) * r, py = d.y + Math.sin(ang) * r * 0.7; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.fill();
      ctx.fillStyle = `rgba(10,8,6,${a * 0.6})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.5, d.r * 0.34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(120,100,76,${a * 0.35})`; ctx.beginPath(); ctx.ellipse(d.x + 1, d.y + 1, d.r * 0.22, d.r * 0.15, 0, 0, TAU); ctx.fill();   // ortada savrulmuş taze toprak
    }
    // yerdeki şapkalar
    for (const h of this.hats) {
      if (h.x < x0 - 20 || h.x > x1 + 20 || h.y < y0 - 20 || h.y > y1 + 20) continue;
      Spr.shadow(ctx, h.x + 0.5, h.y + 1, 4, 2.4, 0.18);
      ctx.save(); ctx.translate(h.x, h.y - h.z); ctx.rotate(h.rot);
      Spr.hatTop(ctx, h.hat, h.col);
      ctx.restore();
    }
    // şahin gölgesi
    const hk = this.hawk;
    if (hk && !G.insideB) {
      const x = hk.cx + Math.cos(hk.a) * hk.r, y = hk.cy + Math.sin(hk.a) * hk.r * 0.7;
      const fade = Math.min(1, hk.t / 3, (hk.life - hk.t) / 3) * clamp(dl, 0, 1);
      const flap = Math.sin(hk.t * 9) > 0.7 ? 0.7 : 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(hk.a + (hk.w > 0 ? Math.PI / 2 : -Math.PI / 2));
      ctx.fillStyle = `rgba(0,0,0,${0.16 * fade})`;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(0, -7 * flap); ctx.lineTo(-1.5, -1); ctx.lineTo(-4, 0); ctx.lineTo(-1.5, 1); ctx.lineTo(0, 7 * flap); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  },
  /* Su karosu: güneşte parıltı (render döngüsü her görünür su karosu için çağırır) */
  water(ctx, tx, ty, t) {
    if (G.daylight < 0.55) return;
    const h = hash2(tx, ty, 57);
    const s = Math.sin(t * (1.6 + h) + h * 60);
    if (s < 0.965) return;
    ctx.fillStyle = `rgba(255,252,236,${(s - 0.965) * 22})`;
    ctx.fillRect(tx * TS + 2 + h * 11, ty * TS + 3 + hash2(tx, ty, 58) * 10, 2, 1);
  },
  /* Varlıkların üstünde, cephelerden sonra: salınan saloon kapıları ve sıçrayan balık */
  drawAfterCovers(ctx, x0, y0, x1, y1, dt) {
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i], k = f.t / f.dur, x = f.x + f.dir * f.len * k, z = Math.sin(k * Math.PI) * 7;
      ctx.save(); ctx.translate(x, f.y - z); ctx.rotate(f.dir * (k - 0.5) * 1.6 + (f.dir < 0 ? Math.PI : 0));
      ctx.fillStyle = '#8a9aa4'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.2, 0, 0, TAU); ctx.fill();
      ctx.fillRect(-4.5, -1, 1.6, 2); ctx.restore();
    }
    const W = G.world, BS = W.buildings;
    for (let bi = 0; bi < BS.length; bi++) {
      const b = BS[bi];
      if (b.type !== 'saloon' && b.type !== 'cantina' && b.type !== 'gambling') continue;
      const dx = b.door.x, by = (b.y + b.h) * TS;
      if (dx < x0 - 20 || dx > x1 + 20 || by < y0 - 20 || by > y1 + 20) continue;
      const S = b.swing || (b.swing = { a: 0, v: 0 });
      // kapıdan geçen biri kanatları iter
      for (let j = -1; j < G.ents.length; j++) {   // önce oyuncu, sonra varlıklar (yeni dizi yaratmadan)
        const e = j < 0 ? G.player : G.ents[j];
        if (e.kind !== 'npc' && e !== G.player) continue;
        if (Math.abs(e.x - dx) < 7 && Math.abs(e.y - (by - 8)) < 11) {
          const k = e._jd || (e._jd = { x: e.x, y: e.y }), vy = e.y - k.y;
          if (Math.abs(vy) > 0.05) S.v += (vy > 0 ? 1 : -1) * Math.min(40, Math.abs(vy) * 90) * dt * 6;
        }
        if (e._jd) { e._jd.x = e.x; e._jd.y = e.y; }
      }
      S.v += (-S.a * 60 - S.v * 3.2) * dt; S.a = clamp(S.a + S.v * dt, -1.35, 1.35);
      const wd = 3.6 * Math.cos(S.a), sh = S.a > 0 ? 0.15 : -0.1;
      ctx.globalAlpha = b.coverA === undefined ? 1 : b.coverA;
      const col = shadeHex('#5e3c22', sh * Math.abs(Math.sin(S.a)));
      for (let q = 0; q < 2; q++) {
        const lx = q ? dx + 4 - wd : dx - 4;
        ctx.fillStyle = col; ctx.fillRect(lx, by - 11, wd, 6);
        ctx.fillStyle = '#b08858'; ctx.fillRect(lx, by - 11, wd, 1); ctx.fillRect(lx, by - 6, wd, 0.8);   // üst ve alt kayıt
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; if (wd > 2) ctx.fillRect(lx + wd / 2 - 0.3, by - 10, 0.6, 4);   // çıta arası
      }
      ctx.globalAlpha = 1;
    }
  },
  /* Çatıların ve ağaçların üstü: bayraklar, çamaşır ipleri, toz şeytanları */
  drawHigh(ctx, x0, y0, x1, y1) {
    const W = G.world, t = G.t, w = FX.wind, BS = W.buildings;
    for (let bi = 0; bi < BS.length; bi++) {
      const b = BS[bi], bx = b.x * TS, by = b.y * TS;
      if (bx > x1 + 40 || bx + b.w * TS < x0 - 40 || by > y1 + 60 || by + b.h * TS < y0 - 60) continue;
      if (b.type === 'sheriff' || b.type === 'county' || b.type === 'station' || b.type === 'bank') {
        // çatıda bayrak direği ve rüzgârda dalgalanan bayrak
        const px = bx + 10, py = by - 16;
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(px, py - 16, 1, 18);
        const dir = w.x >= 0 ? 1 : -1, str = 0.5 + w.s;
        for (let k = 0; k < 8; k++) {
          const wave = Math.sin(t * (5 + w.s * 4) - k * 0.9) * (0.6 + k * 0.18) * str;
          const col = b.type === 'sheriff' || b.type === 'county' ? (k % 2 ? '#e8e0d0' : '#a82a22') : (k % 2 ? '#2a4a7a' : '#d8d0c0');
          ctx.fillStyle = col; ctx.fillRect(px + 1 + dir * k * 1.1 - (dir < 0 ? 1.1 : 0), py - 16 + wave, 1.2, 5);
        }
      }
      if (b.type === 'laundry' || (b.type === 'house' && hash2(b.x, b.y, 61) < 0.35)) {
        // yan duvara gerilmiş çamaşır ipi
        const lx0 = bx + b.w * TS + 2, lx1 = lx0 + 26, ly = by + b.h * TS - 22;
        ctx.strokeStyle = '#5a4a38'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(lx0, ly); ctx.quadraticCurveTo((lx0 + lx1) / 2, ly + 3, lx1, ly); ctx.stroke();
        ctx.fillStyle = '#4a3624'; ctx.fillRect(lx1, ly, 1, 12);
        const cols = ['#e8e4d8', '#b8c8d8', '#c8a878', '#e8d8d0', '#8a9aaa'];
        for (let k = 0; k < 4; k++) {
          const cx = lx0 + 4 + k * 5.5, sag = Math.sin((k + 0.5) / 4 * Math.PI) * 2.6;
          const sw = Math.sin(t * (3 + w.s * 3) + k * 1.3 + b.x) * (0.8 + w.s * 1.6) + w.x * 2;
          ctx.save(); ctx.translate(cx, ly + sag); ctx.transform(1, 0, sw * 0.12, 1, 0, 0);
          ctx.fillStyle = cols[(k + b.x) % cols.length]; ctx.fillRect(-1.8, 0, 3.6, 4.5 + (k % 2) * 1.5);
          ctx.restore();
        }
      }
    }
    // toz şeytanları: dönen toz sütunu
    for (const d of this.devils) {
      if (d.x < x0 - 60 || d.x > x1 + 60 || d.y < y0 - 60 || d.y > y1 + 60) continue;
      const fade = Math.min(1, d.t / 4, (d.life - d.t) / 4);
      const col = DUST_C[W.tileAtPx(d.x, d.y)] || '190,160,120';
      ctx.fillStyle = `rgba(${col},${0.18 * fade})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, 7, 3.2, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 16; i++) {
        const z = i / 16, r = 2 + z * 7, a = t * 7 + i * 0.8, sway = Math.sin(t * 1.3 + z * 3) * z * 4;
        const px = d.x + Math.cos(a) * r + sway, py = d.y - z * d.h + Math.sin(a) * r * 0.35;
        ctx.fillStyle = `rgba(${col},${(0.22 - z * 0.12) * fade})`;
        ctx.beginPath(); ctx.arc(px, py, 1.6 + z * 2.4, 0, TAU); ctx.fill();
      }
    }
  },
  /* Işıklandırmadan sonra: ateş böcekleri ve birikintilerde gece ışığı yansıması */
  drawGlow(ctx, x0, y0) {
    const t = G.t;
    if (this.flies.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.flies) {
        const b = Math.max(0, Math.sin(f.ph)) ** 3;
        if (b < 0.05) continue;
        const x = f.x - x0, y = f.y - y0;
        ctx.globalAlpha = b * 0.5; ctx.drawImage(G.glowSpr, x - 4, y - 4, 8, 8);
        ctx.globalAlpha = b; ctx.fillStyle = '#e8ff90'; ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (this.wet > 0.2 && G.daylight < 0.45 && !G.insideB) {
      const W = G.world, vw = G.vw, vh = G.vh;
      ctx.globalCompositeOperation = 'lighter';
      for (const L of W.lightsIn(x0, y0, x0 + vw, y0 + vh)) {
        if (L.type !== 'lamp' && L.type !== 'window') continue;
        if (L.x < x0 - 60 || L.x > x0 + vw + 60 || L.y < y0 - 60 || L.y > y0 + vh + 60) continue;
        for (let ty = (L.y - 50) >> 4; ty <= (L.y + 50) >> 4; ty++) for (let tx = (L.x - 50) >> 4; tx <= (L.x + 50) >> 4; tx++) {
          if (!W.inb(tx, ty)) continue;
          const tl = W.tile[ty * WW + tx];
          if ((tl !== T.ROAD && tl !== T.TOWN && tl !== T.MUD && tl !== T.FARM && !isStoneT(tl)) || hash2(tx, ty, 91) > 0.07) continue;
          const cx = tx * TS + 4 + hash2(tx, ty, 92) * 8, cy = ty * TS + 4 + hash2(tx, ty, 93) * 8, d = dist(cx, cy, L.x, L.y);
          if (d > 55) continue;
          ctx.globalAlpha = (1 - d / 55) * this.wet * 0.55 * (0.85 + Math.sin(t * 3 + tx) * 0.15);
          ctx.drawImage(G.glowSpr, cx - x0 - 5, cy - y0 - 2.5, 10, 5);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  },
  /* Ekran katmanı: hasar yönü */
  drawScreen(ctx) {
    if (!this.hits.length) return;
    const vw = G.vw, vh = G.vh, cx = vw / 2, cy = vh / 2, R = Math.min(vw, vh) * 0.42;
    for (const h of this.hits) {
      const a = Math.min(1, h.t / 0.4);
      ctx.strokeStyle = `rgba(200,30,20,${a * 0.75})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, R, h.a - 0.28, h.a + 0.28); ctx.stroke();
      ctx.strokeStyle = `rgba(255,90,70,${a * 0.5})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R - 3, h.a - 0.18, h.a + 0.18); ctx.stroke();
    }
  },
  /* Kumlu zeminde kan zamanla toprağa emilir (0..1) */
  soak(e) {
    const t = G.world.tileAtPx(e.x, e.y);
    return t === T.DESERT || t === T.SAND || t === T.DRY || t === T.REDROCK ? clamp(((e.deadT || 0) - 30) / 90, 0, 1) : 0;
  },
  /* Varlık gölgesi için güneş ötelemesi: [x kayması, uzama çarpanı] */
  sun(rx) { return this.sunOn ? [this.sunDx * this.sunLen * rx * 0.55, 1 + this.sunLen * 0.55] : [0, 1]; },
  /* Pencere ışıkları gece ilerledikçe tek tek söner, sabaha karşı bazıları yanar */
  windowLit(L) {
    const h = G.hour, sleep = 21 + hash2(L.x | 0, L.y | 0, 7) * 4.5, wake = 5 + hash2(L.x | 0, L.y | 0, 8) * 2.5;
    const b = G.world.buildings[L.b];
    if (b && (b.type === 'saloon' || b.type === 'hotel' || b.type === 'cantina' || b.type === 'gambling' || b.type === 'sheriff' || b.type === 'station')) return true;
    const hh = h < 12 ? h + 24 : h;
    return hh < sleep || (h < 12 && h >= wake);
  },
  /* Lamba ve ateş ışığı: düzensiz titreme */
  flicker(seed, t, amt) { return 1 + (Math.sin(t * 11 + seed) * 0.5 + Math.sin(t * 17.3 + seed * 2.1) * 0.3 + Math.sin(t * 5.1 + seed * 0.7) * 0.2) * amt; },
};
