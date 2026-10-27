'use strict';
/* Oyuncunun kurduğu yapıların dört hazır tasarımı (kademe): ekonomik, normal, gelişmiş, lüks. Fiyat kademeyle artar
   (normal eski fiyat); seçilen kademenin iç planı ve görünümü kurulur, kayıtta korunur; işletmenin geliri kademeden
   bağımsız. Kasabanın binaları ve hazır satın alınan yapılar kademesiz kalır. Planlar geçerli: kapı yolu açık, işlevli
   eşyalara ve işletmeciye ulaşılır. Menüde tür seçilince tasarım sorulur, önizleme iki çizicide de hatasız çıkar. */
module.exports = {
  name: 'Yapı tasarımları (kademeler)',
  timeout: 400000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      G.godMode = true; G.player.money = 20000; window.TW = TH.town('stclement');
      window.TT = {
        // yapının iç eşyaları plan karakterlerine çevrilir (koltuk ayağı ve yatak ayakucu '|', '=' dahil)
        layout(b) {
          const rev = new Map(Object.entries(INT_KEY).map(([ch, o]) => [o, ch])), rows = [];
          for (let ly = 1; ly <= b.h - 2; ly++) {
            let s = '';
            for (let lx = 1; lx <= b.w - 2; lx++) { const o = G.world.obj[(b.y + ly) * WW + b.x + lx]; s += o ? (o === O.IBLOCK ? '#' : rev.get(o) || '?') : '.'; }
            rows.push(s);
          }
          return rows;
        },
        // planın beklenen görünümü: işletmeci yeri boş, '|' ve '=' tek simge
        expect(m) { return m.map(r => r.replace(/@/g, '.').replace(/[|=]/g, '#')); },
      };
    });

    await t.step('fiyatlar: kademeyle artar, normal kademe eski fiyattır', async () => {
      const r = await p.evaluate(() => {
        const tw = TW, out = { mono: true, stdHome: true, stdBiz: true, cabin: TIER_KEYS.map(k => G.homePrice('hs_cabin', k)) };
        for (const k of Object.keys(HOME_TYPES)) { const v = TIER_KEYS.map(tr => G.homePrice(k, tr)); if (!(v[0] < v[1] && v[1] < v[2] && v[2] < v[3])) out.mono = false; if (v[1] !== HOME_TYPES[k].p) out.stdHome = false; }
        for (const k of Object.keys(BIZ)) {
          const v = TIER_KEYS.map(tr => G.bizBuildPrice(k, tw, tr));
          if (!(v[0] < v[1] && v[1] < v[2] && v[2] < v[3])) out.mono = false;
          if (v[1] !== Math.round(BIZ[k].p * 0.9 * G.bizTownMul(tw) / 5) * 5 || v[1] !== G.bizBuildPrice(k, tw)) out.stdBiz = false;
        }
        return out;
      });
      t.ok(r.mono, 'her türde ekonomik < normal < gelişmiş < lüks');
      t.ok(r.stdHome && r.stdBiz, 'normal kademe eski fiyat');
      t.eq(r.cabin, [60, 80, 112, 160], 'kulübe: $60 / $80 / $112 / $160');
    });

    await t.step('planlar geçerli: boyut, kapı yolu, ulaşılabilir eşya ve işletmeci, zorunlu eşyalar', async () => {
      const r = await p.evaluate(() => {
        const bad = [], WALK = new Set(['.', '@', 'c', '1']), FUNC = new Set('TPpBSDUYHVeM'), GROUP = 'CRL';
        const REQ = {
          hs_shack: 'BH', hs_cabin: 'BHS', hs_house: 'BBHSU', barber: 'YY@', laundry: 'CU@', bakery: 'C@', butcher: 'C@', tailor: 'CM@', mill: 'C@', smith: 'Cfv@',
          pharmacy: 'C@', cantina: 'R1TP@', stable: 'LCZ~@', general: 'C@', saloon: 'R1TPp@', brewery: 'DV', gambling: 'RPe@', bank: 'C@$D',
        };
        const types = [...Object.keys(HOME_TYPES), ...Object.keys(BIZ).filter(k => k !== 'hotel')];
        for (const type of types) for (const k of TIER_KEYS) {
          const pl = TIER_PLANS[type] && TIER_PLANS[type][k], id = type + '/' + k;
          if (!pl) { bad.push(id + ' plan yok'); continue; }
          const m = pl.m, C = BUILDINGS[type].w - 2, R = BUILDINGS[type].h - 2, cd = (BUILDINGS[type].w >> 1) - 1;
          if (m.length !== R || m.some(l => l.length !== C)) { bad.push(id + ' boyut'); continue; }
          const at = (c, r) => (r < 0 || r >= R || c < 0 || c >= C) ? '#' : m[r][c];
          for (let r = R - 2; r < R; r++) if (at(cd, r) !== '.') bad.push(id + ' kapı yolu dolu');
          for (const l of m) for (const ch of l) if (ch !== '.' && ch !== '@' && INT_KEY[ch] === undefined) bad.push(id + ' bilinmeyen ' + ch);
          const seen = new Set([cd + ',' + (R - 1)]), q = [[cd, R - 1]];
          while (q.length) { const [c, r] = q.shift(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = (c + dc) + ',' + (r + dr); if (!seen.has(kk) && WALK.has(at(c + dc, r + dr))) { seen.add(kk); q.push([c + dc, r + dr]); } } }
          const reach = (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dc, dr]) => seen.has((c + dc) + ',' + (r + dr)));
          for (const g of GROUP) { let has = false, any = false; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (at(c, r) === g) { has = true; any = any || reach(c, r); } if (has && !any) bad.push(id + ' ulaşılamayan ' + g); }
          for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
            const ch = at(c, r);
            if (ch === '@' && !seen.has(c + ',' + r)) bad.push(id + ' işletmeciye ulaşılamaz');
            if (FUNC.has(ch) && !(reach(c, r) || (ch === 'B' && reach(c, r + 1)) || ('De'.includes(ch) && reach(c + 1, r)))) bad.push(id + ' ulaşılamayan ' + ch);
            if (ch === 'B' && at(c, r + 1) !== '|') bad.push(id + ' yatak ayakucu');
            if ('TP'.includes(ch) && (at(c - 1, r) !== '.' || at(c + 1, r) !== '.')) bad.push(id + ' masanın yanı dolu');
          }
          if (pl.at && !seen.has((Math.floor(pl.at[0]) - 1) + ',' + (Math.floor(pl.at[1]) - 1))) bad.push(id + ' işletmeci yeri');
          const all = m.join('');
          for (const ch of new Set(REQ[type])) { const need = [...REQ[type]].filter(x => x === ch).length; if (all.split(ch).length - 1 < need) bad.push(id + ' eksik ' + ch); }
        }
        // dört kademe birbirinden farklı
        const same = types.filter(type => new Set(TIER_KEYS.map(k => TIER_PLANS[type][k].m.join('/'))).size < 4);
        return { bad, same, n: types.length, hotel: TIER_KEYS.every(k => HOTEL_TIER[k] && HOTEL_TIER[k].lobby.length && HOTEL_TIER[k].room) };
      });
      t.eq(r.bad, [], 'plan sorunları');
      t.eq(r.same, [], 'her türde dört farklı tasarım');
      t.eq(r.n, 18, '3 ev + 15 işletme (otelin kendi lobi ve oda kademesi var)'); t.ok(r.hotel, 'otel kademeleri');
    });

    await t.step('işletme: arsada tür, sonra tasarım seçilir; lüks salon kurulur, plan ve görünüm uygulanır', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player;
        const lot = TW.lots.find(l => !G.lotBiz(l) && G.lotTypes(l).includes('saloon')); window.LOT = lot;
        G.buyLot(lot); UI.openBuildMenu(lot);
        const item = UI.top().items.find(i => i.label === BUILDINGS.saloon.n), right = item.right;
        item.fn();
        const m = UI.top(), tiers = m.items.map(i => i.tier), prices = m.items.map(i => i.right), focus = m.focusEl && +m.focusEl.dataset.i;
        const side = !!m.el.querySelector('.tier-prev img');
        // parası yetmeyen kademe kapalı
        const keep = P.money; P.money = G.bizBuildPrice('saloon', TW, 'adv') - 1; m.render();
        const dis = UI.top().items.map(i => !!i.disabled); P.money = keep; m.render();
        const m0 = P.money; UI.top().items.find(i => i.tier === 'lux').fn();
        const z = G.lotBiz(lot);
        return { right, tiers, prices, focus, side, dis, paid: m0 - P.money, want: G.bizBuildPrice('saloon', TW, 'lux'), tier: z && z.tier, site: z && z.site, modal: UI.isModal() };
      });
      t.ok(/^\$\d+–\d+$/.test(r.right), 'türün fiyat aralığı', r.right);
      t.eq(r.tiers, ['eco', 'std', 'adv', 'lux'], 'dört tasarım'); t.eq(r.focus, 1, 'normal seçili açılır'); t.ok(r.side, 'önizleme görünür');
      t.eq(r.dis, [false, false, true, true], 'parası yetmeyen tasarım kapalı');
      t.eq(r.paid, r.want, 'lüks fiyatı ödenir'); t.eq(r.tier, 'lux', 'işletme kaydında kademe'); t.ok(r.site && !r.modal, 'şantiye başladı, menü kapandı');
      const r2 = await p.evaluate(() => {
        G.advanceClock(1440 * (BUILD_DAYS + 1));
        const z = G.lotBiz(LOT), b = G.bizBuilding(z); window.LUXB = b;
        return { tier: b && b.tier, modern: b && b.modern, rich: b && richB(b), mb: b && modernB(b), lay: TT.layout(b), want: TT.expect(TIER_PLANS.saloon.lux.m), staff: !!(b && b.staff), seats: b && b.seats.length, piano: !!(b && b.piano),
          pave: G.world.tile[(b.y + b.h) * WW + b.x + 1] === T.PAVE, style: IntDeco.style(b).fl + '/' + IntDeco.style(b).wl };
      });
      t.eq(r2.tier, 'lux', 'bina kademesi'); t.ok(r2.rich && r2.mb && !r2.modern, 'lüks: taş/tuğla cephe (şehirden bağımsız)');
      t.eq(r2.lay, r2.want, 'iç yerleşim lüks plan'); t.ok(r2.staff && r2.seats >= 6 && r2.piano, 'barmen, oturaklar, piyanist yeri', r2);
      t.ok(r2.pave, 'lüks yapının önü taş kaldırım'); t.eq(r2.style, 'wide/damask', 'lüks salonda koyu cilalı tahta ve işlemeli duvar kâğıdı');
    });

    await t.step('ev: kazıkta tür, sonra tasarım; ekonomik baraka kurulur ve tamamlanınca planı uygulanır', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); const P = G.player; P.addItem('stakes', 1, true);
        let best = null;
        for (let ty = 40; ty < WH - 40 && !best; ty += 7) for (let tx = 40; tx < WW - 40 && !best; tx += 7) if (!G.homeCheck(tx, ty)) best = [tx, ty];
        TH.goto((best[0] + (HOME_FW >> 1)) * TS + 8, (best[1] + HOME_FH - 2) * TS + 8); TH.clearNpcs();
        G.consume('stakes');
        UI.top().items.find(i => i.label === BUILDINGS.hs_shack.n + Tr(' (kaçak)')).fn();
        const tiers = UI.top().items.map(i => i.tier), title = UI.top().el.querySelector('.p-title').textContent;
        const m0 = P.money; UI.top().items.find(i => i.tier === 'eco').fn();
        const h = G.homes[G.homes.length - 1]; window.H = h;
        const paid = m0 - P.money;
        for (let k = 0; k < 4; k++) G.advanceClock(1440);
        const b = G.homeBuilding(h); window.ECOB = b;
        return { tiers, title, paid, tier: h.tier, legal: h.legal, done: h.done, btier: b && b.tier, lay: b && TT.layout(b), want: TT.expect(TIER_PLANS.hs_shack.eco.m), worn: b && bCol(b).worn, fl: b && IntDeco.style(b).fl };
      });
      t.eq(r.tiers, ['eco', 'std', 'adv', 'lux'], 'dört tasarım'); t.ok(/Baraka/.test(r.title), 'başlıkta yapı', r.title);
      t.eq(r.paid, 23, 'ekonomik baraka $23'); t.eq(r.tier, 'eco', 'kayıtta kademe'); t.ok(!r.legal, 'kaçak');
      t.ok(r.done && r.btier === 'eco', 'tamamlanan yapı ekonomik', r); t.eq(r.lay, r.want, 'iç yerleşim ekonomik plan');
      t.ok(r.worn, 'ekonomik: yıpranmış tahta cephe'); t.eq(r.fl, 'plank', 'tahta döşeme');
    });

    await t.step('kayıttan yüklenince kademe, plan ve görünüm korunur', async () => {
      const r = await p.evaluate(async () => {
        const before = { lux: TT.layout(LUXB), eco: TT.layout(ECOB) };
        G.saveGame(true); await G.loadGame(G.slot, 'auto');
        const z = G.biz.find(q => q.tier === 'lux'), b = z && G.bizBuilding(z), h = G.homes.find(q => q.tier === 'eco'), hb = h && G.homeBuilding(h);
        return { zt: z && z.tier, bt: b && b.tier, ht: h && h.tier, hbt: hb && hb.tier, lux: b && TT.layout(b), eco: hb && TT.layout(hb), before, mb: b && modernB(b) };
      });
      t.eq([r.zt, r.bt, r.ht, r.hbt], ['lux', 'lux', 'eco', 'eco'], 'kademeler');
      t.eq(r.lux, r.before.lux, 'salon planı aynı'); t.eq(r.eco, r.before.eco, 'baraka planı aynı'); t.ok(r.mb, 'lüks cephe');
    });

    await t.step('kasaba binaları ve satın alınan işletme kademesiz; eski tasarım seçimi sürer', async () => {
      const r = await p.evaluate(() => {
        const town = G.world.buildings.filter(b => b.town !== null && !b.lot && b.home === undefined);
        const shop = TW.buildings.find(b => G.bizForSale(b));
        if (shop) { G.player.money += G.bizPrice(shop); G.buyBiz(shop); }
        return { tiered: town.filter(b => b.tier).length, n: town.length, lays: town.filter(b => b.enter && INT_PLANS[b.type]).every(b => /^[sr]\d$/.test(b.lay || '')), bought: shop ? !G.bizOf(shop).tier && !shop.tier : true };
      });
      t.eq(r.tiered, 0, 'kasaba binalarında kademe yok'); t.ok(r.n > 100, 'kasaba binaları sayıldı', r.n);
      t.ok(r.lays, 'kasaba binaları eski planlardan'); t.ok(r.bought, 'satın alınan işletme kademesiz');
    });

    await t.step('önizleme: her tür ve kademe iki çizicide hatasız; dışı ve içi ayrı görüntü', async () => {
      const r = await p.evaluate(async () => {
        const errs = [], out = {};
        const types = [...Object.keys(HOME_TYPES), ...Object.keys(BIZ)];
        window.__hySoft = true;
        for (const gfx of [1, 0]) {
          G.settings.gfx = gfx; G.applySettings(); Spr._tierPrev = null;
          let n = 0;
          for (const type of types) for (const k of TIER_KEYS) {
            try { const pv = Spr.tierPreview(type, k); if (/^data:image\/png/.test(pv.ext) && /^data:image\/png/.test(pv.int) && pv.ew > BUILDINGS[type].w * TS * 0.9 && pv.iw >= BUILDINGS[type].w * TS) n++; else errs.push(type + '/' + k + ' boş'); }
            catch (e) { errs.push(type + '/' + k + ': ' + e.message); }
          }
          out[gfx] = { n, hy: G.hybridOn() };
        }
        // aynı kademe önbellekten; farklı kademeler farklı görüntü
        const a = Spr.tierPreview('hs_house', 'eco'), b = Spr.tierPreview('hs_house', 'eco'), c = Spr.tierPreview('hs_house', 'lux');
        G.settings.gfx = 0; G.applySettings();
        return { errs, out, cached: a === b, differ: a.ext !== c.ext && a.int !== c.int, world: G.world.lights.length > 0 };
      });
      t.eq(r.errs, [], 'önizleme hataları');
      t.eq(r.out[1].n, 76, 'klasik: 19 tür × 4 kademe'); t.ok(r.out[0].hy, 'melez çizici açık'); t.eq(r.out[0].n, 76, 'melez: 19 tür × 4 kademe');
      t.ok(r.cached && r.differ, 'önbellek ve farklı tasarımlar');
    });
  },
};
