'use strict';
/* At ve araba üstünde selamlaşma: eyerden yakındakini selamlamak (E'ye dokunmak yine indirir), atlı birini ve
   araba sürücüsünü yayayken selamlamak, sataşana eyerden karşılık vermek; dörtnala geçene selam verilmez,
   atla geçip gidene küsülmez */
module.exports = {
  name: 'At ve araba üstünde selamlaşma',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true;
      G.eventT = 1e9; G.travelT = 1e9;   // yol olayları testi bölmesin
      window.MT = {
        // açık bir yerde, ata binmiş oyuncunun önüne (doğuya) bir kişi koy
        rider() {
          const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
          for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
          const P = G.player, h = G.horse; h.dead = false; h.x = P.x; h.y = P.y; h.ang = 0; P.mount(h); h.spd = 0; P.ang = 0;
          return s;
        },
        npc(dx, dy, role = 'traveler', opts = {}) { const P = G.player, n = new NPC(P.x + dx, P.y + dy, role, Object.assign({ sex: 'm' }, opts)); n.state = 'idle'; n.t = 99; G.addEnt(n); return n; },
      };
    });

    await t.step('at üstünde yakındakini selamlarsın: E\'ye dokunmak yine iner, selam seçeneklerde ve istemde görünür', async () => {
      const r = await p.evaluate(() => {
        MT.rider();
        const P = G.player, n = MT.npc(34, 0);
        const it = G.findInteraction(), names = it.actions.map(a => a.n);
        const g = it.actions.find(a => a.n === 'Selamla: ' + n.name);
        const day = n.greetDay;
        if (g) g.fn();
        UI.curInteract = it; UI.interactUpdate(0.016);
        const prompt = document.getElementById('prompts').textContent;
        // uzaktaki biri (48 pikselden öte) seçeneklere girmez
        n.x = P.x + 70;
        const far = G.findInteraction().actions.map(a => a.n);
        return { a0: names[0], names, greeted: n.greetDay === G.day && day !== G.day, riding: !!P.riding, peek: it.peek, prompt, far };
      });
      t.eq(r.a0, 'İn', 'E\'ye dokunmak yine indirir');
      t.ok(r.names.some(n => /^Selamla: /.test(n)), 'seçeneklerde Selamla: ad', r.names);
      t.ok(r.greeted && r.riding, 'eyerden selam verildi, oyuncu atta kaldı', r);
      t.ok(/Seçenekler.*→ Selamla: /.test(r.prompt), 'istem seçeneklerin yanında selamı gösterir', r.prompt);
      t.eq(r.far, ['İn'], 'uzaktaki kişi seçeneklere girmez');
    });

    await t.step('sakin ata binmiş oyuncuyu selamlar; eyerden karşılık verilince küsmez', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, tw = TH.town('harlow');
        TH.goto(tw.spawn.x, tw.spawn.y); for (let f = 0; f < 60; f++) G.update(1 / 30);
        const h = G.horse; h.dead = false; h.x = P.x; h.y = P.y; P.mount(h); h.spd = 0;
        const e = G.ents.find(x => x.res && !x.dead && !x.remove && !x.child && x.state !== 'sit' && !x.talk && !G.world.indoorPx(x.x, x.y));
        e.x = P.x + 30; e.y = P.y; e.nav = null; e.goal = null; e.res.mood = 'jolly'; e.hiWait = 0; e.anim = null;
        for (const o of G.ents) if (o !== e && o.kind === 'npc' && dist(o.x, o.y, P.x, P.y) < 90) o.y += 240;   // seçilecek kişi o olsun
        P.ang = 0; P.masked && G.toggleMask();
        G.mem(e.res).hiDay = -1; G.hiT = 0;
        const op0 = G.opOf(e.res);
        const rr = Math.random; Math.random = () => 0.01;
        let hello; try { hello = G.helloTick(e, e.res, MOODS.jolly, 30 * 30); } finally { Math.random = rr; }
        const it = G.findInteraction(), g = it.actions.find(a => a.n === 'Selamla: ' + e.name);
        if (g) g.fn();
        for (let f = 0; f < 30 * 8; f++) { G.update(1 / 30); if (f % 30 === 0) G.mindTick(e, tw); }
        return { hello, menu: it.actions.map(a => a.n), op0, op1: G.opOf(e.res), snub: G.mem(e.res).snubDay === G.day, wait: !!e.hiWait };
      });
      t.ok(r.hello, 'atlıya da selam verir', r);
      t.ok(r.menu.some(n => /^Selamla: /.test(n)), 'eyerden karşılık seçeneği', r.menu);
      t.ok(!r.wait && !r.snub && r.op1 > r.op0, 'selamı alınınca sevinir, küsmez', r);
    });

    await t.step('dörtnala geçene selam verilmez; atla uzaklaşana küsülmez, at üstünde durup bakana küsülür', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, tw = TH.town('harlow'), h = P.riding;
        const e = G.ents.find(x => x.res && !x.dead && !x.remove && !x.child && x.state !== 'sit' && !x.talk && !x.hiWait && G.mem(x.res).snubDay === undefined && !G.world.indoorPx(x.x, x.y));
        e.x = P.x + 30; e.y = P.y; e.nav = null; e.goal = null; e.res.mood = 'grumpy'; e.anim = null;
        const m = G.mem(e.res), rr = Math.random;
        const hello = () => { m.hiDay = -1; G.hiT = 0; e.hiWait = 0; e.talk = null; Math.random = () => 0.01; try { return G.helloTick(e, e.res, MOODS.grumpy, 30 * 30); } finally { Math.random = rr; } };
        h.spd = 150; const gallop = hello();
        // eşkinden yavaşta selam verir; oyuncu atla uzaklaşınca süre dolar ama küsmez
        h.spd = 40; const trot = hello();
        const op0 = G.opOf(e.res);
        e.hiWait = G.t - 8; G.helloTick(e, e.res, MOODS.grumpy, 400 * 400);
        const away = { snub: m.snubDay === G.day, op: G.opOf(e.res), wait: !!e.hiWait };
        // at üstünde yakında durup karşılık vermeyene küser
        hello(); e.hiWait = G.t - 8; G.helloTick(e, e.res, MOODS.grumpy, 30 * 30);
        return { gallop, trot, op0, away, near: { snub: m.snubDay === G.day, op: G.opOf(e.res) } };
      });
      t.ok(!r.gallop, 'dörtnala geçene selam verilmez', r);
      t.ok(r.trot, 'yavaş giden atlıya selam verilir', r);
      t.ok(!r.away.snub && r.away.op === r.op0 && !r.away.wait, 'atla uzaklaşana küsülmez', r);
      t.ok(r.near.snub && r.near.op < r.op0, 'yakında durup karşılık vermeyene küsülür', r);
    });

    await t.step('sataşana eyerden karşılık verilir', async () => {
      const r = await p.evaluate(() => {
        MT.rider();
        const n = MT.npc(30, 0, 'town');
        n.teased = { rt: G.t, k: 'horse' };
        const names = G.findInteraction().actions.map(a => a.n);
        const ok = TH.act(/^Karşılık Ver: /);
        return { names, ok, teased: !!n.teased };
      });
      t.ok(r.names.some(n => /^Karşılık Ver: /.test(n)), 'seçeneklerde Karşılık Ver', r.names);
      t.ok(r.ok && !r.teased, 'karşılık verildi', r);
    });

    await t.step('yayayken atlıyı selamlarsın: E\'ye dokununca selam, eyerden çekmek seçeneklerde; haydutta önce eyerden çekmek', async () => {
      const r = await p.evaluate(() => {
        MT.rider(); const P = G.player; P.dismount(); P.ang = 0;
        G.horse.x = P.x - 200; G.horse.y = P.y;
        const n = MT.npc(36, 0, 'traveler', { mounted: true });
        const it = G.findInteraction(), names = it.actions.map(a => a.n);
        it.actions[0].fn();
        const greeted = n.greetDay === G.day, mounted = !!n.mounted;
        TH.clearNpcs();
        const b = MT.npc(24, 0, 'traveler', { mounted: true }); b.bountyId = 'x';
        const bn = G.findInteraction().actions.map(a => a.n);
        TH.clearNpcs();
        return { names, greeted, mounted, crime: !!n.assaulted, bn };
      });
      t.eq(r.names[0], 'Selamla', 'E\'ye dokunmak selam verir', r.names);
      t.ok(r.names.includes('Attan İndir'), 'eyerden çekmek seçeneklerde', r.names);
      t.ok(r.greeted && r.mounted && !r.crime, 'selam verildi, atlı atında, suç yok', r);
      t.eq(r.bn[0], 'Attan İndir', 'aranan atlıda önce eyerden çekmek', r.bn);
    });

    await t.step('ilk eylemi basılı tutmalı hedefte kısa basınca seçenekler açılır (aranan atlıyı selamlamak)', async () => {
      await p.evaluate(() => {
        MT.rider(); const P = G.player; P.dismount(); P.ang = 0;
        G.horse.x = P.x - 200; G.horse.y = P.y;
        const b = MT.npc(24, 0, 'traveler', { mounted: true }); b.bountyId = 'x'; b.update = function () {};
        window.BT = b;
      });
      await t.sleep(250);
      const prompt = await p.evaluate(() => document.getElementById('prompts').textContent);
      t.ok(/Attan İndir \(basılı tut\)/.test(prompt) && /Seçenekler \(kısa bas\)/.test(prompt), 'istem: basılı tut ve kısa bas', prompt);
      await p.keyboard.press('KeyE'); await t.sleep(300);
      const labels = await p.evaluate(() => TH.menuLabels());
      t.ok(labels.includes('Selamla') && labels.includes('Attan İndir'), 'kısa basınca seçenekler açılır', labels);
      await p.evaluate(() => TH.clickItem(/Selamla/)); await t.sleep(100);
      const r = await p.evaluate(() => { const o = { greeted: BT.greetDay === G.day, mounted: !!BT.mounted, crime: !!BT.assaulted, modal: UI.isModal() }; TH.clearNpcs(); return o; });
      t.ok(r.greeted && r.mounted && !r.crime && !r.modal, 'seçenekten selam verildi, atlı atında', r);
    });

    await t.step('tutuklamaya gelen kanun adamına at üstünden, uzaktan teslim olunur', async () => {
      await p.evaluate(() => {
        MT.rider(); const P = G.player; P.money = 50;
        Object.assign(G.law, { level: 1, bounty: 5, maskBounty: 0, masked: false, resist: false, lastX: P.x, lastY: P.y, spawnT: 99 });
        const c = MT.npc(100, 0, 'law', { hostile: true }); c.update = function () {};   // yerinde dursun: uzaktan teslim olunabildiği görülsün
        window.COP = c;
      });
      await t.sleep(250);
      const r0 = await p.evaluate(() => { const it = G.findInteraction(); return { far: !!(it && it.far), a0: it && it.actions[0].n, d: dist(COP.x, COP.y, G.player.x, G.player.y) }; });
      t.ok(r0.far && r0.a0 === 'Teslim Ol' && r0.d > 48, 'uzaktaki kanun adamına teslim seçeneği', r0);
      await p.keyboard.down('KeyE'); await t.sleep(1000); await p.keyboard.up('KeyE'); await t.sleep(300);
      const labels = await p.evaluate(() => TH.menuLabels());
      t.ok(labels.some(x => /Cezayı Öde/.test(x)), 'basılı tutunca teslim olunur (tutuklama menüsü)', labels);
      await p.evaluate(() => TH.clickItem(/Cezayı/)); await t.sleep(300);
      const r = await p.evaluate(() => { const o = { lvl: G.law.level, bounty: G.law.bounty, riding: !!G.player.riding }; TH.clearNpcs(); return o; });
      t.ok(r.lvl === 0 && r.bounty === 0 && !r.riding, 'ceza ödendi, attan inildi', r);
    });

    await t.step('araba sürücüsü selamlanır: yayayken (araba giderken de) ve at üstünden', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, road = W.roads.filter(rd => !rd.spur && rd.pts.length > 40)[0];
        const pt = road.pts[20];
        TH.goto(pt[0], pt[1]); TH.clearNpcs();
        for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const P = G.player, w = new Wagon(road, 20, 1, false); G.addEnt(w);
        w.spd = 0; P.x = w.bx + Math.cos(w.bang + Math.PI / 2) * 16; P.y = w.by + Math.sin(w.bang + Math.PI / 2) * 16;
        P.ang = Math.atan2(w.by - P.y, w.bx - P.x);
        const stopped = G.findInteraction().actions.map(a => a.n);
        w.spd = 50;
        const moving = G.findInteraction().actions.map(a => a.n);
        const h0 = G.honor;
        TH.act(/^Selamla$/);
        // at üstünden: sürücü seçeneklerde
        const h = G.horse; h.dead = false; h.x = P.x; h.y = P.y; P.mount(h); h.spd = 0; P.ang = Math.atan2(w.by - P.y, w.bx - P.x);
        const ridden = G.findInteraction().actions.map(a => a.n);
        return { stopped, moving, first: P.greeted.has(w.id), dh: G.honor - h0, ridden, driver: w.driver.name };
      });
      t.eq(r.stopped[0], 'Selamla', 'durmuş arabada E\'ye dokununca selam', r.stopped);
      t.ok(r.stopped.includes('Sürücüyü İndir'), 'sürücüyü indirmek seçeneklerde', r.stopped);
      t.eq(r.moving, ['Selamla'], 'giden arabanın sürücüsü de selamlanır (zorla indirilemez)');
      t.ok(r.first && r.dh > 0, 'ilk selam az şeref kazandırır', r);
      t.ok(r.ridden[0] === 'İn' && r.ridden.includes('Selamla: ' + r.driver), 'at üstünden sürücü seçeneklerde', r.ridden);
      await t.sleep(1200);
      const sub = await p.evaluate(() => (document.getElementById('subtitle') || {}).textContent || '');
      t.ok(sub.startsWith(r.driver + ':'), 'sürücü karşılık verir', sub);
    });
  },
};
