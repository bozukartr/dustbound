'use strict';
/* Rehber el kitabı (Günlük → Rehber): içindekiler ve konu konu oyunun ince işleyişi. Sayılar oyunun kurallarıyla aynı
   (oyun saati, can yenilenmesi ve kaybı, zehir, oyuncunun yeteneğine göre üşüme/sıcak çarpma eşiği); ilaç ve Odak
   listeleri eşya verisinden. Bir mekanikle ilk kez karşılaşınca (soğuk, yılan sokması, hastalık, Odak, ölüm, yaşlanma)
   ipucu Rehber'e yönlendirir ve konu "yeni" diye işaretlenir; Günlük'te rozet çıkar, Rehber açılınca okunmuş sayılır. */
module.exports = {
  name: 'Rehber el kitabı',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = false;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.spot = s;
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      // oyunun kendi ipucu zamanlayıcısı (gece, kamp, su kenarı…) testteki ipuçlarının üstüne yazmasın; gerektiğinde elle çağrılır
      window.hintTick0 = G.hintTick; G.hintTick = () => {};
      window.reset = () => {
        const P = G.player; UI.closeAll(); G.state = 'play'; TH.goto(spot[0], spot[1]);
        P.poison = 0; P.sick = 0; P.hunger = P.thirst = P.energy = 80; P.hp = P.maxHp; G.coldness = G.hotness = 0;
        UI.el.help.classList.add('hidden');
      };
      // Günlük'ü Rehber sekmesinde aç, içeriği oku
      window.guide = () => {
        UI.closeAll(); UI.openJournal(8);
        const el = document.querySelector('.journal'), sc = el.querySelector('.scroll');
        return {
          text: sc.innerText.replace(/\s+/g, ' '),
          toc: [...el.querySelectorAll('.hb-toc-i')].map(a => ({ id: a.dataset.hb, t: a.textContent, isNew: a.classList.contains('new') })),
          secs: [...el.querySelectorAll('.hb-sec')].map(s => s.id.slice(3)),
          newBadge: [...el.querySelectorAll('.hb-sec .hb-new')].map(b => b.closest('.hb-sec').id.slice(3)),
          meds: el.querySelectorAll('.hb-tab tr').length, welcome: !!el.querySelector('.guide .st-btn'),
        };
      };
      window.helpText = () => (UI.el.help.classList.contains('hidden') ? '' : UI.el.help.innerText.replace(/\s+/g, ' '));
    });

    await t.step('Rehber sekmesi: içindekiler ve bütün konular; boş ya da bozuk değer yok', async () => {
      const r = await p.evaluate(() => { reset(); const g = guide(); UI.closeAll(); return { g, n: Handbook.topics().length }; });
      t.eq(r.g.toc.map(x => x.id), r.g.secs, 'içindekiler konularla aynı sırada');
      t.eq(r.g.secs.length, r.n, 'bütün konular');
      for (const id of ['time', 'health', 'needs', 'temp', 'poison', 'meds', 'deadeye', 'horse', 'law', 'death', 'money', 'biz', 'aging', 'controls']) t.ok(r.g.secs.includes(id), 'konu: ' + id, r.g.secs);
      t.ok(!/undefined|NaN|null|\{\d\}/.test(r.g.text), 'boş ya da bozuk değer yok', r.g.text.match(/.{40}(undefined|NaN|null|\{\d\}).{40}/));
      t.ok(r.g.welcome, 'hoş geldin rehberi düğmesi duruyor');
      t.ok(!r.g.toc.some(x => x.isNew) && !r.g.newBadge.length, 'yeni oyunda yeni işaret yok', r.g.toc);
    });

    await t.step('sayılar oyunla aynı: oyun saati, can yenilenmesi ve kaybı, zehir, ödül avcısı eşiği', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player, out = { text: guide().text, hm: HUNTER_MIN, money: fmtMoney(HUNTER_MIN) }; UI.closeAll();
        // bir oyun saati kaç gerçek saniye: oyunu 6 sn oynat, saati ölç
        const c0 = G.clock; for (let f = 0; f < 180; f++) G.update(1 / 30);
        out.secPerHour = 60 / ((G.clock - c0) / 6);
        // can kaybı ve yenilenmesi (oyun saatinde)
        reset(); P.hunger = 0; out.hunger = G.survRates(false).parts.hunger;
        reset(); P.thirst = 0; out.thirst = G.survRates(false).parts.thirst;
        reset(); P.energy = 0; out.tired = G.survRates(false).parts.tired;
        reset(); P.hunger = P.thirst = 50; out.reg = G.survRates(false).reg;
        reset(); out.regFull = G.survRates(false).reg; out.regSleep = G.survRates(true).reg; out.married = G.hasPerk('married');
        // zehir: 90 sn, saniyede 1,6 (yenilenme kapalı)
        reset(); P.hunger = 15; P.poison = 90; P.hp = 90;
        for (let f = 0; f < 30; f++) G.update(1 / 30);
        out.poisonPerSec = 90 - P.hp; out.poisonLeft = P.poison;
        reset();
        return out;
      });
      t.near(r.secPerHour, 27, 0.5, 'oyun saati ≈ 27 gerçek saniye');
      t.ok(/bir saat gerçekte yaklaşık 27 saniye/.test(r.text) && /bir gün yaklaşık 11 dakika/.test(r.text), 'Rehber: saat ve gün', r.text.slice(0, 300));
      t.eq([r.hunger, r.thirst, r.tired], [6, 10, 3], 'oyunda açlık, susuzluk, uykusuzluk can kaybı');
      t.ok(/açlıkta saatte 6, susuzlukta 10, uykusuzlukta 3/.test(r.text), 'Rehber: aynı sayılar');
      t.ok(!r.married, 'evli değil (yenilenme çarpanı yok)');
      t.eq([r.reg, r.regFull, r.regSleep - r.regFull], [7, 13, 8], 'oyunda can yenilenmesi');
      t.ok(/Hızı oyun saatinde 7 can; açlık ve susuzluk 60'ın üstündeyse 13, uyurken 8 fazlası/.test(r.text), 'Rehber: aynı sayılar');
      t.near(r.poisonPerSec, 1.6, 0.1, 'oyunda zehir saniyede 1,6'); t.near(r.poisonLeft, 89, 0.1, 'zehir saniyede 1 azalır (90 sn)');
      t.ok(/90 saniye/.test(r.text) && /saniyede 1,6 can/.test(r.text), 'Rehber: zehir');
      t.ok(r.text.includes(`ödül ${r.money} ve üstündeyse`), 'Rehber: ödül avcısı eşiği HUNTER_MIN', r.money);
    });

    await t.step('ilaç tablosu ve Odak listesi eşya verisinden; Yılan Yağı zehri söker ve Odak +100', async () => {
      const r = await p.evaluate(() => {
        reset(); const g = guide(); UI.closeAll();
        const meds = Object.values(ITEMS).filter(it => it.c === 'med' && it.e), focus = Object.values(ITEMS).filter(it => it.e && it.e.deadeye > 0);
        UI.openJournal(8);
        const md = document.querySelector('#hb-meds').innerText.replace(/\s+/g, ' '), fd = document.querySelector('#hb-deadeye').innerText.replace(/\s+/g, ' ');
        const oil = [...document.querySelectorAll('#hb-meds tr')].find(tr => /Yılan Yağı/.test(tr.textContent));
        UI.closeAll();
        return { rows: g.meds, meds: meds.map(it => it.n), focus: focus.map(it => `${it.n} +${it.e.deadeye}`), md, fd, oil: oil && oil.innerText.replace(/\s+/g, ' ') };
      });
      t.eq(r.rows, r.meds.length, 'her ilaç bir satır');
      for (const n of r.meds) t.ok(r.md.includes(n), 'ilaç: ' + n);
      t.ok(r.oil && /Zehri yok eder/.test(r.oil) && /Hastalığı iyileştirir/.test(r.oil) && /Odak \+100/.test(r.oil), 'Yılan Yağı satırı', r.oil);
      for (const f of r.focus) t.ok(r.fd.includes(f), 'Odak: ' + f, r.fd);
      t.ok(r.fd.includes('Yılan Yağı +100'), 'Odak listesinde Yılan Yağı +100');
    });

    await t.step('üşüme ve sıcak çarpma eşiği oyuncuya göre; oyundaki eşikle aynı', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player, out = {};
        const read = () => { const m = guide().text.match(/Senin için şu an: (-?[\d,]+) °C altında üşürsün, (-?[\d,]+) °C üstünde sıcak çarpar/); UI.closeAll(); return m ? [m[1], m[2]] : null; };
        // oyunun eşiği: hissedilen sıcaklık eşiğin hemen altında/üstündeyken üşüme ve sıcak çarpma başlar mı
        const amb0 = G.ambientTemp, coat0 = P.coat, hat0 = P.look.hat;
        const feel = v => {   // hissedilen = ortam: palto, şapka, ateş, yağmur, sıcak içecek ve serinletici yok
          G.ambientTemp = () => v; P.coat = null; P.look.hat = 'none'; P.warmBuff = 0; P.coolT = 0; G.fireHeat = 0; if (G.envCache) G.envCache.rain = 0;
          G.survivalUpdate(31, false); return [G.coldness, G.hotness];
        };
        const num = s => +s.replace(',', '.');
        const probe = th => ({ cold: [feel(num(th[0]) - 0.3)[0] > 0, feel(num(th[0]) + 0.3)[0] === 0], hot: [feel(num(th[1]) + 0.3)[1] > 0, feel(num(th[1]) - 0.3)[1] === 0] });
        // Hayatta Kalma 1. seviye (geçmişe göre değişir); 4. seviye ve soğuğa dayanıklılık kazanımı eşikleri genişletir
        const sk0 = G.skills.survival.lv; G.skills.survival.lv = 1;
        out.base = read(); out.baseProbe = probe(out.base);
        G.skills.survival.lv = 4; G.achieved.cold = 1;
        out.tough = read(); out.toughProbe = probe(out.tough);
        G.skills.survival.lv = sk0; delete G.achieved.cold; G.ambientTemp = amb0; P.coat = coat0; P.look.hat = hat0; G._feltOk = false;
        reset();
        return out;
      });
      t.eq(r.base, ['2,6', '33,4'], 'Hayatta Kalma 1: 2,6 °C altında üşür, 33,4 °C üstünde sıcak çarpar (virgülle)');
      t.eq(r.baseProbe, { cold: [true, true], hot: [true, true] }, 'oyunda da aynı eşik');
      t.eq(r.tough, ['-4,6', '34,6'], 'yetenek ve kazanımla eşikler değişir');
      t.eq(r.toughProbe, { cold: [true, true], hot: [true, true] }, 'oyunda da aynı eşik');
    });

    await t.step('ilk karşılaşma: ipucu Rehber\'e yönlendirir, konu yeni; Günlük\'te rozet, Rehber açılınca okunur', async () => {
      const r = await p.evaluate(() => {
        reset(); G.hints = {}; const out = {};
        G.coldness = 0.3; hintTick0.call(G); out.cold = helpText(); out.flag = G.hints['new:temp']; out.unread = Handbook.unread();
        G.coldness = 0; G.hotness = 0.3; out.hotShown = G.hintOnce('hot', 'Sıcak çarpıyor!'); out.hot = helpText();
        out.again = G.hintOnce('cold', 'x');
        // Günlük: Rehber sekmesinde rozet
        UI.closeAll(); UI.openJournal(0);
        out.dot = [...document.querySelectorAll('.journal .tab')].filter(n => n.querySelector('.tab-new')).map(n => n.dataset.tab);
        document.querySelector('.journal .tab[data-tab="8"]').click();
        out.tocNew = [...document.querySelectorAll('.hb-toc-i.new')].map(a => a.dataset.hb);
        out.tocBadge = (document.querySelector('.hb-toc-i.new em') || {}).textContent;
        out.secBadge = [...document.querySelectorAll('.hb-sec .hb-new')].map(b => b.closest('.hb-sec').id);
        out.after = { flag: G.hints['new:temp'], unread: Handbook.unread(), seen: G.hints['g:temp'] };
        document.querySelector('.journal .tab[data-tab="0"]').click();
        out.dotAfter = !!document.querySelector('.journal .tab-new');
        document.querySelector('.journal .tab[data-tab="8"]').click();
        out.tocNew2 = document.querySelectorAll('.hb-toc-i.new').length;
        // içindekilerden konuya kaydırır
        const sc = document.querySelector('.journal .scroll');
        document.querySelector('[data-hb="law"]').click();
        const s = document.querySelector('#hb-law');
        out.scroll = { top: sc.scrollTop, gap: Math.round(s.getBoundingClientRect().top - sc.getBoundingClientRect().top) };
        UI.closeAll(); reset();
        return out;
      });
      t.ok(/Üşüyorsun!/.test(r.cold) && /Ayrıntılar: .*Günlük → Rehber/.test(r.cold), 'ilk soğuk ipucu Rehber\'e yönlendirir', r.cold);
      t.eq([r.flag, r.unread], [1, true], 'Sıcak ve Soğuk konusu yeni');
      t.ok(r.hotShown && /Sıcak çarpıyor!/.test(r.hot) && !/Ayrıntılar/.test(r.hot), 'aynı konunun ikinci ipucu yönlendirmez', r.hot);
      t.eq(r.again, false, 'ipucu bir kez');
      t.eq(r.dot, ['8'], 'Günlük\'te Rehber sekmesinde rozet');
      t.eq(r.tocNew, ['temp'], 'içindekilerde yeni konu'); t.eq(r.tocBadge, 'YENİ', 'YENİ yazısı'); t.eq(r.secBadge, ['hb-temp'], 'konu başlığında YENİ');
      t.eq(r.after, { unread: false, seen: 1 }, 'Rehber açılınca okunmuş sayılır, konu bir daha işaretlenmez');
      t.ok(!r.dotAfter, 'rozet kalkar'); t.eq(r.tocNew2, 0, 'ikinci açılışta yeni yok');
      t.ok(r.scroll.top > 0 && Math.abs(r.scroll.gap) < 40, 'içindekilerden konuya kaydırır', r.scroll);
    });

    await t.step('gerçek olaylar konuyu işaretler: yılan sokması, hastalık, ölüm ve doktor, yaşlanma', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        const bite = () => {
          const s = new Animal(P.x + 8, P.y, 'snake'); s.state = 'attack'; s.t = 25; G.addEnt(s);
          for (let f = 0; f < 120 && !(P.poison > 0); f++) G.update(1 / 30);
          s.remove = true; G.update(1 / 30);
          return { poison: Math.round(P.poison), help: helpText() };
        };
        reset(); G.hints = {}; out.bite1 = bite(); out.bite1.flag = G.hints['new:poison'];
        reset(); out.bite2 = bite();
        reset(); G.hints = {}; G.sicken(6, 'Midene bir şey dokundu.', 6); out.sick = { help: helpText(), flag: G.hints['new:poison'] };
        reset(); G.hints = {}; G.respawn(); out.death = { help: helpText(), flag: G.hints['new:death'] };
        reset(); G.respawn(); out.death2 = helpText();
        reset(); G.hints = {}; G.onBirthday(25); out.young = !G.hints.aging;
        G.onBirthday(33); out.aging = { help: helpText(), flag: G.hints['new:aging'] };
        reset();
        return out;
      });
      t.near(r.bite1.poison, 90, 1, 'yılan soktu: 90 sn zehir');
      t.ok(/Yılan soktu!/.test(r.bite1.help) && /Ayrıntılar/.test(r.bite1.help) && r.bite1.flag === 1, 'ilk sokma: Zehir ve Hastalık konusu yeni', r.bite1);
      t.ok(/Yılan soktu!/.test(r.bite2.help) && !/Ayrıntılar/.test(r.bite2.help), 'sonraki sokmalarda uyarı yine çıkar, yönlendirme yok', r.bite2.help);
      t.ok(/Midene bir şey dokundu\./.test(r.sick.help) && /Ayrıntılar/.test(r.sick.help) && r.sick.flag === 1, 'ilk hastalık: aynı konu', r.sick);
      t.ok(/doktoru seni ölümün kıyısından döndürdü/.test(r.death.help) && /Ayrıntılar/.test(r.death.help) && r.death.flag === 1, 'ilk ölüm: Ölüm ve Doktor', r.death);
      t.ok(/doktoru seni ölümün kıyısından döndürdü/.test(r.death2) && !/Ayrıntılar/.test(r.death2), 'sonraki ölümlerde doktor mesajı yine çıkar', r.death2);
      t.ok(r.young, '33 yaşından önce yaşlanma ipucu yok');
      t.ok(/Yaşın ilerliyor/.test(r.aging.help) && /Ayrıntılar/.test(r.aging.help) && r.aging.flag === 1, '33 yaşında: Yaşlanma konusu yeni', r.aging);
    });

    await t.step('Odak ilk kez açılınca ipucu ve konu (gerçek tuşlar: sağ tık nişan, Q)', async () => {
      await p.evaluate(() => { reset(); G.hints = {}; const P = G.player; P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.de = 80; P.deadeye = false; });
      await p.mouse.move(820, 360); await p.mouse.down({ button: 'right' });
      try {
        await p.waitForFunction(() => G.player.aiming, null, { timeout: 4000 });
        await p.keyboard.press('KeyQ');
        await p.waitForFunction(() => G.player.deadeye, null, { timeout: 4000 });
      } finally { await p.mouse.up({ button: 'right' }); }
      const r = await p.evaluate(() => ({ help: helpText(), flag: G.hints['new:deadeye'], once: G.hints.deadeye }));
      t.ok(/Odak zamanı yavaşlatır/.test(r.help) && /Ayrıntılar/.test(r.help), 'ipucu', r.help);
      t.eq([r.flag, r.once], [1, 1], 'Odak konusu yeni');
      await p.evaluate(() => { G.player.deadeye = false; reset(); });
    });

    await t.step('eski kayıt: önceden görülmüş ipucu konuyu işaretlemez', async () => {
      const r = await p.evaluate(() => {
        reset(); G.hints = { cold: 1, poison: 1 };
        const shown = G.hintOnce('cold', 'x');
        return { shown, unread: Handbook.unread(), hints: Object.keys(G.hints) };
      });
      t.eq(r.shown, false, 'ipucu yeniden çıkmaz'); t.ok(!r.unread, 'yeni konu yok', r.hints);
    });

    await t.step('İngilizce: başlıklar, ondalık nokta, Türkçe harf kalmaz', async () => {
      const r = await p.evaluate(() => {
        I18N.setLang('en'); reset(); G.hints = {}; const sk0 = G.skills.survival.lv; G.skills.survival.lv = 1;
        G.coldness = 0.3; hintTick0.call(G); const help = helpText();
        const g = guide(); UI.closeAll();
        G.skills.survival.lv = sk0; I18N.setLang('tr'); reset();
        return { help, g };
      });
      t.ok(/Details: .*Journal → Guide/.test(r.help), 'ipucu yönlendirmesi', r.help);
      const titles = r.g.toc.map(x => x.t);
      for (const n of ['Time', 'Heat and Cold', 'Poison and Sickness', 'Medicine', 'Focus', 'Horse', 'Law and Bounty Hunters', 'Death and the Doctor']) t.ok(titles.some(x => x.startsWith(n)), 'başlık: ' + n, titles);
      t.ok(r.g.toc.find(x => x.id === 'temp').t.endsWith('NEW'), 'NEW rozeti', r.g.toc.find(x => x.id === 'temp'));
      t.ok(/below 2\.6 °C/.test(r.g.text) && /above 33\.4 °C/.test(r.g.text), 'ondalık nokta', r.g.text.match(/.{60}°C.{60}/));
      const tr = r.g.text.match(/.{30}[çğıöşüÇĞİÖŞÜ].{30}/);
      t.ok(!tr, 'Türkçe harf kalmadı', tr && tr[0]);
    });
  },
};
