'use strict';
/* ==========================================================
   DUSTBOUND — varlıklar: oyuncu, at, hayvan, NPC, tren,
   mermiler, parçacıklar
   ========================================================== */

function randomLook(sex, R) {
  const r = R || { pick, chance, next: Math.random };
  const p = a => (R ? R.pick(a) : pick(a));
  sex = sex || (Math.random() < 0.55 ? 'm' : 'f');
  return {
    sex,
    skin: p(LOOKS.skin), hair: p(LOOKS.hair), hairStyle: sex === 'f' ? p([1, 2, 4, 0]) : p([0, 0, 3, 4, 1]),
    beard: sex === 'm' ? p([0, 1, 2, 3, 4, 0]) : 0, beardLen: 0.6,
    hat: p(sex === 'f' ? ['none', 'none', 'wide', 'bowler', 'cowboy'] : ['cowboy', 'cowboy', 'bowler', 'flat', 'wide', 'none']),
    hatCol: p(LOOKS.hatCol), coat: p(LOOKS.coat), shirt: p(LOOKS.shirt), pants: p(LOOKS.pants), eyes: p(LOOKS.eyes), coatLen: Math.random() < 0.3 ? 0.7 : 0,
  };
}
function randomName(sex) { return pick(NAMES[sex]) + ' ' + pick(NAMES.last); }

/* ---------------- Parçacıklar ---------------- */
class Particles {
  constructor() { this.list = []; this.pool = []; }
  add(type, x, y, vx, vy, life, size, col) {
    if (this.list.length > 700) return;
    const p = this.pool.pop() || {};
    p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col; p.z = 0; p.vz = 0; p.x2 = 0; p.y2 = 0;
    this.list.push(p);
    return p;
  }
  burst(type, x, y, n, spd, life, size, col) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = Math.random() * spd; this.add(type, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size, col); }
  }
  tracer(x1, y1, x2, y2) { const p = this.add('tracer', x1, y1, 0, 0, 0.07, 1, '#fff4c0'); if (p) { p.x2 = x2; p.y2 = y2; } }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); this.pool.push(p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'smoke' || p.type === 'steam') { p.vx *= 0.98; p.vy = p.vy * 0.98 - 6 * dt; p.size += dt * 6; }
      else if (p.type === 'dust') { p.vx *= 0.92; p.vy *= 0.92; p.size += dt * 5; }
      else if (p.type === 'blood' || p.type === 'spark' || p.type === 'debris') { p.vx *= 0.9; p.vy *= 0.9; }
      else if (p.type === 'ember') { p.vy -= 10 * dt; p.vx += (Math.random() - 0.5) * 20 * dt; }
      else if (p.type === 'feather') { p.vx *= 0.96; p.vy = p.vy * 0.96 + 4 * dt; }
      else if (p.type === 'splash') { p.vx *= 0.9; p.vy *= 0.9; }
    }
  }
  draw(ctx, cx0, cy0, cx1, cy1) {
    for (const p of this.list) {
      if (p.x < cx0 - 40 || p.x > cx1 + 40 || p.y < cy0 - 40 || p.y > cy1 + 40) continue;
      const a = p.life / p.max;
      switch (p.type) {
        case 'smoke': ctx.fillStyle = `rgba(${p.col || '200,200,200'},${a * 0.35})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'steam': ctx.fillStyle = `rgba(240,240,240,${a * 0.25})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'dust': ctx.fillStyle = `rgba(${p.col || '170,140,100'},${a * 0.35})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'blood': ctx.fillStyle = `rgba(140,10,10,${Math.min(1, a * 2)})`; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); break;
        case 'spark': ctx.fillStyle = `rgba(255,220,120,${a})`; ctx.fillRect(p.x, p.y, 1.2, 1.2); break;
        case 'ember': ctx.fillStyle = `rgba(255,${120 + a * 100 | 0},40,${a})`; ctx.fillRect(p.x, p.y, 1, 1); break;
        case 'debris': ctx.fillStyle = p.col || '#6a5a4a'; ctx.globalAlpha = a; ctx.fillRect(p.x, p.y, p.size, p.size); ctx.globalAlpha = 1; break;
        case 'feather': ctx.fillStyle = p.col || '#e8e0d0'; ctx.globalAlpha = a; ctx.fillRect(p.x, p.y, 2, 1); ctx.globalAlpha = 1; break;
        case 'splash': ctx.strokeStyle = `rgba(200,230,240,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.5 - a), 0, TAU); ctx.stroke(); break;
        case 'flash': ctx.fillStyle = `rgba(255,230,150,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a), 0, TAU); ctx.fill(); break;
        case 'ring': ctx.strokeStyle = `rgba(255,200,120,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - a), 0, TAU); ctx.stroke(); break;
        case 'tracer': ctx.strokeStyle = `rgba(255,240,190,${a * 0.9})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); break;
        case 'text': ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, a * 2); ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.size, p.x, p.y); ctx.globalAlpha = 1; break;
      }
    }
  }
}

/* ---------------- Temel varlık ---------------- */
class Ent {
  constructor(x, y) {
    this.x = x; this.y = y; this.ang = 0; this.r = 4; this.hp = 100; this.maxHp = 100;
    this.dead = false; this.remove = false; this.phase = Math.random() * 6; this.mv = 0; this.kind = 'ent';
    this.id = Ent.nextId++;
  }
  move(dx, dy) {
    const W = G.world;
    let moved = false;
    if (!W.blocked(this.x + dx, this.y, this.r)) { this.x += dx; moved = true; }
    if (!W.blocked(this.x, this.y + dy, this.r)) { this.y += dy; moved = true; }
    return moved;
  }
  slow() { return TINFO[G.world.tileAtPx(this.x, this.y)].slow || 1; }
  dTo(e) { return dist(this.x, this.y, e.x, e.y); }
}
Ent.nextId = 1;

/* ---------------- At ---------------- */
class Horse extends Ent {
  constructor(x, y, breed, opts = {}) {
    super(x, y);
    this.kind = 'horse';
    this.breed = breed;
    const B = HORSE_BREEDS[breed];
    this.def = B;
    this.name = opts.name || pick(HORSE_NAMES);
    this.look = opts.look || { col: pick(B.cols), mane: '#1a1410', blaze: Math.random() < 0.3, blanket: pick(['#8a2a20', '#2a4a6a', '#4a6a3a', '#6a4a2a']) };
    if (!opts.look) this.look.mane = shadeHex(this.look.col, -0.45);
    this.maxHp = B.hp; this.hp = opts.hp || B.hp;
    this.maxSta = B.sta; this.sta = this.maxSta;
    this.owner = opts.owner || null;
    this.bond = opts.bond || 0;
    this.r = 5;
    this.spd = 0;
    this.state = 'idle';
    this.t = 0;
    this.saddle = this.owner !== null;
    this.rider = null;
    this.dirty = 0;
  }
  get bondLv() { return this.bond >= 300 ? 4 : this.bond >= 150 ? 3 : this.bond >= 50 ? 2 : 1; }
  addBond(v) {
    const before = this.bondLv;
    this.bond += v * (G.hasPerk('tamer') ? 2 : 1);
    if (this.bondLv > before) UI.feed(`🐴 ${this.name} ile bağın gelişti: Seviye ${this.bondLv}`);
  }
  update(dt) {
    if (this.dead) return;
    this.t -= dt;
    if (this.rider) return;
    const P = G.player;
    if (this.state === 'come') {
      const d = this.dTo(P);
      if (d < 26) { this.state = 'idle'; this.spd = 0; this.mv = 0; return; }
      const a = Math.atan2(P.y - this.y, P.x - this.x);
      this.ang = turnTo(this.ang, a, 3.5 * dt);
      const target = d > 200 ? 150 * this.def.spd : d > 80 ? 90 : 45;
      this.spd = lerp(this.spd, target, dt * 2);
      if (!this.move(Math.cos(this.ang) * this.spd * dt * this.slow(), Math.sin(this.ang) * this.spd * dt * this.slow())) {
        this.ang += (Math.random() - 0.5) * 2;
      }
    } else if (this.state === 'flee') {
      this.spd = lerp(this.spd, 130, dt * 2);
      this.move(Math.cos(this.ang) * this.spd * dt, Math.sin(this.ang) * this.spd * dt);
      if (this.t <= 0) this.state = 'idle';
    } else {
      this.spd = lerp(this.spd, 0, dt * 3);
      if (this.spd > 1) this.move(Math.cos(this.ang) * this.spd * dt, Math.sin(this.ang) * this.spd * dt);
      if (this.t <= 0) {
        this.t = rnd(3, 8);
        if (chance(0.4) && !this.hitch) { this.ang += rnd(-1.2, 1.2); this.spd = 20; }
      }
      this.graze = this.spd < 3;
    }
    this.mv = this.spd / 60;
    this.phase += dt * (4 + this.spd * 0.09);
    this.sta = Math.min(this.maxSta, this.sta + dt * 6);
  }
  hurt(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    G.parts.burst('blood', this.x, this.y, 5, 30, 0.5, 1.5);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true;
      if (this.rider === G.player) G.player.dismount(true);
      if (this === G.horse) { UI.help(`${this.name} yaralandı ve yere düştü. Bir <b>At Diriltici</b> kullanabilir ya da ahırdan yeni at alabilirsin.`, 8); Audio_.neigh(); }
    } else if (!this.rider && this.owner !== 'player') { this.state = 'flee'; this.t = 4; }
  }
  draw(ctx) {
    Spr.horse(ctx, this.x, this.y, this.ang, this.look, { phase: this.phase, mv: this.mv, saddle: this.saddle, dead: this.dead, graze: this.graze && !this.rider, bags: this.owner === 'player' });
  }
}

/* ---------------- Oyuncu ---------------- */
class Player extends Ent {
  constructor(x, y, profile) {
    super(x, y);
    this.kind = 'player';
    this.r = 3.6;
    this.name = profile.name;
    this.look = profile.look;
    this.sex = profile.look.sex;
    this.inv = {};
    this.weapons = new Set(['fists']);
    this.ammo = { pistol: 0, repeater: 0, rifle: 0, shotgun: 0, arrow: 0 };
    this.clip = {};
    this.weapon = 'fists';
    this.money = 0;
    this.hp = 100; this.maxHpBase = 100;
    this.sta = 100; this.de = 60;
    this.hunger = 85; this.thirst = 85; this.energy = 90; this.clean = 90; this.drunk = 0; this.warmBuff = 0;
    this.deCore = 70;
    this.sick = 0; this.poison = 0;
    this.canteen = 3;
    this.coat = null;
    this.lantern = false;
    this.crouch = false;
    this.riding = null;
    this.aiming = false;
    this.aimAng = 0; this.aimDist = 60;
    this.fireCd = 0; this.reloadT = 0; this.meleeCd = 0; this.swing = 0;
    this.draw_ = 0;
    this.deadeye = false;
    this.stepT = 0;
    this.hurtT = 0;
    this.lastPos = { x, y };
    this.greeted = new Set();
  }
  /* ---- envanter ---- */
  count(id) { return this.inv[id] || 0; }
  has(id, n = 1) { return (this.inv[id] || 0) >= n; }
  addItem(id, n = 1, silent) {
    const it = ITEMS[id];
    if (!it) return 0;
    const cur = this.inv[id] || 0;
    const add = Math.max(0, Math.min(n, it.max - cur));
    if (add > 0) this.inv[id] = cur + add;
    if (!silent) {
      if (add > 0) UI.feed(`${it.i} +${add} ${it.n}`);
      if (add < n) UI.feed(`Çantada yer yok: ${it.n}`, 'warn');
    }
    if (add > 0 && it.c === 'collect') G.stat('collectibles', add);
    return add;
  }
  removeItem(id, n = 1) {
    const cur = this.inv[id] || 0;
    const r = Math.min(cur, n);
    if (cur - r <= 0) delete this.inv[id]; else this.inv[id] = cur - r;
    return r;
  }
  giveWeapon(w, silent) {
    if (!this.weapons.has(w)) {
      this.weapons.add(w);
      const W = WEAPONS[w];
      if (W.clip) this.clip[w] = W.clip;
      if (!silent) UI.feed(`${W.i} Yeni silah: ${W.n}`);
    }
  }
  get maxHp() {
    const age = G.age;
    let m = this.maxHpBase;
    if (age > 50) m *= 1 - Math.min(0.35, (age - 50) * (G.hasPerk('age65') ? 0.007 : 0.012));
    if (G.hasPerk('bear')) m += 15;
    return Math.round(m - (G.scars || 0));
  }
  set maxHp(v) {}
  get maxSta() {
    const age = G.age;
    let m = 100;
    if (age > 32) m *= 1 - Math.min(0.5, (age - 32) * (G.hasPerk('age65') ? 0.007 : 0.011));
    if (G.hasPerk('walker')) m *= 1.15;
    if (G.hasPerk('parent')) m *= 1.05;
    if (this.energy < 10) m *= 0.6;
    return m;
  }
  get W() { return WEAPONS[this.weapon]; }
  get isArmed() { const w = this.W; return w && !w.melee; }

  mount(h) {
    if (h.dead) return;
    this.riding = h; h.rider = this; h.state = 'idle';
    this.x = h.x; this.y = h.y; this.ang = h.ang;
    this.crouch = false;
    Audio_.step(0.2, true);
  }
  dismount(fall) {
    const h = this.riding;
    if (!h) return;
    h.rider = null; this.riding = null;
    const side = h.ang + Math.PI / 2;
    const ox = Math.cos(side) * 10, oy = Math.sin(side) * 10;
    if (!G.world.blocked(h.x + ox, h.y + oy, this.r)) { this.x = h.x + ox; this.y = h.y + oy; }
    else if (!G.world.blocked(h.x - ox, h.y - oy, this.r)) { this.x = h.x - ox; this.y = h.y - oy; }
    if (fall) { this.hurt(12, null, true); UI.feed('Attan düştün!'); }
    h.spd *= 0.3;
  }

  hurt(dmg, src, silent) {
    if (G.state !== 'play' || this.hp <= 0) return;
    if (this.riding && src && src !== 'fall' && Math.random() < 0.25) { this.riding.hurt(dmg); return; }
    if (G.godMode) return;
    this.hp -= dmg;
    this.hurtT = 0.4;
    G.fx.flash = Math.min(0.6, G.fx.flash + dmg / 40);
    G.fx.shake = Math.min(6, G.fx.shake + dmg / 8);
    G.parts.burst('blood', this.x, this.y, 4 + dmg / 6, 30, 0.5, 1.4);
    if (!silent) Audio_.thud(0.3);
    if (this.hp <= 0) { this.hp = 0; G.playerDied(src); }
  }

  update(dt) {
    const I = Input, W = G.world;
    const age = G.age;
    this.fireCd -= dt; this.meleeCd -= dt; this.hurtT -= dt;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4);
    // yeniden doldurma
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    const mv = G.uiBlocksMove ? { x: 0, y: 0, m: 0 } : I.moveVec();
    // nişan
    this.aiming = !G.uiBlocksMove && I.down('aim') && this.weapon !== 'fists';
    this.updateAim(dt, mv);
    if (this.riding) this.updateRiding(dt, mv);
    else this.updateFoot(dt, mv, age);
    // saldırılar
    if (!G.uiBlocksMove && !G.wheelOpen) this.updateCombat(dt);
    // fener ışığı
    if (I.pressed('lantern')) {
      if (this.has('lantern')) { this.lantern = !this.lantern; Audio_.ui('pick'); UI.feed(this.lantern ? '🏮 Fener yakıldı' : '🏮 Fener söndürüldü'); }
      else UI.feed('Fenerin yok. Genel mağazadan alabilirsin.', 'warn');
    }
    if (I.pressed('crouch') && !this.riding) { this.crouch = !this.crouch; }
    if (I.pressed('whistle')) G.whistle();
    // mesafe istatistikleri
    const dd = dist(this.x, this.y, this.lastPos.x, this.lastPos.y);
    if (dd > 0 && dd < 50) {
      if (this.riding) { G.stat('rideMiles', dd / 1609 * 3.2); if (this.riding === G.horse) this.riding.addBond(dd * 0.002); }
      else G.stat('walkMiles', dd / 1609 * 3.2);
    }
    this.lastPos.x = this.x; this.lastPos.y = this.y;
  }
  updateAim(dt, mv) {
    const I = Input;
    const sx = G.cam.sx(this.x), sy = G.cam.sy(this.y);
    if (I.device === 'kb') {
      const mx = I.mouse.x / G.scale, my = I.mouse.y / G.scale;
      this.aimAng = Math.atan2(my - sy, mx - sx);
      this.aimDist = clamp(Math.hypot(mx - sx, my - sy), 14, this.W && this.W.range ? this.W.range : 200);
    } else {
      const a = I.aimVec();
      if (a.m > 0.3) { this.aimAng = Math.atan2(a.y, a.x); this.aimDist = lerp(this.aimDist, 40 + a.m * 70, dt * 5); }
      else if (!this.aiming) this.aimAng = this.riding ? this.riding.ang : this.ang;
      // nişan yardımı
      if (this.aiming) {
        const cone = this.deadeye ? 0.7 : 0.3;
        let best = null, bs = cone;
        for (const e of G.ents) {
          if (e.dead || e === this.riding || e.kind === 'horse' && e.owner === 'player') continue;
          if (e.kind === 'npc' && !e.hostile && !this.deadeye) continue;
          const d = dist(this.x, this.y, e.x, e.y);
          if (d > (this.W.range || 200) || d < 8) continue;
          const da = Math.abs(angDiff(this.aimAng, Math.atan2(e.y - this.y, e.x - this.x)));
          if (da < bs) { bs = da; best = e; }
        }
        if (best) {
          const ta = Math.atan2(best.y - this.y, best.x - this.x);
          this.aimAng = turnTo(this.aimAng, ta, dt * (this.deadeye ? 12 : 3.5));
          this.aimDist = lerp(this.aimDist, dist(this.x, this.y, best.x, best.y), dt * 6);
          this.lockTarget = best;
        } else this.lockTarget = null;
      }
    }
  }
  updateFoot(dt, mv, age) {
    const I = Input;
    let speed = 58;
    const wantSprint = I.down('sprint') && mv.m > 0.2 && !this.aiming;
    if (mv.m > 0 && mv.m < 0.55 && !mv.kb) speed = 32;
    if (this.crouch) speed = 26;
    this.sprinting = false;
    if (wantSprint && this.sta > 1 && !this.crouch) {
      speed = 88; this.sprinting = true;
      this.sta -= dt * 16 * (this.energy < 20 ? 1.5 : 1);
      if (this.sta < 0) this.sta = 0;
    } else {
      const regen = 14 * (this.energy < 15 ? 0.4 : 1) * (G.coldness > 0.5 ? 0.5 : 1);
      this.sta = Math.min(this.maxSta, this.sta + dt * regen);
    }
    if (this.aiming) speed = Math.min(speed, 32);
    if (age > 60) speed *= 1 - Math.min(0.25, (age - 60) * 0.012);
    if (this.hp < this.maxHp * 0.2) speed *= 0.85;
    speed *= this.slow();
    if (this.reloadT > 0) speed *= 0.8;
    let dx = mv.x * mv.m, dy = mv.y * mv.m;
    if (this.drunk > 20) { const w = Math.sin(G.t * 2.3) * this.drunk / 100; const c = Math.cos(w), s = Math.sin(w); const nx = dx * c - dy * s; dy = dx * s + dy * c; dx = nx; }
    this.move(dx * speed * dt, dy * speed * dt);
    this.mv = mv.m * speed / 58;
    if (mv.m > 0.1) {
      this.phase += dt * speed * 0.2;
      if (!this.aiming) this.ang = turnTo(this.ang, Math.atan2(mv.y, mv.x), dt * 12);
      this.stepT -= dt * speed;
      if (this.stepT <= 0) {
        this.stepT = 22;
        Audio_.step(this.crouch ? 0.03 : this.sprinting ? 0.09 : 0.05);
        const t = G.world.tileAtPx(this.x, this.y);
        if (t === T.WATER || t === T.HOTWATER) G.parts.add('splash', this.x, this.y + 2, 0, 0, 0.5, 4);
        else if ((t === T.DESERT || t === T.SAND || t === T.ROAD || t === T.DRY) && this.sprinting) G.parts.add('dust', this.x, this.y + 3, rnd(-5, 5), rnd(-5, 5), 0.6, 2);
        if (t === T.MUD || t === T.SWAMP) this.clean = Math.max(0, this.clean - 0.3);
      }
    }
    if (this.aiming) this.ang = this.aimAng;
  }
  updateRiding(dt, mv) {
    const I = Input, h = this.riding;
    if (h.dead) { this.dismount(true); return; }
    const B = h.def;
    let target = 0;
    const riding = G.skill('riding');
    const sBonus = 1 + riding * 0.02;
    if (mv.m > 0.1) {
      const want = Math.atan2(mv.y, mv.x);
      const tr = (h.spd > 130 ? 2.4 : 3.6) * dt;
      h.ang = turnTo(h.ang, want, tr);
      const align = Math.max(0, Math.cos(angDiff(h.ang, want)));
      if (I.down('sprint') && h.sta > 2) {
        target = 165 * B.spd * sBonus;
        h.sta -= dt * 9 * (G.hasPerk('rider') ? 0.75 : 1) * (1 - riding * 0.03);
        if (h.sta < 0) h.sta = 0;
        this.galloping = true;
      } else {
        this.galloping = false;
        target = (mv.m > 0.6 || mv.kb) ? 95 * B.spd : mv.m > 0.25 ? 60 : 36;
        h.sta = Math.min(h.maxSta, h.sta + dt * 4);
      }
      target *= 0.4 + 0.6 * align;
    } else { this.galloping = false; h.sta = Math.min(h.maxSta, h.sta + dt * 7); }
    if (this.aiming) target = Math.min(target, 70);
    if (h.sta < 5) target = Math.min(target, 60);
    const acc = target > h.spd ? 90 : 180;
    h.spd += clamp(target - h.spd, -acc * dt, acc * dt);
    const t = G.world.tileAtPx(h.x, h.y);
    const sl = t === T.WATER ? 0.6 : t === T.SWAMP || t === T.MUD ? 0.8 : t === T.SNOW ? 0.85 : (t === T.ROAD ? 1.05 : 1);
    const vx = Math.cos(h.ang) * h.spd * sl * dt, vy = Math.sin(h.ang) * h.spd * sl * dt;
    const ox = h.x, oy = h.y;
    h.move(vx, vy);
    const actual = dist(ox, oy, h.x, h.y);
    if (actual < Math.hypot(vx, vy) * 0.3 && h.spd > 100) { h.spd *= 0.3; G.fx.shake = 3; Audio_.thud(0.3); }
    h.mv = h.spd / 60;
    h.phase += dt * (3 + h.spd * 0.1);
    if (h.spd > 40) {
      this.stepT -= dt * h.spd;
      if (this.stepT <= 0) { this.stepT = 26; Audio_.step(0.07 + h.spd / 2500, true); if (t === T.DESERT || t === T.DRY || t === T.ROAD || t === T.SAND) G.parts.add('dust', h.x - Math.cos(h.ang) * 9, h.y - Math.sin(h.ang) * 9, rnd(-8, 8), rnd(-8, 8), 0.7, 2.5); if (t === T.WATER) G.parts.add('splash', h.x, h.y, 0, 0, 0.5, 5); }
    }
    // atla çarpma (NPC ve hayvanlara)
    if (h.spd > 110) {
      for (const e of G.ents) {
        if (e.dead || e === h || e.kind === 'horse') continue;
        if (dist2(e.x, e.y, h.x + Math.cos(h.ang) * 8, h.y + Math.sin(h.ang) * 8) < 100) {
          if (e.kind === 'npc') { e.hurt(18, 'player', 'trample'); e.x += Math.cos(h.ang) * 10; e.y += Math.sin(h.ang) * 10; }
          else if (e.kind === 'animal') e.hurt(12, 'player');
        }
      }
    }
    this.x = h.x; this.y = h.y; this.ang = this.aiming ? this.aimAng : h.ang;
    this.mv = 0;
  }
  /* ---- savaş ---- */
  updateCombat(dt) {
    const I = Input, Wp = this.W;
    if (I.pressed('reload')) this.startReload();
    if (Wp.melee) {
      if ((I.pressed('melee') || (I.pressed('fire') && !this.riding)) && this.meleeCd <= 0) this.melee();
      return;
    }
    if (I.pressed('melee') && this.meleeCd <= 0 && !this.riding) { this.melee(true); return; }
    if (Wp.throw) {
      if (I.pressed('fire') && this.fireCd <= 0) this.throwDynamite();
      return;
    }
    if (this.weapon === 'bow') {
      if (I.down('fire') && this.reloadT <= 0 && this.ammo.arrow > 0) this.draw_ = Math.min(1, this.draw_ + dt * 1.4);
      else if (I.released('fire') && this.draw_ > 0.15) { this.shootBow(); this.draw_ = 0; }
      else if (!I.down('fire')) this.draw_ = 0;
      return;
    }
    if (I.pressed('fire') && this.fireCd <= 0 && this.reloadT <= 0) this.shoot();
  }
  startReload() {
    const Wp = this.W;
    if (!Wp.clip || this.reloadT > 0) return;
    const have = this.ammo[Wp.ammo];
    if ((this.clip[this.weapon] || 0) >= Wp.clip || have <= 0) return;
    let t = Wp.reload * (G.hasPerk('gunslinger') ? 0.75 : 1);
    this.reloadT = t;
    Audio_.tone(900, 0.05, 'square', 0.04); Audio_.tone(700, 0.05, 'square', 0.04, null, t * 0.6);
  }
  finishReload() {
    const Wp = this.W;
    if (!Wp.clip) return;
    const need = Wp.clip - (this.clip[this.weapon] || 0);
    const take = Math.min(need, this.ammo[Wp.ammo]);
    this.ammo[Wp.ammo] -= take;
    this.clip[this.weapon] = (this.clip[this.weapon] || 0) + take;
  }
  shoot() {
    const Wp = this.W;
    const c = this.clip[this.weapon] || 0;
    if (c <= 0) { if (this.ammo[Wp.ammo] > 0) this.startReload(); else { Audio_.tone(1200, 0.03, 'square', 0.05); UI.feed('Mermin kalmadı!', 'warn'); } this.fireCd = 0.3; return; }
    this.clip[this.weapon] = c - 1;
    this.fireCd = Wp.rate;
    const lvl = G.skill('shooting');
    let spread = Wp.spread * (1 - lvl * 0.05) * (this.aiming ? 1 : 2.6) * (this.riding && this.riding.spd > 60 ? 1.8 : 1) * (this.drunk > 30 ? 1.8 : 1);
    if (this.deadeye) spread *= 0.1;
    const n = Wp.pellets || 1;
    const ox = this.x + Math.cos(this.aimAng) * 8, oy = this.y + Math.sin(this.aimAng) * 8;
    for (let i = 0; i < n; i++) {
      const a = this.aimAng + (Math.random() - 0.5) * spread * 2;
      G.fireRay(ox, oy, a, Wp.range, Wp.dmg * (1 + lvl * 0.03), this, { weapon: this.weapon });
    }
    G.parts.add('flash', ox, oy, 0, 0, 0.06, 4);
    G.parts.add('smoke', ox, oy, Math.cos(this.aimAng) * 20, Math.sin(this.aimAng) * 20, 0.8, 2);
    G.fx.shake = Math.max(G.fx.shake, Wp.kind === 'long' ? 2.2 : 1.4);
    G.fx.muzzle = 0.06;
    Audio_.shot(this.weapon === 'rifle' ? 'rifle' : this.weapon === 'shotgun' ? 'shotgun' : 'pistol', 0.9);
    G.noise(this.x, this.y, 620, 'gun');
    G.skillXp('shooting', 0.6);
    if ((this.clip[this.weapon] || 0) <= 0 && this.ammo[Wp.ammo] > 0) this.startReload();
  }
  shootBow() {
    if (this.ammo.arrow <= 0) return;
    this.ammo.arrow--;
    this.fireCd = 0.5;
    const lvl = G.skill('shooting');
    const spread = 0.03 * (1 - lvl * 0.05) * (this.deadeye ? 0.1 : 1);
    const a = this.aimAng + (Math.random() - 0.5) * spread;
    const sp = 260 + 260 * this.draw_;
    G.projs.push({ type: 'arrow', x: this.x + Math.cos(a) * 8, y: this.y + Math.sin(a) * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4, dmg: WEAPONS.bow.dmg * (0.4 + 0.6 * this.draw_), owner: this, ang: a });
    Audio_.shot('bow', 0.6);
    G.noise(this.x, this.y, 50, 'bow');
    G.skillXp('shooting', 0.5);
  }
  throwDynamite() {
    if (!this.has('dynamite')) { UI.feed('Dinamitin yok.', 'warn'); return; }
    this.removeItem('dynamite', 1);
    this.fireCd = 1;
    const d = Math.min(this.aimDist, 140), a = this.aimAng;
    G.projs.push({ type: 'dynamite', x: this.x, y: this.y, sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * d, ty: this.y + Math.sin(a) * d, t: 0, dur: 0.8, fuse: 2.4, owner: this });
    Audio_.tone(200, 0.2, 'sine', 0.1);
    if (!this.has('dynamite')) { this.weapon = 'fists'; }
  }
  melee(bash) {
    this.meleeCd = 0.5;
    this.swing = 1;
    const Wp = bash ? WEAPONS.fists : this.W;
    let dmg = (bash ? 14 : Wp.dmg) * (1 + G.skill('strength') * 0.05) * (G.hasPerk('arm') ? 1.3 : 1);
    const reach = (Wp.range || 14) + 4;
    let hitAny = false;
    const ang = this.aiming ? this.aimAng : this.ang;
    for (const e of G.ents) {
      if (e.dead || e === this.riding || e.kind === 'horse' && e.owner === 'player') continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > reach + (e.r || 4)) continue;
      const da = Math.abs(angDiff(ang, Math.atan2(e.y - this.y, e.x - this.x)));
      if (da > 1.1) continue;
      if (e.hurt) e.hurt(dmg, 'player', this.weapon === 'knife' && !bash ? 'knife' : 'melee');
      e.x += Math.cos(ang) * 5; e.y += Math.sin(ang) * 5;
      hitAny = true;
      break;
    }
    Audio_.tone(300, 0.06, 'sine', 0.05, null, 0, 120);
    if (hitAny) { Audio_.thud(0.5); G.fx.shake = 2; G.skillXp('strength', 1); }
    this.sta = Math.max(0, this.sta - 5);
  }
  draw(ctx) {
    if (this.riding) {
      Spr.human(ctx, this.x - Math.cos(this.riding.ang) * 1, this.y - Math.sin(this.riding.ang) * 1, this.ang, this.lookNow(), { riding: true, aim: this.aiming, wk: this.aimKind(), draw: this.draw_ });
      return;
    }
    Spr.human(ctx, this.x, this.y, this.ang, this.lookNow(), {
      walk: this.phase, mv: Math.min(1, this.mv), aim: this.aiming || this.swing > 0.2, wk: this.aimKind(), crouch: this.crouch, swing: this.swing, draw: this.draw_,
      hasGun: this.weapons.has('cattleman') || this.weapons.has('schofield'), backGun: this.weapons.has('repeater') || this.weapons.has('winchester') || this.weapons.has('rifle') || this.weapons.has('shotgun'),
    });
  }
  aimKind() {
    const w = this.W;
    if (!w) return null;
    if (w.melee) return this.weapon === 'knife' ? 'knife' : 'fists';
    if (w.throw) return 'throw';
    return w.kind;
  }
  lookNow() {
    const age = G.age;
    const L = this.look;
    if (!this._lk || this._lkAge !== age || this._lkCoat !== this.coat || this._lkHat !== L.hat) {
      const grey = clamp((age - 42) / 30, 0, 1);
      const coat = this.coat ? ITEMS[this.coat].coat : null;
      this._lk = Object.assign({}, L, { hairNow: grey > 0 ? mixHex(L.hair, '#d8d4cc', grey) : L.hair, coat: coat && coat.col ? coat.col : L.coat, coatLen: coat ? coat.len : 0 });
      this._lkAge = age; this._lkCoat = this.coat; this._lkHat = L.hat;
    }
    return this._lk;
  }
}

/* ---------------- Hayvan ---------------- */
class Animal extends Ent {
  constructor(x, y, type) {
    super(x, y);
    this.kind = 'animal';
    this.type = type;
    this.def = ANIMALS[type];
    this.hp = this.maxHp = this.def.hp;
    this.r = Math.max(2.5, this.def.wid * 0.45);
    this.male = Math.random() < 0.5;
    this.state = 'idle';
    this.t = rnd(1, 4);
    this.spd = 0;
    this.ang = Math.random() * TAU;
    this.atkCd = 0;
    this.deadT = 0;
    this.skinned = false;
    if (this.def.shape === 'horse') this.look = { col: pick(HORSE_BREEDS.mustang.cols) };
  }
  hurt(dmg, by, how) {
    if (this.dead) return;
    this.hp -= dmg;
    G.parts.burst('blood', this.x, this.y, 3 + dmg / 15, 35, 0.5, 1.4);
    if (this.def.shape === 'bird') G.parts.burst('feather', this.x, this.y, 5, 30, 1, 1, this.def.col);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.state = 'dead'; this.deadT = 0; this.mv = 0;
      if (by === 'player') G.onAnimalKill(this, how);
      return;
    }
    if (this.def.beh === 'flee' || this.def.beh === 'passive') { this.state = 'flee'; this.t = rnd(5, 9); this.fleeFrom(G.player); }
    else { this.state = 'attack'; this.t = 20; }
    if (this.def.owned && by === 'player') G.crime('livestockHurt', this.x, this.y);
  }
  fleeFrom(e) { this.ang = Math.atan2(this.y - e.y, this.x - e.x) + rnd(-0.4, 0.4); }
  update(dt) {
    if (this.dead) { this.deadT += dt; return; }
    const P = G.player, d = this.def;
    const pd = dist(this.x, this.y, P.x, P.y);
    this.t -= dt; this.atkCd -= dt;
    let sense = d.sense * (P.crouch ? 0.5 : 1) * (P.sprinting ? 1.3 : 1) * (P.riding ? 1.2 : 1) * (G.hasPerk('hunt100') ? 0.7 : 1) * (1 - G.skill('hunting') * 0.03);
    if (G.isNight) sense *= 0.8;
    if (this.state === 'idle' || this.state === 'wander') {
      if (d.beh === 'hostile' && pd < d.aggro * (G.isNight && d.night ? 1.3 : 1)) { this.state = 'attack'; this.t = 25; if (this.type === 'bear' || this.type === 'wolf' || this.type === 'cougar') Audio_.growl(); }
      else if (d.beh === 'skittish' && pd < d.aggro && (P.hp < P.maxHp * 0.35 || G.isNight)) { this.state = 'attack'; this.t = 12; }
      else if ((d.beh === 'flee' || d.beh === 'skittish') && pd < sense) { this.state = 'flee'; this.t = rnd(5, 9); this.fleeFrom(P); }
      else if (d.beh === 'passive' && pd < 20) { this.state = 'flee'; this.t = 2; this.fleeFrom(P); }
      else if (this.t <= 0) {
        if (this.state === 'idle') { this.state = 'wander'; this.t = rnd(2, 5); this.ang += rnd(-1.5, 1.5); if (this.leader && !this.leader.dead) this.ang = Math.atan2(this.leader.y - this.y, this.leader.x - this.x) + rnd(-0.6, 0.6); if (this.home && dist(this.x, this.y, this.home.x, this.home.y) > this.home.r) this.ang = Math.atan2(this.home.y - this.y, this.home.x - this.x); }
        else { this.state = 'idle'; this.t = rnd(2, 6); }
      }
    }
    let target = 0;
    if (this.state === 'wander') target = d.spd * 0.25;
    else if (this.state === 'flee') {
      target = d.spd;
      if (this.t <= 0) { this.state = 'idle'; this.t = 2; }
      if (pd < sense * 1.2 && pd > 1) this.ang = turnTo(this.ang, Math.atan2(this.y - P.y, this.x - P.x), dt * 3);
    } else if (this.state === 'attack') {
      const tgt = P;
      const a = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      this.ang = turnTo(this.ang, a, dt * 5);
      target = d.spd * 0.95;
      if (pd < this.r + 9) {
        target = 0;
        if (this.atkCd <= 0) {
          this.atkCd = 1.1;
          P.hurt(d.dmg * (G.difficulty === 'hard' ? 1.2 : 1), this.type);
          if (d.venom && !G.player.riding) { P.poison = Math.max(P.poison, 90); UI.help('Yılan soktu! Zehirlendin. <b>Panzehir</b> ya da <b>Yılan Yağı</b> kullan.', 6); }
          if (this.type === 'bear' || this.type === 'wolf' || this.type === 'cougar' || this.type === 'gator') Audio_.growl();
        }
      }
      if (this.t <= 0 || pd > 420) { this.state = 'idle'; this.t = 3; }
      if (d.beh === 'skittish' && this.hp < this.maxHp * 0.5) { this.state = 'flee'; this.t = 8; this.fleeFrom(P); }
    }
    this.spd = lerp(this.spd, target, dt * 4);
    if (this.spd > 0.5) {
      const vx = Math.cos(this.ang) * this.spd * dt, vy = Math.sin(this.ang) * this.spd * dt;
      const W = G.world;
      const nt = W.tileAtPx(this.x + vx * 4, this.y + vy * 4);
      if ((nt === T.DEEP || (nt === T.WATER && this.type !== 'gator' && this.state !== 'attack')) || !this.move(vx, vy)) {
        this.ang += (Math.random() < 0.5 ? -1 : 1) * rnd(0.8, 2);
      }
    }
    this.mv = this.spd / 30;
    this.phase += dt * (2 + this.spd * 0.18);
  }
  draw(ctx) { Spr.animal(ctx, this); }
}

/* ---------------- NPC ---------------- */
class NPC extends Ent {
  constructor(x, y, role, opts = {}) {
    super(x, y);
    this.kind = 'npc';
    this.role = role;
    this.look = opts.look || randomLook(opts.sex);
    this.sex = this.look.sex;
    this.name = opts.name || randomName(this.sex);
    this.r = 3.6;
    this.hp = this.maxHp = opts.hp || (role === 'law' ? 110 : role === 'bandit' ? 90 : 70);
    this.hostile = !!opts.hostile;
    this.weapon = opts.weapon || (role === 'law' ? pick(['cattleman', 'repeater']) : role === 'bandit' ? pick(['cattleman', 'cattleman', 'repeater', 'shotgun']) : null);
    this.state = opts.state || 'idle';
    this.t = rnd(1, 3);
    this.spd = 0;
    this.home = opts.home || null;
    this.cool = rnd(1, 2);
    this.strafe = 1; this.strafeT = 0;
    this.money = opts.money !== undefined ? opts.money : rnd(0.5, 8);
    this.looted = false;
    this.mounted = opts.mounted ? { col: pick(HORSE_BREEDS.mustang.cols), mane: '#1a1410', blanket: '#5a4a3a' } : null;
    this.path = opts.path || null; this.pi = opts.pi || 0; this.pdir = opts.pdir || 1;
    this.event = opts.event || null;
    this.panic = 0;
    Object.assign(this, opts.extra || {});
  }
  get isLaw() { return this.role === 'law'; }
  hurt(dmg, by, how) {
    if (this.dead) return;
    this.hp -= dmg;
    G.parts.burst('blood', this.x, this.y, 3 + dmg / 12, 35, 0.6, 1.4);
    if (by === 'player') {
      if (!this.hostile && this.role !== 'bandit') {
        if (this.hp > 0 && !this.assaulted) { this.assaulted = true; G.crime(this.isLaw ? 'assaultLaw' : 'assault', this.x, this.y, this); }
      }
      if (this.isLaw) this.hostile = true;
      if (this.role === 'bandit' || this.role === 'target') this.hostile = true;
      if (!this.hostile && this.hp > 0) { this.state = 'flee'; this.t = 10; this.say(pick(LINES.flee)); }
    }
    if (this.mounted && (dmg > 25 || this.hp <= 0)) {
      const h = new Horse(this.x + 6, this.y, 'mustang', { look: this.mounted, owner: 'npc' });
      h.state = 'flee'; h.t = 6; h.ang = Math.random() * TAU;
      G.addEnt(h);
      this.mounted = null;
    }
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.state = 'dead'; this.deadT = 0;
      if (by === 'player') G.onNpcKill(this, how);
      else if (this.event && this.event.onDeath) this.event.onDeath(this);
    }
  }
  say(text, dur = 3) {
    const d = dist(this.x, this.y, G.player.x, G.player.y);
    if (d < 180) UI.subtitle(this.name, text, dur);
  }
  canSee(tx, ty, range) {
    const d = dist(this.x, this.y, tx, ty);
    if (d > range) return false;
    return G.los(this.x, this.y, tx, ty);
  }
  update(dt) {
    if (this.dead) { this.deadT = (this.deadT || 0) + dt; return; }
    this.t -= dt; this.cool -= dt;
    const P = G.player;
    const pd = dist(this.x, this.y, P.x, P.y);
    if (this.isLaw && !this.hostile && G.law.level > 0 && this.canSee(P.x, P.y, 260)) { this.hostile = true; this.say(pick(LINES.law)); }
    if (this.isLaw && this.hostile && G.law.level === 0 && !this.personal) { this.hostile = false; this.state = 'idle'; }
    if (this.hostile && P.hp > 0) {
      if (this.role === 'bandit' && pd > 520 && !this.aggro) { this.idleUpdate(dt, pd); return; }
      if (this.role === 'bandit' || this.role === 'target') {
        if (!this.aggro && (pd < 240 || this.hp < this.maxHp)) { this.aggro = true; this.say(pick(LINES.bandit)); }
        if (!this.aggro) { this.idleUpdate(dt, pd); return; }
      }
      this.fight(dt, pd);
      return;
    }
    if (this.state === 'flee') {
      const a = Math.atan2(this.y - P.y, this.x - P.x);
      this.ang = turnTo(this.ang, a, dt * 4);
      this.walk(dt, this.mounted ? 140 : 80);
      if (this.t <= 0) { this.state = 'idle'; this.t = 2; }
      return;
    }
    if (this.state === 'cower' || this.state === 'hurt' || this.state === 'sit' || this.state === 'static') {
      this.mv = 0;
      if (this.state === 'static' && pd < 60) this.ang = turnTo(this.ang, Math.atan2(P.y - this.y, P.x - this.x), dt * 3);
      return;
    }
    if (this.state === 'robbed') { this.mv = 0; if (this.t <= 0) { this.state = 'flee'; this.t = 8; } return; }
    if (this.state === 'fightFist') { this.fistFight(dt, pd); return; }
    this.idleUpdate(dt, pd);
  }
  idleUpdate(dt, pd) {
    const P = G.player;
    if (this.path) {
      const pt = this.path[this.pi];
      if (!pt) { this.remove = true; return; }
      const a = Math.atan2(pt[1] - this.y, pt[0] - this.x);
      this.ang = turnTo(this.ang, a, dt * 3);
      this.walk(dt, this.mounted ? 70 : 30);
      if (dist(this.x, this.y, pt[0], pt[1]) < 10) { this.pi += this.pdir; if (this.pi < 0 || this.pi >= this.path.length) this.remove = true; }
      if (this.stuck > 2) { this.x = pt[0]; this.y = pt[1]; this.stuck = 0; }
      return;
    }
    if (this.state === 'walk') {
      const tg = this.target;
      const a = Math.atan2(tg.y - this.y, tg.x - this.x);
      this.ang = turnTo(this.ang, a, dt * 4);
      this.walk(dt, 28);
      if (dist(this.x, this.y, tg.x, tg.y) < 8 || this.t <= 0 || this.stuck > 1.5) { this.state = 'idle'; this.t = rnd(2, 8); this.stuck = 0; }
    } else {
      this.mv = 0; this.spd = 0;
      if (pd < 40 && !this.hostile) this.ang = turnTo(this.ang, Math.atan2(P.y - this.y, P.x - this.x), dt * 3);
      if (this.t <= 0 && this.home) {
        const h = this.home;
        let tx, ty, tries = 0;
        do { tx = h.x + rnd(-h.r, h.r); ty = h.y + rnd(-h.r * 0.6, h.r * 0.6); tries++; } while (G.world.blocked(tx, ty, 4) && tries < 8);
        this.target = { x: tx, y: ty }; this.state = 'walk'; this.t = 15;
      }
    }
  }
  walk(dt, sp) {
    const ox = this.x, oy = this.y;
    const s = sp * this.slow();
    this.move(Math.cos(this.ang) * s * dt, Math.sin(this.ang) * s * dt);
    const moved = dist(ox, oy, this.x, this.y);
    if (moved < s * dt * 0.3) { this.stuck = (this.stuck || 0) + dt; this.ang += rnd(-1.5, 1.5) * dt * 4; } else this.stuck = 0;
    this.mv = moved / Math.max(0.001, dt) / 50;
    this.phase += dt * sp * 0.2;
  }
  fight(dt, pd) {
    const P = G.player;
    const a = Math.atan2(P.y - this.y, P.x - this.x);
    this.ang = turnTo(this.ang, a, dt * 6);
    const pref = this.weapon === 'shotgun' ? 60 : this.mounted ? 110 : 120;
    let mx = 0, my = 0;
    if (pd > pref + 50) { mx = Math.cos(a); my = Math.sin(a); }
    else if (pd < pref - 40) { mx = -Math.cos(a); my = -Math.sin(a); }
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = chance(0.5) ? 1 : -1; this.strafeT = rnd(1, 2.5); }
    mx += -Math.sin(a) * 0.7 * this.strafe; my += Math.cos(a) * 0.7 * this.strafe;
    const l = Math.hypot(mx, my) || 1;
    const sp = (this.mounted ? 120 : 48) * this.slow();
    const ox = this.x, oy = this.y;
    this.move(mx / l * sp * dt, my / l * sp * dt);
    if (dist(ox, oy, this.x, this.y) < sp * dt * 0.2) this.strafe *= -1;
    this.mv = 1; this.phase += dt * 10;
    const W = WEAPONS[this.weapon] || WEAPONS.cattleman;
    if (this.cool <= 0 && pd < W.range * 0.85) {
      if (!G.los(this.x, this.y, P.x, P.y)) { this.cool = 0.4; return; }
      this.cool = W.rate * rnd(3, 5.5) + (this.isLaw ? 0 : 0.3);
      const acc = (this.isLaw ? 0.08 : 0.11) + (P.sprinting || (P.riding && P.riding.spd > 80) ? 0.07 : 0) + (P.crouch ? 0.03 : 0);
      const n = W.pellets ? 4 : 1;
      const dmg = this.weapon === 'shotgun' ? 7 : this.weapon === 'repeater' ? 13 : this.weapon === 'rifle' ? 22 : 11;
      for (let i = 0; i < n; i++) G.fireRay(this.x + Math.cos(this.ang) * 7, this.y + Math.sin(this.ang) * 7, this.ang + rnd(-acc, acc), W.range, dmg * (G.difficulty === 'hard' ? 1.25 : 1), this, { npc: true });
      G.parts.add('flash', this.x + Math.cos(this.ang) * 8, this.y + Math.sin(this.ang) * 8, 0, 0, 0.06, 3.5);
      Audio_.shot(this.weapon === 'shotgun' ? 'shotgun' : 'pistol', clamp(1 - pd / 700, 0.1, 0.8));
      if (chance(0.15)) this.say(pick(this.isLaw ? LINES.law : LINES.bandit), 2);
    }
  }
  fistFight(dt, pd) {
    const P = G.player;
    const a = Math.atan2(P.y - this.y, P.x - this.x);
    this.ang = turnTo(this.ang, a, dt * 6);
    if (pd > 14) this.walk(dt, 50);
    else if (this.cool <= 0) { this.cool = rnd(0.8, 1.4); this.swing = 1; P.hurt(rndi(5, 9), 'fist'); Audio_.thud(0.4); }
    if (this.swing > 0) this.swing -= dt * 4;
    if (this.hp < this.maxHp * 0.4) { this.state = 'flee'; this.t = 8; this.say('Tamam, tamam! Yeter!'); G.addHonor(-1); }
    if (pd > 250) this.state = 'idle';
  }
  draw(ctx) {
    if (this.mounted && !this.dead) {
      Spr.horse(ctx, this.x, this.y, this.ang, this.mounted, { phase: this.phase, mv: this.mv, saddle: true });
      Spr.human(ctx, this.x, this.y, this.ang, this.look, { riding: true, aim: this.hostile && this.aggro !== false, wk: this.weapon ? WEAPONS[this.weapon].kind : null });
      return;
    }
    if (this.state === 'hurt' && !this.dead) {
      Spr.human(ctx, this.x, this.y, this.ang, this.look, { dead: true });
      return;
    }
    Spr.human(ctx, this.x, this.y, this.ang, this.look, {
      walk: this.phase, mv: Math.min(1, this.mv), dead: this.dead, crouch: this.state === 'cower',
      aim: (this.hostile && (this.aggro || this.isLaw) && !!this.weapon) || this.state === 'robbing', wk: this.weapon ? WEAPONS[this.weapon].kind : (this.state === 'fightFist' ? 'fists' : null),
      swing: this.swing > 0 ? this.swing : 0, hasGun: !!this.weapon,
    });
  }
}

/* ---------------- Tren ---------------- */
class Train {
  constructor(line, idx) {
    this.line = line;
    this.s = line.stops[Math.min(idx, line.stops.length - 1)].d + 1;
    this.dir = 1;
    this.spd = 0;
    this.wait = rnd(2, 10);
    this.cars = ['loco', 'tender', 'pass', 'pass', 'freight', 'freight'];
    this.gap = 29;
    this.smokeT = 0;
    this.pos = [];
    this.nextStop = null;
    this.whistleT = 0;
  }
  at(s) {
    const L = this.line, pts = L.pts, cum = L.cum;
    s = clamp(s, 0, L.len);
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1, f = (s - cum[lo]) / seg;
    const [ax, ay] = pts[lo], [bx, by] = pts[hi];
    return [lerp(ax, bx, f), lerp(ay, by, f), Math.atan2(by - ay, bx - ax)];
  }
  update(dt) {
    const L = this.line;
    const maxS = 95;
    if (this.wait > 0) {
      this.wait -= dt; this.spd = 0;
      if (this.wait <= 0) {
        if (this.s >= L.len - 5) this.dir = -1; else if (this.s <= 5) this.dir = 1;
        this.whistleT = 1;
        if (dist(G.player.x, G.player.y, this.pos[0] ? this.pos[0][0] : 0, this.pos[0] ? this.pos[0][1] : 0) < 600) Audio_.train();
      }
    } else {
      // sonraki istasyon
      let next = null;
      for (const st of L.stops) {
        const ds = (st.d - this.s) * this.dir;
        if (ds > 2 && (!next || ds < (next.d - this.s) * this.dir)) next = st;
      }
      const toStop = next ? Math.abs(next.d - this.s) : 1e9;
      const target = toStop < 160 ? Math.max(8, toStop * 0.6) : maxS;
      this.spd = lerp(this.spd, target, dt * 0.6);
      this.s += this.spd * this.dir * dt;
      if (next && toStop < 3) { this.s = next.d; this.wait = 12; this.stopAt = next.town; }
      if (this.s <= 0) { this.s = 0; this.wait = 12; this.dir = 1; }
      if (this.s >= L.len) { this.s = L.len; this.wait = 12; this.dir = -1; }
    }
    // vagon konumları (lokomotif hareket yönünde önde)
    this.pos.length = 0;
    for (let i = 0; i < this.cars.length; i++) {
      const s = this.s - this.dir * i * this.gap;
      const p = this.at(s);
      if (this.dir < 0) p[2] += Math.PI;
      this.pos.push(p);
    }
    this.smokeT -= dt;
    if (this.smokeT <= 0 && this.pos[0]) {
      this.smokeT = this.spd > 20 ? 0.08 : 0.35;
      const [x, y, a] = this.pos[0];
      const P = G.player;
      if (Math.abs(x - P.x) < 700 && Math.abs(y - P.y) < 500) G.parts.add('smoke', x + Math.cos(a) * 9, y + Math.sin(a) * 9 - 6, rnd(-6, 6) - Math.cos(a) * this.spd * 0.3, -12 - Math.sin(a) * this.spd * 0.3, 2.2, 3, '60,58,56');
    }
    // çarpışma
    if (this.spd > 15) {
      const P = G.player;
      for (const [x, y] of this.pos) {
        if (dist2(x, y, P.x, P.y) < 13 * 13) { P.hurt(60, 'train'); const a = Math.atan2(P.y - y, P.x - x); P.x += Math.cos(a) * 20; P.y += Math.sin(a) * 20; if (P.riding) { P.riding.x = P.x; P.riding.y = P.y; } }
        for (const e of G.ents) if (!e.dead && dist2(x, y, e.x, e.y) < 12 * 12 && e.hurt) e.hurt(200, null);
      }
    }
  }
  draw(ctx, x0, y0, x1, y1) {
    for (let i = this.pos.length - 1; i >= 0; i--) {
      const [x, y, a] = this.pos[i];
      if (x < x0 - 40 || x > x1 + 40 || y < y0 - 40 || y > y1 + 40) continue;
      Spr.trainCar(ctx, x, y, a, this.cars[i], G.t);
    }
  }
}

/* ---------------- Kamp ---------------- */
class Camp extends Ent {
  constructor(x, y) { super(x, y); this.kind = 'camp'; this.r = 0; }
  update() {}
  draw(ctx) {
    const x = this.x, y = this.y;
    Spr.shadow(ctx, x + 18, y - 4, 9, 4, 0.25);
    ctx.fillStyle = '#b8a880'; ctx.beginPath(); ctx.moveTo(x + 8, y - 2); ctx.lineTo(x + 16, y - 16); ctx.lineTo(x + 24, y - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#98885e'; ctx.beginPath(); ctx.moveTo(x + 16, y - 16); ctx.lineTo(x + 24, y - 2); ctx.lineTo(x + 18, y - 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4424'; ctx.fillRect(x - 16, y + 2, 10, 4);
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; Spr.circ(ctx, x + Math.cos(a) * 4.5, y + Math.sin(a) * 3.5, 1.4, '#6a6660'); }
    Spr.line(ctx, x - 3, y - 1, x + 3, y + 1, '#4a3222', 1.8); Spr.line(ctx, x - 3, y + 1, x + 3, y - 1, '#4a3222', 1.8);
    Spr.fire(ctx, x, y, G.t, 1);
  }
}
