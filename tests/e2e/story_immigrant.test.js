'use strict';
/* Göçmen hikâyesi "Ağabeyin Mektupları": Saint Clement limanından maden kasabasına on bölüm, kayıt/yükleme ve dükkân */
module.exports = {
  name: 'Göçmen hikâyesi',
  timeout: 400000,
  async run(t) {
    const p = await t.page({ story: true, init: () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; } });
    const waitStep = (ch, st, ms = 15000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    const talk = () => p.evaluate(() => { const e = G.mentorEnt(); const a = e && G.mentorActions(e).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; });
    const near = () => p.evaluate(() => { const g = G.story.sully, e = G.mentorEnt(), P = G.player; if (e) { e.x = P.x + 20; e.y = P.y; } g.x = P.x + 20; g.y = P.y; });
    const noon = () => p.evaluate(() => { if (G.hour < 8 || G.hour > 14) G.sSkipTo(9); const P = G.player; P.energy = 100; P.hunger = 100; P.thirst = 100; });

    await t.step('Göçmen hikâyeyle başlar: Saint Clement, Greta iskelede', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const lab = await p.evaluate(() => {
        document.querySelectorAll('.cr-tab')[3].click();
        [...document.querySelectorAll('.cr-card')].find(n => n.dataset.bg === 'immigrant').click();
        return [...document.querySelectorAll('.opt')].find(n => /Hikâyeli/.test(n.textContent)).textContent;
      });
      t.ok(/Açık/.test(lab), 'göçmenin hikâyesi var', lab);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await t.sleep(600); await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await waitStep(0, 0);
      await p.waitForFunction(() => G.mentorEnt(), null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const P = G.player, S = G.story, e = G.mentorEnt(), B = G.world.buildings, mt = G.world.towns.find(x => x.id === S.mine);
        return { id: S.id, name: e.name, d: dist(e.x, e.y, P.x, P.y), port: S.port, town: G.world.townAt(P.x, P.y, 20) && G.world.townAt(P.x, P.y, 20).id, mine: mt && mt.n, store: B[S.store] && B[S.store].type, office: B[S.office] && B[S.office].type, gal: B[S.gallery] && B[S.gallery].type, camp: !!S.camp, kinLook: S.kinLook.skin === P.look.skin };
      });
      t.eq(r.id, 'immigrant', 'hikâye: Ağabeyin Mektupları'); t.eq(r.name, 'Greta Halvorsen', 'akıl hocası Greta');
      t.ok(r.d < 120, 'Greta yanında', r.d); t.eq(r.port, 'stclement', 'liman Saint Clement'); t.eq(r.town, 'stclement', 'oyuncu limanda');
      t.ok(r.mine, 'maden kasabası seçildi', r); t.eq(r.store, 'general', 'şirket dükkânı'); t.eq(r.office, 'house', 'Pike\'ın evi');
      t.eq(r.gal, 'mineentrance', 'eski galeri'); t.ok(r.camp && r.kinLook, 'kamp ve ağabeyin görünüşü', r);
    });

    await t.step('bölüm 1: Greta, selam, pansiyona gir, uyu', async () => {
      t.ok(await talk(), 'Konuş');
      await waitStep(0, 1);
      await p.evaluate(() => { const P = G.player; const L = G.ents.filter(e => e.kind === 'npc' && !e.quest && !e.dead && !e.hostile && e.role !== 'law').sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y)).slice(0, 2); L.forEach(e => G.greet(e)); });
      await waitStep(0, 2);
      await p.evaluate(() => TH.inside(G.sBld('hotel')));
      await waitStep(0, 3);
      await p.evaluate(() => G.sleep(8, 'hotel'));
      await waitStep(1, 0, 20000);
    });

    await t.step('bölüm 2: Greta ile konuş, limanda çalış', async () => {
      await near();
      t.ok(await talk(), 'Konuş');
      await waitStep(1, 1);
      await noon();
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => { TH.inside(G.sBld('docks')); G.work('docks', 'Liman'); });
      await waitStep(2, 0, 20000);
      t.ok(await p.evaluate((m0) => G.player.money > m0, m0), 'yevmiye alındı');
    });

    await t.step('bölüm 3: şeftalileri sat, uyku tulumu al', async () => {
      t.ok(await p.evaluate(() => G.player.count('peaches') >= 3), 'Greta\'nın şeftalileri');
      const sold = await p.evaluate(() => { const b = G.sBld('docks'); TH.inside(b); UI.openShop(b.def.shop); const m = UI.top(); m.tab = 1; m.render(); return TH.clickItem(new RegExp(ITEMS.peaches.n)); });
      t.ok(sold, 'şeftali satıldı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(2, 1);
      const bought = await p.evaluate(() => { const b = G.sBld('general'); TH.inside(b); UI.openShop('general'); return TH.clickItem(new RegExp(ITEMS.bedroll.n)); });
      t.ok(bought, 'tulum alındı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(3, 0);
    });

    await t.step('bölüm 4: postaneye gir, memura sor, mektubu Greta\'ya göster', async () => {
      await p.evaluate(() => TH.inside(G.sBld(['post', 'saloon'])));
      await waitStep(3, 1);
      await p.evaluate(() => { UI.rumor(); });
      t.ok(await p.evaluate(() => /Anton/.test(document.body.innerText)), 'memur Anton\'u anlatır');
      await p.evaluate(() => UI.closeAll());
      await waitStep(3, 2);
      await near();
      t.ok(await talk(), 'Konuş');
      await waitStep(4, 0, 20000);
    });

    await t.step('kayıt ve yükleme hikâyeyi sürdürür', async () => {
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await p.waitForFunction(() => G.story && G.story.ch === 4 && !G.story.wait, null, { timeout: 10000 });
      const r = await p.evaluate(() => ({ id: G.story.id, ch: G.story.ch, loan: G.story.flags.loan }));
      t.eq(r.id, 'immigrant', 'hikâye korunur'); t.eq(r.ch, 4, 'bölüm 5');
    });

    await t.step('bölüm 5: at satın al (Greta borç verir), bin', async () => {
      const r = await p.evaluate(() => { const b = G.sBld('stable'); TH.inside(b); UI.openHorseShop(b); return { ok: TH.clickItem(new RegExp(HORSE_BREEDS.morgan.n)), loan: G.story.flags.loan }; });
      t.ok(r.ok, 'Morgan alındı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(4, 1);
      t.ok(await p.evaluate(() => G.horse && G.horse.breed === 'morgan'), 'at artık oyuncunun');
      await p.evaluate(() => { const P = G.player, h = G.horse; TH.goto(h.x - 8, h.y); P.mount(h, true); P.mountAnim = null; });
      await waitStep(5, 0, 20000);
    });

    await t.step('bölüm 6: posta arabası bileti maden kasabasına gider', async () => {
      const mine = await p.evaluate(() => G.imMine().n);
      const post = await p.evaluate(() => !!G.sBld('post'));
      if (post) {
        const ok = await p.evaluate((n) => { const P = G.player; if (P.riding) { P.dismount(); P.mountAnim = null; } const b = G.sBld('post'); TH.inside(b); UI.openStage(b); return TH.clickItem(new RegExp(n)); }, mine);
        t.ok(ok, 'bilet listesinde maden kasabası', mine);
        await p.waitForFunction(() => G.world.townAt(G.player.x, G.player.y, 0) && G.world.townAt(G.player.x, G.player.y, 0).id === G.story.mine, null, { timeout: 15000 });
      } else await p.evaluate(() => { const M = G.imMine(); TH.goto(M.spawn.x, M.spawn.y); });
      await waitStep(6, 0, 20000);
      const r = await p.evaluate(() => ({ town: G.story.town === G.story.mine, d: G.mentorEnt() ? dist(G.mentorEnt().x, G.mentorEnt().y, G.player.x, G.player.y) : 9999 }));
      t.ok(r.town, 'hikâye maden kasabasına taşındı'); t.ok(r.d < 400, 'Greta da geldi', r.d);
    });

    await t.step('bölüm 7: madende çalış, fener al, eski galeriye in', async () => {
      await noon();
      await p.evaluate(() => { TH.inside(G.sBld('mine')); G.work('mine', 'Maden'); });
      await waitStep(6, 1, 20000);
      const lan = await p.evaluate(() => { G.player.money += 3; const b = G.sBld(['mine', 'general']); TH.inside(b); UI.openShop(b.def.shop); return TH.clickItem(new RegExp(ITEMS.lantern.n)); });
      t.ok(lan, 'fener alındı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(6, 2);
      await p.evaluate(() => { const g = G.imGallery(); TH.goto(g.door.x, g.door.y + 10); G.player.hp = G.player.maxHp; G.exploreMine(g); });
      await waitStep(7, 0, 20000);
    });

    await t.step('bölüm 8: şirket dükkânı, maymuncukla Pike\'ın evi, defter, şerif', async () => {
      await p.evaluate(() => TH.inside(G.world.buildings[G.story.store]));
      await waitStep(7, 1, 20000);
      t.ok(await p.evaluate(() => G.player.has('lockpick')), 'Greta maymuncuk verdi');
      await p.evaluate(() => { const b = G.world.buildings[G.story.office]; b.picked = G.day; TH.inside(b); });
      await waitStep(7, 2);
      await p.evaluate(() => G.searchHouse(G.world.buildings[G.story.office]));
      await waitStep(7, 3);
      const acts = await p.evaluate(() => { G.law.level = 0; const b = G.sBld('sheriff'); TH.inside(b); UI.openBuilding(b); return TH.menuLabels(); });
      t.ok(acts.some(a => /Borç Defterini Göster/.test(a)), 'şerife defteri gösterme seçeneği', acts);
      await p.evaluate(() => TH.clickItem(/Borç Defterini Göster/));
      await waitStep(8, 0, 20000);
      t.ok(await p.evaluate(() => { const cp = G.world.pois.find(q => q.pid === G.story.camp.pid); return G.story.campKnown && (!cp || G.rumored.has(cp.id) || G.discovered.has(cp.id)); }), 'kamp haritada');
    });

    await t.step('bölüm 9: kampı gözetle, Anton\'u kurtar, kasabaya dön', async () => {
      t.ok(await p.evaluate(() => G.hasGun() && G.player.weapons.has('lasso')), 'silah ve kement');
      await p.evaluate(() => { const S = G.story, s = G.findSpawnPos(S.camp.x + 380, S.camp.y + 60, 0, 70) || [S.camp.x + 380, S.camp.y + 60]; UI.closeAll(); TH.goto(s[0], s[1]); });
      await p.waitForFunction(() => !G.insideB, null, { timeout: 5000 });
      await p.evaluate(() => { const S = G.story, P = G.player; G.toggleBinoc(); G.binoc.x = S.camp.x - P.x; G.binoc.y = S.camp.y - P.y; });
      await waitStep(8, 1, 8000);
      await p.evaluate(() => { if (G.binoc) G.binocOff(); const S = G.story; TH.goto(S.camp.x - 30, S.camp.y + 20); G.godMode = true; });
      await p.waitForFunction(() => G.kinEnt() && G.kinEnt().state === 'tied', null, { timeout: 8000 });
      const r = await p.evaluate(() => { const e = G.kinEnt(); return { name: e.name, mentors: G.ents.filter(x => x.quest === 'mentor' && !x.remove).length }; });
      t.ok(/^Anton/.test(r.name), 'ağabey bağlı', r.name);
      const freed = await p.evaluate(() => { if (G.player.carry) G.dropCarry(true); for (const e of G.ents) if (e.kind === 'npc' && e.role === 'bandit' && !e.quest) e.remove = true; const e = G.kinEnt(); TH.goto(e.x + 12, e.y); return TH.act(/İplerini Kes/); });
      t.ok(freed, 'İplerini Kes');
      await waitStep(8, 2, 15000);
      await p.evaluate(() => { const M = G.imMine(); TH.goto(M.spawn.x, M.spawn.y); });
      await waitStep(9, 0, 20000);
    });

    await t.step('bölüm 10: Pike\'ı bağla, senetleri al, teslim et, dükkânı devral, Anton\'la konuş', async () => {
      const gal = await p.evaluate(() => { const g = G.imGallery(); return dist(G.story.camp.x, G.story.camp.y, g.door.x, g.door.y) < 60; });
      t.ok(gal, 'Pike eski galeride');
      await p.evaluate(() => { const S = G.story; TH.goto(S.camp.x + 40, S.camp.y + 30); });
      await p.waitForFunction(() => G.rivalEnt(), null, { timeout: 8000 });
      await p.evaluate(() => { for (const e of G.ents) if (e.role === 'bandit' && !e.quest) e.remove = true; const j = G.rivalEnt(); TH.goto(j.x + 30, j.y); G.lassoHit(j); G.hogtie(j); });
      await waitStep(9, 1);
      t.ok(await p.evaluate(() => { const j = G.rivalEnt(); TH.goto(j.x + 10, j.y); return TH.act(/Senetleri Al/); }), 'Senetleri Al');
      await waitStep(9, 2);
      await p.evaluate(() => { const j = G.rivalEnt(); G.pickUp(j); });
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => { const b = G.sBld('sheriff'), P = G.player; P.x = b.door.x; P.y = b.door.y + 10; G.deliverToSheriff({ e: P.carry, h: null }); });
      await waitStep(9, 3, 15000);
      t.ok(await p.evaluate((m0) => G.player.money - m0 >= 19.9, m0), 'Pike için ödül');
      if (await p.evaluate(() => G.hour < 7 || G.hour > 20)) await p.evaluate(() => G.sSkipTo(9));
      const acts = await p.evaluate(() => { const b = G.world.buildings[G.story.store]; TH.inside(b); UI.openBuilding(b); return TH.menuLabels(); });
      t.ok(acts.some(a => /Dükkânın Tapusunu Al/.test(a)), 'tapuyu alma seçeneği', acts);
      await p.evaluate(() => TH.clickItem(/Dükkânın Tapusunu Al/));
      await waitStep(9, 4, 15000);
      const z = await p.evaluate(() => { const z = G.bizOf(G.world.buildings[G.story.store]); return z && z.mgr.name; });
      t.ok(/^Anton/.test(z || ''), 'dükkân oyuncunun, işletmeci Anton', z);
      t.ok(await p.evaluate(() => !G.mentorActions(G.mentorEnt() || { x: 0, y: 0 }).some(a => a.n === Tr('Konuş'))), 'Greta değil Anton\'la konuşulur');
      await p.evaluate(() => { const e = G.kinEnt() || null, P = G.player; if (e) TH.goto(e.x + 14, e.y); });
      await p.waitForFunction(() => G.kinEnt(), null, { timeout: 8000 });
      t.ok(await p.evaluate(() => { const a = G.kinActions(G.kinEnt()).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; }), 'Anton ile konuş');
      await p.waitForFunction(() => G.story.done, null, { timeout: 15000 });
      const r = await p.evaluate(() => ({ ach: !!G.achieved.story_immigrant, hud: document.getElementById('hud-quest').classList.contains('hidden'), kin: G.story.kin && dist(G.story.kin.x, G.story.kin.y, G.world.buildings[G.story.store].door.x, G.world.buildings[G.story.store].door.y) < 60, errs: window.__errs }));
      t.ok(r.ach, 'başarım'); t.ok(r.hud, 'izleyici kapanır'); t.ok(r.kin, 'Anton dükkânın önünde kalır');
      t.eq(r.errs, [], 'konsolda hata yok');
    });
  },
};
