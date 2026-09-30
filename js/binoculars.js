'use strict';
/* ==========================================================
   FRONTIER'S END — dürbün (G nesnesine eklenir)
   - Çantadan ya da eşya çarkından kullanılır. Oyuncu durur, görüş
     bakılan yöne 420 piksele kadar kayar (fare, yön tuşları ya da çubuk).
   - Görüşteki hayvanların ve dikkat çeken insanların üstünde adları
     yazar; aranan hedefler ve haydutlar kırmızıyla işaretlenir.
   - Uzakta görülen yerler haritada işaretlenir, bakılan yerin
     çevresindeki harita sisi açılır.
   - Esc, sağ tık, etkileşim ya da hasar almak dürbünü indirir.
   ========================================================== */

const BINOC_R = 420;

const BinocSystems = {
  toggleBinoc() {
    if (this.binoc) { this.binocOff(); return; }
    const P = this.player;
    if (P.riding) { UI.feed(Tr('At sırtında dürbün kullanamazsın.'), 'warn'); return; }
    if (this.insideB) { UI.feed(Tr('İçeride dürbünle bakacak bir şey yok.'), 'warn'); return; }
    if (UI.isModal()) UI.closeAll();
    this.binoc = { x: 0, y: 0, hp: P.hp, mouse: false, t: 0, seen: new Set() };
    P.aiming = false;
    Audio_.tone(700, 0.05, 'triangle', 0.04);
    this.binocEl(true);
    this.hintOnce('binoc', Tr`Dürbünle bakıyorsun. Fareyle, yön tuşlarıyla ya da çubukla uzağa bak. Bakarken fark ettiğin yerler haritanda işaretlenir. ${Input.glyph('back')} ile indir.`, 8);
  },
  binocOff() {
    if (!this.binoc) return;
    this.binoc = null;
    this.binocEl(false);
    Audio_.tone(520, 0.05, 'triangle', 0.04);
  },
  /* Her karede (oyuncu güncellemesinin yerine) */
  binocUpdate(dt) {
    const B = this.binoc, P = this.player, I = Input;
    if (P.hp < B.hp - 0.5 || P.hp <= 0 || this.state !== 'play') { this.binocOff(); return; }
    B.hp = P.hp; B.t += dt;
    if (B.t > 0.25 && ['back', 'pause', 'aim', 'interact', 'fire'].some(a => I.pressed(a))) {
      for (const a of ['back', 'pause', 'aim', 'interact', 'fire']) I.consume(a);
      this.binocOff(); return;
    }
    // yön tuşları ve sol/sağ çubuk kaydırır; fare hareket edince doğrudan fareye bakar
    const mv = I.moveVec(), av = I.aimVec();
    const vx = mv.x * mv.m + (av.m > 0.15 ? av.x : 0), vy = mv.y * mv.m + (av.m > 0.15 ? av.y : 0);
    if (vx || vy) { B.x += vx * 340 * dt; B.y += vy * 340 * dt; B.mouse = false; }
    if (I.device === 'kb' && I.mouse.moved) B.mouse = true;
    if (B.mouse) {
      const k = 2.4 / this.scale;
      B.x = (I.mouse.x - window.innerWidth / 2) * k;
      B.y = (I.mouse.y - window.innerHeight / 2) * k;
    }
    const d = Math.hypot(B.x, B.y);
    if (d > BINOC_R) { B.x *= BINOC_R / d; B.y *= BINOC_R / d; }
    P.ang = Math.atan2(B.y, B.x) || P.ang;
    P.mv = 0; P.spd = 0;
    if ((B.scan = (B.scan || 0) - dt) <= 0) { B.scan = 0.2; this.binocScan(); }
  },
  /* Görüşteki şeyleri etiketle, uzaktaki yerleri haritada işaretle */
  binocScan() {
    const B = this.binoc, P = this.player, C = this.cam, W = this.world;
    const x0 = C.ox, y0 = C.oy, x1 = x0 + this.vw, y1 = y0 + this.vh;
    const cx = P.x + B.x, cy = P.y + B.y;
    this.revealAt(cx, cy, 170);
    const labels = [];
    for (const e of this.ents) {
      if (e.dead || e.remove || e === P || e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
      if (dist2(e.x, e.y, P.x, P.y) < 70 * 70) continue;
      if (e.kind === 'animal') {
        if (e.def.tame || e.type === 'chicken' || e.type === 'cow') continue;
        labels.push({ x: e.x, y: e.y - 10, t: e.def.n, cls: e.def.beh === 'hostile' ? 'bad' : '' });
      } else if (e.kind === 'npc') {
        const bounty = e.bountyId || e.role === 'target';
        const t = bounty ? Tr`Aranan: ${e.name}` : e.role === 'bandit' ? Tr('Haydut') : e.role === 'hunter' ? Tr('Ödül Avcısı') : e.isLaw ? Tr('Kanun Adamı') : e.name;
        labels.push({ x: e.x, y: e.y - 14, t, cls: bounty || e.hostile || e.role === 'bandit' || e.role === 'hunter' ? 'bad' : 'dim' });
      }
    }
    for (const p of W.pois) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if (p.kind !== 'landmark' && p.kind !== 'camp') continue;
      labels.push({ x: p.x, y: p.y - 18, t: p.n, cls: 'poi' });
      if (!this.discovered.has(p.id) && !this.rumored.has(p.id) && !B.seen.has(p.id)) {
        B.seen.add(p.id); this.rumored.add(p.id);
        UI.feed(Tr`🔭 Uzakta ${p.n} gördün. Haritanda işaretlendi.`);
        this.skillXp('survival', 2);
      }
    }
    for (const t of W.towns) if (t.cx > x0 && t.cx < x1 && t.cy > y0 && t.cy < y1 && !this.visited.has(t.id)) labels.push({ x: t.cx, y: t.cy, t: t.n, cls: 'poi' });
    B.labels = labels;
  },
  /* Ekran üstü katman: iki mercekli görüş ve etiketler */
  binocEl(on) {
    let el = document.getElementById('binoc');
    document.body.classList.toggle('binoc-on', !!on);
    if (!on) { if (el) el.classList.add('hidden'); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'binoc';
      el.innerHTML = '<svg class="bn-mask"></svg><div class="bn-labels"></div><div class="bn-hint"></div>';
      // HUD'un ilk çocuğu: bildirimler ve altyazılar merceğin üstünde kalır
      const hud = document.getElementById('hud'); if (hud) hud.prepend(el); else document.body.appendChild(el);
    }
    el.classList.remove('hidden');
    const w = window.innerWidth, h = window.innerHeight, r = Math.min(h * 0.46, w * 0.27), dx = r * 0.78;
    el.querySelector('.bn-mask').outerHTML = `<svg class="bn-mask" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="bn-blur"><feGaussianBlur stdDeviation="${r * 0.06}"/></filter>
      <mask id="bn-m"><rect width="${w}" height="${h}" fill="#fff"/><g filter="url(#bn-blur)"><circle cx="${w / 2 - dx}" cy="${h / 2}" r="${r}" fill="#000"/><circle cx="${w / 2 + dx}" cy="${h / 2}" r="${r}" fill="#000"/></g></mask></defs>
      <rect width="${w}" height="${h}" fill="#050403" mask="url(#bn-m)"/></svg>`;
    el.querySelector('.bn-hint').innerHTML = Tr`${Input.glyph('back')} Dürbünü indir`;
  },
  /* Etiketleri ekrana yerleştir (her karede) */
  binocDraw() {
    const B = this.binoc, el = document.getElementById('binoc');
    if (!B || !el) return;
    const html = (B.labels || []).map(l => { const p = this.toScreen(l.x, l.y); return `<div class="bn-l ${l.cls}" style="left:${Math.round(p.x)}px;top:${Math.round(p.y)}px">${escapeHtml(l.t)}</div>`; }).join('');
    const box = el.querySelector('.bn-labels');
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
  },
};
