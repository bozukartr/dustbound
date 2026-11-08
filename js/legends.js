'use strict';
/* ==========================================================
   FRONTIER'S END — efsaneler ve posttan zanaat (G nesnesine eklenir)
   Efsanevi hayvanlar ve balıklar:
   - Dünyada birkaç nadir yer var: altı efsanevi hayvanın ini (LEGENDS) ve dört efsanevi balığın suyu
     (LEGEND_FISH). Yerler dünya kurulurken dünyanın kendisinden hesaplanır (her tohumda başka yerde).
   - Barmenin söylentisi, gazete, tuzakçı kulübesi ve liman bir efsaneyi haritaya arama çemberi olarak
     işler. İnin çevresinde üç iz var (tüy tutamı, pençe izi, leş, sürünme izi…): incelenen her iz çemberi
     daraltır, üçüncüsünde in haritaya işlenir. İzi kendin bulursan söylentiye gerek kalmaz.
   - Efsanevi hayvan yalnızca koşulu tutunca (saat ya da hava: LEGEND_WHEN) ininin yakınında belirir ve
     kendine özgü bir huyu vardır: vurup çekilir, kudurur, vurulunca saldırır ya da kaçarsa o gün dönmez.
     Avlanınca bir daha gelmez; postundan terzi eşsiz bir giysi diker, bazılarından ganimet çıkar.
   - Efsanevi balık yalnızca kendi suyunda, koşulu tutunca vurur. Çekişi sert, arada kaçmaya çalışır;
     misina koparsa o gün bir daha vurmaz.
   Posttan zanaat:
   - Terzi kendi postundan giysi diker (TAILOR) ve heybeni büyütür (SATCHEL); ahırdaki saraç eyerini
     büyütür (SADDLE). Postlar çantadan, omzundan ya da kapıdaki atının eyerinden alınır; ücret peşin,
     sipariş birkaç saatte hazır olur ve aynı kasabadan teslim alınır.
   ========================================================== */

const LEGEND_KEYS = () => [...Object.keys(LEGENDS), ...Object.keys(LEGEND_FISH)];
/* Arama çemberinin yarıçapı (piksel), bulunan iz sayısına göre */
const LEGEND_R = { beast: [1100, 720, 440], fish: [650, 420, 260] };

/* İzlerin anlattıkları: her efsanenin üç izi, uzaktan yakına */
function legendClueText(id, i) {
  const T = {
    ghost: [Tr('Dikenli bir çalıya takılmış kar beyazı bir tutam tüy. Sıradan bir kurdun değil.'), Tr('Karda iri pençe izleri; yanında daha küçük üç sıra iz. Başında dev bir kurt olan bir sürü.'), Tr('Yarısı yenmiş bir geyik leşi. Gece burada avlanmışlar.')],
    scar: [Tr('Bir çam gövdesinde insan boyunu aşan üç derin pençe izi.'), Tr('Devrilmiş bir kütük; altındaki karınca yuvası paramparça.'), Tr('Çamurda kocaman bir ayak izi; avucuna iki kez sığar.')],
    gold: [Tr('Bir kayanın dibinde boynu kırılmış bir antilop; üstü dallarla örtülmüş.'), Tr('Kayaların arasında sarı bir tüy tutamı; güneşte altın gibi parlıyor.'), Tr('Tozda yumuşak pençe izleri; aralarındaki mesafe bir adam boyu.')],
    crown: [Tr('Bir ağacın kabuğu boynuzla soyulmuş; izler başının çok üstünde.'), Tr('Yumuşak toprakta derin, iri toynak izleri.'), Tr('Bir dala takılmış kadife boynuz kabuğu. Bu boynuzlar devasa olmalı.')],
    iron: [Tr('Otlar geniş bir şerit hâlinde ezilmiş; bir sürü buradan geçmiş.'), Tr('Bir boğanın boynuzuyla deştiği toprak; çukur bir kova alacak kadar.'), Tr('Kırık bir ağaç dalına kara kıllar takılmış.')],
    tooth: [Tr('Çamurda bir kayık genişliğinde sürünme izi suya iniyor.'), Tr('Kıyıda parçalanmış bir yaban domuzu leşi; dişler kemiği ikiye ayırmış.'), Tr('Sazlıkta yassılmış bir yatak; yerde iri, sararmış pullar.')],
  }[id];
  return T ? T[i] || '' : '';
}

const LegendSystems = {
  /* ---------------- durum ve kayıt ----------------
     legends[id]: r söylentisi duyuldu, c bulunan izler, f yeri bulundu, k avlandığı/tutulduğu gün (+1), kg balığın ağırlığı,
     gone kaçtığı gün (Taç Boynuz), lost misinayı kopardığı gün, hd yerinde son uyarı günü. orders: terzi ve saraç siparişleri,
     gear: heybe ve eyer basamakları */
  legendInit() { this.legends = {}; this.orders = []; this.gear = { bag: 0, saddle: 0 }; this._lgSp = null; this._lgPn = {}; },
  saveLegends() { return { l: this.legends, o: this.orders, g: this.gear }; },
  loadLegends(d) {
    const sp = this._lgSp;
    this.legendInit();
    this._lgSp = sp;   // yerler dünya kurulurken hesaplandı
    if (!d || typeof d !== 'object') return;
    const keys = new Set(LEGEND_KEYS());
    if (d.l && typeof d.l === 'object') for (const k in d.l) if (keys.has(k) && d.l[k] && typeof d.l[k] === 'object') this.legends[k] = d.l[k];
    if (Array.isArray(d.o)) this.orders = d.o.filter(o => o && this.orderSpec(o) && isFinite(o.ready));
    if (d.g && typeof d.g === 'object') this.gear = { bag: clamp(d.g.bag | 0, 0, SATCHEL.length - 1), saddle: clamp(d.g.saddle | 0, 0, SADDLE.length - 1) };
  },
  lg(id) { return this.legends[id] || (this.legends[id] = {}); },
  lgR(id) { return (this.legends && this.legends[id]) || {}; },
  isLegendDone(id) { return !!this.lgR(id).k; },

  /* ---------------- yerler ----------------
     Dünya kurulunca bir kez hesaplanır (oyuncunun sonradan kurduğu evler yeri kaydırmasın). İn: World.findSpot ile
     bölgesinin arazisinde yerlerden uzak bir nokta (Yaşlı Diş: su kıyısı). Balık: kıyıdan oltayla ulaşılan, açık deniz
     olmayan ve iklimi tutan bir su karesi. */
  legendSpots() {
    const W = this.world;
    if (this._lgSp && this._lgSp.w === W) return this._lgSp;
    const S = { w: W, clues: {} };
    for (const id in LEGENDS) {
      const L = LEGENDS[id];
      const [tx, ty] = W.findSpot(L.near, L.coast ? null : L.bio, { coast: !!L.coast, minD: 40 });
      S[id] = { x: tx * TS + 8, y: ty * TS + 8 };
    }
    for (const id in LEGEND_FISH) S[id] = this.fishSpotFind(LEGEND_FISH[id]);
    return (this._lgSp = S);
  },
  fishSpotFind(F) {
    const W = this.world, cx = Math.round(F.near[0] * WW), cy = Math.round(F.near[1] * WH);
    const ok = (x, y) => {
      if (x < 24 || y < 24 || x >= WW - 24 || y >= WH - 24 || W.t(x, y) !== T.WATER) return false;
      let land = 0;   // kıyı: iki karo içinde yürünebilir kara
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, t = W.t(Math.round(x + Math.cos(a) * 2), Math.round(y + Math.sin(a) * 2)); if (!isWaterT(t) && !isCliffT(t) && t !== T.BRIDGE) land++; }
      if (land < 2) return false;
      let deep = 0, wat = 0;   // açık deniz değil ama gerçek bir su: çevrede derin su payı ve su miktarı (81 örnek)
      for (let yy = -16; yy <= 16; yy += 4) for (let xx = -16; xx <= 16; xx += 4) { const t = W.t(x + xx, y + yy); if (t === T.DEEP) deep++; if (t === T.WATER || t === T.DEEP) wat++; }
      if (deep > 36 || wat < 8) return false;
      for (const tw of W.towns) if (x > tw.x - 30 && x < tw.x + tw.w + 30 && y > tw.y - 30 && y < tw.y + tw.h + 30) return false;
      const h = W.climateAt(x * TS + 8, y * TS + 8);
      return h >= F.heat[0] && h <= F.heat[1];
    };
    for (let r = 0; r < 340; r += 2) {
      const n = Math.max(1, Math.round(r * 1.5));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (ok(x, y)) return { x: x * TS + 8, y: y * TS + 8 };
      }
    }
    return null;
  },
  /* İnin çevresindeki üç iz: uzaktan yakına, ine dönük (karada, engelsiz) */
  legendClues(id) {
    const S = this.legendSpots(), sp = S[id];
    if (!sp || !LEGENDS[id]) return [];
    if (S.clues[id]) return S.clues[id];
    const W = this.world, tx = sp.x >> 4, ty = sp.y >> 4, out = [];
    [560, 380, 210].forEach((dd, i) => {
      let best = null;
      for (let k = 0; k < 16 && !best; k++) {
        const a = hash2(tx, ty, i * 31 + k) * TAU, x = sp.x + Math.cos(a) * dd, y = sp.y + Math.sin(a) * dd;
        if (x > 40 && y > 40 && x < WW * TS - 40 && y < WH * TS - 40 && !W.blocked(x, y, 6) && !W.isWaterPx(x, y) && !W.indoorPx(x, y)) best = { x, y, ang: a + Math.PI };
      }
      out.push(best || { x: sp.x + dd * 0.4, y: sp.y, ang: Math.PI });
    });
    return (S.clues[id] = out);
  },
  legendRegion(id) { const sp = this.legendSpots()[id]; return sp ? this.world.regionAt(sp.x, sp.y) : ''; },

  /* ---------------- koşul ---------------- */
  legendNow(when) {
    const h = this.hour, wx = this.weather.type;
    return when.some(k => {
      const C = LEGEND_WHEN[k];
      if (C.wx) return C.wx.includes(wx);
      const [a, b] = C.h;
      return a < b ? h >= a && h < b : h >= a || h < b;
    });
  },
  legendWhen(when) { return when.map(k => LEGEND_WHEN[k].n).join(Tr(' ya da ')); },
  legendDef(id) { return LEGENDS[id] || LEGEND_FISH[id]; },

  /* ---------------- söylenti ve harita ---------------- */
  /* Henüz duyulmamış efsaneler (kind: 'beast' | 'fish' | undefined: ikisi de) */
  legendUnheard(kind) {
    const S = this.legendSpots();
    return [...(kind !== 'fish' ? Object.keys(LEGENDS) : []), ...(kind !== 'beast' ? Object.keys(LEGEND_FISH) : [])].filter(id => S[id] && !this.lgR(id).r && !this.lgR(id).k);
  },
  /* Bir efsanenin söylentisi haritaya işlenir; söylentinin metnini döndürür (duyulmamış yoksa null) */
  legendRumor(kind) {
    const ids = this.legendUnheard(kind);
    if (!ids.length) return null;
    const id = pick(ids);
    this.lg(id).r = 1;
    this.guideFlag('legends');
    return this.legendRumorText(id);
  },
  legendRumorText(id) {
    const rn = this.legendRegion(id);
    if (LEGENDS[id]) { const L = LEGENDS[id]; return Tr`Avcıların dilinde bir ad dolaşıyor: <b>${L.n}</b>. ${L.d} İni <b>${rn}</b> taraflarındaymış.`; }
    const F = LEGEND_FISH[id];
    return Tr`Balıkçıların dilinde bir ad dolaşıyor: <b>${F.n}</b>. ${ITEMS[F.item].d} <b>${rn}</b> taraflarında bir suda yaşarmış; yalnızca ${this.legendWhen(F.when)} vurur.`;
  },
  /* Haritadaki işaret: yeri bulunduysa tam yeri (r 0), söylentisi duyulduysa ipuçlarıyla daralan, inden kaymış bir çember */
  legendCircle(id) {
    const R = this.legends[id], sp = this.legendSpots()[id];
    if (!R || !sp || R.k) return null;
    if (R.f) return { x: sp.x, y: sp.y, r: 0 };
    if (!R.r) return null;
    const n = Math.min(2, (R.c || []).length), fish = !!LEGEND_FISH[id];
    const r = LEGEND_R[fish ? 'fish' : 'beast'][n] * (this.hasPerk('legend1') ? 0.75 : 1);
    const tx = sp.x >> 4, ty = sp.y >> 4, a = hash2(tx, ty, 91 + n) * TAU, o = r * (0.2 + 0.45 * hash2(ty, tx, 17 + n));
    return { x: sp.x + Math.cos(a) * o, y: sp.y + Math.sin(a) * o, r };
  },
  /* Harita açıklamasındaki "Efsane" türünün hedefleri */
  legendTargets() {
    const out = [];
    for (const id of LEGEND_KEYS()) { const C = this.legendCircle(id); if (C) out.push({ x: C.x, y: C.y, n: this.legendDef(id).n }); }
    return out;
  },
  /* Haritaya çiz: söylenti çemberi (kesik çizgi), bilinen in ya da su, avlanmış/tutulmuş olanın soluk işareti */
  legendMap(c, toS, zoom, badge) {
    const S = this.legendSpots();
    for (const id of LEGEND_KEYS()) {
      const R = this.legends[id], sp = S[id];
      if (!R || !sp) continue;
      const gl = LEGEND_FISH[id] ? 'fish' : 'paw';
      if (R.k) { if (R.f) badge(sp.x, sp.y, gl, 'rgba(110,90,50,0.6)', 'rgba(240,228,200,0.8)', 8); continue; }
      const C = this.legendCircle(id);
      if (!C) continue;
      if (C.r) {
        const [x, y] = toS(C.x, C.y), r = C.r / TS * zoom;
        c.fillStyle = 'rgba(176,124,40,0.12)'; c.strokeStyle = 'rgba(130,84,20,0.8)'; c.lineWidth = 2; c.setLineDash([7, 5]);
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
      }
      badge(C.x, C.y, gl, C.r ? 'rgba(130,84,20,0.85)' : 'rgba(176,124,30,0.98)', '#fff', C.r ? 9 : 11);
    }
  },
  /* Harita imleci: en yakın efsane işareti (yoksa null) */
  legendMapInfo(wx, wy, rad) {
    let best = null, bd = rad * rad;
    for (const id of LEGEND_KEYS()) {
      const R = this.legends[id], C = this.legendCircle(id), sp = this.legendSpots()[id];
      const p = C || (R && R.k && R.f ? sp : null);
      if (!p) continue;
      const d = dist2(p.x, p.y, wx, wy);
      if (d < bd) { bd = d; best = id; }
    }
    if (!best) return null;
    const D = this.legendDef(best), R = this.legends[best], C = this.legendCircle(best);
    const st = R.k ? (LEGEND_FISH[best] ? Tr('Tutuldu') : Tr('Avlandı')) : C && C.r ? Tr('Söylenti: bu çemberin içinde bir yerde') : (LEGEND_FISH[best] ? Tr('Suyu bulundu') : Tr('İni bulundu'));
    return `<div class="mi-n">${D.n}</div><div class="mi-d">${st} · ${Tr`Görünür: ${this.legendWhen(D.when)}`}</div>`;
  },

  /* ---------------- dünyada: her yarım saniyede ---------------- */
  legendTick() {
    const P = this.player;
    if (!P || this.state !== 'play') return;
    const S = this.legendSpots();
    for (const id in LEGENDS) if (S[id]) {
      const d = dist(P.x, P.y, S[id].x, S[id].y);
      this.legendProps(id, S[id], d);
      this.legendBeast(id, S[id], d);
    }
    for (const id in LEGEND_FISH) if (S[id]) this.legendWater(id, S[id]);
    this.orderTick();
  },
  /* İzler (incelenebilir) ve inin süsü (kemikler, iz): oyuncu yakınken dünyada */
  legendProps(id, sp, d) {
    const L = LEGENDS[id], R = this.lgR(id), P = this.player, pre = 'lg:' + id + ':', want = [];
    const has = this._lgPn || (this._lgPn = {});
    if (d > 1500 && !has[id]) return;   // uzakta ve dünyada izi yok: yapacak bir şey yok
    if (!R.k && d < 1500) {
      this.legendClues(id).forEach((c, i) => { if (!(R.c || []).includes(i) && dist(P.x, P.y, c.x, c.y) < 700) want.push({ k: pre + 'c' + i, x: c.x, y: c.y, t: L.clue, ang: c.ang, ci: i }); });
      if (d < 800) { want.push({ k: pre + 'b', x: sp.x - 16, y: sp.y + 12, t: 'bones' }); want.push({ k: pre + 'm', x: sp.x + 20, y: sp.y - 8, t: L.clue, ang: 0.7 }); }
    }
    const keys = new Set(want.map(w => w.k)), live = new Set();
    for (const e of this.ents) if (e.lgKey && !e.remove && e.lgKey.startsWith(pre)) { if (keys.has(e.lgKey)) live.add(e.lgKey); else e.remove = true; }
    for (const w of want) {
      if (live.has(w.k)) continue;
      const e = new Prop(w.x, w.y, w.t, { ang: w.ang || 0 });
      e.big = true; e.lgKey = w.k; e.keep = true;
      if (w.ci !== undefined) { e.lgClue = { id, i: w.ci }; e.label = Tr('Tuhaf Bir İz'); }
      this.addEnt(e);
    }
    has[id] = want.length > 0;
  },
  /* İzi incele: çember daralır; üçüncü izde in haritaya işlenir */
  legendClue(e) {
    const { id, i } = e.lgClue, L = LEGENDS[id], R = this.lg(id);
    e.remove = true;
    R.c = R.c || [];
    if (R.c.includes(i)) return;
    R.c.push(i);
    const first = !R.r;
    R.r = 1;
    this.skillXp('hunting', 5);
    Audio_.tone(420, 0.12, 'triangle', 0.05);
    let tail;
    if (R.c.length >= 3) { R.f = 1; tail = Tr`İnin yeri artık belli; haritana işlendi. ${L.n} ${this.legendWhen(L.when)} görünür.`; }
    else tail = first ? Tr`Bu bir efsanenin izi: <b>${L.n}</b>. Haritanda arama çemberi açıldı; başka izler onu daraltır.` : Tr`Arama çemberi daraldı (${R.c.length}/3 iz).`;
    UI.toast(L.n, `${legendClueText(id, i)} ${tail}`, 'legend');
    this.guideFlag('legends');
  },
  /* Efsanevi hayvan: koşul tutunca ininde belirir, koşul bitince ya da uzaklaşınca kaybolur */
  legendBeast(id, sp, d) {
    const L = LEGENDS[id], R = this.lgR(id), P = this.player;
    let a = null;
    for (const e of this.ents) if (e.legend === id && !e.remove && !e.dead) { a = e; break; }
    if (a) {
      const da = dist(P.x, P.y, a.x, a.y);
      if (!a.lgSeen && da < 320) {
        a.lgSeen = 1;
        const W = this.lg(id); W.r = 1; W.f = 1;
        UI.toast(L.n, L.d, 'legend');
        if (a.def.beh === 'hostile') Audio_.growl(a.type, a.x, a.y);
        this.guideFlag('legends');
      }
      // ürkek efsane gözden kaçtı: o gün dönmez
      if (L.wary && a.state === 'flee' && da > 950) { a.remove = true; this.lg(id).gone = this.day; UI.feed(Tr`${L.n} kaçtı; bugün geri gelmez.`, 'warn'); return; }
      if (da > 1500 || (da > 650 && !this.legendNow(L.when) && a.state !== 'attack')) a.remove = true;
      return;
    }
    if (R.k || R.gone === this.day || d > 650 || this.insideB) return;
    if (!this.legendNow(L.when)) {
      if (d < 230 && R.hd !== this.day) {   // inin başındasın ama efsane yok: ne zaman geldiği söylenir
        const W = this.lg(id); W.hd = this.day; W.r = 1; W.f = 1;
        UI.toast(L.n, Tr`Burası onun ini; ama şimdi ortalıkta yok. ${L.n} ${this.legendWhen(L.when)} görünür.`, 'legend');
        this.guideFlag('legends');
      }
      return;
    }
    // inin yakınında, oyuncudan biraz uzakta belirir
    let pos = null;
    for (let k = 0; k < 6 && !pos; k++) { const q = this.findSpawnPos(sp.x, sp.y, 0, 150); if (q && dist(q[0], q[1], P.x, P.y) > 220) pos = q; }
    if (!pos) pos = this.findSpawnPos(sp.x, sp.y, 0, 150) || [sp.x, sp.y];
    const b = this.addEnt(this.legendMake(id, pos[0], pos[1]));
    for (let k = 0; k < (L.pack || 0); k++) {
      const q = this.findSpawnPos(b.x, b.y, 14, 60);
      if (!q) continue;
      const m = new Animal(q[0], q[1], L.base);
      m.leader = b; m.lgPack = id;
      this.addEnt(m);
    }
  },
  legendMake(id, x, y) {
    const L = LEGENDS[id], a = new Animal(x, y, L.base);
    this.legendApply(a, id);
    a.hp = a.maxHp = a.def.hp;
    if (L.male) a.male = true;
    a.keep = true;
    const sp = this.legendSpots()[id];
    a.home = { x: sp.x, y: sp.y, r: 140 };
    return a;
  },
  /* Temel türün üstüne efsanenin değerleri (kayıttan dönen leşe de uygulanır) */
  legendApply(a, id) {
    const L = LEGENDS[id], B = ANIMALS[L.base];
    a.def = Object.assign({}, B, L.def, { n: L.n, pelt: [L.pelt, 1], meat: B.meat ? [B.meat[0], B.meat[1] * 2] : null, extra: null, grp: [1, 1] });
    a.legend = id;
    a.r = Math.max(2.5, a.def.wid * 0.45);
  },
  /* Efsane vuruldu (Animal.hurt): kudurur, saldırır ya da çekilir; true: durumunu efsane belirledi */
  legendHurt(a) {
    const L = LEGENDS[a.legend];
    if (!L) return false;
    if (L.rage && !a.raged && a.hp < a.maxHp * 0.5) {
      a.raged = 1; a.def.spd *= 1.25; a.def.dmg *= 1.2;
      Audio_.growl(a.type, a.x, a.y);
      UI.feed(Tr`${L.n} kudurdu!`, 'warn');
    }
    if (L.charge) { a.state = 'attack'; a.t = 12; return true; }
    if (L.hitRun && chance(0.5)) { a.state = 'flee'; a.t = rnd(2, 3.2); a.fleeFrom(this.player); return true; }
    return false;
  },
  /* Efsane saldırdı (Animal.update): vurup çekilenler kısa bir süre geri çekilir */
  legendStrike(a) {
    const L = LEGENDS[a.legend];
    if (L && L.hitRun && chance(0.4)) { a.state = 'flee'; a.t = rnd(1.8, 3); a.fleeFrom(this.player); }
  },
  /* Efsane öldü (kim vurursa vursun): bir daha gelmez */
  legendKilled(a) {
    const id = a.legend, L = LEGENDS[id];
    if (!L) return;
    const R = this.lg(id);
    if (R.k) return;
    R.k = this.day + 1; R.r = 1; R.f = 1;
    this.stat('legends', 1);
    if (Audio_.chime) Audio_.chime();
    UI.toast(L.n, Tr('Efsanevi bir av! Derisini yüz: postu eşsizdir.'), 'legend');
    this.guideFlag('legends');
  },
  /* Derisini yüz: efsanevi post (büyüğü omza), ganimet ve iki kat et */
  legendSkin(a) {
    const P = this.player, L = LEGENDS[a.legend], B = ANIMALS[L.base], it = ITEMS[L.pelt];
    a.skinned = true; a.keep = false;
    if (it.big) {
      const pe = new Pelt(a.x, a.y, L.pelt, 1);
      if (!P.carry && !P.riding) { P.carry = pe; UI.feed(Tr`${pe.name} omzunda.`); }
      else this.placeDown(pe, a.x + rnd(-6, 6), a.y + rnd(-6, 6));
    } else P.addItem(L.pelt, 1);
    if (L.trophy) P.addItem(L.trophy, 1);
    if (B.meat) P.addItem(B.meat[0], B.meat[1] * 2);
    this.lg(a.legend).s = 1;
    P.clean = Math.max(0, P.clean - 10);
    Audio_.play('skin', { x: a.x, y: a.y });
    this.skillXp('hunting', 12);
    this.parts.burst('blood', a.x, a.y, 8, 24, 0.7, 1.4);
    UI.toast(L.n, Tr`${it.n}${L.trophy ? ' + ' + ITEMS[L.trophy].n : ''}. Terzi bu posttan eşsiz bir giysi diker.`, 'legend');
    this.qEvent('skin', a);
  },

  /* ---------------- efsanevi balık ---------------- */
  /* Suyun başında: koşul tutunca suda kıpırtı ve sıçrayan balık; ilk görüşte suyu bulunur */
  legendWater(id, sp) {
    const F = LEGEND_FISH[id], R = this.lgR(id), P = this.player;
    if (R.k) return;
    const d = dist(P.x, P.y, sp.x, sp.y);
    if (d > 700) return;
    const now = this.legendNow(F.when) && R.lost !== this.day;
    if (now && chance(0.35)) {
      const a = rnd(TAU), r = rnd(6, 56), x = sp.x + Math.cos(a) * r, y = sp.y + Math.sin(a) * r;
      if (this.world.isWaterPx(x, y)) { this.parts.add('splash', x, y, 0, 0, 0.9, 4); if (chance(0.15)) this.parts.burst('splash', x, y, 8, 26, 0.8, 3); }
    }
    if (d < 260 && !R.f && now) {
      const W = this.lg(id); W.f = 1; W.r = 1;
      UI.toast(F.n, Tr`Suda dev bir gölge kıpırdadı. Burası onun suyu; yalnızca ${this.legendWhen(F.when)} vurur.`, 'legend');
      this.guideFlag('legends');
    } else if (d < 200 && R.f && !now && R.hd !== this.day) {
      this.lg(id).hd = this.day;
      UI.feed(Tr`${F.n} bu suda yaşıyor; yalnızca ${this.legendWhen(F.when)} vurur.`);
    }
  },
  /* Olta vurduğunda: efsanevi balığın suyundaysan ve koşul tutuyorsa onun vurma ihtimali; vurduysa kimliği */
  legendFishBite() {
    const P = this.player, S = this.legendSpots();
    for (const id in LEGEND_FISH) {
      const F = LEGEND_FISH[id], R = this.lgR(id), sp = S[id];
      if (!sp || R.k || R.lost === this.day || dist(P.x, P.y, sp.x, sp.y) > 160 || !this.legendNow(F.when)) continue;
      return chance(P.has('bait') ? 0.55 : 0.4) ? id : null;
    }
    return null;
  },
  legendFishCaught(id) {
    const F = LEGEND_FISH[id], R = this.lg(id), P = this.player;
    R.k = this.day + 1; R.r = 1; R.f = 1;
    R.kg = Math.round(rnd(F.kg[0], F.kg[1]) * 10) / 10;
    P.addItem(F.item, 1);
    this.stat('fish', 1); this.stat('legendFish', 1);
    this.skillXp('survival', 30);
    if (Audio_.chime) Audio_.chime();
    UI.toast(F.n, Tr`Efsanevi bir balık! ${fmtKg(R.kg)}`, 'legend');
    this.guideFlag('legends');
    return R.kg;
  },
  /* Misina koptu ya da balık kaçtı: o gün bir daha vurmaz */
  legendFishLost(id) { const R = this.lg(id); R.lost = this.day; R.f = 1; R.r = 1; },

  /* ---------------- giysinin etkisi ---------------- */
  /* Üstündeki paltonun bir etkisi (scent, guard, aggro, sta, de: çarpan; venom: 1) ya da varsayılan */
  coatFx(k, def = 1) {
    const P = this.player, it = P && P.coat ? ITEMS[P.coat] : null;
    const v = it && it.coat ? it.coat[k] : undefined;
    return typeof v === 'number' ? v : def;   // giysisiz ya da etkisiz: varsayılan (çarpanda 1)
  },

  /* ---------------- heybe ve eyer ---------------- */
  /* Bir eşyanın taşıma sınırı: heybe basamağı yiyecek, ilaç, bitki, av ürünü, değerli ve koleksiyon gibi yığılan
     eşyaları büyütür (alet, belge, giysi ve patlayıcı aynı kalır) */
  itemCap(id) {
    const it = ITEMS[id];
    if (!it) return 0;
    const m = (SATCHEL[this.gear ? this.gear.bag : 0] || SATCHEL[0]).mul;
    if (m === 1 || it.max < 5 || it.c === 'tool' || it.c === 'doc' || it.c === 'ammo' || it.c === 'clothing') return it.max;
    return Math.round(it.max * m);
  },
  horseCap() { return (SADDLE[this.gear ? this.gear.saddle : 0] || SADDLE[0]).cap; },

  /* ---------------- sipariş ----------------
     { k: 'coat', id } | { k: 'bag', tier } | { k: 'saddle', tier }; verilince town ve ready (oyun dakikası) eklenir */
  orderSpec(o) {
    if (!o) return null;
    if (o.k === 'coat') { const R = TAILOR.find(t => t.id === o.id); return R && ITEMS[o.id] ? { n: ITEMS[o.id].n, need: R.need, fee: R.fee, h: R.h, b: 'tailor' } : null; }
    const S = o.k === 'bag' ? SATCHEL[o.tier] : o.k === 'saddle' ? SADDLE[o.tier] : null;
    return S && S.need ? { n: S.n, need: S.need, fee: S.fee, h: S.h, b: o.k === 'bag' ? 'tailor' : 'stable' } : null;
  },
  orderHours(s) { return Math.round(s.h * (this.hasPerk('tailor') ? 0.75 : 1)); },
  /* Malzeme: çantadakiler, omzundaki ve yakındaki atının eyerindeki büyük postlar */
  matHave(id) {
    let n = this.player.count(id);
    for (const c of this.carriedAll()) if (c.e.kind === 'pelt' && c.e.id === id) n++;
    return n;
  },
  matTake(id, n) {
    const P = this.player, k = Math.min(n, P.count(id));
    if (k > 0) P.removeItem(id, k);
    n -= k;
    for (const c of this.carriedAll()) { if (n <= 0) break; if (c.e.kind === 'pelt' && c.e.id === id) { this.takeCarried(c); n--; } }
  },
  /* Sipariş verilebilir mi: '' ya da nedeni */
  orderWhy(o) {
    const s = this.orderSpec(o), P = this.player;
    if (!s) return '?';
    if (this.orders.some(x => x.k === o.k && (o.k !== 'coat' || x.id === o.id))) return Tr('Bu sipariş zaten hazırlanıyor.');
    if (o.k === 'coat' && (P.has(o.id) || P.coat === o.id)) return Tr('Bu giysi zaten sende.');
    const cur = o.k === 'bag' ? this.gear.bag : o.k === 'saddle' ? this.gear.saddle : -1;
    if (cur >= 0 && cur >= o.tier) return o.k === 'bag' ? Tr('Heyben zaten bu kadar büyük.') : Tr('Eyerin zaten bu kadar büyük.');
    if (cur >= 0 && cur < o.tier - 1) return o.k === 'bag' ? Tr('Önce bir önceki heybeyi diktir.') : Tr('Önce bir önceki eyeri yaptır.');
    const miss = Object.entries(s.need).filter(([id, n]) => this.matHave(id) < n);
    if (miss.length) return Tr`Eksik: ${miss.map(([id, n]) => `${ITEMS[id].n} ×${n - this.matHave(id)}`).join(', ')}`;
    if (P.money < s.fee) return Tr('Yeterli paran yok.');
    return '';
  },
  placeOrder(o, b) {
    const why = this.orderWhy(o);
    if (why) { UI.feed(why, 'warn'); return false; }
    const s = this.orderSpec(o);
    if (!this.spend(s.fee)) return false;
    for (const [id, n] of Object.entries(s.need)) this.matTake(id, n);
    const h = this.orderHours(s);
    this.orders.push(Object.assign({}, o, { town: b.town, ready: this.clock + h * 60 }));
    this.stat('orders', 1);
    this.skillXp('trade', 2);
    UI.feed(Tr`✂ ${s.n}: sipariş verildi, ${h} saat sonra hazır.`);
    Audio_.ui('cash');
    this.qEvent('order', o);
    return true;
  },
  orderReady(o) { return this.clock >= o.ready; },
  /* Bu binadan teslim alınır mı: siparişin verildiği kasabanın terzisi (ya da ahırı); kasabada artık yoksa her yerde */
  orderHere(o, b) {
    const s = this.orderSpec(o);
    if (!s || !b || b.type !== s.b) return false;
    return b.town === o.town || !this.world.buildings.some(x => x.type === s.b && x.town === o.town && !x.shut);
  },
  collectOrder(o) {
    const i = this.orders.indexOf(o);
    if (i < 0 || !this.orderReady(o)) return false;
    const s = this.orderSpec(o), P = this.player;
    if (o.k === 'coat' && P.count(o.id) >= P.cap(o.id)) { UI.feed(Tr('Çantada yer yok.'), 'warn'); return false; }
    this.orders.splice(i, 1);
    if (o.k === 'coat') { P.addItem(o.id, 1); this.hintOnce('madecoat', Tr`Dikilen giysiyi ${Input.glyph('satchel')} Çanta → <b>Alet & Giysi</b> sekmesinden giyersin. Etkileri giysinin açıklamasında yazar.`, 8); }
    else if (o.k === 'bag') { this.gear.bag = Math.max(this.gear.bag, o.tier); UI.feed(Tr`${s.n}: yığılan eşyaların taşıma sınırı ×${SATCHEL[this.gear.bag].mul}.`); }
    else { this.gear.saddle = Math.max(this.gear.saddle, o.tier); UI.feed(Tr`${s.n}: atın artık ${this.horseCap()} birim yük taşır.`); }
    UI.toast(s.n, Tr('Siparişini teslim aldın.'), 'ok');
    Audio_.ui('ok');
    this.qEvent('collect', o);
    return true;
  },
  /* Hazır olan siparişi bir kez haber ver */
  orderTick() {
    for (const o of this.orders) {
      if (o.told || !this.orderReady(o)) continue;
      o.told = 1;
      const s = this.orderSpec(o), t = this.world.towns.find(x => x.id === o.town), tn = t ? t.n : '';
      UI.toast(Tr('Sipariş Hazır'), s.b === 'stable' ? Tr`${s.n}: ${tn} ahırında seni bekliyor.` : Tr`${s.n}: ${tn} terzisinde seni bekliyor.`, 'quest');
    }
  },
};

/* Ağırlık: 14,2 kg / 14.2 kg */
function fmtKg(v) { const s = (Math.round(v * 10) / 10).toFixed(1); return (I18N.lang === 'tr' ? s.replace('.', ',') : s) + ' kg'; }

/* ---------------- menüler: terzi, saraç, efsane anlatanlar ---------------- */
Object.assign(UI, {
  orderSide(o) {
    const s = G.orderSpec(o);
    if (!s) return '';
    const ic = o.k === 'coat' ? Icons.item(o.id, 'ic big') : Icons.glyph(o.k === 'bag' ? 'satchel' : 'horseshoe', '#efe6d2', 'ic big');
    const d = o.k === 'coat' ? ITEMS[o.id].d
      : o.k === 'bag' ? Tr`Yığılan eşyaların (yiyecek, ilaç, bitki, av ürünü, değerli ve koleksiyon eşyası) taşıma sınırı ×${SATCHEL[o.tier].mul}.`
        : Tr`Atının eyeri ${SADDLE[o.tier].cap} birim yük taşır (büyük leş 2, küçük leş ve post 1).`;
    const need = Object.entries(s.need).map(([id, n]) => { const h = G.matHave(id); return `<div class="${h >= n ? 'ok' : 'no'}">${Icons.item(id, 'ic inl')} ${ITEMS[id].n} ${Math.min(h, n)}/${n}</div>`; }).join('');
    return `<div class="ps-big">${ic}</div><div class="ps-t">${s.n}</div><div class="ps-d">${d}</div><div class="ps-e ps-need">${Tr('Gerekenler')}${need}</div><div class="ps-p">${Tr`Ücret: ${fmtMoney(s.fee)} · ${G.orderHours(s)} saatte hazır`}</div>`;
  },
  /* Bu binadaki siparişlerin: hazırsa teslim al */
  orderRows(b, items) {
    const mine = G.orders.filter(o => G.orderHere(o, b));
    if (!mine.length) return;
    items.push({ header: Tr('Siparişlerin') });
    for (const o of mine) {
      const s = G.orderSpec(o), rd = G.orderReady(o);
      items.push({ icon: o.k === 'coat' ? Icons.item(o.id) : Icons.glyph(o.k === 'bag' ? 'satchel' : 'horseshoe', '#efe6d2'), label: rd ? Tr`Teslim Al: ${s.n}` : s.n, cls: rd ? 'pref' : '',
        right: rd ? Tr('Hazır') : Tr`${Math.max(1, Math.ceil((o.ready - G.clock) / 60))} sa`, disabled: !rd, why: Tr('Henüz hazır değil.'), side: this.orderSide(o), fn: () => G.collectOrder(o) });
    }
  },
  /* Terzi: kendi postundan giysi ve heybe */
  openTailor(b) {
    this.menu({
      title: Tr('Postundan Diktir'), cls: 'shop', wallet: true, side: (it) => it.side || '',
      sub: () => Tr('Postlar çantandan, omzundan ya da kapıdaki atının eyerinden alınır.'),
      build: () => {
        const it = [];
        this.orderRows(b, it);
        it.push({ header: Tr('Giysiler') });
        for (const R of TAILOR) {
          const o = { k: 'coat', id: R.id }, why = G.orderWhy(o);
          it.push({ icon: Icons.item(R.id), label: ITEMS[R.id].n, right: `${fmtMoney(R.fee)} <small>${G.orderHours(R)} sa</small>`, disabled: !!why, why, side: this.orderSide(o), fn: () => G.placeOrder(o, b) });
        }
        it.push({ header: Tr('Heybe') });
        SATCHEL.forEach((S, tier) => {
          if (!tier) return;
          const o = { k: 'bag', tier }, why = G.orderWhy(o), done = G.gear.bag >= tier;
          it.push({ icon: Icons.glyph('satchel', '#efe6d2'), label: S.n, right: done ? Tr('Sende') : `${fmtMoney(S.fee)} <small>${G.orderHours(S)} sa</small>`, disabled: !!why, why, side: this.orderSide(o), fn: () => G.placeOrder(o, b) });
        });
        return it;
      },
    });
  },
  /* Ahırdaki saraç: eyerin taşıdığı yük */
  openSaddler(b) {
    this.menu({
      title: Tr('Saraç'), cls: 'shop', wallet: true, side: (it) => it.side || '',
      sub: () => Tr`Eyerin şimdi ${G.horseCap()} birim taşıyor. Derileri çantandan, omzundan ya da kapıdaki atının eyerinden alır.`,
      build: () => {
        const it = [];
        this.orderRows(b, it);
        it.push({ header: Tr('Eyer') });
        SADDLE.forEach((S, tier) => {
          if (!tier) return;
          const o = { k: 'saddle', tier }, why = G.orderWhy(o), done = G.gear.saddle >= tier;
          it.push({ icon: Icons.glyph('horseshoe', '#efe6d2'), label: S.n, right: done ? Tr('Sende') : `${fmtMoney(S.fee)} <small>${G.orderHours(S)} sa</small>`, disabled: !!why, why, side: this.orderSide(o), fn: () => G.placeOrder(o, b) });
        });
        return it;
      },
    });
  },
  /* Tuzakçı av efsanelerini, liman balıkçıları balık efsanelerini anlatır */
  legendTales(kind) {
    const who = kind === 'fish' ? Tr('Yaşlı Balıkçı') : Tr('Tuzakçı');
    if (!G.legendUnheard(kind).length) {
      this.info(who, `<p class="quote">"${kind === 'fish' ? Tr('Bildiğim bütün balık hikâyelerini anlattım. Gerisi senin oltana kalmış.') : Tr('Bildiğim bütün av hikâyelerini anlattım. Gerisi senin tüfeğine kalmış.')}"</p>`);
      return;
    }
    if (!G.spend(SVC.tales)) return;
    const txt = G.legendRumor(kind);
    this.info(who, `<p>${txt}</p><p class="dim">${kind === 'fish' ? Tr('Haritanda bir arama çemberi işaretlendi. Vakti gelince suda kıpırtı ara.') : Tr('Haritanda bir arama çemberi işaretlendi. Çemberin içindeki izleri bul.')}</p>`);
  },
});
