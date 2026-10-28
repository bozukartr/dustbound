'use strict';
/* ==========================================================
   FRONTIER'S END — korumalar (G nesnesine eklenir)
   - Nüfuzlu biri saloon, kantina ve kumarhanelerden silahlı koruma
     tutar; en çok kaç koruma tutabileceğini nüfuz basamağı belirler
     (GUARD_MAX). Peşin bir bedel ve günlük ücret; ücret iki gün
     ödenmezse koruma işi bırakır. Her sabah yaraları sarılır.
   - Yaya ya da atlı peşinden gelir; bir binaya girince kapıda bekler,
     geride kalırsa (yolculuk, tren) gözden uzakta yanına gelir.
     Konuşup bir yeri tutmasını isteyebilirsin.
   - Haydutlara, sana saldıran ödül avcılarına ve vahşi hayvanlara ateş
     eder; arada sen ya da masum biri varsa ateş etmez. Vurduğu kişi onu
     hedef alır; koruma ölebilir.
   - Kanuna kendiliğinden asla ateş etmez: tutuklanırken karışmaz.
     Kanuna direnirsen yalnızca sadık olan yanında savaşır (vurduğu kanun
     adamları senin suçun sayılır); ötekiler uzak durur, çatışma büyürse
     işi bırakır.
   - Suçunu gören biri kanuna koşarken yakındaki koruma onu susturmaya
     çalışır.
   ========================================================== */

const GuardSystems = {
  /* ---------------- işe alma ---------------- */
  guardMax() { return GUARD_MAX[this.infLv(this.influence())]; },
  guardFee(trait) { return GUARD_TRAITS[trait].wage * GUARD_HIRE; },
  /* Koruma tutulabilir mi: '' ya da nedeni */
  guardWhy() {
    const max = this.guardMax();
    if (!max) return Tr`Koruma tutmak için ${INF_LV[GUARD_MAX.indexOf(1)].n} olmalısın.`;
    if (this.guards.length >= max) return Tr`Nüfuzunla en çok ${max} koruma tutabilirsin.`;
    return '';
  },
  /* Kasabada iş arayan silahşorlar: gün boyunca aynı kalır */
  guardCandidates(t) {
    const R = new RNG((this.seed ^ (hash2(t.cx | 0, t.cy | 0, 59) * 1e9) ^ (this.day * 6271)) >>> 0);
    const traits = Object.keys(GUARD_TRAITS), out = [];
    for (let k = 0; k < 3; k++) {
      const sex = R.chance(0.9) ? 'm' : 'f';
      const name = R.pick(NAMES[sex]) + ' ' + R.pick(NAMES.last), trait = traits[R.int(0, traits.length - 1)], seed = R.int(1, 1e9);
      if (this.guards.some(g => g.name === name)) continue;
      out.push({ name, sex, trait, seed });
    }
    return out;
  },
  hireGuard(c) {
    const why = this.guardWhy();
    if (why) { UI.feed(why, 'warn'); return false; }
    if (!this.spend(this.guardFee(c.trait))) return false;
    const T = GUARD_TRAITS[c.trait];
    const g = { id: 'g' + Date.now().toString(36) + rndi(0, 999), name: c.name, look: randomLook(c.sex, new RNG(c.seed)), trait: c.trait, hp: T.hp, unpaid: 0, since: this.day, wait: null, hits: 0 };
    this.guards.push(g);
    this.guardSpawn(g);
    if (g.ent) g.ent.say(pick(GUARD_LINES.hire), 3);
    UI.toast(Tr('Koruma Tutuldu'), Tr`${g.name} (${T.n}) artık seni koruyor. Ücreti her gün bankandan ödenir.`, 'ok');
    this.hintOnce('guards', Tr`Korumaların peşinden gelir; haydutlara, sana saldıran ödül avcılarına ve vahşi hayvanlara ateş eder. Kanuna kendiliğinden asla ateş etmezler: kanuna direnirsen yalnızca sadık olanlar yanında savaşır. Korumanın yanında ${Input.glyph('interact')} ile bir yeri tutmasını isteyebilir ya da işine son verebilirsin.`, 12);
    return true;
  },
  /* Koruma gider. why: 'fired' (sen kovdun), 'unpaid' (ücret), 'law' (kanunla çatışma), 'hurt' (ona ateş ettin) */
  guardLeave(g, why) {
    const i = this.guards.indexOf(g);
    if (i < 0) return;
    this.guards.splice(i, 1);
    const e = g.ent;
    g.ent = null;
    if (e && !e.dead && !e.remove) {
      e.guard = null; e.keep = false; e.gAim = false; e.role = 'traveler';
      if (why !== 'hurt') e.say(pick(why === 'fired' ? GUARD_LINES.fired : GUARD_LINES.quit), 3);
      // uzaklaşıp gözden kaybolur
      const a = Math.atan2(e.y - this.player.y, e.x - this.player.x) + rnd(-0.6, 0.6);
      e.mounted = null; e.state = 'walk'; e.goHome = true; e.t = 25; e.nav = null;
      e.target = { x: e.x + Math.cos(a) * 700, y: e.y + Math.sin(a) * 700 };
    }
    if (why === 'fired') UI.feed(Tr`🛡 ${g.name} ile yollarını ayırdın.`);
    else if (why === 'unpaid') UI.toast(Tr('Koruman Gitti'), Tr`${g.name} iki gündür ücretini alamadığı için işi bıraktı.`, 'wanted');
    else if (why === 'law') UI.feed(Tr`🛡 ${g.name} kanunla çatışmak istemedi ve işi bıraktı.`, 'warn');
    else UI.feed(Tr`🛡 ${g.name} ona ateş ettiğin için işi bıraktı.`, 'warn');
  },
  /* mine: onu sen öldürdün */
  guardDied(g, mine) {
    const i = this.guards.indexOf(g);
    if (i >= 0) this.guards.splice(i, 1);
    if (g.ent) { g.ent.guard = null; g.ent.keep = false; g.ent.gAim = false; }
    g.ent = null;
    UI.toast(Tr('Korumanı Kaybettin'), mine ? Tr`${g.name} senin kurşununla öldü.` : Tr`${g.name} seni korurken öldü.`, 'wanted');
  },
  /* Oyuncu kendi korumasını vurdu: ilkinde uyarır, ikincisinde gider */
  guardHit(e) {
    const g = e.guard;
    if (!g || e.hp <= 0) return;
    if (++g.hits >= 2) this.guardLeave(g, 'hurt');
    else e.say(pick([Tr('Dikkat et, patron! Bana ateş ediyorsun!'), Tr('Hey! Ben senin tarafındayım!')]), 2.5);
  },

  /* ---------------- günlük ---------------- */
  /* Ücretler (önce banka, sonra cüzdan); iki gün ödenmezse koruma gider. Gece dinlenen korumanın yaraları sarılır. */
  guardDaily() {
    for (const g of this.guards.slice()) {
      const T = GUARD_TRAITS[g.trait];
      if (this.payWage(T.wage)) g.unpaid = 0;
      else if (++g.unpaid >= 2) { this.guardLeave(g, 'unpaid'); continue; }
      else UI.feed(Tr`🛡 Koruman ${g.name} ücretini alamadı. Yarın da ödenmezse gidecek.`, 'warn');
      g.hp = T.hp; g.hits = 0;
      if (g.ent && !g.ent.dead) { g.ent.hp = g.ent.maxHp = T.hp; g.ent.ammoInit(); }
    }
  },

  /* ---------------- dünyada ---------------- */
  /* Her kare: varlığı olmayan koruma yanına gelir, ölen kaydedilir */
  guardTick() {
    for (const g of this.guards.slice()) {
      const e = g.ent;
      if (e && e.dead) { this.guardDied(g); continue; }
      if (!e || e.remove) { g.ent = null; this.guardSpawn(g); }
    }
  },
  /* Ekranın hemen dışında (yolu açık) bir nokta: koruma oradan koşarak gelir */
  guardEdge(x, y) {
    const R = Math.max(this.vw, this.vh) / 2 + 30;
    return this.findSpawnPos(x, y, R, R + 60) || this.findSpawnPos(x, y, 30, 80);
  },
  guardSpawn(g) {
    const P = this.player, k = this.guards.indexOf(g);
    let s;
    if (g.wait) {
      if (dist(P.x, P.y, g.wait.x, g.wait.y) > 1300) return;   // tuttuğu yer uzakta: oraya dönünce belirir
      s = [g.wait.x, g.wait.y];
    } else if (this.insideB && this.insideB.door) { const D = this.insideB.door; s = this.findSpawnPos(D.x + (k - 1) * 14, D.y + 18, 0, 30); }
    else s = this.findSpawnPos(P.x - Math.cos(P.ang) * 34, P.y - Math.sin(P.ang) * 34, 0, 40);
    s = s || [P.x, P.y + 20];
    const T = GUARD_TRAITS[g.trait];
    const e = new NPC(s[0], s[1], 'guard', { name: g.name, look: Object.assign({}, g.look), hp: T.hp, weapon: T.weapon, money: 0 });
    e.hp = clamp(g.hp, 1, T.hp);
    e.guard = g; e.keep = true; e.personal = true; e.ang = P.ang;
    if (P.riding && !g.wait && !this.insideB) e.mounted = this.guardHorse(g);
    g.ent = e;
    this.addEnt(e);
  },
  /* Korumanın atı (her zaman aynı renk) */
  guardHorse(g) {
    let h = 7;
    for (let i = 0; i < g.name.length; i++) h = (h * 31 + g.name.charCodeAt(i)) >>> 0;
    const R = new RNG(h);
    return { col: R.pick(HORSE_BREEDS.mustang.cols), mane: '#1a1410', blanket: R.pick(['#5a4a3a', '#6a2a22', '#2a3a5a', '#3a4a2a']) };
  },

  /* NPC.update'ten: korumanın davranışı (true: olağan davranış atlanır) */
  guardNpc(e, dt) {
    const g = e.guard, L = this.law, T = GUARD_TRAITS[g.trait];
    g.hp = e.hp;
    e.hostile = false; e.witness = null;
    if (e.state !== 'idle' && e.state !== 'walk') e.state = 'idle';
    if (e.mag === undefined) e.ammoInit();
    e.cool -= dt;
    // şarjör: çatışma dışında da doldurur
    const W = WEAPONS[e.weapon] || WEAPONS.cattleman;
    if (e.reloadT > 0) { if ((e.reloadT -= dt) <= 0) e.mag = W.clip || 6; }
    else if (e.mag < (W.clip || 6) && !e.gTgt) e.npcReload(W);
    // korkak: canı yarıya inince bir süre kaçar
    if (e.gFlee > 0) {
      const th = e.gTgt;
      e.gFlee = th && !th.dead && !th.remove ? e.gFlee - dt : 0; e.gAim = false;   // tehlike geçince döner
      if (e.gFlee > 0) {
        if (e.mounted) { e.ang = turnTo(e.ang, Math.atan2(e.y - th.y, e.x - th.x), dt * 4); e.walk(dt, 140); }
        else this.fleeStep(e, th.x, th.y, dt, 80);
        return true;
      }
    }
    // kanuna direnirsen: sadık savaşır, öteki uzak durur; çatışma büyürse işi bırakır
    const resist = L.level > 0 && L.resist && !this.truce;
    if (resist && !T.loyal && L.level >= 3) { this.guardLeave(g, 'law'); return true; }
    if ((e.gScan = (e.gScan || 0) - dt) <= 0) { e.gScan = 0.3; e.gTgt = this.guardThreat(e, T, resist); }
    const tg = e.gTgt;
    if (tg && !tg.dead && !tg.remove && !tg.bound && (tg.hostile || tg.state === 'attack')) { this.guardFight(e, tg, T, W, dt); return true; }
    e.gTgt = null; e.gAim = false; e.gCalled = false;
    if (!g.wait && !resist && this.guardHush(e, T, dt)) return true;
    if (resist && !T.loyal) { if (!e.gAside) { e.gAside = true; e.say(pick(GUARD_LINES.aside), 2.5); } } else e.gAside = false;
    this.guardFollow(e, g, dt, e.gAside ? 150 : 0);
    return true;
  },
  /* Tehdit: sana ya da korumaya saldıran haydut, ödül avcısı ya da vahşi hayvan; sadık koruma direnişte kanun adamı.
     Sana yakın (GUARD_LEASH) ve korumanın görebildiği; menzil dışındaysa koruma yaklaşır. */
  guardThreat(e, T, resist) {
    const P = this.player, R = Math.max(GUARD_LEASH + 80, (WEAPONS[e.weapon] || WEAPONS.cattleman).range * 0.9);
    let best = null, bd = Infinity;
    for (const o of this.ents) {
      if (o === e || o.dead || o.remove || o.hide) continue;
      let ok = false;
      if (o.kind === 'npc') {
        if (o.guard || o.bound || !o.hostile) continue;
        if (o.isLaw) ok = !!T.loyal && resist;
        else if (o.role === 'hunter') ok = !!this.posse && this.posse.phase === 'fight';
        else ok = !!o.aggro || o.foe === e;
      } else if (o.kind === 'animal') ok = o.state === 'attack' && !o.def.owned;
      if (!ok) continue;
      const d = dist(o.x, o.y, e.x, e.y), dp = dist(o.x, o.y, P.x, P.y);
      if (d > R || (dp > GUARD_LEASH + 80 && o.foe !== e)) continue;
      if (!this.los(e.x, e.y, o.x, o.y)) continue;
      const s = Math.min(d, dp) - (o.foe === e ? 60 : 0);
      if (s < bd) { bd = s; best = o; }
    }
    return best;
  },
  guardFight(e, tg, T, W, dt) {
    const P = this.player;
    if (T.coward && e.hp < e.maxHp * 0.5) { e.gFlee = 6; e.gAim = false; e.say(pick(GUARD_LINES.flee), 2.5); return; }
    e.gAim = true;
    if (!e.gCalled) { e.gCalled = true; if (chance(0.6)) e.say(pick(GUARD_LINES.fight), 2); }
    const d = dist(e.x, e.y, tg.x, tg.y), a = Math.atan2(tg.y - e.y, tg.x - e.x);
    if (!(e.reloadT > 0) && e.mag <= 0) e.npcReload(W);
    // menzile göre uzaklık tutar, yan adım atar; senden fazla uzaklaşmaz
    const pref = e.weapon === 'shotgun' ? 60 : e.weapon === 'rifle' ? 170 : 110;
    let mx = 0, my = 0;
    if (d > pref + 30) { mx = Math.cos(a); my = Math.sin(a); } else if (d < pref - 40) { mx = -Math.cos(a); my = -Math.sin(a); }
    if (dist(e.x, e.y, P.x, P.y) > GUARD_LEASH) { const b = Math.atan2(P.y - e.y, P.x - e.x); mx += Math.cos(b) * 1.2; my += Math.sin(b) * 1.2; }
    if ((e.strafeT -= dt) <= 0) { e.strafe = chance(0.5) ? 1 : -1; e.strafeT = rnd(1, 2.5); }
    // atış yolu kapalıysa (önünde sen ya da biri varsa) yana açılır
    let side = 0.6;
    if (e.gSide > 0) { e.gSide -= dt; mx *= 0.3; my *= 0.3; side = 1.6; }
    mx += -Math.sin(a) * side * e.strafe; my += Math.cos(a) * side * e.strafe;
    e.walk(dt, e.mounted ? 110 : d > W.range * 0.9 ? 62 : 46, Math.atan2(my, mx));
    if (e.stuck > 0.25) { e.strafe *= -1; e.stuck = 0; }
    e.ang = turnTo(e.ang, a, dt * 8);
    if (e.reloadT > 0 || e.mag <= 0 || e.cool > 0 || d > W.range * 0.9 || Math.abs(angDiff(e.ang, a)) > 0.25) return;
    // arada sen ya da masum biri varsa ateş etmez
    if (!this.guardClear(e, tg, d)) { e.cool = 0.3; if (!(e.gSide > 0)) e.gSide = 0.8; return; }
    e.cool = W.rate * rnd(1.8, 3);
    e.mag--;
    const acc = T.acc + (tg.mounted ? 0.03 : 0), n = W.pellets ? 4 : 1, ox = e.x + Math.cos(e.ang) * 7, oy = e.y + Math.sin(e.ang) * 7;
    let hit = null;
    for (let i = 0; i < n; i++) hit = this.fireRay(ox, oy, e.ang + rnd(-acc, acc), W.range, T.dmg * (this.difficulty === 'hard' ? 0.85 : 1), e, { guard: true, gd: d + rnd(4, 40) }) || hit;
    this.parts.add('flash', ox + Math.cos(e.ang), oy + Math.sin(e.ang), 0, 0, 0.06, 3.5);
    Juice.muzzle(ox + Math.cos(e.ang), oy + Math.sin(e.ang));
    if (dist2(e.x, e.y, P.x, P.y) < 500 * 500) FX.gunSmoke(ox, oy, e.ang, W.kind === 'long');
    Audio_.shot(Audio_.gunKind(e.weapon), 0.85, e.x, e.y);
    // vurulan korumayı hedef alır
    if (hit && hit.kind === 'npc' && !hit.dead) { hit.foe = e; hit.foeT = 8; }
  },
  /* Atış yolunda sen, atın ya da düşman olmayan biri var mı */
  guardClear(e, tg, d) {
    const dx = Math.cos(e.ang), dy = Math.sin(e.ang), P = this.player;
    const chk = (o) => {
      if (Math.abs(o.x - e.x) > d + 20 || Math.abs(o.y - e.y) > d + 20) return false;
      const t = rayCircle(e.x, e.y, dx, dy, o.x, o.y, (o.r || 4) + 3);
      return t >= 0 && t < d;
    };
    if (chk(P) || (this.horse && !this.horse.dead && chk(this.horse))) return false;
    for (const o of this.ents) if (o !== e && o !== tg && o.kind === 'npc' && !o.hostile && !o.dead && !o.remove && !o.hide && chk(o)) return false;
    return true;
  },
  /* Suçunu gören ve kanuna koşan birini susturmaya çalışır */
  guardHush(e, T, dt) {
    const P = this.player;
    let w = e.gW;
    if (w && (w.dead || w.remove || !w.witness || w.witness.done || w.gTried)) w = e.gW = null;
    if (!w) {
      if ((e.gHushT = (e.gHushT || 0) - dt) > 0) return false;
      e.gHushT = 0.5;
      for (const o of this.ents) if (o.kind === 'npc' && o.witness && !o.witness.done && !o.gTried && !o.dead && !o.isLaw && dist2(o.x, o.y, e.x, e.y) < 260 * 260 && dist2(o.x, o.y, P.x, P.y) < 360 * 360) { w = e.gW = o; break; }
      if (!w) return false;
    }
    const d = dist(e.x, e.y, w.x, w.y);
    if (d > 26) {
      e.ang = turnTo(e.ang, Math.atan2(w.y - e.y, w.x - e.x), dt * 6);
      if (e.mounted || this.navStep(e, w.x, w.y, dt, 70) === 'fail') e.walk(dt, e.mounted ? 120 : 60);
      return true;
    }
    w.gTried = true; e.gW = null;
    e.say(pick(GUARD_LINES.hush), 2.5);
    if (chance(T.hush)) {
      setTimeout(() => w.say(pick(LINES.silenced), 2.5), 600);
      this.silenceWitness(w);
      if (w.res) this.resOpinion(w, -15, 'threat');
      this.addHonor(-1);
      UI.feed(Tr`🛡 ${e.name} tanığı susturdu.`);
    } else setTimeout(() => w.say(pick([Tr('Çekil yolumdan!'), Tr('Beni korkutamazsın!')]), 2), 600);
    return true;
  },
  /* Peşinden gelir (yaya ya da atlı); binadaysan kapıda, bekle dediysen o yerde durur. far: kanuna direnirken uzak durur */
  guardFollow(e, g, dt, far) {
    const P = this.player, k = this.guards.indexOf(g), n = this.guards.length;
    let gx, gy, stop;
    if (g.wait) { gx = g.wait.x; gy = g.wait.y; stop = 10; }
    else if (this.insideB && this.insideB.door) { const D = this.insideB.door; gx = D.x + (k - (n - 1) / 2) * 16; gy = D.y + 18; stop = 8; }
    else { gx = P.x; gy = P.y; stop = far || (P.riding ? 52 : 32) + k * 14; }
    const ride = !g.wait && !!P.riding && !this.insideB;
    if (ride && !e.mounted) e.mounted = this.guardHorse(g);
    else if (!ride && e.mounted && (!this.onScreen(e.x, e.y, 20) || dist(e.x, e.y, gx, gy) < 120)) e.mounted = null;
    const d = dist(e.x, e.y, gx, gy);
    // çok geride kaldıysa (yolculuk, tren) gözden uzakta yanına gelir
    if (!g.wait && d > 520 && !this.onScreen(e.x, e.y, 40)) {
      const s = this.insideB ? this.findSpawnPos(gx, gy, 0, 30) : this.guardEdge(gx, gy);
      if (s) { e.x = s[0]; e.y = s[1]; e.nav = null; e.rr = null; e.gGoal = null; }
      return;
    }
    if (d <= stop) {
      e.mv = 0; e.spd = 0;
      // dururken çevreyi kollar (sana arkası dönük); öteki korumayla üst üste durmaz
      if (!g.wait && !this.insideB) e.ang = turnTo(e.ang, Math.atan2(e.y - P.y, e.x - P.x), dt * 2);
      for (const o of this.guards) if (o !== g && o.ent && dist2(o.ent.x, o.ent.y, e.x, e.y) < 12 * 12) { e.walk(dt, 20, Math.atan2(e.y - o.ent.y, e.x - o.ent.x)); break; }
      return;
    }
    const sp = e.mounted ? (d > 180 ? 150 : d > 90 ? 110 : 60) : (d > 90 ? 64 : 36);
    // yakındaysa doğrudan ya da kasaba içinde yol bularak; uzaksa yolları izleyerek
    if (d > 260) { this.mentorFollow(e, this.guardGoal(e, gx, gy, !!e.mounted), dt, sp); return; }
    if (e.mounted) { e.ang = turnTo(e.ang, Math.atan2(gy - e.y, gx - e.x), dt * 4); e.walk(dt, sp); return; }
    const r = this.navStep(e, gx, gy, dt, sp, { near: stop });
    if (r === 'fail' && !this.onScreen(e.x, e.y, 20)) { const s = this.findSpawnPos(gx, gy, stop, stop + 30); if (s) { e.x = s[0]; e.y = s[1]; e.nav = null; } }
  },
  /* Uzak hedef seyrek güncellenir (rota her karede yeniden hesaplanmasın) */
  guardGoal(e, x, y, ride) {
    const G0 = e.gGoal;
    if (!G0 || G0.ride !== ride || dist(G0.x, G0.y, x, y) > 80) e.gGoal = { x, y, ride };
    return e.gGoal;
  },

  /* ---------------- konuşma ---------------- */
  guardActions(e) {
    const g = e.guard;
    if (!g) return [];
    return [
      g.wait ? { n: Tr('Peşimden Gel'), mt: 1, fn: () => { g.wait = null; e.say(pick(GUARD_LINES.follow), 2); } }
        : { n: Tr('Burada Bekle'), mt: 1, fn: () => { g.wait = { x: Math.round(e.x), y: Math.round(e.y) }; e.mounted = null; e.say(pick(GUARD_LINES.wait), 2); } },
      { n: Tr('İşine Son Ver'), mt: 1, fn: () => UI.confirm(Tr('İşine Son Ver'), Tr`${g.name} ile yollarını ayırmak istiyor musun? Peşin ödediğin bedel geri gelmez.`, () => this.guardLeave(g, 'fired')) },
    ];
  },
  guardStatus(g) {
    const T = GUARD_TRAITS[g.trait], e = g.ent;
    const hp = Math.round(100 * clamp((e && !e.dead ? e.hp : g.hp) / T.hp, 0, 1));
    return g.wait ? Tr`Bir yeri tutuyor · Can %${hp}` : Tr`Peşinde · Can %${hp}`;
  },

  /* ---------------- kayıt ---------------- */
  saveGuards() { return this.guards.map(g => ({ id: g.id, name: g.name, look: g.look, trait: g.trait, hp: Math.round(g.ent && !g.ent.dead ? g.ent.hp : g.hp), unpaid: g.unpaid, since: g.since, wait: g.wait, hits: g.hits || 0 })); },
  loadGuards(d) { this.guards = (d || []).filter(g => GUARD_TRAITS[g.trait]).map(g => Object.assign({ hits: 0, wait: null }, g, { ent: null })); },
};
