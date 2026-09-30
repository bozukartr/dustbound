'use strict';
/* Yeni eşyalar: ilaçlar (kinin, laudanum, kas merhemi, koklatma tuzu, sarsaparilla), maymuncuk, dürbün */
module.exports = {
  name: 'İlaçlar, maymuncuk ve dürbün',
  async run(t) {
    const p = await t.newGame();
    const NEW = ['quinine', 'laudanum', 'liniment', 'smelling_salts', 'sarsaparilla', 'binoculars', 'lockpick'];
    await t.step('yeni eşyalar tanımlı, ikonlu ve dükkânlarda satılıyor', async () => {
      const r = await p.evaluate((NEW) => NEW.map(id => {
        const it = ITEMS[id]; if (!it) return id + ': yok';
        const svg = Icons.item(id); if (!/<svg/.test(svg) || /undefined|NaN/.test(svg)) return id + ': ikon';
        if (!Object.values(SHOPS).some(s => (s.sell || []).includes(id))) return id + ': satan yok';
        return '';
      }).filter(Boolean), NEW);
      t.eq(r, [], 'eksik yok');
    });
    await t.step('ilaçlar: kinin korur, laudanum hasarı azaltır, tuz ayıltır, sarsaparilla serinletir', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        G.godMode = false; UI.closeAll();
        for (const id of ['quinine', 'laudanum', 'smelling_salts', 'sarsaparilla']) P.addItem(id, 1, true);
        // kinin
        P.sick = 10; G.consume('quinine');
        out.cured = P.sick === 0; out.immune = P.immuneT;
        out.blocked = !G.sicken(6) && P.sick === 0;
        G.survivalUpdate(24 * 60 + 5, false);
        out.after = G.sicken(6) && P.sick === 6; P.sick = 0;
        // laudanum
        P.hp = 100; P.drunk = 0; P.energy = 80; G.consume('laudanum');
        P.hurt(20, 'test', true); out.painHp = P.hp; out.drunk = P.drunk; out.energy = P.energy;
        P.painT = 0; P.hp = 100; P.hurt(20, 'test', true); out.plainHp = P.hp; P.hp = 100;
        // koklatma tuzu
        P.drunk = 70; P.energy = 40; G.consume('smelling_salts'); out.sober = P.drunk; out.awake = P.energy;
        // sarsaparilla: sıcakta hissedilen sıcaklık düşer
        const amb = G.ambientTemp; G.ambientTemp = () => 40;
        P.coolT = 0; G.survivalUpdate(40, false); const hot = G.feltTemp;
        G.consume('sarsaparilla'); G.survivalUpdate(40, false); out.cool = hot - G.feltTemp; out.coolT = P.coolT;
        G.ambientTemp = amb;
        G.godMode = true;
        return out;
      });
      t.ok(r.cured, 'kinin hastalığı iyileştirir'); t.eq(r.immune, 1440, 'bir gün koruma'); t.ok(r.blocked, 'korunurken hastalanmaz'); t.ok(r.after, 'süre bitince yine hastalanabilir');
      t.near(r.painHp, 88, 0.01, 'laudanum ile 20 hasar 12 olur'); t.near(r.plainHp, 80, 0.01, 'laudanumsuz tam hasar');
      t.eq(r.drunk, 15, 'laudanum başı döndürür'); t.eq(r.energy, 65, 'laudanum uykuyu getirir');
      t.eq(r.sober, 0, 'tuz sarhoşluğu giderir'); t.eq(r.awake, 70, 'tuz uykuyu açar');
      t.near(r.cool, 7, 0.01, 'sarsaparilla 7° serinletir'); t.ok(r.coolT > 0, 'etki sürüyor');
      await t.sleep(300);
      t.ok(await p.evaluate(() => document.getElementById('status-icons').innerHTML.includes(Tr('Serinlemiş'))), 'HUD simgesi');
    });
    await t.step('kas merhemi: koşarken dayanıklılık çok daha yavaş tükenir (gerçek girdi)', async () => {
      await p.evaluate(() => { const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs(); G.player.limberT = 0; G.player.energy = 90; });
      const run = async () => {
        await p.evaluate(() => { G.player.sta = G.player.maxSta; });
        const s0 = await p.evaluate(() => G.player.sta);
        await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await t.sleep(1200); await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
        return s0 - await p.evaluate(() => G.player.sta);
      };
      const plain = await run();
      await p.evaluate(() => { G.player.addItem('liniment', 1, true); G.consume('liniment'); });
      const limber = await run();
      t.ok(plain > 8, 'koşunca dayanıklılık düşmeli', plain);
      t.ok(limber < plain * 0.6, 'merhemle belirgin biçimde daha az düşmeli', { plain, limber });
    });
    await t.step('süreli etkiler kayıtla korunur', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player; P.immuneT = 500; P.painT = 90; P.limberT = 60; P.coolT = 30;
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const Q = G.player; return [Q.immuneT, Q.painT, Q.limberT, Q.coolT].map(Math.round);
      });
      t.eq(r, [500, 90, 60, 30], 'süreler');
    });
    await t.step('maymuncuk: kilitli evin kapısında seçenek çıkar, pimler klavyeyle itilir, kapı açılır', async () => {
      await t.helpers(p);
      const r = await p.evaluate(() => {
        const P = G.player; G.godMode = true; UI.closeAll();
        const b = G.world.buildings.find(x => x.def.lock && x.enter && !G.doorOpen(x));
        if (!b) return { err: 'kilitli ev yok' };
        window.LB = b;
        const noPick = (() => { while (P.has('lockpick')) P.removeItem('lockpick', 1); TH.goto(b.door.x, b.door.y + 10); TH.clearNpcs(); return TH.actions(); })();
        P.addItem('lockpick', 2, true);
        const acts = TH.actions();
        TH.act(/Maymuncuk/);
        const m = UI.top(); const st = m && m.lock;
        if (st) st.w = 2;   // bütün çubuk yeşil: her basış tutar
        return { noPick, acts, open: !!st, pins: st && st.pins };
      });
      t.ok(!r.err, r.err);
      t.ok(!r.noPick.some(a => /Maymuncuk/.test(a)), 'maymuncuk yoksa seçenek yok', r.noPick);
      t.ok(r.acts.some(a => /Maymuncuk/.test(a)), 'maymuncukla açma seçeneği', r.acts);
      t.ok(r.open, 'mini oyun açılmalı'); t.eq(r.pins, 3, 'evde 3 pim');
      await t.sleep(200);
      for (let k = 0; k < 3; k++) { await p.keyboard.press('Enter'); await t.sleep(120); }
      await t.sleep(700);
      const e = await p.evaluate(() => ({ open: G.doorOpen(LB), modal: UI.isModal(), picks: G.player.count('lockpick'), stat: G.stats.locksPicked }));
      t.ok(e.open, 'kapı açılmalı'); t.ok(!e.modal, 'mini oyun kapanmalı'); t.eq(e.picks, 2, 'başarıda maymuncuk harcanmaz'); t.eq(e.stat, 1, 'istatistik');
    });
    await t.step('maymuncuk: ıskalayınca kırılabilir; son maymuncuk kırılınca oyun biter', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; UI.closeAll(); LB.picked = -1;
        while (P.count('lockpick') > 1) P.removeItem('lockpick', 1);
        UI.openLockpick(LB); const m = UI.top(); m.lock.w = 0; m.lock.zone = 2;
        const rr = Math.random; Math.random = () => 0; m.tryPin(); Math.random = rr;
        return { picks: P.count('lockpick'), done: m.lock.done, open: G.doorOpen(LB) };
      });
      t.eq(r.picks, 0, 'maymuncuk kırılmalı'); t.ok(r.done, 'oyun bitmeli'); t.ok(!r.open, 'kapı kapalı kalmalı');
      await t.sleep(1100);
      t.ok(await p.evaluate(() => !UI.isModal()), 'pencere kapanmalı');
    });
    await t.step('maymuncuk: gece kapalı dükkânda da kullanılır (4 pim)', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; P.addItem('lockpick', 1, true);
        G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 2 * 60;
        const b = G.world.buildings.find(x => x.type === 'general');
        TH.goto(b.door.x, b.door.y + 10); TH.clearNpcs();
        const acts = TH.actions(); TH.act(/Maymuncuk/);
        const pins = UI.top() && UI.top().lock && UI.top().lock.pins; UI.closeAll();
        return { acts, pins };
      });
      t.ok(r.acts.some(a => /Kapalı/.test(a)) && r.acts.some(a => /Maymuncuk/.test(a)), 'kapalı dükkânda seçenek', r.acts);
      t.eq(r.pins, 4, 'dükkânda 4 pim');
    });
    await t.step('dürbün: görüş uzağa kayar, hayvan etiketlenir, uzaktaki yer haritada işaretlenir', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, W = G.world; UI.closeAll();
        G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 11 * 60;
        const poi = W.pois.find(q => q.kind === 'landmark' && !G.discovered.has(q.id) && !G.rumored.has(q.id));
        if (!poi) return { err: 'keşfedilmemiş yer yok' };
        window.PO = poi;
        TH.goto(poi.x - 300, poi.y); TH.clearNpcs();
        const a = new Animal(P.x - 330, P.y + 20, 'deer'); a.state = 'idle'; G.addEnt(a); window.DE = a;
        P.addItem('binoculars', 1, true); G.consume('binoculars');
        return { on: !!G.binoc };
      });
      t.ok(!r.err, r.err); t.ok(r.on, 'dürbün açılmalı');
      // önce klavyeyle sola (geyiğe) bak
      const x0 = await p.evaluate(() => G.player.x);
      await p.keyboard.down('KeyA'); await t.sleep(1500); await p.keyboard.up('KeyA'); await t.sleep(600);
      const l = await p.evaluate(() => ({ bx: G.binoc.x, cam: G.cam.x - G.player.x, px: G.player.x, labels: [...document.querySelectorAll('#binoc .bn-l')].map(n => n.textContent) }));
      t.near(l.px, x0, 0.01, 'dürbünle bakarken oyuncu yürümez');
      t.ok(l.bx < -300 && l.cam < -250, 'görüş sola kaymalı', l);
      t.ok(l.labels.some(s => /Geyik/.test(s)), 'geyik etiketlenmeli', l.labels);
      // sonra uzaktaki yere
      await p.evaluate(() => { G.binoc.x = PO.x - G.player.x; G.binoc.y = PO.y - G.player.y; G.binoc.mouse = false; });
      await t.sleep(900);
      const q = await p.evaluate(() => ({ rumored: G.rumored.has(PO.id), discovered: G.discovered.has(PO.id), feed: TH.feeds.some(f => /Uzakta/.test(f)) }));
      t.ok(q.rumored && !q.discovered, 'yer haritada işaretlenir ama keşfedilmiş sayılmaz', q); t.ok(q.feed, 'bildirim');
    });
    await t.step('dürbün: Esc indirir (duraklatma açılmaz), hasar alınca iner, at sırtında kullanılamaz', async () => {
      await p.keyboard.press('Escape'); await t.sleep(300);
      const a = await p.evaluate(() => ({ off: !G.binoc, modal: UI.isModal(), hidden: document.getElementById('binoc').classList.contains('hidden') }));
      t.ok(a.off && a.hidden, 'dürbün inmeli'); t.ok(!a.modal, 'duraklatma menüsü açılmamalı');
      const b = await p.evaluate(async () => {
        const P = G.player; G.consume('binoculars'); await new Promise(r => setTimeout(r, 400));
        G.godMode = false; P.hp = 100; P.hurt(5, 'test', true); G.godMode = true;
        await new Promise(r => setTimeout(r, 100));
        const hurtOff = !G.binoc;
        const h = G.horse; h.x = P.x + 10; h.y = P.y; h.dead = false; P.riding = h;
        G.consume('binoculars'); const ridingOn = !!G.binoc; P.riding = null;
        return { hurtOff, ridingOn };
      });
      t.ok(b.hurtOff, 'hasar alınca iner'); t.ok(!b.ridingOn, 'at sırtında açılmaz');
    });
  },
};
