'use strict';
/* ==========================================================
   FRONTIER'S END — NPC algısı (G nesnesine eklenir)
   Düşman NPC'ler (haydut, ödül hedefi; aranırken kanun adamı) oyuncuyu ancak görür ya da duyarsa fark eder.
   Görme:   bakış yönü (önde ±60° tam, ±120°'ye kadar yan görüş ×0,3, arkası kör), role göre menzil, ışık (gece
            ×0,45; fenerin yanıyorsa ya da bir ateşin, lambanın ışığındaysan görünürsün), duruş (çömelme ×0,5, durma
            ×0,75, koşma ×1,3, atlı ×1,4–1,5), hava (yağmur, sis, toz) ve örtü (duvar, kaya, uçurum keser; ağaç ve
            çalı her biri görüşü 0,55 ile çarpar — rastgele değil, algı titremez).
   Şüphe:   0..1. Görünce ve duyunca dolar, görmeyince söner. 0,35'te "?": NPC durur, döner bakar, sonra görüntünün
            ya da sesin geldiği yere yürür. 1'de "!": çatışma (haydut saldırır, kanun adamı düşman olur).
   İşitme:  ayak sesi (çömelme 15, yürüme 45, koşma 110 px), at (tırıs 120, dörtnala 200), silah, patlama, kapı
            kırma, maymuncuk. Ses tam yeri değil, mesafenin %20'si kadar sapmalı bir yer verir.
   Haber:   fark eden bağırır; aynı kamptaki ya da 260 px içindeki arkadaşları 0,4–0,8 sn sonra öğrenir (bağıranın
            bildiği yeri). Arkadaşının cesedini gören, katili görmeden aramaya geçer.
   Çatışma: oyuncuyu gören onu izler (görüş hattı yeter); kaybedince yeniden görmek için bakış yönü gerekir. Son
            görülen yere gider, orada birkaç saniye gözetler, sonra çevresinde 3–5 noktayı arar (grup aralarında
            farklı yönlere bakar); 25–45 sn sonra vazgeçip kampına döner, 3 dakika tetikte kalır.
   ========================================================== */

const SENSE = {
  RANGE: { bandit: 260, target: 260, law: 300 },   // gündüz, yürüyen oyuncuyu görme menzili (px)
  FOV: 1.05, SIDE: 2.1, SIDE_K: 0.3,              // önde ±60° tam; ±120°'ye kadar yan görüş ×0,3; arkası kör
  RATE: 3.2,                                      // şüphenin dolma hızı (yakın ve öndeyken saniyede)
  SUSPECT: 0.35, CALM: 0.15,                      // "?" eşiği; altına inince sakinleşir
  STEP: { crouch: 15, walk: 45, sprint: 110, trot: 120, gallop: 200 },   // ayak sesinin ve atın duyulduğu yarıçap (px)
  CALL: 260,                                      // bağırışın duyulduğu yarıçap
  ERR: 0.2,                                       // ses konumu sapması (mesafenin oranı)
  SEARCH_N: [3, 5], SEARCH_T: [25, 45], WATCH_T: [3, 5],   // arama noktası, arama süresi, son görülen yerde gözetleme (sn)
  ALERT_T: 180,                                   // vazgeçtikten sonra tetikte kalma (sn): şüphe 1,25 kat hızlı dolar
  SEEN: 900,                                      // çatışmada izleme menzili (gündüz)
};

const NpcSense = {
  /* Algıyla çalışan NPC: haydut ve ödül hedefi; kanun adamı yalnız aranırken ve henüz düşman değilken */
  senses(e) { return !e.dead && !e.bound && (e.role === 'bandit' || e.role === 'target' || (e.isLaw && !e.hostile)); },

  /* Oyuncunun ne kadar görünür olduğu (ışık): kare başına bir kez hesaplanır */
  litK() {
    const P = this.player;
    if (this._litF === this.fno && this._litC === this.clock && this._litL === P.lantern) return this._lit;
    let k = 0.45 + 0.55 * this.daylight;
    if (this.insideB) k = Math.max(k, 0.9);   // içerisi lamba ışığında
    else if (k < 0.9) {
      if (P.lantern && P.has('lantern')) k = 0.95;
      else for (const L of this.world.lightsIn(P.x - 100, P.y - 100, P.x + 100, P.y + 100)) {
        const r = (L.r || 60) * 0.9;
        if (dist2(L.x, L.y, P.x, P.y) < r * r) { k = Math.max(k, 0.85); break; }
      }
    }
    this._litF = this.fno; this._litC = this.clock; this._litL = P.lantern; this._lit = k;
    return k;
  },
  /* Duruş: çömelmiş ×0,5, duran ×0,75, yürüyen ×1, koşan ×1,3, atlı ×1,4 (dörtnala ×1,5) */
  stanceK() {
    const P = this.player;
    if (P.riding) return P.riding.spd > 110 ? 1.5 : 1.4;
    if (P.crouch) return 0.5;
    const mv = P.mv || 0;
    if (P.sprinting && mv > 0.3) return 1.3;
    return mv > 0.15 ? 1 : 0.75;
  },
  weatherK() { const E = this.envCache || {}; return 1 - Math.min(0.3, (E.rain || 0) * 0.2 + (E.fog || 0) * 0.3 + (E.dust || 0) * 0.25); },
  /* Oyuncunun gidiş yönü (arama noktalarını kaçış yönüne ağırlıklı seçmek için); duruyorsa undefined */
  playerDir() {
    const P = this.player;
    if (P.riding) return P.riding.spd > 20 ? (P.riding.hAng !== undefined ? P.riding.hAng : P.riding.ang) : undefined;
    return Math.hypot(P.vx || 0, P.vy || 0) > 8 ? Math.atan2(P.vy, P.vx) : undefined;
  },
  /* (x, y) çevresinde, e'den uzaklığın %20'si kadar sapmalı bir nokta: ses ve haber tam yeri vermez */
  senseGuess(e, x, y, k = SENSE.ERR) {
    const r = dist(e.x, e.y, x, y) * k, a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
    let gx = x + Math.cos(a) * d, gy = y + Math.sin(a) * d;
    if (this.world.blocked(gx, gy, 4) || this.world.isWaterPx(gx, gy)) { gx = x; gy = y; }
    return { x: gx, y: gy };
  },
  /* Bakış yönüyle görme: 0 görmüyor, 1 tam görüyor (önde, açıkta). alert: çatışmadaki NPC çevreyi kollar, açısı geniş */
  senseSight(e, x, y, range, alert) {
    const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy;
    if (d2 > range * range) return 0;
    const look = e.lookAt != null ? e.lookAt : e.ang, off = Math.abs(angDiff(look, Math.atan2(dy, dx)));
    const fov = off < (alert ? 1.3 : SENSE.FOV) ? 1 : off < (alert ? 2.35 : SENSE.SIDE) ? (alert ? 0.5 : SENSE.SIDE_K) : 0;
    if (!fov) return 0;
    return fov * this.losTrace(e.x, e.y, x, y, true);
  },
  /* Algı adımı (saniyede ~6 kez): görme, yakınlık ve ayak sesiyle şüphe dolar ya da söner; eşiklerde durum değişir */
  senseTick(e, dt) {
    // arkadaşının haberi: bildiği yer haberin yeridir; haber yeniden yayılmaz. Ceset haberiyse hemen aramaya başlar
    if (e.awPend && this.t >= e.awPend.t) { const pd = e.awPend; e.awPend = null; this.senseAlert(e, pd.pt, 'call'); if (pd.body) e.watchFor = 0.8; return; }
    e.senseAcc = (e.senseAcc || 0) + dt;
    if (e.senseAcc < 0.16) return;
    const h = Math.min(0.5, e.senseAcc); e.senseAcc = 0;
    const P = this.player;
    if (P.hp <= 0 || this.state !== 'play' || this.floorHid(e)) return;
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
    let gain = 0, pt = null, seen = false;
    const R = (SENSE.RANGE[e.isLaw ? 'law' : e.role] || 250) * this.litK() * this.stanceK() * this.weatherK() * (e.alertUntil > this.t ? 1.25 : 1);
    if (d < R && !e.asleep) {
      const v = this.senseSight(e, P.x, P.y, R, false);
      if (v > 0) { gain = Math.pow(1 - d / R, 0.6) * v * SENSE.RATE; seen = true; pt = { x: P.x, y: P.y }; }
    }
    // kol boyu yakın: görmese de sezer (nefes, gölge, hışırtı)
    if (d < (P.crouch ? 12 : 24) && !e.asleep) { gain = Math.max(gain, 6); pt = { x: P.x, y: P.y }; }
    // ayak sesi ve at
    const S = SENSE.STEP, mv = P.mv || 0;
    const step = P.riding ? (P.riding.spd > 110 ? S.gallop : P.riding.spd > 40 ? S.trot : 0) : mv > 0.15 ? (P.crouch ? S.crouch : P.sprinting ? S.sprint : S.walk) : 0;
    if (step && d < step && !this.insideB) { const g = (1 - d / step) * 1.6 * (e.asleep ? 0.4 : 1); if (g > gain) { gain = g; if (!seen) pt = this.senseGuess(e, P.x, P.y); } }
    if (gain > 0) { e.aw = Math.min(1, (e.aw || 0) + gain * h); if (pt) e.awPt = pt; }
    else e.aw = Math.max(0, (e.aw || 0) - h * (e.awState === 'suspect' ? 0.12 : 0.3));
    // arkadaşının cesedi (kanun adamı değil: sivil cesedi suç sistemi işler)
    if (!e.isLaw && !seen && (e.bodyT = (e.bodyT || 0) - h) <= 0) { e.bodyT = 0.6; if (this.senseBodies(e)) return; }
    if (e.aw >= 1) this.senseAlert(e, pt || e.awPt || this.senseGuess(e, P.x, P.y), seen ? 'see' : 'hear');
    else if (e.aw >= SENSE.SUSPECT && e.awState !== 'suspect') this.senseSuspect(e);
    else if (e.aw < SENSE.CALM && e.awState === 'suspect') {
      e.awState = null; e.awPt = null; e.lookAt = null; e.nav = null;
      if (chance(0.5)) e.say(pick([Tr('Rüzgârdı herhalde.'), Tr('Bir şey yok.'), Tr('Hayal görüyorum.')]), 1.8);
    }
  },
  senseSuspect(e) {
    e.awState = 'suspect'; e.susT = 0; e.nav = null;
    e.say(pick([Tr('Kim var orada?'), Tr('Bir ses duydum...'), Tr('Hm?'), Tr('Orada biri mi var?')]), 1.8);
  },
  /* Şüphelenen NPC: durur, dönüp bakar; bir saniye sonra şüphelendiği yere temkinli yürür, varınca çevreye bakınır */
  suspectStep(e, dt) {
    const p = e.awPt;
    e.susT = (e.susT || 0) + dt;
    if (!p) { e.mv = 0; return; }
    const a = Math.atan2(p.y - e.y, p.x - e.x), near = dist2(e.x, e.y, p.x, p.y) < 20 * 20;
    if (e.susT < 1.1 || near || e.isLaw) {
      e.mv = 0; e.spd = 0;
      e.ang = turnTo(e.ang, a, dt * 3);
      e.lookAt = near ? a + Math.sin(this.t * 1.6 + e.id) * 1.1 : null;
      return;
    }
    if (this.navStep(e, p.x, p.y, dt, e.mounted ? 50 : 30, { near: 16 }) !== 'moving') e.awPt = { x: e.x, y: e.y };
    e.lookAt = a;
  },
  /* Fark etti: çatışma. pt: bildiği yer (gördüyse tam, duyduysa ya da haber aldıysa sapmalı) */
  senseAlert(e, pt, how) {
    if (e.dead || e.bound) return;
    const first = e.awState !== 'alert';
    e.aw = 1; e.awState = 'alert'; e.alertT = this.t; e.awPend = null;
    if (pt) e.lkp = { x: pt.x, y: pt.y };
    e.search = null; e.watchT = 0; e.atLkp = false;
    e.sees = how === 'see' && !!pt && dist2(pt.x, pt.y, this.player.x, this.player.y) < 4;
    if (e.isLaw) { if (!e.hostile) { e.hostile = true; e.say(pick(LINES.law)); } }
    else {
      e.aggro = true;
      if (first) e.say(how === 'body' ? pick([Tr('Vurulmuş! Etrafa bakın!'), Tr('Biri onu öldürmüş! Dağılın, arayın!'), Tr('Pusu var! Gözünüzü açın!')])
        : how === 'call' ? pick([Tr('Geliyorum!'), Tr('Nerede?!'), Tr('Silahlanın!')]) : pick(LINES.bandit), 2);
    }
    if (first && how !== 'call') this.senseCall(e, e.lkp, how === 'body');
  },
  /* Bağırış: aynı kamptaki ya da 260 px içindeki arkadaşları kısa süre sonra öğrenir */
  senseCall(e, pt, body) {
    for (const o of this.ents) {
      if (o === e || o.kind !== 'npc' || o.dead || o.bound || o.remove || o.awPend || o.awState === 'alert') continue;
      if (e.isLaw ? !(o.isLaw && !o.hostile && this.law.level > 0) : !(o.role === 'bandit' || o.role === 'target')) continue;
      const same = !!(e.camp && o.camp === e.camp);
      if (!same && dist2(o.x, o.y, e.x, e.y) > SENSE.CALL * SENSE.CALL) continue;
      o.awPend = { t: this.t + rnd(0.4, 0.8), pt: pt && { x: pt.x, y: pt.y }, body };
    }
  },
  /* Arkadaşının cesedini görmek: katili görmeden alarm; cesedin yeri bilinen tek yerdir, oradan aranır */
  senseBodies(e) {
    const R = 230 * this.litK();
    for (const o of this.ents) {
      if (o.kind !== 'npc' || !o.dead || o.remove || o.bodySeen || o === e) continue;
      if (!(o.role === e.role || (e.camp && o.camp === e.camp))) continue;
      if (dist2(o.x, o.y, e.x, e.y) > R * R) continue;
      if (this.senseSight(e, o.x, o.y, R, false) < 0.2) continue;
      o.bodySeen = true;
      this.senseAlert(e, { x: o.x, y: o.y }, 'body');
      e.watchFor = 0.8;   // cesedin başında oyalanmaz, hemen aramaya başlar
      return true;
    }
    return false;
  },
  /* Ses: silah sesi yakındaysa alarm, uzaksa şüphe; çatışmadaki NPC sesi duyunca son bilinen yeri günceller */
  senseNoise(e, x, y, r, type, d2) {
    const d = Math.sqrt(d2), pt = this.senseGuess(e, x, y);
    if (e.aggro || (e.isLaw && e.hostile)) { if (!e.sees) { e.lkp = pt; e.search = null; e.atLkp = false; e.watchT = 0; } return; }
    if (e.asleep && type !== 'gun' && type !== 'loud') return;
    const loud = type === 'gun' || type === 'loud';
    if (loud && d < r * 0.6) { this.senseAlert(e, pt, 'hear'); return; }
    // uzak silah sesi her zaman şüphe ("?"): yakına doğru güçlenir; sessiz sesler (maymuncuk, ok) yalnız yakından
    e.aw = Math.min(0.95, Math.max(e.aw || 0, loud ? SENSE.SUSPECT + 0.5 * (1 - d / r) / 0.4 : 0) + (loud ? 0 : 0.45 * (1 - d / r)));
    e.awPt = pt;
    if (e.aw >= SENSE.SUSPECT && e.awState !== 'suspect') this.senseSuspect(e);
  },

  /* ---------------- çatışmada gözler ve arama ---------------- */
  /* Her 0,2 sn: oyuncuyu görüyorsa izler (görüş hattı yeter), kaybettiyse yeniden görmek için bakış yönü gerekir.
     Görünce son görülen yer ve gidiş yönü güncellenir. Döner: hedef nokta (görüyorsa oyuncu, görmüyorsa son bilinen yer). */
  npcEyes(e, dt, T) {
    if ((e.seeT = (e.seeT || 0) - dt) <= 0) {
      e.seeT = 0.2;
      const far = SENSE.SEEN * this.litK() * this.weatherK(), d2 = dist2(e.x, e.y, T.x, T.y);
      // ilk bakış (çatışmaya doğrudan sokulan NPC) ve izleme: görüş hattı; kaybettikten sonra: bakış yönü de gerekir
      if (e.sees === undefined || e.sees) e.sees = d2 < far * far && this.los(e.x, e.y, T.x, T.y);
      else e.sees = this.senseSight(e, T.x, T.y, far, true) > 0.2;
      if (e.sees) {
        e.lkp = { x: T.x, y: T.y };
        if (T === this.player) e.lkpDir = this.playerDir();
        e.search = null; e.watchT = 0; e.atLkp = false;
      } else if (!e.lkp) e.lkp = this.senseGuess(e, T.x, T.y);
    }
    e.lostT = e.sees ? 0 : (e.lostT || 0) + dt;
    return e.sees ? T : e.lkp;
  },
  /* Görmüyor: son bilinen yere yol bularak gider, varınca gözetler, sonra arar. Döner: true (bu karenin hareketi yapıldı) */
  npcSeek(e, dt, sp) {
    const L = e.lkp;
    if (!L) { e.mv = 0; return true; }
    if (e.search) { if (this.searchStep(e, dt)) return true; if (!e.lkp) return true; }
    const a = Math.atan2(L.y - e.y, L.x - e.x), td = dist(e.x, e.y, L.x, L.y);
    if (!e.atLkp && td > 36) {
      const r = this.navStep(e, L.x, L.y, dt, sp, { near: 30, enter: !e.mounted });
      // vardı ya da ulaşılamayan yerin (nehrin öbür yakası, kapalı bina) en yakın noktasına geldi: buradan gözetler.
      // İki kez takılırsa yaklaşmaktan vazgeçip olduğu yerden gözetler (engele yaslanıp kalmaz)
      if (r === 'arrived') e.atLkp = true;
      else if (r === 'fail') { if ((e.seekFail = (e.seekFail || 0) + 1) >= 2) e.atLkp = true; else { e.ang = turnTo(e.ang, a, dt * 4); e.walk(dt, sp * 0.85); } }
      e.lookAt = a;
      return true;
    }
    e.seekFail = 0;
    // son bilinen yerde: gözetler (başı sağa sola döner), sonra arar
    e.atLkp = true; e.mv = 0; e.spd = 0;
    e.ang = turnTo(e.ang, a, dt * 4);
    e.lookAt = e.ang + Math.sin(this.t * 1.3 + e.id) * 0.8;
    e.watchT = (e.watchT || 0) + dt;
    if (e.watchFor === undefined) e.watchFor = rnd(SENSE.WATCH_T[0], SENSE.WATCH_T[1]);
    if (e.watchT > e.watchFor) { e.search = this.searchPlan(e); e.watchFor = undefined; }
    return true;
  },
  /* Arama planı: son bilinen yerin çevresinde 3–5 nokta; ilki oyuncunun gidiş yönünde, grup üyeleri farklı yönlerden başlar.
     round: noktalar bitip süre kalınca daha geniş bir halkada yeni noktalar */
  searchPlan(e, round = 0) {
    const c = e.lkp, W = this.world, n = rndi(SENSE.SEARCH_N[0], SENSE.SEARCH_N[1]), pts = [];
    const base = (e.lkpDir !== undefined ? e.lkpDir : Math.random() * TAU) + ((e.id % 3) - 1) * 0.9 + round * 0.7;
    for (let k = 0; k < n * 4 && pts.length < n; k++) {
      const a = base + (k % n) * (TAU / n) * (k < n ? 0.6 : 1) + rnd(-0.35, 0.35), d = round ? rnd(120, 220) : rnd(50, 120);
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      if (W.blocked(x, y, 6) || W.isWaterPx(x, y) || W.indoorPx(x, y)) continue;
      if (pts.some(q => dist2(q.x, q.y, x, y) < 45 * 45)) continue;
      pts.push({ x, y });
    }
    return { pts, i: 0, pause: 0, t: 0, round, dur: rnd(SENSE.SEARCH_T[0], SENSE.SEARCH_T[1]) };
  },
  /* Arama adımı: noktaya yürü, varınca 1–1,8 sn çevreye bakın, sonrakine geç. Oyuncuyu kaybettiğinden beri (yola,
     gözetlemeye geçen zaman dahil) 25–45 sn geçince vazgeçer. Döner: aramaya devam ediyor mu */
  searchStep(e, dt) {
    const S = e.search;
    S.t += dt;
    if ((e.lostT || 0) > S.dur) { this.searchEnd(e); return false; }
    if (S.i >= S.pts.length) {
      const N = this.searchPlan(e, S.round + 1);
      if (!N.pts.length) { this.searchEnd(e); return false; }
      S.pts = N.pts; S.i = 0; S.round++;
    }
    const p = S.pts[S.i];
    if (S.pause > 0) {
      S.pause -= dt; e.mv = 0; e.spd = 0;
      e.lookAt = e.ang + Math.sin(this.t * 1.9 + e.id) * 1.2;
      if (S.pause <= 0) S.i++;
      return true;
    }
    const r = this.navStep(e, p.x, p.y, dt, e.mounted ? 70 : 40, { near: 14 });
    e.lookAt = null;
    if (r !== 'moving') {
      S.pause = rnd(1, 1.8);
      if (chance(0.3)) e.say(pick([Tr('Nereye kayboldu?'), Tr('Şu kayaların arkasına bakın!'), Tr('Burada değil.'), Tr('Çıkar ortaya!'), Tr('İzi buradan gidiyor...')]), 1.8);
    }
    return true;
  },
  /* Vazgeçti: haydut kampına döner ve bir süre tetikte kalır; kanun adamı aranma sürüyorsa son bildirilen yerin çevresini tarar */
  searchEnd(e) {
    e.search = null; e.watchT = 0; e.atLkp = false; e.lookAt = null; e.nav = null;
    if (e.isLaw) {
      const L = this.law;
      e.lkp = L.level > 0 ? this.senseGuess(e, L.lastX, L.lastY, 0.5) : null;
      e.lostT = 0;
      return;
    }
    e.lkp = null; e.sees = undefined; e.aggro = false; e.aw = 0.2; e.awState = null; e.alertUntil = this.t + SENSE.ALERT_T;
    e.state = 'idle'; e.t = rnd(1, 3);
    e.say(pick([Tr('Gitti galiba.'), Tr('Kimse yok. Gözünüzü dört açın.'), Tr('Kaçtı... Bir dahaki sefere.')]), 2.2);
  },
  /* Algıyı sıfırla: kanun adamı aranma bitince ya da düşmanlıktan vazgeçince */
  senseReset(e) {
    e.awState = null; e.aw = 0; e.awPt = null; e.awPend = null; e.lookAt = null; e.lkp = null; e.lkpDir = undefined;
    e.search = null; e.sees = undefined; e.atLkp = false; e.watchT = 0; e.watchFor = undefined; e.seekFail = 0; e.lostT = 0;
  },
  /* Tanık suçu görür mü: 120 px'ten yakında olan duyar ve görür; ötesinde bakış yönü gerekir (yakın silah sesi
     başı çevirir). Gece menzil kısalır. */
  witnessSees(e, x, y) {
    const d2 = dist2(e.x, e.y, x, y), R = 340 * this.litK();
    if (d2 > R * R) return false;
    if (d2 > 120 * 120) {
      const N = this.lastNoise, loud = N && N.type === 'gun' && this.t - N.t < 1.2 && d2 < 260 * 260;
      const off = Math.abs(angDiff(e.lookAt != null ? e.lookAt : e.ang, Math.atan2(y - e.y, x - e.x)));
      if (off > SENSE.SIDE && !loud) return false;
    }
    return this.los(e.x, e.y, x, y);
  },
};

/* ---------------- Fark edilme göstergesi (Ayarlar > Görüntü) ----------------
   Şüphelenen NPC'nin başının üstünde dolan amber "?", fark edince kırmızı "!" (2 sn), ararken yeniden "?".
   Ekranda, NPC'nin dünya konumuna bağlı küçük HTML işaretleri (iki çizicide de aynı). */
const AwareMarks = {
  map: new Map(),
  root() {
    let r = this._root;
    // HUD'un en altında: ipucu paneli, mini harita ve göstergeler işaretin üstünde kalır
    if (!r || !r.isConnected) { r = this._root = document.createElement('div'); r.id = 'awaremarks'; const h = document.getElementById('hud') || document.body; h.insertBefore(r, h.firstChild); }
    return r;
  },
  clear() { for (const m of this.map.values()) m.el.remove(); this.map.clear(); },
  update() {
    const on = G.settings.awareMarks !== false, P = G.player;
    const want = new Map();
    if (on && P) for (const e of G.ents) {
      if (e.kind !== 'npc' || e.dead || e.remove || e.bound || G.floorHid(e)) continue;
      if (!(e.role === 'bandit' || e.role === 'target' || e.isLaw)) continue;
      if (dist2(e.x, e.y, P.x, P.y) > 420 * 420) continue;
      let k = null;
      if (e.awState === 'alert' || (e.isLaw ? e.hostile : e.aggro)) {
        if (e.search || (e.lkp && !e.sees && e.lostT > 1.5)) k = { s: 'seek', v: 1 };
        else if (G.t - (e.alertT || -9) < 2) k = { s: 'alert', v: 1 };
      } else if ((e.aw || 0) > 0.05) k = { s: 'sus', v: Math.min(1, e.aw / SENSE.SUSPECT * 0.6 + (e.aw >= SENSE.SUSPECT ? 0.4 : 0)) };
      if (k) want.set(e, k);
    }
    for (const [e, m] of this.map) if (!want.has(e)) { m.el.remove(); this.map.delete(e); }
    if (!want.size) return;
    const C = G.cam, r = G.canvasRect(), kx = r.width / G.vw, root = this.root();
    for (const [e, k] of want) {
      let m = this.map.get(e);
      if (!m) { const el = document.createElement('div'); el.className = 'awm'; el.innerHTML = '<i></i>'; root.appendChild(el); m = { el, s: '', v: -1 }; this.map.set(e, m); }
      if (m.s !== k.s) { m.s = k.s; m.el.className = 'awm ' + k.s; m.el.firstChild.textContent = k.s === 'alert' ? '!' : '?'; }
      const v = Math.round(k.v * 20) / 20;
      if (m.v !== v) { m.v = v; m.el.style.setProperty('--k', v); }
      const x = r.left + (e.x - C.ox) * kx;
      let y = r.top + (e.y - C.oy - (e.mounted ? 24 : 17)) * kx;
      // konuşma balonu varsa işaret balonun üstünde durur (üst üste binmez)
      for (const B of Bubbles.list) if (B.e === e && B.py !== undefined) { y = Math.min(y, B.py - B.h - 2); break; }
      m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  },
};
