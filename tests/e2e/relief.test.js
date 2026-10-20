'use strict';
/* Kabartma: yükselti yumuşak ve sürekli; uçurumun güney kenarı dikey kaya yüzü (klasikte koyu yüz, açık üst kenar,
   koyu dip; melezde normal ve yükseklik), yamaçlar ışığa göre aydınlanır, teraslar yalnız kayalık yükseklerde, su ve
   kasaba düz; parça sınırında dikiş yok. Yüksekte kamera biraz uzaklaşır, rüzgâr ve rüzgâr sesi artar, zerreler
   savrulur; aşağı inince hepsi geri döner. Yokuş yukarı yavaş, aşağı biraz hızlı yürünür. */
module.exports = {
  name: 'Kabartma ve yükseklik',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); TH.clearNpcs(); G.godMode = true;
      G.weather = { type: 'clear', t: 99999, i: 0, cloud: 0, fogI: 0 };
      G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
      // ortam sesine giden rüzgâr düzeyini izle
      const at = Audio_.ambientTick;
      Audio_.ambientTick = function (env) { window.__envWind = env.wind; return at.call(this, env); };
      // bölge pişirme: [renk (klasik), sınıf, kabartma (melez)]; aynı bölge iki kez (klasik ve melez) pişer
      window.__bake = (ox, oy, w, h) => {
        const W = G.world, d = new Uint8ClampedArray(w * h * 4), d2 = new Uint8ClampedArray(w * h * 4), cls = new Int16Array(w * h), rel = new Float32Array(w * h * 3);
        let g = W.groundPixels(ox, oy, w, h, d, cls, null), r; do { r = g.next(); } while (!r.done);
        g = W.groundPixels(ox, oy, w, h, d2, null, rel); do { r = g.next(); } while (!r.done);
        return { d, cls, rel, w, h };
      };
    });

    await t.step('yükselti yumuşak ve sürekli, eğim yokuş yönünü gösterir', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, R = new Float32Array(3), A = new Float32Array(3), B = new Float32Array(3);
        // en engebeli bölgede yatay bir hat
        let best = null;
        for (let ty = 30; ty < WH - 30; ty += 6) for (let tx = 30; tx < WW - 60; tx += 6) { const e0 = W.elev[ty * WW + tx], e1 = W.elev[ty * WW + tx + 24], d = Math.abs(e1 - e0); if (!best || d > best.d) best = { tx, ty, d }; }
        // jump: iki komşu piksel arasındaki en büyük fark; avg: 16 piksellik pencerede en büyük ortalama eğim. Yükselti
        // parça parça doğrusal olduğundan jump avg'yi aşmaz; karo sınırında basamak olsaydı tek pikselde sıçrardı
        let jump = 0, avg = 0, bad = 0, n = 0;
        const y = best.ty * TS + 5;
        let prev = W.reliefPt(best.tx * TS, y, R)[0];
        for (let x = best.tx * TS + 1; x < (best.tx + 24) * TS; x++) {
          const e = W.reliefPt(x, y, R)[0]; jump = Math.max(jump, Math.abs(e - prev)); prev = e;
          avg = Math.max(avg, Math.abs(W.reliefPt(x + 16, y, A)[0] - e) / 16);
          if (x % 7) continue;
          // merkezî farkla eğim: işaret uyuşmalı (düze yakın yerde değil)
          const fd = (W.reliefPt(x + 6, y, A)[0] - W.reliefPt(x - 6, y, B)[0]) / 12;
          W.reliefPt(x, y, R);
          if (Math.abs(fd) > 0.03) { n++; if (Math.sign(fd) !== Math.sign(R[1])) bad++; }
        }
        return { range: best.d, jump: +jump.toFixed(4), avg: +avg.toFixed(4), n, bad };
      });
      t.ok(r.range > 30, 'engebeli bir hat bulunur', r);
      t.ok(r.jump <= r.avg * 1.05 + 0.01, 'pikselden piksele yükselti sıçramaz (karo sınırında basamak yok)', r);
      t.ok(r.n > 10 && r.bad <= r.n * 0.05, 'eğimin işareti yükselti farkıyla uyuşur', r);
    });

    await t.step('uçurumun güney kenarı dikey kaya yüzü: melezde normal ve yükseklik, klasikte koyu yüz ve açık üst kenar', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, cl = (x, y) => isCliffT(W.tile[y * WW + x]), nat = (x, y) => { const tt = W.tile[y * WW + x]; return !isCliffT(tt) && !isWaterT(tt) && tt !== T.BRIDGE && tt !== T.PLANK; };
        // yedi karo boyunca düz güney kenarı: üstte en az üç sıra uçurum, altta iki sıra zemin
        let e = null;
        for (let ty = 20; ty < WH - 20 && !e; ty++) for (let tx = 20; tx < WW - 20; tx++) {
          let ok = true;
          for (let i = -3; i <= 3 && ok; i++) ok = cl(tx + i, ty) && cl(tx + i, ty - 1) && cl(tx + i, ty - 2) && nat(tx + i, ty + 1) && nat(tx + i, ty + 2);
          if (ok) { e = { tx, ty }; break; }
        }
        if (!e) return { none: true };
        const ox = (e.tx - 8) * TS, oy = (e.ty - 8) * TS, B = __bake(ox, oy, 256, 256), lum = (i) => (B.d[i * 4] + B.d[i * 4 + 1] + B.d[i * 4 + 2]) / 3;
        let cols = 0, good = 0;
        const face = [], top = [], lip = [], mid = [], foot = [];
        for (let x = (e.tx - 2) * TS - ox; x < (e.tx + 3) * TS - ox; x++) {
          cols++;
          const run = [];
          let above = -1;
          for (let y = (e.ty - 2) * TS - oy; y < (e.ty + 2) * TS - oy; y++) {
            const i = y * 256 + x, ny = B.rel[i * 3 + 1], hgt = B.rel[i * 3 + 2];
            if (Math.abs(ny - 0.96) < 1e-3) { if (!run.length) above = i - 256; run.push([i, hgt]); }
            else if (run.length) {
              // yüzün altı zemin (yükseklik 0), üstü yayla (tam yükseklik), yüz yukarıdan aşağı alçalır
              const mono = run.every((q, k) => !k || q[1] <= run[k - 1][1] + 1e-4);
              if (mono && run.length >= 10 && run[0][1] > 12 && run[run.length - 1][1] < 1.5 && hgt === 0 && Math.abs(B.rel[above * 3 + 2] - World.CFACE) < 1e-4) {
                good++;
                for (const [j, h] of run) { face.push(lum(j)); if (h >= 13) lip.push(lum(j)); else if (h <= 1.1) foot.push(lum(j)); else if (h >= 4 && h <= 9) mid.push(lum(j)); }
                for (let k = 4; k < 10; k++) top.push(lum(above - k * 256));
              }
              break;
            }
          }
        }
        const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
        return { cols, good, face: avg(face), top: avg(top), lip: avg(lip), mid: avg(mid), foot: avg(foot), tile: W.tile[e.ty * WW + e.tx] };
      });
      t.ok(!r.none, 'düz bir güney uçurum kenarı bulunur');
      t.ok(r.good >= r.cols * 0.8, 'sütunların çoğunda yüz: yukarıdan aşağı alçalan kesintisiz kaya duvarı, üstünde yayla, altında zemin', r);
      t.ok(r.mid < r.top * 0.9, 'klasikte yüz yayladan koyu', r);
      t.ok(r.lip > r.mid + 6, 'yüzün üst kenarı ışık alır', r);
      t.ok(r.foot < r.mid, 'yüzün dibi gölgede', r);
    });

    // dağ bölgesi: kayalık yüksekler (yamaç ışığı, teras)
    const M = await p.evaluate(() => {
      const W = G.world;
      let best = null;
      for (let ty = 16; ty < WH - 32; ty += 4) for (let tx = 16; tx < WW - 32; tx += 4) {
        let n = 0;
        for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) { const i = (ty + y) * WW + tx + x, tt = W.tile[i]; if ((tt === T.ROCK || tt === T.REDROCK || tt === T.SNOW) && W.elev[i] > 185) n++; }
        if (!best || n > best.n) best = { tx, ty, n };
      }
      return best;
    });

    await t.step('yamaçlar ışığa göre aydınlanır (klasikte kuzeybatıdan); su ve kasaba düz', async () => {
      const r = await p.evaluate(() => {
        // hem ışığa hem gölgeye bakan yamacı en çok olan bölge (karo merkezlerinde kabaca)
        const W = G.world, R = new Float32Array(3), LX = -0.5, LY = -0.58;
        let pk = null;
        for (let ty = 12; ty < WH - 28; ty += 8) for (let tx = 12; tx < WW - 28; tx += 8) {
          let lit = 0, dark = 0;
          for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) {
            const tt = W.tile[(ty + y) * WW + tx + x];
            if (isCliffT(tt) || isWaterT(tt)) continue;
            W.reliefPt((tx + x) * TS + 8, (ty + y) * TS + 8, R);
            const K = 4 + 7 * Math.min(1, Math.max(0, (R[0] - 150) / 55)), l = 1 / Math.sqrt(1 + K * K * (R[1] * R[1] + R[2] * R[2])), k = (-K * R[1] * LX - K * R[2] * LY) * l;
            if (k > 0.2) lit++; else if (k < -0.2) dark++;
          }
          if (!pk || Math.min(lit, dark) > pk.m) pk = { tx, ty, m: Math.min(lit, dark) };
        }
        const B = __bake(pk.tx * TS, pk.ty * TS, 256, 256), by = {};
        for (let i = 0; i < 256 * 256; i++) {
          const nx = B.rel[i * 3], ny = B.rel[i * 3 + 1], h = B.rel[i * 3 + 2], c = B.cls[i], n = Math.hypot(nx, ny);
          if (h !== 0 || n < 0.15 || Math.abs(n - 0.7) < 1e-3 || isCliffT(c)) continue;   // yalnız yamaç (uçurum, yayla kenarı, teras değil)
          const k = nx * LX + ny * LY, o = by[c] || (by[c] = { lit: [0, 0], dark: [0, 0] }), l = (B.d[i * 4] + B.d[i * 4 + 1] + B.d[i * 4 + 2]) / 3;
          if (k > 0.15) { o.lit[0] += l; o.lit[1]++; } else if (k < -0.15) { o.dark[0] += l; o.dark[1]++; }
        }
        // en çok örneği olan zemin türünde ışık alan ve gölgedeki yamaç
        let best = null;
        for (const c in by) { const o = by[c], m = Math.min(o.lit[1], o.dark[1]); if (!best || m > best.m) best = { c: +c, m, lit: o.lit[0] / o.lit[1], dark: o.dark[0] / o.dark[1] }; }
        // kasaba ve su: normal yok, yükseklik yok
        const tw = TH.town('harlow'), Tb = __bake(((tw.cx >> 4) - 8) * TS, ((tw.cy >> 4) - 8) * TS, 256, 256);
        let flat = 0, bumpy = 0;
        for (let i = 0; i < 256 * 256; i++) { const c = Tb.cls[i]; if (c === T.TOWN || c === T.COBBLE || c === T.PAVE || isWaterT(c)) { if (Tb.rel[i * 3] === 0 && Tb.rel[i * 3 + 1] === 0 && Tb.rel[i * 3 + 2] === 0) flat++; else bumpy++; } }
        return { best, flat, bumpy };
      });
      t.ok(r.best && r.best.m > 200, 'dağda iki yöne bakan yamaç bulunur', r);
      t.ok(r.best.lit > r.best.dark * 1.08, 'ışığa bakan yamaç gölgedekinden açık', r.best);
      t.ok(r.flat > 1000 && r.bumpy === 0, 'kasaba zemini ve su düz', r);
    });

    await t.step('teraslar kayalık yükseklerde yokuş aşağı bakar; ovada teras yok', async () => {
      const r = await p.evaluate((M) => {
        const W = G.world, B = __bake(M.tx * TS, M.ty * TS, 256, 256), R = new Float32Array(3);
        let ter = 0, down = 0, other = 0;
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          const i = y * 256 + x, nx = B.rel[i * 3], ny = B.rel[i * 3 + 1], c = B.cls[i];
          if (isCliffT(c) || Math.abs(Math.hypot(nx, ny) - 0.7) > 1e-4) continue;
          if (c === T.ROCK || c === T.REDROCK || c === T.SNOW) {
            ter++;
            W.reliefPt(M.tx * TS + x, M.ty * TS + y, R);
            if (nx * R[1] + ny * R[2] < 0) down++;   // basamağın yüzü yokuş aşağı
          } else other++;
        }
        // ova: yükseltisi düşük çimen bölgesi
        let low = null;
        for (let ty = 20; ty < WH - 40 && !low; ty += 7) for (let tx = 20; tx < WW - 40; tx += 7) {
          let ok = true;
          for (let k = 0; k < 16 && ok; k += 3) for (let j = 0; j < 16 && ok; j += 3) { const i = (ty + k) * WW + tx + j; ok = W.tile[i] === T.GRASS && W.elev[i] < 140; }
          if (ok) { low = { tx, ty }; break; }
        }
        let lowTer = 0;
        if (low) { const L = __bake(low.tx * TS, low.ty * TS, 256, 256); for (let i = 0; i < 256 * 256; i++) if (Math.abs(Math.hypot(L.rel[i * 3], L.rel[i * 3 + 1]) - 0.7) < 1e-4) lowTer++; }
        return { ter, down, other, low: !!low, lowTer };
      }, M);
      t.ok(r.ter > 30, 'kayalık yüksekte teras basamağı var', r);
      t.ok(r.down >= r.ter * 0.9, 'basamakların yüzü yokuş aşağı', r);
      t.ok(r.other <= r.ter * 0.05, 'kayalık dışında teras yok (denk gelen eğim dışında)', r);
      t.ok(r.low && r.lowTer === 0, 'ovada teras yok', r);
    });

    await t.step('parça sınırında dikiş yok (üst üste binen iki pişirme aynı)', async () => {
      const r = await p.evaluate((M) => {
        const ox = M.tx * TS - 64, oy = M.ty * TS - 32, A = __bake(ox, oy, 256, 256), B = __bake(ox + 128, oy + 64, 256, 256);
        let diff = 0, rdiff = 0, n = 0;
        for (let y = 64; y < 256; y++) for (let x = 128; x < 256; x++) {
          const i = y * 256 + x, j = (y - 64) * 256 + (x - 128); n++;
          for (let c = 0; c < 3; c++) { if (A.d[i * 4 + c] !== B.d[j * 4 + c]) diff++; if (A.rel[i * 3 + c] !== B.rel[j * 3 + c]) rdiff++; }
        }
        return { n, diff, rdiff };
      }, M);
      t.eq(r.diff, 0, 'renk aynı');
      t.eq(r.rdiff, 0, 'kabartma aynı');
    });

    await t.step('kardaki ayak izi gölgeli yamaçta da zeminden koyu (zemini koyulaştırır)', async () => {
      const r = await p.evaluate(() => {
        const c = makeCanvas(64, 64), g = c.getContext('2d'), C = G.cam, keep = {}, out = [];
        for (const k of ['tracks', 'snowTracks', 'ripples', 'leaves']) keep[k] = FX[k].splice(0);
        for (const bg of [[226, 231, 236], [170, 176, 182], [120, 126, 132]]) {
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgb(${bg})`; g.fillRect(0, 0, 64, 64);
          g.setTransform(1, 0, 0, 1, -C.ox, -C.oy);
          FX.snowTracks.length = 0; FX.snowTracks.push({ x: C.ox + 32, y: C.oy + 32, a: 0, kind: 'foot', life: 60 });
          FX.drawGround(g);
          const d = g.getImageData(28, 28, 9, 9).data; let m = 765;
          for (let i = 0; i < d.length; i += 4) m = Math.min(m, d[i] + d[i + 1] + d[i + 2]);
          out.push(+((bg[0] + bg[1] + bg[2] - m) / 3).toFixed(1));
        }
        for (const k in keep) { FX[k].length = 0; FX[k].push(...keep[k]); }
        return out;
      });
      t.ok(r[0] > 12 && r[0] < 40, 'açık karda silik iz', r);
      t.ok(r[1] > 8 && r[2] > 5, 'gölgeli yamaçta da iz zeminden koyu', r);
    });

    // en yüksek yürünebilir yer ve alçak açık bir yer
    const spots = await p.evaluate(() => {
      const W = G.world, R = new Float32Array(3), cand = [];
      for (let ty = 20; ty < WH - 20; ty++) for (let tx = 20; tx < WW - 20; tx++) { const e = W.elev[ty * WW + tx]; if (e > 185) cand.push([e, tx, ty]); }
      cand.sort((a, b) => b[0] - a[0]);
      let hi = null;
      for (const [, tx, ty] of cand) {
        const x = tx * TS + 8, y = ty * TS + 8;
        if (W.blocked(x, y, 5) || W.isWaterPx(x, y) || isCliffT(W.tile[ty * WW + tx])) continue;
        hi = { x, y, e: W.reliefPt(x, y, R)[0] }; break;
      }
      const tw = TH.town('harlow'), lo = TH.openSpot(tw.cx + 600, tw.cy, 60);
      return { hi, lo, loE: W.reliefPt(lo[0], lo[1], R)[0] };
    });
    const wind = () => p.evaluate(() => ({ alt: G.alt || 0, az: G.camZoom.az, out: G.camZoom.out, os: G.os || 1, tf: G.canvas.style.transform, wind: FX.wind.s, gust: FX.wind.gust, env: window.__envWind, motes: G.motes ? G.motes.length : 0 }));

    await t.step('yüksekte kamera uzaklaşır, rüzgâr ve rüzgâr sesi artar, zerreler savrulur', async () => {
      t.ok(spots.hi && spots.hi.e > 190, 'yüksek bir yer bulunur', spots);
      await p.evaluate(([x, y]) => { TH.goto(x, y); TH.clearNpcs(); }, spots.lo);
      await t.sleep(1500);
      const base = await wind();
      await p.evaluate(({ x, y }) => { TH.goto(x, y); TH.clearNpcs(); }, spots.hi);
      await t.sleep(4500);
      const r = await wind(), want = Math.min(1, Math.max(0, (spots.hi.e - 168) / 50));
      t.near(r.alt, want, 0.06, 'yükseklik hissi bulunduğun yerin yükseltisine göre');
      t.ok(r.az < 1 - (1 - 1 / r.os) * 0.85 * want + 0.01 && r.az < 0.985, 'kamera biraz uzaklaşır', r);
      t.ok(r.out >= 1 / r.os - 1e-6, 'kenar payını aşmaz', r);
      t.ok(/^scale\(0\.9/.test(r.tf), 'tuval küçülür', r.tf);
      // rüzgâr: açık havada 0.18 + esinti + yükseklik payı
      t.near(base.wind - base.gust, 0.18, 0.01, 'alçakta rüzgâr temel düzeyde');
      t.near(r.wind - r.gust, 0.18 + 0.35 * r.alt, 0.01, 'yüksekte rüzgâr sertleşir');
      t.ok(r.env >= 0.12 + 0.5 * want - 0.06 && r.env > base.env + 0.1, 'rüzgâr sesi yükselir', { base, r });
      t.eq(r.motes, 56, 'savrulan zerreler');
    });

    await t.step('aşağı inince kamera ve rüzgâr eski hâline döner', async () => {
      await p.evaluate(([x, y]) => { TH.goto(x, y); TH.clearNpcs(); }, spots.lo);
      await t.sleep(8000);
      const r = await wind();
      t.ok(spots.loE < 160, 'alçak yer', spots.loE);
      t.eq(r.alt, 0, 'yükseklik sıfır');
      t.eq(r.az, 1, 'kamera ölçeği 1');
      t.eq(r.tf, '', 'dönüşüm kalkar');
      t.near(r.wind - r.gust, 0.18, 0.01, 'rüzgâr temel düzeye iner');
      t.ok(r.env < 0.2, 'rüzgâr sesi iner', r);
    });

    await t.step('yokuş yukarı yavaş, aşağı biraz hızlı; düzde ve yamaç boyunca etkisiz', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, R = new Float32Array(3);
        let st = null, fl = null;
        for (let ty = 20; ty < WH - 20; ty += 2) for (let tx = 20; tx < WW - 20; tx += 2) {
          const x = tx * TS + 8, y = ty * TS + 8; W.reliefPt(x, y, R); const g = Math.hypot(R[1], R[2]);
          if (!st || g > st.g) st = { x, y, g, a: Math.atan2(R[2], R[1]) };
          if (!fl && g < 0.005 && !W.isWaterPx(x, y)) fl = { x, y };
        }
        // eğimli yerdeki bina içi ve su: dışarıda olsa yokuş sayılırdı
        const steep = (want) => {
          for (let ty = 20; ty < WH - 20; ty++) for (let tx = 20; tx < WW - 20; tx++) {
            const x = tx * TS + 8, y = ty * TS + 8;
            if (!want(x, y)) continue;
            W.reliefPt(x, y, R);
            if (Math.hypot(R[1], R[2]) > 0.07) return G.slopeMul(x, y, Math.atan2(R[2], R[1]));
          }
          return null;
        };
        const s = st;
        return { g: s.g, up: G.slopeMul(s.x, s.y, s.a), down: G.slopeMul(s.x, s.y, s.a + Math.PI), side: G.slopeMul(s.x, s.y, s.a + Math.PI / 2), flat: [0, 1, 2, 3].map(k => G.slopeMul(fl.x, fl.y, k * 1.57)), inside: steep((x, y) => W.indoorPx(x, y)), water: steep((x, y) => W.isWaterPx(x, y)) };
      });
      t.ok(r.g > 0.15, 'dik bir yamaç bulunur', r);
      t.near(r.up, 0.82, 0.005, 'dik yokuş yukarı %18 yavaş');
      t.near(r.down, 1.1, 0.005, 'dik yokuş aşağı %10 hızlı');
      t.near(r.side, 1, 0.005, 'yamaç boyunca etkisiz');
      t.ok(r.flat.every(v => v === 1), 'düzde etkisiz', r.flat);
      t.ok(r.water === 1 && (r.inside === null || r.inside === 1), 'suda ve bina içinde etkisiz', r);
    });

    await t.step('yürürken yokuş yukarı aşağıdan yavaş', async () => {
      // doğu-batı doğrultusunda eğimi tutarlı, engelsiz 150 piksellik bir hat
      const L = await p.evaluate(() => {
        const W = G.world, R = new Float32Array(3);
        for (let ty = 20; ty < WH - 20; ty += 3) for (let tx = 20; tx < WW - 30; tx += 3) {
          const x0 = tx * TS + 8, y = ty * TS + 8;
          if (W.townAt(x0, y, 4)) continue;
          let ok = true, sum = 0, mn = 9;
          for (let x = x0; x <= x0 + 150 && ok; x += 5) {
            if (W.blocked(x, y, 7) || W.isWaterPx(x, y) || W.indoorPx(x, y)) { ok = false; break; }
            W.reliefPt(x, y, R); sum += R[1]; mn = Math.min(mn, Math.abs(R[1]) * Math.sign(R[1]));
          }
          if (!ok) continue;
          const m = sum / 31;
          if (Math.abs(m) > 0.11) {
            // her noktada aynı yöne
            let same = true; for (let x = x0; x <= x0 + 150; x += 5) { W.reliefPt(x, y, R); if (Math.sign(R[1]) !== Math.sign(m) || Math.abs(R[1]) < 0.05) same = false; }
            if (same) return { x0, y, m };
          }
        }
        return null;
      });
      t.ok(L, 'eğimi tutarlı engelsiz bir hat bulunur');
      const walk = async (x, key) => {
        await p.evaluate(({ x, y }) => { TH.goto(x, y); TH.clearNpcs(); const P = G.player; P.vx = P.vy = 0; }, { x, y: L.y });
        await t.sleep(300);
        const x0 = await p.evaluate(() => G.player.x);
        await p.keyboard.down(key); await t.sleep(1400); await p.keyboard.up(key);
        return Math.abs(await p.evaluate(() => G.player.x) - x0);
      };
      // yukarı: eğim artıysa doğuya (D), eksiyse batıya
      const upKey = L.m > 0 ? 'KeyD' : 'KeyA', downKey = L.m > 0 ? 'KeyA' : 'KeyD';
      const up = await walk(L.m > 0 ? L.x0 + 10 : L.x0 + 140, upKey);
      const down = await walk(L.m > 0 ? L.x0 + 140 : L.x0 + 10, downKey);
      t.ok(up > 20 && down > 20, 'iki yönde de yürür', { up, down });
      t.ok(up < down * 0.92, 'yokuş yukarı daha az yol alınır', { up, down, m: L.m });
    });
  },
};
