'use strict';
/* Baskın (Sully, Bölüm 10): şafaktan önce uyanan kamp (Sully'nin uyandırdığı saat; Jack kampın bir üyesi, ayakta, nöbet
   tutmaz; uyuklayan nöbetçi), gizli etkisizleştirme (sırtı dönüğü bayılt, uyuyanı sessizce bağla; bağlı arkadaşını
   gören alarm verir), Jack'in atlı kaçışı (teslim olmaz, silinmez, kementle düşer, yeniden atına biner, izini
   kaybettirince saklandığı yerde bekler), Sully'nin destek ateşi (Jack'e asla), kaçan haydutların dönüş pususu */
module.exports = {
  name: 'Baskın: Kızıl Jack',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame({ story: true });
    // kampın haydutları (Jack hariç): sayfada bir kez tanımlanır
    await p.evaluate(() => { window.__storyFast = true; G.godMode = true; G.eventT = 1e9; G.hunterTick = () => {}; window.__M = () => G.ents.filter(e => e.kind === 'npc' && e.camp === G.story.camp.pid && !e.quest && !e.remove); });
    await p.waitForFunction(() => G.story && G.story.ch === 0 && G.story.st >= 0, null, { timeout: 15000 });
    const H = (h) => p.evaluate((h) => { G.clock = Math.floor(G.clock / 1440) * 1440 + h * 60; }, h);

    await t.step('Bölüm 9: "Sabaha Kadar" uykusu şafaktan önce biter, baskın 04:30 civarında başlar', async () => {
      const r = await p.evaluate(() => {
        const S = G.story; S.talkQ = null; S.talkCb = null; UI.closeAll();
        S.ch = 8; S.st = 3; S.wait = false; S.n = 0;   // "Sabaha kadar uyu"
        G.law.level = 0;
        const s = S.site; TH.goto(s.x, s.y); TH.clearNpcs();
        G.clock = (Math.floor(G.clock / 1440) + 1) * 1440 + 22 * 60;
        const wake = G.storyWakeHour();
        UI.openSleep('camp');
        const ok = TH.clickItem(/Sabaha Kadar/);
        return { wake, ok };
      });
      t.eq(r.wake, 4.5, 'uyku adımı erken kalkmayı ister');
      t.ok(r.ok, '"Sabaha Kadar" seçildi');
      await p.waitForFunction(() => G.story.ch === 9 && G.story.st === 0 && !G.story.wait, null, { timeout: 20000 });
      const q = await p.evaluate(() => ({ h: G.hour, d: dist(G.player.x, G.player.y, G.story.camp.x, G.story.camp.y), raid: G.story.raid, wake: G.storyWakeHour() }));
      t.ok(q.h >= 4 && q.h < 5.2, 'şafaktan önce uyandın', q);
      t.ok(q.d > 300 && q.d < 700 && q.raid === 1, 'kampa yakın bir sırtta, baskın başladı', q);
      t.eq(q.wake, 7, 'öbür adımlarda uyku 07:00\'de biter');
    });

    await t.step('şafakta kamp: ikisi uyur, biri nöbette; Jack kampın üyesi, ayakta, nöbet tutmaz; atı bağlı', async () => {
      await p.waitForFunction(() => G.jackEnt() && G.ents.some(e => e.jackHorse), null, { timeout: 10000 });
      await p.waitForFunction(() => __M().filter(e => e.asleep).length >= 2, null, { timeout: 20000 });
      const r = await p.evaluate(() => {
        const S = G.story, j = G.jackEnt(), M = __M(), h = G.ents.find(e => e.jackHorse);
        return { h: G.hour, n: M.length, asleep: M.filter(e => e.asleep).length, sentry: M.filter(e => e.isSentry).length, jCamp: j.camp === S.camp.pid, sched: !!j.campSched, jState: j.state, jAsleep: !!j.asleep, jSentry: !!j.isSentry, jd: Math.round(dist(j.x, j.y, S.camp.x, S.camp.y)), hitch: !!h.hitch, hd: Math.round(dist(h.x, h.y, S.camp.x, S.camp.y)) };
      });
      t.ok(r.n === 3 && r.asleep >= 2 && r.sentry === 1, 'üç haydut: ikisi uyuyor, biri nöbette', r);
      t.ok(r.jCamp && r.sched && !r.jAsleep && !r.jSentry, 'Jack kampın üyesi, uyanık, nöbetçi değil', r);
      t.ok(r.hitch && r.hd < 140, 'Jack\'in atı kampın kenarında bağlı', r);
      // Jack ateşin başına gider, ayakta bekler
      await p.waitForFunction(() => { const j = G.jackEnt(); return j && j.campSpot && dist(j.x, j.y, j.campSpot.x, j.campSpot.y) < 8 && j.state === 'idle'; }, null, { timeout: 20000 });
      // hikâyeyi Jack'i etkisiz hâle getirme adımına al (dürbün ve yaklaşma başka testlerde)
      const st = await p.evaluate(() => { const S = G.story; S.talkQ = null; S.talkCb = null; S.wait = false; S.st = 1; G.qNext(); return S.st; });
      t.eq(st, 2, 'Jack\'i etkisiz hâle getirme adımı');
    });

    await t.step('gizlice: sırtı dönük nöbetçiyi bayılt, uyuyanı sessizce bağla; kimse uyanmaz', async () => {
      await H(2);   // herkes uyur (Jack 01:00–04:00), yalnız nöbetçi ayakta
      await p.waitForFunction(() => { const M = __M(), j = G.jackEnt(); return M.filter(e => e.asleep).length >= 2 && M.some(e => e.isSentry && !e.asleep) && j.asleep; }, null, { timeout: 20000 });
      const r = await p.evaluate(() => {
        const M = __M(), P = G.player, sen = M.find(e => e.isSentry), sl = M.find(e => e.asleep);
        // nöbetçinin arkası: bakış yönünün tersinde 18 px. İstem en yakındakini gösterir: nöbetçi o an uyuyanların
        // yanından geçiyorsa onu kampın dışına, nöbet halkasına al
        const look = sen.lookAt != null ? sen.lookAt : sen.ang, C = sen.home, all = M.concat([G.jackEnt()]);
        const crowd = () => all.some(o => o !== sen && o.asleep && dist(o.x, o.y, sen.x - Math.cos(look) * 18, sen.y - Math.sin(look) * 18) < 34);
        for (let r = 95; r <= 160 && crowd(); r += 13) { const a = Math.atan2(sen.y - C.y, sen.x - C.x); if (!G.world.blocked(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r, 6)) { sen.x = C.x + Math.cos(a) * r; sen.y = C.y + Math.sin(a) * r; } }
        TH.goto(sen.x - Math.cos(look) * 18, sen.y - Math.sin(look) * 18); P.ang = look;
        P.crouch = false;
        const stand = !!G.takedownActs(sen);
        P.crouch = true;
        const back = (G.takedownActs(sen) || []).map(a => a.n);
        const it = G.findInteraction(), prompt = it ? it.actions.map(a => a.n) : [];
        G.takedownKO(sen);
        // uyuyanın yanına
        TH.goto(sl.x + 15, sl.y + 4); P.crouch = true;
        const sleep = (G.takedownActs(sl) || []).map(a => a.n);
        G.takedownTie(sl);
        window.__tk = { sen, sl };
        return { stand, back, prompt, sleep, senSt: sen.state, slSt: sl.state };
      });
      t.ok(!r.stand, 'ayaktayken gizli eylem yok');
      t.eq(r.back, ['Bayılt'], 'sırtı dönük uyanığa yalnız Bayılt');
      t.eq(r.prompt[0], 'Bayılt', 'istemde ilk eylem');
      t.eq(r.sleep, ['Sessizce Bağla', 'Bayılt'], 'uyuyana Sessizce Bağla ve Bayılt');
      t.ok(r.senSt === 'downed' && r.slSt === 'tied', 'nöbetçi baygın, uyuyan bağlı', r);
      await t.sleep(1500);
      const q = await p.evaluate(() => { const M = __M().concat([G.jackEnt()]); return { alert: M.filter(e => e.aggro || e.awState === 'alert').length, asleep: M.filter(e => e.asleep).length }; });
      t.ok(q.alert === 0 && q.asleep >= 2, 'kimse uyanmadı (nöbetçi bayılınca uyuyan biri onun yerine kalkmaz)', q.alert === 0 && q.asleep >= 2 ? q : await p.evaluate(() => __M().concat([G.jackEnt()]).map(e => ({ st: e.state, sl: !!e.asleep, as: e.awState, sen: !!e.isSentry, seen: !!e.bodySeen }))));
      // önüne geçilen uyanık birine gizli eylem yok
      const f = await p.evaluate(() => {
        const e = new NPC(G.player.x + 200, G.player.y, 'bandit', { hostile: true }); G.addEnt(e);
        TH.goto(e.x + Math.cos(e.ang) * 18, e.y + Math.sin(e.ang) * 18); G.player.crouch = true;
        const a = G.takedownActs(e); e.remove = true; return !!a;
      });
      t.ok(!f, 'yüzü sana dönük uyanığa gizli eylem yok');
    });

    await t.step('uyanınca bağlı ya da baygın arkadaşını gören alarm verir (seni görmeden)', async () => {
      await p.evaluate(() => { const S = G.story, a = Math.atan2(S.site.y - S.camp.y, S.site.x - S.camp.x); TH.goto(S.camp.x + Math.cos(a) * 380, S.camp.y + Math.sin(a) * 380); G.player.crouch = true; });
      await H(8.5);
      await p.waitForFunction(() => __M().concat([G.jackEnt()]).some(e => e.awState === 'alert'), null, { timeout: 20000 });
      const r = await p.evaluate(() => ({ d: dist(G.player.x, G.player.y, G.story.camp.x, G.story.camp.y), seen: window.__tk.sl.bodySeen || window.__tk.sen.bodySeen }));
      t.ok(r.seen && r.d > 300, 'bağlı ya da baygın arkadaşı görüldü, oyuncu uzakta', r);
    });

    await t.step('arkadaşları dağılınca Jack teslim olmaz: atına koşar, atlayıp kaçar', async () => {
      const r0 = await p.evaluate(() => {
        const S = G.story, j = G.jackEnt(), P = G.player;
        for (const e of __M()) { e.hp = 0; e.dead = true; e.state = 'dead'; e.deadT = 0; }
        TH.goto(j.x + 150, j.y + 40); P.crouch = false;
        j.hp = j.maxHp;
        G.senseAlert(j, { x: P.x, y: P.y }, 'see');
        return { h0: G.ents.filter(e => e.jackHorse && !e.remove).length };
      });
      t.eq(r0.h0, 1, 'at bağlı bekliyor');
      // atına koşar, biner (olmazsa Jack'in durumu hata iletisinde)
      const rode = await p.waitForFunction(() => { const j = G.jackEnt(); return j && j.mounted && j.fleeing === 'ride'; }, null, { timeout: 15000 }).then(() => true, () => false);
      if (!rode) t.ok(false, 'Jack atına binip kaçmadı', await p.evaluate(() => { const j = G.jackEnt(), h = G.ents.find(e => e.jackHorse && !e.remove); return { st: j.state, aggro: j.aggro, flee: j.fleeing, horseT: j.horseT, hd: h && Math.round(dist(h.x, h.y, j.x, j.y)) }; }));
      const r = await p.evaluate(() => { const S = G.story, j = G.jackEnt(); window.__hd0 = dist(j.x, j.y, S.jHideTo.x, S.jHideTo.y); return { flee: S.jFlee, said: S.jFleeSaid, to: !!S.jHideTo, horse: G.ents.filter(e => e.jackHorse && !e.remove).length, surr: j.state === 'surrender', t: G.qStep().t.call(G, S) }; });
      t.ok(r.flee && r.said && r.to, 'kaçış başladı, Sully seslendi', r);
      t.eq(r.horse, 0, 'bağlı at artık Jack\'in altında');
      t.ok(!r.surr, 'teslim olmadı');
      t.ok(/Kaçan Jack/.test(r.t), 'hedef yazısı kovalamaca', r.t);
      await t.sleep(2500);
      const q = await p.evaluate(() => { const S = G.story, j = G.jackEnt(); return { ok: !!j && !j.remove, d: dist(j.x, j.y, S.jHideTo.x, S.jHideTo.y), d0: window.__hd0, mark: G.questMark() === j }; });
      t.ok(q.ok && q.d < q.d0 - 60, 'saklanacağı yere doğru sürüyor', q);
      t.ok(q.mark, 'görev işareti Jack\'in üstünde');
    });

    await t.step('kementle attan düşer; ip bırakılırsa kalkıp yeniden atına biner', async () => {
      const r = await p.evaluate(() => {
        const j = G.jackEnt(), P = G.player;
        TH.goto(j.x - 40, j.y);
        G.lassoHit(j);
        const free = G.ents.filter(e => e.kind === 'horse' && e.owner === 'npc' && !e.rider && !e.dead && dist(e.x, e.y, j.x, j.y) < 40).length;
        return { st: j.state, mounted: !!j.mounted, lasT: j.lasT, free };
      });
      t.ok(r.st === 'lassoed' && !r.mounted && r.free >= 1, 'attan düştü, at yanında kaldı', r);
      t.ok(r.lasT >= 9, 'Jack\'i bağlamak için daha uzun süre', r.lasT);
      await p.evaluate(() => { G.player.rope = null; TH.goto(G.player.x - 260, G.player.y); });
      await p.waitForFunction(() => { const j = G.jackEnt(); return j && j.mounted && j.fleeing === 'ride'; }, null, { timeout: 15000 });
    });

    await t.step('izini kaybettirince saklandığı yerde attan iner; silinmez, bir daha kaçmaz', async () => {
      await p.evaluate(() => { const j = G.jackEnt(), S = G.story, a = Math.atan2(j.y - S.camp.y, j.x - S.camp.x); TH.goto(j.x - Math.cos(a) * 1500, j.y - Math.sin(a) * 1500); });
      await p.waitForFunction(() => G.story.jHide, null, { timeout: 10000 });
      const r = await p.evaluate(() => { const S = G.story, j = G.jackEnt(); return { j: !!j, at: j && dist(j.x, j.y, S.jHide.x, S.jHide.y), corner: j && j.cornered, flee: j && j.fleeing, mounted: j && !!j.mounted, camp: j && j.camp, mark: G.questMark() === j, t: G.qStep().t.call(G, S) }; });
      t.ok(r.j && r.at < 40 && r.corner && !r.flee && !r.mounted && !r.camp, 'saklandığı yerde bekliyor', r);
      t.ok(r.mark && /saklandığı yerde/.test(r.t), 'işaret ve hedef yazısı', r);
      // köşeye sıkışan Jack: canı azalsa da kaçmaz, teslim olmaz
      const q = await p.evaluate(() => {
        const j = G.jackEnt(), P = G.player;
        TH.goto(j.x + 120, j.y); j.hp = 20; G.senseAlert(j, { x: P.x, y: P.y }, 'see');
        const out = []; for (let k = 0; k < 6; k++) { G.moraleStep(j, 0.6, P); out.push(j.state); }
        return { flee: j.fleeing, surr: out.includes('surrender') };
      });
      t.ok(!q.flee && !q.surr, 'köşeye sıkışan Jack kaçmaz, teslim olmaz', q);
      // kayıttan dönüş: saklandığı yerde belirir
      const s = await p.evaluate(() => { const S = G.story; G.jackEnt().remove = true; G.ents = G.ents.filter(e => !e.remove); G.storyRival(); const j = G.jackEnt(); return { j: !!j, d: j && dist(j.x, j.y, S.jHide.x, S.jHide.y), corner: j && j.cornered }; });
      t.ok(s.j && s.d < 2 && s.corner, 'yeniden belirdiğinde saklandığı yerde', s);
    });

    await t.step('Sully silah sesine gelir, siperden kamptakilere ateş eder; Jack\'e asla', async () => {
      const r0 = await p.evaluate(() => {
        const S = G.story, P = G.player, C = S.camp;
        S.raid = 1; S.supOn = 0; S.supPt = null; S.sully = { x: S.site.x + 20, y: S.site.y };
        TH.goto(C.x + 40, C.y + 120);
        const e = new NPC(C.x - 20, C.y - 10, 'bandit', { hostile: true, home: { x: C.x, y: C.y, r: 60 }, hp: 900 }); e.camp = C.pid; G.addEnt(e);
        G.senseAlert(e, { x: P.x, y: P.y }, 'see');
        window.__sup = e; window.__shots = [];
        const f0 = G.fireRay;
        G.fireRay = function (ox, oy, ang, range, dmg, owner, o) { if (owner && owner.quest === 'mentor') window.__shots.push(this.ents.indexOf(owner.supFoe) >= 0 && owner.supFoe.quest !== 'rival'); return f0.apply(this, arguments); };
        return true;
      });
      t.ok(r0, 'kampta çatışma');
      await p.waitForFunction(() => G.story.supOn && G.sullyEnt() && G.sullyEnt().weapon === 'repeater', null, { timeout: 10000 });
      await p.waitForFunction(() => window.__shots.length >= 1, null, { timeout: 25000 });
      const r = await p.evaluate(() => { const e = G.sullyEnt(), S = G.story; return { shots: window.__shots, at: dist(e.x, e.y, S.supPt.x, S.supPt.y), mounted: !!e.mounted, foe: e.supFoe === window.__sup }; });
      t.ok(r.shots.every(Boolean), 'yalnız kamptakilere, Jack\'e değil', r);
      t.ok(r.at < 24 && !r.mounted && r.foe, 'destek yerinde, attan inmiş', r);
      // arada sen varsan ateş etmez
      const c = await p.evaluate(() => { const e = G.sullyEnt(), tg = window.__sup, P = G.player; e.ang = Math.atan2(tg.y - e.y, tg.x - e.x); TH.goto((e.x + tg.x) / 2, (e.y + tg.y) / 2); return G.mentorClear(e, tg, dist(e.x, e.y, tg.x, tg.y)); });
      t.ok(!c, 'atış yolunda sen varken ateş etmez');
      await p.evaluate(() => { window.__sup.remove = true; G.storyRaidEnd(G.story); });
      const w = await p.evaluate(() => ({ w: G.sullyEnt().weapon, aim: !!G.sullyEnt().gAim }));
      t.ok(!w.w && !w.aim, 'baskın bitince silahını bırakır', w);
    });

    await t.step('kaçan haydut sayılır; Jack\'i canlı götürürken dönüş yolunda pusu (bir kez)', async () => {
      const f = await p.evaluate(() => {
        const S = G.story, e = new NPC(S.camp.x, S.camp.y, 'bandit', { hostile: true }); e.camp = S.camp.pid;
        S.fled = 0; G.qEvent('fled', e); G.qEvent('fled', e);
        return S.fled;
      });
      t.eq(f, 1, 'kaçan haydut bir kez sayıldı');
      const r = await p.evaluate(() => {
        const S = G.story, j = G.jackEnt(), P = G.player;
        TH.goto(j.x + 10, j.y); G.hogtie(j); S.jack = 'bound'; S.alive = true; S.deed = true; S.ambush = 0;
        S.talkQ = null; S.talkCb = null; S.wait = false; S.st = 3; G.qNext();
        G.pickUp(j);
        // kamptan ve kasabadan uzak, kasaba dışında bir yer (önce kasabaya giden yolun üstünde, olmazsa kampın çevresinde)
        const T = G.sTown(); let spot = null;
        const ok = (s) => s && dist(s[0], s[1], S.camp.x, S.camp.y) > 760 && dist(s[0], s[1], T.cx, T.cy) > 960 && !G.world.townAt(s[0], s[1], 60);
        for (let k = 0; k < 30 && !spot; k++) { const f = 0.3 + k * 0.015, s = TH.openSpot(S.camp.x + (T.cx - S.camp.x) * f + rnd(-200, 200), S.camp.y + (T.cy - S.camp.y) * f + rnd(-200, 200), 20); if (ok(s)) spot = s; }
        for (let k = 0; k < 48 && !spot; k++) { const a = k / 48 * TAU, r = 820 + (k % 3) * 200, s = TH.openSpot(S.camp.x + Math.cos(a) * r, S.camp.y + Math.sin(a) * r, 20); if (ok(s)) spot = s; }
        if (spot) TH.goto(spot[0], spot[1]);
        return { st: S.st, carry: !!P.carry && P.carry.quest === 'rival', spot: !!spot };
      });
      t.ok(r.st === 4 && r.carry && r.spot, 'Jack omuzda, teslim adımında, yolun ortasında', r);
      await p.waitForFunction(() => G.story.ambush === 1, null, { timeout: 5000 });
      const q = await p.evaluate(() => ({ n: G.ents.filter(e => e.ambush && !e.dead).length, mounted: G.ents.filter(e => e.ambush && e.mounted).length, aggro: G.ents.filter(e => e.ambush && e.aggro).length, toast: document.getElementById('toasts') ? document.getElementById('toasts').textContent : '' }));
      t.ok(q.n >= 2 && q.mounted === q.n && q.aggro === q.n, 'atlı haydutlar saldırıyor', q);
      await t.sleep(600);
      const n2 = await p.evaluate(() => G.ents.filter(e => e.ambush).length);
      t.eq(n2, q.n, 'pusu bir kez kurulur');
    });
  },
};
