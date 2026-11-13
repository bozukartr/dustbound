'use strict';
/* NPC yapay zekâsı, Aşama 3: moral, takım ve teslim olma. Yalnız kalan yaralı haydut geri çekilir, kaçar ya da teslim
   olur; yakındaki oyuncuya teslim olan silahını atar, ellerini kaldırır, bağlanabilir; teslim olanı vurmak onurdan
   götürür; kanun adamı teslim olmaz, destek çağırır; arkadaşları düşünce moral düşer; kalabalık grupta biri yan
   dolaşır. Yardımcılar algı testindekilerle aynıdır; oyun kare kare G.update ile ileri sarılır. */
module.exports = {
  name: 'NPC yapay zekâsı: moral, takım ve teslim olma',
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
      /* oyuncunun çevresinde 9 karo yarıçaplı halkada 16 kaya (her yönde siper) */
      window.RING = () => {
        const P = G.player, W = G.world, sx = P.x >> 4, sy = P.y >> 4;
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; W.setObj(sx + Math.round(Math.cos(a) * 9), sy + Math.round(Math.sin(a) * 9), O.BOULDER); }
        W.refreshArea(sx - 11, sy - 11, sx + 11, sy + 11);
      };
      /* NPC'nin atışlarını say */
      window.SHOTS = new Map();
      const fr = G.fireRay.bind(G);
      G.fireRay = function (ox, oy, ang, range, dmg, owner, opts) { if (owner && owner.kind === 'npc') SHOTS.set(owner, (SHOTS.get(owner) || 0) + 1); return fr(ox, oy, ang, range, dmg, owner, opts); };
    });

    await t.step('yalnız kalan %30 canlı haydut en geç 5 saniyede geri çekilir, kaçar ya da teslim olur', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player;
        const b = BANDIT(P.x + 170, P.y, Math.PI, { weapon: 'cattleman' }, true); b.aggro = true; b.hp = b.maxHp * 0.3;
        const t = RUN(5, () => b.retreat || b.fleeing || b.state === 'surrender');
        const out = { t, mor: b.mor, retreat: !!b.retreat, flee: !!b.fleeing, st: b.state };
        b.remove = true;
        return out;
      });
      t.ok(r.t > 0 && r.t <= 5, 'en geç 5 saniyede', r);
    });

    await t.step('yakındaki oyuncuya teslim olur: silahını atar, ellerini kaldırır, bağlanır', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, out = {};
        const b = BANDIT(P.x + 110, P.y, Math.PI, { weapon: 'cattleman' }, true); b.aggro = true; b.hp = b.maxHp * 0.25; b.mag = 0; b.spare = 0;
        out.t = RUN(3, () => b.state === 'surrender');
        out.weapon = b.weapon; out.anim = b.anim && b.anim.k;
        out.gun = G.ents.some(g => g.kind === 'gun' && dist(g.x, g.y, b.x, b.y) < 24);
        out.shotsAfter = 0; const s0 = SHOTS.get(b) || 0; RUN(2); out.shotsAfter = (SHOTS.get(b) || 0) - s0; out.still = b.state === 'surrender';
        TH.goto(b.x - 12, b.y); P.ang = 0;
        out.acts = TH.actions();
        out.tied = TH.act(/Bağla/) && b.state === 'tied';
        b.remove = true;
        return out;
      });
      t.ok(r.t > 0, 'teslim oldu', r);
      t.ok(r.weapon === null && r.gun, 'silahını yere attı', r);
      t.ok(r.anim === 'handsup' && r.still && r.shotsAfter === 0, 'elleri havada bekliyor, ateş etmiyor', r);
      t.ok(r.tied, 'Bağla ile bağlandı (şerife canlı teslim edilebilir)', r);
    });

    await t.step('teslim olanı vurmak onurdan götürür', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player;
        const b = BANDIT(P.x + 80, P.y, Math.PI, { weapon: 'cattleman' }, true);
        G.npcSurrender(b);
        const h0 = G.honor; b.hurt(10, 'player', 'gun'); const h1 = G.honor; b.hurt(10, 'player', 'gun'); const h2 = G.honor;
        b.remove = true;
        return { d1: +(h1 - h0).toFixed(2), d2: +(h2 - h1).toFixed(2), feed: TH.feeds.some(f => /Teslim olan birini vurdun/.test(f)) };
      });
      t.ok(r.d1 <= -2.9 && r.d2 === 0, 'bir kez 3 onur', r);
      t.ok(r.feed, 'bildirim', r);
    });

    await t.step('kanun adamı teslim olmaz; morali düşünce destek çağırır, yeni ekip çabuk gelir', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, L = G.law;
        L.level = 3; L.resist = true; L.bounty = 50; L.lastX = P.x; L.lastY = P.y; L.unseen = 0; L.spawnT = 30;
        const n = new NPC(P.x + 150, P.y, 'law', { hostile: true, weapon: 'cattleman' }); n.say = () => {}; G.addEnt(n); n.hp = n.maxHp * 0.2;
        let surr = false; const t = RUN(4, () => { if (n.state === 'surrender') surr = true; return !!n.backup; });
        const out = { t, spawnT: +L.spawnT.toFixed(2), retreat: !!n.retreat, surr };
        RUN(1); out.surr2 = n.state === 'surrender';
        for (const e of G.ents) if (e.isLaw) e.remove = true;
        L.level = 0; L.bounty = 0; L.resist = false; L.spawnT = 1e9;
        return out;
      });
      t.ok(r.t > 0 && r.spawnT <= 1.5, 'destek çağırdı, ekip çabuk gelecek', r);
      t.ok(!r.surr && !r.surr2, 'teslim olmadı', r);
    });

    await t.step('arkadaşları düşünce moral düşer', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, out = {};
        const g = [0, 1, 2].map(k => { const b = BANDIT(P.x + 170, P.y - 40 + k * 40, Math.PI, { weapon: 'cattleman' }, true); b.aggro = true; b.camp = 'moral-kamp'; return b; });
        RUN(1); out.m0 = +g[2].mor.toFixed(2);
        g[0].hurt(9999, 'player', 'gun'); g[1].hurt(9999, 'player', 'gun');
        RUN(1); out.m1 = +g[2].mor.toFixed(2); out.retreat = !!g[2].retreat;
        for (const b of g) b.remove = true;
        return out;
      });
      t.ok(r.m0 >= 0.9 && r.m1 <= 0.5, 'iki arkadaşı düşünce moral düştü', r);
    });

    await t.step('takım: üç kişilik grupta biri yan dolaşır (öbürlerine göre en az 50° başka yönden)', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player; RING();
        const g = [0, 1, 2].map(k => { const b = BANDIT(P.x + 175, P.y - 30 + k * 30, Math.PI, { weapon: 'repeater' }, true); b.aggro = true; b.camp = 'takim-kamp'; b.spare = 9; return b; });
        RUN(10);
        const fl = g.filter(b => b.flank), rest = g.filter(b => !b.flank);
        const brg = (b) => Math.atan2(b.y - P.y, b.x - P.x);
        let mx = 0, my = 0; for (const b of rest) { mx += Math.cos(brg(b)); my += Math.sin(brg(b)); }
        const out = { n: fl.length, diff: fl.length ? Math.round(Math.abs(angDiff(brg(fl[0]), Math.atan2(my, mx))) * 180 / Math.PI) : -1 };
        for (const b of g) b.remove = true;
        return out;
      });
      t.eq(r.n, 1, 'bir yan dolaşan');
      t.ok(r.diff >= 50, 'öbürlerine göre en az 50° başka yönden', r);
    });
  },
};
