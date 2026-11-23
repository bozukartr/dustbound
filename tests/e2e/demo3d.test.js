'use strict';
/* 3B test paketi (npm run build:demo3d): paket kurulur, tarayıcıda hatasız açılır; Çiftçi Çocuğu ile Harlow'da
   hikâyesiz başlanır, dünya 3B çizilir (2D arayüz üstünde), oyuncu sınırlı alanda kalır, F3 3B ile 2D arasında
   geçer, [ ve ] saati değiştirir; üçüncü şahıs kamera: bir tuşa basınca fare kendiliğinden kilitlenir, fare kamerayı
   sınırsız döndürür ve gökten yere eğer, hassasiyet ayarı (Ayarlar > Kontroller) dönüşü hızlandırır, nişan ekranın
   ortasından giden ışının değdiği yerdedir, pencere açılınca kilit bırakılıp kapanınca geri gelir; kilitsizken nişan
   imlecin gösterdiği yere gider, yürüyüş ve işaretler perspektif görüntüye uyar; oyuncu binaya girince bina kesitlenir,
   kayıtlar ayrı tutulur.
   Depodaki tam oyun bu testten etkilenmez. */
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
module.exports = {
  name: '3B test paketi',
  timeout: 420000,
  async run(t) {
    const errInit = () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; };
    let p;
    const frames = (n) => p.waitForFunction((n) => D3.state.frames >= n, n, { timeout: 60000 });

    await t.step('paket kurulur: 3B katmanı main.js\'ten önce, geliştirici aracı yok, oyun dosyaları yerinde', async () => {
      execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-demo3d.js')], { cwd: ROOT, stdio: 'pipe' });
      const D = path.join(ROOT, 'dist-demo3d');
      t.ok(fs.existsSync(path.join(ROOT, 'dist-demo3d.zip')), 'zip hazır');
      const html = fs.readFileSync(path.join(D, 'index.html'), 'utf8');
      t.ok(/demo3d\/gl\.js[\s\S]*demo3d\/models\.js[\s\S]*demo3d\/scene\.js[\s\S]*demo3d\/demo3d\.js[\s\S]*js\/main\.js/.test(html), 'betik sırası', html.match(/<script[^>]*>/g).slice(-6));
      t.ok(!/debug\.js/.test(html) && !fs.existsSync(path.join(D, 'js', 'debug.js')), 'geliştirici aracı pakette yok');
      t.ok(/3D Test<\/title>/.test(html), 'pencere başlığı');
      t.ok(fs.existsSync(path.join(ROOT, 'js', 'debug.js')) && !/demo3d/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), 'depodaki oyun değişmedi');
    });

    await t.step('ana menü: 3B TEST işareti, yalnızca Çiftçi Çocuğu', async () => {
      p = await t.page({ path: 'dist-demo3d/index.html', init: errInit });
      const r = await p.evaluate(() => ({ bgs: BACKGROUNDS.map(b => b.id), tag: (document.getElementById('d3-tag') || {}).textContent, ver: document.querySelector('.mm-ver').textContent, dbg: typeof Debug, errs: window.__errs }));
      t.eq(r.bgs, ['farm'], 'geçmiş');
      t.ok(/Harlow/.test(r.tag || '') && /3B/.test(r.ver), 'menüde 3B işareti', r);
      t.eq(r.dbg, 'undefined', 'geliştirici aracı yok');
      t.eq(r.errs, [], 'konsol hatası yok');
    });

    await t.step('yeni oyun: Harlow\'da başlar, dünya 3B çizilir, oyuncu alanın içinde', async () => {
      await t.newGame({ page: p });
      await frames(3);
      const r = await p.evaluate(() => {
        const S = D3.state, A = S.area, P = G.player, sc = S.scene;
        return { ok: S.ok, on: S.on, town: A && A.town, inside: A && P.x >= A.px0 && P.x <= A.px1 && P.y >= A.py0 && P.y <= A.py1, w: A && A.x1 - A.x0, h: A && A.y1 - A.y0,
          hy: G.hy, cv: [G.canvas.width, G.canvas.height, G.vw, G.vh], parts: sc && sc.parts.length, bld: sc && sc.bparts.size, story: !!(G.story && G.story.on), errs: window.__errs };
      });
      t.ok(r.ok && r.on, '3B çizim açık', r);
      t.eq(r.town, 'harlow', 'kasaba');
      t.ok(r.inside, 'oyuncu sınırlı alanın içinde', r);
      t.ok(r.w >= 40 && r.h >= 30, 'alan kasabanın ortasını kapsar', r);
      t.ok(!r.hy && r.cv[0] === r.cv[2] && r.cv[1] === r.cv[3], 'tuval dünya pikseli başına bir piksel', r.cv);
      t.ok(r.parts > 10 && r.bld >= 5, 'sahnede zemin, binalar ve nesneler', r);
      t.ok(!r.story, 'hikâye kapalı');
      t.eq(r.errs, [], 'konsol hatası yok');
      // 3B görüntü gerçekten çiziliyor: oyuncunun üstündeki pikseller düz renk değil
      const px = await p.evaluate(() => { const c = G.ctx.getImageData(0, 0, G.canvas.width, G.canvas.height).data, seen = new Set(); for (let i = 0; i < c.length; i += 4 * 97) seen.add(c[i] >> 3 << 10 | c[i + 1] >> 3 << 5 | c[i + 2] >> 3); return seen.size; });
      t.ok(px > 40, 'görüntüde çok sayıda ton var', px);
    });

    await t.step('F3 2D ile 3B arasında geçer; [ ve ] saati değiştirir', async () => {
      await p.evaluate(() => { const h = document.querySelector('#help'); if (h) h.classList.add('hidden'); UI.closeAll(); });
      await p.keyboard.press('F3');
      await t.sleep(400);
      const a = await p.evaluate(() => ({ on: D3.state.on, f: D3.state.frames }));
      await t.sleep(800);
      const a2 = await p.evaluate(() => D3.state.frames);
      t.ok(!a.on && a2 === a.f, '2D: 3B kareler durur', { a, a2 });
      await p.keyboard.press('F3');
      await frames(a2 + 2);
      t.ok(await p.evaluate(() => D3.state.on && !G.hy), 'yeniden 3B');
      const h0 = await p.evaluate(() => G.hour);
      await p.keyboard.press('BracketRight'); await t.sleep(200);
      const h1 = await p.evaluate(() => G.hour);
      await p.keyboard.press('BracketLeft'); await t.sleep(200);
      const h2 = await p.evaluate(() => G.hour);
      t.ok(Math.abs(((h1 - h0 + 24) % 24) - 1) < 0.1 && Math.abs(((h1 - h2 + 24) % 24) - 1) < 0.1, 'saat bir saat ileri ve geri', [h0, h1, h2]);
    });

    await t.step('üçüncü şahıs kamera: tuşa basınca fare kilitlenir, 360° döner, gökten yere eğilir, hassasiyet ayarı', async () => {
      // oyuna girişte kilit kendiliğinden denenmiş olabilir: önce bırak
      await p.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
      await p.waitForFunction(() => !document.pointerLockElement && !D3.state.look, null, { timeout: 30000 });
      await p.waitForTimeout(800);
      await p.keyboard.press('KeyC');   // çömel (zararsız bir tuş): kilit bir sonraki karede istenir
      await p.waitForFunction(() => document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      await p.keyboard.press('KeyC');
      t.ok(/Esc/.test(await p.evaluate(() => document.getElementById('d3-badge').textContent)), 'işaret kilitli hâli anlatır');
      // başsız tarayıcı kilitliyken fare hareketini olay olarak verir (movementX/Y)
      const mv = (dx, dy) => p.evaluate(([dx, dy]) => G.canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true })), [dx, dy]);
      await p.evaluate(() => { G.settings.d3Sens = 0.5; D3.state.yaw = 0; D3.state.pitch = 0.3; });
      await mv(100, 0);
      const y1 = await p.evaluate(() => D3.state.yaw);
      t.ok(y1 < -0.15, 'fare sağa: kamera sağa döner', y1);
      // tam tur: 2π kadar sürükleyince başa döner (sınır yok)
      const step = await p.evaluate(() => 0.0025 * D3.sensMul());
      const full = Math.round(Math.PI * 2 / step);
      let left = full - 100;
      while (left > 0) { const d = Math.min(300, left); await mv(d, 0); left -= d; }
      const y2 = await p.evaluate(() => D3.state.yaw);
      t.ok(Math.abs(Math.atan2(Math.sin(y2), Math.cos(y2))) < 0.02, 'tam tur dönünce başa gelir (360°)', { y2, full });
      // eğim: fare ileri → kamera alçalıp göğe bakar; geri → yukarıdan yere bakar
      for (let i = 0; i < 6; i++) await mv(0, -300);
      const lo = await p.evaluate(() => ({ p: D3.state.pitch, min: D3.P_MIN }));
      t.ok(Math.abs(lo.p - lo.min) < 1e-6 && lo.min < -0.3, 'fare ileri: aşağıdan göğe bakış', lo);
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 2);
      const sky = await p.evaluate(() => { const K = D3.state.cam, d = G.ctx.getImageData(Math.floor(G.vw / 2), 4, 1, 1).data; return { eyeBelow: K.E[1] < K.T[1], px: [d[0], d[1], d[2]] }; });
      t.ok(sky.eyeBelow && sky.px[0] + sky.px[1] + sky.px[2] > 150, 'kamera hedefin altında, ekranın üstünde gök', sky);
      for (let i = 0; i < 8; i++) await mv(0, 300);
      const hi = await p.evaluate(() => ({ p: D3.state.pitch, max: D3.P_MAX }));
      t.ok(Math.abs(hi.p - hi.max) < 1e-6 && hi.max > 1.2, 'fare geri: yukarıdan yere bakış', hi);
      // hassasiyet: ayar en üstteyken aynı hareket dört kat döndürür
      const sens = await p.evaluate(() => {
        const mvYaw = (dx) => { const y0 = D3.state.yaw; G.canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: 0, bubbles: true })); return Math.abs(Math.atan2(Math.sin(D3.state.yaw - y0), Math.cos(D3.state.yaw - y0))); };
        G.settings.d3Sens = 0.5; const a = mvYaw(40);
        G.settings.d3Sens = 1; const b = mvYaw(40);
        G.settings.d3Sens = 0.5;
        return { a, b };
      });
      t.ok(Math.abs(sens.b / sens.a - 4) < 0.05, 'hassasiyet en üstte: dört kat hızlı', sens);
      // nişan: ekranın ortasından giden ışının değdiği canlı ya da yer
      await p.evaluate(() => { D3.state.pitch = 30 * Math.PI / 180; });
      const f1 = await p.evaluate(() => D3.state.frames);
      await frames(f1 + 2);
      const aim = await p.evaluate(() => {
        const P = G.player, K = D3.state.cam;
        P.updateAim(0.016, { x: 0, y: 0, m: 0 });
        const e = D3.state.aimEnt, want = e ? Math.atan2(e.y - P.y, e.x - P.x) : Math.atan2(K.f2[1], K.f2[0]);
        return { ang: P.aimAng, want, ent: !!e };
      });
      const da = Math.abs(Math.atan2(Math.sin(aim.ang - aim.want), Math.cos(aim.ang - aim.want)));
      t.ok(da < 0.05, 'nişan ekranın ortasından giden ışının yönünde', aim);
      // pencere (çanta) açılınca kilit bırakılır, kapanınca kendiliğinden geri gelir
      await p.keyboard.press('KeyI');
      await p.waitForFunction(() => UI.isModal() && !document.pointerLockElement && !D3.state.look, null, { timeout: 30000 });
      t.ok(true, 'pencere açılınca kilit bırakıldı');
      await p.evaluate(() => UI.closeAll());
      await p.waitForFunction(() => !UI.isModal() && document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      t.ok(true, 'pencere kapanınca kilit geri geldi');
      // ayarlar > Kontroller: fare hassasiyeti kaydırıcısı
      const row = await p.evaluate(() => { UI.openSettings(4, 'd3Sens'); const r = document.querySelector('.st-row[data-k="d3Sens"]'); const out = r ? r.textContent : null; UI.closeAll(); return out; });
      t.ok(row && /Hassasiyeti \(3B/.test(row), 'ayarlarda fare hassasiyeti satırı', row);
      await p.evaluate(() => document.exitPointerLock());
      await p.waitForFunction(() => !document.pointerLockElement && !D3.state.look, null, { timeout: 30000 });
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });

    await t.step('kilitsiz: nişan imlecin gösterdiği yere gider; yürüyüş ve işaretler perspektif görüntüye uyar', async () => {
      // 90°: kamera batıya bakar (ekranın sağı kuzey)
      await p.evaluate(() => { D3.state.yaw = Math.PI / 2; D3.state.pitch = 32 * Math.PI / 180; });
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 3);
      const aim = await p.evaluate(() => {
        const r = G.canvasRect(), P = G.player, k = r.width / G.vw;
        const q = D3.w2s(P.x, P.y - 40, D3.AIM_H);   // oyuncunun 40 birim kuzeyi, gövde hizasında
        const mx = Input.mouse.x, my = Input.mouse.y;
        Input.mouse.x = r.left + q[0] * k; Input.mouse.y = r.top + q[1] * k;
        P.updateAim(0.016, { x: 0, y: 0, m: 0 });
        const e = D3.state.aimEnt, want = e ? Math.atan2(e.y - P.y, e.x - P.x) : -Math.PI / 2;
        const out = { ang: P.aimAng, want, ent: !!e, q: [q[0], q[1]], look: D3.state.look };
        Input.mouse.x = mx; Input.mouse.y = my;
        return out;
      });
      const da = Math.abs(Math.atan2(Math.sin(aim.ang - aim.want), Math.cos(aim.ang - aim.want)));
      t.ok(!aim.look && aim.q[0] > 0 && da < 0.05, 'imleç ekranda sağda (kuzey) → nişan dünyada kuzeye', aim);
      const q0 = await p.evaluate(() => [G.player.x, G.player.y]);
      await p.keyboard.down('KeyW'); await t.sleep(700); await p.keyboard.up('KeyW');
      const q1 = await p.evaluate(() => [G.player.x, G.player.y]);
      const dx = q1[0] - q0[0], dy = q1[1] - q0[1];
      t.ok(dx < -1 && Math.abs(dy) < Math.abs(dx) / 3, 'W kameranın baktığı yöne (batıya) yürütür', { dx, dy });
      await p.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
      // atın üstündeki etkileşim belirteci atın başının görüntüdeki yerine kayar
      await p.evaluate(() => { const P = G.player, h = G.horse; if (h) { h.x = P.x - 18; h.y = P.y; h.vx = h.vy = 0; } });
      await p.waitForFunction(() => { for (const s of InteractMarks.st.values()) if (s.el && s.el._d3 && s.c && s.c.key === G.horse) return true; return false; }, null, { timeout: 30000 }).catch(() => {});
      const mk = await p.evaluate(() => {
        InteractMarks.update(0.016);   // konum ve kaydırma bu anın kamerası ve atıyla
        for (const s of InteractMarks.st.values()) {
          if (!s.el || !s.el._d3 || !s.c || s.c.key !== G.horse) continue;
          const num = (tr) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(tr); return m ? [+m[1], +m[2]] : null; };
          const o = num(s.el._d3.orig), n = num(s.el._d3.out), r = G.canvasRect(), k = r.width / G.vw;
          const fx = G.horse.x - G.cam.ox, fy = G.horse.y - G.cam.oy, q = D3.w2s(G.horse.x, G.horse.y, 30);
          return { d: [n[0] - o[0], n[1] - o[1]], want: q ? [(q[0] - fx) * k, (q[1] - fy) * k] : null };
        }
        return null;
      });
      t.ok(mk && mk.want && Math.abs(mk.d[0] - mk.want[0]) < 1.5 && Math.abs(mk.d[1] - mk.want[1]) < 1.5, 'belirteç atın başının görüntüdeki yerinde', mk);
      await p.evaluate(() => { D3.state.yaw = 0; D3.state.pitch = 11 * Math.PI / 180; });
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });

    await t.step('sınırlı alan: oyuncu (ve bindiği at) alanın dışına çıkamaz', async () => {
      const r = await p.evaluate(() => {
        const A = D3.state.area, P = G.player;
        P.x = A.px1 + 300; P.y = A.py0 - 300;
        return A;
      });
      await t.sleep(500);
      const q = await p.evaluate(() => ({ x: G.player.x, y: G.player.y }));
      t.ok(q.x <= r.px1 + 0.01 && q.y >= r.py0 - 0.01, 'oyuncu sınıra çekildi', { q, r });
      const m = await p.evaluate(() => {
        const P = G.player, h = G.horse, A = D3.state.area;
        if (!h) return null;
        P.x = (A.px0 + A.px1) / 2; P.y = (A.py0 + A.py1) / 2; h.x = P.x + 10; h.y = P.y; P.mount(h, true);
        h.x = A.px0 - 400; return A.px0;
      });
      if (m !== null) {
        await t.sleep(500);
        const hx = await p.evaluate(() => ({ h: G.horse.x, p: G.player.x, riding: !!G.player.riding }));
        t.ok(hx.riding && hx.h >= m - 0.01 && hx.p >= m - 0.01, 'binilen at da sınırda kalır', hx);
        await p.evaluate(() => { const P = G.player; if (P.riding && P.dismount) P.dismount(true); });
      }
    });

    await t.step('binaya girince bina kesitlenir (çatı gizli, ön duvar alçak); arkasında kalınca delinir', async () => {
      await p.evaluate(() => {
        // alanın tam içindeki bir bina (sahne alanın çevresindeki binaları da kurar; dışarıdakine giden oyuncu sınıra çekilir)
        const A = D3.state.area, P = G.player, b = G.world.buildings.find(b => b.enter && D3.state.scene.bparts.has(b.id) && b.x * 16 > A.px0 && (b.x + b.w) * 16 < A.px1 && b.y * 16 - 24 > A.py0 && (b.y + b.h) * 16 < A.py1);
        if (P.riding && P.dismount) P.dismount(true);
        P.x = b.door.x; P.y = (b.y + b.h - 2) * 16 + 4; window.__b = b.id;
      });
      await p.waitForFunction(() => G.insideB && G.insideB.id === window.__b && D3.state.scene.bparts.get(window.__b).cut, null, { timeout: 30000 });
      t.ok(true, 'içerideki binanın kesiti açık');
      await p.evaluate(() => { const b = G.world.buildings[window.__b], P = G.player; P.x = b.door.x; P.y = b.y * 16 - 14; });
      await p.waitForFunction(() => { const q = D3.state.scene.bparts.get(window.__b); return !q.cut && q.holeAll; }, null, { timeout: 30000 });
      t.ok(true, 'arkasındaki oyuncu için bina delinir');
    });

    await t.step('gece: pencereler ve lambalar yanar; kayıtlar ayrı', async () => {
      await p.evaluate(() => { G.clock = Math.floor(G.clock / 1440) * 1440 + 22 * 60; });
      const f = await p.evaluate(() => D3.state.frames);
      await frames(f + 3);
      const r = await p.evaluate(() => {
        G.saveGame(true);
        const lit = [...D3.state.scene.bparts.values()].filter(q => q.winLit).length;
        return { lit, keys: Object.keys(localStorage), errs: window.__errs, ok: D3.state.ok };
      });
      t.ok(r.lit > 0, 'gece pencereleri yanan bina var', r.lit);
      t.ok(r.keys.length > 0 && r.keys.every(k => k.startsWith('d3_')), 'bütün kayıt anahtarları d3_ ile başlar', r.keys);
      t.ok(r.ok, '3B çizim hatasız sürdü');
      t.eq(r.errs, [], 'konsol hatası yok');
    });
  },
};
