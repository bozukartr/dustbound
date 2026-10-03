'use strict';
/* Demiryolu İşçisi hikâyesi "Raylar ve Toz": Fort Mercy ve ray kampı, on bölüm, kayıt/yükleme */
module.exports = {
  name: 'Demiryolu hikâyesi',
  timeout: 400000,
  async run(t) {
    const p = await t.page({ story: true, init: () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; } });
    const waitStep = (ch, st, ms = 15000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    const talk = () => p.evaluate(() => { const e = G.mentorEnt(); const a = e && G.mentorActions(e).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; });
    const toCamp = () => p.evaluate(() => { const R = G.story.rc; UI.closeAll(); TH.goto(R.x + 10, R.y + 30); });
    const noon = () => p.evaluate(() => { if (G.hour < 8 || G.hour > 13) G.sSkipTo(9); const P = G.player; P.energy = 100; P.hunger = 100; P.thirst = 100; });

    await t.step('Demiryolu İşçisi hikâyeyle başlar: Fort Mercy, Boone, ray kampı', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const lab = await p.evaluate(() => {
        document.querySelectorAll('.cr-tab')[3].click();
        [...document.querySelectorAll('.cr-card')].find(n => n.dataset.bg === 'rail').click();
        return [...document.querySelectorAll('.opt')].find(n => /Hikâyeli/.test(n.textContent)).textContent;
      });
      t.ok(/Açık/.test(lab), 'demiryolcunun hikâyesi var', lab);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await t.sleep(600); await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await waitStep(0, 0);
      await p.waitForFunction(() => G.mentorEnt(), null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const P = G.player, S = G.story, e = G.mentorEnt(), B = G.world.buildings, T = G.world.townAt(S.rc.x, S.rc.y, 2);
        return { id: S.id, name: e.name, d: dist(e.x, e.y, P.x, P.y), town: S.town, rcTown: !!T, rcD: dist(S.rc.x, S.rc.y, G.sTown().cx, G.sTown().cy), poi: G.world.pois.some(q => q.id === 'railcamp'),
          rocks: S.rocks.length, dest: S.dest !== S.town && !!G.world.towns.find(x => x.id === S.dest).station, hotel: B[S.hotel] && B[S.hotel].town === S.dest, bank: B[S.bank] && B[S.bank].type, trail: S.trail.length, camp: !!S.camp };
      });
      t.eq(r.id, 'rail', 'hikâye: Raylar ve Toz'); t.eq(r.name, 'Walt Boone', 'akıl hocası Boone'); t.ok(r.d < 120, 'Boone yanında', r.d);
      t.eq(r.town, 'fortmercy', 'kasaba Fort Mercy'); t.ok(!r.rcTown && r.rcD < 1700, 'ray kampı kasabanın dışında, yakında', r.rcD); t.ok(r.poi, 'kamp haritada');
      t.eq(r.rocks, 4, 'heyelanda dört kaya'); t.ok(r.dest && r.hotel, 'tren durağı ve Hale\'in oteli', r); t.eq(r.bank, 'bank', 'banka'); t.eq(r.trail, 6, 'nal izleri'); t.ok(r.camp, 'sığınak');
    });

    await t.step('bölüm 1: Boone, kampa yürü, ray döşe, ye', async () => {
      t.ok(await talk(), 'Konuş');
      await waitStep(0, 1);
      await toCamp();
      await waitStep(0, 2);
      t.ok(await p.evaluate(() => G.ents.filter(e => e.storyNpc === 'crew').length === 3 && G.ents.some(e => e.rlKey === 'fire')), 'kampta ekip ve ateş');
      await noon();
      const w = await p.evaluate(() => { const e = G.mentorEnt(); TH.goto(e.x + 12, e.y); const a = G.mentorActions(e).find(x => x.n === JOBS.rail.n); if (!a) return false; G.work('rail', 'Ray Kampı'); return true; });
      t.ok(w, 'Boone\'da Ray Döşe');
      await waitStep(0, 3, 20000);
      await p.evaluate(() => G.consume('stew'));
      await waitStep(1, 0, 20000);
    });

    await t.step('bölüm 2: heyelan, kazmayla üç kaya, dinamitle büyük kaya', async () => {
      t.ok(await p.evaluate(() => G.player.has('pickaxe') && G.player.count('dynamite') >= 2), 'kazma ve dinamit');
      await p.evaluate(() => { const L = G.story.slide; TH.goto(L.x + 40, L.y + 60); G.godMode = true; });
      await waitStep(1, 1);
      await p.waitForFunction(() => G.ents.filter(e => e.rlKey && e.rlKey.startsWith('rock')).length === 4, null, { timeout: 5000 });
      for (let i = 0; i < 3; i++) {
        const ok = await p.evaluate((i) => { const e = G.ents.find(x => x.rlKey === 'rock' + i && !x.remove); TH.goto(e.x + 8, e.y + 4); return TH.act(/Kazmayla Kır/); }, i);
        t.ok(ok, 'Kazmayla Kır ' + i);
      }
      await waitStep(1, 2);
      await p.evaluate(() => { const r = G.story.rocks.find(x => x.big); TH.goto(r.x + 120, r.y); G.explode(r.x + 4, r.y, G.player); });
      await waitStep(2, 0, 20000);
      t.ok(await p.evaluate(() => !G.ents.some(e => e.rlKey === 'rock3' && !e.remove)), 'büyük kaya yok');
    });

    await t.step('bölüm 3: trenle Hale\'in kasabasına, mektup, kampa dönüş', async () => {
      const ok = await p.evaluate(() => { const st = G.sBld('station'); TH.inside(st); UI.openTrain(st); return TH.clickItem(new RegExp(G.rlDest().n)); });
      t.ok(ok, 'tren bileti');
      await waitStep(2, 1, 20000);
      const acts = await p.evaluate(() => { const b = G.world.buildings[G.story.hotel]; TH.inside(b); UI.openBuilding(b); return TH.menuLabels(); });
      t.ok(acts.some(a => /Boone'un Mektubunu Ver/.test(a)), 'mektubu verme seçeneği', acts);
      await p.evaluate(() => TH.clickItem(/Boone'un Mektubunu Ver/));
      await waitStep(2, 2, 15000);
      await toCamp();
      await waitStep(3, 0, 20000);
    });

    await t.step('bölüm 4: kesim yeri, iki travers demetini kampa taşı', async () => {
      await p.evaluate(() => { const C = G.story.cut; TH.goto(C.x, C.y + 20); });
      await waitStep(3, 1);
      for (let k = 0; k < 2; k++) {
        await p.evaluate(() => { const R = G.story.rc, c = G.ents.find(e => e.kind === 'crate' && e.g === 'ties' && !e.remove && dist(e.x, e.y, R.x, R.y) > 110); TH.goto(c.x + 6, c.y); G.pickUp(c); });
        t.ok(await p.evaluate(() => G.player.carry && G.player.carry.g === 'ties'), 'demet omuzda');
        await p.evaluate((k) => { const R = G.story.rc; TH.goto(R.x - 20 + k * 16, R.y + 40); G.dropCarry(); }, k);
      }
      await waitStep(4, 0, 20000);
    });

    await t.step('bölüm 5: maaş, bankaya yatır, kampa dön', async () => {
      const m = await p.evaluate(() => G.player.money);
      t.ok(m >= 4, 'maaş alındı', m);
      await p.evaluate(() => { const b = G.world.buildings[G.story.bank]; TH.inside(b); UI.openBank(); TH.clickItem(/Tümünü Yatır/); UI.closeAll(); });
      await waitStep(4, 1);
      t.ok(await p.evaluate(() => G.bank > 0), 'para bankada');
      await toCamp();
      await waitStep(5, 0, 20000);
    });

    await t.step('kayıt ve yükleme hikâyeyi ve kampı sürdürür', async () => {
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await p.waitForFunction(() => G.story && G.story.ch === 5 && !G.story.wait, null, { timeout: 10000 });
      await toCamp();
      await p.waitForFunction(() => G.ents.some(e => e.rlKey === 'fire') && G.world.pois.some(q => q.id === 'railcamp'), null, { timeout: 8000 });
      t.eq(await p.evaluate(() => G.story.id), 'rail', 'hikâye korunur');
    });

    await t.step('bölüm 6: soyulan araba, yaralı arabacı, saloonda söylenti', async () => {
      await p.evaluate(() => { const R = G.story.rob; TH.goto(R.x + 30, R.y + 10); });
      await waitStep(5, 1);
      await p.waitForFunction(() => G.ents.some(e => e.storyNpc === 'driver'), null, { timeout: 5000 });
      t.ok(await p.evaluate(() => { const e = G.ents.find(x => x.storyNpc === 'driver'); TH.goto(e.x + 12, e.y); return TH.act(/Yarasını Sar/); }), 'Yarasını Sar ve Dinle');
      await waitStep(5, 2);
      await p.evaluate(() => { G.player.money += 1; TH.inside(G.sBld(['saloon', 'cantina'])); UI.rumor(); UI.closeAll(); });
      await waitStep(6, 0, 20000);
      t.ok(await p.evaluate(() => { const cp = G.world.pois.find(q => q.pid === G.story.camp.pid); return G.story.campKnown && (!cp || G.rumored.has(cp.id) || G.discovered.has(cp.id)); }), 'sığınak haritada');
    });

    await t.step('bölüm 7: yük arabası, iki sandık erzak, kampa getir', async () => {
      t.ok(await p.evaluate(() => !!G.myWagon), 'şirketin arabası');
      t.ok(await p.evaluate(() => G.myWagonActions(G.myWagon).some(a => a.n === Tr('Arabayı Sür'))), 'Arabayı Sür eylemi');
      await p.evaluate(() => { const w = G.myWagon, P = G.player; TH.goto(w.x + 10, w.y + 6); P.mount(w, true); P.mountAnim = null; });
      await waitStep(6, 1);
      await p.evaluate(() => { const P = G.player, w = G.myWagon, b = G.sBld('general'); P.dismount(); P.mountAnim = null; w.x = b.door.x + 30; w.y = b.door.y + 26; w.bx = undefined; TH.inside(b); const gd = G.goodsAt(b).find(x => x.g === 'dry'); G.buyGoods(b, 'dry', gd.p, 2); });
      await waitStep(6, 2);
      t.eq(await p.evaluate(() => G.myWagon.crates.filter(g => g === 'dry').length), 2, 'sandıklar arabada');
      await p.evaluate(() => { const R = G.story.rc, w = G.myWagon; w.x = R.x + 40; w.y = R.y + 40; w.bx = undefined; TH.goto(R.x + 20, R.y + 50); });
      await waitStep(7, 0, 20000);
      t.eq(await p.evaluate(() => G.myWagon.crates.length), 0, 'ekip erzakı indirdi');
    });

    await t.step('bölüm 8: nal izlerini sür, sığınağı dürbünle gözetle', async () => {
      for (let i = 0; i < 6; i++) {
        await p.evaluate((i) => { const q = G.story.trail[i]; TH.goto(q.x, q.y); }, i);
        await p.waitForFunction((i) => G.story.ti > i, i, { timeout: 4000 });
      }
      await waitStep(7, 1);
      await p.evaluate(() => { const S = G.story, s = G.findSpawnPos(S.camp.x + 380, S.camp.y + 60, 0, 70) || [S.camp.x + 380, S.camp.y + 60]; UI.closeAll(); TH.goto(s[0], s[1]); });
      await p.waitForFunction(() => !G.insideB, null, { timeout: 5000 });
      await p.evaluate(() => { const S = G.story, P = G.player; G.toggleBinoc(); G.binoc.x = S.camp.x - P.x; G.binoc.y = S.camp.y - P.y; });
      await waitStep(8, 0, 20000);
    });

    await t.step('bölüm 9: sığınağa baskın, Hale\'i bağla, maaş sandığını al', async () => {
      await p.evaluate(() => { if (G.binoc) G.binocOff(); const S = G.story; TH.goto(S.camp.x + 60, S.camp.y + 40); G.godMode = true; });
      await p.waitForFunction(() => G.rivalEnt(), null, { timeout: 8000 });
      await p.evaluate(() => { for (const e of G.ents) if (e.kind === 'npc' && e.role === 'bandit' && !e.quest) e.remove = true; });
      await waitStep(8, 1);
      await p.evaluate(() => { const j = G.rivalEnt(); TH.goto(j.x + 30, j.y); G.lassoHit(j); G.hogtie(j); });
      await waitStep(8, 2);
      await p.waitForFunction(() => G.ents.some(e => e.rlKey === 'chest'), null, { timeout: 5000 });
      t.ok(await p.evaluate(() => { const c = G.ents.find(e => e.rlKey === 'chest'); TH.goto(c.x + 8, c.y + 4); return TH.act(/Maaş Sandığını Al/); }), 'Maaş Sandığını Al');
      await waitStep(9, 0, 20000);
    });

    await t.step('bölüm 10: Hale\'i şerife teslim et, Boone\'la vedalaş', async () => {
      await p.evaluate(() => { const j = G.rivalEnt(); TH.goto(j.x + 10, j.y); G.pickUp(j); });
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => { const b = G.sBld('sheriff'), P = G.player; P.x = b.door.x; P.y = b.door.y + 10; G.deliverToSheriff({ e: P.carry, h: null }); });
      await waitStep(9, 1, 15000);
      t.ok(await p.evaluate((m0) => G.player.money - m0 >= 24.9, m0), 'Hale için ödül');
      await toCamp();
      await p.waitForFunction(() => G.mentorEnt() && dist(G.mentorEnt().x, G.mentorEnt().y, G.player.x, G.player.y) < 400, null, { timeout: 15000 });
      t.ok(await talk(), 'Boone ile konuş');
      await p.waitForFunction(() => G.story.done, null, { timeout: 15000 });
      const r = await p.evaluate(() => ({ ach: !!G.achieved.story_rail, wagon: !!G.myWagon, hud: document.getElementById('hud-quest').classList.contains('hidden'), errs: window.__errs }));
      t.ok(r.ach, 'başarım'); t.ok(r.wagon, 'yük arabası oyuncuda'); t.ok(r.hud, 'izleyici kapanır');
      t.eq(r.errs, [], 'konsolda hata yok');
    });
  },
};
