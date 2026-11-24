'use strict';
/* 3B çizim tam oyunda (js/gl3d.js, models3d.js, scene3d.js, view3d.js): Ayarlar → Grafik → Çizim Yöntemi'nde Melez ve
   Klasik'in yanında 3B seçeneği; seçilince dünya 3B çizilir (tuval yoğunluğu 1, melez kapalı), Kontroller'deki 3B fare
   hassasiyeti satırı etkinleşir, radar kamerayla döner. Ekran kartı yoksa (tarayıcı yazılımla çiziyor) 3B açılmaz:
   ayar geri döner ve bildirilir. Sahne akışlıdır: kameranın çevresindeki parçalar kurulur, uzaklaşanlar atılır; dünya
   değişince ilgili parça yeniden kurulur. Her dış nesne türünün, uçurumun, köprünün ve otomobilin 3B modeli var; toplanan
   ot kaybolur, kışın zemin karlanır, elektrik telleri direklere bağlanır. Bina içi ve otelin üst katı (iç duvarlar, oda
   kapıları, merdiven boşluğu, kilitli odaların örtüsü), dürbün, harita ve ölüm ekranı hatasız; kayıt yüklenince sahne
   yeni dünyayla kurulur; Melez'e dönünce 3B çizim durur.
   Test tarayıcısı ekran kartsız (yazılımla) çizer: 3B kare orada yaklaşık bir saniye sürer, test bu yüzden az kare bekler. */
module.exports = {
  name: '3B çizim (tam oyun)',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    // 3B çizim hatası (ekran kartı) ya da parça kurulamazsa view3d uyarı yazar: test bunları da hata sayar
    const warns = [];
    p.on('console', (m) => { if (m.type() === 'warning' && /3B/.test(m.text())) warns.push(m.text()); });
    const frames = (n) => p.evaluate((n) => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const look = () => p.evaluate(() => {
      const c = G.ctx.getImageData(0, 0, G.canvas.width, G.canvas.height).data; let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < c.length; i += 16) { const v = (c[i] + c[i + 1] + c[i + 2]) / 3; s += v; s2 += v * v; n++; }
      const mean = s / n; return { mean, sd: Math.sqrt(s2 / n - mean * mean) };
    });
    await p.evaluate(() => {
      UI.closeAll();
      G.clock = Math.floor(G.clock / 1440) * 1440 + 13 * 60;
      G.weather = { type: 'clear', t: 99999, i: 0, cloud: 0, fogI: 0 };
      window.HOME = [G.player.x, G.player.y];
    });

    await t.step('ekran kartı yoksa (yazılım çizimi) 3B açılmaz: ayar geri döner ve bildirilir', async () => {
      // çiziciyle aynı yoklama: büyük başarım kaybı uyarısı ya da çizicinin adı (SwiftShader, llvmpipe...)
      const soft = await p.evaluate(() => {
        const c = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
        if (!c) return true;
        const ri = c.getExtension('WEBGL_debug_renderer_info');
        return !!ri && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(c.getParameter(ri.UNMASKED_RENDERER_WEBGL));
      });
      if (!soft) return;   // ekran kartlı makinede bu yol sınanamaz
      await p.evaluate(() => { G.settings.gfx = 2; G.applySettings(); });
      await frames(3);
      const r = await p.evaluate(() => ({ gfx: G.settings.gfx, ok: D3.state.ok, toast: [...[...document.querySelectorAll('.toast')].map(e => e._key), ...(UI.toastQ || []).map(q => q.key)].join(' | ') }));
      t.eq(r.gfx, 0, 'ayar Melez\'e döndü');
      t.ok(!r.ok && /3B çizim kapatıldı/.test(r.toast) && /Klasik çizimle/.test(r.toast), 'bildirildi (melez de yazılımda açılmaz: Klasik)', r);
      t.ok(warns.length > 0, 'konsola uyarı yazıldı');
      warns.length = 0;
      await p.evaluate(() => { UI.closeAll(); if (UI.toastQ) UI.toastQ.length = 0; for (const e of document.querySelectorAll('.toast')) e.remove(); });
    });

    await t.step('Ayarlar → Grafik: Çizim Yöntemi Melez, Klasik, 3B; 3B seçilince dünya 3B çizilir ve ayar kaydedilir', async () => {
      await p.evaluate(() => { window.__d3Soft = true; });   // testte yazılım çiziminde de aç
      const opts = await p.evaluate(() => { UI.openSettings(3); return [...document.querySelectorAll('.st-row[data-k="gfx"] .st-seg span')].map(s => s.textContent); });
      t.eq(opts, ['Melez', 'Klasik', '3B'], 'üç seçenek');
      await p.click('.st-row[data-k="gfx"] [data-v="2"]');
      await t.sleep(150);
      t.eq(await p.evaluate(() => G.settings.gfx), 2, '3B seçildi');
      // ayarlar geri çıkınca kaydedilir
      await p.keyboard.press('Escape');
      await t.sleep(300);
      await p.evaluate(() => UI.closeAll());
      await frames(6);
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(3);
      const r = await p.evaluate(() => ({
        f: D3.state.frames, ok: D3.state.ok, hy: G.hy, on: G.hybridOn(), ds: G.ds, cw: G.canvas.width, ch: G.canvas.height, vw: G.vw, vh: G.vh,
        parts: D3.state.scene.parts.length, bld: D3.state.scene.bparts.size, saved: JSON.parse(Platform.get(SET_KEY) || '{}').gfx,
      }));
      t.ok(r.f >= f0 + 2, '3B kareler çiziliyor', { f0, f: r.f });
      t.ok(r.ok && !r.hy && !r.on, 'melez kapalı, 3B açık', r);
      t.eq([r.ds, r.cw, r.ch], [1, r.vw, r.vh], 'tuval yoğunluğu 1');
      t.ok(r.parts > 10 && r.bld > 3, 'kasabanın parçaları ve binaları kuruldu', r);
      t.eq(r.saved, 2, 'ayar kaydedildi');
      const l = await look();
      t.ok(l.mean > 40 && l.sd > 8, 'gündüz sahnesi aydınlık ve ayrıntılı', l);
    });

    await t.step('Kontroller: 3B fare hassasiyeti satırı 3B\'de etkin; radar kamerayla döner', async () => {
      const r = await p.evaluate(() => {
        UI.openSettings(4);
        const row = document.querySelector('.st-row[data-k="d3Sens"]');
        const out = { has: !!row, dim: row && row.classList.contains('st-dim'), tag: row && row.querySelector('.st-tag') && row.querySelector('.st-tag').textContent };
        UI.closeAll();
        D3.state.yaw = 0.9;
        return out;
      });
      t.ok(r.has && !r.dim, 'satır var ve etkin', r);
      t.eq(r.tag, '3B', '3B etiketi');
      await frames(2);
      const rot = await p.evaluate(() => { const v = D3.radarRot(); D3.state.yaw = 0; return v; });
      t.near(rot, 0.9, 1e-6, 'radar kameranın yönüyle döner');
    });

    await t.step('hikâye sinematiği oynarken fare kamerayı döndürmez; bitince yine döndürür', async () => {
      const r = await p.evaluate(() => {
        let el = document.getElementById('cinema'); const made = !el;
        if (made) { el = document.createElement('div'); el.id = 'cinema'; document.body.appendChild(el); }
        const move = () => G.canvas.dispatchEvent(new MouseEvent('mousemove', { movementX: 60, movementY: 0, bubbles: true }));
        el.classList.add('on');
        const y0 = D3.state.yaw; move(); const y1 = D3.state.yaw;
        el.classList.remove('on');
        move(); const y2 = D3.state.yaw;
        if (made) el.remove();
        D3.state.yaw = 0;
        return { y0, y1, y2 };
      });
      t.eq(r.y1, r.y0, 'sinematikte kamera dönmedi');
      t.ok(r.y2 !== r.y1, 'sinematik bitince fare kamerayı döndürür', r);
    });

    await t.step('akışlı sahne: yakındaki parçalar kurulur; uzak kasabaya gidince eskiler atılır, yenileri kurulur', async () => {
      const r0 = await p.evaluate(() => {
        const W = G.world, P = G.player, SC = D3.stream;
        // en uzak kasaba: eski parçaların hepsi atılmalı
        const far = W.towns.slice().sort((a, b) => Math.hypot(b.cx - P.x, b.cy - P.y) - Math.hypot(a.cx - P.x, a.cy - P.y))[0];
        window.FAR = far; window.OLD = [...D3.state.scene.bparts.keys()];
        return { planned: SC.planned.size, jobs: SC.jobs.size, far: far.id, d: Math.round(Math.hypot(far.cx - P.x, far.cy - P.y)) };
      });
      t.ok(r0.planned > 0 && r0.jobs > r0.planned, 'kameranın çevresi planlandı', r0);
      t.ok(r0.d > 3000, 'uzak kasaba yeterince uzak', r0);
      await p.evaluate(() => { TH.goto(FAR.spawn.x, FAR.spawn.y); });
      await frames(8);
      const r = await p.evaluate(() => {
        const SC = D3.stream, K = D3.state.cam, P = G.player;
        let maxD = 0, nearHome = 0;
        for (const ck of SC.planned.keys()) {
          const x = (ck % 4096 + 0.5) * 512, y = (Math.floor(ck / 4096) + 0.5) * 512;
          maxD = Math.max(maxD, Math.hypot(x - K.cx, y - K.cy));
          if (Math.hypot(x - HOME[0], y - HOME[1]) < 1500) nearHome++;
        }
        const bp = D3.state.scene.bparts, W = G.world;
        const mine = W.buildings.filter(b => b.town === FAR.id && Math.hypot((b.x + b.w / 2) * 16 - P.x, (b.y + b.h / 2) * 16 - P.y) < 300);
        return { maxD: Math.round(maxD), nearHome, oldLeft: OLD.filter(id => bp.has(id)).length, mine: mine.length, built: mine.filter(b => bp.has(b.id)).length, pend: SC.stats.pend, jobs: SC.jobs.size };
      });
      t.eq(r.nearHome, 0, 'eski kasabanın parçaları atıldı');
      t.eq(r.oldLeft, 0, 'eski binalar sahnede değil');
      t.ok(r.maxD < 2600, 'planlanan parçalar yalnızca kameranın çevresinde', r);
      t.ok(r.mine > 0 && r.built === r.mine, 'yeni kasabanın yakındaki binaları kuruldu', r);
      const l = await look();
      t.ok(l.mean > 40 && l.sd > 8, 'yeni yerde de sahne dolu', l);
    });

    await t.step('dünya değişince ilgili parça yeniden kurulur: bina, nesne bloğu ve zemin', async () => {
      const r0 = await p.evaluate(() => {
        const P = G.player, bp = D3.state.scene.bparts, dist = (b) => Math.hypot((b.x + b.w / 2) * 16 - P.x, (b.y + b.h / 2) * 16 - P.y);
        const b = G.world.buildings.filter(q => bp.has(q.id)).sort((a, c) => dist(a) - dist(c))[0];
        window.DB = b; window.DP = bp.get(b.id); window.DT = D3.stream.terr;
        window.DO = D3.stream.jobs.get('o' + Math.floor(P.x / 256) * 16 + ',' + Math.floor(P.y / 256) * 16);
        window.DOM_ = DO && DO.mesh;
        const n0 = D3.stream.stats.built;
        G.world.buildingDirty(b);
        G.world.invalidateChunkAt(P.x, P.y);
        return { n0, has: !!DO };
      });
      t.ok(r0.has, 'oyuncunun nesne bloğu planlı', r0);
      await frames(2); await t.sleep(700); await frames(2);
      const r = await p.evaluate(() => ({ n: D3.stream.stats.built, newPart: D3.state.scene.bparts.get(DB.id) !== DP, stale: D3.stream.jobs.get('b' + DB.id).stale, objStale: DO.stale, newObj: !DO.mesh || DO.mesh !== DOM_, terr: D3.stream.terr !== DT }));
      t.ok(r.n >= r0.n0 + 2, 'iki iş yeniden kuruldu', { n0: r0.n0, n: r.n });
      t.ok(r.newPart && !r.stale, 'binanın yeni parçası çiziliyor', r);
      t.ok(!r.objStale && r.newObj, 'nesne bloğu yeniden kuruldu', r);
      t.ok(r.terr, 'zemin dokusu yenilendi', r);
    });

    await t.step('3B modeli olmayan dış nesne kalmadı; uçurum yükseltili, köprü korkuluklu; mayşe kazanı, büst ve otomobil', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, gl = D3.renderer.gl, P = G.player;
        const tx = Math.floor(P.x / 16) + 3, ty = Math.floor(P.y / 16) + 3, i = ty * WW + tx, o0 = W.obj[i], f0 = W.flags[i];
        // iç mekân eşyaları binanın parçasında (js/scene3d.js interior) çizilir; kasa, fıçı, saman ve yalak dışarıda da durur
        const outdoor = new Set([O.CRATE, O.BARREL, O.HAY, O.TROUGH]);
        const inner = new Set([...Object.values(INT_KEY).filter(v => !outdoor.has(v)), O.STAIRS, O.STAIRSD, O.RDOOR]);
        const skip = new Set([O.NONE, O.ARTIFACT, O.STEAM]);   // kazı yeri ve kaplıca: parıltı ve buhar her karede
        const miss = [];
        W.flags[i] = f0 & ~8;
        for (const [k, v] of Object.entries(O)) {
          if (skip.has(v) || inner.has(v)) continue;
          W.obj[i] = v;
          const part = D3.objectsPart(gl, W, tx, ty, tx + 1, ty + 1);
          if (!part.mesh || part.mesh.count < 3) miss.push(k);
          if (part.mesh) part.mesh.dispose();
        }
        W.obj[i] = 0;
        // uçurum karosu yükseltili kaya bloğu (yanları komşusu uçurum değilse), suya bakan köprü karosu korkuluklu
        const t0 = W.tile[i], tE = W.tile[i + 1], cnt = () => { const q = D3.objectsPart(gl, W, tx, ty, tx + 1, ty + 1), n = q.mesh ? q.mesh.count : 0; if (q.mesh) q.mesh.dispose(); return n; };
        const flat = cnt();
        W.tile[i] = T.CLIFF; const cliff = cnt();
        W.tile[i] = T.BRIDGE; W.tile[i + 1] = T.WATER; const bridge = cnt();
        W.tile[i] = t0; W.tile[i + 1] = tE;
        W.obj[i] = o0; W.flags[i] = f0;
        const m1 = new D3.Mesh(256); D3.FURN.vat(m1, 0, 0);
        const m2 = new D3.Mesh(256); D3.FURN.bust(m2, 0, 0);
        const m3 = new D3.Mesh(256); D3.P3.car(m3, '#16161a');
        return { miss, vat: m1.count, bust: m2.count, car: m3.count, flat, cliff, bridge };
      });
      t.eq(r.miss, [], 'her dış nesne türü 3B çizilir');
      t.ok(r.vat > 0 && r.bust > 0 && r.car > 300, 'mayşe kazanı, büst ve otomobil modelleri', r);
      t.ok(r.flat === 0 && r.cliff >= 6 * 5 && r.bridge > 0, 'uçurum yükseltili, köprü korkuluklu', r);
    });

    await t.step('otomobil 3B gövdesiyle çizilir, sürücüsü ön koltukta oturur', async () => {
      await p.evaluate(() => {
        const P = G.player, road = G.world.roads.filter(r => !r.spur && r.pts.length > 10).sort((a, b) => Math.hypot(a.pts[0][0] - P.x, a.pts[0][1] - P.y) - Math.hypot(b.pts[0][0] - P.x, b.pts[0][1] - P.y))[0];
        const w = G.motorize(new Wagon(road, 5, 1, false)); G.addEnt(w); window.CAR = w;
        w.max = 0; w.spd = 0;
        TH.goto(w.x + 30, w.y + 30);
      });
      await frames(4);
      const r = await p.evaluate(() => {
        const cap = D3.state.cap, car = cap.find(c => c.k === 'car'), drv = cap.find(c => c.k === 'h' && c.e === CAR && c.st && c.st.car);
        const out = { car: !!car, driver: !!drv, hasDriver: !!CAR.driver };
        CAR.remove = true; G.ents = G.ents.filter(e => e !== CAR);
        return out;
      });
      t.ok(r.car, 'otomobil sahnede', r);
      if (r.hasDriver) t.ok(r.driver, 'sürücü koltukta', r);
    });

    await t.step('toplanan ot 3B\'de hemen kaybolur, yeniden yeşerince görünür; kazı yeri parıldar', async () => {
      const r0 = await p.evaluate(() => {
        const W = G.world, P = G.player, open = (dx, dy) => { const tx = Math.floor(P.x / 16) + dx, ty = Math.floor(P.y / 16) + dy; return ty * WW + tx; };
        window.HI = open(2, 2); window.AI = open(-2, 2);
        window.H0 = [W.obj[HI], W.obj[AI]];
        W.obj[HI] = O.SAGE; W.obj[AI] = O.ARTIFACT; W.harvested.delete(HI); W.harvested.delete(AI);
        W.invalidateChunkAt((HI % WW) * 16, Math.floor(HI / WW) * 16); W.invalidateChunkAt((AI % WW) * 16, Math.floor(AI / WW) * 16);
        return true;
      });
      t.ok(r0, 'hazır');
      const has = () => p.evaluate(() => ({ herb: D3.state.scene.herbs.some(h => h[2] === HI), art: D3.state.scene.arts.some(a => a[2] === AI) }));
      await frames(3);
      const a = await has();
      t.ok(a.herb && a.art, 'ot ve kazı yeri sahnede', a);
      await p.evaluate(() => { G.world.harvested.set(HI, G.day + 3); });
      await frames(3);
      t.ok(!(await has()).herb, 'toplanan ot kayboldu');
      await p.evaluate(() => { G.clock += 1440 * 3; });
      await frames(3);
      t.ok((await has()).herb, 'günler geçince ot yeniden yeşerdi');
      await p.evaluate(() => { const W = G.world; W.obj[HI] = H0[0]; W.obj[AI] = H0[1]; W.invalidateChunkAt((HI % WW) * 16, Math.floor(HI / WW) * 16); W.invalidateChunkAt((AI % WW) * 16, Math.floor(AI / WW) * 16); });
    });

    await t.step('kışın karlı yerde zemin ve çamlar karla örtülür; mevsim dönünce sahne yenilenir', async () => {
      // karlı bir yer: kışın snowyTile olan, açık bir nokta
      const at = await p.evaluate(() => {
        const W = G.world, s0 = W.season;
        W.season = 3;
        let best = null;
        // yalnızca kışın karlanan yer (kalıcı kar karosu değil): çevresinin çoğu kışın karlı, yazın değil
        const sn = (x, y) => W.snowyTile(x, y) && W.tile[y * WW + x] !== T.SNOW && W.tile[y * WW + x] !== T.SNOWCLIFF && !isWaterT(W.tile[y * WW + x]);
        for (let k = 0; k < 6000 && !best; k++) { const tx = 40 + Math.floor(Math.random() * (WW - 80)), ty = 40 + Math.floor(Math.random() * (WH - 80)); if (sn(tx, ty) && !W.blocked(tx * 16 + 8, ty * 16 + 8, 4)) { let n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -8; dx <= 8; dx++) if (sn(tx + dx, ty + dy)) n++; if (n > 190) best = [tx * 16 + 8, ty * 16 + 8]; } }
        W.season = s0;
        if (best) TH.goto(best[0], best[1]);
        return best;
      });
      t.ok(!!at, 'kışın karlı bir yer bulundu');
      await frames(4);
      const spring = await look();
      await p.evaluate(() => { window.TR0 = D3.stream.terr; G.world.setSeason(3); });
      await frames(2); await t.sleep(700); await frames(3);
      const winter = await look(), rb = await p.evaluate(() => D3.stream.terr !== TR0);
      t.ok(rb, 'zemin dokusu mevsimle yeniden kuruldu');
      t.ok(winter.mean > spring.mean + 25, 'kar zemini aydınlattı', { spring: spring.mean, winter: winter.mean });
      await p.evaluate(() => { G.world.setSeason(0); });
      await frames(2); await t.sleep(700); await frames(2);
    });

    await t.step('elektrik telleri: direğin traversi tellere dik, teller sahnede tek çizgi ağı', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, P = G.player, tx = Math.floor(P.x / 16), ty = Math.floor(P.y / 16) - 3;
        window.W0 = W.wires; window.PO = [W.obj[ty * WW + tx - 4], W.obj[ty * WW + tx + 4]];
        W.obj[ty * WW + tx - 4] = O.UPOLE; W.obj[ty * WW + tx + 4] = O.UPOLE;
        W.wires = Object.assign({}, W.wires || {}, { __t: [[(tx - 4) * 16 + 8, ty * 16 + 8, (tx + 4) * 16 + 8, ty * 16 + 8]] });
        W.invalidateChunkAt((tx - 4) * 16, ty * 16); W.invalidateChunkAt((tx + 4) * 16, ty * 16);
        window.PT = [tx, ty];
        return D3.poleDir(W, tx - 4, ty);
      });
      t.ok(Math.abs(r[0]) < 0.01 && Math.abs(Math.abs(r[1]) - 1) < 0.01, 'doğu-batı telinde travers kuzey-güney', r);
      await frames(3);
      const l = await p.evaluate(() => { const L = D3.state.scene.lines; return L ? L.count : 0; });
      t.ok(l >= 40, 'teller çizgi ağında', l);
      await p.evaluate(() => { const W = G.world, [tx, ty] = PT; W.obj[ty * WW + tx - 4] = PO[0]; W.obj[ty * WW + tx + 4] = PO[1]; W.wires = W0; W.invalidateChunkAt((tx - 4) * 16, ty * 16); W.invalidateChunkAt((tx + 4) * 16, ty * 16); });
      await frames(2);
    });

    await t.step('bina içi ve otelin üst katı: kesit, iç duvarlar, oda kapıları, kilitli odaların örtüsü; alt kattakiler gizli', async () => {
      await p.evaluate(() => {
        window.HB = G.world.buildings.find(x => x.type === 'hotel' && x.town === 'harlow' && isHotel2(x));
        TH.inside(HB);
      });
      await frames(6);
      const r0 = await p.evaluate(() => { const q = D3.state.scene.bparts.get(HB.id); return { cut: q && q.cut, iw: q && (q.iw || 0), inside: G.insideB === HB }; });
      t.ok(r0.inside && r0.cut, 'içerideyken bina kesitlenir', r0);
      t.eq(r0.iw, 0, 'otelin zemin katında iç duvar yok');
      await p.evaluate(() => { const P = G.player; G.setFloor(HB, 1); TH.goto((HB.x + 4.5) * 16, (HB.y + 4) * 16); P.ang = -Math.PI / 2; });
      await frames(4);
      const r = await p.evaluate(() => {
        const q = D3.state.scene.bparts.get(HB.id), s = HB.staffNpc;
        return { cut: q.cut, iw: q.iw || 0, shut: q.shut || 0, floor: HB.floor, staff: !!s, staffCap: !!s && D3.state.cap.some(c => c.e === s), staffHid: !!s && G.floorHid(s) };
      });
      t.eq(r.floor, 1, 'üst kattayız');
      t.ok(r.cut, 'üst katta da kesit', r);
      t.ok(r.iw >= 20, 'oda duvarları kuruldu', r);
      t.eq(r.shut, 6, 'kiralanmamış dört odanın üstü örtülü (arka odalarda arka duvar şeridiyle)');
      if (r.staffHid) t.ok(!r.staffCap, 'alt kattaki görevli çizilmez', r);
      const l = await look();
      t.ok(l.sd > 8, 'üst kat ayrıntılı çizilir', l);
      await p.evaluate(() => { G.setFloor(HB, 0); });
      await frames(3);
      t.eq(await p.evaluate(() => D3.state.scene.bparts.get(HB.id).iw || 0), 0, 'aşağı inince zemin katın parçası');
    });

    await t.step('dürbün, harita ve ölüm ekranı 3B\'de hatasız', async () => {
      await p.evaluate(() => { TH.goto(HOME[0], HOME[1]); });
      await frames(3);
      // dürbün: dünya 3B çizilmeye devam eder, dürbün katmanı üstüne çizilir
      await p.evaluate(() => { G.toggleBinoc(); });
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(3);
      const b = await p.evaluate(() => ({ on: !!G.binoc, f: D3.state.frames }));
      t.ok(b.on && b.f >= f0 + 2, 'dürbünle bakarken 3B çizilir', { f0, b });
      await p.evaluate(() => { G.binocOff(); });
      // harita: bütün ekranı kapatır, altındaki dünya çizilmez; kapanınca 3B sürer
      await p.evaluate(() => { UI.openMap(); });
      await frames(2);
      const m0 = await p.evaluate(() => ({ shown: UI.mapShown(), f: D3.state.frames }));
      await frames(4);
      const m1 = await p.evaluate(() => D3.state.frames);
      t.ok(m0.shown && m1 === m0.f, 'harita açıkken dünya çizilmez', { m0, m1 });
      await p.evaluate(() => { UI.closeAll(); });
      await frames(3);
      t.ok(await p.evaluate((f) => D3.state.frames > f, m1), 'harita kapanınca 3B sürer');
      // ölüm: ölüm ekranı açılırken dünya 3B çizilmeye devam eder
      await p.evaluate(() => { G.godMode = false; const P = G.player; P.hurt(P.hp + 999, 'test'); });
      const d0 = await p.evaluate(() => ({ st: G.state, f: D3.state.frames }));
      await p.waitForFunction(() => !!document.querySelector('.deathscreen'), null, { timeout: 30000 });
      await frames(2);
      const d1 = await p.evaluate(() => D3.state.frames);
      t.eq(d0.st, 'dead', 'oyuncu öldü');
      t.ok(d1 >= d0.f + 2, 'ölüm ekranında 3B çizilir', { d0, d1 });
      t.ok(await p.evaluate(() => D3.state.ok), '3B çizim açık kaldı');
    });

    await t.step('kayıt yüklenince sahne yeni dünyayla baştan kurulur', async () => {
      await p.evaluate(async () => {
        UI.closeAll();
        const P = G.player; G.state = 'play'; P.hp = P.maxHp;
        TH.goto(HOME[0], HOME[1]);
        G.saveGame(true);
        window.OW = G.world;
        await G.loadGame(G.slot, 'auto');
        UI.closeAll();
      });
      await frames(6);
      const r = await p.evaluate(() => ({ newWorld: G.world !== OW, sw: D3.stream.world === G.world, bld: D3.state.scene.bparts.size, ok: D3.state.ok, st: G.state }));
      t.ok(r.newWorld && r.sw, 'sahne yeni dünyaya bağlı', r);
      t.ok(r.bld > 3, 'yeni dünyanın binaları kuruldu', r);
      t.eq(r.st, 'play', 'oyun sürüyor');
    });

    await t.step('Melez\'e dönünce 3B çizim durur', async () => {
      await p.evaluate(() => { window.__hySoft = true; G.settings.gfx = 0; G.applySettings(); });
      await frames(3);
      const f0 = await p.evaluate(() => D3.state.frames);
      await frames(4);
      const r = await p.evaluate(() => ({ f: D3.state.frames, hy: G.hy, ds: G.ds, hf: HY.stat.frames }));
      t.eq(r.f, f0, '3B kare çizilmiyor');
      t.ok(r.hy && r.ds === 2 && r.hf > 0, 'melez çiziyor', r);
      t.eq(warns, [], '3B uyarısı yok');
    });
  },
};
