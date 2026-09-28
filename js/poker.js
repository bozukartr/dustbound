'use strict';
/* ==========================================================
   FRONTIER'S END — poker (beş kart çekmeli)
   - Saloon, kumarhane ve cantinadaki kart masasında üç rakiple
     oynanır. Herkes giriş parası (ante) koyar, beşer kart dağıtılır,
     bir bahis turu, en fazla 3 kart değiştirme, ikinci bahis turu ve
     el gösterme.
   - Sabit limit: ilk turda bahis 2×ante, ikinci turda 4×ante; bir
     turda en fazla bir bahis ve iki artırma. Masaya oturmak için elin
     sonuna kadar yetecek para gerekir (all-in ve yan pot yoktur).
   - Rakiplerin paraları günlüktür: masayı boşaltırsan yeni oyuncular
     ertesi gün gelir. Kumarbaz yeteneği rakiplerin yüzünü okutur.
   - Para birimi içeride sent (tam sayı) olarak tutulur.
   ========================================================== */

const POKER_ANTES = [5, 10, 25];
const POKER_SEATS = 3;
const POKER_CAP = 3;
const POKER_MAXDRAW = 3;
const POKER_HANDS = () => [Tr('Yüksek Kart'), Tr('@poker|Per'), Tr('@poker|Döper'), Tr('@poker|Üçlü'), Tr('@poker|Kent'), Tr('@poker|Renk'), Tr('@poker|Ful'), Tr('@poker|Kare'), Tr('Sıralı Renk'), Tr('Floş Royal')];
const POKER_STYLES = [
  { tight: 0.1, aggr: 0.02, bluff: 0.03 },    // temkinli
  { tight: -0.06, aggr: 0.06, bluff: 0.1 },   // gevşek
  { tight: 0.02, aggr: 0.14, bluff: 0.18 },   // blöfçü
];
const POKER_LINES = {
  fold: ['Bende bir şey yok.', 'Çekiliyorum.', 'Bu el senin olsun.', 'Kartlar bu gece bana küs.'],
  raise: ['Biraz ısıtalım.', 'Artırıyorum.', 'Bakalım ne kadar cesursun.', 'Bir o kadar daha.'],
  pat: ['Kart istemem.', 'Böyle iyiyim.'],
  win: ['Kusura bakma, dostum.', 'Masa bu gece benim.', 'Sağ ol, sağ ol.'],
  tellStrong: ['Dudağının kenarında bir gülümseme var.', 'Parmakları masada ritim tutuyor.'],
  tellWeak: ['Kartlarına bakıp iç çekiyor.', 'Gözü kapıda.'],
  tellFlat: ['Yüzünden hiçbir şey okunmuyor.', 'Viskisini yudumluyor.'],
};

const Poker = {
  speed: 1,
  deck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  },
  rank: c => (c.r === 1 ? 14 : c.r),
  /* [kategori, ...eşitlik bozucular] — büyük olan kazanır */
  evalHand(h) {
    const rs = h.map(Poker.rank).sort((a, b) => b - a);
    const flush = h.every(c => c.s === h[0].s);
    const cnt = {};
    for (const r of rs) cnt[r] = (cnt[r] || 0) + 1;
    const g = Object.keys(cnt).map(r => [+r, cnt[r]]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const kick = g.map(x => x[0]);
    let hi = 0;
    if (g.length === 5) { if (rs[0] - rs[4] === 4) hi = rs[0]; else if (rs[0] === 14 && rs[1] === 5) hi = 5; }
    if (hi && flush) return [hi === 14 ? 9 : 8, hi];
    if (g[0][1] === 4) return [7, ...kick];
    if (g[0][1] === 3 && g[1][1] === 2) return [6, ...kick];
    if (flush) return [5, ...rs];
    if (hi) return [4, hi];
    if (g[0][1] === 3) return [3, ...kick];
    if (g[0][1] === 2 && g[1][1] === 2) return [2, ...kick];
    if (g[0][1] === 2) return [1, ...kick];
    return [0, ...rs];
  },
  cmp(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; }
    return 0;
  },
  handName: h => POKER_HANDS()[Poker.evalHand(h)[0]],
  /* Dört kart aynı renkten mi, dört kart sıralı mı? (değiştirilecek kartın yeri) */
  flushDraw(h) {
    for (let s = 0; s < 4; s++) { const odd = h.map((c, i) => (c.s === s ? -1 : i)).filter(i => i >= 0); if (odd.length === 1) return odd; }
    return null;
  },
  straightDraw(h) {
    for (let skip = 0; skip < 5; skip++) {
      const rs = h.filter((c, i) => i !== skip).map(Poker.rank).sort((a, b) => a - b);
      if (new Set(rs).size === 4 && rs[3] - rs[0] === 3 && rs[3] < 14) return [skip];
    }
    return null;
  },
  /* Elin kabaca gücü 0–1 (dört kişilik masaya göre) */
  strength(h, pre) {
    const e = Poker.evalHand(h), c = e[0];
    let s = c === 0 ? 0.04 + Math.max(0, e[1] - 8) / 6 * 0.14
      : c === 1 ? 0.28 + (e[1] - 2) / 12 * 0.27
      : c === 2 ? 0.62 + (e[1] - 3) / 11 * 0.1
      : c === 3 ? 0.76 + (e[1] - 2) / 12 * 0.06
      : [0, 0, 0, 0, 0.86, 0.9, 0.94, 0.97, 0.99, 1][c];
    if (pre && c < 4) {
      if (Poker.flushDraw(h)) s = Math.max(s, 0.42);
      else if (Poker.straightDraw(h)) s = Math.max(s, 0.38);
    }
    return s;
  },
  /* Yapay zekânın değiştireceği kartlar */
  drawPlan(h) {
    const e = Poker.evalHand(h), c = e[0];
    if (c >= 4) return [];
    const byRank = r => h.map((x, i) => (Poker.rank(x) === r ? -1 : i)).filter(i => i >= 0);
    if (c === 3 || c === 1) return byRank(e[1]);
    if (c === 2) return h.map((x, i) => (Poker.rank(x) === e[3] ? i : -1)).filter(i => i >= 0);
    const fd = Poker.flushDraw(h); if (fd) return fd;
    const sd = Poker.straightDraw(h); if (sd) return sd;
    // en yüksek iki kartı tut
    const order = h.map((x, i) => i).sort((a, b) => Poker.rank(h[b]) - Poker.rank(h[a]));
    return order.slice(2, 2 + POKER_MAXDRAW);
  },
  /* Bir eli bitirebilmek için gereken en az para (en kötü durum) */
  minStack: ante => ante + POKER_CAP * 2 * ante + POKER_CAP * 4 * ante,
  newOpp() {
    const sex = chance(0.8) ? 'm' : 'f';
    return { name: randomName(sex), stack: rndi(50, 180) * 5, style: rndi(0, POKER_STYLES.length - 1) };
  },

  /* ---------------- bir elin akışı ----------------
     st.seats[0] oyuncu, diğerleri masadaki rakipler */
  deal(st) {
    st.deck = Poker.deck(); st.pot = 0; st.reveal = false; st.msg = ''; st.sel = new Set(); st.cursor = 0; st.winners = [];
    st.btn = (st.btn + 1) % st.seats.length;
    for (const s of st.seats) {
      Object.assign(s, { hand: [], folded: false, contrib: 0, total: 0, act: '', drew: -1, bluff: false, say: '', sayT: 0, win: false });
      s.out = !s.me && s.o.stack < Poker.minStack(st.ante);
      if (s.out) { s.folded = true; continue; }
      Poker.put(st, s, st.ante);
      s.hand = st.deck.splice(0, 5);
    }
    for (const s of st.seats) if (!s.me && !s.out) {
      s.str = Poker.strength(s.hand, true);
      s.bluff = s.str < 0.25 && chance(POKER_STYLES[s.o.style].bluff);
      Poker.tell(s);
    }
    st.phase = 'bet1';
    Poker.startRound(st);
  },
  put(st, s, c) {
    if (c <= 0) return;
    if (s.me) G.player.money -= c / 100; else s.o.stack -= c;
    s.contrib += c; s.total += c; st.pot += c;
  },
  live: st => st.seats.filter(s => !s.folded),
  order(st, from) {
    const n = st.seats.length, out = [];
    for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (!st.seats[i].folded) out.push(i); }
    return out;
  },
  startRound(st) {
    st.cur = 0; st.raises = 0;
    for (const s of st.seats) s.contrib = 0;
    st.pending = Poker.order(st, st.btn);
    st.wait = 0.5;
  },
  betSize: st => (st.phase === 'bet2' ? 4 : 2) * st.ante,
  toCall: (st, s) => st.cur - s.contrib,
  toAct: st => (st.phase === 'bet1' || st.phase === 'bet2') && st.pending.length ? st.pending[0] : -1,
  canRaise: st => st.raises < POKER_CAP,
  act(st, i, kind) {
    const s = st.seats[i];
    if (Poker.toAct(st) !== i) return false;
    const tc = Poker.toCall(st, s);
    if (kind === 'raise' && !Poker.canRaise(st)) kind = 'call';
    st.pending.shift();
    if (kind === 'fold') {
      Poker.fold(st, i); return true;
    } else if (kind === 'raise') {
      const size = Poker.betSize(st);
      Poker.put(st, s, tc + size);
      st.cur += size; st.raises++;
      s.act = st.raises === 1 ? Tr`Bahis ${fmtMoney(size / 100)}` : Tr`Artırdı ${fmtMoney(size / 100)}`;
      st.pending = Poker.order(st, i).filter(j => j !== i);
    } else {
      Poker.put(st, s, tc);
      s.act = tc ? Tr('Gördü') : Tr('Pas');
    }
    Poker.next(st);
    return true;
  },
  /* Sırası gelmese de çekilebilir (masadan kalkarken) */
  fold(st, i) {
    const s = st.seats[i];
    if (s.folded) return;
    s.folded = true; s.act = Tr('Çekildi');
    st.pending = st.pending.filter(j => j !== i);
    Poker.next(st);
  },
  next(st) {
    st.wait = rnd(0.45, 0.85);
    if (Poker.live(st).length === 1) { Poker.finish(st); return; }
    if ((st.phase === 'bet1' || st.phase === 'bet2') && !st.pending.length) {
      if (st.phase === 'bet1') { st.phase = 'draw'; st.sel = new Set(); st.cursor = 0; if (st.seats[0].folded) Poker.drawAll(st, []); }
      else Poker.finish(st);
    }
  },
  /* Oyuncu değiştireceği kartları seçince herkes kart çeker */
  drawAll(st, mine) {
    if (st.phase !== 'draw') return;
    for (const s of st.seats) {
      if (s.folded) continue;
      let idx = s.me ? [...mine].slice(0, POKER_MAXDRAW) : s.bluff && chance(0.5) ? [] : Poker.drawPlan(s.hand);
      idx = [...new Set(idx)].sort((a, b) => b - a);
      for (const k of idx) s.hand.splice(k, 1);
      s.hand.push(...st.deck.splice(0, idx.length));
      s.drew = idx.length;
      s.act = idx.length ? Tr`${idx.length} kart aldı` : Tr('Kart almadı');
      if (!s.me) {
        s.str = Poker.strength(s.hand, false);
        if (!idx.length && s.bluff) s.str = Math.max(s.str, 0.66);
        if (!idx.length && chance(0.4)) Poker.say(s, 'pat');
        Poker.tell(s);
      }
    }
    st.sel = new Set();
    st.phase = 'bet2';
    Poker.startRound(st);
  },
  /* Yapay zekânın sırası */
  aiAct(st) {
    const i = Poker.toAct(st);
    if (i < 0 || st.seats[i].me) return false;
    const s = st.seats[i], sty = POKER_STYLES[s.o.style], tc = Poker.toCall(st, s);
    let r = (s.bluff ? Math.max(s.str, 0.7) : s.str) + rnd(-0.07, 0.07) - sty.tight;
    // karşısında kart almayan biri varsa temkinli oynar
    if (st.phase === 'bet2' && st.seats.some(x => x !== s && !x.folded && x.drew === 0)) r -= 0.08;
    let kind;
    if (tc === 0) kind = Poker.canRaise(st) && r > 0.55 - sty.aggr ? 'raise' : 'call';
    else {
      const odds = tc / (st.pot + tc);
      if (Poker.canRaise(st) && r > 0.8 - sty.aggr) kind = 'raise';
      else if (r > odds + 0.16) kind = 'call';
      else kind = 'fold';
    }
    if (kind === 'fold' && chance(0.35)) Poker.say(s, 'fold');
    if (kind === 'raise' && chance(0.3)) Poker.say(s, 'raise');
    Poker.act(st, i, kind);
    return true;
  },
  finish(st) {
    const live = Poker.live(st);
    let win = live;
    if (live.length > 1) {
      let best = null;
      for (const s of live) { s.ev = Poker.evalHand(s.hand); if (!best || Poker.cmp(s.ev, best) > 0) best = s.ev; }
      win = live.filter(s => Poker.cmp(s.ev, best) === 0);
      st.reveal = true;
    }
    const share = Math.floor(st.pot / win.length);
    let rest = st.pot - share * win.length;
    for (const s of win) {
      const c = share + rest; rest = 0;
      if (s.me) G.player.money += c / 100; else s.o.stack += c;
      s.win = true;
    }
    const name = st.reveal ? POKER_HANDS()[win[0].ev[0]] : '';
    const who = win.map(s => (s.me ? Tr('Sen') : s.name)).join(', ');
    st.msg = win.length > 1 ? Tr`Pot bölündü: ${who} (${name})`
      : win[0].me ? (st.reveal ? Tr`Kazandın! ${fmtMoney(st.pot / 100)} · ${name}` : Tr`Herkes çekildi. ${fmtMoney(st.pot / 100)} senin.`)
      : (st.reveal ? Tr`${who} kazandı · ${name}` : Tr`${who} potu aldı.`);
    if (win.some(s => s.me)) { G.stat('pokerWins', 1); Audio_.ui('cash'); }
    else { const w = win.find(s => !s.me); if (w && chance(0.5)) Poker.say(w, 'win'); }
    st.lastPot = st.pot; st.pot = 0;
    st.phase = 'idle'; st.pending = [];
  },
  /* Oyuncu çekildikten sonra eli beklemeden sonuna kadar oynat */
  runOut(st) {
    for (let n = 0; n < 200 && st.phase !== 'idle'; n++) {
      if (st.phase === 'draw') Poker.drawAll(st, []);
      else if (!Poker.aiAct(st)) break;
    }
  },
  say(s, kind) { s.say = pick(POKER_LINES[kind]); s.sayT = 2.6; },
  /* Kumarbaz yeteneği: rakibin yüzünden elini sez (çoğu zaman doğru) */
  tell(s) {
    const str = chance(0.75) ? (s.bluff ? 0.1 : s.str) : rnd();
    s.tell = pick(POKER_LINES[str > 0.6 ? 'tellStrong' : str < 0.3 ? 'tellWeak' : 'tellFlat']);
  },
};

/* ---------------- G: masa (günlük rakipler) ---------------- */
const PokerSystems = {
  pokerTable(b) {
    const T = this.pokerTables || (this.pokerTables = {});
    const key = b.town + ':' + b.type, day = Math.floor(this.clock / 1440);
    let t = T[key];
    if (!t || t.day !== day) t = T[key] = { day, opps: Array.from({ length: POKER_SEATS }, () => Poker.newOpp()) };
    t.opps = t.opps.filter(o => o.stack >= Poker.minStack(POKER_ANTES[0]));
    return t;
  },
};

/* ---------------- arayüz ---------------- */
Object.assign(UI, {
  openPoker(b) {
    const P = G.player, table = G.pokerTable(b);
    if (!table.opps.length) { this.feed(Tr('Masada oynayacak kimse kalmadı. Yarın yine gel.'), 'warn'); return; }
    const el = el_('div', 'modal panel poker');
    const st = { ante: POKER_ANTES[0], phase: 'idle', btn: rndi(0, table.opps.length), pot: 0, pending: [], sel: new Set(), cursor: 0, wait: 0, msg: '', table,
      seats: [{ me: true, name: Tr('Sen'), hand: [], folded: true }, ...table.opps.map(o => ({ o, name: o.name, hand: [], folded: true }))] };
    const card = (c, cls = '') => `<div class="card ${cls} ${c.s % 2 ? 'red' : ''}"><span>${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c.r]}</span><span>${'♠♥♣♦'[c.s]}</span></div>`;
    const G_ = (a) => Input.glyph(a);
    const buttons = () => {
      const me = st.seats[0], turn = Poker.toAct(st) === 0, b = [];
      if (st.phase === 'idle') {
        b.push(['deal', G_('confirm') + ' ' + Tr('Dağıt'), 'pref'], ['leave', G_('back') + ' ' + Tr('Kalk')]);
      } else if (st.phase === 'draw' && !me.folded) {
        b.push(['draw', G_('alt') + ' ' + (st.sel.size ? Tr`${st.sel.size} Kart Değiştir` : Tr('Kart Almadan Devam')), 'pref'], ['leave', G_('back') + ' ' + Tr('Çekil ve Kalk')]);
      } else if (turn) {
        const tc = Poker.toCall(st, me), size = Poker.betSize(st);
        b.push(['call', G_('confirm') + ' ' + (tc ? Tr`Gör (${fmtMoney(tc / 100)})` : Tr('Pas')), 'pref']);
        if (Poker.canRaise(st)) b.push(['raise', G_('alt') + ' ' + (st.cur ? Tr`Artır (${fmtMoney((tc + size) / 100)})` : Tr`Bahis (${fmtMoney(size / 100)})`)]);
        b.push(['fold', G_('alt2') + ' ' + Tr('Çekil')], ['leave', G_('back') + ' ' + Tr('Çekil ve Kalk')]);
      } else if (me.folded) b.push(['leave', G_('back') + ' ' + Tr('Kalk')]);
      return b.map(([a, t, c]) => `<button class="pk-b ${c || ''}" data-a="${a}">${t}</button>`).join('');
    };
    const draw = () => {
      const me = st.seats[0], cur = Poker.toAct(st), perk = G.hasPerk('gambler'), inHand = st.phase !== 'idle';
      const opps = st.seats.slice(1).map((s, k) => {
        const i = k + 1, show = st.reveal && !s.folded;
        const cards = s.hand.length ? s.hand.map(c => (show ? card(c, 'sm') : '<div class="card sm back"></div>')).join('') : '';
        return `<div class="pk-seat ${s.folded && inHand ? 'folded' : ''} ${cur === i ? 'turn' : ''} ${s.win ? 'win' : ''}">
          <div class="pk-name">${s.name}${st.btn === i ? ' <i class="pk-dealer">D</i>' : ''}</div><div class="pk-stack">${fmtMoney(s.o.stack / 100)}</div>
          <div class="pk-cards">${cards}</div>
          <div class="pk-act">${s.out ? Tr('Bu el oynamıyor') : show ? Poker.handName(s.hand) : s.act || '&nbsp;'}</div>
          ${perk && inHand && !s.folded && !s.out ? `<div class="pk-tell">${s.tell}</div>` : ''}
          ${s.sayT > 0 ? `<div class="pk-say">${s.say}</div>` : ''}</div>`;
      }).join('');
      const pick_ = st.phase === 'draw' && !me.folded;
      const mine = me.hand.map((c, i) => `<div class="pk-slot ${pick_ ? 'pickable' : ''} ${st.sel.has(i) ? 'sel' : ''} ${pick_ && st.cursor === i ? 'cur' : ''}" data-i="${i}">${card(c)}</div>`).join('');
      el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Poker`}</div><div class="p-sub">${Tr`Beş kart çekmeli · Cüzdan: ${fmtMoney(P.money)} · Giriş: ${st.phase === 'idle' ? '◀ ' + fmtMoney(st.ante / 100) + ' ▶' : fmtMoney(st.ante / 100)}`}</div></div>
        <div class="pk-table"><div class="pk-opps">${opps}</div>
        <div class="pk-mid"><div class="pk-pot">${st.phase === 'idle' ? (st.lastPot ? '' : Tr`Masaya oturmak için en az ${fmtMoney(Poker.minStack(st.ante) / 100)} gerekir.`) : Tr`Pot: ${fmtMoney(st.pot / 100)}`}</div><div class="bj-msg">${st.msg || (pick_ ? Tr`Değiştireceğin kartları seç (en fazla ${POKER_MAXDRAW})` : cur > 0 ? Tr`${st.seats[cur].name} düşünüyor…` : '')}</div></div>
        <div class="pk-me ${cur === 0 ? 'turn' : ''} ${me.folded && inHand ? 'folded' : ''} ${me.win ? 'win' : ''}"><div class="bj-l">${Tr`Sen`}${st.btn === 0 ? ' <i class="pk-dealer">D</i>' : ''}${me.hand.length ? ' · ' + Poker.handName(me.hand) : ''}${me.act && inHand ? ' · ' + me.act : ''}</div><div class="bj-c pk-hand">${mine}</div></div></div>
        <div class="pk-btns">${buttons()}</div>
        <div class="p-foot">${st.phase === 'draw' && !me.folded ? Tr`◀ ▶ Kart &nbsp; ${G_('confirm')} Seç` : st.phase === 'idle' ? Tr`◀ ▶ Giriş parası` : Tr`Sabit limit: bahis ${fmtMoney(Poker.betSize(st) / 100)}, turda en fazla ${POKER_CAP} bahis`}</div>`;
    };
    const deal = () => {
      if (st.phase !== 'idle') return;
      const live = st.seats.filter(s => !s.me && s.o.stack >= Poker.minStack(st.ante));
      if (!live.length) { st.msg = Tr('Bu girişle oynayacak kimse kalmadı.'); Audio_.ui('error'); draw(); return; }
      if (P.money * 100 < Poker.minStack(st.ante) - 0.001) { st.msg = Tr`Masaya oturmak için en az ${fmtMoney(Poker.minStack(st.ante) / 100)} gerekir.`; Audio_.ui('error'); draw(); return; }
      Poker.deal(st); G.advanceClock(3); Audio_.ui('pick'); draw();
    };
    const leave = () => {
      if (st.phase !== 'idle') { Poker.fold(st, 0); Poker.runOut(st); }
      table.opps = table.opps.filter(o => o.stack >= Poker.minStack(POKER_ANTES[0]));
      this.pop(m);
    };
    const doAct = (a) => {
      if (a === 'leave') { leave(); return; }
      if (a === 'deal') { deal(); return; }
      if (a === 'draw') { Poker.drawAll(st, st.sel); Audio_.ui('pick'); draw(); return; }
      if (Poker.toAct(st) !== 0) return;
      Poker.act(st, 0, a); Audio_.ui(a === 'fold' ? 'back' : 'pick'); draw();
    };
    const m = this.makeModal(el, { customInput: true, noFocus: true, onBack: leave });
    m.poker = st; m.pokerAct = doAct;
    m.update = (dt) => {
      const I = Input;
      let dirty = false;
      for (const s of st.seats) if (s.sayT > 0 && (s.sayT -= dt) <= 0) dirty = true;
      const cur = Poker.toAct(st);
      if (cur > 0 && (st.wait -= dt * Poker.speed) <= 0) { Poker.aiAct(st); dirty = true; }
      else if (st.phase === 'draw' && st.seats[0].folded) { Poker.drawAll(st, []); dirty = true; }
      if (m.born >= this.frame - 1) { if (dirty) draw(); return; }
      if (I.pressed('back')) { leave(); return; }
      if (st.phase === 'idle') {
        const k = POKER_ANTES.indexOf(st.ante);
        if (I.nav('left', dt) && k > 0) { st.ante = POKER_ANTES[k - 1]; dirty = true; }
        if (I.nav('right', dt) && k < POKER_ANTES.length - 1) { st.ante = POKER_ANTES[k + 1]; dirty = true; }
        if (I.pressed('confirm')) { deal(); return; }
      } else if (st.phase === 'draw' && !st.seats[0].folded) {
        if (I.nav('left', dt)) { st.cursor = (st.cursor + 4) % 5; dirty = true; }
        if (I.nav('right', dt)) { st.cursor = (st.cursor + 1) % 5; dirty = true; }
        if (I.pressed('confirm')) { toggle(st.cursor); return; }
        if (I.pressed('alt')) { doAct('draw'); return; }
      } else if (Poker.toAct(st) === 0) {
        if (I.pressed('confirm')) { doAct('call'); return; }
        if (I.pressed('alt')) { doAct('raise'); return; }
        if (I.pressed('alt2')) { doAct('fold'); return; }
      }
      if (dirty) draw();
    };
    const toggle = (i) => {
      if (st.sel.has(i)) st.sel.delete(i);
      else if (st.sel.size < POKER_MAXDRAW) st.sel.add(i);
      else { Audio_.ui('error'); return; }
      st.cursor = i; Audio_.ui('move'); draw();
    };
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-a]');
      if (btn) { doAct(btn.dataset.a); return; }
      const slot = e.target.closest('.pk-slot.pickable');
      if (slot) toggle(+slot.dataset.i);
    });
    draw();
    this.push(m);
  },
});
