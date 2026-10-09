'use strict';
/* Sinematikler: seslendirme yalnızca sinematik satırlarında (İngilizce kayıtlar, Türkçe oyunda da; oyuncunun sesi cinsiyetine göre,
   satır sesin süresi kadar ekranda, oyun içi konuşma sessiz), sahnenin ortam sesleri ve tekil sesleri (geçilince
   hepsi susar), kamera dünyadaki kasabanın binalarının içine girmez, kamp ateşinin alevi canlıdır. */
const fs = require('fs'), path = require('path');
const VO = path.join(__dirname, '..', '..', 'audio', 'vo');

module.exports = {
  name: 'Sinematik: seslendirme, ses, kamera',
  timeout: 420000,
  async run(t) {
    await t.step('seslendirme senaryosu yalnızca sinematik satırları; İngilizce kayıtların hepsi var, kaynakları yazılı', async () => {
      const L = JSON.parse(fs.readFileSync(path.join(VO, 'lines.json'), 'utf8'));
      const en = L.filter(x => x.lang === 'en'), tr = L.filter(x => x.lang === 'tr');
      t.ok(en.length > 100 && en.length === tr.length, 'iki dilde aynı sayıda kayıt', [en.length, tr.length]);
      // oyun içi konuşma (çakallardan sonra Sully) senaryoda yok, sinematik satırı var
      t.ok(!tr.some(x => /^Fena değil\. Ben senin yaşında/.test(x.text)), 'oyun içi konuşma senaryoda yok');
      t.ok(tr.some(x => x.text === 'Rüzgâr tavuk kaçırmaz.'), 'bölüm sinematiği satırı senaryoda');
      // oyuncunun satırları iki kayıt (erkek / kadın), öbürleri tek
      const P = en.filter(x => x.w === 'P');
      t.ok(P.length > 10 && P.every(x => /\.[mf]$/.test(x.key)) && en.filter(x => x.w !== 'P').every(x => !/\./.test(x.key)), 'oyuncu satırları .m ve .f');
      t.ok(!L.some(x => /\{ad\}/.test(x.read)), 'okunuşta oyuncunun adı yok');
      const missing = en.filter(x => !['ogg', 'mp3'].every(e => { const f = path.join(VO, 'en', `${x.key}.${e}`); return fs.existsSync(f) && fs.statSync(f).size > 2000; })).map(x => x.key);
      t.eq(missing, [], 'her İngilizce satırın .ogg ve .mp3 kaydı var');
      const man = JSON.parse(fs.readFileSync(path.join(VO, 'manifest.json'), 'utf8'));
      t.ok(en.every(x => man.en.includes(x.key)), 'manifestte bütün İngilizce kayıtlar');
      t.ok(!(man.tr && man.tr.length), 'Türkçe kayıt yok (senaryo kayda hazır)');
      // her karakter sesinin örnek kaydı var; kaynağı (LibriTTS-R okuru ve cümleleri) ve lisanslar KAYNAKLAR.md içinde
      const tool = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'tools', f), 'utf8'), credits = fs.readFileSync(path.join(VO, 'KAYNAKLAR.md'), 'utf8');
      const voices = [...tool('vo-ref.py').matchAll(/^\s+'(\w+)': \('(\d+)', \[([^\]]+)\]/gm)].map(m => ({ name: m[1], spk: m[2], utts: [...m[3].matchAll(/'(\w+)'/g)].map(u => u[1]) }));
      const used = [...tool('vo-tts.py').matchAll(/\('\w+', '\w+'\): '(\w+)'|'[mf]': '(\w+)'/g)].map(m => m[1] || m[2]);
      t.ok(voices.length >= 12 && used.length >= 12 && used.every(v => voices.some(x => x.name === v)), 'her konuşanın sesi var', { voices: voices.map(v => v.name), used });
      const ref = (v) => path.join(__dirname, '..', '..', 'tools', 'vo-ref', v.name + '.ogg');
      t.ok(voices.every(v => fs.existsSync(ref(v)) && fs.statSync(ref(v)).size > 20000), 'örnek kayıtlar depoda');
      t.ok(voices.every(v => credits.includes('`' + v.name + '`') && credits.includes(v.spk) && v.utts.every(u => credits.includes(u))), 'her sesin kaynağı KAYNAKLAR.md içinde');
      t.ok(/CC BY 4\.0/.test(credits) && /LibriTTS-R/.test(credits) && /Chatterbox/.test(credits) && /MIT/.test(credits), 'lisanslar ve CC BY atfı yazılı');
    });

    // ses dosyaları da yüklensin (düdük); hikâye açık (oyun içi konuşma)
    const p = await t.newGame({ story: true, sfx: true });
    await p.evaluate(() => { Audio_.unlock(); UI.el.help.classList.add('hidden'); const w = document.querySelector('.modal.welcome'); if (w) UI.closeAll(); });
    await p.waitForFunction(() => G.story && G.story.on, null, { timeout: 30000 });

    await t.step('sinematik satırı sesi yüklenince başlar ve sesin süresi kadar sürer; oyuncunun sesi cinsiyetine göre; Türkçe oyunda da İngilizce kayıt çalar', async () => {
      const r = await p.evaluate(async () => {
        const D = STORIES[STORY_FOR_BG.farm], sex0 = G.player.sex, res = {};
        for (const lang of ['en', 'tr']) {
          I18N.setLang(lang);
          for (const sex of ['m', 'f']) {
            G.player.sex = sex;
            const lines = await G.openingLines(D), vs = (l) => (l.self ? sex : null);
            res[lang + '.' + sex] = lines.map(l => ({ d: +l.d.toFixed(2), vd: +Audio_.voDur(l.raw, lang, vs(l)).toFixed(2), self: l.self, id: Audio_.voId(l.raw, lang, vs(l)) }));
          }
        }
        G.player.sex = sex0; I18N.setLang('tr');
        return res;
      });
      for (const lang of ['en', 'tr']) for (const sex of ['m', 'f']) {
        const R = r[lang + '.' + sex];
        t.ok(R.length === 4 && R.every(l => l.vd > 0.4 && l.d >= l.vd + 0.3), `satırların sesi yüklü, satır sesin süresi kadar (${lang}, ${sex})`, R);
        t.ok(R.filter(l => l.self).every(l => l.id.endsWith('.' + sex)) && R.some(l => l.self), `oyuncunun satırı ${sex} kaydı (${lang})`, R);
      }
      t.ok(Object.values(r).every(R => R.every(l => l.id && l.id.startsWith('en/'))), 'iki dilde de İngilizce kayıtlar', r);
      t.eq(r['tr.m'].map(l => l.id), r['en.m'].map(l => l.id), 'Türkçe oyunda aynı kayıtlar');
    });

    await t.step('oyun içi konuşma seslendirilmez', async () => {
      const n = await p.evaluate(async () => {
        I18N.setLang('en');
        let calls = 0; const v0 = Audio_.voice;
        Audio_.voice = function (...a) { calls++; return v0.apply(this, a); };
        // sinematik satırı bile oyun içinde konuşulunca sessiz
        G.qSay([['S', Tr('Rüzgâr tavuk kaçırmaz.')]]);
        for (let k = 0; k < 40; k++) await new Promise(r => requestAnimationFrame(r));
        Audio_.voice = v0; I18N.setLang('tr');
        return calls;
      });
      t.eq(n, 0, 'Audio_.voice çağrılmadı');
    });

    await t.step('sinematik sesleri: ortam sahneye geçer, düdük çalar; geçilince hepsi susar, ortam oyuna döner', async () => {
      await p.waitForFunction(() => Audio_.has('train_whistle') && Audio_.has('amb_wind'), null, { timeout: 90000 });
      const r = await p.evaluate(async () => {
        window.__testNoCine = false;
        const whistles = []; const p0 = Audio_.play;
        Audio_.play = function (name, o) { const V = p0.call(this, name, o); if (name === 'train_whistle') whistles.push(!!V); return V; };
        const pr = Cinema.play('rail', { look: G.player.look, seed: 3 });
        const t0 = performance.now();
        while (performance.now() - t0 < 2600 && !whistles.length) await new Promise(r => setTimeout(r, 100));
        const during = { amb: Audio_.cineL ? Object.assign({}, Audio_.cineL) : null, whistles: whistles.slice(), hasBank: Audio_.has('train_whistle') };
        // geçmek için basılı tut
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        await pr;
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape' }));
        Audio_.play = p0;
        return { during, after: { amb: Audio_.cineL, cineV: (Audio_.cineV || []).filter(v => !v.done).length, vo: !!Audio_.voCur } };
      });
      t.ok(r.during.amb && r.during.amb.wind > 0, 'sinematik sürerken ortamı sahne belirliyor', r.during);
      t.ok(r.during.hasBank && r.during.whistles.length > 0 && r.during.whistles.every(Boolean), 'buharla birlikte düdük çaldı', r.during);
      t.eq(r.after.amb, null, 'bitince ortam oyuna döndü');
      t.eq(r.after.cineV, 0, 'tekil sesler sustu');
      t.eq(r.after.vo, false, 'seslendirme sustu');
    });

    await t.step('kamera dünyadaki kasabanın binalarına girmez (gece saloonu her kasabada, demiryolu peronu)', async () => {
      const R = await p.evaluate(async () => {
        const out = [];
        const one = async (sc, town) => {
          const pr = Cinema.play(sc, { look: G.player.look, seed: 5, freeze: 1, probe: true, town, env: 'plains', sully: STORIES.sully.mentor.look, cap: { k: '', n: '', s: '' } });
          for (let k = 0; k < 2; k++) await new Promise(r => requestAnimationFrame(r));
          const c = Object.assign({}, Cinema.stat().cam);
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          await pr; await new Promise(r => setTimeout(r, 720));
          out.push(Object.assign({ sc, town }, c));
        };
        for (const T of G.world.towns) if (G.world.buildings.some(b => b.town === T.id && (b.type === 'saloon' || b.type === 'cantina'))) await one('q_saloon', T.id);
        await one('rail', null);
        return out;
      });
      t.ok(R.length >= 6, 'birden çok kasaba denendi', R.length);
      t.ok(R.every(r => r.solids > 5), 'kasabalar katı kutularıyla kuruldu', R.map(r => [r.town, r.solids]));
      t.ok(R.every(r => r.post === 0), 'düzeltmeden sonra kamera hiçbir an bir binanın içinde ya da duvarın dibinde değil', R.filter(r => r.post));
      const pre = R.reduce((a, r) => a + r.pre, 0), n = R.reduce((a, r) => a + r.n, 0);
      t.ok(pre / n < 0.08, 'sahneler kamerayı çoğu an zaten açık yere koyuyor (düzeltme seyrek)', { pre, n });
    });

    await t.step('kamp ateşlerinin alevi canlı (oynatıcı her kare çizer), sahneler hatasız', async () => {
      const r = await p.evaluate(async () => {
        const out = {};
        for (const sc of ['q_fire', 'q_dawn', 'outlaw', 'rail']) {
          const pr = Cinema.play(sc, { look: G.player.look, seed: 5, freeze: 2, probe: true, cap: { k: '', n: '', s: '' } });
          for (let k = 0; k < 2; k++) await new Promise(r => requestAnimationFrame(r));
          const st = Cinema.stat(); out[sc] = { flames: st.flames, glErr: st.glErr, std: Math.round(st.std) };
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          await pr; await new Promise(r => setTimeout(r, 720));
        }
        return out;
      });
      t.ok(Object.values(r).every(x => x.flames >= 1 && x.glErr === 0 && x.std > 8), 'her kamp ateşinde canlı alev, GL hatası yok', r);
    });
  },
};
