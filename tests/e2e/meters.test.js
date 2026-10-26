'use strict';
/* Göstergeler gerektiğinde: radarın çevresindeki halkalar ve ihtiyaç çubukları dolu ve durgunken söner; yara,
   yemek, azalma, çatışma, nişan, aranma, genişletilmiş HUD ve "Her Zaman" ayarıyla görünür; ipucu bir kez çıkar */
module.exports = {
  name: 'Göstergeler gerektiğinde',
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.eventT = 1e9; G.travelT = 1e9;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.MS = {
        full() { const P = G.player; Object.assign(P, { hp: P.maxHp, sta: P.maxSta, de: 100, deCore: 100, hunger: 100, thirst: 100, energy: 100, clean: 100, aiming: false, deadeye: false }); G.law.level = 0; G.playtime = 100; UI.hudX = 0; G.settings.meters = 0; },
        // oyun saati ilerler, HUD yenilenir (değişimin ardından birkaç saniye görünür kalır)
        tick(sec = 5) { G.t += sec; UI.hudUpdate(); },
        on() { return [...document.querySelectorAll('#cores .core, #needs .need')].filter(e => !e.classList.contains('off')).map(e => e.id); },
      };
    });

    await t.step('dolu ve durgun göstergeler söner', async () => {
      const r = await p.evaluate(() => { MS.full(); MS.tick(); MS.tick(); return { on: MS.on(), n: document.querySelectorAll('#cores .core, #needs .need').length }; });
      t.eq(r.n, 7, 'üç halka ve dört çubuk');
      t.eq(r.on, [], 'hepsi sönük');
    });

    await t.step('yara alınca can halkası, yiyince açlık çubuğu birkaç saniye, azalınca hep görünür', async () => {
      const r = await p.evaluate(() => {
        const P = G.player; MS.full(); MS.tick(); MS.tick();
        P.hp = P.maxHp * 0.8; MS.tick(0.1); const hurt = MS.on();
        P.hp = P.maxHp; MS.tick(); MS.tick(); const healed = MS.on();
        P.hunger = 70; MS.tick(); MS.tick(); const quiet = MS.on();
        P.hunger = 95; MS.tick(0.1); const ate = MS.on();
        MS.tick(); const later = MS.on();
        P.thirst = 40; MS.tick(); MS.tick(); const low = MS.on();
        P.sta = P.maxSta * 0.6; MS.tick(); const tired = MS.on();
        return { hurt, healed, quiet, ate, later, low, tired };
      });
      t.eq(r.hurt, ['core-hp'], 'yara: can halkası görünür');
      t.eq(r.healed, [], 'iyileşince söner');
      t.eq(r.quiet, [], 'yarının üstünde açlık sessiz');
      t.eq(r.ate, ['core-hp', 'need-hunger'], 'yiyince açlık çubuğu ve can halkasının iç dolgusu görünür');
      t.eq(r.later, [], 'birkaç saniye sonra söner');
      t.ok(r.low.includes('need-thirst') && r.low.includes('core-hp'), 'susuzluk yarının altında: çubuk ve can halkasının iç dolgusu görünür', r.low);
      t.ok(r.tired.includes('core-sta'), 'dayanıklılık dolu değilken görünür', r.tired);
    });

    await t.step('çatışmada, nişan alırken, aranırken, genişletilmiş HUD\'da ve Her Zaman ayarında hepsi görünür', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, all = () => MS.on().length;
        MS.full(); MS.tick(); MS.tick(); const quiet = all();
        P.aiming = true; MS.tick(0.1); const aim = all(); P.aiming = false;
        G.law.level = 1; MS.tick(0.1); const law = all(); G.law.level = 0;
        const n = new NPC(P.x + 120, P.y, 'bandit', { hostile: true }); n.aggro = true; G.addEnt(n);
        MS.tick(0.1); const fight = all(); n.remove = true; G.ents = G.ents.filter(e => !e.remove);
        UI.hudX = 5; MS.tick(0.1); const xhud = all(); UI.hudX = 0;
        G.settings.meters = 1; MS.tick(0.1); const always = all(); G.settings.meters = 0;
        MS.tick(0.1); const back = all();
        return { quiet, aim, law, fight, xhud, always, back };
      });
      t.eq(r.quiet, 0, 'önce sönük');
      t.ok(r.aim === 7 && r.law === 7 && r.fight === 7, 'nişan, aranma ve yakındaki düşman: hepsi görünür', r);
      t.ok(r.xhud === 7 && r.always === 7, 'genişletilmiş HUD ve Her Zaman ayarı: hepsi görünür', r);
      t.eq(r.back, 0, 'sonra yine söner');
    });

    await t.step('ayar: Görüntü sekmesinde Göstergeler (Gerektiğinde / Her Zaman), seçim saklanır', async () => {
      const r = await p.evaluate(async () => {
        UI.openSettings(2, 'meters'); await new Promise(res => setTimeout(res, 200));
        const row = document.querySelector('.st-row[data-k="meters"]');
        const opts = row ? [...row.querySelectorAll('[data-v]')].map(e => e.textContent) : [];
        row.querySelector('[data-v="1"]').click(); await new Promise(res => setTimeout(res, 200));
        const v = G.settings.meters;
        UI.top().onBack(); await new Promise(res => setTimeout(res, 200));   // geri çıkınca ayarlar saklanır
        const saved = JSON.parse(Platform.get(SET_KEY) || '{}').meters;
        UI.closeAll(); G.settings.meters = 0; G.saveSettings();
        return { opts, v, saved };
      });
      t.eq(r.opts, ['Gerektiğinde', 'Her Zaman'], 'seçenekler');
      t.ok(r.v === 1 && r.saved === 1, 'Her Zaman seçilir ve saklanır', r);
    });

    await t.step('ipucu bir kez çıkar: sayılar için kamp tuşu ve ayarın yeri', async () => {
      const r = await p.evaluate(() => {
        window.__testNoGuide = false; if (G.hints) delete G.hints.meters;
        MS.full(); MS.tick();
        const h1 = UI.el.help.textContent; UI.el.help.innerHTML = '';
        MS.tick(); const h2 = UI.el.help.textContent;
        window.__testNoGuide = true;
        return { h1, h2 };
      });
      t.ok(/Dolu göstergeler söner/.test(r.h1) && /Ayarlar > Görüntü > Göstergeler/.test(r.h1), 'ipucu çıkar', r.h1);
      t.ok(!/Dolu göstergeler/.test(r.h2), 'yalnızca bir kez');
    });
  },
};
