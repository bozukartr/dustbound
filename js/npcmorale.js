'use strict';
/* ==========================================================
   FRONTIER'S END — NPC morali, takım rolü ve teslim olma (G nesnesine eklenir)
   Moral (0..1, saniyede iki kez): canı azaldıkça (%60 altı −0,2, %35 altı −0,5), yanında savaşan arkadaşı kalmayınca
           (−0,2), arkadaşları düştükçe (ölen, bağlanan, teslim olan; her biri −0,15, en çok −0,45), mermisi bitince
           (−0,3) ve baskı altında (−0,1) düşer.
   Geri çekilme (moral < 0,38): tehditten uzak bir siper seçer.
   Kırılma (moral < 0,2): haydut ve ödül hedefi silahını atıp teslim olur (oyuncu yakında ve görüyorsa her zaman, uzaksa
           yarı yarıya) ya da kaçar; kaçarken oyuncu yaklaşırsa teslim olur. Teslim olan ellerini kaldırır, bağlanabilir
           (Bağla), şerife canlı teslim edilir; teslim olanı vurmak onurdan götürür. Oyuncu uzaklaşırsa bir süre sonra
           sıvışır.
   Kanun: kanun adamı teslim olmaz; morali düşünce bir kez destek çağırır (yeni ekip çabuk gelir) ve geri çekilir.
   Takım: çatışmadaki 3 ve daha kalabalık bir grupta biri yan dolaşır: siperini öbürlerinin oyuncuya göre durduğu yönden
           en az 60° açıkta seçer, oyuncuyu çapraz ateşe alır.
   ========================================================== */

const MORALE = { RETREAT: 0.38, BREAK: 0.2, TICK: 0.5, GIVE: 170, LEAVE: 600 };

const NpcMorale = {
  /* Aynı taraftaki (haydut-ödül hedefi ya da kanun) yakın arkadaşlar: { up: savaşan, down: düşen } */
  allies(e) {
    let up = 0, down = 0;
    for (const o of this.ents) {
      if (o === e || o.kind !== 'npc' || o.remove) continue;
      if (e.isLaw ? !o.isLaw : !(o.role === 'bandit' || o.role === 'target')) continue;
      if (!((e.camp && o.camp === e.camp) || dist2(o.x, o.y, e.x, e.y) < 400 * 400)) continue;
      if (o.dead) { if ((o.deadT || 0) < 60) down++; }
      else if (o.bound || o.state === 'surrender') down++;
      else if (o.aggro || (o.isLaw && o.hostile)) up++;
    }
    return { up, down };
  },
  moraleTick(e, dt) {
    if ((e.morT = (e.morT || 0) - dt) > 0 && e.mor !== undefined) return e.mor;
    e.morT = MORALE.TICK;
    const hp = e.hp / e.maxHp, A = this.allies(e);
    let m = 1;
    if (hp < 0.35) m -= 0.5; else if (hp < 0.6) m -= 0.2;
    if (!A.up) m -= 0.2;
    m -= Math.min(0.45, A.down * 0.15);
    if (e.dry) m -= 0.3;
    if (this.t - (e.supT === undefined ? -9 : e.supT) < 1.5) m -= 0.1;
    e.mor = m; e.allyN = A.up;
    return m;
  },
  /* Çatışmanın başında (fight içinden): moral düşükse geri çekil, kırıldıysa kaç ya da teslim ol. Döner: true (bu karenin
     işi yapıldı) */
  moraleStep(e, dt, P) {
    if (!(e.isLaw || e.role === 'bandit' || e.role === 'target')) return false;   // ödül avcısı, koruma kendi kuralıyla
    const m = this.moraleTick(e, dt);
    if (e.isLaw) {
      // kanun adamı teslim olmaz: bir kez destek çağırır, geri çekilir
      e.retreat = m < MORALE.RETREAT;
      if (e.retreat && !e.backup) {
        e.backup = true;
        e.say(pick([Tr('Destek lazım!'), Tr('Adam yollayın!'), Tr('Vuruldum! Yardım edin!')]), 2);
        if (this.law.level > 0) this.law.spawnT = Math.min(this.law.spawnT, 1.5);
      }
      return false;
    }
    const pd = dist(e.x, e.y, P.x, P.y), sees = e.sees && pd < MORALE.GIVE;
    if (e.fleeing) {
      if (sees) { this.npcSurrender(e); return true; }   // kaçarken yakalandı
      e.cov = null; e.lookAt = null;
      if (e.mounted) { e.ang = turnTo(e.ang, Math.atan2(e.y - P.y, e.x - P.x), dt * 4); e.walk(dt, 140); }
      else this.fleeStep(e, P.x, P.y, dt, 84);
      if (pd > 700 && !this.onScreen(e.x, e.y, 40)) e.remove = true;   // kaçıp gitti
      return true;
    }
    e.retreat = m < MORALE.RETREAT;
    if (m >= MORALE.BREAK) return false;
    // kırıldı: yakındaysan ve görüyorsa teslim olur; uzaksa yarı yarıya kaçar
    if (sees || chance(0.5)) this.npcSurrender(e);
    else { e.fleeing = true; e.cov = null; e.nav = null; e.say(pick([Tr('Kaçın!'), Tr('Benden bu kadar!'), Tr('Geri çekilin!')]), 2); }
    return true;
  },
  /* Teslim ol: silahını yere atar, ellerini kaldırır (G.surrender oyuncunun kanuna teslim olmasıdır, js/systems.js) */
  npcSurrender(e) {
    if (e.state === 'surrender' || e.dead) return;
    if (e.weapon) { this.dropNpcWeapon(e); e.weapon = null; }
    e.state = 'surrender'; e.surrT = 0; e.awayT = 0; e.aggro = false; e.fleeing = false; e.retreat = false;
    e.cov = null; e.nav = null; e.search = null; e.lkp = null; e.awState = null; e.aw = 0; e.lookAt = null; e.mv = 0; e.spd = 0;
    e.anim = { k: 'handsup', t: 0, dur: 1e9 };
    e.say(pick([Tr('Tamam, tamam! Teslim oluyorum!'), Tr('Ateş etme! Silahımı bıraktım!'), Tr('Yeter! Teslim!')]), 2.5);
  },
  /* Teslim olmuş: durur, oyuncuya döner, ellerini kaldırır. Oyuncu uzaklaşıp ekrandan çıkınca bir süre sonra sıvışır */
  surrenderStep(e, dt, pd) {
    const P = this.player;
    e.mv = 0; e.spd = 0; e.surrT += dt;
    e.ang = turnTo(e.ang, Math.atan2(P.y - e.y, P.x - e.x), dt * 3);
    if (!e.anim || e.anim.k !== 'handsup') e.anim = { k: 'handsup', t: 0, dur: 1e9 };
    if (Math.random() < dt * 0.08) e.say(pick([Tr('Ateş etme...'), Tr('Silahsızım, bak!'), Tr('Beni şerife götür, vurma yeter.')]), 2);
    e.awayT = pd > MORALE.LEAVE ? e.awayT + dt : 0;
    if (e.awayT > 20 && !this.onScreen(e.x, e.y, 40)) e.remove = true;
  },
  /* Teslim olanı vurmak: onur kaybı (bir kez) */
  shotSurrendered(e) {
    if (e.surrShot) return;
    e.surrShot = true;
    this.addHonor(-3);
    UI.feed(Tr('Teslim olan birini vurdun. Onurun zedelendi.'), 'honor');
  },
  /* Takım: 3+ kişilik çatışan grupta biri yan dolaşır (bir kez seçilir) */
  flankRole(e) {
    if (e.flank !== undefined) return e.flank;
    let n = 0, taken = false;
    for (const o of this.ents) {
      if (o === e || o.kind !== 'npc' || o.dead || !(o.aggro || (o.isLaw && o.hostile))) continue;
      if (e.isLaw ? !o.isLaw : !(o.role === 'bandit' || o.role === 'target')) continue;
      if (dist2(o.x, o.y, e.x, e.y) > 350 * 350) continue;
      n++; if (o.flank) taken = true;
    }
    return (e.flank = n >= 2 && !taken && !e.mounted);
  },
  /* Yan dolaşanın tercih ettiği yön: öbürlerinin tehdide göre ortalama yönü (yoksa undefined) */
  groupBearing(e, tx, ty) {
    let sx = 0, sy = 0, n = 0;
    for (const o of this.ents) {
      if (o === e || o.kind !== 'npc' || o.dead || o.flank || !(o.aggro || (o.isLaw && o.hostile))) continue;
      if (e.isLaw ? !o.isLaw : !(o.role === 'bandit' || o.role === 'target')) continue;
      if (dist2(o.x, o.y, e.x, e.y) > 450 * 450) continue;
      const a = Math.atan2(o.y - ty, o.x - tx); sx += Math.cos(a); sy += Math.sin(a); n++;
    }
    return n ? Math.atan2(sy, sx) : undefined;
  },
};
