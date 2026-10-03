'use strict';
/* Kanun Kaçağı hikâyesi "Son İş": saklı kamptan başlayıp on bölüm, kayıt/yükleme ve iki son */
module.exports = {
  name: 'Kanun Kaçağı hikâyesi',
  timeout: 400000,
  async run(t) {
    const p = await t.page({ story: true, init: () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; } });
    const waitStep = (ch, st, ms = 15000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    const talk = () => p.evaluate(() => { const e = G.mentorEnt(); const a = e && G.mentorActions(e).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; });
    const home = () => p.evaluate(() => { const H = G.story.hideout, P = G.player; if (P.riding) { P.riding.x = H.x; P.riding.y = H.y + 30; } TH.goto(H.x, H.y + 30); });

    await t.step('Kanun Kaçağı hikâyeyle başlar: saklı kamp, Hollis ve çete ateşin başında', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const lab = await p.evaluate(() => {
        document.querySelectorAll('.cr-tab')[3].click();
        [...document.querySelectorAll('.cr-card')].find(n => n.dataset.bg === 'outlaw').click();
        return [...document.querySelectorAll('.opt')].find(n => /Hikâyeli/.test(n.textContent)).textContent;
      });
      t.ok(/Açık/.test(lab), 'kanun kaçağının hikâyesi var', lab);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await t.sleep(600); await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await waitStep(0, 0);
      await p.waitForFunction(() => G.mentorEnt() && G.ents.some(e => e.gang === 'Dutch'), null, { timeout: 8000 });
      const r = await p.evaluate(() => { const P = G.player, S = G.story, e = G.mentorEnt(); return { id: S.id, name: e.name, d: dist(e.x, e.y, P.x, P.y), gang: G.ents.filter(x => x.gang).map(x => x.gang), inTown: !!G.world.townAt(P.x, P.y, 20), hud: document.getElementById('hud-quest').textContent, amb: !!S.ambush, ride: !!S.ridePt, camp: !!S.camp }; });
      t.eq(r.id, 'outlaw', 'hikâye: Son İş'); t.eq(r.name, 'Hollis Crane', 'akıl hocası Hollis');
      t.ok(r.d < 120, 'Hollis yanında', r.d); t.ok(r.gang.includes('Dutch') && r.gang.includes('Pete'), 'çete kampta', r.gang);
      t.ok(!r.inTown, 'kasabada değil'); t.ok(r.amb && r.ride && r.camp, 'pusu, tepe ve Vance\'in kampı seçildi', r);
      t.ok(/Hollis/.test(r.hud), 'izleyici', r.hud);
    });

    await t.step('bölüm 1: konuş, ateşte pişir, ye, silahını doldur', async () => {
      t.ok(await talk(), 'Konuş');
      await waitStep(0, 1);
      t.ok(await p.evaluate(() => { UI.openCook(); const R = RECIPES.find(r => r.id === 'cook_game'); return TH.clickItem(new RegExp(R.n)); }), 'pişirildi');
      await p.evaluate(() => UI.closeAll());
      await waitStep(0, 2);
      await p.evaluate(() => { const id = Object.keys(G.player.inv).find(k => /cooked/.test(k) && G.player.count(k) > 0); G.consume(id); });
      await waitStep(0, 3);
      await p.evaluate(() => { const P = G.player; P.weapon = 'cattleman'; P.clip.cattleman = 0; P.reloadT = 0; P.startReload(); });
      await waitStep(1, 0);
    });

    await t.step('bölüm 2: ıslık, fırçala, bin, Hollis\'le tepeye dörtnala, kampa dön', async () => {
      await p.evaluate(() => G.whistle());
      await waitStep(1, 1);
      const br = await p.evaluate(() => { const P = G.player, h = G.horse; h.x = P.x + 10; h.y = P.y; h.state = 'idle'; return TH.act(/Fırçala/); });
      t.ok(br, 'Fırçala eylemi');
      await waitStep(1, 2);
      await p.evaluate(() => { const P = G.player, h = G.horse; h.x = P.x + 6; h.y = P.y; P.mount(h, true); P.mountAnim = null; });
      await waitStep(1, 3);
      const wp = await p.evaluate(() => !!G.waypoint);
      t.ok(wp, 'tepeye rota');
      await p.evaluate(() => { const R = G.story.ridePt, h = G.player.riding; h.x = R.x; h.y = R.y; G.player.x = h.x; G.player.y = h.y; });
      await waitStep(1, 4);
      await home();
      await waitStep(2, 0);
    });

    await t.step('bölüm 3: av, deri, kampa getir', async () => {
      await p.evaluate(() => { const P = G.player; if (P.riding) { P.dismount(); P.mountAnim = null; } });
      await p.waitForFunction(() => G.ents.some(e => e.storyGame && !e.dead), null, { timeout: 5000 });
      const herd = await p.evaluate(() => {
        const R = G.story.ranch, a = G.ents.find(e => e.storyGame && !e.dead);
        // her yanı kapalı bir yerde sıkışan hayvan her karede dönmemeli (pervane gibi)
        const b = new Animal(a.x, a.y, a.type); b.move = () => false; b.state = 'wander'; b.t = 9; b.spd = 20;
        let flips = 0, last = b.ang;
        for (let f = 0; f < 120; f++) { b.state = 'wander'; b.t = 9; b.update(1 / 60); if (Math.abs(angDiff(b.ang, last)) > 0.5) flips++; last = b.ang; }
        return { reach: G.storyReach([R.x, R.y], [a.x, a.y]), flips };
      });
      t.ok(herd.reach, 'av sürüsü kamptan yürüyerek ulaşılabilir yerde');
      t.ok(herd.flips <= 5, 'sıkışan hayvan yerinde fır dönmez', herd.flips);
      await p.evaluate(() => { const a = G.ents.find(e => e.storyGame && !e.dead); TH.goto(a.x + 12, a.y); a.hurt(999, 'player'); window.QA = a; });
      await waitStep(2, 1);
      await p.evaluate(() => G.skin(QA));
      await waitStep(2, 2);
      await home();
      await waitStep(3, 0);
    });

    await t.step('kayıt ve yükleme hikâyeyi ve kampı sürdürür', async () => {
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await p.waitForFunction(() => G.mentorEnt(), null, { timeout: 8000 });
      const r = await p.evaluate(() => ({ id: G.story.id, ch: G.story.ch, st: G.story.st, hid: !!G.hideout, mentors: G.ents.filter(e => e.quest === 'mentor' && !e.remove).length }));
      t.eq(r.id, 'outlaw', 'hikâye korunur'); t.eq(r.ch, 3, 'bölüm 4'); t.ok(r.hid, 'saklı kamp'); t.eq(r.mentors, 1, 'tek Hollis');
    });

    await t.step('bölüm 4: bandana, kasaba, maskesiz mühimmat, tanınmadan çık, kampa dön', async () => {
      t.ok(await talk(), 'Konuş');
      await waitStep(3, 1);
      await p.evaluate(() => G.toggleMask('mask_bandana'));
      await waitStep(3, 2);
      await p.evaluate(() => { const tw = G.sTown(); TH.goto(tw.spawn.x, tw.spawn.y); });
      await waitStep(3, 3);
      const bought = await p.evaluate(() => {
        G.toggleMask(null, true); G.player.money += 5;
        const b = G.sBld(['gunsmith', 'general']); UI.openShop(b.def.shop);
        return TH.clickItem(new RegExp(AMMO.pistol.n));
      });
      t.ok(bought, 'mühimmat alındı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(3, 4);
      await p.evaluate(() => { G.law.level = 0; });
      await home();
      await waitStep(4, 0, 20000);
      t.ok(await p.evaluate(() => G.ents.some(e => e.gang === 'Vance')), 'Vance kampa döndü');
    });

    await t.step('bölüm 5: mücevherleri kaçakçıya sat, terziden şapka al, kampa dön', async () => {
      const sold = await p.evaluate(() => {
        const b = G.olNearest('fence') || G.sBld('general'); TH.inside(b);
        UI.openShop(b.def.shop); const m = UI.top(); m.tab = 1; m.render();
        return TH.clickItem(new RegExp(ITEMS.pocket_watch.n));
      });
      t.ok(sold, 'saat satıldı');
      await p.evaluate(() => UI.closeAll());
      await p.waitForFunction(() => G.story.ch === 4 && G.story.st >= 1 && !G.story.wait, null, { timeout: 15000 });
      if (await p.evaluate(() => G.story.st === 1)) {
        const hat = await p.evaluate(() => { const b = G.olNearest('tailor'); TH.inside(b); G.player.money += 10; const id = SHOPS.tailor.sell.find(k => ITEMS[k].c === 'clothing' && !ITEMS[k].mask && !G.player.has(k)); UI.openShop('tailor'); return TH.clickItem(new RegExp(ITEMS[id].n)); });
        t.ok(hat, 'şapka alındı');
        await p.evaluate(() => UI.closeAll());
      }
      await waitStep(4, 2);
      await home();
      await waitStep(5, 0);
    });

    await t.step('bölüm 6: pusu, bandana, posta arabasını kementle durdur, çantayı ara', async () => {
      await p.evaluate(() => { const A = G.story.ambush; TH.goto(A.x, A.y + 4); TH.clearNpcs(); });
      await waitStep(5, 1);
      await p.evaluate(() => { if (!G.player.masked) G.toggleMask('mask_bandana'); });
      await waitStep(5, 2);
      await p.waitForFunction(() => G.olWagon(), null, { timeout: 8000 });
      const w = await p.evaluate(() => { const w = G.olWagon(); return { stage: w.stage, name: w.name }; });
      t.ok(w.stage, 'posta arabası yolda', w);
      await p.evaluate(() => { const w = G.olWagon(); G.lassoHit(w.throwDriver()); });
      await waitStep(5, 3);
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => G.lootWagon(G.olWagon()));
      await waitStep(6, 0);
      t.ok(await p.evaluate((m0) => G.player.money > m0, m0), 'çantadan para çıktı');
      t.ok(!(await p.evaluate(() => G.story.flags.blood)), 'kimse ölmedi');
    });

    await t.step('bölüm 7: kanunu at, kampa dön', async () => {
      await p.evaluate(() => { G.law.level = 0; for (const r of G.reports) r.done = true; });
      await waitStep(6, 1);
      await home();
      await waitStep(7, 0, 20000);
    });

    await t.step('bölüm 8: kamptan uzaklaş, ödül avcıları çıkar ve püskürtülür, kampa dön', async () => {
      await p.evaluate(() => { if (G.law.bounty < 20) G.law.bounty = 25; const H = G.story.hideout; let s = null; for (let k = 0; k < 40 && !s; k++) { const c = G.findSpawnPos(H.x, H.y, 650, 820); if (c && dist(c[0], c[1], H.x, H.y) > 560 && !G.world.townAt(c[0], c[1], 4)) s = c; } s = s || [H.x + 700, H.y]; TH.goto(s[0], s[1]); TH.clearNpcs(); G.godMode = true; });
      await waitStep(7, 1);
      await p.waitForFunction(() => G.posse && G.story.flags.posse, null, { timeout: 10000 });
      await p.evaluate(() => { for (const e of G.posse.ents) e.hurt(9999, 'player'); });
      await waitStep(7, 2);
      await home();
      await waitStep(8, 0, 20000);
      t.ok(await p.evaluate(() => G.ents.some(e => e.gang === 'Dutch') && !G.ents.some(e => e.gang === 'Vance' && !e.remove)), 'kamp boş, Dutch yaralı');
    });

    await t.step('bölüm 9: Vance\'in kampını gözetle, Hollis\'i kurtar', async () => {
      await p.evaluate(() => { const S = G.story, P = G.player, s = G.findSpawnPos(S.camp.x + 380, S.camp.y + 60, 0, 70) || [S.camp.x + 380, S.camp.y + 60]; TH.goto(s[0], s[1]); G.toggleBinoc(); G.binoc.x = S.camp.x - P.x; G.binoc.y = S.camp.y - P.y; });
      await waitStep(8, 1, 8000);
      await p.evaluate(() => { if (G.binoc) G.binocOff(); const S = G.story; TH.goto(S.camp.x - 30, S.camp.y + 20); });
      await p.waitForFunction(() => G.mentorEnt() && G.mentorEnt().state === 'tied', null, { timeout: 8000 });
      const freed = await p.evaluate(() => { if (G.player.carry) G.dropCarry(true); for (const e of G.ents) if (e.kind === 'npc' && e.role === 'bandit' && !e.quest) e.remove = true; const e = G.mentorEnt(); TH.goto(e.x + 12, e.y); return TH.act(/İplerini Kes/); });
      t.ok(freed, 'İplerini Kes');
      await p.waitForFunction(() => G.story.ch === 9 && G.story.st === 0 && UI.isModal(), null, { timeout: 15000 });
    });

    await t.step('bölüm 10 (kanunun yolu): seç, Vance\'i bağla, şerife teslim et, Hollis\'le vedalaş', async () => {
      t.ok(await p.evaluate(() => TH.clickItem(/Vance'i yakala/)), 'seçim: kanunun yolu');
      await waitStep(9, 1);
      await p.waitForFunction(() => G.rivalEnt(), null, { timeout: 8000 });
      await p.evaluate(() => { for (const e of G.ents) if (e.role === 'bandit' && !e.quest) e.remove = true; const j = G.rivalEnt(); TH.goto(j.x + 30, j.y); G.lassoHit(j); G.hogtie(j); });
      await waitStep(9, 2);
      await p.evaluate(() => { const j = G.rivalEnt(); G.pickUp(j); });
      const m0 = await p.evaluate(() => G.player.money);
      await p.evaluate(() => { const b = G.sBld('sheriff'), P = G.player; P.x = b.door.x; P.y = b.door.y + 10; G.deliverToSheriff({ e: P.carry, h: null }); });
      await waitStep(9, 4, 15000);
      t.ok(await p.evaluate((m0) => G.player.money - m0 >= 29.9, m0), 'Vance için ödül');
      await p.waitForFunction(() => G.mentorEnt() && dist(G.mentorEnt().x, G.mentorEnt().y, G.player.x, G.player.y) < 400, null, { timeout: 15000 });
      t.ok(await talk(), 'Hollis ile konuş');
      await p.waitForFunction(() => G.story.done, null, { timeout: 15000 });
      const r = await p.evaluate(() => ({ bounty: G.law.bounty, ach: !!G.achieved.story_outlaw, gun: G.player.weapons.has('schofield'), hud: document.getElementById('hud-quest').classList.contains('hidden'), errs: window.__errs }));
      t.eq(r.bounty, 0, 'sicil temiz'); t.ok(r.ach, 'başarım'); t.ok(r.gun, 'Hollis\'in tabancası'); t.ok(r.hud, 'izleyici kapanır');
      t.eq(r.errs, [], 'konsolda hata yok');
    });

    await t.step('bölüm 10 (kendi yolun): seç, şerifte teslim ol, cezayı öde', async () => {
      await p.evaluate(() => { const S = G.story; Object.assign(S, { done: false, on: true, wait: false, jack: 'free' }); delete S.choice; delete S.alive; S.flags.confessed = 0; S.sully = { x: G.player.x + 30, y: G.player.y }; G.law.bounty = 20; G.player.money += 30; G.qChapter(9); });
      await p.waitForFunction(() => G.story.ch === 9 && UI.isModal() && TH.menuLabels().some(l => /teslim ol/i.test(l)), null, { timeout: 15000 });
      t.ok(await p.evaluate(() => TH.clickItem(/Şerife git, teslim ol/)), 'seçim: kendi yolun');
      await waitStep(9, 3);
      const acts = await p.evaluate(() => { if (G.player.masked) G.toggleMask(null, true); const b = G.sBld('sheriff'); TH.inside(b); UI.openBuilding(b); return TH.menuLabels(); });
      t.ok(acts.some(a => /Teslim Ol ve Hesap Ver/.test(a)), 'şerifte teslim olma seçeneği', acts);
      await p.evaluate(() => TH.clickItem(/Teslim Ol ve Hesap Ver/));
      await t.sleep(200);
      t.ok(await p.evaluate(() => TH.clickItem(/Cezayı Öde/)), 'cezayı öde');
      await waitStep(9, 4, 15000);
      t.eq(await p.evaluate(() => G.law.bounty), 0, 'borç kapandı');
    });
  },
};
