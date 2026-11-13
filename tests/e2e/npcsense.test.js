'use strict';
/* NPC yapay zekâsı, Aşama 1: algı. Bakış yönü, ışık, duruş ve örtüyle görme; ayak sesi ve silah sesiyle duyma; şüphe ("?")
   ve fark etme ("!"); bağırarak haber verme; arkadaşının cesedini görme; son görülen yerde gözetleme, çevreyi arama ve
   vazgeçme; kanun adamının algısı ve ekibin son bildirilen yerden başlaması; tanığın bakış yönü; fark edilme göstergesi;
   maliyet. Oyun, kare kare G.update ile hızlı ileri sarılır (45 saniyelik arama birkaç saniyede biter). */
module.exports = {
  name: 'NPC yapay zekâsı: algı, arama, haber, gösterge',
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
    });

    await t.step('görme: önündeki oyuncuyu gündüz bir saniyede fark eder; arkasındakini ve kayanın ardındakini görmez', async () => {
      const r = await p.evaluate(() => {
        const s = SPOT(), P = G.player, out = {};
        // önde: 150 px batıda, yüzü oyuncuya dönük
        let b = BANDIT(P.x - 150, P.y, 0);
        out.front = RUN(2.5, () => b.awState === 'alert');
        out.frontAggro = !!b.aggro; out.frontLkp = b.lkp ? Math.round(dist(b.lkp.x, b.lkp.y, P.x, P.y)) : -1;
        b.remove = true; RUN(0.1);
        // arkada: aynı yer, yüzü öbür yana
        b = BANDIT(P.x - 150, P.y, Math.PI);
        RUN(4); out.back = [+(b.aw || 0).toFixed(2), b.awState || null, !!b.aggro];
        b.remove = true; RUN(0.1);
        // kaya duvarı: oyuncunun 6 karo doğusunda; haydut 9 karo doğuda, yüzü oyuncuya dönük
        const W = G.world, sx = P.x >> 4, sy = P.y >> 4;
        for (let ty = sy - 4; ty <= sy + 4; ty++) W.setObj(sx + 6, ty, O.BOULDER);
        W.refreshArea(sx + 4, sy - 6, sx + 8, sy + 6);
        b = BANDIT((sx + 9) * 16 + 8, sy * 16 + 8, Math.PI);
        RUN(4); out.wall = [+(b.aw || 0).toFixed(2), b.awState || null, !!b.aggro, G.los(b.x, b.y, P.x, P.y)];
        b.remove = true;
        return out;
      });
      t.ok(r.front > 0 && r.front <= 1.6, 'önden 150 px: en geç 1,6 sn içinde "!"', r);
      t.ok(r.frontAggro && r.frontLkp >= 0 && r.frontLkp < 4, 'gördüğü yeri tam bilir, saldırır', r);
      t.ok(r.back[0] < 0.05 && !r.back[1] && !r.back[2], 'arkası dönükken fark etmez', r);
      t.ok(!r.wall[3] && r.wall[0] < 0.05 && !r.wall[2], 'kayanın ardındaki oyuncuyu görmez', r);
    });

    await t.step('gece çömelerek arkadan 150 px\'e kadar fark edilmeden yaklaşılır; gündüz önden yürüyen uzaktan fark edilir', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        // gece, fenersiz, çömelmiş: haydut 400 px doğuda, sırtı oyuncuya dönük (ikisi de çalıları temizlenmiş alanda)
        let s = SPOT(); HOUR(23); let P = G.player;
        TH.goto(s[0] - 200, s[1]);
        out.lit = +G.litK().toFixed(2);
        let b = BANDIT(s[0] + 200, s[1], 0);
        P.crouch = true;
        let stop = WALK(1, 0), maxAw = 0, tt;
        try { tt = RUN(30, () => { maxAw = Math.max(maxAw, b.aw || 0); return dist(P.x, P.y, b.x, b.y) < 150; }); } finally { stop(); P.crouch = false; }
        out.night = { t: tt, d: Math.round(dist(P.x, P.y, b.x, b.y)), maxAw: +maxAw.toFixed(2), st: b.awState || null, aggro: !!b.aggro };
        b.remove = true;
        // gündüz, yürüyerek, önden: haydut 400 px doğuda, yüzü oyuncuya dönük; arada çalı yok
        s = SPOT(); HOUR(12); P = G.player;
        TH.goto(s[0] - 200, s[1]);
        b = BANDIT(s[0] + 200, s[1], Math.PI);
        stop = WALK(1, 0);
        let td;
        try { td = RUN(30, () => b.awState === 'alert' || dist(P.x, P.y, b.x, b.y) < 60); } finally { stop(); }
        out.day = { t: td, d: Math.round(dist(P.x, P.y, b.x, b.y)), st: b.awState || null };
        b.remove = true;
        return out;
      });
      t.ok(r.lit < 0.6, 'gece ışık az', r);
      t.ok(r.night.t > 0 && r.night.d < 155, '150 px\'e kadar yaklaştı', r);
      t.ok(r.night.maxAw < 0.35 && !r.night.st && !r.night.aggro, 'fark edilmedi (şüphe bile yok)', r);
      t.ok(r.day.st === 'alert' && r.day.d > 150, 'gündüz önden yürüyen 150 px\'ten uzakta fark edilir', r);
    });

    await t.step('silah sesi: yakındaki haydut alarma geçer ama yeri tam bilmez; uzaktaki şüphelenir ve bakmaya gelir', async () => {
      const r = await p.evaluate(() => {
        SPOT(); const P = G.player, out = {};
        const a = BANDIT(P.x + 300, P.y, 0), b = BANDIT(P.x - 450, P.y, Math.PI);
        G.noise(P.x, P.y, 620, 'gun');
        out.near = { st: a.awState || null, aggro: !!a.aggro, sees: a.sees, err: a.lkp ? Math.round(dist(a.lkp.x, a.lkp.y, P.x, P.y)) : -1 };
        out.far = { st: b.awState || null, aw: +(b.aw || 0).toFixed(2), aggro: !!b.aggro, err: b.awPt ? Math.round(dist(b.awPt.x, b.awPt.y, P.x, P.y)) : -1 };
        // şüphelenen bir süre durup bakar, sonra o yere yürür
        a.remove = true;
        const x0 = b.x; RUN(3);
        out.walked = Math.round(b.x - x0);
        b.remove = true;
        return out;
      });
      t.ok(r.near.st === 'alert' && r.near.aggro, 'yakındaki (300 px) alarma geçti', r);
      t.ok(r.near.err >= 0 && r.near.err <= 62, 'bildiği yer oyuncunun çevresinde (mesafenin %20\'si kadar sapmalı)', r);
      t.ok(r.far.st === 'suspect' && !r.far.aggro && r.far.aw >= 0.35, 'uzaktaki (450 px) şüphelendi', r);
      t.ok(r.walked > 10, 'şüphelenen sesin geldiği yere yürüdü', r);
    });

    await t.step('sessiz öldürme: kamp arkadaşının cesedini gören alarma geçer, katili görmeden cesedin çevresini arar', async () => {
      const r = await p.evaluate(() => {
        SPOT(); const P = G.player, W = G.world, sx = P.x >> 4, sy = P.y >> 4, out = {};
        // oyuncu kaya duvarının batısında; iki haydut doğuda
        for (let ty = sy - 8; ty <= sy + 8; ty++) W.setObj(sx + 6, ty, O.BOULDER);
        W.refreshArea(sx + 4, sy - 10, sx + 8, sy + 10);
        const a = BANDIT((sx + 10) * 16 + 8, sy * 16 + 8, 0), b = BANDIT((sx + 17) * 16 + 8, sy * 16 + 8, Math.PI);
        a.camp = b.camp = 'test-kamp';
        RUN(1);
        out.before = [b.awState || null, !!b.aggro];
        a.hurt(9999, 'player', 'knife');
        const ta = RUN(3, () => b.awState === 'alert');
        out.t = ta; out.sees = b.sees; out.lkp = b.lkp ? Math.round(dist(b.lkp.x, b.lkp.y, a.x, a.y)) : -1;
        out.search = RUN(8, () => !!b.search);
        out.pts = b.search ? b.search.pts.length : 0;
        b.remove = true;
        return out;
      });
      t.ok(!r.before[0] && !r.before[1], 'önce sakin', r);
      t.ok(r.t > 0 && r.t <= 1.5, 'cesedi görünce alarma geçti', r);
      t.ok(r.sees === false && r.lkp >= 0 && r.lkp < 4, 'oyuncuyu görmüyor; bildiği tek yer ceset', r);
      t.ok(r.search > 0 && r.pts >= 3, 'cesedin başında oyalanmadan aramaya başladı (en az 3 nokta)', r);
    });

    await t.step('haber: fark eden bağırır; kamptaki arkadaşı 1 saniye içinde öğrenir (bağıranın bildiği yeri)', async () => {
      const r = await p.evaluate(() => {
        SPOT(); const P = G.player, out = {};
        const a = BANDIT(P.x + 160, P.y, Math.PI), b = BANDIT(P.x + 160, P.y + 300, Math.PI / 2);
        a.camp = b.camp = 'test-kamp2';
        let ta = -1, tb = -1, f = 0;
        RUN(4, () => { f++; if (ta < 0 && a.awState === 'alert') ta = f / 30; if (tb < 0 && b.awState === 'alert') tb = f / 30; return tb > 0; });
        out.ta = ta; out.tb = tb;
        out.same = !!(a.lkp && b.lkp && dist(a.lkp.x, a.lkp.y, b.lkp.x, b.lkp.y) < 1);
        out.bSaw = G.los(b.x, b.y, P.x, P.y) && Math.abs(angDiff(b.ang, Math.atan2(P.y - b.y, P.x - b.x))) < 1;
        a.remove = b.remove = true;
        return out;
      });
      t.ok(r.ta > 0, 'gören alarma geçti', r);
      t.ok(r.tb > 0 && r.tb - r.ta <= 1.0, 'arkadaşı en geç 1 saniyede öğrendi', r);
    });

    await t.step('arama: oyuncuyu kaybeden haydut son gördüğü yerde gözetler, en az 3 noktayı arar, en geç 45 saniyede vazgeçer', async () => {
      const r = await p.evaluate(() => {
        const s = SPOT(), P = G.player, out = {};
        const b = BANDIT(P.x - 150, P.y, 0, {}, true);
        RUN(2, () => b.aggro && b.sees);
        out.saw = !!(b.aggro && b.sees);
        // oyuncu gözden kaybolur: temizlenmiş alanın içinde, dört yanı kayalarla çevrili bir yere (hiçbir yönden görünmez;
        // halka su ya da bina üstüne düşerse boşluk kalabiliyordu)
        const lx = P.x, ly = P.y, W = G.world, hx = (s[0] + 200) >> 4, hy = (s[1] + 160) >> 4;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 3) W.setObj(hx + dx, hy + dy, O.BOULDER);
        W.refreshArea(hx - 4, hy - 4, hx + 4, hy + 4);
        TH.goto(hx * 16 + 8, hy * 16 + 8);
        let atT = -1, srT = -1, visits = 0, lastI = -1, f = 0;
        const gave = RUN(60, () => {
          f++;
          if (atT < 0 && b.atLkp) atT = f / 30;
          if (b.search) { if (srT < 0) srT = f / 30; if (b.search.i !== lastI) { if (b.search.i > lastI && lastI >= 0) visits += b.search.i - lastI; lastI = b.search.i; } }
          else lastI = -1;
          return !b.aggro;
        });
        out.gave = gave; out.atT = atT; out.srT = srT; out.visits = visits;
        out.lkp = b.lkp ? Math.round(dist(b.lkp.x, b.lkp.y, lx, ly)) : null;
        out.after = { aggro: !!b.aggro, st: b.awState || null, alertFor: Math.round((b.alertUntil || 0) - G.t) };
        b.remove = true;
        return out;
      });
      t.ok(r.saw, 'önce gördü', r);
      t.ok(r.atT > 0 && r.srT - r.atT >= 2.9, 'son gördüğü yerde en az 3 sn gözetledi', r);
      t.ok(r.visits >= 3, 'en az 3 noktayı aradı', r);
      t.ok(r.gave > 0 && r.gave <= 45.5, 'en geç 45 saniyede vazgeçti', r);
      t.ok(!r.after.aggro && !r.after.st && r.after.alertFor > 100, 'vazgeçince sakinleşti ama bir süre tetikte', r);
    });

    await t.step('kanun: aranırken arkası dönük kanun adamı fark etmez, önündekini fark edip düşman olur; ekip son bildirilen yerden başlar', async () => {
      const r = await p.evaluate(() => {
        const s = SPOT(), P = G.player, L = G.law, out = {};
        L.level = 1; L.bounty = 10; L.lastX = P.x; L.lastY = P.y; L.unseen = 0; L.spawnT = 1e9;
        const n = new NPC(P.x + 150, P.y, 'law', { weapon: 'cattleman', home: { x: P.x + 150, y: P.y, r: 4 } });
        n.say = () => {}; n.ang = 0; n.idleUpdate = function () { this.mv = 0; this.spd = 0; }; G.addEnt(n);
        RUN(3);
        out.back = [!!n.hostile, +(n.aw || 0).toFixed(2)];
        n.ang = Math.PI;
        out.front = RUN(3, () => n.hostile);
        n.remove = true; RUN(0.1);
        // ekip: son bildirilen yer 500 px batıda; oyuncu burada, ekip oyuncunun çevresinde doğar ama yerini bilmez
        L.level = 2; L.lastX = P.x - 500; L.lastY = P.y; L.unseen = 0; L.spawnT = 0;
        RUN(1 / 30);
        const posse = G.ents.filter(e => e.kind === 'npc' && e.isLaw && !e.dead && !e.remove);
        out.posse = posse.map(e => ({ lkp: e.lkp ? Math.round(dist(e.lkp.x, e.lkp.y, L.lastX, L.lastY)) : -1, st: e.awState }));
        for (const e of posse) e.remove = true;
        L.level = 0; L.bounty = 0; L.spawnT = 1e9;
        return out;
      });
      t.ok(!r.back[0], 'arkası dönükken fark etmedi', r);
      t.ok(r.front > 0 && r.front <= 2.5, 'önüne geçince fark edip düşman oldu', r);
      t.ok(r.posse.length >= 1 && r.posse.every(q => q.lkp >= 0 && q.lkp < 60 && q.st === 'alert'), 'ekip son bildirilen yere gider', r);
    });

    await t.step('tanık: 120 px\'ten uzakta bakış yönü gerekir; yakın silah sesi başı çevirir; gece görüş kısalır', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, out = {};
        const w = new NPC(P.x + 200, P.y, 'town', {}); w.say = () => {}; G.addEnt(w);
        w.lookAt = null;
        w.ang = Math.PI; out.facing = G.witnessSees(w, P.x, P.y);
        w.ang = 0; out.away = G.witnessSees(w, P.x, P.y);
        G.lastNoise = { x: P.x, y: P.y, t: G.t, type: 'gun' }; out.gunshot = G.witnessSees(w, P.x, P.y); G.lastNoise = null;
        w.x = P.x + 100; out.close = G.witnessSees(w, P.x, P.y);
        w.x = P.x + 200; w.ang = Math.PI; HOUR(23); out.night = G.witnessSees(w, P.x, P.y);
        HOUR(12); w.remove = true;
        return out;
      });
      t.ok(r.facing, 'yüzü dönük tanık 200 px\'ten görür', r);
      t.ok(!r.away, 'arkası dönük tanık 200 px\'ten görmez', r);
      t.ok(r.gunshot, 'yakın silah sesi başını çevirir: görür', r);
      t.ok(r.close, '120 px\'ten yakında arkası dönük de olsa fark eder', r);
      t.ok(!r.night, 'gece 200 px\'teki suçu görmez', r);
    });

    await t.step('fark edilme göstergesi: şüphede amber "?", fark edince kırmızı "!", ararken "?"; ayardan kapanır', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, out = {};
        out.def = G.settings.awareMarks;
        const b = BANDIT(P.x + 120, P.y, 0);
        const marks = () => [...document.querySelectorAll('#awaremarks .awm')].map(e => e.className.replace('awm', '').trim() + ':' + e.textContent);
        b.aw = 0.5; b.awState = 'suspect'; b.awPt = { x: P.x, y: P.y };
        AwareMarks.update(); out.sus = marks();
        G.senseAlert(b, { x: P.x, y: P.y }, 'see'); AwareMarks.update(); out.alert = marks();
        b.search = { pts: [], i: 0, pause: 0, t: 0, dur: 30 }; AwareMarks.update(); out.seek = marks(); b.search = null;
        G.settings.awareMarks = false; AwareMarks.update(); out.off = marks();
        G.settings.awareMarks = true;
        b.remove = true; AwareMarks.update(); out.gone = marks();
        // Ayarlar > Görüntü sekmesinde satırı var
        UI.openSettings(2, 'awareMarks');
        out.row = !!document.querySelector('.st-row[data-k="awareMarks"]');
        UI.closeAll();
        return out;
      });
      t.ok(r.def !== false, 'varsayılan açık', r);
      t.eq(r.sus, ['sus:?'], 'şüphede "?"');
      t.eq(r.alert, ['alert:!'], 'fark edince "!"');
      t.eq(r.seek, ['seek:?'], 'ararken "?"');
      t.eq(r.off, [], 'ayar kapalıyken işaret yok');
      t.eq(r.gone, [], 'NPC gidince işaret silinir');
      t.ok(r.row, 'Ayarlar > Görüntü sekmesinde satırı var', r);
    });

    await t.step('maliyet: 6 kişilik çatışmada yapay zekâ kare başına 1,5 ms\'den az; sakin 6 haydudun algısı çok ucuz', async () => {
      const r = await p.evaluate(() => {
        SPOT(); HOUR(12); const P = G.player, out = {};
        const up = NPC.prototype.update;
        const meas = (sec) => { let acc = 0, n = 0; NPC.prototype.update = function (dt) { const t0 = performance.now(); up.call(this, dt); acc += performance.now() - t0; }; RUN(sec, () => { n++; return false; }); NPC.prototype.update = up; return acc / Math.max(1, n); };
        // sakin: 6 haydut, sırtı dönük, 200-300 px uzakta
        const calm = [];
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, d = 200 + (k % 2) * 90; calm.push(BANDIT(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, a)); }
        RUN(0.5); out.calm = +meas(3).toFixed(3); out.calmAlert = calm.filter(b => b.awState === 'alert').length;
        for (const b of calm) b.remove = true; RUN(0.1);
        // çatışma: 6 haydut saldırıyor
        const fight = [];
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, d = 170 + (k % 3) * 50, b = BANDIT(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, a + Math.PI, {}, true); b.aggro = true; fight.push(b); }
        RUN(1); out.fight = +meas(4).toFixed(3);
        for (const b of fight) b.remove = true;
        return out;
      });
      t.ok(r.calmAlert === 0, 'sırtı dönük sakin haydutlar fark etmedi', r);
      t.ok(r.calm < 0.4, 'sakin 6 haydut: kare başına < 0,4 ms', r);
      t.ok(r.fight < 1.5, '6 kişilik çatışma: kare başına < 1,5 ms', r);
    });
  },
};
