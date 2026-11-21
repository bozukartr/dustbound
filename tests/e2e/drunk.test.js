'use strict';
/* Sully, Bölüm 8: saloondaki sarhoş haydut. Söylenti kampı vermez, sarhoşu gösterir; kampın yeri dört yoldan öğrenilir:
   barmene sor (pahalı), üç kadeh ısmarla, kâğıt masasında bir el kazan, ya da çıkınca gizlice peşine takıl (arkasına
   bakınca görünürsen kaçar; çok geride kalırsan iz kaybolur). Yollar kapanınca barmen kalır */
module.exports = {
  name: 'Saloondaki sarhoş haydut',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame({ story: true });
    await p.evaluate(() => { window.__storyFast = true; G.godMode = true; G.eventT = 1e9; G.hunterTick = () => {}; });
    await p.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st >= 0, null, { timeout: 15000 });
    const waitStep = (ch, st, ms = 15000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    // Bölüm 8'in kampı öğrenme adımına yeniden kur (her yol için baştan)
    const reset = async () => { await p.waitForFunction(() => !G.story.wait && !G.storyTalking(), null, { timeout: 15000 }); return p.evaluate(() => {
      const S = G.story; S.talkQ = null; S.talkCb = null; UI.closeAll();
      for (const e of G.ents) if (e.storyNpc === 'drunk') e.remove = true;
      G.ents = G.ents.filter(e => !e.remove);
      const cp = G.world.pois.find(q => q.pid === S.camp.pid); if (cp) G.rumored.delete(cp.id);
      Object.assign(S, { ch: 7, st: 2, wait: false, n: 0, campKnown: false, drunkGone: null, drunkN: 0, dkT: 0, campHow: null }); S.flags.campInfo = 0;
      G.clock = Math.floor(G.clock / 1440) * 1440 + 20.5 * 60;
      const b = G.sBld(['saloon', 'cantina']); S.sal = b.id; TH.inside(b);
      G.qNext();
      return S.st;
    }); };
    const drunk = () => p.evaluate(() => { const e = G.drunkEnt(); return e && { dk: e.dk, st: e.state, x: e.x, y: e.y, inside: G.world.indoorPx(e.x, e.y), card: !!e.seat && [-12, 12].some(dx => G.world.obj[(e.seat.y >> 4) * WW + ((e.seat.x + dx) >> 4)] === O.CARDTABLE) }; });

    await t.step('bölüm 8: sarhoş saloonda oturur; söylenti kampı vermez, onu gösterir', async () => {
      await p.evaluate(() => {
        const S = G.story; S.talkQ = null; S.talkCb = null; UI.closeAll();
        S.ch = 7; S.st = 1; S.wait = false; G.clock = Math.floor(G.clock / 1440) * 1440 + 20.5 * 60;
        const b = G.sBld(['saloon', 'cantina']); S.sal = b.id; TH.inside(b); G.qNext();
      });
      await waitStep(7, 2);
      await p.waitForFunction(() => !!G.drunkEnt(), null, { timeout: 8000 });
      const d = await drunk();
      t.ok(d.dk === 'sit' && d.st === 'sit' && d.inside, 'saloonda oturuyor', d);
      await p.evaluate(() => { G.player.money += 1; UI.rumor(); });
      const r = await p.evaluate(() => { const h = document.querySelector('.modal') ? document.querySelector('.modal').textContent : ''; UI.closeAll(); return { known: G.story.campKnown, h }; });
      t.ok(!r.known && /Köşede/.test(r.h), 'barmen köşedeki sarhoşu gösterir, kampı söylemez', r);
      await waitStep(7, 3);
      const a = await p.evaluate(() => ({ drunk: G.drunkActions(G.drunkEnt(), G.story).map(x => x.n), bar: G.storyBuildingActions(G.storySaloon()).map(x => x.label), how: G.questHow(G.qStep(), G.story) }));
      t.ok(a.drunk.some(n => /İçki Ismarla/.test(n)) && a.drunk.includes('Kâğıt Oyna'), 'sarhoşa içki ısmarla ve kâğıt oyna', a.drunk);
      t.eq(a.bar, ['Kampın Yerini Sor'], 'barmene kampın yerini sor');
      t.ok(/Kampın Yerini Sor/.test(a.how) && /İçki Ismarla/.test(a.how), 'nasıl satırı dört yolu sayar', a.how);
    });

    await t.step('üç kadeh ısmarla: sarhoş çözülür, kamp işaretlenir', async () => {
      const r = await p.evaluate(() => {
        const e = G.drunkEnt(), S = G.story, P = G.player; P.money += 5; const m0 = P.money, out = [];
        for (let k = 0; k < 3; k++) { G.drunkActions(e, S).find(a => /İçki Ismarla/.test(a.n)).fn(); out.push(!!S.campKnown); }
        const h = document.querySelector('.modal') ? document.querySelector('.modal').textContent : '';
        UI.closeAll();
        return { out, paid: Math.round((m0 - P.money) * 100), how: S.campHow, h };
      });
      t.eq(r.out, [false, false, true], 'üçüncü kadehte konuştu');
      t.eq(r.paid, 45, 'üç kadeh parası');
      t.ok(r.how === 'drinks' && /Ama ben söylemedim/.test(r.h), 'sarhoşun ağzından', r);
      await waitStep(8, 0);
      const q = await p.evaluate(() => { const cp = G.world.pois.find(x => x.pid === G.story.camp.pid); return { rum: cp ? G.rumored.has(cp.id) : true, bin: G.player.has('binoculars') }; });
      t.ok(q.rum && q.bin, 'kamp haritada, dürbün verildi', q);
    });

    await t.step('kâğıt: sarhoş oturduğu masada rakip; onun oynadığı bir eli kazanınca konuşur', async () => {
      t.eq(await reset(), 3, 'kampı öğrenme adımı');
      await p.waitForFunction(() => !!G.drunkEnt(), null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const b = G.storySaloon(), tb = G.pokerTable(b), o = tb.opps.find(x => x.story === 'drunk');
        // bir el: oyuncu floş royal, sarhoş boş el
        const me = { me: true, name: 'Sen', hand: [{ r: 1, s: 0 }, { r: 13, s: 0 }, { r: 12, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }], folded: false };
        const dr = { o, name: o.name, hand: [{ r: 2, s: 1 }, { r: 4, s: 2 }, { r: 6, s: 3 }, { r: 8, s: 1 }, { r: 9, s: 2 }], folded: false, out: false };
        const st = { ante: 5, pot: 40, seats: [me, dr], pending: [] };
        const k0 = G.story.campKnown;
        Poker.finish(st);
        const h = document.querySelector('.modal') ? document.querySelector('.modal').textContent : '';
        UI.closeAll();
        return { opp: !!o, n: tb.opps.length, k0, k1: G.story.campKnown, how: G.story.campHow, h };
      });
      t.ok(r.opp && r.n <= 3, 'masada sarhoş da var', r);
      t.ok(!r.k0 && r.k1 && r.how === 'poker' && /Lanet kartlar/.test(r.h), 'eli kazanınca konuştu', r);
      await waitStep(8, 0);
      // adım bitince masadan kalkar
      const n = await p.evaluate(() => G.pokerTable(G.storySaloon()).opps.filter(x => x.story).length);
      t.eq(n, 0, 'sarhoş artık masada değil');
    });

    await t.step('barmen: bir dolara kampın yeri', async () => {
      t.eq(await reset(), 3, 'kampı öğrenme adımı');
      const r = await p.evaluate(() => { const P = G.player; P.money += 3; const m0 = P.money; G.storyBuildingActions(G.storySaloon())[0].fn(); const h = document.querySelector('.modal') ? document.querySelector('.modal').textContent : ''; UI.closeAll(); return { paid: Math.round((m0 - P.money) * 100), how: G.story.campHow, k: G.story.campKnown, h }; });
      t.ok(r.paid === 100 && r.how === 'bartender' && r.k && /Benden duymadın/.test(r.h), 'barmen söyledi', r);
      await waitStep(8, 0);
    });

    await t.step('beklersen kalkar, kapıdan çıkıp atına biner ve kampına sürer', async () => {
      t.eq(await reset(), 3, 'kampı öğrenme adımı');
      await p.waitForFunction(() => !!G.drunkEnt(), null, { timeout: 8000 });
      await p.evaluate(() => { G.story.dkT = BARFLY.LEAVE + 1; });
      await p.waitForFunction(() => { const e = G.drunkEnt(); return e && e.dk === 'out'; }, null, { timeout: 5000 });
      await p.waitForFunction(() => { const e = G.drunkEnt(); return e && e.dk === 'ride' && !!e.mounted; }, null, { timeout: 25000 });
      const r = await p.evaluate(() => { const e = G.drunkEnt(), S = G.story; window.__d0 = dist(e.x, e.y, S.camp.x, S.camp.y); return { inside: G.world.indoorPx(e.x, e.y), mark: G.questMark() === e, ch: S.ch, st: S.st, wait: S.wait, how: S.campHow, ci: S.flags.campInfo, gone: S.drunkGone }; });
      t.ok(!r.inside && r.mark, 'dışarıda, atlı; görev işareti onun üstünde', r);
      // oyuncu kapının önünde bekler (gece, uzakta): sarhoş kampa doğru yol alır
      await p.evaluate(() => { const e = G.drunkEnt(); TH.goto(e.x - 220, e.y - 160); G.player.crouch = true; });
      await t.sleep(2500);
      const q = await p.evaluate(() => { const e = G.drunkEnt(), S = G.story; return { d: dist(e.x, e.y, S.camp.x, S.camp.y), d0: window.__d0 }; });
      t.ok(q.d < q.d0 - 40, 'kampa doğru sürüyor', q);
    });

    await t.step('arkasına baktığında onun gördüğü yerdeysen şüphesi dolar, kaçar; yol kapanır, barmen kalır', async () => {
      const r = await p.evaluate(() => {
        const e = G.drunkEnt(), P = G.player;
        // açık hava (sis, yağmur ve toz görüşü kısaltır); arkasında, yakın ve görünür (ayakta, lambalı), peşinden gider
        Object.assign(G.weather, { type: 'clear', i: 0, fogI: 0, cloud: 0, t: 1e6 }); G.envCache = G.localWeather(P.x, P.y);
        const behind = () => { const d = G.drunkEnt(); if (d && d.dk === 'ride') TH.goto(d.x - Math.cos(d.ang) * 70, d.y - Math.sin(d.ang) * 70); };
        behind(); P.crouch = false; P.lantern = true; if (!P.has('lantern')) P.addItem('lantern', 1, true);
        window.__follow = setInterval(behind, 100);
        e.lookT = 0;
        return true;
      });
      t.ok(r, 'arkasında');
      try { await p.waitForFunction(() => { const e = G.drunkEnt(); return !e || e.dk === 'flee'; }, null, { timeout: 8000 }); }
      finally { await p.evaluate(() => clearInterval(window.__follow)); }
      const q = await p.evaluate(() => ({ gone: G.story.drunkGone, bar: G.storyBuildingActions(G.storySaloon()).length, st: G.story.st, k: G.story.campKnown }));
      t.ok(q.gone === 'spotted' && !q.k && q.st === 3, 'fark edildi, kaçtı; kamp bilinmiyor, adım sürüyor', q);
      t.eq(q.bar, 1, 'barmene sormak hâlâ mümkün');
      await p.evaluate(() => { G.player.lantern = false; });
    });

    await t.step('gizli takip: görünmeden peşinden gidersen kampa varınca kampın yeri bulunur', async () => {
      t.eq(await reset(), 3, 'kampı öğrenme adımı');
      await p.waitForFunction(() => !!G.drunkEnt(), null, { timeout: 8000 });
      // yolun sonuna yakın: sarhoşu kampa 900 px kala yola koy, oyuncu gece 330 px geride, çömelmiş
      const r = await p.evaluate(() => {
        const e = G.drunkEnt(), S = G.story, C = S.camp, T = G.sTown(), P = G.player;
        const a = Math.atan2(T.cy - C.y, T.cx - C.x), s = TH.openSpot(C.x + Math.cos(a) * 900, C.y + Math.sin(a) * 900, 20);
        G.drunkUnseat(e); e.dk = 'ride'; e.mounted = { col: '#5a3a22', mane: '#1a1410', blanket: '#3a4a2a' }; e.state = 'idle'; e.rr = null;
        e.x = s[0]; e.y = s[1]; e.ang = a + Math.PI; e.lookT = 99; e.aw = 0;
        const b = TH.openSpot(s[0] + Math.cos(a) * 330, s[1] + Math.sin(a) * 330, 20); TH.goto(b[0], b[1]); P.crouch = true; P.lantern = false;
        G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60;
        return { d: dist(e.x, e.y, C.x, C.y) };
      });
      t.ok(r.d > 800, 'sarhoş kampa doğru yolda', r);
      // oyuncu peşinden gider: her yarım saniyede sarhoşun 330 px gerisine
      let found = false;
      for (let k = 0; k < 40 && !found; k++) {
        await t.sleep(500);
        found = await p.evaluate(() => {
          const e = G.drunkEnt(), S = G.story;
          if (S.flags.campInfo) return true;
          if (!e || e.dk !== 'ride') return false;
          const a = Math.atan2(e.y - S.camp.y, e.x - S.camp.x), s = TH.openSpot(e.x + Math.cos(a) * 330, e.y + Math.sin(a) * 330, 20);
          if (s) TH.goto(s[0], s[1]);
          return false;
        });
      }
      const q = await p.evaluate(() => { const h = document.querySelector('.modal') ? document.querySelector('.modal').textContent : ''; UI.closeAll(); return { how: G.story.campHow, k: G.story.campKnown, gone: G.story.drunkGone, h }; });
      t.ok(found && q.k && q.how === 'follow' && /peşinden/.test(q.h), 'kampa kadar takip ettin', q);
      await waitStep(8, 0);
    });

    await t.step('çok geride kalırsan izi kaybolur', async () => {
      t.eq(await reset(), 3, 'kampı öğrenme adımı');
      await p.waitForFunction(() => !!G.drunkEnt(), null, { timeout: 8000 });
      await p.evaluate(() => {
        const e = G.drunkEnt(), S = G.story, C = S.camp, T = G.sTown();
        const a = Math.atan2(T.cy - C.y, T.cx - C.x), s = TH.openSpot(C.x + Math.cos(a) * 1500, C.y + Math.sin(a) * 1500, 20);
        G.drunkUnseat(e); e.dk = 'ride'; e.mounted = { col: '#5a3a22', mane: '#1a1410', blanket: '#3a4a2a' }; e.x = s[0]; e.y = s[1]; e.rr = null;
        TH.goto(s[0] + Math.cos(a) * 1300, s[1] + Math.sin(a) * 1300);
      });
      await p.waitForFunction(() => G.story.drunkGone === 'lost', null, { timeout: 5000 });
      const q = await p.evaluate(() => ({ k: G.story.campKnown, st: G.story.st, bar: G.storyBuildingActions(G.storySaloon()).length }));
      t.ok(!q.k && q.st === 3 && q.bar === 1, 'iz kayboldu; barmen kalır', q);
    });
  },
};
