'use strict';
/* ==========================================================
   DUSTBOUND — oyun sistemleri (G nesnesine eklenir)
   zaman, hava, sıcaklık, hayatta kalma, kanun, doğma,
   etkileşim, rastgele olaylar, başarımlar, yetenekler
   ========================================================== */

const MIN_PER_SEC = 2.2; // gerçek saniye başına oyun dakikası

const GameSystems = {
  /* ================= ZAMAN ================= */
  get dpy() { return (LIFE_PACES.find(p => p.id === this.pace) || LIFE_PACES[1]).dpy; },
  get day() { return Math.floor(this.clock / 1440); },
  get hour() { return (this.clock / 60) % 24; },
  get age() { return START_AGE + Math.floor(this.day / this.dpy); },
  get year() { return START_YEAR + Math.floor(this.day / this.dpy); },
  get season() { return Math.floor(((this.day % this.dpy) / this.dpy) * 4) % 4; },
  get isNight() { const h = this.hour; return h < 5.5 || h > 20.5; },
  get daylight() {
    const h = this.hour;
    if (h < 4.5 || h > 21.5) return 0;
    if (h < 7) return (h - 4.5) / 2.5;
    if (h > 19) return (21.5 - h) / 2.5;
    return 1;
  },
  timeStr() { const h = Math.floor(this.hour), m = Math.floor(this.clock % 60); return pad2(h) + ':' + pad2(m); },
  dateStr() { return `${SEASONS[this.season]} ${this.year} • Gün ${this.day % this.dpy + 1}`; },

  advanceClock(mins) {
    const prevDay = this.day, prevAge = this.age;
    this.clock += mins;
    if (this.day !== prevDay) for (let d = prevDay + 1; d <= this.day; d++) this.onNewDay(d);
    if (this.age !== prevAge) for (let a = prevAge + 1; a <= this.age; a++) this.onBirthday(a);
  },
  onNewDay(d) {
    // mülk geliri
    let inc = 0;
    for (const id of this.props) { const P = PROPERTIES.find(p => p.id === id); if (P && P.income) inc += P.income; }
    if (inc > 0) { inc *= this.hasPerk('tycoon') ? 1.5 : 1; this.bank += inc; UI.feed(`🏠 Mülk geliri bankaya yatırıldı: ${fmtMoney(inc)}`); this.stats.earned += inc; }
    this.bounties = null; // ilanlar yenilenir
    this.dailyTalk = {};
    this.saveGame(true);
  },
  onBirthday(age) {
    UI.toast(`${age} Yaşındasın`, age >= GOAL_AGE ? 'Bir efsane oldun.' : pick(['Doğum günün kutlu olsun.', 'Bir yıl daha geride kaldı.', 'Batı seni yaşlandırıyor ama yıkamıyor.', 'Zaman akıp gidiyor.']), 'year');
    // yaşlılık hastalıkları
    if (age >= 62 && Math.random() < 0.15 + (age - 62) * 0.012) {
      this.player.sick = Math.max(this.player.sick, 30);
      UI.help('Yaşın ilerledikçe bünyen zayıflıyor. <b>Hastalandın</b>. Bir doktora görün ya da tonik kullan.', 8);
    }
    // aile
    if (this.family.spouse && this.family.children.length < 4 && Math.random() < 0.4 && age < 58) {
      const sex = chance(0.5) ? 'm' : 'f';
      const name = pick(NAMES[sex]);
      this.family.children.push({ name, sex, born: this.year });
      this.stats.children = this.family.children.length;
      UI.toast('Bir Çocuğun Oldu!', `${name} dünyaya geldi.`, 'family');
    }
    if (this.bank > 0) this.bank *= 1.02;
    if (age >= GOAL_AGE && !this.goalReached) { this.goalReached = true; setTimeout(() => UI.showLegacy(true), 2500); }
  },

  /* ================= HAVA ================= */
  weatherUpdate(dtMin) {
    const W = this.weather;
    W.t -= dtMin;
    if (W.t <= 0) {
      const s = this.season;
      const r = Math.random();
      const wet = [0.35, 0.2, 0.35, 0.45][s];
      let type = 'clear';
      if (r < wet * 0.2) type = 'storm'; else if (r < wet * 0.65) type = 'rain'; else if (r < wet + 0.2) type = 'cloudy'; else if (r < wet + 0.26) type = 'fog';
      W.type = type; W.t = rnd(90, 360);
    }
    const tgt = W.type === 'storm' ? 1 : W.type === 'rain' ? 0.6 : 0;
    W.i = lerp(W.i, tgt, Math.min(1, dtMin * 0.02));
    W.cloud = lerp(W.cloud, W.type === 'clear' ? 0 : W.type === 'fog' ? 0.4 : W.type === 'cloudy' ? 0.5 : 0.8, Math.min(1, dtMin * 0.02));
    W.fogI = lerp(W.fogI || 0, W.type === 'fog' ? 1 : 0, Math.min(1, dtMin * 0.02));
  },
  localWeather(px, py) {
    const W = this.weather;
    const t = this.world.tileAtPx(px, py);
    const h = this.world.climateAt(px, py);
    const out = { rain: 0, snow: 0, dust: 0, fog: 0, cloud: W.cloud, storm: W.type === 'storm' && W.i > 0.6 };
    const cold = h < 0.24 || (this.season === 3 && h < 0.5) || t === T.SNOW;
    const dry = (t === T.DESERT || t === T.REDROCK || t === T.MESA) && h > 0.55;
    if (W.i > 0.05) {
      if (cold) out.snow = W.i;
      else if (dry) { out.dust = W.type === 'storm' ? W.i : 0; out.rain = W.type === 'storm' ? 0 : W.i * 0.15; }
      else out.rain = W.i;
    }
    let fog = W.fogI || 0;
    const hr = this.hour;
    if ((t === T.SWAMP || t === T.MUD) && (hr < 9 || hr > 21)) fog = Math.max(fog, 0.6);
    if (t === T.FOREST && hr > 5 && hr < 8) fog = Math.max(fog, 0.35);
    out.fog = fog;
    return out;
  },
  ambientTemp(px, py) {
    const h = this.world.climateAt(px, py);
    const t = this.world.tileAtPx(px, py);
    let T0 = -4 + h * 40 + this.daylight * 3;
    if (t === T.ROCK || isCliffT(t)) T0 -= 5;
    if (t === T.SNOW) T0 -= 5;
    if (t === T.WATER) T0 -= 2;
    if (t === T.DESERT || t === T.REDROCK) T0 += 3;
    if (t === T.HOTWATER) T0 += 25;
    T0 += SEASON_TEMP[this.season];
    const dry = h > 0.6 && (t === T.DESERT || t === T.REDROCK || t === T.SAND || t === T.DRY);
    T0 -= (1 - this.daylight) * (dry ? 17 : 8);
    const lw = this.envCache || { rain: 0, snow: 0 };
    T0 -= lw.rain * 4 + lw.snow * 6;
    return T0;
  },

  /* ================= HAYATTA KALMA ================= */
  survivalUpdate(dtMin, sleeping) {
    const P = this.player;
    const hours = dtMin / 60;
    const surv = 1 - this.skill('survival') * 0.04;
    // sıcaklık
    const amb = this.ambientTemp(P.x, P.y);
    let felt = amb;
    if (P.coat) felt += ITEMS[P.coat].coat.warm;
    if (P.warmBuff > 0) felt += 8;
    if (this.nearFire) felt += 18;
    if (P.look.hat === 'wide' && amb > 28) felt -= 2;
    if (this.envCache && this.envCache.rain > 0.3 && !(P.coat && ITEMS[P.coat].coat.rain)) felt -= 3;
    if (sleeping) felt = Math.max(felt, 18);
    this.feltTemp = felt;
    const coldT = 3 - (this.hasPerk('cold') ? 6 : 0) - this.skill('survival') * 0.4;
    const hotT = 33 + (this.hasPerk('desert') ? 6 : 0) + this.skill('survival') * 0.4;
    this.coldness = clamp((coldT - felt) / 14, 0, 1);
    this.hotness = clamp((felt - hotT) / 12, 0, 1);
    const act = P.sprinting ? 1.5 : 1;
    const sl = sleeping ? 0.5 : 1;
    P.hunger = Math.max(0, P.hunger - 2.8 * hours * surv * act * sl);
    P.thirst = Math.max(0, P.thirst - 4 * hours * surv * act * sl * (1 + this.hotness * 1.5));
    if (!sleeping) P.energy = Math.max(0, P.energy - 3.4 * hours * (P.drunk > 40 ? 1.5 : 1));
    P.clean = Math.max(0, P.clean - 1 * hours);
    P.drunk = Math.max(0, P.drunk - 25 * hours);
    P.warmBuff = Math.max(0, P.warmBuff - dtMin);
    P.deCore = Math.max(0, P.deCore - 1.2 * hours * (this.hasPerk('deadeye') ? 0.6 : 1));
    if (P.sick > 0) P.sick = Math.max(0, P.sick - hours);
    // bölge istatistikleri
    const t = this.world.tileAtPx(P.x, P.y);
    if (t === T.DESERT || t === T.REDROCK) this.stats.hoursDesert += hours;
    if (amb < 2) this.stats.hoursCold += hours;
    // sağlık
    let reg = 0;
    if (P.hunger > 20 && P.thirst > 20 && P.energy > 10 && P.sick <= 0 && this.coldness < 0.3 && this.hotness < 0.5) {
      reg = 7 + (P.hunger > 60 && P.thirst > 60 ? 6 : 0) + (sleeping ? 8 : 0);
      if (this.hasPerk('married')) reg *= 1.25;
    }
    let dmg = 0, cause = null;
    if (P.hunger <= 0) { dmg += 6; cause = 'açlık'; }
    if (P.thirst <= 0) { dmg += 10; cause = 'susuzluk'; }
    if (this.coldness > 0.1) { dmg += 14 * this.coldness; cause = 'soğuk'; }
    if (this.hotness > 0.5) { dmg += 10 * this.hotness; cause = 'sıcak çarpması'; }
    if (P.energy <= 0) { dmg += 3; cause = cause || 'bitkinlik'; }
    if (P.sick > 0) { dmg += 2.5; cause = cause || 'hastalık'; }
    P.hp = Math.min(P.maxHp, P.hp + reg * hours);
    if (dmg > 0) {
      P.hp -= dmg * hours;
      if (P.hp <= 0) { P.hp = 0; this.playerDied(cause); }
    }
  },
  consume(id) {
    const P = this.player, it = ITEMS[id];
    if (!it || !P.has(id)) return false;
    const e = it.e || {};
    if (it.c === 'horse') return this.useHorseItem(id);
    if (it.c === 'clothing') return this.equipClothing(id);
    if (it.autoUse || id === 'region_map') { this.useRegionMap(); P.removeItem(id); return true; }
    if (id === 'treasure_map') { UI.showTreasureMap(); return true; }
    if (!it.e) { UI.feed('Bu eşya kullanılamaz.', 'warn'); return false; }
    P.removeItem(id, 1);
    const mult = it.c === 'food' && this.hasPerk('eater') ? 1.2 : 1;
    if (e.hunger) P.hunger = clamp(P.hunger + e.hunger * mult, 0, 100);
    if (e.thirst) P.thirst = clamp(P.thirst + e.thirst * mult, 0, 100);
    if (e.health) P.hp = clamp(P.hp + e.health * mult, 0, P.maxHp);
    if (e.stamina) P.sta = clamp(P.sta + e.stamina, 0, P.maxSta);
    if (e.energy) P.energy = clamp(P.energy + e.energy, 0, 100);
    if (e.deadeye) { P.de = clamp(P.de + e.deadeye, 0, 100); P.deCore = clamp(P.deCore + e.deadeye * 0.5, 0, 100); }
    if (e.drunk) P.drunk = clamp(P.drunk + e.drunk, 0, 100);
    if (e.warmth) P.warmBuff = Math.max(P.warmBuff, e.warmth * 4);
    if (e.cure) { if (P.sick > 0) UI.feed('Kendini daha iyi hissediyorsun.'); P.sick = 0; }
    if (e.poison) { P.poison = 0; UI.feed('Zehir etkisini yitirdi.'); }
    if (it.raw && Math.random() < it.raw * (this.hasPerk('eater') ? 0.5 : 1)) { P.sick = Math.max(P.sick, 8); UI.help('Çiğ et yedin ve midenin bozulduğunu hissediyorsun. <b>Hastasın.</b>', 5); }
    if (it.c === 'food') { this.stat('eaten', 1); Audio_.tone(300, 0.08, 'triangle', 0.06); Audio_.tone(240, 0.08, 'triangle', 0.06, null, 0.12); }
    else Audio_.ui('pick');
    UI.feed(`${it.i} ${it.n} kullanıldı`);
    return true;
  },
  drinkCanteen() {
    const P = this.player;
    if (!P.has('canteen')) { UI.feed('Mataran yok.', 'warn'); return; }
    if (P.canteen <= 0) { UI.feed('Matara boş. Bir kuyu ya da nehirde doldur.', 'warn'); return; }
    P.canteen--; P.thirst = Math.min(100, P.thirst + 32);
    Audio_.tone(500, 0.1, 'sine', 0.05, null, 0, 300);
    UI.feed(`🫗 Matara: ${P.canteen}/5`);
  },
  equipClothing(id) {
    const P = this.player, it = ITEMS[id];
    if (it.coat) {
      if (P.coat === id) { P.coat = null; UI.feed(`${it.n} çıkarıldı`); }
      else { P.coat = id; UI.feed(`${it.n} giyildi`); }
    } else if (it.hat) {
      P.look.hat = P.look.hat === it.hat ? 'none' : it.hat;
      UI.feed(P.look.hat === 'none' ? 'Şapka çıkarıldı' : `${it.n} takıldı`);
    }
    P._lk = null;
    return true;
  },
  useHorseItem(id) {
    const h = this.horse, P = this.player;
    if (!h || dist(P.x, P.y, h.x, h.y) > 40) { UI.feed('Atın yakınında olmalısın.', 'warn'); return false; }
    if (id === 'horse_reviver') {
      if (!h.dead) { UI.feed('Atın ayakta.', 'warn'); return false; }
      h.dead = false; h.hp = h.maxHp * 0.5; P.removeItem(id); UI.feed(`${h.name} ayağa kalktı!`); Audio_.neigh(); return true;
    }
    if (h.dead) return false;
    P.removeItem(id);
    if (id === 'hay') { h.hp = Math.min(h.maxHp, h.hp + 40); h.sta = h.maxSta; h.addBond(6); }
    if (id === 'horse_tonic') { h.sta = h.maxSta; h.hp = Math.min(h.maxHp, h.hp + 15); }
    UI.feed(`🐴 ${h.name} beslendi`);
    Audio_.neigh();
    return true;
  },
  useRegionMap() {
    const P = this.player;
    const t = this.nearestTown(P.x, P.y);
    this.revealAt(t.cx, t.cy, 200);
    UI.feed(`📜 ${t.n} çevresinin haritası açıldı`);
  },

  /* ================= YETENEKLER / BAŞARIMLAR ================= */
  skill(k) { return this.skills[k] ? this.skills[k].lv : 1; },
  skillXp(k, xp) {
    const s = this.skills[k];
    if (!s || s.lv >= 10) return;
    s.xp += xp * (this.hasPerk('age30') ? 1.1 : 1);
    const need = Math.round(40 * Math.pow(s.lv, 1.5));
    if (s.xp >= need) {
      s.xp -= need; s.lv++;
      UI.toast(`${SKILLS[k].n} Seviye ${s.lv}`, SKILLS[k].d, 'skill');
      Audio_.chime();
    }
  },
  stat(k, v) { this.stats[k] = (this.stats[k] || 0) + v; },
  hasPerk(id) { return !!this.achieved[id]; },
  checkAchievements() {
    const S = this.stats, P = this.player;
    S.maxCash = Math.max(S.maxCash || 0, P.money);
    S.maxHonor = Math.max(S.maxHonor || 0, this.honor);
    S.minHonor = Math.max(S.minHonor || 0, -this.honor);
    S.maxBounty = Math.max(S.maxBounty || 0, this.law.bounty);
    S.towns = this.visited.size;
    S.discoveries = this.discovered.size;
    S.properties = this.props.length;
    S.married = this.family.spouse ? 1 : 0;
    S.age = this.age;
    for (const A of ACHIEVEMENTS) {
      if (this.achieved[A.id] || !A.s) continue;
      if ((S[A.s] || 0) >= A.v) this.unlock(A.id);
    }
  },
  unlock(id) {
    if (this.achieved[id]) return;
    const A = ACHIEVEMENTS.find(a => a.id === id);
    this.achieved[id] = this.day + 1;
    UI.toast(A.n, A.perk ? 'Kazanım: ' + A.perk : A.d, 'ach');
    Audio_.chime();
  },

  /* ================= ONUR / PARA ================= */
  addHonor(v) {
    if (v > 0 && this.hasPerk('samaritan')) v *= 1.5;
    if (v > 0) v *= 1 + this.skill('charisma') * 0.05;
    const before = this.honor;
    this.honor = clamp(this.honor + v, -100, 100);
    if (Math.abs(v) >= 1) UI.honorFlash(v > 0);
    return this.honor - before;
  },
  earn(v, why) {
    this.player.money += v;
    this.stats.earned += v;
    UI.feed(`💵 +${fmtMoney(v)}${why ? ' — ' + why : ''}`, 'money');
    Audio_.ui('cash');
  },
  spend(v) {
    if (this.player.money < v - 0.001) { UI.feed('Yeterli paran yok.', 'warn'); Audio_.ui('error'); return false; }
    this.player.money -= v;
    return true;
  },
  priceMul(buying) {
    let m = 1;
    if (buying) {
      if (this.hasPerk('rich')) m *= 0.9;
      if (this.hasPerk('age50')) m *= 0.95;
      m *= 1 - this.skill('trade') * 0.02;
      if (this.honor > 50) m *= 0.95; else if (this.honor < -50) m *= 1.1;
      if (this.player.clean < 20) m *= 1.1;
    } else {
      m *= 1 + this.skill('trade') * 0.025;
    }
    return m;
  },
  buyPrice(id) { return ITEMS[id].p * this.priceMul(true); },
  sellPrice(id, shop) {
    const it = ITEMS[id];
    const S = SHOPS[shop];
    if (!S || !S.buy) return 0;
    const r = S.buy[it.c];
    if (!r) return 0;
    let p = it.p * r * this.priceMul(false);
    if (it.c === 'animal' && this.hasPerk('hunt25')) p *= 1.15;
    return Math.max(0.05, p);
  },

  /* ================= KANUN ================= */
  crime(type, x, y, victim) {
    const C = {
      murder: [60, 2, -12, 'Cinayet'], murderLaw: [120, 3, -15, 'Kanun adamı öldürme'], assault: [12, 1, -3, 'Saldırı'], assaultLaw: [25, 2, -4, 'Kanun adamına saldırı'],
      livestock: [15, 1, -3, 'Hayvan öldürme'], livestockHurt: [0, 0, -1, ''], horsetheft: [35, 1, -4, 'At hırsızlığı'], robbery: [20, 1, -6, 'Soygun'],
      storerob: [70, 2, -8, 'Dükkan soygunu'], bankrob: [350, 4, -15, 'Banka soygunu'], looting: [8, 1, -2, 'Ceset soyma'], trample: [15, 1, -3, 'Ezme'],
    }[type];
    if (!C) return;
    const [bounty, lvl, honor, name] = C;
    const always = type === 'storerob' || type === 'bankrob';
    let witness = always;
    if (!witness) {
      for (const e of this.ents) {
        if (e.kind !== 'npc' || e.dead || e === victim || e.hostile || e.role === 'bandit') continue;
        if (e.state === 'hurt') continue;
        if (dist2(e.x, e.y, x, y) < 340 * 340 && this.los(e.x, e.y, x, y)) { witness = true; break; }
      }
    }
    this.addHonor(honor);
    if (!witness || lvl === 0) { if (lvl > 0) UI.feed('Kimse görmedi...'); return; }
    this.law.bounty += bounty;
    this.law.level = Math.max(this.law.level, lvl);
    if (type === 'murderLaw') this.law.level = Math.min(5, this.law.level + 1);
    this.law.lastX = this.player.x; this.law.lastY = this.player.y; this.law.unseen = 0;
    this.law.spawnT = 2;
    UI.wanted(name, bounty);
    // yakındaki kanun adamları düşman
    for (const e of this.ents) if (e.kind === 'npc' && e.isLaw && !e.dead) e.hostile = true;
    for (const e of this.ents) if (e.kind === 'npc' && !e.dead && !e.hostile && e.role !== 'bandit' && dist2(e.x, e.y, x, y) < 300 * 300) { e.state = 'flee'; e.t = 10; }
  },
  lawUpdate(dt) {
    const L = this.law, P = this.player;
    if (L.level <= 0) {
      // tanınma
      if (L.bounty >= 40) {
        const town = this.world.townAt(P.x, P.y);
        if (town) {
          L.recog = (L.recog || 0) + dt;
          for (const e of this.ents) if (e.kind === 'npc' && e.isLaw && !e.dead && dist(e.x, e.y, P.x, P.y) < 70 && L.recog > 6) {
            L.level = 1; L.lastX = P.x; L.lastY = P.y; L.unseen = 0; e.hostile = true;
            UI.wanted('Tanındın! Başında ödül var', 0); e.say('Seni tanıyorum! Başında ödül var!'); L.recog = 0; break;
          }
        } else L.recog = 0;
      }
      return;
    }
    const lawmen = this.ents.filter(e => e.kind === 'npc' && e.isLaw && !e.dead);
    let seen = false;
    for (const e of lawmen) if (e.hostile && e.canSee(P.x, P.y, 280)) { seen = true; break; }
    if (seen) { L.lastX = P.x; L.lastY = P.y; L.unseen = 0; } else L.unseen += dt;
    L.radius = 360 + L.level * 110;
    const out = dist(P.x, P.y, L.lastX, L.lastY) > L.radius;
    const need = this.hasPerk('outlaw') ? 7 : 12;
    if (out && L.unseen > need) {
      L.level = 0;
      UI.feed('Kanundan kaçtın. Ama başındaki ödül hâlâ duruyor.', 'law');
      Audio_.ui('ok');
      for (const e of lawmen) { e.hostile = false; if (!this.world.townAt(e.x, e.y)) e.remove = true; }
      return;
    }
    L.spawnT -= dt;
    if (L.spawnT <= 0) {
      L.spawnT = 7;
      const want = Math.min(8, 1 + L.level * 2);
      if (lawmen.filter(e => e.hostile).length < want) {
        for (let k = 0; k < 2; k++) {
          const pos = this.findSpawnPos(P.x, P.y, 330, 430);
          if (!pos) continue;
          const n = new NPC(pos[0], pos[1], 'law', { hostile: true, mounted: P.riding ? true : chance(0.3), weapon: L.level >= 3 ? 'repeater' : pick(['cattleman', 'repeater']) });
          n.personal = false;
          this.addEnt(n);
        }
      }
    }
  },
  payBounty() {
    const b = this.law.bounty;
    if (b <= 0) return;
    if (this.law.level > 0) { UI.feed('Aranırken ödül ödeyemezsin!', 'warn'); return; }
    if (!this.spend(b)) return;
    this.law.bounty = 0;
    this.addHonor(2);
    UI.feed(`⚖️ ${fmtMoney(b)} ödül ödendi. Artık temizsin.`);
  },

  /* ================= SAVAŞ YARDIMCILARI ================= */
  los(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2), n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) {
      const x = lerp(x1, x2, i / n), y = lerp(y1, y2, i / n);
      const tx = x >> 4, ty = y >> 4;
      const idx = ty * WW + tx;
      if (this.world.solid[idx] && !isWaterT(this.world.tile[idx])) {
        const o = this.world.obj[idx];
        if (this.world.flags[idx] & 8 || o === O.BOULDER || o === O.RUINWALL || isCliffT(this.world.tile[idx]) || (o && o < 20 && SOLID_O[o] && Math.random() < 0.5)) return false;
      }
    }
    return true;
  },
  fireRay(ox, oy, ang, range, dmg, owner, opts = {}) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const W = this.world;
    // duvar mesafesi
    let wallD = range;
    for (let s = 4; s < range; s += 4) {
      const x = ox + dx * s, y = oy + dy * s;
      const idx = (y >> 4) * WW + (x >> 4);
      if (x < 0 || y < 0 || x >= WW * TS || y >= WH * TS) { wallD = s; break; }
      if (W.solid[idx] && !isWaterT(W.tile[idx])) {
        const o = W.obj[idx];
        if ((W.flags[idx] & 8) || isCliffT(W.tile[idx]) || o === O.BOULDER || o === O.RUINWALL || o === O.CRATE || o === O.BARREL || o === O.WAGON || (o && o < 20 && Math.random() < 0.6)) { wallD = s; break; }
      }
    }
    let hit = null, hd = wallD;
    const cands = opts.npc ? [this.player, ...(this.horse && !this.horse.dead ? [this.horse] : []), ...this.ents.filter(e => e.kind === 'npc' && !e.hostile && !e.dead)] : this.ents;
    for (const e of cands) {
      if (e === owner || e.dead || e.remove) continue;
      if (e === this.player && !opts.npc) continue;
      if (e.kind === 'camp' || (e === this.horse && owner === this.player)) continue;
      if (e === this.player.riding && owner === this.player) continue;
      if (opts.npc && e.kind === 'npc' && owner.role === e.role) continue;
      const r = (e.r || 4) + (e.kind === 'horse' ? 3 : 1.5);
      if (Math.abs(e.x - ox) > range + 20 || Math.abs(e.y - oy) > range + 20) continue;
      const t = rayCircle(ox, oy, dx, dy, e.x, e.y, r);
      if (t >= 0 && t < hd) { hd = t; hit = e; }
    }
    const ex = ox + dx * hd, ey = oy + dy * hd;
    this.parts.tracer(ox, oy, ex, ey);
    if (hit) {
      if (hit === this.player) hit.hurt(dmg, owner && owner.role === 'law' ? 'kanun' : 'haydut');
      else hit.hurt(dmg, owner === this.player ? 'player' : 'npc', 'gun');
      if (owner === this.player && hit.dead && hd > 400) this.stat('longKills', 1);
    } else {
      this.parts.burst('debris', ex, ey, 3, 30, 0.4, 1, '#8a7a6a');
      if (W.isWaterPx(ex, ey)) this.parts.add('splash', ex, ey, 0, 0, 0.5, 4);
    }
    return hit;
  },
  explode(x, y, owner) {
    Audio_.boom(clamp(1 - dist(x, y, this.player.x, this.player.y) / 900, 0.1, 1));
    this.parts.burst('smoke', x, y, 16, 50, 2, 5, '80,70,60');
    this.parts.burst('spark', x, y, 30, 140, 0.6, 1);
    this.parts.burst('debris', x, y, 14, 110, 0.9, 2, '#5a4a3a');
    this.parts.add('flash', x, y, 0, 0, 0.25, 26);
    this.parts.add('ring', x, y, 0, 0, 0.4, 50);
    this.fx.shake = 9; this.fx.boom = 0.35;
    Input.rumble(1, 1, 400);
    const R = 55;
    for (const e of [...this.ents, this.player]) {
      if (e.dead || !e.hurt) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < R) e.hurt(WEAPONS.dynamite.dmg * (1 - d / R) + 10, e === this.player ? 'patlama' : (owner === this.player ? 'player' : 'npc'), 'explosion');
    }
    this.noise(x, y, 900, 'gun');
  },
  noise(x, y, r, type) {
    for (const e of this.ents) {
      if (e.dead) continue;
      const d2 = dist2(e.x, e.y, x, y);
      if (d2 > r * r) continue;
      if (e.kind === 'animal') {
        if (e.def.beh === 'hostile' && d2 < 200 * 200) { e.state = 'attack'; e.t = 15; }
        else if (e.def.beh !== 'hostile') { e.state = 'flee'; e.t = rnd(6, 10); e.fleeFrom({ x, y }); }
      } else if (e.kind === 'npc' && !e.hostile && e.role !== 'bandit' && type === 'gun') {
        if (e.state !== 'hurt' && e.state !== 'static') { e.state = e.role === 'town' && chance(0.4) ? 'cower' : 'flee'; e.t = rnd(5, 10); if (chance(0.2)) e.say(pick(LINES.flee), 2); if (e.state === 'cower') setTimeout(() => { if (e.state === 'cower') e.state = 'idle'; }, 8000); }
      } else if (e.kind === 'horse' && e.owner !== 'player' && !e.rider && type === 'gun' && !e.hitch) { e.state = 'flee'; e.t = 5; e.ang = Math.atan2(e.y - y, e.x - x); }
      else if (e.kind === 'npc' && e.role === 'bandit' && type === 'gun' && d2 < 500 * 500) e.aggro = true;
    }
    if (type === 'gun' && this.horse && !this.horse.dead && !this.horse.rider && this.horse.bondLv < 2 && Math.random() < 0.3) { this.horse.state = 'flee'; this.horse.t = 3; this.horse.ang = Math.random() * TAU; }
  },
  onAnimalKill(a, how) {
    this.stat('animals', 1);
    if (a.type === 'bear') this.stat('bears', 1);
    this.skillXp('hunting', a.def.xp);
    if (a.def.owned) this.crime('livestock', a.x, a.y, a);
    const d = dist(this.player.x, this.player.y, a.x, a.y);
    if (d > 400) this.stat('longKills', 1);
  },
  onNpcKill(n, how) {
    this.stat('kills', 1);
    if (n.role === 'bandit' || n.role === 'target') { this.stat('bandits', 1); this.addHonor(1); this.skillXp('shooting', 6); }
    else if (n.isLaw) { if (!n.hostile || this.law.level === 0) this.crime('murderLaw', n.x, n.y, n); else { this.law.bounty += 40; this.law.level = Math.min(5, this.law.level + (chance(0.4) ? 1 : 0)); this.addHonor(-4); UI.wanted('Kanun adamı öldürüldü', 40); } }
    else if (!n.hostile) { if (n.assaulted) { this.law.bounty = Math.max(0, this.law.bounty - 12); this.addHonor(3); } this.crime(how === 'trample' ? 'trample' : 'murder', n.x, n.y, n); }
    if (n.event && n.event.onDeath) n.event.onDeath(n);
    if (n.role === 'target' && this.activeBounty && n.bountyId === this.activeBounty.id) {
      this.activeBounty.done = true;
      UI.toast('Hedef Etkisiz Hale Getirildi', `${n.name} — ödülü bir şerif ofisinden al.`, 'bounty');
    }
    if (this.player.deadeye) this.stat('deadeyeKills', 1);
  },
  playerDied(cause) {
    if (this.state !== 'play') return;
    this.state = 'dead';
    this.deathCause = cause || 'bilinmeyen';
    this.player.deadeye = false;
    if (this.player.riding) this.player.dismount();
    Audio_.stopMusic();
    Audio_.playMusic('death');
    setTimeout(() => UI.showDeath(), 1800);
  },

  /* ================= AT ================= */
  whistle() {
    const P = this.player, h = this.horse;
    Audio_.whistle();
    if (P.riding) return;
    if (!h) { UI.feed('Bir atın yok. Ahırdan satın alabilir ya da yabani bir atı evcilleştirebilirsin.', 'warn'); return; }
    if (h.dead) { UI.feed(`${h.name} yaralı yatıyor. At Diriltici gerekli.`, 'warn'); return; }
    const d = dist(P.x, P.y, h.x, h.y);
    if (d > 1100) {
      const pos = this.findSpawnPos(P.x, P.y, 200, 280, true);
      if (pos) { h.x = pos[0]; h.y = pos[1]; }
    }
    if (d > 26) { h.state = 'come'; h.t = 30; setTimeout(() => Audio_.neigh(), 500); }
  },
  setHorse(h, silent) {
    if (this.horse && this.horse !== h && !this.horse.dead) {
      const old = this.horse;
      this.stable.push({ breed: old.breed, name: old.name, look: old.look, bond: old.bond });
      if (this.stable.length > 3) this.stable.shift();
      old.remove = true;
      if (!silent) UI.feed(`${old.name} ahıra gönderildi.`);
    } else if (this.horse && this.horse.dead) this.horse.remove = true;
    h.owner = 'player'; h.saddle = true; h.hitch = false;
    this.horse = h;
    if (!this.ents.includes(h)) this.addEnt(h);
  },

  /* ================= DOĞMA (SPAWN) ================= */
  addEnt(e) { this.ents.push(e); return e; },
  findSpawnPos(cx, cy, r0, r1, road) {
    const W = this.world;
    for (let k = 0; k < 24; k++) {
      const a = Math.random() * TAU, r = rnd(r0, r1);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (x < 40 || y < 40 || x > WW * TS - 40 || y > WH * TS - 40) continue;
      if (W.blocked(x, y, 6) || W.isWaterPx(x, y)) continue;
      return [x, y];
    }
    return null;
  },
  spawnTick() {
    const P = this.player, W = this.world;
    const ents = this.ents;
    // uzaktakileri temizle
    for (const e of ents) {
      const d = dist(e.x, e.y, P.x, P.y);
      if (e === this.horse || e.kind === 'camp' || e.keep) continue;
      if (e.kind === 'animal' && (d > 1200 || (e.dead && e.deadT > 200 && d > 500))) e.remove = true;
      if (e.kind === 'npc' && !e.town && d > 1400 && !e.bountyId) e.remove = true;
      if (e.kind === 'npc' && e.dead && e.deadT > 180 && d > 450) e.remove = true;
      if (e.kind === 'horse' && e.owner !== 'player' && d > 1300 && !e.hitch) e.remove = true;
    }
    // kasabalar
    for (const t of W.towns) {
      const d = dist(t.cx, t.cy, P.x, P.y);
      if (d < 1100 && !t.spawned) this.spawnTown(t);
      else if (d > 1500 && t.spawned) { t.spawned = false; for (const e of ents) if (e.town === t.id) e.remove = true; }
    }
    // çiftlikler & kamplar
    for (const p of W.pois) {
      const d = dist(p.x, p.y, P.x, P.y);
      if (p.kind === 'farm') {
        if (d < 700 && !p.spawned) {
          p.spawned = true;
          const b = W.buildings[p.building];
          const n = new NPC(b.door.x, b.door.y + 6, 'farmer', { home: { x: b.door.x, y: b.door.y + 10, r: 30 }, state: 'idle' });
          n.poi = p.pid; n.keepPoi = true; this.addEnt(n);
          for (let k = 0; k < 4; k++) { const c = new Animal(p.x + rnd(-60, 60), p.y + rnd(40, 110), chance(0.6) ? 'cow' : 'chicken'); c.home = { x: p.x, y: p.y + 70, r: 80 }; c.poi = p.pid; this.addEnt(c); }
        } else if (d > 1100 && p.spawned) { p.spawned = false; for (const e of ents) if (e.poi === p.pid) e.remove = true; }
      }
      if (p.kind === 'camp') {
        const cleared = this.campCleared[p.pid];
        if (d < 600 && !p.spawned && !(cleared !== undefined && this.day - cleared < 3)) {
          p.spawned = true;
          const n = rndi(3, 5);
          for (let k = 0; k < n; k++) {
            const pos = this.findSpawnPos(p.x, p.y, 20, 70);
            if (!pos) continue;
            const b = new NPC(pos[0], pos[1], 'bandit', { hostile: true, home: { x: p.x, y: p.y, r: 60 }, money: rnd(3, 15) });
            b.poi = p.pid; b.camp = p.pid; this.addEnt(b);
          }
        } else if (p.spawned && d > 1100) { p.spawned = false; for (const e of ents) if (e.poi === p.pid && !e.dead) e.remove = true; }
        if (p.spawned && !cleared) {
          const alive = ents.some(e => e.camp === p.pid && !e.dead && !e.remove);
          if (!alive && ents.some(e => e.camp === p.pid)) { this.campCleared[p.pid] = this.day; UI.toast('Kamp Temizlendi', p.n, 'bounty'); this.addHonor(4); for (const e of ents) if (e.camp === p.pid) e.camp = -1; }
        } else if (p.spawned && cleared !== undefined && this.day - cleared >= 3) delete this.campCleared[p.pid];
      }
      if (p.kind === 'property' && this.props.includes(p.prop) && this.family.spouse) {
        if (d < 600 && !p.spawned) {
          p.spawned = true;
          const b = W.buildings[p.building];
          const s = this.family.spouse;
          const n = new NPC(b.door.x + 10, b.door.y + 10, 'spouse', { look: s.look, name: s.name, home: { x: b.door.x, y: b.door.y + 16, r: 40 } });
          n.poi = p.pid; n.keep = true; this.addEnt(n);
          this.family.children.forEach((c, i) => { const k = new NPC(b.door.x - 10 - i * 8, b.door.y + 16, 'child', { look: randomLook(c.sex), name: c.name, home: { x: b.door.x, y: b.door.y + 20, r: 50 } }); k.child = true; k.poi = p.pid; k.keep = true; this.addEnt(k); });
        } else if (d > 1100 && p.spawned) { p.spawned = false; for (const e of ents) if (e.poi === p.pid) e.remove = true; }
      }
    }
    // av hayvanları
    const inTown = W.townAt(P.x, P.y, 20);
    const nearAnimals = ents.filter(e => e.kind === 'animal' && !e.dead && !e.def.owned && dist2(e.x, e.y, P.x, P.y) < 1000 * 1000).length;
    const tgt = inTown ? 0 : 14;
    if (nearAnimals < tgt) this.spawnAnimals();
    // yolcular
    this.travelT -= 1;
    if (this.travelT <= 0 && !inTown) {
      this.travelT = rndi(12, 30);
      const cnt = ents.filter(e => e.role === 'traveler' && !e.dead).length;
      if (cnt < 4) this.spawnTraveler();
    }
    // av ödülü hedefi
    const B = this.activeBounty;
    if (B && !B.done && !B.spawned && dist(P.x, P.y, B.x, B.y) < 650) {
      B.spawned = true;
      const t = new NPC(B.x, B.y, 'target', { hostile: true, name: B.name, hp: 170, weapon: 'repeater', home: { x: B.x, y: B.y, r: 40 }, money: rnd(10, 30) });
      t.bountyId = B.id; t.keep = true; this.addEnt(t);
      for (let k = 0; k < B.hench; k++) { const pos = this.findSpawnPos(B.x, B.y, 20, 60); if (pos) { const h = new NPC(pos[0], pos[1], 'bandit', { hostile: true, home: { x: B.x, y: B.y, r: 60 } }); h.keep = true; this.addEnt(h); } }
    }
    // rastgele olaylar
    this.eventT -= 1;
    if (this.eventT <= 0 && !inTown) { this.eventT = rndi(80, 170); this.spawnEvent(); }
    // tümünü temizle
    this.ents = this.ents.filter(e => !e.remove);
    if (this.horse && this.horse.remove) this.horse = null;
  },
  spawnAnimals() {
    const P = this.player, W = this.world;
    const pos = this.findSpawnPos(P.x, P.y, 420, 640);
    if (!pos) return;
    const biome = W.biomeAt(pos[0], pos[1]);
    const cands = [];
    let total = 0;
    for (const k in ANIMALS) {
      const A = ANIMALS[k];
      let w = A.b[biome] || 0;
      if (!w) continue;
      if (this.isNight && A.night) w *= A.night;
      if (k === 'bear' || k === 'cougar') w *= 0.6;
      cands.push([k, w]); total += w;
    }
    if (!total) return;
    let r = Math.random() * total, type = cands[0][0];
    for (const [k, w] of cands) { r -= w; if (r <= 0) { type = k; break; } }
    const A = ANIMALS[type];
    const n = rndi(A.grp[0], A.grp[1]);
    let leader = null;
    for (let i = 0; i < n; i++) {
      const x = pos[0] + rnd(-30, 30), y = pos[1] + rnd(-30, 30);
      if (W.blocked(x, y, 5) || W.isWaterPx(x, y) && type !== 'gator') continue;
      const a = new Animal(x, y, type);
      if (leader) a.leader = leader; else leader = a;
      this.addEnt(a);
    }
  },
  spawnTown(t) {
    t.spawned = true;
    const W = this.world;
    const n = t.sz === 'l' ? 18 : t.sz === 'm' ? 13 : 9;
    const streets = t.streets;
    for (let i = 0; i < n; i++) {
      const sy = pick(streets);
      const x = (t.x + 3 + Math.random() * (t.w - 6)) * TS, y = (sy + 1) * TS + 8;
      if (W.blocked(x, y, 4)) continue;
      const npc = new NPC(x, y, 'town', { home: { x, y, r: rnd(60, 160) } });
      npc.town = t.id; this.addEnt(npc);
    }
    const sheriff = t.buildings.find(b => b.type === 'sheriff');
    if (sheriff) for (let i = 0; i < 2; i++) {
      const x = sheriff.door.x + rnd(-30, 30), y = sheriff.door.y + 20;
      const law = new NPC(x, y, 'law', { home: { x, y, r: 200 } });
      law.town = t.id; this.addEnt(law);
    }
    // romantik NPC
    const R = this.romances[t.id];
    if (R && !(this.family.spouse && this.family.spouse.id === R.id)) {
      const b = pick(t.buildings.filter(b => b.type !== 'station'));
      const npc = new NPC(b.door.x + 6, b.door.y + 12, 'romance', { look: R.look, name: R.name, home: { x: b.door.x, y: b.door.y + 16, r: 70 } });
      npc.town = t.id; npc.romId = R.id; this.addEnt(npc);
    }
    // bağlı atlar
    if (t.hitch) for (const h of t.hitch) if (chance(0.6)) {
      const horse = new Horse(h.x, h.y + 10, pick(['morgan', 'tennessee', 'mustang', 'nag']), { owner: 'npc' });
      horse.ang = Math.PI / 2; horse.hitch = true; horse.town = t.id; this.addEnt(horse);
    }
    for (let i = 0; i < 3; i++) {
      const b = pick(t.buildings);
      const c = new Animal(b.door.x + rnd(-20, 20), b.door.y + 16, 'chicken');
      c.home = { x: b.door.x, y: b.door.y + 16, r: 40 }; c.town = t.id; c.keepTown = true; this.addEnt(c);
    }
    for (const e of this.ents) if (e.town === t.id && e.kind === 'animal') e.keep = false;
  },
  spawnTraveler() {
    const P = this.player;
    const W = this.world;
    let best = null;
    for (let tries = 0; tries < 10 && !best; tries++) {
      const r = pick(W.roads);
      if (r.spur) continue;
      const i = rndi(0, r.pts.length - 1);
      const [x, y] = r.pts[i];
      const d = dist(x, y, P.x, P.y);
      if (d > 320 && d < 560) best = { r, i, x, y };
    }
    if (!best) return;
    const dir = chance(0.5) ? 1 : -1;
    const npc = new NPC(best.x, best.y, 'traveler', { path: best.r.pts, pi: best.i, pdir: dir, mounted: chance(0.45), weapon: chance(0.3) ? 'cattleman' : null });
    this.addEnt(npc);
  },

  /* ================= RASTGELE OLAYLAR ================= */
  spawnEvent() {
    const P = this.player;
    const ahead = P.riding ? P.riding.ang : P.ang;
    const cx = P.x + Math.cos(ahead) * 360, cy = P.y + Math.sin(ahead) * 360;
    const pos = this.findSpawnPos(cx, cy, 0, 120);
    if (!pos) return;
    const [x, y] = pos;
    const types = ['injured', 'snakebite', 'robbery', 'ambush', 'wagon', 'peddler', 'lostitem'];
    if (this.isNight) types.push('wolves', 'wolves');
    const type = pick(types);
    const ev = { type, x, y, done: false };
    if (type === 'injured' || type === 'snakebite') {
      const n = new NPC(x, y, 'stranger', { state: 'hurt', event: ev });
      n.eventType = type; this.addEnt(n);
      setTimeout(() => n.say(type === 'injured' ? 'Yardım edin... lütfen... vuruldum...' : 'Yılan... yılan soktu beni! Yardım edin!'), 400);
    } else if (type === 'robbery') {
      const v = new NPC(x, y, 'stranger', { state: 'cower', event: ev });
      v.eventType = 'victim'; this.addEnt(v);
      const b = new NPC(x + 14, y + 4, 'bandit', { hostile: true, home: { x, y, r: 20 } });
      b.state = 'robbing'; b.ang = Math.PI; b.event = ev; b.aggro = false; this.addEnt(b);
      ev.bandit = b; ev.victim = v;
      ev.onDeath = (who) => {
        if (who === b && !v.dead && !ev.done) {
          ev.done = true;
          setTimeout(() => { if (v.dead) return; v.say('Hayatımı kurtardın! Al, bu senin.'); this.earn(rndi(4, 12), 'Teşekkür'); this.addHonor(6); this.stat('helped', 1); v.state = 'idle'; v.path = null; }, 800);
        }
      };
      setTimeout(() => v.say('Yardım edin! Soyuluyorum!'), 300);
    } else if (type === 'ambush') {
      const n = rndi(2, 4);
      for (let k = 0; k < n; k++) { const p = this.findSpawnPos(x, y, 10, 90); if (p) { const b = new NPC(p[0], p[1], 'bandit', { hostile: true, home: { x, y, r: 50 } }); b.aggro = false; this.addEnt(b); } }
    } else if (type === 'wagon') {
      const n = new NPC(x, y, 'stranger', { state: 'static', event: ev });
      n.eventType = 'wagon'; this.addEnt(n);
      ev.wagon = { x: x + 14, y: y - 4 };
      setTimeout(() => n.say('Hey dostum! Arabamın tekerleği kırıldı, bir el atar mısın?'), 400);
    } else if (type === 'peddler') {
      const n = new NPC(x, y, 'stranger', { state: 'static', event: ev, look: Object.assign(randomLook('m'), { hat: 'bowler', coat: '#4a2a3a' }) });
      n.eventType = 'peddler'; this.addEnt(n);
      setTimeout(() => n.say('Tonikler, iksirler, mücevherler! Gel bak, yabancı!'), 400);
    } else if (type === 'wolves') {
      for (let k = 0; k < rndi(3, 4); k++) { const p = this.findSpawnPos(x, y, 0, 60); if (p) { const a = new Animal(p[0], p[1], 'wolf'); a.state = 'attack'; a.t = 30; this.addEnt(a); } }
      Audio_.growl();
    } else if (type === 'lostitem') {
      ev.item = pick(['pocket_watch', 'gold_ring', 'old_coin', 'cig_card', 'necklace']);
      this.lostItems.push({ x, y, item: ev.item });
    }
    this.events.push(ev);
  },

  /* ================= KEŞİF / HARİTA ================= */
  revealAt(px, py, r) {
    const cx = px / TS / 4, cy = py / TS / 4, cr = r / TS / 4;
    const M = this.reveal;
    let changed = false;
    const fc = this.fogCtx;
    for (let y = Math.floor(cy - cr); y <= Math.ceil(cy + cr); y++) {
      if (y < 0 || y >= 256) continue;
      for (let x = Math.floor(cx - cr); x <= Math.ceil(cx + cr); x++) {
        if (x < 0 || x >= 256) continue;
        const i = y * 256 + x;
        if (M[i]) continue;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > cr * cr) continue;
        M[i] = 1; changed = true;
        fc.clearRect(x, y, 1, 1);
      }
    }
    return changed;
  },
  rebuildFog() {
    const c = this.fogCanvas, fc = this.fogCtx;
    fc.globalCompositeOperation = 'source-over';
    fc.fillStyle = '#c9b48a'; fc.fillRect(0, 0, 256, 256);
    const img = fc.getImageData(0, 0, 256, 256), d = img.data;
    for (let i = 0; i < 65536; i++) {
      if (this.reveal[i]) d[i * 4 + 3] = 0;
      else { const n = (hash2(i & 255, i >> 8, 42) - 0.5) * 18; d[i * 4] += n; d[i * 4 + 1] += n; d[i * 4 + 2] += n; }
    }
    fc.putImageData(img, 0, 0);
  },
  discoverUpdate() {
    const P = this.player, W = this.world;
    const r = 150 * (this.hasPerk('explore5') ? 1.35 : 1);
    this.revealAt(P.x, P.y, r);
    // kasabalar
    const t = W.townAt(P.x, P.y, 6);
    if (t) {
      if (!this.visited.has(t.id)) { this.visited.add(t.id); this.revealAt(t.cx, t.cy, 800); this.skillXp('survival', 5); }
      if (this.curTown !== t.id) { this.curTown = t.id; UI.locationTitle(t.n, W.regionAt(t.cx, t.cy)); }
    } else this.curTown = null;
    // bölge
    const reg = W.regionAt(P.x, P.y);
    if (reg !== this.curRegion) { if (this.curRegion) UI.locationTitle(reg, ''); this.curRegion = reg; }
    // yerler
    for (const p of W.pois) {
      if (this.discovered.has(p.id)) continue;
      if (dist2(p.x, p.y, P.x, P.y) < 110 * 110) {
        this.discovered.add(p.id);
        if (p.kind === 'landmark' || p.kind === 'camp') {
          UI.locationTitle(p.n, 'Keşfedildi');
          Audio_.discover();
          this.skillXp('survival', 8);
          if (p.type === 'lookout') { this.revealAt(p.x, p.y, 1400); UI.help('Bu yüksek noktadan etrafı gözlemledin. <b>Haritanın büyük bir kısmı açıldı.</b>', 6); }
        } else UI.feed(`📍 Keşfedildi: ${p.n}`);
      }
    }
  },
  nearestTown(px, py, filter) {
    let best = null, bd = 1e18;
    for (const t of this.world.towns) { if (filter && !filter(t)) continue; const d = dist2(px, py, t.cx, t.cy); if (d < bd) { bd = d; best = t; } }
    return best;
  },

  /* ================= GPS ================= */
  setWaypoint(x, y) {
    if (x === null) { this.waypoint = null; this.gps = null; return; }
    this.waypoint = { x, y };
    this.computeGps();
    Audio_.ui('ok');
  },
  computeGps() {
    const P = this.player, W = this.world, wp = this.waypoint;
    if (!wp) return;
    const C = W.cost;
    const s = [clamp((P.x / TS / CG) | 0, 0, CW - 1), clamp((P.y / TS / CG) | 0, 0, CHH - 1)];
    const g = [clamp((wp.x / TS / CG) | 0, 0, CW - 1), clamp((wp.y / TS / CG) | 0, 0, CHH - 1)];
    const path = W.astar(s[0], s[1], g[0], g[1], (ni) => { const c = C[ni]; return c >= 1e5 ? 4 : c > 20 ? 40 : c; });
    this.gps = path ? path.map(p => [p[0] * TS + 8, p[1] * TS + 8]) : null;
    this.gpsT = 4;
  },

  /* ================= ETKİLEŞİM ================= */
  findInteraction() {
    const P = this.player, W = this.world;
    const cands = [];
    const add = (x, y, label, actions, pri = 0) => { const d = dist(P.x, P.y, x, y) - pri; cands.push({ x, y, label, actions, d }); };
    if (P.riding) {
      const acts = [{ n: 'İn', fn: () => P.dismount() }];
      // at sırtından kapı/tren vb. yok
      return { x: P.x, y: P.y, label: P.riding.name || 'At', actions: acts, riding: true };
    }
    // varlıklar
    for (const e of this.ents) {
      if (e.remove) continue;
      const d = dist(P.x, P.y, e.x, e.y);
      if (d > 30) continue;
      if (e.kind === 'horse') {
        if (e === this.horse) {
          if (e.dead) { add(e.x, e.y, e.name, [{ n: 'At Diriltici Kullan', fn: () => this.consume('horse_reviver') }]); continue; }
          const acts = [{ n: 'Bin', fn: () => P.mount(e) }, { n: 'Atı Okşa', fn: () => { e.addBond(3); Audio_.neigh(); UI.feed(`${e.name} mutlu görünüyor.`); } }];
          if (P.has('horse_brush')) acts.push({ n: 'Fırçala', fn: () => { e.addBond(5); e.dirty = 0; UI.feed(`${e.name} tertemiz oldu.`); } });
          if (P.has('hay')) acts.push({ n: 'Saman Ver', fn: () => this.consume('hay') });
          if (P.has('horse_tonic')) acts.push({ n: 'At Toniği Ver', fn: () => this.consume('horse_tonic') });
          acts.push({ n: 'Heybeyi Aç', fn: () => UI.openSatchel() });
          add(e.x, e.y, e.name, acts, 4);
        } else if (!e.dead && !e.rider && e.owner === 'npc') {
          add(e.x, e.y, 'Başkasının Atı', [{ n: 'Atı Çal', fn: () => { this.crime('horsetheft', e.x, e.y); this.setHorse(e); P.mount(e); } }]);
        }
        continue;
      }
      if (e.kind === 'animal') {
        if (e.dead && !e.skinned) add(e.x, e.y, e.def.n + ' Leşi', [{ n: 'Derisini Yüz', hold: 1.3, fn: () => this.skin(e) }]);
        else if (!e.dead && e.def.tame && d < 26) add(e.x, e.y, e.def.n, [{ n: 'Sakinleştir ve Evcilleştir', hold: 2.5, fn: () => this.tameHorse(e), check: () => P.crouch || e.state !== 'flee' }]);
        continue;
      }
      if (e.kind === 'camp') { add(e.x, e.y, 'Kamp', [{ n: 'Kamp Menüsü', fn: () => UI.openCamp() }], 4); continue; }
      if (e.kind === 'npc') {
        if (e.dead) { if (!e.looted) add(e.x, e.y, e.name, [{ n: 'Cesedi Ara', hold: 0.8, fn: () => this.lootBody(e) }]); continue; }
        if (e.hostile && e.aggro) continue;
        const acts = this.npcActions(e);
        if (acts.length) add(e.x, e.y, e.name, acts, 3);
      }
    }
    // kayıp eşyalar
    for (let i = 0; i < this.lostItems.length; i++) {
      const L = this.lostItems[i];
      if (dist2(P.x, P.y, L.x, L.y) < 26 * 26) add(L.x, L.y, 'Yerde bir şey parlıyor', [{ n: 'Al', fn: () => { P.addItem(L.item); this.lostItems.splice(i, 1); } }]);
    }
    // olay arabası
    for (const ev of this.events) if (ev.wagon && !ev.done && dist2(P.x, P.y, ev.wagon.x, ev.wagon.y) < 30 * 30) add(ev.wagon.x, ev.wagon.y, 'Kırık Araba', [{ n: 'Tekerleği Tamir Et', hold: 3, fn: () => { ev.done = true; this.earn(rndi(4, 9), 'Tamir'); this.addHonor(4); this.stat('helped', 1); UI.subtitle('Yolcu', 'Allah razı olsun dostum!', 3); this.skillXp('strength', 5); } }]);
    // nesneler
    const tx0 = (P.x >> 4) - 1, ty0 = (P.y >> 4) - 1;
    for (let ty = ty0; ty <= ty0 + 2; ty++) for (let tx = tx0; tx <= tx0 + 2; tx++) {
      if (!W.inb(tx, ty)) continue;
      const i = ty * WW + tx, o = W.obj[i];
      if (!o) continue;
      const ox = tx * TS + 8, oy = ty * TS + 8;
      if (dist2(P.x, P.y, ox, oy) > 22 * 22) continue;
      const H = HARVEST[o];
      if (H) {
        const hv = W.harvested.get(i);
        if (hv !== undefined && hv > this.day) continue;
        if (o === O.ARTIFACT) { add(ox, oy, 'Parlayan Bir Şey', [{ n: 'İncele', hold: 0.5, fn: () => this.pickArtifact(i) }]); continue; }
        if (H.tool && !P.has(H.tool)) { add(ox, oy, 'Cevher Kayası', [{ n: 'Kazma gerekli', fn: () => UI.feed('Cevher kazmak için bir kazmaya ihtiyacın var.', 'warn') }]); continue; }
        add(ox, oy, H.label.split(' ')[0], [{ n: H.label, hold: H.tool ? 2 : 0.6, fn: () => this.harvest(i, o) }]);
        continue;
      }
      switch (o) {
        case O.WELL: case O.PUMP: case O.TROUGH:
          add(ox, oy, o === O.TROUGH ? 'Yalak' : 'Kuyu', [{ n: 'Su İç', fn: () => this.drinkWater(true) }, { n: 'Matarayı Doldur', fn: () => this.fillCanteen() }, { n: 'Yüzünü Yıka', fn: () => { P.clean = Math.min(100, P.clean + 25); UI.feed('Biraz temizlendin.'); } }]);
          break;
        case O.CHEST: {
          const c = W.chests.get(i);
          const op = this.chestsOpened[i];
          if (op !== undefined && this.day - op < 7) break;
          add(ox, oy, 'Sandık', [{ n: 'Sandığı Aç', hold: 0.9, fn: () => this.openChest(i, c) }]);
          break;
        }
        case O.GRAVE: case O.CROSS:
          if (!this.graves[i]) add(ox, oy, 'Mezar', [{ n: 'Saygı Göster', hold: 1, fn: () => { this.graves[i] = 1; this.addHonor(1); UI.feed('Ölüye saygı gösterdin. Huzur içinde yatsın.'); } }]);
          break;
        case O.SIGN: add(ox, oy, 'Yol Tabelası', [{ n: 'Tabelayı Oku', fn: () => UI.showSign(ox, oy) }]); break;
        case O.BENCH: add(ox, oy, 'Bank', [{ n: 'Otur ve Bekle', fn: () => UI.openWait() }]); break;
        case O.BOARD: add(ox, oy, 'İlan Panosu', [{ n: 'İlanlara Bak', fn: () => UI.openBountyBoard() }]); break;
        case O.CAMPFIRE: add(ox, oy, 'Kamp Ateşi', [{ n: 'Isın ve Pişir', fn: () => UI.openCook() }]); break;
        case O.HAY: add(ox, oy, 'Saman', [{ n: 'Saman Al', fn: () => { const k = 'hay' + i; if (this.dailyTalk[k]) { UI.feed('Bugün zaten aldın.'); return; } this.dailyTalk[k] = 1; P.addItem('hay', 2); } }]); break;
        case O.STEAM: add(ox, oy, 'Sıcak Kaynak', [{ n: 'Kaplıcada Dinlen', fn: () => this.hotSpring() }]); break;
        case O.BIGBONES: case O.BONES: break;
      }
    }
    // su
    const onT = W.tileAtPx(P.x, P.y);
    let wx = null, wy = null;
    for (const [dx, dy] of [[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10]]) { const t = W.tileAtPx(P.x + dx, P.y + dy); if (t === T.WATER || t === T.DEEP) { wx = P.x + dx; wy = P.y + dy; break; } if (t === T.HOTWATER) { add(P.x + dx, P.y + dy, 'Sıcak Kaynak', [{ n: 'Kaplıcada Dinlen', fn: () => this.hotSpring() }]); break; } }
    if (wx !== null) {
      const acts = [{ n: 'Su İç', fn: () => this.drinkWater(false) }, { n: 'Matarayı Doldur', fn: () => this.fillCanteen() }, { n: 'Yıkan', hold: 1.5, fn: () => this.wash() }];
      if (P.has('fishing_rod')) acts.push({ n: 'Balık Tut', fn: () => UI.startFishing() });
      if (P.has('gold_pan')) acts.push({ n: 'Altın Ele', hold: 3, fn: () => this.panGold() });
      add(wx, wy, onT === T.WATER ? 'Nehir' : 'Su Kenarı', acts, -6);
    }
    // binalar
    for (const b of W.buildings) {
      if (Math.abs(b.door.x - P.x) > 40 || Math.abs(b.door.y - P.y) > 30) continue;
      if (dist2(P.x, P.y, b.door.x, b.door.y) > 20 * 20) continue;
      if (b.type === 'property') {
        add(b.door.x, b.door.y, b.name, [{ n: this.props.includes(b.prop) ? 'Eve Gir' : 'Mülkü İncele', fn: () => UI.openProperty(b) }], 5);
        continue;
      }
      if (!b.def.svc || !b.def.svc.length) continue;
      add(b.door.x, b.door.y, b.name, [{ n: 'Gir', fn: () => UI.openBuilding(b) }], 5);
    }
    // hazine
    if (P.has('treasure_map') && this.treasure) {
      const tr = this.treasure;
      if (dist2(P.x, P.y, tr.x, tr.y) < 28 * 28) add(tr.x, tr.y, 'Taze Toprak', [{ n: P.has('shovel') ? 'Kaz' : 'Kürek gerekli', hold: P.has('shovel') ? 3 : 0, fn: () => this.digTreasure() }], 6);
    }
    if (!cands.length) return null;
    // yön tercihi
    const face = P.ang;
    for (const c of cands) { const da = Math.abs(angDiff(face, Math.atan2(c.y - P.y, c.x - P.x))); c.d += da * 4; }
    cands.sort((a, b) => a.d - b.d);
    return cands[0];
  },
  npcActions(e) {
    const P = this.player;
    const acts = [];
    const ev = e.event;
    if (e.eventType === 'injured' || e.eventType === 'snakebite') {
      if (!ev.done) {
        acts.push({ n: 'Yardım Et', fn: () => this.helpStranger(e) });
        acts.push({ n: 'Üstünü Ara (Soy)', fn: () => { ev.done = true; this.earn(rnd(2, 8), ''); this.crime('robbery', e.x, e.y, e); this.addHonor(-4); e.say('Seni... alçak...'); } });
      } else acts.push({ n: 'Konuş', fn: () => e.say('Sağ ol yabancı. Seni unutmayacağım.') });
      return acts;
    }
    if (e.eventType === 'wagon' && !ev.done) { acts.push({ n: 'Konuş', fn: () => e.say('Arabanın yanındaki tekerleğe bir bak, tamir edebilir misin?') }); return acts; }
    if (e.eventType === 'peddler') { acts.push({ n: 'Alışveriş Yap', fn: () => UI.openShop('peddler', 'Seyyar Satıcı') }); }
    if (e.role === 'farmer') {
      acts.push({ n: 'İş İste', fn: () => UI.openWork('ranch', 'Çiftlik') });
      acts.push({ n: 'Selamla', fn: () => this.greet(e) });
      return acts;
    }
    if (e.role === 'spouse') {
      acts.push({ n: 'Sohbet Et', fn: () => { e.say(pick(['Seni özledim.', 'Bugün nasıldı?', 'Eve erken gel, olur mu?', 'Çocuklar seni soruyordu.'])); P.hp = Math.min(P.maxHp, P.hp + 10); } });
      return acts;
    }
    if (e.role === 'child') { acts.push({ n: 'Oyna', fn: () => { e.say(pick(['Baba/Anne bak ne buldum!', 'Hikaye anlatır mısın?', 'Ben de büyüyünce kovboy olacağım!'])); } }); return acts; }
    acts.push({ n: 'Selamla', fn: () => this.greet(e) });
    if (e.role === 'romance') {
      const R = this.romances[e.town];
      acts.push({ n: `Sohbet Et (Yakınlık ${Math.round(R.rel)})`, fn: () => this.courtTalk(e, R) });
      acts.push({ n: 'Hediye Ver', fn: () => UI.openGift(e, R) });
      if (R.rel >= 80) acts.push({ n: 'Evlenme Teklif Et', fn: () => this.propose(e, R) });
    }
    if (e.role !== 'law') acts.push({ n: 'Kışkırt', fn: () => this.antagonize(e) });
    if (P.aiming && P.isArmed && e.state !== 'robbed' && !e.robbed) acts.push({ n: 'Soy', fn: () => this.robNpc(e) });
    return acts;
  },
  greet(e) {
    const P = this.player;
    let line;
    if (P.clean < 20 && chance(0.5)) line = pick(LINES.dirty);
    else if (P.drunk > 50) line = pick(LINES.drunk);
    else if (this.honor < -40) line = pick(LINES.greetLow);
    else if (this.honor > 40 && chance(0.5)) line = pick(LINES.greetHigh);
    else line = pick(LINES.greet);
    e.say(line);
    UI.subtitle(this.player.name, pick(['Merhaba.', 'Günaydın.', 'Nasıl gidiyor?', 'Selam dostum.']), 1.5, true);
    if (!P.greeted.has(e.id)) { P.greeted.add(e.id); this.addHonor(0.3); this.skillXp('charisma', 1.5); }
  },
  antagonize(e) {
    UI.subtitle(this.player.name, pick(['Ne bakıyorsun öyle?', 'Kıyafetlerin çok komik.', 'Yolumdan çekil!', 'Korkak herif.']), 1.5, true);
    this.addHonor(-0.5);
    if (e.role === 'traveler' || e.role === 'town') {
      if (e.sex === 'm' && chance(0.45)) { e.say(pick(LINES.antag)); e.state = 'fightFist'; e.cool = 1; }
      else { e.say(pick(['Bırak beni!', 'Delisin sen!', 'Seni şerife şikayet edeceğim!'])); e.state = 'flee'; e.t = 6; }
    } else e.say(pick(LINES.antag));
  },
  robNpc(e) {
    const mul = this.hasPerk('devil') ? 2 : 1;
    e.robbed = true; e.state = 'robbed'; e.t = 3;
    e.say(pick(LINES.robbed));
    const v = Math.max(1, e.money) * mul;
    this.earn(v, 'Soygun');
    if (chance(0.3)) this.player.addItem(pick(['pocket_watch', 'gold_ring', 'cig_card', 'tobacco']));
    this.crime('robbery', e.x, e.y, e);
  },
  lootBody(e) {
    e.looted = true;
    const P = this.player;
    const innocent = !(e.role === 'bandit' || e.role === 'target' || (e.isLaw && e.hostile));
    if (e.money > 0.2) this.earn(e.money * (this.hasPerk('devil') ? 1.5 : 1), 'Ceset');
    if (e.weapon) { const W = WEAPONS[e.weapon]; if (W.ammo) { const n = rndi(3, 8); P.ammo[W.ammo] = Math.min(AMMO[W.ammo].max, P.ammo[W.ammo] + n); UI.feed(`+${n} ${AMMO[W.ammo].n}`); } if (!P.weapons.has(e.weapon) && chance(0.35)) P.giveWeapon(e.weapon); }
    if (chance(0.4)) P.addItem(pick(['jerky', 'bread', 'beans', 'tobacco', 'whiskey', 'cigarette', 'bandage']));
    if (chance(0.1)) P.addItem(pick(['pocket_watch', 'gold_ring', 'necklace', 'cig_card']));
    if (e.role === 'target' && chance(0.5)) P.addItem('treasure_map') && this.makeTreasure();
    if (innocent) this.crime('looting', e.x, e.y, e);
    Audio_.ui('pick');
  },
  skin(a) {
    const P = this.player, d = a.def;
    a.skinned = true;
    const lvl = this.skill('hunting');
    if (d.pelt) {
      let n = d.pelt[1];
      if (lvl >= 5 && chance(0.3)) n++;
      P.addItem(d.pelt[0], n);
    }
    if (d.meat) {
      let n = d.meat[1] + (this.hasPerk('hunt1') && chance(0.5) ? 1 : 0);
      P.addItem(d.meat[0], n);
    }
    if (d.extra && a.male && chance(d.extra[1] + 0.3)) P.addItem(d.extra[0], 1);
    P.clean = Math.max(0, P.clean - 6);
    this.skillXp('hunting', 3);
    Audio_.tone(200, 0.2, 'sawtooth', 0.03);
    this.parts.burst('blood', a.x, a.y, 6, 20, 0.6, 1.2);
  },
  tameHorse(a) {
    const P = this.player;
    if (chance(0.65 + this.skill('riding') * 0.04)) {
      const h = new Horse(a.x, a.y, 'mustang', { look: { col: a.look.col, mane: shadeHex(a.look.col, -0.5), blaze: chance(0.3), blanket: '#6a4a2a' } });
      h.ang = a.ang;
      a.remove = true;
      this.setHorse(h);
      h.bond = 10;
      P.mount(h);
      this.stat('tamed', 1);
      this.skillXp('riding', 20);
      UI.toast('At Evcilleştirildi', `Ona bir isim verdin: ${h.name}`, 'horse');
      Audio_.neigh();
    } else {
      a.state = 'flee'; a.t = 6; a.fleeFrom(P);
      UI.feed('At ürktü ve kaçtı! Eğilerek (çömel) yavaşça yaklaş.', 'warn');
      Audio_.neigh();
    }
  },
  harvest(i, o) {
    const P = this.player, W = this.world, H = HARVEST[o];
    let n = rndi(H.n[0], H.n[1]);
    if (isHerbO(o) && this.hasPerk('herbs') && chance(0.5)) n *= 2;
    if (o === O.ORE) {
      const r = Math.random();
      const item = r < 0.08 ? 'gold_nugget' : r < 0.35 ? 'silver_ore' : 'iron_ore';
      P.addItem(item, item === 'gold_nugget' ? 1 : n);
      if (item === 'gold_nugget') this.stat('nuggets', 1);
      P.energy = Math.max(0, P.energy - 3);
      this.advanceClock(20);
      this.skillXp('strength', 3);
      Audio_.thud(0.4);
    } else {
      P.addItem(H.item, n);
      if (isHerbO(o)) { this.stat('herbs', 1); this.skillXp('survival', 1.5); }
      Audio_.ui('pick');
    }
    W.harvested.set(i, this.day + H.re);
  },
  pickArtifact(i) {
    const P = this.player, W = this.world;
    const tx = i % WW, ty = (i / WW) | 0;
    const t = W.tile[i];
    const item = (t === T.DESERT || t === T.REDROCK) && chance(0.4) ? 'dino_bone' : pick(['arrowhead', 'arrowhead', 'old_coin', 'cig_card']);
    P.addItem(item, 1);
    W.harvested.set(i, 99999);
    Audio_.ui('pick');
  },
  openChest(i, c) {
    const P = this.player;
    this.chestsOpened[i] = this.day;
    const loot = c ? c.loot : 'random';
    const good = this.hasPerk('collector') ? 1.5 : 1;
    const pool = {
      crater: [['meteorite', 1]], dino: [['dino_bone', 2], ['arrowhead', 1]], ship: [['gold_ring', 1], ['old_coin', 3], ['whiskey', 2]],
      mine: [['silver_ore', 3], ['gold_nugget', 1], ['dynamite', 1]], ghost: [['old_coin', 2], ['pocket_watch', 1], ['snake_oil', 1]],
      ruins: [['old_coin', 3], ['arrowhead', 2]], battle: [['old_coin', 2], ['ammo_pistol', 12]], grave: [['necklace', 1], ['old_coin', 2]],
      camp: [['whiskey', 1], ['ammo_repeater', 12], ['gold_ring', 1], ['jerky', 2]], cave: [['bear_pelt', 1], ['gold_nugget', 1]],
      nature: [['ginseng', 3], ['health_cure', 1]], wreck: [['pocket_watch', 1], ['beans', 2], ['cig_card', 2]], coast: [['old_coin', 2], ['fish_salmon', 1]], farm: [['corn', 3], ['apple', 3]],
      random: [['beans', 1], ['bandage', 1], ['old_coin', 1]],
    }[loot] || [['beans', 1]];
    for (const [id, n] of pool) {
      if (id.startsWith('ammo_')) { const a = id.slice(5); P.ammo[a] = Math.min(AMMO[a].max, P.ammo[a] + n); UI.feed(`+${n} ${AMMO[a].n}`); continue; }
      if (chance(0.85)) P.addItem(id, Math.max(1, Math.round(n * good)));
    }
    const money = rnd(2, 15) * good * (loot === 'ship' || loot === 'ghost' ? 3 : 1);
    this.earn(money, 'Sandık');
    if (!this.treasure && chance(0.25)) { P.addItem('treasure_map'); this.makeTreasure(); UI.help('Sandıkta eski bir <b>hazine haritası</b> buldun! Çantandan inceleyebilirsin.', 6); }
  },
  makeTreasure() {
    if (this.treasure) return;
    const W = this.world;
    for (let k = 0; k < 50; k++) {
      const x = rndi(60, WW - 60), y = rndi(60, WH - 60);
      const t = W.t(x, y);
      if (W.solid[y * WW + x] || isWaterT(t) || t === T.TOWN || t === T.ROAD) continue;
      if (W.townAt(x * TS, y * TS, 20)) continue;
      const near = W.pois.slice().sort((a, b) => dist2(a.tx, a.ty, x, y) - dist2(b.tx, b.ty, x, y))[0];
      this.treasure = { x: x * TS + 8, y: y * TS + 8, hint: near ? near.n : W.regionAt(x * TS, y * TS), region: W.regionAt(x * TS, y * TS) };
      return;
    }
  },
  digTreasure() {
    const P = this.player;
    if (!P.has('shovel')) { UI.feed('Kazmak için bir küreğe ihtiyacın var.', 'warn'); return; }
    P.removeItem('treasure_map');
    this.treasure = null;
    this.advanceClock(30);
    const v = rndi(80, 220);
    this.earn(v, 'Hazine');
    if (chance(0.5)) P.addItem('gold_bar', 1);
    P.addItem(pick(['gold_ring', 'necklace', 'pocket_watch']));
    this.stat('treasures', 1);
    UI.toast('Hazine Bulundu!', 'Toprağın altından paslı bir sandık çıktı.', 'ach');
  },
  drinkWater(clean) {
    const P = this.player;
    P.thirst = Math.min(100, P.thirst + 40);
    Audio_.tone(400, 0.2, 'sine', 0.05, null, 0, 250);
    if (!clean) {
      const t = this.world.tileAtPx(P.x, P.y);
      if (chance(0.06) || (t === T.SWAMP && chance(0.2))) { P.sick = Math.max(P.sick, 6); UI.help('Su pek temiz değildi. <b>Midende bir bulantı hissediyorsun.</b>', 5); }
    }
    UI.feed('💧 Su içtin');
  },
  fillCanteen() {
    const P = this.player;
    if (!P.has('canteen')) { UI.feed('Mataran yok. Genel mağazadan alabilirsin.', 'warn'); return; }
    P.canteen = 5; UI.feed('🫗 Matara dolduruldu (5/5)');
    Audio_.tone(300, 0.4, 'sine', 0.04, null, 0, 600);
  },
  wash() {
    const P = this.player;
    P.clean = 100;
    if (this.ambientTemp(P.x, P.y) < 8) { P.warmBuff = 0; UI.feed('Buz gibi suda yıkandın. Brrr!'); }
    else UI.feed('🧼 Yıkandın. Tertemiz oldun.');
    this.advanceClock(15);
  },
  panGold() {
    const P = this.player, W = this.world;
    const e = W.elev[((P.y >> 4) * WW) + (P.x >> 4)] / 255;
    const h = W.climateAt(P.x, P.y);
    const ch = 0.08 + e * 0.35 + (h < 0.35 ? 0.08 : 0);
    this.advanceClock(40);
    P.energy = Math.max(0, P.energy - 3);
    if (Math.random() < ch) {
      const n = this.hasPerk('gold') ? 2 : 1;
      P.addItem('gold_nugget', n);
      this.stat('nuggets', n);
      Audio_.ui('cash');
    } else UI.feed('Elekte sadece çamur ve çakıl var...');
    this.skillXp('survival', 2);
  },
  hotSpring() {
    const P = this.player;
    this.advanceClock(60);
    P.hp = P.maxHp; P.clean = 100; P.warmBuff = 240; P.sick = 0; P.energy = Math.min(100, P.energy + 15);
    UI.toast('Sıcak Kaynak', 'Kemiklerin ısındı, yaraların iyileşti.', 'ok');
  },
  helpStranger(e) {
    const P = this.player, ev = e.event;
    const need = e.eventType === 'snakebite' ? ['antidote', 'snake_oil', 'herbal_tonic'] : ['bandage', 'health_cure', 'herbal_tonic'];
    const have = need.find(id => P.has(id));
    if (!have) { UI.feed(`Yardım için ${need.map(n => ITEMS[n].n).join(' / ')} gerekli.`, 'warn'); e.say('Lütfen... bir şeyler bul...'); return; }
    P.removeItem(have);
    ev.done = true;
    e.state = 'idle'; e.home = { x: e.x, y: e.y, r: 30 };
    e.say('Hayatımı kurtardın! Bu küçük hediyeyi kabul et lütfen.');
    this.earn(rndi(5, 15), 'Minnet');
    if (chance(0.4)) P.addItem(pick(['gold_ring', 'pocket_watch', 'chocolate', 'whiskey']));
    this.addHonor(8);
    this.stat('helped', 1);
    this.skillXp('charisma', 8);
  },
  courtTalk(e, R) {
    const k = 'talk' + R.id;
    if (this.dailyTalk[k]) { e.say(pick(['Bugün yeterince konuştuk, yarın gel.', 'Hep burada mısın sen?', 'Yarın yine uğra.'])); return; }
    this.dailyTalk[k] = 1;
    let g = 4 + this.skill('charisma') * 0.8;
    if (this.player.clean < 30) { g -= 3; e.say(pick(LINES.dirty)); }
    else if (this.honor < -30) { g -= 1; e.say('Hakkında kötü şeyler duyuyorum...'); }
    else e.say(pick(['Seni görmek güzel.', 'Bugün çok şıksın.', 'Anlat bakalım, nerelerdeydin?', 'Kasabada senden bahsediyorlar.', 'Bir gün beni de at gezintisine çıkarır mısın?']));
    R.rel = clamp(R.rel + g, 0, 100);
    this.skillXp('charisma', 3);
    UI.feed(`❤ ${R.name}: Yakınlık ${Math.round(R.rel)}`);
  },
  giveGift(e, R, id) {
    const P = this.player, it = ITEMS[id];
    P.removeItem(id);
    const g = (it.gift || 2) * (1 + this.skill('charisma') * 0.05);
    R.rel = clamp(R.rel + g, 0, 100);
    e.say(g > 15 ? 'Aman Tanrım, çok güzel! Teşekkür ederim!' : 'Ne kadar düşüncelisin, teşekkürler.');
    UI.feed(`❤ ${R.name}: Yakınlık ${Math.round(R.rel)}`);
  },
  propose(e, R) {
    if (!this.props.length) { e.say('Seni seviyorum ama... başımızı sokacak bir evimiz bile yok.'); return; }
    if (this.family.spouse) { e.say('Sen zaten evlisin!'); return; }
    const ring = this.player.has('gold_ring');
    if (ring || R.rel >= 95 || chance(0.6)) {
      if (ring) this.player.removeItem('gold_ring');
      this.family.spouse = { name: R.name, sex: R.sex, look: R.look, id: R.id, since: this.year };
      e.remove = true;
      this.stats.married = 1;
      UI.toast('Evlendin!', `${R.name} artık hayat arkadaşın. Seni evinizde bekleyecek.`, 'family');
      Audio_.chime();
      for (const p of this.world.pois) if (p.kind === 'property') p.spawned = false;
    } else e.say('Bu... çok ani oldu. Biraz daha zamana ihtiyacım var.');
  },
  work(jobId, place) {
    const J = JOBS[jobId], P = this.player;
    const h = this.hour;
    if (h < 6 || h > 18) { UI.feed('İş saatleri 06:00 - 18:00 arası.', 'warn'); return false; }
    if (P.energy < J.energy * 0.6) { UI.feed('Çalışamayacak kadar yorgunsun.', 'warn'); return false; }
    UI.fade(() => {
      this.advanceClock(J.hours * 60);
      P.energy = Math.max(0, P.energy - J.energy);
      P.hunger = Math.max(0, P.hunger - J.hunger);
      P.thirst = Math.max(0, P.thirst - J.thirst);
      P.clean = Math.max(0, P.clean - 20);
      let pay = rnd(J.pay[0], J.pay[1]) * (1 + this.skill(J.skill) * 0.05) * (this.hasPerk('worker') ? 1.25 : 1);
      if (this.background === 'rail' && jobId !== 'ranch') pay *= 1.15;
      this.earn(pay, J.n);
      if (J.bonus) for (const [id, c] of J.bonus) if (chance(c)) P.addItem(id, 1);
      this.stat('shifts', 1);
      this.skillXp(J.skill, J.xp);
    }, `${J.hours} saat çalıştın...`);
    return true;
  },
  sleep(hours, where) {
    const P = this.player;
    if (this.law.level > 0) { UI.feed('Aranırken uyuyamazsın!', 'warn'); return; }
    UI.fade(() => {
      const steps = Math.round(hours * 6);
      for (let k = 0; k < steps; k++) {
        this.advanceClock(10);
        this.weatherUpdate(10);
        this.survivalUpdate(10, true);
        P.energy = Math.min(100, P.energy + 12.5 / 6);
        if (this.state !== 'play') return;
      }
      P.sta = P.maxSta; P.de = Math.max(P.de, 50);
      if (where === 'home' && this.hasPerk('home')) { P.hp = P.maxHp; P.deCore = 100; }
      if (where === 'home' && this.family.spouse) { P.hp = P.maxHp; UI.feed(`❤ ${this.family.spouse.name} ile huzurlu bir uyku.`); }
      if (where === 'hotel') P.clean = Math.max(P.clean, 60);
      this.saveGame(true);
      UI.feed('💾 Oyun kaydedildi');
      // uyurken saldırı
      if (where === 'camp' && this.isNight && chance(0.1)) { this.eventT = 0; UI.help('Bir ses seni uyandırdı...', 4); }
    }, `${hours} saat uyudun...`);
  },
  passTime(hours) {
    UI.fade(() => {
      const steps = Math.round(hours * 6);
      for (let k = 0; k < steps; k++) { this.advanceClock(10); this.weatherUpdate(10); this.survivalUpdate(10, false); if (this.state !== 'play') return; }
    }, `${hours} saat geçti...`);
  },
  setupCamp() {
    const P = this.player, W = this.world;
    if (!P.has('bedroll')) { UI.feed('Kamp kurmak için bir uyku tulumuna ihtiyacın var.', 'warn'); return; }
    if (W.townAt(P.x, P.y, 30)) { UI.feed('Kasabaya bu kadar yakın kamp kuramazsın.', 'warn'); return; }
    if (this.law.level > 0) { UI.feed('Aranırken kamp kuramazsın.', 'warn'); return; }
    for (const e of this.ents) if (!e.dead && ((e.kind === 'npc' && e.hostile) || (e.kind === 'animal' && e.state === 'attack')) && dist2(e.x, e.y, P.x, P.y) < 400 * 400) { UI.feed('Yakında tehlike var!', 'warn'); return; }
    if (W.blocked(P.x, P.y + 14, 6)) { UI.feed('Burası kamp için uygun değil.', 'warn'); return; }
    if (this.camp) this.camp.remove = true;
    this.camp = new Camp(P.x, P.y + 14);
    this.addEnt(this.camp);
    this.stat('camps', 1);
    Audio_.ui('ok');
    UI.openCamp();
  },
};
