'use strict';
/* ==========================================================
   FRONTIER'S END — hikâyeli başlangıçlar
   Her geçmişin kendi on bölümlük hikâyesi olur (STORIES; geçmiş → hikâye:
   STORY_FOR_BG). Motor ortaktır: bir akıl hocası (konuşma satırlarında 'S'),
   bir hedef kişi (rival), bölümler ve adımlar hikâye tanımından okunur.
   İlk hikâye "Sully'nin Senedi": on bölümlük, oynayarak öğreten bir başlangıç. Yaşlı çiftçi
   Dunham Sully'nin yanında iş bulan, ailesinin toprağını kaybetmiş Harlow'lu genç; selamlaşmayı,
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
/* atlı akıl hocasının rota genişliği (atın gövdesi duvara sürtmesin) */
const RIDE_R = 6.5;
const SULLY_HORSE = { col: '#3a2a20', mane: '#1a1410', blanket: '#6a2a20' };
/* Çiftliğin bulunduğu yerin doğası: sinematiklerin renk ve bitki örtüsü */
/* Bölüm 5'te satılabilecek çiğ etler (postlar 'animal' türündedir) */
const STORY_MEAT = ['raw_game', 'raw_big', 'raw_bird'];
const STORY_ENV = { DESERT: 'desert', REDROCK: 'desert', FOREST: 'forest', SNOW: 'forest', DRY: 'dry', GRASS: 'plains', SWAMP: 'coast' };
/* Baskın (Sully, Bölüm 10): baskın saati; hedef kişinin kaçışı (atı kamp merkezinden uzaklık, kırılma canı, hız: ilk
   14 sn, 24 sn'ye dek, sonra at yorulur; oyuncu bu kadar geride kalıp göremezse saklandığı yere varır; saklanacağı
   yerin kamptan uzaklığı); akıl hocasının destek ateşi (menzil, atış aralığı, hasar, sapma, kamptan uzaklığı);
   dönüş pususu (kamptan ve kasabadan en az bu kadar uzakta) */
/* Bölüm 8 (Sully): saloondaki sarhoş haydut. Kalkıp gitme süresi (sn; ısmarlanan her kadeh uzatır), kadeh fiyatı, kaç
   kadehte konuşur, barmenin bilgi fiyatı; takipte atının hızı, arkasına bakma aralığı ve süresi, görme menzili, kampa bu
   kadar yaklaşınca kamp bulunur, oyuncu bu kadar geride kalırsa izi kaybolur */
/* Bölüm 6 (Sully): çiftlik işleri. İş başına para; çatı ve çitte basılı tutma süresi (sn) ve geçen oyun süresi (dk);
   balya sayısı, çatı deliği, kırık direk; balyanın ambarın kapısına bu kadar yakın bırakılması; günü erken bitirmek için
   en az iş; iş başına yorgunluk (uyku, açlık, susuzluk) */
/* Bölüm 4 (Sully): tavuk sayısı, çakal dalgaları (her dalganın çakalı), dalgalar arası bekleme (sn), çakalın kümesten
   doğduğu uzaklık, Sully'nin kümesle dalga arasında durduğu uzaklık, kurtarılan tavuk başına para; sürünün izi (iz sayısı,
   sürünün çiftliğe uzaklığı) */
const COY = { HENS: 6, WAVES: [2, 2, 3], GAP: 5, FIRST: 2.5, FROM: 280, SULLY: 80, PAY: 0.05, TRAIL: 6, HERD: 900 };
const CHORE = { PAY: 0.25, ROOF: 2.4, FENCE: 2, MIN: 25, HAY: 3, NROOF: 2, NFENCE: 2, DROP: 46, EARLY: 3, ENERGY: 2.6, HUNGER: 2, THIRST: 2.3 };
CHORE.N = CHORE.HAY + CHORE.NROOF + CHORE.NFENCE;
const BARFLY = { LEAVE: 70, PER: 35, DRINK: 0.15, TALK: 3, ASK: 1, SPD: 55, LOOK: [6, 10], LOOKT: 1.8, SEE: 240, FOUND: 650, LOST: 1100, NEAR: 800 };
const RAID = {
  WAKE: 4.5, HORSE_R: 70, FLEE_HP: 0.45, RIDE: [128, 104, 80], SLOW: 420, LOSE: 1300, HIDE: [1700, 2200],
  SUP: { R: 320, RATE: [2.4, 3.4], DMG: 24, ACC: 0.06, DIST: 190 },
  AMBUSH: { FROM: 700, TOWN: 900 },
};

const Story = {
  /* ---------------- yardımcılar ---------------- */
  get storyOn() { const S = this.story; return !!(S && S.on && !S.done); },
  /* oynanan hikâyenin tanımı (eski kayıtlar: Sully) */
  storyDef() { const S = this.story; return STORIES[(S && S.id) || 'sully'] || STORIES.sully; },
  sName(w) { const D = this.storyDef(); return w === 'S' ? D.mentor.short : w === 'R' ? D.rival.name() : w === 'K' && D.kin ? D.kin.short.call(this) : D.speakers && D.speakers[w] ? D.speakers[w]() : w === 'P' ? this.player.name : w === 'W' ? Tr('Şerif') : w === 'B' ? Tr('Barmen') : w; },
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
  /* hikâyenin ikinci yol arkadaşı (konuşmalarda 'K'; ör. Göçmen'in ağabeyi) */
  kinEnt() { return this.ents.find(e => e.quest === 'kin' && !e.remove) || null; },
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
  /* Adım arası (konuşma sürerken ya da adım biterken): sıradaki hedef. Bu sırada yapılanlar o adımda sayılır (_qPend). */
  qPreview() {
    const S = this.story, c = this.qCh();
    if (!S || !c || S.done) return null;
    const cur = this.qStep();
    if (cur && !S.wait) return null;
    for (let k = S.st + 1; k < c.steps.length; k++) {
      const st = c.steps[k];
      try { if (st.skip && st.skip.call(this, S)) continue; } catch (e) { return null; }
      return { st, k };
    }
    return null;
  },
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
    if (st.talk) this.qSay(st.talk.call(this, S), st.choice ? () => this.storyChoice(st) : null, 0, st);
    else if (st.choice) this.storyChoice(st);
    // konuşma sırasında yapılmış eylemler
    const pend = this._qPend; this._qPend = null;
    if (pend && st.ev) for (const [type, d] of pend) { if (this.qStep() !== st || S.wait) break; this.qEvent(type, d); }
    if (this.qStep() !== st || S.wait) { this.questHud(); return; }
    // görevin rotası kişisel hedeften ayrıdır, her adımda kendiliğinden çizilir (js/nav.js); hemen kurulsun
    Nav.tT = 0;
    if (st.hint) setTimeout(() => {
      if (this.qStep() !== st || this.state !== 'play') return;
      const h = st.hint.call(this, S);
      UI.help(h, 9);
      // ateş etmeyi isteyen adım (ilk çakallar, kurtlar...): nişan ipucu daha ilk atıştan önce, adım başlarken gelir;
      // elde silah yoksa önce çark (bkz. UI.coachStep). Çarktan bir şey seçmeyi isteyen adımda çark hatırlatılır.
      if (h.includes(Input.glyph('aim'))) UI.coachFor = { k: 'aim', st };
      else if (h.includes(Input.glyph('wheel'))) UI.coachWheel();
    }, 900);
    this.questHud();
  },
  qDone() {
    const S = this.story, st = this.qStep();
    if (!st || S.wait) return;
    S.wait = true; S.fin = S.st;
    this.qCut(st);
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
      title: st.t.call(this, S), cls: 'small story-choice', sub: st.choiceSub ? st.choiceSub.call(this, S) : '', onBack: () => {}, noClose: true,
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
  qSay(lines, cb, delay = 0, tag) {
    const S = this.story, L = (lines || []).filter(Boolean).map(([w, x]) => ({ w, x: this.sFmt(x), raw: x, tag }));
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
  /* hedef tamamlanınca o adımın konuşmasından kalan satırlar söylenmez (ekrandaki satır biter) */
  qCut(tag) {
    const S = this.story;
    if (S && S.talkQ && tag) S.talkQ = S.talkQ.filter(l => l.tag !== tag);
  },
  storyTalking() { const S = this.story; return !!(S && S.talkQ && (S.talkQ.length || S.talkCb)); },
  /* Konuşmayı geç: satır atlanır; all ile konuşmanın kalanı atlanır, hikâye hemen sıradaki adıma geçer */
  storySkip(all) {
    const S = this.story;
    if (!this.storyTalking() || this.cine) return;
    if (all) S.talkQ.length = 0;
    S.talkT = 0;
    UI.el.sub.classList.add('hidden');
  },
  /* Enter / Boşluk ya da (önünde başka etkileşim yoksa) etkileşim tuşu: dokununca satır geçer, basılı tutunca hepsi */
  storySkipInput(dt) {
    const S = this.story, I = Input;
    if (!this.storyTalking() || this.cine || UI.isModal() || document.body.classList.contains('wheel-open')) { S.skipHold = 0; return; }   // çark açıkken Enter/Boşluk eşya kullanır
    const free = !UI.curInteract && !UI.holdTarget;
    const held = I.keys.has('Enter') || I.keys.has('NumpadEnter') || I.keys.has('Space') || (free && I.down('interact'));
    S.skipHold = held ? (S.skipHold || 0) + dt : 0;
    if (S.skipHold > 0.6) this.storySkip(true);
    else if (I.keyTap('Enter', 'NumpadEnter', 'Space') || (free && I.pressed('interact'))) this.storySkip(false);
  },
  skipHint() { return Tr`${Input.device === 'pad' ? Input.glyph('interact') : Input.glyph('confirm')} Geç · basılı tut: tümü`; },
  talkDur(x) { return window.__storyFast ? 0.05 : clamp(1.5 + x.length * 0.052, 2.2, 6.5); },
  storyTalkTick(dt) {
    const S = this.story;
    if (!S.talkQ || (!S.talkQ.length && !S.talkCb)) return;
    this.storySkipInput(dt);
    if (!S.talkQ) return;
    S.talkT -= dt;
    if (S.talkT > 0) return;
    const ln = S.talkQ.shift();
    if (!ln) { const cb = S.talkCb; S.talkCb = null; S.talkQ = null; if (cb) cb(); return; }
    // oyun içi konuşmalar seslendirilmez (seslendirme yalnızca sinematiklerde)
    const me = this.mentorEnt(), d = this.talkDur(ln.x);
    UI.subtitle(this.sName(ln.w), ln.x, d - 0.2, ln.w === 'P', this.skipHint());
    const who = ln.w === 'S' ? me : ln.w === 'R' ? this.rivalEnt() : ln.w === 'K' ? this.kinEnt() || this.ents.find(e => e.quest === 'ward' && !e.remove) : ln.w === 'P' ? this.player : null;
    // söz bir kez, altyazıda yazılır; konuşanın üstünde yalnızca konuşma işareti
    if (who && (who === this.player || dist(who.x, who.y, this.player.x, this.player.y) < 300)) Bubbles.add(who, '', d - 0.2, true);
    if (ln.w === 'S' && me && !me.anim && chance(0.4)) this.setAnim(me, pick(['gesture', 'point', 'shrug', 'rub', 'scratch']));
    S.talkT = d;
  },

  /* ---------------- sinematik ----------------
     Seslendirme yalnızca sinematiklerde: satırların ses dosyaları sinematikten önce yüklenir (en çok 3 sn
     beklenir), her satır sesi bitene kadar ekranda kalır. Oyuncunun satırı oyuncunun cinsiyetine göre seslendirilir. */
  voSex(w) { return w === 'P' && this.player ? this.player.sex : null; },
  cineVoice(ln) { Audio_.voice(ln.raw, I18N.lang, { sex: ln.self ? this.voSex('P') : null }); },
  voWait(lines) {
    const all = Promise.all((lines || []).map(([w, x0]) => Audio_.voPreload(x0, I18N.lang, this.voSex(w))));
    return Promise.race([all, new Promise(r => setTimeout(r, 3000))]).catch(() => {});
  },
  async cineLines(lines, start = 3.4) {
    await this.voWait(lines);
    let t = start; const out = [];
    for (const [w, x0] of lines || []) {
      const x = this.sFmt(x0), vd = Audio_.voDur(x0, I18N.lang, this.voSex(w)), d = Math.max(this.talkDur(x) * 0.95, vd ? vd + 0.35 : 0);
      out.push({ t, d, w: this.sName(w), x, raw: x0, self: w === 'P' }); t += d + 0.3;
    }
    return { lines: out, dur: t + 1.2 };
  },
  /* açılış sinematiğinin satırları: hikâye henüz kurulmadan (S yok) isimler tanımdan çözülür */
  async openingLines(D) {
    const nm = (w) => w === 'P' ? this.player.name : w === 'S' ? D.mentor.short : D.speakers && D.speakers[w] ? D.speakers[w]() : w;
    const src = D.opening();
    await this.voWait(src);
    let t = 0;
    return src.map(([w, x0]) => {
      const x = this.sFmt(x0), vd = Audio_.voDur(x0, I18N.lang, this.voSex(w)), d = Math.max(this.talkDur(x) * 0.95, vd ? vd + 0.35 : 0);
      const o = { t, d, w: nm(w), x, raw: x0, self: w === 'P' }; t += d + 0.3; return o;
    });
  },
  qCine(sc, lines, cap, after, cast) {
    const fin = () => { this.cine = false; this.timeScale = 1; try { if (after) after(); } catch (e) { console.warn(e); } };
    if (window.__testNoCine || typeof Cinema === 'undefined' || !Cinema.has(sc)) { fin(); return; }
    this.cine = true; this._qPend = null; Bubbles.clear(); UI.el.sub.classList.add('hidden');
    const h = this.horse, S = this.story, D = this.storyDef();
    // dünya bekler (this.cine); satırların sesleri yüklenince sinematik başlar
    this.cineLines(lines).then((L) => Cinema.play(sc, { look: this.player.look, seed: (this.seed || 1) + S.ch * 31, env: S.env, town: S.town, sully: cast === 'rival' ? D.rival.look : cast === 'kin' && D.kin ? Object.assign({}, D.kin.look, S.kinLook || {}) : D.mentor.look, jack: D.rival ? D.rival.look : null, horseCol: h && h.look && h.look.col, cap, lines: L.lines, dur: L.dur, capAt: 0.4, onLine: (ln) => this.cineVoice(ln) })).then(fin, fin);
  },

  /* ---------------- her kare ---------------- */
  storyTick(dt) {
    const S = this.story;
    if (!S || !S.on) return;
    this.storyTalkTick(dt);
    if (!S.done) this.questNudge(dt);
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
    this.storyKin();
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
  /* Yol arkadaşı (S.kin hedefinde durur, yürür; bağlıyken kıpırdamaz) */
  storyKin() {
    const S = this.story, g = S.kin, K = this.storyDef().kin, P = this.player;
    let e = this.kinEnt();
    if (!g || !K) { if (e) e.remove = true; return; }
    if (!e) {
      if (dist(P.x, P.y, g.x, g.y) > 1100) return;
      const s = g.tied ? [g.x, g.y] : this.sSpot(g.x, g.y, 0, 30);
      e = new NPC(s[0], s[1], 'mentor', { name: K.name.call(this), look: Object.assign({}, K.look, S.kinLook || {}), hp: 9999 });
      e.quest = 'kin'; e.keep = true; e.weapon = null; e.money = 0; e.ang = Math.atan2(P.y - e.y, P.x - e.x);
      this.addEnt(e);
    } else if (dist(e.x, e.y, P.x, P.y) > 1700) e.remove = true;
  },
  /* NPC.update'ten çağrılır: true dönerse olağan davranış atlanır */
  questNpc(e, dt) {
    if (e.quest === 'drunk') return this.drunkNpc(e, dt);   // Sully, Bölüm 8: saloondaki sarhoş haydut
    if (e.quest !== 'mentor' && e.quest !== 'kin') return false;
    const S = this.story, g = S && (e.quest === 'kin' ? S.kin : S.sully), P = this.player, MH = this.storyDef().mentor.horse;
    e.hp = e.maxHp = 9999; e.hostile = false; e.witness = null;
    // akıl hocasının feneri (Sully, Bölüm 4: çakal gecesi)
    e.lantern = e.quest === 'mentor' && !!(S && S.flags && S.flags.lantern) && this.isNight;
    // baskında silah sesini duyan akıl hocası destek ateşi açar (Sully, Bölüm 10)
    if (e.quest === 'mentor' && this.mentorSupport(e, dt)) return true;
    if (!g) { e.mv = 0; return true; }
    if (g.tied) { e.state = 'tied'; e.mv = 0; e.spd = 0; e.mounted = null; if (dist(e.x, e.y, g.x, g.y) > 4) { e.x = g.x; e.y = g.y; } return true; }
    if (e.state === 'tied') e.state = 'idle';
    if (e.state !== 'idle' && e.state !== 'walk') e.state = 'idle';
    const d = dist(e.x, e.y, g.x, g.y), pd = dist(e.x, e.y, P.x, P.y);
    if (d > 8) {
      // ekran dışında ve uzaktaysa doğrudan yerini alır
      if (g.ride && d > 300 && pd > 450 && !this.onScreen(e.x, e.y, 40)) { const a = this.sAhead(g), s = this.sSpot(a.x, a.y, 0, 30); e.x = s[0]; e.y = s[1]; e.nav = null; e.rr = null; e.mounted = e.mounted || Object.assign({}, MH); return true; }
      if (!g.ride && d > 220 && !this.onScreen(e.x, e.y, 40) && !this.onScreen(g.x, g.y, 40)) { e.x = g.x; e.y = g.y; e.nav = null; e.rr = null; e.mv = 0; e.mounted = g.ride ? e.mounted || Object.assign({}, MH) : null; return true; }
      if (g.ride) {
        if (!e.mounted) this.npcMount(e, Object.assign({}, MH));   // gözü önündeyse atı gelir, eyere sıçrar
        if (d < 400 && !this.onScreen(e.x, e.y, 40) && !this.onScreen(g.x, g.y, 40)) { e.x = g.x; e.y = g.y; e.nav = null; e.rr = null; return true; }
        // oyuncu geride kalırsa bekler
        if (pd > 380 && dist(P.x, P.y, g.x, g.y) > d) { e.mv = 0; e.spd = 0; e.ang = turnTo(e.ang, Math.atan2(P.y - e.y, P.x - e.x), dt * 2); return true; }
        return this.mentorFollow(e, g, dt, pd < 120 ? 120 : 100);
      }
      // yaya: hedef başka bir yerdeyse (kasaba dışı, başka kasaba) rota izlenir; kasaba içinde sokak gezinmesi
      const W = this.world;
      const tE = W.townAt(e.x, e.y, 10);
      if (d > 120 && (!tE || tE !== W.townAt(g.x, g.y, 10))) return this.mentorFollow(e, g, dt, pd < 60 ? 26 : 34);
      const r = this.navStep(e, g.x, g.y, dt, pd < 60 ? 26 : 34);
      if (r === 'fail' && !this.onScreen(e.x, e.y, 20)) { e.x = g.x; e.y = g.y; e.nav = null; }
      return true;
    }
    e.mv = 0; e.spd = 0;
    if (!g.ride && e.mounted) this.npcDismount(e);   // gözü önündeyse eyerden sıçrar, atı uzaklaşır
    if (pd < 80) e.ang = turnTo(e.ang, Math.atan2(P.y - e.y, P.x - e.x), dt * 3);
    else if (g.ang !== undefined) e.ang = turnTo(e.ang, g.ang, dt * 2);
    else this.standTick(e, dt, 0.25);
    return true;
  },
  /* akıl hocası rotayı izler: kasabada sokaklardan kapıya, dışarıda yolları seçerek (duvara doğru dümdüz gitmez) */
  mentorFollow(e, g, dt, sp) {
    const R = this.mentorRoute(e, g);
    while (R.ri < R.route.length - 1 && dist2(e.x, e.y, R.route[R.ri][0], R.route[R.ri][1]) < R.near * R.near) R.ri++;
    const wp = R.route[R.ri], a = Math.atan2(wp[1] - e.y, wp[0] - e.x);
    // keskin dönüşte yavaşlar, köşeyi kavisle alır
    const turn = Math.abs(angDiff(e.ang, a));
    e.ang = turnTo(e.ang, a + (e.dodge || 0), dt * (e.mounted ? 3 : 5));
    const ox = e.x, oy = e.y;
    e.walk(dt, sp * (turn > 1.2 ? 0.45 : turn > 0.6 ? 0.75 : 1));
    if (Math.hypot(e.x - ox, e.y - oy) < 0.2) { e.dodge = (e.dodge || 0) + (chance(0.5) ? 0.6 : -0.6); if (Math.abs(e.dodge) > 2) e.dodge = 0; } else if (e.dodge) e.dodge *= 0.9;
    // ilerleme yoksa (bir şeye takıldıysa) bulunduğu yerden dolanır
    const wd = dist(e.x, e.y, wp[0], wp[1]);
    if (R.ri !== R.bi) { R.bi = R.ri; R.best = wd; R.stuckT = 0; }
    else if (wd < R.best - 2) { R.best = wd; R.stuckT = 0; } else if ((R.stuckT += dt) > 1.5) this.mentorUnstick(e, R);
    return true;
  },
  mentorRoute(e, g) {
    const R = e.rr, rr = g.ride ? RIDE_R : 4.5;
    if (R && R.gx === g.x && R.gy === g.y && R.r === rr) return R;
    let route = this.haulRoute(e.x, e.y, g.x, g.y, { r: rr, ride: true });
    // son yaklaşma: kaba ızgara çiftlik evini, çiti görmez; son ~300 px karo ölçeğinde
    if (!this.world.townAt(g.x, g.y, 4)) {
      let k = route.length - 1;
      while (k >= 0 && dist(route[k][0], route[k][1], g.x, g.y) < 300) k--;
      const from = k >= 0 ? route[k] : [e.x, e.y], loc = TownPath.local(from[0], from[1], g.x, g.y, rr);
      if (loc) route = route.slice(0, k + 1).concat(loc);
    }
    return (e.rr = { gx: g.x, gy: g.y, r: rr, near: g.ride ? 26 : 14, route: route.length ? route : [[g.x, g.y]], ri: 0, bi: -1, best: Infinity, stuckT: 0 });
  },
  /* atlı takıldı: bulunduğu yerden rotanın ~200 px ilerisine karo ölçeğinde dolanır */
  mentorUnstick(e, R) {
    let j = R.ri;
    while (j < R.route.length - 1 && dist(e.x, e.y, R.route[j][0], R.route[j][1]) < 200) j++;
    const to = R.route[j], loc = TownPath.local(e.x, e.y, to[0], to[1], R.r);
    if (loc) { R.route = loc.concat(R.route.slice(j + 1)); R.ri = 0; R.bi = -1; R.best = Infinity; R.stuckT = 0; }
    else e.rr = null;
  },
  /* atlı Sully için oyuncunun önünde bir nokta: oyuncudan hedefe giden rotanın 260 px ilerisi */
  sAhead(g) {
    const P = this.player, c = this._sAhead;
    if (c && c.gx === g.x && c.gy === g.y && dist(c.px, c.py, P.x, P.y) < 60 && this.t - c.t < 2) return c.pt;
    const R = this.haulRoute(P.x, P.y, g.x, g.y, { r: RIDE_R, ride: true });
    let left = 260, px = P.x, py = P.y, pt = { x: g.x, y: g.y };
    for (const q of R) {
      const L = dist(px, py, q[0], q[1]);
      if (L >= left) { pt = { x: px + (q[0] - px) * left / L, y: py + (q[1] - py) * left / L }; break; }
      left -= L; px = q[0]; py = q[1];
    }
    this._sAhead = { gx: g.x, gy: g.y, px: P.x, py: P.y, t: this.t, pt };
    return pt;
  },
  sullyGo(x, y, ride, ang) { this.story.sully = { x, y, ride: !!ride, ang }; },
  /* Hedef kişi (Sully'de Kızıl Jack): kampta belirir; bağlıysa kaçmaz, kayıttan dönüşte yerinde bekler */
  storyRival() {
    const S = this.story, P = this.player, R = this.storyDef().rival;
    if (!R || R.fromCh === undefined || S.ch < R.fromCh || !S.camp || S.jack === 'delivered') return;
    let j = this.rivalEnt();
    if (!j) {
      if (S.jack === 'carried') { S.jack = 'bound'; }   // taşınırken kaybolduysa bıraktığın yerde
      // kaçarken kaydedildiyse saklanacağı yerde belirir
      if (S.jFlee && !S.jHide && S.jack === 'free') S.jHide = S.jHideTo || this.rivalHideSpot(S);
      const hide = S.jack === 'free' && S.jHide;
      const jx = hide ? S.jHide.x : S.jx || S.camp.x + 10, jy = hide ? S.jHide.y : S.jy || S.camp.y - 12;
      if (dist(P.x, P.y, jx, jy) > 900) return;
      const H = hide || S.camp;
      j = new NPC(jx, jy, 'bandit', { hostile: S.jack === 'free', name: R.name(), look: Object.assign({}, R.look), hp: R.hp || 150, weapon: R.weapon || 'repeater', home: { x: H.x, y: H.y, r: 40 }, money: R.money || 2.5 });
      j.quest = 'rival'; j.keep = true;
      // kampın bir üyesi: gece ateş başı ve uyku (js/npccamp.js), kendi saatleriyle; nöbet tutmaz. Saklandığı yerde yalnız
      if (hide) j.cornered = true;
      else if (S.camp.pid >= 0) { j.camp = S.camp.pid; if (R.camp) j.campSched = R.camp; }
      if (S.jack === 'dead') { j.dead = true; j.hp = 0; j.state = 'dead'; j.deadT = 0; }
      else if (S.jack === 'bound') { j.state = 'tied'; j.tieT = 9999; j.hp = 40; j.hostile = true; }
      this.addEnt(j);
      return;
    }
    const carried = P.carry === j || (this.horse && this.horse.load && this.horse.load.includes(j));
    if (j.dead) S.jack = 'dead';
    else if (carried) S.jack = 'carried';
    else if (j.state === 'tied') { S.jack = 'bound'; j.tieT = Math.max(j.tieT, 600); }
    else if (j.state === 'downed') { S.jack = 'downed'; j.downT = Math.max(j.downT, 60); }   // baygın ya da yaralı: hikâye sürerken kendine gelmez
    else if (j.bound) S.jack = 'lassoed';
    else S.jack = 'free';
    if (!carried) { S.jx = Math.round(j.x); S.jy = Math.round(j.y); }
    // kaçışı olan hedef kişinin atı kampın kenarında bağlı bekler
    if (R.flee) this.storyRivalHorse(S, R, j);
  },
  /* İşaretçi: adımın hedefi (dünyada, radarda, haritada) */
  questMark() {
    const S = this.story;
    if (!S || !S.on || S.done) return null;
    let st = this.qStep();
    if (!st || S.wait) { const pv = this.qPreview(); if (pv) st = pv.st; }
    if (!st || !st.at) return null;
    try { return st.at.call(this, S); } catch (e) { return null; }
  },

  /* ---------------- etkileşimler ---------------- */
  mentorActions(e) {
    // konuşma sürerken etkileşim tuşu konuşmayı geçer (storySkipInput)
    if (this.storyTalking()) return [];
    const S = this.story, acts = [], M = this.storyDef().mentor;
    const st = this.qStep();
    const work = M.work && (() => UI.openWork(M.work, M.place()));
    if (S && S.on && !S.done && st && st.ev === 'talk' && st.who !== 'kin' && !S.wait) acts.push({ n: Tr('Konuş'), fn: () => this.qTalkSully(e) });
    else if (S && S.on && !S.done && st && st.ev === 'work' && work) acts.push({ n: JOBS[M.work].n, fn: work });
    else acts.push({ n: Tr('Sohbet Et'), mt: 1, fn: () => this.sullyChat(e) });
    if (S && S.done && work && M.home && dist(e.x, e.y, M.home.call(this, S).x, M.home.call(this, S).y) < 300) acts.push({ n: JOBS[M.work].n, fn: work });
    const D = this.storyDef();
    if (D.mentorActions && S && S.on && !S.done) return D.mentorActions.call(this, e, S, acts) || acts;
    return acts;
  },
  /* yol arkadaşı: adım onunla konuşmayı bekliyorsa Konuş, bağlıysa İplerini Kes */
  kinActions(e) {
    const S = this.story, K = this.storyDef().kin, st = this.qStep();
    if (!S || !K) return [];
    if (S.kin && S.kin.tied) return [{ n: Tr('İplerini Kes'), hold: 0.8, fn: () => { S.kin = { x: e.x, y: e.y }; Audio_.play('rope'); this.qEvent('free', e); } }];
    if (this.storyTalking()) return [];   // konuşma sürerken etkileşim tuşu konuşmayı geçer
    if (S.on && !S.done && st && st.ev === 'talk' && st.who === 'kin' && !S.wait) return [{ n: Tr('Konuş'), fn: () => this.qTalkSully(e) }];
    return [{ n: Tr('Sohbet Et'), mt: 1, fn: () => {
      const x = this.sFmt(pick(S.done ? K.chatDone() : K.chatBusy()));
      UI.subtitle(K.short.call(this), x, 3.5); Bubbles.add(e, '', 3.5, true);
      e.ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    } }];
  },
  /* hikâyenin yerleştirdiği nesnelerin ve kişilerin eylemleri (tanımdaki propActions / npcActions) */
  storyPropActions(e) { const S = this.story, D = this.storyDef(); return S && S.on && !S.done && D.propActions ? D.propActions.call(this, e, S) || [] : []; },
  storyNpcActions(e) { const S = this.story, D = this.storyDef(); return S && S.on && !S.done && D.npcActions ? D.npcActions.call(this, e, S) : null; },
  /* taşınan yük için hikâyenin eylemleri (tanımdaki carryActions; ör. yaralıyı doktora teslim etmek) */
  storyCarryActions(e) { const S = this.story, D = this.storyDef(); return S && S.on && !S.done && D.carryActions ? D.carryActions.call(this, e, S) || [] : []; },
  /* posta arabasının hikâye için gidebildiği uzak kasaba */
  storyStageDest(t) { const S = this.story; return !!(S && S.on && !S.done && S.stageTo && S.stageTo === t.id); },
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
    if (D.rumorCamp !== false) {
      S.campKnown = true; this.storyApplyWorld();
      const cp = S.camp && this.world.pois.find(p => p.pid === S.camp.pid);
      if (cp) this.rumored.add(cp.id);
    }
    if (D.rumor) D.rumor.call(this, S);
    this.qEvent('rumor');
    return true;
  },

  /* uykunun bitiş saati: adım erken kalkmayı istiyorsa (ör. Sully baskın için şafaktan önce uyandırır), yoksa 07:00 */
  storyWakeHour() {
    const S = this.story, st = S && S.on && !S.done && !S.wait && this.qStep();
    return st && st.wake ? st.wake : 7;
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
    for (const e of [this.mentorEnt(), this.kinEnt()]) if (e) e.remove = true;
    if (S.wpSet) this.setWaypoint(null);
    UI.feed(Tr('Hikâyeyi bıraktın. Dünya seni bekliyor.'));
    this.questHud();
  },

  /* ---------------- görev rehberi ----------------
     Oyuncu hedefin ne olduğunu ve nasıl yapılacağını hep görebilsin:
     - HUD'da hedefin altında kısa bir "nasıl" satırı (tuşlar o anki cihaza göre; günlükte de yazar): adımın how'u
       (QUEST_HOW'daki bir tarifin adı ya da kendi işlevi), yoksa olay türünün tarifi, seçim adımında seçim, işaretli
       adımda işarete gitme, hiçbiri yoksa ipucunun ilk cümlesi.
     - Menülerde ve etkileşim isteminde adımı ilerleten seçenek parlar (qGoal): seçeneğin tetiklediği olay (qe) adımın
       olayıyla ve ok koşuluyla eşleşirse, ara menü (qn) o olaya götürüyorsa; ikisi de yoksa adı ipucundaki ya da
       tarifteki kalın bir yazıyla (<b>…</b>) aynıysa.
     - Oyuncu bir süre ilerleyemezse ipucu yeniden gösterilir (questNudge); işarete yaklaşmak ilerleme sayılır. */
  questHow(st, S) {
    if (!st) return '';
    S = S || this.story;
    try {
      if (typeof st.how === 'function') return st.how.call(this, S) || '';
      const f = QUEST_HOW[st.how] || (st.ev && (QUEST_HOW[st.ev] || QUEST_HOW.act)) || (st.choice && QUEST_HOW.choice) || (st.at && QUEST_HOW.travel);
      const h = f ? f.call(this, st, S) : '';
      return h || (st.hint ? qFirstSentence(st.hint.call(this, S)) : '');
    } catch (e) { return ''; }
  },
  /* adımın kalın yazıları (menü ve istem seçeneklerinin adları); dil değişene kadar saklanır.
     hintOnly: yalnızca ipucundakiler (tarifin kendisi bunlardan kurulurken) */
  qTerms(st, hintOnly) {
    const lang = I18N.lang, k = hintOnly ? 'h' : 'a';
    if (!st._qt || st._qt.lang !== lang) st._qt = { lang };
    if (st._qt[k]) return st._qt[k];
    let src = '';
    try { if (st.hint) src += st.hint.call(this, this.story); } catch (e) {}
    if (!hintOnly) try {
      if (typeof st.how === 'function') src += ' ' + st.how.call(this, this.story);
      else { const f = QUEST_HOW[st.how] || (st.ev && QUEST_HOW[st.ev]); if (f) src += ' ' + f.call(this, st, this.story); }
    } catch (e) {}
    const terms = [];
    for (const m of src.matchAll(/<b>([\s\S]*?)<\/b>/g)) { const t = qNorm(m[1]); if (t.length >= 2 && !terms.includes(t)) terms.push(t); }
    return (st._qt[k] = terms);
  },
  /* bu seçenek (menü öğesi ya da etkileşim eylemi: label/n, qe, qn) görevin şu anki adımını ilerletir mi */
  qGoal(o) {
    const S = this.story;
    if (!o || !S || !S.on || S.done || S.wait || this.cine) return false;
    const st = this.qStep();
    if (!st) return false;
    // olayı bilinen seçenek yalnızca olayıyla karar verir (ör. "4 Saat Uyu" adı "Uyu"yu içerse de "sabaha kadar" değildir)
    if (o.qe) { if (o.qe[0] !== st.ev) return false; try { return !st.ok || !!st.ok.call(this, o.qe[1], S); } catch (e) { return false; } }
    if (o.qn) return [].concat(o.qn).includes(st.ev);
    const L = qNorm(o.label !== undefined ? o.label : o.n);
    return !!L && this.qTerms(st).some(t => L === t || L.startsWith(t + ' ') || L.endsWith(' ' + t) || L.includes(' ' + t + ' '));
  },
  /* etkileşim isteminde görevi ilerleten eylemin sırası (-1: yok). İşaretli adımda yalnızca işaretin yakınındaki
     şeyler sayılır (ör. konuşulacak kişi; kasabadaki her "Konuş" değil) */
  qPromptGoal(it) {
    const S = this.story;
    if (!it || !it.actions || !S || !S.on || S.done || S.wait) return -1;
    const m = this.questMark();
    if (m && it.x !== undefined && dist(m.x, m.y, it.x, it.y) > 200) return -1;
    return it.actions.findIndex(a => this.qGoal(a));
  },
  /* görevi ilerleten seçeneği olan menünün başındaki hatırlatma */
  questBanner() {
    const S = this.story, st = this.qStep();
    let t = '';
    try { t = st ? st.t.call(this, S) : ''; } catch (e) {}
    return Tr`<b>Görev:</b> ${t} — parlayan seçeneği seç`;
  },
  /* takılan oyuncuya ipucu: adımda ilerleme olmadan 45 sn, sonra 75 sn'de bir (en çok dört kez) */
  questNudge(dt) {
    const S = this.story, st = this.qStep();
    if (!st || S.wait || this.cine || this.state !== 'play' || UI.isModal() || this.storyTalking()) return;
    const k = S.ch + '|' + S.st;
    const N = this._qNudge && this._qNudge.k === k ? this._qNudge : (this._qNudge = { k, t: 0, n: 0, best: Infinity });
    const m = this.questMark();
    if (m) { const d = dist(this.player.x, this.player.y, m.x, m.y); if (d < N.best - 40) { N.best = d; N.t = 0; } }
    N.t += dt;
    if (N.n >= 4 || N.t < (N.n ? 75 : 45)) return;
    N.t = 0; N.n++;
    let hint = '';
    try { hint = st.hint ? st.hint.call(this, S) : ''; } catch (e) {}
    UI.help(Tr`<b>Takıldın mı?</b> ${st.t.call(this, S)}<br>${hint || this.questHow(st, S)}`, 11);
    const el = document.getElementById('hud-quest');
    if (el) { el.classList.remove('hq-pulse'); void el.offsetWidth; el.classList.add('hq-pulse'); }
  },
  /* görev "bir şeyler ye" diyorsa hızlı kullanımda yenecek şey: pişmiş ve doyurucu olan önce, çiğ et asla
     (yoksa susuzken matara içilir, tokken hiçbir şey seçilmez, adım hiç bitmezdi) */
  questFood() {
    const S = this.story, st = S && S.on && !S.done && !S.wait && this.qStep();
    if (!st || st.ev !== 'eat') return null;
    const P = this.player, ok = (id) => { try { return !st.ok || st.ok.call(this, id, S); } catch (e) { return false; } };
    const ids = Object.keys(P.inv).filter(id => P.count(id) > 0 && ITEMS[id] && ITEMS[id].c === 'food' && !ITEMS[id].raw && !(ITEMS[id].e || {}).drunk && ok(id));
    ids.sort((a, b) => ((ITEMS[b].e || {}).hunger || 0) - ((ITEMS[a].e || {}).hunger || 0));
    return ids[0] || null;
  },

  /* ---------------- arayüz ---------------- */
  questHud() {
    const el = document.getElementById('hud-quest');
    if (!el) return;
    const S = this.story, c = S && S.on && !S.done && this.storyDef().chapters[S.ch], st = c && this.qStep();
    if (!c) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    // konuşma sürerken ya da adım biterken "…" yerine sıradaki hedef görünür; oyuncu beklemeden ona yönelebilir
    const pv = this.qPreview();
    const shown = pv ? pv.st : st, idx = pv ? pv.k : S.st, done = !pv && S.wait;
    const n = shown && shown.n > 1 ? ` <span class="hq-n">${pv ? 0 : S.n}/${shown.n}</span>` : '';
    let txt;
    try { txt = shown ? shown.t.call(this, S) + n : '…'; } catch (e) { txt = '…'; }
    // hedefin altında "nasıl": tuşlarla kısa tarif (cihaz değişince tuşlar da değişir)
    const how = shown && !done ? this.questHow(shown, S) : '';
    const key = S.ch + '|' + idx + '|' + S.n + '|' + done + '|' + txt + '|' + how;
    if (el._k === key) return;
    el._k = key;
    // yeni bir hedef: panel parlayarak kayıp gelir, kısa süre "Yeni Hedef" etiketi görünür (önizlemede bir kez)
    const sk = S.ch + '|' + idx, fresh = shown && !done && el._sk !== sk;
    if (fresh) el._sk = sk;
    // "nasıl" satırı · ile ayrılan parçalarından bölünür (kısa yol bir alt satıra iner, seçenek adı ikiye bölünmez)
    const howH = how ? Icons.iconize(how).split(' · ').map(s => `<span class="hq-hs">${s}</span>`).join(' · ') : '';
    el.innerHTML = `<div class="hq-t">${fresh ? `<span class="hq-new">${Tr`Yeni Hedef`}</span>` : ''}${Tr`Bölüm ${S.ch + 1}`} · ${c.t()}</div><div class="hq-o ${done ? 'done' : ''}"><i></i>${txt}</div>${how ? `<div class="hq-h">${howH}</div>` : ''}<div class="hq-d"></div>`;
    if (fresh) { el.classList.remove('hq-pulse'); void el.offsetWidth; el.classList.add('hq-pulse'); }
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
      if (i === S.ch && S.on && !S.done) h += `<ul>${c.steps.map((st, k) => { if (k < S.st) return `<li class="ok">${st.t.call(this, S)}</li>`; if (k !== S.st) return ''; const how = this.questHow(st, S); return `<li class="on">${st.t.call(this, S)}${how ? `<div class="qj-how"><b>${Tr`Nasıl:`}</b> ${how}</div>` : ''}</li>`; }).join('')}</ul>`;
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
   Görev rehberi: "nasıl yapılır" tarifleri. Adımın how'u buradaki bir tarifin adı ya da kendi işlevidir; yoksa
   olay türünün (ev) tarifi kullanılır. Tarifler tek satırlık, tuşları oyuncunun o anki cihazına göre gösterir;
   kalın yazılar (<b>…</b>) menüde ve etkileşim isteminde aynı adlı seçeneği parlatır. Kalın yazılar oyundaki
   seçeneklerin adlarıyla birebir aynı olmalı (çeviride de).
   ========================================================== */
const QK = (a) => Input.glyph(a);
const QUEST_HOW = {
  // olay türleri
  talk: () => Tr`Yanına git → ${QK('interact')} <b>Konuş</b>`,
  greet: () => Tr`Birine yaklaş → ${QK('interact')} basılı tut → <b>Selamla</b>`,
  enter: () => Tr`İşaretli binanın kapısından içeri yürü`,
  buy: () => Tr`Satıcıya ${QK('interact')} → <b>Alışveriş</b> → parlayan eşyayı al`,
  sell: () => Tr`Satıcıya ${QK('interact')} → <b>Alışveriş</b> → <b>Sat</b> sekmesi`,
  eat: () => Tr`${QK('satchel')} <b>Çanta</b> → yiyeceği seç → ${QK('confirm')} <b>Ye</b> · kısa yol: ${QK('quick')}`,
  fill: () => Tr`Kuyunun yanında ${QK('interact')} basılı tut → <b>Matarayı Doldur</b>`,
  whistle: () => Tr`${QK('whistle')} ile ıslık çal`,
  kill: () => Tr`${QK('wheel')} silahını seç → ${QK('aim')} nişan al → ${QK('fire')} ateş et`,
  skin: () => Tr`Avın yanında ${QK('interact')} basılı tut → <b>Derisini Yüz</b>`,
  work: () => Tr`İşverene ${QK('interact')} → parlayan işi seç → <b>Çalış</b>`,
  deposit: () => Tr`Bankada ${QK('interact')} → <b>Banka İşlemleri</b> → <b>Yatır</b>`,
  board: () => Tr`Şerifin masasında ${QK('interact')} → <b>Ödül İlanları</b>`,
  drink: () => Tr`Barmene ${QK('interact')} → <b>Bir Viski İç</b> ya da <b>Alışveriş</b>`,
  rumor: () => Tr`Görevliye ${QK('interact')} → <b>Söylenti Dinle</b>`,
  camp: () => Tr`Kasabanın dışında ${QK('camp')} basılı tut: kamp kur`,
  cook: () => Tr`Kamp ateşinde ${QK('interact')} <b>Kamp Menüsü</b> → <b>Pişir ve Üret</b> → parlayan tarif`,
  sleep: () => Tr`Yatağa ya da kamp ateşine ${QK('interact')} → <b>Uyu</b> → <b>Sabaha Kadar</b>`,
  mask: () => Tr`${QK('mask')} ile tak · ya da ${QK('satchel')} <b>Çanta</b> → <b>Bandana</b>`,
  reload: () => Tr`${QK('wheel')} tabancanı seç → ${QK('reload')} doldur`,
  brush: () => Tr`Atının yanında ${QK('interact')} basılı tut → <b>Fırçala</b>`,
  horse: () => Tr`Ahırda seyise ${QK('interact')} → <b>At Satın Al</b>`,
  free: () => Tr`${QK('crouch')} çömelerek yaklaş → ${QK('interact')} basılı tut → <b>İplerini Kes</b>`,
  deliver: () => Tr`${QK('interact')} omzuna al → atına yükle → şerifin masasında <b>Teslim Et</b>`,
  explore: () => Tr`Fener çantanda olsun → girişte ${QK('interact')} basılı tut → <b>Madene Gir</b>`,
  // başka olaylar: ipucundaki ilk kalın seçenek (Tapuyu Al, Evi Ara, Posta Çantasını Ara...)
  act(st) { const t = this.qTerms(st, true)[0], raw = t && qBold(st, this, t); return raw ? Tr`İşarete git → ${QK('interact')} → <b>${raw}</b>` : ''; },
  // koşullu (chk) adımlar
  travel: () => Tr`Haritadaki işarete git · ${QK('map')} Harita`,
  ride: () => Tr`Posta arabası, tren ya da atınla git · ${QK('map')} Harita`,
  train: () => Tr`İstasyonda gişeye ${QK('interact')} → <b>Tren Bileti Al</b> · ${QK('map')} Harita`,
  mount: () => Tr`Atına yaklaş → ${QK('interact')} <b>Bin</b> · uzaktaysa ${QK('whistle')} ıslık`,
  gallop: () => Tr`Atın üstünde ${QK('sprint')} basılı tut: dörtnala`,
  shoot: () => Tr`${QK('wheel')} silahını seç → ${QK('aim')} nişan al → ${QK('fire')} ateş et`,
  bow: () => Tr`${QK('wheel')} <b>Yay</b>'ı seç → ${QK('fire')} basılı tutup ger, bırakınca atar`,
  binoc: () => Tr`${QK('satchel')} <b>Çanta</b> → <b>Dürbün</b> → ${QK('confirm')} kullan, hedefe bak`,
  crouch: () => Tr`${QK('crouch')} ile çömel, yavaşça yaklaş`,
  subdue: () => Tr`Canlı için ${QK('wheel')} <b>Kement</b> → ${QK('fire')} at → ${QK('interact')} basılı tut: bağla`,
  lasso: () => Tr`${QK('wheel')} <b>Kement</b>'i seç → ${QK('aim')} nişan → ${QK('fire')} at`,
  carry: () => Tr`${QK('interact')} <b>Omzuna Al</b> → işarete götür → ${QK('interact')} <b>Yere Bırak</b>`,
  loadhorse: () => Tr`${QK('interact')} <b>Omzuna Al</b> → atının yanında <b>Atına Yükle</b>`,
  wear: () => Tr`${QK('satchel')} <b>Çanta</b> → <b>Alet & Giysi</b> → giysiyi seç → ${QK('confirm')} <b>Giy</b>`,
  tracks: () => Tr`${QK('crouch')} çömel, yerdeki izlerin üstünden yürü`,
  escape: () => Tr`Radardaki kırmızı alanın dışına çık, görünmeden bekle`,
  unseen: () => Tr`Kanun adamlarından uzak dur, kasabanın dışına çık`,
  roam: () => Tr`Atına bin, kamptan uzaklaşıp etrafta dolaş`,
  hunters: () => Tr`Avcılara seslen: ${QK('interact')} basılı tut → <b>Teslim Ol</b>, kısa bas → <b>Parayla Kurtul</b>; ya da çatış`,
  pickaxe: () => Tr`Kayanın yanında ${QK('interact')} basılı tut → <b>Kazmayla Kır</b>`,
  dynamite: () => Tr`${QK('wheel')} <b>Dinamit</b> → ${QK('aim')} nişan → ${QK('fire')} at, sonra uzaklaş`,
  wagon: () => Tr`Arabanın yanında ${QK('interact')} → <b>Arabayı Sür</b>`,
  wholesale: () => Tr`Arabayı mağaza kapısına sür → tezgâhta <b>Toptan Mal Al</b>`,
  choice: () => Tr`Açılan menüden yolunu seç`,
};
/* seçenek adlarını karşılaştırmak için: etiketler, ayraç içleri (fiyat, adet) ve noktalama atılır, küçük harf */
const qNorm = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[:;,.!?·→"“”'’&]/g, ' ').toLocaleLowerCase(I18N.lang === 'tr' ? 'tr' : 'en').replace(/\s+/g, ' ').trim();
/* ipucunun ilk cümlesi (tarifi olmayan adımda "nasıl" satırı) */
const qFirstSentence = (h) => { const s = String(h || '').trim(), m = s.match(/^[\s\S]*?[.!?](?=\s|$)/); return m ? m[0] : s; };
/* ipucundaki kalın yazının özgün hâli (büyük harfiyle) */
const qBold = (st, G0, t) => { let src = ''; try { src = st.hint ? st.hint.call(G0, G0.story) : ''; } catch (e) {} for (const m of src.matchAll(/<b>([\s\S]*?)<\/b>/g)) if (qNorm(m[1]) === t) return m[1].replace(/<[^>]*>/g, ''); return ''; };

/* ==========================================================
   Bölümler. Her adım: t (hedef yazısı), ev/n/ok ya da chk, at (işaret),
   wp (uzaksa rota), hint (ipucu), how (nasıl: QUEST_HOW tarifi ya da işlev),
   on (başlarken), say (Sully'ye konuşunca), talk (başlarken konuşma),
   after (bitince konuşma), cine (bitince sinematik)
   ========================================================== */
const STORY_SULLY = [
  /* 1 — Tanıdık Yüzler: Sully'den iş iste, selamlaş, mağazaya gir */
  {
    t: () => Tr('Tanıdık Yüzler'),
    start() { setTimeout(() => UI.help(Tr`Harlow ovalarında büyüdün. İki kurak yaz üst üste gelince borç birikti; banka ailenin toprağına el koydu, ailen de doğudaki akrabaların yanına gitti.<br>Sen kaldın. Babanın eski komşusu <b>Dunham Sully</b> kasabada; belki ona bir el lazımdır.`, 12), 600); },
    resume(S) { if (S.st >= 1) { const b = this.sBld('general'), p = this.sDoor(b); if (p) this.sullyGo(p.x, p.y); } },
    steps: [
      { t: () => Tr('Dunham Sully ile konuş'), ev: 'talk', at() { const e = this.sullyEnt(); return e || this.story.sully; },
        hint: () => Tr`Yaşlı adama yaklaş ve ${Input.glyph('interact')} ile <b>Konuş</b>.`,
        say: () => [
          ['S', Tr('Bak sen... {ad}! Banka kapınıza kilit vurduğundan beri kasabada yüzünü gören olmadı.')],
          ['P', Tr('Gösterecek yüzüm kalmamıştı, Sully.')],
          ['S', Tr('Saçma. Kuraklık kimseyi seçmedi; o yaz ovanın yarısı battı.')],
          ['P', Tr('İş arıyorum. Ne olursa.')],
          ['S', Tr('Çiftlikte bana bir el lazım. Yatak biraz gıcırdar, yemeği de ben pişiririm. Kararını ona göre ver.')],
          ['S', Tr('Ama önce kasabaya yüzünü göster; birkaç kişiye selam ver. Ben mağazanın önünde olurum.')],
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
        hint: () => Tr`${Input.glyph('satchel')} ile <b>Çanta</b>'yı aç, <b>Yiyecek</b> sekmesinde aldığın yiyeceği seç ve ${Input.glyph('confirm')} ile <b>Ye</b>. Kısa yol: ${Input.glyph('quick')} çantayı açmadan bir şeyler yer.`,
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
      { t: () => Tr('Atına bin'), how: 'mount', chk() { return this.player.riding && this.player.riding === this.horse; }, at() { return this.horse; },
        hint: () => Tr`Atına yaklaş ve ${Input.glyph('interact')} ile bin.`,
        done() { const R = this.story.ranch; this.sullyGo(R.x - 30, R.y + 10, true); } },
      { t: () => Tr('Sully\'nin peşinden çiftliğe git'), chk() { const R = this.story.ranch, P = this.player; return dist(P.x, P.y, R.x, R.y) < 150; }, at() { return this.story.ranch; }, wp: true,
        hint: () => Tr`Sully'nin ardından sür. ${Input.glyph('sprint')} ile hızlan, basılı tutarsan dörtnala gidersin. ${Input.glyph('map')} Harita'da rota görünür.`,
        talk: () => [['S', Tr('Arkamdan gel. Gerçi bu yolları benden iyi bilirsin; çatalda şaşırırsam sen düzeltirsin.')]],
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
  /* 4 — Kümesteki Çakallar: çakallar dalga dalga farklı yönlerden gelir (Sully fenerle yönü gösterir, tavuk sayacı);
     sabah sürünün izini sür (toynak izi, dışkı), rüzgârı karşına alarak yaklaş, tek atışla temiz vur, deri yüz */
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
    resume(S) { if (S.st === 0) this.storyCoyotes(S); if (S.st === 1 || S.st === 2) this.storyGame(S, { far: COY.HERD, trail: true }); },
    steps: [
      { t() { const S = this.story; return Tr`Çakalları kümesten uzaklaştır · dalga ${Math.max(1, Math.min(S.coyWave || 0, COY.WAVES.length))}/${COY.WAVES.length} · tavuk ${this.storyHens()}/${COY.HENS}`; },
        how: 'shoot', chk() { return this.storyCoyDone(); },
        tick(S, dt) { this.storyCoyCount(); this.storyCoyWave(S, dt); },
        at() { const R = this.story.ranch, C = { x: R.cx, y: R.cy + 70 }; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyCoy && !e.dead && !e.remove && !e.counted) { const d = dist(e.x, e.y, C.x, C.y); if (d < bd) { bd = d; best = e; } } return best || C; },
        hint: () => Tr`Çakallar dalga dalga, farklı yönlerden gelir; Sully fenerle gösterip seslenir. ${Input.glyph('aim')} ile nişan al, ${Input.glyph('fire')} ile ateş et. Tavukları vurma; kaç tavuk kurtarırsan Sully o kadar sevinir.`,
        done(S) { const n = this.storyHens(); S.hensSaved = n; if (n > 0) this.earn(n * COY.PAY, Tr('Kurtarılan tavuklar')); const m = this.mentorEnt(); if (m) m.lantern = false; S.flags.lantern = 0; },
        after(S) {
          const n = S.hensSaved || 0;
          return [n >= COY.HENS ? ['S', Tr('Bir tane bile kaptırmadık! Ben senin yaşında iki atışta bir tavuk vururdum.')]
            : n >= COY.HENS - 2 ? ['S', this.sFmt(Tr`${n} tavuk sağ. Fena değil; çakal da bir şey yemeli, derler.`)]
            : ['S', Tr('Kümes yarı yarıya boşaldı... Olsun, sen elinden geleni yaptın.')],
            ['S', Tr('Kiler de bomboş. Bu akşam çayırda geyik izi gördüm; izi takip edersen sürüyü bulursun.')],
            ['S', Tr('Rüzgâra dikkat et: kokunu alırlarsa kaçarlar. Rüzgârı karşına al, çömel, sabırlı ol.')]];
        } },
      { t: () => Tr('Sürünün izini sür'), how: 'tracks', n: COY.TRAIL,
        on(S) { this.storyGame(S, { far: COY.HERD, trail: true }); },
        chk() { const S = this.story, P = this.player, T = S.gtrail || []; const q = T[S.gti || 0]; if (q && dist(P.x, P.y, q.x, q.y) < 70) { S.gti = (S.gti || 0) + 1; Audio_.tone(520, 0.06, 'triangle', 0.04); } if (S.n !== (S.gti || 0)) { S.n = S.gti || 0; this.questHud(); } return (S.gti || 0) >= T.length; },
        at() { const S = this.story, T = S.gtrail || []; return T[Math.min(S.gti || 0, T.length - 1)] || S.ranch; },
        hint: () => Tr`Yerdeki toynak izlerini ve dışkıyı takip et; her iz bir sonrakini gösterir. ${Input.glyph('crouch')} ile çömelirsen daha az ses çıkarırsın.` },
      { t() { return this.story.game === 'pronghorn' ? Tr('Bir antilop avla') : this.story.game === 'turkey' ? Tr('Bir yaban hindisi avla') : Tr('Bir geyik avla'); }, ev: 'kill', ok(a, S) { return a.kind === 'animal' && a.type === S.game; },
        on(S) { this.storyGame(S, { far: COY.HERD, trail: true }); },
        at() { const P = this.player; let best = null, bd = 1e9; for (const e of this.ents) if (e.storyGame && !e.dead && !e.remove) { const d = dist(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } } return best; },
        how() { return Tr`Rüzgâr ${this.windFrom()} esiyor: rüzgârı karşına alarak yaklaş · ${QK('crouch')} çömel · tek atış = kusursuz post`; },
        hint: () => Tr`Rüzgâr kokunu hayvanlara taşırsa seni uzaktan fark edip kaçarlar: rüzgârı karşına alarak yaklaş. ${Input.glyph('crouch')} ile çömel; nişan alırken biraz beklersen elin titremez. Tek atışta temiz vurursan post kusursuz olur.` },
      { t: () => Tr('Hayvanın derisini yüz'), ev: 'skin', ok(a, S) { if (a.type !== S.game) return false; S.cleanShot = !!a.clean; return true; },
        hint: () => Tr`Avın yanında ${Input.glyph('interact')} basılı tut: <b>Derisini Yüz</b>. Büyük postlar omzuna alınır; atının yanında <b>eyere yükleyebilirsin</b>.` },
      { t: () => Tr('Çiftliğe dön, Sully ile konuş'), ev: 'talk', at() { return this.sullyEnt() || this.story.ranch; }, wp: true,
        say: (S) => [
          S && S.cleanShot ? ['S', Tr('Tek atışta, ha? Post da kusursuz. Kasap bunu görünce yüzü güler.')] : ['S', Tr('Post biraz delik deşik olmuş ama olsun; et de et.')],
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
          ['S', Tr('Ambarın çatısında iki delik var, samanlar hâlâ dışarıda, güney çitinin iki direği de kırık. Ne kadar iş, o kadar para; az ama dürüst.')],
        ] },
      // gerçek işler: çatı (merdivende basılı tut), saman (balyaları ambara taşı), çit (kırık direği yenile)
      { t: () => Tr('Sully\'nin çiftliğinde iş gör'), ev: 'chore', n: CHORE.N, reOn: true,
        on(S) { this.choreInit(S); },
        at() { return this.choreNext(this.story) || this.sullyEnt() || this.story.ranch; },
        how: () => Tr`Merdivende ${QK('interact')} basılı tut: <b>Çatıyı Onar</b> · balyayı <b>Omzuna Al</b>, ambarın kapısına bırak · kırık direkte <b>Direği Çak</b>`,
        hint: () => Tr`Ambarın önündeki merdivenlerden çatıyı onar (${Input.glyph('interact')} basılı tut: <b>Çatıyı Onar</b>), samanlığın yanındaki balyaları <b>Omzuna Al</b> ve ambarın kapısına bırak, güney çitindeki kırık direkleri yenile (<b>Direği Çak</b>). Her iş zaman alır ve yorar; bitirdiğin iş kadar para alırsın. Yeterince çalışınca Sully ile konuşup günü bitirebilirsin.`,
        done(S) { const n = S.n, pay = n * CHORE.PAY; if (pay > 0) this.earn(pay, 'Sully'); S.choresPaid = n; this.choreClear(S); },
        after(S) {
          const n = S.choresPaid || 0;
          return [n >= CHORE.N ? ['S', Tr('Hepsini bitirmişsin. Eline sağlık. Çatı on yıl daha dayanır... ya da bir kış.')] : ['S', Tr('Bu kadarı da iyi. Kalanını yarın ben hallederim, yaşlı da olsam.')],
            ['S', Tr('Kasabaya inelim. Şerifle bir kez daha konuşacağım; bu sefer yanımda biri olacak.')]];
        } },
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
        hint: () => Tr`Bankaya gir, veznedara ${Input.glyph('interact')} → <b>Banka İşlemleri</b> → <b>Yatır</b>. Bankadaki para ölsen de kaybolmaz ve faiz getirir.` },
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
        hint: () => Tr`Şerif ofisinde şerifin masasına ${Input.glyph('interact')} → <b>Ödül İlanları</b>. Buradan ödül avı da alabilirsin.`,
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
      ], after() { this.sSkipTo(20, 19); const b = this.sBld(['saloon', 'cantina']), p = this.sDoor(b, 22); if (b) this.story.sal = b.id; if (p) { const s = this.sSpot(p.x - 30, p.y + 10, 0, 30); this.sTeleport(s[0], s[1]); this.sullyGo(p.x + 16, p.y); } } };
    },
    steps: [
      { t: () => Tr('Saloona gir'), ev: 'enter', ok: (b) => b && (b.type === 'saloon' || b.type === 'cantina'), at() { return this.sDoor(this.sBld(['saloon', 'cantina']), 4); } },
      { t: () => Tr('Barda bir içki al'), ev: 'drink', at() { return this.sDoor(this.sBld(['saloon', 'cantina']), -20); },
        hint: () => Tr`Barmenle konuş: <b>Bir Viski İç</b> ya da <b>Alışveriş</b>'ten bir bira al. Fazla içersen sarhoş olursun.` },
      { t: () => Tr('Söylenti dinle'), ev: 'rumor', at() { return this.sDoor(this.sBld(['saloon', 'cantina']), -20); },
        hint: () => Tr`Barmenle konuş ve <b>Söylenti Dinle</b>. Birkaç kuruşa bildiklerini anlatır.`,
        after: () => [
          ['S', Tr('Köşedeki adam, ha? Jack\'in adamlarından biri demek.')],
          ['S', Tr('Barmen bildiğini pahalıya satar. Ya da adamın dilini kendin çözersin: bir iki kadeh, bir el kâğıt...')],
          ['S', Tr('Ya da sus, bekle. Sarhoş eninde sonunda evine döner.')],
        ] },
      // dört yol: barmene sor, sarhoşa içki ısmarla, onunla kâğıt oyna ya da çıkınca gizlice peşine takıl
      { t: () => Tr('Kızıl Jack\'in kampının yerini öğren'), ev: 'campInfo',
        at() { const e = this.drunkEnt(); return e && !e.remove ? e : this.sDoor(this.storySaloon(), -20); },
        how() { return this.drunkEnt() ? Tr`Barmene <b>Kampın Yerini Sor</b> · sarhoşa <b>İçki Ismarla</b> · onunla <b>Kâğıt Oyna</b> · ya da kalkınca gizlice peşine takıl` : Tr`Barmene ${QK('interact')} → <b>Kampın Yerini Sor</b>`; },
        hint: () => Tr`Dört yolun var: barmene <b>Kampın Yerini Sor</b> (pahalı); sarhoşa <b>İçki Ismarla</b> (üç kadehte çözülür); onunla <b>Kâğıt Oyna</b> ve bir el kazan; ya da bekle, saloondan çıkınca gizlice peşine takıl. Takip ederken arada mesafe bırak, arkasına baktığında görünme.`,
        after() {
          const P = this.player, S = this.story;
          if (!P.has('binoculars')) P.addItem('binoculars', 1, true);
          if (!P.has('bedroll')) P.addItem('bedroll', 1, true);
          P.addItem('raw_game', 2, true);
          return [
            S.campHow === 'follow' ? ['S', Tr('{kamp}, demek. Ardından gelmeseydin bunu öğrenemezdim; iyi iş çıkardın.')] : ['S', Tr('{kamp}... Biliyordum. Eski avcıların kamp yeri.')],
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
      { t: () => Tr('Ateşte et pişir'), ev: 'cook', ok: (r) => /^cook_/.test(r), skip() { return !this.player.has('raw_game') && !this.player.has('raw_big') && !this.player.has('raw_bird'); },
        hint: () => Tr`Kamp ateşinin yanında ${Input.glyph('interact')} ile <b>Kamp Menüsü</b>'nü aç → <b>Pişir ve Üret</b> → parlayan tarifi seç. Çiğ et pişince hem daha çok doyurur hem hasta etmez.` },
      { t: () => Tr('Sabaha kadar uyu'), ev: 'sleep', ok: (d) => d === 'camp', wake: RAID.WAKE,
        hint: () => Tr`Kamp ateşinin yanında ${Input.glyph('interact')} ile <b>Kamp Menüsü</b>'nü aç → <b>Uyu</b> → <b>Sabaha Kadar</b>. Sully seni şafak sökmeden uyandıracak. Uyurken oyun kaydedilir.` },
    ],
  },
  /* 10 — Kızıl Jack: şafaktan önce baskın. Gözetle, sessizce yaklaş (uyuyanları ve sırtı dönükleri gizlice etkisiz
     hâle getir), Jack'i yakala (arkadaşları dağılınca atına atlayıp kaçar: kovala, kementle düşür), tapuyu al, teslim
     et (kaçan haydut kaldıysa yolda pusu), tapuyu ver. Silah sesi duyan Sully gelip siperden destek atışı yapar */
  {
    t: () => Tr('Kızıl Jack'),
    cine() {
      return { sc: 'q_dawn', lines: [
        ['S', Tr('Dört kişi. Biri nöbette, o da uyukluyor.')],
        ['S', Tr('Kızıl olanı görüyor musun? Ateşin başında, ayakta.')],
        ['S', Tr('Onu canlı istiyorum, {ad}. Ölüsü bana tapuyu geri verir ama hesap vermez.')],
        ['P', Tr('Ya diğerleri?')],
        ['S', Tr('Diğerleri senin bileceğin iş. Ben atların yanındayım; silah sesi duyarsam gelirim.')],
      ], after() { const S = this.story, h = this.hour; if (!(h >= 3.5 && h < 5.2)) this.sSkipTo(RAID.WAKE); const a = Math.atan2(S.site.y - S.camp.y, S.site.x - S.camp.x), s = this.sSpot(S.camp.x + Math.cos(a) * 470, S.camp.y + Math.sin(a) * 470, 0, 80); this.sTeleport(s[0], s[1]); this.sullyGo(S.site.x + 20, S.site.y); } };
    },
    talk(S) { return S.flags.lasso ? [['S', Tr('Şu kementi de al. Bağlamayı bilirsin, değil mi? Bilmiyorsan öğrenirsin.')]] : []; },
    start(S) { const P = this.player; S.raid = 1; if (!P.weapons.has('lasso')) { P.giveWeapon('lasso', true); S.flags.lasso = 1; } if (!P.has('binoculars')) P.addItem('binoculars', 1, true); },
    steps: [
      { t: () => Tr('Kampı dürbünle gözetle'), how: 'binoc', chk() { const S = this.story, C = this.cam; return !!this.binoc && S.camp.x > C.ox && S.camp.x < C.ox + this.vw && S.camp.y > C.oy && S.camp.y < C.oy + this.vh; }, at() { return this.story.camp; },
        hint: () => Tr`${Input.glyph('satchel')} <b>Çanta</b> → <b>Alet & Giysi</b> sekmesi → <b>Dürbün</b> → ${Input.glyph('confirm')} ile kullan ve kampa doğru bak. Gördüğün kişiler etiketlenir.`,
        after: () => [['P', Tr('İkisi ateşin başında uyuyor, biri nöbette dolaşıyor. Jack ayakta, ateşe bakıyor.')], ['P', Tr('Arkasından yaklaşabilirsem...')]] },
      { t: () => Tr('Kampa sessizce yaklaş'), how: 'crouch', chk() { const S = this.story, P = this.player; return dist(P.x, P.y, S.camp.x, S.camp.y) < 300; }, at() { return this.story.camp; },
        hint: () => Tr`${Input.glyph('crouch')} ile çömel: daha az ses çıkarır, daha geç fark edilirsin. Atını geride bırak. Uyuyanın ya da sırtı dönük birinin yanına çömelerek sokulursan ${Input.glyph('interact')} basılı tutarak <b>Bayılt</b> ya da <b>Sessizce Bağla</b>.` },
      { t() { const j = this.jackEnt(); return j && j.fleeing ? Tr('Kaçan Jack\'i yakala') : j && j.cornered ? Tr('Jack\'i saklandığı yerde yakala') : Tr('Kızıl Jack\'i etkisiz hâle getir'); },
        how() { const j = this.jackEnt(); return j && j.fleeing && j.mounted ? QUEST_HOW.lasso.call(this) : Tr`${QK('crouch')} çömel, arkasından sokul → ${QK('interact')} basılı tut: <b>Bayılt</b> · ya da ${QK('wheel')} <b>Kement</b>`; },
        chk() { const j = this.jackEnt(); return !!(j && (j.dead || j.state === 'tied' || j.state === 'downed')); }, at() { return this.jackEnt() || this.story.camp; },
        hint: () => Tr`Jack'i canlı istiyorsan arkasından çömelerek sokulup <b>Bayılt</b>, ya da <b>kementi</b> seç (${Input.glyph('wheel')}), ${Input.glyph('fire')} ile at, yaklaşıp ${Input.glyph('interact')} basılı tutarak bağla. Arkadaşları dağılınca atına atlayıp kaçar. Nişan alırken ${Input.glyph('deadeye')} <b>Odak</b> zamanı yavaşlatır.`,
        done() { const j = this.jackEnt(), S = this.story; S.alive = !!(j && !j.dead); if (j) { j.fleeing = false; j.cornered = false; } } },
      { t: () => Tr('Tapuyu Jack\'in üstünden al'), ev: 'deed', at() { return this.jackEnt(); }, skip() { return this.story.deed; }, chk() { return this.story.deed; },
        hint: () => Tr`Jack'in yanında ${Input.glyph('interact')} basılı tut: <b>Tapuyu Al</b>.` },
      { t() { return this.story.alive ? Tr('Jack\'i şerife canlı teslim et') : Tr('Jack\'in cesedini şerife götür'); }, ev: 'deliver', ok: (e) => e && e.quest === 'rival', at() { const j = this.jackEnt(), P = this.player; if (j && j !== P.carry && !(this.horse && this.horse.load && this.horse.load.includes(j))) return j; return this.sDoor(this.sBld('sheriff'), 4); }, wp: true,
        on(S) {
          this.storyRaidEnd(S);
          const p = this.sDoor(this.sBld('sheriff'), 22); if (p) this.sullyGo(p.x - 14, p.y);
          // tapu alınmadan teslim edildiyse bu adım zaten olmuştur
          if (S.jack === 'delivered') { const st = this.qStep(); setTimeout(() => { if (this.qStep() === st && !S.wait) this.qDone(); }, 60); }
        },
        // kaçan haydut kaldıysa Jack'i kurtarmak için dönüş yolunda pusu
        tick(S) { this.storyAmbushTick(S); },
        hint: () => Tr`Jack'in yanında ${Input.glyph('interact')} ile <b>Omzuna Al</b>, atının yanında <b>Atına Yükle</b>. Şerif ofisinde şerifin masasına ${Input.glyph('interact')} → <b>Teslim Et</b>.`,
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
          ['P', Tr('Belki bir gün yine kendi toprağım olur.')],
          ['S', Tr('Olur. Yalnız tapunu benim gibi cebinde gezdirme.')],
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
    intro: () => Tr`Banka ailenin toprağına el koydu; sen ovada kaldın. Babanın eski komşusu, yaşlı çiftçi Dunham Sully'nin de tapusu çalınmış; Sully'ye yardım et.`,
    outro: () => Tr`Hikâye tamamlandı. Sully'nin çiftliği seni bekliyor.`,
    welcome: () => Tr('Harlow\'dasın. Babanın eski komşusu, yaşlı çiftçi <b>Dunham Sully</b> kasabada; ondan iş iste. Sağ üstteki hedefi izle.'),
    // açılış sinematiği: aile doğuya gider, oyuncu ovada kalır
    speakers: { F: () => Tr('Baban') },
    opening: () => [
      ['F', Tr('Son kez soruyorum, {ad}. Doğuda akrabaların yanında hepimize iş var.')],
      ['P', Tr('Ben bu ovadan başka yer bilmem, baba.')],
      ['F', Tr('Bilirim. Ben de bilmezdim.')],
      ['F', Tr('Kasabada Sully\'ye uğra. Seni sorar.')],
    ],
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
      // baskında silah sesini duyunca gelip siperden destek atışı yapar (Jack'e asla)
      support: true,
    },
    rival: {
      name: () => Tr('Kızıl Jack'), look: JACK_LOOK, hp: 150, weapon: 'repeater', money: 2.5, fromCh: 9, reward: [25, 12],
      take: { n: () => Tr('Tapuyu Al'), k: () => Tr('Tapu'), msg: () => Tr('Sully\'nin tapusu artık sende.') },
      // teslim olmaz: arkadaşları dağılınca ya da canı azalınca kampın kenarındaki atına atlayıp kaçar
      flee: true, horse: { col: '#7a3a1e', mane: '#1a1410', blanket: '#8a2a1a' },
      // geç yatar (01:00), şafaktan önce kalkar (04:00) ve ateşin başında ayakta bekler
      camp: { sleep: 1, wake: 4, stand: true },
    },
    // kaçan haydutları say (dönüş pususu için); Jack kaçınca Sully seslenir
    onEvent(type, d, S) {
      if (type === 'fled' && d && !d.fledN && S.camp && S.camp.pid >= 0 && d.camp === S.camp.pid) { d.fledN = 1; S.fled = (S.fled || 0) + 1; }
      if (type === 'rivalFlee' && !S.jFleeSaid) { S.jFleeSaid = 1; this.qSay([['S', Tr('Jack kaçıyor! Atına bin, peşine düş! Buradakileri ben tutarım!')]]); }
      // sarhoşla kâğıt oynayıp bir el kazandın: konuşur (js/poker.js)
      if (type === 'pokerWin' && d === 'drunk') this.drunkTalks(S, 'poker');
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
    // söylenti kampı vermez: köşedeki sarhoş haydudu gösterir; kampın yeri sonraki adımda dört yoldan öğrenilir
    rumorCamp: false,
    rumor(S) {
      UI.info(Tr('Barmen Fısıldıyor'), `<p class="quote">${this.sFmt(Tr('"Kızıl Jack mi? Sesini alçalt... Köşede kafayı çeken adamı görüyor musun? Jack\'in adamlarından. Her akşam burada içer, sonra atına binip kampına döner."'))}</p><p class="quote">${Tr('"Kampın yeri mi? Benim hafızam paraya göre çalışır. Bir dolara hatırlarım. Ya da onun dilini kendin çöz."')}</p>`);
    },
    npcActions(e, S) { return e.storyNpc === 'drunk' ? this.drunkActions(e, S) : null; },
    buildingActions(b, S) { return this.drunkBarActions(b, S); },
    propActions(e, S) { return this.choreActs(e, S); },
    // çiftlik işlerinde yeterince çalışınca günü bitirmek
    mentorActions(e, S, acts) { return this.choreMentorActs(e, S, acts); },
    tick(S, dt) { this.drunkTick(S, dt); this.choreTick(S, dt); this.storyTrailTick(S, dt); },
    finish(S) {
      const P = this.player;
      this.earn(S.alive ? 10 : 6, Tr('Sully\'nin teşekkürü'));
      if (!P.weapons.has('repeater')) { P.giveWeapon('repeater'); P.ammo.repeater = Math.min(AMMO.repeater.max, (P.ammo.repeater || 0) + 24); UI.feed(Tr`Sully'nin eski tüfeği artık senin: ${WEAPONS.repeater.n}`); }
      this.addHonor(5);
      this.sullyGo(S.ranch.x + 6, S.ranch.y - 4);
    },
    epilogue: () => Tr`Hikâye bitti ama hayat sürüyor. Artık ne yapacağın sana kalmış: avlan, çalış, ev kur, âşık ol ya da kanunun öbür yanına geç. <b>Hedefin hâlâ itibar sahibi ve zengin biri olmak.</b> Sully'nin çiftliğinin kapısı sana hep açık.`,
    chapters: STORY_SULLY,
  },
};
/* Geçmiş → hikâye. Çiftçi Çocuğu Sully'nin hikâyesini oynar; öteki geçmişleri
   story_*.js dosyaları ekler. Hikâye kimliği olmayan eski kayıtlar Sully'yle sürer (storyDef). */
const STORY_FOR_BG = { farm: 'sully' };

/* Bölüm yardımcıları (Story'ye eklenir) */
Object.assign(Story, {
  /* kasabanın en yakın kuyusu ya da yalağı */
  storyWell() {
    const S = this.story, t = this.sTown(), W = this.world, P = this.player;
    if (S.well) return S.well;
    let best = null, bd = 1e9;
    for (let ty = Math.floor((t.cy - 600) / TS); ty < (t.cy + 600) / TS; ty++) for (let tx = Math.floor((t.cx - 600) / TS); tx < (t.cx + 600) / TS; tx++) {
      const o = W.obj[ty * WW + tx];
      if (o !== O.WELL && o !== O.PUMP && o !== O.TROUGH && o !== O.FOUNTAIN) continue;
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
  /* çakallar: kümesteki tavuklar (ölenler geri gelmez) ve dalgalar. Yüklemede sürmekte olan dalga baştan gelir */
  storyCoyotes(S) {
    const R = S.ranch, C = { x: R.cx, y: R.cy + 70 };
    for (const e of this.ents) if (e.storyCoy || e.storyHen) e.remove = true;
    if (S.coyWave === undefined) S.coyGone = 0;   // dalgasız eski kayıt: sayaç baştan
    S.coyGone = S.coyGone || 0; S.hensLost = S.hensLost || 0;
    // yarıda kalmış dalga: o dalganın çakalları yeniden gelir (sayaç dalga başına döner)
    const done = COY.WAVES.slice(0, S.coyWave || 0).reduce((a, b) => a + b, 0);
    if ((S.coyWave || 0) > 0 && S.coyGone < done) { S.coyWave--; S.coyGone = COY.WAVES.slice(0, S.coyWave).reduce((a, b) => a + b, 0); }
    S.coyWave = S.coyWave || 0; S.coyT = COY.FIRST;
    if (!S.coyDirs) { const d = [0, 1, 2, 3]; for (let k = d.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [d[k], d[j]] = [d[j], d[k]]; } S.coyDirs = d; }
    for (let k = 0; k < COY.HENS - S.hensLost; k++) {
      const s = this.sSpot(C.x + rnd(-60, 60), C.y + rnd(-30, 30), 0, 40);
      const h = new Animal(s[0], s[1], 'chicken'); h.home = { x: C.x, y: C.y, r: 60 }; h.storyHen = true; h.keep = true; this.addEnt(h);
    }
  },
  /* ölen tavuk (çakal ya da yanlışlıkla sen) bir kez sayılır */
  storyHenLost(h) { const S = this.story; if (!S || h.lostN) return; h.lostN = true; S.hensLost = Math.min(COY.HENS, (S.hensLost || 0) + 1); },
  /* sağ kalan tavuklar */
  storyHens() { const S = this.story; return Math.max(0, COY.HENS - ((S && S.hensLost) || 0)); },
  /* dalganın yönü: kümesin kuzeyi (ambarın arkası), doğusu (tarlanın ucu), güneyi (yol), batısı (evin arkası) */
  storyCoyDir(k) {
    return [
      { v: [0, -1], call: () => Tr('Ambarın arkasından geliyorlar!') },
      { v: [1, 0], call: () => Tr('Tarlanın ucundan, doğudan!') },
      { v: [0, 1], call: () => Tr('Yol tarafından, güneyden!') },
      { v: [-1, 0], call: () => Tr('Evin arkasından! Batıdan!') },
    ][k];
  },
  /* her 0,25 sn: önceki dalga dağılınca kısa bir aradan sonra sıradaki dalga gelir; Sully fenerle o yöne geçip seslenir */
  storyCoyWave(S, dt) {
    if ((S.coyWave || 0) >= COY.WAVES.length) return;
    if (this.ents.some(e => e.storyCoy && !e.dead && !e.remove && !e.counted)) return;
    if ((S.coyT = (S.coyT === undefined ? COY.GAP : S.coyT) - dt) > 0) return;
    const R = S.ranch, C = { x: R.cx, y: R.cy + 70 }, D = this.storyCoyDir(S.coyDirs[S.coyWave % S.coyDirs.length]), n = COY.WAVES[S.coyWave];
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(D.v[1], D.v[0]) + (k - (n - 1) / 2) * 0.35, s = this.sSpot(C.x + Math.cos(a) * COY.FROM, C.y + Math.sin(a) * COY.FROM, 0, 60);
      const c = new Animal(s[0], s[1], 'coyote'); c.storyCoy = true; c.keep = true; c.home = { x: C.x, y: C.y, r: 120 }; this.addEnt(c);
    }
    S.coyWave++; S.coyT = COY.GAP;
    // Sully kümesle dalganın arasına geçer, fenerini kaldırır ve seslenir
    const sp = this.sSpot(C.x + D.v[0] * COY.SULLY, C.y + D.v[1] * COY.SULLY, 0, 30);
    S.sully = { x: sp[0], y: sp[1], ang: Math.atan2(D.v[1], D.v[0]) };
    S.flags.lantern = 1;
    const m = this.mentorEnt(); if (m) m.lantern = true;
    this.qSay([['S', D.call()]]);
  },
  /* bütün dalgalar geldi ve sahada çakal kalmadı (sayılmadan dünyadan kalkan çakal, ör. öldüğü an omza alınan leş, adımı
     kilitlemez) */
  storyCoyDone() { const S = this.story; return (S.coyWave || 0) >= COY.WAVES.length && !this.ents.some(e => e.storyCoy && !e.dead && !e.remove && !e.counted); },
  /* vurulan, kaçan ya da kaybolan çakallar */
  storyCoyCount() {
    const S = this.story, R = S.ranch;
    for (const e of this.ents) if (e.storyHen && e.dead) this.storyHenLost(e);
    let gone = S.coyGone || 0;
    for (const e of this.ents) if (e.storyCoy && !e.counted && (e.dead || e.remove || dist(e.x, e.y, R.cx, R.cy) > 650)) { e.counted = true; e.keep = false; gone++; }
    S.coyGone = Math.min(COY.WAVES.reduce((a, b) => a + b, 0), gone);
    return S.coyGone;
  },
  /* av: çiftliğin (kampın) doğasına uygun bir sürü. far: çiftliğe uzaklığı; trail: çiftlikten sürüye giden iz (toynak izi
     ve dışkı; Sully, Bölüm 4) */
  storyGame(S, opt = {}) {
    const R = S.ranch, b = S.biome || this.storyBiome(R.cx, R.cy), far = opt.far || 520;
    S.game = S.game || (b === 'DESERT' || b === 'REDROCK' || b === 'DRY' ? 'pronghorn' : 'deer');
    if (!S.herd) {
      // sürünün yeri: çiftlikten düz yürünerek varılabilen açık bir düzlük; kayalık yükseltinin üstü ya da arkası olmaz
      let cx = 0, cy = 0, ok = false;
      for (let k = 0; k < 32 && !ok; k++) {
        const a = rnd(0, TAU), r = k < 20 ? far : k < 26 ? Math.min(far, 700) : Math.min(far, 380), s = this.findSpawnPos(R.cx + Math.cos(a) * r, R.cy + Math.sin(a) * r, 0, 60);
        if (s && !this.world.townAt(s[0], s[1], 20) && !this.world.blocked(s[0], s[1], 26) && this.storyReach([R.x, R.y], s)) { cx = s[0]; cy = s[1]; ok = true; }
      }
      if (!ok) { const a = rnd(0, TAU); cx = R.cx + Math.cos(a) * 520; cy = R.cy + Math.sin(a) * 520; }
      S.herd = { x: Math.round(cx), y: Math.round(cy) };
    }
    if (opt.trail && !S.gtrail) {
      // iz: çiftliğin kapısından sürünün 110 px önüne, yolda biraz sapmalı
      const H = S.herd, T = [], n = COY.TRAIL, a0 = Math.atan2(H.y - R.y, H.x - R.x), L = Math.max(200, dist(R.x, R.y, H.x, H.y) - 110);
      for (let k = 1; k <= n; k++) {
        const f = k / n, wob = k < n ? Math.sin(k * 1.9) * 40 : 0, x = R.x + Math.cos(a0) * L * f - Math.sin(a0) * wob, y = R.y + Math.sin(a0) * L * f + Math.cos(a0) * wob;
        const s = this.findSpawnPos(x, y, 0, 40) || [x, y];
        T.push({ x: Math.round(s[0]), y: Math.round(s[1]) });
      }
      S.gtrail = T; S.gti = 0;
    }
    if (this.ents.some(e => e.storyGame && !e.dead && !e.remove)) return;
    const H = S.herd;
    let lead = null;
    for (let k = 0; k < 3; k++) {
      let s = this.sSpot(H.x + rnd(-30, 30), H.y + rnd(-30, 30), 0, 60);
      if (!TownPath.walkable([H.x, H.y], s, 5)) s = [H.x + k * 8, H.y];
      const g = new Animal(s[0], s[1], S.game); g.storyGame = true; g.keep = true; g.home = { x: H.x, y: H.y, r: 90 };
      if (lead) g.leader = lead; else lead = g;
      this.addEnt(g);
    }
  },
  /* rüzgârın estiği yön (nereden): sekiz yön */
  windFrom() {
    const a = FX.wind.a + Math.PI, k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return [Tr('doğudan'), Tr('güneydoğudan'), Tr('güneyden'), Tr('güneybatıdan'), Tr('batıdan'), Tr('kuzeybatıdan'), Tr('kuzeyden'), Tr('kuzeydoğudan')][k];
  },
  /* iz yerlerindeki nesneler (D.tick; iz adımında 0,25 sn'de bir, dışında saniyede bir): sıradaki iz ve ötesi, yakındaysa */
  storyTrailTick(S, dt) {
    const on = S.ch === 3 && S.st === 1 && S.gtrail, want = new Map(), P = this.player;
    if ((this._gtT = (this._gtT || 0) - dt) > 0) return;
    this._gtT = on ? 0.25 : 1;
    if (on) S.gtrail.forEach((q, i) => {
      if (i < (S.gti || 0) - 1 || dist2(q.x, q.y, P.x, P.y) > 700 * 700) return;
      const nx = S.gtrail[i + 1] || S.herd;
      want.set('gtrk' + i, { x: q.x, y: q.y, t: i % 3 === 2 ? 'dung' : 'paw', ang: Math.atan2(nx.y - q.y, nx.x - q.x) });
    });
    for (const e of this.ents) if (e.gtKey && !e.remove && !want.has(e.gtKey)) e.remove = true;
    for (const [k, w] of want) {
      if (this.ents.some(e => e.gtKey === k && !e.remove)) continue;
      const e = new Prop(w.x, w.y, w.t, { ang: w.ang }); e.gtKey = k; e.keep = true;
      this.addEnt(e);
    }
  },
  /* a'dan b'ye yürünerek varılabilir mi: önce düz çizgi, olmazsa iki noktayı kapsayan küçük bir ızgarada A* */
  storyReach(a, b) {
    if (TownPath.walkable(a, b, 6)) return true;
    const x0 = Math.floor(Math.min(a[0], b[0]) / TS) - 6, y0 = Math.floor(Math.min(a[1], b[1]) / TS) - 6;
    const area = { x: x0, y: y0, w: Math.ceil(Math.max(a[0], b[0]) / TS) - x0 + 6, h: Math.ceil(Math.max(a[1], b[1]) / TS) - y0 + 6 };
    return !!TownPath.find(area, a[0], a[1], b[0], b[1]);
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
    if (d < 7) { hen.hurt(99, 'coyote'); a.prey = null; this.storyHenLost(hen); if (dist(a.x, a.y, this.player.x, this.player.y) < 400) UI.feed(Tr`Çakal bir tavuğu kaptı! (${this.storyHens()}/${COY.HENS} tavuk kaldı)`, 'warn'); }
    return true;
  },
});

/* ==========================================================
   Baskın (Sully, Bölüm 10). Hedef kişi (rival.flee) teslim olmaz: arkadaşları dağılınca (ölen, bağlanan, teslim
   olan, kaçan) ya da canı azalınca kampın kenarında bağlı atına koşar, atlayıp kamptan uzağa, saklanacağı yere yolları
   izleyerek kaçar. İlk saniyeler hızlıdır, at yoruldukça yavaşlar; oyuncu çok gerideyse ağırdan alır. Kementle (ya da
   vurularak) attan düşer. Atı yoksa yaya kaçar. Oyuncu iyice geride kalıp onu göremezse ya da saklanacağı yere
   varırsa attan iner ve orada bekler: köşeye sıkışmıştır, bir daha kaçmaz. Hiçbir durumda silinmez.
   Akıl hocası (mentor.support) kampta çatışma başlayınca kampın kasaba yanındaki açık bir yere gelir, attan iner ve
   kamptakilere ateş eder; hedef kişiye asla, arada sen ya da atın varken de etmez. Vurduğu haydut ona döner.
   Dönüş pususu: kaçan haydut kaldıysa, hedef kişiyi canlı götürürken kamptan ve kasabadan uzakta atlı haydutlar arkadan
   yetişir (bir kez).
   ========================================================== */
Object.assign(Story, {
  /* Hedef kişinin atı: kampın kasabaya bakmayan yanında bağlı. Öldüyse ya da çalındıysa bir daha kurulmaz */
  storyRivalHorse(S, R, j) {
    let h = this.ents.find(e => e.jackHorse && !e.remove);
    if (h && (h.dead || h.rider || h.owner === 'player')) { S.jHorse = 'gone'; h.jackHorse = false; h.hitch = false; return null; }
    // Jack yakalandıysa, kaçtıysa ya da öldüyse at artık kamp atı değildir (uzaklaşınca temizlenir)
    if (S.jack !== 'free' || S.jHide || j.mounted || j.fleeing) { if (h && !j.fleeing) { h.jackHorse = false; h.hitch = false; } return null; }
    const P = this.player, C = S.camp;
    if (h) { if (dist2(h.x, h.y, P.x, P.y) > 1300 * 1300) h.remove = true; return h; }
    if (S.jHorse === 'gone' || dist(P.x, P.y, C.x, C.y) > 900) return null;
    const a = Math.atan2(C.y - S.site.y, C.x - S.site.x);
    const s = this.findSpawnPos(C.x + Math.cos(a) * RAID.HORSE_R, C.y + Math.sin(a) * RAID.HORSE_R, 0, 40) || this.sSpot(C.x + 60, C.y + 30, 0, 50);
    h = new Horse(s[0], s[1], 'mustang', { owner: 'npc', name: Tr('Jack\'in Atı'), look: Object.assign({}, R.horse) });
    h.hitch = true; h.jackHorse = true; h.ang = a + Math.PI / 2;
    this.addEnt(h);
    return h;
  },
  /* NpcMorale'den: hedef kişinin kırılma anı. true: bu karenin işi yapıldı */
  rivalBreak(e, dt, P) {
    const S = this.story, R = S && S.on && !S.done && this.storyDef().rival;
    if (!R || !R.flee || e.cornered) return false;   // kaçışı olmayan ya da köşeye sıkışan sonuna dek çatışır
    if (e.fleeing) return this.rivalFlee(e, dt, S);
    let mates = 0;
    for (const o of this.ents) if (o !== e && o.kind === 'npc' && e.camp && o.camp === e.camp && !o.dead && !o.remove && !o.bound && o.state !== 'surrender' && !o.fleeing) mates++;
    if (mates > 0 && e.hp > e.maxHp * RAID.FLEE_HP) return false;
    e.fleeing = 'horse'; e.cov = null; e.nav = null; e.rr = null; e.lookAt = null; e.horseT = 0; e.rideT = 0;
    S.jFlee = 1;
    e.say(pick([Tr('Hepiniz işe yaramazsınız! Bu iş burada bitmez!'), Tr('Beni canlı alamazsın!'), Tr('Kızıl Jack kimseye teslim olmaz!')]), 2.5);
    this.qEvent('rivalFlee', e);
    return this.rivalFlee(e, dt, S);
  },
  rivalFlee(e, dt, S) {
    const P = this.player;
    e.cov = null; e.lookAt = null; e.aggro = true; e.retreat = false;
    if (!e.mounted) {
      // binecek at: kendi atı ya da yakında binicisiz bir haydut atı (kementle düşürülünce at olduğu yerde kalır)
      let h = e.fleeHorse;
      if (!h || h.dead || h.remove || h.rider || h.owner !== 'npc' || dist2(h.x, h.y, e.x, e.y) > 260 * 260) {
        h = null; let bd = 220 * 220;
        for (const o of this.ents) if (o.kind === 'horse' && !o.dead && !o.remove && !o.rider && o.owner === 'npc') { const d2 = dist2(o.x, o.y, e.x, e.y); if (d2 < bd) { bd = d2; h = o; } }
        e.fleeHorse = h;
      }
      if (h && (e.horseT = (e.horseT || 0) + dt) < 12) {
        // atın gövdesi uzun: yanına (eyerin hizasına) gelince biner
        if (dist2(e.x, e.y, h.x, h.y) > 20 * 20) {
          if (this.navStep(e, h.x, h.y, dt, 84, { near: 16 }) === 'fail') { e.ang = turnTo(e.ang, Math.atan2(h.y - e.y, h.x - e.x), dt * 6); e.walk(dt, 84); }
          return true;
        }
        // atına atladı: yanından eyere sıçrar (js/juice.js hop), sıçrama bitince kaçar
        const sx = e.x, sy = e.y;
        e.mounted = { col: h.look.col, mane: h.look.mane, blanket: h.look.blanket || '#5a4a3a' };
        e.ang = h.ang; e.hAng = h.ang; h.remove = true; e.fleeHorse = null; e.horseT = 0; e.rideT = 0; e.rr = null; e.fleeing = 'ride';
        e.x = h.x; e.y = h.y;
        Juice.hop(e, true, { sx, sy, hx: h.x, hy: h.y, ha: h.ang });
        if (!S.jHideTo) S.jHideTo = this.rivalHideSpot(S);
        Audio_.neigh();
        if (dist2(e.x, e.y, P.x, P.y) < 700 * 700) {
          UI.feed(Tr`${e.name} atına atladı, kaçıyor!`, 'warn');
          this.hintOnce('rivalRide', Tr`Atına bin (uzaktaysa ${Input.glyph('whistle')} ıslık çal) ve peşine düş. ${Input.glyph('wheel')} <b>Kement</b>'i seç, yaklaşınca ${Input.glyph('fire')} ile at: attan düşer. Vurursan da düşer ama ölebilir.`, 10);
        }
        return true;
      }
      // binecek at yok: yaya kaçar (silinmez)
      e.fleeing = 'foot';
      this.fleeStep(e, P.x, P.y, dt, 84);
      this.rivalLost(e, S);
      return true;
    }
    // atlı: saklanacağı yere yolları izleyerek
    const g = S.jHideTo || (S.jHideTo = this.rivalHideSpot(S));
    e.rideT = (e.rideT || 0) + dt;
    let sp = e.rideT < 14 ? RAID.RIDE[0] : e.rideT < 24 ? RAID.RIDE[1] : RAID.RIDE[2];
    if (dist2(e.x, e.y, P.x, P.y) > RAID.SLOW * RAID.SLOW) sp *= 0.8;   // oyuncu çok gerideyse ağırdan alır
    this.mentorFollow(e, { x: g.x, y: g.y, ride: true }, dt, sp);
    if (dist2(e.x, e.y, g.x, g.y) < 30 * 30) this.rivalHide(e, S, false);
    else this.rivalLost(e, S);
    return true;
  },
  /* oyuncu iyice geride kalıp onu göremiyorsa saklanacağı yere varır */
  rivalLost(e, S) {
    const P = this.player;
    if (dist2(e.x, e.y, P.x, P.y) < RAID.LOSE * RAID.LOSE || this.onScreen(e.x, e.y, 60)) return false;
    this.rivalHide(e, S, true);
    return true;
  },
  /* Saklandığı yer: attan iner, orada bekler; köşeye sıkışmıştır (bir daha kaçmaz), kampla ilgisi kalmaz */
  rivalHide(e, S, jump) {
    const g = S.jHideTo || (S.jHideTo = this.rivalHideSpot(S));
    if (jump) { e.x = g.x; e.y = g.y; }
    if (e.mounted) e.alight();
    e.fleeing = false; e.cornered = true; e.camp = null; e.campSched = null; e.home = { x: g.x, y: g.y, r: 40 };
    e.aggro = false; e.awState = null; e.aw = 0; e.lkp = null; e.search = null; e.sees = false; e.nav = null; e.rr = null; e.alertUntil = this.t + 600;
    S.jHide = { x: Math.round(g.x), y: Math.round(g.y) };
    if (jump) UI.toast(Tr('Jack İzini Kaybettirdi'), Tr('Ama nereye gittiği belli: saklandığı yer haritanda işaretli.'), 'quest');
  },
  /* saklanacağı yer: kamptan kasabanın ters yönünde, kasabalardan uzak açık bir yer */
  rivalHideSpot(S) {
    const C = S.camp, T = this.sTown(), W = this.world;
    const away = T ? Math.atan2(C.y - T.cy, C.x - T.cx) : Math.random() * TAU;
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, 2, -2]) for (const r of [RAID.HIDE[0], RAID.HIDE[1], 1300]) {
      const x = C.x + Math.cos(away + da) * r, y = C.y + Math.sin(away + da) * r;
      if (x < 200 || y < 200 || x > WW * TS - 200 || y > WH * TS - 200) continue;
      const s = this.findSpawnPos(x, y, 0, 120);
      if (s && !W.townAt(s[0], s[1], 80)) return { x: Math.round(s[0]), y: Math.round(s[1]) };
    }
    const s = this.sSpot(C.x + Math.cos(away) * 1300, C.y + Math.sin(away) * 1300, 0, 300);
    return { x: Math.round(s[0]), y: Math.round(s[1]) };
  },

  /* ---------------- akıl hocasının destek ateşi ---------------- */
  /* questNpc'den: true dönerse olağan davranış atlanır. Destek yerine giderken false (questNpc yürütür) */
  mentorSupport(e, dt) {
    const S = this.story, M = S && this.storyDef().mentor;
    if (!S || !S.raid || !S.on || S.done || !M.support || !S.camp || !S.site) return false;
    if ((e.supScan = (e.supScan || 0) - dt) <= 0) { e.supScan = 0.35; this.mentorSupportScan(e, S); }
    if (!S.supOn) return false;
    const g = S.sully;
    if (!g || dist2(e.x, e.y, g.x, g.y) > 20 * 20) return false;
    if (g.ride) { g.ride = false; this.npcDismount(e); }
    e.mv = 0; e.spd = 0; e.weapon = 'repeater';
    const tg = e.supFoe;
    if (!tg || tg.dead || tg.remove || tg.bound || tg.state === 'surrender') { e.gAim = false; if (g.ang !== undefined) e.ang = turnTo(e.ang, g.ang, dt * 2); return true; }
    const a = Math.atan2(tg.y - e.y, tg.x - e.x);
    e.ang = turnTo(e.ang, a, dt * 6); e.gAim = true;
    if ((e.supCd = (e.supCd || 0) - dt) > 0 || Math.abs(angDiff(e.ang, a)) > 0.2) return true;
    const d = dist(e.x, e.y, tg.x, tg.y);
    if (!this.mentorClear(e, tg, d)) { e.supCd = 0.4; return true; }
    e.supCd = rnd(RAID.SUP.RATE[0], RAID.SUP.RATE[1]);
    const ox = e.x + Math.cos(e.ang) * 7, oy = e.y + Math.sin(e.ang) * 7, acc = RAID.SUP.ACC + (tg.mounted ? 0.03 : 0);
    const hit = this.fireRay(ox, oy, e.ang + rnd(-acc, acc), RAID.SUP.R + 40, RAID.SUP.DMG, e, { guard: true, gd: d + rnd(4, 40), weapon: 'repeater' });
    this.parts.add('flash', ox + Math.cos(e.ang), oy + Math.sin(e.ang), 0, 0, 0.06, 3.5);
    Juice.muzzle(ox + Math.cos(e.ang), oy + Math.sin(e.ang));
    if (dist2(e.x, e.y, this.player.x, this.player.y) < 500 * 500) FX.gunSmoke(ox, oy, e.ang, true);
    Audio_.shot('repeater', 0.85, e.x, e.y);
    if (hit && hit.kind === 'npc' && !hit.dead) { hit.foe = e; hit.foeT = 6; }
    return true;
  },
  /* kampta çatışma var mı (kamptan biri seni fark edip saldırıyor ya da Jack kaçıyor); varsa en yakın hedef */
  mentorSupportScan(e, S) {
    const C = S.camp;
    let foe = null, bd = Infinity, fight = false;
    for (const o of this.ents) {
      if (o.kind !== 'npc' || o.dead || o.remove || o.bound || !o.hostile || o.state === 'surrender') continue;
      if (!((C.pid >= 0 && o.camp === C.pid) || o.quest === 'rival' || dist2(o.x, o.y, C.x, C.y) < 450 * 450)) continue;
      if (!o.aggro && !o.fleeing) continue;
      fight = true;
      if (o.quest === 'rival') continue;   // "Onu canlı istiyorum"
      const d = dist(o.x, o.y, e.x, e.y);
      if (d < RAID.SUP.R && d < bd && this.los(e.x, e.y, o.x, o.y)) { bd = d; foe = o; }
    }
    e.supFoe = foe;
    if (!fight || S.supOn) return;
    S.supOn = 1;
    const p = S.supPt || (S.supPt = this.mentorSupportSpot(S));
    S.sully = { x: p.x, y: p.y, ride: true, ang: Math.atan2(C.y - p.y, C.x - p.x) };
    e.weapon = 'repeater';
    this.qSay([['S', pick([Tr('Silah sesi! Geliyorum, {ad}!'), Tr('Dayan, {ad}! Geliyorum!')])]]);
  },
  /* destek yeri: kampın kasaba (kamp yeri) yanında, kampı gören açık bir yer */
  mentorSupportSpot(S) {
    const C = S.camp, a = Math.atan2(S.site.y - C.y, S.site.x - C.x);
    for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) for (const r of [RAID.SUP.DIST, 160, 230]) {
      const s = this.findSpawnPos(C.x + Math.cos(a + da) * r, C.y + Math.sin(a + da) * r, 0, 24);
      if (s && this.los(s[0], s[1], C.x, C.y)) return { x: Math.round(s[0]), y: Math.round(s[1]) };
    }
    const s = this.sSpot(C.x + Math.cos(a) * RAID.SUP.DIST, C.y + Math.sin(a) * RAID.SUP.DIST, 0, 60);
    return { x: Math.round(s[0]), y: Math.round(s[1]) };
  },
  /* atış yolunda sen, atın, Jack ya da düşman olmayan biri var mı */
  mentorClear(e, tg, d) {
    const dx = Math.cos(e.ang), dy = Math.sin(e.ang), P = this.player;
    const chk = (o) => {
      if (Math.abs(o.x - e.x) > d + 20 || Math.abs(o.y - e.y) > d + 20) return false;
      const t = rayCircle(e.x, e.y, dx, dy, o.x, o.y, (o.r || 4) + 4);
      return t >= 0 && t < d;
    };
    if (chk(P) || (this.horse && !this.horse.dead && chk(this.horse))) return false;
    for (const o of this.ents) if (o !== e && o !== tg && o.kind === 'npc' && !o.dead && !o.remove && (o.quest === 'rival' || !o.hostile) && chk(o)) return false;
    return true;
  },
  /* baskın bitti (teslim adımı): akıl hocası silahını bırakır */
  storyRaidEnd(S) {
    S.raid = 0; S.supOn = 0;
    const e = this.mentorEnt();
    if (e) { e.weapon = null; e.gAim = false; e.supFoe = null; }
  },

  /* ---------------- dönüş pususu ---------------- */
  storyAmbushTick(S) {
    if (S.ambush || !S.fled || !S.alive || S.jack === 'delivered') return;
    const P = this.player, T = this.sTown();
    if (!T) return;
    const own = (P.carry ? [P.carry] : []).concat(this.horse && this.horse.load ? this.horse.load : []);
    if (!own.some(e => e.quest === 'rival')) return;
    if (dist2(P.x, P.y, S.camp.x, S.camp.y) < RAID.AMBUSH.FROM * RAID.AMBUSH.FROM || dist2(P.x, P.y, T.cx, T.cy) < RAID.AMBUSH.TOWN * RAID.AMBUSH.TOWN || this.world.townAt(P.x, P.y, 40)) return;
    const n = Math.min(3, 1 + S.fled), back = Math.atan2(S.camp.y - P.y, S.camp.x - P.x);
    let first = null, made = 0;
    for (let k = 0; k < 12 && made < n; k++) {
      // arkadan (kamp yönünden) yetişirler; orası su ya da kayalıksa yanlardan
      const a = back + (made - (n - 1) / 2) * 0.45 + (k >= n ? (k % 2 ? 1 : -1) * (0.5 + k * 0.15) : 0), s = this.findSpawnPos(P.x + Math.cos(a) * 430, P.y + Math.sin(a) * 430, 0, 90);
      if (!s) continue;
      made++;
      const b = new NPC(s[0], s[1], 'bandit', { hostile: true, mounted: true, home: { x: s[0], y: s[1], r: 80 }, money: rnd(3, 12) });
      b.ambush = true;
      this.addEnt(b);
      this.senseAlert(b, { x: P.x, y: P.y }, 'see');
      if (!first) first = b;
    }
    if (!first) return;   // yer bulunamadı: sonra yeniden denenir
    S.ambush = 1;
    UI.toast(Tr('Pusu!'), Tr('Kamptan kaçan haydutlar Jack\'i kurtarmaya geldi.'), 'wanted');
    setTimeout(() => { if (!first.dead) first.say(pick([Tr('Jack\'i bırak, yabancı!'), Tr('O bizim adamımız! Bırak onu!')]), 2.5); }, 400);
  },
});

/* ==========================================================
   Bölüm 8 (Sully) — saloondaki sarhoş haydut. Bölüm başlarken saloonun bir masasında oturur (kâğıt masası varsa onun
   başında). Barmen söylentide onu gösterir; kampın yeri dört yoldan öğrenilir:
   - barmene "Kampın Yerini Sor" (pahalı),
   - sarhoşa "İçki Ismarla": üç kadehte çözülür (her kadeh gidişini geciktirir),
   - onunla "Kâğıt Oyna": oturduğu masada bir el kazanırsan konuşur (js/poker.js),
   - bekle: bir süre sonra kalkar, atına biner ve kampına döner; gizlice peşine takılırsan seni kampa götürür. Ara ara
     omzunun üstünden bakar: o sırada onun gördüğü yerdeysen (ışık, duruş, atlı olman görünürlüğü artırır) şüphesi dolar
     (başının üstünde "?"), dolarsa dörtnala kaçar ve iz kaybolur. Çok geride kalırsan da izi kaybolur.
   Yolların kapandığında barmen kalır. Sarhoşa vurulursa korkup kaçar.
   ========================================================== */
const BARFLY_MUMBLE = () => [Tr('Hık... Bir tane daha...'), Tr('Bu viski su gibi... Hık.'), Tr('Kimse bana ne yapacağımı söyleyemez...'), Tr('Kızıl... hık... kızıl kimse...')];
Object.assign(Story, {
  storySaloon() { const S = this.story; return (S.sal !== undefined && this.world.buildings.find(b => b.id === S.sal)) || this.sBld(['saloon', 'cantina']); },
  drunkEnt() { return this.ents.find(e => e.storyNpc === 'drunk' && !e.remove) || null; },
  /* kampın yeri öğrenilebilir mi (adım: campInfo) */
  drunkStep() { const S = this.story, st = S && S.on && !S.done && !S.wait && this.qStep(); return !!(st && st.ev === 'campInfo'); },
  /* her kare (D.tick): sarhoşun yerinde olması, kalkma zamanı */
  drunkTick(S, dt) {
    const want = S.ch === 7 && !S.flags.campInfo && !S.drunkGone;
    if (!want) {
      // bölüm dışında saniyede bir: kalan sarhoş gözden uzaktayken kalkar
      if ((this._dkIdleT = (this._dkIdleT || 0) - dt) > 0) return;
      this._dkIdleT = 1;
      const e = this.drunkEnt();
      if (e && !this.onScreen(e.x, e.y, 30) && e.dk !== 'home') { e.remove = true; this.drunkUnseat(e); }
      return;
    }
    const e = this.drunkEnt(), P = this.player;
    if (e && e.dead) { S.drunkGone = 'dead'; return; }
    const b = this.storySaloon();
    if (!b) return;
    if (!e) {
      if (dist2(P.x, P.y, b.door.x, b.door.y) > 700 * 700) return;
      this.drunkSpawn(S, b);
      return;
    }
    // kampın yerini öğrenme adımında oyuncu yakındaysa saat işler: sonunda kalkıp gider
    if (e.dk === 'sit' && this.drunkStep() && dist2(P.x, P.y, b.door.x, b.door.y) < 500 * 500) {
      S.dkT = (S.dkT || 0) + dt;
      if (S.dkT > BARFLY.LEAVE + (S.drunkN || 0) * BARFLY.PER) this.drunkLeave(e, S);
    }
  },
  drunkSpawn(S, b) {
    const seat = this.drunkSeat(b);
    if (!S.dkLook) { const R = new RNG((this.seed || 1) + 811); S.dkLook = Object.assign(randomLook('m', R), { hat: 'cowboy', hatCol: '#2a221a', coat: '#3a2e26' }); S.dkName = R.pick(NAMES.m) + ' ' + R.pick(NAMES.last); }
    const e = new NPC(seat.x, seat.y, 'gang', { name: S.dkName, look: Object.assign({}, S.dkLook), state: 'sit', money: 0.4 });
    e.storyNpc = 'drunk'; e.quest = 'drunk'; e.keep = true; e.weapon = null; e.awMark = true; e.dk = 'sit'; e.aw = 0;
    e.seat = seat; e.seatB = b; e.ang = seat.ang !== undefined ? seat.ang : 0;
    b.patrons = (b.patrons || []).filter(p => !p.dead && !p.remove); b.patrons.push(e);
    this.addEnt(e);
    return e;
  },
  drunkUnseat(e) { const b = e.seatB; if (b && b.patrons) b.patrons = b.patrons.filter(p => p !== e); e.seat = null; },
  /* oturacağı yer: kâğıt masasının başı, yoksa kapıdan en uzak masa; boşta olan */
  drunkSeat(b) {
    const W = this.world, seats = (b.seats || []).filter(s => !(b.patrons || []).some(p => p.seat === s && !p.remove));
    const card = seats.filter(s => [-12, 12].some(dx => W.obj[(s.y >> 4) * WW + ((s.x + dx) >> 4)] === O.CARDTABLE));
    const pool = card.length ? card : seats;
    if (pool.length) return pool.slice().sort((a, c) => dist2(c.x, c.y, b.door.x, b.door.y) - dist2(a.x, a.y, b.door.x, b.door.y))[0];
    let iy = b.door.y; for (let k = 0; k < 40 && !W.buildingAtPx(b.door.x, iy); k++) iy -= 2;
    return { x: b.door.x + 8, y: iy - 24, ang: -Math.PI / 2 };
  },
  /* kalkar: kapıya yürür, dışarıda atına biner, kampına sürer */
  drunkLeave(e, S) {
    e.dk = 'out'; e.state = 'walk'; e.nav = null; this.drunkUnseat(e);
    e.say(pick([Tr('Hık... Yeter bu gecelik.'), Tr('Ben... ben gidiyorum. Hık.')]), 2.5);
    if (this.insideB || dist2(this.player.x, this.player.y, e.x, e.y) < 400 * 400) {
      UI.feed(Tr`${e.name} sendeleyerek kalktı, kapıya gidiyor.`);
      UI.help(Tr`Sarhoş gidiyor. Peşine takılırsan seni kampa götürebilir: arada mesafe bırak, arkasına baktığında onun görebileceği yerde olma. Atlıysan daha kolay görülürsün.`, 10);
    }
  },
  /* questNpc'den: sarhoşun davranışı (true: olağan davranış atlanır) */
  drunkNpc(e, dt) {
    const S = this.story, P = this.player;
    if (!S || !S.on || S.done) { e.quest = null; e.storyNpc = null; e.awMark = false; return false; }
    e.hostile = false; e.witness = null;
    // vuruldu ya da itildi: korkup kaçar (bu yol kapanır)
    if (e.dk !== 'flee' && e.dk !== 'home' && e.hitAt !== undefined && this.t - e.hitAt < 0.6) this.drunkSpook(e, S, Tr`${e.name} korkup kaçtı.`);
    const C = S.camp;
    if (e.dk === 'sit') {
      e.state = 'sit'; e.mv = 0; e.spd = 0;
      if (e.seat) { e.x = e.seat.x; e.y = e.seat.y; if (e.seat.ang !== undefined) e.ang = e.seat.ang; }
      this.sitTick(e, dt);
      if (Math.random() < dt * 0.04 && dist2(e.x, e.y, P.x, P.y) < 150 * 150 && !this.storyTalking()) e.say(pick(BARFLY_MUMBLE()), 2);
      return true;
    }
    if (e.dk === 'out') {
      const b = e.seatB || this.storySaloon(), D = { x: b.door.x + 8, y: b.door.y + 24 };
      e.state = 'walk';
      if (dist2(e.x, e.y, D.x, D.y) > 10 * 10) {
        if (this.navStep(e, D.x, D.y, dt, 24, { near: 8, enter: true }) === 'fail' && !this.onScreen(e.x, e.y, 20)) { e.x = D.x; e.y = D.y; }
        return true;
      }
      e.mounted = { col: '#5a3a22', mane: '#1a1410', blanket: '#3a4a2a' }; e.dk = 'ride'; e.lookT = rnd(BARFLY.LOOK[0], BARFLY.LOOK[1]); e.rr = null; e.state = 'idle';
      return true;
    }
    if (e.dk === 'ride') {
      this.mentorFollow(e, { x: C.x, y: C.y, ride: true }, dt, e.mounted ? BARFLY.SPD : 36);
      // arada bir omzunun üstünden bakar: o sırada gördüğü yerdeysen şüphesi dolar
      const d = dist(e.x, e.y, P.x, P.y);
      e.lookT -= dt;
      const look = e.lookT <= 0;
      if (e.lookT < -BARFLY.LOOKT) e.lookT = rnd(BARFLY.LOOK[0], BARFLY.LOOK[1]);
      let gain = 0;
      if (look) {
        e.lookAt = e.ang + Math.PI;
        const R = BARFLY.SEE * this.litK() * this.stanceK() * this.weatherK();
        if (d < R && Math.abs(angDiff(e.lookAt, Math.atan2(P.y - e.y, P.x - e.x))) < 1.05 && this.los(e.x, e.y, P.x, P.y)) gain = Math.pow(1 - d / R, 0.6) * 2.4;
      } else e.lookAt = null;
      if (d < 50) gain = Math.max(gain, 1.6);   // dibinde: at sesini, ayak sesini duyar
      e.aw = gain ? Math.min(1, (e.aw || 0) + gain * dt) : Math.max(0, (e.aw || 0) - dt * 0.08);
      if (look && e.aw > 0.35 && !e.awSaid) { e.awSaid = true; e.say(pick([Tr('Hık... Biri mi var orada?'), Tr('Kim o? Hık...')]), 2); }
      if (e.aw >= 1) { this.drunkSpook(e, S, Tr`Fark edildin! ${e.name} dörtnala kaçtı.`); return true; }
      // kampa yaklaştı: oyuncu yakından izliyorsa kampın yeri bulunur
      if (dist2(e.x, e.y, C.x, C.y) < BARFLY.FOUND * BARFLY.FOUND) {
        if (d < BARFLY.NEAR && this.drunkStep()) this.sullyCampInfo(S, 'follow');
        else this.drunkLost(e, S);
        e.dk = 'home'; e.awMark = false; e.aw = 0; e.lookAt = null;
        return true;
      }
      if (d > BARFLY.LOST) this.drunkLost(e, S);
      return true;
    }
    // korkup kaçıyor ya da kampına varıyor: gözden çıkınca kaybolur
    const fast = e.dk === 'flee';
    if (!e.mounted && fast) e.mounted = { col: '#5a3a22', mane: '#1a1410', blanket: '#3a4a2a' };
    this.mentorFollow(e, { x: C.x, y: C.y, ride: !!e.mounted }, dt, fast ? 150 : BARFLY.SPD);
    if (!this.onScreen(e.x, e.y, 40) && (dist2(e.x, e.y, P.x, P.y) > 600 * 600 || dist2(e.x, e.y, C.x, C.y) < 160 * 160)) e.remove = true;
    return true;
  },
  drunkSpook(e, S, msg) {
    e.dk = 'flee'; e.aw = 1; e.awMark = false; e.lookAt = null; this.drunkUnseat(e);
    if (this.drunkStep() && !S.drunkGone) {
      S.drunkGone = 'spotted';
      e.say(pick([Tr('Peşimde biri var!'), Tr('Bırakın beni! Ben bir şey bilmiyorum!')]), 2.5);
      UI.feed(msg, 'warn');
      UI.help(Tr`Sarhoş kaçtı. Kampın yerini hâlâ barmenden öğrenebilirsin: <b>Kampın Yerini Sor</b>.`, 9);
    }
  },
  drunkLost(e, S) {
    if (S.drunkGone || S.flags.campInfo) return;
    S.drunkGone = 'lost'; e.dk = 'home'; e.awMark = false;
    if (this.drunkStep()) { UI.feed(Tr`${e.name} gözden kayboldu.`, 'warn'); UI.help(Tr`Sarhoşun izini kaybettin. Kampın yerini barmenden öğrenebilirsin: <b>Kampın Yerini Sor</b>.`, 9); }
  },
  /* Sarhoşla etkileşim: adımda içki ısmarla ve kâğıt oyna; yoksa sohbet */
  drunkActions(e, S) {
    if (e.dk !== 'sit') return [];
    const chat = { n: Tr('Sohbet Et'), mt: 1, fn: () => { e.say(pick(BARFLY_MUMBLE()), 2.5); } };
    if (!this.drunkStep()) return [chat];
    const b = e.seatB || this.storySaloon(), acts = [];
    acts.push({ n: Tr`İçki Ismarla (${fmtMoney(BARFLY.DRINK)})`, qe: ['campInfo'], fn: () => this.drunkDrink(e, S) });
    if (b && b.def.svc.includes('poker')) acts.push({ n: Tr('Kâğıt Oyna'), qe: ['campInfo'], fn: () => UI.openPoker(b) });
    acts.push(chat);
    return acts;
  },
  drunkDrink(e, S) {
    if (!this.spend(BARFLY.DRINK)) return;
    S.drunkN = (S.drunkN || 0) + 1;
    this.setAnim(e, 'drink');
    Audio_.ui('pick');
    const n = S.drunkN;
    if (n >= BARFLY.TALK) { this.drunkTalks(S, 'drinks'); return; }
    UI.subtitle(e.name, this.sFmt(n === 1 ? Tr('Hık... Sağ ol, ahbap. Ama ben kimseye bir şey söylemem.') : Tr('Kızıl... Kızıl Jack kimseye güvenmez. Bana bile... Hık. Bir tane daha?')), 3.5);
    Bubbles.add(e, '', 3.5, true);
  },
  /* sarhoş konuşur (içki ya da kâğıt): kampın yeri */
  drunkTalks(S, how) {
    if (!this.drunkStep() || S.flags.campInfo) return;
    const e = this.drunkEnt();
    if (e) { e.ang = Math.atan2(this.player.y - e.y, this.player.x - e.x); Bubbles.add(e, '', 3.5, true); }
    this.sullyCampInfo(S, how);
  },
  /* barmen: kampın yeri pahalıya */
  drunkBarActions(b, S) {
    if (!this.drunkStep() || !(b.type === 'saloon' || b.type === 'cantina') || b.town !== S.town) return [];
    return [{ icon: '💰', label: Tr('Kampın Yerini Sor'), right: fmtMoney(BARFLY.ASK), qe: ['campInfo'], fn: () => { if (!this.spend(BARFLY.ASK)) return; UI.closeAll(); this.sullyCampInfo(S, 'bartender'); } }];
  },
  /* kampın yeri öğrenildi: haritada işaretlenir, nasıl öğrenildiği yazar */
  sullyCampInfo(S, how) {
    if (S.flags.campInfo) return;
    S.flags.campInfo = 1; S.campHow = how; S.campKnown = true;
    this.storyApplyWorld();
    const cp = S.camp && this.world.pois.find(p => p.pid === S.camp.pid);
    if (cp) this.rumored.add(cp.id);
    const q = how === 'bartender' ? Tr('"Bir dolar... Peki. {kamp}. Eski avcıların kamp yeri. Benden duymadın, tamam mı?"')
      : how === 'drinks' ? Tr('"Hık... Kızıl\'ın yeri mi? {kamp}... eski avcıların yeri. Ama ben söylemedim, ha!"')
      : how === 'poker' ? Tr('"Lanet kartlar... Peki, peki! Jack {kamp}\'ta. Şimdi rahat bırak beni."')
      : Tr('Sarhoşun peşinden {kamp}\'a kadar geldin. Kızıl Jack burada saklanıyor.');
    UI.info(Tr('Kızıl Jack\'in Kampı'), `<p class="${how === 'follow' ? '' : 'quote'}">${this.sFmt(q)}</p><p>${this.sFmt(Tr('<b>{kamp}</b> haritanda işaretlendi.'))}</p>`);
    this.qEvent('campInfo', how);
  },
  /* poker masası (js/poker.js): sarhoş oturduğu saloonun masasında rakiplerden biridir */
  storyPokerOpp(b, t) {
    const S = this.story, e = S && S.on && !S.done && this.drunkEnt();
    const want = !!(e && e.dk === 'sit' && e.seatB === b && this.drunkStep());
    const i = t.opps.findIndex(o => o.story === 'drunk');
    if (!want) { if (i >= 0) t.opps.splice(i, 1); return; }
    if (i < 0) { const o = { name: e.name, stack: 600, style: 1, story: 'drunk' }; if (t.opps.length >= POKER_SEATS) t.opps[t.opps.length - 1] = o; else t.opps.push(o); }
  },
});

/* ==========================================================
   Bölüm 6 (Sully) — çiftlik işleri. Saat atlatan menü yerine üç iş, yedi parça:
   - çatı: ambarın önündeki iki merdivende basılı tut, "Çatıyı Onar" (zaman alır, yorar),
   - saman: samanlığın yanındaki üç balyayı omzuna al (ya da atına yükle), ambarın kapısına bırak,
   - çit: güney çitindeki iki kırık direkte basılı tut, "Direği Çak".
   Her iş sayılır; hepsi bitince ya da en az üç işten sonra Sully ile konuşup günü bitirince bitirdiğin iş kadar ödenir.
   Kaybolan balyalar (satılan, uzakta bırakılan) oyuncu uzaktayken samanlıkta yeniden belirir.
   ========================================================== */
Object.assign(Story, {
  /* işlerin yerleri: ambarın ön duvarındaki merdivenler, samanlığın yanındaki balyalar, güney çitindeki kırık direkler,
     balyaların bırakılacağı ambar kapısı (dünya tohumundan; kayda girmez) */
  choreSpots(S) {
    const c = this._chSp;
    if (c && c.pid === S.ranch.pid) return c;
    const W = this.world, p = W.pois.find(q => q.pid === S.ranch.pid);
    if (!p) return null;
    let barn = null, bd = 1e9;
    for (const b of W.buildings) if (b.type === 'barn' && !b.town) { const d = dist2(b.door.x, b.door.y, S.ranch.cx, S.ranch.cy); if (d < bd) { bd = d; barn = b; } }
    if (!barn || bd > 400 * 400) return null;
    const free = (x, y) => { if (!W.blocked(x, y, 5) && !W.indoorPx(x, y)) return [x, y]; return this.findSpawnPos(x, y, 0, 24) || [x, y]; };
    const by = (barn.y + barn.h) * TS + 5;
    const out = {
      pid: S.ranch.pid, barn,
      roof: [free(barn.x * TS + 20, by), free((barn.x + barn.w) * TS - 20, by)].slice(0, CHORE.NROOF),
      fence: [free((p.tx - 5) * TS + 8, (p.ty + 9) * TS + 15), free((p.tx + 7) * TS + 8, (p.ty + 9) * TS + 15)].slice(0, CHORE.NFENCE),
      hay: [free((p.tx + 7) * TS + 8, p.ty * TS + 8), free((p.tx + 9) * TS + 6, p.ty * TS + 10), free((p.tx + 10) * TS + 9, (p.ty - 1) * TS + 10)].slice(0, CHORE.HAY),
      drop: { x: barn.door.x + 8, y: barn.door.y + 20 },
    };
    return (this._chSp = out);
  },
  /* adım başlarken (ve yüklemede): işlerin durumu, eksik balyalar hemen samanlıkta */
  choreInit(S) {
    S.chores = S.chores || { roof: [], fence: [], hay: 0 };
    const C = this.choreSpots(S);
    if (!C) return;
    const need = CHORE.HAY - (S.chores.hay || 0) - this.choreHayHave();
    for (let k = 0; k < need; k++) { const q = C.hay[k % C.hay.length]; this.addEnt(new Crate(q[0] + Math.floor(k / C.hay.length) * 4, q[1], 'hay')); }
  },
  /* ambara henüz girmemiş balyalar: yerde, omuzda ya da eyerde */
  choreHayHave() {
    const P = this.player;
    return this.ents.filter(e => e.kind === 'crate' && e.g === 'hay' && !e.remove && !e.counted).length
      + (P.carry && P.carry.g === 'hay' ? 1 : 0) + (this.horse && this.horse.load ? this.horse.load.filter(e => e.g === 'hay').length : 0);
  },
  choreStep() { const S = this.story, st = S && S.on && !S.done && !S.wait && this.qStep(); return !!(st && st.ev === 'chore'); },
  /* sıradaki iş (işaret için): oyuncu balya taşıyorsa ambar kapısı, yoksa en yakın bitmemiş iş */
  choreNext(S) {
    const C = this.choreSpots(S), P = this.player;
    if (!C || !S.chores) return null;
    if ((P.carry && P.carry.g === 'hay') || (this.horse && this.horse.load && this.horse.load.some(e => e.g === 'hay'))) return C.drop;
    let best = null, bd = Infinity;
    const cand = (x, y) => { const d = dist2(x, y, P.x, P.y); if (d < bd) { bd = d; best = { x, y }; } };
    C.roof.forEach((q, k) => { if (!S.chores.roof[k]) cand(q[0], q[1]); });
    C.fence.forEach((q, k) => { if (!S.chores.fence[k]) cand(q[0], q[1]); });
    for (const e of this.ents) if (e.kind === 'crate' && e.g === 'hay' && !e.remove && !e.counted) cand(e.x, e.y);
    return best;
  },
  /* her kare (D.tick): iş adımında nesneler yerinde; balyalar ambar kapısına bırakılınca sayılır */
  choreTick(S, dt) {
    const C = S.ch === 5 && S.chores && this.choreSpots(S), on = !!C && this.choreStep();
    // iş adımı dışında yalnız temizlik: saniyede bir
    if (!on && (this._chIdleT = (this._chIdleT || 0) - dt) > 0) return;
    this._chIdleT = on ? 0 : 1;
    const want = new Map();
    if (on) {
      C.roof.forEach((q, k) => { if (!S.chores.roof[k]) want.set('roof' + k, { x: q[0], y: q[1], t: 'ladder', label: Tr('Ambar Çatısı'), k }); });
      C.fence.forEach((q, k) => { if (!S.chores.fence[k]) want.set('fence' + k, { x: q[0], y: q[1], t: 'fencebroken', label: Tr('Kırık Çit Direği'), k }); });
    }
    for (const e of this.ents) if (e.chKey && !e.remove && !want.has(e.chKey)) e.remove = true;
    for (const [k, w] of want) {
      if (this.ents.some(e => e.chKey === k && !e.remove)) continue;
      const e = new Prop(w.x, w.y, w.t); e.chKey = k; e.chK = w.k; e.storyAct = true; e.label = w.label; e.keep = true;
      this.addEnt(e);
    }
    const P = this.player;
    if (!on) {
      // bölüm bitti: sayılmamış balyalar gözden uzaktayken kalkar
      if (S.ch !== 5) for (const e of this.ents) if (e.kind === 'crate' && e.g === 'hay' && !e.remove && !this.onScreen(e.x, e.y, 30)) e.remove = true;
      return;
    }
    if ((S.chT = (S.chT || 0) - dt) > 0) return;
    S.chT = 0.3;
    // ambar kapısına bırakılan balya
    for (const e of this.ents) {
      if (e.kind !== 'crate' || e.g !== 'hay' || e.remove || e.counted) continue;
      if (dist2(e.x, e.y, C.drop.x, C.drop.y) > CHORE.DROP * CHORE.DROP) continue;
      e.counted = true; S.chores.hay = Math.min(CHORE.HAY, (S.chores.hay || 0) + 1);
      this.choreFatigue();
      UI.feed(Tr`Saman balyası ambarda (${S.chores.hay}/${CHORE.HAY}).`);
      this.qEvent('chore', 'hay');
      if (!this.choreStep()) return;
    }
    // eksik balyalar (satılan, uzakta kalan): oyuncu samanlıktan uzaktayken yeniden belirir
    const have = this.choreHayHave(), need = CHORE.HAY - (S.chores.hay || 0) - have;
    if (need > 0 && C.hay.every(q => dist2(q[0], q[1], P.x, P.y) > 260 * 260)) {
      for (let k = 0; k < need; k++) { const q = C.hay[(have + k) % C.hay.length]; this.addEnt(new Crate(q[0] + k * 3, q[1], 'hay')); }
    }
  },
  /* merdivende ve kırık direkte basılı tutma eylemi */
  choreActs(e, S) {
    if (!e.chKey || !this.choreStep()) return [];
    if (e.type === 'ladder') return [{ n: Tr('Çatıyı Onar'), hold: CHORE.ROOF, fn: () => this.choreDone(S, 'roof', e) }];
    if (e.type === 'fencebroken') return [{ n: Tr('Direği Çak'), hold: CHORE.FENCE, fn: () => this.choreDone(S, 'fence', e) }];
    return [];
  },
  choreDone(S, kind, e) {
    if (!this.choreStep() || S.chores[kind][e.chK]) return;
    S.chores[kind][e.chK] = 1; e.remove = true;
    this.advanceClock(CHORE.MIN);
    this.choreFatigue();
    for (let k = 0; k < 4; k++) Audio_.tone(kind === 'roof' ? 240 : 180, 0.05, 'square', 0.04, null, k * 0.14);   // çekiç
    UI.feed(kind === 'roof' ? Tr('Çatıdaki delik kapandı.') : Tr('Yeni direk sağlam çakıldı.'));
    this.skillXp('strength', 2);
    this.qEvent('chore', kind);
  },
  choreFatigue() {
    const P = this.player;
    P.energy = Math.max(0, P.energy - CHORE.ENERGY); P.hunger = Math.max(0, P.hunger - CHORE.HUNGER); P.thirst = Math.max(0, P.thirst - CHORE.THIRST);
    P.clean = Math.max(0, P.clean - 3);
  },
  /* adım bitti: merdivenler ve kırık direkler kalkar, sayılmamış balyalar kalır (tick gözden uzakta kaldırır) */
  choreClear(S) { for (const e of this.ents) if (e.chKey) e.remove = true; },
  /* Sully: en az üç işten sonra günü bitir */
  choreMentorActs(e, S, acts) {
    if (!this.choreStep() || S.n < CHORE.EARLY) return acts;
    return [{ n: Tr`Günü Bitir (${S.n}/${CHORE.N} iş)`, fn: () => { e.ang = Math.atan2(this.player.y - e.y, this.player.x - e.x); this.qDone(); } }].concat(acts);
  },
});
