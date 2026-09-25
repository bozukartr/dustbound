'use strict';
/* ==========================================================
   FRONTIER'S END — kasaba hayatı (G nesnesine eklenir)
   - Her kasabanın kalıcı sakinleri: ad, görünüm, meslek, ev ve
     iş yeri tohumdan her seferinde aynı üretilir.
   - Saate, haftanın gününe ve havaya göre günlük program: işe
     gider, alışveriş yapar, öğlen ve akşam saloona uğrar, pazar
     kiliseye gider, yağmurda içeri girer, gece evine döner.
   - Binaya giren sakin görünmez olur; programı değişince kapıdan
     çıkar. Dükkân sahipleri tezgâhtaki çalışanın kendisidir.
   - Kasaba içinde karo ızgarasında A* ile yol bulma.
   - Sakinler oyuncuyu hatırlar (soygun, saldırı, selam); dükkân
     fiyatı, tanıklık ve selam buna göre değişir.
   - Birbirleriyle konuşurlar (baloncuklar), gazeteci çocuk
     manşet bağırır, lambacı akşam sokak lambalarını dolaşır.
   - Yollarda yük arabaları ve posta arabaları.
   ========================================================== */

/* Meslekler. out: dışarıda görünen iş, away: kasaba dışında çalışır */
const OCCS = {
  keeper:    { n: 'Esnaf' },
  laborer:   { n: 'Hamal', out: 'haul' },
  sweeper:   { n: 'Lambacı', out: 'sweep' },
  newsboy:   { n: 'Gazeteci Çocuk', out: 'news', kid: 1 },
  kid:       { n: 'Çocuk', kid: 1 },
  homemaker: { n: 'Ev Hanımı' },
  drifter:   { n: 'Serseri' },
  elder:     { n: 'Emekli' },
  miner:     { n: 'Madenci', away: 1 },
  farmhand:  { n: 'Çiftlik İşçisi', away: 1 },
  dockhand:  { n: 'Liman İşçisi', away: 1 },
  lumberman: { n: 'Oduncu', away: 1 },
};
/* Dükkân sahiplerinin meslek adı, çalıştığı yere göre */
const KEEPER_N = {
  general: 'Bakkal', saloon: 'Barmen', doctor: 'Doktor', gunsmith: 'Silahçı', butcher: 'Kasap', stable: 'Seyis', hotel: 'Otelci', bank: 'Bankacı',
  station: 'İstasyon Memuru', church: 'Peder', barber: 'Berber', tailor: 'Terzi', fence: 'Kaçakçı', mine: 'Maden Kâtibi', docks: 'Liman Kâtibi', lumber: 'Kereste Ustası',
};
const TOWN_POP = { l: 56, m: 38, s: 22 };
const PUBLIC_B = ['saloon', 'hotel', 'general', 'station', 'church', 'barber'];

/* Sakinlerin kendi aralarındaki konuşmaları: [soru, cevap] */
const CHAT = {
  any: [['Bugün işler nasıl?', 'Ne iyi ne kötü. Şükür.'], ['Duydun mu, trenin tarifesi değişmiş.', 'Hep böyle, kimseye sormazlar.'], ['Kahve on sente çıkmış!', 'Tüccarlar bizi soyuyor.'],
    ['Şerif yine saloonda mı?', 'Nerede olacaktı ki?'], ['Dün gece çakallar uludu.', 'Tavukları içeri almak lazım.'], ['Kızın evleniyormuş, hayırlı olsun.', 'Sağ ol, düğüne beklerim.'],
    ['Madende yeni damar bulmuşlar.', 'Bize bir faydası olmaz.'], ['Doktor bu hafta şehre gitti.', 'Hastalanmamaya bak o zaman.'], ['Posta arabası gecikti yine.', 'Yolda haydut var diyorlar.']],
  rain: [['Bu yağmur hiç durmayacak.', 'Tarlalara iyi gelir.'], ['Sırılsıklam oldum.', 'Saloonda bir viski ısıtır.']],
  hot: [['Kavruluyoruz!', 'Kuyu da azaldı bu sıcakta.']],
  cold: [['Ayaz kemiklerime işliyor.', 'Odun stoğunu doldur, kış uzun.']],
  good: [['Şu yabancıyı gördün mü? İyi biri derler.', 'Geçen gün yaşlı Hattie\'ye yardım etmiş.'], ['{ad} kasabaya hayır getirdi.', 'Keşke herkes onun gibi olsa.']],
  bad: [['Şu gelen... tehlikeli biri.', 'Göz göze gelme, yürü git.'], ['{ad} denen yabancıyı duydun mu?', 'Şşş! Duyacak.']],
};
/* Meslekten gelen selamlar */
const OCC_GREET = {
  laborer: ['Şu sandıklar kendi kendine taşınmıyor.', 'Sırtım ağrıyor ama ekmek parası.'], sweeper: ['Akşam lambaları ben yakarım.', 'Sokaklar temiz olmalı.'],
  newsboy: ['Gazete, bayım? Beş sent!', 'Son haberler!'], homemaker: ['Pazara gidiyorum, un bitti.', 'Çocuklar beni deli edecek.'], drifter: ['Bir viski ısmarlar mısın?', 'Bu kasabada iş yok.'],
  elder: ['Benim zamanımda buralar bomboştu.', 'Gençler hep acele ediyor.'], miner: ['Madenden yeni geldim, toz toprak içindeyim.', 'Yerin altı başka bir dünya.'],
  farmhand: ['Sığırlar bugün huysuzdu.', 'Hasat yakın.'], keeper: ['Dükkâna uğra, taze mal geldi.', 'Veresiye yok, baştan söyleyeyim.'], kid: ['Kovboy musun sen?', 'Tabancanı görebilir miyim?'],
};
const NEWS_SHOUT = ['Ekstra! Ekstra! Posta arabası soyuldu!', 'Son haberler! Demiryolu batıya uzanıyor!', 'Gazete! Beş sent!', 'Okuyun! Madende yeni damar!', 'Ekstra! Şerif yeni yardımcı arıyor!'];
const RES_LINES = {
  friend: ['Ah, {ad}! Seni görmek ne güzel.', 'Hoş geldin dostum.', 'Senin gibi komşular olsun.'],
  hate: ['Uzak dur benden!', 'Sen değil misin o... Git buradan!', 'Seninle konuşacak bir şeyim yok.'],
};

/* ---------------- Yazar kasa: A* yol bulma (kasaba ızgarası) ---------------- */
const TownPath = {
  grid(t) {
    if (t._grid) return t._grid;
    const W = G.world, x0 = t.x - 8, y0 = t.y - 8, w = t.w + 16, h = t.h + 16;
    const pass = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = (x0 + x) * TS + 8, py = (y0 + y) * TS + 8;
      pass[y * w + x] = W.inb(x0 + x, y0 + y) && !W.blocked(px, py, 3.2) && !W.indoorPx(px, py) && !W.isWaterPx(px, py) ? 1 : 0;
    }
    t._grid = { x0, y0, w, h, pass, cache: new Map() };
    return t._grid;
  },
  near(g, x, y) {
    if (x >= 0 && y >= 0 && x < g.w && y < g.h && g.pass[y * g.w + x]) return [x, y];
    for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && g.pass[ny * g.w + nx]) return [nx, ny];
    }
    return null;
  },
  /* px koordinatlarında nokta listesi döner (null: yol yok) */
  find(t, ax, ay, bx, by) {
    const g = this.grid(t);
    const s = this.near(g, (ax >> 4) - g.x0, (ay >> 4) - g.y0), e = this.near(g, (bx >> 4) - g.x0, (by >> 4) - g.y0);
    if (!s || !e) return null;
    const key = s[0] + ',' + s[1] + '>' + e[0] + ',' + e[1];
    if (g.cache.has(key)) { const c = g.cache.get(key); return c && c.map(p => p.slice()).concat([[bx, by]]); }
    const W = g.w, N = g.w * g.h, si = s[1] * W + s[0], ei = e[1] * W + e[0];
    const gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [si]; gs[si] = 0;
    const hf = (i) => { const dx = Math.abs(i % W - e[0]), dy = Math.abs(((i / W) | 0) - e[1]); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    const fs = new Float32Array(N); fs[si] = hf(si);
    let found = false, iter = 0;
    while (open.length && iter++ < 6000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (fs[open[k]] < fs[open[bi]]) bi = k;
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === ei) { found = true; break; }
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= g.h) continue;
        const ni = ny * W + nx;
        if (!g.pass[ni] || closed[ni]) continue;
        if (dx && dy && (!g.pass[cy * W + nx] || !g.pass[ny * W + cx])) continue;   // köşeden kesme
        const ng = gs[cur] + (dx && dy ? 1.41 : 1);
        if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; fs[ni] = ng + hf(ni); open.push(ni); }
      }
    }
    let pts = null;
    if (found) {
      const raw = [];
      for (let i = ei; i !== -1; i = came[i]) raw.push([(g.x0 + i % W) * TS + 8, (g.y0 + ((i / W) | 0)) * TS + 8]);
      raw.reverse();
      // görüş hattı ile sadeleştir
      pts = [];
      let a = 0;
      while (a < raw.length - 1) {
        let b = raw.length - 1;
        while (b > a + 1 && !this.clear(g, raw[a], raw[b])) b--;
        pts.push(raw[b]); a = b;
      }
    }
    if (g.cache.size > 300) g.cache.delete(g.cache.keys().next().value);
    g.cache.set(key, pts);
    return pts && pts.map(p => p.slice()).concat([[bx, by]]);
  },
  clear(g, a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) {
      const x = ((a[0] + (b[0] - a[0]) * i / n) >> 4) - g.x0, y = ((a[1] + (b[1] - a[1]) * i / n) >> 4) - g.y0;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h || !g.pass[y * g.w + x]) return false;
    }
    return true;
  },
};

/* ---------------- Konuşma baloncukları (ekranda, dünya konumuna bağlı) ---------------- */
const Bubbles = {
  list: [],
  add(e, text, dur = 3.2) {
    if (!e || e.remove) return;
    const P = G.player;
    if (dist2(e.x, e.y, P.x, P.y) > 330 * 330) return;
    this.list = this.list.filter(b => { if (b.e === e) { b.el.remove(); return false; } return true; });
    let root = document.getElementById('bubbles');
    if (!root) { root = document.createElement('div'); root.id = 'bubbles'; (document.getElementById('hud') || document.body).appendChild(root); }
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    root.appendChild(el);
    this.list.push({ e, el, t: dur });
  },
  update(dt) {
    if (!this.list.length) return;
    const C = G.cam, r = G.canvas.getBoundingClientRect();
    this.list = this.list.filter(b => {
      b.t -= dt;
      if (b.t <= 0 || b.e.remove || b.e.dead || G.state !== 'play') { b.el.remove(); return false; }
      const k = r.width / G.canvas.width, lift = b.e.child ? 9 : 13;
      b.el.style.left = (r.left + (b.e.x - C.ox) * k) + 'px';
      b.el.style.top = (r.top + (b.e.y - C.oy - lift) * k) + 'px';
      b.el.style.opacity = Math.min(1, b.t * 2).toFixed(2);
      return true;
    });
  },
  clear() { for (const b of this.list) b.el.remove(); this.list = []; },
};

/* ---------------- Yol trafiği: yük arabası ve posta arabası ---------------- */
class Wagon extends Ent {
  constructor(road, i, dir, stage) {
    super(road.pts[i][0], road.pts[i][1]);
    this.kind = 'wagon'; this.path = road.pts; this.pi = i; this.dir = dir; this.stage = !!stage;
    this.r = 6; this.spd = 0; this.max = stage ? 66 : 38; this.look = randomLook('m');
    this.hc = [pick(HORSE_BREEDS.morgan.cols), pick(HORSE_BREEDS.tennessee.cols)];
    this.body = stage ? pick(['#6a1e18', '#1e3a2a', '#2a2a3a']) : pick(['#7a5436', '#6a4a2e']);
    this.name = stage ? Tr('Posta Arabası') : Tr('Yük Arabası');
    this.honkT = 0; this.ang = 0;
  }
  hurt() {}
  /* Yolun sonu bir kasabaysa içeri girer: istasyonun ya da dükkânın önünde durur, sonra geri döner */
  enterTown() {
    const t = G.world.townAt(this.x, this.y, 10);
    if (!t || this.stopT) return false;
    const stop = ['general', 'hotel', 'saloon', 'station'].map(ty => t.buildings.find(b => b.type === ty)).find(Boolean);
    if (!stop) return false;
    const r = TownPath.find(t, this.x, this.y, stop.door.x + 34, stop.door.y + 34);
    if (!r) return false;
    this.stopT = t; this.route = r; this.ri = 0; this.leg = 'in'; this.exitPt = [this.x, this.y];
    return true;
  }
  update(dt) {
    if (this.parkT > 0) {
      this.spd = 0; this.mv = 0; this.parkT -= dt;
      this.ang = turnTo(this.ang, Math.abs(angDiff(this.ang, 0)) < Math.PI / 2 ? 0 : Math.PI, dt * 0.8);   // kapının önünde düzgün hizalanır
      if (this.parkT <= 0) { this.route = TownPath.find(this.stopT, this.x, this.y, this.exitPt[0], this.exitPt[1]) || [this.exitPt.slice()]; this.ri = 0; this.leg = 'out'; }
      return;
    }
    let pt;
    if (this.route) {
      pt = this.route[this.ri];
      if (!pt) {
        this.route = null;
        if (this.leg === 'in') { this.parkT = rnd(25, 50); if (this.stage) Bubbles.add(this, pick([Tr('Posta geldi!'), Tr('Yolcular, inin!')]), 2.5); }
        else this.dir = -this.dir;   // yola geri dön
        return;
      }
    } else pt = this.path[this.pi + this.dir];
    if (!pt) { if (!this.enterTown()) this.remove = true; return; }
    const a = Math.atan2(pt[1] - this.y, pt[0] - this.x);
    this.ang = turnTo(this.ang, a, dt * 3);
    // önünde oyuncu ya da biri varsa yavaşla, dur, seslen
    const P = G.player, fx = this.x + Math.cos(this.ang) * 20, fy = this.y + Math.sin(this.ang) * 20;
    let block = dist2(fx, fy, P.x, P.y) < 16 * 16;
    this.honkT -= dt;
    if (block && this.honkT <= 0) { this.honkT = 5; Bubbles.add(this, pick([Tr('Yoldan çekil!'), Tr('Hey! Çekil önümden!'), Tr('Açılın!')]), 2); }
    const target = block ? 0 : this.max;
    this.spd += clamp(target - this.spd, -80 * dt, 30 * dt);
    this.x += Math.cos(this.ang) * this.spd * dt; this.y += Math.sin(this.ang) * this.spd * dt;
    this.phase += dt * this.spd * 0.15; this.mv = this.spd / 60;
    if (dist2(this.x, this.y, pt[0], pt[1]) < 64) { if (this.route) this.ri++; else this.pi += this.dir; }
    if (this.stage && this.spd > 30 && Math.random() < 0.2) { const t = G.world.tileAtPx(this.x, this.y); if (t === T.DESERT || t === T.DRY || t === T.ROAD || t === T.SAND) G.parts.add('dust', this.x - Math.cos(this.ang) * 12, this.y - Math.sin(this.ang) * 12, rnd(-8, 8), rnd(-8, 8), 0.8, 3); }
  }
  draw(ctx) {
    const c = Math.cos(this.ang), s = Math.sin(this.ang);
    // atlar önde, yan yana
    for (const k of [-1, 1]) Spr.horse(ctx, this.x + c * 17 - s * k * 4.2, this.y + s * 17 + c * k * 4.2, this.ang, { col: this.hc[k < 0 ? 0 : 1], mane: '#1a1410' }, { phase: this.phase + (k > 0 ? 1.5 : 0), mv: this.mv });
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.ang);
    Spr.shadow(ctx, 1, 2, 14, 7, 0.28);
    for (const [wx, wy] of [[-7, -6], [-7, 6], [6, -6], [6, 6]]) { ctx.fillStyle = '#1e140c'; ctx.fillRect(wx - 2.5, wy - 1, 5, 2); }
    ctx.strokeStyle = '#3a2616'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(15, 0); ctx.stroke();   // ok
    if (this.stage) {
      ctx.fillStyle = this.body; ctx.fillRect(-10, -5.5, 19, 11);
      ctx.fillStyle = shadeHex(this.body, 0.2); ctx.fillRect(-10, -5.5, 19, 2);
      ctx.fillStyle = '#c8a040'; ctx.fillRect(-9, -5.5, 1, 11); ctx.fillRect(7, -5.5, 1, 11);
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(-7, -3, 9, 6); ctx.fillStyle = '#8a6a44'; ctx.fillRect(-6, -2, 3, 4); ctx.fillStyle = '#6a2a1a'; ctx.fillRect(-2, -2.4, 3, 4.8);   // tavandaki bagaj
    } else {
      ctx.fillStyle = this.body; ctx.fillRect(-10, -5, 18, 10);
      ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.ellipse(-3, 0, 7.5, 5.6, 0, 0, TAU); ctx.fill();   // branda
      ctx.fillStyle = '#c8bca4'; for (let k = -8; k <= 2; k += 3.5) ctx.fillRect(k, -5.4, 0.8, 10.8);
    }
    ctx.restore();
    // sürücü önde oturur
    Spr.human(ctx, this.x + c * 7, this.y + s * 7, this.ang, this.look, { riding: true });
  }
}

const TownLifeSystems = {
  /* ---------------- sakinler ---------------- */
  residents(t) {
    if (t._res) return t._res;
    const W = this.world;
    const R = new RNG((this.seed ^ (hash2(t.cx | 0, t.cy | 0, 77) * 1e9)) >>> 0);
    const houses = t.buildings.filter(b => b.type === 'house');
    const hotel = t.buildings.find(b => b.type === 'hotel');
    const has = (ty) => t.buildings.find(b => b.type === ty);
    const list = [];
    const mk = (occ, extra = {}) => {
      const o = OCCS[occ];
      const sex = o.kid ? (R.chance(0.5) ? 'm' : 'f') : occ === 'homemaker' ? 'f' : ['miner', 'laborer', 'lumberman', 'dockhand'].includes(occ) ? 'm' : R.chance(0.6) ? 'm' : 'f';
      const look = randomLook(sex, R);
      if (occ === 'elder') { look.hair = '#c8c4bc'; look.beardLen = 0.9; }
      if (o.kid) { look.hat = R.pick(['none', 'none', 'flat']); look.beard = 0; }
      if (occ === 'miner') { look.coat = '#4a4038'; look.hat = 'flat'; }
      const home = houses.length ? houses[list.length % houses.length] : hotel || t.buildings[0];
      const r = { id: t.id + ':' + list.length, t, occ, sex, look, name: R.pick(NAMES[sex]) + ' ' + R.pick(NAMES.last), home, jit: R.range(-0.6, 0.6), soc: R.next(), ent: null, inside: null, until: 0, errands: null, ei: 0 };
      Object.assign(r, extra);
      list.push(r);
      return r;
    };
    for (const b of t.buildings) if (b.enter && b.staff && b.type !== 'sheriff') mk('keeper', { work: b });
    const N = TOWN_POP[t.sz] || 30;
    const bag = ['laborer', 'laborer', 'homemaker', 'homemaker', 'homemaker', 'kid', 'kid', 'kid', 'drifter', 'elder', 'elder', 'farmhand', 'farmhand'];
    if (has('mine') || t.id === 'silverridge') bag.push('miner', 'miner', 'miner');
    if (has('docks')) bag.push('dockhand', 'dockhand');
    if (has('lumber')) bag.push('lumberman', 'lumberman');
    mk('sweeper'); mk('newsboy');
    while (list.length < N) mk(R.pick(bag));
    // ölenlerin yerine birkaç gün sonra yenileri gelir (aynı iş ve ev)
    const mem = this.resMem || {};
    for (let i = 0, n = list.length; i < n; i++) {
      let r = list[i];
      while (mem[r.id] && mem[r.id].dead !== undefined && this.day - mem[r.id].dead >= 3) {
        const nr = { ...r, id: r.id + 'n', look: randomLook(r.sex === 'f' ? 'f' : 'm', R), name: R.pick(NAMES[r.sex]) + ' ' + R.pick(NAMES.last), ent: null };
        list[i] = nr; r = nr;
      }
    }
    for (const r of list) r.dead = !!(mem[r.id] && mem[r.id].dead !== undefined);
    // kasaba yeniden yüklenirken dünyada kalan (omuzda, eyerde, bağlı) sakinler kendi kaydına yeniden bağlanır
    const P = this.player, h = this.horse;
    for (const e of [P && P.carry, ...((h && h.load) || []), ...this.ents]) {
      if (!e || !e.res || e.res.t !== t || e.remove) continue;
      const nr = list.find(r => r.id === e.res.id);
      if (nr) { e.res = nr; nr.ent = e; }
    }
    t._res = list;
    return list;
  },
  mem(r) { this.resMem = this.resMem || {}; return this.resMem[r.id] || (this.resMem[r.id] = { op: 0 }); },
  opOf(r) { const m = this.resMem && this.resMem[r.id]; return (m && m.op) || 0; },   // kayıt oluşturmadan okur
  occName(r) { return r.occ === 'keeper' ? KEEPER_N[r.work.type] || OCCS.keeper.n : OCCS[r.occ].n; },
  keeperOf(b) {
    const t = this.world.towns.find(x => x.id === b.town);
    if (!t) return null;
    return this.residents(t).find(r => r.occ === 'keeper' && r.work === b && !r.dead) || null;
  },
  /* Oyuncunun eylemleri sakinin hafızasına işlenir */
  resOpinion(e, d, why) {
    const r = e && e.res;
    if (!r) return;
    const m = this.mem(r);
    m.op = clamp((m.op || 0) + d, -100, 100);
    if (why) m[why] = this.day;
  },

  /* ---------------- günlük program ---------------- */
  schedule(r) {
    const t = r.t, h = ((this.hour + r.jit) + 24) % 24, day = this.day;
    const b = (ty) => t.buildings.find(x => x.type === ty);
    const home = { act: 'home', b: r.home };
    const env = this.envCache || {};
    const bad = (env.rain || 0) > 0.35 || env.storm || (env.dust || 0) > 0.5 || (env.snow || 0) > 0.6;
    const roll = (k) => hash2(day, k, (r.id.length * 131 + r.id.charCodeAt(r.id.length - 1)) | 0);
    const leisure = (act) => {
      if (bad) { const pb = this.nearPublic(t, r.home); if (pb) return { act: 'shelter', b: pb }; return home; }
      return { act };
    };
    // pazar sabahı kilise
    const church = b('church');
    if (church && day % 7 === 0 && h >= 9 && h < 11 && r.occ !== 'keeper' && roll(3) < 0.65) return { act: 'church', b: church };
    const saloon = b('saloon');
    const evening = h >= 18 && h < 21.5;
    switch (r.occ) {
      case 'keeper':
        if (this.isOpen(r.work) && !r.work.def.lock && h >= 6 && h < 22) return { act: 'in', b: r.work };
        return home;
      case 'laborer':
        if (h >= 7 && h < 12 || h >= 13 && h < 18) return bad ? { act: 'in', b: b('general') || r.home } : { act: 'haul' };
        if (h >= 12 && h < 13 && saloon) return { act: 'saloon', b: saloon };
        if (evening) return saloon && roll(1) < 0.6 ? { act: 'saloon', b: saloon } : leisure('stroll');
        return home;
      case 'sweeper':
        if (h >= 6 && h < 11) return leisure('sweep');
        if (h >= 19 && h < 20.5) return { act: 'lamps' };
        if (h >= 15 && h < 18) return leisure(roll(2) < 0.5 ? 'sit' : 'stroll');
        return home;
      case 'newsboy':
        if (h >= 7 && h < 11) return leisure('news');
        if (h >= 11 && h < 19) return leisure('play');
        return home;
      case 'kid':
        if (h >= 8 && h < 12 && church && day % 7 !== 0) return { act: 'school', b: church };
        if (h >= 12 && h < 19.5) return leisure('play');
        return home;
      case 'homemaker':
        if (h >= 8 && h < 11 || h >= 16 && h < 17.5) return bad ? home : { act: 'errand' };
        if (h >= 17.5 && h < 19) return leisure('stroll');
        return home;
      case 'drifter':
        if (h >= 10 && h < 14) return leisure('sit');
        if (h >= 14 && h < 17) return leisure('stroll');
        if ((h >= 17 || h < 1) && saloon) return { act: 'saloon', b: saloon };
        return home;
      case 'elder':
        if (h >= 9 && h < 12 || h >= 14 && h < 18) return leisure('sit');
        if (h >= 18 && h < 19.5) return leisure('stroll');
        return home;
      default: {   // kasaba dışında çalışanlar
        const wb = r.occ === 'miner' ? b('mine') : r.occ === 'dockhand' ? b('docks') : r.occ === 'lumberman' ? b('lumber') : null;
        if (h >= 6 && h < 17) return wb ? { act: 'in', b: wb } : { act: 'away' };
        if (h >= 17 && h < 18) return leisure('stroll');
        if (evening) return saloon && roll(4) < 0.55 ? { act: 'saloon', b: saloon } : leisure('stroll');
        return home;
      }
    }
  },
  nearPublic(t, from) {
    let best = null, bd = 1e12;
    for (const b of t.buildings) if (PUBLIC_B.includes(b.type) && (b.type === 'saloon' || b.type === 'hotel' || b.type === 'station' || this.isOpen(b))) { const d = dist2(b.door.x, b.door.y, from.door.x, from.door.y); if (d < bd) { bd = d; best = b; } }
    return best;
  },
  indoorAct(p) { return p.b && ['home', 'in', 'saloon', 'shelter', 'church', 'school'].includes(p.act); },

  /* ---------------- saniyede bir: programı uygula, sakinleri çıkar/gizle ---------------- */
  townTick(t) {
    const P = this.player;
    const near = dist2(t.cx, t.cy, P.x, P.y) < 1400 * 1400;
    for (const r of this.residents(t)) {
      if (r.dead) continue;
      const e = r.ent;
      if (e && (e.dead || e.remove)) {
        if (e.dead) { this.mem(r).dead = this.day; r.dead = true; }
        else if (e.staffOf) r.inside = e.staffOf;          // dükkân kapandı: kapıdan çıkıp evine gider
        else if (e.seatB) r.inside = e.seatB;
        else if (!e.entered) r.inside = null;              // uzakta silindi: bir sonraki açılışta yeniden yerleşir
        r.ent = null;
        continue;
      }
      let plan = this.schedule(r);
      if (plan.act === 'errand') plan = this.errandPlan(r) || { act: 'home', b: r.home };
      const key = plan.act + ':' + (plan.b ? plan.b.id : '');
      if (e) {
        if (e.staffOf) continue;   // tezgâhtaki esnaf: dükkân kapanınca townStaff çıkarır
        if (e.planKey !== key) {
          e.plan = plan; e.planKey = key; e.goal = null; e.route = null; e.carry2 = null;
          if (e.seatB) {
            // saloondan kalkan: oyuncu içeride değilse sessizce kapıya taşınır
            e.seatB.patrons = (e.seatB.patrons || []).filter(x => x !== e);
            if (this.insideB !== e.seatB && e.state === 'sit') { e.remove = true; continue; }
            e.seatB = null; e.seat = null;
          }
          if (e.state === 'sit' && !e.hostile) e.state = 'idle';
        }
        this.lifeExtras(e, t);
        continue;
      }
      // gizli (içeride ya da kasaba dışında)
      if (!near) { r.inside = this.indoorAct(plan) ? plan.b : plan.act === 'away' ? 'away' : r.inside; continue; }
      if (r.until && this.clock < r.until) continue;
      if (this.indoorAct(plan) && r.inside === plan.b) {
        if (plan.act === 'saloon') this.seatPatron(r, plan.b);
        continue;
      }
      if (plan.act === 'away' && r.inside === 'away') continue;
      this.spawnResident(r, plan);
    }
  },
  /* Alışveriş: bir iki dükkâna girip çıkar */
  errandPlan(r) {
    const t = r.t, d = this.day + (this.hour >= 14 ? 0.5 : 0);
    if (r.errDay !== d) {
      r.errDay = d; r.ei = 0;
      const shops = t.buildings.filter(b => ['general', 'butcher', 'tailor', 'doctor', 'barber', 'bank'].includes(b.type) && this.isOpen(b));
      r.errands = shops.length ? [pick(shops), pick(shops)].filter((b, i, a) => a.indexOf(b) === i) : [];
    }
    if (r.ei >= r.errands.length) return null;
    return { act: 'errand', b: r.errands[r.ei] };
  },
  spawnResident(r, plan) {
    const t = r.t, W = this.world;
    let x, y;
    if (r.inside && r.inside !== 'away') { x = r.inside.door.x + rnd(-2, 2); y = r.inside.door.y + 4; }
    else if (r.inside === 'away') { const g = pick(t.gates); x = g.x * TS + 8; y = g.y * TS + 8; }
    else {
      // ilk açılış: programa uygun bir yerde başlar
      const sp = pick(t.streetPts); x = sp.x + rnd(-8, 8); y = sp.y + rnd(-8, 8);
      if (this.indoorAct(plan)) { r.inside = plan.b; return; }
      if (plan.act === 'away') { r.inside = 'away'; return; }
      if (W.blocked(x, y, 4)) return;
    }
    const o = OCCS[r.occ];
    const n = new NPC(x, y, 'town', { look: r.look, name: r.name, money: rnd(0.05, 1.2) });
    n.town = t.id; n.keepTown = true; n.res = r; n.plan = plan; n.planKey = plan.act + ':' + (plan.b ? plan.b.id : ''); n.ang = Math.PI / 2;
    if (o && o.kid) { n.child = true; n.maxHp = n.hp = 40; }
    if (plan.act === 'errand' && r.inside === plan.b) r.ei++;   // bu dükkândaki iş bitti
    r.inside = null; r.until = 0; r.ent = n;
    this.addEnt(n);
    this.lifeExtras(n, t);
  },
  /* Saloondaki sakin boş bir sandalyeye oturur */
  seatPatron(r, b) {
    if (!b.seats) return;
    b.patrons = (b.patrons || []).filter(p => !p.dead && !p.remove);
    const P = this.player;
    const s = b.seats.find(s => !b.patrons.some(p => p.seat === s) && dist2(s.x, s.y, P.x, P.y) > 30 * 30);
    if (!s || b.patrons.length >= 7 || (this.insideB === b && chance(0.93))) return;
    const n = new NPC(s.x, s.y, 'town', { look: r.look, name: r.name, state: 'sit', money: rnd(0.1, 1.5) });
    n.seat = s; n.seatB = b; n.town = r.t.id; n.keepTown = true; n.res = r; n.plan = { act: 'saloon', b }; n.planKey = 'saloon:' + b.id;
    n.ang = s.x < b.x * TS + b.w * 8 ? 0 : Math.PI;
    r.ent = n; r.inside = null;
    b.patrons.push(n);
    this.addEnt(n);
  },

  /* ---------------- hareket: NPC.update, sakinler için idleUpdate yerine bunu çağırır ---------------- */
  drive(e, dt) {
    const r = e.res, p = e.plan;
    if (e.talkT > 0) { e.talkT -= dt; e.mv = 0; if (e.talkTo) e.ang = turnTo(e.ang, Math.atan2(e.talkTo.y - e.y, e.talkTo.x - e.x), dt * 5); return; }
    if (e.pauseT > 0) { e.pauseT -= dt; e.mv = 0; return; }
    if (!p) { e.mv = 0; return; }
    if (!e.goal) this.pickGoal(e);
    const g = e.goal;
    if (!g) { e.mv = 0; e.pauseT = rnd(1, 3); return; }
    if (!e.route) { e.route = TownPath.find(r.t, e.x, e.y, g.x, g.y) || [[g.x, g.y]]; e.ri = 0; }
    const wp = e.route[e.ri];
    const a = Math.atan2(wp[1] - e.y, wp[0] - e.x);
    e.ang = turnTo(e.ang, a, dt * 7);
    const o = OCCS[r.occ] || {};
    const sp = p.act === 'play' ? 52 : r.occ === 'elder' ? 20 : ['home', 'in', 'away', 'saloon', 'shelter', 'errand', 'church', 'school'].includes(p.act) ? 34 : 26;
    e.walk(dt, sp * (o.kid ? 1.1 : 1));
    if (dist2(e.x, e.y, wp[0], wp[1]) < (e.ri === e.route.length - 1 ? 5 * 5 : 8 * 8)) {
      e.ri++;
      if (e.ri >= e.route.length) this.arrive(e);
    }
    if (e.stuck > 1.4) { e.stuck = 0; e.route = null; e.nudge = (e.nudge || 0) + 1; if (e.nudge > 3) { e.goal = null; e.nudge = 0; } }
  },
  pickGoal(e) {
    const r = e.res, p = e.plan, t = r.t, W = this.world;
    const street = (maxD) => { for (let k = 0; k < 8; k++) { const s = pick(t.streetPts); if (!maxD || dist2(s.x, s.y, e.x, e.y) < maxD * maxD) return { x: s.x + rnd(-6, 6), y: s.y + rnd(-6, 6), kind: 'spot' }; } return null; };
    switch (p.act) {
      case 'home': case 'in': case 'saloon': case 'shelter': case 'church': case 'school': case 'errand':
        e.goal = { x: p.b.door.x, y: p.b.door.y + 3, kind: 'door', b: p.b }; break;
      case 'away': { const gt = t.gates.reduce((a, g) => dist2(g.x * TS, g.y * TS, e.x, e.y) < dist2(a.x * TS, a.y * TS, e.x, e.y) ? g : a, t.gates[0]); e.goal = { x: gt.x * TS + 8, y: gt.y * TS + 8, kind: 'gate' }; break; }
      case 'haul': { const bs = t.buildings.filter(b => b.enter && b.type !== 'house'); const b = pick(bs); e.goal = b ? { x: b.door.x + rnd(-8, 8), y: b.door.y + 8, kind: 'spot', pause: [3, 6], toggle: 'crate' } : street(); break; }
      case 'sweep': e.goal = street(140); if (e.goal) e.goal.pause = [2, 5]; e.carry2 = 'broom'; break;
      case 'news': e.goal = street(200); if (e.goal) e.goal.pause = [1, 3]; e.carry2 = 'paper'; break;
      case 'stroll': e.goal = street(260); if (e.goal) e.goal.pause = [2, 7]; break;
      case 'play': { const d = r.home.door; for (let k = 0; k < 6; k++) { const x = d.x + rnd(-60, 60), y = d.y + rnd(10, 70); if (!W.blocked(x, y, 4) && !W.indoorPx(x, y)) { e.goal = { x, y, kind: 'spot', pause: [0.3, 1.5] }; break; } } break; }
      case 'lamps': {
        const L = this.townLamps(t);
        e.lampI = (e.lampI || 0) % Math.max(1, L.length);
        const l = L[e.lampI++];
        e.goal = l ? { x: l.x, y: l.y + 10, kind: 'spot', pause: [1.5, 2.5], lamp: 1 } : street();
        break;
      }
      case 'sit': {
        const sp = this.freeSeat(t, e);
        e.goal = sp ? { x: sp.x, y: sp.y, kind: 'sit', ang: sp.ang } : street(200);
        break;
      }
      default: e.goal = street(200);
    }
    e.route = null;
  },
  arrive(e) {
    const g = e.goal, r = e.res;
    e.goal = null; e.route = null;
    if (g.kind === 'door' || g.kind === 'gate') {
      // içeri gir / kasabadan çık: görünmez olur
      r.inside = g.kind === 'gate' ? 'away' : g.b;
      if (e.plan.act === 'errand') r.until = this.clock + rnd(20, 45);
      e.remove = true; e.entered = true; r.ent = null;
      return;
    }
    if (g.kind === 'sit') { e.state = 'sit'; e.x = g.x; e.y = g.y; if (g.ang !== undefined) e.ang = g.ang; return; }
    if (g.toggle === 'crate') e.carry2 = e.carry2 === 'crate' ? null : 'crate';
    if (g.pause) e.pauseT = rnd(g.pause[0], g.pause[1]);
  },
  townLamps(t) {
    if (t._lamps) return t._lamps;
    const W = this.world, L = [];
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (W.inb(x, y) && W.obj[y * WW + x] === O.LAMP) L.push({ x: x * TS + 8, y: y * TS + 8 });
    L.sort((a, b) => a.x - b.x);
    t._lamps = L;
    return L;
  },
  freeSeat(t, e) {
    const W = this.world;
    if (!t._seats) {
      t._seats = [];
      for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (W.inb(x, y) && W.obj[y * WW + x] === O.BENCH) t._seats.push({ x: x * TS + 8, y: y * TS + 12, ang: Math.PI / 2 });
      // bina önü sundurmalar
      for (const b of t.buildings) if (['general', 'saloon', 'hotel', 'barber', 'station'].includes(b.type)) for (const k of [-1, 1]) t._seats.push({ x: b.door.x + k * 14, y: b.door.y + 5, ang: Math.PI / 2 });
    }
    const taken = (s) => this.ents.some(o => o !== e && o.res && o.state === 'sit' && dist2(o.x, o.y, s.x, s.y) < 36);
    const free = t._seats.filter(s => !taken(s) && !W.blocked(s.x, s.y, 3));
    if (!free.length) return null;
    free.sort((a, b) => dist2(a.x, a.y, e.x, e.y) - dist2(b.x, b.y, e.x, e.y));
    return free[Math.min(free.length - 1, rndi(0, 2))];
  },

  /* ---------------- sohbet, bağırış, hafıza tepkileri ---------------- */
  lifeExtras(e, t) {
    const P = this.player, r = e.res;
    if (e.hostile || e.dead || e.bound || e.state === 'flee' || e.state === 'report') return;
    const d2 = dist2(e.x, e.y, P.x, P.y);
    if (d2 > 330 * 330) return;
    // gazeteci çocuk manşet bağırır
    if (e.plan && e.plan.act === 'news' && chance(0.12)) Bubbles.add(e, pick(NEWS_SHOUT), 2.6);
    // oyuncudan nefret eden kaçınır
    const m = this.resMem && this.resMem[r.id];
    if (m && m.op <= -40 && d2 < 70 * 70 && !P.masked && this.los(e.x, e.y, P.x, P.y) && !(e.avoidT > this.clock)) {
      e.avoidT = this.clock + 60;
      Bubbles.add(e, this.fmtLine(pick(RES_LINES.hate)), 2.5);
      e.state = 'flee'; e.t = 3; e.goal = null; e.route = null;
      return;
    }
    // iki sakin karşılaşınca kısa sohbet
    if (e.talkT > 0 || !e.plan || !['stroll', 'sit', 'play', 'sweep'].includes(e.plan.act) || !chance(0.05)) return;
    const o = this.ents.find(o => o !== e && o.res && !o.dead && !o.hostile && !(o.talkT > 0) && o.plan && ['stroll', 'sit', 'sweep'].includes(o.plan.act) && dist2(o.x, o.y, e.x, e.y) < 30 * 30);
    if (!o) return;
    const env = this.envCache || {};
    let pool = CHAT.any;
    if ((env.rain || 0) > 0.2) pool = CHAT.rain;
    else if (this.hotness > 0.3) pool = CHAT.hot;
    else if (this.coldness > 0.3) pool = CHAT.cold;
    if (d2 < 140 * 140 && chance(0.4)) pool = this.honor > 30 ? CHAT.good : this.honor < -30 ? CHAT.bad : pool;
    const [q, a] = pick(pool);
    e.talkT = o.talkT = 4.6; e.talkTo = o; o.talkTo = e;
    Bubbles.add(e, this.fmtLine(q), 2.4);
    setTimeout(() => { if (!o.dead && !o.remove) Bubbles.add(o, this.fmtLine(a), 2.4); }, 1700);
  },
  fmtLine(l) { return l.replace('{ad}', this.player.name.split(' ')[0]); },
  /* Selamlaşma: sakin oyuncuyu hatırlar */
  residentGreet(e) {
    const r = e.res;
    if (!r) return null;
    const m = this.mem(r);
    if (m.greetDay !== this.day) { m.greetDay = this.day; m.op = clamp((m.op || 0) + 2, -100, 100); }
    if (m.op <= -30) return this.fmtLine(pick(RES_LINES.hate));
    if (m.op >= 30 && chance(0.6)) return this.fmtLine(pick(RES_LINES.friend));
    if (chance(0.35) && OCC_GREET[r.occ]) return pick(OCC_GREET[r.occ]);
    return null;
  },

  /* ---------------- yol trafiği ---------------- */
  trafficTick() {
    const P = this.player, W = this.world;
    const wagons = this.ents.filter(e => e.kind === 'wagon');
    for (const w of wagons) if (dist2(w.x, w.y, P.x, P.y) > 1500 * 1500) w.remove = true;
    if (wagons.length >= 3 || !chance(0.07)) return;
    // oyuncunun görüş alanının hemen dışındaki yol noktalarından biri
    const cands = [];
    for (const r of W.roads) {
      if (r.spur || r.pts.length < 6) continue;
      for (let i = 1; i < r.pts.length - 1; i += 2) {
        const [x, y] = r.pts[i];
        if (Math.abs(x - P.x) > 900 || Math.abs(y - P.y) > 900) continue;
        const d2 = dist2(x, y, P.x, P.y);
        if (d2 > 360 * 360 && d2 < 900 * 900) cands.push([r, i]);
      }
    }
    if (!cands.length) return;
    const [r, i] = pick(cands);
    this.addEnt(new Wagon(r, i, chance(0.5) ? 1 : -1, chance(0.35)));
  },
};
