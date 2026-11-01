'use strict';
/* Tehlike kartı: can götüren durumlar (zehir, hastalık, susuzluk, açlık, sıcaktan ya da soğuktan bitkinlik, bitkinlik)
   sağ üstte bir kartta; ne kadar süreceği, bu gidişle bayılmaya ya da ölüme kalan süre (oyunla tutarlı tahmin) ve ne
   yapmalı (çantadaki işe yarar eşyalar ve sayıları, hızlı kullanım tuşu, en yakın doktor). Zehir tek başına canı %15'in
   altına indirmez; sıcak ve soğuk 2. aşamada (birikmiş yük) karta çıkar. Hızlı kullanım zehirliyken önce panzehiri kullanır. */
module.exports = {
  name: 'Tehlike kartı',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = false;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.spot = s;
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      // uzun benzetimlerde yeni hayvan, yolcu ve rastgele olay doğmaz (gece bir kurt saldırısı ölçülen hasarı bozmasın); olanlar kaldırılır
      G.spawnTick = () => {}; for (const e of G.ents) if (e.kind === 'animal') e.remove = true;
      // sıcaklık sabit ve ılık: yük birikmez (tahmin ve oyun aynı koşulda)
      G.ambientTemp = () => 18;
      // temiz başlangıç: durum yok, çanta boş
      window.reset = () => {
        const P = G.player; G.state = 'play'; TH.goto(spot[0], spot[1]);
        P.poison = 0; P.sick = 0; P.painT = 0; P.faintCd = 0; P.hunger = P.thirst = P.energy = 80; P.hp = P.maxHp; P.canteen = 0; P.coat = null; P.warmBuff = 0;
        for (const id of Object.keys(P.inv)) delete P.inv[id];
        G.coldness = 0; G.hotness = 0; G.heatLoad = 0; G.coldLoad = 0; G.fireHeat = 0; G._feltOk = false;
      };
      window.card = () => {
        UI.dangerCard();
        const e = document.querySelector('#hud-danger');
        return { hidden: e.classList.contains('hidden'), text: e.innerText.replace(/\s+/g, ' ').trim(), ids: [...e.querySelectorAll('.dg-c')].map(c => c.dataset.id), html: e.innerHTML };
      };
      // oyunu kare kare oynat: durum değişene ya da süre dolana dek (sn)
      window.runUntil = (sec, stop) => { let f = 0; while (f < sec * 30 && !stop()) { G.update(1 / 30); f++; } return f / 30; };
      window.fadeDone = () => new Promise(r => { const k = setInterval(() => { if (!UI.state && G.state === 'play') { clearInterval(k); r(); } }, 50); });
      UI.showDeath = () => {};   // ölüm ekranı açılmasın; sebep G.deathCause'ta
    });

    await t.step('durum yokken kart gizli; zehirlenince kalan süre, çubuk, tahmin ve ilaçlar', async () => {
      const r = await p.evaluate(() => {
        reset(); const off = card();
        const P = G.player; P.poison = 252; P.hp = 45; P.addItem('antidote', 2, true); P.addItem('snake_oil', 1, true);
        const on = card(), fc = G.dangerForecast(), left = fmtSec(P.poison / MIN_PER_SEC);
        const bar = document.querySelector('#hud-danger .dg-bar i').style.width;
        // hızlı kullanım tuşu panzehirin hemen yanında
        const quickNext = /Panzehir ×2<span class="btn/.test(on.html);
        reset();
        return { off, on, fc, bar, quickNext, left };
      });
      t.ok(r.off.hidden, 'durum yokken gizli');
      t.ok(!r.on.hidden, 'zehirlenince görünür');
      t.eq(r.on.ids, ['poison'], 'yalnızca zehir');
      t.eq(r.left, '1 dk 55 sn', 'kalan süre: 252 oyun dakikası ≈ 115 gerçek saniye');
      t.ok(/ZEHİRLENDİN/.test(r.on.text) && r.on.text.includes(r.left), 'başlık ve kalan süre', r.on.text);
      t.eq(r.bar, '70%', 'çubuk zehrin kalanını gösterir (252/360)');
      t.eq(r.fc.ttd, null, 'zehir tek başına öldürmez');
      t.ok(r.fc.low > 0.15 && r.fc.low < 0.3, 'kalan zehrin götüreceği can kadar düşer', r.fc);
      t.ok(new RegExp(`Bu gidişle ölmezsin · en düşük can %${Math.round(r.fc.low * 100)}`).test(r.on.text), 'kartta yazar', r.on.text);
      t.ok(/Panzehir ×2/.test(r.on.text) && /Yılan Yağı ×1/.test(r.on.text), 'çantadaki ilaçlar ve sayıları', r.on.text);
      t.ok(r.quickNext, 'hızlı kullanım tuşu panzehirin yanında');
    });

    await t.step('tahmin oyunla tutarlı: zehir canı %15\'te bırakır, en düşük can doğru', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        reset(); P.poison = 360; P.hp = 20;
        out.low20 = G.dangerForecast();
        let low = P.hp; runUntil(170, () => { low = Math.min(low, P.hp); return !(P.poison > 0); });
        out.min20 = low / P.maxHp; out.alive20 = G.state === 'play'; out.left = P.poison;
        reset(); P.poison = 360; P.hp = 95;
        const fc = G.dangerForecast(); out.fc = fc; out.text = card().text;
        low = P.hp; runUntil(170, () => { low = Math.min(low, P.hp); return !(P.poison > 0); });
        out.low = low / P.maxHp; out.alive = G.state === 'play' && P.hp > 0;
        reset();
        return out;
      });
      t.eq(r.low20.ttd, null, 'düşük canla da ölüm yok');
      t.near(r.low20.low, 0.15, 0.001, 'tahmin: can %15\'te durur');
      t.ok(r.alive20 && r.min20 >= 0.149, 'oyunda da %15\'in altına inmedi', r);
      t.eq(r.left, 0, 'zehir geçti');
      t.eq(r.fc.ttd, null, 'yetecek can: ölüm yok');
      t.ok(/Bu gidişle ölmezsin/.test(r.text), 'kartta ölmezsin yazar', r.text);
      t.ok(r.alive, 'gerçekten ölmedi');
      t.near(r.low, r.fc.low, 0.02, 'en düşük can tahmine yakın');
    });

    await t.step('tahmin oyunla tutarlı: önce bayılırsın; yakın zamanda bayıldıysan ölürsün', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, out = {};
        reset(); P.thirst = 0; P.hp = 30; P.poison = 120;
        out.fcF = G.dangerForecast(); out.textF = card().text;
        out.fainted = runUntil(200, () => G.state !== 'play'); out.state = G.state; out.hpF = P.hp / P.maxHp;
        await fadeDone();
        reset(); P.thirst = 0; P.hp = 20; P.faintCd = 1000;
        out.fcD = G.dangerForecast(); out.textD = card().text;
        out.died = runUntil(200, () => G.state !== 'play'); out.cause = G.deathCause;
        reset();
        return out;
      });
      t.ok(r.fcF.faint && r.fcF.ttd > 0, 'tahmin: bayılma', r.fcF);
      t.ok(/Bu gidişle bayılmaya/.test(r.textF), 'kartta bayılmaya yazar', r.textF);
      t.eq(r.state, 'faint', 'bayıldı');
      t.near(r.fainted, r.fcF.ttd, 1.5, 'bayılma anı tahmine yakın');
      t.near(r.hpF, 0.1, 0.01, 'can %10\'da bayılır');
      t.ok(!r.fcD.faint && r.fcD.ttd > 0, 'yakın zamanda bayıldıysan tahmin ölüm', r.fcD);
      t.ok(/Bu gidişle ölüme/.test(r.textD), 'kartta ölüme yazar', r.textD);
      t.near(r.died, r.fcD.ttd, 1.5, 'gerçek ölüm anı tahmine yakın');
      t.eq(r.cause, 'susuzluk', 'sebep');
    });

    await t.step('ilaç yoksa en yakın doktor: kasaba, uzaklık, yön', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player; P.poison = 200; P.hp = P.maxHp;
        const c = card();
        const tw = G.nearestTown(P.x, P.y, t => t.buildings.some(b => b.type === 'doctor')), b = tw.buildings.find(b => b.type === 'doctor');
        const want = `Doktor: ${tw.n} · ${fmtDist(dist(P.x, P.y, b.door.x, b.door.y))} ${dirWord(b.door.x - P.x, b.door.y - P.y)}`;
        reset();
        return { text: c.text, want };
      });
      t.ok(/Çantanda panzehir yok\./.test(r.text), 'ilaç yok', r.text);
      t.ok(r.text.includes(r.want), 'doktor satırı', r);
    });

    await t.step('yön sözcükleri ve süre biçimi', async () => {
      const r = await p.evaluate(() => ({
        dirs: [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].map(([x, y]) => dirWord(x, y)),
        secs: [5, 42, 60, 185, 3725].map(fmtSec),
      }));
      t.eq(r.dirs, ['doğuda', 'güneydoğuda', 'güneyde', 'güneybatıda', 'batıda', 'kuzeybatıda', 'kuzeyde', 'kuzeydoğuda'], 'sekiz yön');
      t.eq(r.secs, ['5 sn', '42 sn', '1 dk 00 sn', '3 dk 05 sn', '1 sa 02 dk'], 'süre');
    });

    await t.step('hızlı kullanım zehirliyken önce panzehiri kullanır, zehir yokken eskisi gibi', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player, out = {};
        P.addItem('antidote', 1, true); P.addItem('health_cure', 1, true); P.hp = 50; P.poison = 40;
        out.pick = G.quickPick(); G.quickUse();
        out.poison = P.poison; out.antidote = P.count('antidote'); out.cure = P.count('health_cure');
        out.after = G.quickPick();
        reset();
        return out;
      });
      t.eq(r.pick, 'antidote', 'zehirliyken panzehir');
      t.eq(r.poison, 0, 'zehir geçti'); t.eq(r.antidote, 0, 'panzehir kullanıldı'); t.eq(r.cure, 1, 'sağlık iksiri durdu');
      t.eq(r.after, 'health_cure', 'zehir yokken önce can');
    });

    await t.step('açlık ve susuzluk: iki durum, matara ve yiyecek, bayılmaya kalan süre', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player;
        P.hunger = 0; P.thirst = 0; P.hp = 70; P.addItem('beans', 2, true); P.addItem('bread', 1, true); P.addItem('canteen', 1, true); P.canteen = 2;
        const c = card(), fc = G.dangerForecast(), q = G.quickPick();
        reset();
        return { c, fc, q, mps: MIN_PER_SEC };
      });
      t.eq(r.c.ids, ['thirst', 'hunger'], 'iki durum, önce susuzluk');
      t.ok(/SUSUZSUN/.test(r.c.text) && /su içene dek/.test(r.c.text) && /Mataradan iç \(2\/5\)/.test(r.c.text), 'susuzluk: matara', r.c.text);
      t.ok(/AÇSIN/.test(r.c.text) && /Konserve Fasulye ×2/.test(r.c.text) && /Ekmek ×1/.test(r.c.text), 'açlık: yiyecekler, çoktan aza', r.c.text);
      t.eq(r.q, 'canteen', 'hızlı kullanım matarayı seçer');
      t.ok(r.fc.faint, 'önce bayılırsın');
      t.near(r.fc.ttd, (70 - 10) / ((2 + 4) * r.mps / 60), 1, 'bayılmaya kalan süre: 60 can / (2+4 can/oyun saati)');
    });

    await t.step('soğuk, sıcak, bitkinlik ve hastalık: aşamaya göre başlık, yük çubuğu, öneri', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        reset(); G.coldness = 0.6; out.cold1 = card();
        reset(); G.coldness = 0.6; G.coldLoad = 1.5; P.addItem('coffee', 1, true); out.cold2 = card();
        out.coldBar = document.querySelector('#hud-danger .dg-bar i').style.width;
        G.coldLoad = 2.6; out.cold3 = card();
        reset(); G.hotness = 0.8; out.heat1 = card();
        reset(); G.hotness = 0.8; G.heatLoad = 1.5; P.addItem('sarsaparilla', 1, true); P.addItem('beer', 1, true); out.heat2 = card();
        G.heatLoad = 2.6; out.heat3 = card();
        reset(); P.energy = 0; out.tired = card();
        reset(); P.sick = 6; P.addItem('quinine', 1, true); out.sick = card(); out.sickTtd = G.dangerForecast();
        reset(); out.gone = card();
        return out;
      });
      t.ok(r.cold1.hidden && r.heat1.hidden, '1. aşamada (yalnızca üşümek, sıcak basması) kart yok');
      t.ok(/TİTRİYORSUN/.test(r.cold2.text) && /ısınana dek/.test(r.cold2.text) && /Kahve ×1/.test(r.cold2.text) && /Ateşe yaklaş/.test(r.cold2.text), 'soğuk 2. aşama', r.cold2.text);
      t.eq(r.coldBar, '60%', 'çubuk: yük 1,5 / 2,5');
      t.ok(/DONUYORSUN/.test(r.cold3.text), 'soğuk 3. aşama', r.cold3.text);
      t.ok(/SICAKTAN BİTKİNSİN/.test(r.heat2.text) && /Sarsaparilla ×1/.test(r.heat2.text) && !/Bira/.test(r.heat2.text) && /Gölgeye/.test(r.heat2.text), 'sıcak 2. aşama: içki önerilmez', r.heat2.text);
      t.ok(/SICAK ÇARPMASI/.test(r.heat3.text), 'sıcak 3. aşama', r.heat3.text);
      t.ok(/BİTKİNSİN/.test(r.tired.text) && /uyuyana dek/.test(r.tired.text) && /Uyu:/.test(r.tired.text), 'bitkinlik', r.tired.text);
      t.ok(/HASTASIN/.test(r.sick.text) && /2 dk 44 sn/.test(r.sick.text) && /Kinin ×1/.test(r.sick.text), 'hastalık: 6 oyun saati ≈ 2 dk 44 sn', r.sick.text);
      t.eq(r.sickTtd.ttd, null, 'hastalık tek başına öldürmez (geçince can yenilenir)');
      t.ok(r.gone.hidden, 'durum geçince kart kaybolur');
    });

    await t.step('İngilizce', async () => {
      const r = await p.evaluate(() => {
        I18N.setLang('en');
        reset(); const P = G.player; P.poison = 252; P.hp = 45; P.addItem('antidote', 2, true);
        const a = card().text;
        reset(); P.poison = 200; const b = card().text;
        reset(); P.thirst = 0; P.hp = 50; const c = card().text;
        reset(); I18N.setLang('tr');
        return { a, b, c };
      });
      t.ok(/POISONED/.test(r.a) && /You'll survive at this rate/.test(r.a) && /Antidote ×2/.test(r.a), 'zehir kartı', r.a);
      t.ok(/No antidote in your satchel\./.test(r.b) && /Doctor: .* to the /.test(r.b), 'doktor satırı', r.b);
      t.ok(/At this rate, you'll pass out in/.test(r.c), 'bayılma tahmini', r.c);
    });
  },
};
