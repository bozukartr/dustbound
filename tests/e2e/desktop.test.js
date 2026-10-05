'use strict';
/* Masaüstü köprüsü (desktop/preload.js → window.native) sahte bir Steam Deck ile: kayıtlar köprüden yazılır,
   başarım Steam API adıyla gider; karakter ekranında isim kutusu odaklanınca Steam ekran klavyesi kutunun
   alanıyla istenir; Deck dışında ve klavyeyle oynarken istenmez. Paket ayarları: simge pakete girer,
   her platform yalnızca kendi Steam kütüphanesini taşır; başarım listesi ve simgeleri oyundakilerle aynı. */
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), DESK = path.join(ROOT, 'desktop');
module.exports = {
  name: 'Masaüstü köprüsü ve Steam',
  timeout: 300000,
  async run(t) {
    const mock = (deck) => `(() => {
      const S = new Map(), log = window.__native = { kb: [], ach: [] };
      window.native = {
        platform: 'linux',
        store: { get: k => (S.has(k) ? S.get(k) : null), set: (k, v) => { S.set(k, v); return true; }, remove: k => { S.delete(k); return true; } },
        steamInfo: () => ({ enabled: true, appId: 480, lang: 'turkish', deck: ${deck}, name: 'Deck' }),
        achievement: (api) => log.ach.push(api), presence: () => {},
        keyboard: (x, y, w, h) => log.kb.push([x, y, w, h]),
        isFullscreen: () => false, setFullscreen: () => {}, quit: () => {}, onClosing: () => {},
      };
    })();`;
    const openCreate = async (p, pad) => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      if (pad) await p.evaluate(() => { Input.device = 'pad'; });
      await p.waitForFunction(() => document.querySelector('#cr-name'), null, { timeout: 10000 });
    };

    await t.step('Steam Deck: isim kutusu odaklanınca ekran klavyesi kutunun alanıyla açılır', async () => {
      const p = await t.page({ init: mock(true) });
      const r0 = await p.evaluate(() => ({ steam: Platform.steam, deck: Platform.deck }));
      t.ok(r0.steam && r0.deck, 'köprü Deck olarak görünüyor', r0);
      await openCreate(p, false);   // Enter klavyeden: Deck'te yine de isim kutusu kendiliğinden odaklanmaz
      t.eq(await p.evaluate(() => window.__native.kb.length), 0, 'ekran açılınca kendiliğinden açılmaz');
      await p.evaluate(() => document.querySelector('#cr-name-row').click());
      const r = await p.evaluate(() => { const b = document.querySelector('#cr-name').getBoundingClientRect(); return { kb: window.__native.kb, b: [b.left, b.top, b.width, b.height].map(Math.round), focus: document.activeElement.id }; });
      t.eq(r.focus, 'cr-name', 'isim kutusu odakta');
      t.eq(r.kb.length, 1, 'klavye bir kez istendi', r.kb);
      t.ok(r.kb[0].every((v, i) => Math.abs(v - r.b[i]) <= 1) && r.kb[0][2] > 20, 'klavye kutunun alanıyla istendi', r);
      // Steam klavyesinden gelen tuşlar ismi yazar, Enter yazmayı bitirir
      await p.keyboard.press('Control+A'); await p.keyboard.type('Ada Wells'); await p.keyboard.press('Enter');
      const n = await p.evaluate(() => ({ v: document.querySelector('#cr-name').value, focus: document.activeElement && document.activeElement.id, tf: Input.textFocus }));
      t.ok(n.v === 'Ada Wells' && n.focus !== 'cr-name' && !n.tf, 'isim yazıldı, yazma modu kapandı', n);
    });

    await t.step('Deck dışında klavyeyle oynarken ekran klavyesi istenmez; kayıt ve başarım köprüden', async () => {
      const p = await t.page({ init: mock(false) });
      await openCreate(p, false);
      await p.evaluate(() => document.querySelector('#cr-name-row').click());
      t.eq(await p.evaluate(() => window.__native.kb.length), 0, 'klavye istenmedi');
      const r = await p.evaluate(() => { Platform.set('frontiersend_test', 'x'); G.achieved = G.achieved || new Set(); Platform.achievement('story'); return { ls: localStorage.getItem('frontiersend_test'), got: window.native.store.get('frontiersend_test'), ach: window.__native.ach }; });
      t.ok(r.ls === null && r.got === 'x', 'kayıt köprüden yazıldı', r);
      t.eq(r.ach, ['ACH_STORY'], 'başarım Steam API adıyla gitti');
    });

    await t.step('paket ayarları: simge pakete girer, her platform yalnızca kendi Steam kütüphanesini taşır', async () => {
      const B = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8')).build;
      t.ok(B.files.includes('build/icon.png'), 'pencere simgesi pakette', B.files);
      const ex = (os) => (B[os].files || []).join(' ');
      t.ok(/linux64/.test(ex('win')) && /osx/.test(ex('win')) && !/win64\/\*\*/.test(ex('win')), 'Windows: Linux ve Mac kütüphaneleri dışarıda', ex('win'));
      t.ok(/win64/.test(ex('linux')) && /osx/.test(ex('linux')) && !/linux64/.test(ex('linux')), 'Linux: Windows ve Mac kütüphaneleri dışarıda', ex('linux'));
      t.ok(/win64/.test(ex('mac')) && /linux64/.test(ex('mac')) && !/osx/.test(ex('mac')), 'Mac: Windows ve Linux kütüphaneleri dışarıda', ex('mac'));
      // yalnızca '!' kalıplarından oluşan liste electron-builder'da "her şeyi al" demektir (steam/, tools/ pakete girer)
      for (const os of ['win', 'linux', 'mac']) t.ok(B[os].files.some(f => !f.startsWith('!')), `${os}: listede olumlu kalıp var`, B[os].files);
      const png = fs.readFileSync(path.join(DESK, 'build', 'icon.png'));
      t.ok(png.readUInt32BE(16) >= 512 && png.readUInt32BE(16) === png.readUInt32BE(20), 'simge kare ve en az 512 piksel', png.readUInt32BE(16));
      const ico = fs.readFileSync(path.join(DESK, 'steam', 'icons', 'client_icon.ico'));
      t.ok(ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 5, 'istemci simgesi geçerli ICO', ico.readUInt16LE(4));
      t.ok(fs.existsSync(path.join(DESK, 'steam', 'icons', 'community_icon.jpg')), 'topluluk simgesi var');
    });

    await t.step('başarım listesi ve simgeleri oyundaki başarımlarla aynı', async () => {
      const ctx = vm.createContext({});
      vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8') + ';this.A = ACHIEVEMENTS.map(a => "ACH_" + a.id.toUpperCase());', ctx);
      const csv = fs.readFileSync(path.join(DESK, 'steam', 'achievements.csv'), 'utf8').trim().split('\n').slice(1).map(l => JSON.parse(l.split(',')[0]));
      t.eq(csv, ctx.A, 'achievements.csv oyundaki sırayla bütün başarımları içerir');
      const icons = new Set(fs.readdirSync(path.join(DESK, 'steam', 'achievement-icons')));
      const miss = ctx.A.flatMap(a => [a + '.jpg', a + '_locked.jpg']).filter(f => !icons.has(f));
      t.eq(miss, [], 'her başarımın kazanılmış ve kilitli simgesi var');
      t.eq(icons.size, ctx.A.length * 2, 'fazla simge yok');
    });
  },
};
