'use strict';
/* Kamera: binaya girince yumuşak yakınlaşma, çıkınca uzaklaşma; içeride kamera sabit (sahne titremez); yakınken fareyle
   nişan; piksel kamerası oyuncuya kilitli, hızlanıp yavaşlarken sahne geri sekmez; oyuncu ya da binek durunca kamera aynı
   karede durur (sonradan kaymaz); sığmayan binada oyuncuyu bina içinde izler */
module.exports = {
  name: 'Kamera yakınlaşması',
  async run(t) {
    const p = await t.newGame();
    const z = () => p.evaluate(() => ({ z: G.camZoom ? G.camZoom.z : 1, tf: G.canvas.style.transform, inside: !!G.insideB, cx: G.cam.x, cy: G.cam.y }));
    await t.step('dışarıda yakınlaşma yok', async () => {
      await p.evaluate(() => {
        G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
        const b = G.world.buildings.find(x => x.type === 'general' && x.town === 'harlow'); window.GB = b;
        TH.goto(b.door.x, b.door.y + 26); TH.clearNpcs(); G.player.ang = -Math.PI / 2;
      });
      await t.sleep(900);
      const r = await z();
      t.near(r.z, 1, 0.001, 'ölçek'); t.eq(r.tf, '', 'dönüşüm yok'); t.ok(!r.inside, 'dışarıda');
    });
    await t.step('yürüyerek girince kamera yumuşakça binaya yaklaşır ve binayı ortalar', async () => {
      // yük altında oyun saati gerçek zamandan yavaş akar: kapıdan girilene kadar yürünür (girince birkaç örnek daha),
      // yakınlaşma hedef ölçeğe oturana kadar örneklenir
      await p.keyboard.down('KeyW');
      const samples = [];
      let held = true, inK = -1;
      for (let k = 0; k < 120; k++) {
        await t.sleep(90);
        const s = await z(); samples.push(s.z);
        if (s.inside && inK < 0) inK = k;
        if (held && inK >= 0 && k - inK >= 3) { await p.keyboard.up('KeyW'); held = false; }
        if (inK >= 0 && k - inK >= 4 && s.z > 1.2 && Math.abs(s.z - samples[k - 1]) < 1e-6) break;
      }
      if (held) await p.keyboard.up('KeyW');
      await t.sleep(1000);
      const r = await p.evaluate(() => {
        const b = GB, Z = G.camZoom, bw = b.w * TS * Z.z, bh = (b.h + 1) * TS * Z.z;
        return { z: Z.z, inside: G.insideB === b, dx: Math.abs(G.cam.x - (b.x + b.w / 2) * TS), dy: Math.abs(G.cam.y - (b.y + b.h / 2) * TS), fillW: bw / G.vw, fillH: bh / G.vh, tf: G.canvas.style.transform, expect: G.zoomFor(b) };
      });
      t.ok(r.inside, 'içeride');
      t.ok(r.z > 1.2, 'yakınlaşmış olmalı', r.z); t.near(r.z, r.expect, 0.001, 'hedef ölçek');
      t.ok(/scale/.test(r.tf), 'tuval ölçeklenmeli');
      t.ok(Math.max(r.fillW, r.fillH) < 0.95 && Math.max(r.fillW, r.fillH) > 0.6, 'bina ekranı doldurmamalı ama büyük görünmeli', r);
      t.ok(r.dx < 12 && r.dy < 12, 'bina ortalanmalı', r);
      // geçiş kademeli olmalı: ara değerler görülmeli ve artarak gitmeli
      const mid = samples.filter(v => v > 1.02 && v < r.z - 0.02);
      t.ok(mid.length >= 2, 'yumuşak geçiş (ara değerler)', samples);
      t.ok(samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1e-6), 'geçiş geri dönmemeli', samples);
    });
    await t.step('yakınken fareyle nişan doğru yöne bakar', async () => {
      await p.evaluate(() => { const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; });
      const pt = await p.evaluate(() => {
        const P = G.player, r = G.canvas.getBoundingClientRect(), k = r.width / G.canvas.width;
        // oyuncunun 40 piksel sağındaki noktanın ekran konumu
        return { x: r.left + (P.x + 40 - G.cam.ox) * k, y: r.top + (P.y - G.cam.oy) * k };
      });
      await p.mouse.move(pt.x, pt.y); await t.sleep(250);
      const a = await p.evaluate(() => G.player.aimAng);
      t.near(a, 0, 0.12, 'sağa nişan');
    });
    await t.step('içeride kamera oyuncuyu izlemez: binanın ortasında durur, oyuncu yürürken sahne kıpırdamaz (60 ve 144 Hz)', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, C = G.cam, b = GB, x0 = P.x, y0 = P.y, cx = (b.x + b.w / 2) * TS, cy = (b.y + b.h / 2) * TS;
        // yük altında girişten sonraki kayma bitmemiş olabilir: kamera önce yerine oturur (en çok 10 sn'lik adım)
        for (let i = 0; i < 600 && (Math.abs(C.x - cx) > 0.001 || Math.abs(C.y - cy) > 0.001); i++) G.updateCamera(1 / 60);
        const out = { dx: Math.abs(C.x - cx), dy: Math.abs(C.y - cy) };
        for (const fps of [60, 144]) {
          const ox0 = C.ox, oy0 = C.oy;
          let moved = 0;
          for (let i = 0; i < fps * 3; i++) {
            const tt = i / fps;
            P.x = x0 + Math.sin(tt * 2) * 40; P.y = y0 + Math.cos(tt * 1.3) * 12;   // mağazada gezinir (piksel altı adımlarla)
            G.updateCamera(1 / fps);
            if (C.ox !== ox0 || C.oy !== oy0) moved++;
          }
          out[fps] = moved;
        }
        P.x = x0; P.y = y0; G.updateCamera(1 / 60);
        return out;
      });
      t.ok(r.dx < 0.01 && r.dy < 0.01, 'kamera binanın tam ortasında', r);
      t.eq(r[60], 0, '60 Hz: sahne kıpırdamaz'); t.eq(r[144], 0, '144 Hz: sahne kıpırdamaz');
    });
    await t.step('sarhoşken içeride hem sallantı hem yakınlaşma birlikte uygulanır', async () => {
      await p.evaluate(() => { G.player.drunk = 90; });
      await t.sleep(2500);
      const r = await p.evaluate(() => ({ tf: G.canvas.style.transform, z: G.camZoom.z }));
      t.ok(/scale\(1\.[2-9]/.test(r.tf) && /rotate/.test(r.tf), 'yakınlaşma ve dönme birlikte', r);
      await p.evaluate(() => { G.player.drunk = 0; FX.g.drunk = 0; });
      await t.sleep(400);
      t.ok(/^scale\(/.test(await p.evaluate(() => G.canvas.style.transform)), 'ayılınca yalnızca yakınlaşma kalır');
    });
    await t.step('çıkınca kamera aynı yumuşaklıkla uzaklaşır', async () => {
      await p.evaluate(() => { const P = G.player; P.x = GB.door.x; P.y = GB.door.y - 18; P.ang = Math.PI / 2; });
      // girişteki gibi: kapıdan çıkılana kadar yürünür, uzaklaşma 1'e oturana kadar örneklenir
      await p.keyboard.down('KeyS');
      const samples = [];
      let held = true, outK = -1;
      for (let k = 0; k < 120; k++) {
        await t.sleep(90);
        const s = await z(); samples.push(s.z);
        if (!s.inside && outK < 0) outK = k;
        if (held && outK >= 0 && k - outK >= 3) { await p.keyboard.up('KeyS'); held = false; }
        if (outK >= 0 && k - outK >= 4 && s.z === 1) break;
      }
      if (held) await p.keyboard.up('KeyS');
      await t.sleep(1000);
      const r = await z();
      t.ok(!r.inside, 'dışarıda'); t.near(r.z, 1, 0.001, 'ölçek 1'); t.eq(r.tf, '', 'dönüşüm kalktı');
      t.ok(samples.some(v => v > 1.02 && v < 1.9), 'kademeli uzaklaşma', samples);
    });
    await t.step('piksel kamerası oyuncuya kilitli: sabit hızda oyuncu ekranda titremez, zemin geri kaymaz (60 ve 144 Hz)', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, C = G.cam, x0 = P.x, y0 = P.y, out = { ds: G.ds };
        for (const fps of [60, 144]) {
          const dt = 1 / fps, v = 58;   // yürüyüş hızı (piksel/sn), kare başına piksel altı adım
          C.x = P.x = x0; C.y = P.y = y0;
          let prev = null, prevOx = null, jumps = 0, back = 0, n = 0;
          for (let i = 0; i < fps * 4; i++) {
            P.x += v * dt; G.updateCamera(dt);
            if (i < fps * 1.5) continue;              // kamera gecikmesi otursun
            const scr = Math.round(P.x) - C.ox;        // oyuncunun tuvaldeki pikseli
            if (prev !== null && scr !== prev) jumps++;
            if (prevOx !== null && C.ox < prevOx) back++;
            prev = scr; prevOx = C.ox; n++;
          }
          out[fps] = { jumps, back, n };
        }
        C.x = P.x = x0; C.y = P.y = y0; G.updateCamera(1 / 60);
        return out;
      });
      t.eq(r.ds, 1, 'klasik çizim (tek kat ızgara)');
      for (const fps of [60, 144]) {
        t.ok(r[fps].jumps <= 2, fps + ' Hz: oyuncu ekranda sıçramaz', r[fps]);
        t.eq(r[fps].back, 0, fps + ' Hz: zemin geri kaymaz');
      }
    });
    await t.step('durup kalkarken ve geri dönerken sahne yürüme yönünün tersine sekmez (klasik ve melez ızgara, 60 ve 144 Hz)', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, C = G.cam, x0 = P.x, y0 = P.y, ds0 = G.ds, out = {};
        for (const ds of [1, 2]) {
          G.ds = ds;
          for (const fps of [60, 144]) {
            for (const [name, plan] of [['durkalk', (tt) => ((tt % 1.5) < 1 ? 58 : 0)], ['donus', (tt) => (Math.floor(tt / 1.5) % 2 ? -58 : 58)]]) {
              C.x = P.x = x0; C.y = P.y = y0;
              let last = null, lastD = 0, back = 0;
              for (let i = 0; i < fps * 6; i++) {
                const dt = (1 / fps) * (1 + Math.sin(i * 1.7) * 0.08), v = plan(i / fps);   // dalgalı kare süresi (±%8)
                P.x += v * dt; G.updateCamera(dt);
                if (i < fps) continue;
                if (last !== null && C.ox !== last) { const d = Math.sign(C.ox - last); if (lastD && d !== lastD && Math.sign(v) === lastD) back++; lastD = d; }
                last = C.ox;
              }
              out[`${name} ${ds === 2 ? 'melez' : 'klasik'} ${fps} Hz`] = back;
            }
          }
        }
        G.ds = ds0; C.x = P.x = x0; C.y = P.y = y0; G.updateCamera(1 / 60);
        return out;
      });
      for (const k in r) t.eq(r[k], 0, k + ': sahne geri sekmez');
    });
    await t.step('yaya durunca kamera oyuncuyla aynı karede durur, kuyruk bırakmaz; oyuncu ekranda yerinde kalır (klasik ve melez, 60 ve 144 Hz)', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, C = G.cam, x0 = P.x, y0 = P.y, ds0 = G.ds, R0 = P.riding, out = {};
        P.riding = null;
        for (const ds of [1, 2]) {
          G.ds = ds; const q = ds === 2 ? 2 : 1, Rn = (v) => Math.round(v * q) / q;
          for (const fps of [60, 144]) {
            for (const v0 of [58, 88]) {   // yürüyüş ve koşu; bırakınca oyuncu gibi yavaşlar (Player: üstel, 9/sn)
              C.x = P.x = x0; C.y = P.y = y0;
              let v = v0, lastP = -1, lastO = -1, prevP = null, prevO = null, scr = new Set();
              for (let i = 0; i < fps * 5; i++) {
                const dt = 1 / fps;
                if (i >= fps * 2) { v *= Math.exp(-dt * 9); if (v < 1.5) v = 0; }
                P.x += v * dt; G.updateCamera(dt);
                const rp = Rn(P.x);
                if (prevP !== null && rp !== prevP) lastP = i;
                if (prevO !== null && C.ox !== prevO) lastO = i;
                if (i > fps * 0.5) scr.add(rp - C.ox);   // ilk karelerde kamera, başta konduğu yerden oyuncuya oturur
                prevP = rp; prevO = C.ox;
              }
              out[`${ds === 2 ? 'melez' : 'klasik'} ${fps} Hz ${v0}`] = { tail: lastO - lastP, scr: scr.size };
            }
          }
        }
        G.ds = ds0; P.riding = R0; C.x = P.x = x0; C.y = P.y = y0; G.updateCamera(1 / 60);
        return out;
      });
      for (const k in r) {
        t.ok(r[k].tail <= 0, k + ': oyuncu durduktan sonra sahne kaymaz', r[k]);
        t.eq(r[k].scr, 1, k + ': oyuncu ekranda hep aynı pikselde');
      }
    });
    await t.step('atlıyken: dörtnaldan durunca kamera atla birlikte durur; şahlanınca önden bakış sıçramadan döner (60 ve 144 Hz)', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, C = G.cam, x0 = P.x, y0 = P.y, R0 = P.riding, out = {};
        for (const fps of [60, 144]) {
          const dt = 1 / fps, H = { spd: 0, ang: 0, back: false };
          P.riding = H; C.x = P.x = x0; C.y = P.y = y0; G.updateCamera(dt);
          // kalkış (hız 100'e kadar: dörtnal uzaklaşması devreye girmesin), seyir, frenle duruş
          let lastP = -1, lastO = -1, prevO = null, lead = 0;
          for (let i = 0; i < fps * 7; i++) {
            const tt = i / fps;
            if (tt < 2) H.spd = Math.min(100, H.spd + 80 * dt);
            else if (tt >= 3.5) { H.spd = Math.max(0, H.spd - 200 * dt); if (H.spd < 2) H.spd = 0; }
            P.x += H.spd * dt; G.updateCamera(dt);
            if (tt > 3 && tt < 3.5) lead = C.x - P.x;
            if (H.spd > 0) lastP = i;   // at bu karede hâlâ ilerliyor (önden bakış payı da hızla birlikte kapanır)
            if (prevO !== null && C.ox !== prevO) lastO = i;
            prevO = C.ox;
          }
          // şahlanma: hız birden sıfırlanır; önden bakış yumuşakça geri gelir
          H.spd = 100; for (let i = 0; i < fps; i++) { P.x += H.spd * dt; G.updateCamera(dt); }
          H.spd = 0; let maxStep = 0, settle = -1, prev = C.ox;
          for (let i = 0; i < fps * 3; i++) { G.updateCamera(dt); const d = Math.abs(C.ox - prev); maxStep = Math.max(maxStep, d); if (d) settle = i; prev = C.ox; }
          out[fps] = { tail: lastO - lastP, lead: +lead.toFixed(1), maxStep, settle: +(settle / fps).toFixed(2), rest: +(C.x - P.x).toFixed(2) };
        }
        P.riding = R0; C.x = P.x = x0; C.y = P.y = y0; G.updateCamera(1 / 60);
        return out;
      });
      for (const fps of [60, 144]) {
        const o = r[fps];
        t.ok(o.tail <= 0, fps + ' Hz: at durduktan sonra sahne kaymaz', o);
        t.near(o.lead, 17, 0.3, fps + ' Hz: seyirde kamera gidilen yöne önden bakar (15 px/sn üstü hızın 0,2 katı)');
        t.ok(o.maxStep <= 3, fps + ' Hz: şahlanınca kamera sıçramaz', o);
        t.ok(o.settle >= 0 && o.settle < 2 && o.rest === 0, fps + ' Hz: şahlanınca kamera iki saniyede ata oturur', o);
      }
    });
    await t.step('gerçek tuşla: yürüyüp bırakınca sahne oyuncunun son adımında durur', async () => {
      await p.evaluate(() => {
        TH.goto(GB.door.x - 60, GB.door.y + 30); TH.clearNpcs(); G.player.ang = 0;
        window.__cl = [];
        if (!G.__camLog) { G.__camLog = true; const u = G.updateCamera; G.updateCamera = function (dt) { u.call(this, dt); if (window.__cl) window.__cl.push([this.player.x, this.cam.ox, Input.keys.has('KeyD') ? 1 : 0]); }; }
      });
      await t.sleep(600);
      await p.evaluate(() => { window.__cl = []; });
      await p.keyboard.down('KeyD'); await t.sleep(900); await p.keyboard.up('KeyD'); await t.sleep(1500);
      const L = await p.evaluate(() => { const l = window.__cl; window.__cl = null; return l; });
      const q = await p.evaluate(() => (G.ds === 2 ? 2 : 1)), Rn = (v) => Math.round(v * q) / q;
      let lastP = -1, lastO = -1;
      for (let i = 1; i < L.length; i++) { if (Rn(L[i][0]) !== Rn(L[i - 1][0])) lastP = i; if (L[i][1] !== L[i - 1][1]) lastO = i; }
      const up = L.findIndex((e, i) => i > 0 && L[i - 1][2] && !e[2]);
      t.ok(up > 0 && lastP > up, 'tuş bırakıldı, oyuncu yavaşlayarak durdu', { up, lastP, n: L.length });
      t.ok(lastO <= lastP, 'oyuncu durduktan sonra sahne kaymaz', { lastP, lastO });
    });
    await t.step('bina görünen alana sığmıyorsa (büyük piksel ölçeği) kamera oyuncuyu bina içinde izler, oyuncu ekranda kalır', async () => {
      await p.setViewportSize({ width: 1920, height: 600 });
      await t.sleep(300);
      const r = await p.evaluate(() => {
        G.settings.zoom = 5; G.resize();
        const b = GB, P = G.player; TH.clearNpcs();
        P.x = b.door.x; P.y = b.door.y - 20;
        for (let i = 0; i < 150; i++) G.update(1 / 60);
        const Z = G.camZoom, visH = G.vh / G.os / Z.out, out = { inside: G.insideB === b, fits: (b.h + 1) * TS <= visH };
        const top = (b.y + 1) * TS + 8, bot = (b.y + b.h - 1) * TS;
        let minM = 1e9, outside = 0, follow = 0, last = null;
        for (let i = 0; i < 240; i++) {
          P.y = top + (bot - top) * (i < 120 ? i / 119 : (239 - i) / 119);
          G.updateCamera(1 / 60);
          minM = Math.min(minM, visH / 2 - Math.abs(P.y - G.cam.oy - G.vh / 2));   // oyuncunun görünen alanın kenarına uzaklığı
          if (G.cam.y - visH / 2 < Z.cy - Z.bh / 2 - 0.5 || G.cam.y + visH / 2 > Z.cy + Z.bh / 2 + 0.5) outside++;
          if (last !== null && G.cam.oy !== last) follow++;
          last = G.cam.oy;
        }
        G.settings.zoom = 0;
        return Object.assign(out, { minM: Math.round(minM), outside, follow });
      });
      await p.setViewportSize({ width: 1280, height: 720 });
      t.ok(r.inside && !r.fits, 'mağaza bu ölçekte görünen alana sığmamalı', r);
      t.ok(r.follow > 5, 'kamera oyuncuyu dikeyde izlemeli', r);
      t.ok(r.minM > 8, 'oyuncu ekranda kalmalı', r);
      t.eq(r.outside, 0, 'kamera binanın dışını göstermez');
    });
  },
};
