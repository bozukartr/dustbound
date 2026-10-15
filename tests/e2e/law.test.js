'use strict';
/* Tanıklar, rüşvet ve tehdit, maske, tutuklama ve teslim olma */
module.exports = {
  name: 'Kanun, tanıklar ve tutuklama',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const setup = () => p.evaluate(() => {
      UI.closeAll(); const P = G.player, tw = TH.town('harlow');
      // tanık doğuya, 420 px ötedeki kanun adamına düz koşar: yolun tamamı açık olmalı (rastgele dünyada aradaki bir kaya
      // ya da ağaç tanığı takar, rapor ancak süre dolunca gider)
      const clear = (x, y) => { for (let d = 0; d <= 440; d += 4) if (G.world.blocked(x + d, y, 6)) return false; return true; };
      for (let k = 0; k < 160; k++) { P.x = tw.cx + 1600 + (k % 80) * 23; P.y = tw.cy + 200 + (k >= 80 ? 120 : 0); if (!G.world.blocked(P.x, P.y, 8) && G.los(P.x, P.y, P.x + 200, P.y) && clear(P.x, P.y)) break; }
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
        // sivil dörtnala gelen atlıdan yana sıçrar; çarpmayı ölçmek için bu kişinin algısı kapalı
        const pv = G.perceive; G.perceive = function (e, dt) { return e === cop ? null : pv.call(this, e, dt); };
        const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
        const out = [];
        for (let k = 0; k < 3; k++) {
          G.playtime += 3;
          h.ang = 0; h.spd = 200; cop.x = h.x + 12; cop.y = h.y; P.x = h.x; P.y = h.y;
          await frame(); await frame(); await frame();
          out.push({ hp: cop.hp, max: cop.maxHp, lvl: G.law.level, bounty: G.law.bounty, assaulted: !!cop.assaulted, hostile: !!cop.hostile, bumps: cop.bumps });
        }
        P.dismount(); P.mountAnim = null; G.perceive = pv;
        return out;
      }, role);
      for (const k of [0, 1]) { t.eq(r[k].bumps, k + 1, (k + 1) + '. çarpma sayıldı', r); t.ok(!r[k].assaulted && !r[k].hostile && r[k].hp === r[k].max, (k + 1) + '. çarpma suç değil, hasar yok', r[k]); }
      t.ok(r[2].assaulted && r[2].hp < r[2].max, 'üçüncü çarpma saldırı sayılır', r[2]);
    });

    /* ---- Şerif ofisi: aranan oyuncu ateş yemeden teslim olup cezasını öder ---- */
    // Harlow şerif ofisinin önüne git, masadaki şerifin gelmesini bekle; kanun adamlarının ateşini say
    const office = (law) => p.evaluate(async (law) => {
      UI.closeAll();
      const P = G.player, b = G.world.buildings.find(x => x.town === 'harlow' && x.type === 'sheriff');
      if (P.riding) P.dismount();
      TH.clearNpcs(); G.reports.length = 0; P.money = 100; P.hp = P.maxHp; P.mask = null; P.aiming = false;
      G.truce = null; G.truceUsed = 0;
      Object.assign(G.law, { level: 0, bounty: 0, maskBounty: 0, masked: false, desc: null, unseen: 0, resist: false, arrestT: 0, fleeT: 0, warned: false, recog: 0, aimT: 0 });
      TH.goto(b.door.x, b.door.y + 30);
      const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      for (let k = 0; k < 150 && !(b.staffNpc && !b.staffNpc.dead && !b.staffNpc.remove); k++) await frame();
      // aranma durumu şerif yerine geçtikten sonra yazılır (beklerken kimse tanımasın)
      Object.assign(G.law, law, { lastX: P.x, lastY: P.y, spawnT: 99 });
      window.ofc = b; window.shots = 0;
      if (!window.fr0) { window.fr0 = G.fireRay; G.fireRay = function (...a) { if (a[5] && a[5].kind === 'npc' && a[5].isLaw) window.shots++; return window.fr0.apply(this, a); }; }
      // masanın önünde, etkileşimi şerifin masası olan boş bir karo
      window.deskSpot = () => {
        for (let ly = 1; ly < b.h; ly++) for (let lx = 1; lx < b.w - 1; lx++) {
          const x = (b.x + lx) * TS + 8, y = (b.y + ly) * TS + 8;
          if (G.world.blocked(x, y, 4) || G.world.buildingAtPx(x, y) !== b) continue;
          TH.goto(x, y);
          if (TH.actions()[0] === 'Şerifin Masası') return true;
        }
        return false;
      };
      return !!b.staffNpc;
    }, law);
    await t.step('şerif ofisi: başında ödülle giren tanınmaz, ödülünü masada öder', async () => {
      t.ok(await office({ bounty: 30 }), 'masada şerif olmalı');
      // kıyafeti eşkâle uyan, kasabada çoktandır dolaşan biri: ofisin dışında olsa şerif onu hemen tanırdı
      t.ok(await p.evaluate(() => { G.law.desc = G.outfit(); G.law.recog = 20; return deskSpot(); }), 'masanın önüne gidilmeli');
      await t.sleep(2500);
      const r = await p.evaluate(() => ({ lvl: G.law.level, hostile: !!ofc.staffNpc.hostile, acts: TH.actions() }));
      t.eq(r.lvl, 0, 'ofiste tanınıp aranmamalı'); t.ok(!r.hostile, 'şerif silah çekmemeli');
      t.ok(r.acts.some(a => /Başındaki Ödülü Öde/.test(a)), 'masada ödül ödenebilmeli', r.acts);
      const q = await p.evaluate(() => { TH.act(/Başındaki Ödülü Öde/); return { b: G.law.bounty, money: G.player.money }; });
      t.eq(q.b, 0, 'ödül silinmeli'); t.near(q.money, 70, 0.01, 'ödül paradan düşülmeli');
    });
    await t.step('aranırken ofise giren oyuncuya ateşkes: ateş edilmez, teslim olup cezayı öder', async () => {
      // üç yıldız: normalde kanun gördüğü yerde ateş eder
      t.ok(await office({ level: 3, bounty: 60 }), 'masada şerif olmalı');
      await p.evaluate(() => TH.inside(ofc));
      await t.sleep(4500);
      const r = await p.evaluate(() => ({ truce: !!G.truce, shots, hp: G.player.hp / G.player.maxHp, moved: dist(ofc.staffNpc.x, ofc.staffNpc.y, ofc.staff.x, ofc.staff.y), hostile: !!ofc.staffNpc.hostile,
        hud: !document.querySelector('#hud-wanted .wanted-truce').classList.contains('hidden') && document.querySelector('#hud-wanted .wanted-truce').textContent, acts: TH.actions() }));
      t.ok(r.truce, 'ofiste ateşkes başlamalı'); t.eq(r.shots, 0, 'kanun ateş etmemeli'); t.ok(r.hp > 0.99, 'can azalmamalı', r.hp);
      t.ok(r.hostile && r.moved < 4, 'şerif masasından kalkmadan silah zoruyla tutmalı', r);
      t.ok(/2[4-7]/.test(r.hud), 'aranma afişinde kalan süre yazmalı', r.hud);
      t.ok(r.acts.includes('Teslim Ol'), 'teslim olma seçeneği olmalı', r.acts);
      await p.evaluate(() => TH.act(/Teslim Ol/)); await t.sleep(300);
      t.ok(await p.evaluate(() => TH.clickItem(/Cezayı/)), 'ceza ödeme seçeneği olmalı'); await t.sleep(400);
      const q = await p.evaluate(() => ({ lvl: G.law.level, b: G.law.bounty, money: G.player.money, truce: G.truce, hostile: !!ofc.staffNpc.hostile }));
      t.eq(q.lvl, 0, 'aranma bitmeli'); t.eq(q.b, 0, 'ödül silinmeli'); t.near(q.money, 40, 0.01, 'ceza düşülmeli');
      t.ok(!q.truce && !q.hostile, 'ateşkes kapanmalı, şerif silahını indirmeli', q);
    });
    await t.step('ateşkes: şerifin masasında da teslim olunur', async () => {
      t.ok(await office({ level: 2, bounty: 40 }), 'masada şerif olmalı');
      const r = await p.evaluate(() => {
        deskSpot();
        const W = G.world, b = ofc;
        let i = -1;
        for (let y = b.y; y < b.y + b.h && i < 0; y++) for (let x = b.x; x < b.x + b.w; x++) if (W.obj[y * WW + x] === O.DESK) { i = y * WW + x; break; }
        const acts = G.furnActions(b, O.DESK, i).acts.map(a => a.n);
        G.furnActions(b, O.DESK, i).acts.find(a => /Teslim Ol/.test(a.n)).fn();
        return { acts, menu: TH.menuLabels() };
      });
      t.ok(r.acts.some(a => /Teslim Ol/.test(a)) && !r.acts.some(a => /Başındaki Ödülü/.test(a)), 'aranırken masada teslim olunmalı', r.acts);
      t.ok(r.menu.some(a => /Cezayı Öde/.test(a)) && r.menu.some(a => /Hapse Gir/.test(a)), 'ceza ya da hapis seçilmeli', r.menu);
      await p.evaluate(() => TH.clickItem(/Cezayı/)); await t.sleep(300);
      t.eq(await p.evaluate(() => G.law.level), 0, 'aranma bitmeli');
    });
    await t.step('ateşkes: çıkınca durur, kalan süreden sürer; süre dolunca kanun ateş açar', async () => {
      t.ok(await office({ level: 3, bounty: 60 }), 'masada şerif olmalı');
      await p.evaluate(() => TH.inside(ofc)); await t.sleep(600);
      // ofisten çıkınca ateşkes durur, harcanan süre saklanır
      const a = await p.evaluate(async () => {
        G.truce.t = 12; G.player.x = ofc.door.x; G.player.y = ofc.door.y + 60;
        await new Promise(res => setTimeout(res, 300));
        const out = { truce: !!G.truce, used: G.truceUsed };
        TH.inside(ofc); await new Promise(res => setTimeout(res, 300));
        out.back = G.truce && G.truce.t;
        return out;
      });
      t.ok(!a.truce && a.used >= 12, 'dışarıda ateşkes durmalı', a);
      t.ok(a.back >= 12 && a.back < 13, 'geri girince kalan süreden sürmeli', a);
      await p.evaluate(() => { G.truce.t = TRUCE_SEC - 0.3; window.shots = 0; });
      await p.waitForFunction(() => window.shots > 0, null, { timeout: 6000 });
      const r = await p.evaluate(() => ({ truce: G.truce, resist: G.law.resist, used: G.truceUsed, arrest: G.canArrest() }));
      t.ok(!r.truce && r.resist && !r.arrest, 'süre dolunca ateşkes bitmeli', r);
      await p.evaluate(() => { G.player.x = ofc.door.x; G.player.y = ofc.door.y + 60; });
      await t.sleep(300);
      await p.evaluate(() => TH.inside(ofc)); await t.sleep(300);
      t.ok(await p.evaluate(() => !G.truce), 'aynı aranmada yeni ateşkes verilmemeli');
    });
    await t.step('ateşkes: ofisin içinde işlenen suçla başlayan aranmada yok; dışarı çıkıp girince verilir', async () => {
      t.ok(await office({}), 'masada şerif olmalı');
      await p.evaluate(() => TH.inside(ofc)); await t.sleep(400);
      await p.evaluate(() => { window.shots = 0; const s = ofc.staffNpc; G.crime('assaultLaw', s.x, s.y, s); });
      await p.waitForFunction(() => window.shots > 0, null, { timeout: 6000 });
      const r = await p.evaluate(() => ({ lvl: G.law.level, truce: G.truce }));
      t.ok(r.lvl > 0 && !r.truce, 'ofiste şerife saldırana ateşkes verilmemeli', r);
      await p.evaluate(() => { G.player.x = ofc.door.x; G.player.y = ofc.door.y + 60; });
      await t.sleep(300);
      await p.evaluate(() => { TH.inside(ofc); G.player.hp = G.player.maxHp; });
      await t.sleep(300);
      t.ok(await p.evaluate(() => !!G.truce), 'dışarıdan teslim olmaya gelince ateşkes verilmeli');
    });
    await t.step('ateşkes: ofiste ateş eden oyuncuya kanun ateş açar', async () => {
      t.ok(await office({ level: 1, bounty: 20 }), 'masada şerif olmalı');
      await p.evaluate(() => TH.inside(ofc)); await t.sleep(800);
      t.ok(await p.evaluate(() => !!G.truce && window.shots === 0), 'ateşkes başlamalı');
      await p.evaluate(() => G.onPlayerFire());
      await p.waitForFunction(() => window.shots > 0, null, { timeout: 6000 });
      const r = await p.evaluate(() => ({ truce: G.truce, resist: G.law.resist, spent: G.truceUsed >= TRUCE_SEC }));
      t.ok(!r.truce && r.resist && r.spent, 'ateş edince ateşkes bozulmalı', r);
      await p.evaluate(() => { G.fireRay = window.fr0; window.fr0 = null; Object.assign(G.law, { level: 0, bounty: 0, resist: false }); G.player.hp = G.player.maxHp; });
    });
  },
};
