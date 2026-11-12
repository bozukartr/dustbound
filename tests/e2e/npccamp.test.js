'use strict';
/* NPC yapay zekâsı, Aşama 4: haydut kampında gece. Akşam ateş başında oturur, gece yarısından şafağa uyurlar; biri nöbet
   tutar (kampın çevresinde dört noktada dışarıyı gözetler). Uyuyan görmez, çömelerek yanına gelinir; silah sesi hepsini
   uyandırır; arkadaşının bağırışıyla sersem uyanır; gündüz uyumazlar. Gerçek bir haydut kampında da denenir. Yardımcılar
   algı testindekilerle aynıdır; oyun kare kare G.update ile ileri sarılır. */
module.exports = {
  name: 'NPC yapay zekâsı: haydut kampında gece',
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
      /* kamp: açık alanın ortasında n haydut, evi (ateşi) ortada */
      window.CAMPN = (n, tag) => {
        const s = SPOT(), P = G.player, out = [];
        TH.goto(s[0] - 230, s[1]);
        for (let k = 0; k < n; k++) { const a = k / n * TAU; const b = BANDIT(s[0] + Math.cos(a) * 40, s[1] + Math.sin(a) * 40, a, { home: { x: s[0], y: s[1], r: 60 } }, true); b.camp = tag; out.push(b); }
        return { s, g: out };
      };
    });

    await t.step('akşam ateş başında oturur, gece uyur; en küçük kimlikli nöbet tutar ve dört noktayı dolaşır', async () => {
      const r = await p.evaluate(() => {
        const { s, g } = CAMPN(4, 'gece-kamp'), out = {};
        HOUR(21); RUN(12);
        const sentry = g.filter(b => b.post);
        out.sentry = sentry.length; out.sentryMin = sentry.length === 1 && sentry[0].id === Math.min(...g.map(b => b.id));
        out.sit = g.filter(b => !b.post && b.state === 'sit' && dist(b.x, b.y, s[0], s[1]) < 45).length;
        const k0 = sentry[0] && sentry[0].post.k; RUN(14); out.moved = sentry[0] && sentry[0].post.k !== k0;
        HOUR(1); RUN(3);
        out.sleep = g.filter(b => !b.post && b.asleep && b.state === 'sleep').length;
        out.awake = g.filter(b => b.post && !b.asleep).length;
        for (const b of g) b.remove = true;
        return out;
      });
      t.eq(r.sentry, 1, 'bir nöbetçi'); t.ok(r.sentryMin, 'en küçük kimlikli', r);
      t.ok(r.sit === 3, 'üçü ateş başında oturuyor', r);
      t.ok(r.moved, 'nöbetçi bir sonraki noktaya geçti', r);
      t.ok(r.sleep === 3 && r.awake === 1, 'gece üçü uyuyor, nöbetçi uyanık', r);
    });

    await t.step('uyuyan görmez: çömelerek 30 px\'e kadar gelinir; silah sesi hepsini uyandırır', async () => {
      const r = await p.evaluate(() => {
        const sentry0 = G.campSentry; G.campSentry = () => false;   // nöbetçisiz kamp: yalnız uyuyanlar
        const { s, g } = CAMPN(3, 'uyku-kamp'), P = G.player, out = {};
        HOUR(1); RUN(6);
        out.asleep = g.filter(b => b.asleep).length;
        const v = g[0]; TH.goto(v.x - 120, v.y); P.crouch = true;
        const stop = WALK(1, 0); let maxAw = 0;
        try { RUN(10, () => { maxAw = Math.max(maxAw, ...g.map(b => b.aw || 0)); return dist(P.x, P.y, v.x, v.y) < 30; }); } finally { stop(); P.crouch = false; }
        out.d = Math.round(dist(P.x, P.y, v.x, v.y)); out.maxAw = +maxAw.toFixed(2); out.still = g.filter(b => b.asleep).length;
        G.noise(P.x, P.y, 620, 'gun');
        out.woke = g.filter(b => !b.asleep && b.aggro).length;
        G.campSentry = sentry0;
        for (const b of g) b.remove = true;
        return out;
      });
      t.ok(r.asleep === 3, 'üçü uyuyor', r);
      t.ok(r.d <= 31 && r.maxAw < 0.35 && r.still === 3, 'çömelerek yanına gelindi, kimse uyanmadı', r);
      t.ok(r.woke === 3, 'silah sesi hepsini uyandırdı', r);
    });

    await t.step('bağırış uyuyan arkadaşları sersem uyandırır (en geç 2,5 sn); gündüz uyumazlar', async () => {
      const r = await p.evaluate(() => {
        const sentry0 = G.campSentry; G.campSentry = () => false;
        const { s, g } = CAMPN(3, 'alarm-kamp'), P = G.player, out = {};
        HOUR(1); RUN(6);
        G.senseAlert(g[0], { x: P.x, y: P.y }, 'see');
        out.t = RUN(4, () => g.every(b => b.aggro && !b.asleep));
        G.campSentry = sentry0;
        for (const b of g) b.remove = true;
        const D = CAMPN(3, 'gunduz-kamp'); HOUR(12); RUN(6);
        out.day = D.g.filter(b => b.asleep || b.state === 'sit' || b.state === 'sleep').length;
        for (const b of D.g) b.remove = true;
        return out;
      });
      t.ok(r.t > 0.9 && r.t <= 2.5, 'uyuyanlar 1–2,5 sn içinde uyandı', r);
      t.eq(r.day, 0, 'gündüz oturan ya da uyuyan yok');
    });

    await t.step('gerçek haydut kampı: gece ateşin çevresinde uyurlar, biri nöbette', async () => {
      const r = await p.evaluate(() => {
        TH.clearNpcs(); HOUR(1);
        const W = G.world, p_ = W.pois.find(q => q.kind === 'camp' && !(G.campCleared[q.pid] !== undefined));
        if (!p_) return { skip: true };
        const pos = G.findSpawnPos(p_.x, p_.y, 430, 500) || [p_.x + 450, p_.y];
        TH.goto(pos[0], pos[1]);
        RUN(5, () => G.ents.some(e => e.camp === p_.pid));
        const g = G.ents.filter(e => e.camp === p_.pid && !e.dead);
        RUN(20);
        const out = { n: g.length, sentry: g.filter(b => b.post).length, sleep: g.filter(b => b.asleep).length, near: g.filter(b => b.asleep && dist(b.x, b.y, p_.x, p_.y) < 50).length, aggro: g.filter(b => b.aggro).length };
        return out;
      });
      t.ok(!r.skip, 'dünyada temizlenmemiş bir haydut kampı var', r);
      t.ok(r.n >= 3 && r.sentry === 1, 'kampta bir nöbetçi', r);
      t.ok(r.sleep >= r.n - 1 - r.aggro && r.near === r.sleep, 'ötekiler ateşin yanında uyuyor', r);
    });
  },
};
