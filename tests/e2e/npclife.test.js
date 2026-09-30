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
        G.eventT = 1e9; G.travelT = 1e9;   // yol olayları (düello, soygun) testi bölmesin
        for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const ws = [new Wagon(road, 10, 1, false), new Wagon(road, 14, 1, true), new Wagon(road, 30, -1, false), new Wagon(road, 26, -1, true), new Wagon(road, 6, 1, true)];
        for (const w of ws) G.addEnt(w);
        const start = ws.map(w => [w.x, w.y]);
        let ov = 0;
        for (let f = 0; f < 30 * 35; f++) {
          G.update(1 / 30);
          for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) if (!ws[i].remove && !ws[j].remove && ws[i].overlapWith(ws[j]) > 1) ov++;
        }
        return { ov, moved: ws.map((w, i) => Math.round(Math.hypot(w.x - start[i][0], w.y - start[i][1]))), modal: UI.isModal(), st: G.state };
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
        e.x = P.x + 24; e.y = P.y; e.talk = null; e.teaseCd = 0; G.teaseT = 0; P.clean = 5; P.drunk = 0; P.hp = P.maxHp; e.hiWait = 0; G.mem(e.res).hiDay = G.day;
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
    await t.step('sakin selam verir; karşılık vermezsen bozulur ve sana küser', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, tw = TH.town('harlow');
        TH.goto(tw.spawn.x, tw.spawn.y); for (let f = 0; f < 60; f++) G.update(1 / 30);
        const e = G.ents.find(x => x.res && !x.dead && !x.remove && !x.child && x.state !== 'sit' && !x.talk);
        e.x = P.x + 30; e.y = P.y; e.nav = null; e.goal = null; e.res.mood = 'grumpy'; e.hiWait = 0; e.anim = null;
        const m = G.mem(e.res); m.hiDay = -1; G.hiT = 0; P.masked && G.toggleMask();
        const op0 = G.opOf(e.res);
        const rr = Math.random; Math.random = () => 0.01;
        let hello; try { hello = G.helloTick(e, e.res, MOODS.grumpy, 30 * 30); } finally { Math.random = rr; }
        const b1 = [...document.querySelectorAll('#bubbles .bubble')].map(b => b.textContent);
        const waited = !!e.hiWait, anim = e.anim && e.anim.k;
        for (let f = 0; f < 30 * 8; f++) { G.update(1 / 30); if (f % 30 === 0) G.mindTick(e, tw); }
        const b2 = [...document.querySelectorAll('#bubbles .bubble')].map(b => b.textContent);
        return { hello, waited, anim, b1, b2, op0, op1: G.opOf(e.res), snub: G.mem(e.res).snubDay === G.day, wait2: !!e.hiWait };
      });
      t.ok(r.hello && r.waited, 'selam vermeli ve karşılık beklemeli', r);
      t.ok(r.anim === 'wave' || r.anim === 'tiphat', 'el sallar ya da şapka çıkarır', r.anim);
      t.ok(r.op1 < r.op0 && r.snub && !r.wait2, 'karşılık gelmeyince görüşü düşer, unutmaz', r);
      t.ok(r.b2.some(s => /Selam|Kaba|unutmam|para/.test(s)), 'bozulduğunu söyler', r.b2);
    });
    await t.step('selama karşılık verilince sevinir', async () => {
      const r = await p.evaluate(() => {
        const P = G.player, tw = TH.town('harlow');
        const e = G.ents.find(x => x.res && !x.dead && !x.remove && !x.child && x.state !== 'sit' && !x.talk && !x.hiWait && G.mem(x.res).snubDay === undefined);
        e.x = P.x - 30; e.y = P.y; e.nav = null; e.goal = null; e.res.mood = 'jolly'; e.hiWait = 0;
        G.mem(e.res).hiDay = -1; G.hiT = 0;
        const op0 = G.opOf(e.res);
        const rr = Math.random; Math.random = () => 0.01;
        try { G.helloTick(e, e.res, MOODS.jolly, 30 * 30); } finally { Math.random = rr; }
        const acts = G.npcActions(e).map(a => a.n);
        G.npcActions(e).find(a => a.n === 'Selamla').fn();
        for (let f = 0; f < 30 * 8; f++) { G.update(1 / 30); if (f % 30 === 0) G.mindTick(e, tw); }
        return { acts, op0, op1: G.opOf(e.res), snub: G.mem(e.res).snubDay === G.day, wait: !!e.hiWait };
      });
      t.ok(r.acts.includes('Selamla'), 'Selamla seçeneği', r.acts);
      t.ok(!r.wait && !r.snub && r.op1 > r.op0, 'selam alınınca görüşü artar, küsmez', r);
    });
    await t.step('araba sürücüsü dükkân önünde iner, sandıkları içeri taşır, bekler ve arabasına dönüp gider', async () => {
      const r = await p.evaluate(() => {
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y);
        for (const e of G.ents) if (e.kind === 'wagon') e.remove = true; G.ents = G.ents.filter(e => !e.remove);
        const g = tw.gates[0], w = new Wagon(null, 0, 1, false, { x: g.x * TS + 8, y: g.y * TS + 8, ang: 0 });
        w.path = [[w.x, w.y]]; G.addEnt(w); w.enterTown();
        const S = { phases: new Set(), hid: 0, carried: 0, back: false, left: false, seatEmpty: false };
        for (let f = 0; f < 30 * 150 && !S.left; f++) {
          G.update(1 / 30);
          const d = w.driverEnt;
          if (d && d.job) { S.phases.add(d.job.phase); if (d.hide) S.hid++; if (d.carry2 === 'crate') S.carried++; if (!w.driver) S.seatEmpty = true; }
          if (!d && S.phases.size && w.driver) S.back = true;
          if (S.back && w.leg === 'out') S.left = true;
        }
        return { ...S, phases: [...S.phases], slot: w.slot, leg: w.leg, route: w.route && w.route.length, ri: w.ri, pos: [Math.round(w.x), Math.round(w.y)], park: w.parkT, rm: w.remove, modal: UI.isModal(), st: G.state };
      });
      t.ok(r.seatEmpty, 'sürücü arabadan iner (koltuk boş)', r);
      t.ok(r.carried > 30 && r.hid > 10, 'sandık taşıyıp dükkâna girer', r);
      t.ok(r.phases.includes('rest') || r.phases.includes('idle') || r.phases.includes('return'), 'sonra bekler ya da döner', r.phases);
      t.ok(r.back && r.left, 'arabasına dönüp yola çıkar', r);
    });
    await t.step('iki kişi aynı yere giderken aynı çizgiden yürümez, yolları kavislidir', async () => {
      const r = await p.evaluate(() => {
        const tw = TH.town('harlow'), P = G.player; TH.goto(tw.spawn.x, tw.spawn.y);
        const sp = tw.streetPts.slice().sort((a, b) => dist2(a.x, a.y, P.x, P.y) - dist2(b.x, b.y, P.x, P.y));
        const A = sp[0], B = sp.find(s => dist2(s.x, s.y, A.x, A.y) > 180 * 180) || sp[sp.length - 1];
        const mk = () => { const n = new NPC(A.x, A.y, 'traveler', {}); n.state = 'idle'; G.addEnt(n); return n; };
        const ns = [mk(), mk()], tr = [[], []];
        for (let f = 0; f < 30 * 25; f++) {
          ns.forEach((n, i) => { if (G.navStep(n, B.x, B.y, 1 / 30, 30) === 'moving') tr[i].push([n.x, n.y]); });
        }
        ns.forEach(n => { n.remove = true; });
        // düz çizgiden sapma ve iki yol arasındaki fark
        const dev = (a) => { const [x0, y0] = a[0], [x1, y1] = a[a.length - 1], L = Math.hypot(x1 - x0, y1 - y0) || 1; return Math.max(...a.map(([x, y]) => Math.abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L)); };
        const n = Math.min(tr[0].length, tr[1].length);
        let apart = 0; for (let i = 0; i < n; i += 10) apart = Math.max(apart, Math.hypot(tr[0][i][0] - tr[1][i][0], tr[0][i][1] - tr[1][i][1]));
        return { n, dev: tr.map(dev), apart };
      });
      t.ok(r.n > 60, 'yürümeliler', r);
      t.ok(r.apart > 4, 'iki yol birbirinden farklı', r);
      t.ok(r.dev.every(d => d > 3), 'cetvel gibi dümdüz değil', r);
    });
    await t.step('boşta çeşit çeşit hareket: sigara (duman), saat, kol kavuşturma, gerinme...', async () => {
      const r = await p.evaluate(() => {
        const e = G.ents.find(x => x.res && !x.dead && !x.remove && !x.child);
        const kinds = new Set();
        for (let k = 0; k < 300; k++) kinds.add(G.pickIdle(e, k % 3 === 0));
        const P = G.player; e.x = P.x + 20; e.y = P.y + 10; e.pauseT = 20; e.nav = null;
        G.mem(e.res).hiDay = G.day; e.hiWait = 0; e.teaseCd = G.clock + 999; e.talkCd = G.clock + 999; e.passCd = G.t + 999; e.talk = null;
        e.smk = true; G.setAnim(e, 'smoke', 20); e.anim.t = 2;
        const before = G.parts.list.filter(q => q.type === 'breath').length;
        for (let f = 0; f < 30 * 7; f++) G.update(1 / 30);
        const after = G.parts.list.filter(q => q.type === 'breath').length;
        return { kinds: [...kinds], smoke: after > before || G.parts.list.some(q => q.type === 'breath') };
      });
      t.ok(r.kinds.length >= 7, 'en az 7 farklı hareket', r.kinds);
      t.ok(r.smoke, 'sigara içen duman çıkarır', r);
    });
  },
};
