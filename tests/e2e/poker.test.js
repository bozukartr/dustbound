'use strict';
/* Poker (beş kart çekmeli): el değerlendirme, masa, klavye ve fareyle el, çekilme, günlük rakipler */
module.exports = {
  name: 'Poker',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      G.godMode = true; Poker.speed = 25;
      window.PK = {
        saloon: () => G.world.buildings.find(b => b.type === 'saloon'),
        top: () => UI.top() && UI.top().poker,
        total: () => Math.round(G.player.money * 100) + PK.top().table.opps.reduce((a, o) => a + o.stack, 0) + PK.top().pot,
      };
    });
    await t.step('el değerlendirme: bütün kategoriler, as-5 kenti, eşitlik bozma', async () => {
      const r = await p.evaluate(() => {
        const H = s => s.split(' ').map(x => ({ r: { A: 1, K: 13, Q: 12, J: 11, T: 10 }[x[0]] || +x[0], s: 'shcd'.indexOf(x[1]) }));
        const cat = s => Poker.evalHand(H(s))[0];
        const cmp = (a, b) => Math.sign(Poker.cmp(Poker.evalHand(H(a)), Poker.evalHand(H(b))));
        return {
          cats: ['As Ks Qs Js Ts', '9h 8h 7h 6h 5h', '9s 9h 9c 9d 2s', '3s 3h 3c 2d 2s', 'As 9s 7s 4s 2s', 'Ah 2s 3c 4d 5h', '7s 7h 7c Kd 2s', '7s 7h Kc Kd 2s', '7s 7h Qc Kd 2s', 'As Jh 9c 6d 3s'].map(cat),
          wheel: cmp('Ah 2s 3c 4d 5h', '2h 3s 4c 5d 6h'),
          kicker: cmp('7s 7h Ac 4d 2s', '7c 7d Kc Qd Js'),
          twoPair: cmp('Ks Kh 3c 3d 2s', 'Qs Qh Jc Jd As'),
          tie: cmp('As Kh 9c 6d 3s', 'Ah Kc 9d 6s 3h'),
          name: Poker.handName(H('3s 3h 3c 2d 2s')),
          plan: Poker.drawPlan(H('7s 7h Kc 4d 2s')).length,
          flushDraw: Poker.drawPlan(H('As 9s 7s 4s 2h')),
          min: Poker.minStack(10),
        };
      });
      t.eq(r.cats, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0], 'el kategorileri');
      t.eq(r.wheel, -1, 'A-2-3-4-5 kenti 6\'lı kentten küçük');
      t.eq(r.kicker, 1, 'eş perde yüksek yan kart kazanır');
      t.eq(r.twoPair, 1, 'KK33 > QQJJ');
      t.eq(r.tie, 0, 'aynı değerler berabere');
      t.eq(r.name, 'Ful', 'el adı');
      t.eq(r.plan, 3, 'perle 3 kart değişir');
      t.eq(r.flushDraw, [4], 'renge bir kart kala tek kart değişir');
      t.eq(r.min, 190, 'masaya oturmak için gereken en az para');
    });
    await t.step('saloon, kumarhane ve cantinada kart masasında poker var', async () => {
      const r = await p.evaluate(() => ['saloon', 'gambling', 'cantina'].map(type => {
        const b = G.world.buildings.find(x => x.type === type);
        if (!b) return type + ': yok';
        const table = (G.furnActions(b, O.CARDTABLE) || { acts: [] }).acts.some(a => /Poker/.test(a.n));
        const menu = UI.svcItems(b, 'poker').some(i => /Poker/.test(i.label));
        return table && menu ? '' : type + ': poker yok';
      }).filter(Boolean));
      t.eq(r, [], 'poker her üç yerde de olmalı');
    });
    await t.step('klavyeyle bir el: dağıt, gör, kart değiştir, sonuç; para korunur', async () => {
      // rakipler hep görsün ki kart değiştirme ve el gösterme kesin yaşansın
      await p.evaluate(() => {
        PK.aiAct = Poker.aiAct;
        Poker.aiAct = (st) => { const i = Poker.toAct(st); if (i < 0 || st.seats[i].me) return false; Poker.act(st, i, 'call'); return true; };
        TH.inside(PK.saloon()); G.player.money = 20; UI.openPoker(PK.saloon());
      });
      await t.sleep(200);
      const t0 = await p.evaluate(() => ({ total: PK.total(), clock: G.clock }));
      await p.keyboard.press('Enter'); await t.sleep(300);
      t.ok(await p.evaluate(() => PK.top().phase !== 'idle'), 'Enter eli dağıtmalı');
      let swapped = false;
      for (let n = 0; n < 200; n++) {
        const s = await p.evaluate(() => { const st = PK.top(); return { ph: st.phase, turn: Poker.toAct(st), folded: st.seats[0].folded }; });
        if (s.ph === 'idle') break;
        if (s.ph === 'draw' && !s.folded) {
          await p.keyboard.press('Enter'); await t.sleep(60); await p.keyboard.press('ArrowRight'); await t.sleep(60); await p.keyboard.press('Enter'); await t.sleep(60);
          t.eq(await p.evaluate(() => PK.top().sel.size), 2, 'iki kart seçilmeli');
          await p.keyboard.press('KeyX'); swapped = true;
        } else if (s.turn === 0) await p.keyboard.press('Enter');
        await t.sleep(80);
      }
      const r = await p.evaluate(() => { Poker.aiAct = PK.aiAct; const st = PK.top(); return { ph: st.phase, msg: st.msg, pot: st.pot, total: PK.total(), drew: st.seats[0].drew, reveal: st.reveal, shown: document.querySelectorAll('.pk-seat .card.sm:not(.back)').length, clock: G.clock, hands: st.seats.filter(s => s.hand.length === 5).length }; });
      t.eq(r.ph, 'idle', 'el bitmeli');
      t.ok(r.msg, 'sonuç yazılmalı');
      t.eq(r.pot, 0, 'pot dağıtılmalı');
      t.near(r.total, t0.total, 0.5, 'masadaki toplam para korunmalı');
      t.ok(r.clock > t0.clock, 'zaman ilerlemeli');
      t.eq(r.hands, 4, 'herkeste beş kart');
      t.ok(swapped, 'kart değiştirme aşaması gelmeli'); t.eq(r.drew, 2, 'iki kart değişmeli');
      t.ok(r.reveal && r.shown === 15, 'el gösterilince rakiplerin kartları açılmalı', r.shown);
    });
    await t.step('fareyle kart seçilir ve çekilinir; yalnızca koyduğun para gider', async () => {
      await p.evaluate(() => { PK.top().msg = ''; Poker.aiAct = (st) => { const i = Poker.toAct(st); if (i < 0 || st.seats[i].me) return false; Poker.act(st, i, 'call'); return true; }; });
      await p.click('.pk-b[data-a="deal"]');
      await t.sleep(200);
      for (let n = 0; n < 100; n++) {
        const s = await p.evaluate(() => { const st = PK.top(); return { ph: st.phase, turn: Poker.toAct(st) }; });
        if (s.ph === 'idle' || s.ph === 'draw') break;
        if (s.turn === 0) await p.click('.pk-b[data-a="call"]');
        await t.sleep(60);
      }
      const r = await p.evaluate(() => ({ ph: PK.top().phase }));
      if (r.ph === 'draw') {
        await p.click('.pk-slot[data-i="0"]'); await p.click('.pk-slot[data-i="4"]');
        t.eq(await p.evaluate(() => [...PK.top().sel].sort()), [0, 4], 'tıklanan kartlar seçilmeli');
        await p.click('.pk-slot[data-i="4"]');
        t.eq(await p.evaluate(() => [...PK.top().sel]), [0], 'ikinci tık seçimi kaldırır');
        await p.evaluate(() => { Poker.aiAct = PK.aiAct; });
        await p.click('.pk-b[data-a="draw"]');
        for (let n = 0; n < 100 && await p.evaluate(() => PK.top().phase !== 'idle' && Poker.toAct(PK.top()) !== 0); n++) await t.sleep(60);
      }
      t.eq(r.ph, 'draw', 'kart değiştirme aşamasına gelinmeli');
      const st = await p.evaluate(() => ({ ph: PK.top().phase, m0: G.player.money, put: PK.top().seats[0].total }));
      if (st.ph !== 'idle') {
        await p.click('.pk-b[data-a="fold"]');
        for (let n = 0; n < 150 && await p.evaluate(() => PK.top().phase !== 'idle'); n++) await t.sleep(60);
        const e = await p.evaluate(() => ({ ph: PK.top().phase, m: G.player.money, folded: PK.top().seats[0].folded, total: PK.top().seats[0].total, win: PK.top().seats[0].win }));
        t.eq(e.ph, 'idle', 'el bitmeli'); t.ok(e.folded && !e.win, 'çekilmiş olmalı');
        t.near(e.m, st.m0, 0.001, 'çekilince fazladan para gitmez');
      }
    });
    await t.step('elin ortasında masadan kalkılır; rakipler ve paraları gün boyu kalır, kayıtla korunur', async () => {
      const r = await p.evaluate(async () => {
        const st = PK.top(), before = PK.total();
        st.msg = ''; UI.top().pokerAct('deal');
        const inHand = st.phase !== 'idle';
        UI.top().pokerAct('leave');
        const closed = !UI.top() || !UI.top().poker;
        const tbl = G.pokerTable(PK.saloon());
        const after = Math.round(G.player.money * 100) + tbl.opps.reduce((a, o) => a + o.stack, 0);
        const names = tbl.opps.map(o => o.name).join();
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const t2 = G.pokerTable(G.world.buildings.find(b => b.type === 'saloon'));
        return { inHand, closed, before, after, same: t2.opps.map(o => o.name).join() === names, stacks: t2.opps.map(o => o.stack).join() === tbl.opps.map(o => o.stack).join() };
      });
      t.ok(r.inHand, 'el başlamış olmalı'); t.ok(r.closed, 'masa kapanmalı');
      t.near(r.after, r.before, 0.5, 'kalkınca para korunmalı');
      t.ok(r.same && r.stacks, 'kayıttan sonra aynı rakipler aynı paralarla');
    });
    await t.step('masadaki herkes batınca kimse kalmaz; ertesi gün yeni oyuncular gelir', async () => {
      const r = await p.evaluate(() => {
        const b = G.world.buildings.find(x => x.type === 'saloon');
        for (const o of G.pokerTable(b).opps) o.stack = 40;
        const n0 = UI.stack.length; UI.openPoker(b);
        const opened = UI.stack.length > n0;
        const msg = TH.feeds.join(' | ');
        G.clock += 1440;
        const fresh = G.pokerTable(b).opps.length;
        return { opened, msg, fresh };
      });
      t.ok(!r.opened, 'boş masada oyun açılmamalı'); t.ok(/kimse kalmadı/.test(r.msg), 'uyarı verilmeli', r.msg);
      t.eq(r.fresh, 3, 'ertesi gün üç yeni rakip');
    });
    await t.step('yetersiz para ve Kumarbaz yeteneği (yüz okuma)', async () => {
      const r = await p.evaluate(() => {
        const b = G.world.buildings.find(x => x.type === 'saloon');
        G.player.money = 0.5; UI.openPoker(b); const st = PK.top();
        UI.top().pokerAct('deal'); const poor = st.phase === 'idle' && /en az/.test(st.msg);
        UI.pop();
        G.player.money = 20; delete G.achieved.gambler; UI.openPoker(b); UI.top().pokerAct('deal');
        const noTell = !document.querySelector('.poker .pk-tell');
        UI.top().pokerAct('leave');
        G.achieved.gambler = true; UI.openPoker(b); UI.top().pokerAct('deal');
        const tell = document.querySelectorAll('.poker .pk-tell').length;
        UI.top().pokerAct('leave');
        return { poor, noTell, tell };
      });
      t.ok(r.poor, 'yetersiz parayla el dağıtılmamalı'); t.ok(r.noTell, 'yetenek yokken yüz okunmaz'); t.ok(r.tell > 0, 'Kumarbaz yüz okur', r.tell);
    });
  },
};
