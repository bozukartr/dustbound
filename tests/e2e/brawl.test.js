'use strict';
/* Yumruk kavgası: kasabalıya yumruk hemen suç değildir; karakterine göre karşılık verir,
   uyarır ya da kaçar. Teslim olana, yere serilene ya da karşılık vermeyene vurmaya devam etmek suçtur.
   Dipçik, bıçak, kanun adamı ve çocuk her zaman suçtur. Özür dilenebilir. */
module.exports = {
  name: 'Yumruk kavgası ve özür',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      if (G.horse) { G.horse.x = s[0] + 300; G.horse.y = s[1]; }
      // sayfa içi yardımcılar: önüne bir kişi koy, yumrukla / dipçikle vur
      window.BR = {
        spawn(role, opts = {}) {
          if (!opts.keep) TH.clearNpcs();   // yumruk en yakındakine gider: önceki kişiler kalkar
          const P = G.player, n = new NPC(P.x + 11, P.y, role, Object.assign({ sex: 'm' }, opts));
          n.state = 'idle'; G.addEnt(n); return n;
        },
        face(n) { const P = G.player; n.x = P.x + 11; n.y = P.y; P.ang = 0; P.aiming = false; P.meleeCd = 0; },
        punch(n, bash) { BR.face(n); G.player.weapon = bash ? 'cattleman' : 'fists'; G.player.melee(!!bash); },
        grit(v) { G.brawlGrit = () => v; },
        gritReset() { G.brawlGrit = BrawlSystems.brawlGrit; },
        rnd(v) { Math.random = () => v; },
        rndReset() { Math.random = BR.orig; },
        orig: Math.random,
      };
      G.player.giveWeapon('cattleman', true);
      G.godMode = false; G.player.hp = G.player.maxHp;
    });

    await t.step('kavgacı biri yumruğa karşılık verir; karşılıklı dövüş suç sayılmaz', async () => {
      const r = await p.evaluate(() => {
        BR.grit(0.95); BR.rnd(0.2);
        const n = BR.spawn('town'); window.N1 = n;
        const h0 = G.honor;
        BR.punch(n);
        const a = { state: n.state, crime: !!n.assaulted, report: n.state === 'report' };
        for (let k = 0; k < 2; k++) BR.punch(n);
        BR.rndReset();
        return { a, state: n.state, crime: !!n.assaulted, hits: n.brawl.hits, fought: n.brawl.fought, dh: G.honor - h0 };
      });
      t.eq(r.a.state, 'fightFist', 'ilk yumrukta karşılık verdi');
      t.ok(!r.a.crime && !r.crime, 'suç yazılmadı', r);
      t.eq(r.state, 'fightFist', 'dövüş sürüyor'); t.eq(r.hits, 3, 'üç yumruk sayıldı'); t.ok(r.fought, 'karşılıklı');
      t.ok(r.dh > -1.5, 'onur yalnızca biraz düşer', r.dh);
    });

    await t.step('kavgacı da yumruk atar; oyuncu yere serilir ama ölmez, kavga biter', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player; P.hp = 14;
        N1.x = P.x + 10; N1.y = P.y; N1.cool = 0;
        for (let k = 0; k < 40 && N1.state === 'fightFist'; k++) { N1.cool = Math.min(N1.cool, 0); N1.x = P.x + 10; N1.y = P.y; await new Promise(r => setTimeout(r, 50)); }
        return { hp: P.hp, dead: G.state !== 'play', state: N1.state, won: N1.brawl.won };
      });
      t.ok(!r.dead && r.hp >= 7, 'oyuncu ölmedi', r);
      t.ok(r.won && r.state === 'glare', 'kazanan kavgayı bitirdi', r);
      await p.evaluate(() => { G.player.hp = G.player.maxHp; });
    });

    await t.step('kavgayı kaybeden teslim olur; teslim olana vurmaya devam etmek saldırı suçudur', async () => {
      const r = await p.evaluate(async () => {
        BR.grit(0.95); BR.rnd(0.2);
        const n = BR.spawn('town'); window.N2 = n;
        G.godMode = true;
        BR.punch(n);
        // oyundaki gibi yumruklar arasında kareler geçer (teslim olma kararı karede verilir)
        for (let k = 0; k < 12 && n.state === 'fightFist'; k++) { await new Promise(r => setTimeout(r, 120)); if (n.state === 'fightFist') BR.punch(n); }
        G.godMode = false;
        const a = { state: n.state, yielded: n.brawl.yielded, crime: !!n.assaulted, hp: n.hp };
        BR.punch(n);
        BR.rndReset();
        return { a, crime: !!n.assaulted, state: n.state };
      });
      t.ok(r.a.yielded && r.a.state === 'glare' && !r.a.crime, 'teslim oldu, suç yok', r.a);
      t.ok(r.crime, 'teslim olana vurmak suç', r);
    });

    await t.step('sakin biri karşılık vermez: ilk iki yumruk suç değil, üçüncüsü saldırı', async () => {
      const r = await p.evaluate(() => {
        BR.grit(0.02); BR.rnd(0.3);
        const n = BR.spawn('town', { sex: 'f' });
        BR.punch(n);
        const a = { state: n.state, crime: !!n.assaulted };
        BR.rnd(0.99); BR.punch(n);
        const b = { state: n.state, crime: !!n.assaulted };
        BR.punch(n);
        BR.rndReset();
        return { a, b, crime: !!n.assaulted, state: n.state };
      });
      t.ok(r.a.state === 'glare' && !r.a.crime, 'önce öfkeyle uyarır', r.a);
      t.ok(r.b.state === 'flee' && !r.b.crime, 'ikinci yumrukta kaçar, hâlâ suç değil', r.b);
      t.ok(r.crime, 'üçüncü yumruk saldırı suçu', r);
    });

    await t.step('kavga bittikten sonra karşılık vermeyen kişiyi dövmeye devam etmek de suç olur', async () => {
      const r = await p.evaluate(() => {
        BR.grit(0.95); BR.rnd(0.2);
        const n = BR.spawn('town'); BR.punch(n);
        n.state = 'glare'; n.t = 5;           // kavga bitti (ör. oyuncuyu yere serdi)
        BR.grit(0.02); BR.rnd(0.99);
        BR.punch(n); const a = !!n.assaulted;
        BR.punch(n); const b = !!n.assaulted;
        BR.punch(n);
        BR.rndReset();
        return { a, b, c: !!n.assaulted };
      });
      t.ok(!r.a && !r.b && r.c, 'üçüncü karşılıksız yumruk suç', r);
    });

    await t.step('kişilik belirler: huysuz hamal kavgaya yatkın, dindar ve utangaç değil', async () => {
      const r = await p.evaluate(() => {
        BR.gritReset();   // gerçek hesap
        const mk = (mood, occ, sex) => { const n = BR.spawn('town', { sex }); n.res = { id: 'tr' + mood + occ + sex, name: n.name, occ, mood }; G.ents.splice(G.ents.indexOf(n), 1); return G.brawlGrit(n); };
        return { grumpy: mk('grumpy', 'laborer', 'm'), pious: mk('pious', 'elder', 'm'), shy: mk('shy', 'homemaker', 'f'), plain: mk('plain', 'keeper', 'm') };
      });
      t.ok(r.grumpy > 0.8, 'huysuz hamal', r); t.ok(r.pious < 0.1 && r.shy < 0.1, 'dindar emekli ve utangaç ev hanımı', r);
      t.ok(r.plain > r.pious && r.plain < r.grumpy, 'sakin esnaf arada', r);
    });

    await t.step('dipçik, kanun adamı ve çocuk: her zaman suç', async () => {
      const r = await p.evaluate(() => {
        BR.grit(0.95); BR.rnd(0.2);
        const a = BR.spawn('town'); BR.punch(a, true); const bash = !!a.assaulted && a.state !== 'fightFist';
        const law = BR.spawn('law'); BR.punch(law); const lw = !!law.assaulted && law.hostile;
        const kid = BR.spawn('town'); kid.res = { id: 'kid1', name: kid.name, occ: 'kid', mood: 'jolly' }; BR.punch(kid);
        BR.rndReset();
        return { bash, law: lw, kid: !!kid.assaulted };
      });
      t.ok(r.bash, 'dipçik darbesi saldırı', r); t.ok(r.law, 'kanun adamına yumruk suç', r); t.ok(r.kid, 'çocuğa yumruk suç', r);
    });

    await t.step('özür dile: kabul edilirse kavga biter; reddedilirse bir süre tekrar denenemez; suçtan sonra yok', async () => {
      const r = await p.evaluate(async () => {
        const has = (n) => G.npcActions(n).some(a => a.n === Tr('Özür Dile'));
        const sorry = (n) => G.npcActions(n).find(a => a.n === Tr('Özür Dile')).fn();
        BR.grit(0.95); BR.rnd(0.2);
        const n = BR.spawn('town'); BR.punch(n);
        const fighting = n.state;
        const before = has(n);
        BR.rnd(0.01); sorry(n);
        await new Promise(r => setTimeout(r, 1100));
        const acc = { state: n.state, sorry: n.brawl.sorry, after: has(n) };
        // reddeden
        BR.grit(0.02); BR.rnd(0.3);
        n.x = G.player.x - 120; const m = BR.spawn('town', { keep: true }); BR.punch(m);
        BR.rnd(0.999); sorry(m);
        await new Promise(r => setTimeout(r, 1100));
        const rej = { sorry: !!m.brawl.sorry, again: has(m) };
        // suçtan sonra özür seçeneği yok
        BR.rnd(0.99); BR.punch(m); BR.punch(m);
        const crime = { assaulted: !!m.assaulted, has: has(m) };
        BR.rndReset();
        return { fighting, before, acc, rej, crime };
      });
      t.eq(r.fighting, 'fightFist', 'kavga başladı');
      t.ok(r.before, 'kavgada "Özür Dile" seçeneği var');
      t.ok(r.acc.sorry && r.acc.state === 'idle' && !r.acc.after, 'özür kabul: kavga bitti, seçenek kalktı', r.acc);
      t.ok(!r.rej.sorry && !r.rej.again, 'özür reddedildi, hemen tekrar denenemez', r.rej);
      t.ok(r.crime.assaulted && !r.crime.has, 'suçtan sonra özür yok', r.crime);
    });

    await t.step('uzaklaşınca kavga sakinleşir; gerçek tuşla yumruk da kavga başlatır', async () => {
      const r = await p.evaluate(async () => {
        BR.grit(0.95); BR.rnd(0.2);
        const n = BR.spawn('town'); BR.punch(n);
        BR.rndReset();
        const P = G.player; n.x = P.x + 120; n.y = P.y; n.calmT = 6.5;
        await new Promise(r => setTimeout(r, 300));
        const calm = n.state;
        const m = BR.spawn('town'); BR.face(m); P.weapon = 'fists'; BR.grit(0.95); BR.rnd(0.2); window.N3 = m;
        return { calm };
      });
      t.ok(r.calm === 'idle' || r.calm === 'walk', 'uzaklaşınca sakinleşti', r);
      await p.keyboard.press('KeyF'); await t.sleep(150);
      const k = await p.evaluate(() => { BR.rndReset(); return { state: N3.state, crime: !!N3.assaulted, hits: N3.brawl && N3.brawl.hits }; });
      t.ok(k.hits === 1 && k.state === 'fightFist' && !k.crime, 'tuşla yumruk: kavga, suç yok', k);
    });
  },
};
