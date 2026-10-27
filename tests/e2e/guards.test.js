'use strict';
/* Korumalar (js/guards.js): nüfuzla tutulur (saloonda), peşinden gelir, binada kapıda bekler, uzakta kalınca yanına
   gelir, atlıyken atlıdır; haydutlara ateş eder, vurduğu haydut onu hedef alır; arada masum varken ateş etmez; kanuna
   kendiliğinden ateş etmez, direnişte yalnızca sadık savaşır, öteki çatışma büyüyünce gider; kanuna koşan tanığı
   susturur; ücret ödenmezse gider; oyuncu vurursa gider; kayıt. */
module.exports = {
  name: 'Korumalar',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => {
      G.godMode = true;
      window.wait = (ms) => new Promise(r => setTimeout(r, ms));
      window.WITH_RANDOM = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
      window.GUARD = () => G.guards[0] && G.guards[0].ent;
      // açık bir yer; korumalar dışındaki NPC'ler ve hayvanlar temizlenir
      window.OPEN = () => {
        const s = TH.openSpot(); TH.goto(s[0], s[1]);
        for (const e of G.ents) if ((e.kind === 'npc' && !e.guard) || e.kind === 'animal') e.remove = true;
        G.ents = G.ents.filter(e => !e.remove);
        if (G.horse) { G.horse.x = s[0] + 600; G.horse.y = s[1]; }
        return s;
      };
    });

    await t.step('koruma tutmak için nüfuz gerekir; saloonda adaylar, peşin bedel, nüfuza göre en çok sayı', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        const sal = G.world.buildings.find(b => b.type === 'saloon');
        G.player.money = 5000; G.bank = 0; G.honor = 0;
        out.lv1 = G.infLv(G.influence());
        UI.openBuilding(sal); out.menu = TH.menuLabels();
        TH.clickItem(/Koruma Tut/); out.cands = TH.menuLabels(); out.why = G.guardWhy();
        UI.closeAll();
        G.player.money = 40000; G.honor = 40;
        out.lv2 = G.infLv(G.influence()); out.max = G.guardMax();
        UI.openBuilding(sal); TH.clickItem(/Koruma Tut/);
        const m0 = G.player.money, c = G.guardCandidates(G.world.towns.find(x => x.id === sal.town))[0];
        TH.clickItem(new RegExp(c.name));
        out.hired = G.guards.map(g => g.name); out.paid = m0 - G.player.money; out.fee = G.guardFee(c.trait);
        out.after = TH.menuLabels(); out.whyFull = G.guardWhy();
        UI.closeAll();
        out.ent = !!GUARD() && GUARD().guard === G.guards[0];
        return out;
      });
      t.eq(r.lv1, 1, 'tanınmış'); t.ok(r.menu.some(l => /Koruma Tut/.test(l)), 'saloonda seçenek', r.menu);
      t.ok(r.cands.length >= 2 && /Nüfuzlu/.test(r.why), 'adaylar görünür, nüfuz yetmez', r);
      t.eq(r.lv2, 2, 'nüfuzlu'); t.eq(r.max, 1, 'nüfuzlu en çok 1 koruma');
      t.eq(r.hired.length, 1, 'koruma tutuldu'); t.near(r.paid, r.fee, 0.01, 'peşin bedel');
      t.ok(r.after[0].startsWith(r.hired[0]) && r.after.length === 3, 'listede koruman ve kalan adaylar', r.after);
      t.ok(/en çok 1/.test(r.whyFull), 'sınır', r.whyFull);
      t.ok(r.ent, 'koruma dünyada');
    });

    await t.step('peşinden gelir; uzakta kalınca yanına gelir; atlıyken atlıdır', async () => {
      const r = await p.evaluate(async () => {
        const out = {}, P = G.player;
        const s = OPEN();
        GUARD().x = s[0] + 150; GUARD().y = s[1] + 40; GUARD().nav = null;
        await wait(4000);
        out.near = dist(GUARD().x, GUARD().y, P.x, P.y);
        // uzak bir yere (tren, yolculuk): görünmeden yanına gelir
        const s2 = TH.openSpot(s[0] + 3000, s[1]); TH.goto(s2[0], s2[1]);
        await wait(1500);
        out.far = dist(GUARD().x, GUARD().y, P.x, P.y);
        // atlı
        G.horse.x = P.x + 10; G.horse.y = P.y; P.mount(G.horse, true);
        await wait(800);
        out.mounted = !!GUARD().mounted;
        P.dismount();
        GUARD().x = P.x + 300; GUARD().y = P.y; await wait(300);
        await wait(3500);
        out.dismounted = !GUARD().mounted;
        return out;
      });
      t.ok(r.near < 80, 'peşinden geldi', r.near);
      t.ok(r.far < 520, 'uzakta kalınca yanına geldi', r.far);
      t.ok(r.mounted, 'atlıyken atlı'); t.ok(r.dismounted, 'inince yaya');
    });

    await t.step('haydutlara ateş eder, vurduğu haydut onu hedef alır; arada masum varken ateş etmez', async () => {
      const r = await p.evaluate(async () => {
        const out = {}, P = G.player;
        const s = OPEN(); const e = GUARD();
        // karabinalı koruma (keskin nişancının tek mermili tüfeği yavaş ateş eder)
        e.guard.trait = 'loyal'; e.weapon = 'repeater'; e.ammoInit();
        e.x = s[0] + 20; e.y = s[1] + 30; e.nav = null; e.cool = 0;
        const b = new NPC(s[0] + 150, s[1] + 10, 'bandit', { hostile: true, weapon: 'cattleman' }); b.aggro = true; G.addEnt(b);
        const hp0 = b.hp;
        let sawFoe = false, target = false;
        for (let k = 0; k < 160 && !b.dead; k++) { await wait(50); if (e.gTgt === b) target = true; if (b.foe === e) sawFoe = true; }
        out.target = target; out.hurt = b.dead || b.hp < hp0; out.foe = sawFoe;
        b.remove = true;
        // atış yolunda masum biri
        TH.clearNpcs();
        const g = G.guards[0]; g.ent = null; G.guardTick(); const e2 = GUARD();
        e2.x = s[0]; e2.y = s[1] + 60; e2.ang = 0;
        const tg = new NPC(s[0] + 120, s[1] + 60, 'bandit', { hostile: true }); tg.aggro = true; G.addEnt(tg);
        const by = new NPC(s[0] + 60, s[1] + 60, 'town', {}); G.addEnt(by);
        out.blocked = !G.guardClear(e2, tg, 120);
        by.x += 0; by.y += 40;
        out.clear = G.guardClear(e2, tg, 120);
        tg.remove = true; by.remove = true;
        return out;
      });
      t.ok(r.target, 'haydudu hedef aldı'); t.ok(r.hurt, 'haydudu vurdu', r);
      t.ok(r.foe, 'vurulan haydut korumayı hedef aldı');
      t.ok(r.blocked, 'arada masum varken ateş etmez'); t.ok(r.clear, 'yol açılınca eder');
    });

    await t.step('kanuna kendiliğinden ateş etmez; direnişte yalnızca sadık savaşır, öteki çatışma büyüyünce gider', async () => {
      const r = await p.evaluate(() => {
        const out = {}, P = G.player, L = G.law;
        OPEN();
        const e = GUARD(), g = e.guard;
        const cop = new NPC(P.x + 100, P.y, 'law', { hostile: true }); G.addEnt(cop);
        Object.assign(L, { level: 2, bounty: 30, resist: false, lastX: P.x, lastY: P.y, spawnT: 99 });
        const loyal = GUARD_TRAITS.loyal, other = GUARD_TRAITS.cheap;
        out.arrest = !!G.guardThreat(e, loyal, false);
        L.resist = true;
        out.loyal = G.guardThreat(e, loyal, true) === cop;
        out.other = !!G.guardThreat(e, other, true);
        // sadık olmayan koruma çatışma büyüyünce işi bırakır
        g.trait = 'cheap'; L.level = 3;
        G.guardNpc(e, 0.1);
        out.left = !G.guards.includes(g) && !e.guard;
        G.lawClear(); cop.remove = true;
        return out;
      });
      t.ok(!r.arrest, 'tutuklamada karışmaz'); t.ok(r.loyal, 'direnişte sadık kanun adamını hedef alır');
      t.ok(!r.other, 'öteki kanuna ateş etmez'); t.ok(r.left, 'çatışma büyüyünce gider');
    });

    await t.step('kanuna koşan tanığı susturur; ücret ödenmezse gider; vurursan gider; kayıtta korunur', async () => {
      const r = await p.evaluate(async () => {
        const out = {}, P = G.player;
        OPEN();
        G.player.money = 40000;
        const sal = G.world.buildings.find(b => b.type === 'saloon'), c = G.guardCandidates(G.world.towns.find(x => x.id === sal.town)).find(x => !G.guards.some(g => g.name === x.name));
        G.hireGuard(c); const e = GUARD(), g = e.guard;
        // tanık
        const LOS = G.los; G.los = () => true;
        const w = new NPC(P.x + 40, P.y, 'town', {}); G.addEnt(w);
        G.crime('robbery', P.x, P.y, null);
        G.los = LOS;
        out.witness = !!w.witness;
        e.x = w.x + 10; e.y = w.y; e.gHushT = 0;
        WITH_RANDOM(0.01, () => { G.guardHush(e, GUARD_TRAITS[g.trait], 0.1); G.guardHush(e, GUARD_TRAITS[g.trait], 0.1); });
        out.silenced = !!w.silenced; out.open = G.reports.filter(x => !x.done).length;
        G.lawClear(); G.law.bounty = 0; w.remove = true;
        // oyuncu vurursa: ilkinde uyarır, ikincisinde gider; suç yazılmaz
        const b0 = G.law.bounty;
        e.hurt(5, 'player', 'gun'); out.stay = G.guards.includes(g);
        e.hurt(5, 'player', 'gun'); out.gone = !G.guards.includes(g); out.crime = G.law.bounty - b0;
        // ücret: iki gün ödenmezse gider
        G.hireGuard(G.guardCandidates(G.world.towns.find(x => x.id === sal.town)).find(x => !G.guards.some(q => q.name === x.name)) || c);
        const g2 = G.guards[0];
        G.player.money = 0; G.bank = 0;
        G.guardDaily(); out.day1 = G.guards.includes(g2);
        G.guardDaily(); out.day2 = G.guards.includes(g2);
        // kayıt: koruma ve beklediği yer korunur
        G.player.money = 40000;
        G.hireGuard(G.guardCandidates(G.world.towns.find(x => x.id === sal.town))[0]);
        const g3 = G.guards[0]; g3.wait = { x: Math.round(P.x + 30), y: Math.round(P.y) };
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        await wait(600);
        out.loaded = G.guards.map(q => [q.name, !!q.wait]);
        out.name = g3.name;
        out.ent = !!(G.guards[0] && G.guards[0].ent && G.guards[0].ent.guard === G.guards[0]);
        out.dup = G.ents.filter(x => x.kind === 'npc' && x.guard && !x.dead && !x.remove).length;
        return out;
      });
      t.ok(r.witness, 'tanık kanuna koşuyor'); t.ok(r.silenced, 'koruma tanığı susturdu'); t.eq(r.open, 0, 'rapor kalmadı');
      t.ok(r.stay, 'ilk kurşunda kalır'); t.ok(r.gone, 'ikincide gider'); t.eq(r.crime, 0, 'kendi korumanı vurmak suç yazmaz');
      t.ok(r.day1, 'bir gün ödenmeyince kalır'); t.ok(!r.day2, 'iki gün ödenmeyince gider');
      t.eq(r.loaded, [[r.name, true]], 'kayıttan koruma ve beklediği yer');
      t.ok(r.ent, 'yüklenince dünyada'); t.eq(r.dup, 1, 'tek kopya');
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
