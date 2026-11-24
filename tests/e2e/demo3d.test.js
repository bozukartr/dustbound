'use strict';
/* 3B test paketi (npm run build:demo3d): paket kurulur, tarayıcıda hatasız açılır; Çiftçi Çocuğu ile Harlow'da
   hikâyesiz başlanır, dünya 3B çizilir (2D arayüz üstünde), oyuncu sınırlı alanda kalır, F3 3B ile 2D arasında
   geçer, [ ve ] saati değiştirir; fare kendiliğinden bakış yönüdür (kilitsizken de döndürür), tuşa basınca kilitlenir,
   nişan ekranın tepesine kadar çıkar (kamera öne kayar), hassasiyet ayarı çalışır, pencere ve Esc'te kilit bırakılıp
   kapanınca geri gelir; yürüyüş ve işaretler eğik görüntüye uyar; oyuncu binaya girince bina kesitlenir, kayıtlar
   ayrı tutulur.
   Depodaki tam oyun bu testten etkilenmez. */
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
module.exports = {
  name: '3B test paketi',
  timeout: 420000,
  async run(t) {
    const errInit = () => { window.__d3Soft = true; window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; };
    let p;
    const frames = (n) => p.waitForFunction((n) => D3.state.frames >= n, n, { timeout: 60000 });

    await t.step('paket kurulur: 3B çizim oyunda, demo katmanı main.js\'ten önce, geliştirici aracı yok', async () => {
      execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-demo3d.js')], { cwd: ROOT, stdio: 'pipe' });
      const D = path.join(ROOT, 'dist-demo3d');
      t.ok(fs.existsSync(path.join(ROOT, 'dist-demo3d.zip')), 'zip hazır');
      const html = fs.readFileSync(path.join(D, 'index.html'), 'utf8');
      t.ok(/js\/gl3d\.js[\s\S]*js\/models3d\.js[\s\S]*js\/scene3d\.js[\s\S]*js\/view3d\.js[\s\S]*demo3d\/demo\.js[\s\S]*js\/main\.js/.test(html), 'betik sırası', html.match(/<script[^>]*>/g).slice(-7));
      t.ok(!/debug\.js/.test(html) && !fs.existsSync(path.join(D, 'js', 'debug.js')), 'geliştirici aracı pakette yok');
      t.ok(/3D Test<\/title>/.test(html), 'pencere başlığı');
      const rh = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      t.ok(fs.existsSync(path.join(ROOT, 'js', 'debug.js')) && /js\/view3d\.js/.test(rh) && !/demo3d/.test(rh), 'depodaki oyun 3B çizimi yükler, demo katmanını yüklemez');
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
        return { ok: S.ok, on: G.settings.gfx === 2, town: A && A.town, inside: A && P.x >= A.px0 && P.x <= A.px1 && P.y >= A.py0 && P.y <= A.py1, w: A && A.x1 - A.x0, h: A && A.y1 - A.y0,
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
      const a = await p.evaluate(() => ({ on: G.settings.gfx === 2, f: D3.state.frames }));
      await t.sleep(800);
      const a2 = await p.evaluate(() => D3.state.frames);
      t.ok(!a.on && a2 === a.f, '2D: 3B kareler durur', { a, a2 });
      await p.keyboard.press('F3');
      await frames(a2 + 2);
      t.ok(await p.evaluate(() => G.settings.gfx === 2 && !G.hy), 'yeniden 3B');
      const h0 = await p.evaluate(() => G.hour);
      await p.keyboard.press('BracketRight'); await t.sleep(200);
      const h1 = await p.evaluate(() => G.hour);
      await p.keyboard.press('BracketLeft'); await t.sleep(200);
      const h2 = await p.evaluate(() => G.hour);
      t.ok(Math.abs(((h1 - h0 + 24) % 24) - 1) < 0.1 && Math.abs(((h1 - h2 + 24) % 24) - 1) < 0.1, 'saat bir saat ileri ve geri', [h0, h1, h2]);
    });

    await t.step('fare kendiliğinden bakış: kilitsizken de döndürür, tuşla kilitlenir, nişan ekranın tepesine çıkar, hassasiyet', async () => {
      // oyuna girişte kilit kendiliğinden denenmiş olabilir: önce (katmanın kendi bırakışı gibi) bırak
      await p.evaluate(() => { D3.state.look = false; if (document.pointerLockElement) document.exitPointerLock(); });
      await p.waitForFunction(() => !document.pointerLockElement, null, { timeout: 30000 });
      t.eq(await p.evaluate(() => G.canvas.style.cursor), 'none', '3B oyunda imleç görünmez');
      // başsız tarayıcı fare hareketini olay olarak verir (movementX/Y); kilitsizken de kamera döner, tıklama gerekmez
      const mv = (dx, dy) => p.evaluate(([dx, dy]) => G.canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true })), [dx, dy]);
      await p.evaluate(() => { G.settings.d3Sens = 0.5; D3.state.yaw = 0; });
      await mv(120, 0);
      const y1 = await p.evaluate(() => ({ yaw: D3.state.yaw, look: D3.state.look }));
      t.ok(!y1.look && y1.yaw < -0.3, 'kilitsiz: fare sağa → kamera sağa döner', y1);
      await p.waitForTimeout(800);
      await p.keyboard.press('KeyC');   // çömel (zararsız bir tuş): kilit bir sonraki karede istenir
      await p.waitForFunction(() => document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      await p.keyboard.press('KeyC');
      t.ok(true, 'tuşa basınca fare kilitlendi');
      // tam tur: sınır yok
      const step = await p.evaluate(() => D3.LOOK_YAW * D3.sensMul());
      const y0 = await p.evaluate(() => D3.state.yaw);
      let left = Math.round(Math.PI * 2 / step);
      while (left > 0) { const d = Math.min(300, left); await mv(d, 0); left -= d; }
      const y2 = await p.evaluate(() => D3.state.yaw);
      t.ok(Math.abs(Math.atan2(Math.sin(y2 - y0), Math.cos(y2 - y0))) < 0.02, 'tam tur dönünce başa gelir (360°)', { y0, y2 });
      // nişan: fare ileri → ekranın tepesine kadar çıkar, kamera öne kayar (oyuncu ekranın altına iner)
      const la0 = await p.evaluate(() => D3.state.cam.la);
      for (let i = 0; i < 12; i++) await mv(0, -300);
      // kamera öne kayması yumuşak: yazılımla çizen (yavaş) tarayıcıda oturması birkaç saniye sürebilir
      await p.waitForFunction(() => { const P = G.player, S = D3.state, K = S.cam, a = D3.w2s(P.x + K.fx * S.aim, P.y + K.fy * S.aim, 0); return Math.abs(a[1] / G.vh - 0.12) < 0.03; }, null, { timeout: 15000 }).catch(() => {});
      const top = await p.evaluate(() => {
        const P = G.player, S = D3.state, K = S.cam;
        const a = D3.w2s(P.x + K.fx * S.aim, P.y + K.fy * S.aim, 0), pl = D3.w2s(P.x, P.y, 0);
        return { aim: S.aim, ay: a[1] / G.vh, py: pl[1] / G.vh, la: K.la };
      });
      t.ok(Math.abs(top.ay - 0.12) < 0.03, 'nişan ekranın tepesinde', top);
      t.ok(top.py > 0.8 && top.py < 0.9 && top.la > la0 + 40, 'kamera öne kaydı: oyuncu ekranın altında', { top, la0 });
      // nişanın düz 2D karşılığı oyunun hesabına gider: yön kameranın baktığı yön, uzaklık silahın menziliyle sınırlı
      const aim = await p.evaluate(() => {
        const P = G.player, S = D3.state, K = S.cam;
        P.updateAim(0.016, { x: 0, y: 0, m: 0 });
        return { ang: P.aimAng, want: Math.atan2(K.fy, K.fx), d: P.aimDist, wantD: Math.min(Math.max(S.aim, 14), (P.W && P.W.range) || 200) };
      });
      const da = Math.abs(Math.atan2(Math.sin(aim.ang - aim.want), Math.cos(aim.ang - aim.want)));
      t.ok(da < 0.02 && Math.abs(aim.d - aim.wantD) < 1, 'nişan kameranın baktığı yönde, nişan uzaklığında', aim);
      for (let i = 0; i < 12; i++) await mv(0, 300);
      await p.waitForTimeout(1200);
      const low = await p.evaluate(() => ({ aim: D3.state.aim, min: D3.AIM_MIN, la: D3.state.cam.la }));
      t.ok(low.aim === low.min && Math.abs(low.la - la0) < 8, 'fare geri: nişan oyuncunun önüne iner, kamera geri gelir', { low, la0 });
      // hassasiyet: ayar en üstteyken aynı hareket dört kat döndürür ve taşır
      const sens = await p.evaluate(() => {
        const S = D3.state, ev = (dx, dy) => G.canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true }));
        const turn = (dx) => { const y0 = S.yaw; ev(dx, 0); return Math.abs(Math.atan2(Math.sin(S.yaw - y0), Math.cos(S.yaw - y0))); };
        const push = (dy) => { const a0 = S.aim; ev(0, dy); return S.aim - a0; };
        G.settings.d3Sens = 0.5; const a = turn(40), pa = push(-20);
        G.settings.d3Sens = 1; const b = turn(40), pb = push(-20);
        G.settings.d3Sens = 0.5;
        return { a, b, pa, pb };
      });
      t.ok(Math.abs(sens.b / sens.a - 4) < 0.05 && Math.abs(sens.pb / sens.pa - 4) < 0.05, 'hassasiyet en üstte: dört kat', sens);
      // pencere (çanta) açılınca kilit bırakılır ve imleç görünür, kapanınca kilit kendiliğinden geri gelir
      await p.keyboard.press('KeyI');
      await p.waitForFunction(() => UI.isModal() && !document.pointerLockElement && !D3.state.look && G.canvas.style.cursor === '', null, { timeout: 30000 });
      t.ok(true, 'pencere açılınca kilit bırakıldı, imleç göründü');
      await p.evaluate(() => UI.closeAll());
      await p.waitForFunction(() => !UI.isModal() && document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      t.ok(true, 'pencere kapanınca kilit geri geldi');
      // Esc (tarayıcı kilidi bırakır): oyun bir pencere açmadıysa duraklat menüsü açılır; kapanınca kilit geri gelir
      await p.waitForTimeout(800);
      await p.evaluate(() => document.exitPointerLock());
      await p.waitForFunction(() => UI.isModal() && document.body.classList.contains('paused'), null, { timeout: 30000 });
      t.ok(true, 'kilit bırakılınca duraklat menüsü açıldı');
      await p.evaluate(() => UI.closeAll());
      await p.waitForFunction(() => !UI.isModal() && document.pointerLockElement === G.canvas && D3.state.look, null, { timeout: 30000 });
      t.ok(true, 'duraklat menüsü kapanınca kilit geri geldi');
      // ayarlar > Kontroller: fare hassasiyeti kaydırıcısı
      const row = await p.evaluate(() => { UI.openSettings(4, 'd3Sens'); const r = document.querySelector('.st-row[data-k="d3Sens"]'); const out = r ? r.textContent : null; UI.closeAll(); return out; });
      t.ok(row && /Hassasiyeti \(3B/.test(row), 'ayarlarda fare hassasiyeti satırı', row);
      await p.evaluate(() => { D3.state.look = false; document.exitPointerLock(); });
      await p.waitForFunction(() => !document.pointerLockElement, null, { timeout: 30000 });
      t.ok(/Fare: bakış ve nişan/.test(await p.evaluate(() => document.getElementById('d3-badge').textContent)), 'işaret fare kontrolünü anlatır');
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });

    await t.step('yürüyüş kameraya göre; işaretler eğik görüntüye uyar', async () => {
      // 90°: ekranın yukarısı dünyada batı
      await p.evaluate(() => { D3.state.yaw = Math.PI / 2; });
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 2);
      const q0 = await p.evaluate(() => [G.player.x, G.player.y]);
      await p.keyboard.down('KeyW'); await t.sleep(700); await p.keyboard.up('KeyW');
      const q1 = await p.evaluate(() => [G.player.x, G.player.y]);
      const dx = q1[0] - q0[0], dy = q1[1] - q0[1];
      t.ok(dx < -1 && Math.abs(dy) < Math.abs(dx) / 3, 'W ekranda yukarı → dünyada batıya yürür', { dx, dy });
      await p.evaluate(() => { D3.state.look = false; if (document.pointerLockElement) document.exitPointerLock(); });
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

    await t.step('3B ayrıntılar: bacadan duman, bayrak ve çamaşır, parçacık yüksekliği, zemin izleri, bulut gölgesi, dönen radar', async () => {
      await p.evaluate(() => { D3.state.look = false; if (document.pointerLockElement) document.exitPointerLock(); D3.state.yaw = 0; G.clock = Math.floor(G.clock / 1440) * 1440 + 8 * 60; G.settings.clouds = 1; });
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 4);
      await p.waitForTimeout(2500);
      const r = await p.evaluate(() => {
        const S = D3.state, parts = [...S.scene.bparts.values()];
        const flagB = parts.filter(q => ['sheriff', 'county', 'station', 'bank'].includes(q.b.type)), washB = parts.filter(q => q.b.type === 'laundry' || (q.b.type === 'house' && hash2(q.b.x, q.b.y, 61) < 0.35));
        // parçacık: doğduğu yükseklik ve yükselme payı kaydedilir, yükselme ayrıca toplanır
        const P = G.player, e = G.parts.add('ember', P.x, P.y, 0, -10, 1, 1), h0 = e && e.h0, rv = e && e.rv;
        G.parts.update(0.1);
        return {
          flags: [flagB.length, flagB.filter(q => q.flag).length], wash: [washB.length, washB.filter(q => q.laundry).length], chim: parts.filter(q => q.chimney).length,
          smoke: FX.smoke.filter(q => q.h0 > 25).length, ember: { h0, rv, ry: e && e.ry },
          decal: S.view && S.view.decal, tex: !!D3.renderer.decalTex, cloud: S.view && S.view.cloud, wind: G.weather && G.weather.cloud,
          flagMesh: [...S.meshes.keys()].some(k => k.startsWith('flag|')), flagNear: flagB.some(q => q.flag && S.nearFn(q.flag[0], q.flag[1], 40) && !q.cut),
        };
      });
      t.ok(r.flags[0] === r.flags[1] && r.wash[0] === r.wash[1] && r.chim > 0, 'bayrak direği, çamaşır ipi ve bacalar sahnede', r);
      t.ok(r.smoke > 0, 'sabah bacalar 3B bacanın tepesinden tüter', r.smoke);
      t.ok(r.ember.h0 === 4 && r.ember.rv === -10 && r.ember.ry < -0.5, 'kıvılcım yerden yükseklikle doğar ve yükselir', r.ember);
      t.ok(r.tex && r.decal && r.decal[2] === 1024, 'zemin izleri dokusu yüklendi', r.decal);
      t.ok(!r.flagNear || r.flagMesh, 'görünen bayrak 3B kumaş olarak çizilir', r);
      // bulut gölgesi öğlen, ayar açıkken
      const cl = await p.evaluate(async () => {
        G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60; if (G.weather) G.weather.cloud = 0.3;
        const f = D3.state.frames; await new Promise(res => { const k = () => D3.state.frames >= f + 2 ? res() : requestAnimationFrame(k); k(); });
        return D3.state.view.cloud;
      });
      t.ok(cl && cl[2] > 0.1 && cl[3] > 0.2, 'gündüz bulut gölgesi dünyaya düşer', cl);
      // radar kameraya göre döner: kuzey harfi (kırmızı daire) kameranın dönüşüyle yer değiştirir
      const rad = await p.evaluate(() => {
        const out = {};
        // harfin çevresindeki kırmızı daire (ortası harfin kendisi): 4,4 birim yarıçapta sekiz noktadan en az ikisi kırmızı
        const red = (x, y) => { let n = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, d = UI.rctx.getImageData(Math.round((x + Math.cos(a) * 4.4) * 2), Math.round((y + Math.sin(a) * 4.4) * 2), 1, 1).data; if (d[0] > 110 && d[1] < 70 && d[2] < 60) n++; } return n >= 2; };
        for (const [k, yaw] of [['n', 0], ['w', Math.PI / 2]]) {
          D3.state.yaw = yaw; UI.drawRadar();
          const a = -Math.PI / 2 + D3.radarRot(), x = 112 + Math.cos(a) * 105.6, y = 112 + Math.sin(a) * 105.6;
          out[k] = { rot: D3.radarRot(), at: red(x, y), top: red(112, 112 - 105.6) };
        }
        D3.state.yaw = 0; UI.drawRadar();
        return out;
      });
      t.ok(rad.n.at && rad.n.top && Math.abs(rad.w.rot - Math.PI / 2) < 1e-6 && rad.w.at && !rad.w.top, 'radar döner: kuzey işareti kameraya göre yer değiştirir', rad);
      t.eq(await p.evaluate(() => window.__errs), [], 'konsol hatası yok');
    });

    await t.step('raylar ve tren 3B: vagonlar rayın üstünde çizilir, lokomotif dumanı bacadan yükselir', async () => {
      const r = await p.evaluate(() => {
        const S = D3.state, A = S.area, W = G.world;
        if (!W.lines.length) return { none: true };
        // alana en yakın ray noktası; test için alan oraya kadar genişletilir
        let best = null, bd = 1e9, li = 0;
        W.lines.forEach((L, k) => L.pts.forEach((q, i) => { const d = Math.hypot(q[0] - clamp(q[0], A.px0, A.px1), q[1] - clamp(q[1], A.py0, A.py1)); if (d < bd) { bd = d; best = [q[0], q[1], i]; li = k; } }));
        window.__A0 = Object.assign({}, A);
        A.px0 = Math.min(A.px0, best[0] - 200); A.px1 = Math.max(A.px1, best[0] + 200); A.py0 = Math.min(A.py0, best[1] - 200); A.py1 = Math.max(A.py1, best[1] + 200);
        const L = W.lines[li], pts = L.pts, q0 = pts[Math.max(0, best[2] - 4)], q1 = pts[Math.min(pts.length - 1, best[2] + 4)], ux = q1[0] - q0[0], uy = q1[1] - q0[1], ul = Math.hypot(ux, uy) || 1;
        const P = G.player; P.x = best[0] + uy / ul * 24; P.y = best[1] - ux / ul * 24;
        if (W.indoorPx(P.x, P.y) || W.blocked(P.x, P.y, 4)) { P.x = best[0] - uy / ul * 24; P.y = best[1] + ux / ul * 24; }
        const tr = G.trains.find(x => x.line === L);
        tr.s = L.cum[best[2]] + 40; tr.wait = 60; tr.spd = 0; tr.dir = 1; tr.update(0.016);
        window.__tr = tr;
        return { bd };
      });
      if (r.none) { t.ok(true, 'dünyada demiryolu yok'); return; }
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(f0 + 3);
      // akışlı sahne: rayın parçası ışınlanınca kurulur
      await p.waitForFunction(() => D3.state.scene.parts.some(q => q.rails), null, { timeout: 60000 });
      t.ok(true, 'raylar sahnede');
      const tr = await p.evaluate(() => {
        const S = D3.state, tr = window.__tr, q = tr.pos[0], s = D3.w2s(q[0], q[1], 10);
        // duman: lokomotifin bacasından (yerden ~21 birim) yükselen parçacık
        tr.smokeT = 0; tr.update(0.016);
        const sm = G.parts.list.filter(p => p.type === 'smoke' && p.h0 === 21);
        return { mesh: ['loco', 'tender', 'pass', 'freight'].every(k => S.meshes.has('train|' + k)), on: s[0] > 0 && s[0] < G.vw && s[1] > 0 && s[1] < G.vh, smoke: sm.length, dy: sm[0] && sm[0].dy0 };
      });
      t.ok(tr.mesh, 'lokomotif, kömür, yolcu ve yük vagonu 3B', tr);
      t.ok(tr.on, 'lokomotif görüntüde', tr);
      t.ok(tr.smoke > 0 && tr.dy === 6, 'duman bacanın yüksekliğinden çıkar', tr);
      await p.evaluate(() => { window.__tr.wait = 0; const A = Object.assign(D3.state.area, window.__A0), P = G.player; P.x = (A.px0 + A.px1) / 2; P.y = (A.py0 + A.py1) / 2; });   // alan eski hâline
      await frames(f0 + 6);
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
