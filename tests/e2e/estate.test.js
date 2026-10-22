'use strict';
/* Saint Clement malikanesi, hizmetçiler, özel kulüp, bilardo ve özel fayton: dünya sürümü 5 yerleşimi (eski sürümde yok),
   satın alma ve kapı, iki kat ve dört oda (duvarın ardındaki eşya çıkmaz), ev işlevleri, hizmetçiler (kahvaltı, ganimet,
   seyis, ücret), kulüp üyeliği ve üyelere açık eşyalar, yüksek bahisli poker, bilardo fiziği ve rakip, fayton yolculuğu
   (izleme, basılı tutarak atlama, saldırıda durma), kayıt; iki çizicide hatasız çizim */
module.exports = {
  name: 'Malikane, kulüp ve özel fayton',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = true; TH.clearNpcs();
      G.clock = Math.floor(G.clock / 1440) * 1440 + 13 * 60;
      const tw = TH.town('stclement');
      window.MB = tw.buildings.find(b => b.type === 'mansion'); window.CB = tw.buildings.find(b => b.type === 'club');
      G.visited.add('stclement');
      // binanın yerel karosunun ortasına git, istemi döndür
      window.AT = (b, lx, ly) => { TH.goto((b.x + lx) * TS + 8, (b.y + ly) * TS + 8); return TH.actions(); };
    });

    await t.step('dünya sürümü 5: Saint Clement\'te yan bahçeli malikane ve kulüp; eski sürümde yoklar', async () => {
      const r = await p.evaluate(async () => {
        const W = G.world, g = MB && MB.garden;
        const objIn = (o) => { let n = 0; for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) if (W.obj[y * WW + x] === o) n++; return n; };
        const houses = (w) => w.towns.find(x => x.id === 'stclement').buildings.filter(b => b.type === 'house').length;
        const keep = WGEN;
        WGEN = 4;
        const w4 = new World(G.seed); await w4.generate(() => {});
        WGEN = keep;
        const t4 = w4.towns.find(x => x.id === 'stclement');
        return {
          wgen: WGEN, names: [MB && MB.name, CB && CB.name], mansions: W.buildings.filter(b => b.type === 'mansion').length, clubs: W.buildings.filter(b => b.type === 'club').length,
          garden: !!g && g.x === MB.x + MB.w && g.h === MB.h, fountain: g && objIn(O.FOUNTAIN), hedge: g && objIn(O.HEDGE), rooms: [upPlan(MB).rooms.length, upPlan(CB).rooms.length],
          old: { mansion: t4.buildings.some(b => b.type === 'mansion'), club: t4.buildings.some(b => b.type === 'club') }, extraHouses: houses(w4) - houses(W),
        };
      });
      t.ok(r.wgen >= 5, 'yeni oyun dünya sürümü 5', r.wgen);
      t.eq([r.mansions, r.clubs], [1, 1], 'tek malikane ve tek kulüp');
      t.eq(r.names, ['Saint Clement Malikanesi', 'Saint Clement Kulübü'], 'adları');
      t.ok(r.garden && r.fountain === 1 && r.hedge > 10, 'malikanenin yanında çitli, çeşmeli bahçe', r);
      t.eq(r.rooms, [4, 2], 'malikanenin üst katında dört oda, kulübün iki');
      t.eq(r.old, { mansion: false, club: false }, 'eski kayıtların dünyasında (sürüm 4) yoklar');
      t.eq(r.extraHouses, 3, 'yerlerine üç ev eksildi');
    });

    await t.step('malikane: kapı kilitli, incelenip satın alınır; kapı sahibine açılır', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; P.money = 9000;
        const door0 = G.doorOpen(MB);
        TH.goto(MB.door.x, MB.door.y + 12);
        const acts = TH.actions();
        TH.act(/Malikaneyi İncele/);
        const menu = TH.menuLabels();
        const m0 = P.money, price = G.mansionPrice();
        TH.clickItem(/Malikaneyi Satın Al/);
        return { door0, acts, menu, paid: Math.round((m0 - P.money) * 100) / 100, price, estate: !!G.estate && G.estate.bid === MB.id, door1: G.doorOpen(MB), open: !!UI.top() };
      });
      t.ok(!r.door0, 'satın almadan kapı kilitli');
      t.ok(r.acts.includes('Malikaneyi İncele'), 'kapıda incele seçeneği', r.acts);
      t.ok(r.menu.includes('Malikaneyi Satın Al'), 'satın alma menüsü', r.menu);
      t.ok(r.price >= 3000, 'fiyat', r.price);
      t.eq(r.paid, r.price, 'fiyat ödendi'); t.ok(r.estate && r.door1, 'malikane senin, kapı açık', r);
      t.ok(!r.open, 'menü kapandı');
    });

    await t.step('iki kat: salon eşyaları, üst katta dört oda; eşyalar yalnızca kendi odasından kullanılır', async () => {
      await p.evaluate(() => { UI.closeAll(); TH.clearNpcs(); TH.inside(MB); });
      await t.sleep(300);
      const r = await p.evaluate(() => {
        const out = { inside: G.insideB === MB };
        out.table = AT(MB, 3, 7);
        G.setFloor(MB, 1);
        out.up = [G.upB === MB, MB.floor];
        TH.goto((MB.x + 2) * TS + 2, (MB.y + 7) * TS + 6); out.bed = TH.actions();   // yatağın yanı (sandık bir karo aşağıda)
        out.chest = AT(MB, 3, 8); out.desk = AT(MB, 3, 2); out.tub = AT(MB, 10, 2);
        out.corridor = AT(MB, 2, 5);
        out.rooms = [G.upRoomAt(MB, 2, 7), G.upRoomAt(MB, 3, 2), G.upRoomAt(MB, 10, 2), G.upRoomAt(MB, 10, 7)].map(i => (i >= 0 ? upPlan(MB).rooms[i].n : null));
        G.player.clean = 10; AT(MB, 10, 2); TH.act(/Sıcak Banyo/);
        out.clean = G.player.clean;
        return out;
      });
      t.ok(r.inside, 'içeride');
      t.ok(r.table.includes('Yemek Masası') && r.table.includes('Otur ve Bekle'), 'salonda yemek masası', r.table);
      t.eq(r.up, [true, 1], 'üst kata çıkıldı');
      t.ok(r.bed.includes('Uyu') && r.bed.includes('Oyunu Kaydet'), 'yatakta uyku ve kayıt', r.bed);
      t.ok(r.chest.includes('Sandığı Aç'), 'yatak odasında sandık', r.chest);
      t.ok(r.desk.includes('Malikane Defteri'), 'çalışma odasında defter', r.desk);
      t.ok(r.tub.includes('Sıcak Banyo'), 'banyoda küvet', r.tub);
      t.ok(!r.corridor.some(a => /Uyu|Sandığı Aç/.test(a)), 'koridordan duvarın ardındaki yatak ve sandık çıkmaz', r.corridor);
      t.eq(r.rooms, ['Yatak Odası', 'Çalışma Odası', 'Banyo', 'Misafir Odası'], 'dört oda');
      t.eq(r.clean, 100, 'banyo yapıldı');
    });

    await t.step('hizmetçiler: defterden tutulur ve malikanede belirir; kahvaltı, ganimet, seyis', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, E = G.estate;
        AT(MB, 3, 2); TH.act(/Malikane Defteri/);
        const menu = TH.menuLabels();
        for (const re of [/Aşçı Tut/, /Uşak Tut/, /Seyis Tut/]) TH.clickItem(re);
        const menu2 = TH.menuLabels();
        UI.closeAll();
        G.setFloor(MB, 0); TH.inside(MB);
        G.servantSync(true);
        const S = G._serv, ents = ['cook', 'butler', 'groom'].map(k => !!S[k] && G.ents.includes(S[k]) && S[k].servant === k);
        // kahvaltı: sabah, günde bir
        G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 7 * 60;
        P.hunger = 20;
        const cookActs = G.npcActions(S.cook).map(a => a.n);
        G.npcActions(S.cook).find(a => a.n === 'Kahvaltı Et').fn();
        const fed = [P.hunger, E.meal === G.day, G.breakfastReady()];
        // malikanede uyanınca hazır kahvaltı
        E.meal = -1; P.hunger = 30; G.estateWake();
        const wake = P.hunger;
        // uşak: ganimet sandığa
        P.addItem('wolf_pelt', 2); P.addItem('gold_ring', 1); P.addItem('bread', 1);
        const st0 = (G.stash.wolf_pelt || 0);
        G.npcActions(S.butler).find(a => a.n === 'Ganimeti Sandığa Kaldır').fn();
        const stow = { pelt: (G.stash.wolf_pelt || 0) - st0, inv: !!P.inv.wolf_pelt || !!P.inv.gold_ring, bread: !!P.inv.bread };
        // seyis: bahçe kapısındaki at tımarlanır, beslenir, dinlenir
        const h = G.horse, gate = MB.garden.gate;
        if (P.riding) P.dismount();
        h.x = gate.x; h.y = gate.y + 20; h.hp = 5; h.sta = 0; h.dirty = 1;
        E.groomed = -1; G.groomTick();
        const groom = [h.hp === h.maxHp, h.sta === h.maxSta, h.dirty, E.groomed === G.day];
        return { menu, menu2, ents, cookActs, fed, wake, stow, groom, staff: Object.keys(E.staff).sort() };
      });
      t.ok(r.menu.some(l => /Aşçı Tut/.test(l)) && r.menu.some(l => /Seyis Tut/.test(l)) && r.menu.some(l => /Uşak Tut/.test(l)), 'defterde üç hizmetçi', r.menu);
      t.eq(r.staff, ['butler', 'cook', 'groom'], 'üçü de tutuldu'); t.ok(r.menu2.some(l => /^Aşçı · /.test(l)), 'defterde adlarıyla', r.menu2);
      t.eq(r.ents, [true, true, true], 'hizmetçiler malikanede belirdi');
      t.ok(r.cookActs.includes('Kahvaltı Et'), 'sabah aşçıda kahvaltı', r.cookActs);
      t.eq(r.fed, [100, true, false], 'kahvaltı karın doyurur, günde bir');
      t.eq(r.wake, 100, 'uyanınca kahvaltı hazır');
      t.eq(r.stow, { pelt: 2, inv: false, bread: true }, 'uşak post ve değerli eşyayı sandığa kaldırır, yiyeceğe dokunmaz');
      t.eq(r.groom, [true, true, 0, true], 'seyis atı tımarlar, besler, dinlendirir');
    });

    await t.step('ücretler önce bankadan; iki gün ödenmeyen hizmetçi gider', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, E = G.estate;
        G.bank = 10; P.money = 5;
        G.estateDaily();
        const paid = [Math.round((10 - G.bank) * 100) / 100, P.money];
        G.bank = 0; P.money = 0;
        G.estateDaily();
        const one = Object.values(E.staff).map(s => s.unpaid);
        G.estateDaily();
        const left = Object.keys(E.staff).length;
        P.money = 9000;
        G.hireServant('cook'); G.hireServant('butler'); G.hireServant('groom');
        return { paid, one, left, again: Object.keys(E.staff).length };
      });
      t.eq(r.paid, [1.8, 5], 'üç ücret ($1.80) bankadan ödendi, cüzdana dokunulmadı');
      t.eq(r.one, [1, 1, 1], 'bir gün ödenmedi: uyarı');
      t.eq(r.left, 0, 'ikinci gün hepsi gitti'); t.eq(r.again, 3, 'yeniden tutulabilir');
    });

    await t.step('kulüp: üyelik (temizlik şartı), kapı ve eşyalar yalnızca üyelere; yüksek bahisli poker, gazete', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; UI.closeAll();
        const out = { door0: G.doorOpen(CB), furn0: G.clubFurn(CB, O.CARDTABLE).acts.map(a => a.n) };
        TH.goto(CB.door.x, CB.door.y + 12);
        out.acts = TH.actions();
        P.clean = 10; TH.feeds.length = 0;
        out.dirty = G.joinClub(CB); out.dirtyFeed = TH.feeds.slice(-1)[0] || '';
        P.clean = 100;
        TH.act(/Kapı Görevlisiyle Konuş/);
        out.menu = TH.menuLabels();
        const m0 = P.money;
        TH.clickItem(/Kulübe Üye Ol/);
        out.paid = m0 - P.money; out.fee = G.clubPrice(); out.club = !!G.club; out.door1 = G.doorOpen(CB);
        UI.closeAll(); TH.clearNpcs(); TH.inside(CB);
        out.lectern = (() => { let f = null; const W = G.world; for (let y = CB.y; y < CB.y + CB.h && !f; y++) for (let x = CB.x; x < CB.x + CB.w; x++) if (W.obj[y * WW + x] === O.LECTERN) { f = [x - CB.x, y - CB.y]; break; } return f && AT(CB, f[0], f[1] + 1); })();
        G.dailyTalk.clubPaper = 0; TH.act(/Gazeteleri Oku/);
        out.paper = !!UI.top(); UI.closeAll(); TH.feeds.length = 0; UI.clubPapers(); out.again = TH.feeds.slice(-1)[0] || '';
        G.setFloor(CB, 1);
        out.card = AT(CB, 2, 2); out.cardHall = AT(CB, 3, 4); out.bill = AT(CB, 3, 8);
        out.antes = [Poker.antes(CB), Poker.antes(G.world.buildings.find(b => b.type === 'saloon'))];
        G.setFloor(CB, 0);
        return out;
      });
      t.ok(!r.door0, 'üye olmayana kapı kapalı'); t.eq(r.furn0, ['Yalnızca Üyeler'], 'üye olmayana kart masası kapalı');
      t.ok(r.acts.includes('Kapı Görevlisiyle Konuş'), 'kapı görevlisi', r.acts);
      t.ok(!r.dirty && /banyo/.test(r.dirtyFeed), 'toz toprak içinde üye olunmaz', r.dirtyFeed);
      t.ok(r.menu.includes('Kulübe Üye Ol'), 'üyelik menüsü', r.menu);
      t.eq([r.paid, r.club, r.door1], [r.fee, true, true], 'üyelik ödendi, kapı açık');
      t.ok(r.lectern && r.lectern.includes('Gazeteleri Oku'), 'okuma odasında gazete kürsüsü', r.lectern);
      t.ok(r.paper && /zaten okudun/.test(r.again), 'gazete günde bir', r.again);
      t.ok(r.card.includes('Yüksek Bahisli Poker'), 'üst katta kart odası', r.card);
      t.ok(!r.cardHall.includes('Yüksek Bahisli Poker'), 'koridordan duvarın ardındaki kart masası çıkmaz', r.cardHall);
      t.ok(r.bill.includes('Bilardo Oyna'), 'üst katta bilardo', r.bill);
      t.eq(r.antes[0], [50, 100, 250], 'kulüpte yüksek bahis'); t.ok(r.antes[1][0] < 50, 'saloonda bahis düşük', r.antes[1]);
    });

    await t.step('bilardo: düz vuruşta top cebe girer, bantta seker; rakip oyunu bitirir, kazanan bahsin iki katını alır', async () => {
      const r = await p.evaluate(() => {
        const mk = (balls) => ({ balls, potted: [], snd: { click: 0, cush: 0, pot: 0 } });
        const run = (st, s = 4) => { for (let k = 0; k < s * 480 && BL.moving(st); k++) BL.step(st, 1 / 480); };
        // beyaz, top ve sağ alt cep aynı doğruda
        const [px, py] = BL.pockets()[5], o = { x: px - 60, y: py - 30, vx: 0, vy: 0, c: '#e8c030' }, cue = { x: o.x - 80, y: o.y - 40, vx: 0, vy: 0, cue: true };
        const a = Math.atan2(py - cue.y, px - cue.x); cue.vx = Math.cos(a) * 300; cue.vy = Math.sin(a) * 300;
        const s1 = mk([cue, o]); run(s1);
        // banta dik vuruş geri seker, sürtünmeyle durur
        const c2 = { x: 100, y: 90, vx: 0, vy: -250, cue: true }, s2 = mk([c2]); let minY = 999;
        for (let k = 0; k < 4 * 480 && BL.moving(s2); k++) { BL.step(s2, 1 / 480); minY = Math.min(minY, c2.y); }
        // yapay zekâ: her iki taraf da rakibin vuruşunu yapar; oyun biter
        UI.openBilliards(CB);
        const m = UI.top(), st = m.billiards, P = G.player;
        st.bet = 5; m.update(0.016);
        const m0 = P.money;
        m.el.querySelector('.bl-cv').dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
        const started = st.phase, paid = Math.round((m0 - P.money) * 100) / 100;
        let shots = 0;
        for (; shots < 80 && st.phase !== 'over'; shots++) {
          if (st.phase === 'aim') { const s = BL.aiShot(st); const v = BL.VMAX * s.pow, c = st.balls[0]; c.vx = Math.cos(s.ang) * v; c.vy = Math.sin(s.ang) * v; st.potted = []; st.phase = 'roll'; }
          for (let k = 0; k < 4000 && (st.phase === 'roll' || st.phase === 'ai'); k++) m.update(0.02);
        }
        const res = { phase: st.phase, score: st.score.slice(), won: st.score[0] >= BL.WIN || (st.score[0] > st.score[1]), gain: Math.round((P.money - m0) * 100) / 100 };
        UI.closeAll();
        return { pot: [o.in, !cue.in], bounce: [minY >= BL.T + BL.r - 0.01, !c2.in && c2.vy === 0 && c2.vx === 0, c2.y > minY + 20], started, paid, res };
      });
      t.eq(r.pot, [true, true], 'hedef top cebe girdi, beyaz masada kaldı');
      t.eq(r.bounce, [true, true, true], 'bant topu geri seker, top durur');
      t.eq([r.started, r.paid], ['aim', 5], 'bahis ödendi, açış oyuncuda');
      t.eq(r.res.phase, 'over', 'oyun bitti', r.res);
      t.eq(r.res.gain, r.res.won ? 5 : -5, 'kazanınca bahsin iki katı, kaybedince bahis gider', r.res);
    });

    await t.step('özel fayton: ahırdan alınır, kapıya gelir; binilir, yol izlenir, onay basılı tutulunca atlanır', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); TH.clearNpcs();
        const P = G.player, tw = TH.town('stclement'), stb = tw.buildings.find(b => b.type === 'stable');
        G.visited.add('harlow');
        TH.goto(stb.door.x, stb.door.y + 20);
        UI.openBuilding(stb);
        const menu = TH.menuLabels();
        const m0 = P.money;
        TH.clickItem(/Özel Fayton ve Arabacı Al/);
        const w = G.coach;
        const out = { menu, paid: Math.round((m0 - P.money) * 100) / 100, price: G.carriagePrice(), coach: !!w && G.ents.includes(w), near: w && Math.round(Math.hypot(w.x - stb.door.x, w.y - stb.door.y)) };
        TH.goto(w.x + 4, w.y + 16);
        out.acts = TH.actions();
        TH.act(/Faytona Bin/);
        out.dests = TH.menuLabels();
        // at faytonun yanında: arkaya bağlanır
        const h = G.horse; if (P.riding) P.dismount(); h.x = w.x - 40; h.y = w.y + 10;
        G.law.level = 1; UI.closeAll(); out.wanted = G.rideStart(w, G.coachDests().find(d => d.town === 'harlow')); G.law.level = 0;
        TH.act(/Faytona Bin/); TH.clickItem(/Harlow/);
        out.ride = !!G.ride && !!P.passenger;
        window.RX = [P.x, P.y, G.clock];
        return out;
      });
      t.ok(r.menu.includes('Özel Fayton ve Arabacı Al'), 'ahırda özel fayton', r.menu);
      t.eq(r.paid, r.price, 'fayton fiyatı ödendi'); t.ok(r.coach && r.near < 140, 'fayton ahırın önünde', r.near);
      t.ok(r.acts.includes('Faytona Bin') && r.acts.includes('Arabacıyı Gönder'), 'fayton seçenekleri', r.acts);
      t.ok(r.dests.includes('Harlow') && !r.dests.includes('Saint Clement'), 'gidilecek yerler: bilinen öbür kasabalar', r.dests);
      t.ok(!r.wanted, 'aranırken arabacı yola çıkmaz');
      t.ok(r.ride, 'yolculuk başladı');
      await t.sleep(2500);
      const m = await p.evaluate(() => ({ moved: Math.round(Math.hypot(G.player.x - RX[0], G.player.y - RX[1])), acts: TH.actions(), horse: Math.round(Math.hypot(G.horse.x - G.coach.bx, G.horse.y - G.coach.by)), prompt: !!document.querySelector('.prompt') && /Yolu Atla/.test(document.body.innerHTML) }));
      t.ok(m.moved > 60, 'fayton yolu kendisi sürüyor', m.moved);
      t.ok(m.acts.includes('Faytondan İn'), 'yolcuyken inme seçeneği', m.acts);
      t.ok(m.horse < 30, 'at faytonun arkasına bağlı', m.horse);
      t.ok(m.prompt, 'yolu atla istemi');
      // onay tuşunu basılı tut: halka dolar, yol atlanır
      await p.keyboard.down('Enter');
      await t.sleep(500);
      const hold = await p.evaluate(() => [G.ride && G.ride.hold, !!document.querySelector('.prompt.holding')]);
      await t.sleep(1000);
      await p.keyboard.up('Enter');
      await p.waitForFunction(() => !G.ride && !G.player.passenger, null, { timeout: 15000 });
      await t.sleep(600);
      const e = await p.evaluate(() => {
        return { mins: Math.round(G.clock - RX[2]), town: (G.world.townAt(G.player.x, G.player.y, 6) || {}).id, feed: TH.feeds.filter(f => /Yolculuk bitti/.test(f)).slice(-1)[0] || '', horse: Math.round(Math.hypot(G.horse.x - G.player.x, G.horse.y - G.player.y)) };
      });
      t.ok(hold[0] > 0.2 && hold[1], 'basılı tutarken istem doluyor', hold);
      t.ok(e.mins > 30, 'yol atlanınca zaman ilerler', e.mins);
      t.eq(e.town, 'harlow', 'Harlow\'a varıldı'); t.ok(/Harlow/.test(e.feed), 'varış bildirimi', e.feed);
      t.ok(e.horse < 80, 'at da geldi', e.horse);
    });

    await t.step('fayton saldırıda durur; arabacının ücreti ödenmezse gider', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, H = TH.town('harlow'), post = H.buildings.find(b => b.type === 'post') || H.buildings.find(b => b.type === 'stable');
        G.coachCall(post);
        const w = G.coach, d = G.coachDests().find(x => x.town === 'stclement') || G.coachDests()[0];
        G.rideStart(w, d);
        const before = !!G.ride;
        const foe = new NPC(P.x + 30, P.y, 'bandit', {}); G.addEnt(foe);
        G.godMode = false; P.hp = P.maxHp;
        P.hurt(5, foe.name, false, foe);
        G.godMode = true;
        G.rideTick(0.016);
        const stopped = [!G.ride, !P.passenger, TH.feeds.some(f => /Saldırıya uğradın/.test(f))];
        foe.remove = true;
        G.bank = 0; P.money = 0; G.estate.staff = {};
        G.estateDaily(); G.estateDaily();
        const gone = [G.carriage.driver === null, !G.coach];
        P.money = 50;
        UI.openBuilding(H.buildings.find(b => b.type === 'stable'));
        const menu = TH.menuLabels();
        TH.clickItem(/Yeni Arabacı Tut/);
        UI.closeAll();
        return { before, stopped, gone, menu, driver: !!G.carriage.driver };
      });
      t.ok(r.before, 'yolculuk başladı');
      t.eq(r.stopped, [true, true, true], 'saldırıya uğrayınca arabacı durur, yolcu iner');
      t.eq(r.gone, [true, true], 'iki gün ücret alamayan arabacı gider, fayton ahıra döner');
      t.ok(r.menu.includes('Yeni Arabacı Tut'), 'ahırdan yeni arabacı', r.menu); t.ok(r.driver, 'yeni arabacı tutuldu');
    });

    await t.step('kayıt: malikane, hizmetçiler, kulüp ve fayton korunur', async () => {
      const r = await p.evaluate(async () => {
        const before = JSON.stringify({ e: Object.keys(G.estate.staff).sort(), c: !!G.club, d: G.carriage.driver.name, b: G.estate.bid });
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const after = JSON.stringify({ e: Object.keys(G.estate.staff).sort(), c: !!G.club, d: G.carriage.driver.name, b: G.estate.bid });
        return { before, after, door: G.doorOpen(G.mansionB()), club: G.doorOpen(G.world.buildings.find(b => b.type === 'club')) };
      });
      t.eq(r.after, r.before, 'yüklemede aynı'); t.ok(r.door && r.club, 'kapılar açık');
    });

    await t.step('iki çizici malikane cephesini, bahçeyi, iki katı ve kulübü hatasız çizer', async () => {
      const r = await p.evaluate(async () => {
        const out = {};
        const frames = async (n) => { for (let k = 0; k < n; k++) await new Promise(res => requestAnimationFrame(res)); };
        const MB_ = G.mansionB(), CB_ = G.world.buildings.find(b => b.type === 'club');
        window.__hySoft = true;
        const views = [['dis', MB_, () => { G.setFloor(MB_, 0); TH.goto(MB_.door.x + 40, MB_.door.y + 40); }, MB_.door.x / TS, MB_.door.y / TS - 1.2],
          ['salon', MB_, () => { G.setFloor(MB_, 0); TH.inside(MB_); }, MB_.x + MB_.w / 2, MB_.y + MB_.h / 2],
          ['ust', MB_, () => { TH.inside(MB_); G.setFloor(MB_, 1); }, MB_.x + MB_.w / 2, MB_.y + MB_.h / 2],
          ['kulup', CB_, () => { G.setFloor(MB_, 0); TH.inside(CB_); }, CB_.x + CB_.w / 2, CB_.y + CB_.h / 2]];
        for (const [k, b, go, tx, ty] of views) {
          UI.closeAll(); TH.clearNpcs(); go();
          for (const gfx of [0, 1]) {
            G.settings.gfx = gfx; G.applySettings();
            await frames(gfx ? 8 : 40);
            if (gfx === 0 && window.HY && G.hybridOn()) for (let i = 0; i < 120; i++) { const q = HY._queued(); if (!q.chunks && !q.covers) break; await frames(2); }
            await frames(4);
            const s = G.canvas.width / G.vw, cx = Math.round((tx * TS - G.cam.ox) * s), cy = Math.round((ty * TS - G.cam.oy) * s);
            const d = G.ctx.getImageData(cx - 40, cy - 30, 80, 60).data, cols = new Set();
            for (let i = 0; i < d.length; i += 4) cols.add((d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3));
            out[k + '.' + (gfx ? 'cl' : 'hy')] = cols.size;
          }
        }
        G.setFloor(MB_, 0); G.settings.gfx = 0; G.applySettings();
        return out;
      });
      for (const [k, n] of Object.entries(r)) t.ok(n > 30, 'desenli çizim ' + k, n);
    });
  },
};
