'use strict';
/* ==========================================================
   FRONTIER'S END — Yol gösterme: rota, radarda rota çizimi, ekran kenarı okları
   İki rota: kişisel hedef (haritada işaretlenen, mor) ve görevin hedefi (altın). Görev hedefi kişisel hedefi
   kullanmaz; ikisi aynı anda görünebilir.
   Rota yolları izler: kasabada sokaklardan kapıya (TownPath), dışarıda kaba ızgarada yolu seven A*. A*'ın yolun
   üstünden geçen kısmı yolun kendi çizgisiyle değiştirilir (radarda ve haritada rota yolun üstünde durur), arazideki
   kısım yumuşatılır. Oyuncu rotanın üstündeyken rota yeniden hesaplanmaz, yalnız ilerleme işlenir; sapınca ya da hedef
   yer değiştirince yeniden hesaplanır.
   Dönüş noktaları: yola çıkış, yoldan ayrılma, kavşak, kasabaya giriş ve sokak köşeleri. Radarın altında sıradaki
   dönüş ve kalan yol/süre yazar. Hedef ekranın dışındaysa ekranın kenarında yön oku ve uzaklık görünür.
   ========================================================== */

const NAV = {
  ROAD: 0.42,      // yol hücresinin A* maliyeti (arazi ~2): rota yolu sever
  SNAP: 36,        // A* noktası yola bu kadar yakınsa yolun kendi çizgisi kullanılır (px)
  ON: 150,         // oyuncu rotaya bu kadar yakınsa rotanın üstünde sayılır (px)
  NEAR: 110,       // görev hedefine bu kadar yakında rota çizilmez (px)
  TURN: 0.6,       // dönüş sayılan yön değişimi (rad)
  RECALC: 2.5,     // yeniden hesaplama en sık (sn)
  COL: { q: [232, 184, 74], wp: [176, 80, 200] },
};

const Nav = {
  wp: null, q: null, tT: 0,
  clear() { this.wp = null; this.q = null; this.rIdx = null; for (const k of ['q', 'wp']) { const e = this._arr && this._arr[k]; if (e) e.remove(); } this._arr = null; },

  /* ---------------- rota ---------------- */
  /* yol noktaları dizini: 64 px'lik hücre → [yol sırası, nokta sırası, ...] (yollar değişince yeniden) */
  roadIndex() {
    const W = G.world;
    if (this.rIdx && this.rW === W && this.rN === W.roads.length) return this.rIdx;
    const M = new Map();
    W.roads.forEach((r, ri) => {
      for (let k = 0; k < r.pts.length; k++) {
        const p = r.pts[k], key = ((p[1] >> 6) << 12) | (p[0] >> 6);
        let a = M.get(key); if (!a) M.set(key, a = []);
        a.push(ri, k);
      }
    });
    this.rIdx = M; this.rW = W; this.rN = W.roads.length;
    return M;
  },
  /* (x, y)'ye R px'ten yakın en yakın yol noktası: [yol sırası, nokta sırası] ya da null */
  nearRoad(x, y, R) {
    const M = this.roadIndex(), W = G.world, cx = x >> 6, cy = y >> 6;
    let best = null, bd = R * R;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      const a = M.get((j << 12) | i);
      if (!a) continue;
      for (let n = 0; n < a.length; n += 2) {
        const p = W.roads[a[n]].pts[a[n + 1]], d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
        if (d < bd) { bd = d; best = [a[n], a[n + 1]]; }
      }
    }
    return best;
  },
  /* kasabadan çıkış: yol kapıları ya da (yüksek bedelle) hedefe bakan kenar */
  gate(t, tx, ty, fx, fy) {
    const G_ = TownPath.grid(t);
    const cands = t.gates.map(g => [g.x * TS + 8, g.y * TS + 8, 1]);
    cands.push([clamp(tx, (G_.x0 + 2) * TS, (G_.x0 + G_.w - 3) * TS), clamp(ty, (G_.y0 + 2) * TS, (G_.y0 + G_.h - 3) * TS), 1.25]);
    let best = [t.cx, t.cy], bd = Infinity;
    for (const [gx, gy, k] of cands) { const d = (dist(gx, gy, tx, ty) + dist(gx, gy, fx, fy)) * k; if (d < bd) { bd = d; best = [gx, gy]; } }
    return best;
  },
  /* (x0, y0)'dan (x1, y1)'e rota: { pts, seg } — seg noktanın kesimi: yol sırası (≥ 0), arazi (-1), kasaba (-2) */
  route(x0, y0, x1, y1) {
    const W = G.world, pts = [], seg = [];
    const push = (p, s) => { const L = pts[pts.length - 1]; if (L && Math.abs(L[0] - p[0]) < 1 && Math.abs(L[1] - p[1]) < 1) { seg[seg.length - 1] = s; return; } pts.push([p[0], p[1]]); seg.push(s); };
    const t0 = W.townAt(x0, y0, 4), t1 = W.townAt(x1, y1, 4);
    const inTown = (t, ax, ay, bx, by) => { const r = TownPath.find(t, ax, ay, bx, by, 4.2); return r && r.length ? r : [[bx, by]]; };
    push([x0, y0], t0 ? -2 : -1);
    if (t0 && t0 === t1) { for (const p of inTown(t0, x0, y0, x1, y1)) push(p, -2); push([x1, y1], -2); return { pts, seg }; }
    let ax = x0, ay = y0, bx = x1, by = y1;
    if (t0) { const g = this.gate(t0, x1, y1, x0, y0); for (const p of inTown(t0, x0, y0, g[0], g[1])) push(p, -2); ax = g[0]; ay = g[1]; }
    if (t1) { const g = this.gate(t1, ax, ay, x1, y1); bx = g[0]; by = g[1]; }
    this.outside(ax, ay, bx, by, push, pts);
    if (t1) for (const p of inTown(t1, bx, by, x1, y1)) push(p, -2);
    push([x1, y1], t1 ? -2 : -1);
    return { pts, seg };
  },
  /* kasaba dışı: yolu seven A*; yolun üstündeki kısım yolun kendi çizgisi, arazideki kısım yumuşatılmış */
  outside(ax, ay, bx, by, push, pts) {
    const W = G.world, C = W.cost;
    if (!C) { push([bx, by], -1); return; }
    const cell = (v, m) => clamp((v / TS / CG) | 0, 0, m - 1);
    const cost = (ni) => { const c = C[ni]; return c >= 1e5 ? 4 : c > 20 ? 40 : c <= 0.6 ? NAV.ROAD : c; };
    const path = W.astar(cell(ax, CW), cell(ay, CHH), cell(bx, CW), cell(by, CHH), cost);
    if (!path) { push([bx, by], -1); return; }
    const P = path.map(p => [p[0] * TS + 8, p[1] * TS + 8]);
    let i = 0;
    while (i < P.length) {
      const r = this.nearRoad(P[i][0], P[i][1], NAV.SNAP);
      if (r) {
        // aynı yolun üstünde kalan ardışık noktalar
        const ri = r[0], k0 = r[1];
        let k1 = k0, j = i + 1;
        while (j < P.length) { const q = this.nearRoad(P[j][0], P[j][1], NAV.SNAP); if (!q || q[0] !== ri) break; k1 = q[1]; j++; }
        if (j - i >= 2 && Math.abs(k1 - k0) >= 2) { const R = W.roads[ri].pts, s = k1 >= k0 ? 1 : -1; for (let k = k0; k !== k1 + s; k += s) push(R[k], ri); }
        else for (let k = i; k < j; k++) push(P[k], -1);   // yolu yalnız kesip geçiyor
        i = j;
        continue;
      }
      // arazi parçası: sonraki yola kadar, yumuşatılmış
      const off = [];
      while (i < P.length && !this.nearRoad(P[i][0], P[i][1], NAV.SNAP)) off.push(P[i++]);
      const prev = pts[pts.length - 1], nxt = i < P.length ? (() => { const q = this.nearRoad(P[i][0], P[i][1], NAV.SNAP); return W.roads[q[0]].pts[q[1]]; })() : [bx, by];
      const sm = World.chaikin([prev, ...off, nxt], 2);
      for (let k = 1; k < sm.length - 1; k++) push(sm[k], -1);
    }
    push([bx, by], -1);
  },
  /* rotayı kur: uzunluklar ve dönüş noktaları */
  build(tx, ty) {
    const P = G.player, r = this.route(P.x, P.y, tx, ty), N = r.pts.length, cum = new Float64Array(N);
    for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + dist(r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]);
    Object.assign(r, { tx, ty, cum, len: cum[N - 1] || 0, i: 0, done: 0, px: P.x, py: P.y, t: G.t });
    r.turns = this.turns(r);
    return r;
  },
  /* i noktasından 40 px geriye (dir -1) ya da ileriye (dir 1) gidiş yönü */
  dirAt(r, i, dir) {
    const P = r.pts, C = r.cum;
    let j = i;
    while (j + dir >= 0 && j + dir < P.length && Math.abs(C[j + dir] - C[i]) < 40) j += dir;
    if (j === i) j = clamp(i + dir, 0, P.length - 1);
    if (j === i) return 0;
    return dir < 0 ? Math.atan2(P[i][1] - P[j][1], P[i][0] - P[j][0]) : Math.atan2(P[j][1] - P[i][1], P[j][0] - P[i][0]);
  },
  /* dönüşler: kesimin değiştiği yer (yola çıkış, yoldan ayrılma, kavşak, kasaba) ve kasaba içinde sokak köşeleri.
     s: 1 sağa, -1 sola (ekranda y aşağı: açı artışı saat yönü) */
  turns(r) {
    const out = [], P = r.pts, S = r.seg;
    for (let i = 1; i < P.length - 1; i++) {
      const edge = S[i] !== S[i - 1], corner = S[i] === -2 && S[i - 1] === -2;
      if (!edge && !corner) continue;
      const da = angDiff(this.dirAt(r, i, -1), this.dirAt(r, i, 1));
      if (Math.abs(da) < (corner ? 0.9 : NAV.TURN)) continue;
      if (out.length && r.cum[i] - out[out.length - 1].d < 30) continue;   // aynı köşenin ikinci noktası
      out.push({ i, d: r.cum[i], s: Math.sign(da), x: P[i][0], y: P[i][1] });
    }
    return out;
  },
  /* oyuncunun rotadaki yeri: ilerleme sırasının çevresinde en yakın parçaya izdüşüm. Rotanın dışındaysa false */
  progress(r) {
    const P = G.player, pts = r.pts;
    if (pts.length < 2) return false;
    let bi = -1, bd = Infinity, bt = 0;
    const scan = (i0, i1) => {
      for (let i = i0; i < i1; i++) {
        const a = pts[i], b = pts[i + 1], vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1;
        const t = clamp(((P.x - a[0]) * vx + (P.y - a[1]) * vy) / L2, 0, 1), x = a[0] + vx * t, y = a[1] + vy * t;
        const d = (P.x - x) * (P.x - x) + (P.y - y) * (P.y - y);
        if (d < bd) { bd = d; bi = i; bt = t; }
      }
    };
    // önce ilerlemenin çevresi; orada yoksa (ışınlanma, faytonla yolculuk) bütün rota
    scan(Math.max(0, r.i - 12), Math.min(pts.length - 1, r.i + 120));
    if (bd > NAV.ON * NAV.ON) scan(0, pts.length - 1);
    if (bi < 0 || bd > NAV.ON * NAV.ON) return false;
    const a = pts[bi], b = pts[bi + 1];
    r.i = bi; r.done = r.cum[bi] + (r.cum[bi + 1] - r.cum[bi]) * bt;
    r.px = a[0] + (b[0] - a[0]) * bt; r.py = a[1] + (b[1] - a[1]) * bt;
    return true;
  },
  /* hedefi izle: hedef yer değiştirdiyse ya da oyuncu rotadan saptıysa yeniden (en sık RECALC sn'de bir) */
  follow(r, tgt, quest) {
    if (!tgt) return null;
    const P = G.player;
    if (quest && dist(P.x, P.y, tgt[0], tgt[1]) < NAV.NEAR) return null;
    const moved = !r || dist(r.tx, r.ty, tgt[0], tgt[1]) > 64;
    const on = r && this.progress(r);
    if (r && !moved && on) return r;
    if (r && G.t - r.t < (moved && on ? NAV.RECALC * 1.4 : NAV.RECALC)) { r.tx2 = tgt[0]; r.ty2 = tgt[1]; return r; }
    const n = this.build(tgt[0], tgt[1]);
    this.progress(n);
    return n;
  },
  /* her kare (ucuz): dört kez saniyede rotalar güncellenir */
  tick(dt) {
    if (G.state !== 'play' || !G.player || !G.world) return;
    if ((this.tT -= dt) > 0) return;
    this.tT = 0.25;
    const wp = G.waypoint;
    this.wp = this.follow(this.wp, wp ? [wp.x, wp.y] : null, false);
    G.gps = this.wp ? this.wp.pts : null;   // eski ad (kayıt dışı; harita ekranı rotayı buradan da okur)
    let qm = null;
    try { qm = G.storyOn && !G.cine ? G.questMark() : null; } catch (e) { qm = null; }
    this.q = this.follow(this.q, qm ? [qm.x, qm.y] : null, true);
  },
  /* kalan yol (px) */
  left(r) { return r ? Math.max(0, r.len - r.done) + dist(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1], r.tx2 !== undefined ? r.tx2 : r.tx, r.ty2 !== undefined ? r.ty2 : r.ty) : 0; },
  /* sıradaki dönüş (oyuncunun önünde, 1500 px içinde) ve ona kalan yol */
  nextTurn(r) {
    if (!r || !r.turns) return null;
    for (const T of r.turns) if (T.d > r.done + 12) return T.d - r.done < 1500 ? { T, d: T.d - r.done } : null;
    return null;
  },
  /* kalan süre (oyun dakikası): o anki gidişe göre (yaya, at, araba, fayton) */
  etaMin(d) {
    const P = G.player, h = P.riding;
    const sp = P.passenger ? CARRIAGE_SPD : h ? (h.motor ? 210 : h.kind === 'wagon' ? 80 : 118 * ((h.def && h.def.spd) || 1)) : 58;
    return d / sp * MIN_PER_SEC;
  },
  fmtEta(m) { return m >= 60 ? Tr`~${Math.round(m / 6) / 10} sa` : Tr`~${Math.max(1, Math.round(m))} dk`; },

  /* ---------------- radar ---------------- */
  /* Rotalar radarda: geride kalan kısım soluk; öndeki kısım koyu kenarlı renkli çizgi, üstünde gidiş yönünde kayan
     oklar; sıradaki dönüşün yerinde küçük bir yön işareti. toR: dünya → radar dönüşümü (aynı diziye yazar) */
  radar(c, toR, C, R, t) {
    for (const k of ['wp', 'q']) {
      const r = this[k];
      if (!r || r.pts.length < 2) continue;
      const col = NAV.COL[k], rgb = (a) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      const pts = r.pts, i0 = r.i;
      c.lineCap = 'round'; c.lineJoin = 'round';
      // geride kalan son ~400 px: soluk
      let k0 = i0;
      while (k0 > 0 && r.done - r.cum[k0] < 400) k0--;
      if (i0 > k0 || r.done > r.cum[k0]) {
        c.beginPath();
        for (let i = k0; i <= i0; i++) { const q = toR(pts[i][0], pts[i][1]); if (i === k0) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]); }
        const q = toR(r.px, r.py); c.lineTo(q[0], q[1]);
        c.strokeStyle = rgb(0.28); c.lineWidth = 2; c.stroke();
      }
      // öndeki kısım (radarın dışına taşan uzun rota: yalnız ekrana yakın kısım)
      c.beginPath();
      const q0 = toR(r.px, r.py); c.moveTo(q0[0], q0[1]);
      let n = 0;
      const lim = R * 1.6;
      for (let i = i0 + 1; i < pts.length; i++) {
        const q = toR(pts[i][0], pts[i][1]);
        c.lineTo(q[0], q[1]);
        // radarın epey dışına çıkınca (üç nokta üst üste) gerisi çizilmez
        if (Math.abs(q[0] - C) > lim || Math.abs(q[1] - C) > lim) { if (++n > 2) break; } else n = 0;
      }
      c.strokeStyle = 'rgba(30,18,8,0.55)'; c.lineWidth = 4.6; c.stroke();
      c.strokeStyle = rgb(0.95); c.lineWidth = 2.6; c.stroke();
      // gidiş yönünde kayan oklar (rota boyunca her 22 birimde bir)
      this.chevrons(c, r, toR, C, R, t);
      // sıradaki dönüş
      const nt = this.nextTurn(r);
      if (nt) {
        const q = toR(nt.T.x, nt.T.y);
        if (Math.hypot(q[0] - C, q[1] - C) < R - 6) this.turnGlyph(c, q[0], q[1], nt.T.s, this.dirAt(r, nt.T.i, 1), rgb(1));
      }
    }
  },
  chevrons(c, r, toR, C, R, t) {
    const pts = r.pts, step = 22, off = (t * 26) % step;
    let acc = -off, prev = toR(r.px, r.py).slice(), drawn = 0;
    c.strokeStyle = 'rgba(255,248,228,0.85)'; c.lineWidth = 1.3;
    c.beginPath();
    for (let i = r.i + 1; i < pts.length && drawn < 14; i++) {
      const q = toR(pts[i][0], pts[i][1]), sx = q[0] - prev[0], sy = q[1] - prev[1], L = Math.hypot(sx, sy);
      if (L < 0.01) continue;
      let u = step - acc;
      while (u <= L) {
        const x = prev[0] + sx * u / L, y = prev[1] + sy * u / L;
        if (Math.hypot(x - C, y - C) > R - 5) { drawn = 99; break; }
        const a = Math.atan2(sy, sx), ca = Math.cos(a), sa = Math.sin(a);
        c.moveTo(x - ca * 2.2 - sa * 2.2, y - sa * 2.2 + ca * 2.2); c.lineTo(x + ca * 1.2, y + sa * 1.2); c.lineTo(x - ca * 2.2 + sa * 2.2, y - sa * 2.2 - ca * 2.2);
        drawn++;
        u += step;
      }
      acc = (acc + L) % step;
      prev = [q[0], q[1]];
    }
    c.stroke();
  },
  /* dönüş işareti: koyu daire, içinde kıvrık ok (s: 1 sağ, -1 sol); a: dönüşten sonraki gidiş yönü */
  turnGlyph(c, x, y, s, a, col) {
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(24,15,8,0.88)'; c.beginPath(); c.arc(0, 0, 5.4, 0, TAU); c.fill();
    c.strokeStyle = col; c.lineWidth = 1; c.stroke();
    c.rotate(a);
    c.strokeStyle = '#fff6df'; c.lineWidth = 1.2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-3, 0); c.lineTo(2.6, 0); c.moveTo(0.6, -2); c.lineTo(2.8, 0); c.lineTo(0.6, 2); c.stroke();
    c.restore();
  },
  /* sıradaki dönüşün oku (yazı için: ekranda sola/sağa kıvrılan küçük ok) */
  turnIcon(c, x, y, s, col) {
    c.save(); c.translate(x, y);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, 4.5); c.lineTo(0, -0.5); c.quadraticCurveTo(0, -3, s * 2.6, -3); c.lineTo(s * 4, -3); c.stroke();
    c.beginPath(); c.moveTo(s * 5.4, -3); c.lineTo(s * 3.2, -5.2); c.lineTo(s * 3.2, -0.8); c.closePath(); c.fill();
    c.restore();
  },
  /* radarın altında: sıradaki dönüş ve kalan yol/süre (önce kişisel hedef, yoksa görev) */
  radarInfo(c, C, R) {
    const k = this.wp ? 'wp' : this.q ? 'q' : null;
    if (!k) return;
    const r = this[k], col = NAV.COL[k], rgb = `rgb(${col[0]},${col[1]},${col[2]})`;
    const d = this.left(r), nt = this.nextTurn(r);
    const txt = `${fmtDist(d)} · ${this.fmtEta(this.etaMin(d))}`, tt = nt ? fmtDist(nt.d) : '';
    c.save();
    c.font = '9px "IM Fell English SC", serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    const w1 = c.measureText(txt).width, w2 = nt ? c.measureText(tt).width + 13 : 0, gap = nt ? 8 : 0, W = w1 + w2 + gap + 16, x0 = C - W / 2, y = C + R - 25;
    c.fillStyle = 'rgba(20,12,6,0.74)';
    c.beginPath(); c.roundRect ? c.roundRect(x0, y - 7, W, 14, 7) : c.rect(x0, y - 7, W, 14); c.fill();
    c.fillStyle = rgb; c.beginPath(); c.arc(x0 + 7, y, 2.2, 0, TAU); c.fill();
    let x = x0 + 12;
    if (nt) { this.turnIcon(c, x + 4, y + 0.5, nt.T.s, '#fff3d6'); c.fillStyle = '#fff3d6'; c.fillText(tt, x + 11, y + 0.5); x += w2 + gap; }
    c.fillStyle = '#efe2c4'; c.fillText(txt, x, y + 0.5);
    c.restore();
  },

  /* ---------------- harita ekranı ---------------- */
  map(c, toS) {
    for (const k of ['wp', 'q']) {
      const r = this[k];
      if (!r || r.pts.length < 2) continue;
      const col = NAV.COL[k];
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      const s0 = toS(r.px, r.py); c.moveTo(s0[0], s0[1]);
      for (let i = r.i + 1; i < r.pts.length; i++) { const s = toS(r.pts[i][0], r.pts[i][1]); c.lineTo(s[0], s[1]); }
      c.strokeStyle = 'rgba(40,24,10,0.55)'; c.lineWidth = 5; c.stroke();
      c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.95)`; c.lineWidth = 3; c.setLineDash([8, 5]); c.stroke(); c.setLineDash([]);
    }
  },

  /* ---------------- ekran kenarı okları ---------------- */
  /* Hedef ekranın dışındaysa ekranın kenarında (köşelerdeki göstergelerden uzak bir elips üstünde) yön oku ve uzaklık */
  edge() {
    const P = G.player;
    const off = G.state !== 'play' || !P || P.dead || G.cine || G.binoc || UI.isModal() || UI.state === 'fade' || UI.mapShown();
    const A = this._arr || (this._arr = {});
    const r = G.canvasRect(), kx = r.width / G.vw, Cm = G.cam;
    const vw = innerWidth, vh = innerHeight;
    for (const k of ['q', 'wp']) {
      let tgt = null;
      if (!off) {
        if (k === 'wp' && G.waypoint) tgt = [G.waypoint.x, G.waypoint.y];
        if (k === 'q' && this.q) tgt = [this.q.tx2 !== undefined ? this.q.tx2 : this.q.tx, this.q.ty2 !== undefined ? this.q.ty2 : this.q.ty];
      }
      let el = A[k];
      const sx = tgt ? r.left + (tgt[0] - Cm.ox) * kx : 0, sy = tgt ? r.top + (tgt[1] - Cm.oy) * kx : 0;
      const inside = tgt && sx > 24 && sx < vw - 24 && sy > 24 && sy < vh - 24;
      if (!tgt || inside) { if (el && !el.classList.contains('off')) el.classList.add('off'); continue; }
      if (!el || !el.isConnected) {
        el = A[k] = document.createElement('div'); el.className = 'nava off ' + k;
        el.innerHTML = '<svg viewBox="-10 -10 20 20"><path></path></svg><span></span>';
        const h = document.getElementById('hud') || document.body; h.insertBefore(el, h.firstChild);
      }
      const cx = vw / 2, cy = vh / 2, a = Math.atan2(sy - cy, sx - cx);
      // elips: köşelerdeki radar, istem ve göstergelerden uzak
      const ex = vw / 2 - 70, ey = vh / 2 - 64;
      const x = cx + Math.cos(a) * ex, y = cy + Math.sin(a) * ey;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      // ok şeklin noktaları açıyla hesaplanır (CSS döndürmesi yok: küçük döndürülmüş öğeyi her çizici doğru çizmiyor)
      if (el._a === undefined || Math.abs(angDiff(el._a, a)) > 0.02) {
        el._a = a;
        const ca = Math.cos(a), sa = Math.sin(a), P_ = (x, y) => `${(x * ca - y * sa).toFixed(2)} ${(x * sa + y * ca).toFixed(2)}`;
        el.firstChild.firstChild.setAttribute('d', `M${P_(9.5, 0)} L${P_(-7, -5)} L${P_(-3.2, 0)} L${P_(-7, 5)} Z`);
      }
      const d = fmtDist(this.left(k === 'q' ? this.q : this.wp) || dist(P.x, P.y, tgt[0], tgt[1]));
      if (el._d !== d) { el._d = d; el.lastChild.textContent = d; }
      if (el.classList.contains('off')) el.classList.remove('off');
    }
  },
};
