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
  /* Her kare: trenlerin tehlike koridorları ve vagon çarpışma çemberleri */
  railTick() {
    const zones = [];
    for (const tr of this.trains) {
      if (!tr.pos[0]) continue;
      const L = tr.line, dir = tr.dir;
      // kalkmak üzere olan tren de tehlikelidir; uzun süre duran trenin yalnızca gövdesi
      const moving = tr.wait <= 0, leaving = !moving && tr.wait < 2.5;
      const ahead = moving ? Math.max(50, tr.spd * RAIL_WARN) : leaving ? 70 : 0;
      const sTail = tr.s - dir * ((tr.cars.length - 1) * tr.gap + 16), sHead = tr.s + dir * (16 + ahead);
      const a = Math.min(sTail, sHead), b = Math.max(sTail, sHead);
      const pts = [];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let s = Math.max(0, a); s <= Math.min(L.len, b) + 0.1; s += RAIL_STEP) {
        const p = tr.at(s);
        // ETA: lokomotifin bu noktaya varış süresi (gövdenin altı: 0)
        const ds = (s - tr.s) * dir;
        p.push(ds <= 0 ? 0 : ds / Math.max(tr.spd, moving ? 12 : 6) + (moving ? 0 : tr.wait));
        pts.push(p);
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      }
      if (pts.length) zones.push({ tr, pts, x0, y0, x1, y1, moving: moving || leaving });
      // vagon çemberleri (vagon 26-28 px boyunda, 12 px eninde: üç çember) ve sınır kutusu
      const cc = [];
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const [x, y, ang] of tr.pos) {
        const c = Math.cos(ang) * 8, s = Math.sin(ang) * 8;
        cc.push([x + c, y + s], [x, y], [x - c, y - s]);
        bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
      }
      tr.circles = cc; tr.box = [bx0 - 20, by0 - 20, bx1 + 20, by1 + 20];
    }
    this.railZones = zones;
    // katı arabalar (yayalar, hayvanlar, atlar ve oyuncu içlerinden geçemez)
    this.wagonsNow = this.ents.filter(o => o.kind === 'wagon' && !o.remove && !o.hide);
  },
  /* (x, y, r) bir arabanın gövdesine ya da atlarına giriyor mu (kendisi, sürdüğü ya da bindiği araba hariç) */
  wagonBlock(x, y, r, self) {
    const L = this.wagonsNow;
    if (!L) return null;
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
    let best = null;
    for (const Z of this.railZones || []) {
      if (x < Z.x0 - pad - RAIL_HALF || x > Z.x1 + pad + RAIL_HALF || y < Z.y0 - pad - RAIL_HALF || y > Z.y1 + pad + RAIL_HALF) continue;
      const P = Z.pts;
      for (let i = 0; i < P.length; i++) {
        const dx = x - P[i][0], dy = y - P[i][1], d2 = dx * dx + dy * dy, lim = RAIL_HALF + pad;
        if (d2 < lim * lim && (!best || d2 < best.d2)) best = { d2, i, Z };
      }
    }
    if (!best) return null;
    const P = best.Z.pts, p = P[best.i], q = P[Math.min(P.length - 1, best.i + 1)], o = P[Math.max(0, best.i - 1)];
    const tang = Math.atan2(q[1] - o[1], q[0] - o[0]);
    return { d: Math.sqrt(best.d2), x: p[0], y: p[1], tang, eta: p[3], tr: best.Z.tr, moving: best.Z.moving };
  },
  /* Raydan dik yönde uzaklaşma açısı (bulunulan taraf; tam ortadaysa kimliğe göre bir yan) */
  railAway(e, D) {
    const side = Math.sign(-Math.sin(D.tang) * (e.x - D.x) + Math.cos(D.tang) * (e.y - D.y)) || (e.id & 1 ? 1 : -1);
    return D.tang + side * Math.PI / 2;
  },
  /* Vagonlarla çakışma: (x, y, r) bir trenin gövdesine giriyor mu */
  trainBlock(x, y, r) {
    for (const tr of this.trains) {
      const B = tr.box;
      if (!B || x < B[0] || x > B[2] || y < B[1] || y > B[3]) continue;
      for (const [cx, cy] of tr.circles) { const lim = r + 6; if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < lim * lim) return tr; }
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
    // yalnızca rayı geçecekse (rayın yanında boylamasına yürüyen beklemez)
    if (A && (A.moving ? A.eta < RAIL_WARN : true) && Math.abs(Math.sin(e.ang - A.tang)) > 0.4) {
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
    if (A && (A.moving ? A.eta < RAIL_WARN : true)) {
      // sahibine gelen at rayın kenarında tren geçene kadar bekler
      if (e.state === 'come') return 'wait';
      // raya doğru gidiyor: sırtını raya dönüp uzaklaşır (duran trenin gövdesinden de)
      e.ang = this.railAway(e, A) + rnd(-0.4, 0.4);
      if (A.moving) { e.state = 'flee'; e.t = rnd(1.5, 2.5); e.railT = e.t; }
      return A.moving;
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
