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
        // sarsılma süresince en büyük sapma (yük altında kareler seyrekleşir: tek an yetmez)
        const s0 = { flinch: !!n.flinch, dx: 0 };
        await until(() => { const o = Juice.flinchOff(n); if (o) s0.dx = Math.max(s0.dx, +o[0].toFixed(2)); return !n.flinch; }, 2000);
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

    await t.step('kement nişanda "kement" duruşu (ilmek döner), ipte biri varken değil; dinamit atınca kol savrulur', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player; P.weapons.add('lasso'); P.weapons.add('dynamite'); P.addItem('dynamite', 2);
        P.weapon = 'lasso'; const lasso = P.aimKind();
        P.rope = mk(20, 0); const roped = P.aimKind(); P.rope = null;
        P.weapon = 'dynamite'; const dyn = P.aimKind();
        P.aimDist = 60; P.aimAng = 0; P.throwDynamite(); const sw = P.swing;
        G.projs.length = 0;
        // iki çizicide de hatasız çizilir (nişan, savuruş)
        const errs = []; const on = (e) => errs.push(e.message); window.addEventListener('error', on);
        for (const g of [1, 0]) { if (!g) window.__hySoft = true; G.settings.gfx = g; G.applySettings(); for (const [w, a, s] of [['lasso', true, 0], ['lasso', false, 0.5], ['dynamite', true, 0], ['dynamite', false, 0.5]]) { P.weapon = w; P.aiming = a; P.swing = s; await new Promise(q => requestAnimationFrame(() => requestAnimationFrame(q))); } }
        window.removeEventListener('error', on); P.aiming = false; P.swing = 0; P.weapon = 'fists'; G.settings.gfx = 1; G.applySettings();
        return { lasso, roped, dyn, sw, errs };
      });
      t.eq([r.lasso, r.roped, r.dyn], ['lasso', null, 'throw'], 'kement kendi duruşunda; ipte biri varken ilmek yok; dinamit fırlatma');
      t.ok(r.sw > 0.9, 'dinamit atınca kol savuruşu başlar', r.sw);
      t.eq(r.errs, [], 'Klasik ve Melez çizimde hata yok');
    });

    await t.step('oturan kalkar, uyuyan uyanınca doğrulup kalkar, oturan oturur, uyuyacak olan uzanır', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const rs = (e) => e.rise ? [e.rise.k0, e.rise.k1] : null;
        const a = mk(30, 0); a.state = 'sit'; await until(() => a._seat === 'sit', 1500);
        a.state = 'idle'; await until(() => !!a.rise, 1500); const chair = rs(a); await until(() => !a.rise, 3000);
        const b = mk(-30, 0); b.camp = 1; b.state = 'sleep'; b.asleep = true; await until(() => b._seat === 'sleep', 1500);
        G.campWake(b); await until(() => !!b.rise, 1500); const wake = rs(b); await until(() => !b.rise, 3000);
        const c = mk(0, 30); c.camp = 1; await until(() => c._seat === null, 1500);
        c.state = 'sit'; await until(() => !!c.rise, 1500); const down = rs(c); await until(() => !c.rise, 3000);
        c.state = 'sleep'; await until(() => !!c.rise, 1500); const lie = rs(c); await until(() => !c.rise, 3000);
        const d = mk(0, -30); d.state = 'sit'; await until(() => d._seat === 'sit', 1500);
        d.down(0.01, true); await new Promise(q => setTimeout(q, 150));   // yerde yatan: oturuştan kalkma değil, yerden kalkma
        return { chair, wake, down, lie, cState: c.state, aState: a.state, downRise: d.rise ? [d.rise.k0, d.rise.k1] : null };
      });
      t.eq(r.chair, [0.76, 1], 'banktan kalkan çömelip doğrulur');
      t.eq(r.wake, [0, 1], 'uyanan yatıştan kalkar');
      t.eq(r.down, [1, 0.5], 'kamp ateşinde yere oturur');
      t.eq(r.lie, [0.5, 0], 'uyumak için uzanır');
      t.eq(r.cState, 'sleep', 'geçişten sonra durumu korunur');
      t.ok(!r.downRise || r.downRise[0] === 0, 'otururken yere düşen oturuştan kalkmaz', r.downRise);
    });

    await t.step('vurulan NPC sendeler, dizlerine çöker, yığılır (savrulma sürer); patlamada ve eyerden vurulunca oynamaz', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player, n = mk(40, 0); n.ang = Math.PI;
        const x0 = n.x;
        G.fireRay(P.x, P.y, 0, 200, 9999, P, { weapon: 'rifle' });
        const s0 = { dead: n.dead, die: !!n.die };
        const stages = new Set();
        await until(() => { if (n.die) stages.add(Juice.diePose(n).stage); return !n.die; }, 3000);
        const slid = n.x - x0;
        const b = mk(-40, 0); G.explode(b.x + 4, b.y, P);   // patlama: savrulur, yığılmaz
        const bdie = !!b.die && b.dead;
        const c = mk(0, 50); c.mounted = { col: '#6a4a2e', mane: '#2a1a10' }; c.hurt(9999, 'player', 'gun');
        return { s0, stages: [...stages], done: !n.die, slid, bdie, bdead: b.dead, cfall: !!c.fall, cdie: !!c.die };
      });
      t.ok(r.s0.dead && r.s0.die, 'ilk andan ceset sayılır, yığılma başlar', r.s0);
      t.ok(['stagger', 'kneel', 'sit', 'lie'].every(s => r.stages.includes(s)), 'sendeleme, diz, geriye oturuş, yatış', r.stages);
      t.ok(r.done && r.slid > 3, 'biter; savrulma kayması sürer', r);
      t.ok(r.bdead && !r.bdie, 'patlamada yığılma yok (savrulur)', r);
      t.ok(r.cfall && !r.cdie, 'eyerden vurulan düşer, yığılmaz', r);
    });

    await t.step('yükü alırken eğilip omzuna kaldırır, bırakırken indirir; yük bırakıldığı an yerdedir', async () => {
      await setup();
      const r = await p.evaluate(async () => {
        const P = G.player, n = mk(9, 2); n.dead = true; n.hp = 0; n.state = 'dead';
        G.pickUp(n);
        const s0 = { carry: P.carry === n, inWorld: G.ents.includes(n), lift: !!P.lift, st: Juice.liftSt(P).kneel, h: Juice.liftH(P), face: +Math.cos(P.ang).toFixed(2) };
        const x0 = P.x; let hMax = 0;
        await until(() => { if (P.lift) hMax = Math.max(hMax, Juice.liftH(P)); return !P.lift; }, 3000);
        const moved = Math.abs(P.x - x0);
        G.dropCarry();
        const d0 = { inWorld: G.ents.includes(n), lower: !!P.lower, hid: Juice.lowerHid(n), carry: P.carry };
        await until(() => !P.lower, 3000);
        const d1 = { hid: Juice.lowerHid(n), lower: !!P.lower };
        // kaldırırken bırakılırsa o yükseklikten iner; sessiz bırakma (bayılma) anında
        G.pickUp(n); P.lift.t = P.lift.dur * 0.6; const hl = Juice.liftH(P); G.dropCarry(); const h0 = P.lower ? P.lower.h0 : null;
        await until(() => !P.lower, 3000);
        G.pickUp(n); G.dropCarry(true); const silent = !!P.lower || !!P.lift;
        return { s0, hMax, moved, d0, d1, hl: +hl.toFixed(2), h0: h0 === null ? null : +h0.toFixed(2), silent };
      });
      t.ok(r.s0.carry && !r.s0.inWorld && r.s0.lift, 'yük hemen omuzda sayılır, kaldırma başlar', r.s0);
      t.ok(r.s0.st === 'lift' && r.s0.h === 0 && r.s0.face > 0.9, 'önce yüke dönüp eğilir, yük yerde', r.s0);
      t.ok(r.hMax === 1 && r.moved < 0.5, 'yük omza çıkar; bu sırada yürümez', r);
      t.ok(r.d0.inWorld && r.d0.lower && r.d0.hid && !r.d0.carry, 'bırakınca yük hemen yerde sayılır, çizimi omuzdan iner', r.d0);
      t.ok(!r.d1.hid && !r.d1.lower, 'yere değince dünyada görünür', r.d1);
      t.ok(r.h0 === r.hl && r.hl > 0 && r.hl < 1, 'kaldırırken bırakılan o yükseklikten iner', r);
      t.ok(!r.silent, 'sessiz bırakmada (bayılma) animasyon yok');
    });
  },
};
