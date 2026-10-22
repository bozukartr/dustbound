'use strict';
/* ==========================================================
   FRONTIER'S END — bilardo (Saint Clement kulübünün bilardo salonu)
   - Yedi top: masaya üçgen dizilmiş yedi renkli top ve beyaz istaka
     topu. Sırayla vurulur; top sokan bir daha vurur, sokamayan ya da
     beyazı deliğe düşüren sırayı rakibe bırakır (beyaz baş noktasına
     döner). İlk dört topu sokan kazanır.
   - Nişan: fareyle ya da sol/sağ (yukarı/aşağı ince ayar). Güç: sol
     tık ya da onay tuşu basılı tutulur, gösterge dolup boşalır;
     bırakınca vurulur. Kılavuz çizgi beyazın gideceği yeri ve
     vurulan topun yönünü gösterir.
   - Bahis oyun başında konur; kazanan bahsin iki katını alır. Bahis
     büyüdükçe rakip daha usta. Oyun bırakılırsa bahis kaybedilir.
   - Fizik: sabit sürtünme, eşit kütleli esnek çarpışma, bantta enerji
     kaybı; küçük alt adımlarla (top birbirinin içinden geçmez).
   ========================================================== */

const BILLIARD_BETS = [1, 2.5, 5];
const BL = {
  W: 320, H: 180, L: 18, T: 18, R: 302, B: 162, r: 4.2,
  FRIC: 110, VMAX: 470, ECUSH: 0.74, EBALL: 0.95, WIN: 4,
  COLS: ['#e8c030', '#2a4ab8', '#c82a2a', '#6a2a8a', '#e07020', '#1e8a4a', '#161616'],
  NOISE: [0.03, 0.021, 0.014],   // bahse göre rakibin nişan sapması (radyan)
  get MY() { return (this.T + this.B) / 2; },
  get HEAD() { return this.L + (this.R - this.L) * 0.25; },
  get FOOT() { return this.L + (this.R - this.L) * 0.72; },
  pockets() { const { L, T, R, B } = this; return [[L, T, 8.6], [(L + R) / 2, T - 2.5, 7.6], [R, T, 8.6], [L, B, 8.6], [(L + R) / 2, B + 2.5, 7.6], [R, B, 8.6]]; },
  /* Üçgen diziliş: tepe ayak noktasında, sıralar sağa doğru; siyah en arkada */
  rack() {
    const r = this.r, dx = r * 2 * 0.87 + 0.15, my = this.MY, fx = this.FOOT;
    const cols = this.COLS.slice(0, 6).sort(() => Math.random() - 0.5);
    const at = [[0, 0], [1, -1], [1, 1], [2, -2], [2, 0], [2, 2]].map(([k, j]) => [fx + k * dx, my + j * (r + 0.08)]);
    const balls = [{ x: this.HEAD, y: my, vx: 0, vy: 0, c: '#f2eee2', cue: true }];
    at.forEach(([x, y], i) => balls.push({ x: x + rnd(-0.05, 0.05), y: y + rnd(-0.05, 0.05), vx: 0, vy: 0, c: cols[i] }));
    balls.push({ x: fx + 3 * dx, y: my, vx: 0, vy: 0, c: this.COLS[6], black: true });
    return balls;
  },
  moving(st) { return st.balls.some(b => !b.in && (b.vx || b.vy)); },
  /* Bir alt adım: hareket ve sürtünme, cepler, bantlar, top-top çarpışmaları */
  step(st, h) {
    const { L, T, R, B, r } = this, P = this.pockets(), bs = st.balls;
    for (const b of bs) {
      if (b.in || (!b.vx && !b.vy)) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 2) { b.vx = b.vy = 0; continue; }
      const k = Math.max(0, sp - this.FRIC * h) / sp;
      b.vx *= k; b.vy *= k; b.x += b.vx * h; b.y += b.vy * h;
    }
    for (const b of bs) {
      if (b.in) continue;
      for (const [px, py, pr] of P) if ((b.x - px) ** 2 + (b.y - py) ** 2 < pr * pr) { b.in = true; b.vx = b.vy = 0; st.potted.push(b); st.snd.pot = 1; break; }
      if (b.in) continue;
      // bant: ceplerin ağzında bant yok
      const cornerY = b.y < T + 9 || b.y > B - 9, sideX = Math.abs(b.x - (L + R) / 2) < 7.5, cornerX = b.x < L + 9 || b.x > R - 9;
      if (b.x < L + r && !cornerY) { b.x = L + r; b.vx = Math.abs(b.vx) * this.ECUSH; st.snd.cush = Math.max(st.snd.cush, Math.abs(b.vx)); }
      if (b.x > R - r && !cornerY) { b.x = R - r; b.vx = -Math.abs(b.vx) * this.ECUSH; st.snd.cush = Math.max(st.snd.cush, Math.abs(b.vx)); }
      if (b.y < T + r && !cornerX && !sideX) { b.y = T + r; b.vy = Math.abs(b.vy) * this.ECUSH; st.snd.cush = Math.max(st.snd.cush, Math.abs(b.vy)); }
      if (b.y > B - r && !cornerX && !sideX) { b.y = B - r; b.vy = -Math.abs(b.vy) * this.ECUSH; st.snd.cush = Math.max(st.snd.cush, Math.abs(b.vy)); }
      // ağızdan masanın dışına taşan top deliğe düşer
      if (b.x < L - 6 || b.x > R + 6 || b.y < T - 6 || b.y > B + 6) { b.in = true; b.vx = b.vy = 0; st.potted.push(b); st.snd.pot = 1; }
    }
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (a.in) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const c = bs[j];
        if (c.in) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy, m = 2 * r;
        if (d2 >= m * m || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vn > 0) {
          const j_ = vn * (1 + this.EBALL) / 2;
          a.vx -= j_ * nx; a.vy -= j_ * ny; c.vx += j_ * nx; c.vy += j_ * ny;
          st.snd.click = Math.max(st.snd.click, vn);
          if (a.cue || c.cue) st.hit = true;
        }
        const o = (m - d) / 2;
        a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
      }
    }
  },
  /* (x0,y0)→(x1,y1) doğrusu bir topa (ignore dışındaki) değiyor mu */
  blocked(st, x0, y0, x1, y1, ignore) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, m = 2 * this.r - 0.3;
    for (const b of st.balls) {
      if (b.in || ignore.includes(b)) continue;
      const t = clamp(((b.x - x0) * dx + (b.y - y0) * dy) / L2, 0, 1), px = x0 + dx * t - b.x, py = y0 + dy * t - b.y;
      if (px * px + py * py < m * m) return true;
    }
    return false;
  },
  /* Nişan çizgisi: beyazın ilk değdiği top (hayalet top konumu) ya da bant */
  aimLine(st, ang) {
    const cue = st.balls[0], r = this.r, ux = Math.cos(ang), uy = Math.sin(ang);
    let best = Infinity, hit = null;
    for (const b of st.balls) {
      if (b === cue || b.in) continue;
      const fx = b.x - cue.x, fy = b.y - cue.y, t = fx * ux + fy * uy;
      if (t <= 0) continue;
      const q = fx * fx + fy * fy - t * t, R2 = 4 * r * r;
      if (q > R2) continue;
      const tt = t - Math.sqrt(R2 - q);
      if (tt < best) { best = tt; hit = b; }
    }
    const { L, T, R, B } = this;
    const tx = ux > 0 ? (R - r - cue.x) / ux : ux < 0 ? (L + r - cue.x) / ux : Infinity, ty = uy > 0 ? (B - r - cue.y) / uy : uy < 0 ? (T + r - cue.y) / uy : Infinity, tw = Math.max(0, Math.min(tx, ty));
    if (!hit || best > tw) return { x: cue.x + ux * tw, y: cue.y + uy * tw, ball: null };
    const gx = cue.x + ux * best, gy = cue.y + uy * best;
    return { x: gx, y: gy, ball: hit, ox: hit.x - gx, oy: hit.y - gy };
  },
  /* Rakibin vuruşu: hayalet top yöntemiyle her top-cep çiftine bakar, yolu açık ve açısı rahat olanı seçer */
  aiShot(st) {
    const cue = st.balls[0], r = this.r, F = this.FRIC, out = [];
    for (const o of st.balls) {
      if (o === cue || o.in) continue;
      for (const [px, py] of this.pockets()) {
        const dx = px - o.x, dy = py - o.y, d2 = Math.hypot(dx, dy), ux = dx / d2, uy = dy / d2;
        const gx = o.x - ux * 2 * r, gy = o.y - uy * 2 * r, ax = gx - cue.x, ay = gy - cue.y, d1 = Math.hypot(ax, ay);
        if (d1 < 1 || gx < this.L + r || gx > this.R - r || gy < this.T + r || gy > this.B - r) continue;
        const cs = (ax * ux + ay * uy) / d1;
        if (cs < 0.3) continue;
        if (this.blocked(st, cue.x, cue.y, gx, gy, [cue, o]) || this.blocked(st, o.x, o.y, px, py, [cue, o])) continue;
        const vo = Math.sqrt(2 * F * d2) + 45, vc = vo / cs, v0 = Math.sqrt(vc * vc + 2 * F * d1);
        out.push({ ang: Math.atan2(ay, ax), pow: clamp(v0 * 1.08 / this.VMAX, 0.22, 1), score: cs * cs / (1 + (d1 + d2) / 160) });
      }
    }
    out.sort((a, b) => b.score - a.score);
    if (out.length) return out[0];
    // açık atış yoksa en yakın topa orta güçte vurur
    let near = null, nd = Infinity;
    for (const o of st.balls) if (o !== cue && !o.in) { const d = Math.hypot(o.x - cue.x, o.y - cue.y); if (d < nd) { nd = d; near = o; } }
    return near ? { ang: Math.atan2(near.y - cue.y, near.x - cue.x), pow: 0.55, score: 0 } : { ang: 0, pow: 0.4, score: 0 };
  },
  /* Beyaz deliğe düştüyse baş noktasına (doluysa biraz aşağı/yukarı) döner */
  respot(st) {
    const cue = st.balls[0];
    cue.in = false; cue.vx = cue.vy = 0;
    for (const dy of [0, 10, -10, 20, -20, 30, -30]) {
      const x = this.HEAD, y = this.MY + dy;
      if (!st.balls.some(b => b !== cue && !b.in && (b.x - x) ** 2 + (b.y - y) ** 2 < (2 * this.r + 1) ** 2)) { cue.x = x; cue.y = y; return; }
    }
    cue.x = this.HEAD; cue.y = this.MY;
  },
  /* ---------------- çizim (320x180 piksel) ---------------- */
  felt: null,
  feltPat(g) {
    if (this.felt) return this.felt;
    const c = makeCanvas(64, 64), x = c.getContext('2d'), d = x.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) { const n = hash2(i % 64, (i / 64) | 0, 91), k = n > 0.92 ? 10 : n < 0.08 ? -8 : 0; d.data[i * 4] = 30 + k; d.data[i * 4 + 1] = 106 + k; d.data[i * 4 + 2] = 68 + k; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    return (this.felt = g.createPattern(c, 'repeat'));
  },
  draw(g, st) {
    const { W, H, L, T, R, B, r } = this;
    g.fillStyle = '#140d08'; g.fillRect(0, 0, W, H);
    // ahşap kasa ve pirinç köşeler
    g.fillStyle = '#4a2a16'; g.fillRect(4, 4, W - 8, H - 8);
    g.fillStyle = '#6a3e22'; g.fillRect(5, 5, W - 10, 3); g.fillStyle = '#2e1a0e'; g.fillRect(5, H - 8, W - 10, 3);
    for (let x = 8; x < W - 8; x += 6) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 8, 1, H - 16); }
    g.fillStyle = '#c8a040'; for (const [x, y] of [[4, 4], [W - 10, 4], [4, H - 10], [W - 10, H - 10]]) g.fillRect(x, y, 6, 6);
    // elmaslar
    g.fillStyle = '#e8dcb8';
    for (let k = 1; k < 8; k++) { if (k === 4) continue; const x = L + (R - L) * k / 8; g.fillRect(x - 0.5, 9, 1.5, 1.5); g.fillRect(x - 0.5, H - 11, 1.5, 1.5); }
    for (let k = 1; k < 4; k++) { const y = T + (B - T) * k / 4; g.fillRect(9, y - 0.5, 1.5, 1.5); g.fillRect(W - 11, y - 0.5, 1.5, 1.5); }
    // bantlar ve çuha
    g.fillStyle = '#145236'; g.fillRect(L - 6, T - 6, R - L + 12, B - T + 12);
    g.fillStyle = this.feltPat(g); g.fillRect(L, T, R - L, B - T);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(this.HEAD, T, 0.6, B - T);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(L, T, R - L, 2); g.fillRect(L, T, 2, B - T);
    // cepler
    for (const [px, py, pr] of this.pockets()) { g.fillStyle = '#3a2414'; g.beginPath(); g.arc(px, py, pr + 1.2, 0, TAU); g.fill(); g.fillStyle = '#060404'; g.beginPath(); g.arc(px, py, pr - 0.6, 0, TAU); g.fill(); }
    // nişan kılavuzu
    const cue = st.balls[0], aiming = (st.phase === 'aim' || st.phase === 'ai') && !cue.in;
    if (aiming && st.phase === 'aim') {
      const A = this.aimLine(st, st.ang), len = Math.hypot(A.x - cue.x, A.y - cue.y);
      g.fillStyle = 'rgba(244,240,224,0.55)';
      for (let t = r + 2; t < len; t += 4) g.fillRect(cue.x + Math.cos(st.ang) * t - 0.5, cue.y + Math.sin(st.ang) * t - 0.5, 1, 1);
      g.strokeStyle = 'rgba(244,240,224,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.arc(A.x, A.y, r, 0, TAU); g.stroke();
      if (A.ball) { const d = Math.hypot(A.ox, A.oy) || 1; g.strokeStyle = 'rgba(255,230,150,0.75)'; g.beginPath(); g.moveTo(A.ball.x, A.ball.y); g.lineTo(A.ball.x + A.ox / d * 18, A.ball.y + A.oy / d * 18); g.stroke(); }
    }
    // toplar
    for (const b of st.balls) {
      if (b.in) continue;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(b.x + 1, b.y + 1.3, r, 0, TAU); g.fill();
      g.fillStyle = b.c; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill();
      g.fillStyle = shadeHex(b.c, -0.35); g.beginPath(); g.arc(b.x + 0.9, b.y + 0.9, r - 0.9, 0.1, Math.PI * 0.9); g.fill();
      if (b.black) { g.fillStyle = '#f2eee2'; g.beginPath(); g.arc(b.x, b.y, 1.5, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(b.x - 2, b.y - 2.4, 1.4, 1.2);
    }
    // istaka
    if (aiming) {
      const a = st.ang, back = 6 + (st.pull || 0) * 18, ux = Math.cos(a), uy = Math.sin(a);
      const x0 = cue.x - ux * back, y0 = cue.y - uy * back, x1 = x0 - ux * 92, y1 = y0 - uy * 92;
      g.lineCap = 'round';
      g.strokeStyle = '#3a2010'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x0 - ux * 52, y0 - uy * 52); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = '#d8b878'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 - ux * 54, y0 - uy * 54); g.stroke();
      g.strokeStyle = '#f0ece0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 - ux * 2.2, y0 - uy * 2.2); g.stroke();
      g.lineCap = 'butt';
    }
  },
};

Object.assign(UI, {
  openBilliards(b) {
    const P = G.player, sex = chance(0.85) ? 'm' : 'f';
    const st = { phase: 'bet', bet: BILLIARD_BETS[1], balls: BL.rack(), potted: [], snd: { click: 0, cush: 0, pot: 0 }, score: [0, 0], turn: 0, ang: 0, pull: 0, charge: 0, msg: '', opp: randomName(sex), games: 0, quitT: 0, wait: 0 };
    const el = el_('div', 'modal panel billiards');
    el.innerHTML = `<div class="p-head"><div class="p-title">${Tr('Bilardo')}</div><div class="p-sub"></div></div>
      <div class="bl-score"><div class="bl-me"></div><div class="bl-msg"></div><div class="bl-opp"></div></div>
      <canvas class="bl-cv" width="${BL.W}" height="${BL.H}"></canvas>
      <div class="bl-pow"><i></i></div><div class="p-foot"></div>`;
    const cv = el.querySelector('.bl-cv'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const $q = (s) => el.querySelector(s);
    const G_ = (a) => Input.glyph(a);
    const hud = () => {
      $q('.p-sub').innerHTML = Tr`Yedi top · ilk ${BL.WIN} topu sokan kazanır · Bahis: ${st.phase === 'bet' ? '◀ ' + fmtMoney(st.bet) + ' ▶' : fmtMoney(st.bet)} · Cüzdan: ${fmtMoney(P.money)}`;
      $q('.bl-me').innerHTML = `${Tr('Sen')} <b>${st.score[0]}</b>`;
      $q('.bl-opp').innerHTML = `<b>${st.score[1]}</b> ${escapeHtml(st.opp)}`;
      $q('.bl-me').classList.toggle('turn', st.turn === 0 && st.phase !== 'bet' && st.phase !== 'over');
      $q('.bl-opp').classList.toggle('turn', st.turn === 1 && st.phase !== 'bet' && st.phase !== 'over');
      $q('.bl-msg').innerHTML = st.msg;
      $q('.p-foot').innerHTML = st.phase === 'bet' ? Tr`◀ ▶ Bahis &nbsp; ${G_('confirm')} Başla &nbsp; ${G_('back')} Kalk`
        : st.phase === 'over' ? Tr`${G_('confirm')} Yeni Oyun &nbsp; ${G_('back')} Kalk`
        : Tr`Fare ya da ◀ ▶ (▲ ▼ ince) nişan &nbsp; Sol tık / ${G_('confirm')} basılı tut: güç, bırak: vur &nbsp; ${G_('back')} Oyunu Bırak`;
      $q('.bl-pow i').style.width = (st.pull * 100).toFixed(0) + '%';
    };
    const say = (m) => { st.msg = m; hud(); };
    const start = () => {
      if (!G.spend(st.bet)) { say(Tr('Bu bahse yetecek paran yok.')); return; }
      Audio_.ui('cash');
      Object.assign(st, { phase: 'aim', balls: BL.rack(), potted: [], score: [0, 0], turn: 0, ang: 0, pull: 0, charge: 0, quitT: 0, hit: false });
      st.games++;
      say(Tr('Açış senin. Üçgene sert vur!'));
    };
    const shoot = (pow) => {
      const cue = st.balls[0], v = BL.VMAX * clamp(pow, 0.05, 1);
      cue.vx = Math.cos(st.ang) * v; cue.vy = Math.sin(st.ang) * v;
      st.potted = []; st.hit = false; st.phase = 'roll'; st.pull = 0; st.charge = 0;
      Audio_.tone(700 + pow * 500, 0.035, 'triangle', 0.05 + pow * 0.05);
      hud();
    };
    // atış bitti: sokulan toplar puan, beyaz düştüyse sıra döner
    const settle = () => {
      const who = st.turn, scratch = st.potted.some(p => p.cue), n = st.potted.filter(p => !p.cue).length;
      st.score[who] += n;
      if (scratch) BL.respot(st);
      if (n) Audio_.tone(520, 0.08, 'sine', 0.04, null, 0, 680);
      if (st.score[who] >= BL.WIN || st.balls.every(q => q.cue || q.in)) { finish(st.score[0] > st.score[1] || (st.score[0] === st.score[1] && who === 0)); return; }
      if (n && !scratch) say(who === 0 ? Tr`Güzel! ${n} top soktun, yine sen vur.` : Tr`${escapeHtml(st.opp)} ${n} top soktu, yine o vuruyor.`);
      else {
        st.turn = 1 - who;
        say(scratch ? (who === 0 ? Tr('Beyaz deliğe düştü! Sıra rakipte.') : Tr`${escapeHtml(st.opp)} beyazı deliğe düşürdü. Sıra sende.`) : st.turn === 0 ? Tr('Sıra sende.') : Tr`${escapeHtml(st.opp)} düşünüyor…`);
      }
      st.phase = st.turn === 0 ? 'aim' : 'ai';
      if (st.turn === 1) { st.ai = BL.aiShot(st); const noise = BL.NOISE[BILLIARD_BETS.indexOf(st.bet)] || 0.02; st.ai.ang += (Math.random() + Math.random() - 1) * noise * 1.6; st.ai.pow *= rnd(0.93, 1.08); st.wait = 0; st.ang0 = st.ang; }
      else { const c = st.balls[0], o = st.balls.find(q => !q.cue && !q.in); if (o && st.turn === 0 && scratch) st.ang = Math.atan2(o.y - c.y, o.x - c.x); }
    };
    const finish = (win) => {
      st.phase = 'over';
      if (win) { G.earn(st.bet * 2, Tr('Bilardo')); G.stat('billiardsWon', 1); say(Tr`Kazandın! ${escapeHtml(st.opp)} elini sıkıp bahsi ödedi.`); }
      else { Audio_.ui('error'); say(Tr`${escapeHtml(st.opp)} kazandı. Bahsi kaybettin.`); }
    };
    const leave = () => {
      if (st.phase !== 'bet' && st.phase !== 'over') {
        if (!(st.quitT > 0)) { st.quitT = 2.5; say(Tr`Oyunu bırakırsan bahsi kaybedersin. Bırakmak için ${G_('back')} tuşuna yeniden bas.`); return; }
        finish(false);
      }
      if (st.games) G.advanceClock(st.games * 25);
      this.pop(m);
    };
    // fare: nişan ve güç
    let mouseAim = false, mDown = false;
    const toTable = (e) => { const R = cv.getBoundingClientRect(); return [(e.clientX - R.left) / R.width * BL.W, (e.clientY - R.top) / R.height * BL.H]; };
    cv.addEventListener('pointermove', (e) => { if (st.phase !== 'aim') return; const [x, y] = toTable(e), c = st.balls[0]; if (Math.hypot(x - c.x, y - c.y) > 3) { st.ang = Math.atan2(y - c.y, x - c.x); mouseAim = true; } });
    cv.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); if (st.phase === 'aim') { mDown = true; st.charge = 0; } else if (st.phase === 'bet') start(); });
    window.addEventListener('pointerup', function up(e) { if (!m.alive) { window.removeEventListener('pointerup', up); return; } if (mDown && e.button === 0) { mDown = false; if (st.phase === 'aim' && st.pull > 0.04) shoot(st.pull); else st.pull = 0; } });
    const m = this.makeModal(el, { customInput: true, noFocus: true, onBack: leave });
    m.billiards = st;
    m.update = (dt) => {
      const I = Input;
      if (st.quitT > 0) st.quitT -= dt;
      if (st.phase === 'roll') {
        const H = 1 / 480;
        for (let t = 0; t < Math.min(dt, 0.05); t += H) BL.step(st, H);
        const S = st.snd;
        if (S.click > 20) Audio_.tone(1700 + rnd(-200, 200), 0.018, 'square', Math.min(0.05, S.click / 9000));
        if (S.cush > 40) Audio_.tone(160, 0.04, 'triangle', Math.min(0.05, S.cush / 8000));
        if (S.pot) Audio_.thud(0.18);
        S.click = S.cush = S.pot = 0;
        if (!BL.moving(st)) settle();
      } else if (st.phase === 'ai') {
        // rakip nişanını yavaşça alır, istakayı geri çeker ve vurur
        st.wait += dt;
        const k = Math.min(1, st.wait / 0.8);
        st.ang = st.ang0 + angDiff(st.ang0, st.ai.ang) * (k * k * (3 - 2 * k));
        st.pull = st.wait > 0.9 ? Math.min(st.ai.pow, (st.wait - 0.9) * 1.6) : 0;
        if (st.wait > 0.9 && st.pull >= st.ai.pow) shoot(st.ai.pow);
      }
      if (m.born >= this.frame - 1) { BL.draw(g, st); return; }
      if (I.pressed('back')) { leave(); return; }
      if (st.phase === 'bet') {
        const k = BILLIARD_BETS.indexOf(st.bet);
        if (I.nav('left', dt) && k > 0) { st.bet = BILLIARD_BETS[k - 1]; Audio_.ui('move'); hud(); }
        if (I.nav('right', dt) && k < BILLIARD_BETS.length - 1) { st.bet = BILLIARD_BETS[k + 1]; Audio_.ui('move'); hud(); }
        if (I.pressed('confirm')) start();
      } else if (st.phase === 'over') {
        if (I.pressed('confirm')) { st.phase = 'bet'; st.balls = BL.rack(); st.score = [0, 0]; say(Tr('Bir oyun daha? Bahsi seç.')); }
      } else if (st.phase === 'aim') {
        const ax = Input.axes ? Input.axes[0] || 0 : 0;
        let rot = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
        if (Math.abs(ax) > 0.2) rot = ax;
        if (rot) { st.ang += rot * dt * 1.3; mouseAim = false; }
        if (I.down('down')) st.ang += dt * 0.12;
        if (I.down('up')) st.ang -= dt * 0.12;
        if (I.down('confirm') || mDown) { st.charge += dt; const p = (st.charge / 1.1) % 2; st.pull = p < 1 ? p : 2 - p; }
        else if (I.released('confirm') && st.pull > 0.04) shoot(st.pull);
        else if (!mDown) st.pull = 0;
      }
      $q('.bl-pow i').style.width = (st.pull * 100).toFixed(0) + '%';
      BL.draw(g, st);
    };
    say(Tr`${escapeHtml(st.opp)} istakasını tebeşirliyor: "Bir oyuna ne dersin? Bahsi sen koy."`);
    BL.draw(g, st);
    this.push(m);
  },
});
