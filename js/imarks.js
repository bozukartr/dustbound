'use strict';
/* ==========================================================
   FRONTIER'S END — Etkileşim belirteçleri (Ayarlar > Görüntü)
   Yakındaki etkileşimli şeylerin (kişi, kapı, at, kuyu, sandık, tezgâh, av, kamp ateşi...) üstünde birkaç saniyeliğine
   küçük bir etiket belirir: adı, tuşu ve eylemi; sonra solar. Oyuncu nasıl etkileşime gireceğini görür, ekran kalabalık
   kalmaz. Etiket sağ alttaki istemle aynı eylem listesinden gelir (G.findInteraction'ın geniş yarıçaplı tarama kipi):
   iki yerdeki adlar birbirinden kopmaz.
   - Bir şeyin etiketi bir kez görünür; menzilden çıkıp geri gelince (en erken AGAIN sn sonra) yeniden görünür.
   - Sıradan kasabalı yalnızca yakındaysa ve önündeyse, aynı anda en çok biri; uzun aralıkla yeniden.
   - Görevi ilerleten eylemin etiketi altın renklidir; görevin hedefi değişince yeniden görünür.
   - Atlıyken, yük taşırken, nişan alırken, çatışmada, aranırken, konuşma, sinematik ve pencere açıkken görünmez.
   ========================================================== */

const IMARK = {
  SCAN: 112,       // tarama yarıçapı (px)
  NPC: 64,         // sıradan kişi: bundan yakın ve önünde
  HARV: 56,        // toplanan bitki, cevher
  IN: 84,          // bina içindeki eşya (aynı binada)
  SHOW: 3.2,       // görünme süresi (sn)
  GONE: 2,         // menzilden en az bu kadar çıkınca yeniden görünebilir (sn)
  AGAIN: 10,       // aynı şeyin etiketi en erken bu kadar sonra yeniden (sn)
  NPC_AGAIN: 90,   // sıradan kişi için
  MAX: 5,          // aynı anda en çok
  RATE: 0.25,      // tarama aralığı (sn)
};

const InteractMarks = {
  st: new Map(),   // anahtar → { t0 (görünmeye başladı ya da null), seen, out, q, c (aday), el, html, w, h, fadeT }
  now: 0, scanT: 0, busy: false,
  root() {
    let r = this._root;
    // HUD'un en altında: istemler, mini harita ve göstergeler belirtecin üstünde kalır
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
  /* yerinde duran şeyin etiketi dünyada nereye: varlıkta başının üstü, karoda nesnenin üstü, kapıda kapının üstü */
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
      // aynı eylemin yan yana karoları (ör. birkaç karoluk tezgâh) tek etiket: yakındaki aynısı alındıysa atla
      const html = this.html(c, ea, gi);
      if (took.some(t => t.html === html && Math.abs(t.x - c.x) < 56 && Math.abs(t.y - c.y) < 56)) continue;
      took.push({ html, x: c.x, y: c.y });
      seen.add(key);
      let s = this.st.get(key);
      if (!s) { s = { t0: null, seen: now, out: 0, q, kd }; this.st.set(key, s); }
      // menzilden yeterince uzun çıkıp döndüyse (ve epey zaman geçtiyse) yeniden görünebilir
      if (s.out && now - s.out >= IMARK.GONE && s.t0 !== null && now - s.t0 >= (kd === 'folk' ? IMARK.NPC_AGAIN : IMARK.AGAIN)) s.t0 = null;
      if (q && !s.q && s.t0 !== null && now - s.t0 >= IMARK.SHOW) s.t0 = null;   // görevin hedefi oldu: yeniden
      s.out = 0; s.seen = now; s.q = q; s.kd = kd; s.c = c; s.d = d; s.html = html;
    }
    // menzilden çıkanlar
    for (const [k, s] of this.st) {
      if (seen.has(k)) continue;
      if (!s.out) s.out = now;
      if (now - s.seen > 60 && !s.el) this.st.delete(k);
    }
    // görünmeye başlayacaklar: önce görev, sonra yakın olan; aynı anda en çok MAX (sıradan kişi en çok bir)
    let n = 0, folk = 0;
    for (const s of this.st.values()) if (this.live(s)) { n++; if (s.kd === 'folk') folk++; }
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
  live(s) { return s.t0 !== null && this.now - s.t0 < IMARK.SHOW; },
  /* etiketin içi: adı (kısa), tuşu ve eylemi; görev hedefi seçeneklerin içindeyse onun adı */
  html(c, ea, gi) {
    const a = ea[gi > 0 ? gi : 0];
    let t = String(c.label || '').replace(/<[^>]*>/g, '').split(' · ')[0].trim();
    if (t.length > 26) t = t.slice(0, 25) + '…';
    return `${t ? `<b>${t}</b>` : ''}<span>${Input.glyph('interact')}<i>${a.n}</i></span>` + (a.hold ? '<em></em>' : '');
  },
  update(dt) {
    this.now += dt;
    if (this.hidden()) { this.fadeAll(dt, true); return; }
    if ((this.scanT -= dt) <= 0) { this.scanT = IMARK.RATE; this.scan(); }
    if (this.busy) { this.fadeAll(dt, true); return; }
    const r = G.canvasRect(), kx = r.width / G.vw, C = G.cam, root = this.root();
    const placed = [];
    // yakından uzağa yerleştir: üst üste binen etiket yukarı kayar
    const vis = [];
    for (const s of this.st.values()) {
      if (this.live(s)) vis.push(s);
      else if (s.el) this.fade(s, dt);
    }
    vis.sort((a, b) => a.d - b.d);
    for (const s of vis) {
      if (!s.el) { s.el = document.createElement('div'); s.el.className = 'imk'; root.appendChild(s.el); s.html_ = null; s.fadeT = 0; }
      if (s.html_ !== s.html) { s.html_ = s.html; s.el.innerHTML = s.html; s.w = s.el.offsetWidth; s.h = s.el.offsetHeight; }
      const cls = 'imk on' + (s.q ? ' q' : '') + (s.html.endsWith('<em></em>') ? ' hold' : '');
      if (s.el.className !== cls) s.el.className = cls;
      const [ax, ay] = this.anchor(s);
      let x = r.left + (ax - C.ox) * kx, y = r.top + (ay - C.oy) * kx - 6;
      // konuşma balonunun üstünde dur
      const k = s.c.key;
      if (k && k.kind === 'npc') for (const B of Bubbles.list) if (B.e === k && B.py !== undefined) { y = Math.min(y, B.py - B.h - 2); break; }
      // [y - h, y] dikey aralığı: yerleşmiş bir etiketle kesişirse onun üstüne çıkar
      for (let it = 0; it < 4; it++) {
        let hit = null;
        for (const p of placed) if (Math.abs(p.x - x) < (p.w + s.w) / 2 + 4 && y > p.y - p.h - 3 && y - s.h < p.y + 3) { hit = p; break; }
        if (!hit) break;
        y = hit.y - hit.h - 4;
      }
      placed.push({ x, y, w: s.w, h: s.h });
      s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  },
  /* solarak kaybol (CSS geçişi), sonra öğeyi kaldır */
  fade(s, dt) {
    if (s.el.classList.contains('on')) s.el.classList.remove('on');
    s.fadeT = (s.fadeT || 0) + dt;
    if (s.fadeT > 0.45) { s.el.remove(); s.el = null; s.fadeT = 0; }
  },
  fadeAll(dt, hard) {
    for (const s of this.st.values()) {
      // gizlenen durumda görünmekte olan etiketin süresi biter: geri dönünce aynı etiket yeniden çıkmaz
      if (hard && this.live(s)) s.t0 = this.now - IMARK.SHOW;
      if (s.el) this.fade(s, dt);
    }
  },
};
