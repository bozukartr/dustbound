'use strict';
/* Tanıklar, rüşvet ve tehdit, maske, tutuklama ve teslim olma */
module.exports = {
  name: 'Kanun, tanıklar ve tutuklama',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const setup = () => p.evaluate(() => {
      UI.closeAll(); const P = G.player, tw = TH.town('harlow');
      for (let k = 0; k < 80; k++) { P.x = tw.cx + 1600 + k * 23; P.y = tw.cy + 200; if (!G.world.blocked(P.x, P.y, 8) && G.los(P.x, P.y, P.x + 200, P.y)) break; }
      if (P.riding) P.dismount();
      TH.clearNpcs(); G.reports.length = 0; P.money = 100; P.hp = P.maxHp;
      Object.assign(G.law, { level: 0, bounty: 0, maskBounty: 0, masked: false, desc: null, unseen: 0, resist: false, arrestT: 0, fleeT: 0, warned: false });
      G.cam.x = P.x; G.cam.y = P.y;
      window.mk = (dx, dy, role, o) => { const n = new NPC(P.x + dx, P.y + dy, role, o || {}); G.addEnt(n); return n; };
    });
    await t.step('tanık kanun adamına koşup haber verir, aranma başlar', async () => {
      await setup();
      // arada yakına biri doğmuş olabilir: suçtan hemen önce yeniden temizle
      await p.evaluate(() => { TH.clearNpcs(); window.w = mk(40, 0, 'traveler'); window.law = mk(420, 0, 'law'); law.state = 'static'; G.crime('robbery', G.player.x, G.player.y, null); });
      const r0 = await p.evaluate(() => ({ reports: G.reports.length, level: G.law.level, near: G.ents.filter(e => e.kind === 'npc' && e !== w && e !== law && dist(e.x, e.y, G.player.x, G.player.y) < 400).map(e => e.role) }));
      t.ok(r0.reports > 0 && r0.level === 0, 'suç anında önce tanık raporu olmalı, aranma sonra', r0);
      await p.waitForFunction(() => G.law.level > 0, null, { timeout: 40000 });
      t.ok(await p.evaluate(() => G.law.bounty > 0), 'başa ödül yazılmalı');
    });
    await t.step('tehdit edilen tanık susar', async () => {
      await setup();
      const r = await p.evaluate(() => { window.w = mk(30, 0, 'town'); mk(800, 0, 'law').state = 'static'; G.crime('assault', G.player.x + 30, G.player.y, w); const rr = Math.random; Math.random = () => 0.01; G.intimidate(w); Math.random = rr; return { open: G.reports.filter(x => !x.done).length, sil: !!w.silenced }; });
      t.eq(r.open, 0, 'açık rapor kalmamalı'); t.ok(r.sil, 'tanık susturulmalı');
    });
    await t.step('rüşvet: başarılıysa susar, başarısızsa ikinci şans yok', async () => {
      await setup();
      const ok = await p.evaluate(() => { window.w = mk(30, 0, 'town'); mk(900, 0, 'law').state = 'static'; G.crime('robbery', G.player.x, G.player.y, null); const rr = Math.random; Math.random = () => 0.01; G.bribeWitness(w); Math.random = rr; return { open: G.reports.filter(x => !x.done).length, money: G.player.money }; });
      t.eq(ok.open, 0, 'rüşvet sonrası açık rapor'); t.ok(ok.money < 100, 'rüşvet para tutmalı', ok.money);
      await setup();
      const bad = await p.evaluate(() => { window.w = mk(30, 0, 'town'); mk(900, 0, 'law').state = 'static'; G.crime('robbery', G.player.x, G.player.y, null); const rr = Math.random; Math.random = () => 0.99; G.bribeWitness(w); Math.random = rr; return { open: G.reports.filter(x => !x.done).length, tried: !!w.bribeTried, again: G.npcActions(w).some(a => /Rüşvet/.test(a.n)) }; });
      t.ok(bad.open > 0, 'başarısız rüşvette rapor sürmeli'); t.ok(bad.tried && !bad.again, 'ikinci rüşvet seçeneği olmamalı', bad);
    });
    await t.step('maskeli suç maskeli yabancıya yazılır; görülmeden çıkarınca iz kaybolur', async () => {
      await setup();
      // kanun adamı suçu kendisi görür: rapor anında işler (tanığın koşusu ilk adımda sınandı)
      await p.evaluate(() => { G.player.addItem('mask_bandana', 1, true); if (!G.player.masked) G.toggleMask(); window.law = mk(60, 0, 'law'); law.state = 'static'; G.crime('robbery', G.player.x, G.player.y, null); });
      await p.waitForFunction(() => G.law.level > 0, null, { timeout: 10000 });
      const r = await p.evaluate(() => ({ masked: G.law.masked, mb: G.law.maskBounty, b: G.law.bounty }));
      t.ok(r.masked && r.mb > 0 && r.b === 0, 'ödül maskeli yabancıya yazılmalı', r);
      await p.evaluate(() => { for (const e of G.ents) if (e.kind === 'npc') { e.x = G.player.x + 700; e.y = G.player.y; e.hostile = false; } if (G.player.masked) G.toggleMask(); });
      await t.sleep(300);
      const r2 = await p.evaluate(() => ({ lvl: G.law.level, b: G.law.bounty, suspect: G.suspect() }));
      t.eq(r2.b, 0, 'kimliğin açığa çıkmamalı'); t.ok(!r2.suspect, 'şüpheli olmamalı', r2);
    });
    await t.step('maskeliyken dükkân hizmet vermez', async () => {
      await setup();
      const items = await p.evaluate(() => { G.player.addItem('mask_bandana', 1, true); if (!G.player.masked) G.toggleMask(); UI.openBuilding(G.world.buildings.find(b => b.type === 'general')); return TH.menuLabels(); });
      t.ok(items.some(x => /Maskeyi Çıkar/.test(x)) && !items.some(x => /Alışveriş/.test(x)), 'yalnız maskeyi çıkar seçeneği', items);
      await p.evaluate(() => { TH.clickItem(/Maskeyi Çıkar/); });
      t.ok(await p.evaluate(() => !G.player.masked && TH.menuLabels().some(x => /Alışveriş/.test(x))), 'maske çıkınca alışveriş açılmalı');
      await p.evaluate(() => UI.closeAll());
    });
    await t.step('kanun adamına teslim olup cezayı ödeme', async () => {
      await setup();
      await p.evaluate(() => { Object.assign(G.law, { level: 1, bounty: 30, lastX: G.player.x, lastY: G.player.y, spawnT: 99 }); window.cop = mk(150, 0, 'law', { hostile: true, weapon: 'cattleman' }); });
      await t.sleep(2500);
      const hp = await p.evaluate(() => G.player.hp / G.player.maxHp);
      t.ok(hp > 0.95, 'düşük ödülde kanun adamı hemen ateş etmemeli', hp);
      await p.evaluate(() => G.surrender(cop)); await t.sleep(300);
      t.ok(await p.evaluate(() => TH.clickItem(/Cezayı/)), 'ceza ödeme seçeneği olmalı'); await t.sleep(400);
      const r = await p.evaluate(() => ({ lvl: G.law.level, b: G.law.bounty, money: G.player.money }));
      t.eq(r.lvl, 0, 'aranma bitmeli'); t.eq(r.b, 0, 'ödül silinmeli'); t.near(r.money, 70, 0.01, 'ceza düşülmeli');
    });
    await t.step('hapis: günler geçer, borç silinir', async () => {
      await setup();
      await p.evaluate(() => { Object.assign(G.law, { level: 1, bounty: 120, lastX: G.player.x, lastY: G.player.y, spawnT: 99 }); window.cop = mk(150, 0, 'law', { hostile: true, weapon: 'cattleman' }); window.d0 = G.day; G.surrender(cop); });
      await t.sleep(300);
      t.ok(await p.evaluate(() => TH.clickItem(/Hapse/)), 'hapse girme seçeneği olmalı');
      await t.sleep(2500);
      const r = await p.evaluate(() => ({ days: G.day - d0, lvl: G.law.level, b: G.law.bounty }));
      t.ok(r.days >= 1, 'en az bir gün geçmeli', r); t.eq(r.b, 0, 'ödül silinmeli'); t.eq(r.lvl, 0, 'aranma bitmeli');
    });
    for (const role of ['law', 'town']) await t.step(`dörtnala ${role === 'law' ? 'kanun adamına' : 'sivile'} çarpmak: iki kez uyarı, üçüncüsü saldırı`, async () => {
      await setup();
      const r = await p.evaluate(async (role) => {
        TH.clearNpcs();
        const P = G.player;
        let h = G.horse; if (!h || h.dead) { h = new Horse(P.x, P.y, 'mustang', { owner: 'player' }); G.addEnt(h); G.setHorse(h); }
        h.x = P.x; h.y = P.y; P.mount(h, true); P.mountAnim = null;
        const cop = mk(60, 0, role); cop.state = 'static';
        const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const out = [];
        for (let k = 0; k < 3; k++) {
          G.playtime += 3;
          h.ang = 0; h.spd = 200; cop.x = h.x + 12; cop.y = h.y; P.x = h.x; P.y = h.y;
          await frame(); await frame(); await frame();
          out.push({ hp: cop.hp, max: cop.maxHp, lvl: G.law.level, bounty: G.law.bounty, assaulted: !!cop.assaulted, hostile: !!cop.hostile, bumps: cop.bumps });
        }
        P.dismount(); P.mountAnim = null;
        return out;
      }, role);
      for (const k of [0, 1]) { t.eq(r[k].bumps, k + 1, (k + 1) + '. çarpma sayıldı', r); t.ok(!r[k].assaulted && !r[k].hostile && r[k].hp === r[k].max, (k + 1) + '. çarpma suç değil, hasar yok', r[k]); }
      t.ok(r[2].assaulted && r[2].hp < r[2].max, 'üçüncü çarpma saldırı sayılır', r[2]);
    });
  },
};
