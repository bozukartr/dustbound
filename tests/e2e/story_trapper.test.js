'use strict';
/* Tuzakçı hikâyesi "Babamın Tuzakları": Cedar Falls, Elias, on bölüm, yaralı babanın eyerde kaydı */
module.exports = {
  name: 'Tuzakçı hikâyesi',
  timeout: 420000,
  async run(t) {
    const p = await t.page({ story: true, init: () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; } });
    const waitStep = async (ch, st, ms = 15000) => {
      try { await p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms }); }
      catch (e) { const s = await p.evaluate(() => { const S = G.story; return { ch: S.ch, st: S.st, wait: S.wait, n: S.n, hud: document.getElementById('hud-quest').textContent, talk: !!(S.talkQ && S.talkQ.length), modal: UI.isModal() }; }); throw new Error(`bölüm ${ch}.${st} beklenirken: ${JSON.stringify(s)}`); }
    };
    const talk = () => p.evaluate(() => { const e = G.mentorEnt(); const a = e && G.mentorActions(e).find(x => x.n === Tr('Konuş')); if (!a) return false; a.fn(); return true; });
    const toCamp = () => p.evaluate(() => { const E = G.story.ec; UI.closeAll(); TH.goto(E.x + 10, E.y + 30); });
    const reload = async () => {
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
    };

    await t.step('Tuzakçı hikâyeyle başlar: Cedar Falls, Elias, kamp ve yerler', async () => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const lab = await p.evaluate(() => {
        document.querySelectorAll('.cr-tab')[3].click();
        [...document.querySelectorAll('.cr-card')].find(n => n.dataset.bg === 'trapper').click();
        return [...document.querySelectorAll('.opt')].find(n => /Hikâyeli/.test(n.textContent)).textContent;
      });
      t.ok(/Açık/.test(lab), 'tuzakçının hikâyesi var', lab);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await t.sleep(600); await t.helpers(p);
      await p.evaluate(() => { window.__storyFast = true; UI.el.help.classList.add('hidden'); });
      await waitStep(0, 0);
      await p.waitForFunction(() => G.mentorEnt(), null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const P = G.player, S = G.story, e = G.mentorEnt(), W = G.world, T = G.sTown();
        return { id: S.id, name: e.name, d: dist(e.x, e.y, P.x, P.y), town: S.town, ecTown: !!W.townAt(S.ec.x, S.ec.y, 2), ecD: dist(S.ec.x, S.ec.y, T.cx, T.cy), poi: W.pois.some(q => q.id === 'eliascamp'),
          trk: S.trk.length, herdTown: !!W.townAt(S.herd.x, S.herd.y, 10), north: !!S.north, look: !!S.look, cave: S.cave.bid >= 0 && W.buildings[S.cave.bid].cave, fc: !!S.fc, den: !!S.den, btrail: S.btrail.length,
          doc: !!G.sBld('doctor'), tailor: !!G.sBld('tailor'), butcher: !!G.sBld('butcher') };
      });
      t.eq(r.id, 'trapper', 'hikâye: Babamın Tuzakları'); t.eq(r.name, 'Elias Crowe', 'akıl hocası Elias'); t.ok(r.d < 120, 'Elias yanında', r.d);
      t.eq(r.town, 'cedarfalls', 'kasaba Cedar Falls'); t.ok(!r.ecTown && r.ecD < 1400, 'Elias\'ın kampı kasabanın dışında, yakında', r.ecD); t.ok(r.poi, 'kamp haritada');
      t.eq(r.trk, 5, 'beş geyik izi'); t.ok(!r.herdTown, 'sürü kasabadan uzakta'); t.ok(r.north && r.look && r.fc && r.den, 'kuzey kampı, tepe, kulübe, vadi', r);
      t.ok(r.cave, 'Ayı İni mağarası'); t.eq(r.btrail, 5, 'ayı izleri'); t.ok(r.doc && r.tailor && r.butcher, 'doktor, terzi, kasap', r);
    });

    await t.step('bölüm 1: Elias, kampa yürü, çömelip izleri oku', async () => {
      t.ok(await talk(), 'Konuş');
      await waitStep(0, 1);
      await toCamp();
      await waitStep(0, 2);
      t.ok(await p.evaluate(() => G.ents.some(e => e.trKey === 'fire') && G.ents.some(e => e.trKey === 'rack')), 'kampta ateş ve kurutma çerçevesi');
      // ayaktayken iz okunmaz
      await p.evaluate(() => { const q = G.story.trk[0], P = G.player; TH.goto(q.x, q.y); P.crouch = false; });
      await t.sleep(700);
      t.eq(await p.evaluate(() => G.story.ti || 0), 0, 'ayakta iz okunmaz');
      for (let i = 0; i < 5; i++) {
        await p.evaluate((i) => { const q = G.story.trk[i]; TH.goto(q.x, q.y); G.player.crouch = true; }, i);
        await p.waitForFunction((i) => G.story.ti > i, i, { timeout: 4000 });
      }
      await waitStep(1, 0, 20000);
    });

    await t.step('bölüm 2: sürüye yaklaş, yayla avla (tüfekle olmaz), derisini yüz', async () => {
      t.ok(await p.evaluate(() => G.player.weapons.has('bow') && G.player.ammo.arrow >= 12), 'yay ve ok');
      await p.evaluate(() => { const H = G.story.herd, E = G.story.ec, a = Math.atan2(E.y - H.y, E.x - H.x); G.player.crouch = false; TH.goto(H.x + Math.cos(a) * 500, H.y + Math.sin(a) * 500); });
      await p.waitForFunction(() => G.ents.filter(e => e.storyDeer && !e.dead).length === 3, null, { timeout: 6000 });
      await p.evaluate(() => { const H = G.story.herd; TH.goto(H.x + 150, H.y + 60); });
      await waitStep(1, 1);
      await p.evaluate(() => { const d = G.ents.find(e => e.storyDeer && !e.dead); d.hurt(999, 'player', 'gun'); });
      await t.sleep(600);
      t.ok(await p.evaluate(() => G.story.ch === 1 && G.story.st === 1), 'tüfekle vurulan geyik sayılmaz');
      await p.evaluate(() => { const d = G.ents.find(e => e.storyDeer && !e.dead); G.player.x = d.x + 40; G.player.y = d.y; d.hurt(999, 'player', 'arrow'); });
      await waitStep(1, 2);
      await p.evaluate(() => { const d = G.ents.find(e => e.storyDeer && e.dead && e.how === 'arrow'); TH.goto(d.x + 8, d.y); G.skin(d); });
      await waitStep(2, 0, 20000);
      t.ok(await p.evaluate(() => G.player.carry && G.player.carry.kind === 'pelt'), 'post omuzda');
    });

    await t.step('bölüm 3: postu kasapta sat, babanın son izi, kampa dön', async () => {
      await p.evaluate(() => { const b = G.sBld('butcher'); TH.inside(b); G.sellCarried('butcher'); UI.closeAll(); });
      await waitStep(2, 1, 15000);
      await toCamp();
      await waitStep(3, 0, 20000);
    });

    await t.step('bölüm 4: kürk manto al ve giy, kuzeye git, kamp kur, et pişir', async () => {
      const ok = await p.evaluate(() => { const b = G.sBld('tailor'); TH.inside(b); UI.openShop('tailor', b.name); return TH.clickItem(new RegExp(ITEMS.coat_fur.n)); });
      t.ok(ok, 'Kürk Manto satın alındı');
      await p.evaluate(() => UI.closeAll());
      await waitStep(3, 1);
      await p.evaluate(() => G.consume('coat_fur'));
      await waitStep(3, 2);
      t.eq(await p.evaluate(() => G.player.coat), 'coat_fur', 'manto üstünde');
      await p.evaluate(() => { const N = G.story.north; TH.goto(N.x, N.y + 20); });
      await waitStep(3, 3);
      await p.evaluate(() => { for (const e of G.ents) if (e.hostile || (e.kind === 'animal' && e.state === 'attack')) e.remove = true; G.law.level = 0; G.setupCamp(); if (!G.camp) { const o = TH.openSpot(G.player.x, G.player.y, 40); TH.goto(o[0], o[1]); G.setupCamp(); } UI.closeAll(); });
      await waitStep(3, 4);
      const ok2 = await p.evaluate(() => { UI.closeAll(); UI.openCook(); const R = RECIPES.find(r => r.id === 'cook_game'); return TH.clickItem(new RegExp(R.n)); });
      t.ok(ok2, 'et pişti');
      await p.evaluate(() => UI.closeAll());
      await waitStep(4, 0, 20000);
    });

    await t.step('bölüm 5: gece kurt sürüsü, püskürt, sabaha kadar uyu', async () => {
      const r = await p.evaluate(() => ({ n: G.ents.filter(e => e.storyWolf && !e.dead).length, night: G.isNight, gun: G.hasGun() }));
      t.eq(r.n, 3, 'üç kurt'); t.ok(r.night, 'gece'); t.ok(r.gun, 'tüfek var');
      await p.evaluate(() => { G.godMode = true; for (const e of G.ents) if (e.storyWolf && !e.dead) e.hurt(999, 'player', 'gun'); });
      await waitStep(4, 1);
      await p.evaluate(() => { UI.closeAll(); G.sleep(8, 'camp'); });
      await waitStep(5, 0, 20000);
    });

    await t.step('kayıt ve yükleme hikâyeyi ve kampı sürdürür', async () => {
      await reload();
      await p.waitForFunction(() => G.story && G.story.ch === 5 && !G.story.wait, null, { timeout: 10000 });
      await toCamp();
      await p.waitForFunction(() => G.ents.some(e => e.trKey === 'fire') && G.world.pois.some(q => q.id === 'eliascamp'), null, { timeout: 8000 });
      t.eq(await p.evaluate(() => G.story.id), 'trapper', 'hikâye korunur');
    });

    await t.step('bölüm 6: gözetleme tepesi haritayı açar, dürbünle mağarayı gör', async () => {
      const before = await p.evaluate(() => { const L = G.story.look, R = G.reveal; let n = 0; for (let k = 0; k < R.length; k++) n += R[k] ? 1 : 0; return n; });
      await p.evaluate(() => { const L = G.story.look; TH.goto(L.x, L.y); });
      await waitStep(5, 1);
      const after = await p.evaluate(() => { const R = G.reveal; let n = 0; for (let k = 0; k < R.length; k++) n += R[k] ? 1 : 0; return n; });
      t.ok(after > before, 'harita açıldı', [before, after]);
      await p.evaluate(() => { UI.closeAll(); G.toggleBinoc(); G.binoc.x = 300; G.binoc.y = -60; });
      await waitStep(6, 0, 20000);
      t.ok(await p.evaluate(() => { const S = G.story; if (G.binoc) G.binocOff(); return S.caveKnown && (!S.cave.poi || G.rumored.has(S.cave.poi) || G.discovered.has(S.cave.poi)); }), 'mağara haritada');
    });

    await t.step('bölüm 7: fenerle Ayı İni\'ne in, babanın notu', async () => {
      t.ok(await p.evaluate(() => G.player.has('lantern')), 'fener');
      await p.evaluate(() => { const C = G.story.cave; TH.goto(C.x, C.y + 10); });
      await waitStep(6, 1);
      await p.evaluate(() => G.exploreMine(G.world.buildings[G.story.cave.bid]));
      await waitStep(7, 0, 20000);
      t.ok(await p.evaluate(() => G.world.pois.some(q => q.id === 'fathercabin') && (G.rumored.has('fathercabin') || G.discovered.has('fathercabin'))), 'babanın kulübesi haritada');
    });

    await t.step('bölüm 8: babanın kulübesi, üç ipucu', async () => {
      await p.evaluate(() => { UI.closeAll(); const F = G.story.fc; TH.goto(F.x, F.y + 40); });
      await waitStep(7, 1);
      await p.waitForFunction(() => G.ents.filter(e => e.trKey && e.trKey.startsWith('clue')).length === 3 && G.ents.some(e => e.trKey === 'shack'), null, { timeout: 5000 });
      for (let i = 0; i < 3; i++) {
        const ok = await p.evaluate((i) => { const e = G.ents.find(x => x.trKey === 'clue' + i); TH.goto(e.x + 6, e.y + 4); G.player.ang = Math.PI; return TH.act(/İncele/); }, i);
        t.ok(ok, 'İncele ' + i);
      }
      await waitStep(8, 0, 20000);
    });

    await t.step('bölüm 9: ayı izleri, Yaşlı Kral, yaralı baba', async () => {
      for (let i = 0; i < 5; i++) {
        await p.evaluate((i) => { const q = G.story.btrail[i]; TH.goto(q.x, q.y); }, i);
        await p.waitForFunction((i) => G.story.bi > i, i, { timeout: 4000 });
      }
      await waitStep(8, 1);
      await p.evaluate(() => { const D = G.story.den; TH.goto(D.x + 260, D.y); G.godMode = true; });
      await p.waitForFunction(() => G.ents.some(e => e.legend && !e.dead), null, { timeout: 5000 });
      const b = await p.evaluate(() => { const e = G.ents.find(x => x.legend); return { n: e.def.n, hp: e.hp, len: e.def.len, base: ANIMALS.bear.len }; });
      t.eq(b.n, 'Yaşlı Kral', 'efsanevi ayı'); t.ok(b.hp >= 700 && b.len > b.base, 'iri ve dayanıklı', b);
      await p.evaluate(() => { const e = G.ents.find(x => x.legend); e.hurt(9999, 'player', 'gun'); });
      await waitStep(8, 2);
      await p.evaluate(() => { const F = G.story.fp; TH.goto(F.x + 30, F.y); });
      await waitStep(9, 0, 20000);
      t.ok(await p.evaluate(() => { const w = G.trWardEnt(); return !!w && w.state === 'downed'; }), 'baba yaralı, yerde');
    });

    await t.step('bölüm 10: yarayı sar, eyere yükle (kayıtta korunur), doktora yetiştir', async () => {
      const acts0 = await p.evaluate(() => { const w = G.trWardEnt(); TH.goto(w.x + 8, w.y); G.player.ang = Math.PI; return TH.actions(); });
      t.ok(acts0.some(a => /Yarasını Sar/.test(a)) && !acts0.some(a => /Bağla/.test(a)), 'Yarasını Sar; bağlanmaz', acts0);
      t.ok(await p.evaluate(() => TH.act(/Yarasını Sar/)), 'Yarasını Sar');
      await waitStep(9, 1);
      await p.evaluate(() => { const w = G.trWardEnt(), h = G.horse; h.x = w.x + 20; h.y = w.y + 6; G.pickUp(w); G.stowOnHorse(h); });
      await waitStep(9, 2);
      t.ok(await p.evaluate(() => G.horse.load.some(e => e.quest === 'ward')), 'baba eyerde');
      await reload();
      await p.waitForFunction(() => G.story && G.story.ch === 9 && G.story.st === 2 && !G.story.wait, null, { timeout: 10000 });
      t.ok(await p.evaluate(() => { const w = G.horse.load.find(e => e.quest === 'ward'); return !!w && w.state === 'downed'; }), 'yükten sonra baba hâlâ eyerde, baygın');
      const labels = await p.evaluate(() => { const b = G.sBld('doctor'), h = G.horse; h.x = b.door.x + 20; h.y = b.door.y + 24; TH.inside(b); UI.openBuilding(b); return TH.menuLabels(); });
      t.ok(labels.some(a => /Babanı Doktora Teslim Et/.test(a)), 'doktorda teslim seçeneği', labels);
      await p.evaluate(() => TH.clickItem(/Babanı Doktora Teslim Et/));
      await p.waitForFunction(() => G.story.done, null, { timeout: 20000 });
      const r = await p.evaluate(() => ({ ach: !!G.achieved.story_trapper, kin: !!G.story.kin, load: G.horse.load.some(e => e.quest === 'ward'), hud: document.getElementById('hud-quest').classList.contains('hidden'), errs: window.__errs }));
      t.ok(r.ach, 'başarım'); t.ok(r.kin && !r.load, 'baba Elias\'ın kampında iyileşiyor'); t.ok(r.hud, 'izleyici kapanır');
      t.eq(r.errs, [], 'konsolda hata yok');
    });
  },
};
