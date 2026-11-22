'use strict';
/* Animasyonlar (js/juice.js): yerden kalkma (NPC ve bayılan oyuncu), NPC'nin ata binip inmesi (sıçrama; at varlık değilse
   gelip giden at), yeme-içme-matara-avuçla su, yer işlerinde diz çökme ve yerden alırken eğilme, silah doldurma duruşu,
   isabet tepkisi. Bu sürelerde yapay zekâ bekler, oyuncu kıpırdamaz; animasyon bitince her şey olağan akışına döner. */
module.exports = {
  name: 'Animasyonlar',
  timeout: 240000,
  async run(t) {
    const p = await t.newGame();
    const setup = () => p.evaluate(() => {
      UI.closeAll(); const tw = TH.town('harlow'), s = TH.openSpot(tw.cx + 1400, tw.cy + 300, 120);
      TH.goto(s[0], s[1]); TH.clearNpcs(); G.godMode = true; G.clock = Math.floor(G.clock / 1440) * 1440 + 12 * 60;
      for (const e of G.ents) if (e.kind === 'wagon' || (e.kind === 'horse' && e !== G.horse)) e.remove = true;
      G.ents = G.ents.filter(e => !e.remove);
      const P = G.player; P.hp = P.maxHp; if (P.riding) { P.dismount(); P.mountAnim = null; }
      P.act = null; P.kneel = null; P.rise = null; P.reloadT = 0; G.horse.x = P.x - 200; G.horse.y = P.y + 120;
      Object.assign(G.law, { level: 0, bounty: 0 });
      window.mk = (dx, dy, o) => { const n = new NPC(P.x + dx, P.y + dy, (o && o.role) || 'traveler', Object.assign({ sex: 'm' }, o || {})); n.state = 'idle'; n.t = 99; G.addEnt(n); return n; };
      // oyun saatiyle bekle (yük altında kareler seyrekleşir): koşul ya da süre
      window.until = async (fn, ms = 8000) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 16)); return fn(); };
    });

    await t.step('baygın NPC ayılınca bir anda dikilmez: doğrulup oturur, dizine gelir, kalkar; bu sürede kıpırdamaz', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const n = mk(30, 0); n.ang = Math.PI; n.down(0.01, true);
        await until(() => !!n.rise, 3000);
        const s0 = { rise: !!n.rise, state: n.state, bound: n.bound, x: n.x, y: n.y };
        const stages = new Set();
        let moved = 0;
        await until(() => { if (n.rise) { stages.add(Juice.risePose(n).stage); moved = Math.max(moved, Math.hypot(n.x - s0.x, n.y - s0.y)); } return !n.rise; });
        return { s0, stages: [...stages], moved, done: !n.rise, ang: +Math.cos(n.ang).toFixed(2), state: n.state };
      });
      t.ok(r.s0.rise && !r.s0.bound && r.s0.state !== 'downed', 'ayılınca kalkmaya başlar', r.s0);
      t.ok(['lie', 'sit', 'kneel', 'crouch'].every(s => r.stages.includes(s)), 'yatış, oturuş, diz, çömelme', r.stages);
      t.ok(r.done && r.moved < 0.5, 'kalkarken yerinden oynamaz, sonra biter', r);
      t.ok(r.ang > 0.9, 'kalkınca ayaklarının yönüne (yattığı yönün tersine) döner', r.ang);
    });

    await t.step('kementten kurtulan ve iplerini çözen de kalkar; arabadan atılan sürücü yere inince kalkar', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player, a = mk(30, 0); G.lassoHit(a); P.rope = null;   // ip bırakılınca kurtulur
        await until(() => !!a.rise, 3000);
        const lasso = !!a.rise;
        const b = mk(-30, 0); b.state = 'tied'; b.tieT = 0.01;
        await until(() => !!b.rise, 3000);
        const tied = !!b.rise;
        const road = G.world.roads.find(x => !x.spur && x.pts.length > 60);
        TH.goto(road.pts[30][0], road.pts[30][1] + 22);   // uzaktaki NPC seyrek güncellenir: arabanın yanına gidilir
        const w = new Wagon(road, 30, 1, false); G.addEnt(w); w.spd = 0; w.max = 0;
        const d = w.throwDriver();
        await until(() => !d.fall, 3000);
        const drv = !!d.rise;
        w.remove = true;
        return { lasso, tied, drv };
      });
      t.ok(r.lasso, 'kementten kurtulan kalkar');
      t.ok(r.tied, 'iplerinden kurtulan kalkar');
      t.ok(r.drv, 'koltuktan düşen sürücü yere inince kalkar');
    });

    await t.step('bayılan oyuncu ayılınca ekran açılırken bir an yatar, sonra kalkar; o sırada yürümez', async () => {
      await setup();
      await p.evaluate(() => { G.player.faintCd = 0; G.law.level = 1; G.faint('heat'); });   // aranırken kimse doktora götürmez: olduğu yerde ayılır
      await p.waitForFunction(() => G.state === 'play' && !!G.player.rise, null, { timeout: 15000 }).catch(() => {});
      const r0 = await p.evaluate(() => ({ rise: !!G.player.rise, x: G.player.x, y: G.player.y }));
      t.ok(r0.rise, 'ayılınca kalkış başlar', r0);
      await p.keyboard.down('KeyD');
      await t.sleep(300);
      const r1 = await p.evaluate(() => ({ rise: !!G.player.rise, x: G.player.x, y: G.player.y }));
      await p.waitForFunction(() => !G.player.rise, null, { timeout: 10000 }).catch(() => {});
      await t.sleep(400);
      const r2 = await p.evaluate(() => ({ rise: !!G.player.rise, x: G.player.x }));
      await p.keyboard.up('KeyD');
      await p.evaluate(() => { UI.closeAll(); Object.assign(G.law, { level: 0, bounty: 0 }); });
      t.ok(!r1.rise || Math.hypot(r1.x - r0.x, r1.y - r0.y) < 0.5, 'kalkarken yürümez', { r0, r1 });
      t.ok(!r2.rise && r2.x > r0.x + 2, 'kalkınca yürür', { r0, r2 });
    });

    await t.step('atlı NPC atından sıçrayarak iner: at yerinde kalır, kendisi yanına iner', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const n = mk(40, 0, { mounted: true }); n.ang = n.hAng = Math.PI / 2;
        const x0 = n.x, y0 = n.y;
        n.alight();
        const h = G.ents.find(e => e.kind === 'horse' && e !== G.horse && !e.remove);
        const s0 = { hop: !!(n.hop && !n.hop.on), mounted: !!n.mounted, horse: !!h && Math.hypot(h.x - x0, h.y - y0) < 1, z: 0 };
        await until(() => { if (n.hop) s0.z = Math.max(s0.z, Juice.hopPose(n).z); return !n.hop; }, 3000);
        return { s0, done: !n.hop, d: h ? Math.hypot(n.x - h.x, n.y - h.y) : -1, free: !G.world.blocked(n.x, n.y, 4) };
      });
      t.ok(r.s0.hop && !r.s0.mounted && r.s0.horse, 'iner, at olduğu yerde', r.s0);
      t.ok(r.s0.z > 3, 'sıçrar', r.s0.z);
      t.ok(r.done && r.d > 6 && r.d < 16 && r.free, 'atın yanında boş bir yere iner', r);
    });

    await t.step('atı varlık olmayan NPC (koruma, Sully) binerken atı gelir, eyere sıçrar; inince at uzaklaşıp kaybolur', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const n = mk(30, -6), look = { col: '#6a4a2a', mane: '#1a1410', blanket: '#2a3a5a' };
        Juice.ghosts.length = 0;
        G.npcMount(n, look);
        const m0 = { mounted: n.mounted === look, hop: !!(n.hop && n.hop.on), ghosts: Juice.ghosts.length, a0: Juice.ghosts[0] ? Juice.ghosts[0].a : -1 };
        await until(() => !n.hop && !Juice.ghosts.length, 3000);
        const m1 = { hop: !!n.hop, ghosts: Juice.ghosts.length, mounted: !!n.mounted };
        G.npcDismount(n);
        const d0 = { mounted: !!n.mounted, hop: !!(n.hop && !n.hop.on), ghosts: Juice.ghosts.length };
        await until(() => !n.hop, 3000);
        const d1 = { ghost: Juice.ghosts.length };
        await until(() => !Juice.ghosts.length, 4000);
        // gözden uzakta: sıçrama yok, hemen atlı/yaya
        const far = mk(2000, 0); G.npcMount(far, look);
        return { m0, m1, d0, d1, d2: Juice.ghosts.length, far: { hop: !!far.hop, mounted: !!far.mounted } };
      });
      t.ok(r.m0.mounted && r.m0.hop && r.m0.ghosts === 1 && r.m0.a0 < 0.5, 'atlı sayılır, at belirerek gelir, eyere sıçrar', r.m0);
      t.ok(!r.m1.hop && r.m1.ghosts === 0 && r.m1.mounted, 'biniş biter, at gerçek atlı NPC olur', r.m1);
      t.ok(!r.d0.mounted && r.d0.hop && r.d0.ghosts === 1, 'iner, at uzaklaşmaya başlar', r.d0);
      t.ok(r.d1.ghost === 1 && r.d2 === 0, 'at kişi indikten sonra da bir süre görünür, sonra kaybolur', r);
      t.ok(!r.far.hop && r.far.mounted, 'gözden uzaktaki hemen atlı olur', r.far);
    });

    await t.step('yemek, içmek, matara, sigara: el ağza gider, sonra iner; nişan alınca yarıda kalır', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player, out = {};
        const run = async (k, fn) => { fn(); const A = P.act; let qmax = 0; await until(() => { if (P.act) qmax = Math.max(qmax, P.act.q); return !P.act; }, 4000); out[k] = { k: A && A.k, col: A && A.col, qmax: +qmax.toFixed(2), done: !P.act }; };
        P.addItem('bread'); await run('bread', () => G.consume('bread'));
        P.addItem('whiskey'); await run('whiskey', () => G.consume('whiskey'));
        if (!P.has('canteen')) P.addItem('canteen'); P.canteen = 5; await run('canteen', () => G.drinkCanteen());
        P.addItem('cigarette'); await run('cig', () => G.consume('cigarette'));
        P.addItem('coffee'); await run('coffee', () => G.consume('coffee'));
        // avuçla su: diz çöker
        G.drinkWater(true); out.scoop = { k: P.act && P.act.k, kneel: (P.kneelPose() || {}).st && P.kneelPose().st.kneel };
        P.act = null;
        // nişan alınca yarıda kalır
        P.addItem('bread'); G.consume('bread'); P.aiming = true; Juice.actTick(P, 0.016); out.aim = !P.act; P.aiming = false;
        return out;
      });
      t.eq([r.bread.k, r.whiskey.k, r.canteen.k, r.cig.k, r.coffee.k], ['eat', 'drink', 'canteen', 'smoke', 'cup'], 'eşyaya göre hareket');
      t.ok(r.whiskey.col && r.bread.col, 'şişe ve yiyecek renkli', r);
      for (const k of ['bread', 'whiskey', 'canteen', 'cig', 'coffee']) t.ok(r[k].qmax > 0.9 && r[k].done, `${k}: el ağza gelir ve hareket biter`, r[k]);
      t.eq(r.scoop, { k: 'scoop', kneel: 'mouth' }, 'avuçla su içerken diz çöker');
      t.ok(r.aim, 'nişan alınca yarıda kalır');
    });

    await t.step('yerdeki işte (bağlama) basılı tutarken diz çöker, hedefe döner; bitince kalkar; yerden alırken eğilir', async () => {
      await setup();
      await p.evaluate(() => { const P = G.player; if (!P.weapons.has('lasso')) P.giveWeapon('lasso', true); P.weapon = 'lasso'; const n = window.__k = mk(12, 0); G.lassoHit(n); P.ang = Math.PI; });   // elde kement yoksa ip bırakılır
      await p.waitForFunction(() => { const it = UI.curInteract; return !!(it && it.actions[0].n === 'Bağla'); }, null, { timeout: 8000 }).catch(() => {});
      await p.keyboard.down('KeyE');
      await p.waitForFunction(() => !!G.player.kneel, null, { timeout: 5000 }).catch(() => {});
      const r0 = await p.evaluate(() => { const k = G.player.kneelPose(); return { k: G.player.kneel && G.player.kneel.k, pose: k && k.st.kneel, face: k ? +Math.cos(k.ang).toFixed(2) : null }; });
      await p.waitForFunction(() => window.__k.state === 'tied', null, { timeout: 8000 }).catch(() => {});
      await p.keyboard.up('KeyE');
      await p.waitForFunction(() => !G.player.kneel, null, { timeout: 3000 }).catch(() => {});
      const r1 = await p.evaluate(() => ({ tied: window.__k.state === 'tied', kneel: !!G.player.kneel }));
      t.eq(r0.k, 'work', 'bağlarken diz çöker', r0);
      t.ok(r0.pose === 'work' && r0.face > 0.9, 'diz çökmüş duruş hedefe (doğuya) dönük', r0);
      t.ok(r1.tied && !r1.kneel, 'bağlanınca kalkar', r1);
      const d = await p.evaluate(async () => {
        const P = G.player, g = new GunDrop(P.x + 8, P.y, 'repeater', 6); G.addEnt(g);
        const a = G.gunPickAction(g);
        P.kneelAt('work', g.x, g.y, 0.42); a.fn();   // UI'nin anlık eylemdeki yolu (dip)
        const k0 = !!P.kneel;
        await until(() => !P.kneel, 3000);
        return { dip: a.dip, k0, gone: !P.kneel };
      });
      t.ok(d.dip && d.k0 && d.gone, 'yerden silah alırken kısa eğilir', d);
    });

    await t.step('doldururken silah türüne göre doldurma duruşu (oyuncu ve NPC)', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player, out = {};
        for (const w of ['cattleman', 'winchester', 'shotgun', 'rifle', 'bow']) {
          if (!P.weapons.has(w)) P.giveWeapon(w, true);
          P.weapon = w; P.reloadT = 0; P.clip[w] = 0; P.ammo[WEAPONS[w].ammo] = 30;
          P.startReload();
          await new Promise(r => setTimeout(r, 120));
          const rp = P.reloadPose();
          out[w] = rp ? { wk: rp.wk, n: rp.n, q: rp.q > 0 && rp.q < 1, dur: P.reloadDur > 0 } : null;
          await until(() => !(P.reloadT > 0), 5000);
          out[w].after = P.reloadPose();
        }
        const n = mk(30, 0, { role: 'bandit' }); n.weapon = 'repeater'; n.npcReload(WEAPONS.repeater);
        const nr = Juice.reloadSt(n, n.weapon, n.reloadDur);
        out.npc = nr && { wk: nr.wk, dur: n.reloadDur > 0 };
        return out;
      });
      t.eq(r.cattleman && [r.cattleman.wk, r.cattleman.n], ['pistol', 3], 'tabanca: tambur, üç gidiş-geliş', r.cattleman);
      t.eq(r.winchester && r.winchester.wk, 'long', 'karabina'); t.eq(r.shotgun && r.shotgun.wk, 'shotgun', 'av tüfeği');
      t.eq(r.rifle && r.rifle.wk, 'single', 'tek atımlık'); t.eq(r.bow && r.bow.wk, 'bow', 'yay');
      for (const w of ['cattleman', 'winchester', 'shotgun', 'rifle', 'bow']) t.ok(r[w] && r[w].q && r[w].dur && r[w].after === null, `${w}: doldururken duruş, bitince yok`, r[w]);
      t.eq(r.npc, { wk: 'long', dur: true }, 'NPC de doldururken duruşa geçer');
    });

    await t.step('vurulan NPC ve oyuncu vuruş yönünde kısa sarsılır (yalnız görünüş)', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player, n = mk(40, 0); n.hp = n.maxHp = 9999; n.update = function () {};   // yerinde dursun (sarsılma Juice.update'te söner)
        G.godMode = false;
        const x0 = n.x, y0 = n.y;
        G.fireRay(P.x, P.y, 0, 200, 40, P, { weapon: 'cattleman' });
        await new Promise(r => setTimeout(r, 60));
        const o = Juice.flinchOff(n), s0 = { flinch: !!n.flinch, dx: o ? +o[0].toFixed(2) : 0 };
        P.hurt(20, 'haydut', true, n);
        const p0 = { flinch: !!P.flinch, ang: P.flinch ? +Math.cos(P.flinch.ang).toFixed(2) : null };
        await until(() => !n.flinch && !P.flinch, 3000);
        G.godMode = true; P.hp = P.maxHp;
        return { s0, p0, gone: !n.flinch && !P.flinch, moved: Math.hypot(n.x - x0, n.y - y0) };
      });
      t.ok(r.s0.flinch && r.s0.dx > 0.3, 'NPC vuruş yönüne (doğuya) itilir', r.s0);
      t.ok(r.p0.flinch && r.p0.ang < -0.9, 'oyuncu ateş edenden uzağa (batıya) sarsılır', r.p0);
      t.ok(r.gone && r.moved < 0.5, 'sarsılma kısa sürer, konum değişmez', r);
    });
  },
};
