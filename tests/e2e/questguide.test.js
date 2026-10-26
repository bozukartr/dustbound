'use strict';
/* Görev rehberi: her adımın tuşlu "nasıl" satırı (HUD ve günlük), menüde ve etkileşim isteminde görevi ilerleten
   seçeneğin parlaması, yeme adımında çanta ve hızlı kullanım, kamp ve pişirme menüsü, takılınca yinelenen ipucu */
module.exports = {
  name: 'Görev rehberi',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame({ story: true });
    await p.evaluate(() => { window.__storyFast = true; });
    await p.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st === 0 && !G.story.wait, null, { timeout: 20000 });
    // adımı doğrudan kur: konuşmalar beklenmez
    const go = (ch, st) => p.evaluate(async ([ch, st]) => {
      UI.closeAll();
      const S = G.story; S.talkQ = null; S.talkCb = null;
      S.ch = ch; S.st = st - 1; S.wait = false; G.qNext();
      S.talkQ = null; S.talkCb = null;
      await new Promise(r => setTimeout(r, 300));
      return { ch: S.ch, st: S.st, t: G.qStep() && G.qStep().t.call(G, S) };
    }, [ch, st]);

    await t.step('beş hikâyenin her adımının tuşlu bir "nasıl" satırı var', async () => {
      const r = await p.evaluate(() => {
        const out = { n: 0, empty: [], noKey: [] };
        const acts = ['talk', 'greet', 'buy', 'sell', 'eat', 'fill', 'whistle', 'kill', 'skin', 'work', 'deposit', 'board', 'drink', 'rumor', 'camp', 'cook', 'sleep', 'mask', 'reload', 'brush', 'horse', 'free', 'deliver', 'explore'];
        for (const id of Object.keys(STORIES)) {
          const S = { id, on: true, ch: 0, st: 0, n: 0, town: G.world.towns[0].id, flags: {}, camp: { x: 0, y: 0, n: 'K' }, north: { x: 0, y: 0 }, look: { n: 'T', x: 0, y: 0 }, cave: { n: 'M', x: 0, y: 0 } };
          const keep = G.story; G.story = S;
          STORIES[id].chapters.forEach((c, ci) => c.steps.forEach((st, si) => {
            out.n++;
            const h = G.questHow(st, S), k = id + ' ' + (ci + 1) + '.' + si;
            if (!h.replace(/<[^>]+>/g, '').trim()) out.empty.push(k);
            else if (acts.includes(st.ev) && !/class="btn/.test(h)) out.noKey.push(k + ' ' + h);
          }));
          G.story = keep;
        }
        return out;
      });
      t.ok(r.n >= 150, 'bütün adımlar tarandı', r.n);
      t.eq(r.empty, [], 'nasıl satırı boş adım yok');
      t.eq(r.noKey, [], 'eylem isteyen adımın satırında tuş var');
    });

    await t.step('HUD hedefin altında nasıl satırını gösterir; günlükte de yazar; kolda tuşlar kola göre', async () => {
      await go(0, 0);
      const r = await p.evaluate(() => {
        G.questHud();
        const h = document.querySelector('#hud-quest .hq-h');
        const kb = h && h.innerHTML;
        Input.device = 'pad'; G.questHud();
        const pad = document.querySelector('#hud-quest .hq-h').innerHTML;
        Input.device = 'kb'; G.questHud();
        return { txt: h && h.textContent, kb, pad, jr: G.questJournal() };
      });
      t.ok(/Konuş/.test(r.txt) && /btn kb/.test(r.kb), 'konuşma adımı: yanına git, E Konuş', r.txt);
      t.ok(/btn ps|btn xb|btn sd|class="btn [a-z]/.test(r.pad) && r.pad !== r.kb, 'kolda kolun tuşu görünür', r.pad);
      t.ok(/qj-how/.test(r.jr) && /Nasıl:/.test(r.jr), 'günlükte şu anki adımın nasıl satırı', r.jr.slice(0, 200));
    });

    await t.step('yeme adımı: çantada yiyecekler parlar, imleç yiyecekte, onay tuşu "Ye"', async () => {
      const s = await go(1, 1);
      t.eq(s.t, 'Bir şeyler ye', 'yeme adımı');
      const r = await p.evaluate(async () => {
        const P = G.player; P.addItem('beans', 2, true);
        const out = { hud: document.querySelector('#hud-quest .hq-h').textContent };
        UI.openSatchel();
        await new Promise(r => setTimeout(r, 80));
        const el = UI.top().el;
        out.goals = [...el.querySelectorAll('.p-item.q-goal .pi-l')].map(n => n.textContent);
        out.notGoal = [...el.querySelectorAll('.p-item:not(.q-goal) .pi-l')].map(n => n.textContent);
        out.focus = el.querySelector('.p-item.focus .pi-l').textContent;
        out.foot = el.querySelector('.p-foot').textContent;
        out.banner = (el.querySelector('.p-quest') || {}).textContent;
        UI.top().opts.onTab(3); await new Promise(r => setTimeout(r, 30));
        out.tabMark = [...UI.top().el.querySelectorAll('.tab.q-goal')].map(n => n.textContent);
        UI.closeAll();
        return out;
      });
      t.ok(/Çanta/.test(r.hud) && /Ye/.test(r.hud), 'HUD: çantayı aç, yiyeceği seç, Ye', r.hud);
      t.ok(r.goals.includes('Konserve Fasulye') && !r.goals.includes('Matara'), 'yiyecekler parlar, matara parlamaz', r);
      t.ok(r.goals.includes(r.focus), 'çanta parlayan yiyecekle açılır', r.focus);
      t.ok(/Ye/.test(r.foot) && !/Kullan/.test(r.foot), 'onay tuşunun adı Ye', r.foot);
      t.ok(/Görev/.test(r.banner) && /Bir şeyler ye/.test(r.banner), 'menünün başında görev bandı', r.banner);
      t.ok(r.tabMark.length === 1 && /Yiyecek/.test(r.tabMark[0]), 'başka sekmedeyken Yiyecek sekmesi işaretli', r.tabMark);
    });

    await t.step('yeme adımında hızlı kullanım susuz ve tokken bile yiyecek yer, adım biter', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, S = G.story;
        P.hunger = 92; P.thirst = 35; P.canteen = 4; P.hp = P.maxHp;
        const pick = G.quickPick(), can0 = P.canteen;
        G.quickUse();
        await new Promise(r => setTimeout(r, 200));
        return { pick, food: ITEMS[pick] && ITEMS[pick].c, canteen: P.canteen === can0, wait: S.wait, st: S.st };
      });
      t.eq(r.food, 'food', 'hızlı kullanım yiyecek seçti', r);
      t.ok(r.canteen, 'matara içilmedi');
      t.ok(r.wait || r.st > 1, 'yeme adımı tamamlandı', r);
      // görev yokken hızlı kullanım eski önceliğini korur (susuzken matara)
      const q = await p.evaluate(() => { const keep = G.story; G.story = null; const P = G.player; P.thirst = 35; P.hunger = 92; const k = G.quickPick(); G.story = keep; return k; });
      t.eq(q, 'canteen', 'görev yokken susuzken matara');
    });

    await t.step('pişirme adımı: kamp menüsünde Pişir ve Üret, tarif menüsünde yalnızca et tarifi parlar', async () => {
      await p.evaluate(() => { G.player.addItem('raw_game', 2, true); });
      const s = await go(8, 2);
      t.eq(s.t, 'Ateşte et pişir', 'pişirme adımı');
      const r = await p.evaluate(async () => {
        const out = {};
        UI.openCamp();
        let el = UI.top().el;
        out.camp = [...el.querySelectorAll('.p-item.q-goal .pi-l')].map(n => n.textContent);
        out.campFocus = el.querySelector('.p-item.focus .pi-l').textContent;
        UI.openCook();
        el = UI.top().el;
        out.cook = [...el.querySelectorAll('.p-item.q-goal .pi-l')].map(n => n.textContent);
        out.want = RECIPES.find(R => R.id === 'cook_game').n;
        UI.closeAll();
        // ok koşulu: et dışı tarif adımı bitirmez
        const S = G.story; G.qEvent('cook', 'coffee'); out.afterCoffee = { st: S.st, wait: S.wait };
        return out;
      });
      t.eq(r.camp, ['Pişir ve Üret'], 'kamp menüsünde yalnızca Pişir ve Üret parlar');
      t.eq(r.campFocus, 'Pişir ve Üret', 'kamp menüsü Pişir ve Üret üstünde açılır');
      t.ok(r.cook.includes(r.want) && r.cook.every(n => !/Kahve|Ok|Sargı/.test(n)), 'tarif menüsünde et tarifi parlar', r.cook);
      t.ok(!r.afterCoffee.wait, 'kahve pişirmek et pişirme adımını bitirmez', r.afterCoffee);
    });

    await t.step('uyku adımı: kamp menüsünde Uyu, uyku menüsünde Sabaha Kadar parlar', async () => {
      const s = await go(8, 3);
      t.eq(s.t, 'Sabaha kadar uyu', 'uyku adımı');
      const r = await p.evaluate(() => {
        UI.openCamp();
        const camp = [...UI.top().el.querySelectorAll('.p-item.q-goal .pi-l')].map(n => n.textContent);
        UI.openSleep('camp');
        const sleep = [...UI.top().el.querySelectorAll('.p-item.q-goal .pi-l')].map(n => n.textContent);
        UI.closeAll();
        return { camp, sleep };
      });
      t.eq(r.camp, ['Uyu'], 'kamp menüsünde Uyu parlar');
      t.ok(r.sleep.length === 1 && /Sabaha Kadar/.test(r.sleep[0]), 'Sabaha Kadar parlar', r.sleep);
    });

    await t.step('istem: kuyuda görev seçeneği (Matarayı Doldur) seçili gelir ve parlar', async () => {
      const s = await go(1, 2);
      t.eq(s.t, 'Mataranı bir kuyudan doldur', 'matara adımı');
      const r = await p.evaluate(async () => {
        const w = G.storyWell(), P = G.player;
        UI.closeAll(); TH.clearNpcs();
        let it = null;
        for (const [dx, dy] of [[0, 14], [14, 0], [-14, 0], [0, -14], [0, 20], [20, 0], [-20, 0]]) { TH.goto(w.x + dx, w.y + dy); it = G.findInteraction(); if (it && it.actions.some(a => a.n === 'Matarayı Doldur')) break; }
        UI.curInteract = it; UI._scanT = 9;
        G.t += 1; UI.interactUpdate(0.016);
        const html = UI.el.prompts.innerHTML, sel = it.actions[UI.optSel(it)].n, a0 = it.actions[0].n;
        // görev başka bir şey isterken aynı yerde vurgu yok
        const keep = G.story; G.story = null; UI._pk = null; it._qgT = undefined; UI.curInteract = it; UI.interactUpdate(0.016);
        const plain = UI.el.prompts.innerHTML; G.story = keep;
        return { found: !!it, html, plain, sel, a0 };
      });
      t.ok(r.found, 'kuyunun etkileşimi bulundu');
      t.ok(r.sel === 'Matarayı Doldur' && r.a0 !== r.sel, 'görev seçeneği ilk eylem olmasa da seçili gelir', r);
      t.ok(/q-goal/.test(r.html) && /Matarayı Doldur/.test(r.html), 'istemde görev seçeneği yazar ve parlar', r.html);
      t.ok(!/q-goal/.test(r.plain), 'görev yokken istem parlamaz');
    });

    await t.step('takılınca ipucu: 45 sn ilerleme olmazsa "Takıldın mı?" ve izleyici parlar; işarete yaklaşmak ilerlemedir', async () => {
      await go(0, 1);
      const r = await p.evaluate(() => {
        UI.closeAll(); UI.el.help.classList.add('hidden');
        G.questNudge(0.1);
        const N = G._qNudge; N.t = 44.95;
        G.questNudge(0.1);
        const help = UI.el.help.classList.contains('hidden') ? '' : UI.el.help.textContent;
        const n1 = N.n;
        // işaretli adımda işarete yaklaşmak sayacı sıfırlar
        G._qNudge = null;
        const m = { x: G.player.x + 600, y: G.player.y };
        const qm = G.questMark; G.questMark = () => m;
        G.questNudge(0.1); G._qNudge.t = 40; G.player.x += 100; G.questNudge(0.1);
        const reset = G._qNudge.t; G.questMark = qm; G.player.x -= 100;
        return { help, n1, reset, pulse: document.getElementById('hud-quest').classList.contains('hq-pulse') };
      });
      t.ok(/Takıldın mı\?/.test(r.help) && /Selamla/.test(r.help), 'ipucu yeniden gösterildi', r.help);
      t.eq(r.n1, 1, 'bir kez sayıldı');
      t.ok(r.reset < 1, 'işarete yaklaşınca sayaç sıfırlanır', r.reset);
      t.ok(r.pulse, 'izleyici parlar');
    });

    await t.step('İngilizcede de kalın yazılar İngilizce seçenek adlarıyla eşleşir', async () => {
      await p.evaluate(() => { I18N.setLang('en'); G.player.addItem('raw_game', 2, true); });
      try {
        await go(8, 2);
        const cook = await p.evaluate(() => {
          G.questHud();
          UI.openCamp(); const camp = [...UI.top().el.querySelectorAll('.p-item.q-goal .pi-l')].map(n => n.textContent); UI.closeAll();
          return { camp, hud: document.querySelector('#hud-quest .hq-h').textContent };
        });
        t.eq(cook.camp, ['Cook and Craft'], 'pişirme adımında Cook and Craft parlar');
        t.ok(/Camp Menu/.test(cook.hud) && /Cook and Craft/.test(cook.hud), 'HUD satırı İngilizce', cook.hud);
        await go(1, 1);
        const eat = await p.evaluate(async () => {
          G.player.addItem('beans', 1, true);
          UI.openSatchel(); await new Promise(r => setTimeout(r, 50));
          const el = UI.top().el, out = { goals: el.querySelectorAll('.p-item.q-goal').length, foot: el.querySelector('.p-foot').textContent };
          UI.closeAll();
          return out;
        });
        t.ok(eat.goals > 0 && /Eat/.test(eat.foot), 'çantada yiyecek parlar, onay tuşu Eat', eat);
      } finally { await p.evaluate(() => I18N.setLang('tr')); }
    });

    await t.step('görev yokken menüler parlamaz', async () => {
      const r = await p.evaluate(() => {
        const keep = G.story; G.story = null;
        UI.openCamp(); const n = UI.top().el.querySelectorAll('.q-goal, .p-quest').length; UI.closeAll();
        G.story = keep;
        return n;
      });
      t.eq(r, 0, 'vurgu yok');
    });
  },
};
