'use strict';
/* Sully, Bölüm 4: çakallar dalga dalga farklı yönlerden gelir (Sully fenerle o yöne geçip seslenir; hedef satırında dalga
   ve tavuk sayacı; kurtarılan tavuk başına ödül), sürünün izi (toynak izi, dışkı), rüzgâr (rüzgârın üstündeysen hayvan
   kokunu uzaktan alır; satırda rüzgârın nereden estiği), temiz vuruş (tek atışta düşen hayvanın postu kusursuz) */
module.exports = {
  name: 'Çakal gecesi ve iz sürerek av',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame({ story: true });
    await p.evaluate(() => { window.__storyFast = true; G.godMode = true; G.eventT = 1e9; G.hunterTick = () => {}; });
    await p.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st >= 0, null, { timeout: 15000 });
    const waitStep = (ch, st, ms = 15000) => p.waitForFunction(([ch, st]) => G.story && G.story.ch === ch && G.story.st === st && !G.story.wait, [ch, st], { timeout: ms });
    const hud = () => p.evaluate(() => document.getElementById('hud-quest').textContent);

    await t.step('çakal gecesi: altı tavuk; ilk dalga bir yönden gelir, Sully fenerle o yöne geçip seslenir', async () => {
      await p.evaluate(() => {
        const S = G.story; S.talkQ = null; S.talkCb = null; UI.closeAll();
        delete S.coyWave; delete S.coyGone; delete S.hensLost; delete S.coyDirs; delete S.herd; delete S.gtrail;
        const R = S.ranch; TH.goto(R.cx, R.cy + 30); G.clock = Math.floor(G.clock / 1440) * 1440 + 19.5 * 60;
        G.qChapter(3);
      });
      await waitStep(3, 0, 20000);
      const h0 = await p.evaluate(() => G.ents.filter(e => e.storyHen && !e.dead).length);
      t.eq(h0, 6, 'altı tavuk');
      await p.waitForFunction(() => G.ents.some(e => e.storyCoy && !e.dead), null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const S = G.story, R = S.ranch, C = { x: R.cx, y: R.cy + 70 }, cs = G.ents.filter(e => e.storyCoy && !e.dead), m = G.sullyEnt();
        const v = G.storyCoyDir(S.coyDirs[0]).v, ang = Math.atan2(v[1], v[0]);
        const ca = cs.map(c => Math.abs(angDiff(Math.atan2(c.y - C.y, c.x - C.x), ang)));
        return { n: cs.length, wave: S.coyWave, dirOk: ca.every(x => x < 0.9), sully: S.sully && Math.round(dist(S.sully.x, S.sully.y, C.x + v[0] * 80, C.y + v[1] * 80)), lantern: S.flags.lantern, mLantern: m && m.lantern };
      });
      t.ok(r.n === 2 && r.wave === 1 && r.dirOk, 'ilk dalga: iki çakal, Sully\'nin seslendiği yönden', r);
      t.ok(r.sully < 40 && r.lantern, 'Sully o yöne geçti, feneri yanıyor', r);
      t.ok(/dalga 1\/3/.test(await hud()) && /tavuk 6\/6/.test(await hud()), 'hedef satırında dalga ve tavuk sayacı', await hud());
    });

    await t.step('çakal tavuğu kaparsa sayaç düşer; sonraki dalga başka yönden', async () => {
      const r = await p.evaluate(() => {
        const S = G.story, c = G.ents.find(e => e.storyCoy && !e.dead), h = G.ents.find(e => e.storyHen && !e.dead);
        c.x = h.x + 3; c.y = h.y; c.prey = h;
        return true;
      });
      t.ok(r, 'çakal tavuğun dibinde');
      await p.waitForFunction(() => G.story.hensLost >= 1, null, { timeout: 4000 });
      // ilk dalgayı hemen dağıt (çakal yandaki tavuğa da saldırabilir), ikinci dalga beklemeden gelsin; sayaç kaybı gösterir
      const d = await p.evaluate(() => { const S = G.story; for (const e of G.ents) if (e.storyCoy && !e.dead) e.hurt(999, 'player'); window.__lost = S.hensLost; S.coyT = 0; return S.coyDirs[0]; });
      const lost = await p.evaluate(() => window.__lost);
      t.ok(lost >= 1 && lost <= 2, 'kapılan tavuk sayıldı', lost);
      await p.waitForFunction((n) => new RegExp('tavuk ' + (6 - n) + '/6').test(document.getElementById('hud-quest').textContent), lost, { timeout: 3000 });
      await p.waitForFunction(() => G.story.coyWave === 2, null, { timeout: 5000 });
      const q = await p.evaluate(() => G.story.coyDirs[1]);
      t.ok(q !== d, 'ikinci dalga başka yönden', { d, q });
    });

    await t.step('bütün dalgalar dağılınca adım biter (ölmeden dünyadan kalkan çakal da kilitlemez); kurtarılan tavuk başına ödül, fener söner', async () => {
      const m0 = await p.evaluate(() => G.player.money), lost = await p.evaluate(() => window.__lost);
      for (let k = 0; k < 40; k++) {
        // bir dalga vurulur, öteki sayılmadan kalkar (ör. öldüğü an omza alınan leş)
        const done = await p.evaluate((k) => { for (const e of G.ents) if (e.storyCoy && !e.dead) { if (k % 2) e.remove = true; else e.hurt(999, 'player'); } G.story.coyT = 0; return G.story.st >= 1; }, k);
        if (done) break;
        await t.sleep(300);
      }
      await waitStep(3, 1);
      const r = await p.evaluate(() => ({ saved: G.story.hensSaved, lantern: G.story.flags.lantern, m: G.player.money }));
      t.eq(r.saved, 6 - lost, 'kapılanlar dışındaki tavuklar kurtarıldı');
      t.ok(Math.abs(r.m - m0 - r.saved * 0.05) < 0.011 && !r.lantern, 'tavuk başına ödül, fener söndü', { paid: r.m - m0, lantern: r.lantern });
    });

    await t.step('iz: sürü çiftlikten uzakta; toynak izleri ve dışkı sürüye götürür', async () => {
      await p.waitForFunction(() => G.ents.some(e => e.gtKey), null, { timeout: 8000 });
      const r = await p.evaluate(() => {
        const S = G.story, R = S.ranch, H = S.herd, T = S.gtrail, m = G.questMark();
        const props = G.ents.filter(e => e.gtKey && !e.remove).map(e => e.type);
        // işaret sıradaki izde (ilk iz oyuncunun dibine düştüyse o çoktan sayılmıştır)
        const q = T[Math.min(S.gti || 0, T.length - 1)];
        return { far: Math.round(dist(H.x, H.y, R.cx, R.cy)), n: T.length, toward: dist(T[T.length - 1].x, T[T.length - 1].y, H.x, H.y) < dist(T[0].x, T[0].y, H.x, H.y), gti: S.gti || 0, mark: m && Math.round(dist(m.x, m.y, q.x, q.y)), props };
      });
      t.ok(r.far > 380 && r.n === 6 && r.toward, 'sürü uzakta, iz ona doğru', r);
      t.ok(r.mark === 0 && r.gti <= 1 && r.props.includes('paw'), 'işaret sıradaki izde; toynak izi görünür', r);
      for (let k = 0; k < 20; k++) {
        const done = await p.evaluate(() => { const S = G.story, q = S.gtrail[S.gti || 0]; if (!q || S.st !== 1) return true; TH.goto(q.x, q.y); return false; });
        if (done) break;
        await t.sleep(350);
      }
      await waitStep(3, 2);
      const q = await p.evaluate(() => ({ dung: true, game: G.ents.filter(e => e.storyGame && !e.dead).length, near: Math.round(dist(G.player.x, G.player.y, G.story.herd.x, G.story.herd.y)) }));
      t.ok(q.game >= 1 && q.near < 260, 'izin sonunda sürü', q);
    });

    await t.step('rüzgâr: rüzgârın üstündeysen hayvan kokunu uzaktan alır; satırda rüzgârın yönü', async () => {
      const r = await p.evaluate(() => {
        const a = G.ents.find(e => e.storyGame && !e.dead), w = FX.wind, P = G.player;
        P.crouch = false;
        // rüzgâr oyuncudan hayvana esiyor: oyuncu hayvanın rüzgâr üstünde
        TH.goto(a.x - Math.cos(w.a) * 160, a.y - Math.sin(w.a) * 160);
        const up = G.scentK(a);
        TH.goto(a.x + Math.cos(w.a) * 160, a.y + Math.sin(w.a) * 160);
        const down = G.scentK(a);
        return { up, down, how: G.questHow(G.qStep(), G.story), from: G.windFrom() };
      });
      t.ok(r.up > 1.5 && r.down === 1, 'rüzgâr üstünde koku taşınır, altında taşınmaz', r);
      t.ok(r.how.includes('Rüzgâr ' + r.from), 'nasıl satırı rüzgârın nereden estiğini yazar', r.how);
      // hayvanın rüzgâr altından, normal algının dışında (160 px, ayakta durarak) yaklaşınca ürkmez; rüzgâr üstünde ürker
      const q = await p.evaluate(async () => {
        const a = G.ents.find(e => e.storyGame && !e.dead), w = FX.wind;
        for (const e of G.ents) if (e.storyGame) { e.state = 'idle'; e.t = 9; e.spd = 0; }
        TH.goto(a.x + Math.cos(w.a) * 160, a.y + Math.sin(w.a) * 160);
        await new Promise(r => setTimeout(r, 500));
        const calm = a.state !== 'flee';
        for (const e of G.ents) if (e.storyGame) { e.state = 'idle'; e.t = 9; e.spd = 0; }
        TH.goto(a.x - Math.cos(FX.wind.a) * 160, a.y - Math.sin(FX.wind.a) * 160);
        await new Promise(r => setTimeout(r, 500));
        return { calm, fled: a.state === 'flee' };
      });
      t.ok(q.calm && q.fled, 'rüzgâr altında sakin, rüzgâr üstünde kaçtı', q);
    });

    await t.step('temiz vuruş: tek atışta düşen hayvanın postu kusursuz; iki isabette değil', async () => {
      // sürüden biri tek atışta: av adımı biter, deri yüzme adımı temiz vuruşu hatırlar
      await p.evaluate(() => { const a = G.ents.find(e => e.storyGame && !e.dead); TH.goto(a.x + 14, a.y); a.hurt(999, 'player', 'gun'); window.__A = a; });
      await waitStep(3, 3);
      const r = await p.evaluate(() => {
        const S = G.story, a = window.__A; G.player.carry = null;
        G.skin(a); const pa = G.player.carry || G.ents.find(e => e.kind === 'pelt' && dist(e.x, e.y, a.x, a.y) < 14); G.player.carry = null;
        // ikinci hayvan: iki isabet
        const s = TH.openSpot(G.player.x + 60, G.player.y, 20), b = new Animal(s[0], s[1], S.game); G.addEnt(b);
        b.hurt(5, 'player', 'gun'); b.hurt(999, 'player', 'gun');
        G.skin(b); const pb = G.player.carry || G.ents.find(e => e.kind === 'pelt' && dist(e.x, e.y, b.x, b.y) < 14 && e !== pa); G.player.carry = null;
        return { ca: a.clean, cb: b.clean, qa: pa && pa.q, qb: pb && pb.q, na: pa && pa.name, cs: S.cleanShot };
      });
      t.ok(r.ca && !r.cb, 'tek atış temiz, iki isabet değil', r);
      t.ok(r.qa > 1 && /Kusursuz/.test(r.na) && r.qb === 1, 'temiz vuruşun postu kusursuz', r);
      t.ok(r.cs === true, 'deri yüzme adımı temiz vuruşu hatırlar', r);
      await waitStep(3, 4);
      const say = await p.evaluate(() => STORIES.sully.chapters[3].steps[4].say.call(G, G.story).map(x => x[1])[0]);
      t.ok(/Tek atışta/.test(say), 'Sully temiz vuruşu över', say);
    });
  },
};
