'use strict';
/* Ayrıntılı ölüm ekranı: alınan hasar kaynak kaynak kaydedilir (aynı saldırganın isabetleri birikir); ölünce sebep,
   öldüren ve silahı, yer, zaman, son anlar dökümü (ölümcül satır işaretli), doktorun bedeli (paranın dörtte biri,
   banka güvende, kalıcı iz, aranma biter) ya da Tek Hayat'ta kaydın silindiği ve sebebe göre bir öğüt yazar. */
module.exports = {
  name: 'Ölüm ekranı',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    await p.evaluate(() => {
      UI.closeAll(); G.godMode = false;
      const s = TH.openSpot(); TH.goto(s[0], s[1]); TH.clearNpcs();
      window.spot = s;
      if (G.horse) { G.horse.x = s[0] + 400; G.horse.y = s[1]; }
      window.revive = () => {
        UI.closeAll(); TH.clearNpcs(); G.state = 'play'; G.dmgLog = []; G.deathInfo = null; G.deathCause = null;
        const P = G.player; P.hp = P.maxHp; P.poison = 0; P.sick = 0; P.hunger = P.thirst = P.energy = 80; TH.goto(spot[0], spot[1]);
        G.difficulty = 'normal';
      };
      window.npc = (role, weapon, name, dx = -40) => { const P = G.player, n = new NPC(P.x + dx, P.y, role, { hostile: true, weapon, name }); G.addEnt(n); return n; };
      // ölüm ekranı 1,8 sn sonra açılır; testte hemen açmak için bekletme yok
      window.waitDeath = () => new Promise(r => { const k = setInterval(() => { if (document.querySelector('.deathscreen')) { clearInterval(k); r(); } }, 50); });
    });

    await t.step('hasar kaydı: aynı saldırganın isabetleri birikir, kaynaklar ayrı satır; zehirde yılanın adı', async () => {
      const r = await p.evaluate(() => {
        revive(); const P = G.player;
        // dünyaya eklenmeyen haydut: yalnızca saldıranın kimliği (kendisi ateş etmesin)
        const b = new NPC(P.x - 40, P.y, 'bandit', { weapon: 'repeater', name: 'Tom Reed' });
        P.hurt(10, 'haydut', false, b, 'repeater'); G.update(1 / 30); P.hurt(12, 'haydut', false, b, 'repeater');
        P.poison = 20; P.poisonBy = 'snake';
        for (let f = 0; f < 60; f++) G.update(1 / 30);
        P.poison = 0; P.thirst = 0;
        for (let f = 0; f < 30; f++) G.update(1 / 30);
        const L = G.dmgLog.map(e => ({ src: e.src, who: e.who, weapon: e.weapon, n: e.n, sum: Math.round(e.sum * 10) / 10 }));
        revive();
        return L;
      });
      const by = s => r.find(e => e.src === s);
      t.ok(by('haydut') && by('haydut').n === 2 && by('haydut').sum === 22, 'iki isabet tek satırda', r);
      t.eq([by('haydut').who, by('haydut').weapon], ['Tom Reed', 'repeater'], 'saldıran ve silahı');
      t.ok(by('zehir') && by('zehir').who === 'Çıngıraklı Yılan' && by('zehir').sum > 2, 'zehir satırı, yılanın adıyla', r);
      t.ok(by('thirst') && by('thirst').sum > 0, 'susuzluk ayrı satır', r);
    });

    await t.step('ölüm raporu: sebep, öldüren ve silahı, yer, zaman, ölümcül satır', async () => {
      const r = await p.evaluate(() => {
        revive(); const P = G.player;
        const b = npc('bandit', 'repeater', 'Tom Reed', -60);
        P.hurt(30, 'haydut', false, b, 'repeater'); b.remove = true;
        const h = npc('hunter', 'winchester', 'Jed Barlow');
        P.hp = 15; G.fireRay(h.x, h.y, 0, 120, 60, h, { npc: true }); h.remove = true;
        const D = G.deathInfo, W = G.world, tw = W.townAt(P.x, P.y, 60);
        return { D, cause: G.deathCause, place: tw ? tw.n : W.regionAt(P.x, P.y), time: G.timeStr(), state: G.state };
      });
      t.eq(r.state, 'dead', 'öldü');
      t.eq(r.cause, 'ödül avcısı kurşunu', 'sebep');
      t.eq([r.D.src, r.D.who, r.D.weapon], ['avci', 'Jed Barlow', 'winchester'], 'öldüren ve silahı');
      t.eq(r.D.place, r.place, 'yer'); t.eq(r.D.time, r.time, 'zaman');
      t.ok(r.D.near && r.D.near.n && r.D.near.dir, 'kasaba dışında en yakın kasaba ve yönü', r.D.near);
      t.eq(r.D.log.map(e => [e.src, e.kill]), [['haydut', false], ['avci', true]], 'son anlar eskiden yeniye, ölümcül satır işaretli');
      t.eq(Math.round(r.D.log[1].sum), 15, 'ölümcül darbe kalan canı kadar sayılır');
    });

    await t.step('ölüm ekranı: döküm, doktorun bedeli ve öğüt; Devam Et bedeli gerçekten öder', async () => {
      await p.evaluate(() => {
        revive(); const P = G.player; P.money = 6.4; G.bank = 12.5; G.law.level = 2; G.law.bounty = 30; window.scars0 = G.scars || 0;
        const h = npc('hunter', 'winchester', 'Jed Barlow'); P.hp = 15; G.fireRay(h.x, h.y, 0, 120, 60, h, { npc: true }); h.remove = true;
      });
      await p.evaluate(() => waitDeath());
      const r = await p.evaluate(() => {
        const el = document.querySelector('.deathscreen'), text = el.innerText.replace(/\s+/g, ' ');
        const out = { text, grid: !!el.querySelector('.ds-grid'), kill: el.querySelector('.dl-r.kill .dl-l').textContent, focus: !!el.querySelector('#ds-cont') };
        document.querySelector('#ds-cont').click();
        const P = G.player;
        Object.assign(out, { money: P.money, bank: G.bank, scars: (G.scars || 0) - scars0, level: G.law.level, bounty: G.law.bounty, log: G.dmgLog.length, state: G.state });
        return out;
      });
      t.ok(r.grid, 'ayrıntılı ekran');
      t.ok(/Ölüm sebebi: ödül avcısı kurşunu/.test(r.text) && /Öldüren: Jed Barlow · /.test(r.text), 'sebep ve öldüren', r.text);
      t.ok(/SON ANLAR/.test(r.text) && /Ödül avcısı kurşunu/.test(r.kill), 'son anlar, ölümcül satır', r.kill);
      t.ok(/−\$1\.60/.test(r.text) && /Bankadaki \$12\.50 güvende/.test(r.text) && /Kalıcı iz/.test(r.text) && /Aranman sona erer/.test(r.text), 'bedel', r.text);
      t.ok(/parayla anlaşabilir ya da teslim olabilirsin/.test(r.text), 'sebebe göre öğüt', r.text);
      t.eq(r.state, 'play', 'doktor kurtardı');
      t.near(r.money, 4.8, 0.001, 'paranın dörtte biri gitti'); t.eq(r.bank, 12.5, 'banka güvende');
      t.eq(r.scars, 3, 'kalıcı iz'); t.eq(r.level, 0, 'aranma bitti'); t.eq(r.bounty, 30, 'ödül kaldı'); t.eq(r.log, 0, 'döküm sıfırlandı');
    });

    await t.step('susuzluktan ölüm: sebep çevrili, döküm ve öğüt', async () => {
      await p.evaluate(() => {
        revive(); const P = G.player; P.thirst = 0; P.hunger = 50; P.hp = 2; P.money = 0;
        for (let f = 0; f < 30 * 30 && G.state === 'play'; f++) G.update(1 / 30);
      });
      await p.evaluate(() => waitDeath());
      const r = await p.evaluate(() => ({ D: G.deathInfo, cause: G.deathCause, text: document.querySelector('.deathscreen').innerText.replace(/\s+/g, ' ') }));
      t.eq(r.cause, 'susuzluk', 'sebep'); t.eq(r.D.src, 'thirst', 'anahtar');
      t.ok(r.D.log.some(e => e.src === 'thirst' && e.kill), 'ölümcül satır susuzluk', r.D.log);
      t.ok(/Susuzluk/.test(r.text) && /boyunca/.test(r.text) && /Mataranı dolu tut/.test(r.text) && /Cebinde para yok/.test(r.text), 'ekran', r.text);
    });

    await t.step('Tek Hayat: kaydın silindiği yazar, Hayatının Özeti', async () => {
      const r = await p.evaluate(async () => {
        revive(); G.difficulty = 'hard'; let del = 0; const d0 = G.deleteSave; G.deleteSave = () => { del++; };
        const P = G.player, w = new Animal(P.x + 20, P.y, 'bear'); G.addEnt(w);
        P.hp = 20; P.hurt(25, 'bear', false, w); w.remove = true;
        await waitDeath();
        const el = document.querySelector('.deathscreen'), out = { text: el.innerText.replace(/\s+/g, ' '), cont: el.querySelector('#ds-cont').textContent, legacy: !!el.querySelector('#ds-legacy'), del, src: G.deathInfo.src };
        G.deleteSave = d0; revive();
        return out;
      });
      t.ok(/TEK HAYAT/.test(r.text) && /Bu hayat burada biter; kaydı silindi\./.test(r.text), 'kayıt silindi', r.text);
      t.eq(r.cont, 'Hayatının Özeti', 'özet düğmesi'); t.ok(!r.legacy, 'Bu Hayatı Bitir yok'); t.eq(r.del, 1, 'kayıt bir kez silindi');
      t.eq(r.src, 'bear', 'ayı saldırısı');
      t.ok(/Boz Ayı saldırısı/.test(r.text) && /Vahşi hayvanlarla/.test(r.text), 'döküm ve öğüt', r.text);
    });

    await t.step('düelloda erken davranıp vurulunca: düello kurşunu, öldüren rakip (gerçek tuş)', async () => {
      await p.evaluate(() => {
        revive(); const P = G.player; P.giveWeapon('cattleman', true); P.hp = 30;
        const e = new NPC(P.x + 40, P.y, 'traveler', { name: 'Ada Kline', weapon: 'schofield' }); G.addEnt(e); window.duelist = e;
        UI.openDuel(e);
      });
      await t.sleep(300);
      await p.keyboard.press('Enter');
      await p.evaluate(() => waitDeath());
      const r = await p.evaluate(() => ({ cause: G.deathCause, D: G.deathInfo, text: document.querySelector('.deathscreen').innerText.replace(/\s+/g, ' ') }));
      t.eq(r.cause, 'düello kurşunu', 'sebep');
      t.eq([r.D.src, r.D.who, r.D.weapon], ['duello', 'Ada Kline', 'schofield'], 'öldüren ve silahı');
      t.ok(/ÇEK!/.test(r.text), 'öğüt', r.text);
      await p.evaluate(() => revive());
    });

    await t.step('ayrıntı yoksa yalın ekran; İngilizce', async () => {
      const r = await p.evaluate(async () => {
        revive(); G.deathInfo = null; G.deathCause = 'Kurşun'; UI.showDeath();
        const plain = !document.querySelector('.deathscreen .ds-grid') && !!document.querySelector('#ds-cont');
        UI.closeAll(); document.body.classList.remove('dying');
        I18N.setLang('en'); revive();
        const P = G.player, h = npc('law', 'repeater', 'Sam Holt'); P.hp = 10; G.fireRay(h.x, h.y, 0, 120, 60, h, { npc: true }); h.remove = true;
        await waitDeath();
        const text = document.querySelector('.deathscreen').innerText.replace(/\s+/g, ' ');
        I18N.setLang('tr'); revive();
        return { plain, text };
      });
      t.ok(r.plain, 'eski çağrı: yalın ekran');
      t.ok(/Cause of death: lawmen's bullets/.test(r.text) && /Killed by: Sam Holt/.test(r.text) && /LAST MOMENTS/.test(r.text) && /IF THE DOCTOR SAVES YOU/.test(r.text) && /FATAL/i.test(r.text), 'İngilizce', r.text);
    });
  },
};
