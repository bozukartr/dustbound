'use strict';
/* ==========================================================
   FRONTIER'S END — görünür kasaba gelişimi (G nesnesine eklenir)
   Kasabaların gelişimi (js/develop.js) her yıl dönümünde kasabaya
   yansır:
   - Yeni binalar: kasaba büyüdükçe sokağa toprak patikayla bağlanan
     boş yerlere evler ve dükkânlar gelir (her üç binadan biri dükkân).
     Mevcut binalar yerinden oynamaz, kimsenin kapısı ve yolu kapanmaz.
   - Cepheler: büyüyen kasabanın binaları yıllar içinde boyanır, şehirde
     tuğla ve taşa döner; gerileyen kasabada boya solar, tahta yıpranır.
     Yalnız dış görünüş değişir, iç mekân aynı kalır.
   - Sokaklar: toprak → çakıl → arnavut kaldırımı (taş kaldırım ve
     bordürle) → asfalt (Asfalt döneminde büyük şehirde, Modern Kasaba
     döneminde şehirlerde). Yeni gaz lambaları dikilir.
   - Nüfus basamakla artar; yeni dükkânlara esnaf, yeni evlere aileler
     yerleşir. Eski sakinler aynı kalır.
   - Gerileme: önce evler ve lüks dükkânlar, sonra temel dükkânlar tahta
     perdeyle kapanır; esnaf ve aileler gider. Hayalet kasabada her yer
     kapanır, sokak lambaları söner, birkaç kişi kalır. Canlanınca açılır.
   - Görünmeden: kasaba oyuncunun görüş alanındaysa değişiklik bekler;
     uykuda, beklerken, yolculukta ya da oyuncu uzaklaşınca yapılır.
   - Oyuncunun işletmelerine, kiraladığı odaya, içinde bulunduğu binaya
     ve etkin hikâyenin binalarına (hikâyenin kasabası dahil) dokunulmaz.
   - Kayıt: yeni binalar ve lambalar sırasıyla, somut konumlarıyla
     yazılır (yüklemede aynen uygulanır: kod değişse de kasaba aynı);
     cepheler, tahta perdeler ve sokak düzeyi son hâlleriyle. Oyuncunun
     ve kasabaların sonradan kurulan binaları kayıttaki numaralarıyla
     sırayla dikilir: bina numaraları kayıttan kayda aynı kalır.
   ========================================================== */

const DEV_POP = [12, 22, 38, 56, 80];   // basamağa göre sakin sayısı (başlangıç basamağında küçük/orta/büyük kasabanınki)
const DEV_POP_GHOST = 3;
const DEV_BPT = { s: 5, m: 6, l: 5 };     // basamak başına yeni bina
const DEV_BMAX = { s: 16, m: 18, l: 12 }; // kasabaya en çok bu kadar yeni bina
const DEV_LPT = { s: 3, m: 4, l: 5 };     // basamak başına yeni sokak lambası
const DEV_STREET = [T.ROAD, T.GRAVEL, T.COBBLE, T.ASPHALT];   // sokak düzeyine göre yüzey
/* Basamağa göre gelebilecek dükkânlar (kasabaya göre karışık sırayla; kasabada olmayan önce) */
const DEV_SHOPS = [
  [],
  ['general', 'saloon', 'butcher', 'stable', 'doctor', 'smith'],
  ['bakery', 'barber', 'tailor', 'gunsmith', 'post', 'laundry', 'pharmacy'],
  ['bank', 'gambling', 'brewery', 'land', 'warehouse', 'county'],
  ['general', 'saloon', 'bakery', 'tailor', 'pharmacy', 'barber'],
];
/* Kapanma sırası: önce evler ve lüks, sonra temel dükkânlar; 5: yalnız hayalet kasabada. Listede olmayan kapanmaz
   (istasyon, malikane, kulüp, pazar) */
const DEV_SHUT = {
  house: 0, gambling: 1, tailor: 1, barber: 1, pharmacy: 1, laundry: 1, bakery: 1, brewery: 1, bank: 1, land: 1, county: 1, warehouse: 1, gunsmith: 1, fence: 1,
  hotel: 2, smith: 2, butcher: 2, mill: 2, cantina: 3, doctor: 3, post: 3, stable: 3, general: 4, saloon: 4, sheriff: 5, church: 5, mine: 5, lumber: 5, docks: 5, ranch: 5,
};
const DEV_HITCH = new Set(['saloon', 'general', 'sheriff', 'hotel', 'cantina', 'gambling', 'warehouse']);
const DEV_GROUND = new Set([T.TOWN, T.GRASS, T.DRY, T.DESERT, T.SAND, T.SNOW, T.ROCK, T.REDROCK, T.FOREST]);   // doğal zemin (patika ve kaldırım olur)
const devVeg = (o) => (o >= O.PINE && o <= O.APPLE) || (o >= O.BERRY && o <= O.WFLOWER);   // bina yerinden temizlenen bitki ve taş

const DevWorldSystems = {
  /* ---------------- sorgular ---------------- */
  /* Kasabanın başlangıçtaki gelişmişliği (basamak + ilerleme) */
  devV0(t) { return this.devStartTier(t) + 0.2 + hash2(this.seed, this.devIdx(t), 3) * 0.4; },
  devVit(S) { return S.ghost ? -1 : S.tier + Math.min(S.prog, 0.999); },
  /* Bina anahtarı: üretilmiş binada numarası, gelişimle gelen binada kalıcı anahtarı */
  bKey(b) { return b.dkey !== undefined ? b.dkey : b.id; },
  bByKey(k) {
    const W = this.world;
    if (typeof k === 'string' && k[0] === 'd') { const M = this._devB || (this._devB = new Map()); let b = M.get(k); if (!b) { b = W.buildings.find(q => q.dkey === k) || null; if (b) M.set(k, b); } return b; }
    return W.buildings[+k] || null;
  },
  /* Oyuncunun ya da hikâyenin binası: gelişim dokunmaz */
  devMine(b) { return b.lot !== undefined || b.home !== undefined || !!b.tier || b.prop !== undefined; },
  devProtected(b) {
    if (this.devMine(b) || this.bizOf(b)) return true;
    if (this.hotelRent && this.hotelRent.b === b.id && this.clock < this.hotelRent.until) return true;
    const P = this.player;
    if (P && this.world.buildingAtPx(P.x, P.y) === b) return true;   // oyuncu içerideyken (beklerken, uyurken) kapanmaz
    const S = this.story;
    if (S && S.on && !S.done) {
      if (b.town === S.town || b.town === S.dest) return true;
      for (const k of ['store', 'office', 'gallery', 'hotel', 'bank']) if (S[k] === b.id) return true;
    }
    return false;
  },
  /* Etkin hikâyenin kasabası (ya da gideceği kasaba): oraya yeni bina dikilmez (hikâye bitince açık kalan büyüme yetişir) */
  devStoryTown(t) { const S = this.story; return !!(S && S.on && !S.done && (t.id === S.town || t.id === S.dest)); },
  /* Kasabanın sakin sayısı: basamağa göre; boşalan her ev iki kişi eksiltir, hayalet kasabada birkaç kişi */
  devPop(t) {
    const S = this.devOf(t);
    if (!S) return TOWN_POP[t.sz] || 30;
    if (S.ghost) return DEV_POP_GHOST;
    let n = S.tier === this.devStartTier(t) ? TOWN_POP[t.sz] || DEV_POP[S.tier] : DEV_POP[S.tier];
    for (const b of t.buildings) if (b.shut && b.type === 'house') n -= 2;
    return Math.max(DEV_POP_GHOST + 2, n);
  },
  /* Kasabanın sokak düzeyi (0 toprak, 1 çakıl, 2 arnavut kaldırımı, 3 asfalt) */
  devStreetLv(t) { const D = this.dev, v = D && D.st && D.st[t.id]; return v !== undefined ? v : t.modern ? 2 : 0; },
  devBuilt(t) { return t.buildings.filter(b => b.dkey !== undefined).length; },
  devShutN(t) { return t.buildings.filter(b => b.shut).length; },
  /* Kasabanın içi (üretimdeki gürültülü elips; ızgara planlı şehirde dikdörtgen) */
  devInside(t) {
    if (t._din) return t._din;
    if (t.plan === 'grid') return (t._din = (x, y, m = 0) => x >= t.x - m && x < t.x + t.w + m && y >= t.y - m && y < t.y + t.h + m);
    const nz = new Noise(this.world.seed + 911), cx = t.cx / TS, cy = t.cy / TS;
    return (t._din = (x, y, m = 0) => { const dx = (x - cx) / (t.rx + m), dy = (y - cy) / (t.ry + m); return dx * dx + dy * dy + (nz.v(x * 0.07, y * 0.07) - 0.5) * 0.4 < 1; });
  },

  /* ---------------- hazırlık: üretilmiş dünyadan kasabaların sokakları ---------------- */
  /* Dünya kurulur kurulmaz (oyuncunun ve gelişimin değişikliklerinden önce): sokak karoları (özgün yüzeyleriyle) ve
     kaldırım olabilecek karolar (sokağa bitişik doğal zemin; arsaların çevresi hariç). Şehirde (kaldırımları hazır)
     bunlar yalnız lamba yeri: taşıt yoluna bakan kaldırım taşları. */
  devPrep() {
    const W = this.world;
    this._devB = null;
    for (const t of W.towns) {
      t._din = null;
      const x0 = Math.max(0, t.x - 3), y0 = Math.max(0, t.y - 3), x1 = Math.min(WW - 1, t.x + t.w + 3), y1 = Math.min(WH - 1, t.y + t.h + 3);
      const st = [], so = [], isSt = new Set(), nearLot = (x, y) => (t.lots || []).some(L => x >= L.x - 2 && x <= L.x + L.w + 1 && y >= L.y - 2 && y <= L.y + L.h + 2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * WW + x, tt = W.tile[i];
        if ((tt === T.ROAD || tt === T.COBBLE) && (W.flags[i] & 4) && !(W.flags[i] & 2)) { st.push(i); so.push(tt); isSt.add(i); }
      }
      const sw = new Set();
      for (const i of st) for (const d of [1, -1, WW, -WW]) {
        const j = i + d, f = W.flags[j];
        if (isSt.has(j) || sw.has(j) || (f & 8) || !(f & 4) || (f & 2) || !(t.modern ? W.tile[j] === T.PAVE : DEV_GROUND.has(W.tile[j])) || nearLot(j % WW, (j / WW) | 0)) continue;
        sw.add(j);
      }
      t._dv = { st: Int32Array.from(st), so: Uint8Array.from(so), sw: Int32Array.from([...sw].sort((a, b) => a - b)) };
    }
  },

  /* ---------------- yıl dönümü ---------------- */
  /* Çekirdeğin bir yılı bitince (js/develop.js devStep): kasabanın o yılki görünür gelişimi sıraya girer */
  devPhysQueue(t, y, S) { this.dev.pend.push([t.id, y, { tier: S.tier, prog: S.prog, ghost: S.ghost, pk: S.pk }]); },
  /* Kasaba oyuncunun görüş alanında mı (dürbünle bakarken daha geniş) */
  devSeen(t) {
    if (typeof UI !== 'undefined' && UI.state === 'fade') return false;
    if (this.state !== 'play' || !this.player) return false;
    const C = this.cam || this.player, m = Math.max(this.vw || 900, this.vh || 600) * (this.binoc ? 2 : 1) + 160;
    const x0 = t.x * TS, y0 = t.y * TS, x1 = (t.x + t.w) * TS, y1 = (t.y + t.h) * TS;
    return C.x > x0 - m && C.x < x1 + m && C.y > y0 - m && C.y < y1 + m;
  },
  /* Bekleyen yılları uygula: görünmeyen kasabalarınkini sırayla (aynı kasabanın yılları sırasını korur). force: hepsi
     (ekran kararmışken, yüklemede). budget: en çok bu kadar kasaba-yılı (oyun sırasında kareye yayılır) */
  devFlush(force, budget = Infinity) {
    const D = this.dev;
    if (!D || !D.pend || !D.pend.length || !this.world) return 0;
    const wait = new Set();
    let n = 0;
    for (let i = 0; i < D.pend.length && n < budget;) {
      const [id, y, s] = D.pend[i], t = this.world.towns.find(q => q.id === id);
      if (!t) { D.pend.splice(i, 1); continue; }
      if (wait.has(id) || (!force && this.devSeen(t))) { wait.add(id); i++; continue; }
      D.pend.splice(i, 1);
      this.devTownYear(t, y, s);
      n++;
    }
    return n;
  },
  /* Oyun sırasında yarım saniyede bir: görüş alanından çıkan kasabanın bekleyen yılı (bir seferde bir kasaba-yılı) */
  devTick() { if (this.dev && this.dev.pend && this.dev.pend.length) this.devFlush(false, 1); },

  /* Bir kasabanın bir yılı. s: o yılın durumu { tier, prog, ghost, pk }. catchup: eski kaydı yetiştirme (sınırsız adım) */
  devTownYear(t, y, s, catchup) {
    const D = this.dev, start = this.devStartTier(t), v = s.ghost ? -1 : s.tier + Math.min(s.prog, 0.999);
    const idx = this.devIdx(t), roll = (k, q) => hash2((this.seed ^ (idx * 7919)) | 0, y * 4099 + k, q);
    const changed = new Set(), quiet = !!catchup;
    let area = false;
    // ---- yeni binalar: kasabanın ulaştığı en yüksek gelişmişliğe göre (yıkılmaz; gerilerken boşalır)
    const want = s.ghost || this.devStoryTown(t) ? 0 : Math.min(DEV_BMAX[t.sz] || 12, Math.floor(Math.max(0, s.pk - this.devV0(t)) * (DEV_BPT[t.sz] || 5)));
    let have = this.devBuilt(t);
    for (let k = 0; have < want && k < (catchup ? 40 : 2); k++) {
      const b = this.devNewBuilding(t, y, have, s, quiet);
      if (!b) break;
      changed.add(b); have++; area = true;
    }
    // ---- tahta perde: zirveden düştükçe binalar boşalır, toparlanınca yeniden açılır
    const cl = this.devClosable(t, s.ghost), c = s.ghost ? 1 : clamp((s.pk - v) * 0.4, 0, 0.8), nShut = Math.round(c * cl.length);
    cl.forEach((b, k) => {
      const sh = k < nShut;
      if (!!b.shut === sh) return;
      this.devSetShut(b, sh);
      changed.add(b);
      if (b.type !== 'house') this.devLog(y, t, sh ? 'shut' : 'reopen', b.type, quiet);
    });
    // ---- cepheler: büyüyen kasabada boya, şehirde tuğla ve taş; gerileyende boya solar
    for (const b of t.buildings) {
      if (!this.devFaceOk(t, b)) continue;
      const cur = b.face === undefined ? 1 : b.face, r = roll(this.devKeyNum(b), 71);
      let nf = cur;
      if (s.ghost) { if (cur > 0 && cur < 3 && r < (catchup ? 1 : 0.35)) nf = catchup ? 0 : cur - 1; }
      else if (s.tier > start) { const tg = this.devFaceTarget(s.tier, b); if (cur < tg && (catchup || r < 0.25)) nf = catchup ? tg : cur + 1; }
      else if (s.tier < start || s.pk - v > 0.6) { if (cur === 2 && r < 0.15) nf = 1; else if (cur === 1 && s.tier === 0 && r < 0.2) nf = 0; }
      if (nf !== cur) { this.devSetFace(b, nf); changed.add(b); }
    }
    // ---- sokaklar: çakıl, arnavut kaldırımı (kaldırımla), asfalt (dönemine gelince)
    const lv = this.devStreetLv(t);
    let lt = s.tier >= 3 ? 2 : s.tier >= 2 ? 1 : 0;
    if ((y >= 1920 && s.tier >= 4) || (y >= 1935 && s.tier >= 3)) lt = 3;
    if (!s.ghost && lt > lv) { D.st[t.id] = catchup ? lt : lv + 1; this.devStreet(t, D.st[t.id]); area = true; }
    // ---- sokak lambaları
    const nl = D.lamps[t.id] || 0, lw = s.ghost ? 0 : Math.max(0, s.tier - start) * (DEV_LPT[t.sz] || 3);
    if (nl < lw) {
      const L = this.devLampSpots(t, Math.min(lw - nl, catchup ? 40 : 3));
      if (L.length) { const op = ['l', t.id, L]; D.ops.push(op); this.devLampsApply(op); D.lamps[t.id] = nl + L.length; area = true; }
    }
    // ---- hayalet kasabada lambalar söner
    if (this.devLights(t, s.ghost)) area = true;
    if (area || changed.size) this.devRefresh(t, changed);
  },

  /* ---------------- yeni bina ---------------- */
  /* Kasabanın k. yeni binası: üç binadan biri dükkân (kasabada olmayan, basamağın izin verdiği), öbürleri ev */
  devNewType(t, k, s) {
    if (k % 3 !== 1) return 'house';
    const have = new Set(t.buildings.filter(b => !b.shut).map(b => b.type)), pool = [];
    for (let tr = 1; tr <= Math.min(s.tier, 3); tr++) pool.push(...DEV_SHOPS[tr]);
    const R = new RNG(Math.floor(hash2(this.seed, this.devIdx(t), 313) * 4294967296));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    for (let ty of pool) {
      if (ty === 'saloon' && TOWN_GROWTH[t.id] === 'border') ty = 'cantina';
      if (!have.has(ty)) return ty;
    }
    if (s.tier >= 4) return DEV_SHOPS[4][Math.floor(k / 3) % DEV_SHOPS[4].length];
    return 'house';
  },
  devNewBuilding(t, y, k, s, quiet) {
    const P = this.player, avoid = !quiet && P && this.state === 'play' ? { x: P.x >> 4, y: P.y >> 4 } : null;
    let type = this.devNewType(t, k, s), spot = this.devSpot(t, type, avoid);
    if (!spot && type !== 'house') { type = 'house'; spot = this.devSpot(t, type, avoid); }
    if (!spot) return null;
    const D = this.dev, key = 'd' + (D.nk++), def = BUILDINGS[type], W = this.world;
    // kapı yanında bağlama direği, yanda fıçı ya da sandık (boş yerlere)
    const decor = [], free = (x, y) => { const i = y * WW + x; return W.inb(x, y) && !W.obj[i] && !(W.flags[i] & 8) && !isStoneT(W.tile[i]) && W.tile[i] !== T.ROAD && W.tile[i] !== T.PLANK && !spot.path.includes(i) && !decor.some(d => d[0] === i); };
    const h = hash2(spot.x, spot.y, 17), L = spot.x - 1, Rt = spot.x + def.w, side = h < 0.5 ? [L, Rt] : [Rt, L];
    if (DEV_HITCH.has(type)) for (const x of side) if (free(x, spot.y + def.h)) { decor.push([(spot.y + def.h) * WW + x, O.HITCH]); break; }
    if (hash2(spot.x, spot.y, 18) < 0.55) { const x = side[1]; if (free(x, spot.y + def.h - 2)) decor.push([(spot.y + def.h - 2) * WW + x, h > 0.75 ? O.CRATE : O.BARREL]); }
    const face = s.tier > this.devStartTier(t) ? this.devFaceTarget(s.tier, { type, dkey: key }) : 1;
    const op = ['b', t.id, type, spot.x, spot.y, key, W.buildings.length, spot.path, decor, face];
    D.ops.push(op);
    const b = this.devBuild(op, false);
    if (type !== 'house') this.devLog(y, t, 'open', type, quiet);
    return b;
  },
  /* Kayıttaki (ya da yeni) bina kaydını dünyaya uygula. replay: yüklemede (yenileme ve tahliye sonra toplu) */
  devBuild(op, replay) {
    const [, tid, type, x, y, key, , path, decor, face] = op, W = this.world, t = W.towns.find(q => q.id === tid), def = BUILDINGS[type];
    if (!t || !def) return null;
    const w = def.w, h = def.h;
    // yer: bina altı düz toprak, çevresindeki bitki ve taş temizlenir
    for (let yy = y - 1; yy <= y + h + 1; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (!W.inb(xx, yy)) continue;
      const i = yy * WW + xx;
      if (W.flags[i] & 8) continue;
      if (devVeg(W.obj[i])) W.obj[i] = 0;
      if (yy >= y && yy < y + h && xx >= x && xx < x + w) W.tile[i] = T.TOWN;
      W.flags[i] |= 1 | 4;
    }
    const b = W.addBuilding(type, x, y, t, undefined, { dkey: key });
    t.buildings.push(b);
    if (face !== undefined && face !== 1) b.face = face;
    if (this._devB) this._devB.set(key, b);
    for (const i of path) {
      if (W.flags[i] & 8) continue;
      if (DEV_GROUND.has(W.tile[i])) W.tile[i] = T.TOWN;
      if (devVeg(W.obj[i])) W.obj[i] = 0;
      W.flags[i] |= 1 | 4;
    }
    for (const [i, o] of decor) {
      if (W.obj[i] || (W.flags[i] & 8)) continue;
      W.obj[i] = o;
      if (o === O.HITCH) t.hitch.push({ x: (i % WW) * TS + 8, y: ((i / WW) | 0) * TS + 14 });
    }
    if (!replay) {
      // sokak taş döşeliyse veranda da taş kaldırım
      if (this.devStreetLv(t) >= 2 && !t.modern) for (let xx = x; xx < x + w; xx++) { const i = (y + h) * WW + xx; if (!(W.flags[i] & 8) && W.tile[i] === T.PLANK) W.tile[i] = T.PAVE; }
      this.devEvict(b);
    }
    return b;
  },
  /* Yeni binanın yerindeki varlıklar kapının önüne çıkar (kasaba sakini silinir, yeniden doğar) */
  devEvict(b) {
    const x0 = (b.x - 1) * TS, y0 = (b.y - 1) * TS, x1 = (b.x + b.w + 1) * TS, y1 = (b.y + b.h) * TS;
    for (const e of this.ents) {
      if (e.remove || e === this.player || e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
      if (e.kind === 'npc' && e.res && !e.dead) { e.remove = true; continue; }
      e.x = b.door.x + rnd(-6, 6); e.y = b.door.y + 14 + rnd(0, 6);
      if (e.bx !== undefined) { e.bx = e.x; e.by = e.y; }
    }
  },
  /* Kasabada type türünde bir bina için yer: kapısı sokağa (en çok 14 karoluk) patikayla bağlanan, kimsenin kapısını ve
     yolunu kapatmayan en iyi boş yer. Organik kasabada bina sokaktan en az bir karo geride durur; ızgara planlı şehirde
     cephe hizası kaldırımdır (veranda kaldırımın üstünde). Döner: { x, y, path: [karo dizini...] } ya da null.
     avoid: bu karonun çevresinde dikilmez (oyuncu) */
  devSpot(t, type, avoid) {
    const W = this.world, def = BUILDINGS[type], bw = def.w, bh = def.h, inside = this.devInside(t), grid = t.plan === 'grid';
    const gx0 = t.x - 3, gy0 = t.y - 3, GW = t.w + 6, GH = t.h + 8, N = GW * GH;
    // 0 boş, 1 yol kenarı (yürünür, dikilmez), 2 dolu, 3 taşıt yolu, 4 ayrılmış (yürünür, dikilmez), 5 kaldırım
    const occ = new Uint8Array(N), at = (x, y) => (y - gy0) * GW + (x - gx0), inG = (x, y) => x >= gx0 && y >= gy0 && x < gx0 + GW && y < gy0 + GH;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const wx = gx0 + x, wy = gy0 + y, k = y * GW + x;
      if (!W.inb(wx, wy)) { occ[k] = 2; continue; }
      const i = wy * WW + wx, tt = W.tile[i], f = W.flags[i], o = W.obj[i];
      if (f & 8) occ[k] = 2;
      else if (tt === T.PAVE) occ[k] = o && !devVeg(o) && o !== O.LAMP ? 2 : 5;
      else if (tt === T.ROAD || isStoneT(tt) || tt === T.BRIDGE) occ[k] = 3;
      else if ((f & 2) || tt === T.PLANK || tt === T.FARM || isWaterT(tt) || isCliffT(tt) || tt === T.SWAMP || tt === T.MUD) occ[k] = 2;
      else if (o && !devVeg(o)) occ[k] = 2;
    }
    for (const L of t.lots || []) for (let y = L.y - 2; y <= L.y + L.h + 2; y++) for (let x = L.x - 2; x <= L.x + L.w + 1; x++) if (inG(x, y)) occ[at(x, y)] = 2;
    // kapıların önü açık kalır
    for (const b of t.buildings) { const dx = b.doorI % WW; for (let y = b.y + b.h; y <= b.y + b.h + 2; y++) for (let x = dx - 1; x <= dx + 1; x++) if (inG(x, y) && occ[at(x, y)] === 0) occ[at(x, y)] = 4; }
    if (avoid) for (let y = avoid.y - 9; y <= avoid.y + 9; y++) for (let x = avoid.x - 9; x <= avoid.x + 9; x++) if (inG(x, y) && occ[at(x, y)] === 0) occ[at(x, y)] = 4;
    for (let k = 0; k < N; k++) {
      if (occ[k] !== 0) continue;
      const x = k % GW, y = (k / GW) | 0;
      for (let dy = -1; dy <= 1 && occ[k] === 0; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && (occ[yy * GW + xx] === 3 || occ[yy * GW + xx] === 5)) { occ[k] = 1; break; } }
    }
    const walk = (k) => occ[k] === 0 || occ[k] === 1 || occ[k] === 4 || occ[k] === 5, road = (k) => occ[k] === 3 || occ[k] === 5;
    // sokağa uzaklık (çok kaynaklı BFS); block verilirse o karolardan geçilmez
    const reach = (block) => {
      const dd = new Int16Array(N).fill(-1), q = new Int32Array(N);
      let qn = 0;
      for (let k = 0; k < N; k++) if (road(k)) { dd[k] = 0; q[qn++] = k; }
      const go = (c, n) => { if (dd[n] < 0 && walk(n) && !(block && block(n))) { dd[n] = dd[c] + 1; q[qn++] = n; } };
      for (let qi = 0; qi < qn; qi++) {
        const c = q[qi], x = c % GW;
        if (x > 0) go(c, c - 1);
        if (x < GW - 1) go(c, c + 1);
        if (c >= GW) go(c, c - GW);
        if (c + GW < N) go(c, c + GW);
      }
      return dd;
    };
    const D0 = reach(null);
    const doorsOk = (dd) => t.buildings.every(b => { const fx = b.doorI % WW, fy = b.y + b.h + 1; if (!inG(fx, fy)) return true; const k = at(fx, fy); return D0[k] < 0 || dd[k] >= 0 || road(k); });
    // dolu karo sayıları (önek toplamı): ayak izi ve çevresi boş (şehirde kaldırım kenarı da olur), veranda sırası dolu ya da
    // taşıt yolu değil (organik kasabada kaldırım da değil)
    const SA = new Int32Array((GW + 1) * (GH + 1)), SB = new Int32Array((GW + 1) * (GH + 1));
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const k = y * GW + x, o = (y + 1) * (GW + 1) + x + 1, v = occ[k];
      SA[o] = (v !== 0 && !(grid && v === 1) ? 1 : 0) + SA[o - 1] + SA[o - GW - 1] - SA[o - GW - 2];
      SB[o] = (v === 2 || v === 3 || v === 4 || (!grid && v === 5) ? 1 : 0) + SB[o - 1] + SB[o - GW - 1] - SB[o - GW - 2];
    }
    const sum = (S, x0, y0, x1, y1) => S[(y1 + 1) * (GW + 1) + x1 + 1] - S[y0 * (GW + 1) + x1 + 1] - S[(y1 + 1) * (GW + 1) + x0] + S[y0 * (GW + 1) + x0];
    const px = t.plaza ? t.plaza.x : t.cx / TS, py = t.plaza ? t.plaza.y : t.cy / TS, cand = [];
    for (let y = 1; y + bh + 2 < GH; y++) for (let x = 1; x + bw < GW - 1; x++) {
      if (sum(SA, x - 1, y - 1, x + bw, y + bh - 1)) continue;                    // ayak izi ve bir karo çevresi
      if (sum(SB, x - 1, y + bh, x + bw, y + bh)) continue;                       // veranda sırası
      const wx = gx0 + x, wy = gy0 + y;
      if (!inside(wx - 1, wy - 1, 1) || !inside(wx + bw, wy - 1, 1) || !inside(wx - 1, wy + bh, 1) || !inside(wx + bw, wy + bh, 1)) continue;
      const fk = (y + bh + 1) * GW + x + (bw >> 1);
      if (fk >= N || !walk(fk) && !road(fk)) continue;
      const dd = road(fk) ? 0 : D0[fk];
      if (dd < 0 || dd > 14) continue;
      let blocked = false;
      for (let xx = x - 1; xx <= x + bw && !blocked; xx++) { const k = (y + bh + 1) * GW + xx; if (occ[k] === 2) blocked = true; }
      if (blocked) continue;
      const sc = dd * 2.2 + dist(wx + bw / 2, wy + bh / 2, px, py) / Math.max(12, t.rx || 40) * 14 + hash2(wx, wy, 29) * 3;
      cand.push([sc, x, y]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (let n = 0; n < Math.min(cand.length, 10); n++) {
      const [, x, y] = cand[n];
      const inFoot = (k) => { const cx = k % GW, cy = (k / GW) | 0; return cx >= x - 1 && cx <= x + bw && cy >= y - 1 && cy < y + bh; };
      const dd = reach(inFoot);
      if (!doorsOk(dd)) continue;
      // kapıdan sokağa patika (uzaklık haritasında yokuş aşağı)
      let k = (y + bh + 1) * GW + x + (bw >> 1);
      if (!road(k) && dd[k] < 0) continue;
      const path = [];
      for (let s = 0; s < 40 && !road(k) && dd[k] > 0; s++) {
        path.push((gy0 + ((k / GW) | 0)) * WW + gx0 + (k % GW));
        const kx = k % GW, step = [k + GW < N ? k + GW : -1, kx > 0 ? k - 1 : -1, kx < GW - 1 ? k + 1 : -1, k >= GW ? k - GW : -1];
        let nk = -1;
        for (const m of step) if (m >= 0 && dd[m] === dd[k] - 1) { nk = m; break; }
        if (nk < 0) break;
        k = nk;
      }
      return { x: gx0 + x, y: gy0 + y, path };
    }
    return null;
  },

  /* ---------------- cephe ve tahta perde ---------------- */
  devKeyNum(b) { return b.dkey !== undefined ? 100000 + (+b.dkey.slice(1)) : b.id; },
  /* Cephesi gelişimle değişebilen bina: kasabanın kendi binası (zengin şehrin binaları zaten tuğla ve taş) */
  devFaceOk(t, b) { return !t.modern && !this.devMine(b) && !b.def.ruin && b.type !== 'market'; },
  /* Basamağa göre hedef cephe: 1 düz tahta, 2 boyalı (pervazlı), 3 tuğla ya da taş */
  devFaceTarget(tier, b) {
    const u = hash2(this.seed, this.devKeyNum(b), 71), cap = MODERN_SKIP.has(b.type) ? 2 : 3;
    const f = tier >= 4 ? (u < 0.75 ? 3 : 2) : tier >= 3 ? (u < 0.4 ? 3 : u < 0.85 ? 2 : 1) : tier >= 2 ? (u < 0.55 ? 2 : 1) : 1;
    return Math.min(cap, f);
  },
  devSetFace(b, f) {
    this.dev.face[this.bKey(b)] = f;
    if (f === 1) delete b.face; else b.face = f;
  },
  devSetShut(b, on) {
    const D = this.dev, k = this.bKey(b);
    if (on) { b.shut = true; D.shut[k] = 1; } else { delete b.shut; delete D.shut[k]; }
    // tezgâhtaki esnaf ve saloon müşterileri gider
    if (on) for (const e of [b.staffNpc, b.pianist, ...(b.patrons || [])]) if (e && !e.dead) e.remove = true;
    if (on) { b.staffNpc = null; b.pianist = null; b.patrons = []; }
  },
  /* Kapanabilecek binalar, kapanma sırasıyla (önce evler ve lüks; aynı sırada önce en yeni) */
  devClosable(t, ghost) {
    const L = t.buildings.filter(b => DEV_SHUT[b.type] !== undefined && b.enter && (ghost || DEV_SHUT[b.type] < 5) && !this.devProtected(b));
    return L.map(b => [DEV_SHUT[b.type] * 4 + (b.dkey !== undefined ? 0 : 2) + hash2(this.seed, this.devKeyNum(b), 83), b]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
  },

  /* ---------------- sokaklar ve lambalar ---------------- */
  /* Sokak düzeyini dünyaya uygula: sokak karoları (özgün yüzeyin altına inmez); arnavut kaldırımında sokağa bitişik zemin
     taş kaldırım, kasabanın binalarının verandası taş olur */
  devStreet(t, lv) {
    const W = this.world, K = t._dv;
    if (!K) return;
    for (let k = 0; k < K.st.length; k++) {
      const i = K.st[k];
      if (W.flags[i] & 8) continue;
      W.tile[i] = DEV_STREET[Math.max(lv, K.so[k] === T.COBBLE ? 2 : 0)];
    }
    if (lv < 2 || t.modern) return;
    for (const i of K.sw) if (!(W.flags[i] & 8)) W.tile[i] = T.PAVE;
    for (const b of t.buildings) {
      if (this.devMine(b)) continue;
      for (let x = b.x; x < b.x + b.w; x++) { const i = (b.y + b.h) * WW + x; if (!(W.flags[i] & 8) && W.tile[i] === T.PLANK) W.tile[i] = T.PAVE; }
    }
  },
  /* Yeni lamba yerleri: kaldırım olabilecek karolarda, kapıların önünde değil, öbür lambalardan uzakta */
  devLampSpots(t, n) {
    const W = this.world, K = t._dv, out = [];
    if (!K) return out;
    const lamps = [];
    for (let y = t.y - 2; y < t.y + t.h + 2; y++) for (let x = t.x - 2; x < t.x + t.w + 2; x++) if (W.inb(x, y) && W.obj[y * WW + x] === O.LAMP) lamps.push([x, y]);
    const doors = t.buildings.map(b => [b.doorI % WW, b.y + b.h]);
    const order = [...K.sw].map(i => [hash2(i % WW, (i / WW) | 0, 61), i]).sort((a, b) => a[0] - b[0]);
    for (const [, i] of order) {
      if (out.length >= n) break;
      const x = i % WW, y = (i / WW) | 0;
      if (W.obj[i] || (W.flags[i] & 8) || W.tile[i] === T.PLANK) continue;
      if (doors.some(([dx, dy]) => Math.abs(dx - x) <= 2 && y >= dy - 1 && y <= dy + 3)) continue;
      if (lamps.some(([lx, ly]) => Math.abs(lx - x) < 7 && Math.abs(ly - y) < 7)) continue;
      out.push(i); lamps.push([x, y]);
    }
    return out;
  },
  devLampsApply(op) {
    const W = this.world;
    for (const i of op[2]) {
      if (W.obj[i] || (W.flags[i] & 8)) continue;
      W.obj[i] = O.LAMP;
      W.lights.push({ x: (i % WW) * TS + 8, y: ((i / WW) | 0) * TS + 2, r: 55, type: 'lamp' });
    }
  },
  /* Hayalet kasabada sokak lambaları yanmaz; değişen olduysa true */
  devLights(t, off) {
    let ch = false;
    const x0 = t.x * TS, y0 = t.y * TS, x1 = (t.x + t.w) * TS, y1 = (t.y + t.h) * TS;
    for (const L of this.world.lights) if (L.type === 'lamp' && L.x >= x0 && L.x <= x1 && L.y >= y0 && L.y <= y1 && !!L.off !== off) { if (off) L.off = true; else delete L.off; ch = true; }
    return ch;
  },

  /* ---------------- sakinler ---------------- */
  /* Kasaba sakinlerinin gelişimle değişen kısmı (townlife residents çağırır; list kuruluş günkü sakinler): yeni
     dükkânların esnafı ve basamağa göre ek sakinler (her biri kendi tohumuyla, yeni evlerde); gerileyen kasabada
     kapanan dükkânın esnafı ve en son gelenler gider (yaşlılar ve serseriler en son); boşalan evin sakini açık bir eve
     taşınır. mk(meslek, ek, kimlik) sakini listeye ekler; setR, mk'nin kullanacağı rastgele sayı üretecini verir. */
  devResidents(t, list, mk, bag, setR) {
    if (!this.dev || !this.dev.towns[t.id]) return;
    const sd = (k) => ((this.seed ^ Math.floor(hash2(t.cx | 0, t.cy | 0, 78) * 1e9) ^ Math.imul(k + 1, 2654435761)) >>> 0);
    for (const b of t.buildings) if (b.dkey !== undefined && b.enter && b.staff && b.type !== 'sheriff') { setR(new RNG(sd(100000 + this.devKeyNum(b)))); mk('keeper', { work: b }, t.id + ':' + b.dkey); }
    const N = this.devPop(t), homes = t.buildings.filter(b => b.type === 'house' && !b.shut).sort((a, b) => (b.dkey !== undefined) - (a.dkey !== undefined));
    for (let k = 0; list.length < N && k < 200; k++) { const R = new RNG(sd(k)); setR(R); const r = mk(R.pick(bag), {}, t.id + ':x' + k); if (homes.length) r.home = homes[k % homes.length]; }
    // gidenler: kapanan dükkânın esnafı; sonra sondan başa (yaşlı ve serseri en son)
    for (let i = list.length - 1; i >= 0; i--) if (list[i].work && list[i].work.shut) list.splice(i, 1);
    for (const late of [false, true]) for (let i = list.length - 1; i >= 0 && list.length > N; i--) {
      const r = list[i];
      if (r.occ === 'keeper') continue;
      if (!late && (r.occ === 'elder' || r.occ === 'drifter')) continue;
      list.splice(i, 1);
    }
    for (let i = list.length - 1; i >= 0 && list.length > N; i--) list.splice(i, 1);
    // boşalan evden açık bir eve (yoksa açık bir binaya)
    const open = t.buildings.find(b => !b.shut && b.enter);
    list.forEach((r, i) => { if (r.home && r.home.shut) r.home = homes.length ? homes[i % homes.length] : open || r.home; });
  },

  /* ---------------- yenileme ---------------- */
  devRefresh(t, changed) {
    const W = this.world;
    W.refreshArea(t.x - 3, t.y - 3, t.x + t.w + 3, t.y + t.h + 4);
    for (const b of changed || []) W.buildingDirty(b);
    // sakinler basamağa ve binalara göre yeniden kurulur; kaydı kalmayan sakin (giden) dünyadan çıkar
    t._res = null; t._grid = null;
    if (!this.player) return;
    const list = this.residents(t), keep = new Set(list);
    for (const e of this.ents) if (e.res && e.res.t === t && !keep.has(e.res) && !e.dead) e.remove = true;
  },

  /* ---------------- kayıt ---------------- */
  /* Yüklemede (dünya önbellekten, oyuncunun binaları sırada bekler): bina ve lamba kayıtları sırayla, araya bina
     numarasına göre oyuncunun binaları girer; sonra cepheler, tahta perdeler, sokaklar ve ışıklar son hâlleriyle */
  devPhysLoad(d) {
    const D = this.dev, W = this.world;
    D.ops = (d && d.ops) || []; D.face = (d && d.face) || {}; D.st = (d && d.st) || {}; D.lamps = {}; D.pend = (d && d.pend) || []; D.nk = (d && d.nk) || 0;
    D.shut = {};
    for (const k of (d && d.shut) || []) D.shut[k] = 1;
    for (const op of D.ops) {
      if (op[0] === 'b') {
        this.bqFlush(op[6]);
        const b = this.devBuild(op, true);
        if (b && b.id !== op[6]) console.warn('gelişim binasının numarası kaydınkinden farklı:', op[5], op[6], b.id);
      } else if (op[0] === 'l') { this.devLampsApply(op); D.lamps[op[1]] = (D.lamps[op[1]] || 0) + op[2].length; }
    }
    this.bqFlush();
    for (const k in D.face) { const b = this.bByKey(k); if (b) { if (D.face[k] === 1) delete b.face; else b.face = D.face[k]; } }
    for (const k in D.shut) { const b = this.bByKey(k); if (b) b.shut = true; }
    for (const t of W.towns) {
      const lv = D.st[t.id];
      if (lv !== undefined) this.devStreet(t, lv);
      const S = D.towns[t.id];
      if (S && S.ghost) this.devLights(t, true);
      if (S && S.pk === undefined) S.pk = Math.max(this.devV0(t), this.devVit(S));
      // çarpışma (yeni binalar ve lambalar), harita resmi; sakinler ve yol ızgarası yeniden kurulur
      if (D.ops.some(op => op[1] === t.id) || lv !== undefined) W.refreshArea(t.x - 3, t.y - 3, t.x + t.w + 3, t.y + t.h + 4);
      t._res = null; t._grid = null;
    }
    // görünür gelişimden önceki kayıt: kasabalar bugünkü durumlarına bir kerede getirilir
    if (!d || !d.ops) for (const t of W.towns) { const S = D.towns[t.id]; if (S) this.devTownYear(t, this.dev.y, { tier: S.tier, prog: S.prog, ghost: S.ghost, pk: S.pk }, true); }
    // kayıtta bekleyen yıllar (yükleme ekranında görünmeden)
    this.devFlush(true);
    W.refreshChunks();
    if (D.ops.length) W.buildMapImage(true);
  },
  /* Sonradan dikilen binalar (oyuncunun işletmeleri ve yapıları) yüklemede sıraya girer: kayıttaki numaralarıyla sırayla
     dikilsin diye. Oyun sırasında hemen dikilir. */
  bqAdd(id, fn) { if (this._bq) this._bq.push([id, fn]); else fn(); },
  bqFlush(upto = Infinity) {
    const Q = this._bq;
    if (!Q || !Q.length) return;
    Q.sort((a, b) => a[0] - b[0]);
    while (Q.length && Q[0][0] < upto) Q.shift()[1]();
  },
};
