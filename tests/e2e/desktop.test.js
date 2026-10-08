'use strict';
/* Masaüstü köprüsü (desktop/preload.js → window.native) sahte bir Steam Deck ile: kayıtlar köprüden yazılır,
   başarım Steam API adıyla gider; karakter ekranında isim kutusu odaklanınca Steam ekran klavyesi kutunun
   alanıyla istenir; Deck dışında ve klavyeyle oynarken istenmez. Paket ayarları: simge pakete girer,
   her platform yalnızca kendi Steam kütüphanesini taşır; başarım listesi ve simgeleri oyundakilerle aynı.
   Ekran kartı: açılış anahtarları ve Linux PRIME değişkenleri (desktop/gpu.js), Ayarlar'da bulunan kartların
   adlarıyla seçimi, tercihin köprüye yazılması ve yeniden açma sorusu, açılış tercihinin WebGL'e geçmesi. */
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

    await t.step('ekran kartı: açılış anahtarları, Linux PRIME değişkenleri, kart listesi (desktop/gpu.js)', async () => {
      const GPU = require(path.join(DESK, 'gpu.js')), os = require('os');
      t.ok(JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8')).build.files.includes('gpu.js'), 'gpu.js pakete girer');
      t.eq([GPU.prefOf('high'), GPU.prefOf('x'), GPU.prefOf(undefined)], ['high', 'auto', 'auto'], 'tercih süzülür');
      t.eq(GPU.launchPlan('auto', 'win32').switches, ['force_high_performance_gpu'], 'otomatik: güçlü kart anahtarı');
      t.eq(GPU.launchPlan('low', 'darwin'), { pref: 'low', switches: ['force_low_power_gpu'], env: {} }, 'tasarruflu: düşük güç anahtarı, değişken yok');
      const intel = { vendorId: 0x8086, deviceId: 0x5917, bootVga: true }, nv = { vendorId: 0x10de, deviceId: 0x2520, bootVga: false }, amd = { vendorId: 0x1002, deviceId: 0x73df, bootVga: false };
      t.eq(GPU.launchPlan('high', 'linux', { cards: [intel, nv], nvidiaDriver: true }).env, { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' }, 'Linux Intel + NVIDIA: render offload');
      t.eq(GPU.launchPlan('auto', 'linux', { cards: [intel, nv], nvidiaDriver: false }).env, {}, 'NVIDIA sürücüsü yüklü değilse değişken verilmez');
      t.eq(GPU.launchPlan('auto', 'linux', { cards: [intel, amd] }).env, { DRI_PRIME: '1' }, 'Linux Intel + AMD: DRI_PRIME');
      t.eq(GPU.launchPlan('high', 'linux', { cards: [{ ...nv, bootVga: true }, { ...intel, bootVga: false }], nvidiaDriver: true }).env, {}, 'açılış kartı NVIDIA ise dokunulmaz');
      t.eq(GPU.launchPlan('high', 'linux', { cards: [intel, amd], envBad: true }).env, {}, 'önceki deneme başarısızsa değişken verilmez');
      t.eq(GPU.launchPlan('low', 'linux', { cards: [intel, amd] }).env, {}, 'tasarruflu seçimde değişken yok');
      t.eq(GPU.launchPlan('high', 'linux', { cards: [intel] }).env, {}, 'tek kartta değişken yok');
      // sahte sysfs: iki kart, bağlantı noktası düğümleri (card0-HDMI-A-1) sayılmaz
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drm-'));
      const mk = (n, v, d, boot) => { const dir = path.join(root, n, 'device'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'vendor'), v + '\n'); fs.writeFileSync(path.join(dir, 'device'), d + '\n'); if (boot !== undefined) fs.writeFileSync(path.join(dir, 'boot_vga'), boot + '\n'); };
      mk('card0', '0x8086', '0x5917', 1); mk('card1', '0x10de', '0x2520', 0); fs.mkdirSync(path.join(root, 'card0-HDMI-A-1'));
      const cards = GPU.linuxCards(root);
      fs.rmSync(root, { recursive: true, force: true });
      t.eq(cards.map(c => [c.vendorId, c.deviceId, c.bootVga]), [[0x8086, 0x5917, true], [0x10de, 0x2520, false]], 'sysfs kartları okunur', cards);
      const sum = GPU.summarize({ auxAttributes: { glRenderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)', optimus: true }, gpuDevice: [{ vendorId: 0x8086, deviceId: 0x5917, active: true, deviceString: '', gpuPreference: 0 }] }, cards);
      t.eq(sum.devices.map(d => [d.vendorId, d.active, d.boot]), [[0x8086, true, true], [0x10de, false, false]], 'Chromium görmediği kart sysfs listesinden eklenir', sum);
      t.ok(sum.optimus && /UHD/.test(sum.renderer), 'çizici dizgesi ve Optimus işareti taşınır');
      const deck = GPU.summarize({ gpuDevice: [{ vendorId: 0x1002, deviceId: 0, active: true }] }, [{ vendorId: 0x1002, deviceId: 0x163f, bootVga: true }]);
      t.eq(deck.devices.map(d => [d.deviceId, d.active, d.boot]), [[0x163f, true, true]], 'kimliği bilinmeyen Chromium kaydı sysfs kartıyla birleşir (Steam Deck tek kart)', deck);
    });

    await t.step('ekran kartı: Ayarlarda bulunan kartlar adlarıyla seçilir, tercih köprüye yazılır, çıkarken yeniden açma sorulur', async () => {
      const gpuMock = (launch) => mock(false).replace('onClosing: () => {},', `onClosing: () => {}, gpuLaunch: '${launch}', setGpu: (p) => (log.gpu = log.gpu || []).push(p), relaunch: () => { log.relaunch = (log.relaunch || 0) + 1; },
        gpuInfo: () => Promise.resolve({ launch: '${launch}', saved: '${launch}', platform: 'win32', env: [], envBad: false, optimus: true, renderer: '', webgl: 'enabled',
          devices: [{ vendorId: 0x8086, deviceId: 0x5917, name: 'Intel(R) UHD Graphics 620', active: true, pref: 2 }, { vendorId: 0x10de, deviceId: 0x2520, name: 'NVIDIA GeForce RTX 3060 Laptop GPU', active: false, pref: 3 }] }),`).replace('quit: () => {},', 'quit: () => { log.quit = (log.quit || 0) + 1; },');
      const p = await t.page({ init: gpuMock('auto') });
      await p.evaluate(() => UI.openSettings(2)); await t.sleep(400);
      const r = await p.evaluate(() => {
        const row = document.querySelector('.st-row[data-k="gpu"]'); UI.top().setFocus(row, true);
        return { opts: [...row.querySelectorAll('.st-seg span')].map(n => n.textContent), side: document.querySelector('.st-side').innerText, cards: UI.gpuDet.cards.map(c => [c.short, c.role]) };
      });
      t.eq(r.opts, ['Otomatik', 'GeForce RTX 3060 Laptop', 'Intel UHD 620'], 'seçenekler kartların adlarıyla', r);
      t.ok(/NVIDIA GeForce RTX 3060 Laptop GPU — güçlü/.test(r.side) && /Intel UHD Graphics 620 — tasarruflu/.test(r.side), 'yan panelde bulunan kartlar ve rolleri', r.side);
      await p.evaluate(() => document.querySelector('.st-row[data-k="gpu"] [data-v="2"]').click()); await t.sleep(200);
      const r2 = await p.evaluate(() => ({ gpu: G.settings.gpu, sent: window.__native.gpu, side: document.querySelector('.st-side').innerText, power: G.gpuPower() }));
      t.eq(r2.gpu, 2, 'tasarruflu kart seçildi');
      t.eq(r2.sent, ['low'], 'tercih köprüye yazıldı');
      t.ok(/yeniden açılınca geçerli/.test(r2.side), 'yeniden açınca geçerli olacağı yazılır', r2.side);
      t.eq(r2.power, 'high-performance', 'bu açılışta WebGL hâlâ açılış tercihiyle (kart süreç boyunca sabit)');
      await p.keyboard.press('Escape'); await t.sleep(300);
      const ask = await p.evaluate(() => UI.top() && UI.top().el.innerText);
      t.ok(/Ekran Kartı/.test(ask) && /Kaydet ve Çık/.test(ask), 'Steam açıkken kaydedip kapatma sorulur', ask);
      await p.evaluate(() => UI.top().el.querySelector('.p-item').click()); await t.sleep(200);
      t.eq(await p.evaluate(() => window.__native.quit), 1, 'evet: oyun kapanır (Steam\'den yeniden açılır)');
      // bir sonraki açılış: tercih köprüden gelir, ayara ve WebGL güç tercihine geçer
      const p2 = await t.page({ init: gpuMock('low') });
      const r3 = await p2.evaluate(() => ({ gpu: G.settings.gpu, power: G.gpuPower() }));
      t.eq(r3, { gpu: 2, power: 'low-power' }, 'açılış tercihi ayara ve WebGL güç tercihine geçer');
    });

    await t.step('ekran kartı adları: WebGL çizici dizgeleri okunur ada, kısa ada ve role çevrilir', async () => {
      const p = await t.page();
      const r = await p.evaluate(() => {
        const S = [
          'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002520) Direct3D11 vs_5_0 ps_5_0, D3D11)',
          'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)',
          'ANGLE (AMD, AMD Custom GPU 0405 (radeonsi, vangogh, LLVM 15.0.7, DRM 3.52, 6.1.52-valve9-1-neptune-61), OpenGL ES 3.2 Mesa 23.1.3)',
          'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
          'ANGLE (NVIDIA, Vulkan 1.3.242 (NVIDIA GeForce RTX 4070 (0x00002786)), NVIDIA-535.86.5.0)',
          'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)',
          'Adreno (TM) 650', 'NVIDIA GeForce GTX 980, or similar',
          'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
        ];
        const names = S.map(s => Platform.gpuName(s));
        const shorts = ['NVIDIA GeForce RTX 3060 Laptop GPU', 'Intel UHD Graphics 620', 'AMD Radeon Graphics', 'AMD Radeon RX 6600'].map(n => Platform.gpuShort(n));
        const role = (L) => { Platform.gpuRoles(L); return L.map(c => c.role); };
        return { names, shorts, soft: Platform.gpuSoft(S[8]),
          roles: [role([{ vendor: 'Intel', name: 'Intel UHD Graphics 620' }, { vendor: 'NVIDIA', name: 'NVIDIA GeForce RTX 3060' }]),
            role([{ vendor: 'AMD', name: 'AMD Radeon Graphics' }, { vendor: 'NVIDIA', name: 'NVIDIA GeForce RTX 4060' }]),
            role([{ vendor: 'Intel', name: 'Intel Iris Xe Graphics' }, { vendor: 'AMD', name: 'AMD Radeon RX 6500M' }]),
            role([{ vendor: 'AMD', name: 'AMD Radeon Graphics', boot: true }, { vendor: 'AMD', name: 'AMD Radeon Graphics', boot: false }]),
            role([{ vendor: 'Intel', name: 'Intel Arc Graphics' }, { vendor: 'NVIDIA', name: 'NVIDIA GeForce RTX 4050 Laptop GPU' }]),
            role([{ vendor: 'NVIDIA', name: 'X', pref: 2 }, { vendor: 'NVIDIA', name: 'Y', pref: 3 }]),
            role([{ vendor: 'Apple', name: 'Apple M2' }])] };
      });
      t.eq(r.names, ['NVIDIA GeForce RTX 3060 Laptop GPU', 'Intel UHD Graphics 620', 'Steam Deck GPU', 'Apple M2 Pro', 'NVIDIA GeForce RTX 4070', 'Intel UHD Graphics 620', 'Adreno 650', 'NVIDIA GeForce GTX 980', 'SwiftShader Device'], 'okunur adlar', r.names);
      t.eq(r.shorts, ['GeForce RTX 3060 Laptop', 'Intel UHD 620', 'Radeon Graphics', 'Radeon RX 6600'], 'kısa adlar', r.shorts);
      t.ok(r.soft, 'SwiftShader yazılım sayılır');
      t.eq(r.roles, [['low', 'high'], ['low', 'high'], ['low', 'high'], ['low', 'high'], ['low', 'high'], ['low', 'high'], ['only']], 'güçlü ve tasarruflu kart ayrılır', r.roles);
    });
  },
};
