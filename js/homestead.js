'use strict';
/* ==========================================================
   FRONTIER'S END — kendi yapın (G nesnesine eklenir)
   - Arazi Kazıkları'nı kasabalardan, yollardan, sudan ve yerlerden
     uzak, düz ve boş bir araziye çakarsın. Yer uygunsa üç konaklama
     yapısından birini seçersin: baraka, kütük kulübe, çiftlik evi.
   - Tapulu (tapu dairesi / ilçe binasından Arazi Tapusu) ya da kaçak.
     Kaçak yapı ihbar edilirse 3 gün içinde tapuya bağlanmazsa mühürlenir.
   - İnşaat günler sürer ve şantiye her gün ilerler; yanında çalışırsan
     hızlanır. İç tasarım birkaç tasarımdan rastgele biridir.
   - Ahır, kuyu ve bostan yalnızca biten bir yapının yanına eklenir.
   Arazi yerel karo düzeni (HOME_FW x HOME_FH): yapı üst ortada, ahır
   solda, kuyu sağ üstte, bostan sağ altta, kapıdan aşağı patika.
   ========================================================== */

const HomeSystems = {
  homeOf(b) { return b && b.home !== undefined ? this.homes.find(h => h.id === b.home) : null; },
  homeBuilding(h) { return this.world.buildings.find(b => b.home === h.id) || null; },
  homeRect(h) { const d = BUILDINGS[h.type]; return { x: h.tx + ((HOME_FW - d.w) >> 1), y: h.ty + 1, w: d.w, h: d.h }; },
  homeAtIdx(i) { const x = i % WW, y = (i / WW) | 0; return this.homes.find(h => x >= h.tx && x < h.tx + HOME_FW && y >= h.ty && y < h.ty + HOME_FH) || null; },
  homeName(h) { return BUILDINGS[h.type].n; },
  /* Sıradaki iş: önce yapı, sonra sırayla ekler */
  homeJob(h) { return !h.done ? h : h.addons.find(a => !a.done) || null; },
  homePct(j) { return Math.min(100, Math.round(j.work / j.need * 100)); },

  /* ---------------- yer seçimi ---------------- */
  /* Oyuncu arazinin alt ortasında, kapıdan inen patikanın üstünde durur */
  homeSpotAt(px, py) { return [(px >> 4) - (HOME_FW >> 1), (py >> 4) - (HOME_FH - 2)]; },
  /* Uygun değilse nedeni, uygunsa '' */
  homeCheck(tx, ty) {
    const W = this.world, FW = HOME_FW, FH = HOME_FH;
    if (tx < 6 || ty < 6 || tx + FW > WW - 6 || ty + FH > WH - 6) return Tr('Dünyanın kenarına bu kadar yakın yapı kurulamaz.');
    const cx = (tx + FW / 2) * TS, cy = (ty + FH / 2) * TS;
    for (const [x, y] of [[tx, ty], [tx + FW, ty], [tx, ty + FH], [tx + FW, ty + FH]]) if (W.townAt(x * TS, y * TS, 30)) return Tr('Kasabaya çok yakın. Kasabada yapı için arsa satın almalısın.');
    if (this.homes.some(h => Math.abs(h.tx - tx) < FW + 24 && Math.abs(h.ty - ty) < FH + 24)) return Tr('Başka bir yapına çok yakın.');
    for (const p of W.pois) if (dist2(p.x, p.y, cx, cy) < 360 * 360) return Tr`Burası ${p.n || Tr('bir yer')} için ayrılmış; biraz daha uzaklaş.`;
    for (const nc of this.nomads || []) if (nc.x !== undefined && dist2(nc.x, nc.y, cx, cy) < 400 * 400) return Tr('Göçebelerin kamp yerine çok yakın.');
    let trees = 0;
    for (let y = ty - 3; y < ty + FH + 3; y++) for (let x = tx - 3; x < tx + FW + 3; x++) {
      const i = y * WW + x, t = W.tile[i], f = W.flags[i];
      if (f & 8) return Tr('Yakında başka bir yapı var.');
      if (f & 2) return Tr('Demiryoluna çok yakın.');
      if (t === T.ROAD || t === T.BRIDGE || t === T.TOWN || t === T.PLANK || isStoneT(t)) return Tr('Yolun üstüne ya da hemen kenarına yapı kurulamaz.');
      if (x < tx || x >= tx + FW || y < ty || y >= ty + FH) continue;
      if (isWaterT(t) || t === T.SWAMP || t === T.MUD || t === T.HOTWATER) return Tr('Zemin su ya da bataklık. Kuru bir yer bul.');
      if (t === T.ROCK || t === T.CLIFF || t === T.SNOWCLIFF || t === T.MESA || t === T.REDROCK) return Tr('Zemin kayalık ve engebeli.');
      if (t === T.DESERT || t === T.SAND) return Tr('Kumun üstüne temel atılmaz.');
      if (t === T.FARM) return Tr('Burası birinin tarlası.');
      if (W.obj[i] && SOLID_O[W.obj[i]]) trees++;
    }
    if (trees > FW * FH * 0.3) return Tr('Burası çok sık ağaçlık ya da kayalık. Daha açık bir yer bul.');
    return '';
  },
  /* Arazi Kazıkları kullanılınca */
  useStakes() {
    const P = this.player;
    if (P.riding) { UI.feed(Tr('Kazıkları çakmak için attan in.'), 'warn'); return; }
    if (this.insideB) { UI.feed(Tr('Kazıkları dışarıda, boş bir araziye çak.'), 'warn'); return; }
    const [tx, ty] = this.homeSpotAt(P.x, P.y);
    const why = this.homeCheck(tx, ty);
    if (why) { UI.feed(`📍 ${why}`, 'warn'); this.homePreview = { tx, ty, bad: true, t: 2.5 }; return; }
    UI.openHomePlan(tx, ty);
  },

  /* ---------------- inşaat ---------------- */
  homeStart(tx, ty, type, legal) {
    const P = this.player, T_ = HOME_TYPES[type];
    if (this.homeCheck(tx, ty)) return false;
    if (legal && !P.has('land_deed')) { UI.feed(Tr('Arazi tapun yok.'), 'warn'); return false; }
    if (!this.spend(T_.p)) return false;
    if (legal) P.removeItem('land_deed', 1);
    P.removeItem('stakes', 1);
    const h = { id: (this.homeSeq = (this.homeSeq || 0) + 1), tx, ty, type, design: rndi(0, 2), legal, work: 0, need: T_.days, since: this.day, done: false, addons: [], notice: 0, sealed: false };
    this.homes.push(h);
    this.homeApply(h, true);
    this.homePoi(h);
    Audio_.ui('cash');
    UI.toast(Tr('İnşaat Başladı'), Tr`${this.homeName(h)} ${T_.days} gün içinde bitecek. Yanında çalışırsan daha çabuk biter.`, 'ok');
    if (!legal) this.hintOnce('illegal_home', Tr('Tapusuz bir yapı kuruyorsun. İhbar edilirse <b>3 gün içinde</b> tapu dairesinde ya da ilçe binasında tapuya bağlamazsan yapın <b>mühürlenir</b>. Kasabalardan uzak yapılar daha geç fark edilir.'), 10);
    return true;
  },
  homeAddon(h, k) {
    const A = HOME_ADDONS[k];
    if (!h.done || h.sealed || h.addons.some(a => a.k === k)) return false;
    if (!this.spend(A.p)) return false;
    h.addons.push({ k, work: 0, need: A.days, done: false });
    this.homeApply(h);
    Audio_.ui('cash');
    UI.feed(Tr`🔨 ${A.n} yapımı başladı (${A.days} gün).`);
    return true;
  },
  /* Şantiyede iki saat çalış: günde en çok iki kez */
  homeWork(h) {
    const P = this.player, job = this.homeJob(h);
    if (!job) { UI.feed(Tr('Yapılacak bir iş kalmadı.')); return; }
    if (h.sealed) { UI.feed(Tr('Yapın mühürlü. İnşaat durdu.'), 'warn'); return; }
    const k = 'hw' + h.id;
    if ((this.dailyTalk[k] || 0) >= 2) { UI.feed(Tr('Bugün şantiyede yeterince çalıştın.'), 'warn'); return; }
    if (P.energy < 15) { UI.feed(Tr('Çalışamayacak kadar yorgunsun.'), 'warn'); return; }
    this.dailyTalk[k] = (this.dailyTalk[k] || 0) + 1;
    job.work += 0.5;
    P.energy = Math.max(0, P.energy - 12); P.hunger = Math.max(0, P.hunger - 6); P.thirst = Math.max(0, P.thirst - 8);
    this.skillXp('strength', 6);
    Audio_.thud(0.25);
    this.homeProgress(h);
    this.advanceClock(120);
    UI.feed(Tr`🔨 Şantiyede iki saat çalıştın. İlerleme: %${this.homePct(job)}`);
  },
  /* Biten işleri kapat, dünyayı güncelle */
  homeProgress(h) {
    let changed = false;
    if (!h.done && h.work >= h.need) {
      h.done = true; changed = true;
      UI.toast(Tr('Yapın Hazır'), Tr`${this.homeName(h)} tamamlandı. Yatağında uyuyup oyunu kaydedebilirsin.`, 'ok');
      this.stat('homesBuilt', 1);
    }
    for (const a of h.addons) if (!a.done && a.work >= a.need) { a.done = true; changed = true; UI.toast(Tr('Ek Tamamlandı'), Tr`${HOME_ADDONS[a.k].n} hazır.`, 'ok'); }
    this.homeApply(h, changed);
  },
  /* Her yeni gün: işçiler bir günlük iş çıkarır, kaçak yapılar ihbar edilebilir */
  homeDaily() {
    for (const h of this.homes) {
      if (!h.sealed) { const job = this.homeJob(h); if (job) job.work += 1; }
      if (!h.legal && !h.sealed) {
        if (h.notice && this.day >= h.notice) {
          h.sealed = true;
          UI.toast(Tr('Yapın Mühürlendi'), Tr`Tapusuz ${this.homeName(h)} ilçe tarafından mühürlendi. Tapuya bağlarsan mühür kalkar.`, 'wanted');
        } else if (!h.notice) {
          const r = this.homeRect(h), cx = (r.x + r.w / 2) * TS, cy = (r.y + r.h / 2) * TS;
          let d = 1e9;
          for (const t of this.world.towns) d = Math.min(d, dist(cx, cy, (t.x + t.w / 2) * TS, (t.y + t.h / 2) * TS));
          const p = d < 2400 ? 0.07 : d < 4000 ? 0.035 : 0.012;
          if (chance(p)) {
            h.notice = this.day + 3;
            UI.toast(Tr('Kaçak Yapı İhbarı'), Tr`Biri tapusuz ${this.homeName(h)} yapını ilçeye bildirdi. 3 gün içinde tapu dairesinde ya da ilçe binasında tapuya bağlamazsan mühürlenecek.`, 'wanted');
          }
        }
      }
      this.homeProgress(h);
    }
  },
  /* Tapu dairesinde / ilçe binasında: kaçak yapıyı tapuya bağla (ihbarlı ya da mühürlüyse ceza da ödenir) */
  homeLegalPrice(h) { return DEED_PRICE + (h.notice || h.sealed ? DEED_PRICE : 0); },
  homeLegalize(h) {
    if (h.legal || !this.spend(this.homeLegalPrice(h))) return false;
    h.legal = true; h.notice = 0; h.sealed = false;
    Audio_.ui('cash');
    UI.toast(Tr('Tapu Alındı'), Tr`${this.homeName(h)} artık yasal olarak senin.`, 'ok');
    return true;
  },
  buyDeed() {
    if (!this.player.has('land_deed') || this.player.count('land_deed') < ITEMS.land_deed.max) {
      if (!this.spend(DEED_PRICE)) return false;
      this.player.addItem('land_deed', 1, true);
      UI.feed(Tr('📜 Arazi tapusu aldın. Kazıkları çaktığın yere yasal yapı kurabilirsin.'));
      return true;
    }
    UI.feed(Tr('Daha fazla tapu taşıyamazsın.'), 'warn'); return false;
  },
  /* Bitmiş ahırı olan ve yemliği bu noktaya yakın yapı */
  homeStableNear(x, y) {
    return this.homes.find(h => !h.sealed && h.addons.some(a => a.k === 'stable' && a.done) && dist(x, y, (h.tx + 2) * TS + 8, (h.ty + 4) * TS + 8) < 110) || null;
  },
  /* Yemlikte: atını besle ve dinlendir (günde bir) */
  homeRestHorse(h) {
    const hr = this.horse, P = this.player;
    if (!hr || hr.dead || dist(hr.x, hr.y, P.x, P.y) > 90) { UI.feed(Tr('Atın yanında değil.'), 'warn'); return; }
    const k = 'hr' + h.id;
    if (this.dailyTalk[k]) { UI.feed(Tr`${hr.name} bugün zaten dinlendi.`); return; }
    this.dailyTalk[k] = 1;
    hr.hp = hr.maxHp; hr.sta = hr.maxSta; hr.addBond(2);
    this.advanceClock(20);
    UI.feed(Tr`🐴 ${hr.name} yemliğin başında karnını doyurdu ve dinlendi.`);
  },

  /* ---------------- dünyaya uygula ---------------- */
  homeApply(h, remap) {
    const W = this.world, r = this.homeRect(h), FW = HOME_FW, FH = HOME_FH;
    const idx = (lx, ly) => (h.ty + ly) * WW + h.tx + lx;
    const put = (x, y, o) => { const i = y * WW + x; if (!(W.flags[i] & 8)) W.obj[i] = o; };
    // arazi temizlenir; yapının çevresi ve kapıdan inen patika toprak
    for (let ly = 0; ly < FH; ly++) for (let lx = 0; lx < FW; lx++) { const i = idx(lx, ly); if (W.flags[i] & 8) continue; W.obj[i] = 0; W.flags[i] |= 1; }
    const doorX = r.x + (r.w >> 1);
    for (let y = r.y - 1; y <= r.y + r.h + 1; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) { const i = y * WW + x; if (!(W.flags[i] & 8) && W.tile[i] !== T.FARM) W.tile[i] = T.TOWN; }
    for (let y = r.y + r.h + 1; y < h.ty + FH; y++) W.tile[y * WW + doorX] = T.TOWN;
    let b = this.homeBuilding(h), built = false;
    if (!h.done) {
      // şantiye: döşeme, malzeme; iskelet ve duvarlar ilerledikçe yükselir
      const stage = clamp(Math.floor(h.work / h.need * 3), 0, 2);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) W.tile[y * WW + x] = T.PLANK;
      put(r.x + r.w, r.y + 1, O.CRATE); put(r.x + r.w, r.y + 2, O.CRATE); put(r.x + r.w, r.y + 3, O.BARREL);
      if (stage >= 1) for (const [x, y] of [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]]) put(x, y, O.RUINWALL);
      if (stage >= 2) {
        for (let x = r.x; x < r.x + r.w; x++) put(x, r.y, O.RUINWALL);
        for (let y = r.y; y < r.y + r.h; y += 2) { put(r.x, y, O.RUINWALL); put(r.x + r.w - 1, y, O.RUINWALL); }
      }
    } else if (!b) {
      b = W.addBuilding(h.type, r.x, r.y, null, this.homeName(h), { home: h.id, design: h.design });
      built = true;
    }
    // tabela: kapının solunda
    h.sign = (r.y + r.h) * WW + r.x - 1;
    W.obj[h.sign] = O.SIGN;
    // ekler: bitmişse yapıları, sürüyorsa malzeme sandığı
    for (const a of h.addons) {
      if (a.k === 'stable') {
        if (!a.done) { W.obj[idx(1, 4)] = O.CRATE; continue; }
        W.obj[idx(0, 2)] = O.STALL; W.obj[idx(0, 3)] = O.HAY; W.obj[idx(0, 4)] = O.HAY; W.obj[idx(0, 5)] = O.STALL; W.obj[idx(2, 4)] = O.TROUGH; W.obj[idx(2, 2)] = O.HITCH;
      } else if (a.k === 'well') {
        W.obj[idx(FW - 3, 3)] = a.done ? O.WELL : O.CRATE;
      } else if (a.k === 'garden') {
        if (!a.done) { W.obj[idx(FW - 4, 8)] = O.CRATE; continue; }
        for (let ly = 8; ly <= 9; ly++) for (let lx = FW - 5; lx <= FW - 2; lx++) { const i = idx(lx, ly); W.tile[i] = T.FARM; W.obj[i] = O.CROP; }
      }
    }
    // çarpışma, bina iç çarpışması, chunk ve harita
    for (let y = h.ty - 2; y < h.ty + FH + 2; y++) for (let x = h.tx - 2; x < h.tx + FW + 2; x++) {
      const i = y * WW + x;
      W.solid[i] = (TINFO[W.tile[i]].solid || SOLID_O[W.obj[i]] || (W.flags[i] & 8)) ? 1 : 0;
      if (W.solid[i] && TRUNK_O[W.obj[i]] && !TINFO[W.tile[i]].solid && !(W.flags[i] & 8)) W.solid[i] = 5;
    }
    if (b && b.enter) W.buildingSolid(b);
    W.refreshChunks();
    if (built || remap) W.buildMapImage(true);
  },
  homePoi(h) {
    const W = this.world, id = 'home_' + h.id;
    if (W.pois.some(p => p.id === id)) return;
    const r = this.homeRect(h);
    W.addPOI({ id, n: this.homeName(h), type: 'home', tx: r.x + (r.w >> 1), ty: r.y + r.h + 1, kind: 'home', home: h.id });
    this.discovered.add(id);
  },
  /* Tabela: durum ve işler */
  homeSignActs(h) {
    const acts = [{ n: h.done ? Tr('Yapına Bak') : Tr('İnşaata Bak'), fn: () => UI.openHome(h) }];
    if (this.homeJob(h) && !h.sealed) acts.push({ n: Tr('Şantiyede Çalış (2 saat)'), hold: 1, fn: () => this.homeWork(h) });
    return acts;
  },
  homeSignLabel(h) {
    const job = this.homeJob(h);
    return h.sealed ? Tr`${this.homeName(h)} · Mühürlü` : !h.done ? Tr`${this.homeName(h)} İnşaatı · %${this.homePct(h)}` : job ? Tr`${HOME_ADDONS[job.k].n} yapılıyor · %${this.homePct(job)}` : this.homeName(h);
  },
  /* Yapının içindeki eşyalar (undefined: normal davranış) */
  homeFurn(b, o) {
    const h = this.homeOf(b), P = this.player, U = UI;
    const ok = h && h.done && !h.sealed;
    const sealed = label => ({ label, acts: [{ n: Tr('Mühürlü'), fn: () => UI.feed(Tr('Yapın mühürlü. Önce tapuya bağlamalısın.'), 'warn') }] });
    switch (o) {
      case O.BED: return ok ? { label: Tr('Yatağın'), acts: [{ n: Tr('Uyu'), fn: () => U.openSleep('home') }, { n: Tr('Oyunu Kaydet'), fn: () => this.saveGame() }] } : sealed(Tr('Yatak'));
      case O.STOVE: return ok ? { label: Tr('Ocak'), acts: [{ n: Tr('Yemek Pişir'), fn: () => U.openCook() }] } : undefined;
      case O.HOMECHEST: return ok ? { label: Tr('Sandık'), acts: [{ n: Tr('Sandığı Aç'), fn: () => U.openStash() }] } : sealed(Tr('Sandık'));
      case O.TUB: return ok ? { label: Tr('Küvet'), acts: [{ n: Tr('Sıcak Banyo'), fn: () => { P.clean = 100; P.warmBuff = Math.max(P.warmBuff, 60); UI.feed(Tr('🛁 Kendi küvetinde yıkandın.')); this.advanceClock(30); } }] } : null;
    }
    return undefined;
  },

  /* ---------------- kayıt ---------------- */
  saveHomes() { return { list: this.homes, seq: this.homeSeq || 0 }; },
  loadHomes(d) {
    this.homes = (d && d.list) || []; this.homeSeq = (d && d.seq) || this.homes.reduce((a, h) => Math.max(a, h.id), 0);
    for (const h of this.homes) { this.homeApply(h); this.homePoi(h); }
    if (this.homes.some(h => h.done)) this.world.buildMapImage(true);
  },
};

/* ---------------- arayüz ---------------- */
Object.assign(UI, {
  homeSide(k, legal) {
    const T_ = HOME_TYPES[k];
    return `<div class="ps-big">${Icons.glyph(k === 'hs_house' ? 'house' : 'hut', '#efe6d2', 'ic big')}</div><div class="ps-t">${BUILDINGS[k].n}</div><div class="ps-d">${T_.d}</div>
      <div class="ps-e">${Tr`İnşaat: ${T_.days} gün`}<br>${legal ? Tr('Tapulu: yapın yasal olarak senin.') : Tr('Kaçak: ihbar edilirse 3 gün içinde tapuya bağlamazsan mühürlenir.')}</div>`;
  },
  /* Kazıklar çakıldı: ne kurulacak? */
  openHomePlan(tx, ty) {
    const P = G.player;
    G.homePreview = { tx, ty, bad: false };
    const m = this.menu({
      title: Tr('Yapı Kur'), cls: 'small', side: (it) => it.side || '',
      sub: () => Tr`Cüzdan: ${fmtMoney(P.money)} · Arazi tapusu: ${P.count('land_deed')}`,
      onClose: () => { G.homePreview = null; },
      build: () => {
        const it = [], deed = P.has('land_deed');
        for (const legal of [true, false]) {
          it.push({ header: legal ? Tr('Tapulu (yasal)') : Tr('Kaçak (tapusuz)') });
          for (const k of Object.keys(HOME_TYPES)) {
            const pr = HOME_TYPES[k].p, poor = P.money < pr;
            it.push({ icon: Icons.glyph(k === 'hs_house' ? 'house' : 'hut', '#efe6d2'), label: BUILDINGS[k].n + (legal ? '' : Tr(' (kaçak)')), right: fmtMoney(pr), side: this.homeSide(k, legal),
              disabled: poor || (legal && !deed), why: legal && !deed ? Tr('Önce tapu dairesinden ya da ilçe binasından arazi tapusu almalısın.') : Tr('Yeterli paran yok.'),
              fn: () => { if (G.homeStart(tx, ty, k, legal)) this.closeAll(); } });
          }
        }
        return it;
      },
    });
    return m;
  },
  /* Tabeladan: yapının durumu, çalışma ve ekler */
  openHome(h) {
    const P = G.player;
    this.menu({
      title: G.homeName(h), cls: 'small', side: (it) => it.side || '',
      sub: () => Tr`Cüzdan: ${fmtMoney(P.money)} · ${G.timeStr()}`,
      build: () => {
        const it = [], job = G.homeJob(h);
        const st = h.legal ? Tr('Tapulu') : h.sealed ? `<span class="bad">${Tr('Kaçak · mühürlü')}</span>` : h.notice ? `<span class="bad">${Tr`Kaçak · ihbar edildi, ${Math.max(0, h.notice - G.day)} gün içinde tapuya bağla`}</span>` : Tr('Kaçak (tapusuz)');
        const adds = h.addons.map(a => `${HOME_ADDONS[a.k].n}${a.done ? '' : ` (%${G.homePct(a)})`}`).join(', ') || Tr('yok');
        it.push({ html: `<div class="biz-card"><div><b>${Tr`Durum:`}</b> ${st}</div><div><b>${Tr`İnşaat:`}</b> ${h.done ? Tr('tamamlandı') : `%${G.homePct(h)} · ${Tr`${Math.max(0, Math.ceil(h.need - h.work))} gün kaldı`}`}</div><div><b>${Tr`Ekler:`}</b> ${adds}</div></div>` });
        if (job && !h.sealed) it.push({ icon: '🔨', label: Tr('Şantiyede Çalış (2 saat)'), right: `%${G.homePct(job)}`, fn: () => { G.homeWork(h); } });
        if (!h.legal) it.push({ icon: '📜', label: Tr('Tapuya bağlamak için tapu dairesine ya da ilçe binasına git'), right: fmtMoney(G.homeLegalPrice(h)), disabled: true, why: '' });
        if (h.done && !h.sealed) {
          it.push({ header: Tr('Ekler') });
          for (const k of Object.keys(HOME_ADDONS)) {
            if (h.addons.some(a => a.k === k)) continue;
            const A = HOME_ADDONS[k];
            it.push({ icon: '🔨', label: Tr`${A.n} Kur`, right: fmtMoney(A.p), disabled: P.money < A.p, why: Tr('Yeterli paran yok.'),
              side: `<div class="ps-t">${A.n}</div><div class="ps-d">${A.d}</div><div class="ps-e">${Tr`İnşaat: ${A.days} gün`}</div>`, fn: () => { G.homeAddon(h, k); } });
          }
        }
        return it;
      },
    });
  },
});
