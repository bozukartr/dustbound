'use strict';
/* Yere düşen silah: silahlı biri ölünce son kullandığı silah yanına düşer (şarjöründe kalan mermiyle); sende yoksa
   yerden silah olarak alınır, varsa yalnızca mermileri; ceset aramak silah vermez; mermi ve patlama ona işlemez;
   kayıtta yerinde kalır; iki çizimde de görünür. */
module.exports = {
  name: 'Yere düşen silah',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      // oyuncunun dx px doğusunda, oyuncuya bakan bir haydut ölür; mag: şarjöründe kalan mermi (verilmezse hiç ateş etmemiş)
      window.killBandit = (w, mag, by = 'npc', dx = 40) => {
        const P = G.player, n = new NPC(P.x + dx, P.y, 'bandit', { hostile: true, weapon: w }); n.ang = Math.PI;
        if (mag !== undefined) n.mag = mag;
        G.addEnt(n); n.hurt(9999, by, 'gun');
        return n;
      };
      window.drops = () => G.ents.filter(e => e.kind === 'gun' && !e.remove);
      window.clearDrops = () => { for (const e of drops()) e.remove = true; G.ents = G.ents.filter(e => !e.remove); };
      // yerdeki silahın hemen batısında, ona bakarak dur
      window.standAt = (g) => { TH.goto(g.x - 5, g.y); G.player.ang = 0; };
    });

    await t.step('silahlı biri ölünce son kullandığı silah yanına düşer, şarjöründe kalan mermiyle', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const a = killBandit('shotgun', 1, 'player'), da = drops();
        clearDrops();
        const b = killBandit('cattleman'), db = drops();
        clearDrops();
        const c = new NPC(G.player.x + 40, G.player.y, 'traveler', {}); G.addEnt(c); c.hurt(9999, 'npc', 'gun');
        return {
          a: da.map(g => ({ w: g.w, n: g.n, d: Math.hypot(g.x - a.x, g.y - a.y) })), aDead: a.dead, aWeapon: a.weapon,
          b: db.map(g => ({ w: g.w, n: g.n })), unarmed: drops().length, cWeapon: c.weapon,
        };
      });
      t.ok(r.aDead, 'haydut öldü');
      t.eq(r.a.length, 1, 'bir silah düştü');
      t.eq(r.a[0].w, 'shotgun', 'son kullandığı silah');
      t.eq(r.a[0].n, 1, 'şarjöründe kalan mermiyle');
      t.ok(r.a[0].d <= 12, 'cesedin yanında', r.a[0].d);
      t.eq(r.aWeapon, 'shotgun', 'cesedin kemerdeki mermisi için silah türü kalır');
      t.eq(r.b, [{ w: 'cattleman', n: 6 }], 'hiç ateş etmemişse şarjör dolu');
      t.eq(r.unarmed, 0, 'silahsız ölünce bir şey düşmez');
    });

    await t.step('suya düşen silah kaybolur', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const W = G.world, P = G.player;
        // oyuncunun 80 px doğusundaki 5x5 karoyu geçici olarak göle çevir, ortasında öldür
        const tx = Math.floor((P.x + 80) / TS), ty = Math.floor(P.y / TS), saved = [];
        for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) { saved.push([y * WW + x, W.tile[y * WW + x]]); W.tile[y * WW + x] = T.WATER; }
        let got, dead, water;
        try {
          const cx = tx * TS + 8, cy = ty * TS + 8;
          water = W.isWaterPx(cx, cy) && W.isWaterPx(cx - 11, cy) && W.isWaterPx(cx + 11, cy);
          const n = new NPC(cx, cy, 'bandit', { hostile: true, weapon: 'repeater' }); G.addEnt(n); n.hurt(9999, 'npc', 'gun');
          got = drops().length; dead = n.dead; n.remove = true;
        } finally { for (const [i, v] of saved) W.tile[i] = v; }
        return { got, dead, water };
      });
      t.ok(r.water, 'göl kuruldu', r);
      t.ok(r.dead && r.got === 0, 'suda ölenin silahı kaybolur', r);
    });

    await t.step('silah sende yoksa yerden silah olarak alınır, şarjörü düştüğü kadar dolu', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const P = G.player;
        P.weapons.delete('shotgun'); delete P.clip.shotgun;
        killBandit('shotgun', 1);
        const g = drops()[0];
        standAt(g);
        const before = TH.actions();
        TH.feeds.length = 0;
        const ok = TH.act(/Silahı Al/);
        return { before, ok, has: P.weapons.has('shotgun'), clip: P.clip.shotgun, left: drops().length, feeds: TH.feeds.slice() };
      });
      t.eq(r.before, ['Çift Namlulu Av Tüfeği', 'Silahı Al'], 'yerdeki silahın adı ve eylemi');
      t.ok(r.ok && r.has, 'silah alındı');
      t.eq(r.clip, 1, 'şarjörde düştüğündeki mermi');
      t.eq(r.left, 0, 'yerde kalmaz');
      t.ok(r.feeds.some(f => /Yeni silah/.test(f)), 'yeni silah bildirimi', r.feeds);
    });

    await t.step('cesede yakınken ceset önde kalır; silahın üstünde durunca silahın eylemi çıkar', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const P = G.player;
        P.weapons.delete('repeater'); delete P.clip.repeater;
        const n = killBandit('repeater', 5);
        const g = drops()[0], a = Math.atan2(n.y - g.y, n.x - g.x);
        // cesedin silahtan uzak yanında, cesede bakarak
        TH.goto(n.x + Math.cos(a) * 4, n.y + Math.sin(a) * 4); P.ang = a + Math.PI;
        const nearBody = TH.actions();
        // silahın üstünde, cesede doğru bakarak
        TH.goto(g.x, g.y); P.ang = a;
        const onGun = TH.actions();
        return { nearBody, onGun, name: n.name, d: Math.hypot(n.x - g.x, n.y - g.y) };
      });
      t.eq(r.nearBody[0], r.name, 'cesedin yanında ceset', r);
      t.ok(r.nearBody.includes('Cesedi Ara'), 'cesedi arama eylemi', r.nearBody);
      t.eq(r.onGun, ['Karabina Tüfeği', 'Silahı Al'], 'silahın üstünde silah');
    });

    await t.step('aynı silah sende varsa yalnızca mermileri alınır; taşıyamadığın mermi yerde kalır', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const P = G.player;
        P.giveWeapon('cattleman', true);
        const nW = P.weapons.size;
        P.ammo.pistol = 10;
        killBandit('cattleman', 4);
        let g = drops()[0];
        standAt(g);
        const act1 = TH.actions();
        TH.act(/Mermilerini Al/);
        const after1 = { ammo: P.ammo.pistol, weapons: P.weapons.size, left: drops().length };
        // neredeyse dolu: 5 mermiden 2'si alınır, 3'ü silahla yerde kalır; dolunca alınamaz
        clearDrops();
        P.ammo.pistol = AMMO.pistol.max - 2;
        killBandit('cattleman', 5);
        g = drops()[0];
        standAt(g);
        TH.act(/Mermilerini Al/);
        const after2 = { ammo: P.ammo.pistol, n: g.n, left: drops().length, act: TH.actions() };
        TH.feeds.length = 0;
        TH.act(/Mermilerini Al/);
        const after3 = { ammo: P.ammo.pistol, n: g.n, left: drops().length, feeds: TH.feeds.slice() };
        // boş şarjörlü aynı silah: alınacak bir şey yok, eylem de yok
        clearDrops();
        killBandit('cattleman', 0);
        const empty = G.gunPickAction(drops()[0]);
        return { nW, act1, after1, after2, after3, empty, max: AMMO.pistol.max };
      });
      t.eq(r.act1, ['Drover Tabanca', 'Mermilerini Al (4)'], 'eylem mermi sayısıyla');
      t.eq(r.after1, { ammo: 14, weapons: r.nW, left: 0 }, 'yalnızca 4 mermi alındı, silah eklenmedi, yerde kalmadı');
      t.eq([r.after2.ammo, r.after2.n, r.after2.left], [r.max, 3, 1], 'yalnızca taşıyabildiği kadar; kalan mermiyle silah yerde');
      t.eq(r.after2.act, ['Drover Tabanca', 'Mermilerini Al (3)'], 'yerde kalanın eylemi güncel');
      t.eq([r.after3.ammo, r.after3.n, r.after3.left], [r.max, 3, 1], 'dolunca alınmaz');
      t.ok(r.after3.feeds.some(f => /Daha fazla taşıyamazsın/.test(f)), 'dolu bildirimi', r.after3.feeds);
      t.eq(r.empty, null, 'boş ve sende olan silahta eylem yok');
    });

    await t.step('ceset aramak silah vermez, yalnızca kemerdeki mermiyi', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const P = G.player;
        P.weapons.delete('rifle'); delete P.clip.rifle;
        P.ammo.rifle = 0;
        const n = killBandit('rifle', 1);
        const mr = Math.random; Math.random = () => 0;   // eskiden %35 ihtimalle silah verirdi: en şanslı zar
        try { G.lootBody(n); } finally { Math.random = mr; }
        return { has: P.weapons.has('rifle'), ammo: P.ammo.rifle, looted: n.looted, onGround: drops().filter(g => g.w === 'rifle').length };
      });
      t.ok(r.looted, 'ceset arandı');
      t.ok(!r.has, 'aramada silah gelmez');
      t.ok(r.ammo >= 3 && r.ammo <= 8, 'kemerdeki mermi gelir', r.ammo);
      t.eq(r.onGround, 1, 'silah yerde, oradan alınır');
    });

    await t.step('mermi, ok ve patlama yerdeki silaha işlemez', async () => {
      const r = await p.evaluate(() => {
        clearDrops();
        const P = G.player;
        const g = new GunDrop(P.x + 30, P.y, 'repeater', 5); G.addEnt(g);
        let err = null;
        try {
          G.fireRay(P.x, P.y, 0, 200, 40, P, {});
          G.projs.push({ type: 'arrow', x: P.x + 8, y: P.y, vx: 420, vy: 0, life: 1.4, dmg: 60, owner: P, ang: 0 });
          for (let f = 0; f < 10; f++) G.update(1 / 30);
          G.explode(P.x + 34, P.y, P);
          for (let f = 0; f < 10; f++) G.update(1 / 30);
        } catch (e) { err = String(e); }
        return { err, alive: !g.remove && G.ents.includes(g), n: g.n };
      });
      t.eq(r.err, null, 'hata yok');
      t.ok(r.alive, 'silah yerinde');
      t.eq(r.n, 5, 'mermisi aynı');
    });

    await t.step('iki çizimde de yerdeki silah çizilir; her silah türü kendi boyunda', async () => {
      const r = await p.evaluate(() => {
        // her türü boş bir tuvale çiz: dolu piksel sayısı ve x boyu
        const size = {};
        for (const w of ['cattleman', 'schofield', 'repeater', 'winchester', 'rifle', 'shotgun', 'bow', 'knife']) {
          const c = document.createElement('canvas'); c.width = c.height = 64;
          const g = c.getContext('2d'); g.translate(32, 32); g.scale(2, 2);
          Spr.gunDrop(g, 0, 0, 0, w, 1);
          const d = g.getImageData(0, 0, 64, 64).data;
          let n = 0, x0 = 64, x1 = -1;
          for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (d[(y * 64 + x) * 4 + 3] > 120) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
          size[w] = { n, len: (x1 - x0 + 1) / 2 };
        }
        // oyunda: bir silah ekranda dururken iki çizimle de birkaç kare
        clearDrops();
        const P = G.player, gd = new GunDrop(P.x + 14, P.y + 6, 'winchester', 7); G.addEnt(gd);
        let err = null;
        try {
          for (const gfx of [0, 1, 0]) { G.settings.gfx = gfx; G.applySettings(); for (let f = 0; f < 6; f++) { G.update(1 / 30); G.render(1 / 30); } }
        } catch (e) { err = String(e); }
        return { size, err };
      });
      t.eq(r.err, null, 'iki çizimde de hata yok');
      for (const [w, s] of Object.entries(r.size)) t.ok(s.n > 12, `${w} çizildi`, s);
      t.ok(r.size.cattleman.len < 10 && r.size.rifle.len > 14, 'tabanca kısa, tüfek uzun', r.size);
      t.ok(r.size.rifle.len > r.size.repeater.len, 'uzun tüfek karabinadan uzun', r.size);
    });

    await t.step('yerdeki silah kaydedilir, Devam Et ile yerinde ve aynı mermiyle gelir', async () => {
      const before = await p.evaluate(() => {
        clearDrops();
        const P = G.player, g = new GunDrop(P.x + 20, P.y - 8, 'schofield', 3); g.ang = 1.25; G.addEnt(g);
        G.saveGame(true);
        return { x: g.x, y: g.y };
      });
      await p.evaluate(() => { UI.closeAll(); G.state = 'menu'; G.ents = []; return G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 120000 });
      const after = await p.evaluate(() => drops().map(g => ({ w: g.w, n: g.n, x: g.x, y: g.y, ang: g.ang })));
      const g = after.find(a => a.w === 'schofield');
      t.ok(g, 'silah geri geldi', after);
      t.ok(Math.hypot(g.x - before.x, g.y - before.y) < 1, 'aynı yerde', { g, before });
      t.eq([g.n, g.ang], [3, 1.25], 'aynı mermi ve açı');
    });
  },
};
