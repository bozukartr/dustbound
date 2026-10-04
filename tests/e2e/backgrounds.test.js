'use strict';
/* Beş geçmişin genel kontrolü: her geçmiş kendi hikâyesine bağlı, hikâye metinleri tam,
   hikâyesiz başlangıç her geçmişte doğru yerde açılır, hikâye kimliği olmayan eski kayıt Sully'yle sürer */
module.exports = {
  name: 'Beş geçmiş',
  timeout: 420000,
  async run(t) {
    const BGS = ['farm', 'immigrant', 'outlaw', 'rail', 'trapper'];
    const WANT = { farm: 'sully', immigrant: 'immigrant', outlaw: 'outlaw', rail: 'rail', trapper: 'trapper' };
    const errInit = () => { window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; };
    /* karakter ekranında geçmişi seç, Hikâye satırının etiketini oku, hayata başla */
    const start = async (p, bg) => {
      await t.sleep(300); await p.keyboard.press('Enter'); await t.sleep(500);
      const lab = await p.evaluate((bg) => {
        document.querySelectorAll('.cr-tab')[3].click();
        [...document.querySelectorAll('.cr-card')].find(n => n.dataset.bg === bg).click();
        return [...document.querySelectorAll('.opt')].find(n => /Hikâyeli/.test(n.textContent)).textContent;
      }, bg);
      await p.evaluate(() => { for (let k = 0; k < 8 && document.querySelector('#cr-go'); k++) document.querySelector('#cr-go').click(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 150000 });
      await t.sleep(600); await t.helpers(p);
      return lab;
    };

    await t.step('her geçmişin kendi hikâyesi ve başarımı var; günlük metinleri iki dilde tam', async () => {
      const p = await t.page({});
      const r = await p.evaluate((BGS) => {
        const out = { map: {}, missing: [], en: [] };
        for (const bg of BGS) {
          const id = STORY_FOR_BG[bg], D = STORIES[id];
          out.map[bg] = id;
          if (!D) { out.missing.push(bg + ': tanım yok'); continue; }
          for (const k of ['title', 'intro', 'outro', 'welcome', 'epilogue']) if (typeof D[k] !== 'function' || String(D[k]()).length < (k === 'title' ? 4 : 20)) out.missing.push(id + '.' + k);
          if (!ACHIEVEMENTS.some(a => a.id === D.ach)) out.missing.push(id + ': başarım ' + D.ach);
          if (D.chapters.length !== 10) out.missing.push(id + ': ' + D.chapters.length + ' bölüm');
        }
        I18N.setLang('en');
        for (const bg of BGS) { const D = STORIES[STORY_FOR_BG[bg]]; for (const k of ['title', 'intro', 'welcome']) if (/[ğüşıöçİĞÜŞÖÇ]/.test(D[k]())) out.en.push(D.id + '.' + k); }
        I18N.setLang('tr');
        return out;
      }, BGS);
      t.eq(r.map, WANT, 'geçmiş → hikâye');
      t.eq(r.missing, [], 'eksik metin, başarım ya da bölüm yok');
      t.eq(r.en, [], 'İngilizcede çevrilmemiş günlük metni yok');
    });

    for (const bg of BGS) {
      await t.step(`${bg}: hikâyesiz başlangıç doğru yerde açılır, hikâye başlamaz`, async () => {
        const p = await t.page({ init: () => { window.__testNoStory = true; window.__errs = []; const ce = console.error; console.error = (...a) => { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 300)); ce(...a); }; } });
        const lab = await start(p, bg);
        t.ok(/Açık/.test(lab), 'karakter ekranında hikâye seçeneği açık', lab);
        await t.sleep(2500);
        const r = await p.evaluate((bg) => {
          const P = G.player, BG = BACKGROUNDS.find(b => b.id === bg), T = G.world.towns.find(x => x.id === BG.town), H = G.hideout;
          return { bg: G.background, story: G.story, dT: dist(P.x, P.y, T.cx, T.cy), hide: H ? dist(P.x, P.y, H.x, H.y) : -1, inTown: !!G.world.townAt(P.x, P.y, 4), quest: !document.getElementById('hud-quest').classList.contains('hidden'), npc: G.ents.filter(e => e.quest).length, errs: window.__errs };
        }, bg);
        t.eq(r.bg, bg, 'geçmiş');
        t.ok(!r.story && !r.quest && r.npc === 0, 'hikâye yok: izleyici ve hikâye kişileri yok', r);
        if (bg === 'outlaw') t.ok(r.hide >= 0 && r.hide < 120 && !r.inTown, 'Kanun Kaçağı saklı kampta', r);
        else t.ok(r.dT < 900, 'kendi kasabasında', r.dT);
        t.eq(r.errs, [], 'konsol hatası yok');
      });
    }

    await t.step('hikâye kimliği olmayan eski kayıt Sully\'nin hikâyesiyle sürer', async () => {
      const p = await t.newGame({ story: true, init: errInit });
      await p.waitForFunction(() => G.story && G.story.on, null, { timeout: 10000 });
      await p.evaluate(async () => { delete G.story.id; G.saveGame(true); await G.loadGame(); });
      await p.waitForFunction(() => G.state === 'play', null, { timeout: 60000 });
      await t.helpers(p);
      const r = await p.evaluate(() => ({ def: G.storyDef().id, ch: G.story.ch, hud: document.getElementById('hud-quest').textContent, j: (() => { UI.openJournal(6); const h = document.querySelector('.journal').textContent; UI.closeAll(); return h; })(), errs: window.__errs }));
      t.eq(r.def, 'sully', 'tanım Sully'); t.eq(r.ch, 0, 'bölüm korunur');
      t.ok(/Sully/.test(r.hud) && /Sully'nin Senedi/.test(r.j), 'izleyici ve günlük', r.hud);
      t.eq(r.errs, [], 'konsol hatası yok');
    });
  },
};
