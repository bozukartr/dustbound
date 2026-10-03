'use strict';
/* Hikâyeli başlangıç: Sully'nin Senedi — on bölüm baştan sona, kayıt/yükleme, bırakma */
module.exports = {
  name: 'Hikâyeli başlangıç',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame({ story: true, init: () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; } });
    await p.evaluate(() => { window.__storyFast = true; });
    const S = () => p.evaluate(() => { const s = G.story; return s && { ch: s.ch, st: s.st, n: s.n, wait: s.wait, done: !!s.done, on: s.on, jack: s.jack }; });
    const waitStep = (ch, st, ms = 15000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    const sully = () => p.evaluate(() => { const e = G.sullyEnt(); return e && { x: e.x, y: e.y, d: dist(e.x, e.y, G.player.x, G.player.y) }; });
    const talk = () => p.evaluate(() => { const e = G.sullyEnt(); const a = G.sullyActions(e).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; });

    await t.step('bölüm 1 başlar: Sully yakında bekler, hedef ve işaret görünür', async () => {
      await waitStep(0, 0);
      const r = await p.evaluate(() => ({ hud: document.getElementById('hud-quest').textContent, hidden: document.getElementById('hud-quest').classList.contains('hidden'), mark: !!G.questMark(), ranch: !!G.story.ranch, camp: !!G.story.camp, site: !!G.story.site }));
      t.ok(!r.hidden && /Sully/.test(r.hud), 'izleyici görünür', r.hud);
      t.ok(r.mark && r.ranch && r.camp && r.site, 'çiftlik, kamp ve gece yeri seçildi', r);
      const s = await sully();
      t.ok(s && s.d < 120, 'Sully oyuncunun yanında', s);
    });

    await t.step('konuş, iki kişiyi selamla, mağazaya gir', async () => {
      t.ok(await talk(), 'Konuş seçeneği var');
      await waitStep(0, 1);
      const same = await p.evaluate(() => { const P = G.player; const e = G.ents.filter(e => e.kind === 'npc' && !e.quest && !e.dead && !e.hostile && e.role !== 'law').sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y))[0]; G.greet(e); G.greet(e); return G.story.n; });
      t.eq(same, 1, 'aynı kişiyi iki kez selamlamak bir sayılır');
      const n = await p.evaluate(() => { const P = G.player; const L = G.ents.filter(e => e.kind === 'npc' && !e.quest && !e.dead && !e.hostile && e.role !== 'law' && !(G.story.greeted || []).includes(e.id)).sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y)).slice(0, 1); L.forEach(e => G.greet(e)); return L.length + 1; });
      t.eq(n, 2, 'iki kasabalı');
      await waitStep(0, 2);
      await p.evaluate(() => { const b = G.sBld('general'); TH.inside(b); });
      await waitStep(1, 0);
      const s = await sully();
      t.ok(s && s.d < 400, 'Sully mağazaya gelir', s);
    });

    await t.step('bölüm 2: yiyecek al, ye, matarayı doldur', async () => {
      const m0 = await p.evaluate(() => G.player.money);
      t.ok(m0 >= 1, 'Sully bir dolar verdi');
      const ok = await p.evaluate(() => { UI.openShop('general'); return TH.clickItem(new RegExp(ITEMS.beans.n)); });
      t.ok(ok, 'mağazadan fasulye tıklandı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(1, 1);
      await p.evaluate(() => G.consume('beans'));
      await waitStep(1, 2);
      const w = await p.evaluate(() => G.questMark());
      t.ok(w && w.x, 'kuyu işaretli', w);
      await p.evaluate(() => G.fillCanteen());
      await waitStep(2, 0);
    });

    await t.step('bölüm 3: ıslık, ata bin, çiftliğe sür', async () => {
      await p.evaluate(() => G.whistle());
      await waitStep(2, 1);
      await p.evaluate(() => { const P = G.player, h = G.horse; h.x = P.x + 6; h.y = P.y; P.mount(h, true); P.mountAnim = null; });
      await waitStep(2, 2);
      const wp = await p.evaluate(() => !!G.waypoint);
      t.ok(wp, 'çiftliğe rota çizildi');
      await t.sleep(600);
      const ride = await p.evaluate(() => { const e = G.sullyEnt(); return { m: !!(e && e.mounted), e: e && { x: e.x | 0, y: e.y | 0, st: e.state, hide: e.hide, dead: e.dead, n: G.ents.filter(x => x.quest === 'sully').length }, g: G.story.sully, err: G._errShown, cine: G.cine, modal: UI.isModal(), state: G.state, talk: G.story.talkQ && G.story.talkQ.length, p: [G.player.x | 0, G.player.y | 0], ch: G.story.ch, st: G.story.st, errs: window.__errs }; });
      t.ok(ride.m, 'Sully atla önden gider ' + JSON.stringify(ride));
      await p.evaluate(() => { const R = G.story.ranch, h = G.player.riding; h.x = R.x; h.y = R.y + 30; G.player.x = h.x; G.player.y = h.y; });
      await waitStep(3, 0, 20000);
    });

    await t.step('bölüm 4: çakallar, av, deri yüzme', async () => {
      const r = await p.evaluate(() => ({ coy: G.ents.filter(e => e.storyCoy && !e.dead).length, all: G.ents.filter(e => e.storyCoy).map(e => [e.dead, e.remove, Math.round(dist(e.x, e.y, G.story.ranch.cx, G.story.ranch.cy))]), gone: G.story.coyGone, hens: G.ents.filter(e => e.storyHen).length, gun: G.hasGun(), h: G.hour, st: G.story.st, ch: G.story.ch, state: G.state, hp: G.player.hp, feeds: TH.feeds.slice(-6) }));
      t.eq(r.coy, 3, 'üç çakal ' + JSON.stringify(r)); t.ok(r.hens >= 3, 'tavuklar'); t.ok(r.gun, 'silah var');
      await p.evaluate(() => { const P = G.player; if (P.riding) { P.dismount(); P.mountAnim = null; } for (const e of G.ents) if (e.storyCoy) e.hurt(999, 'player'); });
      await waitStep(3, 1);
      const g = await p.evaluate(() => { const L = G.ents.filter(e => e.storyGame && !e.dead); return { n: L.length, type: G.story.game }; });
      t.ok(g.n >= 1, 'av sürüsü', g);
      await p.evaluate(() => { const a = G.ents.find(e => e.storyGame && !e.dead); TH.goto(a.x + 12, a.y); a.hurt(999, 'player'); window.QA = a; });
      await waitStep(3, 2);
      await p.evaluate(() => G.skin(QA));
      await waitStep(3, 3);
      await p.evaluate(() => { const e = G.sullyEnt() || G.story.ranch; TH.goto(G.story.ranch.x, G.story.ranch.y + 20); });
      await p.waitForFunction(() => G.sullyEnt(), null, { timeout: 5000 });
      t.ok(await talk(), 'Sully ile konuş');
      await waitStep(4, 0);
    });

    await t.step('kayıt ve yükleme hikâyeyi kaldığı yerden sürdürür', async () => {
      await p.evaluate(() => { G.saveGame(true); });
      await p.evaluate(async () => { await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      const s = await S();
      t.eq(s.ch, 4, 'bölüm 5'); t.eq(s.st, 0, 'ilk adım');
      t.ok(await p.evaluate(() => !G.ents.some(e => e.quest === 'mentor' && e.res)), 'Sully çift kopya değil');
    });

    await t.step('bölüm 5: postu sat, çiftliğe dön', async () => {
      await p.evaluate(() => { const b = G.sBld(['butcher', 'general']); TH.inside(b); const P = G.player; if (!G.storyHasGoods()) P.addItem('raw_game', 1, true); });
      await p.evaluate(() => { if (G.player.carry) G.sellCarried(G.sBld(['butcher', 'general']).def.shop); else { const id = Object.keys(G.player.inv).find(k => ITEMS[k].c === 'animal'); UI.openShop('butcher'); UI.top().tab = 1; } });
      await p.evaluate(() => { if (G.story.st === 0 && !G.story.wait) G.qEvent('sell', { id: 'raw_game' }); UI.closeAll(); });
      await waitStep(4, 1);
      await p.evaluate(() => TH.goto(G.story.ranch.x, G.story.ranch.y + 10));
      await waitStep(5, 0, 20000);
      const h = await p.evaluate(() => G.hour);
      t.ok(h >= 6.9 && h < 8, 'itiraftan sonra sabah olur', h);
    });

    await t.step('bölüm 6: Sully için çalış', async () => {
      await p.waitForFunction(() => G.sullyEnt(), null, { timeout: 5000 });
      await p.evaluate(() => { const e = G.sullyEnt(); TH.goto(e.x + 14, e.y); });
      t.ok(await talk(), 'konuş');
      await waitStep(5, 1);
      const acts = await p.evaluate(() => G.sullyActions(G.sullyEnt()).map(a => a.n).includes(JOBS.ranch.n));
      t.ok(acts, 'çalışma seçeneği');
      await p.evaluate(() => G.work('ranch', 'Sully'));
      await p.waitForFunction(() => G.story.ch === 6 && !G.story.wait, null, { timeout: 20000 });   // banka yoksa yatırma adımı atlanır
    });

    await t.step('bölüm 7: şerif ofisi ve ilan panosu', async () => {
      const s = await S();
      if (s.st === 0) await p.evaluate(() => G.qEvent('deposit', 1));
      await waitStep(6, 1);
      const inTown = await p.evaluate(() => !!G.world.townAt(G.player.x, G.player.y, 60));
      t.ok(inTown, 'sinematik oyuncuyu kasabaya taşır');
      await p.evaluate(() => TH.inside(G.sBld('sheriff')));
      await waitStep(6, 2);
      const poster = await p.evaluate(() => G.storyPoster());
      t.ok(/Jack/.test(poster), 'Jack afişi');
      await p.evaluate(() => { UI.svcItems(G.sBld('sheriff'), 'board')[0].fn(); UI.closeAll(); });
      await waitStep(7, 0);
      t.ok(await p.evaluate(() => G.hour >= 19.9 || G.hour < 4), 'saloon gecesi');
    });

    await t.step('bölüm 8: saloonda içki ve söylenti, kamp işaretlenir', async () => {
      await p.evaluate(() => TH.inside(G.sBld(['saloon', 'cantina'])));
      await waitStep(7, 1);
      await p.evaluate(() => { G.player.money += 1; const b = G.sBld(['saloon', 'cantina']); UI.svcItems(b, 'meal')[1].fn(); });
      await waitStep(7, 2);
      await p.evaluate(() => { UI.rumor(); UI.closeAll(); });
      await waitStep(8, 0);
      const r = await p.evaluate(() => { const cp = G.world.pois.find(q => q.pid === G.story.camp.pid); return { known: G.story.campKnown, rum: cp ? G.rumored.has(cp.id) : true, bin: G.player.has('binoculars'), bed: G.player.has('bedroll'), meat: G.player.has('raw_game') }; });
      t.ok(r.known && r.rum, 'kamp haritada', r); t.ok(r.bin && r.bed && r.meat, 'dürbün, tulum, et verildi', r);
    });

    await t.step('bölüm 9: kamp kur, pişir, sabaha kadar uyu', async () => {
      await p.evaluate(() => { const s = G.story.site; TH.goto(s.x, s.y); TH.clearNpcs(); });
      await waitStep(8, 1);
      await p.evaluate(() => { for (const e of G.ents) if (e.hostile || (e.kind === 'animal' && e.state === 'attack')) e.remove = true; G.law.level = 0; G.setupCamp(); if (!G.camp) { const o = TH.openSpot(G.player.x, G.player.y, 40); TH.goto(o[0], o[1]); G.setupCamp(); } });
      await waitStep(8, 2);
      const ok = await p.evaluate(() => { UI.closeAll(); UI.openCook(); const R = RECIPES.find(r => r.id === 'cook_game'); return TH.clickItem(new RegExp(R.n)); });
      t.ok(ok, 'pişirme tıklandı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(8, 3);
      await p.evaluate(() => G.sleep(8, 'camp'));
      await waitStep(9, 0, 30000);
      const d = await p.evaluate(() => dist(G.player.x, G.player.y, G.story.camp.x, G.story.camp.y));
      t.ok(d > 300 && d < 700, 'şafakta kampa yakın bir sırtta', d);
    });

    await t.step('bölüm 10: gözetle, yaklaş, Jack\'i bağla, tapuyu al, teslim et, final', async () => {
      await p.evaluate(() => { G.toggleBinoc(); const S = G.story, P = G.player; G.binoc.x = S.camp.x - P.x; G.binoc.y = S.camp.y - P.y; });
      await waitStep(9, 1, 8000);
      await p.evaluate(() => { if (G.binoc) G.binocOff(); const S = G.story; TH.goto(S.camp.x + 200, S.camp.y + 60); });
      await waitStep(9, 2, 8000);
      await p.waitForFunction(() => G.jackEnt(), null, { timeout: 8000 });
      const j = await p.evaluate(() => { const j = G.jackEnt(); return { name: j.name, hostile: j.hostile, n: G.ents.filter(e => e.camp === G.story.camp.pid && e.role === 'bandit' && !e.dead).length }; });
      t.ok(/Jack/.test(j.name), 'Kızıl Jack kampta', j);
      await p.evaluate(() => { for (const e of G.ents) if (e.role === 'bandit' && !e.quest) e.remove = true; const j = G.jackEnt(); TH.goto(j.x + 30, j.y); G.lassoHit(j); G.hogtie(j); });
      await waitStep(9, 3);
      const acts = await p.evaluate(() => G.jackActions(G.jackEnt()).map(a => a.n).includes(Tr('Tapuyu Al')));
      t.ok(acts, 'tapu eylemi');
      await p.evaluate(() => G.jackActions(G.jackEnt())[0].fn());
      await waitStep(9, 4);
      await p.evaluate(() => { const j = G.jackEnt(); G.pickUp(j); });
      await p.waitForFunction(() => G.story.jack === 'carried', null, { timeout: 3000 });
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => { const b = G.sBld('sheriff'); const P = G.player, j = P.carry; P.x = b.door.x; P.y = b.door.y + 10; G.deliverToSheriff({ e: j, h: null }); });
      await waitStep(9, 5);
      const m1 = await p.evaluate(() => G.player.money);
      t.ok(m1 - m0 >= 24.9, 'canlı teslim ödülü', m1 - m0);
      await p.waitForFunction(() => G.sullyEnt() && dist(G.sullyEnt().x, G.sullyEnt().y, G.player.x, G.player.y) < 400, null, { timeout: 15000 });
      t.ok(await talk(), 'tapuyu ver');
      await p.waitForFunction(() => G.story.done, null, { timeout: 15000 });
      const r = await p.evaluate(() => ({ ach: !!G.achieved.story, hud: document.getElementById('hud-quest').classList.contains('hidden'), rep: G.player.weapons.has('repeater'), near: dist(G.player.x, G.player.y, G.story.ranch.x, G.story.ranch.y) }));
      t.ok(r.ach, 'başarım'); t.ok(r.hud, 'izleyici kapanır'); t.ok(r.rep, 'Sully\'nin tüfeği'); t.ok(r.near < 200, 'final çiftlikte biter', r.near);
    });

    await t.step('olası hatalar: gece yarısı saat atlatma, konuşmada yapılan eylem, tapusuz teslim, Sully dokunulmaz', async () => {
      // gece 02:00'de "akşama sar" bir günü atlamaz; akşamüstü ise akşama sarar
      const sk = await p.evaluate(() => {
        const day = Math.floor(G.clock / 1440) + 1; G.clock = day * 1440 + 120; const d0 = G.day;
        G.sSkipTo(19.25, 18); const a = { h: G.hour, d: G.day - d0 };
        G.clock = day * 1440 + 17 * 60; G.sSkipTo(19.25, 18); const b = G.hour;
        return { a, b };
      });
      t.ok(sk.a.h < 2.1 && sk.a.d === 0, 'gece yarısından sonra saat sarılmaz', sk);
      t.ok(Math.abs(sk.b - 19.25) < 0.01, 'akşamüstü akşama sarılır', sk);
      // şerifin konuşması sürerken panoya bakmak sayılır
      await p.evaluate(() => { Object.assign(G.story, { on: true, done: false, jack: 'free', deed: false }); delete G.story.alive; UI.closeAll(); G.qChapter(6); });
      await p.waitForFunction(() => G.story.ch === 6 && G.story.st >= 0 && !G.story.wait, null, { timeout: 15000 });
      await p.evaluate(() => { if (G.story.st === 0) G.qEvent('deposit', 1); });
      await waitStep(6, 1);
      await p.evaluate(() => { TH.inside(G.sBld('sheriff')); });
      await p.waitForFunction(() => G.story.wait, null, { timeout: 3000 });
      await p.evaluate(() => { UI.svcItems(G.sBld('sheriff'), 'board')[0].fn(); UI.closeAll(); });
      await p.waitForFunction(() => G.story.ch === 7, null, { timeout: 15000 });
      t.ok(true, 'konuşma sırasında panoya bakmak adımı tamamladı');
      // tapuyu almadan Jack'i teslim etmek hikâyeyi kilitlemez, ödül bir kez verilir
      await p.evaluate(() => { const S = G.story; S.talkQ = null; S.talkCb = null; S.ch = 9; S.st = 1; S.wait = false; S.jack = 'free'; S.deed = false; delete S.alive; delete S.jx; delete S.jy; for (const e of G.ents) if (e.quest === 'jack') e.remove = true; G.qNext(); TH.goto(S.camp.x + 200, S.camp.y + 60); });
      await p.waitForFunction(() => G.jackEnt() && G.story.st === 2, null, { timeout: 8000 });
      await p.evaluate(() => { for (const e of G.ents) if (e.role === 'bandit' && !e.quest) e.remove = true; const j = G.jackEnt(); TH.goto(j.x + 30, j.y); G.lassoHit(j); G.hogtie(j); });
      await waitStep(9, 3);
      const m0 = await p.evaluate(() => { const j = G.jackEnt(); G.pickUp(j); return G.player.money; });
      await p.waitForFunction(() => G.story.jack === 'carried', null, { timeout: 3000 });
      await p.evaluate(() => { const b = G.sBld('sheriff'); const P = G.player; P.x = b.door.x; P.y = b.door.y + 10; G.deliverToSheriff({ e: P.carry, h: null }); });
      await waitStep(9, 5, 15000);
      await t.sleep(800);
      const dl = await p.evaluate(() => ({ deed: G.story.deed, jack: G.story.jack, money: G.player.money, ent: !!G.jackEnt() }));
      t.ok(dl.deed && dl.jack === 'delivered', 'şerif tapuyu verdi, Jack teslim edildi', dl);
      t.ok(Math.abs(dl.money - m0 - 25) < 0.01, 'ödül bir kez', dl.money - m0);
      t.ok(!dl.ent, 'Jack kampta yeniden doğmaz');
      // Sully: vurulamaz, çarpılamaz, suç yazılmaz
      const su = await p.evaluate(() => { const e = G.sullyEnt(); const b0 = G.law.bounty, h0 = G.honor; e.hurt(50, 'player', 'gun'); return { bounty: G.law.bounty - b0, assaulted: !!e.assaulted, hp: e.hp }; });
      t.ok(su.bounty === 0 && !su.assaulted && su.hp > 9000, 'Sully vurulunca suç yok', su);
    });

    await t.step('günlükte Görevler sekmesi; yeni hayatta hikâye bırakılabilir', async () => {
      const r = await p.evaluate(() => { UI.openJournal(6); const h = document.querySelector('.journal').textContent; UI.closeAll(); return h; });
      t.ok(/Sully/.test(r) && /Bölüm 10|Chapter 10/.test(r), 'görev günlüğü', r.slice(0, 120));
      await p.evaluate(() => { G.story.done = false; G.story.on = true; G.storyAbandon(); });
      const s = await S();
      t.ok(!s.on, 'bırakıldı');
      t.ok(await p.evaluate(() => !G.sullyEnt() || G.sullyEnt().remove), 'Sully gider');
    });
  },
};
