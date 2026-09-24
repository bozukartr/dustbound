'use strict';
/* ==========================================================
   DUSTBOUND — oyun çekirdeği: durum, döngü, render, kayıt
   ========================================================== */

const SAVE_KEY = 'dustbound_save_v1';
const SET_KEY = 'dustbound_settings_v1';

const G = {
  state: 'boot',
  world: null, player: null, horse: null, ents: [], projs: [], trains: [],
  parts: new Particles(),
  t: 0, timeScale: 1, uiBlocksMove: false, wheelOpen: false,
  fx: { flash: 0, shake: 0, muzzle: 0, boom: 0, lightning: 0 },
  cam: { x: 0, y: 0, ox: 0, oy: 0, sx(x) { return x - G.cam.ox; }, sy(y) { return y - G.cam.oy; } },
  scale: 3, vw: 640, vh: 360,
  settings: { master: 0.8, music: 0.5, sfx: 0.8, amb: 0.6, zoom: 0, fps: false, shake: true },
  timers: { spawn: 0, disc: 0, ach: 0, fire: 0, amb: 0, gps: 0, hud: 0, radar: 0 },
  coldness: 0, hotness: 0, feltTemp: 20, nearFire: false,

  resetState() {
    this.ents = []; this.projs = []; this.trains = []; this.parts = new Particles();
    this.clock = 8 * 60; this.pace = 'normal'; this.difficulty = 'story';
    this.weather = { type: 'clear', t: 180, i: 0, cloud: 0, fogI: 0 };
    this.law = { level: 0, bounty: 0, lastX: 0, lastY: 0, unseen: 0, spawnT: 0, radius: 0, maskBounty: 0, masked: false, desc: null };
    this.reports = []; this.nomads = null;
    this.honor = 0; this.bank = 0; this.scars = 0;
    this.stats = { animals: 0, bears: 0, discoveries: 0, towns: 0, rideMiles: 0, walkMiles: 0, eaten: 0, herbs: 0, fish: 0, longKills: 0, bandits: 0, kills: 0, maxCash: 0, earned: 0, shifts: 0, helped: 0, maxBounty: 0, maxHonor: 0, minHonor: 0, properties: 0, married: 0, children: 0, bjWins: 0, armWins: 0, hoursDesert: 0, hoursCold: 0, nuggets: 0, collectibles: 0, tamed: 0, camps: 0, treasures: 0, trainRides: 0, deadeyes: 0, age: START_AGE };
    this.skills = {}; for (const k in SKILLS) this.skills[k] = { lv: 1, xp: 0 };
    this.achieved = {};
    this.visited = new Set(); this.discovered = new Set(); this.rumored = new Set();
    this.props = []; this.family = { spouse: null, children: [] }; this.romances = {}; this.stable = [];
    this.campCleared = {}; this.chestsOpened = {}; this.graves = {}; this.dailyTalk = {}; this.lostItems = []; this.events = [];
    this.treasure = null; this.activeBounty = null; this.bounties = null; this.stash = {};
    this.waypoint = null; this.gps = null; this.camp = null; this.horse = null;
    this.reveal = new Uint8Array(65536);
    this.travelT = 10; this.eventT = 90;
    this.amb = { birds: [], tumbles: [], flies: [] };
    this.curTown = null; this.curRegion = null; this.goalReached = false; this.hints = {};
  },

  init() {
    this.canvas = $('#game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.light = makeCanvas(16, 16); this.lctx = this.light.getContext('2d');
    this.over = makeCanvas(16, 16); this.octx = this.over.getContext('2d');
    this.fogCanvas = makeCanvas(256, 256); this.fogCtx = this.fogCanvas.getContext('2d', { willReadFrequently: true });
    // ışık sprite'ı
    this.lightSpr = makeCanvas(64, 64);
    const lc = this.lightSpr.getContext('2d');
    const g = lc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    lc.fillStyle = g; lc.fillRect(0, 0, 64, 64);
    this.glowSpr = makeCanvas(64, 64);
    const gc = this.glowSpr.getContext('2d');
    const g2 = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g2.addColorStop(0, 'rgba(255,190,90,0.55)'); g2.addColorStop(1, 'rgba(255,150,60,0)');
    gc.fillStyle = g2; gc.fillRect(0, 0, 64, 64);
    this.holeSpr = makeCanvas(64, 64);
    const hc = this.holeSpr.getContext('2d');
    const g3 = hc.createRadialGradient(32, 32, 10, 32, 32, 32);
    g3.addColorStop(0, 'rgba(0,0,0,0.75)'); g3.addColorStop(1, 'rgba(0,0,0,0)');
    hc.fillStyle = g3; hc.fillRect(0, 0, 64, 64);
    this.rain = []; for (let i = 0; i < 220; i++) this.rain.push({ x: Math.random(), y: Math.random(), s: rnd(0.7, 1.3) });
    this.loadSettings();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },
  loadSettings() {
    try { const s = JSON.parse(localStorage.getItem(SET_KEY)); if (s) Object.assign(this.settings, s); } catch (e) {}
    Input.setBinds(this.settings.binds);
    this.applySettings();
  },
  saveSettings() {
    this.settings.binds = JSON.parse(JSON.stringify(Input.binds));
    try { localStorage.setItem(SET_KEY, JSON.stringify(this.settings)); } catch (e) {}
    this.applySettings();
  },
  applySettings() {
    const S = this.settings;
    Object.assign(Audio_.vol, { master: S.master, music: S.music, sfx: S.sfx, amb: S.amb });
    Audio_.applyVolumes();
    $('#fps') && $('#fps').classList.toggle('hidden', !S.fps);
    this.resize();
  },
  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    let s = this.settings.zoom || Math.max(2, Math.round(H / 270));
    if (W / s < 320) s = Math.max(1, Math.floor(W / 320));
    this.scale = s;
    this.vw = Math.ceil(W / s); this.vh = Math.ceil(H / s);
    const c = this.canvas;
    c.width = this.vw; c.height = this.vh;
    c.style.width = this.vw * s + 'px'; c.style.height = this.vh * s + 'px';
    this.light.width = this.vw; this.light.height = this.vh;
    this.over.width = this.vw; this.over.height = this.vh;
    this.ctx.imageSmoothingEnabled = false;
  },

  /* ---------------- Yeni oyun ---------------- */
  async newGame(profile) {
    this.resetState();
    const seed = (Math.random() * 1e9) | 0;
    this.seed = seed;
    this.pace = profile.pace; this.difficulty = profile.difficulty; this.background = profile.bg;
    this.profile = profile;
    await this.buildWorld(seed);
    const BG = BACKGROUNDS.find(b => b.id === profile.bg);
    const town = this.world.towns.find(t => t.id === BG.town);
    const sx = town.spawn.x, sy = town.spawn.y;
    const P = this.player = new Player(sx, sy, profile);
    P.money = BG.money;
    for (const k in BG.skills) this.skills[k].lv += BG.skills[k];
    for (const id in BG.items) P.addItem(id, BG.items[id], true);
    for (const w of BG.weapons) P.giveWeapon(w, true);
    for (const a in BG.ammo) P.ammo[a] = BG.ammo[a];
    if (BG.weapons.includes('cattleman')) P.weapon = 'fists';
    if (BG.bounty) this.law.bounty = BG.bounty;
    if (BG.honor) this.honor = BG.honor;
    if (P.has('coat_sheep')) P.coat = 'coat_sheep';
    const hat = profile.look.hat;
    if (hat !== 'none') P.inv['hat_' + hat] = 1;
    if (BG.horse) {
      const h = new Horse(sx + 20, sy + 10, BG.horse, { owner: 'player', name: pick(HORSE_NAMES) });
      this.setHorse(h, true);
    }
    this.initRomances();
    this.rebuildFog();
    this.revealAt(town.cx, town.cy, 1000);
    this.visited.add(town.id);
    // kasabaya varış sinematiği (5 geçmişe özel, geçilebilir)
    try { await Cinema.play(profile.bg, { look: profile.look, seed }); } catch (e) { console.warn(e); }
    this.unlock('begin');
    this.startPlay();
    setTimeout(() => {
      UI.help(`<b>${P.name}</b>, 18 yaşındasın ve yıl ${START_YEAR}. Hedefin: <b>80 yaşına kadar hayatta kalmak.</b><br>Aç kalma, susuz kalma, uykusuz kalma. Avlan, çalış, keşfet.`, 12);
      setTimeout(() => UI.help(`${Input.glyph('map')} Harita &nbsp; ${Input.glyph('satchel')} Çanta &nbsp; ${Input.glyph('journal')} Günlük &nbsp; ${Input.glyph('wheel')} Silah Çarkı &nbsp; ${Input.glyph('pause')} Duraklat`, 10), 13000);
    }, 1200);
    this.saveGame(true);
  },
  initRomances() {
    const R = new RNG(this.seed + 900);
    this.world.towns.forEach((t, i) => {
      const sex = i % 2 ? 'm' : 'f';
      const look = randomLook(sex, R);
      look.hat = sex === 'f' ? R.pick(['none', 'wide', 'bowler']) : R.pick(['cowboy', 'bowler', 'none']);
      this.romances[t.id] = { id: 'rom_' + t.id, name: R.pick(NAMES[sex]) + ' ' + R.pick(NAMES.last), sex, look, rel: 0 };
    });
  },
  async buildWorld(seed) {
    UI.showLoading(true);
    const w = new World(seed);
    await w.generate((msg, p) => UI.loading(msg, p));
    World.initTables(seed);
    this.world = w;
    w.doorFn = (b) => this.doorOpen(b);
    this.insideB = null;
    this.trains = w.lines.map((l, i) => new Train(l, i));
    UI.loading('Hazır.', 1);
  },
  startPlay() {
    this.state = 'play';
    UI.showLoading(false);
    UI.hideScreens();
    $('#hud').classList.remove('hidden');
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.world.setSeason(this.season);
    // görünür chunk'ları önceden üret
    this.prefetch(true);
    Audio_.playMusic('explore');
    this.curTown = null;
  },

  /* ---------------- Kayıt ---------------- */
  saveGame(silent) {
    if (!this.player || this.state === 'dead') return;
    const P = this.player;
    const enc = (arr) => { let s = ''; for (let i = 0; i < arr.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (arr[i + k]) b |= 1 << k; s += String.fromCharCode(b); } return btoa(s); };
    const h = this.horse;
    const data = {
      v: 1, seed: this.seed, clock: this.clock, pace: this.pace, difficulty: this.difficulty, background: this.background,
      profile: this.profile,
      player: { x: P.x, y: P.y, name: P.name, look: P.look, inv: P.inv, weapons: [...P.weapons], ammo: P.ammo, clip: P.clip, weapon: P.weapon, money: P.money, hp: P.hp, sta: P.sta, de: P.de, hunger: P.hunger, thirst: P.thirst, energy: P.energy, clean: P.clean, deCore: P.deCore, sick: P.sick, canteen: P.canteen, coat: P.coat, mask: P.masked ? P.mask : null, lastMask: P.lastMask || null, lantern: P.lantern, riding: !!P.riding },
      horse: h ? { breed: h.breed, name: h.name, look: h.look, hp: h.hp, bond: h.bond, x: h.x, y: h.y, dead: h.dead } : null,
      weather: this.weather, law: this.law, honor: this.honor, bank: this.bank, scars: this.scars, stats: this.stats, skills: this.skills, achieved: this.achieved,
      visited: [...this.visited], discovered: [...this.discovered], rumored: [...this.rumored], props: this.props, family: this.family, romances: this.romances, stable: this.stable,
      campCleared: this.campCleared, chestsOpened: this.chestsOpened, graves: this.graves, harvested: [...this.world.harvested], treasure: this.treasure, activeBounty: this.activeBounty, stash: this.stash,
      reveal: enc(this.reveal), goalReached: this.goalReached, hints: this.hints, savedAt: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (!silent) UI.feed('💾 Oyun kaydedildi');
    } catch (e) { UI.feed('Kayıt başarısız: ' + e.message, 'warn'); }
  },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  saveInfo() {
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!d) return null; const dpy = (LIFE_PACES.find(p => p.id === d.pace) || LIFE_PACES[1]).dpy; return { name: d.player.name, age: START_AGE + Math.floor(Math.floor(d.clock / 1440) / dpy), money: d.player.money, bg: d.background }; } catch (e) { return null; }
  },
  deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} },
  async loadGame() {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    if (!d) return false;
    this.resetState();
    this.seed = d.seed;
    await this.buildWorld(d.seed);
    Object.assign(this, { clock: d.clock, pace: d.pace, difficulty: d.difficulty, background: d.background, profile: d.profile, honor: d.honor, bank: d.bank, scars: d.scars || 0, goalReached: d.goalReached });
    Object.assign(this.weather, d.weather); Object.assign(this.law, d.law); this.law.level = 0; this.law.maskBounty = 0; this.law.masked = false;
    Object.assign(this.stats, d.stats); Object.assign(this.skills, d.skills); this.achieved = d.achieved || {};
    this.visited = new Set(d.visited); this.discovered = new Set(d.discovered); this.rumored = new Set(d.rumored || []);
    this.props = d.props || []; this.family = d.family || { spouse: null, children: [] }; this.romances = d.romances || {}; this.stable = d.stable || [];
    this.campCleared = d.campCleared || {}; this.chestsOpened = d.chestsOpened || {}; this.graves = d.graves || {}; this.treasure = d.treasure; this.activeBounty = d.activeBounty; this.stash = d.stash || {};
    if (this.activeBounty) this.activeBounty.spawned = false;
    this.hints = d.hints || {};
    this.world.harvested = new Map(d.harvested || []);
    for (const b of this.world.buildings) if (b.prop && this.props.includes(b.prop)) b.owned = true;
    const bin = atob(d.reveal);
    for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); for (let k = 0; k < 8; k++) this.reveal[i * 8 + k] = (b >> k) & 1; }
    this.rebuildFog();
    const p = d.player;
    const P = this.player = new Player(p.x, p.y, { name: p.name, look: p.look });
    Object.assign(P, { inv: p.inv, ammo: p.ammo, clip: p.clip, weapon: p.weapon, money: p.money, hp: p.hp, sta: p.sta, de: p.de, hunger: p.hunger, thirst: p.thirst, energy: p.energy, clean: p.clean, deCore: p.deCore, sick: p.sick, canteen: p.canteen, coat: p.coat, mask: p.mask || null, lastMask: p.lastMask || null, lantern: p.lantern });
    P.weapons = new Set(p.weapons);
    // eski kayıtlar: kasaba düzeni değiştiyse duvarın içinde başlama
    if (this.world.blocked(P.x, P.y, 4)) { const t = this.nearestTown(P.x, P.y); P.x = t.spawn.x; P.y = t.spawn.y; }
    if (!this.romances || !Object.keys(this.romances).length) this.initRomances();
    if (d.horse) {
      const h = new Horse(d.horse.x, d.horse.y, d.horse.breed, { owner: 'player', name: d.horse.name, look: d.horse.look, bond: d.horse.bond, hp: d.horse.hp });
      h.dead = d.horse.dead;
      this.setHorse(h, true);
      if (p.riding && !h.dead) { h.x = P.x; h.y = P.y; P.mount(h); }
    }
    this.startPlay();
    UI.feed('Kayıt yüklendi. Hoş geldin, ' + P.name + '.');
    return true;
  },

  /* ---------------- Döngü ---------------- */
  frame(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    Input.poll(dt);
    if (this.state !== 'play') Audio_.pianoLevel = 0;
    Audio_.update(dt);
    try {
      if (this.state === 'play' || this.state === 'dead') this.update(dt);
      UI.update(dt);
      if (this.world && this.player && (this.state === 'play' || this.state === 'dead')) this.render(dt);
      else if (this.state === 'menu') UI.menuBg(dt);
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; UI.feed('Hata: ' + e.message, 'warn'); }
    }
    Input.endFrame();
    if (this.settings.fps) { this._fc = (this._fc || 0) + 1; this._ft = (this._ft || 0) + dt; if (this._ft > 0.5) { $('#fps').textContent = Math.round(this._fc / this._ft) + ' FPS'; this._fc = 0; this._ft = 0; } }
    requestAnimationFrame(t => this.frame(t));
  },
  update(dt) {
    const P = this.player, I = Input;
    const modal = UI.isModal() || UI.state === 'fade';
    this.uiBlocksMove = modal || this.state !== 'play';
    if (this.state === 'play' && !modal) this.handleGlobalInput(dt);
    if (modal) { this.updateCamera(dt); return; }
    let ts = 1;
    if (this.wheelOpen) ts = 0.2;
    if (P.deadeye) ts = 0.35;
    this.timeScale = ts;
    const sdt = dt * ts;
    this.t += dt;
    if (this.state === 'play') P.update(sdt);
    for (const e of this.ents) if (e !== P) e.update(sdt);
    this.updateProjectiles(sdt);
    this.ambientLife(sdt);
    for (const tr of this.trains) tr.update(sdt);
    this.parts.update(sdt);
    if (this.state !== 'play') { this.updateCamera(dt); return; }
    const dmin = sdt * MIN_PER_SEC;
    this.advanceClock(dmin);
    this.weatherUpdate(dmin);
    this.survivalUpdate(dmin, false);
    // dead eye
    if (P.deadeye) {
      P.de -= dt * 18 * (this.hasPerk('longshot') ? 0.75 : 1);
      if (P.de <= 0 || !P.aiming) { P.de = Math.max(0, P.de); P.deadeye = false; Audio_.tone(300, 0.3, 'sine', 0.08, null, 0, 150); }
    } else P.de = Math.min(100, P.de + dt * (0.6 + P.deCore / 60));
    if (P.poison > 0) { P.poison -= dt; P.hurt(dt * 1.6, 'zehir', true); }
    P.hp = Math.min(P.hp, P.maxHp);
    this.lawUpdate(dt);
    this.witnessUpdate(dt);
    const ib = this.world.buildingAtPx(P.x, P.y);
    if (ib !== this.insideB) {
      if (ib && (!this.insideB || this.insideB !== ib)) {
        UI.feed(`${Icons.glyph('door', '#efe6d2', 'ic inl')} ${ib.name}`); Audio_.tone(180, 0.06, 'triangle', 0.05);
        this.hintOnce('indoor', `Binaların içinde dolaşabilirsin. Tezgahtaki çalışanla, yataklarla, masalarla ve diğer eşyalarla ${Input.glyph('interact')} ile etkileşime geç. Dükkanlar gece kapanır.`);
      }
      this.insideB = ib;
    }
    const T_ = this.timers;
    T_.spawn -= dt; if (T_.spawn <= 0) { T_.spawn = 1; this.spawnTick(); }
    T_.disc -= dt; if (T_.disc <= 0) { T_.disc = 0.4; this.discoverUpdate(); }
    T_.ach -= dt; if (T_.ach <= 0) { T_.ach = 1; this.checkAchievements(); }
    T_.fire -= dt; if (T_.fire <= 0) { T_.fire = 0.5; this.checkFire(); if (this.t > 30) this.hintTick(); }
    T_.gps -= dt; if (T_.gps <= 0 && this.waypoint) { T_.gps = 5; if (dist(P.x, P.y, this.waypoint.x, this.waypoint.y) < 40) { this.setWaypoint(null); UI.feed('📍 Hedefe ulaştın'); } else this.computeGps(); }
    T_.amb -= dt;
    if (T_.amb <= 0) {
      T_.amb = 0.25;
      const env = this.envCache = this.localWeather(P.x, P.y);
      const b = this.world.biomeAt(P.x, P.y);
      Audio_.ambientTick({ rain: env.rain, wind: Math.max(env.dust, env.snow * 0.6, env.storm ? 0.6 : 0.12), fire: this.nearFire ? 1 : 0, water: this.world.nearWater(P.x, P.y, 40) ? 1 : 0, night: this.isNight, nature: b === 'FOREST' || b === 'GRASS' || b === 'SWAMP' ? 1 : 0.4, wolves: b === 'FOREST' || b === 'SNOW' });
      if (env.storm && Math.random() < 0.02) { this.fx.lightning = 1; Audio_.thunder(); }
      // piyano dosyası yüklenemezse eski prosedürel piyano
      if (Audio_.tr && Audio_.tr.piano && Audio_.tr.piano.failed && Audio_.pianoLevel > 0.02) {
        const scale = [262, 294, 330, 392, 440, 523, 587, 659], v = 0.12 * Audio_.pianoLevel;
        if (Math.random() < 0.7) Audio_.pluck(pick(scale), v);
        if (Math.random() < 0.3) Audio_.pluck(pick(scale) / 2, v * 1.2);
      }
    }
    this.saloonAudio();
    this.updateCamera(dt);
  },
  /* Saloon piyanosu: içeride tam, dışarıda kapıya yaklaştıkça yükselir; duvar arkasından boğuk */
  saloonAudio() {
    const P = this.player, W = this.world;
    let lvl = 0, muf = 1;
    for (const b of W.buildings) {
      if (b.type !== 'saloon' || !this.isOpen(b)) continue;
      if (Math.abs(b.door.x - P.x) > 420 || Math.abs(b.door.y - P.y) > 420) continue;
      if (this.insideB === b) { lvl = 1; muf = 0; break; }
      const dd = dist(P.x, P.y, b.door.x, b.door.y);
      const cx = (b.x + b.w / 2) * TS, cy = (b.y + b.h / 2) * TS;
      const dc = Math.max(0, dist(P.x, P.y, cx, cy) - b.w * 7);
      const k = clamp(1 - (dd - 18) / 250, 0, 1), door = k * k * (3 - 2 * k) * 0.6;
      const k2 = clamp(1 - dc / 150, 0, 1), wall = k2 * k2 * 0.22;
      const v = Math.max(door, wall);
      if (v > lvl) { lvl = v; muf = door >= wall ? 0.35 + 0.5 * clamp((dd - 18) / 200, 0, 1) : 1; }
    }
    Audio_.pianoLevel = lvl; Audio_.pianoMuffle = muf;
  },
  handleGlobalInput(dt) {
    const I = Input, P = this.player;
    // silah / eşya çarkı (açıkken diğer kısayollar çalışmaz)
    if (I.down('wheel')) { if (!this.wheelOpen) UI.openWheel(); this.wheelOpen = true; UI.updateWheel(); }
    else if (this.wheelOpen) { this.wheelOpen = false; UI.closeWheel(); }
    if (this.wheelOpen) return;
    if (I.pressed('pause')) { UI.openPause(); return; }
    if (I.pressed('map')) { UI.openMap(); return; }
    if (I.pressed('satchel')) { UI.openSatchel(); return; }
    if (I.pressed('journal')) { UI.openJournal(); return; }
    // dead eye
    if (I.pressed('deadeye')) {
      if (P.deadeye) { P.deadeye = false; }
      else if (P.aiming && P.isArmed && P.de > 12) { P.deadeye = true; this.stat('deadeyes', 1); Audio_.tone(120, 0.6, 'sine', 0.15, null, 0, 60); }
      else if (!P.aiming) UI.feed('Dead Eye için önce nişan al.', 'warn');
    }
    if (Input.mouse.wheel && Input.device === 'kb') this.cycleWeapon(Input.mouse.wheel > 0 ? 1 : -1);
    if (I.held('camp') > 0.7 && !this._campHeld) { this._campHeld = true; this.setupCamp(); }
    if (!I.down('camp')) this._campHeld = false;
    if (I.pressed('quick')) this.quickUse();
    UI.interactUpdate(dt);
  },
  cycleWeapon(d) {
    const P = this.player;
    const list = [];
    for (const s of WHEEL_SLOTS) { const w = s.w.find(id => P.weapons.has(id) || (id === 'dynamite' && P.has('dynamite'))); if (w) list.push(w); }
    if (!list.length) return;
    let i = list.indexOf(P.weapon);
    i = (i + d + list.length) % list.length;
    P.weapon = list[i]; P.reloadT = 0; P.draw_ = 0;
    Audio_.tone(700, 0.04, 'square', 0.04);
  },
  hintOnce(key, html, dur = 8) {
    this.hints = this.hints || {};
    if (this.hints[key]) return;
    this.hints[key] = 1;
    UI.help(html, dur);
  },
  hintTick() {
    const P = this.player, g = k => Input.glyph(k);
    if (P.hunger < 30) this.hintOnce('hunger', `Açıkıyorsun. ${g('satchel')} ile çantanı açıp yemek ye ya da ${g('quick')} ile hızlıca bir şeyler atıştır.`);
    else if (P.thirst < 30) this.hintOnce('thirst', `Susadın. Mataranı iç (${g('quick')}) ya da bir nehir/kuyu başında ${g('interact')} ile su iç.`);
    else if (P.energy < 25) this.hintOnce('sleep', `Yorgunsun. Bir otelde, evinde ya da kampta (${g('camp')} basılı tut) uyu.`);
    else if (this.coldness > 0.05) this.hintOnce('cold', 'Üşüyorsun! Kalın bir palto giy, ateş yak ya da sıcak bir şeyler iç. Terzilerden kürk alabilirsin.');
    else if (this.hotness > 0.05) this.hintOnce('hot', 'Sıcak çarpıyor! Daha sık su iç, geniş kenarlı şapka ya da keten gömlek giy.');
    else if (this.isNight) this.hintOnce('night', `Gece çöktü. ${g('lantern')} ile fenerini yak. Kurtlar gece daha tehlikelidir.`);
    else if (P.riding) this.hintOnce('ride', `${g('sprint')} basılı tutarak dörtnala koş. Atının dayanıklılığına dikkat et. ${g('interact')} ile in.`);
    else if (this.law.level > 0) this.hintOnce('law', 'Aranıyorsun! Radardaki kırmızı arama alanının dışına çık ve görünmeden bekle.');
    else if (!this.world.townAt(P.x, P.y, 60) && this.hour >= 17) this.hintOnce('camp', P.has('bedroll') ? `Akşam oluyor. Kasabadan uzaktaysan ${g('camp')} tuşunu basılı tutarak kamp kurabilirsin.` : `Vahşi doğada kamp kurmak için bir <b>Uyku Tulumu</b> gerekir (genel mağazada $8). Sonra ${g('camp')} tuşunu basılı tut.`, 10);
    else if (this.world.nearWater(P.x, P.y, 20)) this.hintOnce('water', `Su kenarındasın. ${g('interact')} ile su iç; basılı tutarak matara doldurma, yıkanma ve balık tutma seçeneklerine ulaş.`);
  },
  quickUse() {
    const P = this.player;
    if (P.hp < P.maxHp * 0.8) {
      for (const id of ['health_cure', 'herbal_tonic', 'bandage', 'cooked_big', 'cooked_game', 'cooked_fish', 'stew']) if (P.has(id)) { this.consume(id); return; }
    }
    if (P.thirst < 70 && P.canteen > 0) { this.drinkCanteen(); return; }
    if (P.hunger < 70) for (const id of ['cooked_game', 'cooked_big', 'beans', 'bread', 'jerky', 'cooked_fish', 'cooked_bird', 'peaches', 'apple', 'corn', 'berries']) if (P.has(id)) { this.consume(id); return; }
    if (P.sta < P.maxSta * 0.4) for (const id of ['stamina_tonic', 'chocolate', 'ginseng']) if (P.has(id)) { this.consume(id); return; }
    UI.feed('Hızlı kullanılacak bir şey yok.', 'warn');
  },
  /* Ortam canlıları: kuş sürüleri, çalı topları, ateşböcekleri */
  ambientLife(dt) {
    const A = this.amb, P = this.player, C = this.cam;
    if (!A) return;
    const env = this.envCache || { rain: 0, snow: 0 };
    const b = this.world.biomeAt(P.x, P.y);
    const x0 = C.ox, y0 = C.oy, vw = this.vw, vh = this.vh;
    if (!this.isNight && env.rain < 0.3 && A.birds.length < 12 && Math.random() < dt * 0.04) {
      const dir = Math.random() < 0.5 ? 1 : -1, n = rndi(4, 8);
      const sy = y0 + rnd(0, vh), sx = dir > 0 ? x0 - 60 : x0 + vw + 60, vy = rnd(-15, 15);
      for (let i = 0; i < n; i++) A.birds.push({ x: sx - dir * (i % 2 ? i : -i) * 3 - dir * i * 6, y: sy + (i % 2 ? 1 : -1) * i * 5, vx: dir * rnd(55, 70), vy, ph: Math.random() * 6 });
    }
    for (let i = A.birds.length - 1; i >= 0; i--) { const q = A.birds[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.ph += dt * 12; if (q.x < x0 - 200 || q.x > x0 + vw + 200) A.birds.splice(i, 1); }
    const dry = b === 'DESERT' || b === 'DRY' || b === 'REDROCK';
    if (dry && A.tumbles.length < 3 && Math.random() < dt * 0.12) {
      const dir = this.hour % 2 < 1 ? 1 : -1;
      A.tumbles.push({ x: dir > 0 ? x0 - 20 : x0 + vw + 20, y: y0 + rnd(20, vh - 20), vx: dir * rnd(35, 65) * (env.dust ? 2 : 1), r: rnd(3, 5.5), rot: 0, bt: 0 });
    }
    for (let i = A.tumbles.length - 1; i >= 0; i--) {
      const q = A.tumbles[i];
      q.x += q.vx * dt; q.rot += q.vx * dt / q.r; q.bt += dt * 6; q.y += Math.sin(q.bt * 0.7) * dt * 6;
      if (this.world.isSolidPx(q.x, q.y)) q.vx *= -0.6;
      if (q.x < x0 - 60 || q.x > x0 + vw + 60) A.tumbles.splice(i, 1);
    }
    if (this.isNight && this.season < 3 && (b === 'GRASS' || b === 'FOREST' || b === 'SWAMP') && A.flies.length < 34 && Math.random() < dt * 4) {
      A.flies.push({ x: x0 + rnd(0, vw), y: y0 + rnd(0, vh), vx: rnd(-6, 6), vy: rnd(-6, 6), t: 0, life: rnd(4, 9) });
    }
    for (let i = A.flies.length - 1; i >= 0; i--) { const q = A.flies[i]; q.t += dt; q.vx += rnd(-12, 12) * dt; q.vy += rnd(-12, 12) * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.t > q.life) A.flies.splice(i, 1); }
  },
  drawTumbles(ctx) {
    for (const q of this.amb.tumbles) {
      const hop = Math.abs(Math.sin(q.bt)) * 3;
      Spr.shadow(ctx, q.x + 1, q.y + q.r * 0.6, q.r, q.r * 0.4, 0.2);
      ctx.save(); ctx.translate(q.x, q.y - hop); ctx.rotate(q.rot);
      ctx.strokeStyle = '#9a7a4a'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, q.r, 0, TAU);
      for (let k = 0; k < 5; k++) { const a = k * 1.3; ctx.moveTo(Math.cos(a) * q.r, Math.sin(a) * q.r); ctx.lineTo(-Math.cos(a + 2) * q.r * 0.6, -Math.sin(a + 2) * q.r * 0.6); }
      ctx.stroke(); ctx.restore();
    }
  },
  drawBirds(ctx) {
    for (const q of this.amb.birds) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(q.x + 24, q.y + 36, 2, 1);
      const f = Math.sin(q.ph) * 2;
      ctx.strokeStyle = '#1a1614'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(q.x - 3, q.y - f); ctx.lineTo(q.x, q.y); ctx.lineTo(q.x + 3, q.y - f); ctx.stroke();
    }
  },
  drawFlies(ctx) {
    const x0 = this.cam.ox, y0 = this.cam.oy;
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.amb.flies) {
      const a = Math.max(0, Math.sin(q.t * 3 + q.life)) * Math.min(1, (q.life - q.t));
      if (a <= 0.05) continue;
      ctx.fillStyle = `rgba(200,255,120,${a * 0.25})`; ctx.beginPath(); ctx.arc(q.x - x0, q.y - y0, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(240,255,180,${a})`; ctx.fillRect(q.x - x0 - 0.5, q.y - y0 - 0.5, 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  checkFire() {
    const P = this.player, W = this.world;
    let near = false;
    if (this.camp && dist2(this.camp.x, this.camp.y, P.x, P.y) < 70 * 70) near = true;
    if (!near && this.nomads) for (const c of this.nomads) if (c.spawned && dist2(c.x, c.y, P.x, P.y) < 60 * 60) near = true;
    if (!near) {
      const tx = P.x >> 4, ty = P.y >> 4;
      for (let y = ty - 4; y <= ty + 4 && !near; y++) for (let x = tx - 4; x <= tx + 4; x++) if (W.inb(x, y) && W.obj[y * WW + x] === O.CAMPFIRE) { near = true; break; }
    }
    this.nearFire = near;
  },
  updateProjectiles(dt) {
    const L = this.projs;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      if (p.type === 'arrow') {
        p.life -= dt;
        const steps = 3;
        let done = false;
        for (let s = 0; s < steps && !done; s++) {
          p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
          if (this.world.isSolidPx(p.x, p.y) && !this.world.isWaterPx(p.x, p.y)) { done = true; break; }
          for (const e of this.ents) {
            if (e.dead || e === p.owner || e === this.player.riding || e.kind === 'camp' || e === this.horse) continue;
            if (dist2(e.x, e.y, p.x, p.y) < (e.r + 2) * (e.r + 2)) { e.hurt(p.dmg, 'player', 'arrow'); done = true; break; }
          }
        }
        if (done || p.life <= 0) L.splice(i, 1);
      } else if (p.type === 'dynamite') {
        p.t += dt; p.fuse -= dt;
        const f = Math.min(1, p.t / p.dur);
        p.x = lerp(p.sx, p.tx, f); p.y = lerp(p.sy, p.ty, f); p.z = Math.sin(f * Math.PI) * 20;
        if (Math.random() < 0.5) this.parts.add('spark', p.x, p.y - p.z, rnd(-10, 10), rnd(-20, 0), 0.3, 1);
        if (p.fuse <= 0) { this.explode(p.x, p.y, p.owner); L.splice(i, 1); }
      }
    }
  },
  updateCamera(dt) {
    const P = this.player, C = this.cam;
    let tx = P.x, ty = P.y;
    if (P.riding) { tx += Math.cos(P.riding.ang) * P.riding.spd * 0.45; ty += Math.sin(P.riding.ang) * P.riding.spd * 0.45; }
    if (P.aiming || P.rsAim) { const d = Math.min(P.aimDist, 90) * 0.45; tx += Math.cos(P.aimAng) * d; ty += Math.sin(P.aimAng) * d; }
    C.x = lerp(C.x, tx, Math.min(1, dt * 4));
    C.y = lerp(C.y, ty, Math.min(1, dt * 4));
    let sx = 0, sy = 0;
    if (this.fx.shake > 0 && this.settings.shake) { sx = rnd(-1, 1) * this.fx.shake; sy = rnd(-1, 1) * this.fx.shake; }
    this.fx.shake = Math.max(0, this.fx.shake - dt * 18);
    C.ox = Math.round(C.x - this.vw / 2 + sx);
    C.oy = Math.round(C.y - this.vh / 2 + sy);
  },
  prefetch(sync) {
    const W = this.world, C = this.cam;
    const x0 = C.ox, y0 = C.oy;
    const cx0 = Math.floor(x0 / CPX), cy0 = Math.floor(y0 / CPX), cx1 = Math.floor((x0 + this.vw) / CPX), cy1 = Math.floor((y0 + this.vh) / CPX);
    const NC = WW / CHUNK;
    if (sync) for (let cy = Math.max(0, cy0); cy <= Math.min(NC - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(NC - 1, cx1); cx++) W.getChunk(cx, cy, true);
    // hareket yönünde bir halka
    const P = this.player;
    const vx = P.riding ? Math.cos(P.riding.ang) : 0, vy = P.riding ? Math.sin(P.riding.ang) : 0;
    const ex = vx > 0.3 ? 2 : 1, wx = vx < -0.3 ? 2 : 1, ey = vy > 0.3 ? 2 : 1, ny = vy < -0.3 ? 2 : 1;
    for (let cy = cy0 - ny; cy <= cy1 + ey; cy++) for (let cx = cx0 - wx; cx <= cx1 + ex; cx++) W.getChunk(cx, cy, false);
  },

  /* ---------------- Render ---------------- */
  render(dt) {
    const ctx = this.ctx, W = this.world, P = this.player, C = this.cam;
    const vw = this.vw, vh = this.vh;
    const x0 = C.ox, y0 = C.oy, x1 = x0 + vw, y1 = y0 + vh;
    const cx0 = Math.floor(x0 / CPX), cy0 = Math.floor(y0 / CPX), cx1 = Math.floor(x1 / CPX), cy1 = Math.floor(y1 / CPX);
    const chunks = [];
    const NC = WW / CHUNK;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= NC || cy >= NC) { ctx.fillStyle = '#2c4b5e'; ctx.fillRect(cx * CPX - x0, cy * CPX - y0, CPX, CPX); continue; }
      const c = W.getChunk(cx, cy, true);
      chunks.push([c, cx * CPX - x0, cy * CPX - y0]);
      ctx.drawImage(c.g, cx * CPX - x0, cy * CPX - y0);
    }
    ctx.save();
    ctx.translate(-x0, -y0);
    // dinamik zemin öğeleri
    const tx0 = Math.max(0, (x0 >> 4) - 1), ty0 = Math.max(0, (y0 >> 4) - 1), tx1 = Math.min(WW - 1, (x1 >> 4) + 1), ty1 = Math.min(WH - 1, (y1 >> 4) + 1);
    const obj = W.obj, day = this.day, t = this.t;
    const fires = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      const row = ty * WW;
      for (let tx = tx0; tx <= tx1; tx++) {
        const o = obj[row + tx];
        if (!o) continue;
        if (o >= 20 && o <= 28) {
          if (W.season === 3 && W.snowyTile(tx, ty)) continue;
          const hv = W.harvested.get(row + tx);
          if (hv !== undefined && hv > day) continue;
          const near = dist2(tx * TS + 8, ty * TS + 8, P.x, P.y) < 60 * 60;
          Spr.herb(ctx, o, tx * TS + 8, ty * TS + 10, t, near);
        } else if (o === O.ARTIFACT) {
          const hv = W.harvested.get(row + tx);
          if (hv === undefined) Spr.sparkle(ctx, tx * TS + 8, ty * TS + 8, t + tx);
        } else if (o === O.CAMPFIRE) { Spr.fire(ctx, tx * TS + 8, ty * TS + 8, t); fires.push([tx * TS + 8, ty * TS + 8]); if (Math.random() < 0.1) this.parts.add('ember', tx * TS + 8, ty * TS + 4, 0, -10, 1, 1); if (Math.random() < 0.05) this.parts.add('smoke', tx * TS + 8, ty * TS, rnd(-3, 3), -8, 2, 2); }
        else if (o === O.STEAM) { if (Math.random() < 0.3) this.parts.add('steam', tx * TS + rnd(-40, 56), ty * TS + rnd(-40, 56), rnd(-4, 4), -6, 2.5, 3); }
      }
    }
    for (const L of this.lostItems) Spr.sparkle(ctx, L.x, L.y, t * 1.3);
    for (const ev of this.events) if (ev.wagon && dist2(ev.wagon.x, ev.wagon.y, P.x, P.y) < 800 * 800) Spr.object(ctx, ctx, O.WAGON, ev.wagon.x - 6, ev.wagon.y, 0.9, W);
    if (this.treasure && P.has('treasure_map') && dist2(this.treasure.x, this.treasure.y, P.x, P.y) < 120 * 120) { ctx.fillStyle = 'rgba(90,60,30,0.6)'; ctx.beginPath(); ctx.ellipse(this.treasure.x, this.treasure.y, 6, 4, 0, 0, TAU); ctx.fill(); }
    // trenler
    for (const tr of this.trains) tr.draw(ctx, x0, y0, x1, y1);
    this.drawTumbles(ctx);
    // varlıklar
    const vis = [];
    for (const e of this.ents) if (e.x > x0 - 40 && e.x < x1 + 40 && e.y > y0 - 40 && e.y < y1 + 40 && !(e.kind === 'horse' && e.rider === P)) vis.push(e);
    if (P.riding) vis.push(P.riding);
    vis.push(P);
    vis.sort((a, b) => (a.y + (a.dead ? -20 : 0)) - (b.y + (b.dead ? -20 : 0)));
    for (const e of vis) {
      if (e === P && P.riding) continue;
      if (e.kind === 'horse' && e.rider === P) { e.draw(ctx); P.draw(ctx); continue; }
      if (e.child) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(0.7, 0.7); ctx.translate(-e.x, -e.y); e.draw(ctx); ctx.restore(); continue; }
      e.draw(ctx);
    }
    // mermiler
    for (const p of this.projs) {
      if (p.type === 'arrow') { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.ang) * 7, p.y - Math.sin(p.ang) * 7); ctx.stroke(); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(p.x - Math.cos(p.ang) * 7 - 1, p.y - Math.sin(p.ang) * 7 - 1, 2, 2); }
      else if (p.type === 'dynamite') { Spr.shadow(ctx, p.x, p.y + 2, 3, 1.5, 0.3); ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.t * 12); ctx.fillStyle = '#b02a20'; ctx.fillRect(-3, -1, 6, 2.4); ctx.restore(); }
    }
    this.parts.draw(ctx, x0, y0, x1, y1);
    this.drawCovers(ctx, x0, y0, x1, y1, dt);
    ctx.restore();
    // üst katman (ağaç tepeleri, çatılar)
    const under = this.playerUnderCanopy();
    if (under) {
      const oc = this.octx;
      oc.clearRect(0, 0, vw, vh);
      for (const [c, x, y] of chunks) oc.drawImage(c.o, x, y);
      oc.globalCompositeOperation = 'destination-out';
      const px = P.x - x0, py = P.y - y0 - 4;
      oc.drawImage(this.holeSpr, px - 34, py - 34, 68, 68);
      oc.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.over, 0, 0);
    } else for (const [c, x, y] of chunks) ctx.drawImage(c.o, x, y);
    // dünya uzayı arayüz öğeleri
    ctx.save();
    ctx.translate(-x0, -y0);
    this.drawBirds(ctx);
    this.drawWorldUI(ctx);
    ctx.restore();
    this.drawWeather(ctx, dt);
    this.drawLighting(ctx, fires);
    if (this.amb.flies.length) this.drawFlies(ctx);
    // flaşlar
    if (this.fx.lightning > 0) { ctx.fillStyle = `rgba(230,235,255,${this.fx.lightning * 0.6})`; ctx.fillRect(0, 0, vw, vh); this.fx.lightning = Math.max(0, this.fx.lightning - dt * 3); }
    if (this.fx.boom > 0) { ctx.fillStyle = `rgba(255,220,160,${this.fx.boom})`; ctx.fillRect(0, 0, vw, vh); this.fx.boom = Math.max(0, this.fx.boom - dt * 2); }
    this.fx.flash = Math.max(0, this.fx.flash - dt * 1.5);
    this.fx.muzzle = Math.max(0, this.fx.muzzle - dt);
    // sonraki chunk'lar
    this.prefetch(false);
    W.runJobs(4);
  },
  /* Bina cepheleri ve çatıları: içerideyken ya da arkasındayken soluklaşır */
  drawCovers(ctx, x0, y0, x1, y1, dt) {
    const W = this.world, P = this.player, IB = this.insideB;
    const k = Math.min(1, dt * 7);
    for (const b of W.buildings) {
      const bx = b.x * TS, by = b.y * TS, bw = b.w * TS, bh = b.h * TS;
      if (bx + bw + 50 < x0 || bx - 50 > x1 || by + bh + 30 < y0 || by - 80 > y1) continue;
      let target = 1;
      if (b === IB) target = 0;
      else if (P.x > bx - 6 && P.x < bx + bw + 6 && P.y > by - 34 && P.y < by + bh - (b.def.tall ? 30 : 22)) target = 0.4;
      b.coverA = b.coverA === undefined ? target : b.coverA + (target - b.coverA) * k;
      if (b.coverA < 0.02) continue;
      const c = Spr.cover(b, W);
      ctx.globalAlpha = b.coverA;
      ctx.drawImage(c.c, c.x, c.y);
    }
    ctx.globalAlpha = 1;
  },
  playerUnderCanopy() {
    const P = this.player, W = this.world;
    const tx = P.x >> 4, ty = P.y >> 4;
    for (let y = ty; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      if (!W.inb(x, y)) continue;
      const o = W.obj[y * WW + x];
      if (o === O.PINE || o === O.OAK || o === O.BIRCH || o === O.CYPRESS || o === O.SNOWPINE || o === O.APPLE || o === O.SEQUOIA || o === O.SAGUARO || o === O.WELL || o === O.SIGN || o === O.LAMP) return true;
    }
    for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) { if (W.inb(x, y) && W.obj[y * WW + x] === O.SEQUOIA) return true; }
    return false;
  },
  drawWorldUI(ctx) {
    const P = this.player;
    // etkileşim hedefi
    const it = UI.curInteract;
    if (it && !it.riding) {
      const b = Math.sin(this.t * 5) * 1.5;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.moveTo(it.x - 3, it.y - 16 + b); ctx.lineTo(it.x + 3, it.y - 16 + b); ctx.lineTo(it.x, it.y - 12 + b); ctx.fill();
    }
    // nişangah
    if (P.aiming || (P.rsAim && P.isArmed) || (Input.device === 'kb' && P.isArmed && this.state === 'play' && !UI.isModal())) {
      const d = (P.aiming || P.rsAim) ? P.aimDist : Math.min(P.aimDist, 60);
      const rx = P.x + Math.cos(P.aimAng) * d, ry = P.y + Math.sin(P.aimAng) * d;
      let enemy = false;
      for (const e of this.ents) if (!e.dead && (e.kind === 'animal' || e.kind === 'npc') && dist2(e.x, e.y, rx, ry) < 64) { enemy = true; break; }
      const col = P.deadeye ? '#e03020' : enemy ? '#ff5040' : 'rgba(255,255,255,0.9)';
      ctx.fillStyle = col;
      if (P.aiming || P.rsAim) {
        const sp = P.W && P.W.spread ? P.W.spread * d * (P.deadeye ? 0.2 : 1) * (P.aiming ? 1 : 1.7) + 2 : 3;
        ctx.fillRect(rx - 0.5, ry - 0.5, 1, 1);
        ctx.fillRect(rx - sp - 2, ry - 0.5, 2, 1); ctx.fillRect(rx + sp, ry - 0.5, 2, 1);
        ctx.fillRect(rx - 0.5, ry - sp - 2, 1, 2); ctx.fillRect(rx - 0.5, ry + sp, 1, 2);
        if (P.weapon === 'dynamite') { ctx.strokeStyle = 'rgba(255,200,100,0.6)'; ctx.beginPath(); ctx.arc(rx, ry, 20, 0, TAU); ctx.stroke(); }
      } else { ctx.globalAlpha = 0.5; ctx.fillRect(rx - 0.5, ry - 0.5, 1, 1); ctx.globalAlpha = 1; }
    }
    // waypoint oku (ekran dışı)
    if (this.waypoint) {
      const wp = this.waypoint;
      ctx.fillStyle = '#e8c860';
      if (Math.abs(wp.x - this.cam.x) < this.vw / 2 && Math.abs(wp.y - this.cam.y) < this.vh / 2) {
        ctx.beginPath(); ctx.moveTo(wp.x, wp.y); ctx.lineTo(wp.x - 4, wp.y - 8); ctx.lineTo(wp.x + 4, wp.y - 8); ctx.fill();
      }
    }
  },
  drawWeather(ctx, dt) {
    const env = this.envCache || { rain: 0, snow: 0, dust: 0, fog: 0, cloud: 0 };
    const vw = this.vw, vh = this.vh;
    if (env.cloud > 0.05) { ctx.fillStyle = `rgba(40,48,60,${env.cloud * 0.22})`; ctx.fillRect(0, 0, vw, vh); }
    if (this.insideB) return;
    const wind = env.storm ? 0.35 : 0.12;
    if (env.rain > 0.05) {
      ctx.strokeStyle = `rgba(190,205,225,${0.25 + env.rain * 0.35})`; ctx.lineWidth = 1;
      ctx.beginPath();
      const n = Math.floor(this.rain.length * env.rain);
      for (let i = 0; i < n; i++) {
        const r = this.rain[i];
        r.y += dt * 1.6 * r.s; r.x += dt * wind * r.s;
        if (r.y > 1) { r.y -= 1; r.x = Math.random(); }
        if (r.x > 1) r.x -= 1;
        const x = r.x * vw, y = r.y * vh;
        ctx.moveTo(x, y); ctx.lineTo(x - wind * 10, y - 8 * r.s);
      }
      ctx.stroke();
    }
    if (env.snow > 0.05) {
      ctx.fillStyle = 'rgba(250,250,255,0.85)';
      const n = Math.floor(this.rain.length * env.snow * 0.7);
      for (let i = 0; i < n; i++) {
        const r = this.rain[i];
        r.y += dt * 0.12 * r.s; r.x += dt * (0.03 + Math.sin(this.t + i) * 0.03);
        if (r.y > 1) { r.y -= 1; r.x = Math.random(); }
        if (r.x > 1) r.x -= 1; if (r.x < 0) r.x += 1;
        ctx.fillRect(r.x * vw, r.y * vh, r.s > 1 ? 2 : 1, r.s > 1 ? 2 : 1);
      }
      ctx.fillStyle = `rgba(230,236,245,${env.snow * 0.18})`; ctx.fillRect(0, 0, vw, vh);
    }
    if (env.dust > 0.05) {
      ctx.fillStyle = `rgba(180,140,90,${env.dust * 0.45})`; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = `rgba(200,160,110,${env.dust * 0.5})`;
      for (let i = 0; i < 120; i++) { const r = this.rain[i]; r.x += dt * 0.6 * r.s; if (r.x > 1) { r.x -= 1; r.y = Math.random(); } ctx.fillRect(r.x * vw, r.y * vh, 3, 1); }
    }
    if (env.fog > 0.05) {
      const g = ctx.createRadialGradient(vw / 2, vh / 2, 30, vw / 2, vh / 2, Math.max(vw, vh) * 0.6);
      g.addColorStop(0, `rgba(215,220,225,${env.fog * 0.15})`); g.addColorStop(1, `rgba(215,220,225,${env.fog * 0.6})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    }
  },
  drawLighting(ctx, fires) {
    const dl = this.daylight;
    const h = this.hour;
    const vw = this.vw, vh = this.vh, x0 = this.cam.ox, y0 = this.cam.oy;
    // gün doğumu / batımı
    let warm = 0;
    if (h > 5 && h < 8) warm = 1 - Math.abs(h - 6.3) / 1.7;
    if (h > 18 && h < 21.5) warm = 1 - Math.abs(h - 19.6) / 1.9;
    if (warm > 0) { ctx.fillStyle = `rgba(255,120,40,${warm * 0.16})`; ctx.fillRect(0, 0, vw, vh); }
    const dark = (1 - dl) * 0.84 + (this.envCache ? this.envCache.cloud * 0.08 * dl : 0);
    if (dark < 0.03) return;
    const lc = this.lctx;
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = `rgba(6,10,28,${dark})`;
    lc.clearRect(0, 0, vw, vh);
    lc.fillRect(0, 0, vw, vh);
    lc.globalCompositeOperation = 'destination-out';
    const lights = [];
    const P = this.player;
    const inView = (x, y, r) => x + r > x0 && x - r < x0 + vw && y + r > y0 && y - r < y0 + vh;
    const night = dark > 0.35;
    for (const L of this.world.lights) {
      if (!inView(L.x, L.y, L.r)) continue;
      if (L.type === 'window' && (!night || hash2(L.x | 0, L.y | 0, this.day) < 0.25)) continue;
      if (L.type === 'lamp' && !night) continue;
      if (L.type === 'inner' && !(this.insideB && this.insideB.id === L.b)) continue;
      lights.push([L.x, L.y, L.r * (L.type === 'fire' ? 1 + Math.sin(this.t * 9) * 0.05 : 1), L.type === 'window' ? 0.75 : 1]);
    }
    for (const [x, y] of fires) lights.push([x, y, 80 + Math.sin(this.t * 11) * 4, 1]);
    if (this.camp) lights.push([this.camp.x, this.camp.y, 90 + Math.sin(this.t * 11) * 4, 1]);
    if (this.nomads) for (const c of this.nomads) if (c.spawned && inView(c.x, c.y, 100)) lights.push([c.x, c.y, 95 + Math.sin(this.t * 10) * 5, 1]);
    if (P.lantern && P.has('lantern')) lights.push([P.x + Math.cos(P.ang) * 6, P.y + Math.sin(P.ang) * 6, 100, 1]);
    else lights.push([P.x, P.y, 26, 0.35]);
    if (this.fx.muzzle > 0) lights.push([P.x, P.y, 90, this.fx.muzzle * 12]);
    for (const tr of this.trains) if (tr.pos[0]) { const [x, y, a] = tr.pos[0]; if (inView(x, y, 120)) lights.push([x + Math.cos(a) * 50, y + Math.sin(a) * 50, 70, 0.9]); }
    for (const [x, y, r, a] of lights) {
      lc.globalAlpha = Math.min(1, a);
      lc.drawImage(this.lightSpr, x - x0 - r, y - y0 - r, r * 2, r * 2);
    }
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.light, 0, 0);
    // sıcak parıltı
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, dark * 1.2);
    for (const [x, y, r] of lights) ctx.drawImage(this.glowSpr, x - x0 - r * 0.6, y - y0 - r * 0.6, r * 1.2, r * 1.2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  /* ---------------- Ölüm & yeniden doğma ---------------- */
  respawn() {
    const P = this.player;
    const t = this.nearestTown(P.x, P.y, t => t.buildings.some(b => b.type === 'doctor'));
    const doc = t.buildings.find(b => b.type === 'doctor');
    const lost = P.money * 0.25;
    P.money -= lost;
    this.scars = Math.min(30, (this.scars || 0) + 3);
    P.x = doc.door.x; P.y = doc.door.y + 10;
    if (P.riding) P.dismount();
    P.hp = P.maxHp * 0.6; P.hunger = Math.max(P.hunger, 50); P.thirst = Math.max(P.thirst, 50); P.energy = Math.max(P.energy, 60); P.poison = 0; P.sick = 0;
    P.deadeye = false;
    this.law.level = 0;
    for (const e of this.ents) if (e.kind === 'npc' && (e.hostile || e.role === 'bandit')) e.remove = true;
    for (const e of this.ents) if (e.kind === 'animal' && e.state === 'attack') e.remove = true;
    this.advanceClock(18 * 60);
    this.cam.x = P.x; this.cam.y = P.y;
    this.state = 'play';
    Audio_.playMusic('explore');
    UI.help(`${t.n} doktoru seni ölümün kıyısından döndürdü. <b>${fmtMoney(lost)}</b> kaybettin ve vücudunda kalıcı izler kaldı (maks. sağlık -3).`, 9);
    this.saveGame(true);
  },
};
Object.defineProperties(G, Object.getOwnPropertyDescriptors(GameSystems));
