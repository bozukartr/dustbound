'use strict';
/* Motor çağı: 1908'den sonra yollarda ve şehirlerde arabaların yerini yıllar geçtikçe artan payla tek tip otomobil alır
   (siyah, tenteli, atsız, gövdesi katı). Ahır motor çağında otomobil satar; otomobil kayıtta kalır. Sürüş: W gaz,
   A/D otomobili yalnızca giderken çevirir, S fren ve geri vites; otomobil yorulmaz. Ön tekerlekler direksiyonu izler
   (dururken de kırılır, geri viteste tuşun yönüne bakar). NPC'nin otomobilini almak araç hırsızlığıdır. */
module.exports = {
  name: 'Motor çağı: otomobil',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; G.eventT = 1e9; G.travelT = 1e9;
      window.MT = {
        year(y) { G.clock = (y - START_YEAR) * G.dpy * 1440 + 10 * 60; },
        // açık bir yerde kendi otomobiline bin, doğuya bakarak dur
        drive() {
          const P = G.player; if (P.riding) { P.dismount(); P.mountAnim = null; }
          const s = TH.openSpot(undefined, undefined, 200) || TH.openSpot(undefined, undefined, 150) || TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
          const h = G.myCar; h.x = P.x; h.y = P.y; h.ang = 0; h.spd = 0; h.back = false; h.trail(true);
          P.mount(h, true); P.mountAnim = null; P.ang = 0;
        },
        st() { const h = G.player.riding; return { x: Math.round(h.x), y: Math.round(h.y), ang: +h.ang.toFixed(3), spd: Math.round(h.spd), back: !!h.back, sta: h.sta, max: h.maxSta, motor: h.motor, steer: +(h.steer || 0).toFixed(3) }; },
      };
    });
    const st = () => p.evaluate(() => MT.st());
    const down = async (...ks) => { for (const k of ks) await p.keyboard.down(k); };
    const up = async (...ks) => { for (const k of ks) await p.keyboard.up(k); };
    const hold = async (ks, ms) => { await down(...ks); await t.sleep(ms); await up(...ks); };

    await t.step('motor payı yıla göre artar; araba tek tip, atsız, gövdesi katı otomobile döner', async () => {
      const r = await p.evaluate(() => {
        const road = G.world.roads.filter(r => !r.spur && r.pts.length > 10)[0];
        const ws = [new Wagon(road, 5, 1, true), new Wagon(road, 7, 1, false)].map(w => G.motorize(w)), w = ws[0];
        return {
          share: [1890, 1907, 1915, 1930, 1955].map(y => G.motorShare(y)),
          motor: ws.map(w => w.motor), name: ws.map(w => w.name), hc: ws.map(w => w.hc), body: ws.map(w => w.body),
          rigid: Math.hypot(w.x - Math.cos(w.ang) * CAR_DIM.l - w.bx, w.y - Math.sin(w.ang) * CAR_DIM.l - w.by), bang: Math.abs(angDiff(w.bang, w.ang)),
        };
      });
      t.eq(r.share.slice(0, 2), [0, 0], 'motor çağından önce otomobil yok');
      t.ok(r.share[2] > 0.1 && r.share[2] < r.share[3] && r.share[3] < r.share[4] && r.share[4] <= 0.95, 'pay yıllar geçtikçe artar', r.share);
      t.eq(r.motor, ['car', 'car'], 'posta arabası da yük arabası da aynı otomobile döner');
      t.eq(r.name, ['Otomobil', 'Otomobil'], 'adı Otomobil');
      t.eq(r.hc, [null, null], 'atsız'); t.eq(r.body, ['#16161a', '#16161a'], 'siyah');
      t.ok(r.rigid < 0.01 && r.bang < 1e-6, 'gövde ön noktanın tam arkasında (sürüklenmez)', r);
    });

    await t.step('yol trafiği: 1890\'da hep atlı araba, 1955\'te çoğu otomobil', async () => {
      const r = await p.evaluate(() => {
        const road = G.world.roads.filter(r => !r.spur && r.pts.length > 20).sort((a, b) => b.pts.length - a.pts.length)[0], [x, y] = road.pts[road.pts.length >> 1];
        const run = yr => {
          MT.year(yr); TH.goto(x, y + 30);
          for (const e of G.ents) if (e.kind === 'wagon') e.remove = true;
          G.ents = G.ents.filter(e => !e.remove);
          for (let k = 0; k < 3000; k++) G.trafficTick();
          const ws = G.ents.filter(e => e.kind === 'wagon' && !e.remove);
          return { n: ws.length, motor: ws.filter(w => w.motor).length };
        };
        return { y1890: run(1890), y1955: run(1955) };
      });
      t.ok(r.y1890.n >= 2 && r.y1890.motor === 0, '1890: otomobil yok', r.y1890);
      t.ok(r.y1955.n >= 3 && r.y1955.motor >= 2, '1955: çoğu otomobil', r.y1955);
    });

    await t.step('ahır motor çağında otomobil satar; alınan otomobil kayıtta kalır', async () => {
      const r = await p.evaluate(() => {
        const tw = TH.town('stclement'), stb = tw.buildings.find(b => b.type === 'stable');
        TH.goto(stb.door.x, stb.door.y + 20);
        MT.year(1905); UI.openBuilding(stb); const before = TH.menuLabels(); UI.closeAll();
        MT.year(1915); UI.openBuilding(stb); const after = TH.menuLabels();
        G.player.money = 5000; const m0 = G.player.money, price = CAR_PRICE * G.priceMul(true);
        const clicked = TH.clickItem(/Otomobil Satın Al/); UI.closeAll();
        UI.openBuilding(stb); const owned = TH.menuLabels(); UI.closeAll();
        const c = G.myCar;
        G.saveGame(true);
        return { before, after, clicked, owned, paid: m0 - G.player.money, price, motor: c && c.motor, mine: c && c.mine, name: c && c.name };
      });
      t.ok(!r.before.some(l => /Otomobil/.test(l)), '1905: ahırda otomobil yok', r.before);
      t.ok(r.after.some(l => /Otomobil Satın Al/.test(l)) && r.clicked, '1915: ahırda otomobil satılır', r.after);
      t.near(r.paid, r.price, 0.01, 'fiyatı ödenir');
      t.ok(r.motor === 'car' && r.mine && r.name === 'Otomobilin', 'otomobil oyuncunun', r);
      t.ok(r.owned.some(l => /Otomobilini Buraya Getirt/.test(l)) && !r.owned.some(l => /Otomobil Satın Al/.test(l)), 'ikincisi satılmaz, getirtilebilir', r.owned);
      await p.evaluate(() => { UI.closeAll(); G.state = 'menu'; G.ents = []; return G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 120000 });
      const a = await p.evaluate(() => { UI.closeAll(); const c = G.myCar; return { ok: !!c && G.ents.includes(c), motor: c && c.motor, mine: c && c.mine, body: c && c.body }; });
      t.ok(a.ok && a.motor === 'car' && a.mine && a.body === '#16161a', 'yüklemeden sonra otomobil yerinde', a);
    });

    await t.step('sürüş: dururken otomobil yerinde dönmez; W gaz; W ile A sola kavis; Shift ile hızlanınca yorulmaz', async () => {
      await p.evaluate(() => MT.drive());
      const a = await st();
      await hold(['KeyD'], 600);
      const b = await st();
      t.ok(a.motor === 'car' && Math.abs(b.ang) < 0.05 && Math.hypot(b.x - a.x, b.y - a.y) < 3, 'dururken D: yerinde dönmez', { a, b });
      await hold(['KeyW'], 1300);
      const c = await st();
      t.ok(c.x - b.x > 30 && Math.abs(c.ang) < 0.02, 'W: baktığı yöne gider', { b, c });
      await hold(['KeyW', 'KeyA'], 1300);
      const d = await st();
      t.ok(d.ang < -0.5 && Math.hypot(d.x - c.x, d.y - c.y) > 25, 'W+A: sola kavis çizer', { c, d });
      await hold(['ShiftLeft', 'KeyW'], 2500);
      const e = await st();
      t.ok(e.spd > 60 && e.sta >= e.max - 0.01, 'hızlanır, yorulmaz', e);
    });

    await t.step('S fren, durunca geri vites; geri giderken direksiyon ters çevirir', async () => {
      await p.evaluate(() => MT.drive());
      await hold(['KeyW'], 1200);
      const a = await st();
      await down('KeyS'); await t.sleep(1400);
      const b0 = await st();
      await t.sleep(2000);
      const b = await st();
      await down('KeyA'); await t.sleep(700); await up('KeyA');
      const c = await st();
      await up('KeyS'); await t.sleep(1200);
      const d = await st();
      t.ok(a.spd > 30 && b.back && b.spd > 15 && b.x < b0.x - 15, 'S basılı: durur, sonra geri gider', { a, b0, b });
      t.ok(c.ang > 0.05, 'geri giderken A: burun sağa döner (direksiyon ters)', c);
      t.ok(d.spd < 3 && !d.back, 'S bırakılınca durur', d);
    });

    await t.step('ön tekerlekler direksiyonu izler: dururken de kırılır, bırakınca ortaya döner, geri viteste tuşun yönüne bakar', async () => {
      await p.evaluate(() => MT.drive());
      await down('KeyA'); await t.sleep(600);
      const a = await st();
      await up('KeyA'); await t.sleep(900);
      const b = await st();
      await down('KeyD'); await t.sleep(600);
      const c = await st();
      await up('KeyD'); await t.sleep(800);
      t.ok(a.steer < -0.4 && Math.abs(a.ang) < 0.02, 'dururken A: tekerlekler sola kırılır, otomobil dönmez', a);
      t.ok(Math.abs(b.steer) < 0.05, 'bırakınca ortaya döner', b);
      t.ok(c.steer > 0.4, 'D: sağa kırılır', c);
      await down('KeyS'); await t.sleep(2400); await down('KeyA'); await t.sleep(700);
      const d = await st();
      await up('KeyA'); await up('KeyS');
      t.ok(d.back && d.steer < -0.4 && d.ang > 0.05, 'geri viteste A: tekerlek sola bakar, burun sağa döner', d);
      // park edip inince tekerlek bırakıldığı açıda kalır; NPC'nin otomobilinde açı dönüş yönünden gelir
      const e = await p.evaluate(() => {
        const P = G.player, h = P.riding; h.steer = -0.45; P.dismount(); P.mountAnim = null;
        for (let i = 0; i < 30; i++) G.update(1 / 30);
        const kept = h.steer;
        const w = G.motorize(new Wagon(null, 0, 1, false, { x: P.x + 200, y: P.y, ang: 0 })); w.driver = { look: randomLook('m'), name: 'X' };
        w.motorFx(1 / 30); for (let i = 0; i < 20; i++) { w.ang += 0.04; w.motorFx(1 / 30); }
        return { kept, npc: w.steer };
      });
      t.ok(Math.abs(e.kept + 0.45) < 0.01, 'park etmiş otomobilin tekerleği bırakıldığı açıda kalır', e);
      t.ok(e.npc > 0.2, 'NPC otomobili sağa dönerken tekerlekleri sağa bakar', e);
    });

    await t.step('NPC otomobilini almak araç hırsızlığıdır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; if (P.riding) { P.dismount(); P.mountAnim = null; }
        G.law.level = 0; G.law.bounty = 0; G.reports = [];
        const w = G.motorize(new Wagon(null, 0, 1, false, { x: P.x + 40, y: P.y, ang: 0 })); G.addEnt(w);
        G.hijackWagon(w);
        const R = G.reports.find(o => !o.done);
        return { riding: P.riding === w, owner: w.owner, type: R && R.type, name: R && R.name };
      });
      t.ok(r.riding && r.owner === 'player', 'oyuncu direksiyonda', r);
      t.eq([r.type, r.name], ['cartheft', 'Araç hırsızlığı'], 'şoför kanuna araç hırsızlığını bildirir');
    });
  },
};
