'use strict';
/* ==========================================================
   FRONTIER'S END — yaşayan dünya: kasabaların gelişimi (G nesnesine eklenir)
   - Her kasabanın 0–4 arası bir gelişmişlik basamağı (köy, kasaba, gelişmiş
     kasaba, şehir, büyük şehir) ve basamak içinde bir ilerlemesi vardır.
   - Her yıl dönümünde (1891–1963) kasabanın yıllık gelişimi hesaplanır:
     türü (kavşak, maden, liman…), demiryolu, bu dünyadaki şansı, çevresindeki
     haydut kampları, o yıl işlenen suçlar, temizlenen kamplar, şerife teslim
     edilen kaçaklar ve oyuncunun oradaki işletmeleri, evleri ve mülkleri.
   - Kader olayları (madende damarın tükenmesi, karakolun kapanması…) dünya
     tohumundan gelir: bir dünyada kasabayı büyütür, ötekinde söndürür. Aynı
     dünyada, aynı oyuncu davranışıyla sonuç hep aynıdır.
   - Oyuncunun etkisi dengelidir: büyüyen kasabayı birkaç yıl öne çeker,
     gerileyeni yavaşlatır ya da kurtarır; durgun bir köyü tek başına şehre
     çeviremez.
   - Olan biten gelişim günlüğüne yazılır. Günlük kayda girer; yüklerken
     baştan sırayla yeniden uygulanır. Görünür değişiklikler (yeni binalar,
     cepheler, sokaklar, lambalar, tahta perdeler, nüfus) js/devworld.js'te.
   - Gazeteler, gazeteci çocuk ve kasabalıların sohbeti gelişmeleri anlatır;
     Günlük'ün Kasabalar sekmesi her kasabanın durumunu gösterir.
   ========================================================== */

const DEV_CAMP_R = 6000;   // kasabanın güvenliğini etkileyen haydut kamplarının uzaklığı (px; kamplar kasabalardan 4–11 bin piksel uzakta)

const DevSystems = {
  /* ---------------- sorgular ---------------- */
  devIdx(t) { return TOWNS.findIndex(d => d.id === t.id); },
  devKind(t) { return TOWN_KINDS[TOWN_GROWTH[t.id]] || TOWN_KINDS.hub; },
  devStartTier(t) { const K = this.devKind(t); return clamp({ s: 1, m: 2, l: 3 }[t.sz] || 1, K.min, K.max); },
  devOf(t) { return this.dev && t ? this.dev.towns[t.id] || null : null; },
  devTierName(t) { const S = this.devOf(t); return !S ? '' : S.ghost ? Tr('Hayalet Kasaba') : DEV_TIERS[S.tier]; },
  eraOf(y) { let e = ERAS[0]; for (const E of ERAS) if (y >= E.y) e = E; return e; },
  /* (x, y) noktasına en yakın kasaba (r piksel içinde) */
  devNear(x, y, r) {
    let best = null, bd = r * r;
    for (const t of this.world.towns) { const d = dist2(x, y, t.cx, t.cy); if (d < bd) { bd = d; best = t; } }
    return best;
  },
  /* Kasabanın çevresindeki haydut kampları (dünyaya göre sabit) */
  devCamps(t) {
    const C = this._devCamps || (this._devCamps = {});
    if (C[t.id] === undefined) C[t.id] = this.world.pois.filter(p => p.kind === 'camp' && dist2(p.x, p.y, t.cx, t.cy) < DEV_CAMP_R * DEV_CAMP_R).length;
    return C[t.id];
  },
  /* Kader olayları: dünya tohumundan, kasaba başına bir kez hesaplanır */
  devFates(t) {
    const F = this._devF || (this._devF = {});
    if (F[t.id]) return F[t.id];
    const out = [], R = new RNG(Math.floor(hash2(this.seed, this.devIdx(t), 777) * 4294967296));
    for (const f of DEV_FATES[TOWN_GROWTH[t.id]] || []) {
      const roll = R.next(), u = R.next(), when = Math.round(f.y[0] + u * (f.y[1] - f.y[0]));
      if (f.after) { const a = out.find(o => o.id === f.after); if (a && roll < f.p) out.push({ id: f.id, y: a.y + when, g: f.g, d: f.d, def: f }); continue; }
      if (roll < f.p) out.push({ id: f.id, y: when, g: f.g, d: f.d, def: f });
      else if (f.alt) out.push({ id: f.alt.id, y: when, g: f.alt.g, d: f.alt.d, def: f.alt });
    }
    return (F[t.id] = out);
  },
  /* Oyuncunun kasabadaki yatırımı: işletmeler, çevredeki evleri, malikane ve mülkler */
  devInvest(t) {
    let v = 0;
    for (const z of this.biz) if (z.town === t.id) v += z.site ? 0.2 : z.lot !== undefined ? 0.7 : 0.5;
    for (const h of this.homes) if (h.done && this.devNear(h.tx * TS + 8, h.ty * TS + 8, 1500) === t) v += 0.25;
    if (this.estate) { const b = this.world.buildings[this.estate.bid]; if (b && b.town === t.id) v += 0.6; }
    for (const id of this.props) { const b = this.world.buildings.find(q => q.prop === id); if (b && this.devNear((b.x + b.w / 2) * TS, (b.y + b.h / 2) * TS, 1500) === t) v += 0.3; }
    return v;
  },
  /* Bir yılın gelişimi (basamak ilerlemesi ölçeğinde). why: nedenlerin dökümü (hata ayıklama).
     quiet: eski kaydı yetiştirirken oyuncunun o yıllardaki etkisi bilinmez, sayılmaz. */
  devGrowth(t, y, why, quiet) {
    const K = this.devKind(t), i = this.devIdx(t), S = this.seed, Y = (!quiet && this.dev.yr[t.id]) || {};
    const w = why || {};
    w.base = K.g;
    w.rail = t.station ? 0.015 : 0;
    w.luck = (hash2(S, i, 9) - 0.5) * 0.04 + (hash2(S, i * 131 + y, 5) - 0.5) * 0.04;   // bu dünyada kasabanın şansı + yılın şansı
    w.safety = -0.006 * Math.min(3, this.devCamps(t)) - 0.006 * Math.min(6, Y.crime || 0) + 0.01 * Math.min(3, Y.camp || 0) + 0.005 * Math.min(4, Y.bounty || 0);
    w.fate = 0;
    for (const f of this.devFates(t)) if (y >= f.y && (!f.d || y < f.y + f.d)) w.fate += f.g;
    let g = w.base + w.rail + w.luck + w.safety + w.fate;
    // oyuncunun yatırımı: büyüyeni hızlandırır, gerileyeni yavaşlatır (doymalı)
    const L = quiet ? 0 : 1 - Math.exp(-this.devInvest(t));
    w.player = L * (0.003 + (g > 0 ? 0.5 * g : Math.min(-g, 0.06)));
    return g + w.player;
  },

  /* ---------------- durum ---------------- */
  devInit() {
    const D = this.dev = { y: START_YEAR, towns: {}, log: [], yr: {}, fresh: [], ops: [], face: {}, shut: {}, st: {}, lamps: {}, elec: {}, pend: [], nk: 0 };
    for (const t of this.world.towns) { const S = D.towns[t.id] = { tier: this.devStartTier(t), prog: 0.2 + hash2(this.seed, this.devIdx(t), 3) * 0.4, ghost: false, g: 0 }; S.pk = this.devVit(S); }
    this._devF = null; this._devCamps = null;
    this.devMirror();
  },
  /* Kasabaların gelişim durumu dünyadaki kasaba nesnelerine de yazılır (arayüz ve öbür sistemler için) */
  devMirror() {
    for (const t of this.world.towns) { const S = this.dev.towns[t.id]; if (S) { t.tier = S.tier; t.ghost = S.ghost; } }
  },
  /* Yıl dönümü: y yılına kadar işlenmemiş her yılın gelişimi sırayla. quiet: haber duyurulmaz (eski kaydı yetiştirme) */
  devYear(y, quiet) {
    const D = this.dev;
    if (!D) return;
    while (D.y < y) this.devStep(++D.y, quiet);
    // ekran kararmışken (uyku, bekleme, yolculuk) kasabalar hemen değişir; yoksa görüş alanından çıktıkça (devTick)
    if (!quiet && typeof UI !== 'undefined' && UI.state === 'fade') this.devFlush(true);
  },
  devStep(y, quiet) {
    const D = this.dev;
    if (y > DEV_END_YEAR) { D.yr = {}; return; }
    for (const t of this.world.towns) {
      const S = D.towns[t.id], K = this.devKind(t);
      if (!S) continue;
      for (const f of this.devFates(t)) if (f.y === y) this.devLog(y, t, 'fate', f.id, quiet);
      const g = this.devGrowth(t, y, null, quiet);
      S.g = Math.round(g * 10000) / 10000;
      if (S.ghost) {
        S.prog = Math.max(-1, S.prog + g / DEV_COST[0]);
        if (S.prog >= 0) { S.ghost = false; S.prog = 0.1; this.devLog(y, t, 'revive', 0, quiet); }
      } else {
        const top = S.tier >= K.max;
        S.prog += g / DEV_COST[Math.min(S.tier, DEV_COST.length - 1)];
        if (top) S.prog = Math.min(S.prog, 1);
        if (S.prog >= 1 && !top) { S.tier++; S.prog = 0.15; this.devLog(y, t, 'up', S.tier, quiet); }
        else if (S.prog < 0) {
          if (S.tier > K.min) { S.tier--; S.prog = 0.8; this.devLog(y, t, 'down', S.tier, quiet); }
          else if (K.ghost && S.tier === 0) { if (S.prog < -0.5) { S.ghost = true; S.prog = -0.5; this.devLog(y, t, 'ghost', 0, quiet); } }
          else S.prog = 0;
        }
      }
      // görünür gelişim (js/devworld.js): kasabanın ulaştığı en yüksek gelişmişlik ve bu yılın değişiklikleri sıraya
      S.pk = Math.max(S.pk !== undefined ? S.pk : this.devV0(t), this.devVit(S));
      if (!quiet) this.devPhysQueue(t, y, S);
    }
    D.yr = {};
    this.devMirror();
  },
  devLog(y, t, k, v, quiet) {
    const e = { y, t: t.id, k, v };
    this.dev.log.push(e);
    if (!quiet) this.dev.fresh.push(e);
  },
  /* Bu yılın sayaçları: suç, temizlenen kamp, şerife teslim edilen kaçak. r: kasabanın bu kadar piksel yakınındaki olay da sayılır */
  devNote(x, y, k, r) {
    if (!this.dev || !this.world) return;
    const t = this.world.townAt(x, y, 4) || (r ? this.devNear(x, y, r) : null);
    if (!t) return;
    const Y = this.dev.yr[t.id] || (this.dev.yr[t.id] = {});
    Y[k] = (Y[k] || 0) + 1;
  },
  /* Yeni gelişmeler bildirim satırı olarak duyurulur (en çok üçü, gerisi Günlük'te) */
  devAnnounce() {
    const D = this.dev;
    if (!D || !D.fresh.length) return;
    const L = D.fresh.splice(0), show = L.slice(-3);
    for (const e of show) { const s = this.devStory(e); if (s) UI.feed('📰 ' + s.s); }
    if (L.length > show.length) UI.feed(Tr`📰 ${L.length - show.length} gelişme daha: Günlük → Kasabalar`);
  },

  /* ---------------- haberler ---------------- */
  /* Günlük kaydının gazete haberi: { h manşet, t haber, s kısa söz, good iyi haber mi } */
  devStory(e) {
    const t = this.world.towns.find(x => x.id === e.t);
    if (!t) return null;
    if (e.k === 'eco') return this.ecoStory(e, t);   // ekonomi haberleri (js/tycoon.js)
    let N, good;
    if (e.k === 'fate') { const f = this.devFates(t).find(o => o.id === e.v); N = f && f.def; good = f && f.g > 0; }
    else { N = e.k === 'up' ? DEV_NEWS.up[e.v] : DEV_NEWS[e.k]; good = e.k === 'up' || e.k === 'revive' || e.k === 'open' || e.k === 'reopen'; }
    if (!N) return null;
    // dükkân haberlerinde {b}: binanın türü (gazete başlığında büyük, metinde küçük harfle)
    const bn = BUILDINGS[e.v] ? BUILDINGS[e.v].n : '', lang = typeof I18N !== 'undefined' && I18N.lang === 'en' ? 'en' : 'tr';
    const k = (s, up) => s.replace(/\{k\}/g, up ? t.n.toUpperCase() : t.n).replace(/\{b\}/g, up ? bn.toLocaleUpperCase(lang) : bn.toLocaleLowerCase(lang));
    return { h: k(N.h, true), t: k(N.t), s: k(N.s), good, y: e.y, town: t };
  },
  /* Son iki yılın gelişmeleri (yeniden eskiye) */
  devRecent(years = 2) {
    if (!this.dev) return [];
    const y = this.year, out = [];
    for (let i = this.dev.log.length - 1; i >= 0 && this.dev.log[i].y > y - years; i--) out.push(this.dev.log[i]);
    return out;
  },
  /* Gazete: çoğunlukla son gelişmelerden biri (bulunulan kasabanınki öncelikli); yoksa null */
  devHeadline(town) {
    const L = this.devRecent(2);
    if (!L.length || chance(0.35)) return null;
    const own = town ? L.filter(e => e.t === town.id) : [];
    const s = this.devStory(pick(own.length && chance(0.6) ? own : L));
    return s ? [s.h, s.t] : null;
  },
  /* Gazeteci çocuğun bağırdığı son haber */
  devShout() {
    const L = this.devRecent(1);
    if (!L.length || chance(0.5)) return null;
    const s = this.devStory(pick(L));
    return s ? Tr('Ekstra! Ekstra! {0}', s.s) : null;
  },
  /* Kasabalıların sohbeti: kasabada son bir yılda iyi ya da kötü bir gelişme olduysa onu konuşurlar */
  devTalk(t) {
    if (!t) return null;
    const e = this.devRecent(1).find(x => x.t === t.id && x.k !== 'eco');
    if (!e) return null;
    const s = this.devStory(e);
    return s ? (s.good ? TALKS.grow : TALKS.decline) : null;
  },

  /* ---------------- kayıt ---------------- */
  saveDev() {
    const D = this.dev;
    return D ? { y: D.y, towns: D.towns, log: D.log, yr: D.yr, ops: D.ops, face: D.face, shut: Object.keys(D.shut), st: D.st, pend: D.pend, nk: D.nk } : null;
  },
  loadDev(d) {
    this._devF = null; this._devCamps = null;
    if (!d || !d.towns) {
      // gelişimden önceki bir kayıt: dünyanın geçmişi oyuncunun etkisi olmadan yeniden hesaplanır, kasabalar bugünkü
      // durumlarına bir kerede getirilir
      this.devInit();
      this.devYear(this.year, true);
      this.devPhysLoad(null);
      return;
    }
    this.dev = { y: d.y, towns: d.towns, log: d.log || [], yr: d.yr || {}, fresh: [] };
    for (const t of this.world.towns) if (!this.dev.towns[t.id]) this.dev.towns[t.id] = { tier: this.devStartTier(t), prog: 0.3, ghost: false, g: 0 };
    this.devReplay();
    this.devPhysLoad(d);
  },
  /* Günlüğü baştan sırayla uygula: kasabalar başlangıç basamağından kayıttaki duruma gelir */
  devReplay() {
    const st = {};
    for (const t of this.world.towns) st[t.id] = { tier: this.devStartTier(t), ghost: false };
    for (const e of this.dev.log) this.devApply(e, st);
    for (const t of this.world.towns) {
      const a = st[t.id], b = this.dev.towns[t.id];
      if (a.tier !== b.tier || a.ghost !== b.ghost) console.warn('gelişim günlüğü kayıttaki durumla uyuşmuyor:', t.id);
    }
    this.devMirror();
  },
  /* Tek bir günlük kaydını uygula (st: kasaba başına basamak durumu) */
  devApply(e, st) {
    const s = st[e.t];
    if (!s) return;
    if (e.k === 'up' || e.k === 'down') s.tier = e.v;
    else if (e.k === 'ghost') s.ghost = true;
    else if (e.k === 'revive') s.ghost = false;
  },
};
