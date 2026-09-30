'use strict';
/* NPC aklı: duvara yürümeden yol bulma, arabaların çakışmaması, sohbetler, sataşma ve tepkiler */
module.exports = {
  name: 'NPC aklı ve kasaba trafiği',
  timeout: 300000,
  async run(t) {
    const p = await t.newGame();
    const bubbles = () => p.evaluate(() => [...document.querySelectorAll('#bubbles .bubble')].map(b => b.textContent));
    await t.step('kasabada sakinler ve şerifler duvara doğru yürüyüp takılmaz', async () => {
      const r = await p.evaluate(() => {
        UI.closeAll(); G.godMode = true;
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y);
        G.clock = Math.floor(G.clock / 1440) * 1440 + 1440 + 13 * 60;
        const w0 = NPC.prototype.walk;
        NPC.prototype.walk = function (dt, sp, dir) { const ox = this.x, oy = this.y; w0.call(this, dt, sp, dir); if (Math.hypot(this.x - ox, this.y - oy) < sp * this.slow() * dt * 0.3) this.press = (this.press || 0) + dt; };
        for (const e of G.ents) e.press = 0;
        let walkers = 0;
        for (let f = 0; f < 30 * 75; f++) { G.update(1 / 30); if (f === 900) walkers = G.ents.filter(e => e.kind === 'npc' && (e.nav || e.goal)).length; }
        NPC.prototype.walk = w0;
        const npcs = G.ents.filter(e => e.kind === 'npc' && !e.dead);
        const w = npcs.reduce((a, e) => ((e.press || 0) > (a.press || 0) ? e : a), npcs[0]);
        const info = w && { role: w.role, occ: w.res && w.res.occ, st: w.state, act: w.plan && w.plan.act, pos: [Math.round(w.x), Math.round(w.y)], goal: w.goal ? [Math.round(w.goal.x), Math.round(w.goal.y), w.goal.kind] : w.target ? [Math.round(w.target.x), Math.round(w.target.y)] : null, mounted: !!w.mounted, host: w.hostile, dodge: w.dodgeT, flee: w.fleePt };
        return { n: npcs.length, walkers, worst: Math.max(0, ...npcs.map(e => e.press || 0)), total: npcs.reduce((s, e) => s + (e.press || 0), 0), law: npcs.filter(e => e.role === 'law').length, info };
      });
      t.ok(r.n > 15 && r.walkers > 5, 'kasaba yaşıyor olmalı', r);
      t.ok(r.worst < 2, 'hiçbir NPC 2 sn\'den uzun duvara yüklenmemeli', r);
      t.ok(r.total < 6, 'toplam takılma çok az olmalı', r);
    });
    await t.step('yolda iki yönden gelen arabalar üst üste binmez, hepsi yoluna devam eder', async () => {
      const r = await p.evaluate(() => {
        const W = G.world, road = W.roads.filter(r => !r.spur && r.pts.length > 40)[0];
        const mid = road.pts[20]; TH.goto(mid[0] + 40, mid[1] + 40); TH.clearNpcs();
        for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const ws = [new Wagon(road, 10, 1, false), new Wagon(road, 14, 1, true), new Wagon(road, 30, -1, false), new Wagon(road, 26, -1, true), new Wagon(road, 6, 1, true)];
        for (const w of ws) G.addEnt(w);
        const start = ws.map(w => [w.x, w.y]);
        let ov = 0;
        for (let f = 0; f < 30 * 35; f++) {
          G.update(1 / 30);
          for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) if (!ws[i].remove && !ws[j].remove && ws[i].overlapWith(ws[j]) > 1) ov++;
        }
        return { ov, moved: ws.map((w, i) => Math.round(Math.hypot(w.x - start[i][0], w.y - start[i][1]))) };
      });
      t.eq(r.ov, 0, 'hiç çakışma olmamalı');
      t.ok(r.moved.every(m => m > 250), 'arabalar birbirini beklerken kilitlenmemeli', r.moved);
    });
    await t.step('kasabaya giren arabalar ayrı park yerlerine park eder', async () => {
      const r = await p.evaluate(() => {
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y);
        for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const g = tw.gates[0], out = [];
        for (let k = 0; k < 3; k++) { const w = new Wagon(null, 0, 1, k === 1, { x: g.x * TS + 8, y: g.y * TS + 8, ang: 0 }); w.path = [[w.x, w.y]]; G.addEnt(w); out.push({ ok: w.enterTown(), slot: w.slot }); }
        let minD = 1e9;
        for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (out[i].slot && out[j].slot) minD = Math.min(minD, Math.hypot(out[i].slot[0] - out[j].slot[0], out[i].slot[1] - out[j].slot[1]));
        return { ok: out.map(o => o.ok), minD };
      });
      t.ok(r.ok.every(Boolean), 'her araba park yeri bulmalı', r);
      t.ok(r.minD >= 30, 'park yerleri ayrı olmalı', r.minD);
    });
    await t.step('sakinler kendi aralarında satır satır sohbet eder (yakındaysan baloncuklar görünür)', async () => {
      await p.evaluate(() => {
        for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const tw = TH.town('harlow'), P = G.player;
        for (let f = 0; f < 90; f++) G.update(1 / 30);   // kasaba yeniden yerleşsin
        const [a, b] = G.ents.filter(e => e.res && !e.dead && !e.remove && !e.child && e.state !== 'sit' && e.plan && ['stroll', 'haul', 'sweep', 'news', 'sit', 'errand'].includes(e.plan.act)).concat(G.ents.filter(e => e.res && !e.dead && !e.remove && !e.child && e.state !== 'sit')).filter((e, i, A) => A.indexOf(e) === i).slice(0, 2);
        a.x = P.x + 30; a.y = P.y + 20; b.x = P.x + 44; b.y = P.y + 20; a.nav = b.nav = null;
        window.TA = G.startTalk(a, b, tw, ['Birinci satır.', 'İkinci satır.', 'Üçüncü satır.']);
        window.TP = [a, b];
      });
      const seen = new Set();
      for (let k = 0; k < 24; k++) { await t.sleep(400); for (const s of await bubbles()) seen.add(s); }
      const end = await p.evaluate(() => ({ done: !G.talks.includes(TA), talk: TP.map(e => !!e.talk), cd: TP.every(e => e.talkCd > G.clock) }));
      t.ok(seen.has('Birinci satır.') && seen.has('İkinci satır.') && seen.has('Üçüncü satır.'), 'üç satır sırayla görünmeli', [...seen]);
      t.ok(end.done && !end.talk.some(Boolean) && end.cd, 'sohbet biter, bir süre yeniden başlamaz', end);
    });
    await t.step('kirli oyuncuya sataşır; karşılık verilince güler ya da bozulur', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, tw = TH.town('harlow');
        const e = G.ents.find(x => x.res && !x.dead && !x.child && x.res.occ !== 'elder' && x.res.occ !== 'drifter' && x.state !== 'sit');
        e.x = P.x + 24; e.y = P.y; e.talk = null; e.teaseCd = 0; G.teaseT = 0; P.clean = 5; P.drunk = 0; P.hp = P.maxHp;
        G.law.bounty = 0; G.honor = 0; e.res.mood = 'jolly';
        const rr = Math.random; Math.random = () => 0.01;
        try { G.mindTick(e, tw); } finally { Math.random = rr; }
        window.TE = e;
        return { teased: !!e.teased, k: e.teased && e.teased.k, acts: G.npcActions(e).map(a => a.n) };
      });
      t.ok(r.teased, 'sataşmalı', r);
      t.ok(r.acts.includes('Karşılık Ver'), 'karşılık verme seçeneği', r.acts);
      await t.sleep(300);
      const b1 = await bubbles();
      t.ok(b1.some(s => /koku|Rüzgâr|ahır|Kovboy|Nişan|atına|haydut|Şapkan/.test(s)), 'sataşma baloncuğu', b1);
      await p.evaluate(() => { const a = G.npcActions(TE).find(x => x.n === 'Karşılık Ver'); a.fn(); });
      await t.sleep(2100);
      const b2 = await bubbles();
      t.ok(b2.length >= 2, 'oyuncunun cevabı ve sakinin tepkisi görünmeli', b2);
      t.ok(await p.evaluate(() => !G.npcActions(TE).some(a => a.n === 'Karşılık Ver')), 'bir kez karşılık verilir');
      await p.evaluate(() => { G.player.clean = 100; });
    });
    await t.step('silah doğrultulan sivil ellerini kaldırır; dörtnala gelen atlıdan yana sıçrar', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, e = TE;
        e.state = 'idle'; e.talk = null; e.x = P.x + 40; e.y = P.y; e.handsT = 0;
        P.giveWeapon('cattleman', true); P.weapon = 'cattleman'; P.aiming = true; P.aimAng = 0;
        G.perceive(e, 0.016);
        const hands = e.state;
        P.aiming = false; e.state = 'idle'; e.handsT = 0;
        const h = G.horse; h.x = P.x; h.y = P.y; h.dead = false; P.mount(h, true); h.ang = 0; h.spd = 150;
        e.x = P.x + 30; e.y = P.y + 2;
        G.perceive(e, 0.016);
        const dodge = e.dodgeT > 0, a0 = [e.x, e.y];
        for (let k = 0; k < 10; k++) G.perceive(e, 0.05);
        P.dismount(); P.mountAnim = null;
        return { hands, dodge, side: Math.abs(e.y - a0[1]) };
      });
      t.eq(r.hands, 'cower', 'eller havada');
      t.ok(r.dodge && r.side > 8, 'atın yolundan yana çekilmeli', r);
    });
  },
};
