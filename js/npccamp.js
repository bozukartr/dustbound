'use strict';
/* ==========================================================
   FRONTIER'S END — Haydut kampında gece (G nesnesine eklenir)
   Akşam (19:00'dan) haydutlar kamp ateşinin çevresine oturur; gece yarısından (23:00) şafağa (05:30) dek uyurlar.
   Kamptakilerden biri nöbetçidir (20:00–06:00): kampın çevresindeki dört noktayı sırayla dolaşır, her birinde birkaç
   saniye dışarıyı gözetler. Ateşin ışığına giren görünür (js/npcsense.js); uyuyan görmez, ancak yakındaki ayak sesini
   zayıf duyar, silah sesiyle ya da arkadaşının bağırmasıyla uyanır (biraz sersem: 1–2 sn geç). Gündüz kamp eskisi gibi
   (çevrede dolaşırlar).
   Kendi programı olan (campSched; ör. hikâyenin hedef kişisi Kızıl Jack): geç yatar, erken kalkar; kalkınca ateşin
   başında ayakta durur. Hedef kişi nöbet tutmaz.
   Gizli etkisizleştirme: fark etmemiş bir haydudun (uyuyan ya da sırtı dönük) yanına çömelerek sokulan oyuncu onu
   arkadan bayıltır (kısa basılı tut); uyuyanı uyandırmadan sessizce de bağlayabilir (uzun basılı tut). Bayıltmanın
   boğuk sesini yalnız çok yakındaki uyanık biri duyar. Uyanık arkadaşı bağlı ya da baygın birini görünce alarm verir.
   ========================================================== */

const CAMP = { SIT: 19, SLEEP: 23, WAKE: 5.5, WATCH: [20, 6], RING: [22, 30], POST: 95, LOOK: [3, 5] };
/* gizli etkisizleştirme: yarıçap, sırtı dönük sayılan açı (bakış yönünden), bayıltma ve sessiz bağlama süreleri, bayıltmanın sesi */
const TAKEDOWN = { R: 26, BACK: 2.0, KO: 0.45, TIE: 1.6, NOISE: 46, DOWN: [75, 110] };

const NpcCamp = {
  /* Kampın ateşi: haydudun evi (home) kamp merkezidir */
  campNight(h) { return h >= CAMP.SIT || h < CAMP.WAKE; },
  /* Kamptaki nöbetçi: kampın en küçük kimlikli üyesi (kendi saatleri olan hedef kişi nöbet tutmaz). Nöbet değişmez:
     nöbetçi bayılır, bağlanır ya da ölürse uyuyan biri haberi olmadan yerine geçip kalkmaz */
  campSentry(e) {
    let best = null;
    for (const o of this.ents) if (o.kind === 'npc' && o.camp === e.camp && !o.remove && !o.campSched && (!best || o.id < best.id)) best = o;
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
    // yatma ve kalkma saati: kendi programı varsa ondan (gece yarısını aşabilir); erkenci kalkınca ateşin başında ayakta
    const Z = e.campSched, sl = Z ? Z.sleep : CAMP.SLEEP, wk = Z ? Z.wake : CAMP.WAKE;
    const late = sl > wk ? h >= sl || h < wk : h >= sl && h < wk, up = !late && !!Z && Z.stand && h >= wk && h < CAMP.WAKE;
    e.mv = 0; e.spd = 0; e.nav = null; e.lookAt = null;
    const fa = Math.atan2(C.y - e.y, C.x - e.x);
    e.ang = turnTo(e.ang, up ? fa + Math.sin(this.t * 0.23 + e.id) * 0.45 : fa, dt * (up ? 0.8 : 2));   // ateşe döner; ayaktaysa ağır ağır çevresine
    e.state = late ? 'sleep' : up ? 'idle' : 'sit'; e.asleep = late;
    if (up) this.standTick(e, dt, 0.12);
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

  /* ---------------- gizli etkisizleştirme ---------------- */
  /* Oyuncu bu haydudu fark ettirmeden etkisiz hâle getirebilir mi: yaya, yüksüz, çömelmiş; haydut fark etmemiş ve
     uyuyor ya da sırtı dönük (bakış yönünün arkası; görme sisteminde kör nokta) */
  takedownOk(e) {
    const P = this.player;
    if (!e || e.kind !== 'npc' || !(e.role === 'bandit' || e.role === 'target') || e.dead || e.remove || e.bound || e.mounted) return false;
    if (e.aggro || e.awState === 'alert' || e.awPend || e.state === 'surrender' || e.fleeing) return false;
    if (P.riding || P.carry || P.passenger || !P.crouch || dist2(P.x, P.y, e.x, e.y) > TAKEDOWN.R * TAKEDOWN.R) return false;
    if (e.asleep) return true;
    const look = e.lookAt != null ? e.lookAt : e.ang;
    return Math.abs(angDiff(look, Math.atan2(P.y - e.y, P.x - e.x))) > TAKEDOWN.BACK;
  },
  /* Etkileşim isteminde: uyuyana sessizce bağla (önce) ve bayılt; sırtı dönük uyanığa yalnız bayılt. null: koşul yok */
  takedownActs(e) {
    if (!this.takedownOk(e)) return null;
    const fail = () => UI.feed(Tr('Fark edildin! Gizlice etkisiz hâle getiremezsin.'), 'warn');
    const acts = [{ n: Tr('Bayılt'), hold: TAKEDOWN.KO, live: 1, check: () => this.takedownOk(e), fail, fn: () => this.takedownKO(e) }];
    if (e.asleep) acts.unshift({ n: Tr('Sessizce Bağla'), hold: TAKEDOWN.TIE, live: 1, check: () => this.takedownOk(e), fail, fn: () => this.takedownTie(e) });
    return acts;
  },
  /* Arkadan bayılt: boğuk bir darbe, yere yığılır; uzunca bir süre baygın kalır (bağlanabilir, omza alınabilir) */
  takedownKO(e) {
    const P = this.player;
    P.ang = Math.atan2(e.y - P.y, e.x - P.x); P.swing = 1;
    Audio_.thud(0.35);
    if (e.asleep || e.state === 'sleep' || e.state === 'sit') this.campWake(e);
    e.down(rnd(TAKEDOWN.DOWN[0], TAKEDOWN.DOWN[1]), true);
    e.ko = true;
    this.noise(e.x, e.y, TAKEDOWN.NOISE, 'quiet');   // yalnız çok yakındaki uyanık biri duyar (uyuyan duymaz)
    this.skillXp('strength', 2);
    this.hintOnce('takedown', Tr`Arkadan bayılttın. Uyanmadan ${Input.glyph('interact')} basılı tutarak <b>bağla</b>. Baygın ya da bağlı birini gören arkadaşı alarm verir; onu gözden uzağa taşıyabilirsin.`, 9);
    this.qEvent('takedown', e);
  },
  /* Uyuyanı uyandırmadan bağla: ağzı da bağlandığı için bağıramaz */
  takedownTie(e) {
    if (e.asleep || e.state === 'sleep' || e.state === 'sit') this.campWake(e);
    e.state = 'tied'; e.tieT = rnd(150, 210) + this.skill('survival') * 8; e.wrig = 0; e.aggro = false; e.anim = null; e.nav = null;
    Audio_.play('rope', { x: e.x, y: e.y, vol: 0.5 });
    e.say(Tr('Hmmf!'), 1.5);
    if (e.bountyId) this.bountyTargetDown(e);
    this.skillXp('strength', 2);
    this.qEvent('takedown', e);
  },
};
