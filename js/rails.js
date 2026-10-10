'use strict';
/* ==========================================================
   FRONTIER'S END — demiryolu güvenliği
   Her trenin bir tehlike koridoru vardır: vagonların üstü ve lokomotifin önünde birkaç saniyede
   geçeceği ray. Yaklaşan trenden herkes kaçınır:
   - NPC'ler (yaya ya da atlı) raydaysa dik yönde kenara çekilir, rayı geçmek üzereyse bekler
   - hayvanlar raydan kaçar, raya doğru gidiyorsa yön değiştirir; sahipsiz duran at da çekilir
   - at arabaları ve posta arabaları geçitten önce durur, raydaysa hızla karşıya geçer
   - tren rayda duran bir arabayı görünce düdük çalıp fren yapar, yol açılınca devam eder
   Duran ya da giden trenin vagonları katıdır: kimse içinden geçemez.
   ========================================================== */
const RAIL_WARN = 6;      // sn: bu sürede gelecek trene karşı davranılır
const RAIL_HALF = 9;      // ray ekseninden vagon kenarına (yarı genişlik)
const RAIL_STEP = 6;      // koridor örnek aralığı (px)

const RailSystems = {
  /* Her kare: trenlerin tehlike koridorları ve vagon çarpışma çemberleri.
     Diziler her karede yeniden yaratılmaz, yerinde güncellenir (okuyanlar aynı karede okur). */
  railTick() {
    const zones = this.railZones || (this.railZones = []);
    zones.length = 0;
    for (const tr of this.trains) {
      if (!tr.pos[0]) continue;
      const L = tr.line, dir = tr.dir;
      // kalkmak üzere olan tren de tehlikelidir; uzun süre duran trenin yalnızca gövdesi
      const moving = tr.wait <= 0, leaving = !moving && tr.wait < 2.5;
      const ahead = moving ? Math.max(50, tr.spd * RAIL_WARN) : leaving ? 70 : 0;
      const sTail = tr.s - dir * ((tr.cars.length - 1) * tr.gap + 16), sHead = tr.s + dir * (16 + ahead);
      const a = Math.min(sTail, sHead), b = Math.max(sTail, sHead);
      const Z = tr.zone || (tr.zone = { tr, pts: [], x0: 0, y0: 0, x1: 0, y1: 0, moving: false }), pts = Z.pts;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
      for (let s = Math.max(0, a); s <= Math.min(L.len, b) + 0.1; s += RAIL_STEP) {
        const p = tr.at(s, pts[n] || (pts[n] = [0, 0, 0, 0]));
        // ETA: lokomotifin bu noktaya varış süresi (gövdenin altı: 0)
        const ds = (s - tr.s) * dir;
        p[3] = ds <= 0 ? 0 : ds / Math.max(tr.spd, moving ? 12 : 6) + (moving ? 0 : tr.wait);
        n++;
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      }
      pts.length = n;
      if (n) { Z.x0 = x0; Z.y0 = y0; Z.x1 = x1; Z.y1 = y1; Z.moving = moving || leaving; zones.push(Z); }
      // vagon çemberleri (vagon 26-28 px boyunda, 12 px eninde: üç çember) ve sınır kutusu
      const cc = tr.circles || (tr.circles = []), np = tr.pos.length;
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (let i = 0; i < np; i++) {
        const q = tr.pos[i], x = q[0], y = q[1], c = Math.cos(q[2]) * 8, s = Math.sin(q[2]) * 8;
        const A = cc[3 * i] || (cc[3 * i] = [0, 0]), B = cc[3 * i + 1] || (cc[3 * i + 1] = [0, 0]), D = cc[3 * i + 2] || (cc[3 * i + 2] = [0, 0]);
        A[0] = x + c; A[1] = y + s; B[0] = x; B[1] = y; D[0] = x - c; D[1] = y - s;
        bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
      }
      cc.length = 3 * np;
      const B = tr.box || (tr.box = [0, 0, 0, 0]);
      B[0] = bx0 - 20; B[1] = by0 - 20; B[2] = bx1 + 20; B[3] = by1 + 20;
    }
    // katı arabalar: hayvanlar ve sahipsiz atlar içlerinden geçemez (yayalar ve oyuncu kasaba içinde
    // park etmiş arabaların arasından geçebilir; arabalar onlar için zaten durur, onlar da arabadan kaçar)
    const wn = this.wagonsNow || (this.wagonsNow = []);
    wn.length = 0;
    for (let i = 0; i < this.ents.length; i++) { const o = this.ents[i]; if (o.kind === 'wagon' && !o.remove && !o.hide) wn.push(o); }
  },
  /* (x, y, r) bir arabanın gövdesine ya da atlarına giriyor mu: yalnızca hayvanlar ve atlar için */
  wagonBlock(x, y, r, self) {
    const L = this.wagonsNow;
    if (!L || !self || (self.kind !== 'animal' && self.kind !== 'horse')) return null;
    const P = this.player;
    for (const o of L) {
      if (o === self || Math.abs(o.x - x) > 34 || Math.abs(o.y - y) > 34) continue;
      if (self && (o.rider === self || self.riding === o || o.driverEnt === self || (self === P && P.riding === o))) continue;
      for (const [cx, cy, cr] of o.circles()) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < (cr + r) * (cr + r)) return o;
    }
    return null;
  },
  /* Ent.move için: trenin vagonları ve arabalar katıdır */
  solidAt(x, y, r, self) { return this.trainBlock(x, y, r) || this.wagonBlock(x, y, r, self); },
  /* (x, y) çevresindeki tehlike: koridora `pad` mesafesinden yakınsa en yakın ray noktası, yönü ve varış süresi */
  railDanger(x, y, pad) {
    // en yakın nokta: ara nesne yaratmadan (yalnızca tehlike varsa sonuç nesnesi)
    const Zs = this.railZones;
    if (!Zs) return null;
    let bd = 0, bi = -1, bZ = null;
    for (let z = 0; z < Zs.length; z++) {
      const Z = Zs[z];
      if (x < Z.x0 - pad - RAIL_HALF || x > Z.x1 + pad + RAIL_HALF || y < Z.y0 - pad - RAIL_HALF || y > Z.y1 + pad + RAIL_HALF) continue;
      const P = Z.pts;
      for (let i = 0; i < P.length; i++) {
        const dx = x - P[i][0], dy = y - P[i][1], d2 = dx * dx + dy * dy, lim = RAIL_HALF + pad;
        if (d2 < lim * lim && (!bZ || d2 < bd)) { bd = d2; bi = i; bZ = Z; }
      }
    }
    if (!bZ) return null;
    const P = bZ.pts, p = P[bi], q = P[Math.min(P.length - 1, bi + 1)], o = P[Math.max(0, bi - 1)];
    const tang = Math.atan2(q[1] - o[1], q[0] - o[0]);
    return { d: Math.sqrt(bd), x: p[0], y: p[1], tang, eta: p[3], tr: bZ.tr, moving: bZ.moving };
  },
  /* Raydan dik yönde uzaklaşma açısı (bulunulan taraf; tam ortadaysa kimliğe göre bir yan) */
  railAway(e, D) {
    const side = Math.sign(-Math.sin(D.tang) * (e.x - D.x) + Math.cos(D.tang) * (e.y - D.y)) || (e.id & 1 ? 1 : -1);
    return D.tang + side * Math.PI / 2;
  },
  /* Vagonlarla çakışma: (x, y, r) bir trenin gövdesine giriyor mu */
  trainBlock(x, y, r) {
    const TR = this.trains;
    for (let t = 0; t < TR.length; t++) {
      const tr = TR[t], B = tr.box;
      if (!B || x < B[0] || x > B[2] || y < B[1] || y > B[3]) continue;
      const cc = tr.circles;
      for (let i = 0; i < cc.length; i++) { const cx = cc[i][0], cy = cc[i][1], lim = r + 6; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < lim * lim) return tr; }
    }
    return null;
  },
  /* NPC (yaya ya da atlı): raydaysa kenara çekilir, rayı geçmek üzereyse bekler. true: bu kare yönetildi */
  railDodge(e, dt) {
    if (e.dead || e.bound || e.hide || !this.railZones || !this.railZones.length) return false;
    const pad = e.r + 7, D = this.railDanger(e.x, e.y, pad);
    if (D && D.moving && D.eta < RAIL_WARN) {
      // raydan çekil: dik yönde, gerekirse koşarak
      const a = this.railAway(e, D);
      e.ang = turnTo(e.ang, a, dt * 10); e.talk = null; e.pauseT = 0;
      if (e.mounted) e.walk(dt, 120); else e.walk(dt, D.eta < 2.5 ? 110 : 80);
      e.railT = 1.2;
      if (!(e.railSayT > this.t) && chance(0.5)) { e.railSayT = this.t + 8; Bubbles.add(e, pick([Tr('Tren geliyor!'), Tr('Çekilin, tren!'), Tr('Raylardan uzak durun!')]), 1.8); }
      return true;
    }
    // rayın kenarında: önündeki yol raya giriyorsa tren geçene kadar bekle
    const c = Math.cos(e.ang), s = Math.sin(e.ang), look = e.mounted ? 26 : 18;
    const A = this.railDanger(e.x + c * look, e.y + s * look, e.r + 4);
    // yalnızca yaklaşan tren için ve rayı geçecekse (rayın yanında boylamasına yürüyen beklemez;
    // istasyonda duran trenin vagonları katıdır, yaya onların yanından dolaşır)
    if (A && A.moving && A.eta < RAIL_WARN && Math.abs(Math.sin(e.ang - A.tang)) > 0.4) {
      e.mv = 0; e.railT = 1.2;
      if (A.moving) e.lookAt = Math.atan2(A.tr.pos[0][1] - e.y, A.tr.pos[0][0] - e.x);
      if (!(e.railSayT > this.t) && chance(0.25)) { e.railSayT = this.t + 12; Bubbles.add(e, pick([Tr('Treni bekleyelim.'), Tr('Önce tren geçsin.')]), 1.8); }
      return true;
    }
    return false;
  },
  /* Hayvan ve sahipsiz at: raydan kaçar, raya doğru gidiyorsa yön değiştirir. true: kaçış başladı */
  railShy(e) {
    if (e.dead || e.bound || e.rider || e.hitch || !this.railZones || !this.railZones.length) return false;
    const r = e.r || 4, D = this.railDanger(e.x, e.y, r + 8);
    if (D && D.moving && D.eta < RAIL_WARN) {
      // ıslıkla çağrılan at kaçtıktan sonra yine sahibine gelir
      if (e.state === 'come') e.after = 'come';
      e.ang = this.railAway(e, D) + rnd(-0.3, 0.3); e.state = 'flee'; e.t = rnd(2, 3); e.railT = e.t; return true;
    }
    const look = 14 + (e.spd || 0) * 0.4, c = Math.cos(e.ang), s = Math.sin(e.ang);
    const A = this.railDanger(e.x + c * look, e.y + s * look, r + 4);
    if (A && A.moving && A.eta < RAIL_WARN) {
      // sahibine gelen at rayın kenarında tren geçene kadar bekler
      if (e.state === 'come') return 'wait';
      // raya doğru gidiyor: sırtını raya dönüp uzaklaşır
      e.ang = this.railAway(e, A) + rnd(-0.4, 0.4);
      e.state = 'flee'; e.t = rnd(1.5, 2.5); e.railT = e.t;
      return true;
    }
    return false;
  },
  /* Araba: önündeki yol yaklaşan trenin koridoruna giriyorsa geçitten önce durmalı mı.
     Kendisi zaten raydaysa durmaz (karşıya geçer). */
  railWagon(w) {
    if (!this.railZones || !this.railZones.length) return null;
    // atlar ya da gövde rayda: durma, hızla karşıya geç
    const on = this.railDanger(w.x, w.y, 6) || this.railDanger(w.bx, w.by, 7);
    if (on && on.moving && on.eta < RAIL_WARN) return 'cross';
    // geçitten önce dur: atlar rayın ekseninden 21 px uzakta kalır (tren 15 px'ten yakını "rayda" sayar ve fren yapar)
    const c = Math.cos(w.ang), s = Math.sin(w.ang);
    for (let d = 4; d <= 36; d += 4) {
      const A = this.railDanger(w.x + c * d, w.y + s * d, 12);
      if (A && (A.moving ? A.eta < RAIL_WARN + 2 : true) && Math.abs(Math.sin(w.ang - A.tang)) > 0.35) return 'stop';
    }
    return null;
  },
  /* Tren: önündeki rayda duran (ya da raya girmiş) araba var mı; varsa ona kalan yol */
  trainObstacle(tr) {
    const ahead = Math.max(60, tr.spd * tr.spd / (2 * 60) + 40), [hx, hy] = tr.pos[0] || tr.at(tr.s);
    const wag = this.ents.filter(o => o.kind === 'wagon' && !o.remove && Math.abs(o.x - hx) < ahead + 40 && Math.abs(o.y - hy) < ahead + 40);
    if (!wag.length) return null;
    for (let d = 16; d <= ahead; d += 8) {
      const [x, y] = tr.at(tr.s + tr.dir * d);
      for (const o of wag) {
        if (Math.abs(o.x - x) > 40 || Math.abs(o.y - y) > 40) continue;
        for (const [cx, cy, cr] of o.circles()) if (dist2(cx, cy, x, y) < (cr + RAIL_HALF) * (cr + RAIL_HALF)) return { d, o };
      }
    }
    return null;
  },
  /* Hızla giden trenin önüne yine de girmiş araba: gövde vagonla çakışmasın, kenara itilir */
  trainShove(tr) {
    if (tr.spd < 15) return;
    for (const o of this.ents) {
      if (o.kind !== 'wagon' || o.remove) continue;
      const B = tr.box;
      if (!B || o.x < B[0] - 20 || o.x > B[2] + 20 || o.y < B[1] - 20 || o.y > B[3] + 20) continue;
      let hit = null;
      for (const [cx, cy, cr] of o.circles()) for (const [tx, ty] of tr.circles) if (dist2(cx, cy, tx, ty) < (cr + 6) * (cr + 6)) hit = [tx, ty];
      if (!hit) continue;
      const D = this.railDanger(o.x, o.y, 20) || { x: hit[0], y: hit[1], tang: tr.pos[0][2] };
      const a = this.railAway(o, D);
      for (let k = 0; k < 6 && o.circles().some(([cx, cy, cr]) => tr.circles.some(([tx, ty]) => dist2(cx, cy, tx, ty) < (cr + 6) * (cr + 6))); k++) {
        o.x += Math.cos(a) * 4; o.y += Math.sin(a) * 4; o.bx += Math.cos(a) * 4; o.by += Math.sin(a) * 4;
      }
      o.spd = 0;
      if (o.rider === this.player) { this.player.x = o.x; this.player.y = o.y; this.player.hurt(30, 'train'); }
      else if (o.driver && !(o.panicT > 0)) { o.panicT = 6; Bubbles.add(o, pick([Tr('Tren! Az kalsın!'), Tr('Hooop! Kıl payı!')]), 2); }
    }
  },
};
