'use strict';
/* ==========================================================
   FRONTIER'S END — Etkileşim belirteçleri (Ayarlar > Görüntü)
   Sade: yaklaşılan etkileşimli şeyin (kişi, kapı, at, kuyu, sandık, tezgâh, av, kamp ateşi...) üstünde yalnızca
   küçük, hafifçe süzülen bir tuş simgesi belirir ve birkaç saniye sonra solar. Önündeki şey (sağ alttaki istemin
   gösterdiği) "üstüne gelinmiş" sayılır: simgesi genişler, yanında eylemin adı görünür; odak sürdükçe kalır.
   Eylem adı istemle aynı listeden gelir (G.findInteraction'ın geniş yarıçaplı tarama kipi): iki yer birbirinden kopmaz.
   - Bir şeyin simgesi bir kez görünür; menzilden çıkıp geri gelince (en erken AGAIN sn sonra) yeniden görünür.
   - Sıradan kasabalı yalnızca yakındaysa ve önündeyse, aynı anda en çok biri; uzun aralıkla yeniden.
   - Görevi ilerleten eylemin simgesi altın halkalıdır; görevin hedefi değişince yeniden görünür.
   - Atlıyken, yük taşırken, nişan alırken, çatışmada, aranırken, konuşma, sinematik ve pencere açıkken görünmez.
   ========================================================== */

const IMARK = {
  SCAN: 112,       // tarama yarıçapı (px)
  NPC: 64,         // sıradan kişi: bundan yakın ve önünde
  HARV: 56,        // toplanan bitki, cevher
  IN: 84,          // bina içindeki eşya (aynı binada)
  SHOW: 3.2,       // simgenin görünme süresi (sn)
  GONE: 2,         // menzilden en az bu kadar çıkınca yeniden görünebilir (sn)
  AGAIN: 10,       // aynı şeyin simgesi en erken bu kadar sonra yeniden (sn)
  NPC_AGAIN: 90,   // sıradan kişi için
  MAX: 5,          // aynı anda en çok (odaktaki hariç)
  RATE: 0.25,      // tarama aralığı (sn)
};

const InteractMarks = {
  st: new Map(),   // anahtar → { t0 (görünmeye başladı ya da null), seen, out, q, kd, c (aday), d, act, el, w, h, fadeT }
  now: 0, scanT: 0, busy: false,
  root() {
    let r = this._root;
    // HUD'un en altında: istemler, mini harita ve göstergeler simgenin üstünde kalır
    if (!r || !r.isConnected) { r = this._root = document.createElement('div'); r.id = 'imarks'; const h = document.getElementById('hud') || document.body; h.insertBefore(r, h.firstChild); }
    return r;
  },
  clear() { for (const s of this.st.values()) if (s.el) s.el.remove(); this.st.clear(); this.scanT = 0; },
  /* adayın türü: anahtarına göre (varlık, bina kapısı, karo sırası ya da başka) */
  kind(key) {
    if (typeof key === 'number') { const o = G.world.obj[key]; return HARVEST[o] ? 'harv' : isFurnO(o) && G.world.bid[key] >= 0 ? 'in' : 'obj'; }
    if (key.kind === 'npc') return this.plainNpc(key) ? 'folk' : 'npc';
    if (key.kind) return 'ent';
    if (key.door && key.def) return 'door';
    return 'misc';
  },
  /* sıradan kasabalı (selam, sohbet): öbür kişiler (hikâyenin kişileri, korumalar, olaylar, ödül hedefleri, yaralı,
     bağlı, teslim olmuş ya da ölü) önemli sayılır */
  plainNpc(e) {
    return !(e.quest || e.storyNpc || e.guard || e.servant || e.eventType || e.bountyId || e.role === 'hunter' || e.role === 'nomad' || e.dead || e.bound || e.state === 'surrender');
  },
  /* simge dünyada nerede: varlıkta başının üstü, karoda nesnenin üstü, kapıda kapının üstü */
  anchor(s) {
    const k = s.c.key;
    if (k && k.kind) {
      const e = k, h = e.kind === 'npc' ? (e.dead || e.bound || e.state === 'sleep' ? 9 : e.mounted ? 27 : 19) : e.kind === 'horse' ? 18 : e.kind === 'wagon' ? 20 : 10;
      return [e.x, e.y - h];
    }
    if (k && k.door) return [k.door.x, k.door.y - 20];
    return [s.c.x, s.c.y - 12];
  },
  /* görünmez mi: ayar, oyun durumu ve oyuncunun hâli (her karede bakılır, ucuz) */
  hidden() {
    const P = G.player;
    if (G.settings.imarks === false || G.state !== 'play' || !P || P.dead || G.cine || G.binoc) return true;
    if (UI.isModal() || UI.state === 'fade' || UI.mapShown()) return true;
    if (P.riding || P.carry || P.passenger || P.aiming || P.deadeye || P.rope) return true;
    if (G.law && G.law.level > 0) return true;
    return !!(G.storyTalking && G.storyTalking());
  },
  /* çatışma: yakında saldıran biri ya da saldırgan hayvan */
  fight() {
    const P = G.player;
    for (const e of G.ents) if (e.hostile && !e.dead && (e.aggro || (e.kind === 'animal' && e.state === 'attack')) && Math.abs(e.x - P.x) + Math.abs(e.y - P.y) < 520) return true;
    return false;
  },
  /* görünen eylem: görevin hedefi seçeneklerin içindeyse onun adı */
  act(ea, gi) { const a = ea[gi > 0 ? gi : 0]; return a ? a.n : ''; },
  /* aday listesini tara: menzildekileri işaretle, görünmeye hazır olanlara sıra ver */
  scan() {
    const P = G.player, W = G.world, now = this.now;
    this.busy = this.fight();
    const cands = this.busy ? null : G.findInteraction(IMARK.SCAN);
    const pIn = W.indoorPx(P.x, P.y), pb = W.bid[(P.y >> 4) * WW + (P.x >> 4)];
    const C = G.cam, mx = 14;
    const seen = new Set(), took = [];
    if (cands) cands.sort((a, b) => a.d - b.d);
    if (cands) for (const c of cands) {
      const key = c.key;
      if (key === null || key === undefined || seen.has(key)) continue;
      const kd = this.kind(key);
      const d = dist(P.x, P.y, c.x, c.y);
      const ea = UI.eActs(c);
      if (!ea.length) continue;
      const gi = G.qPromptGoal({ x: c.x, y: c.y, actions: ea }), q = gi >= 0;
      // menzil türüne göre; görevin hedefi her zaman tarama menzilinde
      if (!q) {
        if (kd === 'folk' && (d > IMARK.NPC || Math.abs(angDiff(P.ang, Math.atan2(c.y - P.y, c.x - P.x))) > 1.15)) continue;
        if (kd === 'harv' && d > IMARK.HARV) continue;
        if (kd === 'in' && d > IMARK.IN) continue;
      }
      // aynı yerde mi: içerideyken dışarıdakiler, dışarıdayken içerideki eşyalar sayılmaz (kapı hep dışarıda)
      if (kd === 'door') { if (pIn) continue; }
      else if (kd === 'in') { if (W.bid[key] !== pb) continue; }
      else if (W.indoorPx(c.x, c.y) !== pIn) continue;
      // ekranda
      if (c.x < C.ox - mx || c.x > C.ox + G.vw + mx || c.y < C.oy - mx || c.y > C.oy + G.vh + mx) continue;
      // aynı eylemin yan yana karoları (ör. birkaç karoluk tezgâh) tek simge: yakındaki aynısı alındıysa atla
      const act = this.act(ea, gi);
      if (took.some(t => t.act === act && Math.abs(t.x - c.x) < 56 && Math.abs(t.y - c.y) < 56)) continue;
      took.push({ act, x: c.x, y: c.y });
      seen.add(key);
      let s = this.st.get(key);
      if (!s) { s = { t0: null, seen: now, out: 0, q, kd }; this.st.set(key, s); }
      // menzilden yeterince uzun çıkıp döndüyse (ve epey zaman geçtiyse) yeniden görünebilir
      if (s.out && now - s.out >= IMARK.GONE && s.t0 !== null && now - s.t0 >= (kd === 'folk' ? IMARK.NPC_AGAIN : IMARK.AGAIN)) s.t0 = null;
      if (q && !s.q && s.t0 !== null && now - s.t0 >= IMARK.SHOW) s.t0 = null;   // görevin hedefi oldu: yeniden
      s.out = 0; s.seen = now; s.q = q; s.kd = kd; s.c = c; s.d = d; s.act = act;
    }
    // menzilden çıkanlar
    for (const [k, s] of this.st) {
      if (seen.has(k)) continue;
      if (!s.out) s.out = now;
      if (now - s.seen > 60 && !s.el) this.st.delete(k);
    }
    // görünmeye başlayacaklar: önce görev, sonra yakın olan; aynı anda en çok MAX (sıradan kişi en çok bir)
    let n = 0, folk = 0;
    for (const s of this.st.values()) if (this.timed(s)) { n++; if (s.kd === 'folk') folk++; }
    const ready = [];
    for (const [k, s] of this.st) if (seen.has(k) && s.t0 === null) ready.push(s);
    ready.sort((a, b) => (b.q - a.q) || (a.d - b.d));
    for (const s of ready) {
      if (n >= IMARK.MAX) break;
      if (s.kd === 'folk' && folk) continue;
      s.t0 = now; n++;
      if (s.kd === 'folk') folk++;
    }
  },
  /* süreli görünme (yaklaşınca) */
  timed(s) { return s.t0 !== null && this.now - s.t0 < IMARK.SHOW; },
  /* odak ("üstüne gelinmiş"): sağ alttaki istemin gösterdiği şey. Belirteci yoksa (ör. tezgâhın başka karosu) aynı
     eylemin yakındaki belirteci, o da yoksa yeni bir belirteç */
  focus() {
    const cur = UI.holdTarget || UI.curInteract;
    if (!cur || cur.key === null || cur.key === undefined || cur.riding || cur.far) return null;
    let s = this.st.get(cur.key);
    const ea = UI.eActs(cur), gi = G.qPromptGoal({ x: cur.x, y: cur.y, actions: ea }), act = this.act(ea, gi);
    if (!s) for (const o of this.st.values()) if (o.c && o.act === act && Math.abs(o.c.x - cur.x) < 56 && Math.abs(o.c.y - cur.y) < 56 && this.now - o.seen < 1) { s = o; break; }
    if (!s) { s = { t0: this.now - IMARK.SHOW, seen: this.now, out: 0, kd: this.kind(cur.key) }; this.st.set(cur.key, s); }
    if (!s.c || s.c.key === cur.key) s.c = cur;
    s.q = gi >= 0; s.act = act; s.seen = this.now; s.d = 0;
    return s;
  },
  update(dt) {
    this.now += dt;
    if (this.hidden()) { this.fadeAll(dt, true); return; }
    if ((this.scanT -= dt) <= 0) { this.scanT = IMARK.RATE; this.scan(); }
    if (this.busy) { this.fadeAll(dt, true); return; }
    const fs = this.focus();
    const r = G.canvasRect(), kx = r.width / G.vw, C = G.cam, root = this.root();
    // yakından uzağa yerleştir (odaktaki önce): üst üste binen simge yukarı kayar
    const vis = [];
    for (const s of this.st.values()) {
      if (s === fs || this.timed(s)) vis.push(s);
      else if (s.el) this.fade(s, dt);
    }
    vis.sort((a, b) => (b === fs) - (a === fs) || a.d - b.d);
    const placed = [];
    for (const s of vis) {
      if (!s.el) { s.el = document.createElement('div'); s.el.className = 'imk'; s.el.innerHTML = `${Input.glyph('interact')}<i></i>`; root.appendChild(s.el); s.html_ = null; s.cls = ''; s.fadeT = 0; }
      const f = s === fs, txt = f ? s.act : '';
      const key = txt + '|' + Input.device;
      if (s.html_ !== key) { s.html_ = key; s.el.innerHTML = `${Input.glyph('interact')}<i>${txt}</i>`; s.w = 0; }
      const cls = 'imk on' + (f ? ' f' : '') + (s.q ? ' q' : '');
      if (s.cls !== cls) { s.cls = cls; s.el.className = cls; s.w = 0; }
      if (!s.w || f) { s.w = s.el.offsetWidth || 24; s.h = s.el.offsetHeight || 22; }   // odaktaki genişlerken boyu değişir
      s.fadeT = 0;
      const [ax, ay] = this.anchor(s);
      let x = r.left + (ax - C.ox) * kx, y = r.top + (ay - C.oy) * kx - 3;
      // konuşma balonunun üstünde dur
      const k = s.c.key;
      if (k && k.kind === 'npc') for (const B of Bubbles.list) if (B.e === k && B.py !== undefined) { y = Math.min(y, B.py - B.h - 2); break; }
      // [y - h, y] dikey aralığı: yerleşmiş bir simgeyle kesişirse onun üstüne çıkar
      for (let it = 0; it < 4; it++) {
        let hit = null;
        for (const p of placed) if (Math.abs(p.x - x) < (p.w + s.w) / 2 + 3 && y > p.y - p.h - 2 && y - s.h < p.y + 2) { hit = p; break; }
        if (!hit) break;
        y = hit.y - hit.h - 3;
      }
      placed.push({ x, y, w: s.w, h: s.h });
      s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  },
  /* solarak kaybol (CSS geçişi), sonra öğeyi kaldır */
  fade(s, dt) {
    if (s.el.classList.contains('on')) { s.el.classList.remove('on'); s.cls = ''; }
    s.fadeT = (s.fadeT || 0) + dt;
    if (s.fadeT > 0.45) { s.el.remove(); s.el = null; s.fadeT = 0; }
  },
  fadeAll(dt, hard) {
    for (const s of this.st.values()) {
      // gizlenen durumda görünmekte olan simgenin süresi biter: geri dönünce aynı simge yeniden çıkmaz
      if (hard && this.timed(s)) s.t0 = this.now - IMARK.SHOW;
      if (s.el) this.fade(s, dt);
    }
  },
};
