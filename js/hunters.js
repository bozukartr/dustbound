'use strict';
/* ==========================================================
   FRONTIER'S END — ödül avcıları (G nesnesine eklenir)
   - Başında kendi adına ödül varken, kanun peşini bırakmış olsa
     bile, kasaba dışında zaman zaman 2–4 kişilik bir grup çıkar.
     Ödül büyüdükçe daha sık ve daha kalabalık gelirler.
   - Önce yaklaşıp seslenirler ve bir süre bekler: teslim olabilir,
     parayla kurtulabilir (ödül başında kalır) ya da kaçıp ateş
     açabilirsin. Kaçmak, onlara nişan almak ya da beklemek
     çatışmayı başlatır.
   - Onları vurmak suç değildir; cesetlerinden para çıkar.
   ========================================================== */

const HUNTER_MIN = 20;          // bu ödülün altında kimse zahmet etmez
const HUNTER_LINES = {
  demand: ['Başında {b} ödül var, {ad}. Sağ ya da ölü, fark etmez. Silahını bırak!', '{ad}! Afişteki yüz sensin. {b} ödül… Teslim ol, kimse ölmesin.', 'Yakaladık seni, {ad}. {b} için seni şerife götürüyoruz. Ya da cesedini.'],
  last: ['Son kez söylüyorum!', 'Sabrımız tükeniyor.', 'Düşünme süren bitiyor!'],
  fight: ['Madem öyle… Vurun!', 'Ölüsü de aynı parayı eder!', 'Yakalayın onu!'],
  paid: ['Bu para bize yeter. Seni görmedik.', 'Akıllıca. Yolun açık olsun… şimdilik.'],
  surrender: ['Akıllıca. Şerife gidiyoruz.', 'Eller arkaya. Yavaşça.'],
};

const HunterSystems = {
  hunterLine(kind) {
    return this.fmtLine(pick(HUNTER_LINES[kind])).replace('{b}', fmtMoney(this.law.bounty));
  },
  /* Her karede: grup yoksa arada bir çıkma olasılığına bakılır */
  hunterTick(dt) {
    if (this.posse) { this.posseTick(dt); return; }
    const L = this.law, P = this.player;
    if ((this._huntChk = (this._huntChk || 0) - dt) > 0) return;
    this._huntChk = 5;   // ≈ 11 oyun dakikası
    if (L.bounty < HUNTER_MIN) { L.hunterNext = undefined; return; }
    if (this.state !== 'play' || L.level > 0) return;
    if (L.hunterNext === undefined) { L.hunterNext = this.clock + 360; return; }   // ödül yazıldıktan sonra birkaç saat haber yayılır
    if (this.clock < L.hunterNext) return;
    if (this.world.townAt(P.x, P.y, 60) || this.insideB || UI.isModal()) return;
    const perHour = clamp(0.05 + L.bounty / 800, 0.05, 0.35);
    if (chance(perHour / 5.5)) this.hunterSpawn();
  },
  hunterSpawn() {
    const L = this.law, P = this.player;
    const base = this.findSpawnPos(P.x, P.y, 420, 560);
    if (!base) return false;
    const n = L.bounty < 60 ? 2 : L.bounty < 150 ? 3 : 4;
    const mounted = P.riding ? true : chance(0.5);
    const ents = [];
    for (let k = 0; k < n; k++) {
      const pos = this.findSpawnPos(base[0], base[1], 8, 50) || base;
      const h = new NPC(pos[0], pos[1], 'hunter', { mounted, hp: 100, weapon: pick(['repeater', 'cattleman', 'shotgun', 'repeater']), money: rnd(1, 6) });
      h.keep = true; h.slot = k;
      this.addEnt(h); ents.push(h);
    }
    this.posse = { ents, phase: 'approach', t: 0, warnT: 0, aimT: 0 };
    L.hunterNext = this.clock + 1440 * 1.5;
    UI.toast(Tr('Ödül Avcıları'), Tr`Başındaki ${fmtMoney(L.bounty)} ödül birilerinin iştahını kabarttı. ${n} avcı sana doğru geliyor.`, 'bounty');
    Audio_.ui('error');
    return true;
  },
  posseTick(dt) {
    const S = this.posse, P = this.player;
    S.ents = S.ents.filter(e => !e.remove);
    const alive = S.ents.filter(e => !e.dead && !e.bound);
    if (!alive.length) {
      for (const e of S.ents) e.keep = false;
      this.posse = null;
      if (S.phase !== 'leave') {
        this.stat('huntersBeaten', 1);
        UI.toast(Tr('Ödül Avcıları Püskürtüldü'), Tr('Peşindeki avcılar artık kimseyi rahatsız etmeyecek. Ama ödül hâlâ başında.'), 'bounty');
      }
      return;
    }
    if (S.phase === 'leave') {
      if (alive.every(e => dist(e.x, e.y, P.x, P.y) > 700)) { for (const e of S.ents) { e.keep = false; if (!e.dead) e.remove = true; } this.posse = null; }
      return;
    }
    if (this.state !== 'play' || P.hp <= 0) { this.posseLeave(); return; }
    if (this.law.bounty < 1 && S.phase !== 'fight') { this.posseLeave(); return; }
    S.t += dt;
    const lead = alive[0], pd = dist(lead.x, lead.y, P.x, P.y);
    if (S.phase === 'approach') {
      if (pd < 130) {
        S.phase = 'standoff'; S.warnT = 11;
        const line = this.hunterLine('demand');
        lead.say(line, 5); UI.subtitle(lead.name + ' · ' + Tr('Ödül Avcısı'), line, 5);
        this.hintOnce('hunters', Tr`Ödül avcıları seni sıkıştırdı. Yanlarına gidip ${Input.glyph('interact')} ile <b>teslim olabilir</b> ya da <b>parayla kurtulabilirsin</b>. Kaçarsan, onlara nişan alırsan ya da beklersen ateş açarlar.`, 10);
      } else if (S.t > 70) this.hunterFight();
      return;
    }
    if (S.phase === 'standoff') {
      S.warnT -= dt;
      // oyuncu onlardan birine nişan alıyorsa
      const aimed = P.aiming && alive.some(e => Math.abs(angDiff(P.aimAng === undefined ? P.ang : P.aimAng, Math.atan2(e.y - P.y, e.x - P.x))) < 0.3);
      S.aimT = aimed ? S.aimT + dt : Math.max(0, S.aimT - dt);
      if (pd > 280 || S.aimT > 1.2 || S.warnT <= 0) { this.hunterFight(); return; }
      if (S.warnT < 5 && !S.warned) { S.warned = true; lead.say(this.hunterLine('last'), 3); }
    }
  },
  hunterFight() {
    const S = this.posse;
    if (!S || S.phase === 'fight') return;
    S.phase = 'fight';
    const alive = S.ents.filter(e => !e.dead && !e.bound);
    if (alive[0]) alive[0].say(this.hunterLine('fight'), 2.5);
    for (const e of alive) { e.hostile = true; e.aggro = true; e.cool = rnd(0.4, 1.2); }
    UI.feed(Tr('Ödül avcıları ateş açtı!'), 'law');
  },
  posseLeave(line) {
    const S = this.posse;
    if (!S) return;
    S.phase = 'leave';
    for (const e of S.ents) { e.hostile = false; e.aggro = false; }
    const lead = S.ents.find(e => !e.dead);
    if (lead && line) lead.say(this.hunterLine(line), 3);
  },
  /* NPC.update içinden: avcının hareketi */
  hunterUpdate(n, dt, pd) {
    const S = this.posse, P = this.player;
    if (!S || !S.ents.includes(n)) { n.remove = true; return; }
    const a = Math.atan2(P.y - n.y, P.x - n.x);
    if (S.phase === 'fight') { if (P.hp > 0) n.fight(dt, pd); return; }
    if (S.phase === 'leave') {
      n.ang = turnTo(n.ang, a + Math.PI, dt * 3);
      n.walk(dt, n.mounted ? 110 : 45);
      if (!n.mounted) { n.mv = 0.8; n.phase += dt * 8; }
      return;
    }
    if (S.phase === 'approach') {
      // yelpaze gibi açılarak yaklaşırlar
      const spread = (n.slot - (S.ents.length - 1) / 2) * 0.35;
      if (pd > 100) {
        n.ang = turnTo(n.ang, a + spread, dt * 4);
        n.walk(dt, n.mounted ? 115 : 58);
        if (!n.mounted) { n.mv = 1; n.phase += dt * 10; }
        if (n.stuck > 0.6) { n.ang += rnd(-1.5, 1.5); n.stuck = 0; }
      } else { n.mv = 0; n.spd = 0; n.ang = turnTo(n.ang, a, dt * 6); }
      return;
    }
    // bekleyiş: yüzü oyuncuya dönük, silah elde
    n.mv = 0; n.spd = 0;
    n.ang = turnTo(n.ang, a, dt * 6);
    if (pd < 60) n.walk(dt, 30, a + Math.PI);
  },
  /* Bekleyiş sırasında avcıyla konuşma */
  hunterActions(e) {
    const S = this.posse;
    if (!S || S.phase !== 'standoff' || !S.ents.includes(e)) return [];
    const pay = Math.max(5, Math.round(this.law.bounty * 0.6));
    return [
      { n: Tr('Teslim Ol'), hold: 0.7, fn: () => { e.say(this.hunterLine('surrender'), 3); this.posseLeave(); this.surrender(e); } },
      { n: Tr`Parayla Kurtul (${fmtMoney(pay)})`, fn: () => {
        if (!this.spend(pay)) return;
        this.posseLeave('paid');
        this.addHonor(-1);
        UI.feed(Tr`💰 Avcılara ${fmtMoney(pay)} verdin. Ödül hâlâ başında.`, 'law');
      } },
    ];
  },
};
