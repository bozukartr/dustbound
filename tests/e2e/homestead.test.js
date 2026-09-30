'use strict';
/* Kendi yapın: yer seçimi, tapu/kaçak, aşamalı inşaat, iç tasarım, ekler, ihbar ve mühür, kayıt */
module.exports = {
  name: 'Yapı kurma',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      G.godMode = true;
      /* Uygun bir arazi bul (verilen noktaya en yakın) */
      window.HS = {
        spot(fx, fy, skip) {
          const W = G.world, out = [];
          for (let ty = 10; ty < WH - 30; ty += 5) for (let tx = 10; tx < WW - 30; tx += 5) {
            if (G.homeCheck(tx, ty)) continue;
            if (skip && skip.some(([x, y]) => Math.abs(x - tx) < 60 && Math.abs(y - ty) < 60)) continue;
            out.push([tx, ty, Math.hypot(tx - fx, ty - fy)]);
          }
          out.sort((a, c) => a[2] - c[2]);
          return out[0] || null;
        },
        stand(tx, ty) { TH.goto((tx + (HOME_FW >> 1)) * TS + 8, (ty + HOME_FH - 2) * TS + 8); TH.clearNpcs(); },
        objs(h, o) { let n = 0; for (let y = h.ty; y < h.ty + HOME_FH; y++) for (let x = h.tx; x < h.tx + HOME_FW; x++) if (G.world.obj[y * WW + x] === o) n++; return n; },
        days(n) { for (let k = 0; k < n; k++) G.advanceClock(1440); },
      };
    });
    await t.step('her yere kurulamaz: kasaba, su ve yol reddedilir; uygun yer bulunur', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, tw = TH.town('harlow');
        const town = G.homeCheck(tw.x + 2, tw.y + 2);
        let water = null, road = null;
        for (let i = 0; i < WW * WH && (!water || !road); i += 97) {
          const x = i % WW, y = (i / WW) | 0; if (x < 20 || y < 20 || x > WW - 40 || y > WH - 40 || W.townAt(x * TS, y * TS, 30)) continue;
          if (!water && W.tile[i] === T.WATER) water = G.homeCheck(x - 9, y - 5);
          if (!road && W.tile[i] === T.ROAD) road = G.homeCheck(x - 9, y - 5);
        }
        const s = HS.spot(tw.x + 120, tw.y); window.S1 = s;
        return { town, water, road, spot: !!s };
      });
      t.ok(/Kasaba/.test(r.town), 'kasabada reddedilmeli', r.town);
      t.ok(r.water, 'suda reddedilmeli'); t.ok(r.road, 'yolda reddedilmeli', r.road);
      t.ok(r.spot, 'uygun bir arazi bulunmalı');
    });
    await t.step('uygun olmayan yerde kazık uyarı verir; uygun yerde plan menüsü açılır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, tw = TH.town('harlow'); UI.closeAll();
        P.addItem('stakes', 2, true);
        TH.goto(tw.cx, tw.cy + 40); TH.feeds.length = 0; G.consume('stakes');
        const warned = TH.feeds.some(f => /Kasaba/.test(f)) && !UI.isModal() && G.homePreview && G.homePreview.bad;
        HS.stand(S1[0], S1[1]); G.consume('stakes');
        const labels = TH.menuLabels();
        return { warned, labels, spot: G.homeSpotAt(P.x, P.y), preview: G.homePreview && !G.homePreview.bad };
      });
      t.ok(r.warned, 'kasabada uyarı ve kırmızı önizleme');
      t.eq(r.spot, await p.evaluate(() => [S1[0], S1[1]]), 'oyuncunun durduğu yer araziyi belirler');
      t.eq(r.labels.length, 6, 'üç yapı × tapulu/kaçak', r.labels);
      t.ok(r.preview, 'sarı önizleme');
    });
    await t.step('tapusuz tapulu seçenek kapalı; tapu dairesinden tapu alınır, tapulu kulübe başlar', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; P.money = 500;
        const m = UI.top(); const legal = m.items.find(i => i.label === BUILDINGS.hs_cabin.n);
        const locked = legal.disabled;
        UI.closeAll();
        const office = G.world.buildings.find(b => b.type === 'land');
        UI.svcItems(office, 'property').find(i => /Arazi Tapusu/.test(i.label)).fn();
        const deed = P.count('land_deed');
        HS.stand(S1[0], S1[1]); G.consume('stakes');
        const m0 = P.money;
        UI.top().items.find(i => i.label === BUILDINGS.hs_cabin.n).fn();
        const h = G.homes[0]; window.H1 = h;
        return { locked, deed, spent: m0 - P.money, deedLeft: P.count('land_deed'), stakes: P.count('stakes'), legal: h && h.legal, type: h && h.type, planks: (() => { let n = 0; const rr = G.homeRect(h); for (let y = rr.y; y < rr.y + rr.h; y++) for (let x = rr.x; x < rr.x + rr.w; x++) if (G.world.tile[y * WW + x] === T.PLANK) n++; return n; })(), crates: HS.objs(h, O.CRATE), modal: UI.isModal() };
      });
      t.ok(r.locked, 'tapu yokken tapulu seçenek kapalı'); t.eq(r.deed, 1, 'tapu alındı');
      t.eq(r.spent, 80, 'kulübe $80'); t.eq(r.deedLeft, 0, 'tapu harcandı'); t.eq(r.stakes, 1, 'kazık harcandı');
      t.ok(r.legal, 'tapulu'); t.eq(r.type, 'hs_cabin', 'tür'); t.eq(r.planks, 42, 'döşeme'); t.ok(r.crates >= 2, 'malzeme sandıkları'); t.ok(!r.modal, 'menü kapandı');
    });
    await t.step('tabeladan şantiyede çalışılır (günde iki kez), iş ilerler ve zaman geçer', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, rr = G.homeRect(H1);
        G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 8 * 60;   // yeni günün sabahı
        const w0 = H1.work;
        TH.goto((rr.x - 1) * TS + 8, (rr.y + rr.h) * TS + 22); TH.clearNpcs(); P.energy = 90;
        const acts = TH.actions();
        const c0 = G.clock; TH.act(/Şantiyede Çalış/); const dt = G.clock - c0;
        TH.act(/Şantiyede Çalış/); TH.feeds.length = 0; TH.act(/Şantiyede Çalış/);
        return { acts, gained: H1.work - w0, dt, refused: TH.feeds.some(f => /yeterince/.test(f)), energy: P.energy };
      });
      t.ok(r.acts[0] && /İnşaatı/.test(r.acts[0]) && r.acts.some(a => /Çalış/.test(a)), 'tabela etkileşimi', r.acts);
      t.eq(r.gained, 1, 'iki çalışma = bir günlük iş'); t.eq(r.dt, 120, 'iki saat geçer'); t.ok(r.refused, 'üçüncüsü reddedilir'); t.ok(r.energy < 70, 'yorulur');
    });
    await t.step('ek yapılar bitmemiş yapıya kurulamaz; günler geçince iskelet yükselir, yapı tamamlanır', async () => {
      const r = await p.evaluate(() => {
        const early = G.homeAddon(H1, 'well');
        HS.days(1); const walls = HS.objs(H1, O.RUINWALL);
        HS.days(4);
        const b = G.homeBuilding(H1);
        let bed = 0, chest = 0, stove = 0;
        if (b) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const o = G.world.obj[y * WW + x]; bed += o === O.BED; chest += o === O.HOMECHEST; stove += o === O.STOVE; }
        window.B1 = b;
        return { early, walls, done: H1.done, b: !!b, enter: b && b.enter, open: b && G.doorOpen(b), bed, chest, stove, poi: G.world.pois.some(q => q.kind === 'home' && G.discovered.has(q.id)), stat: G.stats.homesBuilt };
      });
      t.ok(!r.early, 'bitmeden ek yok'); t.ok(r.walls > 0, 'iskelet görünür');
      t.ok(r.done && r.b && r.enter, 'yapı tamamlandı ve girilebilir'); t.ok(r.open, 'kapı sahibine açık');
      t.eq([r.bed, r.chest, r.stove], [1, 1, 1], 'kulübede yatak, sandık, ocak'); t.ok(r.poi, 'haritada işaretli'); t.eq(r.stat, 1, 'istatistik');
    });
    await t.step('içeride yatakta uyunur/kayıt yapılır, sandık açılır', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); TH.inside(B1);
        const bed = G.furnActions(B1, O.BED), chest = G.furnActions(B1, O.HOMECHEST), stove = G.furnActions(B1, O.STOVE);
        return { bed: bed && bed.acts.map(a => a.n), chest: chest && chest.acts.map(a => a.n), stove: stove && stove.acts.map(a => a.n), inside: G.world.buildingAtPx(G.player.x, G.player.y) === B1 };
      });
      t.ok(r.inside, 'içeride'); t.ok(r.bed.includes('Uyu') && r.bed.includes('Oyunu Kaydet'), 'yatak', r.bed);
      t.ok(r.chest.includes('Sandığı Aç'), 'sandık'); t.ok(r.stove.includes('Yemek Pişir'), 'ocak');
    });
    await t.step('ahır, kuyu ve bostan eklenir; yemlikte at dinlenir', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.money = 500;
        const ok = ['stable', 'well', 'garden'].map(k => G.homeAddon(H1, k));
        const dup = G.homeAddon(H1, 'well');
        HS.days(5);
        const res = { ok, dup, done: H1.addons.every(a => a.done), well: HS.objs(H1, O.WELL), crops: HS.objs(H1, O.CROP), trough: HS.objs(H1, O.TROUGH) };
        // yemlik
        let ti = -1; for (let y = H1.ty; y < H1.ty + HOME_FH; y++) for (let x = H1.tx; x < H1.tx + HOME_FW; x++) if (G.world.obj[y * WW + x] === O.TROUGH) ti = y * WW + x;
        const tx = (ti % WW) * TS + 8, ty = ((ti / WW) | 0) * TS + 8;
        TH.goto(tx + 14, ty + 4); TH.clearNpcs();
        const h = G.horse; h.dead = false; h.x = tx + 30; h.y = ty + 20; h.hp = 10; h.sta = 5;
        res.acts = TH.actions(); TH.act(/Atını Besle/);
        res.horse = h.hp === h.maxHp && h.sta === h.maxSta;
        return res;
      });
      t.eq(r.ok, [true, true, true], 'ekler başlar'); t.ok(!r.dup, 'aynı ek iki kez kurulmaz'); t.ok(r.done, 'ekler biter');
      t.eq(r.well, 1, 'kuyu'); t.eq(r.crops, 8, 'bostanda 8 mısır'); t.eq(r.trough, 1, 'yemlik');
      t.ok(r.acts.some(a => /Atını Besle/.test(a)), 'yemlik seçeneği', r.acts); t.ok(r.horse, 'at dinlendi');
    });
    await t.step('kaçak baraka: ihbar, 3 gün sonra mühür, kapı kapanır; tapuya bağlanınca açılır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; UI.closeAll(); P.money = 500;
        const s = HS.spot(S1[0] + 150, S1[1] + 80, [[H1.tx, H1.ty]]);
        if (!s) return { err: 'ikinci arazi yok' };
        HS.stand(s[0], s[1]); P.addItem('stakes', 1, true);
        const ok = G.homeStart(s[0], s[1], 'hs_shack', false);
        const h = G.homes[1]; window.H2 = h;
        HS.days(3);
        const built = h.done;
        const rr = Math.random; Math.random = () => 0; HS.days(1); Math.random = rr;
        const notice = h.notice;
        HS.days(3);
        const b = G.homeBuilding(h); window.B2 = b;
        const sealed = h.sealed, open = G.doorOpen(b);
        TH.goto(b.door.x, b.door.y + 10); TH.clearNpcs();
        const door = TH.actions();
        const office = G.world.buildings.find(x => x.type === 'county') || G.world.buildings.find(x => x.type === 'land');
        const item = UI.svcItems(office, 'property').find(i => /Tapuya Bağla/.test(i.label));
        const m0 = P.money; if (item) item.fn();
        return { ok, built, notice: notice > 0, sealed, open, door, item: !!item, paid: m0 - P.money, legal: h.legal, unsealed: !h.sealed, open2: G.doorOpen(b) };
      });
      t.ok(!r.err, r.err); t.ok(r.ok && r.built, 'kaçak baraka biter');
      t.ok(r.notice, 'ihbar'); t.ok(r.sealed && !r.open, 'mühürlenir, kapı kapanır');
      t.ok(r.door.some(a => /Mühürlü/.test(a)), 'mühürlü kapı', r.door);
      t.ok(r.item, 'tapuya bağlama seçeneği'); t.eq(r.paid, 50, 'tapu + ceza'); t.ok(r.legal && r.unsealed && r.open2, 'yasallaştı');
    });
    await t.step('iç tasarımlar farklıdır; kayıt/yükleme yapıları, ekleri ve tasarımı korur', async () => {
      const r = await p.evaluate(async () => {
        const sig = (b) => { const a = []; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const o = G.world.obj[y * WW + x]; if (isFurnO(o)) a.push((x - b.x) + ',' + (y - b.y) + ':' + o); } return a.join(' '); };
        // üç tasarımı dünyanın ıssız bir köşesinde dene
        const sigs = [0, 1, 2].map(d => sig(G.world.addBuilding('hs_house', 30 + d * 12, 30, null, 'x', { home: -9, design: d })));
        const before = { d: H1.design, s: sig(B1), n: G.homes.length, crops: HS.objs(H1, O.CROP), well: HS.objs(H1, O.WELL) };
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const h = G.homes.find(x => x.id === H1.id), b = G.homeBuilding(h);
        return { distinct: new Set(sigs).size, before, after: { d: h.design, s: b && sig(b), n: G.homes.length, crops: HS.objs(h, O.CROP), well: HS.objs(h, O.WELL) }, legal2: G.homes[1].legal };
      });
      t.eq(r.distinct, 3, 'üç farklı iç tasarım');
      t.eq(r.after, r.before, 'kayıttan sonra aynı'); t.ok(r.legal2, 'ikinci yapı tapulu kaldı');
    });
  },
};
