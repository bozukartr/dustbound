'use strict';
/* 3B test paketi (npm run build:demo3d): paket kurulur, tarayıcıda hatasız açılır; Çiftçi Çocuğu ile Harlow'da
   hikâyesiz başlanır, dünya 3B çizilir (2D arayüz üstünde), oyuncu sınırlı alanda kalır, F3 3B ile 2D arasında
   geçer, [ ve ] saati değiştirir, tıklayınca fare kilitlenir (o tıklama ateş etmez) ve kamerayı döndürüp eğer, nişan
   kameranın baktığı yöndedir, pencere açılınca kilit bırakılıp kapanınca geri gelir; kilitsizken nişan imlecin gösterdiği
   yere gider, yürüyüş ve işaretler eğik görüntüye uyar; oyuncu binaya girince bina kesitlenir, kayıtlar ayrı tutulur.
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

    await t.step('fareyle bakış: tıklama fareyi kilitler (ateş etmez), fare kamerayı döndürür ve eğer, nişan baktığı yönde', async () => {
      await p.evaluate(() => { window.__md = 0; window.addEventListener('mousedown', () => window.__md++); });
      const r0 = await p.evaluate(() => { const r = G.canvasRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 }; });
      await p.mouse.click(r0.x, r0.y);
      await p.waitForFunction(() => document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      const c = await p.evaluate(() => ({ md: window.__md, b: Input.mouse.b.slice(), badge: document.getElementById('d3-badge').textContent }));
      t.ok(c.md === 0 && !c.b[0], 'kilitleyen tıklama oyuna gitmez', c);
      t.ok(/Esc/.test(c.badge), 'işaret kilitli hâli anlatır', c.badge);
      // başsız tarayıcı kilitliyken fare hareketini olay olarak verir (movementX/Y)
      const mv = (dx, dy) => p.evaluate(([dx, dy]) => G.canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true })), [dx, dy]);
      const s0 = await p.evaluate(() => ({ yaw: D3.state.yaw, pitch: D3.state.pitch }));
      await mv(150, 0);
      const s1 = await p.evaluate(() => ({ yaw: D3.state.yaw, pitch: D3.state.pitch }));
      t.ok(s1.yaw < s0.yaw - 0.3 && s1.pitch === s0.pitch, 'fare sağa: kamera sağa döner', { s0, s1 });
      await mv(0, -300); await mv(0, -300);
      const s2 = await p.evaluate(() => ({ pitch: D3.state.pitch, min: D3.P_MIN }));
      t.ok(Math.abs(s2.pitch - s2.min) < 1e-6, 'fare ileri: kamera alçalır (en alçak eğimde durur)', s2);
      await mv(0, 300); await mv(0, 300); await mv(0, 300);
      const s3 = await p.evaluate(() => ({ pitch: D3.state.pitch, max: D3.P_MAX }));
      t.ok(Math.abs(s3.pitch - s3.max) < 1e-6, 'fare geri: kamera dikleşir (en dik eğimde durur)', s3);
      await mv(0, -250);
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 2);
      // nişan kameranın baktığı yönde, önden bakış payı uzaklığında; kilitliyken oyunun fare konumu (clientX) yazılmaz
      const aim = await p.evaluate(() => {
        const P = G.player, K = D3.state.cam;
        P.updateAim(0.016, { x: 0, y: 0, m: 0 });
        // oyun nişan uzaklığını silahın menziliyle sınırlar (yumrukta kısa)
        return { ang: P.aimAng, want: Math.atan2(-K.c, -K.s), d: P.aimDist, wantD: Math.min(Math.max(K.laAim, 14), (P.W && P.W.range) || 200) };
      });
      const da = Math.abs(Math.atan2(Math.sin(aim.ang - aim.want), Math.cos(aim.ang - aim.want)));
      t.ok(da < 0.02 && Math.abs(aim.d - aim.wantD) < 1, 'nişan kameranın baktığı yönde', aim);
      // pencere (çanta) açılınca kilit bırakılır, kapanınca kendiliğinden geri gelir
      await p.keyboard.press('KeyI');
      await p.waitForFunction(() => UI.isModal() && !document.pointerLockElement && !D3.state.look, null, { timeout: 30000 });
      t.ok(true, 'pencere açılınca kilit bırakıldı');
      await p.evaluate(() => UI.closeAll());
      await p.waitForFunction(() => !UI.isModal() && document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      t.ok(true, 'pencere kapanınca kilit geri geldi');
      await p.evaluate(() => document.exitPointerLock());
      await p.waitForFunction(() => !document.pointerLockElement && !D3.state.look, null, { timeout: 30000 });
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });

    await t.step('kilitsiz: nişan imlecin gösterdiği yere gider; yürüyüş ve işaretler eğik görüntüye uyar', async () => {
      // 90°: ekranın yukarısı dünyada batı, sağı kuzey
      await p.evaluate(() => { D3.state.yaw = Math.PI / 2; D3.state.pitch = 38 * Math.PI / 180; });
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 2);
      const aim = await p.evaluate(() => {
        const r = G.canvasRect(), P = G.player, k = r.width / G.vw;
        const q = D3.w2s(P.x, P.y - 60, D3.AIM_H);   // oyuncunun 60 birim kuzeyi, gövde hizasında
        const mx = Input.mouse.x, my = Input.mouse.y;
        Input.mouse.x = r.left + q[0] * k; Input.mouse.y = r.top + q[1] * k;
        P.updateAim(0.016, { x: 0, y: 0, m: 0 });
        const out = { ang: P.aimAng, d: P.aimDist, wantD: Math.min(60, (P.W && P.W.range) || 200), q, look: D3.state.look };
        Input.mouse.x = mx; Input.mouse.y = my;
        return out;
      });
      t.ok(!aim.look && Math.abs(aim.ang + Math.PI / 2) < 0.03 && Math.abs(aim.d - aim.wantD) < 1.5, 'imleç ekranda sağda (kuzey) → nişan dünyada kuzeye', aim);
      const q0 = await p.evaluate(() => [G.player.x, G.player.y]);
      await p.keyboard.down('KeyW'); await t.sleep(700); await p.keyboard.up('KeyW');
      const q1 = await p.evaluate(() => [G.player.x, G.player.y]);
      const dx = q1[0] - q0[0], dy = q1[1] - q0[1];
      t.ok(dx < -1 && Math.abs(dy) < Math.abs(dx) / 3, 'W ekranda yukarı → dünyada batıya yürür', { dx, dy });
      // atın üstündeki etkileşim belirteci atın görüntüdeki yerine kayar (başın üstündeki pay korunur)
      await p.evaluate(() => { const P = G.player, h = G.horse; if (h) { h.x = P.x + 16; h.y = P.y; h.vx = h.vy = 0; } });
      await p.waitForFunction(() => { for (const s of InteractMarks.st.values()) if (s.el && s.el._d3 && s.c && s.c.key === G.horse) return true; return false; }, null, { timeout: 30000 }).catch(() => {});
      const mk = await p.evaluate(() => {
        InteractMarks.update(0.016);   // konum ve kaydırma bu anın kamerası ve atıyla
        for (const s of InteractMarks.st.values()) {
          if (!s.el || !s.el._d3 || !s.c || s.c.key !== G.horse) continue;
          const num = (tr) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(tr); return m ? [+m[1], +m[2]] : null; };
          const o = num(s.el._d3.orig), n = num(s.el._d3.out), r = G.canvasRect(), k = r.width / G.vw;
          const fx = G.horse.x - G.cam.ox, fy = G.horse.y - G.cam.oy, q = D3.w2s(G.horse.x, G.horse.y);
          return { d: [n[0] - o[0], n[1] - o[1]], want: [(q[0] - fx) * k, (q[1] - fy) * k] };
        }
        return null;
      });
      t.ok(mk && Math.abs(mk.d[0] - mk.want[0]) < 1.5 && Math.abs(mk.d[1] - mk.want[1]) < 1.5, 'belirteç atın görüntüdeki yerinde', mk);
      await p.evaluate(() => { D3.state.yaw = 0; });
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
        const P = G.player, b = G.world.buildings.find(b => b.enter && D3.state.scene.bparts.has(b.id) && b.x * 16 > D3.state.area.px0 && (b.x + b.w) * 16 < D3.state.area.px1);
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
