'use strict';
/* ==========================================================
   FRONTIER'S END — nakliyeciler (G nesnesine eklenir)
   - Ahırdan ya da posta ofisinden nakliyeci tutulur: peşin
     ücret + günlük maaş (önce bankadan, sonra cüzdandan).
   - Nakliyeci kendi yük arabasıyla işletmelerini dolaşır: stoğu
     en az olan işletmenin malını en uygun üreticiden/toptancıdan
     alır (parası bankadan, yetmezse işletme kasalarından) ve
     götürür. Oyuncu yakındayken araba yolda gerçekten görünür.
   - Kasaba dışında haydut baskınına uğrayabilir. Yetişirsen
     haydutları dağıtıp yükü ve adamını kurtarırsın; yetişmezsen
     yük gider, adamın yaralanabilir. Korkak nakliyeci yükü
     bırakıp kaçar. Fırtınada (güvenilir olan hariç) yol kenarında
     bekler.
   ========================================================== */

const HAUL_SPD = 16;   // oyun dakikası başına piksel (≈ yol arabası hızı)

const HaulSystems = {
  /* ---------------- rota ---------------- */
  /* İki nokta arası: kasaba içinde sokaklardan, kasabalar arasında kaba A* ile (yolları tercih eder) */
  /* o (isteğe bağlı): r → kasaba içi rota genişliği; ride → atlı yolcu: kapı, giriş ve çıkış toplamı en kısa
     olandan seçilir, yollar yalnızca hafifçe tercih edilir (araba gibi yol uğruna uzun dolanmaz) */
  haulRoute(x0, y0, x1, y1, o = {}) {
    const W = this.world;
    const t0 = W.townAt(x0, y0, 4), t1 = W.townAt(x1, y1, 4);
    const inTown = (t, ax, ay, bx, by) => (t && TownPath.find(t, ax, ay, bx, by, o.r)) || [[bx, by]];
    if (t0 && t0 === t1) return inTown(t0, x0, y0, x1, y1);
    const gate = (t, tx, ty, fx, fy) => {
      let best = [t.cx, t.cy], bd = 1e18;
      const cands = t.gates.map(g => [g.x * TS + 8, g.y * TS + 8, 1]);
      // atlı/yaya kasabayı yalnızca yol kapısından değil, hedefe bakan kenarından da terk edebilir
      if (o.ride) { const G_ = TownPath.grid(t); cands.push([clamp(tx, (G_.x0 + 2) * TS, (G_.x0 + G_.w - 3) * TS), clamp(ty, (G_.y0 + 2) * TS, (G_.y0 + G_.h - 3) * TS), 1.12]); }
      for (const [gx, gy, k] of cands) { const d = o.ride ? (dist(gx, gy, tx, ty) + dist(gx, gy, fx, fy)) * k : dist2(gx, gy, tx, ty); if (d < bd) { bd = d; best = [gx, gy]; } }
      return best;
    };
    const out = [];
    let ax = x0, ay = y0, bx = x1, by = y1;
    if (t0) { const g = gate(t0, x1, y1, x0, y0); out.push(...inTown(t0, x0, y0, g[0], g[1])); ax = g[0]; ay = g[1]; }
    if (t1) { const g = gate(t1, ax, ay, x1, y1); bx = g[0]; by = g[1]; }
    const C = W.cost, cell = (v, m) => clamp((v / TS / CG) | 0, 0, m - 1);
    const cost = o.ride ? (ni) => { const c = C[ni]; return c >= 1e5 ? 40 : c > 20 ? 60 : 0.7 + c * 0.35; } : (ni) => { const c = C[ni]; return c >= 1e5 ? 30 : c > 20 ? 40 : c; };
    const path = C && W.astar(cell(ax, CW), cell(ay, CHH), cell(bx, CW), cell(by, CHH), cost);
    if (path && path.length > 2) out.push(...World.chaikin(path.map(p => [p[0] * TS + 8, p[1] * TS + 8]), 2));
    out.push([bx, by]);
    if (t1) out.push(...inTown(t1, bx, by, x1, y1));
    else out.push([x1, y1]);
    return out;
  },
  haulGo(h, state, x, y) {
    h.state = state; h.route = this.haulRoute(h.x, h.y, x, y); h.ri = 0;
  },
  haulMove(h, m) {
    let d = HAUL_SPD * HAUL_TRAITS[h.trait].spd * m;
    while (d > 0 && h.route && h.ri < h.route.length) {
      const [tx, ty] = h.route[h.ri], dd = dist(h.x, h.y, tx, ty);
      if (dd <= d) { h.x = tx; h.y = ty; d -= dd; h.ri++; }
      else { h.x += (tx - h.x) / dd * d; h.y += (ty - h.y) / dd * d; d = 0; }
    }
    return !h.route || h.ri >= h.route.length;
  },

  /* ---------------- iş planı ---------------- */
  haulPlan(h) {
    const W = this.world;
    // elde kalan yük varsa önce onu ihtiyacı olan işletmeye götür
    if (h.cargo.length) {
      const g = h.cargo[0];
      const z = this.biz.filter(q => !q.site && BIZ[q.type].goods === g && q.stock < BIZ[q.type].cap - 0.5).sort((a, c) => this.haulDist(h, a) - this.haulDist(h, c))[0];
      if (z) { const b = this.bizBuilding(z); h.tgt = z.bid; h.g = g; this.haulGo(h, 'toBiz', b.door.x, b.door.y + 10); }
      return;
    }
    const busy = new Set(this.haulers.filter(o => o !== h && o.state !== 'idle' && o.state !== 'rest').map(o => o.tgt));
    const cands = this.biz.filter(z => !z.site && BIZ[z.type].goods && z.stock / BIZ[z.type].cap < 0.6 && !busy.has(z.bid))
      .sort((a, c) => a.stock / BIZ[a.type].cap - c.stock / BIZ[c.type].cap);
    const z = cands[0];
    if (!z) return;
    const b = this.bizBuilding(z), g = BIZ[z.type].goods;
    let sup = null, best = 1e18;
    for (const s of W.buildings) {
      if (s === b) continue;
      const it = this.goodsAt(s).find(x => x.g === g);
      if (!it) continue;
      const sc = dist(h.x, h.y, s.door.x, s.door.y) + dist(s.door.x, s.door.y, b.door.x, b.door.y) + it.p * 1500;
      if (sc < best) { best = sc; sup = s; }
    }
    if (!sup) return;
    h.tgt = z.bid; h.src = sup.id; h.g = g; h.n = Math.min(HAUL_CAP, Math.ceil(BIZ[z.type].cap - z.stock));
    this.haulGo(h, 'toSrc', sup.door.x, sup.door.y + 10);
  },
  haulDist(h, z) { const b = this.bizBuilding(z); return b ? dist(h.x, h.y, b.door.x, b.door.y) : 1e9; },
  /* Mal parası: önce banka, sonra işletme kasaları */
  haulPay(v) {
    let paid = Math.min(v, this.bank); this.bank -= paid;
    for (const z of this.biz) { if (paid >= v - 0.001) break; const k = Math.min(z.cash, v - paid); z.cash -= k; paid += k; }
    return paid;
  },
  haulArrive(h) {
    const W = this.world;
    if (h.state === 'toSrc') {
      const s = W.buildings[h.src], it = s && this.goodsAt(s).find(x => x.g === h.g);
      if (!it) { h.state = 'idle'; h.waitT = 30; return; }
      const can = Math.min(h.n, Math.floor((this.bank + this.biz.reduce((a, z) => a + z.cash, 0) + 0.001) / it.p));
      if (can <= 0) { h.state = 'idle'; h.waitT = 240; UI.feed(Tr`🚚 ${h.name} mal alamadı: bankada ve kasalarda para yok.`, 'warn'); return; }
      this.haulPay(can * it.p);
      h.cargo = Array(can).fill(h.g);
      h.state = 'wait'; h.waitT = 20; h.why = 'load'; h.next = 'toBiz';
      return;
    }
    if (h.state === 'toBiz') {
      const b = W.buildings[h.tgt], z = this.bizOf(b);
      if (z) {
        const B = BIZ[z.type];
        let n = 0;
        while (h.cargo.length && B.goods === h.cargo[0] && z.stock < B.cap - 0.01) { h.cargo.shift(); z.stock = Math.min(B.cap, z.stock + 1); n++; }
        if (n) UI.feed(Tr`🚚 ${h.name}, ${b.name} için ${n} ${GOODS[B.goods].n} getirdi.`);
      }
      h.state = 'idle'; h.waitT = 10;
      return;
    }
    h.state = 'idle'; h.waitT = 10;
  },

  /* ---------------- zaman akışı ---------------- */
  haulTick(mins) {
    if (!this.haulers.length && !this.raids.length) return;
    // uzun zaman atlamaları (uyku, yolculuk) parça parça işlenir
    for (let left = mins; left > 0; left -= 15) {
      const m = Math.min(15, left);
      for (const h of this.haulers) this.haulStep(h, m);
      this.raidTick(m);
    }
    this.haulEnts();
  },
  haulStep(h, m) {
    const W = this.world;
    switch (h.state) {
      case 'idle': h.waitT = (h.waitT || 0) - m; if (h.waitT <= 0) { h.waitT = 30; this.haulPlan(h); } return;
      case 'rest': if (this.day >= h.restUntil) { h.state = 'idle'; h.waitT = 0; } return;
      case 'raid': return;
      case 'wait': h.waitT -= m; if (h.waitT <= 0) { if (h.next === 'toBiz') { const b = W.buildings[h.tgt]; if (b) this.haulGo(h, 'toBiz', b.door.x, b.door.y + 10); else h.state = 'idle'; } else { h.state = h.next; } } return;
    }
    // yolda
    const inTown = W.townAt(h.x, h.y, 2);
    if (!inTown && this.weather.type === 'storm' && this.weather.i > 0.5 && h.trait !== 'reliable') { h.storm = true; return; }
    h.storm = false;
    if (!inTown && h.trait === 'fast' && chance(m / 900)) { const cur = h.state; h.state = 'wait'; h.waitT = rnd(30, 60); h.why = 'break'; h.next = cur; return; }
    if (!inTown && h.cargo.length && chance(m / 60 * 0.03 * HAUL_TRAITS[h.trait].risk * this.haulDanger(h.x, h.y))) { this.haulStartRaid(h); return; }
    // oyuncu arabanın önündeyse bekler
    if (h.ent && dist2(h.ent.x + Math.cos(h.ent.ang) * 12, h.ent.y + Math.sin(h.ent.ang) * 12, this.player.x, this.player.y) < 16 * 16) return;
    if (this.haulMove(h, m)) this.haulArrive(h);
  },
  /* Yakında temizlenmemiş haydut kampı varsa baskın olasılığı artar */
  haulDanger(x, y) {
    let k = 1;
    for (const p of this.world.pois) if (p.kind === 'camp' && !this.campCleared[p.id] && dist2(p.x, p.y, x, y) < 1600 * 1600) k += 1;
    return k;
  },
  /* Günlük maaşlar: önce banka, sonra cüzdan. İki gün ödenmezse nakliyeci bırakır. */
  haulDaily() {
    for (const h of this.haulers.slice()) {
      const w = HAUL_TRAITS[h.trait].wage;
      if (this.bank >= w) { this.bank -= w; h.unpaid = 0; }
      else if (this.player.money >= w) { this.player.money -= w; h.unpaid = 0; }
      else if (++h.unpaid >= 2) { this.fireHauler(h, true); UI.feed(Tr`🚚 ${h.name} maaşını alamadığı için işi bıraktı.`, 'warn'); }
      else UI.feed(Tr`🚚 Nakliyecin ${h.name} maaşını alamadı. Yarın da ödenmezse gidecek.`, 'warn');
    }
  },

  /* ---------------- baskın ---------------- */
  haulStartRaid(h) {
    const t = this.nearestTown(h.x, h.y);
    const R = { id: 'r' + Date.now().toString(36) + rndi(0, 999), h: h.id, x: h.x, y: h.y, t: 150, g: h.cargo.slice(), coward: h.trait === 'coward', spawned: false, bandits: [] };
    this.raids.push(R);
    if (R.coward) { h.cargo = []; h.state = 'idle'; h.waitT = 120; }
    else h.state = 'raid';
    UI.toast(Tr('Nakliyecine Baskın!'), R.coward ? Tr`${h.name} ${t.n} yakınlarında haydutları görünce yükü bırakıp kaçtı. Yetişirsen malı geri alabilirsin.` : Tr`${h.name} ${t.n} yakınlarında haydutlara yakalandı! Yetişirsen adamını ve yükü kurtarabilirsin.`, 'bounty');
    Audio_.ui('error');
  },
  raidTick(m) {
    const P = this.player;
    for (const R of this.raids.slice()) {
      const h = this.haulers.find(x => x.id === R.h);
      const d = dist(P.x, P.y, R.x, R.y);
      if (!R.spawned && d < 750) {
        R.spawned = true;
        const n = rndi(2, 3);
        for (let k = 0; k < n; k++) {
          const p = this.findSpawnPos(R.x, R.y, 20, 70);
          if (!p) continue;
          const b = new NPC(p[0], p[1], 'bandit', { hostile: true, home: { x: R.x, y: R.y, r: 60 }, money: rnd(1, 5) });
          b.keep = true; b.raid = R.id;
          this.addEnt(b); R.bandits.push(b);
        }
        if (R.coward) { for (const g of R.g) this.addEnt(new Crate(R.x + rnd(-14, 14), R.y + rnd(-10, 10), g)); R.g = []; }
        if (!R.bandits.length) { this.raidWin(R, h); continue; }
      }
      if (R.spawned) {
        if (!R.bandits.some(b => !b.dead && !b.remove)) { this.raidWin(R, h); continue; }
        if (d < 1400) continue;   // çatışma sürüyor ya da oyuncu yakında
      }
      R.t -= m;
      if (R.t <= 0) this.raidLose(R, h);
    }
  },
  raidWin(R, h) {
    this.raids.splice(this.raids.indexOf(R), 1);
    for (const b of R.bandits) b.keep = false;
    this.addHonor(3);
    if (h && !R.coward) { h.state = 'wait'; h.waitT = 5; h.why = 'load'; h.next = 'toBiz'; }
    UI.toast(Tr('Baskın Püskürtüldü'), R.coward ? Tr('Haydutlar dağıldı. Bırakılan sandıklar yerde; alıp götürebilirsin.') : Tr`${h ? h.name : ''} yoluna devam ediyor. Yük kurtuldu.`, 'ok');
  },
  raidLose(R, h) {
    this.raids.splice(this.raids.indexOf(R), 1);
    for (const b of R.bandits) if (!b.dead) b.remove = true;
    if (R.coward) { UI.feed(Tr('🚚 Korkak nakliyecinin bıraktığı yük yağmalandı.'), 'warn'); return; }
    if (!h) return;
    if (chance(h.trait === 'reliable' ? 0.6 : 0.35)) { h.state = 'wait'; h.waitT = 10; h.why = 'load'; h.next = 'toBiz'; UI.feed(Tr`🚚 ${h.name} haydutları tek başına savuşturdu ve yoluna devam ediyor.`); return; }
    h.cargo = []; h.state = 'rest'; h.restUntil = this.day + 1;
    UI.feed(Tr`🚚 ${h.name} soyuldu ve yaralandı. Yük gitti; yarın işe döner.`, 'warn');
  },

  /* ---------------- dünyadaki araba ---------------- */
  haulEnts() {
    const P = this.player;
    for (const h of this.haulers) {
      if (h.ent && (h.ent.remove || !this.ents.includes(h.ent))) h.ent = null;
      const near = h.state !== 'rest' && Math.abs(h.x - P.x) < 1000 && Math.abs(h.y - P.y) < 1000;
      if (near && !h.ent) {
        const w = new Wagon(null, 0, 1, false, { x: h.x, y: h.y, ang: 0 });
        w.driver = { look: h.look, name: h.name }; w.hauler = h; w.owner = 'player'; w.keep = true; w.cargo = false;
        w.name = Tr`Nakliyecin ${h.name}`; w.body = '#6a4a30';
        const nx = h.route && h.route[h.ri]; if (nx) { w.ang = Math.atan2(nx[1] - h.y, nx[0] - h.x); w.trail(true); }
        h.ent = w; this.addEnt(w);
      } else if (!near && h.ent) { h.ent.remove = true; h.ent = null; }
      if (h.ent) h.ent.crates = h.cargo;
    }
  },
  /* Wagon.update içinden: arabayı soyut konuma bağla */
  haulSync(w, dt) {
    const h = w.hauler;
    const dx = h.x - w.x, dy = h.y - w.y, d = Math.hypot(dx, dy);
    if (d > 60) { w.x = h.x; w.y = h.y; }
    else if (d > 0.3) { w.ang = turnTo(w.ang, Math.atan2(dy, dx), dt * 4); w.x = h.x; w.y = h.y; }
    w.spd = d / Math.max(dt, 0.001); w.mv = Math.min(1, w.spd / 60); w.phase += dt * w.spd * 0.15;
    w.trail();
  },
  haulerActions(w, add) {
    const h = w.hauler;
    add(w.x, w.y, w.name, [{ n: Tr('Durumunu Sor'), fn: () => Bubbles.add(w, this.haulStatus(h), 3) }], 3);
  },
  haulStatus(h) {
    const W = this.world;
    switch (h.state) {
      case 'idle': return h.cargo.length ? Tr`Elimde ${h.cargo.length} sandık var, götürecek yer arıyorum.` : Tr('Boştayım patron, iş bekliyorum.');
      case 'rest': return Tr('Yaralıyım, bugün dinleniyorum.');
      case 'raid': return Tr('Haydutlar! Yardım et!');
      case 'wait': return h.why === 'break' ? Tr('Biraz mola veriyorum.') : Tr('Yükleniyoruz.');
      case 'toSrc': { const s = W.buildings[h.src]; return h.storm ? Tr('Fırtınanın dinmesini bekliyorum.') : Tr`${GOODS[h.g].n} almaya gidiyorum: ${s ? s.name : ''}.`; }
      case 'toBiz': { const b = W.buildings[h.tgt]; return h.storm ? Tr('Fırtınanın dinmesini bekliyorum.') : Tr`${h.cargo.length} sandık götürüyorum: ${b ? b.name : ''}.`; }
    }
    return '';
  },

  /* ---------------- işe alma ---------------- */
  haulCandidates(t) {
    const R = new RNG((this.seed ^ (hash2(t.cx | 0, t.cy | 0, 41) * 1e9) ^ (this.day * 7919)) >>> 0);
    const traits = Object.keys(HAUL_TRAITS), out = [];
    for (let k = 0; k < 3; k++) {
      const sex = R.chance(0.85) ? 'm' : 'f';
      const name = R.pick(NAMES[sex]) + ' ' + R.pick(NAMES.last);
      if (this.haulers.some(h => h.name === name)) continue;
      out.push({ name, sex, trait: traits[R.int(0, traits.length - 1)], seed: R.int(1, 1e9) });
    }
    return out;
  },
  hireHauler(c, b) {
    if (this.haulers.length >= HAUL_MAX) { UI.feed(Tr`En fazla ${HAUL_MAX} nakliyeci tutabilirsin.`, 'warn'); return false; }
    if (!this.spend(HAUL_HIRE)) return false;
    const h = { id: 'h' + Date.now().toString(36) + rndi(0, 999), name: c.name, look: randomLook(c.sex, new RNG(c.seed)), trait: c.trait, x: b.door.x + 20, y: b.door.y + 26, state: 'idle', waitT: 0, cargo: [], unpaid: 0, since: this.day };
    this.haulers.push(h);
    UI.toast(Tr('Nakliyeci Tutuldu'), Tr`${h.name} (${HAUL_TRAITS[h.trait].n}) işe başladı. İşletmelerini kendi dolaşıp mal getirecek.`, 'ok');
    if (!this.biz.some(z => BIZ[z.type].goods)) UI.feed(Tr('Mal tüketen bir işletmen olmadıkça nakliyecinin yapacak işi yok.'), 'warn');
    this.hintOnce('hauler', Tr`Nakliyeci, stoğu azalan işletmenin malını en uygun yerden alıp götürür. Mal parası önce bankadan, yetmezse işletme kasalarından ödenir; maaşı her gün bankadan kesilir. Yolda baskına uğrarsa haber gelir: yetişirsen yükü kurtarırsın.`, 12);
    return true;
  },
  fireHauler(h, silent) {
    if (h.ent) { h.ent.remove = true; h.ent = null; }
    this.haulers.splice(this.haulers.indexOf(h), 1);
    this.raids = this.raids.filter(R => R.h !== h.id || R.coward);
    if (!silent) UI.feed(Tr`${h.name} ile yollarını ayırdın.`);
  },

  /* ---------------- kayıt ---------------- */
  saveHaul() {
    return {
      list: this.haulers.map(h => ({ id: h.id, name: h.name, look: h.look, trait: h.trait, x: Math.round(h.x), y: Math.round(h.y), state: h.state, tgt: h.tgt, src: h.src, g: h.g, n: h.n, cargo: h.cargo, waitT: h.waitT, next: h.next, why: h.why, restUntil: h.restUntil, unpaid: h.unpaid, since: h.since })),
      raids: this.raids.map(R => ({ id: R.id, h: R.h, x: Math.round(R.x), y: Math.round(R.y), t: R.t, g: R.g, coward: R.coward })),
    };
  },
  loadHaul(d) {
    if (!d) return;
    const W = this.world;
    this.haulers = (d.list || []).map(h => Object.assign({ cargo: [], unpaid: 0 }, h));
    for (const h of this.haulers) {
      const b = W.buildings[h.state === 'toSrc' ? h.src : h.tgt];
      if ((h.state === 'toSrc' || h.state === 'toBiz') && b) this.haulGo(h, h.state, b.door.x, b.door.y + 10);
      else if (h.state === 'toSrc' || h.state === 'toBiz') h.state = 'idle';
    }
    this.raids = (d.raids || []).map(R => Object.assign({ spawned: false, bandits: [] }, R));
  },
};
