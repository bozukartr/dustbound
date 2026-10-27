'use strict';
/* Dizginle sürüş (klavye): at ve arabada W ileri (gaz), A/D atın başını çevirir (dururken yerinde döner), S fren;
   durunca basılı tutulursa geri geri gidilir. Yürürken tuşlar yine ekrandaki yönlerdir. Kolda sol analog mutlak
   yöndür (controls testinde). Gerçek tuş basışlarıyla. */
module.exports = {
  name: 'Dizginle sürüş: W gaz, A/D dümen, S fren ve geri',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; G.eventT = 1e9; G.travelT = 1e9;
      window.RK = {
        // açık bir yerde ata (ya da kendi yük arabana) bin, doğuya bakarak dur
        mount(wagon) {
          const P = G.player; if (P.riding) { P.dismount(); P.mountAnim = null; }
          const s = TH.openSpot(undefined, undefined, 200) || TH.openSpot(undefined, undefined, 150) || TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
          let h;
          if (wagon) { h = G.myWagon || G.spawnMyWagon(P.x, P.y, 0, []); h.x = P.x; h.y = P.y; h.ang = 0; h.trail(true); }
          else { h = G.horse; h.x = P.x; h.y = P.y; h.ang = 0; h.state = 'idle'; h.dead = false; h.sta = h.maxSta; h.rearT = 0; h.brk = false; }
          h.spd = 0; h.acc = 0; P.mount(h, true); P.mountAnim = null; P.ang = 0;
          return true;
        },
        // atı durdurup doğuya çevir (şahlanma olmasın)
        still() { const h = G.player.riding; h.ang = 0; h.spd = 0; h.acc = 0; h.rearT = 0; h.brk = false; h.back = false; },
        st() { const h = G.player.riding; return { x: Math.round(h.x), y: Math.round(h.y), ang: +h.ang.toFixed(3), spd: Math.round(h.spd), back: !!h.back, gal: !!G.player.galloping }; },
      };
    });
    const st = () => p.evaluate(() => RK.st());
    const down = async (...ks) => { for (const k of ks) await p.keyboard.down(k); };
    const up = async (...ks) => { for (const k of ks) await p.keyboard.up(k); };
    const hold = async (ks, ms) => { await down(...ks); await t.sleep(ms); await up(...ks); };

    await t.step('W atı baktığı yöne sürer; D tek başına dururken atı yerinde sağa çevirir, ilerletmez', async () => {
      await p.evaluate(() => RK.mount());
      const a = await st();
      await hold(['KeyW'], 1300);
      const b = await st();
      t.ok(b.x - a.x > 30 && Math.abs(b.y - a.y) < 6 && Math.abs(b.ang) < 0.02, 'W: doğuya (baktığı yöne) gider, yön değişmez', { a, b });
      await t.sleep(1600);
      const c = await st();
      t.ok(c.spd < 3, 'W bırakılınca at durur', c);
      await hold(['KeyD'], 600);
      const d = await st();
      t.ok(d.ang > 0.6 && d.ang < 2, 'D: saat yönünde (sağa) döner', d);
      t.ok(Math.hypot(d.x - c.x, d.y - c.y) < 6, 'dururken yerinde döner', { c, d });
    });

    await t.step('W ile A birlikte: at sola kavis çizerek ilerler', async () => {
      await p.evaluate(() => RK.mount());
      const a = await st();
      await hold(['KeyW', 'KeyA'], 1300);
      const b = await st();
      t.ok(b.ang < -0.8 && Math.hypot(b.x - a.x, b.y - a.y) > 25 && b.y < a.y - 8, 'W+A: başı sola (kuzeye doğru) döner, ilerler', { a, b });
    });

    await t.step('S fren: bırakmaktan hızlı durur; durunca basılı kalırsa geri geri gider; geri giderken W önce durdurur', async () => {
      await p.evaluate(() => RK.still());
      await hold(['KeyW'], 1400);
      const v0 = await st();
      await down('KeyS'); await t.sleep(700);
      const v1 = await st();
      await t.sleep(1500);
      const v2 = await st();
      await t.sleep(900);
      const v3 = await st();
      await up('KeyS'); await t.sleep(1300);
      const v4 = await st();
      t.ok(v0.spd > 70 && v1.spd < v0.spd * 0.45, 'S fren: hız hızla düşer', { v0, v1 });
      t.ok(v2.back && v3.back && v3.x < v2.x - 5 && Math.abs(v3.ang) < 0.05, 'durduktan sonra S basılı: geri geri gider, yön değişmez', { v2, v3 });
      t.ok(v4.spd < 3 && !v4.back, 'S bırakılınca durur', v4);
      await hold(['KeyS'], 1500);
      const w0 = await st();
      await down('KeyW'); await t.sleep(2200);
      const w1 = await st(); await up('KeyW');
      t.ok(w0.back && w1.x > w0.x + 20 && !w1.back, 'geri giderken W: durup ileri gider', { w0, w1 });
    });

    await t.step('Shift + W dörtnala; dörtnalda dönüş tırıstakinden geniş', async () => {
      await p.evaluate(() => RK.mount());
      await down('ShiftLeft', 'KeyW'); await t.sleep(2600);
      const g = await st();
      await down('KeyD'); await t.sleep(400);
      const g1 = await st();
      await up('KeyD', 'KeyW', 'ShiftLeft'); await t.sleep(2600);
      await p.evaluate(() => RK.still());
      await down('KeyW'); await t.sleep(900);
      const r0 = await st();
      await down('KeyD'); await t.sleep(400);
      const r1 = await st();
      await up('KeyD', 'KeyW');
      t.ok(g.spd > 130 && g.gal, 'dörtnala', g);
      t.ok(g1.ang - g.ang > 0.4 && r1.ang - r0.ang > (g1.ang - g.ang) * 1.15, 'dörtnalda daha geniş döner', { gallop: g1.ang - g.ang, trot: r1.ang - r0.ang });
    });

    await t.step('yük arabası da dizginle sürülür: W ileri, W+D sağa, S ile geri', async () => {
      await t.sleep(1500);
      await p.evaluate(() => RK.mount(true));
      const a = await st();
      await hold(['KeyW'], 1500);
      const b = await st();
      t.ok(b.x - a.x > 30 && Math.abs(b.y - a.y) < 10, 'W: araba baktığı yöne gider', { a, b });
      await hold(['KeyW', 'KeyD'], 900);
      const c = await st();
      t.ok(c.ang > 0.5, 'W+D: araba sağa döner', c);
      await t.sleep(2200);
      const d0 = await st();
      await hold(['KeyS'], 1600);
      const d1 = await st();
      const along = (d1.x - d0.x) * Math.cos(d0.ang) + (d1.y - d0.y) * Math.sin(d0.ang);
      t.ok(along < -4, 'S: araba geri gider', { d0, d1, along });
      await p.evaluate(() => { G.player.dismount(); G.player.mountAnim = null; });
    });

    await t.step('yürürken tuşlar ekrandaki yönlerdir (D doğu, S güney)', async () => {
      await p.evaluate(() => { const s = TH.openSpot(undefined, undefined, 120); TH.goto(s[0], s[1]); G.player.ang = Math.PI; });
      const a = await p.evaluate(() => [G.player.x, G.player.y]);
      await hold(['KeyD'], 700); await t.sleep(300);
      const b = await p.evaluate(() => [G.player.x, G.player.y]);
      await hold(['KeyS'], 700); await t.sleep(300);
      const c = await p.evaluate(() => [G.player.x, G.player.y]);
      t.ok(b[0] - a[0] > 20 && Math.abs(b[1] - a[1]) < 6, 'D: doğuya yürür', { a, b });
      t.ok(c[1] - b[1] > 20 && Math.abs(c[0] - b[0]) < 6, 'S: güneye yürür', { b, c });
    });

    await t.step('ipucu: klavyede ata binince dizgin tuşları bir kez anlatılır', async () => {
      const r = await p.evaluate(() => {
        window.__testNoGuide = false; G.hints = G.hints || {}; delete G.hints.rideKb;
        RK.mount(); UI.el.help.innerHTML = '';
        const P = G.player; P.hunger = P.thirst = P.energy = 100; G.coldness = G.hotness = 0;
        if (G.isNight) G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
        G.hintTick(); const h1 = UI.el.help.textContent;
        UI.el.help.innerHTML = ''; G.hintTick(); const h2 = UI.el.help.textContent;
        window.__testNoGuide = true; P.dismount(); P.mountAnim = null;
        return { h1, h2 };
      });
      t.ok(/ile sür/.test(r.h1) && /ile dön/.test(r.h1) && /geri gidersin/.test(r.h1), 'ipucu çıkar', r.h1);
      t.ok(!/ile sür/.test(r.h2), 'yalnızca bir kez', r.h2);
    });
  },
};
