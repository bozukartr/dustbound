'use strict';
/* ==========================================================
   FRONTIER'S END — hikâyeli başlangıçlar
   Her geçmişin kendi on bölümlük hikâyesi olur (STORIES; geçmiş → hikâye:
   STORY_FOR_BG). Motor ortaktır: bir akıl hocası (konuşma satırlarında 'S'),
   bir hedef kişi (rival), bölümler ve adımlar hikâye tanımından okunur.
   İlk hikâye "Sully'nin Senedi": on bölümlük, oynayarak öğreten bir başlangıç. Yaşlı çiftçi
   Dunham Sully'nin gazete ilanıyla kasabaya gelen oyuncu; selamlaşmayı,
   alışverişi, yemeyi, su doldurmayı, ata binmeyi, avı, deri yüzmeyi,
   satışı, çalışmayı, bankayı, şerifi, söylentiyi, dürbünü, kampı,
   pişirmeyi, uykuyu, gizlenmeyi, odağı, kementi ve teslimi öğrenir.
   Bölüm geçişlerinde 3D sinematikler oynar (storycine.js).
   Görevler serbest oyunu kilitlemez; günlükten hikâye bırakılabilir.
   Motor veri güdümlüdür: her adım bir olay (qEvent) ya da bir koşul
   (chk) bekler, tamamlanınca isteğe bağlı konuşma oynar ve ilerler.
   ========================================================== */

const SULLY_LOOK = { sex: 'm', skin: '#d8a880', hair: '#c8c4bc', hairStyle: 0, beard: 4, beardLen: 0.7, hat: 'wide', hatCol: '#6a5038', coat: '#5a4630', shirt: '#d8cdb4', pants: '#3a3024', eyes: '#4a6a8a', coatLen: 0.7 };
const JACK_LOOK = { sex: 'm', skin: '#e0b48c', hair: '#a8401a', hairStyle: 4, beard: 4, beardLen: 0.8, hat: 'cowboy', hatCol: '#1a1614', coat: '#2a2622', shirt: '#b04a3a', pants: '#2a2a30', eyes: '#5a7a4a', coatLen: 0.7 };
const SULLY_HORSE = { col: '#3a2a20', mane: '#1a1410', blanket: '#6a2a20' };
/* Çiftliğin bulunduğu yerin doğası: sinematiklerin renk ve bitki örtüsü */
/* Bölüm 5'te satılabilecek çiğ etler (postlar 'animal' türündedir) */
const STORY_MEAT = ['raw_game', 'raw_big', 'raw_bird'];
const STORY_ENV = { DESERT: 'desert', REDROCK: 'desert', FOREST: 'forest', SNOW: 'forest', DRY: 'dry', GRASS: 'plains', SWAMP: 'coast' };

const Story = {
  /* ---------------- yardımcılar ---------------- */
  get storyOn() { const S = this.story; return !!(S && S.on && !S.done); },
  /* oynanan hikâyenin tanımı (eski kayıtlar: Sully) */
  storyDef() { const S = this.story; return STORIES[(S && S.id) || 'sully'] || STORIES.sully; },
  sName(w) { const D = this.storyDef(); return w === 'S' ? D.mentor.short : w === 'R' ? D.rival.name() : w === 'P' ? this.player.name : w === 'W' ? Tr('Şerif') : w === 'B' ? Tr('Barmen') : w; },
  sFmt(t) { const S = this.story, T = S && this.world.towns.find(x => x.id === S.town); return String(t).replace(/\{ad\}/g, this.player.name.split(' ')[0]).replace(/\{kasaba\}/g, T ? T.n : '').replace(/\{kamp\}/g, S && S.camp ? S.camp.n : ''); },
  sTown() { return this.world.towns.find(t => t.id === this.story.town); },
  sBld(type) {
    const t = this.sTown(), P = this.player, types = Array.isArray(type) ? type : [type];
    let best = null, bd = 1e9;
    for (const b of this.world.buildings) if (b.town === t.id && types.includes(b.type)) { const d = dist(b.door.x, b.door.y, P.x, P.y); if (d < bd) { bd = d; best = b; } }
    return best;
  },
  /* bina kapısının hemen dışı (Sully'nin beklediği yer) */
  sDoor(b, out = 16) { return b ? { x: b.door.x + 8, y: b.door.y + out } : null; },
  mentorEnt() { return this.ents.find(e => e.quest === 'mentor' && !e.remove) || null; },
  rivalEnt() {
    const P = this.player, all = this.ents.concat(P.carry ? [P.carry] : [], this.horse && this.horse.load ? this.horse.load : []);
    return all.find(e => e.quest === 'rival' && !e.remove) || null;
  },
  // eski adlar (Sully hikâyesi ve testler)
  sullyEnt() { return this.mentorEnt(); },
  jackEnt() { return this.rivalEnt(); },
  hasGun() { const P = this.player; return [...P.weapons].some(w => WEAPONS[w] && WEAPONS[w].ammo && w !== 'bow'); },
  sGlyph(a) { return Input.glyph(a); },
  /* Oyuncuyu (ve atını) bir yere taşı: sinematik geçişlerinde */
  sTeleport(x, y) {
    const P = this.player, h = this.horse;
    if (P.carry) this.dropCarry(true);
    if (P.riding) { P.riding.x = x; P.riding.y = y; }
    P.x = x; P.y = y; this.cam.x = x; this.cam.y = y;
    if (h && !h.dead && P.riding !== h) { const s = this.findSpawnPos(x, y, 24, 60) || [x + 20, y + 10]; h.x = s[0]; h.y = s[1]; h.state = 'idle'; }
    this.insideB = null; this.exitB = null;
    this.prefetch(true);
  },
  /* saati ileri sar (aynı gün ya da ertesi günün belli saatine).
     minH: bu saatten sonrası (gece yarısını geçip sabah 5'e kadar dahil) zaten uygun sayılır, sarılmaz */
  sSkipTo(h, minH) {
    if (minH !== undefined && (this.hour >= minH || this.hour < 5)) return;
    const day = Math.floor(this.clock / 1440);
    let tgt = day * 1440 + h * 60;
    if (tgt <= this.clock) tgt += 1440;
    this.advanceClock(tgt - this.clock);
  },
  /* görev noktasına uygun, açık bir yer */
  sSpot(x, y, r0 = 0, r1 = 80) { return this.findSpawnPos(x, y, r0, r1) || [x, y]; },

  /* ---------------- başlangıç ---------------- */
  storyStart(id) {
    const P = this.player, BG = BACKGROUNDS.find(b => b.id === this.background) || BACKGROUNDS[0];
    id = id || STORY_FOR_BG[BG.id];
    const D = STORIES[id];
    if (!D) return false;
    const town = this.world.towns.find(t => t.id === BG.town);
    const S = this.story = { id, on: true, ch: -1, st: -1, n: 0, town: town.id, jack: 'free', deed: false, flags: {} };
    D.setup.call(this, S, town);
    S.biome = S.biome || this.storyBiome(S.ranch ? S.ranch.cx : town.cx, S.ranch ? S.ranch.cy : town.cy);
    S.env = STORY_ENV[S.biome] || 'plains';
    this.storyApplyWorld();
    this.qChapter(0);
    this.saveGame(true);
    return true;
  },
  /* yüklemede ve başlangıçta dünyaya işlenen ayrıntılar */
  storyApplyWorld() {
    const S = this.story;
    if (!S) return;
    const D = this.storyDef();
    if (D.apply) D.apply.call(this, S);
    if (S.camp && S.campKnown) { const cp = this.world.pois.find(p => p.pid === S.camp.pid); if (cp && !this.discovered.has(cp.id)) this.rumored.add(cp.id); }
  },

  /* ---------------- bölüm ve adım akışı ---------------- */
  qCh() { const S = this.story; return S && this.storyDef().chapters[S.ch]; },
  qStep() { const c = this.qCh(), S = this.story; return c && c.steps[S.st]; },
  qChapter(i) {
    const S = this.story, c = this.storyDef().chapters[i];
    S.ch = i; S.st = -1; S.n = 0; S.wait = true;
    if (!c) { this.storyFinish(); return; }
    const go = () => {
      S.wait = false;
      UI.toast(Tr`Bölüm ${i + 1}`, c.t(), 'quest');
      Audio_.chime();
      if (c.start) c.start.call(this, S);
      const next = () => this.qNext();
      if (c.talk) this.qSay(c.talk.call(this, S), next, c.talkDelay); else next();
    };
    const cine = () => { const k = c.cine.call(this, S); this.qCine(k.sc, k.lines, { k: Tr`Bölüm ${i + 1}`, n: c.t(), s: k.sub || '' }, () => { if (k.after) k.after.call(this, S); go(); }, k.cast); };
    if (c.cine && c.pre) this.qSay(c.pre.call(this, S), cine);
    else if (c.cine) cine();
    else go();
    this.questHud();
  },
  qNext() {
    const S = this.story, c = this.qCh();
    S.st++; S.n = 0; S.wait = false; S.fin = -1;
    const st = this.qStep();
    if (!st) { if (c.end) c.end.call(this, S); this.saveGame(true); setTimeout(() => { if (this.story === S && S.on) this.qChapter(S.ch + 1); }, 1200); S.wait = true; this.questHud(); return; }
    if (st.skip && st.skip.call(this, S)) { this.qNext(); return; }
    if (st.on) st.on.call(this, S);
    if (st.talk) this.qSay(st.talk.call(this, S), st.choice ? () => this.storyChoice(st) : null);
    else if (st.choice) this.storyChoice(st);
    // konuşma sırasında yapılmış eylemler
    const pend = this._qPend; this._qPend = null;
    if (pend && st.ev) for (const [type, d] of pend) { if (this.qStep() !== st || S.wait) break; this.qEvent(type, d); }
    if (this.qStep() !== st || S.wait) { this.questHud(); return; }
    const m = this.questMark();
    if (st.wp && m && dist(m.x, m.y, this.player.x, this.player.y) > 500) { this.setWaypoint(m.x, m.y); S.wpSet = true; }
    if (st.hint) setTimeout(() => { if (this.qStep() === st && this.state === 'play') UI.help(st.hint.call(this, S), 9); }, 900);
    this.questHud();
  },
  qDone() {
    const S = this.story, st = this.qStep();
    if (!st || S.wait) return;
    S.wait = true; S.fin = S.st;
    if (S.wpSet) { this.setWaypoint(null); S.wpSet = false; }
    if (st.done) st.done.call(this, S);
    Audio_.tone(660, 0.12, 'triangle', 0.06); Audio_.tone(880, 0.16, 'triangle', 0.05, null, 0.1);
    const go = () => { if (this.story === S && S.on) this.qNext(); };
    const after = () => { if (st.after) this.qSay(st.after.call(this, S), go); else go(); };
    if (st.cine) { const k = st.cine.call(this, S); this.qCine(k.sc, k.lines, k.cap || {}, () => { if (k.after) k.after.call(this, S); after(); }, k.cast); }
    else setTimeout(after, 500);
    this.questHud();
  },
  /* Seçim adımı: oyuncu bir yol seçer (S.choice); sonraki adımlar skip ile ayrılır */
  storyChoice(st) {
    const S = this.story;
    if (!S || this.qStep() !== st || S.wait || S.choice) return;
    if (UI.isModal()) { setTimeout(() => this.storyChoice(st), 400); return; }
    const opts = st.choice.call(this, S);
    UI.menu({
      title: st.t.call(this, S), cls: 'small story-choice', sub: st.choiceSub ? st.choiceSub.call(this, S) : '', onBack: () => {},
      footer: () => Tr`${Input.glyph('confirm')} Seç`,
      items: (opts.some(o => o.d) ? [{ html: opts.map(o => `<p><b>${o.n}</b> — ${o.d}</p>`).join('') }] : []).concat(opts.map(o => ({ label: o.n, fn: () => { UI.closeAll(); S.choice = o.k; this.qDone(); } }))),
    });
  },
  /* oyundaki olaylar buraya bildirilir */
  qEvent(type, d) {
    const S = this.story;
    if (!S || !S.on || S.done) return;
    const D = this.storyDef();
    if (D.onEvent) D.onEvent.call(this, type, d, S);
    if (this.cine) return;
    // adım arası konuşma sürerken yapılan eylem kaybolmasın: sıradaki adım bekliyorsa orada sayılır
    const st = this.qStep();
    if (S.wait || !st) { if (type !== 'talk') { const q = this._qPend || (this._qPend = []); q.push([type, d]); if (q.length > 8) q.shift(); } return; }
    if (st.ev !== type || (st.ok && !st.ok.call(this, d, S))) return;
    S.n++;
    if (S.n >= (st.n || 1)) this.qDone(); else { this.questHud(); Audio_.tone(520, 0.08, 'triangle', 0.05); }
  },

  /* ---------------- konuşma ---------------- */
  /* satırlar: [kim, söz]; S = Sully, P = oyuncu, W = şerif, B = barmen */
  qSay(lines, cb, delay = 0) {
    const S = this.story, L = (lines || []).filter(Boolean).map(([w, x]) => ({ w, x: this.sFmt(x), raw: x }));
    for (const l of L) Audio_.voPreload(l.raw, I18N.lang);   // seslendirme dosyası varsa önceden yüklenir
    // süren bir konuşma varsa arkasına eklenir (bekleyen geri çağrı kaybolmaz)
    if (S.talkQ && (S.talkQ.length || S.talkCb)) {
      S.talkQ.push(...L);
      const old = S.talkCb;
      S.talkCb = old || cb ? () => { if (old) old(); if (cb) cb(); } : null;
      return;
    }
    S.talkQ = L;
    S.talkT = -delay; S.talkCb = cb || null;
    if (!S.talkQ.length) { S.talkCb = null; if (cb) cb(); }
  },
  storyTalking() { const S = this.story; return !!(S && S.talkQ && (S.talkQ.length || S.talkCb)); },
  talkDur(x) { return window.__storyFast ? 0.05 : clamp(1.5 + x.length * 0.052, 2.2, 6.5); },
  storyTalkTick(dt) {
    const S = this.story;
    if (!S.talkQ || (!S.talkQ.length && !S.talkCb)) return;
    S.talkT -= dt;
    if (S.talkT > 0) return;
    const ln = S.talkQ.shift();
    if (!ln) { const cb = S.talkCb; S.talkCb = null; S.talkQ = null; if (cb) cb(); return; }
    // seslendirme varsa satır sesin süresi kadar ekranda kalır
    const me = this.mentorEnt(), vd = Audio_.voice(ln.raw || ln.x, I18N.lang, ln.w === 'S' && me ? { x: me.x, y: me.y, dist: 600 } : {});
    const d = Math.max(this.talkDur(ln.x), vd ? vd + 0.4 : 0);
    UI.subtitle(this.sName(ln.w), ln.x, d - 0.2, ln.w === 'P');
    const who = ln.w === 'S' ? me : ln.w === 'R' ? this.rivalEnt() : ln.w === 'P' ? this.player : null;
    // söz bir kez, altyazıda yazılır; konuşanın üstünde yalnızca konuşma işareti
    if (who && (who === this.player || dist(who.x, who.y, this.player.x, this.player.y) < 300)) Bubbles.add(who, '', d - 0.2, true);
    if (ln.w === 'S' && me && !me.anim && chance(0.4)) this.setAnim(me, pick(['gesture', 'point', 'shrug', 'rub', 'scratch']));
    S.talkT = d;
  },

  /* ---------------- sinematik ---------------- */
  cineLines(lines, start = 3.4) {
    let t = start; const out = [];
    for (const [w, x0] of lines || []) {
      Audio_.voPreload(x0, I18N.lang);
      const x = this.sFmt(x0), vd = Audio_.voDur(x0, I18N.lang), d = Math.max(this.talkDur(x) * 0.95, vd ? vd + 0.3 : 0);
      out.push({ t, d, w: this.sName(w), x, raw: x0, self: w === 'P' }); t += d + 0.3;
    }
    return { lines: out, dur: t + 1.2 };
  },
  qCine(sc, lines, cap, after, cast) {
    const fin = () => { this.cine = false; this.timeScale = 1; try { if (after) after(); } catch (e) { console.warn(e); } };
    if (window.__testNoCine || typeof Cinema === 'undefined' || !Cinema.has(sc)) { fin(); return; }
    this.cine = true; this._qPend = null; Bubbles.clear(); UI.el.sub.classList.add('hidden');
    const L = this.cineLines(lines), h = this.horse, S = this.story;
    const D = this.storyDef();
    Cinema.play(sc, { look: this.player.look, seed: (this.seed || 1) + S.ch * 31, env: S.env, sully: cast === 'rival' ? D.rival.look : D.mentor.look, jack: D.rival.look, horseCol: h && h.look && h.look.col, cap, lines: L.lines, dur: L.dur, capAt: 0.4, onLine: (ln) => Audio_.voice(ln.raw, I18N.lang) }).then(fin, fin);
  },

  /* ---------------- her kare ---------------- */
  storyTick(dt) {
    const S = this.story;
    if (!S || !S.on) return;
    this.storyTalkTick(dt);
    this.storyMentor(dt);
    if (!S.done) this.storyRival();
    const D = this.storyDef();
    if (D.tick && !S.done) D.tick.call(this, S, dt);
    if ((S.chkT = (S.chkT || 0) - dt) > 0) return;
    S.chkT = 0.25;
    const st = this.qStep();
    if (st && !S.wait && st.chk && st.chk.call(this, S)) this.qDone();
    if (st && st.tick) st.tick.call(this, S, 0.25);
    this.questHud();
  },
  /* Akıl hocası: istenen yere yürür ya da atla gider; uzaktaysa görünmeden yerini alır */
  storyMentor(dt) {
    const S = this.story, g = S.sully, P = this.player;
    let e = this.mentorEnt();
    if (!g) { if (e) e.remove = true; return; }
    const M = this.storyDef().mentor;
    const pd = dist(P.x, P.y, g.x, g.y);
    if (!e) {
      // atlıyken önden gider: uzaktaysa oyuncunun önünde, hedef yönünde belirir
      const at = g.ride && pd > 400 ? this.sAhead(g) : g;
      if (dist(P.x, P.y, at.x, at.y) > 1200) return;
      const s = this.sSpot(at.x, at.y, 0, 30);
      e = new NPC(s[0], s[1], 'mentor', { name: M.name, look: Object.assign({}, M.look), hp: 9999 });
      e.quest = 'mentor'; e.keep = true; e.weapon = null; e.money = 0; e.ang = Math.atan2(P.y - e.y, P.x - e.x);
      if (g.ride) e.mounted = Object.assign({}, M.horse);
      this.addEnt(e);
    } else if (dist(e.x, e.y, P.x, P.y) > 1700) e.remove = true;
  },
  /* NPC.update'ten çağrılır: true dönerse olağan davranış atlanır */
  questNpc(e, dt) {
    if (e.quest !== 'mentor') return false;
    const S = this.story, g = S && S.sully, P = this.player, MH = this.storyDef().mentor.horse;
    e.hp = e.maxHp = 9999; e.hostile = false; e.witness = null;
    if (!g) { e.mv = 0; return true; }
    if (g.tied) { e.state = 'tied'; e.mv = 0; e.spd = 0; e.mounted = null; if (dist(e.x, e.y, g.x, g.y) > 4) { e.x = g.x; e.y = g.y; } return true; }
    if (e.state === 'tied') e.state = 'idle';
    if (e.state !== 'idle' && e.state !== 'walk') e.state = 'idle';
    const d = dist(e.x, e.y, g.x, g.y), pd = dist(e.x, e.y, P.x, P.y);
    if (d > 8) {
      // ekran dışında ve uzaktaysa doğrudan yerini alır
      if (g.ride && d > 300 && pd > 450 && !this.onScreen(e.x, e.y, 40)) { const a = this.sAhead(g), s = this.sSpot(a.x, a.y, 0, 30); e.x = s[0]; e.y = s[1]; e.nav = null; e.mounted = e.mounted || Object.assign({}, MH); return true; }
      if (!g.ride && d > 220 && !this.onScreen(e.x, e.y, 40) && !this.onScreen(g.x, g.y, 40)) { e.x = g.x; e.y = g.y; e.nav = null; e.mv = 0; e.mounted = g.ride ? e.mounted || Object.assign({}, MH) : null; return true; }
      if (g.ride) {
        e.mounted = e.mounted || Object.assign({}, MH);
        if (d < 400 && !this.onScreen(e.x, e.y, 40) && !this.onScreen(g.x, g.y, 40)) { e.x = g.x; e.y = g.y; e.nav = null; return true; }
        // oyuncu geride kalırsa bekler
        if (pd > 380 && dist(P.x, P.y, g.x, g.y) > d) { e.mv = 0; e.spd = 0; e.ang = turnTo(e.ang, Math.atan2(P.y - e.y, P.x - e.x), dt * 2); return true; }
        const a = Math.atan2(g.y - e.y, g.x - e.x);
        e.ang = turnTo(e.ang, a + (e.dodge || 0), dt * 3);
        const ox = e.x, oy = e.y;
        e.walk(dt, pd < 120 ? 120 : 100);
        if (Math.hypot(e.x - ox, e.y - oy) < 0.2) { e.dodge = (e.dodge || 0) + (chance(0.5) ? 0.6 : -0.6); if (Math.abs(e.dodge) > 2) e.dodge = 0; } else if (e.dodge) e.dodge *= 0.98;
        return true;
      }
      const r = this.navStep(e, g.x, g.y, dt, pd < 60 ? 26 : 34);
      if (r === 'fail' && !this.onScreen(e.x, e.y, 20)) { e.x = g.x; e.y = g.y; e.nav = null; }
      return true;
    }
    e.mv = 0; e.spd = 0;
    if (!g.ride && e.mounted) e.mounted = null;
    if (pd < 80) e.ang = turnTo(e.ang, Math.atan2(P.y - e.y, P.x - e.x), dt * 3);
    else if (g.ang !== undefined) e.ang = turnTo(e.ang, g.ang, dt * 2);
    else this.standTick(e, dt, 0.25);
    return true;
  },
  /* atlı Sully için oyuncunun önünde, hedef yönünde bir nokta */
  sAhead(g) { const P = this.player, d = dist(P.x, P.y, g.x, g.y), k = Math.min(1, 260 / Math.max(1, d)); return { x: P.x + (g.x - P.x) * k, y: P.y + (g.y - P.y) * k }; },
  sullyGo(x, y, ride, ang) { this.story.sully = { x, y, ride: !!ride, ang }; },
  /* Hedef kişi (Sully'de Kızıl Jack): kampta belirir; bağlıysa kaçmaz, kayıttan dönüşte yerinde bekler */
  storyRival() {
    const S = this.story, P = this.player, R = this.storyDef().rival;
    if (!R || R.fromCh === undefined || S.ch < R.fromCh || !S.camp || S.jack === 'delivered') return;
    let j = this.rivalEnt();
    if (!j) {
      if (S.jack === 'carried') { S.jack = 'bound'; }   // taşınırken kaybolduysa bıraktığın yerde
      const jx = S.jx || S.camp.x + 10, jy = S.jy || S.camp.y - 12;
      if (dist(P.x, P.y, jx, jy) > 900) return;
      j = new NPC(jx, jy, 'bandit', { hostile: S.jack === 'free', name: R.name(), look: Object.assign({}, R.look), hp: R.hp || 150, weapon: R.weapon || 'repeater', home: { x: S.camp.x, y: S.camp.y, r: 40 }, money: R.money || 2.5 });
      j.quest = 'rival'; j.keep = true;
      if (S.jack === 'dead') { j.dead = true; j.hp = 0; j.state = 'dead'; j.deadT = 0; }
      else if (S.jack === 'bound') { j.state = 'tied'; j.tieT = 9999; j.hp = 40; j.hostile = true; }
      this.addEnt(j);
      return;
    }
    const carried = P.carry === j || (this.horse && this.horse.load && this.horse.load.includes(j));
    if (j.dead) S.jack = 'dead';
    else if (carried) S.jack = 'carried';
    else if (j.state === 'tied') { S.jack = 'bound'; j.tieT = Math.max(j.tieT, 600); }
    else if (j.bound) S.jack = j.state === 'downed' ? 'downed' : 'lassoed';
    else S.jack = 'free';
    if (!carried) { S.jx = Math.round(j.x); S.jy = Math.round(j.y); }
  },
  /* İşaretçi: adımın hedefi (dünyada, radarda, haritada) */
  questMark() {
    const S = this.story;
    if (!S || !S.on || S.done) return null;
    const st = this.qStep();
    if (!st || !st.at) return null;
    try { return st.at.call(this, S); } catch (e) { return null; }
  },

  /* ---------------- etkileşimler ---------------- */
  mentorActions(e) {
    const S = this.story, acts = [], M = this.storyDef().mentor;
    const st = this.qStep();
    const work = M.work && (() => UI.openWork(M.work, M.place()));
    if (S && S.on && !S.done && st && st.ev === 'talk' && !S.wait) acts.push({ n: Tr('Konuş'), fn: () => this.qTalkSully(e) });
    else if (S && S.on && !S.done && st && st.ev === 'work' && work) acts.push({ n: JOBS[M.work].n, fn: work });
    else acts.push({ n: Tr('Sohbet Et'), fn: () => this.sullyChat(e) });
    if (S && S.done && work && M.home && dist(e.x, e.y, M.home.call(this, S).x, M.home.call(this, S).y) < 300) acts.push({ n: JOBS[M.work].n, fn: work });
    const D = this.storyDef();
    if (D.mentorActions && S && S.on && !S.done) return D.mentorActions.call(this, e, S, acts) || acts;
    return acts;
  },
  /* bina menüsüne hikâyenin eklediği seçenekler (ör. şerifte teslim olmak) */
  storyBuildingActions(b) {
    const S = this.story, D = this.storyDef();
    if (!S || !S.on || S.done || !D.buildingActions) return [];
    return D.buildingActions.call(this, b, S) || [];
  },
  sullyActions(e) { return this.mentorActions(e); },
  qTalkSully(e) {
    const st = this.qStep();
    e.ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    if (st && st.say) { const S = this.story; S.wait = true; this.qSay(st.say.call(this, S), () => { S.wait = false; this.qEvent('talk', e); }); }
    else this.qEvent('talk', e);
  },
  sullyChat(e) {
    const S = this.story, M = this.storyDef().mentor;
    const L = S && S.done ? M.chatDone() : M.chatBusy();
    const x = this.sFmt(pick(L));
    UI.subtitle(M.short, x, 3.5); Bubbles.add(e, '', 3.5, true);
    e.ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
  },
  rivalActions(e) {
    const S = this.story, acts = [], R = this.storyDef().rival;
    if (S && S.on && !S.deed && R.take && (e.dead || e.bound)) acts.push({ n: R.take.n(), hold: 0.6, fn: () => { S.deed = true; UI.toast(R.take.k(), R.take.msg(), 'quest'); Audio_.ui('pick'); this.qEvent('deed', e); } });
    return acts;
  },
  jackActions(e) { return this.rivalActions(e); },
  /* hedef kişinin şerifteki değeri (0: hikâyenin hedefi değil) */
  rivalValue(e) { const R = this.storyDef().rival; return R && R.reward ? (e.dead ? R.reward[1] : R.reward[0]) : 0; },
  /* Şerif ofisi ilan panosunun üstündeki afiş */
  storyPoster() {
    const S = this.story, D = this.storyDef();
    if (!S || !S.on || S.done || S.jack === 'delivered' || !D.poster) return '';
    return D.poster.call(this, S);
  },
  /* Sully: şerif ofisi panosunda Kızıl Jack afişi */
  sullyPoster(S) {
    if (S.ch < 6) return '';
    return `<div class="poster story"><div class="po-w">${Tr`ARANIYOR`}</div><div class="po-n">${Tr('Kızıl Jack')}</div><div class="po-c">${Tr`Yol kesme, soygun, at hırsızlığı`}</div><div class="po-r">${fmtMoney(25)}</div><div class="po-l">${Tr`Canlı teslime tam ödül.`}</div></div>`;
  },
  /* Barmenin fısıldadığı söz: kampın yeri */
  storyRumor() {
    const S = this.story, st = this.qStep(), D = this.storyDef();
    if (!S || !st || st.ev !== 'rumor' || S.wait) return false;
    S.campKnown = true; this.storyApplyWorld();
    const cp = S.camp && this.world.pois.find(p => p.pid === S.camp.pid);
    if (cp) this.rumored.add(cp.id);
    if (D.rumor) D.rumor.call(this, S);
    this.qEvent('rumor');
    return true;
  },

  /* ---------------- bitiş ve bırakma ---------------- */
  storyFinish() {
    const S = this.story, D = this.storyDef();
    S.done = true; S.wait = false;
    if (D.finish) D.finish.call(this, S);
    this.unlock(D.ach || 'story');
    UI.toast(Tr('Hikâye Tamamlandı'), D.title(), 'quest');
    if (D.epilogue) setTimeout(() => UI.help(D.epilogue.call(this, S), 14), 1500);
    this.questHud();
    this.saveGame(true);
  },
  storyAbandon() {
    const S = this.story;
    if (!S) return;
    S.on = false; S.talkQ = null; S.talkCb = null;
    const e = this.mentorEnt(); if (e) e.remove = true;
    if (S.wpSet) this.setWaypoint(null);
    UI.feed(Tr('Hikâyeyi bıraktın. Dünya seni bekliyor.'));
    this.questHud();
  },

  /* ---------------- arayüz ---------------- */
  questHud() {
    const el = document.getElementById('hud-quest');
    if (!el) return;
    const S = this.story, c = S && S.on && !S.done && this.storyDef().chapters[S.ch], st = c && this.qStep();
    if (!c) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const n = st && st.n > 1 ? ` <span class="hq-n">${S.n}/${st.n}</span>` : '';
    const txt = st ? st.t.call(this, S) + n : '…';
    const key = S.ch + '|' + S.st + '|' + S.n + '|' + S.wait + '|' + txt;
    if (el._k === key) return;
    el._k = key;
    el.innerHTML = `<div class="hq-t">${Tr`Bölüm ${S.ch + 1}`} · ${c.t()}</div><div class="hq-o ${S.wait ? 'done' : ''}"><i></i>${txt}</div>`;
  },
  /* Günlük: Görevler sekmesi */
  questJournal() {
    const S = this.story;
    if (!S) return `<p class="jr-note">${Tr`Bu hayatta hikâyeli başlangıç kapalı. Yeni bir hayata başlarken "Hikâyeli Başlangıç"ı açabilirsin.`}</p>`;
    const D = this.storyDef();
    let h = `<div class="qj"><div class="qj-h">${D.title()}</div><p class="jr-note">${D.intro()}</p><ol class="qj-l">`;
    D.chapters.forEach((c, i) => {
      const cls = S.done || i < S.ch ? 'ok' : i === S.ch && S.on ? 'on' : '';
      h += `<li class="${cls}"><b>${Tr`Bölüm ${i + 1}`}</b> ${i <= S.ch || S.done ? c.t() : '???'}`;
      if (i === S.ch && S.on && !S.done) h += `<ul>${c.steps.map((st, k) => k < S.st ? `<li class="ok">${st.t.call(this, S)}</li>` : k === S.st ? `<li class="on">${st.t.call(this, S)}</li>` : '').join('')}</ul>`;
      h += '</li>';
    });
    h += '</ol>';
    if (S.done) h += `<p class="qj-end">${D.outro()}</p>`;
    else if (S.on) h += `<p><button class="st-btn" data-qa="1">${Tr`Hikâyeyi Bırak`}</button></p>`;
    else h += `<p class="qj-end">${Tr`Hikâyeyi bıraktın.`}</p>`;
    return h + '</div>';
  },
  saveStory() { const S = this.story; if (!S) return null; const o = Object.assign({}, S); delete o.talkQ; delete o.talkCb; delete o.chkT; return o; },
  loadStory(d) {
    if (!d) { this.story = null; return; }
    this.story = d; d.wait = false;
    if (!d.id || !STORIES[d.id]) d.id = 'sully';   // eski kayıtlar
    this.storyApplyWorld();
    if (d.on && !d.done) {
      // yarıda kalan bölüm başını yeniden kur (konuşmalar geri gelmez)
      if (d.st < 0) { d.ch = Math.max(0, d.ch); this.qChapter(d.ch); return; }
      // adım bitmiş, sonrası (konuşma ya da sinematik) sürerken kaydedilmiş
      if (d.fin === d.st) { this.qNext(); return; }
      const c = this.storyDef().chapters[d.ch];
      if (c && c.resume) c.resume.call(this, d);
      const st = this.qStep();
      if (st && st.on && st.reOn) st.on.call(this, d);
      if (st && st.choice && !d.choice) setTimeout(() => this.storyChoice(st), 1500);
    }
  },
};

/* ==========================================================
   Bölümler. Her adım: t (hedef yazısı), ev/n/ok ya da chk, at (işaret),
   wp (uzaksa rota), hint (ipucu), on (başlarken), say (Sully'ye konuşunca),
   talk (başlarken konuşma), after (bitince konuşma), cine (bitince sinematik)
   ========================================================== */
const STORY_SULLY = [
  /* 1 — Yeni Kasaba: tanış, selamlaş, mağazaya gir */
  {
    t: () => Tr('Yeni Kasaba'),
    start() { setTimeout(() => UI.help(Tr`Bir gazete ilanı seni buraya getirdi: <i>"Çiftliğe el aranıyor. Yatak ve yemek verilir. — D. Sully"</i><br>İlanı veren adam seni bekliyor olmalı.`, 10), 600); },
    resume(S) { if (S.st >= 1) { const b = this.sBld('general'), p = this.sDoor(b); if (p) this.sullyGo(p.x, p.y); } },
    steps: [
      { t: () => Tr('Dunham Sully ile konuş'), ev: 'talk', at() { const e = this.sullyEnt(); return e || this.story.sully; },
        hint: () => Tr`Yaşlı adama yaklaş ve ${Input.glyph('interact')} ile <b>Konuş</b>.`,
        say: () => [
          ['S', Tr('İlana bakan sen misin? Gazeteyi öyle sıkı tutuyorsun ki kaçacak sandım.')],
          ['P', Tr('{ad}. İlanda yatak ve yemek yazıyordu.')],
          ['S', Tr('Yazıyordu. Yatak biraz gıcırdar, yemeği de ben pişiririm. Kararını ona göre ver.')],
          ['S', Tr('Dunham Sully. Herkes Sully der.')],
          ['S', Tr('Çiftliğe çıkmadan kasabayı bir tanı. Buralarda yüzünü bilmedikleri adama ne iş verirler ne veresiye.')],
          ['S', Tr('Birkaç kişiye selam ver. Ben mağazanın önünde olurum.')],
        ],
        done() { const p = this.sDoor(this.sBld('general')); if (p) this.sullyGo(p.x, p.y); } },
      { t: () => Tr('Kasabalıları selamla'), ev: 'greet', n: 2, ok: (e, S) => { if (!e || e.quest === 'mentor') return false; const g = S.greeted || (S.greeted = []); if (g.includes(e.id)) return false; g.push(e.id); return true; },
        hint: () => Tr`Birine yaklaş, ${Input.glyph('interact')} basılı tut ve <b>Selamla</b>. Selamını alanı unutmazlar; seni selamlayanı da cevapsız bırakma.` },
      { t: () => Tr('Genel mağazaya gir'), ev: 'enter', ok: (b) => b && b.type === 'general', at() { return this.sDoor(this.sBld('general'), 4); },
        hint: () => Tr`Mağazanın kapısından içeri yürü. Binaların içinde dolaşabilirsin.`,
        done() { const b = this.sBld('general'); if (b) { let iy = b.door.y; for (let k = 0; k < 40 && !this.world.buildingAtPx(b.door.x, iy); k++) iy -= 2; this.sullyGo(b.door.x - 10, iy - 12); } } },
    ],
  },
  /* 2 — Karnını Doyur: alışveriş, yemek, matara */
  {
    t: () => Tr('Karnını Doyur'),
    talk() {
      const P = this.player, out = [
        ['S', Tr('Ne zamandır bir şey yemedin?')],
        ['P', Tr('Dünden beri... sanırım.')],
        ['S', Tr('"Sanırım" diyor. Yüzün söylüyor zaten.')],
        ['S', Tr('Al şunu. Borç değil, avans da değil. Aç adamdan iş çıkmaz, hepsi bu.')],
        ['S', Tr('Dayanıklı bir şeyler al. Fasulye, peksimet... Tatlıya para verme.')],
      ];
      if (this.story.flags.canteen) out.push(['S', Tr('Matara da yok mu? Al benimkini. Ben yenisini alırım, nasılsa her yıl kaybediyorum.')]);
      return out;
    },
    talkDelay: 0.6,
    start(S) { const P = this.player; this.earn(1, 'Sully'); if (!P.has('canteen')) { P.addItem('canteen', 1, true); P.canteen = 0; S.flags.canteen = 1; } },
    steps: [
      { t: () => Tr('Mağazadan yiyecek satın al'), ev: 'buy', ok: (d) => ITEMS[d.id] && ITEMS[d.id].c === 'food', at() { return this.sDoor(this.sBld('general'), -18); },
        hint: () => Tr`Tezgâhtaki satıcıya yaklaş, ${Input.glyph('interact')} ile <b>Alışveriş</b>'i aç ve bir yiyecek al.` },
      { t: () => Tr('Bir şeyler ye'), ev: 'eat',
        hint: () => Tr`${Input.glyph('satchel')} Çanta'dan bir yiyecek seç ya da ${Input.glyph('quick')} ile hızlıca atıştır.`,
        after: () => [['S', Tr('Hah. Şimdi biraz insana benzedin.')]] },
      { t: () => Tr('Mataranı bir kuyudan doldur'), ev: 'fill', at() { return this.storyWell(); },
        hint: () => Tr`Kasabadaki kuyuya ya da yalağa yaklaş: ${Input.glyph('interact')} basılı tut, <b>Matarayı Doldur</b>. Susayınca matarandan içersin.`,
        on() { const w = this.storyWell(); if (w) this.sullyGo(w.x + 18, w.y + 10); },
        after: () => [['S', Tr('Su bulduğun yerde doldur. Çölde kimse sana su ısmarlamaz.')], ['S', Tr('Hadi bakalım. Çiftlik kasabanın dışında. Yürünmez, ata bineceğiz.')]] },
    ],
  },
  /* 3 — Sully'nin Çiftliği: ıslık, ata bin, sür */
  {
    t: () => Tr('Sully\'nin Çiftliği'),
    talk() {
      const S = this.story;
      return S.lent ? [['S', Tr('Atın yok, değil mi? Kömür\'ü al. Yaşlıdır ama yolu bilir. Benden az şikâyet eder.')]] : [['S', Tr('Atın nerede? Islık çal, gelsin. İyi at sahibini bekletmez.')]];
    },
    start(S) {
      if (!this.horse || this.horse.dead) {
        const P = this.player, s = this.sSpot(P.x + 60, P.y + 20, 20, 90);
        const h = new Horse(s[0], s[1], 'nag', { owner: 'player', name: Tr('Kömür'), look: { col: '#2a2420', mane: '#1a1410' } });
        this.setHorse(h, true); S.lent = true;
      }
    },
    steps: [
      { t: () => Tr('Atını ıslıkla çağır'), ev: 'whistle', hint: () => Tr`${Input.glyph('whistle')} ile atını çağır. Uzaktaysa koşarak gelir.` },
      { t: () => Tr('Atına bin'), chk() { return this.player.riding && this.player.riding === this.horse; }, at() { return this.horse; },
        hint: () => Tr`Atına yaklaş ve ${Input.glyph('interact')} ile bin.`,
        done() { const R = this.story.ranch; this.sullyGo(R.x - 30, R.y + 10, true); } },
      { t: () => Tr('Sully\'nin peşinden çiftliğe git'), chk() { const R = this.story.ranch, P = this.player; return dist(P.x, P.y, R.x, R.y) < 150; }, at() { return this.story.ranch; }, wp: true,
        hint: () => Tr`Sully'nin ardından sür. ${Input.glyph('sprint')} ile hızlan, basılı tutarsan dörtnala gidersin. ${Input.glyph('map')} Harita'da rota görünür.`,
        talk: () => [['S', Tr('Arkamdan gel. Yol çatallanınca sağa... ya da sola. Atına güven, o bilir.')]],
        cine: () => ({ sc: 'q_ride', lines: [
          ['S', Tr('Otuz bir yıl oldu bu yolu ilk sürdüğüm.')],
          ['S', Tr('Martha arabanın üstündeydi, ben yanında yürüyordum. At alacak paramız yoktu.')],
          ['P', Tr('Ya şimdi?')],
          ['S', Tr('Şimdi at var.')],
          ['S', Tr('...Martha yok.')],
          ['S', Tr('Neyse. Tavuklar beni bekler, ben de onları.')],
        ], after() { const R = this.story.ranch; this.sullyGo(R.x + 6, R.y - 4); const e = this.sullyEnt(); if (e) { e.x = R.x + 6; e.y = R.y - 4; e.mounted = null; } } }) },
    ],
  },
  /* 4 — Kümesteki Çakallar: ateş et, avlan, deri yüz */
  {
    t: () => Tr('Kümesteki Çakallar'),
    cine() {
      return { sc: 'q_coyote', lines: [
        ['S', Tr('Şşt. Duydun mu?')],
        ['P', Tr('Rüzgâr mı?')],
        ['S', Tr('Rüzgâr tavuk kaçırmaz.')],
        ['S', Tr('Çakallar. Üç gecedir geliyorlar. Kümesin oraya, çabuk!')],
      ], after() { this.sSkipTo(19.25, 18); } };
    },
    talk(S) { return S.flags.gun ? [['S', Tr('Silahın yok mu? Al, babamın tabancası. Geri isterim ama.')]] : []; },
    pre: () => [['S', Tr('İşte. Ev, ahır, bir kuyu, bir sürü tavuk ve ben. Hepimiz biraz yorgunuz.')], ['S', Tr('Atını bağla, içeri gel. Güneş batmak üzere.')]],
    start(S) {
      const P = this.player;
      if (!this.hasGun()) { P.giveWeapon('cattleman'); P.ammo.pistol = Math.max(P.ammo.pistol || 0, 24); S.flags.gun = 1; }
      this.storyCoyotes(S);
    },
    resume(S) { if (S.st === 0) this.storyCoyotes(S); if (S.st === 1) this.storyGame(S); },
    steps: [
      { t: () => Tr('Çakalları kümesten uzaklaştır'), n: 3, chk() { return this.storyCoyCount() >= 3; },
        tick(S) { const n = this.storyCoyCount(); if (n !== S.n) { S.n = n; if (n === 1) this.qSay([['S', Tr('Biri gitti! Devam et!')]]); } },
        at() { const R = this.story.ranch; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyCoy && !e.dead && !e.remove) { const d = dist(e.x, e.y, R.cx, R.cy); if (d < bd) { bd = d; best = e; } } return best; },
        hint: () => Tr`${Input.glyph('aim')} ile nişan al, ${Input.glyph('fire')} ile ateş et. Tavukları vurma, Sully'nin siniri bozulur.`,
        after: () => [['S', Tr('Fena değil. Ben senin yaşında iki atışta bir tavuk vururdum.')], ['S', Tr('Kiler de bomboş, onu da söyleyeyim. Tepenin ardında av olur. Akşam karanlığında yaklaşmak daha kolay.')]] },
      { t() { return this.story.game === 'pronghorn' ? Tr('Bir antilop avla') : this.story.game === 'turkey' ? Tr('Bir yaban hindisi avla') : Tr('Bir geyik avla'); }, ev: 'kill', ok(a, S) { return a.kind === 'animal' && a.type === S.game; },
        on(S) { this.storyGame(S); },
        at() { const P = this.player; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyGame && !e.dead && !e.remove) { const d = dist(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } } return best; },
        hint: () => Tr`${Input.glyph('crouch')} ile çömelip sessizce yaklaş; ürkek hayvanlar ayak sesini duyar. Nişan alırken biraz beklersen elin titremez.` },
      { t: () => Tr('Hayvanın derisini yüz'), ev: 'skin', ok(a, S) { return a.type === S.game; },
        hint: () => Tr`Avın yanında ${Input.glyph('interact')} basılı tut: <b>Derisini Yüz</b>. Büyük postlar omzuna alınır; atının yanında <b>eyere yükleyebilirsin</b>.` },
      { t: () => Tr('Çiftliğe dön, Sully ile konuş'), ev: 'talk', at() { return this.sullyEnt() || this.story.ranch; }, wp: true,
        say: () => [
          ['S', Tr('Bu et bize bir hafta yeter. Postu kasaba götür, kasap iyi para verir.')],
          ['P', Tr('Sen gelmiyor musun?')],
          ['S', Tr('Kasabada... şu an yüzüne bakamayacağım insanlar var. Sonra anlatırım. Sen git.')],
        ] },
    ],
  },
  /* 5 — Kasabın Terazisi: sat, geri dön */
  {
    t: () => Tr('Kasabın Terazisi'),
    steps: [
      { t: () => Tr('Postu ya da eti kasapta sat'), ev: 'sell', ok: (d) => !!(d && (d.carried || d.all || (d.id && (STORY_MEAT.includes(d.id) || (ITEMS[d.id] && ITEMS[d.id].c === 'animal'))))), at() { return this.sDoor(this.sBld('butcher') || this.sBld('general'), 4); }, wp: true,
        skip() { return !this.storyHasGoods(); },
        hint: () => Tr`Kasap ya da genel mağazada <b>Sat</b> sekmesini kullan. Omzundaki ya da eyerdeki postu, dükkânın içinde <b>Getirdiğin Avı Sat</b> ile satarsın. Dükkânlar 22:00 – 06:00 arası kapalıdır; gece vardıysan sabahı bekle.` },
      { t: () => Tr('Sully\'nin çiftliğine dön'), chk() { const R = this.story.ranch, P = this.player; return dist(P.x, P.y, R.x, R.y) < 140; }, at() { return this.story.ranch; }, wp: true },
    ],
  },
  /* 6 — Alın Teri: itiraf (gece), sabah çalış */
  {
    t: () => Tr('Alın Teri'),
    pre: () => [['S', Tr('Döndün mü? Kasap seni kazıklamadı, değil mi?')], ['S', Tr('Gel, otur şöyle. Gece uzun.')]],
    cine() {
      return { sc: 'q_porch', lines: [
        ['S', Tr('Sana bir şey söylemem lazım. Bunu duymayı hak ediyorsun.')],
        ['S', Tr('Geçen ay bankaya gidiyordum. Tapu yanımdaydı; kredi için göstermem gerekiyordu.')],
        ['S', Tr('Yolda üç atlı çıktı önüme. Önde giden kızıl sakallıydı. Gülüyordu.')],
        ['P', Tr('Ne aldılar?')],
        ['S', Tr('Cüzdanımı. Saatimi. Bir de tapuyu.')],
        ['S', Tr('Tapu kimdeyse toprak onundur, öyle diyorlar. Şu ev, şu tavuklar, Martha\'nın mezarı... hepsi bir kâğıt parçasına bağlı.')],
        ['P', Tr('Şerife gitmedin mi?')],
        ['S', Tr('Gittim. "Adamım yok, Sully" dedi. Otuz yıl vergi ödedim, adamı yokmuş.')],
        ['S', Tr('Neyse. Yarın erken kalk. Banka faiz bekler, ben de ahırın çatısını.')],
      ], after() { const P = this.player; this.sSkipTo(21.5, 21); this.sSkipTo(7); P.energy = Math.max(P.energy, 90); P.sta = P.maxSta; const R = this.story.ranch; this.sullyGo(R.x + 6, R.y - 4); this.saveGame(true); } };
    },
    steps: [
      { t: () => Tr('Sully ile konuş'), ev: 'talk', at() { return this.sullyEnt() || this.story.ranch; },
        say: () => [
          ['S', Tr('Günaydın. Kahve yok, bitti. Çatı da akıyor.')],
          ['S', Tr('Dört saatini bana ver. Karşılığında ne bulursam vereyim; az ama dürüst para.')],
        ] },
      { t: () => Tr('Sully\'nin çiftliğinde çalış'), ev: 'work', at() { return this.sullyEnt() || this.story.ranch; },
        hint: () => Tr`Sully'ye yaklaş ve <b>Çiftlikte Çalış</b>'ı seç. İş saatleri 06:00 – 18:00; çalışınca yorulur, acıkır ve susarsın.`,
        after: () => [['S', Tr('Eline sağlık. Çatı on yıl daha dayanır... ya da bir kış.')], ['S', Tr('Kasabaya inelim. Şerifle bir kez daha konuşacağım; bu sefer yanımda biri olacak.')]] },
    ],
  },
  /* 7 — Kanunun Kapısı: banka, şerif, pano */
  {
    t: () => Tr('Kanunun Kapısı'),
    cine() {
      return { sc: 'q_town', lines: [
        ['S', Tr('Konuşmayı bana bırak. Şerif beni sever.')],
        ['S', Tr('Yani... eskiden severdi.')],
      ], after() { const t = this.sTown(), s = this.sSpot(t.spawn.x, t.spawn.y, 0, 40); this.sTeleport(s[0], s[1]); if (this.hour < 9) this.sSkipTo(10); const e = this.sullyEnt(); this.story.sully = { x: s[0] + 24, y: s[1] + 4 }; if (e) { e.x = s[0] + 24; e.y = s[1] + 4; e.mounted = null; } } };
    },
    steps: [
      { t: () => Tr('Kazancını bankaya yatır'), ev: 'deposit', at() { return this.sDoor(this.sBld('bank'), 4); },
        skip() { return !this.sBld('bank'); },
        talk: () => [['S', Tr('Önce bankaya uğra. Cebinde para taşıma; buralarda cepler kendi kendine boşalır.')]],
        hint: () => Tr`Bankada <b>Banka İşlemleri</b>: yatırdığın para ölsen de kaybolmaz ve faiz getirir.` },
      { t: () => Tr('Şerif ofisine gir'), ev: 'enter', ok: (b) => b && b.type === 'sheriff', at() { return this.sDoor(this.sBld('sheriff'), 4); },
        on() { const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y); },
        after: () => [
          ['W', Tr('Sully. Yine mi tapu?')],
          ['S', Tr('Yine tapu. Bu sefer yanımda bir tanık var.')],
          ['W', Tr('Tanık neye yarar? Jack\'in kampını bilen yok. Bilen de söylemez.')],
          ['P', Tr('Başında ödül var mı?')],
          ['W', Tr('Var. Panoya bak. Canlı getirene tam ödül... ama kimse getirmiyor.')],
        ] },
      { t: () => Tr('İlan panosuna bak'), ev: 'board', at() { return this.sDoor(this.sBld('sheriff'), -14); },
        hint: () => Tr`Şerif ofisinde <b>Ödül İlanları</b>'na bak. Buradan ödül avı da alabilirsin.`,
        after: () => [['S', Tr('Yirmi beş dolar. Demek benim tapum yirmi beş dolar etmiyor.')], ['S', Tr('Akşam saloona gidelim. Şerifin bilmediğini barmen bilir.')]] },
    ],
  },
  /* 8 — Saloon Söylentileri: içki, söylenti, kampın yeri */
  {
    t: () => Tr('Saloon Söylentileri'),
    cine() {
      return { sc: 'q_saloon', lines: [
        ['S', Tr('Barmene bir içki ısmarla. Sonra sus.')],
        ['P', Tr('Susmak mı?')],
        ['S', Tr('İnsanlar sessizliğe dayanamaz. Doldurmak için ağızlarından ne çıktığını bilmezler.')],
      ], after() { this.sSkipTo(20, 19); const p = this.sDoor(this.sBld(['saloon', 'cantina']), 22); if (p) { const s = this.sSpot(p.x - 30, p.y + 10, 0, 30); this.sTeleport(s[0], s[1]); this.sullyGo(p.x + 16, p.y); } } };
    },
    steps: [
      { t: () => Tr('Saloona gir'), ev: 'enter', ok: (b) => b && (b.type === 'saloon' || b.type === 'cantina'), at() { return this.sDoor(this.sBld(['saloon', 'cantina']), 4); } },
      { t: () => Tr('Barda bir içki al'), ev: 'drink', at() { return this.sDoor(this.sBld(['saloon', 'cantina']), -20); },
        hint: () => Tr`Barmenle konuş: <b>Bir Viski İç</b> ya da <b>Alışveriş</b>'ten bir bira al. Fazla içersen sarhoş olursun.` },
      { t: () => Tr('Söylenti dinle'), ev: 'rumor', at() { return this.sDoor(this.sBld(['saloon', 'cantina']), -20); },
        hint: () => Tr`Barmenle konuş ve <b>Söylenti Dinle</b>. Birkaç kuruşa bildiklerini anlatır.`,
        after() {
          const P = this.player;
          if (!P.has('binoculars')) P.addItem('binoculars', 1, true);
          if (!P.has('bedroll')) P.addItem('bedroll', 1, true);
          P.addItem('raw_game', 2, true);
          return [
            ['S', Tr('{kamp}... Biliyordum. Eski avcıların kamp yeri.')],
            ['S', Tr('Gece adamların üstüne gidilmez. Yolun yarısında kamp kurar, şafakta yaklaşırız.')],
            ['S', Tr('Al bunları. Babamın dürbünü, benim eski tulumum, bir de akşam yemeği. Tulum senden yaşlı, ona göre davran.')],
          ];
        } },
    ],
  },
  /* 9 — Ateş Başında: kamp, pişir, uyu */
  {
    t: () => Tr('Ateş Başında'),
    steps: [
      { t: () => Tr('Kamp yerine git'), chk() { const s = this.story.site, P = this.player; return dist(P.x, P.y, s.x, s.y) < 150; }, at() { return this.story.site; }, wp: true,
        on() { const s = this.story.site; this.sullyGo(s.x + 30, s.y - 10, true); },
        hint: () => Tr`Haritadaki işarete sür. Sully seni orada bekleyecek.` },
      { t: () => Tr('Kamp kur'), ev: 'camp',
        hint: () => Tr`${Input.glyph('camp')} basılı tutarak kamp kur. Kasabanın dışında ve yakında tehlike yokken kurulabilir.`,
        cine: () => ({ sc: 'q_fire', lines: [
          ['S', Tr('Senin yaşındayken ben de böyle toprakta uyurdum. Sırtım daha az ağrırdı.')],
          ['P', Tr('Neden yardım ediyorsun bana, Sully? İlk günden beri.')],
          ['S', Tr('Bilmem.')],
          ['S', Tr('Belki bana edilmeyen yardımı ödüyorumdur. Belki de konuşacak birini arıyordum.')],
          ['S', Tr('Ye bir şeyler, sonra uyu. Nöbeti ben tutarım; zaten uyuyamam.')],
        ], after() { this.sSkipTo(21.5, 20); const c = this.camp; if (c) { this.sullyGo(c.x - 26, c.y + 4, false); const e = this.sullyEnt(); if (e) { e.x = c.x - 26; e.y = c.y + 4; e.mounted = null; } } if (c && !UI.isModal()) UI.openCamp(); } }) },
      { t: () => Tr('Ateşte et pişir'), ev: 'cook', skip() { return !this.player.has('raw_game') && !this.player.has('raw_big') && !this.player.has('raw_bird'); },
        hint: () => Tr`Kamp menüsünde <b>Pişir ve Üret</b>: çiğ et pişince hem daha çok doyurur hem hasta etmez.` },
      { t: () => Tr('Sabaha kadar uyu'), ev: 'sleep', ok: (d) => d === 'camp',
        hint: () => Tr`Kamp menüsünde <b>Uyu</b> → <b>Sabaha Kadar</b>. Uyurken oyun kaydedilir.` },
    ],
  },
  /* 10 — Kızıl Jack: gözetle, yaklaş, yakala, teslim et, tapuyu ver */
  {
    t: () => Tr('Kızıl Jack'),
    cine() {
      return { sc: 'q_dawn', lines: [
        ['S', Tr('Dört kişi. Biri nöbette, o da uyukluyor.')],
        ['S', Tr('Kızıl olanı görüyor musun? Ateşin başında, ayakta.')],
        ['S', Tr('Onu canlı istiyorum, {ad}. Ölüsü bana tapuyu geri verir ama hesap vermez.')],
        ['P', Tr('Ya diğerleri?')],
        ['S', Tr('Diğerleri senin bileceğin iş. Ben atların yanındayım; silah sesi duyarsam gelirim.')],
      ], after() { const S = this.story; if (this.hour > 9 || this.hour < 5) this.sSkipTo(6); const a = Math.atan2(S.site.y - S.camp.y, S.site.x - S.camp.x), s = this.sSpot(S.camp.x + Math.cos(a) * 470, S.camp.y + Math.sin(a) * 470, 0, 80); this.sTeleport(s[0], s[1]); this.sullyGo(S.site.x + 20, S.site.y); } };
    },
    talk(S) { return S.flags.lasso ? [['S', Tr('Şu kementi de al. Bağlamayı bilirsin, değil mi? Bilmiyorsan öğrenirsin.')]] : []; },
    start(S) { const P = this.player; if (!P.weapons.has('lasso')) { P.giveWeapon('lasso', true); S.flags.lasso = 1; } if (!P.has('binoculars')) P.addItem('binoculars', 1, true); },
    steps: [
      { t: () => Tr('Kampı dürbünle gözetle'), chk() { const S = this.story, C = this.cam; return !!this.binoc && S.camp.x > C.ox && S.camp.x < C.ox + this.vw && S.camp.y > C.oy && S.camp.y < C.oy + this.vh; }, at() { return this.story.camp; },
        hint: () => Tr`${Input.glyph('satchel')} Çanta'dan <b>Dürbün</b>'ü kullan ve kampa doğru bak. Gördüğün kişiler etiketlenir.`,
        after: () => [['P', Tr('Dört kişi... Jack ateşin başında.')]] },
      { t: () => Tr('Kampa sessizce yaklaş'), chk() { const S = this.story, P = this.player; return dist(P.x, P.y, S.camp.x, S.camp.y) < 300; }, at() { return this.story.camp; },
        hint: () => Tr`${Input.glyph('crouch')} ile çömel: daha az ses çıkarır, daha geç fark edilirsin. Atını geride bırakmak iyi fikir.` },
      { t: () => Tr('Kızıl Jack\'i etkisiz hâle getir'), chk() { const j = this.jackEnt(); return !!(j && (j.dead || j.bound)); }, at() { return this.jackEnt() || this.story.camp; },
        hint: () => Tr`Nişan alırken ${Input.glyph('deadeye')} ile <b>Odak</b>'ı aç: zaman yavaşlar. Jack'i canlı istiyorsan <b>kementi</b> seç (${Input.glyph('wheel')}), ${Input.glyph('fire')} ile at, sonra yaklaşıp ${Input.glyph('interact')} basılı tutarak bağla.`,
        done() { const j = this.jackEnt(); this.story.alive = !!(j && !j.dead); } },
      { t: () => Tr('Tapuyu Jack\'in üstünden al'), ev: 'deed', at() { return this.jackEnt(); }, skip() { return this.story.deed; }, chk() { return this.story.deed; },
        hint: () => Tr`Jack'in yanında ${Input.glyph('interact')} basılı tut: <b>Tapuyu Al</b>.` },
      { t() { return this.story.alive ? Tr('Jack\'i şerife canlı teslim et') : Tr('Jack\'in cesedini şerife götür'); }, ev: 'deliver', ok: (e) => e && e.quest === 'rival', at() { const j = this.jackEnt(), P = this.player; if (j && j !== P.carry && !(this.horse && this.horse.load && this.horse.load.includes(j))) return j; return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
        on(S) {
          const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y);
          // tapu alınmadan teslim edildiyse bu adım zaten olmuştur
          if (S.jack === 'delivered') { const st = this.qStep(); setTimeout(() => { if (this.qStep() === st && !S.wait) this.qDone(); }, 60); }
        },
        hint: () => Tr`Jack'in yanında ${Input.glyph('interact')} ile omzuna al, atının yanında <b>eyere yükle</b>. Şerif ofisinde teslim et.`,
        done() { this.story.jack = 'delivered'; },
        after() { return this.story.alive ? [['W', Tr('Kızıl Jack. Hem de canlı! On yıldır bu masada bunu bekliyordum.')], ['W', Tr('Sully\'ye söyle... Neyse, ben söylerim. Borcum var ona.')]] : [['W', Tr('Kızıl Jack... Keşke canlı olsaydı. Ama bu da bir şey.')]]; } },
      { t: () => Tr('Tapuyu Sully\'ye ver'), ev: 'talk', at() { return this.sullyEnt() || this.story.sully; },
        say: () => [['P', Tr('Bunu kaybetmişsin galiba.')], ['S', Tr('...')], ['S', Tr('Bu benim... Martha\'nın el yazısı, şurada, köşede.')]],
        cine: () => ({ sc: 'q_finale', cap: { k: Tr('Son'), n: Tr('Sully\'nin Senedi'), s: '' }, lines: [
          ['S', Tr('Otuz bir yıl... ve bir kâğıt parçası.')],
          ['S', Tr('Martha görse gülerdi. "Dunham, kâğıda bu kadar bağlanma" derdi.')],
          ['P', Tr('Ama bağlandın.')],
          ['S', Tr('Bağlandım. Ama kâğıda değil.')],
          ['S', Tr('Bu çiftliğin kapısı sana hep açık, {ad}. Ne zaman istersen gel. Bu sefer kahve de alırım.')],
          ['P', Tr('Belki bir gün kendi toprağım olur.')],
          ['S', Tr('Olur. Ama önce çit tamir etmeyi öğren.')],
        ], after() { const R = this.story.ranch; this.sSkipTo(18.5, 17); const s = this.sSpot(R.x + 20, R.y + 24, 0, 40); this.sTeleport(s[0], s[1]); this.sullyGo(R.x + 6, R.y - 4); const e = this.sullyEnt(); if (e) { e.x = R.x + 6; e.y = R.y - 4; } } }) },
    ],
  },
];

/* ==========================================================
   Hikâye tanımları. Her tanım: title/intro/outro (günlük), mentor (akıl
   hocası: isim, görünüş, at, iş, sohbet), rival (hedef kişi), setup (dünyada
   yerleri seçer), apply (yüklemede dünyaya işler), poster, rumor, finish,
   epilogue ve chapters (on bölüm).
   ========================================================== */
const STORIES = {
  sully: {
    id: 'sully', ach: 'story',
    title: () => Tr('Sully\'nin Senedi'),
    intro: () => Tr`Yaşlı çiftçi Dunham Sully'nin gazete ilanıyla geldin. Çiftliğin tapusu çalınmış; Sully'ye yardım et.`,
    outro: () => Tr`Hikâye tamamlandı. Sully'nin çiftliği seni bekliyor.`,
    welcome: () => Tr('İyi yolculuklar, kovboy. Gazete ilanını veren <b>Dunham Sully</b> seni kasabada bekliyor; sağ üstteki hedefi izle.'),
    mentor: {
      name: 'Dunham Sully', short: 'Sully', look: SULLY_LOOK, horse: SULLY_HORSE, work: 'ranch',
      place: () => Tr('Sully Çiftliği'),
      home(S) { return S.ranch; },
      chatDone: () => [
        Tr('Kahve buldum bu sefer. Gerçek kahve. Martha görse inanmazdı.'), Tr('Çit hâlâ yarım. Ama artık kimse onu benden almaya kalkmıyor.'),
        Tr("Kızıl Jack'in davası gelecek ay. Gidip en ön sıraya oturacağım."), Tr('Tavuklar seni sordu. Yalan değil, gıdakladılar.'),
        Tr('Yorgun görünüyorsun, {ad}. Otur biraz, toprak kaçmaz.'), Tr('Ne zaman istersen gel. Ahırda yer var, sofrada da.'),
      ],
      chatBusy: () => [Tr('Şimdi değil, evlat. Önce işimizi bitirelim.'), Tr('Bir şey mi unuttun? Ben de çok unuturum, yaştan.'), Tr('Konuşacak çok vaktimiz olacak. Hadi.')],
    },
    rival: {
      name: () => Tr('Kızıl Jack'), look: JACK_LOOK, hp: 150, weapon: 'repeater', money: 2.5, fromCh: 9, reward: [25, 12],
      take: { n: () => Tr('Tapuyu Al'), k: () => Tr('Tapu'), msg: () => Tr('Sully\'nin tapusu artık sende.') },
    },
    setup(S, town) {
      // Sully'nin çiftliği: kasabaya en yakın çiftlik
      let best = null, bd = 1e9;
      for (const p of this.world.pois) if (p.kind === 'farm') { const d = dist(p.x, p.y, town.spawn.x, town.spawn.y); if (d < bd) { bd = d; best = p; } }
      if (best) { const b = this.world.buildings[best.building]; S.ranch = { pid: best.pid, x: b.door.x, y: b.door.y + 18, cx: best.x, cy: best.y }; }
      else { const s = this.sSpot(town.spawn.x + 1400, town.spawn.y, 0, 300); S.ranch = { pid: -1, x: s[0], y: s[1], cx: s[0], cy: s[1] }; }
      // Kızıl Jack'in kampı: çiftliğe en yakın haydut kampı
      best = null; bd = 1e9;
      for (const p of this.world.pois) if (p.kind === 'camp') { const d = dist(p.x, p.y, S.ranch.cx, S.ranch.cy) + dist(p.x, p.y, town.cx, town.cy) * 0.5; if (d < bd) { bd = d; best = p; } }
      S.camp = best ? { pid: best.pid, id: best.id, x: best.x, y: best.y, n: best.n } : { pid: -1, x: S.ranch.cx + 2000, y: S.ranch.cy, n: Tr('Kızıl Kamp') };
      // kampa varmadan önce gece geçirilecek yer: kamptan kasabaya doğru ~750 piksel
      S.site = this.storySite(S.camp, town);
      const sp = this.sSpot(town.spawn.x + 34, town.spawn.y + 6, 0, 40);
      S.sully = { x: sp[0], y: sp[1] };
    },
    apply(S) {
      const rp = S.ranch && this.world.pois.find(p => p.pid === S.ranch.pid);
      if (rp) { rp.n = Tr('Sully Çiftliği'); rp.sully = true; this.discovered.add(rp.id); }
    },
    poster(S) { return this.sullyPoster(S); },
    rumor(S) {
      UI.info(Tr('Barmen Fısıldıyor'), `<p class="quote">${this.sFmt(Tr('"Kızıl Jack mi? Sesini alçalt... Geçen hafta adamlarından biri burada sızdı kaldı. Sabaha kadar {kamp} diye sayıkladı, bir de kızıl sakallının payından. Ben bir şey söylemedim, tamam mı?"'))}</p><p>${this.sFmt(Tr('<b>{kamp}</b> haritanda işaretlendi.'))}</p>`);
    },
    finish(S) {
      const P = this.player;
      this.earn(S.alive ? 10 : 6, Tr('Sully\'nin teşekkürü'));
      if (!P.weapons.has('repeater')) { P.giveWeapon('repeater'); P.ammo.repeater = Math.min(AMMO.repeater.max, (P.ammo.repeater || 0) + 24); UI.feed(Tr`Sully'nin eski tüfeği artık senin: ${WEAPONS.repeater.n}`); }
      this.addHonor(5);
      this.sullyGo(S.ranch.x + 6, S.ranch.y - 4);
    },
    epilogue: () => Tr`Hikâye bitti ama hayat sürüyor. Artık ne yapacağın sana kalmış: avlan, çalış, ev kur, âşık ol ya da kanunun öbür yanına geç. <b>Hedefin hâlâ 80 yaşına kadar yaşamak.</b> Sully'nin çiftliğinin kapısı sana hep açık.`,
    chapters: STORY_SULLY,
  },
};
/* Geçmiş → hikâye. Kanun Kaçağı'nın kendi hikâyesi yazılana dek hikâyesi yoktur
   (kasabada tanınacağı için Sully'nin hikâyesi ona uymaz). */
const STORY_FOR_BG = { farm: 'sully', immigrant: 'sully', rail: 'sully', trapper: 'sully' };

/* Bölüm yardımcıları (Story'ye eklenir) */
Object.assign(Story, {
  /* kasabanın en yakın kuyusu ya da yalağı */
  storyWell() {
    const S = this.story, t = this.sTown(), W = this.world, P = this.player;
    if (S.well) return S.well;
    let best = null, bd = 1e9;
    for (let ty = Math.floor((t.cy - 600) / TS); ty < (t.cy + 600) / TS; ty++) for (let tx = Math.floor((t.cx - 600) / TS); tx < (t.cx + 600) / TS; tx++) {
      const o = W.obj[ty * WW + tx];
      if (o !== O.WELL && o !== O.PUMP && o !== O.TROUGH) continue;
      const x = tx * TS + 8, y = ty * TS + 8, d = dist(x, y, P.x, P.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return (S.well = best);
  },
  /* bir kampa varmadan önce gece geçirilecek yer: kamptan kasabaya doğru ~750 piksel */
  storySite(camp, town) {
    const a = Math.atan2(town.cy - camp.y, town.cx - camp.x), W = this.world;
    for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) for (const r of [760, 640, 880, 540]) {
      const s = this.findSpawnPos(camp.x + Math.cos(a + da) * r, camp.y + Math.sin(a + da) * r, 0, 120);
      if (s && !W.townAt(s[0], s[1], 34) && !W.blocked(s[0], s[1] + 14, 8)) return { x: s[0], y: s[1] };
    }
    const s = this.sSpot(camp.x + Math.cos(a) * 760, camp.y + Math.sin(a) * 760, 0, 160);
    return { x: s[0], y: s[1] };
  },
  /* çevrenin baskın doğası (çiftliğin düzlenmiş toprağı sayılmaz) */
  storyBiome(x, y) {
    const n = {};
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, r = 260 + (k % 3) * 120, b = this.world.biomeAt(x + Math.cos(a) * r, y + Math.sin(a) * r); if (STORY_ENV[b]) n[b] = (n[b] || 0) + 1; }
    return Object.keys(n).sort((a, c) => n[c] - n[a])[0] || 'GRASS';
  },
  /* çakallar: kümesteki tavuklara saldırır */
  storyCoyotes(S) {
    const R = S.ranch;
    for (const e of this.ents) if (e.storyCoy || e.storyHen) e.remove = true;
    S.coyGone = S.coyGone || 0;
    for (let k = 0; k < 3; k++) {
      const s = this.sSpot(R.cx + rnd(-60, 60), R.cy + rnd(40, 100), 0, 40);
      const h = new Animal(s[0], s[1], 'chicken'); h.home = { x: R.cx, y: R.cy + 70, r: 60 }; h.storyHen = true; h.keep = true; this.addEnt(h);
    }
    for (let k = S.coyGone; k < 3; k++) {
      const a = rnd(0, TAU), s = this.sSpot(R.cx + Math.cos(a) * 240, R.cy + 70 + Math.sin(a) * 240, 0, 60);
      const c = new Animal(s[0], s[1], 'coyote'); c.storyCoy = true; c.keep = true; c.home = { x: R.cx, y: R.cy + 70, r: 120 }; this.addEnt(c);
    }
  },
  /* vurulan, kaçan ya da kaybolan çakallar */
  storyCoyCount() {
    const S = this.story, R = S.ranch;
    let gone = S.coyGone || 0;
    for (const e of this.ents) if (e.storyCoy && !e.counted && (e.dead || e.remove || dist(e.x, e.y, R.cx, R.cy) > 650)) { e.counted = true; e.keep = false; gone++; }
    S.coyGone = Math.min(3, gone);
    return S.coyGone;
  },
  /* av: çiftliğin doğasına uygun bir sürü */
  storyGame(S) {
    const R = S.ranch, b = S.biome || this.storyBiome(R.cx, R.cy);
    S.game = S.game || (b === 'DESERT' || b === 'REDROCK' || b === 'DRY' ? 'pronghorn' : 'deer');
    if (this.ents.some(e => e.storyGame && !e.dead && !e.remove)) return;
    const a = rnd(0, TAU), cx = R.cx + Math.cos(a) * 520, cy = R.cy + Math.sin(a) * 520;
    let lead = null;
    for (let k = 0; k < 3; k++) {
      const s = this.sSpot(cx + rnd(-30, 30), cy + rnd(-30, 30), 0, 60);
      const g = new Animal(s[0], s[1], S.game); g.storyGame = true; g.keep = true; g.home = { x: cx, y: cy, r: 90 };
      if (lead) g.leader = lead; else lead = g;
      this.addEnt(g);
    }
  },
  /* satılacak av ürünü var mı (çanta, omuz, eyer) */
  storyHasGoods() {
    const P = this.player;
    if (Object.keys(P.inv).some(id => ITEMS[id] && (ITEMS[id].c === 'animal' || STORY_MEAT.includes(id)) && P.count(id) > 0)) return true;
    if (P.carry && (P.carry.kind === 'pelt' || P.carry.kind === 'animal')) return true;
    return !!(this.horse && this.horse.load && this.horse.load.some(e => e.kind === 'pelt' || e.kind === 'animal'));
  },
  /* çakal tavuğa koşar; yakalarsa tavuk ölür */
  storyAnimal(a, dt) {
    if (!a.storyCoy || a.state === 'flee' || a.state === 'attack' || a.dead || a.bound) return false;
    let hen = a.prey;
    if (!hen || hen.dead || hen.remove) { hen = null; let bd = 1e9; for (const e of this.ents) if (e.storyHen && !e.dead && !e.remove) { const d = dist(e.x, e.y, a.x, a.y); if (d < bd) { bd = d; hen = e; } } a.prey = hen; }
    if (!hen) return false;
    const d = dist(a.x, a.y, hen.x, hen.y);
    a.ang = turnTo(a.ang, Math.atan2(hen.y - a.y, hen.x - a.x), dt * 4);
    a.spd = lerp(a.spd, d < 60 ? a.def.spd * 0.9 : a.def.spd * 0.35, dt * 3);
    a.move(Math.cos(a.ang) * a.spd * dt, Math.sin(a.ang) * a.spd * dt);
    a.mv = a.spd / 30; a.phase += dt * (2 + a.spd * 0.18);
    if (d < 7) { hen.hurt(99, 'coyote'); a.prey = null; if (dist(a.x, a.y, this.player.x, this.player.y) < 400) UI.feed(Tr('Çakal bir tavuğu kaptı!'), 'warn'); }
    return true;
  },
});
