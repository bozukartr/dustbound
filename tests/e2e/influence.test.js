'use strict';
/* Nüfuz ve rüşvet (js/influence.js): servet, onur ve varlıklardan nüfuz ve basamakları; suç dosyası; tutuklamaya gelen
   kanun adamına, şerif masasında ve tutuklanınca rüşvet; nüfuzun yetmediği ve hiç kapanmayan dosya; dürüst şerife teklif
   suçtur; söylenti, skandal ve Islah Komisyonu; nüfuzlunun suçunu görenlerin bir kısmı susar; kayıt. */
module.exports = {
  name: 'Nüfuz ve rüşvet',
  async run(t) {
    const p = await t.newGame();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.evaluate(() => {
      window.WITH_RANDOM = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
      // suç: kanun adamı görmüş gibi hemen aranırsın
      window.CRIME = (type, bounty, lvl) => G.applyCrime({ type, name: type, bounty, lvl, masked: false, desc: G.outfit(), x: G.player.x, y: G.player.y }, true);
      // tutuklamaya gelen kanun adamı
      window.COP = () => { const P = G.player, n = new NPC(P.x + 40, P.y, 'law', { hostile: true }); G.addEnt(n); return n; };
      window.TWN = () => G.infTown();
      window.LAW_HONEST = G.lawHonest;
      // patron: zengin, saygın ve kasabada işletmeleri olan biri
      window.PATRON = () => {
        G.player.money = 400000; G.honor = 100; G.infl.taint = 0;
        const lv = G.law.level; G.law.level = 0;   // aranırken tapu verilmez
        for (const b of TWN().buildings) if (BIZ[b.type] && !G.bizOf(b) && b.type !== 'bank') G.buyBiz(b, G.bizForSale(b) ? G.bizPrice(b) : G.bizOfferPrice(b));
        G.law.level = lv; G.player.money = 400000; G.honor = 100;
      };
    });

    await t.step('nüfuz servet, onur ve varlıklarla artar; basamaklar', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        G.player.money = 0; G.bank = 0; G.honor = 0; out.zero = G.influence();
        G.player.money = 5000; out.k5 = [G.influence(), G.infLv(G.influence())];
        G.player.money = 40000; G.honor = 40; out.k40 = [G.influence(), G.infLv(G.influence())];
        G.honor = -60; out.bad = G.influence();
        G.honor = 40;
        const b = TH.town('stclement').buildings.find(x => BIZ[x.type] && G.bizForSale(x)); G.buyBiz(b);
        out.local = [G.influence(), G.influence(TH.town('stclement'))];
        return out;
      });
      t.eq(r.zero, 0, 'parasız ve onursuz: 0');
      t.eq(r.k5[1], 1, '$5000: tanınmış'); t.eq(r.k40[1], 2, '$40000 ve onur: nüfuzlu');
      t.ok(r.bad < r.k40[0], 'kötü şöhret nüfuzu düşürür', r);
      t.ok(r.local[1] > r.local[0], 'işletmenin olduğu kasabada nüfuz yüksek', r.local);
    });

    await t.step('suç dosyası: suçlar yazılır, en ağırı belirler; ödeyince kapanır', async () => {
      const r = await p.evaluate(() => {
        CRIME('assault', 5, 1); const c1 = G.recClass();
        CRIME('robbery', 8, 1); const c2 = G.recClass(), n = G.law.rec.length;
        G.law.level = 0; G.payBounty();
        return { c1, c2, n, after: G.law.rec.length, bounty: G.law.bounty };
      });
      t.eq(r.c1, 0, 'saldırı hafif'); t.eq(r.c2, 1, 'soygun orta'); t.eq(r.n, 2, 'iki kayıt');
      t.eq(r.after, 0, 'ödeyince dosya kapanır'); t.eq(r.bounty, 0, 'ödül sıfır');
    });

    await t.step('tutuklamaya gelen kanun adamına rüşvet: aranma biter, dosya kapanır, onur düşer', async () => {
      const r = await p.evaluate(() => {
        G.lawHonest = () => false;
        CRIME('assault', 5, 1);
        const cop = COP(), acts = G.findInteraction().actions.map(a => a.n);
        const h0 = G.honor, m0 = G.player.money, pr = G.bribePrice(TWN());
        const res = WITH_RANDOM(0.01, () => G.bribeLaw(cop, TWN()));
        return { acts, res, level: G.law.level, bounty: G.law.bounty, rec: G.law.rec.length, honor: G.honor - h0, paid: m0 - G.player.money, pr, hostile: cop.hostile, removed: !!cop.remove, heat: G.infl.heat[TWN().id] };
      });
      t.ok(r.acts.includes('Teslim Ol') && r.acts.some(a => /^Rüşvet Teklif Et/.test(a)), 'teslim ol ve rüşvet seçenekleri', r.acts);
      t.eq(r.res, 'ok', 'rüşvet kabul'); t.eq(r.level, 0, 'aranma bitti'); t.eq(r.bounty, 0, 'ödül silindi'); t.eq(r.rec, 0, 'dosya kapandı');
      t.ok(r.honor < 0, 'onur düştü', r.honor); t.near(r.paid, r.pr, 0.01, 'bedel ödendi');
      t.ok(r.pr < 5 * 1.3, 'nüfuzlunun rüşveti ödülden ucuz', r.pr);
      t.ok(!r.hostile && !r.removed, 'kanun adamı bakmazdan gelir, yerinde kalır');
      t.ok(r.heat > 0, 'kasabada söylenti');
    });

    await t.step('nüfuzun yetmediği ve hiç kapanmayan dosya; maskeyle pazarlık olmaz', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        CRIME('murder', 50, 2);
        out.murder = G.bribeWhy(TWN());
        const keep = [G.player.money, G.honor];
        PATRON();
        out.murderRich = [G.bribeWhy(TWN()), G.influence(TWN())];
        CRIME('murderLaw', 100, 3); out.lawKill = G.bribeWhy(TWN());
        const cop = COP(); out.acts = G.findInteraction() ? G.findInteraction().actions.map(a => a.n) : [];
        G.lawClear(); cop.remove = true;
        CRIME('assault', 5, 1);
        const P = G.player; P.addItem('mask_bandana', 1, true); P.mask = 'mask_bandana'; out.masked = G.bribeWhy(TWN()); P.mask = null;
        G.lawClear();
        [G.player.money, G.honor] = keep;
        return out;
      });
      t.ok(/nüfuzun yetmez/.test(r.murder), 'cinayet için patron olmalı', r.murder);
      t.eq(r.murderRich[0], '', 'patron cinayet dosyasını kapatabilir', r.murderRich);
      t.ok(/pazarlığı olmaz/.test(r.lawKill), 'kanun adamı öldürmek asla', r.lawKill);
      t.ok(!r.acts.some(a => /Rüşvet/.test(a)), 'rüşvet seçeneği çıkmaz', r.acts);
      t.ok(/Maskeyle/.test(r.masked), 'maskeyle olmaz');
    });

    await t.step('dürüst şerife rüşvet teklifi suçtur; şerif masasında Dosyayı Kapat', async () => {
      const r = await p.evaluate(() => {
        const out = {};
        G.lawHonest = () => true;
        CRIME('assault', 5, 1);
        const cop = COP(), b0 = G.law.bounty;
        out.res = G.bribeLaw(cop, TWN());
        out.added = G.law.bounty - b0; out.rec = G.law.rec.map(x => x.t); out.level = G.law.level; out.honest = cop.honest;
        out.acts = G.findInteraction().actions.map(a => a.n);
        G.lawClear(); cop.remove = true;
        // ofiste (aranmıyorken, başında ödülle)
        G.lawHonest = () => false;
        CRIME('robbery', 8, 1); G.law.level = 0;
        const b = TH.town('stclement').buildings.find(x => x.type === 'sheriff');
        UI.openBuilding(b); out.desk = TH.menuLabels();
        WITH_RANDOM(0.01, () => TH.clickItem(/Dosyayı Kapat/)); out.after = G.law.bounty; UI.closeAll();
        return out;
      });
      t.eq(r.res, 'honest', 'dürüst şerif'); t.eq(r.added, 8, 'rüşvet teklifi ödülü'); t.ok(r.rec.includes('bribery'), 'dosyada');
      t.ok(r.honest, 'kanun adamı bir daha teklif almaz');
      t.ok(!r.acts.some(a => /Rüşvet/.test(a)), 'aynı kanun adamına ikinci teklif yok', r.acts);
      t.ok(r.desk.some(l => /Dosyayı Kapat/.test(l)), 'şerif masasında seçenek', r.desk);
      t.eq(r.after, 0, 'dosya kapandı');
    });

    await t.step('tutuklanınca Şerifle Anlaş', async () => {
      const r = await p.evaluate(() => {
        CRIME('assault', 5, 1);
        const cop = COP();
        G.surrender(cop);
        const labels = TH.menuLabels();
        WITH_RANDOM(0.01, () => TH.clickItem(/Şerifle Anlaş/));
        return { labels, level: G.law.level, bounty: G.law.bounty, modal: UI.isModal() };
      });
      t.ok(r.labels.some(l => /Şerifle Anlaş/.test(l)) && r.labels.some(l => /Cezayı Öde/.test(l)), 'seçenekler', r.labels);
      t.eq(r.level, 0, 'serbest'); t.eq(r.bounty, 0, 'dosya kapandı'); t.ok(!r.modal, 'menü kapandı');
    });

    await t.step('söylenti eşiği aşılınca skandal: gazete, onur ve nüfuz düşer, dürüst şerif atanır', async () => {
      const r = await p.evaluate(() => {
        const t0 = TWN(), h0 = G.honor, inf0 = G.influence();
        G.infl.heat[t0.id] = BRIBE.scandal + 5;
        WITH_RANDOM(0, () => G.bribeHeat(t0, 1));
        G.lawHonest = LAW_HONEST;   // gerçek hesap: skandaldan sonra kasabanın şerifi dürüst
        return { honor: G.honor - h0, inf: G.influence() - inf0, honest: G.lawHonest(t0), news: G.dev.log.filter(e => e.k === 'eco').map(e => e.v), heat: G.infl.heat[t0.id], taint: G.infl.taint > G.year };
      });
      t.ok(r.honor <= -6, 'onur düştü', r.honor); t.ok(r.inf <= -10, 'nüfuz lekelendi', r.inf);
      t.ok(r.honest, 'kasabaya dürüst şerif'); t.ok(r.news.includes('skandal'), 'gazete');
      t.eq(r.heat, 0, 'söylenti sıfırlandı'); t.ok(r.taint, 'leke');
    });

    await t.step('patronun suçunu görenlerin bir kısmı susar; ödül avcıları seyrekleşir', async () => {
      const r = await p.evaluate(() => {
        PATRON();
        for (const e of G.ents) if (e.isLaw) e.remove = true;
        G.ents = G.ents.filter(e => !e.remove);
        const P = G.player, ws = [];
        for (let k = 0; k < 40; k++) { const n = new NPC(P.x + 30 + (k % 8) * 6, P.y + 20 + Math.floor(k / 8) * 6, 'town', {}); G.addEnt(n); ws.push(n); }
        const lv = G.infLv(G.influence(TWN()));
        G.crime('assault', P.x, P.y, null);
        const told = ws.filter(w => w.witness).length;
        for (const w of ws) w.remove = true;
        G.lawClear();
        return { lv, told, n: ws.length };
      });
      t.eq(r.lv, 4, 'patron');
      t.ok(r.told < r.n * 0.8 && r.told > r.n * 0.3, 'tanıkların bir kısmı sustu', r);
    });

    await t.step('Islah Komisyonu: haber, rüşvet pahalılaşır; kayıttan yüklenince durum korunur', async () => {
      const r = await p.evaluate(async () => {
        const t0 = TWN();
        G.advanceClock(Math.max(0, BRIBE.reformYear - G.year) * G.dpy * 1440);
        CRIME('assault', 5, 1); G.law.level = 0;
        // aynı anda, komisyon kurulmamış gibi hesaplanan bedelle karşılaştır
        const post = G.bribePrice(t0), ry = BRIBE.reformYear; BRIBE.reformYear = 9999; const pre = G.bribePrice(t0); BRIBE.reformYear = ry;
        const news = G.dev.log.filter(e => e.k === 'eco' && e.v === 'islah').length;
        G.infl.heat.harlow = 4;
        const before = JSON.stringify({ infl: G.infl, rec: G.law.rec });
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        return { pre, post, news, year: G.year, same: before === JSON.stringify({ infl: G.infl, rec: G.law.rec }) };
      });
      t.ok(r.year >= 1915, 'yıl', r.year); t.ok(r.news >= 1, 'gazete: Islah Komisyonu');
      t.ok(r.post > r.pre * 1.3, 'rüşvet pahalılaştı', r);
      t.ok(r.same, 'nüfuz durumu ve dosya korunur');
      t.eq(errs.length, 0, 'sayfa hatası yok', errs);
    });
  },
};
