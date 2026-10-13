'use strict';
/* Tehlike kartı: can götüren durumlar (zehir, hastalık, susuzluk, açlık, soğuk, sıcak, bitkinlik) sağ üstte bir kartta;
   ne kadar süreceği, bu gidişle ölüme kalan süre (oyunla tutarlı tahmin) ve ne yapmalı (çantadaki işe yarar eşyalar ve
   sayıları, hızlı kullanım tuşu, en yakın doktor). Hızlı kullanım zehirliyken önce panzehiri kullanır. */
module.exports = {
  name: 'Tehlike kartı',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = false;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.spot = s;
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      // temiz başlangıç: durum yok, çanta boş
      window.reset = () => {
        const P = G.player; G.state = 'play'; TH.goto(spot[0], spot[1]);
        P.poison = 0; P.sick = 0; P.painT = 0; P.hunger = P.thirst = P.energy = 80; P.hp = P.maxHp; P.canteen = 0;
        for (const id of Object.keys(P.inv)) delete P.inv[id];
        G.coldness = 0; G.hotness = 0;
      };
      window.card = () => {
        UI.dangerCard();
        const e = document.querySelector('#hud-danger');
        return { hidden: e.classList.contains('hidden'), text: e.innerText.replace(/\s+/g, ' ').trim(), ids: [...e.querySelectorAll('.dg-c')].map(c => c.dataset.id), html: e.innerHTML };
      };
      UI.showDeath = () => {};   // ölüm ekranı açılmasın; sebep G.deathCause'ta
    });

    await t.step('durum yokken kart gizli; zehirlenince kalan süre, çubuk, ölüme kalan süre ve ilaçlar', async () => {
      const r = await p.evaluate(() => {
        reset(); const off = card();
        const P = G.player; P.poison = 70; P.hp = 45; P.addItem('antidote', 2, true); P.addItem('snake_oil', 1, true);
        const on = card(), fc = G.dangerForecast();
        const bar = document.querySelector('#hud-danger .dg-bar i').style.width;
        // hızlı kullanım tuşu panzehirin hemen yanında
        const quickNext = /Panzehir ×2<span class="btn/.test(on.html);
        reset();
        return { off, on, ttd: fc.ttd, bar, quickNext };
      });
      t.ok(r.off.hidden, 'durum yokken gizli');
      t.ok(!r.on.hidden, 'zehirlenince görünür');
      t.eq(r.on.ids, ['poison'], 'yalnızca zehir');
      t.ok(/ZEHİRLENDİN/.test(r.on.text) && /1 dk 10 sn/.test(r.on.text), 'başlık ve kalan süre', r.on.text);
      t.eq(r.bar, '78%', 'çubuk zehrin kalanını gösterir (70/90)');
      t.near(r.ttd, 40, 1, 'ölüme kalan süre: 45 can / (1,6 zehir − yenilenme)');
      t.ok(/Bu gidişle ölüme 4[01] sn/.test(r.on.text), 'kartta yazar (yukarı yuvarlanır)', r.on.text);
      t.ok(/Panzehir ×2/.test(r.on.text) && /Yılan Yağı ×1/.test(r.on.text), 'çantadaki ilaçlar ve sayıları', r.on.text);
      t.ok(r.quickNext, 'hızlı kullanım tuşu panzehirin yanında');
    });

    await t.step('tahmin oyunla tutarlı: o sürede ölünür; yetecek can varsa ölmezsin ve en düşük can doğru', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        reset(); P.poison = 60; P.hp = 20;
        out.ttd = G.dangerForecast().ttd;
        let f = 0; while (G.state === 'play' && f < 30 * 60) { G.update(1 / 30); f++; }
        out.died = f / 30; out.cause = G.deathCause;
        reset(); P.poison = 60; P.hp = 95;
        const fc = G.dangerForecast(); out.fc = fc; out.text = card().text;
        let low = P.hp; for (let k = 0; k < 30 * 65; k++) { G.update(1 / 30); low = Math.min(low, P.hp); }
        out.low = low / P.maxHp; out.alive = G.state === 'play' && P.hp > 0;
        reset();
        return out;
      });
      t.near(r.died, r.ttd, 1.5, 'gerçek ölüm anı tahmine yakın');
      t.eq(r.cause, 'zehirlenme', 'sebep');
      t.eq(r.fc.ttd, null, 'yetecek can: ölüm yok');
      t.ok(/Bu gidişle ölmezsin/.test(r.text), 'kartta ölmezsin yazar', r.text);
      t.ok(r.alive, 'gerçekten ölmedi');
      t.near(r.low, r.fc.low, 0.03, 'en düşük can tahmine yakın');
    });

    await t.step('ilaç yoksa en yakın doktor: kasaba, uzaklık, yön', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player; P.poison = 50; P.hp = P.maxHp;
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

    await t.step('açlık ve susuzluk: iki durum, matara ve yiyecek, ölüme kalan süre', async () => {
      const r = await p.evaluate(() => {
        reset(); const P = G.player;
        P.hunger = 0; P.thirst = 0; P.hp = 70; P.addItem('beans', 2, true); P.addItem('bread', 1, true); P.addItem('canteen', 1, true); P.canteen = 2;
        const c = card(), fc = G.dangerForecast(), q = G.quickPick();
        reset();
        return { c, ttd: fc.ttd, q, mps: MIN_PER_SEC };
      });
      t.eq(r.c.ids, ['thirst', 'hunger'], 'iki durum, önce susuzluk');
      t.ok(/SUSUZSUN/.test(r.c.text) && /su içene dek/.test(r.c.text) && /Mataradan iç \(2\/5\)/.test(r.c.text), 'susuzluk: matara', r.c.text);
      t.ok(/AÇSIN/.test(r.c.text) && /Konserve Fasulye ×2/.test(r.c.text) && /Ekmek ×1/.test(r.c.text), 'açlık: yiyecekler, çoktan aza', r.c.text);
      t.eq(r.q, 'canteen', 'hızlı kullanım matarayı seçer');
      t.near(r.ttd, 70 / ((6 + 10) * r.mps / 60), 1, 'ölüme kalan süre: 70 can / (6+10 can/oyun saati)');
    });

    await t.step('soğuk, sıcak, bitkinlik ve hastalık: başlık, süre ve öneri', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, out = {};
        reset(); G.coldness = 0.6; P.addItem('coffee', 1, true); out.cold = card();
        reset(); G.hotness = 0.8; P.addItem('sarsaparilla', 1, true); P.addItem('beer', 1, true); out.heat = card();
        reset(); P.energy = 0; out.tired = card();
        reset(); P.sick = 6; P.addItem('quinine', 1, true); out.sick = card(); out.sickTtd = G.dangerForecast();
        reset(); out.gone = card();
        return out;
      });
      t.ok(/DONUYORSUN/.test(r.cold.text) && /ısınana dek/.test(r.cold.text) && /Kahve ×1/.test(r.cold.text) && /Ateşe yaklaş/.test(r.cold.text), 'soğuk', r.cold.text);
      t.ok(/SICAK ÇARPIYOR/.test(r.heat.text) && /Sarsaparilla ×1/.test(r.heat.text) && !/Bira/.test(r.heat.text) && /Gölgeye/.test(r.heat.text), 'sıcak: içki önerilmez', r.heat.text);
      t.ok(/BİTKİNSİN/.test(r.tired.text) && /uyuyana dek/.test(r.tired.text) && /Uyu:/.test(r.tired.text), 'bitkinlik', r.tired.text);
      t.ok(/HASTASIN/.test(r.sick.text) && /2 dk 44 sn/.test(r.sick.text) && /Kinin ×1/.test(r.sick.text), 'hastalık: 6 oyun saati ≈ 2 dk 44 sn', r.sick.text);
      t.eq(r.sickTtd.ttd, null, 'hastalık tek başına öldürmez (geçince can yenilenir)');
      t.ok(r.gone.hidden, 'durum geçince kart kaybolur');
    });

    await t.step('İngilizce', async () => {
      const r = await p.evaluate(() => {
        I18N.setLang('en');
        reset(); const P = G.player; P.poison = 70; P.hp = 45; P.addItem('antidote', 2, true);
        const a = card().text;
        reset(); P.poison = 50; const b = card().text;
        reset(); I18N.setLang('tr');
        return { a, b };
      });
      t.ok(/POISONED/.test(r.a) && /At this rate, death in 4[01] s/.test(r.a) && /Antidote ×2/.test(r.a), 'zehir kartı', r.a);
      t.ok(/No antidote in your satchel\./.test(r.b) && /Doctor: .* to the /.test(r.b), 'doktor satırı', r.b);
    });
  },
};
