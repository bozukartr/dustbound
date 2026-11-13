'use strict';
/* ==========================================================
   FRONTIER'S END — Haydut kampında gece (G nesnesine eklenir)
   Akşam (19:00'dan) haydutlar kamp ateşinin çevresine oturur; gece yarısından (23:00) şafağa (05:30) dek uyurlar.
   Kamptakilerden biri nöbetçidir (20:00–06:00): kampın çevresindeki dört noktayı sırayla dolaşır, her birinde birkaç
   saniye dışarıyı gözetler. Ateşin ışığına giren görünür (js/npcsense.js); uyuyan görmez, ancak yakındaki ayak sesini
   zayıf duyar, silah sesiyle ya da arkadaşının bağırmasıyla uyanır (biraz sersem: 1–2 sn geç). Gündüz kamp eskisi gibi
   (çevrede dolaşırlar).
   ========================================================== */

const CAMP = { SIT: 19, SLEEP: 23, WAKE: 5.5, WATCH: [20, 6], RING: [22, 30], POST: 95, LOOK: [3, 5] };

const NpcCamp = {
  /* Kampın ateşi: haydudun evi (home) kamp merkezidir */
  campNight(h) { return h >= CAMP.SIT || h < CAMP.WAKE; },
  /* Kamptaki nöbetçi: en küçük kimlikli, uyanık, bağlı olmayan */
  campSentry(e) {
    let best = null;
    for (const o of this.ents) if (o.kind === 'npc' && o.camp === e.camp && !o.dead && !o.bound && !o.remove && o.state !== 'surrender' && (!best || o.id < best.id)) best = o;
    return best === e;
  },
  /* Kamp gecesi adımı (sakin haydut için, idleUpdate yerine). Döner: true (bu karenin işi yapıldı) */
  campLife(e, dt) {
    if (!e.camp || !e.home || e.mounted) return false;
    const h = this.hour, C = e.home;
    if (!this.campNight(h)) { if (e.asleep || e.state === 'sit' || e.state === 'sleep') this.campWake(e); return false; }
    const watch = h >= CAMP.WATCH[0] || h < CAMP.WATCH[1];
    if ((e.sentryT = (e.sentryT || 0) - dt) <= 0) { e.sentryT = 1; e.isSentry = this.campSentry(e); }
    if (watch && e.isSentry) return this.campWatch(e, dt);
    if (e.post) e.post = null;
    // ateş başı: kimliğine göre bir yer
    if (!e.campSpot) {
      const a = (e.id * 2.39996) % TAU, r = rnd(CAMP.RING[0], CAMP.RING[1]);
      let x = C.x + Math.cos(a) * r, y = C.y + Math.sin(a) * r;
      if (this.world.blocked(x, y, 5)) { x = C.x + Math.cos(a) * (r + 10); y = C.y + Math.sin(a) * (r + 10); }
      e.campSpot = { x, y };
    }
    const S = e.campSpot;
    if (dist2(e.x, e.y, S.x, S.y) > 7 * 7 && e.state !== 'sleep') {
      if (e.state === 'sit') e.state = 'idle';
      if (this.navStep(e, S.x, S.y, dt, 26, { near: 5 }) !== 'moving') { e.x = S.x; e.y = S.y; }
      return true;
    }
    const late = h >= CAMP.SLEEP || h < CAMP.WAKE;
    e.mv = 0; e.spd = 0; e.nav = null; e.lookAt = null;
    e.ang = turnTo(e.ang, Math.atan2(C.y - e.y, C.x - e.x), dt * 2);   // ateşe döner
    e.state = late ? 'sleep' : 'sit'; e.asleep = late;
    return true;
  },
  campWake(e) { e.asleep = false; if (e.state === 'sit' || e.state === 'sleep') e.state = 'idle'; e.campSpot = null; },
  /* Nöbetçi: kampın çevresinde dört nokta; her birinde dışarı bakar */
  campWatch(e, dt) {
    const C = e.home;
    if (e.asleep || e.state === 'sit' || e.state === 'sleep') this.campWake(e);
    if (!e.post) e.post = { k: e.id % 4, look: 0 };
    const Q = e.post, a = Q.k * Math.PI / 2 + 0.4;
    const px = C.x + Math.cos(a) * CAMP.POST, py = C.y + Math.sin(a) * CAMP.POST;
    if (Q.look <= 0) {
      const r = this.navStep(e, px, py, dt, 24, { near: 8 });
      e.lookAt = null;
      if (r !== 'moving') Q.look = rnd(CAMP.LOOK[0], CAMP.LOOK[1]);
      return true;
    }
    e.mv = 0; e.spd = 0;
    e.ang = turnTo(e.ang, a + Math.sin(this.t * 0.7 + e.id) * 0.7, dt * 1.5);   // dışarıyı tarar
    if ((Q.look -= dt) <= 0) Q.k = (Q.k + 1) % 4;
    return true;
  },
};
