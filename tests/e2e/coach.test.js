'use strict';
/* İlk oyuncu geri bildirimi: Tab çarkı ve sağ tık nişan fark edilmiyordu, sesler sert ve yüksekti.
   - silah kartında çark tuşu yazar, çark hiç açılmadıysa kart parlar; yeni silahta ortada çark ipucu
   - nişansız ateşte nişan ipucu, istemlerde "Nişan Al"; öğrenilince ikisi de kalıcı olarak susar
   - ses: yeni varsayılan seviyeler, eski varsayılanların bir kez taşınması, miks sırası (yağmur silahtan alçak) */
module.exports = {
  name: 'Koç ipuçları ve ses miksi',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const coach = () => p.evaluate(() => { const el = document.getElementById('coach'); return { on: el.classList.contains('show'), txt: el.textContent }; });

    await t.step('silah kartında çark tuşu; çark hiç açılmadıysa kart parlar', async () => {
      await t.sleep(400);
      const r = await p.evaluate(() => ({ key: document.getElementById('w-key').textContent, learn: document.getElementById('weapon-hud').classList.contains('learn'), n: G.player.weapons.size }));
      t.ok(/Tab/.test(r.key) && /Çark/.test(r.key), 'çark tuşu yazıyor', r);
      t.ok(r.n > 1 && r.learn, 'kart parlıyor', r);
    });

    await t.step('yeni silah alınca ortada çark ipucu belirir', async () => {
      await p.evaluate(() => G.player.giveWeapon('repeater'));
      await p.waitForFunction(() => document.getElementById('coach').classList.contains('show'), null, { timeout: 5000 });
      const c = await coach();
      t.ok(/Silah Çarkı/.test(c.txt) && /Tab/.test(c.txt), 'çark ipucu', c);
    });

    await t.step('çark iki kez açılınca ipucu ve parlama kalıcı olarak susar', async () => {
      const r = await p.evaluate(async () => {
        for (let k = 0; k < 2; k++) { UI.openWheel(); UI.closeWheel(); }
        await new Promise(r => setTimeout(r, 300));
        UI._coachT = {};
        return { learned: UI.coachLearned('wheel'), again: UI.coachWheel(), show: document.getElementById('coach').classList.contains('show'), learn: document.getElementById('weapon-hud').classList.contains('learn'), saved: JSON.parse(Platform.get(SET_KEY) || '{}').coach };
      });
      t.ok(r.learned && r.again === false && !r.show && !r.learn, 'çark öğrenildi', r);
      t.ok(r.saved && r.saved.wheel >= 2, 'ayarlarla saklandı', r.saved);
    });

    await t.step('nişan almadan ateş edince nişan ipucu; istemlerde "Nişan Al"', async () => {
      await p.evaluate(() => { const P = G.player; P.weapon = 'cattleman'; P.clip.cattleman = 6; P.reloadT = 0; P.fireCd = 0; UI._coachT = {}; });
      await t.sleep(400);
      t.ok(/Nişan Al/.test(await p.evaluate(() => document.getElementById('prompts').textContent)), 'istemlerde Nişan Al');
      await p.evaluate(() => { const P = G.player; P.aiming = false; P.shoot(); });
      const c = await coach();
      t.ok(c.on && /Nişan almak/.test(c.txt) && /Sağ Tık/.test(c.txt), 'nişan ipucu', c);
    });

    await t.step('nişanla üç kez ateş edince nişan ipuçları susar', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player;
        for (let k = 0; k < 3; k++) { P.clip.cattleman = 6; P.fireCd = 0; P.aiming = true; P.shoot(); }
        P.aiming = false;
        await new Promise(r => setTimeout(r, 400));
        UI._coachT = {};
        return { learned: UI.coachLearned('aim'), again: UI.coachAim(), prompt: /Nişan Al/.test(document.getElementById('prompts').textContent) };
      });
      t.ok(r.learned && r.again === false && !r.prompt, 'nişan öğrenildi', r);
    });

    await t.step('ateş etmeyi isteyen ilk görevde nişan ipucu ilk atıştan önce gelir (elde silah yoksa önce çark)', async () => {
      const q = await t.newGame({ story: true });
      await q.evaluate(() => { window.__storyFast = true; });
      await q.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st === 0 && !G.story.wait, null, { timeout: 20000 });
      await q.evaluate(() => { G.player.weapon = 'fists'; G.qChapter(3); });
      await q.waitForFunction(() => G.story.ch === 3 && G.story.st === 0 && !G.story.wait, null, { timeout: 20000 });
      // elde yumruk: önce çark
      await q.waitForFunction(() => document.getElementById('coach').classList.contains('show'), null, { timeout: 8000 });
      const w = await q.evaluate(() => document.getElementById('coach').textContent);
      t.ok(/Silah Çarkı/.test(w), 'önce çark ipucu', w);
      // tabancayı eline alınca, daha ateş etmeden nişan ipucu
      await q.evaluate(() => { const P = G.player; P.weapon = P.weapons.has('cattleman') ? 'cattleman' : [...P.weapons].find(x => WEAPONS[x].clip); });
      await q.waitForFunction(() => /Nişan almak/.test(document.getElementById('coach').textContent) && document.getElementById('coach').classList.contains('show'), null, { timeout: 5000 });
      const r = await q.evaluate(() => ({ shots: Object.values(G.player.spent || {}).reduce((a, b) => a + b, 0), wanted: G.player.wanted || 0, pend: !!UI.coachFor }));
      t.eq(r.shots, 0, 'ipucu ilk atıştan önce');
      t.ok(!r.pend, 'görev ipucu bir kez gösterildi', r);
    });

    await t.step('ses: yeni varsayılanlar ve eski varsayılanların taşınması', async () => {
      const r = await p.evaluate(() => {
        const fresh = { master: 0.7, sfx: 0.7, music: 0.4, amb: 0.5 };
        Platform.set(SET_KEY, JSON.stringify({ master: 0.8, sfx: 0.8, music: 0.5, amb: 0.6 }));
        G.loadSettings();
        const old = { master: G.settings.master, sfx: G.settings.sfx, music: G.settings.music, amb: G.settings.amb };
        Platform.set(SET_KEY, JSON.stringify({ master: 0.95, sfx: 0.8, music: 0.2, amb: 0.6 }));
        G.loadSettings();
        const own = { master: G.settings.master, music: G.settings.music, sfx: G.settings.sfx };
        G.saveSettings();
        return { fresh, old, own, aud: Audio_.vol.sfx };
      });
      t.eq(r.old, r.fresh, 'eski varsayılanlar yeni varsayılanlara indi');
      t.eq(r.own, { master: 0.95, music: 0.2, sfx: 0.7 }, 'oyuncunun kendi değerleri korunur');
    });

    await t.step('miks: silah yüksek ve sert değil, yağmur silahtan en az 6 dB alçak, zil silahtan alçak', async () => {
      const r = await p.evaluate(async () => {
        const SR = 44100, RealAC = window.AudioContext, saved = { ctx: Audio_.ctx, bank: Audio_.bank, sloops: Audio_.sloops, loadBank: Audio_.loadBank, loops: Audio_.loops, vol: Object.assign({}, Audio_.vol) };
        const meas = async (fn) => {
          const off = new OfflineAudioContext(2, SR * 2.5, SR);
          window.AudioContext = function () { return off; };
          Audio_.ctx = null; Audio_.bank = {}; Audio_.sloops = {}; Audio_.loadBank = () => {}; Audio_.loops = {};
          Object.assign(Audio_.vol, { master: 0.7, sfx: 0.7, music: 0.4, amb: 0.5 });
          Audio_.unlock(); fn(Audio_);
          const d = (await off.startRendering()).getChannelData(0), W = SR / 10;
          let best = 0, hf = 0, tot = 0;
          for (let s = 0; s + W <= d.length; s += W / 2) { let e = 0; for (let i = s; i < s + W; i++) e += d[i] * d[i]; best = Math.max(best, Math.sqrt(e / W)); }
          for (let i = 1; i < d.length; i++) { const df = d[i] - d[i - 1]; hf += df * df; tot += d[i] * d[i]; }
          return { db: 20 * Math.log10(best || 1e-9), harsh: tot ? hf / tot : 0 };
        };
        try {
          const gun = await meas(A => A.shot('pistol', 1));
          const rain = await meas(A => A.ambientTick({ rain: 1, wind: 0, fire: 0, water: 0, nature: 0 }));
          const chime = await meas(A => A.chime());
          return { gun, rain, chime };
        } finally { window.AudioContext = RealAC; Object.assign(Audio_, { ctx: saved.ctx, bank: saved.bank, sloops: saved.sloops, loadBank: saved.loadBank, loops: saved.loops }); Object.assign(Audio_.vol, saved.vol); }
      });
      t.ok(r.gun.db > -34 && r.gun.db < -22, 'silah duyulur ama patlamaz', r.gun);
      t.ok(r.gun.harsh < 0.05, 'silah cızırtısız', r.gun);
      t.ok(r.rain.db < r.gun.db - 6, 'yağmur silahtan en az 6 dB alçak', r);
      t.ok(r.chime.db < r.gun.db, 'bölüm zili silahtan alçak', r);
    });
  },
};
