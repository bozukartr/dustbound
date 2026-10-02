'use strict';
/* ==========================================================
   FRONTIER'S END — oyun çekirdeği: durum, döngü, render, kayıt
   ========================================================== */

const SAVE_KEY = 'frontiersend_save_v1';   // eski tek kayıt: açılışta 1. yuvaya taşınır
const SET_KEY = 'frontiersend_settings_v1';
/* Kayıt yuvaları: her yuva ayrı bir hayat; içinde bir otomatik, bir manuel kayıt.
   Yuva bilgileri (ad, yaş, yer, küçük ekran görüntüsü) ayrı bir anahtarda tutulur ki menü büyük kayıtları okumadan listelesin. */
const SLOTS = 3;
/* Arayüz (HUD) boyutu seçenekleri; ayarda dizin tutulur */
const HUD_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.4];
const SLOT_META = 'frontiersend_slots_v1';
const slotKey = (n, kind) => `frontiersend_slot${n}_${kind}`;
/* Eski adla (Dustbound) tarayıcıda yapılmış kayıt ve ayarları yeni anahtarlara taşı */
if (!Platform.desktop) try {
  for (const [o, n] of [['dustbound_save_v1', SAVE_KEY], ['dustbound_settings_v1', SET_KEY]]) {
    const v = localStorage.getItem(o);
    if (v !== null && localStorage.getItem(n) === null) localStorage.setItem(n, v);
  }
} catch (e) {}

const G = {
  state: 'boot',
  world: null, player: null, horse: null, ents: [], projs: [], trains: [],
  parts: new Particles(),
  t: 0, timeScale: 1, uiBlocksMove: false, wheelOpen: false,
  fx: { flash: 0, shake: 0, muzzle: 0, boom: 0, lightning: 0 },
  cam: { x: 0, y: 0, ox: 0, oy: 0, sx(x) { return x - G.cam.ox; }, sy(y) { return y - G.cam.oy; } },
  scale: 3, vw: 640, vh: 360,
  settings: { master: 0.8, music: 0.5, sfx: 0.8, amb: 0.6, zoom: 0, fps: false, shake: true, aimAssist: 2, aimSens: 1, fxq: 0, lang: null, padGlyphs: 0, guideNew: true, hudScale: 2 },
  timers: { spawn: 0, disc: 0, ach: 0, fire: 0, amb: 0, gps: 0, hud: 0, radar: 0 },
  coldness: 0, hotness: 0, feltTemp: 20, nearFire: false,

  resetState() {
    this.ents = []; this.projs = []; this.trains = []; this.parts = new Particles();
    this.clock = 8 * 60; this.pace = 'normal'; this.difficulty = 'story';
    this.weather = { type: 'clear', t: 180, i: 0, cloud: 0, fogI: 0 };
    this.law = { level: 0, bounty: 0, lastX: 0, lastY: 0, unseen: 0, spawnT: 0, radius: 0, maskBounty: 0, masked: false, desc: null };
    this.reports = []; this.nomads = null;
    this.talks = []; this.townNews = {}; this.teaseT = 0;
    this.honor = 0; this.bank = 0; this.scars = 0;
    this.stats = { animals: 0, bears: 0, discoveries: 0, towns: 0, rideMiles: 0, walkMiles: 0, eaten: 0, herbs: 0, fish: 0, longKills: 0, bandits: 0, kills: 0, maxCash: 0, earned: 0, shifts: 0, helped: 0, maxBounty: 0, maxHonor: 0, minHonor: 0, properties: 0, married: 0, children: 0, bjWins: 0, armWins: 0, pokerWins: 0, locksPicked: 0, homesBuilt: 0, hoursDesert: 0, hoursCold: 0, nuggets: 0, collectibles: 0, tamed: 0, camps: 0, treasures: 0, trainRides: 0, deadeyes: 0, age: START_AGE };
    this.skills = {}; for (const k in SKILLS) this.skills[k] = { lv: 1, xp: 0 };
    this.achieved = {};
    this.visited = new Set(); this.discovered = new Set(); this.rumored = new Set();
    this.props = []; this.family = { spouse: null, children: [] }; this.romances = {}; this.stable = [];
    this.campCleared = {}; this.chestsOpened = {}; this.graves = {}; this.dailyTalk = {}; this.robbed = {}; this.lostItems = []; this.events = [];
    this.treasure = null; this.activeBounty = null; this.bounties = null; this.stash = {}; this.resMem = {}; this._feltOk = false; this.fireHeat = 0; this.debugUsed = false;
    if (typeof Bubbles !== 'undefined') Bubbles.clear();
    this.waypoint = null; this.gps = null; this.camp = null; this.horse = null;
    this.biz = []; this.lotsOwned = []; this.myWagon = null; this.haulers = []; this.raids = [];
    this.playtime = 0; this.autoT = 0; this.posse = null; this.pokerTables = {}; this.homes = []; this.homeSeq = 0; this.homePreview = null; this.hitStopT = 0; Juice.reset();
    if (this.binoc) this.binocOff();
    this.reveal = new Uint8Array(FW * FW);
    if (!this.fogCanvas || this.fogCanvas.width !== FW) { this.fogCanvas = makeCanvas(FW, FW); this.fogCtx = this.fogCanvas.getContext('2d', { willReadFrequently: true }); }
    this.travelT = 10; this.eventT = 90;
    this.amb = { birds: [], tumbles: [], flies: [] };
    this.curTown = null; this.curRegion = null; this.goalReached = false; this.hints = {};
    this.story = null; this.cine = false;
    FX.reset();
  },

  init() {
    this.canvas = $('#game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.light = makeCanvas(16, 16); this.lctx = this.light.getContext('2d');
    this.over = makeCanvas(16, 16); this.octx = this.over.getContext('2d');
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
    FX.init();
    this.loadSettings();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },
  loadSettings() {
    try { const s = JSON.parse(Platform.get(SET_KEY)); if (s) Object.assign(this.settings, s); } catch (e) {}
    Input.setBinds(this.settings.binds);
    this.applySettings();
  },
  /* Tam ekran tercihi: ayarlarda ve F11 ile değişir, kayıtta saklanır */
  setFullscreenPref(on) {
    this.settings.fullscreen = !!on;
    Platform.setFullscreen(!!on);
    this.saveSettings();
  },
  saveSettings() {
    this.settings.binds = JSON.parse(JSON.stringify(Input.binds));
    try { Platform.set(SET_KEY, JSON.stringify(this.settings)); } catch (e) {}
    this.applySettings();
  },
  /* Piksel ölçeğini ayarlara girmeden değiştir: +1 / -1, 0 = döngü (kol R3) */
  binds_zoom() { return Input.binds.pad.zoomIn != null || Input.binds.pad.zoomOut != null; },
  quickZoom(d) {
    const H = window.innerHeight, W = window.innerWidth;
    const auto = Math.max(2, Math.round(H / 270)), maxS = Math.max(2, Math.min(7, Math.floor(W / 320)));
    let s = this.scale || auto;
    if (d === 0) s = s >= maxS ? 2 : s + 1; else s = clamp(s + d, 2, maxS);
    this.settings.zoom = s === auto ? 0 : s;
    this.applySettings(); this.saveSettings();
    this.prefetch(true);
    UI.feed(Tr`Piksel Ölçeği: ${s}x${this.settings.zoom ? '' : Tr(' (otomatik)')}`);
    Audio_.ui('move');
  },
  applySettings() {
    const S = this.settings;
    Object.assign(Audio_.vol, { master: S.master, music: S.music, sfx: S.sfx, amb: S.amb });
    Audio_.applyVolumes();
    $('#fps') && $('#fps').classList.toggle('hidden', !S.fps);
    // efekt kalitesi değişince salınan bitkiler chunk'a gömülür / çıkarılır
    if (this._fxq !== undefined && this._fxq !== S.fxq && this.world) this.world.refreshChunks();
    this._fxq = S.fxq;
    this.resize();
  },
  /* Arayüz ölçeği: kullanıcının seçimi × ekran boyuna göre temel; kısa ekranda taşmasın diye sınırlanır */
  hudScaleApply() {
    const S = this.settings, w = innerWidth, h = innerHeight;
    const base = w >= 1500 && h >= 1000 ? 1.2 : w <= 800 ? 0.75 : 1;
    const hs = Math.min((HUD_SCALES[S.hudScale === undefined ? 2 : S.hudScale] || 1) * base, h / 560);
    document.documentElement.style.setProperty('--hs', hs.toFixed(3));
  },
  resize() {
    this.hudScaleApply();
    const W = window.innerWidth, H = window.innerHeight;
    let s = this.settings.zoom || Math.max(2, Math.round(H / 270));
    if (W / s < 320) s = Math.max(1, Math.floor(W / 320));
    this.scale = s;
    if (this.binoc) this.binocEl(true);
    // kenar payı: tuval ekrandan biraz büyük çizilir; dörtnala giderken kamera bu payı açarak uzaklaşır
    this.os = OVERSCAN;
    this.vw = Math.ceil(W / s * OVERSCAN); this.vh = Math.ceil(H / s * OVERSCAN);
    const c = this.canvas;
    c.width = this.vw; c.height = this.vh;
    c.style.width = this.vw * s + 'px'; c.style.height = this.vh * s + 'px';
    const L = Math.round((W - this.vw * s) / 2), Tp = Math.round((H - this.vh * s) / 2);
    c.style.left = L + 'px'; c.style.top = Tp + 'px';
    c.style.transformOrigin = `${W / 2 - L}px ${H / 2 - Tp}px`;   // yakınlaşma ekranın ortasından
    this.light.width = this.vw; this.light.height = this.vh;
    this.over.width = this.vw; this.over.height = this.vh;
    this.ctx.imageSmoothingEnabled = false;
  },

  /* ---------------- Yeni oyun ---------------- */
  async newGame(profile) {
    setWorldSize(WORLD_NEW);
    this.resetState();
    const seed = (Math.random() * 1e9) | 0;
    this.seed = seed;
    this.pace = profile.pace; this.difficulty = profile.difficulty; this.background = profile.bg;
    this.slot = profile.slot || this.freeSlot() || 1;
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
    // hikâyeli başlangıç: rehber kapanınca Sully'nin ilk bölümü başlar
    const story = this._storyNext = profile.story !== false && !window.__testNoStory;
    const hints = () => {
      if (story) { this.storyStart(); return; }
      UI.help(Tr`<b>${P.name}</b>, 18 yaşındasın ve yıl ${START_YEAR}. Hedefin: <b>80 yaşına kadar hayatta kalmak.</b><br>Aç kalma, susuz kalma, uykusuz kalma. Avlan, çalış, keşfet.`, 12);
      setTimeout(() => UI.help(Tr`${Input.glyph('map')} Harita &nbsp; ${Input.glyph('satchel')} Çanta &nbsp; ${Input.glyph('journal')} Günlük &nbsp; ${Input.glyph('wheel')} Silah Çarkı &nbsp; ${Input.glyph('pause')} Duraklat`, 10), 13000);
    };
    // her yeni hayatta sinematikten hemen sonra kısa rehber açılır (Ayarlar'dan ya da rehberden kapatılabilir);
    // kapanınca hikâye ya da ipuçları başlar
    if (this.settings.guideNew !== false && !window.__testNoGuide) setTimeout(() => { if (this.state === 'play' && !UI.isModal()) UI.openWelcome(() => setTimeout(hints, 600)); else hints(); }, 700);
    else setTimeout(hints, 1200);
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
    this.insideB = null; this.exitB = null;
    this.trains = w.lines.map((l, i) => new Train(l, i));
    UI.loading(Tr('Hazır.'), 1);
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
  /* silent: otomatik kayıt (gün dönümü, uyku, birkaç dakikada bir); aksi hâlde oyuncunun istediği manuel kayıt.
     Tek Hayat zorluğunda yalnızca otomatik kayıt tutulur (eski bir kayda dönülemez). */
  saveGame(silent, kind) {
    if (!this.player || this.state === 'dead') return;
    kind = kind || (silent || this.difficulty === 'hard' ? 'auto' : 'manual');
    if (!this.slot) this.slot = this.freeSlot() || 1;
    const P = this.player;
    const enc = (arr) => { let s = ''; for (let i = 0; i < arr.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (arr[i + k]) b |= 1 << k; s += String.fromCharCode(b); } return btoa(s); };
    const h = this.horse;
    this.noteBountyState();
    const data = {
      v: 3, ww: WW, seed: this.seed, clock: this.clock, pace: this.pace, difficulty: this.difficulty, background: this.background,
      profile: this.profile,
      player: { x: P.x, y: P.y, name: P.name, look: P.look, inv: P.inv, weapons: [...P.weapons], ammo: P.ammo, clip: P.clip, weapon: P.weapon, money: P.money, hp: P.hp, sta: P.sta, de: P.de, hunger: P.hunger, thirst: P.thirst, energy: P.energy, clean: P.clean, deCore: P.deCore, sick: P.sick, immuneT: P.immuneT, painT: P.painT, limberT: P.limberT, coolT: P.coolT, canteen: P.canteen, coat: P.coat, mask: P.masked ? P.mask : null, lastMask: P.lastMask || null, lantern: P.lantern, riding: !!P.riding },
      horse: h ? { breed: h.breed, name: h.name, look: h.look, hp: h.hp, bond: h.bond, x: h.x, y: h.y, dead: h.dead } : null,
      weather: this.weather, law: this.law, honor: this.honor, bank: this.bank, scars: this.scars, stats: this.stats, skills: this.skills, achieved: this.achieved,
      visited: [...this.visited], discovered: [...this.discovered], rumored: [...this.rumored], props: this.props, family: this.family, romances: this.romances, stable: this.stable,
      campCleared: this.campCleared, chestsOpened: this.chestsOpened, robbed: this.robbed, graves: this.graves, harvested: [...this.world.harvested], treasure: this.treasure, activeBounty: this.activeBounty, stash: this.stash,
      story: this.saveStory(), reveal: enc(this.reveal), goalReached: this.goalReached, hints: this.hints, carry: this.saveCarry(), biz: this.saveBiz(), haul: this.saveHaul(), homes: this.saveHomes(), world: this.saveEnts(), poker: this.pokerTables, playtime: Math.round(this.playtime), resMem: this.resMem, debugUsed: !!this.debugUsed, savedAt: Date.now(),
    };
    try {
      Platform.set(slotKey(this.slot, kind), JSON.stringify(data));
      this.writeSlotMeta(this.slot, kind, this.slotMetaNow());
      if (!silent) UI.feed(Tr`💾 ${this.slot}. yuvaya kaydedildi.`);
    } catch (e) { UI.feed(Tr('Kayıt başarısız: ') + e.message, 'warn'); }
  },
  /* 1890 fiyat reformundan önceki kayıtlar: paralar yeni ölçeğe çekilir (alım gücü korunur) */
  migrateEconomy() {
    const P = this.player, S = this.stats, L = this.law;
    P.money *= 0.3; this.bank *= 0.3;
    L.bounty = Math.round(L.bounty * 0.5 * 100) / 100;
    S.earned = (S.earned || 0) * 0.3; S.maxCash = (S.maxCash || 0) * 0.3; S.maxBounty = (S.maxBounty || 0) * 0.5;
    if (this.activeBounty) this.activeBounty.reward = Math.round(this.activeBounty.reward * 0.5);
    this.bounties = null;
  },
  /* ---------------- Kayıt yuvaları ---------------- */
  slotMetaAll() {
    let M = null;
    try { M = JSON.parse(Platform.get(SLOT_META) || 'null'); } catch (e) { M = null; }
    if (!M || typeof M !== 'object') M = {};
    // eski tek kayıt: 1. yuvanın otomatik kaydı olur
    if (!M.migrated) {
      M.migrated = 1;
      try {
        const old = Platform.get(SAVE_KEY);
        if (old && !M[1]) {
          const d = JSON.parse(old);
          Platform.set(slotKey(1, 'auto'), old);
          M[1] = { auto: this.metaFromData(d) };
          Platform.remove(SAVE_KEY);
        }
      } catch (e) {}
      try { Platform.set(SLOT_META, JSON.stringify(M)); } catch (e) {}
    }
    return M;
  },
  writeSlotMeta(n, kind, meta) {
    const M = this.slotMetaAll();
    M[n] = M[n] || {};
    if (meta) M[n][kind] = meta; else delete M[n][kind];
    if (!M[n].auto && !M[n].manual) delete M[n];
    Platform.set(SLOT_META, JSON.stringify(M));
  },
  metaFromData(d) {
    const dpy = (LIFE_PACES.find(p => p.id === d.pace) || LIFE_PACES[1]).dpy;
    const day = Math.floor(d.clock / 1440);
    return { name: d.player.name, age: START_AGE + Math.floor(day / dpy), money: d.player.money, bg: d.background, diff: d.difficulty, day, year: START_YEAR + Math.floor(day / dpy), place: '', savedAt: d.savedAt || Date.now(), playtime: d.playtime || 0, thumb: null };
  },
  /* Şu anki oyunun yuva özeti: yer adı ve küçük bir ekran görüntüsü */
  slotMetaNow() {
    const P = this.player, t = this.curTown ? this.world.towns.find(x => x.id === this.curTown) : null;
    const reg = this.world.regionAt ? this.world.regionAt(P.x, P.y) : null;
    let thumb = null;
    try {
      if (this.canvas && this.canvas.width) {
        const c = makeCanvas(224, 126), g = c.getContext('2d');
        g.drawImage(this.canvas, 0, 0, c.width, c.height);
        thumb = c.toDataURL('image/jpeg', 0.72);
      }
    } catch (e) { thumb = null; }
    return { name: P.name, age: this.age, money: P.money, bg: this.background, diff: this.difficulty, day: this.day, year: this.year, place: t ? t.n : (reg ? (reg.n || reg) : ''), savedAt: Date.now(), playtime: Math.round(this.playtime), thumb };
  },
  slotList() {
    const M = this.slotMetaAll(), out = [];
    for (let n = 1; n <= SLOTS; n++) out.push({ n, auto: (M[n] && M[n].auto) || null, manual: (M[n] && M[n].manual) || null });
    return out;
  },
  freeSlot() { const L = this.slotList().find(s => !s.auto && !s.manual); return L ? L.n : null; },
  /* En yeni kayıt: { n, kind, meta } */
  latestSave(n) {
    let best = null;
    for (const s of this.slotList()) {
      if (n && s.n !== n) continue;
      for (const kind of ['auto', 'manual']) if (s[kind] && (!best || s[kind].savedAt > best.meta.savedAt)) best = { n: s.n, kind, meta: s[kind] };
    }
    return best;
  },
  hasSave() { return !!this.latestSave(); },
  saveInfo() { const L = this.latestSave(); return L ? Object.assign({ slot: L.n, kind: L.kind }, L.meta) : null; },
  deleteSlot(n) {
    if (!n) return;
    for (const kind of ['auto', 'manual']) Platform.remove(slotKey(n, kind));
    const M = this.slotMetaAll(); delete M[n];
    try { Platform.set(SLOT_META, JSON.stringify(M)); } catch (e) {}
  },
  /* Tek Hayat'ta ölüm: bu hayatın yuvası silinir */
  deleteSave() { this.deleteSlot(this.slot); },
  /* n, kind verilmezse en yeni kayıt yüklenir; kind verilmezse o yuvanın en yeni kaydı */
  async loadGame(n, kind) {
    const L = n && kind ? { n, kind } : this.latestSave(n);
    if (!L) return false;
    let d;
    try { d = JSON.parse(Platform.get(slotKey(L.n, L.kind))); } catch (e) { d = null; }
    if (!d) return false;
    setWorldSize(d.ww || WORLD_OLD);   // v3 öncesi kayıtlar küçük dünyada kalır
    this.resetState();
    this.slot = L.n;
    this.seed = d.seed;
    await this.buildWorld(d.seed);
    Object.assign(this, { clock: d.clock, pace: d.pace, difficulty: d.difficulty, background: d.background, profile: d.profile, honor: d.honor, bank: d.bank, scars: d.scars || 0, goalReached: d.goalReached });
    Object.assign(this.weather, d.weather); Object.assign(this.law, d.law); this.law.level = 0; this.law.maskBounty = 0; this.law.masked = false; this.law.resist = false; this.law.arrestT = 0; this.law.warned = false;
    Object.assign(this.stats, d.stats); Object.assign(this.skills, d.skills); this.achieved = d.achieved || {};
    this.visited = new Set(d.visited); this.discovered = new Set(d.discovered); this.rumored = new Set(d.rumored || []);
    this.props = d.props || []; this.family = d.family || { spouse: null, children: [] }; this.romances = d.romances || {}; this.stable = d.stable || [];
    this.campCleared = d.campCleared || {}; this.robbed = d.robbed || {}; this.chestsOpened = d.chestsOpened || {}; this.graves = d.graves || {}; this.treasure = d.treasure; this.activeBounty = d.activeBounty; this.stash = d.stash || {};
    if (this.activeBounty) this.activeBounty.spawned = false;
    this.hints = d.hints || {}; this.resMem = d.resMem || {}; this.debugUsed = !!d.debugUsed; this.playtime = d.playtime || 0;
    this.world.harvested = new Map(d.harvested || []);
    for (const b of this.world.buildings) if (b.prop && this.props.includes(b.prop)) b.owned = true;
    const bin = atob(d.reveal);
    for (let i = 0; i < bin.length; i++) { const b = bin.charCodeAt(i); for (let k = 0; k < 8; k++) this.reveal[i * 8 + k] = (b >> k) & 1; }
    this.rebuildFog();
    const p = d.player;
    const P = this.player = new Player(p.x, p.y, { name: p.name, look: p.look });
    Object.assign(P, { inv: p.inv, ammo: p.ammo, clip: p.clip, weapon: p.weapon, money: p.money, hp: p.hp, sta: p.sta, de: p.de, hunger: p.hunger, thirst: p.thirst, energy: p.energy, clean: p.clean, deCore: p.deCore, sick: p.sick, immuneT: p.immuneT || 0, painT: p.painT || 0, limberT: p.limberT || 0, coolT: p.coolT || 0, canteen: p.canteen, coat: p.coat, mask: p.mask || null, lastMask: p.lastMask || null, lantern: p.lantern });
    P.weapons = new Set(p.weapons);
    // eski kayıtlar: kasaba düzeni değiştiyse duvarın içinde başlama
    if (this.world.blocked(P.x, P.y, 4)) { const t = this.nearestTown(P.x, P.y); P.x = t.spawn.x; P.y = t.spawn.y; }
    if (!this.romances || !Object.keys(this.romances).length) this.initRomances();
    if (d.horse) {
      const h = new Horse(d.horse.x, d.horse.y, d.horse.breed, { owner: 'player', name: d.horse.name, look: d.horse.look, bond: d.horse.bond, hp: d.horse.hp });
      h.dead = d.horse.dead;
      this.setHorse(h, true);
      if (p.riding && !h.dead) { h.x = P.x; h.y = P.y; P.mount(h, true); }
    }
    this.loadCarry(d.carry);
    this.loadBiz(d.biz);
    this.loadHomes(d.homes);
    this.pokerTables = d.poker || {};
    this.loadHaul(d.haul);
    // çevredeki dünya kaldığı gibi: NPC'ler, hayvanlar, arabalar, cesetler, yerdeki eşyalar
    try { this.loadEnts(d.world); } catch (e) { console.warn('dünya anlık görüntüsü yüklenemedi', e); }
    try { this.loadStory(d.story); } catch (e) { console.warn('hikâye yüklenemedi', e); this.story = null; }
    if ((d.v || 1) < 2) this.migrateEconomy();
    Platform.syncAchievements(this.achieved);
    this.startPlay();
    UI.feed(Tr('Kayıt yüklendi. Hoş geldin, ') + P.name + '.');
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
      else if (this.state === 'menu') { if (FX.drunkCss) FX.clearCss(); UI.menuBg(dt); }
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; UI.feed(Tr('Hata: ') + e.message, 'warn'); }
    }
    Input.endFrame();
    this.presenceTick(dt);
    if (this.settings.fps) { this._fc = (this._fc || 0) + 1; this._ft = (this._ft || 0) + dt; if (this._ft > 0.5) { $('#fps').textContent = Math.round(this._fc / this._ft) + ' FPS'; this._fc = 0; this._ft = 0; } }
    requestAnimationFrame(t => this.frame(t));
  },
  /* Steam arkadaş listesinde görünen durum (rich presence) */
  presenceTick(dt) {
    if (!Platform.steam) return;
    this._presT = (this._presT || 0) - dt;
    if (this._presT > 0) return;
    this._presT = 5;
    if ((this.state === 'play' || this.state === 'dead') && this.player && this.world) {
      const P = this.player, t = this.world.townAt(P.x, P.y, 60);
      Platform.presence('age', this.age);
      Platform.presence('place', t ? t.n : this.world.regionAt(P.x, P.y));
      Platform.presence('steam_display', this.state === 'dead' ? '#StatusDead' : '#StatusPlaying');
    } else Platform.presence('steam_display', '#StatusMenu');
  },
  update(dt) {
    const P = this.player, I = Input;
    // hikâye sinematiği oynarken dünya bekler
    if (this.cine) { this.uiBlocksMove = true; return; }
    const modal = UI.isModal() || UI.state === 'fade';
    this.uiBlocksMove = modal || this.state !== 'play';
    if (this.binoc) { if (modal || this.state !== 'play') this.binocOff(); else this.binocUpdate(dt); }
    if (this.state === 'play' && !modal) this.handleGlobalInput(dt);
    if (modal || this.state !== 'play') Bubbles.clear(); else { this.talkTick(dt); Bubbles.update(dt); }
    if (modal) { this.updateCamera(dt); return; }
    // isabet anında mikro duraklama: dünya bir anlığına durur, çizim sürer
    if (this.hitStopT > 0) { this.hitStopT -= dt; this.updateCamera(dt); return; }
    let ts = 1;
    if (this.wheelOpen) ts = 0.2;
    if (P.deadeye) ts = 0.35;
    this.timeScale = ts;
    const sdt = dt * ts;
    this.t += dt;
    if (this.state === 'play') {
      this.playtime += dt;
      // birkaç dakikada bir sessiz otomatik kayıt (kovalamaca ya da baskın sırasında değil)
      if ((this.autoT += dt) > 240 && this.law.level === 0) { this.autoT = 0; this.saveGame(true); }
    }
    if (this.state === 'play' && !this.binoc) P.update(sdt);
    for (const e of this.ents) {
      if (e === P) continue;
      if ((e.kind === 'npc' && !e.dead && !e.bound && !e.hide) || (e.kind === 'horse' && !e.rider && !e.dead) || (e.kind === 'wagon' && e !== P.riding)) {
        if (Math.abs(e.x - P.x) < 300 && Math.abs(e.y - P.y) < 220) Audio_.footTick(e, sdt); else e._sx = undefined;
      }
      // uzaktaki kasaba sakinleri seyrek güncellenir (kalabalık kasabalarda performans)
      if (e.res && !e.hostile && e.state !== 'flee' && e.state !== 'report' && !e.bound && Math.abs(e.x - P.x) + Math.abs(e.y - P.y) > 620) {
        e.lodT = (e.lodT || 0) + sdt;
        if (e.lodT < 0.2) continue;
        e.update(e.lodT); e.lodT = 0;
        continue;
      }
      e.update(sdt);
    }
    this.updateProjectiles(sdt);
    this.ambientLife(sdt);
    for (const tr of this.trains) tr.update(sdt);
    this.parts.update(sdt);
    FX.update(sdt, dt);
    Juice.update(sdt);
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
    this.storyTick(dt);
    this.hunterTick(dt);
    this.witnessUpdate(dt);
    const ib = this.world.buildingAtPx(P.x, P.y);
    if (ib !== this.insideB) {
      if (ib && (!this.insideB || this.insideB !== ib)) {
        UI.feed(`${Icons.glyph('door', '#efe6d2', 'ic inl')} ${ib.name}`); Audio_.tone(180, 0.06, 'triangle', 0.05);
        this.qEvent('enter', ib);
        this.hintOnce('indoor', Tr`Binaların içinde dolaşabilirsin. Tezgahtaki çalışanla, yataklarla, masalarla ve diğer eşyalarla ${Input.glyph('interact')} ile etkileşime geç. Dükkanlar gece kapanır.`);
      }
      if (this.insideB && !ib) this.exitB = this.insideB;
      // kapı sesi: saloonda yaylı kanatlar, öbür binalarda menteşe gıcırtısı
      const db = ib || this.insideB;
      if (db && db.door) Audio_.play(db.type === 'saloon' || db.type === 'cantina' ? 'saloon_door' : 'door_open', { x: db.door.x, y: db.door.y, vol: 0.8 });
      this.insideB = ib;
    }
    // çıkılan binanın kapısı, oyuncu kapıdan uzaklaşana kadar açık kalır
    if (this.exitB && (ib || dist2(P.x, P.y, this.exitB.door.x, this.exitB.door.y) > 30 * 30)) this.exitB = null;
    const T_ = this.timers;
    T_.spawn -= dt; if (T_.spawn <= 0) { T_.spawn = 1; this.spawnTick(); }
    T_.disc -= dt; if (T_.disc <= 0) { T_.disc = 0.4; this.discoverUpdate(); }
    T_.ach -= dt; if (T_.ach <= 0) { T_.ach = 1; this.checkAchievements(); }
    T_.fire -= dt; if (T_.fire <= 0) { T_.fire = 0.5; this.checkFire(); if (this.t > 30) this.hintTick(); }
    T_.gps -= dt; if (T_.gps <= 0 && this.waypoint) { T_.gps = 5; if (dist(P.x, P.y, this.waypoint.x, this.waypoint.y) < 40) { this.setWaypoint(null); UI.feed(Tr('📍 Hedefe ulaştın')); } else this.computeGps(); }
    T_.amb -= dt;
    if (T_.amb <= 0) {
      T_.amb = 0.25;
      const env = this.envCache = this.localWeather(P.x, P.y);
      const b = this.world.biomeAt(P.x, P.y);
      Audio_.ambientTick({ town: !!this.world.townAt(P.x, P.y, 2), indoor: !!this.insideB, storm: !!env.storm, rain: env.rain, wind: Math.max(env.dust, env.snow * 0.6, env.storm ? 0.6 : 0.12), fire: this.nearFire ? 1 : 0, water: this.world.nearWater(P.x, P.y, 40) ? 1 : 0, night: this.isNight, nature: b === 'FOREST' || b === 'GRASS' || b === 'SWAMP' ? 1 : 0.4, wolves: b === 'FOREST' || b === 'SNOW' });
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
      if ((b.type !== 'saloon' && b.type !== 'gambling') || !this.isOpen(b)) continue;
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
      else if (!P.aiming && I.device === 'pad' && !this.binds_zoom()) this.quickZoom(0);   // kolda nişan almadan R3: piksel ölçeğini değiştir
      else if (!P.aiming) UI.feed(Tr('Odak için önce nişan al.'), 'warn');
    }
    if (I.pressed('zoomIn')) this.quickZoom(1);
    if (I.pressed('zoomOut')) this.quickZoom(-1);
    if (Input.mouse.wheel && Input.device === 'kb') this.cycleWeapon(Input.mouse.wheel > 0 ? 1 : -1);
    // kamp tuşu (kolda D-pad ↓): basılı tut = kamp kur, kısa bas = genişletilmiş radar/HUD
    if (I.held('camp') > 0.7 && !this._campHeld) { this._campHeld = true; this.setupCamp(); }
    if (I.down('camp')) this._campT = (this._campT || 0) + dt;
    else { if (this._campT > 0 && this._campT < 0.35 && !this._campHeld) UI.expandHud(); this._campT = 0; this._campHeld = false; }
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
    if (P.hunger < 30) this.hintOnce('hunger', Tr`Açıkıyorsun. ${g('satchel')} ile çantanı açıp yemek ye ya da ${g('quick')} ile hızlıca bir şeyler atıştır.`);
    else if (P.thirst < 30) this.hintOnce('thirst', Tr`Susadın. Mataranı iç (${g('quick')}) ya da bir nehir/kuyu başında ${g('interact')} ile su iç.`);
    else if (P.energy < 25) this.hintOnce('sleep', Tr`Yorgunsun. Bir otelde, evinde ya da kampta (${g('camp')} basılı tut) uyu.`);
    else if (this.coldness > 0.05) this.hintOnce('cold', Tr('Üşüyorsun! Kalın bir palto giy, ateş yak ya da sıcak bir şeyler iç. Terzilerden kürk alabilirsin.'));
    else if (this.hotness > 0.05) this.hintOnce('hot', Tr('Sıcak çarpıyor! Daha sık su iç, geniş kenarlı şapka ya da keten gömlek giy.'));
    else if (this.isNight) this.hintOnce('night', Tr`Gece çöktü. ${g('lantern')} ile fenerini yak. Kurtlar gece daha tehlikelidir.`);
    else if (P.riding) this.hintOnce('ride', Tr`${g('sprint')} basılı tutarak dörtnala koş. Atının dayanıklılığına dikkat et. ${g('interact')} ile in.`);
    else if (this.law.level > 0) this.hintOnce('law', Tr('Aranıyorsun! Radardaki kırmızı arama alanının dışına çık ve görünmeden bekle.'));
    else if (!this.world.townAt(P.x, P.y, 60) && this.hour >= 17) this.hintOnce('camp', P.has('bedroll') ? Tr`Akşam oluyor. Kasabadan uzaktaysan ${g('camp')} tuşunu basılı tutarak kamp kurabilirsin.` : Tr`Vahşi doğada kamp kurmak için bir <b>Uyku Tulumu</b> gerekir (genel mağazada $8). Sonra ${g('camp')} tuşunu basılı tut.`, 10);
    else if (this.world.nearWater(P.x, P.y, 20)) this.hintOnce('water', Tr`Su kenarındasın. ${g('interact')} ile su iç; basılı tutarak matara doldurma, yıkanma ve balık tutma seçeneklerine ulaş.`);
  },
  quickUse() {
    const P = this.player;
    if (P.hp < P.maxHp * 0.8) {
      for (const id of ['health_cure', 'herbal_tonic', 'bandage', 'cooked_big', 'cooked_game', 'cooked_fish', 'stew']) if (P.has(id)) { this.consume(id); return; }
    }
    if (P.thirst < 70 && P.canteen > 0) { this.drinkCanteen(); return; }
    if (P.hunger < 70) for (const id of ['cooked_game', 'cooked_big', 'beans', 'bread', 'jerky', 'cooked_fish', 'cooked_bird', 'peaches', 'apple', 'corn', 'berries']) if (P.has(id)) { this.consume(id); return; }
    if (P.sta < P.maxSta * 0.4) for (const id of ['stamina_tonic', 'chocolate', 'ginseng']) if (P.has(id)) { this.consume(id); return; }
    UI.feed(Tr('Hızlı kullanılacak bir şey yok.'), 'warn');
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
    // ateşin ısısı mesafeyle azalır: dibinde +18°, kenarda birkaç derece
    let heat = 0;
    const src = (x, y, R) => { const d = dist(x, y, P.x, P.y); if (d < R) heat = Math.max(heat, 18 * clamp((R - d) / (R * 0.6), 0, 1)); };
    if (this.camp) src(this.camp.x, this.camp.y, 90);
    if (this.nomads) for (const c of this.nomads) if (c.spawned) src(c.x, c.y, 80);
    const tx = P.x >> 4, ty = P.y >> 4;
    for (let y = ty - 5; y <= ty + 5; y++) for (let x = tx - 5; x <= tx + 5; x++) if (W.inb(x, y) && W.obj[y * WW + x] === O.CAMPFIRE) src(x * TS + 8, y * TS + 8, 80);
    this.fireHeat = heat;
    this.nearFire = heat > 6;
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
            if (e.dead || e === p.owner || e === this.player.riding || e.kind === 'camp' || e.kind === 'prop' || e.kind === 'pelt' || e.kind === 'crate' || e === this.horse) continue;
            if (dist2(e.x, e.y, p.x, p.y) < (e.r + 2) * (e.r + 2)) { e.hurt(p.dmg, 'player', 'arrow'); done = true; break; }
          }
        }
        if (done || p.life <= 0) L.splice(i, 1);
      } else if (p.type === 'lasso') {
        // kement ilmeği: ilk değdiği kişiyi yakalar
        p.life -= dt; p.t += dt;
        const tg = p.tg;
        if (tg && !tg.dead && !tg.bound && !tg.remove) { const sp = Math.hypot(p.vx, p.vy), aa = Math.atan2(tg.y - p.y, tg.x - p.x); p.vx = Math.cos(aa) * sp; p.vy = Math.sin(aa) * sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        let hit = null;
        if (this.world.isSolidPx(p.x, p.y) && !this.world.isWaterPx(p.x, p.y)) { L.splice(i, 1); continue; }
        for (const e of this.ents) {
          if (e.dead || e.remove || e.bound) continue;
          let r;
          if (e.kind === 'npc') { if (e.role === 'spouse' || e.role === 'child') continue; r = e.r + (e.mounted ? 7 : 4); }
          else if (e.kind === 'animal') { if (e.def.shape === 'snake' || e.def.shape === 'gator') continue; r = e.r + 4; }
          else if (e.kind === 'wagon') { if (!e.driver || e.hauler) continue; r = 12; }   // sürücüyü arabadan çeker
          else continue;
          const hc = e.kind === 'wagon' ? e.seat : e;
          if (dist2(hc.x, hc.y, p.x, p.y) < r * r) { hit = e; break; }
        }
        if (hit) {
          if (hit.kind === 'animal') this.lassoAnimal(hit);
          else if (hit.kind === 'wagon') this.lassoHit(hit.throwDriver());
          else this.lassoHit(hit);
          L.splice(i, 1);
        }
        else if (p.life <= 0) L.splice(i, 1);
      } else if (p.type === 'dynamite') {
        p.t += dt; p.fuse -= dt;
        const f = Math.min(1, p.t / p.dur);
        p.x = lerp(p.sx, p.tx, f); p.y = lerp(p.sy, p.ty, f); p.z = Math.sin(f * Math.PI) * 20;
        if (Math.random() < 0.5) this.parts.add('spark', p.x, p.y - p.z, rnd(-10, 10), rnd(-20, 0), 0.3, 1);
        if (p.fuse <= 0) { this.explode(p.x, p.y, p.owner); L.splice(i, 1); }
      }
    }
  },
  /* Binaya girince kamera yumuşakça binaya doğru yaklaşır (bina ekranı tamamen doldurmaz),
     çıkınca aynı yumuşaklıkla geri uzaklaşır. Yakınlaşma tuvalin CSS ölçeğiyle yapılır;
     dünya çizimi ve piksel ölçeği değişmez. */
  zoomFor(b) {
    const fill = 0.8, bw = b.w * TS, bh = (b.h + 1) * TS, os = this.os || 1;
    return clamp(Math.min(this.vw / os * fill / bw, this.vh / os * fill / bh), 1, 2.2);
  },
  zoomUpdate(dt) {
    const Z = this.camZoom || (this.camZoom = { z: 1, from: 1, to: 1, k: 0, kFrom: 0, kTo: 0, t: 1, b: null, cx: 0, cy: 0 });
    const IB = this.state === 'play' && this.insideB && this.insideB.enter ? this.insideB : null;
    if (IB !== Z.b) {
      Z.b = IB; Z.t = 0; Z.from = Z.z; Z.kFrom = Z.k;
      Z.to = IB ? this.zoomFor(IB) : 1; Z.kTo = IB ? 1 : 0;
      if (IB) { Z.cx = (IB.x + IB.w / 2) * TS; Z.cy = (IB.y + IB.h / 2) * TS; }
    }
    if (Z.t < 1) {
      Z.t = Math.min(1, Z.t + dt / 0.75);
      const u = Z.t, e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;   // yumuşak başlayıp yumuşak biten geçiş
      Z.z = lerp(Z.from, Z.to, e); Z.k = lerp(Z.kFrom, Z.kTo, e);
    }
    // dörtnala giderken kenar payı açılır: kamera hafifçe uzaklaşır
    const R = !IB && this.state === 'play' ? this.player.riding : null;
    const sp = R ? R.spd : 0, sTo = 1 - (1 - 1 / (this.os || 1)) * clamp((sp - 100) / 60, 0, 1);
    Z.sz = (Z.sz || 1) + (sTo - (Z.sz || 1)) * Math.min(1, dt * 1.6);
    if (Math.abs(Z.sz - sTo) < 0.002) Z.sz = sTo;
    Z.out = Z.z * Z.sz;
    if (FX.drunkCss) return Z;   // sarhoşken dönüşümü FX.post yazar (yakınlaşmayı da içerir)
    const tf = Math.abs(Z.out - 1) > 0.001 ? `scale(${Z.out.toFixed(4)})` : '';
    if (this.canvas.style.transform !== tf) this.canvas.style.transform = tf;
    return Z;
  },
  updateCamera(dt) {
    const P = this.player, C = this.cam;
    let tx = P.x, ty = P.y;
    if (P.riding) { tx += Math.cos(P.riding.ang) * P.riding.spd * 0.45; ty += Math.sin(P.riding.ang) * P.riding.spd * 0.45; }
    if (P.aiming || P.rsAim) { const d = Math.min(P.aimDist, 90) * 0.45; tx += Math.cos(P.aimAng) * d; ty += Math.sin(P.aimAng) * d; }
    if (this.binoc) { tx += this.binoc.x; ty += this.binoc.y; }
    // içerideyken kamera binanın ortasına oturur
    const Z = this.zoomUpdate(dt);
    if (Z.k > 0.001) { tx = lerp(tx, Z.cx, Z.k); ty = lerp(ty, Z.cy, Z.k); }
    const cf = this.binoc ? 7 : 4;
    C.x = lerp(C.x, tx, Math.min(1, dt * cf));
    C.y = lerp(C.y, ty, Math.min(1, dt * cf));
    let sx = 0, sy = 0;
    if (this.fx.shake > 0 && this.settings.shake) { sx = rnd(-1, 1) * this.fx.shake; sy = rnd(-1, 1) * this.fx.shake; }
    this.fx.shake = Math.max(0, this.fx.shake - dt * 18);
    if (this.settings.shake) { sx += this.fx.kx || 0; sy += this.fx.ky || 0; }   // yönlü tepme (atış, patlama)
    C.ox = Math.round(C.x - this.vw / 2 + sx);
    C.oy = Math.round(C.y - this.vh / 2 + sy);
  },
  /* Dünya koordinatı → ekran (CSS pikseli); tuvalin kenar payını ve yakınlaşmasını hesaba katar */
  toScreen(x, y) {
    const r = this.canvas.getBoundingClientRect(), k = r.width / this.canvas.width;
    return { x: r.left + (x - this.cam.ox) * k, y: r.top + (y - this.cam.oy) * k };
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
    FX.beginFrame();
    FX.drawGround(ctx);
    Juice.drawGround(ctx, x0, y0, x1, y1);
    // dinamik zemin öğeleri
    const tx0 = Math.max(0, (x0 >> 4) - 1), ty0 = Math.max(0, (y0 >> 4) - 1), tx1 = Math.min(WW - 1, (x1 >> 4) + 1), ty1 = Math.min(WH - 1, (y1 >> 4) + 1);
    const obj = W.obj, tile = W.tile, flags = W.flags, day = this.day, t = this.t;
    const fxFull = FX.full, autumn = W.season === 2;
    const fires = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      const row = ty * WW;
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tile[row + tx] === T.WATER) { FX.foam(ctx, tx, ty, t); if (fxFull) Juice.water(ctx, tx, ty, t); }
        const o = obj[row + tx];
        if (!o) continue;
        if (fxFull && SWAY_O[o] && !(flags[row + tx] & 16)) { FX.sway(ctx, o, tx * TS + 8, ty * TS + 8, hash2(tx, ty, 77)); continue; }
        if (autumn && fxFull && (o === O.OAK || o === O.APPLE || o === O.BIRCH)) FX.leafTree(tx * TS + 8, ty * TS - 4, hash2(tx, ty, 78));
        if (o >= 20 && o <= 28) {
          if (W.season === 3 && W.snowyTile(tx, ty)) continue;
          const hv = W.harvested.get(row + tx);
          if (hv !== undefined && hv > day) continue;
          const near = dist2(tx * TS + 8, ty * TS + 8, P.x, P.y) < 60 * 60;
          Spr.herb(ctx, o, tx * TS + 8, ty * TS + 10, t, near);
        } else if (o === O.ARTIFACT) {
          const hv = W.harvested.get(row + tx);
          if (hv === undefined) Spr.sparkle(ctx, tx * TS + 8, ty * TS + 8, t + tx);
        } else if (o === O.CAMPFIRE) { Spr.fire(ctx, tx * TS + 8, ty * TS + 8, t); fires.push([tx * TS + 8, ty * TS + 8]); if (Math.random() < 0.1) this.parts.add('ember', tx * TS + 8, ty * TS + 4, 0, -10, 1, 1); FX.fireSource(tx * TS + 8, ty * TS + 8); }
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
    Juice.sunOn = !this.insideB;   // varlık gölgeleri güneşe göre
    const vis = [];
    for (const e of this.ents) if (e.x > x0 - 40 && e.x < x1 + 40 && e.y > y0 - 40 && e.y < y1 + 40 && !(e.rider === P)) vis.push(e);
    if (P.riding) vis.push(P.riding);
    vis.push(P);
    const flat = (e) => e.dead || e.bound || e.kind === 'pelt' || e.kind === 'crate' ? -20 : 0;   // yerde yatanlar altta çizilir
    vis.sort((a, b) => (a.y + flat(a)) - (b.y + flat(b)));
    for (const e of vis) {
      if (e === P && P.riding) continue;
      if (e.rider === P) { e.draw(ctx); if (e.kind === 'horse' || P.mountAnim) P.draw(ctx); continue; }   // araba sürücüyü kendisi çizer (binme animasyonu hariç)
      if (e.child) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(0.7, 0.7); ctx.translate(-e.x, -e.y); e.draw(ctx); ctx.restore(); continue; }
      e.draw(ctx);
    }
    // mermiler
    for (const p of this.projs) {
      if (p.type === 'arrow') { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.ang) * 7, p.y - Math.sin(p.ang) * 7); ctx.stroke(); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(p.x - Math.cos(p.ang) * 7 - 1, p.y - Math.sin(p.ang) * 7 - 1, 2, 2); }
      else if (p.type === 'lasso') { const o = p.owner; Spr.rope(ctx, o.x, o.y, p.x, p.y, 2); ctx.strokeStyle = '#c8a870'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4.5, 3.2, p.t * 14, 0, TAU); ctx.stroke(); }
      else if (p.type === 'dynamite') { Spr.shadow(ctx, p.x, p.y + 2, 3, 1.5, 0.3); ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.t * 12); ctx.fillStyle = '#b02a20'; ctx.fillRect(-3, -1, 6, 2.4); ctx.restore(); }
    }
    // kementteki kişiye uzanan ip
    if (P.rope) { const e = P.rope, d = dist(P.x, P.y, e.x, e.y); Spr.rope(ctx, P.x, P.y, e.x, e.y, Math.max(0, 44 - d) * 0.25); }
    Juice.sunOn = false;
    this.parts.draw(ctx, x0, y0, x1, y1);
    this.drawCovers(ctx, x0, y0, x1, y1, dt);
    Juice.drawAfterCovers(ctx, x0, y0, x1, y1, dt);
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
    FX.drawHigh(ctx);
    this.drawBirds(ctx);
    Juice.drawHigh(ctx, x0, y0, x1, y1);
    ctx.restore();
    FX.drawClouds(ctx);
    ctx.save();
    ctx.translate(-x0, -y0);
    this.drawWorldUI(ctx);
    ctx.restore();
    this.drawWeather(ctx, dt);
    this.drawLighting(ctx, fires);
    Juice.drawGlow(ctx, x0, y0);
    if (this.amb.flies.length) this.drawFlies(ctx);
    FX.post(ctx, dt);
    Juice.drawScreen(ctx);
    // flaşlar
    if (this.fx.lightning > 0) { ctx.fillStyle = `rgba(230,235,255,${this.fx.lightning * 0.6})`; ctx.fillRect(0, 0, vw, vh); this.fx.lightning = Math.max(0, this.fx.lightning - dt * 3); }
    if (this.fx.boom > 0) { ctx.fillStyle = `rgba(255,220,160,${this.fx.boom})`; ctx.fillRect(0, 0, vw, vh); this.fx.boom = Math.max(0, this.fx.boom - dt * 2); }
    this.fx.flash = Math.max(0, this.fx.flash - dt * 1.5);
    this.fx.muzzle = Math.max(0, this.fx.muzzle - dt);
    // sonraki chunk'lar
    this.prefetch(false);
    W.runJobs(4);
    if (this.binoc) this.binocDraw();
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
      const L = P.lockTarget;
      if (L && !L.dead && (P.aiming || P.rsAim)) {
        // kilit göstergesi: hedefin çevresinde köşe işaretleri
        const hostile = P.targetClass(L) >= 2.5, r = (L.r || 4) + 4 + Math.sin(this.t * 8) * 0.6;
        ctx.fillStyle = hostile ? '#ff4a3a' : 'rgba(255,255,255,0.95)';
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(L.x + sx * r - (sx > 0 ? 2 : 0), L.y + sy * r - (sy > 0 ? 0.6 : 0), 2.6, 0.9); ctx.fillRect(L.x + sx * r - (sx > 0 ? 0.6 : 0), L.y + sy * r - (sy > 0 ? 2 : 0), 0.9, 2.6); }
        enemy = hostile;
      }
      const col = P.deadeye ? '#e03020' : enemy ? '#ff5040' : 'rgba(255,255,255,0.9)';
      ctx.fillStyle = col;
      if (P.aiming || P.rsAim) {
        const sp = P.W && P.W.spread ? P.W.spread * d * (P.deadeye ? 0.2 : 1) * (P.aiming ? 1 : 1.7) * (1 - 0.45 * clamp((P.aimSteady || 0) / 0.7, 0, 1)) + 2 : 3;
        ctx.fillRect(rx - 0.5, ry - 0.5, 1, 1);
        ctx.fillRect(rx - sp - 2, ry - 0.5, 2, 1); ctx.fillRect(rx + sp, ry - 0.5, 2, 1);
        ctx.fillRect(rx - 0.5, ry - sp - 2, 1, 2); ctx.fillRect(rx - 0.5, ry + sp, 1, 2);
        if (P.weapon === 'dynamite') { ctx.strokeStyle = 'rgba(255,200,100,0.6)'; ctx.beginPath(); ctx.arc(rx, ry, 20, 0, TAU); ctx.stroke(); }
      } else { ctx.globalAlpha = 0.5; ctx.fillRect(rx - 0.5, ry - 0.5, 1, 1); ctx.globalAlpha = 1; }
    }
    // yapı kurma önizlemesi: arazinin sınırı (uygun değilse kırmızı)
    const HP = this.homePreview;
    if (HP) {
      if (HP.t !== undefined && (HP.t -= 1 / 60) <= 0) this.homePreview = null;
      ctx.strokeStyle = HP.bad ? 'rgba(230,80,60,0.9)' : 'rgba(240,220,140,0.9)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.strokeRect(HP.tx * TS + 0.5, HP.ty * TS + 0.5, HOME_FW * TS - 1, HOME_FH * TS - 1); ctx.setLineDash([]);
    }
    // hikâye hedefi: üstünde salınan altın elmas
    const qm = this.questMark();
    if (qm && !this.storyTalking() && Math.abs(qm.x - this.cam.x) < this.vw / 2 + 10 && Math.abs(qm.y - this.cam.y) < this.vh / 2 + 10) {
      const b = Math.sin(this.t * 4) * 1.5, y = qm.y - (qm.kind ? 20 : 12) + b;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(qm.x, y - 5); ctx.lineTo(qm.x + 4.5, y); ctx.lineTo(qm.x, y + 5); ctx.lineTo(qm.x - 4.5, y); ctx.fill();
      ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.moveTo(qm.x, y - 4); ctx.lineTo(qm.x + 3.5, y); ctx.lineTo(qm.x, y + 4); ctx.lineTo(qm.x - 3.5, y); ctx.fill();
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
    const wind = clamp(FX.wind.x * 0.55, -0.4, 0.4);
    if (env.rain > 0.05) {
      ctx.strokeStyle = `rgba(190,205,225,${0.25 + env.rain * 0.35})`; ctx.lineWidth = 1;
      ctx.beginPath();
      const n = Math.floor(this.rain.length * env.rain);
      for (let i = 0; i < n; i++) {
        const r = this.rain[i];
        r.y += dt * 1.6 * r.s; r.x += dt * wind * r.s;
        if (r.y > 1) { r.y -= 1; r.x = Math.random(); }
        if (r.x > 1) r.x -= 1; if (r.x < 0) r.x += 1;
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
        r.y += dt * 0.12 * r.s; r.x += dt * (wind * 0.25 + Math.sin(this.t + i) * 0.03);
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
    // gün doğumu / batımı renkleri FX.post içindeki derecelendirmede
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
      if (L.type === 'window' && (!night || !Juice.windowLit(L))) continue;
      if (L.type === 'lamp' && !night) continue;
      if (L.type === 'inner' && !(this.insideB && this.insideB.id === L.b)) continue;
      const fl = L.type === 'fire' ? Juice.flicker(L.x, this.t, 0.08) : L.type === 'lamp' ? Juice.flicker(L.x + L.y, this.t * 0.6, 0.035) : 1;
      lights.push([L.x, L.y, L.r * fl, L.type === 'window' ? 0.75 : 1]);
    }
    for (const [x, y] of fires) lights.push([x, y, 80 * Juice.flicker(x * 0.37 + y, this.t, 0.07), 1]);
    if (this.camp) lights.push([this.camp.x, this.camp.y, 90 * Juice.flicker(3.1, this.t, 0.07), 1]);
    for (const f of Juice.flashes) if (inView(f.x, f.y, 80)) lights.push([f.x, f.y, 80, f.t * 12]);
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
    UI.help(Tr`${t.n} doktoru seni ölümün kıyısından döndürdü. <b>${fmtMoney(lost)}</b> kaybettin ve vücudunda kalıcı izler kaldı (maks. sağlık -3).`, 9);
    this.saveGame(true);
  },
};
Object.defineProperties(G, Object.getOwnPropertyDescriptors(GameSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(CarrySystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(TownLifeSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(NpcNav));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(NpcMind));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(NpcActs));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(WorldSave));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(BizSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(HaulSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(HunterSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(PokerSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(BinocSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(HomeSystems));
Object.defineProperties(G, Object.getOwnPropertyDescriptors(Story));
