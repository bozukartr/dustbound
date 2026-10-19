'use strict';
/* Otelin üst katı, duvarlar ve kanun: üst kattan alt kattakine bıçak, yumruk, ok, kement ve patlama değmez, nişan
   kilitlenmez; alt kat beklemedeyken suça tanık olunmaz, ceset bulunmaz; kapıdan bakan dışarıdaki üst kattakini görmez,
   mermisi ulaşmaz; aşağı inince ceset yine bulunur; yakın dövüş ince duvarın ardına geçmez; atlı binaya giremez;
   binaya kaçan oyuncunun peşindeki atlı kanun adamı kasabada atından iner, at dışarıda kalır, kendisi yürüyerek
   yaklaşır */
module.exports = {
  name: 'Otel katı, duvar ve atlı',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true;
      G.clock = Math.floor(G.clock / 1440) * 1440 + 13 * 60;   // öğle: otel açık, görevli masasında
      window.HB = G.world.buildings.find(x => x.type === 'hotel' && x.town === 'harlow');
      TH.inside(HB);
    });
    await p.waitForFunction(() => HB.staffNpc && !HB.staffNpc.dead, null, { timeout: 10000 });

    await t.step('üst kattan alt kattakine bıçak, yumruk, ok, kement ve patlama değmez; nişan kilitlenmez', async () => {
      const r0 = await p.evaluate(() => {
        const P = G.player, s = HB.staffNpc;
        TH.feeds.length = 0;
        G.setFloor(HB, 1);
        // görevlinin tam üstünde, ona dönük (aşağıda olsa bıçak değerdi)
        TH.goto(s.x + 12, s.y); P.ang = Math.PI; P.aiming = false;
        P.weapons.add('knife'); P.weapon = 'knife';
        window.HP0 = s.hp;
        G.godMode = true;   // hata ayıklama paneli her karede sıfırlar: patlamayla aynı anda açık olsun
        const out = { hid: G.floorHid(s), aim: P.validTarget(s, 300), pick: P.pickTarget(Math.PI, 0.6, null, true) === s };
        for (let k = 0; k < 4; k++) { P.meleeCd = 0; P.melee(); }
        P.meleeCd = 0; P.melee(true);
        out.melee = s.hp;
        G.explode(s.x, s.y, P);
        out.boom = s.hp;
        // görevlinin üstünden geçen ok ve onu hedefleyen kement
        G.projs.push({ type: 'arrow', x: s.x + 40, y: s.y, vx: -320, vy: 0, life: 0.5, dmg: 75, owner: P, ang: Math.PI });
        G.projs.push({ type: 'lasso', x: s.x + 40, y: s.y, vx: -300, vy: 0, life: 0.4, owner: P, ang: Math.PI, t: 0, tg: s });
        return out;
      });
      await t.sleep(700);
      const r = await p.evaluate(() => {
        const s = HB.staffNpc;
        return { hp: s.hp, dead: s.dead, state: s.state, rope: G.player.rope === s, reports: G.reports.length, lvl: G.law.level, feeds: TH.feeds.filter(f => /tanık|görmedi/i.test(f)) };
      });
      t.ok(r0.hid, 'üst kattayken görevli gizli');
      t.ok(!r0.aim && !r0.pick, 'nişan alt kattakine kilitlenmez', r0);
      t.eq([r0.melee, r0.boom], [await p.evaluate(() => HP0), await p.evaluate(() => HP0)], 'bıçak, yumruk ve patlama değmez');
      t.ok(!r.dead && r.hp === await p.evaluate(() => HP0), 'ok değmez', r);
      t.ok(r.state !== 'lassoed' && !r.rope, 'kement yakalamaz', r);
      t.eq([r.reports, r.lvl, r.feeds], [0, 0, []], 'suç da yazılmaz');
      t.eq(await p.evaluate(() => G.state), 'play', 'oyuncu patlamada ölmedi (test düzeni)');
    });

    await t.step('alt kat beklemedeyken tanık olunmaz, ceset bulunmaz; kapıdaki kanun adamı üst kattakini görmez, mermisi ulaşmaz', async () => {
      const r = await p.evaluate(() => {
        const P = G.player;
        TH.feeds.length = 0;
        // lobide bir konuk ve yanında masum bir ceset (kanıt); kapının önünde dışarıda bir kanun adamı
        const gx = HB.x * TS + 56, gy = HB.y * TS + 88;
        const g = new NPC(gx, gy, 'town', { state: 'static', home: { x: gx, y: gy, r: 4 } }); g.name = 'Lobi Konuğu'; G.addEnt(g);
        const b = new NPC(gx + 18, gy, 'town', {}); b.dead = true; b.hp = 0; b.state = 'dead'; b.evidence = true; G.addEnt(b);
        const cx = HB.door.x, cy = HB.door.y + 14;
        const cop = new NPC(cx, cy, 'law', { state: 'static', home: { x: cx, y: cy, r: 4 } }); G.addEnt(cop);
        window.GG = g; window.GB = b; window.GC = cop;
        const out = { hid: [G.floorHid(g), G.floorHid(b), G.floorHid(cop)] };
        G.crime('assault', P.x, P.y, null);
        out.crime = TH.feeds.slice(); out.reports = G.reports.length; out.lvl = G.law.level;
        G.evidenceTick();
        out.ev = b.evidence; out.reports2 = G.reports.length;
        out.los = G.los(cx, cy, P.x, P.y); out.see = cop.canSee(P.x, P.y, 400);
        out.shot = G.fireRay(cx, cy, Math.atan2(P.y - cy, P.x - cx), 400, 1, cop, { npc: true }) === P;
        return out;
      });
      t.eq(r.hid, [true, true, false], 'lobidekiler gizli, kapının önündeki değil');
      t.eq([r.crime, r.reports, r.lvl], [['Kimse görmedi...'], 0, 0], 'üst kattaki suçu ne lobideki ne kapıdaki görür');
      t.eq([r.ev, r.reports2], [true, 0], 'lobideki ceset bulunmaz');
      t.ok(!r.los && !r.see, 'kapıdaki kanun adamı üst kattakini görmez', r);
      t.ok(!r.shot, 'dışarıdan atılan mermi üst kattakine ulaşmaz');
    });

    await t.step('aşağı inince ceset yine bulunur', async () => {
      const r = await p.evaluate(() => {
        GC.remove = true;
        G.setFloor(HB, 0);
        TH.goto(GB.x + 40, GB.y);
        TH.feeds.length = 0;
        const out = { hid: G.floorHid(GG) };
        G.evidenceTick();
        out.ev = GB.evidence; out.report = G.reports.length > 0 && G.reports[0].ws.includes(GG);
        out.feeds = TH.feeds.filter(f => /tanık/i.test(f));
        // temizlik
        for (const o of G.reports) o.done = true;
        for (const e of [GG, GB]) { e.witness = null; e.remove = true; }
        return out;
      });
      t.ok(!r.hid, 'aşağıda konuk görünür');
      t.ok(!r.ev && r.report, 'konuk cesedi bulur ve kanuna koşar', r);
      t.eq(r.feeds.length, 1, 'tanık uyarısı çıkar');
    });

    await t.step('yakın dövüş ince duvarın ardına geçmez, açıkta aynı uzaklıkta değer', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, y = HB.y * TS + 88, xi = HB.x * TS + 10, xo = HB.x * TS - 5;
        // otelin batı duvarı ince (5 piksel): dışarıda oyuncu, içeride duvarın dibinde bir haydut
        const n = new NPC(xi, y, 'bandit', { state: 'static', home: { x: xi, y, r: 2 } }); G.addEnt(n);
        TH.goto(xo, y); P.ang = 0; P.aiming = false; P.weapon = 'knife';
        const hp0 = n.hp, out = { d: Math.round(dist(P.x, P.y, n.x, n.y)), wall: !G.world.indoorPx(xo, y) && G.world.indoorPx(xi, y) };
        for (let k = 0; k < 3; k++) { P.meleeCd = 0; P.melee(); }
        out.thru = hp0 - n.hp;
        // açıkta aynı uzaklıkta
        const s = TH.openSpot(HB.door.x, HB.door.y + 200, 40);
        TH.goto(s[0], s[1]); n.x = s[0] + out.d; n.y = s[1];
        for (let k = 0; k < 1; k++) { P.meleeCd = 0; P.melee(); }
        out.open = hp0 - out.thru - n.hp;
        n.remove = true;
        return out;
      });
      t.ok(r.wall && r.d < 20, 'duvarın iki yanı, bıçak menzilinde', r);
      t.eq(r.thru, 0, 'duvarın ardındakine bıçak değmez');
      t.ok(r.open > 0, 'açıkta aynı uzaklıkta değer', r);
    });

    await t.step('atlı binaya giremez; binaya kaçan oyuncunun peşindeki atlı kanun adamı atından iner, at dışarıda kalır, kendisi yürüyerek yaklaşır', async () => {
      await p.evaluate(() => {
        const P = G.player, W = G.world;
        TH.clearNpcs();
        TH.inside(HB);
        // kapıdan içeri sürmeye çalışan atlı kasabalı
        const rx = HB.door.x, ry = HB.door.y + 40;
        const rider = new NPC(rx, ry, 'town', { mounted: true }); rider.state = 'walk'; rider.target = { x: HB.door.x, y: HB.door.y - 40 }; rider.t = 60; rider.ang = rider.hAng = -Math.PI / 2;
        G.addEnt(rider);
        // aranan oyuncu otelde; kapının önündeki sokaktan atlı bir kanun adamı geliyor (kasabanın içinde, açık bir doğrultu)
        const L = G.law; L.level = 1; L.masked = false; L.bounty = 10; L.lastX = P.x; L.lastY = P.y; L.unseen = 0; L.spawnT = 999;
        const free = (x, y) => !W.blocked(x, y, 8) && !W.indoorPx(x, y) && !W.isWaterPx(x, y);
        let best = null;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
          const x0 = HB.door.x + dx * 30, y0 = HB.door.y + 28;
          let d = 0; while (d < 160 && free(x0 + dx * (d + 8), y0 + dy * (d + 8))) d += 8;
          if (!best || d > best.d) best = { d, x: x0 + dx * d, y: y0 + dy * d };
        }
        const cop = new NPC(best.x, best.y, 'law', { hostile: true, mounted: true, weapon: 'cattleman' }); cop.personal = false;
        G.addEnt(cop);
        window.RD = rider; window.CP = cop; window.VIO = []; window.CP0 = Math.round(dist(cop.x, cop.y, P.x, P.y));
        window.H0 = new Set(G.ents.filter(e => e.kind === 'horse'));
        const nose = (e) => { const a = e.hAng === undefined ? e.ang : e.hAng; return W.indoorPx(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10); };
        window.WATCH = setInterval(() => {
          for (const e of [RD, CP]) if (e.mounted && (W.indoorPx(e.x, e.y) || nose(e))) VIO.push([e.role, Math.round(e.x), Math.round(e.y)]);
          for (const h of G.ents) if (h.kind === 'horse' && h.owner === 'npc' && W.indoorPx(h.x, h.y)) VIO.push(['horse', Math.round(h.x), Math.round(h.y)]);
        }, 50);
      });
      await p.waitForFunction(() => !CP.mounted, null, { timeout: 3000 }).catch(() => {});
      const alight = await p.evaluate(() => ({ mounted: !!CP.mounted, t: Math.round(dist(CP.x, CP.y, G.player.x, G.player.y)), d0: CP0 }));
      await t.sleep(5000);
      const r = await p.evaluate(() => {
        clearInterval(WATCH);
        const P = G.player, W = G.world, horses = G.ents.filter(e => e.kind === 'horse' && !H0.has(e));
        const out = { vio: VIO.slice(0, 5), riderMounted: !!RD.mounted, riderIn: W.indoorPx(RD.x, RD.y), copMounted: !!CP.mounted, horses: horses.map(h => [h.owner, !!h.rider, Math.round(h.x - HB.door.x), Math.round(h.y - HB.door.y)]),
          horseOut: horses.every(h => !W.indoorPx(h.x, h.y)), copD: Math.round(dist(CP.x, CP.y, P.x, P.y)), copIn: W.buildingAtPx(CP.x, CP.y) === HB };
        const L = G.law; L.level = 0; L.bounty = 0; for (const e of G.ents) if (e.kind === 'npc' || e.kind === 'horse' && e.owner === 'npc') e.remove = true;
        return out;
      });
      t.eq(r.vio, [], 'atlı ve at hiçbir an binanın içinde değil');
      t.ok(r.riderMounted && !r.riderIn, 'atlı kasabalı kapıda kalır', r);
      t.ok(!alight.mounted, 'kasabada kanun adamı atından iner (atlı yol bulamaz, duvara takılırdı)', alight);
      t.ok(!r.copMounted && r.horses.length === 1 && r.horses[0][0] === 'npc' && !r.horses[0][1] && r.horseOut, 'atı dışarıda kalır', r);
      t.ok(r.copIn || r.copD < alight.t - 40, 'kanun adamı yürüyerek yaklaşır', { alight, r });
    });
  },
};
