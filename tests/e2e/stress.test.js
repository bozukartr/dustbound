'use strict';
/* Rastgele tuş ve fare girdisiyle oyun sayfa hatası vermeden çalışmayı sürdürür */
module.exports = {
  name: 'Rastgele girdi dayanıklılığı',
  timeout: 200000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => { const P = G.player; P.money = 300; P.giveWeapon('cattleman', true); P.giveWeapon('bow', true); P.ammo.arrow = 30; P.ammo.pistol = 60; P.addItem('dynamite', 3, true); P.addItem('bedroll', 1, true); P.addItem('fishing_rod', 1, true); });
    await t.step('45 saniye rastgele girdi', async () => {
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyE', 'KeyR', 'KeyF', 'KeyC', 'KeyQ', 'Tab', 'KeyT', 'KeyH', 'KeyL', 'KeyI', 'KeyB', 'KeyM', 'Escape', 'KeyJ', 'Enter', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyX', 'Space'];
      let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const t0 = Date.now(); let i = 0;
      while (Date.now() - t0 < 45000) {
        i++;
        const k = keys[Math.floor(rnd() * keys.length)];
        if (rnd() < 0.15) { await p.mouse.move(rnd() * 1280, rnd() * 720); await p.mouse.down({ button: rnd() < 0.5 ? 'left' : 'right' }); await t.sleep(60); await p.mouse.up({ button: 'left' }); await p.mouse.up({ button: 'right' }); }
        await p.keyboard.down(k); await t.sleep(rnd() < 0.7 ? 50 : 400); await p.keyboard.up(k); await t.sleep(20);
        if (i % 60 === 0) await p.evaluate(() => { if (G.state === 'play' && !UI.isModal()) { const q = G.world.pois[Math.floor(Math.random() * G.world.pois.length)]; TH.goto(q.x + 30, q.y + 30); } });
      }
      const s = await p.evaluate(() => ({ state: G.state, frame: typeof G.last === 'number' }));
      t.ok(['play', 'dead'].includes(s.state), 'oyun oynanır durumda kalmalı', s);
    });
  },
};
