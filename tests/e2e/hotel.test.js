'use strict';
/* İki katlı otel: lobi düzeni (ortada resepsiyon, iki yanda merdiven, oturma köşeleri), merdivenle kat değişimi,
   üst katta dört oda (dolu ve boş odalar kilitli), resepsiyondan oda kiralama, kiralanan odanın kapısından geçip
   yatakta uyuma, üst katta kayıt ve yükleme, otel sahibine ücretsiz oda, alt kattakilerin gizlenmesi, iki çizici */
module.exports = {
  name: 'Otel',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const fade = () => t.sleep(900);   // merdivenin kısa kararması
    await p.evaluate(() => {
      UI.closeAll();
      G.godMode = true;
      G.clock = Math.floor(G.clock / 1440) * 1440 + 13 * 60;   // öğle
      window.HB = G.world.buildings.find(x => x.type === 'hotel' && x.town === 'harlow');
      window.HT = {
        idx: (lx, ly) => (HB.y + ly) * WW + HB.x + lx,
        /* karonun ortasına git (lx, ly yerel karo) */
        at(lx, ly) { TH.goto((HB.x + lx) * TS + 8, (HB.y + ly) * TS + 8); },
        objs(o) { let n = 0; for (let ly = 0; ly < HB.h; ly++) for (let lx = 0; lx < HB.w; lx++) if (G.world.obj[HT.idx(lx, ly)] === o) n++; return n; },
        /* oyuncunun yeri (yerel karo, kesirli) */
        loc() { const P = G.player; return [(P.x - HB.x * TS) / TS, (P.y - HB.y * TS) / TS]; },
        /* oda kapısının koridor tarafındaki karo ve odaya doğru yürüme tuşu */
        front(k) { const R = HOTEL_UP.rooms[k]; return R.side === 2 ? { lx: R.door[0], ly: R.door[1] + 1, key: 'KeyW' } : { lx: R.door[0], ly: R.door[1] - 1, key: 'KeyS' }; },
        /* oda kapısının çizgisini geçtin mi (arka odalarda kapı bandı karonun altında, öndekilerde üstünde) */
        inRoom(k) { const R = HOTEL_UP.rooms[k], ly = HT.loc()[1]; return R.side === 2 ? ly < R.door[1] + 0.75 : ly > R.door[1] + 0.375; },
        /* yatağın yanındaki boş karo */
        byBed(k) { const R = HOTEL_UP.rooms[k]; return R.side === 2 ? [R.bed[0] + (R.bed[0] < HB.w / 2 ? 1 : -1), R.bed[1]] : [R.bed[0] + (R.bed[0] < HB.w / 2 ? 1 : -1), R.bed[1] + 1]; },
        /* odanın ortası (yerel piksel; döşeme, eşya yok) ve odanın karanlık örtüyle kapalı olup olmadığı */
        mid: [[56, 30], [104, 30], [40, 105], [120, 105]],
        shut(k) { const [x, y] = HT.mid[k]; return hotelShut(HB).some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h); },
        /* ekranda odanın ortasının parlaklığı (tuvaldeki son kare, 5x5 ortalama) */
        luma(k) {
          const s = G.canvas.width / G.vw, [x, y] = HT.mid[k], cx = Math.round((HB.x * TS + x - G.cam.ox) * s), cy = Math.round((HB.y * TS + y - G.cam.oy) * s);
          const d = G.ctx.getImageData(cx - 2, cy - 2, 5, 5).data; let t = 0;
          for (let i = 0; i < d.length; i += 4) t += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          return Math.round(t / (d.length / 4));
        },
      };
      TH.inside(HB);
    });

    await t.step('lobi: resepsiyon tam ortada, iki yanda merdiven, önde oturma köşeleri', async () => {
      const r = await p.evaluate(() => {
        const o = (lx, ly) => G.world.obj[HT.idx(lx, ly)], counter = [], stairs = [];
        for (let lx = 0; lx < HB.w; lx++) if (o(lx, 2) === O.COUNTER) counter.push(lx);
        for (let ly = 0; ly < HB.h; ly++) for (let lx = 0; lx < HB.w; lx++) if (o(lx, ly) === O.STAIRS) stairs.push([lx, ly]);
        HT.at(4.5, 3);
        return { w: HB.w, h: HB.h, counter, staffX: HB.staff.x - HB.x * TS, stairs, sofa: HT.objs(O.SOFA), table: HT.objs(O.TABLE), plant: HT.objs(O.PLANT), bed: HT.objs(O.BED), acts: TH.actions(), floor: HB.floor || 0 };
      });
      t.eq([r.w, r.h], [10, 8], 'otel 10x8');
      t.eq(r.counter, [3, 4, 5, 6], 'tezgâh binanın ortasında');
      t.eq(r.staffX, 80, 'görevli tam ortada');
      t.eq(r.stairs, [[1, 1], [8, 1], [1, 2], [8, 2], [1, 3], [8, 3]], 'iki yanda merdiven');
      t.eq([r.sofa, r.table, r.plant], [4, 2, 2], 'iki oturma köşesi: dört kanepe, iki sehpa, iki saksı');
      t.eq([r.bed, r.floor], [0, 0], 'lobide yatak yok, zemin kat');
      t.eq(r.acts[0], 'Resepsiyon', 'tezgâh resepsiyon');
    });

    await t.step('aranırken üst kata çıkılmaz', async () => {
      const r = await p.evaluate(() => {
        HT.at(1, 4); G.law.level = 1; TH.feeds.length = 0;
        TH.act(/Üst Kata Çık/);
        const out = { feeds: TH.feeds.slice(), fade: UI.state === 'fade' };
        G.law.level = 0;   // aynı karede geri al: kanun adamı doğmasın
        return out;
      });
      await t.sleep(400);
      t.ok(r.feeds.some(f => /Kanun peşindeyken/.test(f)), 'görevli durdurur', r.feeds);
      t.ok(!r.fade && !(await p.evaluate(() => !!G.upB)), 'kat değişmedi');
    });

    await t.step('merdivenden üst kata çık: dört oda, kapılar kilitli', async () => {
      const a = await p.evaluate(() => { HT.at(1, 4); return TH.actions(); });
      t.eq(a, ['Merdiven', 'Üst Kata Çık'], 'merdiven etkileşimi');
      await p.evaluate(() => TH.act(/Üst Kata Çık/));
      await fade();
      const r = await p.evaluate(() => ({
        up: G.upB === HB, floor: HB.floor, loc: HT.loc(), rdoor: HT.objs(O.RDOOR), bed: HT.objs(O.BED), down: HT.objs(O.STAIRSD),
        lobby: HT.objs(O.COUNTER) + HT.objs(O.SOFA) + HT.objs(O.STAIRS), open: HB.openRoom, occ: [0, 1, 2, 3].map(k => G.hotelOccupied(HB, k)), acts: TH.actions(), shut: [0, 1, 2, 3].map(k => HT.shut(k)),
        blocked: G.world.blocked(G.player.x, G.player.y, G.player.r),
      }));
      t.ok(r.up && r.floor === 1, 'üst kattayız', r);
      t.eq(r.loc, [1.5, 4.5], 'merdivenin başındaki karoya çıkıldı');
      t.ok(!r.blocked, 'çıkılan yer boş');
      t.eq([r.rdoor, r.down], [4, 6], 'dört oda kapısı, iki merdiven boşluğu');
      t.eq(r.bed, 0, 'kira yokken odaların içi boş (eşya yok)');
      t.eq(r.shut, [true, true, true, true], 'bütün odalar kilitli: içleri karanlık örtüyle kapalı');
      t.eq(r.lobby, 0, 'lobinin eşyaları üst katta yok');
      t.eq(r.open, -1, 'kira yokken bütün kapılar kapalı');
      t.eq(r.acts, ['Merdiven', 'Alt Kata İn'], 'aşağı inen merdiven');
      t.ok(r.occ.some(x => x) && r.occ.some(x => !x), 'bazı odalar dolu, en az biri boş', r.occ);
    });

    await t.step('dolu ve boş odaların kapıları kilitli; içeri yürünemez', async () => {
      const r = await p.evaluate(() => [0, 1, 2, 3].map(k => {
        const f = HT.front(k); HT.at(f.lx, f.ly);
        const acts = TH.actions(); TH.feeds.length = 0; TH.act(/Kilitli/);
        return { k, occ: G.hotelOccupied(HB, k), acts, feed: TH.feeds[0] || '' };
      }));
      for (const x of r) {
        t.eq(x.acts, [`${x.k + 1} Numaralı Oda`, x.occ ? 'Kilitli (Dolu)' : 'Kilitli'], `oda ${x.k + 1}`);
        t.ok(x.occ ? /Oda dolu|Meşgul/.test(x.feed) : /Resepsiyondan kiralayabilirsin/.test(x.feed), `oda ${x.k + 1} mesajı`, x.feed);
      }
      // gerçek girdiyle: arka ve ön odaların kilitli kapısına yürü
      for (const k of [0, 2]) {
        const f = await p.evaluate((k) => { const f = HT.front(k); HT.at(f.lx, f.ly); return f; }, k);
        await p.keyboard.down(f.key); await t.sleep(800); await p.keyboard.up(f.key);
        const st = await p.evaluate((k) => ({ inRoom: HT.inRoom(k), loc: HT.loc() }), k);
        t.ok(!st.inRoom, `kilitli oda ${k + 1}: kapıdan geçilmez`, st);
      }
      // yan duvarla yatak arasındaki dar boşluktan da öndeki odalara sızılmaz
      for (const [k, px] of [[2, 10.5], [3, 149.5]]) {
        await p.evaluate((px) => TH.goto(HB.x * TS + px, (HB.y + 4) * TS + 8), px);
        const free = await p.evaluate(() => !G.world.blocked(G.player.x, G.player.y, G.player.r));
        await p.keyboard.down('KeyS'); await t.sleep(800); await p.keyboard.up('KeyS');
        const st = await p.evaluate((k) => ({ inRoom: HT.inRoom(k), loc: HT.loc() }), k);
        t.ok(free && !st.inRoom, `oda ${k + 1}: yan duvar boyunca girilmez`, st);
      }
    });

    await t.step('üst kattayken alt kattakiler görünmez, etkileşilmez ve bekler', async () => {
      // lobide merdiven başında duran biri; üst katta oyuncu tam onun yerinde
      await p.evaluate(() => { HT.at(1, 4); TH.act(/Alt Kata İn/); });
      await fade();
      const r0 = await p.evaluate(() => {
        const x = (HB.x + 1) * TS + 12, y = (HB.y + 4) * TS + 12;
        const n = new NPC(x, y, 'clerk', { state: 'static', home: { x, y, r: 6 } }); n.town = HB.town; n.name = 'Lobi Konuğu';
        G.addEnt(n); window.HN = n;
        return { floor: HB.floor, up: !!G.upB, lobby: HT.objs(O.COUNTER), acts: TH.actions() };
      });
      t.eq([r0.floor, r0.up, r0.lobby], [0, false, 4], 'zemin kata inildi, lobi geri geldi');
      t.eq(r0.acts[0], 'Lobi Konuğu', 'aşağıda konuk etkileşilir');
      await p.evaluate(() => G.hotelStairs(HB, HT.idx(1, 3)));   // konuk istemin önünde: merdiveni doğrudan kullan
      await fade();
      const x0 = await p.evaluate(() => [HN.x, HN.y]);
      await t.sleep(700);
      const r = await p.evaluate(() => ({ hid: G.floorHid(HN), up: G.upB === HB, acts: TH.actions(), pos: [HN.x, HN.y], d: dist(HN.x, HN.y, G.player.x, G.player.y) }));
      t.ok(r.up && r.hid, 'üst katta konuk gizli', r);
      t.ok(r.d < 10, 'konuk oyuncunun hemen yanında (aşağıda)', r.d);
      t.eq(r.acts, ['Merdiven', 'Alt Kata İn'], 'gizli konuk etkileşime girmez');
      t.eq(r.pos, x0, 'gizli konuk yerinde bekler');
      await p.evaluate(() => TH.act(/Alt Kata İn/));
      await fade();
      t.ok(await p.evaluate(() => !G.floorHid(HN) && TH.actions()[0] === 'Lobi Konuğu'), 'aşağı inince konuk yine görünür');
      await p.evaluate(() => { HN.remove = true; });
    });

    await t.step('resepsiyondan oda kirala: ücret ödenir, boş bir oda senin olur', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; P.money = 50;
        HT.at(4.5, 3); UI.closeAll(); UI.openBuilding(HB);
        const labels = TH.menuLabels(), cost = SVC.room * G.priceMul(true), m0 = P.money;
        TH.feeds.length = 0;
        const ok = TH.clickItem(/Oda Kirala/);
        const k = G.hotelRoom(HB), paid = m0 - P.money, feeds = TH.feeds.slice();
        G.rentRoom(HB);   // ikinci kez: zaten senin, ücret yok
        return { labels, ok, cost, paid, paid2: m0 - P.money, k, occ: G.hotelOccupied(HB, k), feeds, again: TH.feeds.slice(-1)[0], until: G.hotelRent.until - G.clock };
      });
      t.ok(r.labels.includes('Oda Kirala') && r.ok, 'menüde Oda Kirala', r.labels);
      t.near(r.paid, r.cost, 1e-6, 'oda ücreti ödendi');
      t.near(r.paid2, r.cost, 1e-6, 'ikinci kez ücret alınmaz');
      t.ok(r.k >= 0 && r.k < 4 && !r.occ, 'boş bir oda kiralandı', r);
      t.ok(r.feeds.some(f => new RegExp(`${r.k + 1} numaralı odayı kiraladın`).test(f)), 'kira mesajı', r.feeds);
      t.ok(/zaten senin/.test(r.again), 'zaten kiralı', r.again);
      t.near(r.until, 1440, 0.01, 'kira bir gün');
      const lab = await p.evaluate(() => { UI.closeAll(); UI.openBuilding(HB); const L = TH.menuLabels(); UI.closeAll(); return L; });
      t.ok(lab.some(l => /^Odan: \d Numara$/.test(l)) && !lab.includes('Oda Kirala'), 'menüde kiralık odan görünür', lab);
    });

    let room;
    await t.step('üst katta kiralanan odanın kapısı açık: içeri yürünür, yatakta uyunur', async () => {
      await p.evaluate(() => { UI.closeAll(); HT.at(8, 4); TH.act(/Üst Kata Çık/); });
      await fade();
      const st = await p.evaluate(() => { const k = G.hotelRoom(HB), f = HT.front(k); HT.at(f.lx, f.ly); return { k, f, open: HB.openRoom, loc: HT.loc(), up: G.upB === HB, acts: TH.actions() }; });
      room = st.k;
      t.ok(st.up, 'sağdaki merdivenden de çıkılır');
      t.eq(st.open, st.k, 'kiralanan odanın kapısı açık');
      const vis = await p.evaluate((k) => ({ beds: HT.objs(O.BED), bedIn: G.world.obj[HT.idx(...HOTEL_UP.rooms[k].bed)] === O.BED, shut: [0, 1, 2, 3].map(q => HT.shut(q)) }), st.k);
      t.ok(vis.beds === 1 && vis.bedIn, 'yalnızca kiralanan odada eşya var', vis);
      t.eq(vis.shut, [0, 1, 2, 3].map(q => q !== st.k), 'kiralanan oda açık, öbürlerinin içi kapalı');
      t.eq(st.acts, [], 'açık kapı engel değil, etkileşim yok');
      await p.keyboard.down(st.f.key); await t.sleep(900); await p.keyboard.up(st.f.key);
      const inn = await p.evaluate((k) => ({ inRoom: HT.inRoom(k), loc: HT.loc() }), st.k);
      t.ok(inn.inRoom, 'kapıdan odaya yürünür', inn);
      const r = await p.evaluate(() => {
        const k = G.hotelRoom(HB), [lx, ly] = HT.byBed(k); HT.at(lx, ly);
        window.QE = []; const q0 = G.qEvent; G.qEvent = function (ev, d) { QE.push([ev, d]); return q0.call(this, ev, d); };
        const P = G.player; P.energy = 30;
        const acts = TH.actions(); TH.act(/^Uyu$/);
        const labels = TH.menuLabels();
        window.S0 = { clock: G.clock, money: P.money };
        TH.clickItem(/8 Saat Uyu/);
        return { acts, labels };
      });
      t.eq(r.acts, [`${st.k + 1} Numaralı Oda`, 'Uyu'], 'odadaki yatak');
      t.ok(r.labels.includes('8 Saat Uyu'), 'uyku menüsü', r.labels);
      await t.sleep(2200);
      const s = await p.evaluate(() => {
        const d = JSON.parse(Platform.get(slotKey(G.slot, 'auto')));
        return { dt: G.clock - S0.clock, paid: S0.money - G.player.money, energy: G.player.energy, ev: QE.filter(e => e[0] === 'sleep').map(e => e[1]), up: G.upB === HB, saveUp: d.upB, id: HB.id, saveRoom: d.hotelRent && d.hotelRent.room };
      });
      t.near(s.dt, 480, 10, '8 saat uyundu');   // uyandıktan sonra saat gerçek zamanla da biraz ilerler
      t.near(s.paid, 0, 1e-6, 'kiralık odada uyumak ücretsiz');
      t.ok(s.energy > 90, 'uyku doldu', s.energy);
      t.eq(s.ev, ['hotel'], 'otelde uyuma olayı');
      t.ok(s.up, 'uyandıktan sonra hâlâ üst katta');
      t.eq([s.saveUp, s.saveRoom], [s.id, st.k], 'kayıtta üst kat ve oda');
    });

    await t.step('üst katta kaydedilen oyun yine üst katta, odanın içinde açılır', async () => {
      const id = await p.evaluate(() => HB.id);
      await p.evaluate(async () => { G.saveGame(true); await G.loadGame(G.slot, 'auto'); });
      await t.sleep(800);
      const r = await p.evaluate((id) => {
        window.HB = G.world.buildings[id];
        const k = G.hotelRoom(HB), [lx, ly] = HT.byBed(k); HT.at(lx, ly);
        return { up: G.upB === HB, floor: HB.floor, k, open: HB.openRoom, rdoor: HT.objs(O.RDOOR), acts: TH.actions(), blocked: G.world.blocked(G.player.x, G.player.y, G.player.r) };
      }, id);
      t.ok(r.up && r.floor === 1, 'üst kat geri kuruldu', r);
      t.eq([r.k, r.open, r.rdoor], [room, room, 4], 'kiralık oda ve açık kapısı');
      t.eq(r.acts, [`${room + 1} Numaralı Oda`, 'Uyu'], 'yatak yine kullanılabilir');
      t.ok(!r.blocked, 'oyuncu duvarın içinde değil');
    });

    await t.step('başka yolla binadan çıkınca (ışınlanma) otel zemin katına döner', async () => {
      await p.evaluate(() => { const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); });
      await t.sleep(500);
      const r = await p.evaluate(() => ({ up: G.upB, floor: HB.floor, counter: HT.objs(O.COUNTER), stairs: HT.objs(O.STAIRS), rdoor: HT.objs(O.RDOOR), doorSolid: G.world.solid[HB.doorI] }));
      t.eq([r.up, r.floor, r.counter, r.stairs, r.rdoor], [null, 0, 4, 6, 0], 'lobi geri geldi', r);
      t.eq(r.doorSolid, 3, 'giriş kapısı yine kapı');
    });

    await t.step('otel senin işletmense oda ücretsiz', async () => {
      const r = await p.evaluate(() => {
        G.hotelRent = null;
        const P = G.player; P.money += G.bizPrice(HB) + 5;
        const bought = G.buyBiz(HB);
        HT.at(4.5, 3); UI.closeAll(); UI.openBuilding(HB);
        const it = [...UI.top().el.querySelectorAll('.p-item')].find(n => (n.querySelector('.pi-l') || {}).textContent === 'Oda Kirala');
        const right = it && it.querySelector('.pi-r') ? it.querySelector('.pi-r').textContent : null;
        const m0 = P.money; TH.feeds.length = 0;
        if (it) it.click();
        UI.closeAll();
        return { bought, right, paid: m0 - P.money, k: G.hotelRoom(HB), feeds: TH.feeds.slice() };
      });
      t.ok(r.bought, 'otel satın alındı');
      t.eq(r.right, 'Ücretsiz', 'menüde ücretsiz');
      t.near(r.paid, 0, 1e-6, 'ücret alınmadı');
      t.ok(r.k >= 0, 'oda verildi');
      t.ok(r.feeds.some(f => /Kendi otelin/.test(f)), 'sahibine mesaj', r.feeds);
    });

    await t.step('yatağa duvarın öbür yanından uzanılmaz; merdiven başında merdiven kullanılır', async () => {
      for (const k of [2, 3]) {   // öndeki odaların yatakları merdiven başının hemen güneyinde, duvarın ardında
        const r = await p.evaluate((k) => {
          G.hotelRent = { b: HB.id, room: k, until: G.clock + 1440 };
          const [lx, ly] = HOTEL_UP.land[k === 2 ? 0 : 1];
          HT.at(lx, ly); G.setFloor(HB, 1);
          const land = TH.actions();
          const [bx, by] = HT.byBed(k); HT.at(bx, by);
          const bed = TH.actions();
          HT.at(lx, ly); G.setFloor(HB, 0);
          return { land, bed };
        }, k);
        t.eq(r.land, ['Merdiven', 'Alt Kata İn'], `oda ${k + 1}: merdiven başında merdiven`);
        t.eq(r.bed, [`${k + 1} Numaralı Oda`, 'Uyu'], `oda ${k + 1}: odanın içinden yatak`);
      }
    });

    await t.step('iki çizicide de katlar hatasız çizilir; kilitli odaların içi ekranda görünmez (Melez ve Klasik)', async () => {
      await p.evaluate(() => { G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 13 * 60; G.hotelRent = { b: HB.id, room: 1, until: G.clock + 1440 }; });   // ertesi gün öğle; 2 numaralı oda (arkada sağda) kiralık
      for (const gfx of [0, 1]) {
        // ekran kartı olmayan test tarayıcısında melez çizim yalnızca zorlanınca açılır
        const on = await p.evaluate((g) => { window.__hySoft = true; G.settings.gfx = g; G.applySettings(); HT.at(1, 4); return G.hybridOn(); }, gfx);
        t.eq(on, gfx === 0, `çizici ${gfx}: ${gfx ? 'Klasik' : 'Melez'}`);
        await t.sleep(700);
        const f0 = await p.evaluate(() => HY.stat.frames);
        await p.evaluate(() => TH.act(/Üst Kata Çık/));
        await fade(); await t.sleep(500);
        const up = await p.evaluate(() => [G.upB === HB, HB.floor, TH.actions()]);
        // parçalar pişene kadar bekle: kilitli odaların ortası karanlık, kiralanan oda aydınlık
        const ok = await p.waitForFunction(() => { const L = [0, 1, 2, 3].map(k => HT.luma(k)); return L[1] > 50 && [0, 2, 3].every(k => L[k] < L[1] * 0.6); }, null, { timeout: 10000 }).then(() => true, () => false);
        const lum = await p.evaluate(() => [0, 1, 2, 3].map(k => HT.luma(k)));
        t.ok(ok, `çizici ${gfx}: kilitli odalar karanlık, kiralanan oda görünür`, lum);
        await p.evaluate(() => TH.act(/Alt Kata İn/));
        await fade(); await t.sleep(500);
        const down = await p.evaluate(() => [!G.upB, HB.floor || 0, HY.stat.frames]);
        t.ok(up[0] && up[1] === 1 && down[0] && down[1] === 0, `çizici ${gfx}: çıkılıp inildi`, { up, down });
        if (!gfx) t.ok(down[2] > f0 + 10, 'melez çizim kareleri çizildi', [f0, down[2]]);
      }
    });
  },
};
