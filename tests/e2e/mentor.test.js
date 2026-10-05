'use strict';
/* Akıl hocası ve görev konuşmaları:
   - hedef tamamlanınca o adımın konuşmasından kalan satırlar söylenmez (konuşma uzayıp gitmez)
   - altyazının hafif bir arka planı var
   - Sully çiftliğe atla sokaklardan, kasaba kenarından ve yoldan gider; duvara dayanıp kalmaz
   - Elias kampına yürürken de rota izler */
module.exports = {
  name: 'Akıl hocası: konuşma akışı ve rota',
  timeout: 360000,
  async run(t) {
    const p = await t.newGame({ story: true });
    await p.evaluate(() => { window.__storyFast = true; });
    const waitStep = (ch, st, ms = 20000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    // akıl hocasının arkasından gelen oyuncu: hocayla hedef arasında değil, hep arkasında
    const follow = (ms, back) => p.evaluate(async ([ms, back]) => {
      const S = G.story, t0 = performance.now(), log = [];
      let stuck = 0, arrived = null;
      while (performance.now() - t0 < ms) {
        await new Promise(r => setTimeout(r, 100));
        const e = G.mentorEnt(); if (!e) continue;
        const P = G.player, a = Math.atan2(e.y - S.sully.y, e.x - S.sully.x);
        P.x = e.x + Math.cos(a) * back; P.y = e.y + Math.sin(a) * back;
        const last = log[log.length - 1], d = dist(e.x, e.y, S.sully.x, S.sully.y);
        if (last && Math.hypot(e.x - last[0], e.y - last[1]) < 0.5 && d > 20) stuck++; else stuck = 0;
        if (stuck > 40) return { arrived: null, stuckAt: [Math.round(e.x), Math.round(e.y)], d: Math.round(d) };
        log.push([e.x, e.y]);
        if (d < 10) { arrived = (performance.now() - t0) / 1000; break; }
      }
      let L = 0; for (let i = 1; i < log.length; i++) L += Math.hypot(log[i][0] - log[i - 1][0], log[i][1] - log[i - 1][1]);
      const st = log[0], en = log[log.length - 1];
      return { arrived, ratio: Math.round(L / Math.max(1, Math.hypot(en[0] - st[0], en[1] - st[1])) * 100) / 100 };
    }, [ms, back]);

    await t.step('altyazının hafif bir arka planı var', async () => {
      const r = await p.evaluate(() => { UI.subtitle('Dunham Sully', 'Deneme satırı.', 2); const cs = getComputedStyle(UI.el.sub); return { bg: cs.backgroundColor, rad: parseFloat(cs.borderTopLeftRadius) }; });
      const a = +((r.bg.match(/rgba?\(([^)]+)\)/) || [])[1] || '0,0,0,0').split(',')[3];
      t.ok(a > 0.3 && a < 0.8 && r.rad > 0, 'yarı saydam, köşeleri yumuşak zemin', r);
    });

    await t.step('hedef tamamlanınca adımın kalan konuşması kesilir, bitiş sözü söylenir', async () => {
      await waitStep(0, 0);
      await p.evaluate(() => { const e = G.mentorEnt(); G.qTalkSully(e); });
      await waitStep(0, 1);
      const r = await p.evaluate(() => {
        const S = G.story, st = G.qStep();
        // adımın başında söylenen uzun bir konuşma (ör. talk) — oyuncu daha bitmeden hedefi tamamlıyor
        G.qSay([['S', 'adım satırı bir'], ['S', 'adım satırı iki'], ['S', 'adım satırı üç']], null, 0, st);
        G.qSay([['S', 'başka bir söz']]);
        const before = S.talkQ.map(l => l.x);
        G.qDone();
        return { before, after: (S.talkQ || []).map(l => l.x) };
      });
      t.ok(r.before.includes('adım satırı iki'), 'satırlar sıradaydı', r.before);
      t.ok(!r.after.some(x => /adım satırı/.test(x)), 'tamamlanan adımın satırları silindi', r.after);
      t.ok(r.after.includes('başka bir söz'), 'adıma bağlı olmayan söz kalır', r.after);
      await waitStep(0, 2);
    });

    await t.step('Sully çiftliğe atla sokaklardan ve yoldan gider, duvara dayanıp kalmaz', async () => {
      await p.evaluate(() => G.qChapter(2));
      await waitStep(2, 0);
      await p.evaluate(() => { const w = G.storyWell(); G.sullyGo(w.x + 18, w.y + 10); const e = G.mentorEnt(); if (e) { e.x = w.x + 18; e.y = w.y + 10; } G.player.x = w.x + 50; G.player.y = w.y + 20; });
      await t.sleep(800);
      await p.evaluate(() => G.qDone());
      await waitStep(2, 1);
      await p.evaluate(() => G.qDone());
      await p.waitForFunction(() => G.story.st === 2 && G.story.sully.ride, null, { timeout: 20000 });
      const r = await follow(70000, 90);
      t.ok(r.arrived, 'Sully çiftliğe vardı', r);
      t.ok(r.ratio < 1.9, 'dolambaçsız rota', r);
      const rr = await p.evaluate(() => { const e = G.mentorEnt(); return e && e.rr && e.rr.route.length; });
      t.ok(rr > 3, 'rota ara noktalardan oluşur (dümdüz değil)', rr);
    });

    await t.step('rota parçaları: kasaba içinde duvar dibinden geçmez, son yaklaşma engelin etrafından', async () => {
      const r = await p.evaluate(() => {
        const S = G.story, R = S.ranch, W = G.world, T = G.sTown();
        // kasabanın ortasından çiftliğe atlı rota
        const route = G.haulRoute(T.cx, T.cy + 20, R.x - 30, R.y + 10, { r: RIDE_R, ride: true });
        let bad = 0;
        for (let i = 1; i < route.length; i++) { const a = route[i - 1], b = route[i]; if (W.townAt(a[0], a[1], 0) && W.townAt(b[0], b[1], 0) && !TownPath.walkable(a, b, 4)) bad++; }
        // evin arkasından önüne: düz çizgi evin içinden geçer, yerel yol etrafından dolanır
        const a = G.sSpot(R.cx, R.cy - 160, 0, 60), b = G.sSpot(R.x - 30, R.y + 30, 0, 60);
        const loc = TownPath.local(a[0], a[1], b[0], b[1], RIDE_R);
        return { n: route.length, bad, direct: TownPath.walkable(a, b, 4), loc: !!loc && loc.every((q, i) => TownPath.walkable(i ? loc[i - 1] : a, q, 4)) };
      });
      t.ok(r.n > 2 && r.bad === 0, 'kasaba içi parçalar yürünebilir', r);
      t.ok(r.loc, 'yerel yol engelden geçmez', r);
    });
  },
};
