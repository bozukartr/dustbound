'use strict';
/* ==========================================================
   FRONTIER'S END — dünyanın anlık görüntüsü (G nesnesine eklenir)
   "Devam Et" oyunu kaldığı andan sürdürür: çevredeki kasaba
   sakinleri, kanun adamları, yolcular, haydutlar, çiftçiler,
   hayvanlar (av, çiftlik, kasaba tavukları), bağlı atlar, yol
   arabaları, yerdeki cesetler, postlar, sandıklar, uçmuş şapkalar
   ve yanık izleri bulundukları yerde, durumlarıyla geri gelir.
   Kendi düzeneğiyle yeniden kurulanlar (tezgâhtaki esnaf, piyanist,
   göçebeler, ödül hedefi, aile, olay NPC'leri, ödül avcıları)
   kaydedilmez; onları ilgili sistem yeniden yerleştirir.
   ========================================================== */

const NPC_KEYS = ['ang', 'hp', 'maxHp', 'hostile', 'weapon', 'money', 'looted', 'state', 't', 'home', 'town', 'keepTown', 'poi', 'keepPoi', 'camp', 'romId',
  'mounted', 'hAng', 'dead', 'deadT', 'tieT', 'downT', 'assaulted', 'evidence', 'child', 'carry2', 'goHome', 'target', 'pi', 'pdir', 'aggro', 'robbed', 'greetDay', 'bribeTried', 'silenced', 'mag', 'spare'];
const ANIMAL_KEYS = ['ang', 'hp', 'maxHp', 'dead', 'deadT', 'skinned', 'male', 'look', 'state', 't', 'home', 'poi', 'town', 'keepTown', 'tieT', 'tame'];
const HORSE_KEYS = ['ang', 'hp', 'dead', 'saddle', 'hitch', 'town', 'state', 'bond', 'owner'];
const WAGON_KEYS = ['ang', 'bx', 'by', 'bang', 'pi', 'dir', 'stage', 'max', 'cargo', 'body', 'hc', 'owner', 'route', 'ri', 'leg', 'parkT', 'exitPt', 'hp', 'name'];
/* Yüklemede güvenli hâle çevrilen anlık durumlar (kovalama, rapor, kementte...) */
const SAFE_STATE = { flee: 'idle', report: 'idle', robbed: 'idle', robbing: 'idle', cower: 'idle', fightFist: 'idle', lassoed: 'tied', walk: 'idle', attack: 'idle', come: 'idle', hurt: 'hurt' };

const WorldSave = {
  /* Kaydedilmeyecek varlıklar: kendi sistemi yeniden kuranlar ve geçici olanlar */
  skipEnt(e) {
    const P = this.player;
    if (!e || e.remove || e.hide || e === P || e === this.horse || e === P.carry || e.event || e.eventType || e.quest || e.storyCoy || e.storyGame || e.storyHen) return true;
    if (e.kind === 'npc') return e.staffOf || e.work !== undefined || e.role === 'clerk' || e.role === 'nomad' || e.role === 'hunter' || e.role === 'target'
      || e.role === 'spouse' || e.role === 'child' || e.role === 'stranger' || e.keep || e.job || e.bountyId || e.nomad !== undefined;
    if (e.kind === 'horse') return e.owner === 'player' || e.rider || e.nomad !== undefined;
    if (e.kind === 'wagon') return e.mine || e.hauler || e.rider;
    if (e.kind === 'animal') return e.nomad !== undefined;
    return e.kind === 'prop' || e.kind === 'camp' || e.kind === 'ent';
  },
  pick(e, keys) { const o = {}; for (const k of keys) if (e[k] !== undefined && e[k] !== null) o[k] = e[k]; return o; },
  saveEnts() {
    const W = this.world, list = [], idx = new Map(), out = [];
    for (const e of this.ents) if (!this.skipEnt(e)) { idx.set(e, list.length); list.push(e); }
    for (const e of list) {
      const b = { k: e.kind, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10 };
      if (e.kind === 'npc') {
        Object.assign(b, this.pick(e, NPC_KEYS), { role: e.role, name: e.name, look: e.look });
        if (e.res) b.res = e.res.id;
        if (e.seatB) { b.seatB = e.seatB.id; b.seat = e.seatB.seats ? e.seatB.seats.indexOf(e.seat) : -1; }
        if (e.path) { const ri = W.roads.findIndex(r => r.pts === e.path); if (ri >= 0) b.road = ri; }
        if (b.state && SAFE_STATE[b.state]) b.state = SAFE_STATE[b.state];
        if (e.state === 'walk' && e.target) b.state = 'walk';
      } else if (e.kind === 'animal') {
        Object.assign(b, this.pick(e, ANIMAL_KEYS), { type: e.type });
        if (e.leader && idx.has(e.leader)) b.leader = idx.get(e.leader);
        if (b.state && SAFE_STATE[b.state]) b.state = SAFE_STATE[b.state];
        if (e.camp !== undefined) b.camp = e.camp;
      } else if (e.kind === 'horse') {
        Object.assign(b, this.pick(e, HORSE_KEYS), { breed: e.breed, name: e.name, look: e.look });
        if (b.state && SAFE_STATE[b.state]) b.state = SAFE_STATE[b.state];
      } else if (e.kind === 'wagon') {
        Object.assign(b, this.pick(e, WAGON_KEYS));
        // sürücü dükkânda yük taşıyorsa koltuğuna geri oturtulur
        const d = e.driver || e.awayDriver || (e.driverEnt ? { look: e.driverEnt.look, name: e.driverEnt.name } : null);
        b.driver = d ? { look: d.look, name: d.name } : null;
        if (e.path) b.road = W.roads.findIndex(r => r.pts === e.path);
        if (e.stopT) b.stopT = e.stopT.id;
        if (e.slot) b.slot = [e.slot[0], e.slot[1], e.slot[2] ? e.slot[2].id : -1];
        if (e.shop) b.shop = e.shop.id;
        b.spd = Math.round(e.spd || 0);
      } else if (e.kind === 'pelt') Object.assign(b, { id: e.id, q: e.q, ang: e.ang, age: e.age });
      else if (e.kind === 'crate') Object.assign(b, { g: e.g });
      else continue;
      out.push(b);
    }
    return {
      ents: out,
      towns: W.towns.filter(t => t.spawned).map(t => t.id),
      pois: W.pois.filter(p => p.spawned && (p.kind === 'farm' || p.kind === 'camp')).map(p => p.pid),
      hats: Juice.hats.filter(h => h.z <= 0).slice(-20), decals: Juice.decals.slice(-12),
      pang: this.player.ang,
    };
  },
  loadEnts(S) {
    if (!S || !S.ents) return;
    const W = this.world, made = [];
    const town = (id) => W.towns.find(t => t.id === id);
    for (const b of S.ents) {
      let e = null;
      try {
        if (b.k === 'npc') {
          const path = b.road !== undefined && W.roads[b.road] ? W.roads[b.road].pts : null;
          e = new NPC(b.x, b.y, b.role, { name: b.name, look: b.look, path, pi: b.pi, pdir: b.pdir, hostile: b.hostile, weapon: b.weapon, money: b.money });
          for (const k of NPC_KEYS) if (b[k] !== undefined) e[k] = b[k];
          if (e.state === 'walk' && !e.target) e.state = 'idle';
          if (e.mounted && typeof e.mounted !== 'object') e.mounted = null;
          // kasaba sakini: kayıt tutucu yer tutucu; kasaba sakinleri üretilince gerçek kayda bağlanır
          if (b.res && b.town) { const t = town(b.town); if (t) e.res = { id: b.res, t }; }
          if (b.seatB !== undefined) {
            const sb = W.buildings[b.seatB], s = sb && sb.seats && sb.seats[b.seat];
            if (s) { e.seatB = sb; e.seat = s; (sb.patrons = sb.patrons || []).push(e); e.state = 'sit'; }
          }
        } else if (b.k === 'animal') {
          if (!ANIMALS[b.type]) continue;
          e = new Animal(b.x, b.y, b.type);
          for (const k of ANIMAL_KEYS) if (b[k] !== undefined) e[k] = b[k];
          if (b.camp !== undefined) e.camp = b.camp;
          if (e.dead) { e.state = 'dead'; e.hp = 0; }
        } else if (b.k === 'horse') {
          e = new Horse(b.x, b.y, b.breed, { name: b.name, look: b.look, owner: b.owner || 'npc' });
          for (const k of HORSE_KEYS) if (b[k] !== undefined) e[k] = b[k];
        } else if (b.k === 'wagon') {
          const road = b.road >= 0 ? W.roads[b.road] : null;
          e = new Wagon(null, 0, b.dir || 1, b.stage, { x: b.x, y: b.y, ang: b.ang || 0 });
          if (road) e.path = road.pts;
          for (const k of WAGON_KEYS) if (b[k] !== undefined) e[k] = b[k];
          e.driver = b.driver; e.spd = b.spd || 0;
          if (b.stopT) e.stopT = town(b.stopT) || null;
          if (b.slot) e.slot = [b.slot[0], b.slot[1], W.buildings[b.slot[2]]];
          if (b.shop !== undefined) e.shop = W.buildings[b.shop];
          if (!e.path && !e.route && !e.stopT) e.remove = true;
        } else if (b.k === 'pelt') { if (!ITEMS[b.id]) continue; e = new Pelt(b.x, b.y, b.id, b.q || 1); e.ang = b.ang || 0; e.age = b.age || 0; }
        else if (b.k === 'crate') { if (!GOODS[b.g]) continue; e = new Crate(b.x, b.y, b.g); }
      } catch (err) { console.warn('varlık yüklenemedi', b, err); e = null; }
      made.push(e);
      if (e && !e.remove) this.addEnt(e);
    }
    // sürü liderleri
    S.ents.forEach((b, i) => { if (b.k === 'animal' && b.leader !== undefined && made[i] && made[b.leader]) made[i].leader = made[b.leader]; });
    // bu kasabalar ve çiftlik/kamp yerleri zaten "doğmuş": sistemler ikinci kez doldurmasın
    for (const id of S.towns || []) { const t = town(id); if (t) { t.spawned = true; t._res = null; } }
    for (const pid of S.pois || []) { const p = W.pois.find(q => q.pid === pid); if (p) p.spawned = true; }
    if (S.hats) Juice.hats.push(...S.hats);
    if (S.decals) Juice.decals.push(...S.decals);
    if (S.pang !== undefined) this.player.ang = S.pang;
    // kasaba sakinlerini kayıtlarına bağla
    for (const id of S.towns || []) { const t = town(id); if (t) this.residents(t); }
    // kaydı artık eşleşmeyen sakin (kasaba nüfusu değişti): sıradan bir kasabalı gibi dolaşır
    for (const e of made) if (e && e.res && !e.res.occ) { e.res = null; e.home = e.home || { x: e.x, y: e.y, r: 60 }; e.keepTown = true; }
  },
};
