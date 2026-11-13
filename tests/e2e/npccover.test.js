'use strict';
/* NPC yapay zekâsı, Aşama 2: siper ve isabet. Kayalık arenada çatışan haydut zamanının çoğunu siperde geçirir, yana
   çıkıp ateş eder; oyuncu yandan dolaşıp siperi açığa çıkarınca yer değiştirir; açık arazide siper yoksa yanlayarak
   çatışır; isabet modeli koşullara göre değişir; siperine gelen mermi onu siperde tutar; maliyet. Yardımcılar (açık alan,
   saat, haydut, hızlı ileri sarma) algı testindekilerle aynıdır; oyun kare kare G.update ile ileri sarılır. */
module.exports = {
  name: 'NPC yapay zekâsı: siper ve isabet',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); UI.el.help.classList.add('hidden'); G.eventT = 1e9; G.travelT = 1e9; G.hunterTick = () => {};
      G.godMode = true;
      /* saat (h) ve açık hava; hava önbelleği oyunun kendi hesabıyla tazelenir */
      window.HOUR = (h) => {
        G.clock = Math.floor(G.clock / 1440) * 1440 + h * 60;
        Object.assign(G.weather, { type: 'clear', i: 0, fogI: 0, cloud: 0, t: 1e6 });
        G.envCache = G.localWeather(G.player.x, G.player.y);
      };
      window.MV0 = Input.moveVec;
      HOUR(12);
      /* dünyada rastgele örnekleyerek kenarı 2*half px olan, engelsiz, susuz, kasabasız kare bir alanın ortası; her çağrı başka yer */
      window.OPEN = (half = 260) => {
        OPEN.n = (OPEN.n || 0) + 1;
        const W = G.world, R = new RNG(31 + OPEN.n * 113), n = Math.ceil(half / 16);
        for (let k = 0; k < 900; k++) {
          // karo merkezine hizalı; kaya, harabe duvarı, bina, uçurum, su ve iç mekân olmayan bir kare
          const tx = Math.floor(R.range(2000, WW * TS - 2000) / TS), ty = Math.floor(R.range(2000, WH * TS - 2000) / TS), cx = tx * TS + 8, cy = ty * TS + 8;
          if (W.townAt(cx, cy, 120)) continue;
          if (W.lightsIn(cx - 400, cy - 400, cx + 400, cy + 400).length) continue;   // ışık yok: gece testleri karanlıkta
          let ok = true;
          for (let dy = -n; dy <= n && ok; dy++) for (let dx = -n; dx <= n && ok; dx++) {
            const i = (ty + dy) * WW + tx + dx, o = W.obj[i], x = cx + dx * 16, y = cy + dy * 16;
            if ((W.flags[i] & 8) || o === O.BOULDER || o === O.RUINWALL || isCliffT(W.tile[i]) || W.isWaterPx(x, y) || W.indoorPx(x, y)) ok = false;
          }
          if (!ok) continue;
          // küçük nesneler (çalı, taş, ağaç) temizlenir: görüş ve rota testi belirlenimli olsun
          for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if (W.obj[(ty + dy) * WW + tx + dx]) W.setObj(tx + dx, ty + dy, 0);
          W.refreshArea(tx - n - 1, ty - n - 1, tx + n + 1, ty + n + 1);
          for (let dy = -n; dy <= n && ok; dy++) for (let dx = -n; dx <= n && ok; dx++) if (W.blocked(cx + dx * 16, cy + dy * 16, 5)) ok = false;
          if (ok) return [cx, cy];
        }
        return null;
      };
      /* açık bir alanın ortasına oyuncuyu koy; NPC'leri, aranmayı, feneri, çömelmeyi sıfırla */
      window.SPOT = (half) => {
        TH.clearNpcs();
        const s = OPEN(half), P = G.player, L = G.law;
        Input.moveVec = MV0;   // önceki adım yarıda kaldıysa oyuncu yürümeye devam etmesin
        TH.goto(s[0], s[1]); P.crouch = false; P.lantern = false; P.vx = P.vy = 0; P.hp = P.maxHp;
        L.level = 0; L.bounty = 0; L.masked = false; L.resist = false; L.spawnT = 1e9;
        if (G.horse) { G.horse.x = s[0] - 900; G.horse.y = s[1]; }
        return s;
      };
      /* haydut: yüzü ang yönüne dönük; live=false iken boştaki gezinmesi dondurulur (bakış yönü testte sabit kalsın) */
      window.BANDIT = (x, y, ang, o = {}, live = false) => {
        const b = new NPC(x, y, 'bandit', Object.assign({ hostile: true, weapon: 'cattleman', home: { x, y, r: 6 } }, o));
        b.ang = ang; b.say = () => {}; G.addEnt(b);
        if (!live) b.idleUpdate = function () { this.mv = 0; this.spd = 0; };
        return b;
      };
      /* oyunu hızlı ileri sar: her adım yeni bir kare (yol bulma bütçesi kare başınadır). stop tutunca geçen süre, tutmazsa -1 */
      window.RUN = (sec, stop) => {
        const n = Math.round(sec * 30);
        for (let f = 1; f <= n; f++) { G.fno++; G.update(1 / 30); G.player.hp = G.player.maxHp; if (stop && stop()) return f / 30; }
        return -1;
      };
      /* oyuncuyu yürüt: (x, y) yönünde, istenirse çömelerek */
      window.WALK = (x, y) => { const mv = Input.moveVec.bind(Input); Input.moveVec = () => ({ x, y, m: 1 }); return () => { Input.moveVec = mv; }; };
      /* kayalık arena: oyuncunun doğusunda 7-14 karo arası dağınık 9 kaya */
      window.ROCKS = () => {
        const P = G.player, W = G.world, sx = P.x >> 4, sy = P.y >> 4;
        for (const [dx, dy] of [[8, -3], [10, 2], [12, -1], [9, 5], [13, 4], [11, -5], [7, 1], [14, -3], [12, 7]]) W.setObj(sx + dx, sy + dy, O.BOULDER);
        W.refreshArea(sx + 5, sy - 8, sx + 16, sy + 9);
        return { sx, sy };
      };
      /* NPC'nin atışlarını say */
      window.SHOTS = new Map();
      const fr = G.fireRay.bind(G);
      G.fireRay = function (ox, oy, ang, range, dmg, owner, opts) { if (owner && owner.kind === 'npc') SHOTS.set(owner, (SHOTS.get(owner) || 0) + 1); return fr(ox, oy, ang, range, dmg, owner, opts); };
    });

    await t.step('kayalık arazide çatışan haydut zamanının en az %60\'ını siperde geçirir, yana çıkıp ateş eder', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, { sx, sy } = ROCKS(), out = {};
        const b = BANDIT((sx + 12) * 16 + 8, (sy + 2) * 16 + 8, Math.PI, { weapon: 'repeater' }, true); b.aggro = true; b.spare = 9;
        RUN(2);
        out.cov = !!b.cov;
        let hidden = 0, n = 0, peeks = 0, st = '';
        const s0 = SHOTS.get(b) || 0;
        RUN(20, () => { n++; if (G.losTrace(P.x, P.y, b.x, b.y, true) === 0) hidden++; const s = b.cov ? b.cov.st : '-'; if (s === 'out' && st !== 'out') peeks++; st = s; return false; });
        out.ratio = +(hidden / n).toFixed(2); out.peeks = peeks; out.shots = (SHOTS.get(b) || 0) - s0; out.dead = b.dead;
        b.remove = true;
        return out;
      });
      t.ok(r.cov, 'siper buldu', r);
      t.ok(r.ratio >= 0.6, 'zamanın en az %60\'ı oyuncudan görünmüyor', r);
      t.ok(r.peeks >= 3 && r.shots >= 3, 'en az 3 kez yana çıkıp ateş etti', r);
    });

    await t.step('oyuncu (görünerek) yandan dolaşıp siperi açığa çıkarınca yeni bir siper bulur ve yeniden saklanır', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, W = G.world, { sx, sy } = ROCKS(), out = {};
        const b = BANDIT((sx + 12) * 16 + 8, (sy + 2) * 16 + 8, Math.PI, { weapon: 'repeater' }, true); b.aggro = true; b.spare = 9;
        out.hid = RUN(8, () => b.cov && b.cov.st === 'hide');
        const c0 = { x: b.cov.x, y: b.cov.y }, u = Math.atan2(P.y - b.y, P.x - b.x);
        // haydudun yanına (90°) geç: yan gözüyle görür, siperi artık işe yaramaz
        let gx = 0, gy = 0, found = false;
        for (const d of [150, 120, 180]) {
          for (const s of [1, -1, 0.75, -0.75, 1.25, -1.25]) {
            gx = b.x + Math.cos(u + s * Math.PI / 2) * d; gy = b.y + Math.sin(u + s * Math.PI / 2) * d;
            if (!W.blocked(gx, gy, 6) && !W.isWaterPx(gx, gy) && G.losTrace(gx, gy, c0.x, c0.y, true) > 0.5 && G.losTrace(gx, gy, b.x, b.y, true) > 0.5) { found = true; break; }
          }
          if (found) break;
        }
        TH.goto(gx, gy);
        out.exposed = found && G.losTrace(P.x, P.y, c0.x, c0.y, true) > 0;
        out.moved = RUN(4, () => b.cov && dist(b.cov.x, b.cov.y, c0.x, c0.y) > 20);
        out.rehid = RUN(8, () => b.cov && b.cov.st === 'hide' && G.losTrace(P.x, P.y, b.x, b.y, true) === 0);
        b.remove = true;
        return out;
      });
      t.ok(r.hid > 0, 'önce siperde', r);
      t.ok(r.exposed, 'oyuncu dolaşınca açıkta kaldı', r);
      t.ok(r.moved > 0 && r.moved <= 3, 'en geç 3 saniyede yeni siper seçti', r);
      t.ok(r.rehid > 0, 'yeni siperinde yeniden saklandı', r);
    });

    await t.step('açık arazide siper yoksa yanlayarak çatışır ve ateş eder', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player;
        const b = BANDIT(P.x + 160, P.y, Math.PI, { weapon: 'cattleman' }, true); b.aggro = true;
        const s0 = SHOTS.get(b) || 0;
        RUN(5);
        const out = { cov: !!b.cov, shots: (SHOTS.get(b) || 0) - s0 };
        b.remove = true;
        return out;
      });
      t.ok(!r.cov && r.shots >= 2, 'siper yok, yine de ateş etti', r);
    });

    await t.step('isabet: kanun adamı daha isabetli; uzaklık, yürüme, yeni nişan, koşan hedef, karanlık ve baskı sapmayı artırır', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, out = {};
        const b = BANDIT(P.x + 150, P.y, Math.PI), n = new NPC(P.x - 150, P.y, 'law', { weapon: 'cattleman' });
        b.aimT0 = n.aimT0 = G.t - 5; b.supT = n.supT = -99;
        const S = (e, d, mv) => +G.npcSpread(e, P, d, mv).toFixed(4);
        out.base = S(b, 150, false); out.law = S(n, 150, false); out.far = S(b, 600, false); out.moving = S(b, 150, true);
        b.aimT0 = G.t; out.fresh = S(b, 150, false); b.aimT0 = G.t - 5;
        P.sprinting = true; P.mv = 1; out.sprint = S(b, 150, false); P.sprinting = false; P.mv = 0;
        P.crouch = true; out.crouch = S(b, 150, false); P.crouch = false;
        b.supT = G.t; out.sup = S(b, 150, false); b.supT = -99;
        HOUR(23); out.night = S(b, 150, false); HOUR(12);
        b.remove = true;
        return out;
      });
      t.ok(r.law < r.base, 'kanun adamı haydattan isabetli', r);
      t.ok(r.far > r.base && r.moving > r.base && r.fresh > r.base, 'uzaklık, yürüme ve yeni nişan sapmayı artırır', r);
      t.ok(r.sprint > r.base && r.crouch > r.base, 'koşan ve çömelmiş hedef zor', r);
      t.ok(r.night > r.base && r.sup > r.base, 'karanlık ve baskı sapmayı artırır', r);
      t.ok(r.base > 0.08 && r.base < 0.14, 'temel sapma eski değere yakın (0,11)', r);
    });

    await t.step('baskı: yanından geçen ya da siperine çarpan mermi titretir; baskı altındaki siperden çıkmaz, geçince çıkar', async () => {
      const r = await p.evaluate(() => {
        let s = SPOT(); HOUR(12); let P = G.player; const W = G.world, out = {};
        // açık arazide 22 px yanından geçen mermi; arkadaki haydut etkilenmez
        const a = BANDIT(P.x + 200, P.y, Math.PI), c = BANDIT(P.x - 200, P.y + 120, 0);
        G.fireRay(P.x, P.y, Math.atan2(22, 200), 700, 0, P, {});
        out.near = G.t - (a.supT === undefined ? -99 : a.supT) < 0.1; out.behind = c.supT === undefined;
        a.remove = c.remove = true;
        // önündeki kayaya çarpan mermi (haydut kayanın 18 px arkasında)
        const kx = (P.x >> 4) + 12, ky = P.y >> 4; W.setObj(kx, ky, O.BOULDER); W.refreshArea(kx - 1, ky - 1, kx + 1, ky + 1);
        const d = BANDIT(kx * 16 + 8 + 18, ky * 16 + 8, Math.PI);
        G.fireRay(P.x, P.y, Math.atan2(d.y - P.y, d.x - P.x), 700, 0, P, {});
        out.rock = G.t - (d.supT === undefined ? -99 : d.supT) < 0.1 && !(d.hp < d.maxHp);
        d.remove = true;
        // siperdeki haydut baskı altındayken çıkmaz
        s = SPOT(); P = G.player; const { sx, sy } = ROCKS();
        const b = BANDIT((sx + 12) * 16 + 8, (sy + 2) * 16 + 8, Math.PI, { weapon: 'repeater' }, true); b.aggro = true; b.spare = 9;
        out.hid = RUN(8, () => b.cov && b.cov.st === 'hide');
        b.cov.until = G.t; b.supT = G.t;
        out.sup = true;
        let stay = true; RUN(1.2, () => { if (!b.cov || b.cov.st !== 'hide') stay = false; return false; });
        out.stay = stay;
        out.peek = RUN(3, () => b.cov && (b.cov.st === 'peek' || b.cov.st === 'out'));
        b.remove = true;
        return out;
      });
      t.ok(r.near && r.behind, 'yanından geçen mermi baskı kurar, arkadakini etkilemez', r);
      t.ok(r.rock, 'siperine çarpan mermi de baskı kurar', r);
      t.ok(r.hid > 0, 'siperde', r);
      t.ok(r.stay, 'baskı sürerken siperden çıkmadı', r);
      t.ok(r.peek > 0, 'baskı geçince yeniden yana çıktı', r);
    });

    await t.step('maliyet: kayalık arazide 6 kişilik siperli çatışma kare başına 1,5 ms\'den az', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, { sx, sy } = ROCKS(), up = NPC.prototype.update, all = [];
        for (let k = 0; k < 6; k++) { const b = BANDIT((sx + 10 + (k % 3) * 2) * 16 + 8, (sy - 4 + k * 2) * 16 + 8, Math.PI, { weapon: k % 2 ? 'repeater' : 'cattleman' }, true); b.aggro = true; all.push(b); }
        RUN(1);
        let acc = 0, n = 0; NPC.prototype.update = function (dt) { const t0 = performance.now(); up.call(this, dt); acc += performance.now() - t0; };
        RUN(5, () => { n++; return false; }); NPC.prototype.update = up;
        const out = { ms: +(acc / n).toFixed(3), inCover: all.filter(b => b.cov).length };
        for (const b of all) b.remove = true;
        return out;
      });
      t.ok(r.inCover >= 3, 'çoğu siperde', r);
      t.ok(r.ms < 1.5, 'kare başına 1,5 ms\'den az', r);
    });
  },
};
