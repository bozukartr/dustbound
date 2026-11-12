'use strict';
/* ==========================================================
   FRONTIER'S END — NPC çatışması: siper ve isabet (G nesnesine eklenir)
   Siper:  Çatışmadaki yaya NPC (haydut, ödül hedefi; tutuklamaya değil vurmaya gelen kanun adamı) çevresindeki kalıcı
           engellerin (kaya, harabe duvarı, sandık, fıçı, araba, bina, uçurum) arkasında, tehdidin görüşünü kesen bir yer
           arar. Oraya koşar (koşarken de ateş edebilir, isabetsiz), çömelir; şarjörünü orada değiştirir. Bir süre sonra
           siperin yanına çıkar (görüşün açıldığı yer), nişan oturtup kısa bir atış dizisi yapar, geri çekilir. Yakınından
           mermi geçerse siperde kalır. Tehdit yandan dolaşıp siperi açığa çıkarırsa yeni siper arar; siper yoksa eskisi
           gibi yanlayarak çatışır. Arkadaşlar aynı siperi paylaşmaz.
   İsabet: Atışın sapma açısı: rol (kanun adamı en isabetli, haydut en az), mesafe, NPC'nin yürümesi ya da atlı oluşu,
           nişan oturtma (hedefi yeni görünce ve siperden çıkınca 0,6 sn'de oturur), hedefin hareketi (koşan, dörtnala
           daha zor; çömelmiş daha küçük), ışık (gece) ve baskı (yakınından mermi geçen 1,5 sn titrek).
   ========================================================== */

const COVER = {
  R: 170,                 // siper arama yarıçapı (px)
  NEAR: 50, FAR: 420,     // tehdide en az / en çok uzaklık
  STEP: [14, 17, 20],     // siper noktasının engelin merkezinden uzaklığı (ilk boş olan; engel bütün karoyu kaplar)
  PEEK: [14, 20],         // yana çıkış (atış noktası) uzaklığı: görüşün iyice açıldığı ilk yer
  HIDE: [1.6, 3.0],       // siperde bekleme (sn)
  OUT: [0.7, 1.2],        // dışarıda kalma (sn)
  SUP: 1.5,               // baskı süresi (sn)
  KEEP: 4,                // siperdeyken tehdidin yerini bildiği süre (görmeden)
};

const NpcCombat = {
  /* Mermiyi tutan, gövdeyi gizleyen kalıcı engel */
  coverTile(i) {
    const W = this.world, o = W.obj[i];
    return o === O.BOULDER || o === O.RUINWALL || o === O.CRATE || o === O.BARREL || o === O.WAGON || (W.flags[i] & 8) || isCliffT(W.tile[i]);
  },
  /* Siper ara: tehdide (tx, ty) göre engelin arka yüzünde, gövdenin sığdığı, tehditten görülmeyen ve yanında görüşün
     açıldığı (atış için) bir nokta. Puan: NPC'ye yakınlık, silahına uygun mesafe, arkadaşların siperinden uzaklık,
     tehdide doğru koşmanın cezası. Döner: { x, y, peek: {x, y}, t } ya da null */
  coverFind(e, tx, ty) {
    const W = this.world, R = COVER.R;
    const Wp = WEAPONS[e.weapon] || {}, pref = e.weapon === 'shotgun' ? 80 : Wp.kind === 'long' ? 200 : 140;
    const taken = [];
    for (const o of this.ents) if (o !== e && o.kind === 'npc' && o.cov && !o.dead) taken.push(o.cov);
    const dE0 = dist(e.x, e.y, tx, ty);
    let best = null, bestS = Infinity;
    const x0 = Math.max(0, Math.floor((e.x - R) / TS)), x1 = Math.min(WW - 1, Math.floor((e.x + R) / TS));
    const y0 = Math.max(0, Math.floor((e.y - R) / TS)), y1 = Math.min(WH - 1, Math.floor((e.y + R) / TS));
    for (let ty_ = y0; ty_ <= y1; ty_++) for (let tx_ = x0; tx_ <= x1; tx_++) {
      const i = ty_ * WW + tx_;
      if (!this.coverTile(i)) continue;
      const cx = tx_ * TS + 8, cy = ty_ * TS + 8, dT = dist(cx, cy, tx, ty);
      if (dT < COVER.NEAR || dT > COVER.FAR) continue;
      const ux = (cx - tx) / dT, uy = (cy - ty) / dT;
      let px = 0, py = 0, ok = false;
      for (const st of COVER.STEP) { px = cx + ux * st; py = cy + uy * st; if (!W.blocked(px, py, (e.r || 4) + 1) && !W.isWaterPx(px, py) && !W.indoorPx(px, py)) { ok = true; break; } }
      if (!ok || (px - e.x) * (px - e.x) + (py - e.y) * (py - e.y) > R * R) continue;
      if (this.losTrace(tx, ty, px, py, true) > 0) continue;   // tehdit görüyor: siper değil
      // atış noktası: siperin sağında ya da solunda görüşün açıldığı yer
      let peek = null;
      for (const s of (tx_ + ty_) & 1 ? [1, -1] : [-1, 1]) {
        for (const k of COVER.PEEK) {
          const qx = px - uy * k * s, qy = py + ux * k * s;
          if (W.blocked(qx, qy, e.r || 4) || W.isWaterPx(qx, qy)) break;
          if (this.losTrace(qx, qy, tx, ty, true) > 0.5) { peek = { x: qx, y: qy }; break; }
        }
        if (peek) break;
      }
      if (!peek) continue;
      const dE = dist(e.x, e.y, px, py);
      let sc = dE + Math.abs(dT - pref) * 0.5 + Math.max(0, dE0 - dT - 40) * 0.8;
      for (const c of taken) if (dist2(c.x, c.y, px, py) < 34 * 34) sc += 90;
      if (sc < bestS) { bestS = sc; best = { x: px, y: py, peek, t: this.t }; }
    }
    return best;
  },
  /* Siper adımı (fight içinden, NPC tehdidi görüyorken ya da siperde yerini bilirken). Döner: true (bu karenin işi yapıldı),
     false (siper yok: yanlayarak çatışsın). T: tehdidin bilinen yeri; P: hedef (atış için) */
  coverStep(e, dt, T, P, Wp) {
    let C = e.cov;
    if (e.sees && C) C.seenT = this.t;
    // ara, yenile: yoksa; açığa çıktıysa (tehdit siperi görüyor); 8 sn'den eskiyse (tehdit yer değiştirmiş olabilir)
    if ((e.covT = (e.covT || 0) - dt) <= 0 && (!C || C.st !== 'out')) {
      e.covT = rnd(0.45, 0.7);
      const exposed = !!C && C.st !== 'go' && this.losTrace(T.x, T.y, C.x, C.y, true) > 0.25;
      if (!C || exposed || this.t - C.t > 8) {
        const N = this.coverFind(e, T.x, T.y);
        if (N && (!C || exposed || dist2(N.x, N.y, C.x, C.y) > 24 * 24)) {
          if (!C && chance(0.25)) e.say(pick([Tr('Siper alın!'), Tr('Kayaların arkasına!'), Tr('Başını eğ!')]), 1.6);
          N.st = 'go'; N.seenT = C ? C.seenT : this.t; e.cov = C = N; e.nav = null;
        }
        else if (C && !exposed) C.t = this.t;
        else if (!N) { e.cov = C = null; }
      }
    }
    if (!C) return false;
    const a = Math.atan2(T.y - e.y, T.x - e.x);
    // siperde iken (görmeden) tehdidin yerini ancak bir süre bilir; sonra arar (js/npcsense.js)
    if (!e.sees && this.t - (C.seenT || -9) > COVER.KEEP) { e.cov = null; return false; }
    if (C.st === 'go' || C.st === 'back') {
      const r = this.navStep(e, C.x, C.y, dt, C.st === 'go' ? 72 : 46, { near: 5 });
      e.lookAt = a;
      if (e.sees && C.st === 'go') e.npcFire(P, Wp, true);   // koşarken de ateş eder (isabetsiz)
      if (r === 'arrived' || dist2(e.x, e.y, C.x, C.y) < 6 * 6) { C.st = 'hide'; C.until = this.t + rnd(COVER.HIDE[0], COVER.HIDE[1]); e.nav = null; e.mv = 0; }
      else if (r === 'fail') { e.cov = null; e.nav = null; return false; }
      return true;
    }
    if (C.st === 'hide') {
      e.mv = 0; e.spd = 0; e.lookAt = null;
      e.ang = turnTo(e.ang, a, dt * 5);
      const sup = this.t - (e.supT || -9) < COVER.SUP;
      if (this.t > C.until && !(e.reloadT > 0) && e.mag > 0 && !sup) { C.st = 'peek'; e.nav = null; }
      return true;
    }
    if (C.st === 'peek') {   // yana çıkıyor
      const r = this.navStep(e, C.peek.x, C.peek.y, dt, 46, { near: 2 });
      e.lookAt = a;
      if (r !== 'moving' || dist2(e.x, e.y, C.peek.x, C.peek.y) < 3 * 3) { C.st = 'out'; C.fired = false; C.until = this.t + rnd(COVER.OUT[0], COVER.OUT[1]); e.aimT0 = this.t; e.nav = null; }
      return true;
    }
    // dışarıda: nişan alır, ateş eder; süre dolunca (henüz ateş etmediyse en çok 0,8 sn daha bekler), şarjör bitince ya da
    // baskı altında geri çekilir
    e.mv = 0; e.spd = 0; e.lookAt = null;
    e.ang = turnTo(e.ang, a, dt * 8);
    if (e.sees && e.npcFire(P, Wp, false)) C.fired = true;
    if ((this.t > C.until && (C.fired || this.t > C.until + 0.8)) || e.reloadT > 0 || e.mag <= 0 || this.t - (e.supT || -9) < 0.25) { C.st = 'back'; e.nav = null; }
    return true;
  },
  /* İsabet: atışın sapma açısı (radyan, ±) */
  npcSpread(e, T, d, moving) {
    const P = this.player;
    let s = e.isLaw ? 0.065 : e.role === 'target' || e.role === 'hunter' ? 0.07 : 0.085;
    s += Math.min(0.05, d / 5000);                                       // uzaklık
    if (moving) s += e.mounted ? 0.05 : 0.035;                           // yürürken, atlıyken
    s += Math.max(0, 1 - (this.t - (e.aimT0 === undefined ? -9 : e.aimT0)) / 0.6) * 0.07;   // nişan oturtma
    if (T === P) {
      if (P.sprinting || (P.riding && P.riding.spd > 80)) s += 0.06;     // koşan, dörtnala giden
      else if ((P.mv || 0) > 0.15 || (P.riding && P.riding.spd > 20)) s += 0.02;
      if (P.crouch) s += 0.025;                                          // çömelmiş: küçük hedef
    }
    s *= 1 + (1 - this.litK()) * 0.7;                                    // karanlık
    if (this.t - (e.supT === undefined ? -9 : e.supT) < COVER.SUP) s += 0.05;   // baskı
    if (this.difficulty === 'hard') s *= 0.88;
    return s;
  },
  /* Baskı: oyuncunun mermisi yakınından (36 px) geçen, siperine çarpan ya da onu vuran düşman NPC kısa süre titrek nişan
     alır, siperde kalır */
  suppress(ox, oy, dx, dy, len, hit) {
    for (const e of this.ents) {
      if (e.kind !== 'npc' || e.dead || !e.hostile) continue;
      const rx = e.x - ox, ry = e.y - oy;
      if (Math.abs(rx) > len + 40 || Math.abs(ry) > len + 40) continue;
      const t = rx * dx + ry * dy;
      if (t < 0 || t > len + 40) continue;   // siperine çarpan mermi de (durduğu yerin 40 px ötesine kadar)
      if (e === hit || Math.abs(rx * dy - ry * dx) < 36) e.supT = this.t;
    }
  },
};
