'use strict';
/* Oyun kolu, silah çarkı, ata binme animasyonu, genişletilmiş radar */
const PAD = () => {
  const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: () => Promise.resolve() } };
  window.__pad = pad; window.__padOn = true;
  navigator.getGamepads = () => (window.__padOn ? [pad] : []);
  window.__press = (i, v = 1) => { pad.buttons[i].pressed = v > 0; pad.buttons[i].value = v; };
};
module.exports = {
  name: 'Kontroller: oyun kolu, çark, binme',
  async run(t) {
    const p = await t.page({ init: PAD });
    const tap = async (i, ms = 90) => { await p.evaluate(i => __press(i, 1), i); await t.sleep(ms); await p.evaluate(i => __press(i, 0), i); await t.sleep(150); };
    await t.step('kolla menüde gezinip yeni oyun başlatılır', async () => {
      await t.sleep(400);
      await tap(13); await tap(12);
      t.eq(await p.evaluate(() => UI.top().focusEl.dataset.id), 'new', 'D-pad ile odak');
      await tap(0); await t.sleep(400);
      t.ok(await p.evaluate(() => !!document.querySelector('.create')), 'X karakter ekranını açmalı');
      await p.evaluate(() => document.querySelector('#cr-go').click());
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 }); await t.sleep(600);
      await p.evaluate(() => UI.el.help.classList.add('hidden'));
      await t.helpers(p);
      t.eq(await p.evaluate(() => Input.device), 'pad', 'giriş cihazı kol olmalı');
    });
    await t.step('sol analogla yürüme, L2+R2 ile ateş', async () => {
      const x0 = await p.evaluate(() => G.player.x);
      await p.evaluate(() => { __pad.axes[0] = 1; }); await t.sleep(700); await p.evaluate(() => { __pad.axes[0] = 0; });
      t.ok((await p.evaluate(() => G.player.x)) - x0 > 20, 'analogla yürümeli');
      await p.evaluate(() => { const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.clip.cattleman = 6; __pad.axes[2] = 1; __press(6, 1); });
      await t.sleep(300); await tap(7);
      const r = await p.evaluate(() => ({ aiming: G.player.aiming, clip: G.player.clip.cattleman }));
      await p.evaluate(() => { __pad.axes[2] = 0; __press(6, 0); });
      t.ok(r.aiming, 'L2 nişan almalı'); t.eq(r.clip, 5, 'R2 bir mermi atmalı');
    });
    await t.step('L1 silah çarkı: sağ analogla seçilir, bırakınca kuşanılır', async () => {
      await t.sleep(400);
      await p.evaluate(() => { const P = G.player; P.giveWeapon('schofield', true); P.addItem('bread', 3, true); __press(4, 1); __pad.axes[2] = 1; __pad.axes[3] = 0; });
      await t.sleep(300);
      t.ok(await p.evaluate(() => G.wheelOpen), 'çark açılmalı');
      await p.evaluate(() => { __press(4, 0); __pad.axes[2] = 0; }); await t.sleep(300);
      t.ok(await p.evaluate(() => !G.wheelOpen && ['schofield', 'cattleman'].includes(G.player.weapon)), 'tabanca yuvasındaki silah kuşanılmalı');
    });
    await t.step('Options duraklatır, O kapatır; touchpad haritayı açar', async () => {
      await tap(9); t.ok(await p.evaluate(() => UI.isModal()), 'duraklatma açılmalı');
      await tap(1); t.ok(await p.evaluate(() => !UI.isModal()), 'O ile kapanmalı');
      await tap(17); t.ok(await p.evaluate(() => !document.getElementById('mapscreen').classList.contains('hidden')), 'harita açılmalı');
      await tap(1); t.ok(await p.evaluate(() => document.getElementById('mapscreen').classList.contains('hidden')), 'harita kapanmalı');
    });
    await t.step('ata binme animasyonu ve üçgenle binme', async () => {
      const r = await p.evaluate(async () => {
        const s = TH.openSpot(); TH.goto(s[0], s[1]); const P = G.player, h = G.horse; h.x = P.x + 16; h.y = P.y; h.state = 'idle'; h.spd = 0;
        const until = async (f) => { for (let k = 0; k < 40 && !f(); k++) await new Promise(res => setTimeout(res, 50)); };
        P.mount(h); const anim = !!P.mountAnim; await until(() => !P.mountAnim);
        const on = P.riding === h && !P.mountAnim; P.dismount(false, true); await until(() => !P.mountAnim);
        P.x = h.x - 12; P.y = h.y; P.ang = 0; UI._scanT = 0;
        return { anim, on, off: !P.riding };
      });
      t.ok(r.anim, 'binerken animasyon'); t.ok(r.on, 'animasyon sonunda eyerde'); t.ok(r.off, 'inmeli');
      await t.sleep(200); await tap(3); await t.sleep(700);
      t.ok(await p.evaluate(() => !!G.player.riding), 'üçgen ile ata binilmeli');
    });
    await t.step('D-pad aşağı kısa basış radarı genişletir, tekrar basış kapatır', async () => {
      await p.waitForFunction(() => !G.player.mountAnim); await p.evaluate(() => { if (G.player.riding) G.player.dismount(); });
      await tap(13, 100); await t.sleep(400);
      t.ok(await p.evaluate(() => document.getElementById('hud').classList.contains('hud-x')), 'radar genişlemeli');
      await tap(13, 100); await t.sleep(400);
      t.ok(await p.evaluate(() => !document.getElementById('hud').classList.contains('hud-x')), 'radar küçülmeli');
    });
  },
};
