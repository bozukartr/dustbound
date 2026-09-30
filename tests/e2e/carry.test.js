'use strict';
/* Kement, bağlama, omuzda ve eyerde taşıma, teslim, satış, kanıt */
module.exports = {
  name: 'Kement, taşıma ve teslim',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      G.godMode = true;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      if (G.horse) { G.horse.x = s[0] + 200; G.horse.y = s[1]; }
      G.player.giveWeapon('lasso', true); G.player.weapon = 'lasso';
    });
    await t.sleep(300);
    await t.step('fareyle kement atılır, hedef yakalanır ve sürüklenir', async () => {
      const pos = await p.evaluate(() => {
        const P = G.player, n = new NPC(P.x + 60, P.y + 10, 'bandit', { hostile: true, weapon: 'cattleman' }); n.aggro = false; G.addEnt(n); window.TG = n;
        const q = G.toScreen(n.x, n.y); return { sx: q.x, sy: q.y };
      });
      await t.sleep(200);
      const pos2 = await p.evaluate(() => { const q = G.toScreen(TG.x, TG.y); return { sx: q.x, sy: q.y }; });
      await p.mouse.move(pos2.sx, pos2.sy); await t.sleep(120);
      await p.mouse.down(); await t.sleep(80); await p.mouse.up(); await t.sleep(800);
      const r = await p.evaluate(() => ({ state: TG.state, rope: G.player.rope === TG }));
      t.eq(r.state, 'lassoed', 'hedefin durumu'); t.ok(r.rope, 'ip oyuncuda olmalı');
      const d0 = await p.evaluate(() => [TG.x, TG.y]);
      await p.keyboard.down('KeyA'); await t.sleep(1000); await p.keyboard.up('KeyA');
      const moved = await p.evaluate((d0) => dist(TG.x, TG.y, d0[0], d0[1]), d0);
      t.ok(moved > 15, 'kementli kişi sürüklenmeli', moved);
    });
    await t.step('E basılı tutunca bağlanır, omuza alınır; yükle koşulamaz', async () => {
      await p.evaluate(() => { const P = G.player; P.x = TG.x - 10; P.y = TG.y; P.ang = 0; });
      await t.sleep(250);
      await p.keyboard.down('KeyE'); await t.sleep(1300); await p.keyboard.up('KeyE'); await t.sleep(200);
      t.eq(await p.evaluate(() => TG.state), 'tied', 'bağlanmalı');
      await p.keyboard.press('KeyE'); await t.sleep(300);
      t.ok(await p.evaluate(() => G.player.carry === TG && !G.ents.includes(TG)), 'omuzda olmalı');
      const s0 = await p.evaluate(() => [G.player.x, G.player.y]);
      await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await t.sleep(1000); await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
      const sp = await p.evaluate((s0) => dist(G.player.x, G.player.y, s0[0], s0[1]), s0);
      t.ok(sp > 10 && sp < 60, 'yükle yavaş yürümeli (koşamaz)', sp);
    });
    await t.step('eyere yüklenir, şerif ofisinde teslim edilir', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, h = G.horse; h.x = P.x + 18; h.y = P.y; h.dead = false;
        const it = G.findInteraction(); const a = it.actions.find(x => /Yükle/.test(x.n)); a.fn();
        const loaded = h.load.length;
        const off = G.world.buildings.find(b => b.type === 'sheriff');
        P.x = off.door.x; P.y = off.door.y - 12; h.x = off.door.x + 20; h.y = off.door.y + 20;
        const m0 = P.money; const d = UI.svcItems(off, 'bounty').find(i => /Teslim/.test(i.label)); if (d) d.fn();
        return { loaded, gain: P.money - m0, load: h.load.length };
      });
      t.eq(r.loaded, 1, 'eyerde bir yük'); t.ok(r.gain > 0, 'aranan haydut için ödül alınmalı', r.gain); t.eq(r.load, 0, 'eyer boşalmalı');
    });
    await t.step('ödül hedefi: yaralanır, bağlanır, canlı teslimde ödül', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, s = TH.openSpot(P.x + 800, P.y);
        G.activeBounty = { id: 'bt1', name: 'Test Kid', crime: 'x', reward: 120, x: s[0], y: s[1], where: 'x', hench: 0, done: false, spawned: false };
        P.x = s[0] - 100; P.y = s[1]; G.spawnTick();
        const tg = G.ents.find(e => e.bountyId === 'bt1'); if (!tg) return { err: 'hedef yok' };
        let n = 0; while (!tg.dead && tg.state !== 'downed' && n < 30) { tg.hurt(40, 'player', 'gun'); n++; }
        if (tg.dead) { tg.dead = false; tg.hp = 1; tg.down(60); }
        G.hogtie(tg); P.x = tg.x; P.y = tg.y; G.pickUp(tg);
        G.saveGame(true); const saved = JSON.parse(Platform.get(slotKey(G.slot, 'auto'))).activeBounty.status;
        TH.inside(G.world.buildings.find(b => b.type === 'sheriff'));
        const m0 = P.money; G.findInteraction().actions[0].fn();
        return { saved, gain: P.money - m0, left: !!G.activeBounty, carry: !!P.carry };
      });
      t.ok(!r.err, r.err); t.eq(r.saved, 'carried', 'kayıtta hedef taşınıyor görünmeli');
      t.near(r.gain, 120, 0.01, 'canlı teslim tam ödül'); t.ok(!r.left && !r.carry, 'ödül avı kapanmalı, omuz boşalmalı', r);
    });
    await t.step('geyik leşi omuzda kasaba satılır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, s = TH.openSpot(P.x - 900, P.y); TH.goto(s[0], s[1]); P.ang = 0;
        const a = new Animal(s[0] + 12, s[1], 'deer'); a.dead = true; a.state = 'dead'; a.hp = 0; G.addEnt(a);
        const it = G.findInteraction(); it.alt.fn();
        const carried = P.carry === a;
        TH.inside(G.world.buildings.find(b => b.type === 'butcher'));
        const m0 = P.money; G.findInteraction().actions[0].fn();
        return { carried, gain: P.money - m0, carry: !!P.carry };
      });
      t.ok(r.carried, 'leş omuza alınmalı'); t.ok(r.gain > 0, 'leş satılmalı', r.gain); t.ok(!r.carry, 'omuz boşalmalı');
    });
    await t.step('ayı postu: yüzülür, yere bırakılır, yerden alınır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, s = TH.openSpot(P.x + 600, P.y + 400); TH.goto(s[0], s[1]);
        const a = new Animal(s[0] + 12, s[1], 'bear'); a.dead = true; a.state = 'dead'; a.hp = 0; G.addEnt(a);
        const bearAlt = !!G.findInteraction().alt;
        G.skin(a); const kind = P.carry && P.carry.kind;
        G.dropCarry(); const ground = G.ents.some(e => e.kind === 'pelt');
        G.findInteraction().actions[0].fn(); const again = P.carry && P.carry.kind;
        G.dropCarry(true); G.ents = G.ents.filter(e => e.kind !== 'pelt');
        return { bearAlt, kind, ground, again };
      });
      t.ok(!r.bearAlt, 'ayı leşi omuza alınamaz'); t.eq(r.kind, 'pelt', 'büyük post omuzda'); t.ok(r.ground, 'post yerde'); t.eq(r.again, 'pelt', 'yerden alınır');
    });
    await t.step('kanıt: yakında masum ceset bulunursa suç yazılır, uzaktaysan yazılmaz', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, s = TH.openSpot(P.x - 700, P.y - 300); TH.goto(s[0], s[1]); TH.clearNpcs();   // yakındaki bir kanun adamı suçu doğrudan yazmasın
        G.law.level = 0; G.law.bounty = 0; G.reports = [];
        const v = new NPC(s[0] + 40, s[1], 'traveler', {}); G.addEnt(v); v.hurt(999, 'player', 'gun');
        const f = new NPC(s[0] + 90, s[1] + 10, 'traveler', {}); G.addEnt(f); G.evidenceTick();
        const near = G.reports.length;
        G.reports = []; f.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const v2 = new NPC(s[0] + 40, s[1] + 40, 'traveler', {}); G.addEnt(v2); v2.hurt(999, 'player', 'gun');
        P.x = s[0] + 600; const f2 = new NPC(s[0] + 70, s[1] + 60, 'traveler', {}); G.addEnt(f2); G.evidenceTick();
        return { near, far: G.reports.length, found: !v2.evidence };
      });
      t.ok(r.near > 0, 'yakındayken tanık haber vermeli', r); t.eq(r.far, 0, 'uzaktayken suç yazılmamalı'); t.ok(r.found, 'ceset yine de bulunmuş olmalı');
    });
    await t.step('ceset suya atılınca kaybolur', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, w = TH.waterSpot(); if (!w) return { err: 'su yok' };
        const c = new NPC(P.x, P.y, 'bandit', {}); c.dead = true; c.state = 'dead'; P.carry = c;
        let x = w[0], y = w[1]; for (let k = 0; k < 40 && G.world.blocked(x, y, 3); k++) x -= 4;
        TH.goto(x - 8, y); P.carry = c;
        const ok = TH.act(/Suya/);
        return { ok, gone: !P.carry && !G.ents.includes(c) };
      });
      t.ok(!r.err, r.err); t.ok(r.ok, 'Suya At seçeneği olmalı'); t.ok(r.gone, 'ceset kaybolmalı');
    });
    await t.step('omuzdaki post ve eyerdeki ceset kayıtla korunur', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player; G.law.level = 0; G.law.bounty = 0; G.reports = [];
        const d = new NPC(P.x, P.y, 'bandit', {}); d.dead = true; d.state = 'dead';
        G.horse.x = P.x; G.horse.y = P.y; G.horse.load = [d];
        P.carry = new Pelt(0, 0, 'elk_hide', 1.5);
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        return { carry: G.player.carry && G.player.carry.kind, load: G.horse.load.length };
      });
      t.eq(r.carry, 'pelt', 'omuzdaki post'); t.eq(r.load, 1, 'eyerdeki yük');
    });
  },
};
