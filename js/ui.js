'use strict';
/* ==========================================================
   FRONTIER'S END — arayüz: HUD, menüler, harita, çanta, günlük,
   dükkanlar, mini oyunlar, karakter yaratma
   ========================================================== */

/* silah doldururken dönen tambur */
const CYL_SVG = '<svg class="w-cyl" viewBox="-10 -10 20 20"><circle r="9.2" fill="#8a8a92" stroke="#2a2a2e" stroke-width="1"/><circle cx="5.30" cy="0.00" r="2.1" fill="#16161a"/><circle cx="2.65" cy="4.59" r="2.1" fill="#16161a"/><circle cx="-2.65" cy="4.59" r="2.1" fill="#16161a"/><circle cx="-5.30" cy="0.00" r="2.1" fill="#16161a"/><circle cx="-2.65" cy="-4.59" r="2.1" fill="#16161a"/><circle cx="2.65" cy="-4.59" r="2.1" fill="#16161a"/><circle r="1.7" fill="#4a4a52"/></svg>';
/* koç ipuçlarının susması için gereken kullanım sayısı (çarkı iki kez aç, nişanla üç kez ateş et) */
const COACH_NEED = { wheel: 2, aim: 3 };

const UI = {
  stack: [],
  frame: 0,
  cache: {},
  curInteract: null,
  holdT: 0,

  init() {
    this.el = {
      hud: $('#hud'), feed: $('#feed'), help: $('#hud-help'), toasts: $('#toasts'), sub: $('#subtitle'), loc: $('#loc-title'),
      prompts: $('#prompts'), modals: $('#modals'), radar: $('#radar'), fader: $('#fader'),
    };
    this.rctx = this.el.radar.getContext('2d');
    this.mapCanvas = $('#mapcanvas');
    this.mctx = this.mapCanvas.getContext('2d');
    this.menuCanvas = $('#menubg');
    this.bgctx = this.menuCanvas.getContext('2d');
    this.map = { zoom: 1, cx: 512, cy: 512, drag: null };
    $$('[data-g]').forEach(n => { n.innerHTML = Icons.glyph(n.dataset.g, n.closest('.core') ? (n.dataset.g === 'deadeye' ? '#7a1a10' : '#1a1612') : '#efe6d2'); });
    this.setupMapMouse();
    this.menuVidInit();
  },
  isModal() { return this.stack.length > 0; },
  top() { return this.stack[this.stack.length - 1]; },

  /* ================= MODAL ÇEKİRDEĞİ ================= */
  makeModal(el, opts = {}) {
    const m = { el, opts, born: this.frame, alive: true, focusEl: null };
    m.navs = () => $$('.nav', el).filter(n => !n.classList.contains('disabled') && n.offsetParent !== null);
    m.setFocus = (n, silent) => {
      if (!n) return;
      if (m.focusEl) m.focusEl.classList.remove('focus');
      m.focusEl = n; n.classList.add('focus');
      n.scrollIntoView({ block: 'nearest' });
      if (!silent) Audio_.ui('move');
      if (opts.onFocus) opts.onFocus(n);
    };
    m.focusFirst = () => { const ns = m.navs(); const pref = ns.find(n => n.classList.contains('pref')); m.setFocus(pref || ns[0], true); };
    m.move = (dx, dy) => {
      const ns = m.navs();
      if (!ns.length) return;
      if (!m.focusEl || !ns.includes(m.focusEl)) { m.setFocus(ns[0]); return; }
      if (dx && m.focusEl.dataset.lr !== undefined) { m.focusEl._lr && m.focusEl._lr(dx); Audio_.ui('move'); return; }
      const r = m.focusEl.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null, bs = Infinity;
      for (const n of ns) {
        if (n === m.focusEl) continue;
        const q = n.getBoundingClientRect();
        const qx = q.left + q.width / 2, qy = q.top + q.height / 2;
        const ddx = qx - cx, ddy = qy - cy;
        const prim = dx ? ddx * dx : ddy * dy;
        if (prim <= 2) continue;
        const perp = dx ? Math.abs(ddy) : Math.abs(ddx);
        const s = prim + perp * 2.5;
        if (s < bs) { bs = s; best = n; }
      }
      if (!best && dy && opts.wrap !== false) best = dy > 0 ? ns[0] : ns[ns.length - 1];
      if (best) m.setFocus(best);
    };
    m.activate = () => { if (m.focusEl) m.focusEl.click(); };
    m.onBack = opts.onBack || (() => this.pop());
    return m;
  },
  push(m) {
    this.stack.push(m);
    this.el.modals.appendChild(m.el);
    if (!m.opts.noFocus) m.focusFirst();
    this.updatePauseState();
    return m;
  },
  pop(m) {
    m = m || this.top();
    if (!m) return;
    const i = this.stack.indexOf(m);
    if (i >= 0) this.stack.splice(i, 1);
    m.alive = false;
    if (m.opts.onClose) m.opts.onClose();
    if (m.el.parentNode === this.el.modals) m.el.remove();
    else if (m.opts.keepEl) m.el.classList.add('hidden');
    this.updatePauseState();
  },
  closeAll() { while (this.stack.length) this.pop(); },
  updatePauseState() {
    const t = this.top();
    document.body.classList.toggle('modal-open', !!t && !(t.opts && t.opts.transparent));
  },
  update(dt) {
    this.frame++;
    const m = this.top();
    if (this.state === 'fade') return;
    if (m) {
      if (m.update) m.update(dt);
      if (m.born !== this.frame - 1 && m.born !== this.frame && !m.opts.customInput) {
        const I = Input;
        if (I.nav('up', dt)) m.move(0, -1);
        if (I.nav('down', dt)) m.move(0, 1);
        if (I.nav('left', dt)) m.move(-1, 0);
        if (I.nav('right', dt)) m.move(1, 0);
        if (I.pressed('confirm')) m.activate();
        else if (I.pressed('back')) { Audio_.ui('back'); m.onBack(); }
        else if (m.opts.onTab && I.pressed('tabL')) m.opts.onTab(-1);
        else if (m.opts.onTab && I.pressed('tabR')) m.opts.onTab(1);
        else if (m.opts.onAlt && I.pressed('alt')) m.opts.onAlt(m);
        if (m.opts.scroll) {
          const s = m.el.querySelector('.scroll');
          if (s) { const ax = Input.axes[3]; if (Math.abs(ax) > 0.2) s.scrollTop += ax * dt * 600; }
        }
      }
    }
    if (G.state === 'play' || G.state === 'dead') {
      // genişletilmiş HUD: radar uzaklaşır, değerler ve konum bilgisi görünür
      if (this.hudX > 0) this.hudX -= dt;
      const xt = this.hudX > 0 && G.state === 'play' ? 1 : 0;
      this.hudXk = (this.hudXk || 0) + (xt - (this.hudXk || 0)) * Math.min(1, dt * 7);
      if (Math.abs(this.hudXk - xt) < 0.01) this.hudXk = xt;
      const hudEl = this.cache.hudEl || (this.cache.hudEl = $('#hud'));
      if (hudEl._x !== !!xt) { hudEl._x = !!xt; hudEl.classList.toggle('hud-x', !!xt); this.timers && (this.timers.hud = 0); }
      this.timers = this.timers || { hud: 0, radar: 0 };
      this.timers.hud -= dt; this.timers.radar -= dt;
      if (this.timers.hud <= 0) { this.timers.hud = 0.1; this.hudUpdate(); }
      this.moneyTick(dt);
      if (this.timers.radar <= 0) { this.timers.radar = 1 / 20; this.drawRadar(); }
      this.feedUpdate(dt);
    }
  },

  /* Genel liste menüsü */
  menu(spec) {
    const el = el_('div', 'modal panel ' + (spec.cls || ''));
    let m;
    const render = () => {
      const items = spec.build ? spec.build(m) : spec.items;
      m.items = items;
      const prevI = m.focusEl ? +m.focusEl.dataset.i : (spec.focus || 0);
      // cüzdan: sağ üstte büyük; para değişince kısa bir parlama
      let wl = '';
      if (spec.wallet && G.player) {
        const mo = G.player.money, fl = m._money === undefined || m._money === mo ? '' : mo < m._money ? ' spent' : ' gain';
        m._money = mo;
        wl = `<div class="p-wallet${fl}"><span>${Tr('Cüzdan')}</span><b>${fmtMoney(mo)}</b></div>`;
      }
      const sub = spec.sub ? (typeof spec.sub === 'function' ? spec.sub(m) : spec.sub) : '';
      let h = `<div class="p-head${wl ? ' has-wallet' : ''}">${wl}<div class="p-title">${spec.title}</div>${sub ? `<div class="p-sub">${sub}</div>` : ''}</div>`;
      if (spec.tabs) h += `<div class="p-tabs">${Input.glyph('tabL')}${spec.tabs.map((t, i) => `<span class="tab ${i === m.tab ? 'on' : ''}" data-tab="${i}">${t}</span>`).join('')}${Input.glyph('tabR')}</div>`;
      h += `<div class="p-body"><div class="p-list scroll">`;
      items.forEach((it, i) => {
        if (it.header) { h += `<div class="p-hdr">${it.header}</div>`; return; }
        if (it.html) { h += `<div class="p-html">${it.html}</div>`; return; }
        h += `<div class="p-item nav ${it.disabled ? 'dis' : ''} ${it.cls || ''}" data-i="${i}">${it.icon ? `<span class="pi-ic">${Icons.iconize(it.icon)}</span>` : ''}<span class="pi-l">${Icons.iconize(it.label)}</span>${it.right !== undefined ? `<span class="pi-r">${Icons.iconize(String(it.right))}</span>` : ''}</div>`;
      });
      if (!items.some(it => !it.header && !it.html)) h += `<div class="p-empty">${spec.empty || Tr('Burada bir şey yok.')}</div>`;
      h += `</div>`;
      if (spec.side) h += `<div class="p-side"></div>`;
      h += `</div><div class="p-foot">${spec.footer ? spec.footer(m) : this.footer(spec)}</div>`;
      el.innerHTML = h;
      $$('.p-item', el).forEach(n => {
        n.onclick = () => { m.setFocus(n, true); act(+n.dataset.i); };
        n.onmouseenter = () => { if (m.focusEl !== n) m.setFocus(n, true); };
      });
      $$('.tab', el).forEach(n => (n.onclick = () => { m.tab = +n.dataset.tab; m.focusEl = null; render(); m.focusFirst(); }));
      const ns = m.navs();
      const target = ns.find(n => +n.dataset.i === prevI) || ns.find(n => +n.dataset.i > prevI) || ns[ns.length - 1] || ns[0];
      m.focusEl = null;
      if (target) m.setFocus(target, true);
      else if (spec.side) { const s = $('.p-side', el); if (s) s.innerHTML = ''; }
    };
    const act = (i) => {
      const it = m.items[i];
      if (!it || it.header) return;
      if (it.disabled) { Audio_.ui('error'); if (it.why) this.feed(it.why, 'warn'); return; }
      Audio_.ui('ok');
      if (it.fn) it.fn(m, it);
      if (m.alive && !it.close) render();
      if (it.close && m.alive) this.pop(m);
    };
    m = this.makeModal(el, {
      onBack: spec.onBack, onClose: spec.onClose, onAlt: spec.onAlt ? (mm) => { const i = mm.focusEl ? +mm.focusEl.dataset.i : -1; spec.onAlt(m.items[i], m); if (m.alive) render(); } : null,
      onTab: spec.tabs ? (d) => { m.tab = (m.tab + d + spec.tabs.length) % spec.tabs.length; m.focusEl = null; render(); m.focusFirst(); Audio_.ui('move'); } : null,
      onFocus: (n) => { if (spec.side) { const it = m.items[+n.dataset.i]; $('.p-side', el).innerHTML = it ? spec.side(it, m) : ''; } },
    });
    m.tab = spec.tab || 0;
    m.render = render;
    render();
    this.push(m);
    return m;
  },
  footer(spec) {
    let s = Tr`${Input.glyph('confirm')} ${spec.okLabel || Tr('Seç')} &nbsp; ${Input.glyph('back')} Geri`;
    if (spec.altLabel) s += ` &nbsp; ${Input.glyph('alt')} ${spec.altLabel}`;
    if (spec.tabs) s += Tr` &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Sekme`;
    return s;
  },
  confirm(title, text, yes, noLabel = Tr('Vazgeç'), yesLabel = Tr('Evet')) {
    return this.menu({ title, sub: text, cls: 'small', items: [{ label: yesLabel, fn: () => { this.pop(); yes(); } }, { label: noLabel, fn: () => this.pop() }] });
  },
  info(title, html, btn = Tr('Tamam')) {
    return this.menu({ title, cls: 'small', items: [{ html }, { label: btn, fn: () => this.pop() }] });
  },

  /* ================= GERİ BİLDİRİM ================= */
  feedItems: [],
  feed(text, kind) {
    const e = el_('div', 'feed-item ' + (kind || ''), Icons.iconize(text));
    this.el.feed.appendChild(e);
    this.feedItems.push({ e, t: 5 });
    if (this.feedItems.length > 6) { const f = this.feedItems.shift(); f.e.remove(); }
  },
  feedUpdate(dt) {
    for (let i = this.feedItems.length - 1; i >= 0; i--) {
      const f = this.feedItems[i];
      f.t -= dt;
      if (f.t < 0.6) f.e.style.opacity = Math.max(0, f.t / 0.6);
      if (f.t <= 0) { f.e.remove(); this.feedItems.splice(i, 1); }
    }
  },
  /* Duyurular sırayla gelir: ekranda en fazla iki pankart; kuyruk doluysa her biri daha kısa kalır.
     Aynı duyuru ekranda ya da kuyrukta zaten varsa yeniden eklenmez. */
  toast(title, sub, kind) {
    const Q = this.toastQ || (this.toastQ = []), key = title + '|' + (sub || '');
    if (Q.some(t => t.key === key) || [...this.el.toasts.children].some(e => e._key === key && !e.classList.contains('out'))) return;
    Q.push({ title, sub, kind, key });
    this.toastPump();
  },
  toastPump() {
    const Q = this.toastQ;
    while (Q && Q.length && this.el.toasts.querySelectorAll('.toast:not(.out)').length < 2) {
      const { title, sub, kind, key } = Q.shift();
      const e = el_('div', 'toast tk-' + (kind || 'none'), `<div class="t-k">${{ ach: Tr('BAŞARIM'), skill: Tr('YETENEK'), year: Tr('YAŞ'), family: Tr('AİLE'), bounty: Tr('ÖDÜL'), horse: Tr('AT'), ok: '' }[kind] || ''}</div><div class="t-t">${Icons.iconize(title)}</div><div class="t-s">${Icons.iconize(sub || '')}</div>`);
      e._key = key;
      this.el.toasts.appendChild(e);
      const dur = Q.length ? 3600 : 5200;
      setTimeout(() => { e.classList.add('out'); this.toastPump(); }, dur);
      setTimeout(() => e.remove(), dur + 800);
    }
  },
  help(html, dur = 6) {
    const h = this.el.help;
    h.innerHTML = Icons.iconize(html); h.classList.remove('hidden');
    // alttaki pirinç çizgi kalan süreyi gösterir
    h.style.setProperty('--dur', dur + 's'); h.classList.remove('tick'); void h.offsetWidth; h.classList.add('tick');
    clearTimeout(this._helpT);
    this._helpT = setTimeout(() => h.classList.add('hidden'), dur * 1000);
  },
  /* Koç ipuçları: oyuncu bir mekaniği kaçırınca (çarkı hiç açmadan yumrukla dövüşmek, nişan almadan
     ateş etmek) ekranın ortasında tek satır belirir. Öğrenilince (çark açılınca, nişanla ateş edilince)
     kalıcı olarak susar; ilerleme ayarlarla birlikte saklanır, bütün kayıtlarda geçerlidir. */
  coachLearned(k) { const C = G.settings.coach || {}; return (C[k] || 0) >= (COACH_NEED[k] || 1); },
  coachLearn(k) {
    if (this.coachLearned(k)) return;
    const C = G.settings.coach || (G.settings.coach = {});
    C[k] = (C[k] || 0) + 1;
    try { Platform.set(SET_KEY, JSON.stringify(G.settings)); } catch (e) {}
    if (this._coachK === k) this.coachHide();
  },
  coach(k, html, dur = 5) {
    if (this.coachLearned(k) || G.state !== 'play' || G.cine) return false;
    const now = performance.now() / 1000, T = this._coachT || (this._coachT = {});
    if (T[k] !== undefined && now - T[k] < 20) return false;
    T[k] = now;
    const el = $('#coach');
    el.innerHTML = html; el.classList.add('show'); this._coachK = k;
    clearTimeout(this._coachTO); this._coachTO = setTimeout(() => this.coachHide(), dur * 1000);
    Audio_.ui('hover');
    return true;
  },
  coachHide() { const el = $('#coach'); if (el) el.classList.remove('show'); this._coachK = null; clearTimeout(this._coachTO); },
  coachWheel() { return this.coach('wheel', Tr`<b>Silah Çarkı</b> için ${Input.glyph('wheel')} basılı tut — silahını, kementi, yayı buradan seç`, 6); },
  coachAim(dur = 5) { return this.coach('aim', Tr`<b>Nişan almak</b> için ${Input.glyph('aim')} basılı tut — atışların çok daha isabetli olur`, dur); },
  /* görev adımı ateş etmeyi istiyor: önce silahı eline almak (çark), sonra nişan ipucu; adım değişince vazgeçilir */
  coachStep() {
    const C = this.coachFor, P = G.player;
    if (!C || !P || G.state !== 'play') return;
    if (G.qStep() !== C.st || this.coachLearned(C.k)) { this.coachFor = null; return; }
    if (P.W.clip || P.weapon === 'bow') { if (this.coachAim(7)) this.coachFor = null; }
    else if (!this.coachLearned('wheel')) this.coachWheel();
  },
  subtitle(name, text, dur = 3, self) {
    const s = this.el.sub;
    s.innerHTML = `<span class="sn ${self ? 'self' : ''}">${escapeHtml(name)}:</span> ${escapeHtml(text)}`;
    s.classList.remove('hidden');
    clearTimeout(this._subT);
    this._subT = setTimeout(() => s.classList.add('hidden'), dur * 1000);
  },
  locationTitle(name, sub) {
    const l = this.el.loc;
    $('.lt-name', l).textContent = name; $('.lt-sub', l).textContent = sub || '';
    l.classList.remove('hidden', 'show'); void l.offsetWidth; l.classList.add('show');
    clearTimeout(this._locT);
    this._locT = setTimeout(() => l.classList.remove('show'), 4200);
  },
  wanted(reason, bounty) {
    this.toast(reason ? reason.toUpperCase() : Tr('SUÇ'), bounty ? Tr`Başına +${fmtMoney(bounty)} ödül kondu` : Tr('Kanun peşinde!'), 'wanted');
    Audio_.tone(220, 0.4, 'sawtooth', 0.05); Audio_.tone(196, 0.5, 'sawtooth', 0.05, null, 0.3);
  },
  honorFlash(good) {
    const e = $('#honor-flash');
    e.className = good ? 'good' : 'bad';
    void e.offsetWidth; e.classList.add('show');
  },
  fade(fn, text) {
    const f = this.el.fader;
    this.state = 'fade';
    f.classList.add('on');
    $('#fader-text').textContent = text || '';
    setTimeout(() => {
      try { fn(); } catch (e) { console.error(e); }
      setTimeout(() => { f.classList.remove('on'); this.state = null; }, 900);
    }, 600);
  },

  /* ================= HUD ================= */
  setCore(id, ring, core, col) {
    const e = this.cache['core' + id] || (this.cache['core' + id] = $('#' + id));
    const r = Math.round(ring * 100), c = Math.round(core * 100);
    const k = r + '|' + c;
    if (e._k === k) return;
    e._k = k;
    e.style.setProperty('--v', ring.toFixed(3));
    e.style.setProperty('--c', core.toFixed(3));
    e.classList.toggle('low', ring < 0.25 || core < 0.15);
  },
  /* Para sayacı: gösterilen değer gerçeğe doğru yuvarlanır (tıkırtıyla), artışta yeşil, azalışta kırmızı parlar */
  moneyTick(dt) {
    const P = G.player; if (!P) return;
    const e = this.cache['hud-money'] || (this.cache['hud-money'] = $('#hud-money'));
    if (this.moneyP !== P || this.moneyV == null) { this.moneyP = P; this.moneyV = P.money; }
    const d = P.money - this.moneyV;
    if (Math.abs(d) >= 0.005) {
      if (!this.moneyRoll) { this.moneyRoll = true; e.classList.remove('gain', 'loss'); e.classList.add(d > 0 ? 'gain' : 'loss'); }
      this.moneyV += d * Math.min(1, dt * 6);
      if (Math.abs(P.money - this.moneyV) < 0.02 || !Juice.motion) this.moneyV = P.money;
      if ((this.coinT = (this.coinT || 0) - dt) <= 0) { this.coinT = 0.085; Audio_.tone(d > 0 ? rnd(1900, 2200) : rnd(1300, 1500), 0.025, 'triangle', 0.01, Audio_.uiBus); }
    } else if (this.moneyRoll) { this.moneyRoll = false; this.moneyV = P.money; setTimeout(() => { if (!this.moneyRoll) e.classList.remove('gain', 'loss'); }, 350); }
    this.setText('hud-money', fmtMoney(this.moneyV));
  },
  setText(id, t) {
    const e = this.cache[id] || (this.cache[id] = $('#' + id));
    if (e._t !== t) { e._t = t; e.innerHTML = t; }
  },
  /* D-pad ↓ (ya da kamp tuşu) kısa basış: birkaç saniyelik genişletilmiş HUD; tekrar basınca kapanır */
  expandHud() {
    this.hudX = this.hudX > 0 ? 0 : 7;
    Audio_.ui('move');
  },
  hudXInfo() {
    const P = G.player, W = G.world;
    const t = W.townAt(P.x, P.y, 20);
    const place = t ? t.n : W.regionAt(P.x, P.y);
    const wn = this.weatherName();
    const h = G.honor, hn = h > 50 ? Tr('Saygın') : h > 15 ? Tr('İyi') : h < -50 ? Tr('Kötü Şöhretli') : h < -15 ? Tr('Şüpheli') : Tr('Nötr');
    const pct = v => Math.round(clamp(v, 0, 100));
    return `<div class="xi-place">${place}</div>
      <div class="xi-row">${Icons.glyph(this.weatherGlyph(), '#efe6d2')}${wn} • ${Math.round(G.feltTemp)}°</div>
      <div class="xi-row">${Icons.glyph('star', '#efe6d2')}${Tr`Onur: ${hn}`}</div>
      <div class="xi-grid"><span>${Tr`Sağlık`}</span><b>${pct(P.hp / P.maxHp * 100)}</b><span>${Tr`Dayanıklılık`}</span><b>${pct(P.sta / Math.max(1, P.maxSta) * 100)}</b><span>${Tr`Odak`}</span><b>${pct(P.de)}</b>
      <span>${Tr`Açlık`}</span><b>${pct(P.hunger)}</b><span>${Tr`Susuzluk`}</span><b>${pct(P.thirst)}</b><span>${Tr`Uyku`}</span><b>${pct(P.energy)}</b></div>`;
  },
  hudUpdate() {
    const P = G.player;
    if (!P) return;
    if (this.hudX > 0) this.setText('hud-xinfo', this.hudXInfo());
    this.setCore('core-hp', P.hp / P.maxHp, Math.min(P.hunger, P.thirst) / 100);
    this.setCore('core-sta', P.sta / Math.max(1, P.maxSta), P.energy / 100);
    this.setCore('core-de', P.de / 100, P.deCore / 100);
    const setNeed = (id, v) => { const e = this.cache[id] || (this.cache[id] = $('#' + id)); const k = Math.round(v); if (e._k !== k) { e._k = k; e.style.setProperty('--v', v / 100); e.classList.toggle('low', v < 20); } };
    setNeed('need-hunger', P.hunger); setNeed('need-thirst', P.thirst); setNeed('need-energy', P.energy); setNeed('need-clean', P.clean);
    this.setText('hud-time', G.timeStr());
    this.setText('hud-date', G.dateStr());
    this.setText('hud-age', Tr`${P.name} • ${G.age} yaşında`);
    // hava ve hissedilen sıcaklık: saatin yanında küçük rozet (gece ay, yağmurda bulut)
    const ft = Math.round(G.feltTemp), cold = G.coldness > 0, hot = G.hotness > 0, wg = this.weatherGlyph();
    const ev = this.cache.env || (this.cache.env = $('#hud-env')), ek = wg + ft + cold + hot;
    if (ev._k !== ek) {
      ev._k = ek;
      ev.innerHTML = Icons.glyph(wg, cold ? '#b8d6ff' : hot ? '#ffbe82' : '#f2ead8') + ft + '°';
      ev.classList.toggle('cold', cold); ev.classList.toggle('hot', hot);
      ev.title = cold ? Tr('Üşüyorsun') : hot ? Tr('Sıcak çarpıyor') : Tr('Hissedilen sıcaklık');
    }
    // görev izleyicide hedefe uzaklık
    const hq = this.cache.hq || (this.cache.hq = $('#hud-quest'));
    if (!hq.classList.contains('hidden')) {
      const de = hq.querySelector('.hq-d'), qm = G.questMark();
      if (de) { const d = qm ? dist(P.x, P.y, qm.x, qm.y) : 0, t = d > 70 ? fmtDist(d) : ''; if (de._t !== t) { de._t = t; de.textContent = t; } }
    }
    // aranma
    const L = G.law;
    const wz = this.cache.wz || (this.cache.wz = $('#hud-wanted'));
    const wk = L.level + '|' + Math.round(L.bounty) + '|' + Math.round(L.maskBounty || 0) + L.masked;
    if (wz._k !== wk) {
      wz._k = wk;
      wz.classList.toggle('hidden', L.level <= 0);
      $('.wanted-stars', wz).innerHTML = '★'.repeat(L.level) + '<span>' + '★'.repeat(5 - L.level) + '</span>';
      $('.wanted-bounty', wz).innerHTML = L.masked ? Tr('Maskeli yabancı aranıyor') + (L.maskBounty ? ` <span class="mb">${Tr`Ödül: ${fmtMoney(L.maskBounty)}`}</span>` : '') : Tr('Ödül: ') + fmtMoney(L.bounty) + (L.maskBounty ? ` <span class="mb">${Tr`+ maskeli: ${fmtMoney(L.maskBounty)}`}</span>` : '');
      const hb = $('#hud-bounty');
      hb.classList.toggle('hidden', L.level > 0 || L.bounty <= 0);
      hb.textContent = Tr('Başındaki ödül: ') + fmtMoney(L.bounty);
    }
    // tanıklar
    const wt = this.cache.wt || (this.cache.wt = $('#hud-witness'));
    let wn = 0, wp = 0;
    for (const r of G.reports) if (!r.done) { wn += r.ws.length; wp = Math.max(wp, r.t / r.limit); }
    const wtk = wn + '|' + Math.round(wp * 50);
    if (wt._k !== wtk) {
      wt._k = wtk;
      wt.classList.toggle('hidden', !wn);
      if (wn) { $('.wt-t', wt).innerHTML = Icons.glyph('witness', '#f0b050') + (wn > 1 ? Tr('{0} TANIK KANUNA KOŞUYOR', wn) : Tr('TANIK KANUNA KOŞUYOR')); $('.wt-bar i', wt).style.width = Math.round((1 - wp) * 100) + '%'; }
    }
    // at
    const h = G.horse;
    const hc = this.cache.hc || (this.cache.hc = $('#horse-cores'));
    const showH = h && !h.dead && (P.riding === h || dist(P.x, P.y, h.x, h.y) < 120);
    hc.classList.toggle('hidden', !showH);
    if (showH) { this.setCore('core-hhp', h.hp / h.maxHp, h.bondLv / 4); this.setCore('core-hsta', h.sta / h.maxSta, 1); }
    // durum simgeleri
    const st = [];
    const gi = (g, t, col, blink) => st.push(`<span title="${t}" class="${blink ? 'blink' : ''}">${Icons.glyph(g, col)}</span>`);
    if (P.masked) gi('mask', P.maskBlown ? Tr('Maskeli (görüldün)') : Tr('Maskeli'), P.maskBlown ? '#e0a080' : '#efe6d2');
    if (P.sick > 0) gi('sick', Tr('Hasta'), '#b8d890');
    if (P.poison > 0) gi('skull', Tr('Zehirlendin'), '#b8e070', 1);
    if (P.drunk > 30) gi('mug', Tr('Sarhoş'), '#e8c060');
    if (G.coldness > 0) gi('snow', Tr('Üşüyorsun'), '#9cc8ff', 1);
    if (G.hotness > 0) gi('sun', Tr('Sıcak çarpıyor'), '#ffb060', 1);
    if (P.warmBuff > 0) gi('steam', Tr('Isınmış'), '#f0d8b0');
    if (P.immuneT > 0) gi('cross', Tr('Kinin: hastalığa karşı korunuyorsun'), '#e8e0c8');
    if (P.painT > 0) gi('heartp', Tr('Laudanum: acı uyuştu'), '#d8a0c8');
    if (P.limberT > 0) gi('feet', Tr('Kas merhemi'), '#b8d8a0');
    if (P.coolT > 0) gi('snow', Tr('Serinlemiş'), '#a8d0f0');
    if (G.nearFire) gi('fire', Tr('Ateş başında'), '#ff9a40');
    if (P.clean < 20) gi('flies', Tr('Kirlisin'), '#c8b890');
    if (P.crouch) gi('feet', Tr('Gizlilik'), '#e8e0d0');
    this.setText('status-icons', st.join(''));
    // silah
    const W = P.W;
    let ammo = '', pips = '';
    if (W.clip) {
      const n = P.clip[P.weapon] || 0;
      ammo = `${n}<small>/${P.ammo[W.ammo]}</small>`;
      // şarjördeki fişekler: dolu ve boş yuvalar
      if (W.clip > 1 && W.clip <= 14) for (let k = 0; k < W.clip; k++) pips += k < n ? '<i></i>' : '<i class="e"></i>';
    } else if (W.throw) ammo = `${P.count('dynamite')}`;
    else if (P.weapon === 'bow') ammo = `${P.ammo.arrow}`;
    this.setText('w-icon', Icons.weapon(P.weapon)); this.setText('w-name', W.n + (P.reloadT > 0 ? Tr(' <em>dolduruluyor…</em>') : '')); this.setText('w-ammo', (P.reloadT > 0 ? CYL_SVG : '') + ammo); this.setText('w-pips', pips);
    // çark tuşu silah kartında hep yazar; çark hiç açılmadıysa kart nazikçe parlar
    this.setText('w-key', `${Input.glyph('wheel')} ${Tr('Çark')}`);
    const wl = !this.coachLearned('wheel') && P.weapons.size > 1;
    if (this._wl !== wl) { this._wl = wl; $('#weapon-hud').classList.toggle('learn', wl); }
    this.coachStep();
    // ilk oyunda: bir süre sonra çark bir kez hatırlatılır
    if (wl && !this._coachW0 && G.state === 'play' && (this._coachPlay = (this._coachPlay || 0) + 0.1) > 45) { this._coachW0 = true; this.coachWheel(); }
    // efektler
    document.body.classList.toggle('deadeye', !!P.deadeye);
    document.body.classList.toggle('lowhp', P.hp < P.maxHp * 0.25 && G.state === 'play');
    document.body.classList.toggle('drunk', P.drunk > 45);
    const hurt = $('#fx-hurt');
    const fv = Math.min(1, G.fx.flash * 1.4);   // düşük sağlık nabzı FX.post'ta (kalp atışı)
    hurt.style.opacity = fv.toFixed(2);
  },

  /* ================= ETKİLEŞİM İSTEMLERİ ================= */
  interactUpdate(dt) {
    const P = G.player, I = Input;
    if (!I.down('interact') && !I.released('interact')) {
      this._scanT = (this._scanT || 0) - dt;
      if (this._scanT <= 0) { this.curInteract = G.findInteraction(); this._scanT = 0.1; }
    }
    const it = this.curInteract;
    if (I.pressed('interact') && it) { this.holdTarget = it; this.holdT = 0; this.menuOpened = false; }
    // ikincil eylem (ör. Omzuna Al) şarjör tuşunda
    if (it && it.alt && !this.holdTarget && I.pressed('reload')) { it.alt.fn(); this.curInteract = null; this._scanT = 0.05; }
    const tgt = this.holdTarget;
    let holdPct = 0;
    if (tgt) {
      const a0 = tgt.actions[0];
      const hasMenu = tgt.actions.length > 1 && !a0.hold;
      if (!tgt.riding && dist(P.x, P.y, tgt.x, tgt.y) > 48) this.holdTarget = null;
      else if (I.down('interact')) {
        this.holdT += dt;
        if (a0.hold) {
          holdPct = Math.min(1, this.holdT / a0.hold);
          if (this.holdT >= a0.hold) { this.holdTarget = null; this.curInteract = null; this._scanT = 0; if (!a0.check || a0.check()) a0.fn(); else this.feed(Tr`Önce çömelerek (${I.glyph('crouch')}) sakince yaklaş.`, 'warn'); }
        } else if (hasMenu && this.holdT > 0.35 && !this.menuOpened) {
          this.menuOpened = true; this.holdTarget = null;
          this.contextMenu(tgt);
        }
      } else if (I.released('interact')) {
        this.holdTarget = null;
        if (!a0.hold && !this.menuOpened) { a0.fn(); this.curInteract = null; this._scanT = 0.05; }
      }
    }
    const lines = [];
    const shown = this.holdTarget || it;
    if (shown) {
      const a0 = shown.actions[0];
      const hasMenu = shown.actions.length > 1 && !a0.hold;
      lines.push(`<div class="prompt-title">${shown.label}</div>`);
      lines.push(`<div class="prompt ${holdPct > 0 ? 'holding' : ''}" style="--p:${holdPct.toFixed(2)}">${I.glyph('interact')}<span>${a0.n}${a0.hold ? Tr(' <em>(basılı tut)</em>') : ''}</span></div>`);
      if (hasMenu) lines.push(`<div class="prompt dim">${I.glyph('interact')}<span>${Tr`Seçenekler <em>(basılı tut)</em>`}</span></div>`);
      if (shown.alt) lines.push(`<div class="prompt">${I.glyph('reload')}<span>${shown.alt.n}</span></div>`);
    }
    // nişan almayı henüz öğrenmediyse, ateşli silah elindeyken istemlerde hatırlatılır
    if (P.W.clip && !P.aiming && !P.deadeye && !P.carry && !this.coachLearned('aim')) lines.push(`<div class="prompt dim">${I.glyph('aim')}<span>${Tr`Nişan Al <em>(basılı tut)</em>`}</span></div>`);
    if (P.rope && !shown) lines.push(`<div class="prompt dim">${I.glyph('fire')}<span>${Tr('Kementi Bırak')}</span></div>`);
    if (P.aiming && P.isArmed && !P.deadeye && P.de > 12) lines.push(`<div class="prompt dim">${I.glyph('deadeye')}<span>${Tr('Odak')}</span></div>`);
    if (P.riding) lines.push(`<div class="prompt dim">${I.glyph('sprint')}<span>${Tr`Dörtnala`}</span></div>`);
    const key = lines.join('');
    if (this._pk !== key) { this._pk = key; this.el.prompts.innerHTML = key; }
  },
  contextMenu(it) {
    this.menu({
      title: it.label, cls: 'context', items: it.actions.map(a => ({
        label: a.n, fn: () => {
          this.pop();
          if (a.hold) { this.fade(() => a.fn(), ''); } else a.fn();
        },
      })),
    });
  },

  /* ================= RADAR ================= */
  /* Pirinç kadranlı minimap: 224 px (iki kat çözünürlükte çizilir), harita dairesi r=100,
     dışında deri bant: yön harfleri, derece çentikleri ve dairenin dışında kalan önemli hedefler
     (görev, hedef işareti, ödül, atın, yük araban) bandın üzerinde, doğru yönde gösterilir. */
  drawRadar() {
    const c = this.rctx, W = G.world, P = G.player;
    if (!W || !P) return;
    const L = 224, C = 112, R = 100;
    const xk = this.hudXk || 0;                                   // genişletilmiş radar (D-pad ↓): daha geniş alan
    const z = (P.riding ? 1.35 : 1.8) * lerp(1, 0.42, xk); // px / karo
    const tx = P.x / TS, ty = P.y / TS;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, L, L);
    c.save();
    c.beginPath(); c.arc(C, C, R, 0, TAU); c.clip();
    c.fillStyle = '#c9b48a'; c.fillRect(0, 0, L, L);
    c.imageSmoothingEnabled = z < 1.6;
    const span = 2 * R / z, ms = W.mapScale || 1;
    c.drawImage(W.mapCanvas, (tx - span / 2) * ms, (ty - span / 2) * ms, span * ms, span * ms, C - R, C - R, 2 * R, 2 * R);
    c.imageSmoothingEnabled = true;
    const toR = (wx, wy) => [C + (wx / TS - tx) * z, C + (wy / TS - ty) * z];
    // yollar ve demiryolu (vektörel)
    const lim = span * TS * 0.75;
    const poly = (pts, step) => { c.beginPath(); let on = false; for (let k = 0; k < pts.length; k += step) { const q = pts[k]; if (Math.abs(q[0] - P.x) > lim || Math.abs(q[1] - P.y) > lim) { on = false; continue; } const [x, y] = toR(q[0], q[1]); if (on) c.lineTo(x, y); else { c.moveTo(x, y); on = true; } } c.stroke(); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const r of W.roads) { c.strokeStyle = 'rgba(92,62,36,0.85)'; c.lineWidth = r.spur ? 1.6 : 2.6; poly(r.pts, 2); c.strokeStyle = 'rgba(214,190,140,0.9)'; c.lineWidth = r.spur ? 0.6 : 1.1; poly(r.pts, 2); }
    c.strokeStyle = 'rgba(30,24,20,0.8)'; c.lineWidth = 1.2;
    for (const l of W.lines) poly(l.pts, 2);
    c.drawImage(G.fogCanvas, (tx - span / 2) / 4, (ty - span / 2) / 4, span / 4, span / 4, C - R, C - R, 2 * R, 2 * R);
    // gece: kâğıt mürekkep mavisine kararır (göz yormaz)
    const night = 1 - G.daylight;
    if (night > 0.02) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.62 * night; c.fillStyle = '#48527a'; c.fillRect(C - R, C - R, 2 * R, 2 * R); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    // aranma alanı
    if (G.law.level > 0) {
      const [lx, ly] = toR(G.law.lastX, G.law.lastY);
      c.fillStyle = 'rgba(180,20,20,0.22)'; c.strokeStyle = 'rgba(200,30,30,0.7)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(lx, ly, G.law.radius / TS * z, 0, TAU); c.fill(); c.stroke();
    }
    // GPS
    if (G.gps && G.gps.length > 1) {
      c.strokeStyle = 'rgba(160,40,160,0.85)'; c.lineWidth = 3; c.lineJoin = 'round';
      c.beginPath();
      let started = false;
      let bestI = 0, bd = 1e18;
      for (let i = 0; i < G.gps.length; i++) { const d = dist2(G.gps[i][0], G.gps[i][1], P.x, P.y); if (d < bd) { bd = d; bestI = i; } }
      c.moveTo(C, C);
      for (let i = bestI; i < G.gps.length; i++) { const [x, y] = toR(G.gps[i][0], G.gps[i][1]); c.lineTo(x, y); started = true; }
      if (started) c.stroke();
    }
    // simgeler; edge: daire dışındaysa kadran bandında gösterilir
    const edges = [];
    const icon = (wx, wy, g, col, bg, sz = 13, edge) => {
      const [x, y] = toR(wx, wy);
      const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
      if (d > R - 8) { if (edge) edges.push({ a: Math.atan2(dy, dx), g, col: col || '#fff', bg: bg || 'rgba(26,18,12,0.95)', q: edge === 'quest' }); return; }
      c.fillStyle = bg || 'rgba(26,18,12,0.85)'; c.beginPath(); c.arc(x, y, sz * 0.62, 0, TAU); c.fill();
      const im = Icons.img(g, col || '#efe6d2', 32);
      if (im && im.complete) c.drawImage(im, x - sz * 0.42, y - sz * 0.42, sz * 0.84, sz * 0.84);
    };
    for (const b of W.buildings) {
      if (Math.abs(b.door.x - P.x) > 900 || Math.abs(b.door.y - P.y) > 900 || (xk > 0.5 && b.town)) continue;   // genişken kasaba adı yeterli
      const ic = BICON[b.type];
      if (ic && (RADAR_B.has(b.type) || b.lot) && (b.town ? G.visited.has(b.town) : true)) icon(b.door.x, b.door.y, ic, '#efe6d2', G.bizOf(b) ? 'rgba(150,110,20,0.95)' : null, 15);
    }
    for (const p of W.pois) {
      if (!G.discovered.has(p.id) && !G.rumored.has(p.id)) continue;
      icon(p.x, p.y, G.rumored.has(p.id) && !G.discovered.has(p.id) ? 'question' : (PICON[p.kind === 'landmark' ? p.type : p.kind] || 'eye'), '#efe6d2', p.kind === 'camp' ? 'rgba(130,20,14,0.9)' : null);
    }
    if (G.camp) icon(G.camp.x, G.camp.y, 'tent', '#efe6d2');
    if (G.myWagon && P.riding !== G.myWagon) icon(G.myWagon.x, G.myWagon.y, 'bag', '#f0d8a8', 'rgba(60,36,20,0.95)', 13, true);
    if (G.nomads) for (const nc of G.nomads) if (nc.era >= 0 && G.discovered.has(G.nomadId(nc))) icon(nc.x, nc.y, 'tent', '#f0e4c8', 'rgba(120,80,20,0.9)', 13);
    if (G.activeBounty && !G.activeBounty.done && G.activeBounty.status !== 'carried') icon(G.activeBounty.bx || G.activeBounty.x, G.activeBounty.by || G.activeBounty.y, 'skull', '#fff', 'rgba(150,20,20,0.95)', 15, true);
    if (G.waypoint) icon(G.waypoint.x, G.waypoint.y, 'waypoint', '#fff', 'rgba(140,40,140,0.95)', 15, true);
    const qm = G.questMark();
    if (qm) {
      const [qx, qy] = toR(qm.x, qm.y);
      if (Math.hypot(qx - C, qy - C) <= R - 8) { const pr = 9 + (Math.sin(G.t * 4) * 0.5 + 0.5) * 4; c.strokeStyle = 'rgba(240,200,90,0.75)'; c.lineWidth = 1.5; c.beginPath(); c.arc(qx, qy, pr, 0, TAU); c.stroke(); }
      icon(qm.x, qm.y, 'star', '#fff', 'rgba(190,140,20,0.98)', 15, 'quest');
    }
    // canlılar
    for (const e of G.ents) {
      if (e.dead) continue;
      const [x, y] = toR(e.x, e.y);
      if (Math.hypot(x - C, y - C) > R - 4) { if (e === G.horse && !P.riding && !e.rider) icon(e.x, e.y, 'horse', '#f0d8a8', 'rgba(60,36,20,0.95)', 13, true); continue; }
      if (e.kind === 'npc') {
        if (e.witness && !e.witness.done) { const im = Icons.img('witness', '#fff4dc', 32); c.fillStyle = 'rgba(200,120,20,0.95)'; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); if (im.complete) c.drawImage(im, x - 4.5, y - 4.5, 9, 9); }
        else if (e.hostile && (e.aggro || e.isLaw)) { c.fillStyle = e.isLaw ? '#e0e0ff' : '#e02020'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); c.strokeStyle = e.isLaw ? '#2040c0' : '#400'; c.lineWidth = 1; c.stroke(); }
        else if (e.role === 'romance' || e.role === 'spouse') { const im = Icons.img('heart', '#e06090', 32); if (im.complete) c.drawImage(im, x - 5, y - 5, 10, 10); }
        else if (e.role === 'stranger') { const im = Icons.img('question', '#ffffff', 32); if (im.complete) c.drawImage(im, x - 5, y - 5, 10, 10); }
        else { c.fillStyle = 'rgba(40,30,20,0.55)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); }
      } else if (e.kind === 'animal' && e.state === 'attack') { c.fillStyle = '#e02020'; c.fillRect(x - 2, y - 2, 4, 4); }
      else if (e.kind === 'animal' && P.crouch) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); }
      else if (e === G.horse) { icon(e.x, e.y, 'horse', '#f0d8a8', 'rgba(60,36,20,0.9)', 13); }
    }
    for (const tr of G.trains) if (tr.pos[0]) { const [x, y] = toR(tr.pos[0][0], tr.pos[0][1]); if (Math.hypot(x - C, y - C) < R - 4) { c.fillStyle = '#222'; c.fillRect(x - 3, y - 3, 6, 6); } }
    // genişletilmiş radarda kasaba adları
    if (xk > 0.3) {
      c.globalAlpha = Math.min(1, (xk - 0.3) * 2);
      c.font = '12px "IM Fell English SC", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const t of W.towns) {
        if (!G.visited.has(t.id) && !G.reveal[((t.cy / TS / 4) | 0) * FW + ((t.cx / TS / 4) | 0)]) continue;
        const [x, y] = toR(t.cx, t.cy);
        if (Math.hypot(x - C, y - C) > R - 16) continue;
        c.lineWidth = 3; c.strokeStyle = 'rgba(236,224,196,0.9)'; c.strokeText(t.n, x, y - 10); c.fillStyle = '#2a1a0e'; c.fillText(t.n, x, y - 10);
      }
      c.globalAlpha = 1;
    }
    // kubbe gölgesi: kenarlara doğru koyulaşan kâğıt
    const vg = c.createRadialGradient(C, C, R * 0.58, C, C, R);
    vg.addColorStop(0, 'rgba(40,24,10,0)'); vg.addColorStop(1, 'rgba(40,24,10,0.42)');
    c.fillStyle = vg; c.fillRect(C - R, C - R, 2 * R, 2 * R);
    // oyuncu: önündeki bakış konisi ve ok
    c.translate(C, C); c.rotate(P.riding ? P.riding.ang : P.ang);
    const cone = c.createRadialGradient(0, 0, 3, 0, 0, 46);
    cone.addColorStop(0, 'rgba(255,248,226,0.5)'); cone.addColorStop(1, 'rgba(255,248,226,0)');
    c.fillStyle = cone; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 46, -0.5, 0.5); c.closePath(); c.fill();
    c.fillStyle = '#fffaf0'; c.strokeStyle = '#1a120b'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -6); c.lineTo(-2.5, 0); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    this.drawBezel(c, C, R, edges);
  },
  /* Radarın deri ve pirinç kadranı: çentikler, yön harfleri, bant üzerindeki uzak hedefler */
  drawBezel(c, C, R, edges) {
    const R2 = 111;
    c.save();
    const bg = c.createLinearGradient(0, C - R2, 0, C + R2);
    bg.addColorStop(0, '#33251a'); bg.addColorStop(0.5, '#1d150e'); bg.addColorStop(1, '#100b07');
    c.fillStyle = bg; c.beginPath(); c.arc(C, C, R2, 0, TAU); c.arc(C, C, R + 0.5, 0, TAU, true); c.fill();
    // çentikler: her 10°, her 30° uzun
    c.lineCap = 'round';
    for (let d = 0; d < 360; d += 10) {
      if (d % 90 === 0) continue;
      const a = d * Math.PI / 180 - Math.PI / 2, long = d % 30 === 0, r0 = R + 3, r1 = R + (long ? 8.5 : 5.5);
      c.strokeStyle = long ? 'rgba(232,206,150,0.75)' : 'rgba(201,164,92,0.45)'; c.lineWidth = long ? 1.2 : 0.8;
      c.beginPath(); c.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); c.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); c.stroke();
    }
    // pirinç kenarlar: dışta kalın, içte ince; ışığı sol üstten alan metal
    const mg = c.createLinearGradient(C - R2, C - R2, C + R2, C + R2);
    mg.addColorStop(0, '#f6dc96'); mg.addColorStop(0.3, '#9a7230'); mg.addColorStop(0.55, '#e6c47a'); mg.addColorStop(0.8, '#7a5420'); mg.addColorStop(1, '#c9a45c');
    c.strokeStyle = mg; c.lineWidth = 2.4; c.beginPath(); c.arc(C, C, R2 - 0.9, 0, TAU); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.arc(C, C, R + 0.6, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 1; c.beginPath(); c.arc(C, C, R2 + 0.4, 0, TAU); c.stroke();
    // yön harfleri
    const lt = [Tr('@pusula|K'), Tr('@pusula|D'), Tr('@pusula|G'), Tr('@pusula|B')];
    c.font = 'bold 9px "IM Fell English SC", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    lt.forEach((t, i) => {
      const a = i * Math.PI / 2 - Math.PI / 2, x = C + Math.cos(a) * (R + 5.6), y = C + Math.sin(a) * (R + 5.6);
      if (i === 0) { c.fillStyle = '#8e1b12'; c.beginPath(); c.arc(x, y, 5.6, 0, TAU); c.fill(); c.strokeStyle = 'rgba(240,212,135,0.9)'; c.lineWidth = 0.8; c.stroke(); }
      c.fillStyle = i === 0 ? '#fff3d6' : 'rgba(236,216,172,0.92)'; c.fillText(t, x, y + 0.4);
    });
    // uzaktaki hedefler bandın üzerinde
    for (const e of edges) {
      const x = C + Math.cos(e.a) * (R + 5.6), y = C + Math.sin(e.a) * (R + 5.6), r = e.q ? 7 + Math.sin(G.t * 5) * 0.8 : 6.2;
      c.fillStyle = e.bg; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = e.q ? 'rgba(255,236,170,0.95)' : 'rgba(240,212,135,0.75)'; c.lineWidth = 1; c.stroke();
      const im = Icons.img(e.g, e.col, 32);
      if (im && im.complete) c.drawImage(im, x - r * 0.68, y - r * 0.68, r * 1.36, r * 1.36);
    }
    c.restore();
  },

  /* ================= HARİTA ================= */
  openMap(focusX, focusY) {
    const scr = $('#mapscreen');
    scr.classList.remove('hidden');
    const P = G.player;
    this.map.cx = (focusX !== undefined ? focusX : P.x) / TS; this.map.cy = (focusY !== undefined ? focusY : P.y) / TS;
    if (!this.map.zoomSet) { this.map.zoom = 1.3; this.map.zoomSet = true; }
    const m = this.makeModal(scr, { customInput: true, keepEl: true, noFocus: true, transparent: true, onClose: () => scr.classList.add('hidden') });
    m.update = (dt) => this.mapUpdate(dt, m);
    this.stack.push(m);
    this.updatePauseState();
    this.mapResize();
    this.mapDirty = true;
    this.map.lg = -1; this.map.lgPick = null;
    const lg = $('#map-legend');
    const lbg = { tent: 'radial-gradient(circle at 40% 35%, #a02418, #5a0e08)', waypoint: 'radial-gradient(circle at 40% 35%, #a03aa0, #5a145a)', question: 'radial-gradient(circle at 40% 35%, #6a5a3a, #2a2014)' };
    lg.innerHTML = `<div class="ml-t">${Tr`Açıklamalar`}</div>` + mapLegend().map(([a, b], i) => `<div class="ml-i" data-i="${i}"><span${lbg[a] ? ` style="background:${lbg[a]}"` : ''}>${Icons.glyph(a, '#f0e4c8')}</span>${b}</div>`).join('');
    this._mme = null; this.mapMeT = 0;
    $$('.ml-i', lg).forEach(n => { n.onclick = (e) => { e.stopPropagation(); this.mapLegendPick(+n.dataset.i); }; });
  },
  /* Açıklamadaki bir türün haritada bilinen yerleri (oyuncuya yakından uzağa) */
  mapLegendTargets(key) {
    const W = G.world, P = G.player, out = [];
    const known = (t) => G.visited.has(t.id) || G.reveal[((t.cy / TS / 4) | 0) * FW + ((t.cx / TS / 4) | 0)];
    const types = MAP_LEGEND_B[key];
    if (types) for (const t of W.towns) if (known(t)) for (const b of t.buildings) if (types.includes(b.type)) out.push({ x: b.door.x, y: b.door.y, n: b.name });
    const poi = (f) => { for (const p of W.pois) if (f(p, G.discovered.has(p.id), G.rumored.has(p.id))) out.push({ x: p.x, y: p.y, n: p.n }); };
    if (key === 'house') poi((p, k) => k && (p.kind === 'property' || p.kind === 'home'));
    else if (key === 'tent') poi((p, k) => k && p.kind === 'camp');
    else if (key === 'eye') poi((p, k) => k && !['camp', 'property', 'home'].includes(p.kind));
    else if (key === 'question') poi((p, k, r) => r && !k);
    else if (key === 'waypoint' && G.waypoint) out.push({ x: G.waypoint.x, y: G.waypoint.y, n: Tr('Hedef'), keep: true });
    return out.sort((a, b) => dist2(a.x, a.y, P.x, P.y) - dist2(b.x, b.y, P.x, P.y));
  },
  /* Açıklamadan bir tür seç: en yakın bilinen yeri işaretle; aynı türü yeniden seçmek sıradakine geçer */
  mapLegendPick(i) {
    const M = this.map, [key, label] = mapLegend()[i];
    const ts = this.mapLegendTargets(key);
    this.mapLegendFocus(i);
    if (!ts.length) { Audio_.ui('error'); this.feed(Tr`Haritada bilinen bir yer yok: ${label}`, 'warn'); return null; }
    const k = M.lgPick && M.lgPick.i === i ? (M.lgPick.k + 1) % ts.length : 0;
    M.lgPick = { i, k };
    const t = ts[k];
    M.cx = t.x / TS; M.cy = t.y / TS; M.zoom = Math.max(M.zoom, 2.2); this.mapDirty = true;
    if (!t.keep) { G.setWaypoint(t.x, t.y); this.feed(Tr`📍 Hedef: ${t.n}${ts.length > 1 ? ` (${k + 1}/${ts.length})` : ''}`); }
    return t;
  },
  mapLegendFocus(i) {
    this.map.lg = i;
    $$('#map-legend .ml-i').forEach(n => n.classList.toggle('on', +n.dataset.i === i));
  },
  mapResize() {
    const c = this.mapCanvas, d = window.devicePixelRatio || 1;
    c.width = innerWidth * d; c.height = innerHeight * d;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    this.mapDPR = d;
  },
  setupMapMouse() {
    const c = $('#mapcanvas');
    c.addEventListener('mousedown', e => { this.map.drag = { x: e.clientX, y: e.clientY, cx: this.map.cx, cy: this.map.cy, moved: false }; });
    window.addEventListener('mousemove', e => {
      const d = this.map.drag;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      this.map.cx = d.cx - dx / this.map.zoom; this.map.cy = d.cy - dy / this.map.zoom;
      this.mapDirty = true;
    });
    window.addEventListener('mouseup', e => {
      const d = this.map.drag;
      this.map.drag = null;
      if (!d || d.moved || this.top() === undefined || $('#mapscreen').classList.contains('hidden')) return;
      const [wx, wy] = this.mapToWorld(e.clientX, e.clientY);
      if (e.button === 2) G.setWaypoint(null); else this.mapSetWaypoint(wx, wy);
      this.mapDirty = true;
    });
    c.addEventListener('wheel', e => { e.preventDefault(); this.map.zoom = clamp(this.map.zoom * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 8); this.mapDirty = true; }, { passive: false });
  },
  mapToWorld(sx, sy) {
    const M = this.map;
    return [(M.cx + (sx - innerWidth / 2) / M.zoom) * TS, (M.cy + (sy - innerHeight / 2) / M.zoom) * TS];
  },
  mapSetWaypoint(wx, wy) {
    // yakın bir simgeye yapış
    let best = null, bd = (30 / this.map.zoom * TS) ** 2;
    for (const p of G.world.pois) if (G.discovered.has(p.id) || G.rumored.has(p.id)) { const d = dist2(p.x, p.y, wx, wy); if (d < bd) { bd = d; best = p; } }
    if (best) { wx = best.x; wy = best.y; }
    G.setWaypoint(wx, wy);
    this.feed(Tr('📍 Hedef işaretlendi'));
  },
  mapUpdate(dt, m) {
    const I = Input, M = this.map;
    if (m.born >= this.frame - 1) return;
    const mv = I.moveVec();
    if (mv.m > 0) { M.cx += mv.x * mv.m * dt * 500 / M.zoom; M.cy += mv.y * mv.m * dt * 500 / M.zoom; this.mapDirty = true; if (M.lg >= 0 && I.device === 'pad') this.mapLegendFocus(-1); }
    // açıklamalarda gezinme: yön tuşu yukarı/aşağı, ✕ ile işaretle
    const dU = I.padTap(PS.UP), dD = I.padTap(PS.DOWN);
    if (dU || dD) { this.mapLegendFocus(M.lg < 0 ? (dU ? mapLegend().length - 1 : 0) : (M.lg + (dU ? -1 : 1) + mapLegend().length) % mapLegend().length); Audio_.ui('move'); }
    const a = I.aimVec();
    if (Math.abs(a.y) > 0.2) { M.zoom = clamp(M.zoom * (1 - a.y * dt * 2), 0.5, 8); this.mapDirty = true; }
    if (I.down('fire') && I.device === 'pad') { M.zoom = clamp(M.zoom * (1 + dt * 2), 0.5, 8); this.mapDirty = true; }
    if (I.down('aim') && I.device === 'pad') { M.zoom = clamp(M.zoom * (1 - dt * 2), 0.5, 8); this.mapDirty = true; }
    M.cx = clamp(M.cx, 0, WW); M.cy = clamp(M.cy, 0, WH);
    if (I.pressed('confirm') && I.device === 'pad' && M.lg >= 0) { this.mapLegendPick(M.lg); this.mapDirty = true; }
    else if (I.pressed('confirm') && I.device === 'pad') { const [wx, wy] = this.mapToWorld(innerWidth / 2, innerHeight / 2); this.mapSetWaypoint(wx, wy); this.mapDirty = true; }
    if (I.pressed('alt')) { G.setWaypoint(null); this.mapDirty = true; this.feed(Tr('Hedef kaldırıldı')); }
    if (I.pressed('alt2') && I.device === 'pad') { M.cx = G.player.x / TS; M.cy = G.player.y / TS; this.mapDirty = true; }
    if (I.pressed('back') || I.pressed('map')) { this.pop(m); return; }
    $('#map-cursor').style.display = I.device === 'pad' ? 'block' : 'none';
    if ((this.mapMeT -= dt) <= 0) { this.mapMeT = 0.5; const h = this.mapMe(); if (this._mme !== h) { this._mme = h; $('#map-me').innerHTML = h; } }
    this.mapHover();
    this.drawMap();
  },
  mapHover() {
    const I = Input;
    const sx = I.device === 'pad' ? innerWidth / 2 : I.mouse.x, sy = I.device === 'pad' ? innerHeight / 2 : I.mouse.y;
    const [wx, wy] = this.mapToWorld(sx, sy);
    let best = null, bd = (26 / this.map.zoom * TS) ** 2;
    for (const p of G.world.pois) if (G.discovered.has(p.id) || G.rumored.has(p.id)) { const d = dist2(p.x, p.y, wx, wy); if (d < bd) { bd = d; best = p; } }
    for (const t of G.world.towns) if (G.visited.has(t.id) || G.reveal[((t.cy / TS / 4) | 0) * FW + ((t.cx / TS / 4) | 0)]) { const d = dist2(t.cx, t.cy, wx, wy); if (d < bd * 4) { bd = d / 4; best = { n: t.n, desc: t.desc + (G.visited.has(t.id) ? '' : Tr(' (Henüz ziyaret edilmedi)')) }; } }
    let html = '';
    if (best) html = `<div class="mi-n">${best.n}</div><div class="mi-d">${best.desc || ''}${G.rumored.has(best.id) && !G.discovered.has(best.id) ? Tr(' <i>(söylenti)</i>') : ''}</div>`;
    else html = `<div class="mi-n">${G.world.regionAt(wx, wy)}</div>`;
    if (this._mh !== html) { this._mh = html; $('#map-info').innerHTML = html; }
    const hint = Tr`${Input.device === 'pad' ? Input.padGlyph(PS.UP) + Input.padGlyph(PS.DOWN) + Tr(' Açıklamalar &nbsp; ') + Input.glyph('confirm') + Tr(' Hedef Koy &nbsp; ') + Input.glyph('alt') + Tr(' Hedefi Kaldır &nbsp; ') + Input.padGlyph(PS.R2) + Input.padGlyph(PS.L2) + Tr(' Yakınlaştır &nbsp; ') + Input.glyph('alt2') + Tr(' Konumum') : Tr('Sol Tık: Hedef Koy &nbsp; Açıklamaya Tık: En Yakın Yer &nbsp; Sağ Tık / X: Kaldır &nbsp; Tekerlek: Yakınlaştır &nbsp; Sürükle: Kaydır')} &nbsp; ${Input.glyph('back')} Kapat`;
    if (this._mhint !== hint) { this._mhint = hint; $('#map-hint').innerHTML = hint; }
  },
  drawMap() {
    const c = this.mctx, W = G.world, M = this.map, d = this.mapDPR;
    const w = innerWidth, h = innerHeight;
    c.setTransform(d, 0, 0, d, 0, 0);
    // masa: koyu deri, haritanın çevresinde yanık kenarlı kâğıt
    c.fillStyle = '#3a2a1c'; c.fillRect(0, 0, w, h);
    const ox = w / 2 - M.cx * M.zoom, oy = h / 2 - M.cy * M.zoom, mw = WW * M.zoom, mh = WH * M.zoom;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 30; c.fillStyle = '#d8c49c'; c.fillRect(ox - 14, oy - 14, mw + 28, mh + 28); c.restore();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(W.mapCanvas, ox, oy, mw, mh);
    const toS = (wx, wy) => [ox + wx / TS * M.zoom, oy + wy / TS * M.zoom];
    const revealed = (wx, wy) => G.reveal[((wy / TS / 4) | 0) * FW + ((wx / TS / 4) | 0)];
    // yollar: çift çizgi (mürekkep kenar, kâğıt içi); patikalar kesikli
    const x0 = -40, y0 = -40, x1 = w + 40, y1 = h + 40;
    const poly = (pts, step) => { c.beginPath(); let on = false; for (let k = 0; k < pts.length; k += step) { const [x, y] = toS(pts[k][0], pts[k][1]); if (x < x0 || y < y0 || x > x1 || y > y1) { if (on) c.lineTo(x, y); on = false; continue; } if (on) c.lineTo(x, y); else { c.moveTo(x, y); on = true; } } c.stroke(); };
    const st = M.zoom < 1 ? 4 : M.zoom < 2.5 ? 2 : 1;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const rw = clamp(M.zoom * 1.5, 1.8, 7);
    for (const r of W.roads) {
      if (r.spur) { c.strokeStyle = 'rgba(92,62,36,0.8)'; c.lineWidth = rw * 0.45; c.setLineDash([rw * 1.2, rw]); poly(r.pts, st); c.setLineDash([]); continue; }
      c.strokeStyle = 'rgba(80,52,30,0.9)'; c.lineWidth = rw; poly(r.pts, st);
      c.strokeStyle = 'rgba(226,204,160,0.95)'; c.lineWidth = rw * 0.45; poly(r.pts, st);
    }
    // demiryolu: siyah hat ve traversler
    for (const l of W.lines) {
      c.strokeStyle = 'rgba(28,22,18,0.9)'; c.lineWidth = Math.max(1.2, M.zoom * 0.5); poly(l.pts, st);
      c.lineWidth = Math.max(4, M.zoom * 2); c.setLineDash([1.2, Math.max(4, M.zoom * 3)]); poly(l.pts, st); c.setLineDash([]);
    }
    // enlem-boylam ızgarası: iki milde bir (uzaktan bakınca dört)
    const gstep = (M.zoom * 62.8 < 46 ? 125.6 : 62.8) * M.zoom;
    c.strokeStyle = 'rgba(96,62,30,0.13)'; c.lineWidth = 1;
    c.beginPath();
    for (let x = ox + gstep; x < ox + mw; x += gstep) if (x > -2 && x < w + 2) { c.moveTo(Math.round(x) + 0.5, Math.max(oy, 0)); c.lineTo(Math.round(x) + 0.5, Math.min(oy + mh, h)); }
    for (let y = oy + gstep; y < oy + mh; y += gstep) if (y > -2 && y < h + 2) { c.moveTo(Math.max(ox, 0), Math.round(y) + 0.5); c.lineTo(Math.min(ox + mw, w), Math.round(y) + 0.5); }
    c.stroke();
    c.imageSmoothingEnabled = true;
    this.drawMapFog(c, ox, oy, mw, mh, w, h);
    // kenar gölgesi ve çift çerçeve
    c.strokeStyle = 'rgba(60,36,18,0.85)'; c.lineWidth = 2; c.strokeRect(ox - 6, oy - 6, mw + 12, mh + 12);
    c.strokeStyle = 'rgba(60,36,18,0.5)'; c.lineWidth = 1; c.strokeRect(ox - 10, oy - 10, mw + 20, mh + 20);
    // bölge isimleri: aralıklı italik, kâğıt rengi kenarla okunur
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `italic ${Math.round(16 + M.zoom * 4)}px "IM Fell English", serif`;
    for (const r of REGIONS) {
      if (!inWorld(r)) continue;
      const [x, y] = toS(r.x * WW * TS, r.y * WH * TS);
      const txt = r.n.toUpperCase().split('').join(' ');
      c.lineWidth = 3; c.strokeStyle = 'rgba(232,218,184,0.45)'; c.strokeText(txt, x, y);
      c.fillStyle = 'rgba(60,40,20,0.5)'; c.fillText(txt, x, y);
    }
    // GPS
    if (G.gps) {
      c.strokeStyle = 'rgba(150,40,150,0.8)'; c.lineWidth = 3; c.setLineDash([6, 4]);
      c.beginPath(); G.gps.forEach((p, i) => { const [x, y] = toS(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.setLineDash([]);
    }
    // aranma
    if (G.law.level > 0) { const [x, y] = toS(G.law.lastX, G.law.lastY); c.fillStyle = 'rgba(180,20,20,0.2)'; c.beginPath(); c.arc(x, y, G.law.radius / TS * M.zoom, 0, TAU); c.fill(); }
    // kasabalar
    for (const t of W.towns) {
      if (!revealed(t.cx, t.cy) && !G.visited.has(t.id)) continue;
      const [x, y] = toS(t.cx, t.cy);
      // kasaba adı küçük bir kâğıt etiket üzerinde
      const fs = Math.round(13 + M.zoom * 2.5), ly = y - 18 - M.zoom * 4;
      c.font = `${fs}px "IM Fell English SC", serif`;
      const tw = c.measureText(t.n).width + fs * 0.9;
      c.fillStyle = 'rgba(236,224,196,0.88)'; c.fillRect(x - tw / 2, ly - fs * 0.62, tw, fs * 1.24);
      c.strokeStyle = 'rgba(70,44,22,0.7)'; c.lineWidth = 1; c.strokeRect(x - tw / 2 + 2.5, ly - fs * 0.62 + 2.5, tw - 5, fs * 1.24 - 5);
      c.fillStyle = '#2a1a0e'; c.fillText(t.n, x, ly + 1);
      if (M.zoom > 1.8) {
        for (const l of t.lots || []) { const [lx, ly2] = toS((l.x + l.w / 2) * TS, (l.y + l.h / 2) * TS); c.fillStyle = 'rgba(40,90,40,0.85)'; c.beginPath(); c.arc(lx, ly2, 10, 0, TAU); c.fill(); c.fillStyle = '#efe6d2'; c.font = 'bold 13px serif'; c.fillText('$', lx, ly2 + 1); c.font = `${fs}px "IM Fell English SC", serif`; }
        for (const b of t.buildings) { const ic = BICON[b.type]; if (!ic) continue; const [bx, by] = toS(b.door.x, b.door.y); c.fillStyle = 'rgba(30,20,12,0.85)'; c.beginPath(); c.arc(bx, by, 12, 0, TAU); c.fill(); const im = Icons.img(ic, '#efe6d2', 32); if (im.complete) c.drawImage(im, bx - 8.5, by - 8.5, 17, 17); }
      }
    }
    // yerler
    c.font = '13px serif';
    for (const p of W.pois) {
      const known = G.discovered.has(p.id), rum = G.rumored.has(p.id);
      let show = known || rum;
      if (!show && G.hasPerk('explore20') && dist(p.x, p.y, G.player.x, G.player.y) < 2500) { const [x, y] = toS(p.x, p.y); const im = Icons.img('question', 'rgba(40,20,10,0.55)', 32); if (im.complete) c.drawImage(im, x - 7, y - 7, 14, 14); continue; }
      if (!show) continue;
      const [x, y] = toS(p.x, p.y);
      c.fillStyle = p.kind === 'camp' ? 'rgba(150,20,20,0.85)' : 'rgba(40,24,12,0.85)';
      c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
      const im = Icons.img(rum && !known ? 'question' : (PICON[p.kind === 'landmark' ? p.type : p.kind] || 'eye'), '#f0e4c8', 32);
      if (im.complete) c.drawImage(im, x - 6.5, y - 6.5, 13, 13);
      if (M.zoom > 2.2 && known) { c.font = 'italic 12px "IM Fell English", serif'; c.fillStyle = '#2a1a0e'; c.fillText(p.n, x, y + 17); c.font = '13px serif'; }
      if ((p.kind === 'property' && G.props.includes(p.prop)) || p.kind === 'home') { c.strokeStyle = '#e8c860'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.stroke(); }
    }
    // göçebe kamplar (keşfedilmiş, güncel yerleri)
    if (G.nomads) for (const nc of G.nomads) {
      if (nc.era < 0 || !G.discovered.has(G.nomadId(nc))) continue;
      const [x, y] = toS(nc.x, nc.y);
      c.fillStyle = 'rgba(120,80,20,0.9)'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
      const im = Icons.img('tent', '#f0e4c8', 32); if (im.complete) c.drawImage(im, x - 6.5, y - 6.5, 13, 13);
      if (M.zoom > 2.2) { c.font = 'italic 12px "IM Fell English", serif'; c.fillStyle = '#2a1a0e'; c.fillText(nc.n, x, y + 17); c.font = '13px serif'; }
    }
    // demiryolu istasyonları
    // hazine
    if (G.treasure && G.player.has('treasure_map')) { const [x, y] = toS(G.treasure.x + G.treasure.ox || G.treasure.x, G.treasure.y); c.strokeStyle = 'rgba(140,20,10,0.6)'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, 180 / TS * M.zoom * 4, 0, TAU); c.stroke(); c.setLineDash([]); }
        const badge = (wx, wy, g, bg, col = '#fff', r = 10) => { const [x, y] = toS(wx, wy); c.fillStyle = bg; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); const im = Icons.img(g, col, 32); if (im.complete) c.drawImage(im, x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44); };
    if (G.activeBounty && !G.activeBounty.done && G.activeBounty.status !== 'carried') badge(G.activeBounty.bx || G.activeBounty.x, G.activeBounty.by || G.activeBounty.y, 'skull', 'rgba(150,20,20,0.9)');
    if (G.camp) badge(G.camp.x, G.camp.y, 'tent', 'rgba(30,20,12,0.85)', '#efe6d2');
    // işletmelerin (altın) ve yük araban
    for (const z of G.biz) { if (z.site) { const l = W.lots.find(x => x.id === z.lot); if (l) badge((l.x + l.w / 2) * TS, (l.y + l.h / 2) * TS, 'pick', 'rgba(170,130,30,0.95)', '#fff', 9); continue; } const b = G.bizBuilding(z); if (b) badge(b.door.x, b.door.y, BICON[b.type] || 'store', 'rgba(170,130,30,0.95)', '#fff', 9); }
    if (G.myWagon && G.player.riding !== G.myWagon) badge(G.myWagon.x, G.myWagon.y, 'bag', 'rgba(60,36,20,0.9)', '#f0d8a8', 9);
    for (const h of G.haulers) badge(h.x, h.y, 'wagon', h.state === 'raid' ? 'rgba(160,20,14,0.95)' : 'rgba(40,70,90,0.9)', '#f0e4c8', 9);
    for (const R of G.raids) badge(R.x, R.y, 'skull', 'rgba(160,20,14,0.95)', '#fff', 11);
    if (G.horse && !G.horse.dead) badge(G.horse.x, G.horse.y, 'horse', 'rgba(60,36,20,0.9)', '#f0d8a8');
    if (G.waypoint) badge(G.waypoint.x, G.waypoint.y, 'waypoint', 'rgba(140,40,140,0.95)');
    const qm = G.questMark();
    const pulse = Math.sin(performance.now() / 260) * 0.5 + 0.5;
    if (qm) { const [qx, qy] = toS(qm.x, qm.y); c.strokeStyle = `rgba(190,140,20,${0.8 - pulse * 0.5})`; c.lineWidth = 2; c.beginPath(); c.arc(qx, qy, 14 + pulse * 7, 0, TAU); c.stroke(); badge(qm.x, qm.y, 'star', 'rgba(190,140,20,0.95)', '#fff', 11); }
    // oyuncu: koyu rozet, pirinç kenar, nabız gibi atan halka ve yön oku
    const P = G.player;
    const [px, py] = toS(P.x, P.y);
    c.strokeStyle = `rgba(255,250,235,${0.85 - pulse * 0.6})`; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 15 + pulse * 9, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(20,13,8,0.92)'; c.beginPath(); c.arc(px, py, 12, 0, TAU); c.fill();
    c.strokeStyle = '#e6c47a'; c.lineWidth = 2; c.stroke();
    c.save(); c.translate(px, py); c.rotate(P.riding ? P.riding.ang : P.ang);
    c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5.5, -5.5); c.lineTo(-2.5, 0); c.lineTo(-5.5, 5.5); c.closePath(); c.fill();
    c.restore();
    // çerçeve gölgesi
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,5,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    this.drawCompass(c, w - 104, h - 168, 58);
    // ölçek çubuğu: 1 mil ≈ 31 karo (yürüme istatistiğiyle aynı ölçek)
    const mile = 1609 / 3.2 / TS * M.zoom, miles = mile < 40 ? 5 : mile < 90 ? 2 : 1, bw = mile * miles;
    const sx = w - 44 - bw, sy = h - 56;
    c.fillStyle = 'rgba(236,224,196,0.85)'; c.fillRect(sx - 10, sy - 24, bw + 20, 36);
    c.strokeStyle = '#2a1a0e'; c.lineWidth = 1; c.strokeRect(sx - 10, sy - 24, bw + 20, 36);
    for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#efe2c0' : '#2a1a0e'; c.fillRect(sx + bw / 4 * k, sy, bw / 4, 5); }
    c.strokeRect(sx, sy, bw, 5);
    c.fillStyle = '#2a1a0e'; c.font = 'italic 13px "IM Fell English", serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(Tr`${miles} mil`, sx + bw / 2, sy - 7);
  },
  /* Keşfedilmemiş alan: taranmış eski kâğıt; açılan yerlerin kıyısına mürekkep gölgesi düşer.
     Katman yalnızca görünüm değişince yeniden kurulur (sürükleme ve yakınlaştırma). */
  drawMapFog(c, ox, oy, mw, mh, w, h) {
    const d = this.mapDPR || 1, key = [ox, oy, mw, w, h, d].map(v => Math.round(v * 10)).join('|') + '|' + (G.fogVer || 0);
    const mk = (n) => this[n] || (this[n] = document.createElement('canvas'));
    const L = mk('fogLayer'), A = mk('fogMask'), B = mk('fogBlur');
    if (L._k !== key) {
      L._k = key;
      for (const cv of [L, A]) if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
      const a = A.getContext('2d');
      a.setTransform(d, 0, 0, d, 0, 0); a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, w, h);
      a.imageSmoothingEnabled = true; a.drawImage(G.fogCanvas, ox, oy, mw, mh);
      a.globalCompositeOperation = 'source-in'; a.fillStyle = a.createPattern(this.fogTex(), 'repeat'); a.fillRect(0, 0, w, h);
      a.globalCompositeOperation = 'source-over';
      // gölge: sisin küçültülmüş (bulanık) koyu kopyası
      const k = 6, bw = Math.ceil(w / k), bh = Math.ceil(h / k);
      if (B.width !== bw || B.height !== bh) { B.width = bw; B.height = bh; }
      const b = B.getContext('2d');
      b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, bw, bh); b.imageSmoothingEnabled = true;
      b.drawImage(G.fogCanvas, ox / k, oy / k, mw / k, mh / k);
      b.globalCompositeOperation = 'source-in'; b.fillStyle = 'rgba(70,40,16,0.7)'; b.fillRect(0, 0, bw, bh);
      const f = L.getContext('2d');
      f.setTransform(d, 0, 0, d, 0, 0); f.clearRect(0, 0, w, h); f.imageSmoothingEnabled = true;
      f.drawImage(B, -k * 1.5, -k * 1.5, w + k * 3, h + k * 3);
      f.drawImage(A, 0, 0, w, h);
    }
    c.drawImage(L, 0, 0, w, h);
  },
  fogTex() {
    if (this._fogTex) return this._fogTex;
    const n = 192, T = document.createElement('canvas'); T.width = T.height = n;
    const t = T.getContext('2d'), R = new RNG(19);
    t.fillStyle = '#c2a97c'; t.fillRect(0, 0, n, n);
    for (let k = 0; k < 2400; k++) { const v = R.range(-1, 1); t.fillStyle = v > 0 ? `rgba(255,240,210,${(v * 0.14).toFixed(3)})` : `rgba(80,52,24,${(-v * 0.14).toFixed(3)})`; t.fillRect(R.range(0, n), R.range(0, n), R.range(1, 3), R.range(1, 3)); }
    t.strokeStyle = 'rgba(96,64,32,0.17)'; t.lineWidth = 1;
    for (let k = -n; k < n; k += 8) { t.beginPath(); t.moveTo(k, 0); t.lineTo(k + n, n); t.stroke(); }
    return (this._fogTex = T);
  },
  weatherName() {
    const env = G.envCache || {}, wt = G.weather.type;
    return (env.dust || 0) > 0.3 ? Tr('Kum fırtınası') : (env.snow || 0) > 0.3 ? Tr('Karlı') : ({ clear: Tr('Açık hava'), cloudy: Tr('Bulutlu'), rain: Tr('Yağmurlu'), storm: Tr('Fırtınalı'), fog: Tr('Sisli') })[wt] || '';
  },
  weatherGlyph() {
    const env = G.envCache || {}, wt = G.weather.type;
    return (env.snow || 0) > 0.3 ? 'snow' : wt === 'rain' || wt === 'storm' ? 'rain' : wt === 'cloudy' || wt === 'fog' ? 'cloud' : G.daylight < 0.35 ? 'moon' : 'sun';
  },
  /* Harita: sol alttaki konum kartı */
  mapMe() {
    const P = G.player, W = G.world, t = W.townAt(P.x, P.y, 20), reg = W.regionAt(P.x, P.y);
    const qm = G.questMark(), st = G.storyOn && qm ? G.qStep() : null;
    let q = '';
    if (st) q = `<div class="mme-q"><i></i>${st.t.call(G, G.story)}<span>${fmtDist(dist(P.x, P.y, qm.x, qm.y))}</span></div>`;
    else if (G.waypoint) q = `<div class="mme-q"><i></i>${Tr('Hedef işareti')}<span>${fmtDist(dist(P.x, P.y, G.waypoint.x, G.waypoint.y))}</span></div>`;
    return `<div class="mme-k">${Tr('Konumun')}</div><div class="mme-p">${t ? t.n : reg}</div>${t ? `<div class="mme-r">${reg}</div>` : ''}<div class="mme-t">${Icons.glyph(this.weatherGlyph(), '#efe6d2')}${this.weatherName()} • ${Math.round(G.feltTemp)}° • ${G.timeStr()} • ${G.dateStr()}</div>${q}`;
  },
  /* Süslü pusula gülü (harita köşesi) */
  drawCompass(c, x, y, r) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(236,224,196,0.8)'; c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(60,36,18,0.8)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.stroke();
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); c.lineTo(Math.cos(a) * r * (k % 2 ? 0.5 : 0.46), Math.sin(a) * r * (k % 2 ? 0.5 : 0.46)); c.stroke(); }
    const star = (len, wid, rot, dark, light) => {
      for (let k = 0; k < 4; k++) {
        const a = rot + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(a + Math.PI / 2), sp = Math.sin(a + Math.PI / 2);
        c.fillStyle = dark; c.beginPath(); c.moveTo(0, 0); c.lineTo(ca * len, sa * len); c.lineTo(cp * wid, sp * wid); c.closePath(); c.fill();
        c.fillStyle = light; c.beginPath(); c.moveTo(0, 0); c.lineTo(ca * len, sa * len); c.lineTo(-cp * wid, -sp * wid); c.closePath(); c.fill();
      }
    };
    star(r * 0.62, r * 0.09, Math.PI / 4, '#5a3c20', '#c8aa78');
    star(r, r * 0.13, -Math.PI / 2, '#2a1a0e', '#e8d8b0');
    c.fillStyle = '#8a1a10'; c.beginPath(); c.arc(0, 0, r * 0.05, 0, TAU); c.fill();
    c.fillStyle = '#2a1a0e'; c.font = `bold ${Math.round(r * 0.32)}px "IM Fell English SC", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(Tr('@pusula|K'), 0, -r * 1.2);
    c.restore();
  },

  /* ================= SİLAH / EŞYA ÇARKI (iki sayfa) ================= */
  wheelSlots(page) { return page === 0 ? WHEEL_SLOTS : ITEM_SLOTS; },
  /* Bir yuvadaki seçilebilir girdiler */
  wheelEntries(page, i) {
    const P = G.player, sl = this.wheelSlots(page)[i];
    if (!sl) return [];
    if (page === 0) return sl.w.filter(id => (id === 'dynamite' ? P.has('dynamite') : P.weapons.has(id))).map(id => ({ id, kind: 'w' }));
    const out = [];
    for (const v of sl.v || []) {
      if (v === '@canteen' && P.has('canteen')) out.push({ id: v, kind: 'v' });
      if (v === '@lantern' && P.has('lantern')) out.push({ id: v, kind: 'v' });
      if (v === '@harmonica' && P.has('harmonica')) out.push({ id: v, kind: 'v' });
    }
    for (const id in P.inv) { const it = ITEMS[id]; if (it && P.inv[id] > 0 && sl.f(id, it)) out.push({ id, kind: 'i' }); }
    return out;
  },
  wheelPickOf(page, i) {
    const P = G.player, E = this.wheelEntries(page, i);
    if (!E.length) return null;
    P.wheelPick = P.wheelPick || {};
    const key = page + ':' + i;
    let e = E.find(x => x.id === P.wheelPick[key]);
    if (!e && page === 0) e = E.find(x => x.id === P.weapon);
    return e || E[0];
  },
  wheelEntryInfo(e) {
    const P = G.player;
    if (e.kind === 'w') {
      const W = WEAPONS[e.id];
      return { n: W.n, ic: Icons.weapon(e.id, 'ic wpn'), am: W.clip ? `${P.clip[e.id] || 0}<span>|</span>${P.ammo[W.ammo]}` : W.throw ? `x${P.count('dynamite')}` : '' };
    }
    if (e.id === '@canteen') return { n: Tr('Matara'), ic: Icons.item('canteen'), am: `${P.canteen}/5`, d: P.canteen > 0 ? Tr('Bir yudum su iç. (Susuzluk +32)') : Tr('Matara boş. Bir kuyu ya da nehirde doldur.') };
    if (e.id === '@lantern') return { n: P.lantern ? Tr('Feneri Söndür') : Tr('Feneri Yak'), ic: Icons.item('lantern'), am: P.lantern ? Tr('Açık') : Tr('Kapalı'), d: Tr('Karanlıkta yolunu aydınlatır.') };
    if (e.id === '@harmonica') return { n: Tr('Mızıka Çal'), ic: Icons.item('harmonica'), am: '', d: Tr('Kısa bir ezgi çal. Ruhunu dinlendirir.') };
    const it = ITEMS[e.id];
    const worn = (P.coat === e.id) || (it.hat && P.look.hat === it.hat) || (it.mask && P.masked && P.mask === e.id);
    const EN = { hunger: Tr('Açlık'), thirst: Tr('Susuzluk'), health: Tr('Sağlık'), stamina: Tr('Dayanıklılık'), energy: Tr('Uyku'), deadeye: Tr('Odak'), warmth: Tr('Sıcaklık'), drunk: Tr('Sarhoşluk') };
    const fx = it.e ? Object.keys(it.e).filter(k => EN[k]).map(k => `${EN[k]} ${it.e[k] > 0 ? '+' : ''}${it.e[k]}`).join(' • ') : '';
    return { n: it.n, ic: Icons.item(e.id), am: it.c === 'clothing' ? (worn ? Tr('Giyili') : '') : `x${P.count(e.id)}`, d: fx || it.d || '', worn, raw: !!it.raw };
  },
  openWheel() {
    const w = $('#wheel');
    w.classList.remove('hidden'); document.body.classList.add('wheel-open');
    const P = G.player;
    this.wheelPage = 0;
    this.wheelSelP = this.wheelSelP || [0, 0];
    this.wheelSelP[0] = Math.max(0, WHEEL_SLOTS.findIndex(sl => sl.w.includes(P.weapon)));
    this.wheelOpenT = 0;
    this.coachLearn('wheel');
    Audio_.tone(500, 0.1, 'sine', 0.05);
    this.renderWheel();
  },
  renderWheel() {
    const page = this.wheelPage, S = this.wheelSlots(page), N = S.length;
    const rin = 96, rout = 232, gap = 0.035;
    const pt = (r, a) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
    let wedges = '', slots = '';
    S.forEach((sl, i) => {
      const ac = (i / N) * TAU - Math.PI / 2, a0 = ac - Math.PI / N + gap, a1 = ac + Math.PI / N - gap;
      const E = this.wheelEntries(page, i), e = this.wheelPickOf(page, i);
      wedges += `<path class="wh-w ${e ? '' : 'empty'}" data-i="${i}" d="M${pt(rin, a0)} L${pt(rout, a0)} A${rout} ${rout} 0 0 1 ${pt(rout, a1)} L${pt(rin, a1)} A${rin} ${rin} 0 0 0 ${pt(rin, a0)}Z"/>`;
      const cx = Math.cos(ac) * 166, cy = Math.sin(ac) * 166;
      const inf = e ? this.wheelEntryInfo(e) : null;
      const empty = page === 0 ? Icons.glyph('fist', 'rgba(239,230,210,0.18)') : Icons.glyph(sl.g, 'rgba(239,230,210,0.18)');
      const more = E.length > 1 ? `<div class="wh-more"><b>◀</b>${E.indexOf(E.find(x => x.id === e.id)) + 1}/${E.length}<b>▶</b></div>` : '';
      slots += `<div class="wh-slot ${e ? '' : 'empty'} ${page ? 'items' : ''}" data-i="${i}" style="left:calc(50% + ${cx.toFixed(1)}px);top:calc(50% + ${cy.toFixed(1)}px)">
        <div class="wh-ic">${inf ? inf.ic : empty}</div>
        <div class="wh-lab">${sl.n}</div>${inf && inf.am ? `<div class="wh-am">${inf.am}</div>` : ''}${more}</div>`;
    });
    $('#wheel-ring').innerHTML = `<svg class="wh-svg" viewBox="-260 -260 520 520">
        <defs><radialGradient id="whSel" cx="0" cy="0" r="240" gradientUnits="userSpaceOnUse"><stop offset="0.35" stop-color="#5a0a06"/><stop offset="1" stop-color="#b3180f"/></radialGradient>
        <radialGradient id="whBg" cx="0" cy="0" r="240" gradientUnits="userSpaceOnUse"><stop offset="0.35" stop-color="rgba(8,6,4,0.9)"/><stop offset="1" stop-color="rgba(24,18,12,0.86)"/></radialGradient></defs>
        <circle r="244" fill="none" stroke="rgba(201,164,92,0.22)" stroke-width="1.5"/>
        <circle r="250" fill="none" stroke="rgba(201,164,92,0.1)" stroke-width="6"/>
        ${wedges}
        <circle r="90" fill="rgba(10,8,6,0.94)" stroke="rgba(201,164,92,0.45)" stroke-width="1.5"/>
        <circle r="84" fill="none" stroke="rgba(201,164,92,0.15)" stroke-width="1"/>
        <path id="wh-ptr" d="M0 -100 L-9 -112 L9 -112Z" fill="#e6c27a"/>
      </svg>${slots}<div id="wheel-center" class="wh-center"></div>
      <div class="wh-tabs"><span class="${page === 0 ? 'on' : ''}">${Tr('Silahlar')}</span><i></i><span class="${page === 1 ? 'on' : ''}">${Tr('Eşyalar')}</span></div>`;
    const sc = Math.min(1.25, Math.min(innerWidth, innerHeight) * 0.86 / 540);
    $('#wheel-ring').style.transform = `scale(${sc.toFixed(3)})`;
    $('#wheel-hint').innerHTML = I_WHEEL_HINT(page);
    this._whSel = -1;
    this.drawWheelSel(true);
  },
  updateWheel(force) {
    const I = Input, P = G.player;
    const page = this.wheelPage, S = this.wheelSlots(page), N = S.length;
    this.wheelOpenT += 1;
    // sayfa değiştir: R1 (kol) / Q-E ya da sağ tık (klavye)
    if ((I.padTap(PS.R1) || (this.wheelOpenT > 2 && I.keyTap('KeyQ', 'KeyE')) || I.justMouse[2])) {
      this.wheelPage = 1 - page; Audio_.ui('move'); this.renderWheel(); return;
    }
    let sel = this.wheelSelP[page];
    let ang = null;
    if (I.device === 'pad') {
      const a = I.aimVec();                  // yalnızca sağ analog
      if (a.m > 0.55) ang = Math.atan2(a.y, a.x);
    } else {
      const dx = I.mouse.x - innerWidth / 2, dy = I.mouse.y - innerHeight / 2;
      if (Math.hypot(dx, dy) > 60) ang = Math.atan2(dy, dx);
    }
    if (ang !== null) { let i = Math.round(((ang + Math.PI / 2) / TAU) * N); sel = ((i % N) + N) % N; }
    this.wheelSelP[page] = sel;
    // aynı kategorideki girdiler arasında geç: D-Pad ←/→ (kol), tekerlek ya da ←/→ (klavye)
    let cyc = 0;
    if (I.padTap(PS.LEFT)) cyc = -1; else if (I.padTap(PS.RIGHT)) cyc = 1;
    if (I.device === 'kb') { if (I.mouse.wheel) cyc = I.mouse.wheel > 0 ? 1 : -1; else if (I.keyTap('ArrowLeft')) cyc = -1; else if (I.keyTap('ArrowRight')) cyc = 1; }
    let changed = false;
    if (cyc) {
      const E = this.wheelEntries(page, sel), cur = this.wheelPickOf(page, sel);
      if (E.length > 1) {
        const k = (E.findIndex(x => x.id === cur.id) + cyc + E.length) % E.length;
        P.wheelPick[page + ':' + sel] = E[k].id;
        Audio_.ui('move'); changed = true;
      }
    }
    // eşya kullan: ✕ (kol) / sol tık, Enter, Boşluk (klavye)
    if (page === 1 && (I.padTap(PS.X) || I.justMouse[0] || I.keyTap('Enter', 'Space'))) {
      const e = this.wheelPickOf(1, sel);
      if (e) { this.wheelUse(e); changed = true; } else Audio_.ui('error');
    }
    if (changed) { this.renderWheel(); return; }
    this.drawWheelSel(force);
  },
  drawWheelSel(force) {
    const P = G.player, page = this.wheelPage, S = this.wheelSlots(page), N = S.length, sel = this.wheelSelP[page];
    if (sel === this._whSel && !force) return;
    if (this._whSel !== -1 && sel !== this._whSel) Audio_.ui('move');
    this._whSel = sel;
    $$('.wh-w').forEach(n => n.classList.toggle('sel', +n.dataset.i === sel));
    $$('.wh-slot').forEach(n => n.classList.toggle('sel', +n.dataset.i === sel));
    const ptr = $('#wh-ptr');
    if (ptr) ptr.setAttribute('transform', `rotate(${(sel / N) * 360})`);
    const sl = S[sel], e = this.wheelPickOf(page, sel);
    const c = $('#wheel-center');
    const E = this.wheelEntries(page, sel);
    const nav = E.length > 1 ? `<div class="whc-nav">${Input.device === 'pad' ? Input.padGlyph(PS.LEFT) : '◀'} ${E.findIndex(x => x.id === e.id) + 1} / ${E.length} ${Input.device === 'pad' ? Input.padGlyph(PS.RIGHT) : '▶'}</div>` : '';
    if (!e) { c.innerHTML = `<div class="whc-cat">${sl ? sl.n : ''}</div><div class="whc-n dim">${Tr`Boş`}</div><div class="whc-hint">${page ? Tr('Bu türde eşyan yok') : Tr('Bu yuvada silahın yok')}</div>`; return; }
    if (page === 1) {
      const inf = this.wheelEntryInfo(e);
      c.innerHTML = `<div class="whc-cat">${sl.n}</div><div class="whc-big">${inf.ic}</div><div class="whc-n">${inf.n}</div>${inf.am ? `<div class="whc-at">${inf.am}</div>` : ''}<div class="whc-d">${inf.d || ''}</div>${nav}<div class="whc-use">${Input.device === 'pad' ? Input.padGlyph(PS.X) : Input.kbGlyph('Mouse0')} ${ITEMS[e.id] && ITEMS[e.id].c === 'clothing' ? (inf.worn ? Tr('Çıkar') : Tr('Giy')) : Tr('Kullan')}</div>`;
      return;
    }
    const W = WEAPONS[e.id];
    const bar = (lbl, v) => `<div class="whc-st"><span>${lbl}</span><i><b style="width:${Math.round(clamp(v, 0.04, 1) * 100)}%"></b></i></div>`;
    const dmg = (W.dmg * (W.pellets || 1)) / 160, rng = (W.range || 14) / 560, rate = W.rate ? clamp(0.35 / W.rate, 0, 1) : 0;
    let ammo = '';
    if (W.clip) ammo = `<div class="whc-am">${P.clip[e.id] || 0}<small> / ${P.ammo[W.ammo]}</small></div><div class="whc-at">${AMMO[W.ammo].n}</div>`;
    else if (W.throw) ammo = `<div class="whc-am">x${P.count('dynamite')}</div>`;
    c.innerHTML = `<div class="whc-cat">${sl.n}</div><div class="whc-n">${W.n}</div>${ammo}
      <div class="whc-stats">${W.lasso ? '' : bar(Tr('Hasar'), dmg)}${W.melee ? '' : bar(Tr('Menzil'), rng)}${bar(Tr('Hız'), rate)}</div>${W.lasso ? `<div class="whc-d">${Tr('Yakala, bağla, taşı. Aranan suçluları canlı teslim et.')}</div>` : ''}${nav}`;
  },
  wheelUse(e) {
    const P = G.player;
    if (e.id === '@canteen') { G.drinkCanteen(); return; }
    if (e.id === '@lantern') { P.lantern = !P.lantern; Audio_.ui('pick'); this.feed(P.lantern ? Tr('🏮 Fener yakıldı') : Tr('🏮 Fener söndürüldü')); return; }
    if (e.id === '@harmonica') { Audio_.harmonica(); P.deCore = Math.min(100, P.deCore + 8); this.feed(Tr('🎵 Mızıkayla kısa bir ezgi çaldın.')); return; }
    G.consume(e.id);
  },
  closeWheel() {
    $('#wheel').classList.add('hidden'); document.body.classList.remove('wheel-open');
    const P = G.player;
    if (this.wheelPage !== 0) return;          // eşya sayfasında bırakmak yalnızca kapatır
    const e = this.wheelPickOf(0, this.wheelSelP[0]);
    const owned = e && e.id;
    if (owned && owned !== P.weapon) { P.weapon = owned; P.reloadT = 0; P.draw_ = 0; Audio_.tone(700, 0.05, 'square', 0.05); if (owned === 'dynamite') P.weapons.add('dynamite'); }
  },

  /* ================= ÇANTA ================= */
  openSatchel() {
    const P = G.player;
    const tabs = [Tr('Yiyecek'), Tr('İlaç & Bitki'), Tr('Av & Değerli'), Tr('Alet & Giysi'), Tr('Silahlar')];
    const cats = [['food'], ['med', 'herb'], ['animal', 'valuable', 'collect'], ['tool', 'horse', 'doc', 'clothing', 'ammo'], []];
    const m = this.menu({
      title: Tr('Çanta'), cls: 'satchel', tabs, side: (it) => it.sideHtml || '', altLabel: Tr('Bir Tane At'), okLabel: Tr('Kullan'),
      sub: () => Tr`${fmtMoney(P.money)} • Matara: ${P.canteen}/5 • ${G.age} yaş`,
      build: (m) => {
        const items = [];
        if (m.tab === 0 && P.has('canteen')) items.push({ icon: Icons.item('canteen'), label: Tr('Matara'), right: `${P.canteen}/5`, fn: () => G.drinkCanteen(), sideHtml: this.itemSide(ITEMS.canteen, Tr`Susuzluk +32`) });
        if (m.tab === 4) {
          for (const w of P.weapons) {
            const W = WEAPONS[w];
            if (w === 'dynamite') continue;
            items.push({ icon: Icons.weapon(w), label: W.n + (P.weapon === w ? Tr(' <em>(elinde)</em>') : ''), right: W.clip ? `${P.clip[w] || 0} / ${P.ammo[W.ammo]}` : '', fn: () => { P.weapon = w; this.feed(Tr`${W.n} kuşanıldı`); }, sideHtml: `<div class="ps-big">${Icons.weapon(w, 'ic wpn big')}</div><div class="ps-t">${W.n}</div><div class="ps-d">${W.lasso ? Tr('Yakala, bağla, taşı. Aranan suçluları canlı teslim et.') : W.melee ? Tr('Yakın dövüş') : Tr('Hasar ') + W.dmg + (W.pellets ? 'x' + W.pellets : '') + Tr(' • Menzil ') + W.range + Tr(' • Şarjör ') + (W.clip || '-')}</div>` });
          }
          items.push({ header: Tr('Mühimmat') });
          for (const a in AMMO) items.push({ icon: Icons.glyph('ammo', '#d9c8a4'), label: AMMO[a].n, right: `${P.ammo[a]} / ${AMMO[a].max}`, disabled: true });
          return items;
        }
        const ids = Object.keys(P.inv).filter(id => cats[m.tab].includes(ITEMS[id].c) && id !== 'canteen').sort((a, b) => ITEMS[a].n.localeCompare(ITEMS[b].n, 'tr'));
        for (const id of ids) {
          const it = ITEMS[id];
          const worn = (P.coat === id) || (it.hat && P.look.hat === it.hat) || (it.mask && P.masked && P.mask === id);
          items.push({ id, icon: Icons.item(id), label: it.n + (worn ? Tr(' <em>(giyili)</em>') : ''), right: 'x' + P.inv[id], fn: () => { G.consume(id); }, sideHtml: this.itemSide(it) });
        }
        return items;
      },
      onAlt: (it) => { if (!it || !it.id) return; this.confirm(Tr('Eşyayı At'), Tr`Bir adet ${ITEMS[it.id].n} atılsın mı?`, () => { P.removeItem(it.id, 1); if (P.coat === it.id && !P.has(it.id)) P.coat = null; }); },
      empty: Tr('Bu bölmede eşyan yok.'),
    });
    return m;
  },
  itemSide(it, extra) {
    const e = it.e || {};
    const eff = [];
    const map = { hunger: Tr('Açlık'), thirst: Tr('Susuzluk'), health: Tr('Sağlık'), stamina: Tr('Dayanıklılık'), energy: Tr('Uyku'), deadeye: Tr('Odak'), drunk: Tr('Sarhoşluk'), warmth: Tr('Isınma') };
    for (const k in map) if (e[k]) eff.push(`${map[k]} ${e[k] > 0 ? '+' : ''}${e[k]}`);
    if (e.cure) eff.push(Tr('Hastalığı iyileştirir'));
    if (e.poison) eff.push(Tr('Zehri yok eder'));
    if (e.immune) eff.push(Tr`${e.immune} saat hastalığa karşı korur`);
    if (e.pain) eff.push(Tr`${e.pain} saat alınan hasar %40 azalır`);
    if (e.limber) eff.push(Tr`${e.limber} saat koşarken daha geç yorulursun`);
    if (e.cool) eff.push(Tr`${e.cool} saat sıcakta serinletir`);
    if (e.sober) eff.push(Tr('Sarhoşluğu anında giderir'));
    if (it.raw) eff.push(`<span class="bad">${Tr`Çiğ: hastalık riski`}</span>`);
    if (it.coat) eff.push(Tr`Sıcaklık ${it.coat.warm > 0 ? '+' : ''}${it.coat.warm}°C`);
    return `<div class="ps-big">${Icons.item(it.id, 'ic big')}</div><div class="ps-t">${it.n}</div><div class="ps-d">${it.d || ''}</div>${eff.length || extra ? `<div class="ps-e">${extra || eff.join('<br>')}</div>` : ''}<div class="ps-p">${Tr`Değeri: ${fmtMoney(it.p)}`}</div>`;
  },

  /* ================= GÜNLÜK ================= */
  openJournal(tab = 0) {
    const tabs = [Tr('Karakter'), Tr('Yetenekler'), Tr('Başarımlar'), Tr('İstatistikler'), Tr('İlişkiler'), Tr('İşlerim'), Tr('Görevler'), Tr('Rehber')];
    const el = el_('div', 'modal panel journal');
    const m = this.makeModal(el, { scroll: true, noFocus: true, onTab: (d) => { m.tab = (m.tab + d + tabs.length) % tabs.length; render(); Audio_.ui('move'); } });
    m.tab = tab;
    const render = () => {
      el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Günlük`}</div></div><div class="p-tabs">${Input.glyph('tabL')}${tabs.map((t, i) => `<span class="tab ${i === m.tab ? 'on' : ''}" data-tab="${i}">${t}</span>`).join('')}${Input.glyph('tabR')}</div><div class="p-body"><div class="scroll jr">${Icons.iconize(this.journalTab(m.tab))}</div></div><div class="p-foot">${Tr`${Input.glyph('back')} Kapat &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Sekme`}</div>`;
      $$('.tab', el).forEach(n => (n.onclick = () => { m.tab = +n.dataset.tab; render(); }));
      const pc = $('#jr-portrait', el);
      if (pc) Spr.portrait(pc.getContext('2d'), pc.width, pc.height, G.player.look, G.age);
      const qa = $('[data-qa]', el);
      if (qa) qa.onclick = () => this.confirm(Tr('Hikâyeyi Bırak'), Tr`${G.storyDef().title()} hikâyesini bırakırsan bir daha devam edemezsin. Emin misin?`, () => { G.storyAbandon(); this.closeAll(); });
    };
    render();
    this.push(m);
  },
  journalTab(t) {
    const P = G.player, S = G.stats;
    if (t === 0) {
      const BG = BACKGROUNDS.find(b => b.id === G.background);
      const honorTxt = G.honor > 60 ? Tr('Saygın') : G.honor > 20 ? Tr('Dürüst') : G.honor > -20 ? Tr('Nötr') : G.honor > -60 ? Tr('Şüpheli') : Tr('Kötü Şöhretli');
      const born = START_YEAR - START_AGE;
      return `<div class="jr-char"><canvas id="jr-portrait" width="220" height="264"></canvas><div class="jr-info">
        <h2>${escapeHtml(P.name)}</h2>
        <div class="jr-row">${Tr`<b>Doğum:</b> ${born} &nbsp; <b>Yaş:</b> ${G.age} &nbsp; <b>Yıl:</b> ${G.year}`}</div>
        <div class="jr-row">${Tr`<b>Geçmiş:</b> ${BG ? BG.n : ''}`}</div>
        <div class="jr-row">${Tr`<b>Onur:</b> ${honorTxt} (${Math.round(G.honor)})`}<div class="honorbar"><i style="left:${50 + G.honor / 2}%"></i></div></div>
        <div class="jr-row">${Tr`<b>Nakit:</b> ${fmtMoney(P.money)} &nbsp; <b>Banka:</b> ${fmtMoney(G.bank)}`}</div>
        <div class="jr-row">${Tr`<b>Başındaki Ödül:</b> ${fmtMoney(G.law.bounty)}`}</div>
        <div class="jr-row">${Tr`<b>At:</b> ${G.horse ? Tr`${G.horse.name} (${G.horse.def.n}) — Bağ ${G.horse.bondLv}/4` : Tr('Yok')}`}</div>
        <div class="jr-row">${Tr`<b>Mülkler:</b> ${G.props.length ? G.props.map(id => PROPERTIES.find(p => p.id === id).n).join(', ') : Tr('Yok')}`}</div>
        <div class="jr-row">${Tr`<b>Aile:</b> ${G.family.spouse ? Tr`Eşi: ${G.family.spouse.name}` : Tr('Bekar')}${G.family.children.length ? Tr(' • Çocuklar: ') + G.family.children.map(c => c.name).join(', ') : ''}`}</div>
        <div class="jr-row">${Tr`<b>Hayat Hedefi:</b> 80 yaş — kalan ${Math.max(0, GOAL_AGE - G.age)} yıl`}</div>
        <div class="lifebar"><i style="width:${clamp((G.age - START_AGE) / (GOAL_AGE - START_AGE), 0, 1) * 100}%"></i></div>
        ${G.activeBounty ? `<div class="jr-row">${Tr`<b>Aktif Ödül Avı:</b> ${G.activeBounty.name} — ${fmtMoney(G.activeBounty.reward)} ${G.activeBounty.done ? Tr('(Tamamlandı, ödülü al)') : Tr('(Şerif ofisine canlı teslim: tam ödül, ceset: yarısı)')}`}</div>` : ''}
      </div></div>`;
    }
    if (t === 1) {
      return `<div class="skills">` + Object.keys(SKILLS).map(k => {
        const s = G.skills[k], need = Math.round(40 * Math.pow(s.lv, 1.5));
        return `<div class="skill"><div class="sk-n">${SKILLS[k].n} <span>${Tr`Sv. ${s.lv}/10`}</span></div><div class="sk-d">${SKILLS[k].d}</div><div class="sk-bar"><i style="width:${s.lv >= 10 ? 100 : s.xp / need * 100}%"></i></div></div>`;
      }).join('') + `</div><p class="jr-note">${Tr`Yetenekler, ilgili işleri yaptıkça gelişir: avlanmak, ateş etmek, at sürmek, ticaret yapmak, insanlarla konuşmak ve çalışmak.`}</p>`;
    }
    if (t === 2) {
      const n = Object.keys(G.achieved).length;
      return `<div class="ach-sum">${Tr`${n} / ${ACHIEVEMENTS.length} başarım`}</div><div class="achs">` + ACHIEVEMENTS.map(A => {
        const got = G.achieved[A.id];
        const prog = A.s ? Math.min(A.v, Math.floor(S[A.s] || (A.s === 'age' ? G.age : 0))) : 0;
        return `<div class="ach ${got ? 'got' : ''}"><div class="a-i">${Icons.glyph('trophy', got ? '#e2b64a' : 'rgba(239,230,210,0.18)')}</div><div><div class="a-n">${A.n}</div><div class="a-d">${A.d}${!got && A.s ? ` <span class="a-p">(${prog}/${A.v})</span>` : ''}</div>${A.perk ? `<div class="a-perk">${A.perk}</div>` : ''}</div></div>`;
      }).join('') + '</div>';
    }
    if (t === 3) {
      const rows = [[Tr('Hayatta kalınan gün'), G.day], [Tr('Avlanan hayvan'), S.animals], [Tr('Öldürülen haydut'), S.bandits], [Tr('Toplam öldürülen insan'), S.kills], [Tr('Yürünen mesafe'), S.walkMiles.toFixed(1) + Tr(' mil')], [Tr('At sırtında'), S.rideMiles.toFixed(1) + Tr(' mil')], [Tr('Toplanan bitki'), S.herbs], [Tr('Tutulan balık'), S.fish], [Tr('Yenen yemek'), S.eaten], [Tr('Kazanılan toplam para'), fmtMoney(S.earned)], [Tr('Çalışılan vardiya'), S.shifts], [Tr('Yardım edilen yabancı'), S.helped], [Tr('Keşfedilen yer'), G.discovered.size], [Tr('Ziyaret edilen kasaba'), G.visited.size + ' / ' + G.world.towns.length], [Tr('Kurulan kamp'), S.camps], [Tr('Tren yolculuğu'), S.trainRides], [Tr('Bulunan altın'), S.nuggets], [Tr('Kazanılan Yirmi Bir eli'), S.bjWins], [Tr('Kazanılan poker eli'), S.pokerWins || 0], [Tr('Bilek güreşi zaferi'), S.armWins]];
      return `<table class="stats">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
    }
    if (t === 4) {
      let h = '<div class="rels">';
      for (const t of G.world.towns) {
        const R = G.romances[t.id];
        if (!R) continue;
        const married = G.family.spouse && G.family.spouse.id === R.id;
        const met = G.visited.has(t.id);
        h += `<div class="rel"><div class="r-n">${met ? R.name : '???'}</div><div class="r-t">${t.n}</div><div class="r-bar"><i style="width:${married ? 100 : R.rel}%"></i></div><div class="r-s">${married ? Tr('❤ Eşin') : R.rel >= 80 ? Tr('Evlenmeye hazır') : R.rel >= 50 ? Tr('Yakın') : R.rel >= 20 ? Tr('Tanıdık') : Tr('Yabancı')}</div></div>`;
      }
      return h + `</div><p class="jr-note">${Tr`Her kasabada tanışabileceğin biri yaşıyor (haritada ♥). Onlarla her gün sohbet et, hediye ver. Yakınlık 80'e ulaştığında ve bir mülkün olduğunda evlenme teklif edebilirsin.`}</p>`;
    }
    if (t === 5) return this.bizJournal();
    if (t === 6) return G.questJournal();
    return this.guideHtml();
  },
  /* İşlerim: işletmeler, stok, kasa, yük arabası */
  bizJournal() {
    const L = G.biz;
    let h = '';
    if (!L.length && !G.lotsOwned.length) h += `<p class="jr-note">${Tr`Henüz bir işletmen yok. Dükkânların tezgâhında sahibine satın almak istediğini söyleyebilir, ilçe binası ya da tapu dairesinden satılık işletmelere ve arsalara bakabilirsin.`}</p>`;
    else {
      let tot = 0, cash = 0;
      h += `<table class="jr-biz"><tr><th>${Tr`İşletme`}</th><th>${Tr`Kasaba`}</th><th>${Tr`İşletmeci`}</th><th>${Tr`Stok`}</th><th>${Tr('@işletme|Kasa')}</th><th>${Tr('@gelir|Günlük')}</th></tr>`;
      for (const z of L) {
        const t = G.bizTown(z.town);
        if (z.site) { h += `<tr><td>${BUILDINGS[z.type].n}</td><td>${t ? t.n : ''}</td><td>${escapeHtml(z.mgr.name)}</td><td colspan="3" class="dim">${Tr`İnşaat: ${Math.max(0, z.ready - G.day)} gün kaldı`}</td></tr>`; continue; }
        const est = G.bizDailyEst(z); tot += est; cash += z.cash;
        h += `<tr><td>${G.bizName(z)}</td><td>${t ? t.n : ''}</td><td>${escapeHtml(z.mgr.name)} <span class="dim">(${MGR_TRAITS[z.mgr.trait].n})</span></td><td class="st-${G.bizStockCls(z)}">${G.bizStockWord(z)}</td><td>${z.bank ? Tr('bankaya') : fmtMoney(z.cash)}</td><td>~${fmtMoney(est)}</td></tr>`;
      }
      h += `</table><p class="jr-note">${Tr`Kasalarda toplam ${fmtMoney(cash)} bekliyor. Stok dolu olduğunda günlük brüt gelir ~${fmtMoney(tot)}.`}</p>`;
      const free = G.lotsOwned.filter(id => !G.biz.some(z => z.lot === id));
      if (free.length) h += `<p class="jr-note">${Tr`Boş arsaların: ${free.length}. Tabelasından ya da ilçe binasından inşaata başlayabilirsin.`}</p>`;
      const need = G.goodsNeeded(), nk = Object.keys(need).filter(g => need[g] > 0);
      if (nk.length) h += `<p class="jr-note">${Tr`Getirilmesi gereken mallar:`} ${nk.map(g => `${GOODS[g].n} ×${need[g]}`).join(', ')}</p>`;
    }
    if (G.haulers.length) {
      h += `<h3 class="jr-h">${Tr`Nakliyeciler`}</h3><table class="jr-biz">`;
      for (const x of G.haulers) h += `<tr><td>${escapeHtml(x.name)} <span class="dim">(${HAUL_TRAITS[x.trait].n})</span></td><td class="${x.state === 'raid' ? 'st-low' : ''}">${escapeHtml(G.haulStatus(x))}</td><td>${fmtMoney(HAUL_TRAITS[x.trait].wage)}${Tr`/gün`}</td></tr>`;
      h += `</table>`;
    }
    for (const R of G.raids) h += `<p class="jr-note st-low">${Tr`Baskın: ${G.nearestTown(R.x, R.y).n} yakınlarında, haritada kırmızı işaret.`}</p>`;
    const w = G.myWagon;
    h += `<p class="jr-note">${w ? Tr`Yük araban: ${w.crates.length}/${WAGON_CAP} sandık.` : Tr`Yük araban yok. Ahırdan ${fmtMoney(WAGON_PRICE)} karşılığında alabilirsin; ${WAGON_CAP} sandık taşır.`}</p>`;
    return h;
  },
  /* İlk oyunda sinematikten sonra açılan kısa, sayfalı rehber (Günlük → Rehber ve Duraklat menüsünden de açılır) */
  openWelcome(onDone) {
    const P = G.player, g = (a) => Input.glyph(a), name = P ? P.name.split(' ')[0] : '';
    const pages = [
      { ic: 'star', t: Tr('Batıya Hoş Geldin!'), portrait: true,
        b: Tr`Merhaba <b>${name}</b>! Yıl ${START_YEAR}, daha 18 yaşındasın ve cebinde birkaç dolar var.<br>Hedefin basit ama kolay değil: <b>80 yaşına kadar hayatta kalmak</b>.<br><br>Bu kısa rehber ilk adımlarını gösterecek. Hazırsan başlayalım!` },
      { ic: 'heart', t: Tr('Hayatta Kal'), pre: true,
        b: Tr`Sol alttaki halkalar <b>sağlık</b>, <b>dayanıklılık</b> ve <b>odak</b>; yanındaki çubuklar <b>açlık</b>, <b>susuzluk</b>, <b>uyku</b> ve <b>temizlik</b>.`,
        tips: [['meat', Tr`Acıkınca ${g('satchel')} Çanta'dan ye, ${g('quick')} ile hızlıca atıştır.`], ['drop', Tr('Matarandan iç, nehirden ya da kuyudan doldur.')], ['bed', Tr('Otelde, evinde ya da kamp kurup uyu.')], ['sun', Tr('Çölde bol su iç, karda kalın giyin.')]] },
      { ic: 'feet', t: Tr('Dolaş ve Keşfet'),
        tips: [['feet', Tr`${g('moveUp')}${g('moveLeft')}${g('moveDown')}${g('moveRight')} yürü, ${g('sprint')} koş.`], ['talk', Tr`İnsanlara, kapılara ve eşyalara yaklaş: ${g('interact')} ile etkileş. Basılı tutunca başka seçenekler çıkar.`], ['horse', Tr`${g('whistle')} ile atını çağır, ${g('interact')} ile bin; dörtnala için ${g('sprint')}.`], ['map', Tr`${g('map')} Harita: kasabalar, yollar ve işaretlediğin yerler.`]] },
      { ic: 'coin', t: Tr('Para Kazan'),
        tips: [['fox', Tr('Avlan; postları ve etleri kasaba sat.')], ['pick', Tr('Madende, kerestecide, limanda ya da çiftlikte çalış.')], ['scroll', Tr('Şerif ofisindeki ödül ilanlarını takip et.')], ['bank', Tr('Kazancını bankaya yatır: ölürsen bankadaki para kaybolmaz.')], ['cards', Tr('Şansını saloonda pokerde dene... ama dikkat!')]] },
      { ic: 'talk', t: Tr('Kasaba Seni Hatırlar'),
        tips: [['talk', Tr`Sakinlerin adı, mesleği ve huyu var. Seni selamlarlarsa ${g('interact')} ile <b>Selamla</b>: selamı alınmayan bozulur!`], ['mask', Tr('Laf atana karşılık verebilirsin. Ama suç işlersen tanıklar şerife koşar.')], ['star', Tr('İyilik yaparsan ünün artar; dükkânlar indirim yapar, insanlar sana gülümser.')]] },
      { ic: 'book', t: Tr('İşine Yarayacaklar'),
        tips: [['satchel', Tr`${g('satchel')} Çanta: yiyecek, ilaç, giysi ve eşyalar.`], ['book', Tr`${g('journal')} Günlük: karakterin, başarımlar, işlerin ve bu rehber.`], ['gun', Tr`${g('wheel')} Silah çarkı, ${g('aim')} nişan, ${g('fire')} ateş.`], ['gear', Tr`${g('pause')} Duraklat: kaydet, ayarlar, ana menü.`]],
        b: G.story === null && G._storyNext && STORIES[STORY_FOR_BG[G.background]] ? STORIES[STORY_FOR_BG[G.background]].welcome() : Tr('İyi yolculuklar, kovboy. Batı seni bekliyor!') },
    ];
    const el = el_('div', 'modal panel welcome');
    let pg = 0;
    const done = () => { G.settings.guideSeen = true; G.saveSettings(); this.pop(m); if (onDone) onDone(); };
    const render = () => {
      const Pg = pages[pg], last = pg === pages.length - 1;
      el.innerHTML = `<div class="wl-card">
        <div class="wl-top"><span class="wl-rope"></span><span class="wl-kick">${Tr`Rehber`} · ${pg + 1}/${pages.length}</span><span class="wl-rope"></span></div>
        <div class="wl-medal">${Pg.portrait ? '<canvas id="wl-portrait" width="96" height="112"></canvas>' : Icons.glyph(Pg.ic, '#4a2e10')}</div>
        <div class="wl-title">${Pg.t}</div>
        ${Pg.b && Pg.pre ? `<div class="wl-body">${Pg.b}</div>` : ''}
        ${Pg.tips ? `<div class="wl-tips">${Pg.tips.map(([ic, tx]) => `<div class="wl-tip"><span class="wl-ic">${Icons.glyph(ic, '#c9a45c')}</span><span>${tx}</span></div>`).join('')}</div>` : ''}
        ${Pg.b && !Pg.pre ? `<div class="wl-body">${Pg.b}</div>` : ''}
        ${last ? `<label class="wl-skip"><input type="checkbox" data-skip ${G.settings.guideNew === false ? 'checked' : ''}> ${Tr`Yeni hayatlarda bu rehberi gösterme`}</label>` : ''}
        <div class="wl-dots">${pages.map((_, i) => `<i class="${i === pg ? 'on' : ''}" data-pg="${i}"></i>`).join('')}</div>
        <div class="wl-btns">
          ${pg > 0 ? `<button class="st-btn nav" data-act="prev">${g('left')} ${Tr`Geri`}</button>` : `<button class="st-btn nav" data-act="skip">${Tr`Atla`}</button>`}
          <button class="st-btn nav pref" data-act="${last ? 'done' : 'next'}">${last ? Tr('Maceraya Başla!') : Tr('İleri')} ${last ? '' : g('right')}</button>
        </div></div>`;
      const pc = $('#wl-portrait', el);
      if (pc && P) Spr.portrait(pc.getContext('2d'), pc.width, pc.height, P.look, G.age);
      $$('[data-pg]', el).forEach(n => (n.onclick = () => { pg = +n.dataset.pg; Audio_.ui('move'); render(); }));
      $$('[data-act]', el).forEach(n => (n.onclick = () => act(n.dataset.act)));
      const sk = $('[data-skip]', el);
      if (sk) sk.onchange = () => { G.settings.guideNew = !sk.checked; G.saveSettings(); };
      m.focusFirst();
    };
    const act = (a) => {
      if (a === 'next' && pg < pages.length - 1) { pg++; Audio_.ui('move'); render(); }
      else if (a === 'prev' && pg > 0) { pg--; Audio_.ui('move'); render(); }
      else if (a === 'done' || a === 'skip') { Audio_.ui('ok'); done(); }
    };
    const m = this.makeModal(el, { customInput: true, onBack: done });
    m.update = (dt) => {
      if (m.born >= this.frame - 1) return;
      const I = Input;
      if (I.nav('right', dt)) act('next');
      else if (I.nav('left', dt)) act('prev');
      else if (I.pressed('confirm')) act(pg === pages.length - 1 ? 'done' : 'next');
      else if (I.pressed('back')) { Audio_.ui('back'); done(); }
    };
    m.welcome = true;
    render();
    this.push(m);
    Audio_.ui('ok');
    return m;
  },
  guideHtml() {
    return `<div class="guide"><p><button class="st-btn" onclick="UI.openWelcome()">${Icons.glyph('book', 'currentColor')} ${Tr`Hoş Geldin Rehberini Aç`}</button></p>
      <h3>${Tr`Hayatta Kalma`}</h3><p>${Tr`<b>Açlık</b>, <b>susuzluk</b> ve <b>uyku</b> sürekli azalır. Sıfırlanırlarsa sağlığın düşer. Sağlık çekirdeği (♥ içi) açlık ve susuzluktan beslenir. Sıcak çöllerde daha çok su içmen, karlı dağlarda ise kalın giysiler giymen gerekir. Kamp ateşleri ve sıcak yemekler seni ısıtır.`}</p>
      <h3>${Tr`Yaşlanma`}</h3><p>${Tr`18 yaşında başlarsın. Zaman geçtikçe yaşlanırsın; 30'lardan sonra dayanıklılığın, 50'lerden sonra sağlığın azalır. Hedefin <b>80 yaşına kadar hayatta kalmak.</b>`}</p>
      <h3>${Tr`Para Kazanma`}</h3><p>${Tr`Avlan ve postları kasapta sat. Bitki topla. Madende, kerestecide, limanda ya da çiftliklerde <b>çalış</b>. Nehirde altın ele. Ödül ilanlarını takip et. Ya da… kanunun yanlış tarafında yaşa.`}</p>
      <h3>${Tr`İşletmeler`}</h3><p>${Tr`Dükkân sahiplerinin bir kısmı dükkânını satar: tezgâhta ya da ilçe binasında satın al. İşletmeci işi yürütür, gelir kasada birikir. Çoğu işletme mal tüketir: toptancıdan, değirmenden ya da imalathaneden sandık alıp omzunda, atınla ya da ahırdan alacağın yük arabasıyla getir; ya da ahırdan bir nakliyeci tut, bu işi o yapsın. Boş arsalara yeni işletme kurabilirsin. Günlüğün İşlerim sekmesi hepsini gösterir.`}</p>
      <h3>${Tr`Kanun`}</h3><p>${Tr`Görülürsen suçların başına ödül koydurur. Kanun adamlarının arama alanından (haritadaki kırmızı daire) kaç ve görünmeden bekle. Ödülünü şerif ofisinde ödeyebilirsin. Ödülün kalırsa kasaba dışında ödül avcıları peşine düşer: teslim olabilir, parayla kurtulabilir ya da çatışabilirsin.`}</p>
      <h3>${Tr`Başarımlar`}</h3><p>${Tr`Başarımlar sana kalıcı kazanımlar (perk) sağlar. Günlüğün Başarımlar sekmesine bak.`}</p>
      <h3>${Tr`Kontroller`}</h3>${this.controlsTable()}
    </div>`;
  },
  controlsTable() {
    const B = Input.binds;
    const rows = GAME_ACTIONS.map(g => [g.n, g.kbOnly ? Tr('Sol Analog') : Input.padGlyph(B.pad[g.id]), (B.kb[g.id] || []).filter(Boolean).map(c => Input.kbGlyph(c)).join(' ') || '—']);
    rows.unshift([Tr('Hareket'), Tr('Sol Analog'), `${Input.kbGlyph(B.kb.moveUp[0])}${Input.kbGlyph(B.kb.moveLeft[0])}${Input.kbGlyph(B.kb.moveDown[0])}${Input.kbGlyph(B.kb.moveRight[0])}`], [Tr('Nişan Yönü'), Tr('Sağ Analog'), Tr('Fare')]);
    return `<table class="ctrl"><tr><th>${Tr`Eylem`}</th><th>${Tr`Oyun Kolu`}</th><th>${Tr`Klavye / Fare`}</th></tr>${rows.filter(r => ![Tr('İleri'), Tr('Geri'), Tr('Sol'), Tr('Sağ')].includes(r[0])).map(r => `<tr><td>${r[0]}</td><td class="c-ps">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table><p class="dim">${Tr`Tuşları Ayarlar → Tuş Atamaları'ndan değiştirebilirsin.`}</p>`;
  },
  openControls(tab = Input.device === 'pad' ? 1 : 0) {
    let capturing = null;
    const m = this.menu({
      title: Tr('Tuş Atamaları'), cls: 'shop controls', tabs: [Tr('Klavye / Fare'), Tr('Oyun Kolu')], tab,
      sub: (mm) => mm.tab === 0 ? Tr('Bir eyleme bas, ardından yeni tuşa ya da fare düğmesine bas. Esc iptal eder.') : Tr`Bir eyleme bas, ardından koldaki yeni tuşa bas. 6 saniye beklersen iptal olur. Menülerde ${Input.padGlyph(PS.X)} seç, ${Input.padGlyph(PS.O)} geri sabittir.`,
      altLabel: Tr('Varsayılana Dön'), okLabel: Tr('Değiştir'),
      side: (it) => it.sideHtml || '',
      build: (mm) => {
        const dev = mm.tab === 0 ? 'kb' : 'pad';
        const items = [];
        for (const g of GAME_ACTIONS) {
          if (dev === 'pad' && g.kbOnly) continue;
          const cur = dev === 'kb' ? (Input.binds.kb[g.id] || []).filter(Boolean).map(c => Input.kbGlyph(c)).join(' ') || Input.kbGlyph(null) : Input.padGlyph(Input.binds.pad[g.id]);
          const wait = capturing === g.id;
          items.push({
            label: g.n, right: wait ? Tr('<em class="cap">Bir tuşa bas…</em>') : cur, cls: wait ? 'capturing' : '',
            sideHtml: `<div class="ps-t">${g.n}</div><div class="ps-d">${Tr`Şu an: ${cur}`}</div><div class="ps-e">${dev === 'kb' ? Tr('Enter ya da tık ile değiştir.') : Tr`${Input.padGlyph(PS.X)} ile değiştir.`}</div>`,
            fn: () => {
              if (capturing) return;
              capturing = g.id;
              mm.render();
              Input.startCapture(dev, (v) => {
                capturing = null;
                if (v !== undefined && v !== null) {
                  const sw = Input.bind(dev, g.id, v);
                  if (sw) this.feed(Tr`"${GAME_ACTIONS.find(x => x.id === sw).n}" ile tuşlar takas edildi.`);
                  G.saveSettings();
                  Audio_.ui('ok');
                } else Audio_.ui('back');
                if (mm.alive) mm.render();
              });
            },
          });
        }
        items.push({ header: ' ' });
        items.push({ label: Tr('Bu Sekmeyi Varsayılana Döndür'), cls: 'danger', fn: () => { Input.resetBinds(dev); G.saveSettings(); } });
        return items;
      },
      onAlt: () => { const dev = m.tab === 0 ? 'kb' : 'pad'; Input.resetBinds(dev); G.saveSettings(); this.feed(Tr('Tuşlar varsayılana döndü.')); },
      onClose: () => { if (Input.capture) Input.finishCapture(undefined); G.saveSettings(); },
    });
    return m;
  },


  /* ================= DURAKLAT ================= */
  /* Duraklatma: tam ekran; solda menü, sağda karakterin kayıt defteri kartı (portre, onur, hayat hedefi,
     konum, zaman, hava, para, at, oynama süresi ve süren hedef). Oyun arkada bulanıklaşır. */
  openPause() {
    Audio_.ui('ok');
    document.body.classList.add('paused');
    const ic = (g) => Icons.glyph(g, '#d9c8a4'), card = this.pauseDossier();
    this.menu({
      title: Tr('Duraklatıldı'), cls: 'pause', sub: () => Tr`${G.player.name} • ${G.age} yaşında • ${G.dateStr()}`,
      side: () => card, onClose: () => document.body.classList.remove('paused'),
      items: [
        { icon: ic('check'), label: Tr('Devam Et'), fn: () => this.pop() },
        { icon: ic('map'), label: Tr('Harita'), fn: () => { this.pop(); this.openMap(); } },
        { icon: ic('satchel'), label: Tr('Çanta'), fn: () => { this.pop(); this.openSatchel(); } },
        { icon: ic('book'), label: Tr('Günlük'), fn: () => { this.pop(); this.openJournal(); } },
        { icon: ic('question'), label: Tr('Rehber'), fn: () => { this.pop(); this.openWelcome(); } },
        { icon: ic('quill'), label: G.difficulty === 'hard' ? Tr('Oyunu Kaydet') : Tr`Oyunu Kaydet (${G.slot}. yuva)`, fn: () => G.saveGame() },
        { icon: ic('hourglass'), label: Tr('Kayıt Yükle'), fn: () => this.openSlots('load') },
        { icon: ic('gear'), label: Tr('Ayarlar'), fn: () => this.openSettings() },
        { icon: ic('pad'), label: Tr('Tuş Atamaları'), fn: () => this.openControls() },
        ...(Platform.canQuit ? [{ icon: ic('door'), label: Tr('Oyundan Çık'), fn: () => this.confirm(Tr('Oyundan Çık'), Tr('Oyun kaydedilip kapatılsın mı?'), () => { G.saveGame(true); Platform.quit(); }, Tr('Vazgeç'), Tr('Kaydet ve Çık')) }] : []),
        { icon: ic('back'), label: Tr('Ana Menüye Dön'), fn: () => this.confirm(Tr('Ana Menü'), Tr('Kaydedilmemiş ilerleme kaybolabilir. Kaydedip çıkılsın mı?'), () => { G.saveGame(true); this.closeAll(); this.showMainMenu(); }, Tr('Vazgeç'), Tr('Kaydet ve Çık')) },
      ],
    });
  },
  /* Portre görseli (kayıt defteri kartı için; görünüş ve yaş değişmedikçe önbellekten) */
  portraitURL(look, age, w = 200, h = 240) {
    const k = JSON.stringify(look) + age + w;
    if (this._ptK === k) return this._ptU;
    const c = makeCanvas(w, h);
    try { Spr.portrait(c.getContext('2d'), w, h, look, age); this._ptU = c.toDataURL('image/png'); } catch (e) { this._ptU = ''; }
    this._ptK = k;
    return this._ptU;
  },
  pauseDossier() {
    const P = G.player, W = G.world, t = W.townAt(P.x, P.y, 20), reg = W.regionAt(P.x, P.y);
    const bg = BACKGROUNDS.find(b => b.id === G.background), df = DIFFICULTIES.find(d => d.id === G.difficulty);
    const h = G.horse && !G.horse.dead ? G.horse : null, hon = G.honor;
    const hn = hon > 50 ? Tr('Saygın') : hon > 15 ? Tr('İyi') : hon < -50 ? Tr('Kötü Şöhretli') : hon < -15 ? Tr('Şüpheli') : Tr('Nötr');
    const life = clamp((G.age - START_AGE) / (80 - START_AGE), 0, 1);
    const sec = G.playtime || 0, ph = Math.floor(sec / 3600), pm = Math.floor(sec / 60) % 60;
    const row = (g, k, v) => `<div class="pz-row">${Icons.glyph(g, '#d9c8a4')}<div><span>${k}</span><b>${v}</b></div></div>`;
    // süren hedef: hikâye bölümü, ödül avı ya da haritadaki işaret
    let ok = '', ot = '', od = '';
    const S = G.story, st = G.storyOn && G.qStep(), qm = G.questMark();
    if (st) { const c = G.storyDef().chapters[S.ch]; ok = Tr`Bölüm ${S.ch + 1}` + (c ? ' · ' + c.t() : ''); ot = st.t.call(G, S); if (qm) od = fmtDist(dist(P.x, P.y, qm.x, qm.y)); }
    else if (G.activeBounty && !G.activeBounty.done) { const B = G.activeBounty; ok = Tr('Ödül Avı'); ot = escapeHtml(B.name || ''); od = fmtDist(dist(P.x, P.y, B.bx || B.x, B.by || B.y)); }
    else if (G.waypoint) { ok = Tr('Hedef'); ot = Tr('Hedef işareti'); od = fmtDist(dist(P.x, P.y, G.waypoint.x, G.waypoint.y)); }
    const law = G.law.level > 0 || G.law.bounty > 0 ? row('skull', Tr('Başındaki Ödül'), fmtMoney(G.law.bounty)) : '';
    return `<div class="pz-card">
      <div class="pz-top"><div class="pz-frame">${this.portraitURL(P.look, G.age) ? `<img src="${this.portraitURL(P.look, G.age)}" alt="">` : ''}</div>
        <div class="pz-id"><div class="pz-k">${Tr('Kayıt Defteri')}</div><div class="pz-n">${escapeHtml(P.name)}</div>
          <div class="pz-s">${Tr`${G.age} yaşında`}${bg ? ' • ' + bg.n : ''}</div><div class="pz-s dim">${df ? df.n : ''}</div>
          <div class="pz-bars"><div class="pz-bar"><span>${Tr('Onur')}</span><i class="hon"><b style="left:${(clamp((hon + 100) / 200, 0, 1) * 100).toFixed(1)}%"></b></i><em>${hn}</em></div>
          <div class="pz-bar"><span>${Tr('Hayat')}</span><i class="life"><b style="width:${(life * 100).toFixed(1)}%"></b></i><em>${G.age} / 80</em></div></div>
        </div></div>
      <div class="pz-rows">
        ${row('pin', Tr('Konum'), t ? `${t.n}, ${reg}` : reg)}
        ${row('hourglass', Tr('Zaman'), `${G.timeStr()} • ${G.dateStr()}`)}
        ${row(this.weatherGlyph(), Tr('Hava'), `${this.weatherName()} • ${Math.round(G.feltTemp)}°`)}
        ${row('coin', Tr('Para'), `${fmtMoney(P.money)} • ${Tr('Banka')}: ${fmtMoney(G.bank)}`)}
        ${row('horse', Tr('At'), h ? `${escapeHtml(h.name)} • ${Tr`Bağ ${h.bondLv}/4`}` : Tr('Atın yok'))}
        ${row('quill', Tr('Oynama'), ph ? Tr`${ph} sa ${pm} dk` : Tr`${pm} dk`)}
        ${law}
      </div>
      ${ok ? `<div class="pz-obj"><div class="pz-ok">${ok}</div><div class="pz-ot"><i></i><b>${ot}</b>${od ? `<span>${od}</span>` : ''}</div></div>` : ''}
    </div>`;
  },
  /* Ayarlar: sekmeli (Genel / Ses / Görüntü / Kontroller). Her satırın kendi denetimi var:
     ses için dilimli kaydırıcı, açık/kapalı için anahtar, seçenekler için düğme dizisi.
     Sağda odaktaki ayarın açıklaması durur. ◀ ▶ değiştirir, Q/E sekme, Alt varsayılana döndürür. */
  openSettings(tab = 0, focusKey = null) {
    const S = G.settings;
    const DEF = { master: 0.8, music: 0.5, sfx: 0.8, amb: 0.6, zoom: 0, fps: false, shake: true, aimAssist: 2, aimSens: 1, fxq: 0, tone: 0, padGlyphs: 0, guideNew: true, hudScale: 2 };
    const OPTL = {
      aimAssist: [Tr('Kapalı'), Tr('Hafif'), Tr('Standart'), Tr('Tam Kilit')], aimSens: [Tr('Düşük'), Tr('Normal'), Tr('Yüksek')],
      padGlyphs: [Tr('Otomatik'), 'PlayStation', 'Xbox', 'Steam Deck'], fxq: [Tr('Tam'), Tr('Sade')], tone: [Tr('Doğal'), Tr('Canlı')],
      zoom: [Tr('Otomatik'), '1x', '2x', '3x', '4x', '5x'],
      hudScale: HUD_SCALES.map(v => Math.round(v * 100) + '%'),
    };
    const TABS = [
      { n: Tr('@ayar|Genel'), g: 'gear', rows: [
        ['lang', 'Dil / Language', 'lang', Tr('Oyunun dili. Menüler, diyaloglar ve bütün metinler hemen değişir.')],
        ['shake', Tr('Ekran Sarsıntısı'), 'bool', Tr('Silah sesi, patlama ve darbelerde kameranın sarsılması. Baş dönmesi yapıyorsa kapat.')],
        ['fps', Tr('FPS Göster'), 'bool', Tr('Ekranın köşesinde saniyedeki kare sayısını gösterir.')],
        ['guideNew', Tr('Yeni Hayatta Rehber'), 'bool', Tr('Her yeni hayatın başında, varış sinematiğinden sonra hoş geldin rehberi açılır. Duraklat menüsünden her zaman açabilirsin.')],
      ] },
      { n: Tr('Ses'), g: 'note', rows: [
        ['master', Tr('Ana Ses'), 'vol', Tr('Bütün seslerin genel seviyesi.')],
        ['music', Tr('Müzik'), 'vol', Tr('Saloon piyanosu, menü ve sahne müzikleri.')],
        ['sfx', Tr('Efektler'), 'vol', Tr('Silahlar, adımlar, atlar ve arayüz sesleri.')],
        ['amb', Tr('Ortam Sesleri'), 'vol', Tr('Rüzgâr, yağmur, kuşlar, böcekler ve kasaba uğultusu.')],
      ] },
      { n: Tr('Görüntü'), g: 'eye', rows: [
        ...(Platform.canFullscreen === false ? [] : [['fullscreen', Tr('Tam Ekran'), 'fs', Tr('Oyunu tam ekranda ya da pencerede çalıştırır. Tercih kaydedilir; tarayıcıda tam ekrandan çıkmak için Esc tuşunu basılı tut.')]]),
        ['zoom', Tr('Piksel Ölçeği'), 'opt', Tr('Dünyanın kaç kat büyütülerek çizileceği. Otomatik, ekran çözünürlüğüne göre seçer; küçük değer daha geniş bir alan gösterir.')],
        ['hudScale', Tr('Arayüz Boyutu'), 'opt', Tr('Ekrandaki göstergelerin (sağlık halkaları, radar, para ve saat, hedef, silah, bildirimler, altyazı) boyutu. Büyük ekranda büyüt, küçük ekranda küçült.')],
        ['tone', Tr('Görüntü Tonu'), 'opt', Tr('Doğal: gerçeğe yakın, yumuşak renkler ve daha düşük kontrast; uzun oyunda gözü yormaz. Canlı: daha doygun, parlak renkler.')],
        ['fxq', Tr('Görsel Efektler'), 'opt', Tr('Tam: bulut gölgeleri, duman, izler, su halkaları ve renk tonlaması. Sade: zayıf bilgisayarlar için azaltılmış efektler.')],
      ] },
      { n: Tr('Kontroller'), g: 'pad', rows: [
        ['padGlyphs', Tr('Kol Simgeleri'), 'opt', Tr('Ekranda gösterilecek oyun kolu tuş simgeleri. Otomatik, bağlı kolu tanır.')],
        ['aimAssist', Tr('Nişan Yardımı (Kol)'), 'opt', Tr('Kolla nişan alırken hedefe kilitlenme gücü. Tam Kilit, nişan tuşuna basınca en yakın hedefe kilitlenir.')],
        ['aimSens', Tr('Nişan Hassasiyeti (Kol)'), 'opt', Tr('Sağ analogla nişan alırken dönüş hızı.')],
        ['keys', Tr('Tuş Atamaları'), 'link', Tr('Klavye, fare ve oyun kolu tuşlarını değiştir.')],
      ] },
    ];
    const el = el_('div', 'modal panel settings');
    let m;
    const cur = (k, t) => t === 'fs' ? Platform.isFullscreen() : t === 'lang' ? I18N.lang : k === 'zoom' ? (S.zoom || 0) : S[k];
    const valTxt = (k, t) => {
      const v = cur(k, t);
      if (t === 'vol') return Math.round(v * 100) + '%';
      if (t === 'bool' || t === 'fs') return v ? Tr('Açık') : Tr('Kapalı');
      if (t === 'lang') return (I18N.LANGS.find(l => l[0] === v) || I18N.LANGS[0])[1];
      if (t === 'opt') return OPTL[k][v === undefined ? 1 : v];
      return '';
    };
    const control = (k, t) => {
      const v = cur(k, t);
      if (t === 'vol') { const pc = Math.round(v * 100); return `<div class="st-slider" data-slider="${k}"><div class="st-sl-track"><div class="st-sl-fill" style="width:${pc}%"></div><div class="st-sl-knob" style="left:${pc}%"></div></div></div><span class="st-num">${pc}</span>`; }
      if (t === 'bool' || t === 'fs') return `<div class="st-tog ${v ? 'on' : ''}"><span>${Tr('Kapalı')}</span><span>${Tr('Açık')}</span><b></b></div>`;
      if (t === 'lang') return `<div class="st-seg">${I18N.LANGS.map(l => `<span class="${l[0] === v ? 'on' : ''}" data-v="${l[0]}">${l[1]}</span>`).join('')}</div>`;
      if (t === 'opt') return `<div class="st-seg">${OPTL[k].map((o, i) => `<span class="${i === (v === undefined ? 1 : v) ? 'on' : ''}" data-v="${i}">${o}</span>`).join('')}</div>`;
      return `<span class="st-link">${Icons.glyph('pad', 'currentColor')} ›</span>`;
    };
    const side = (row) => {
      const [k, n, t, d] = row;
      const T = TABS[m.tab];
      return `<div class="st-side-ic">${Icons.glyph(T.g, '#c9a45c')}</div><div class="ps-t">${n}</div>${t !== 'link' ? `<div class="st-side-v">${valTxt(k, t)}</div>` : ''}<div class="ps-d st-desc">${d}</div>${k in DEF ? `<div class="st-def">${Tr`Varsayılan:`} ${t === 'vol' ? Math.round(DEF[k] * 100) + '%' : t === 'bool' ? (DEF[k] ? Tr('Açık') : Tr('Kapalı')) : OPTL[k][DEF[k]]}</div>` : ''}`;
    };
    const change = (k, t, d, direct) => {
      if (t === 'lang') {
        const L = I18N.LANGS, i = L.findIndex(l => l[0] === I18N.lang);
        S.lang = direct !== undefined ? direct : L[(i + d + L.length) % L.length][0];
        if (S.lang === I18N.lang) return;
        I18N.setLang(S.lang); G.saveSettings(); Audio_.ui('move');
        this.relocalize(m.tab, 'lang');
        return;
      }
      if (t === 'fs') { G.setFullscreenPref(direct !== undefined ? direct : !Platform.isFullscreen()); setTimeout(() => { if (m.alive) render(); }, 250); return; }
      if (t === 'link') { G.saveSettings(); this.openControls(); return; }
      if (t === 'vol') S[k] = clamp(direct !== undefined ? direct : Math.round((S[k] + d * 0.05) * 20) / 20, 0, 1);
      else if (t === 'bool') S[k] = direct !== undefined ? direct : !S[k];
      else if (t === 'opt') { const n = OPTL[k].length; S[k] = direct !== undefined ? direct : ((S[k] === undefined ? 1 : S[k]) + d + n) % n; }
      G.applySettings();
      if (t === 'vol') Audio_.ui('move');
      render();
    };
    const render = () => {
      const T = TABS[m.tab];
      const fk = m.focusEl ? m.focusEl.dataset.k : focusKey;
      el.innerHTML = `<div class="p-head st-head"><div class="p-title">${Tr`Ayarlar`}</div></div>
        <div class="p-tabs st-tabs">${Input.glyph('tabL')}${TABS.map((x, i) => `<span class="tab ${i === m.tab ? 'on' : ''}" data-tab="${i}">${Icons.glyph(x.g, 'currentColor')}${x.n}</span>`).join('')}${Input.glyph('tabR')}</div>
        <div class="p-body st-body"><div class="p-list scroll st-list">${T.rows.map(r => `<div class="p-item nav st-row" data-k="${r[0]}" data-t="${r[2]}" ${r[2] !== 'link' ? 'data-lr' : ''}><span class="pi-l">${r[1]}</span><span class="st-ctl">${control(r[0], r[2])}</span></div>`).join('')}</div><div class="p-side st-side"></div></div>
        <div class="p-foot st-foot"><span class="st-hint">${Tr`${Input.glyph('left')}${Input.glyph('right')} Değiştir &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Sekme`}</span>
          <span class="st-btns"><button class="st-btn nav" data-act="reset">${Input.glyph('alt')} ${Tr`Sekmeyi Varsayılana Döndür`}</button><button class="st-btn nav pref" data-act="close">${Input.glyph('back')} ${Tr`Kaydet ve Kapat`}</button></span></div>`;
      $('[data-act="close"]', el).onclick = () => { Audio_.ui('ok'); m.onBack(); };
      $('[data-act="reset"]', el).onclick = () => m.opts.onAlt(m);
      // ses kaydırıcıları: tıkla ya da sürükle; sürüklerken yalnızca ses ve görüntü güncellenir
      $$('[data-slider]', el).forEach(sl => {
        const k = sl.dataset.slider, row = sl.closest('.st-row');
        const set = (cx) => {
          const r = sl.querySelector('.st-sl-track').getBoundingClientRect();
          const v = clamp(Math.round((cx - r.left) / r.width * 20) / 20, 0, 1);
          if (v === S[k]) return;
          S[k] = v; Object.assign(Audio_.vol, { master: S.master, music: S.music, sfx: S.sfx, amb: S.amb }); Audio_.applyVolumes();
          const pc = Math.round(v * 100);
          sl.querySelector('.st-sl-fill').style.width = pc + '%'; sl.querySelector('.st-sl-knob').style.left = pc + '%';
          row.querySelector('.st-num').textContent = pc;
          const sv = $('.st-side-v', el); if (sv && m.focusEl === row) sv.textContent = pc + '%';
          if (!sl._tickT || performance.now() - sl._tickT > 70) { sl._tickT = performance.now(); Audio_.ui('move'); }
        };
        sl.onpointerdown = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (m.focusEl !== row) m.setFocus(row, true);
          sl.classList.add('drag'); set(e.clientX);
          try { sl.setPointerCapture(e.pointerId); } catch (_) {}
          sl.onpointermove = (ev) => set(ev.clientX);
          sl.onpointerup = sl.onpointercancel = () => { sl.classList.remove('drag'); sl.onpointermove = null; G.saveSettings(); };
        };
        sl.onclick = (e) => e.stopPropagation();
      });
      $$('.tab', el).forEach(n => (n.onclick = () => { m.tab = +n.dataset.tab; m.focusEl = null; focusKey = null; render(); }));
      $$('.st-row', el).forEach(n => {
        const k = n.dataset.k, t = n.dataset.t, row = T.rows.find(r => r[0] === k);
        n._lr = (d) => change(k, t, d);
        n._row = row;
        n.onclick = (e) => {
          const seg = e.target.closest('[data-v]');
          if (seg) change(k, t, 0, t === 'lang' ? seg.dataset.v : +seg.dataset.v);
          else if (t !== 'vol') change(k, t, 1);
        };
        n.onmouseenter = () => { if (m.focusEl !== n) m.setFocus(n, true); };
      });
      const target = $$('.st-row', el).find(n => n.dataset.k === fk) || $('.st-row', el);
      m.focusEl = null;
      m.setFocus(target, true);
    };
    m = this.makeModal(el, {
      onBack: () => { G.saveSettings(); this.pop(); },
      onTab: (d) => { m.tab = (m.tab + d + TABS.length) % TABS.length; m.focusEl = null; focusKey = null; render(); Audio_.ui('move'); },
      onAlt: () => {
        for (const r of TABS[m.tab].rows) if (r[0] in DEF) S[r[0]] = DEF[r[0]];
        G.applySettings(); G.saveSettings(); render(); this.feed(Tr('Bu sekmedeki ayarlar varsayılana döndü.'));
      },
      onFocus: (n) => { const sd = $('.st-side', el); if (sd && n._row) sd.innerHTML = side(n._row); },
    });
    m.tab = tab;
    render();
    this.push(m);
    return m;
  },
  /* Dil değişince açık menüleri yeni dilde yeniden kur (ayarlar dil satırında açık kalır) */
  relocalize(tab = 0, key = 'lang') {
    if (G.state === 'menu') this.showMainMenu();
    else { this.closeAll(); this.openPause(); }
    this.openSettings(tab, key);
  },

  /* ================= BİNALAR ================= */
  openBuilding(b) {
    const d = b.def, P = G.player;
    const svc = d.svc;
    const sub = TOWNS.find(t => t.id === b.town);
    this.menu({
      title: b.name, sub: () => Tr`${sub ? sub.n + ' • ' : ''}${G.timeStr()}`, wallet: true, cls: 'building',
      build: () => {
        const it = [];
        const closed = (G.hour < 6 || G.hour > 22) && !['saloon', 'hotel', 'sheriff', 'station', 'church', 'mine', 'lumber', 'docks', 'ranch', 'stable', 'cantina', 'gambling', 'warehouse'].includes(b.type);
        if (closed) { it.push({ html: `<p class="closed">${Tr`Dükkan kapalı. Açılış saati 06:00.`}</p>` }); if (svc.includes('rob')) it.push({ label: Tr('Kapıyı Kır ve Soy'), icon: '🔫', fn: () => this.robStore(b, true) }); return it; }
        if (P.masked && b.type !== 'fence') {
          it.push({ html: `<p class="closed">${b.type === 'sheriff' ? Tr('"Maskeyle şerif ofisine mi giriyorsun? Çıkar onu, hemen!"') : b.type === 'bank' ? Tr('"Maskeli müşteriye hizmet yok. Çıkar onu ya da defol."') : Tr('"Maskeni çıkar, yoksa sana hizmet etmem."')}</p>` });
          it.push({ icon: '🎭', label: Tr('Maskeyi Çıkar'), fn: () => G.toggleMask(null, true) });
          if (svc.includes('rob')) it.push({ icon: '🔫', label: Tr('Dükkanı Soy'), cls: 'danger', fn: () => this.robStore(b) });
          if (svc.includes('robbank')) it.push({ icon: '💣', label: Tr('Bankayı Soy'), cls: 'danger', fn: () => this.robBank(b) });
          return it;
        }
        it.push(...G.storyBuildingActions(b));
        const z = G.bizOf(b);
        if (z) it.push(...this.bizItems(b, z));
        else if (G.bizForSale(b)) it.push({ icon: '📜', label: Tr('Bu İşletmeyi Satın Al'), right: fmtMoney(G.bizPrice(b)), fn: () => this.confirmBuyBiz(b) });
        const gd = G.goodsAt(b);
        if (gd.length) it.push({ icon: '📦', label: Tr('Toptan Mal Al'), fn: () => this.openGoods(b) });
        for (const s of svc) if (!(z && (s === 'rob' || s === 'robbank'))) it.push(...this.svcItems(b, s));
        it.push({ icon: '🚪', label: Tr('Çık'), fn: () => this.pop() });
        return it;
      },
    });
  },
  /* Bir bina hizmetinin menü öğeleri (bina menüsü ve iç mekân eşyaları ortak kullanır) */
  svcItems(b, s) {
    const d = b.def, P = G.player, it = [];
    switch (s) {
      case 'shop': {
        it.push({ icon: '🛒', label: Tr('Alışveriş'), fn: () => this.openShop(d.shop, b.name) });
        const L = G.sellables(d.shop);
        if (L.length) it.push({ icon: '🦌', label: Tr`Getirdiğin Avı Sat (${L.length})`, right: fmtMoney(L.reduce((a, c) => a + G.loadValue(c.e, d.shop), 0)), fn: () => { G.sellCarried(d.shop); this.pop(); } });
        break;
      }
      case 'meal': it.push({ icon: '🍲', label: Tr('Sıcak Yemek Ye'), right: fmtMoney(0.25 * G.priceMul(true)), fn: () => { if (G.spend(0.25 * G.priceMul(true))) { P.hunger = Math.min(100, P.hunger + 60); P.thirst = Math.min(100, P.thirst + 25); P.hp = Math.min(P.maxHp, P.hp + 20); P.warmBuff = 120; G.stat('eaten', 1); this.feed(Tr('🍲 Doyasıya yedin.')); G.advanceClock(20); G.qEvent('eat', 'meal'); } } });
        it.push({ icon: '🥃', label: Tr('Bir Viski İç'), right: fmtMoney(0.1), fn: () => { if (G.spend(0.1)) { P.addItem('whiskey', 1, true); G.consume('whiskey'); G.qEvent('drink', 'whiskey'); } } }); break;
      case 'poker': it.push({ icon: '♠', label: Tr('Poker Oyna'), fn: () => this.openPoker(b) }); break;
      case 'blackjack': it.push({ icon: '🃏', label: Tr('Yirmi Bir Oyna'), fn: () => this.openBlackjack() }); break;
      case 'arm': it.push({ icon: '💪', label: Tr('Bilek Güreşi (25¢ bahis)'), fn: () => this.openArmWrestle() }); break;
      case 'rumor': it.push({ icon: '👂', label: Tr('Söylenti Dinle'), right: fmtMoney(0.05), fn: () => this.rumor() }); break;
      case 'rob': if (!G.bizOf(b)) it.push({ icon: '🔫', label: Tr('Dükkanı Soy'), cls: 'danger', fn: () => this.robStore(b) }); break;
      case 'news': it.push({ icon: '📰', label: Tr('Gazete Oku'), right: fmtMoney(0.05), fn: () => this.readNews() }); break;
      case 'room': it.push({ icon: '🛏', label: Tr('Oda Tut ve Uyu'), right: fmtMoney(0.5 * G.priceMul(true)), fn: () => this.openSleep('hotel', 0.5 * G.priceMul(true)) }); break;
      case 'bath': it.push({ icon: '🛁', label: Tr('Sıcak Banyo'), right: fmtMoney(0.25), fn: () => { if (G.spend(0.25)) { P.clean = 100; P.warmBuff = 60; this.feed(Tr('🛁 Tertemiz oldun. Kokun bile değişti.')); G.advanceClock(30); } } }); break;
      case 'heal': { const c = 1 * (G.hasPerk('saint') ? 0.5 : 1); it.push({ icon: '✚', label: Tr('Tedavi Ol (Sağlık, hastalık, zehir)'), right: fmtMoney(c), fn: () => { if (G.spend(c)) { P.hp = P.maxHp; P.sick = 0; P.poison = 0; this.feed(Tr('✚ Doktor seni muayene edip tedavi etti.')); G.advanceClock(30); } } }); break; }
      case 'bounty':
        if (G.law.bounty > 0) it.push({ icon: '⚖', label: Tr('Başındaki Ödülü Öde'), right: fmtMoney(G.law.bounty), fn: () => G.payBounty() });
        if (G.activeBounty && G.activeBounty.done) it.push({ icon: '💰', label: Tr('Ödül Avı Ödülünü Al'), right: fmtMoney(G.activeBounty.reward), fn: () => { G.earn(G.activeBounty.reward, Tr('Ödül avı')); G.addHonor(3); G.activeBounty = null; } });
        // omuzda ya da kapıdaki atın eyerinde getirilen suçlular
        for (const c of G.carriedAll()) if (c.e.kind === 'npc' && G.wantedValue(c.e)) it.push({ icon: '⚖', label: Tr`Teslim Et: ${c.e.name} ${c.e.dead ? Tr('(ölü)') : Tr('(canlı)')}`, right: fmtMoney(G.wantedValue(c.e)), fn: () => { G.deliverToSheriff(c); this.pop(); } });
        break;
      case 'board': it.push({ icon: '📜', label: Tr('Ödül İlanları'), fn: () => { this.openBountyBoard(); G.qEvent('board'); } }); break;
      case 'horses': it.push({ icon: '🐴', label: Tr('At Satın Al'), fn: () => this.openHorseShop(b) }); if (G.stable.length) it.push({ icon: '🏇', label: Tr('Ahırdaki Atların'), fn: () => this.openStable(b) });
        if (!G.myWagon) it.push({ icon: '📦', label: Tr('Yük Arabası Satın Al'), right: fmtMoney(WAGON_PRICE * G.priceMul(true)), fn: () => { G.buyWagon(b); this.pop(); } });
        else it.push({ icon: '📦', label: Tr('Arabanı Buraya Getirt'), right: fmtMoney(0.5), fn: () => G.fetchWagon(b) });
        break;
      case 'horsecare': if (G.horse && !G.horse.dead) it.push({ icon: '🧽', label: Tr`${G.horse.name}'i Tımar Ettir`, right: fmtMoney(0.25), fn: () => { if (dist(G.horse.x, G.horse.y, P.x, P.y) > 200) { this.feed(Tr('Atın burada değil.'), 'warn'); return; } if (G.spend(0.25)) { G.horse.hp = G.horse.maxHp; G.horse.sta = G.horse.maxSta; G.horse.addBond(5); this.feed(Tr`🐴 ${G.horse.name} tımar edildi.`); } } }); break;
      case 'bank': it.push({ icon: '🏦', label: Tr('Banka İşlemleri'), right: fmtMoney(G.bank), fn: () => this.openBank() }); break;
      case 'robbank': it.push({ icon: '💣', label: Tr('Bankayı Soy'), cls: 'danger', fn: () => this.robBank(b) }); break;
      case 'train': it.push({ icon: '🚂', label: Tr('Tren Bileti Al'), fn: () => this.openTrain(b) }); break;
      case 'stage': it.push({ icon: '🐴', label: Tr('Posta Arabası Bileti'), fn: () => this.openStage(b) }); it.push({ icon: '📦', label: G.haulers.length ? Tr`Nakliyeciler (${G.haulers.length}/${HAUL_MAX})` : Tr('Nakliyeci Tut'), fn: () => this.openHaulers(b) }); break;
      case 'donate': it.push({ icon: '🙏', label: Tr('Kiliseye Bağış Yap'), right: fmtMoney(0.5), fn: () => { if (G.spend(0.5)) { G.addHonor(3); this.feed(Tr('Rahip sana teşekkür etti.')); } } }); break;
      case 'pray': it.push({ icon: '✝', label: Tr('Dua Et'), fn: () => { const k = 'pray'; if (G.dailyTalk[k]) { this.feed(Tr('Bugün zaten dua ettin.')); return; } G.dailyTalk[k] = 1; P.energy = Math.min(100, P.energy + 8); P.deCore = Math.min(100, P.deCore + 20); G.addHonor(0.5); this.feed(Tr('İçin huzurla doldu.')); G.advanceClock(20); } }); break;
      case 'property': it.push({ icon: '📜', label: Tr('Satılık Mülkler'), fn: () => this.openLand() }); it.push({ icon: '🏪', label: Tr('Satılık İşletmeler ve Arsalar'), fn: () => this.openBizMarket(b) });
        it.push({ icon: '📜', label: Tr('Arazi Tapusu Al'), right: fmtMoney(DEED_PRICE), fn: () => G.buyDeed() });
        for (const h of G.homes.filter(x => !x.legal)) it.push({ icon: '⚖', label: Tr`Tapuya Bağla: ${G.homeName(h)}${h.sealed ? Tr(' (mühürlü)') : h.notice ? Tr(' (ihbarlı)') : ''}`, right: fmtMoney(G.homeLegalPrice(h)), fn: () => { if (G.homeLegalize(h)) this.pop(); } });
        break;
      case 'barber': it.push({ icon: '💈', label: Tr('Tıraş Ol / Saç Kestir'), right: fmtMoney(0.15), fn: () => this.openBarber() }); break;
      case 'work': it.push({ icon: '⚒', label: JOBS[d.work].n, fn: () => this.openWork(d.work, b.name) }); break;
    }
    return it;
  },
  openShop(shopId, title) {
    const S = SHOPS[shopId], P = G.player;
    const regional = S.mul || 1;   // pazar gibi seçkin dükkânlar daha pahalı satar
    this.menu({
      title: title || S.n, cls: 'shop', tabs: [Tr('Satın Al'), Tr('Sat')], side: (it) => it.sideHtml || '',
      wallet: true, okLabel: Tr('Al / Sat'),
      build: (m) => {
        const items = [];
        if (m.tab === 0) {
          if (S.weapons) {
            items.push({ header: Tr('Silahlar') });
            for (const w of S.weapons) {
              const W = WEAPONS[w], pr = W.p * G.priceMul(true) * regional;
              const own = P.weapons.has(w);
              items.push({ icon: Icons.weapon(w), label: W.n, right: own ? Tr('Sahipsin') : fmtMoney(pr), disabled: own, sideHtml: `<div class="ps-big">${Icons.weapon(w, 'ic wpn big')}</div><div class="ps-t">${W.n}</div><div class="ps-d">${W.lasso ? Tr('Yakala, bağla, taşı. Aranan suçluları canlı teslim et.') : W.melee ? Tr('Yakın dövüş silahı.') : Tr`Hasar: ${W.dmg}${W.pellets ? ' x' + W.pellets : ''}<br>Menzil: ${W.range}<br>Şarjör: ${W.clip}<br>Mühimmat: ${AMMO[W.ammo].n}`}</div>`, fn: () => { if (G.spend(pr)) { P.giveWeapon(w); if (W.ammo) P.ammo[W.ammo] = Math.min(AMMO[W.ammo].max, P.ammo[W.ammo] + AMMO[W.ammo].box); Audio_.ui('cash'); } } });
            }
          }
          if (S.ammo) {
            items.push({ header: Tr('Mühimmat') });
            for (const a of S.ammo) {
              const A = AMMO[a], pr = A.p * G.priceMul(true);
              items.push({ icon: Icons.glyph('ammo', '#d9c8a4'), label: `${A.n} (x${A.box})`, right: `${fmtMoney(pr)} <small>[${P.ammo[a]}]</small>`, disabled: P.ammo[a] >= A.max, why: Tr('Taşıyabileceğin en fazla mühimmat bu.'), sideHtml: `<div class="ps-t">${A.n}</div><div class="ps-d">${Tr`Kutu başına ${A.box} adet. Taşıma sınırı: ${A.max}`}</div>`, fn: () => { if (G.spend(pr)) { P.ammo[a] = Math.min(A.max, P.ammo[a] + A.box); Audio_.ui('cash'); G.qEvent('buy', { id: 'ammo_' + a, ammo: a, shop: shopId }); } } });
            }
          }
          if (S.sell && S.sell.length) {
            items.push({ header: Tr('Eşyalar') });
            for (const id of S.sell) {
              const it = ITEMS[id];
              if (!it) continue;
              if (id === 'treasure_map' && (G.treasure || P.has('treasure_map'))) continue;
              const pr = (id === 'treasure_map' ? 25 : it.p) * G.priceMul(true) * regional;
              const full = P.count(id) >= it.max;
              items.push({ icon: Icons.item(id), label: it.n, right: `${fmtMoney(pr)} <small>[${P.count(id)}]</small>`, disabled: full, why: Tr('Daha fazla taşıyamazsın.'), sideHtml: this.itemSide(it), fn: () => { if (G.spend(pr)) { P.addItem(id, 1, true); if (id === 'treasure_map') G.makeTreasure(); if (it.autoUse) G.consume(id); Audio_.ui('cash'); G.qEvent('buy', { id, shop: shopId }); if (shopId === 'saloon' && (id === 'beer' || id === 'whiskey' || id === 'sarsaparilla')) G.qEvent('drink', id); } } });
            }
          }
        } else {
          const ids = Object.keys(P.inv).filter(id => G.sellPrice(id, shopId) > 0 && id !== 'canteen').sort((a, b) => ITEMS[a].c.localeCompare(ITEMS[b].c));
          if (!ids.length) items.push({ html: `<p class="p-empty">${Tr`Bu dükkanın satın alacağı bir eşyan yok.`}</p>` });
          if (ids.length > 1) {
            const tot = ids.reduce((s, id) => s + G.sellPrice(id, shopId) * P.count(id), 0);
            const cats = new Set(ids.map(id => ITEMS[id].c));
            if (cats.has('animal')) {
              const tA = ids.filter(id => ITEMS[id].c === 'animal').reduce((s, id) => s + G.sellPrice(id, shopId) * P.count(id), 0);
              items.push({ icon: '💰', label: Tr('Tüm Av Ürünlerini Sat'), right: fmtMoney(tA), fn: () => { for (const id of ids) if (ITEMS[id].c === 'animal') { const n = P.count(id); P.removeItem(id, n); } G.earn(tA, Tr('Satış')); G.qEvent('sell', { all: 1 }); } });
            }
            void tot;
          }
          for (const id of ids) {
            const it = ITEMS[id], pr = G.sellPrice(id, shopId);
            const worn = P.coat === id || (P.masked && P.mask === id);
            items.push({ icon: Icons.item(id), label: it.n, right: `${fmtMoney(pr)} <small>[${P.count(id)}]</small>`, sideHtml: this.itemSide(it), disabled: worn, why: Tr('Üzerindeki giysiyi satamazsın.'), fn: () => { P.removeItem(id, 1); G.earn(pr, ''); G.skillXp('trade', 1 + pr * 0.1); G.qEvent('sell', { id }); } });
          }
        }
        return items;
      },
    });
  },
  /* Dükkan ve banka kasaları soyulunca boşalır; dükkan 3, banka 7 gün sonra yeniden dolar */
  robbedRecently(b, days) { const d = G.robbed[b.id]; return d !== undefined && G.day - d < days; },
  robStore(b, closed) {
    if (this.robbedRecently(b, 3)) { this.feed(Tr('Kasa boş. Bu dükkân yakın zamanda soyuldu.'), 'warn'); return; }
    this.confirm(closed ? Tr('Kasayı Boşalt') : Tr('Dükkanı Soy'), Tr('Bu bir suçtur. Kanun peşine düşecek. Emin misin?'), () => {
      if (this.robbedRecently(b, 3)) return;
      G.robbed[b.id] = G.day;
      const v = rnd(8, 25) * (G.hasPerk('devil') ? 2 : 1) * (closed ? 0.7 : 1);
      this.closeAll();
      G.earn(v, Tr('Soygun'));
      G.crime(closed ? 'storeNight' : 'storerob', G.player.x, G.player.y);
      Audio_.shot('pistol', 0.6);
    });
  },
  robBank(b) {
    if (!G.player.has('dynamite') && !G.player.isArmed) { this.feed(Tr('Banka soymak için silah ya da dinamit gerekli.'), 'warn'); return; }
    if (this.robbedRecently(b, 7)) { this.feed(Tr('Kasa boş. Banka yeni para getirtene kadar soyulacak bir şey yok.'), 'warn'); return; }
    this.confirm(Tr('Bankayı Soy'), Tr('Büyük bir suç. Bütün kanun peşine düşecek (4 yıldız). Emin misin?'), () => {
      if (this.robbedRecently(b, 7)) return;
      G.robbed[b.id] = G.day;
      const v = rnd(200, 600) * (G.hasPerk('devil') ? 1.5 : 1);
      this.closeAll();
      G.earn(v, Tr('Banka soygunu'));
      G.crime('bankrob', G.player.x, G.player.y);
      Audio_.boom(0.6);
    });
  },
  readNews() {
    if (!G.spend(0.05)) return;
    const [h, t] = pick(HEADLINES);
    const unk = G.world.pois.filter(p => p.kind === 'landmark' && !G.discovered.has(p.id) && !G.rumored.has(p.id));
    let extra = '';
    if (unk.length && chance(0.5)) { const p = pick(unk); G.rumored.add(p.id); extra = `<p class="dim">${Tr`Gazetenin arka sayfasında <b>${p.n}</b> hakkında bir okur mektubu var. Haritanda işaretlendi.`}</p>`; }
    this.info('The Frontier Gazette', `<div class="news"><div class="nw-h">${h}</div><p>${t}</p></div>${extra}`);
  },
  openDuel(e) {
    const P = G.player;
    if (!P.weapons.has('cattleman') && !P.weapons.has('schofield')) { e.say(Tr('Tabancan bile yok. Git başımdan!')); return; }
    const bet = Math.round((e.money + 2) * 4) / 4;
    const el = el_('div', 'modal duel');
    const st = { phase: 'ready', t: rnd(2, 4.5), react: 0, opp: rnd(0.3, 0.55) * (1 - G.skill('shooting') * 0.02) + (P.drunk > 40 ? -0.1 : 0) };
    const draw = (msg, big) => { el.innerHTML = `<div class="du-inner"><div class="du-t">${big || ''}</div><div class="du-m">${msg}</div><div class="du-h">${Tr`${Input.glyph('fire')} ya da ${Input.glyph('confirm')} ile çek`}</div></div>`; };
    draw(Tr`${escapeHtml(e.name)} ile düello. Ödül: ${fmtMoney(bet)}`, Tr('HAZIR OL'));
    P.weapon = P.weapons.has('schofield') ? 'schofield' : 'cattleman';
    P.ang = Math.atan2(e.y - P.y, e.x - P.x); e.ang = P.ang + Math.PI;
    const m = this.makeModal(el, { customInput: true, transparent: true });
    const finish = (win, msg) => {
      st.phase = 'end';
      Audio_.shot('pistol', 1);
      G.parts.add('flash', P.x + Math.cos(P.ang) * 8, P.y + Math.sin(P.ang) * 8, 0, 0, 0.08, 5);
      if (win) { e.hurt(999, 'duel'); G.earn(bet, Tr('Düello')); G.addHonor(1); G.skillXp('shooting', 15); G.stat('duels', 1); draw(msg, Tr('KAZANDIN')); }
      else { P.hurt(55, 'haydut'); if (G.state === 'play') { e.state = 'idle'; e.eventType = null; e.path = null; e.home = { x: e.x + 200, y: e.y, r: 50 }; } draw(msg, Tr('VURULDUN')); }
      setTimeout(() => { if (m.alive) this.pop(m); }, 2200);
    };
    m.update = (dt) => {
      const I = Input;
      if (m.born >= this.frame - 1 || st.phase === 'end') return;
      const pulled = I.pressed('fire') || I.pressed('confirm');
      if (st.phase === 'ready') {
        st.t -= dt;
        if (pulled) { finish(false, Tr('Erken davrandın! Rakibin seni fark etti.')); return; }
        if (st.t <= 0) { st.phase = 'draw'; draw('', Tr('ÇEK!')); Audio_.tone(880, 0.15, 'square', 0.08); }
      } else if (st.phase === 'draw') {
        st.react += dt;
        if (pulled) finish(st.react < st.opp, Tr`Tepki süren: ${(st.react * 1000) | 0} ms • Rakip: ${(st.opp * 1000) | 0} ms`);
        else if (st.react > st.opp) finish(false, Tr`Çok yavaştın. Rakip: ${(st.opp * 1000) | 0} ms`);
      }
    };
    this.push(m);
  },
  rumor() {
    if (!G.spend(0.05)) return;
    if (G.storyRumor()) return;
    const unk = G.world.pois.filter(p => (p.kind === 'landmark' || p.kind === 'camp') && !G.discovered.has(p.id) && !G.rumored.has(p.id));
    const line = pick(LINES.rumor);
    if (unk.length) {
      const p = pick(unk);
      G.rumored.add(p.id);
      this.info(Tr('Barmen Fısıldıyor'), `<p class="quote">"${line}"</p><p>${Tr`Ayrıca <b>${p.n}</b> hakkında bir şeyler duydun. Haritanda <b>?</b> olarak işaretlendi.`}</p>`);
    } else this.info(Tr('Barmen Fısıldıyor'), `<p class="quote">"${line}"</p>`);
  },
  openSleep(where, cost) {
    const P = G.player;
    const untilMorning = ((7 - G.hour) + 24) % 24 || 24;
    const opts = [[2, Tr('2 Saat Kestir')], [4, Tr('4 Saat Uyu')], [8, Tr('8 Saat Uyu')], [Math.round(untilMorning), Tr`Sabaha Kadar (${Math.round(untilMorning)} saat)`]];
    this.menu({
      title: where === 'hotel' ? Tr('Otel Odası') : where === 'home' ? Tr('Evin') : Tr('Kamp'), cls: 'small', sub: Tr`Uyku: ${Math.round(P.energy)}/100 • ${G.timeStr()}`,
      items: opts.map(([h, n]) => ({ label: n, fn: () => { if (cost && !G.spend(cost)) return; this.closeAll(); G.sleep(h, where); } })).concat([{ label: Tr('Vazgeç'), fn: () => this.pop() }]),
    });
  },
  openWait() {
    this.menu({ title: Tr('Zaman Geçir'), cls: 'small', items: [[1, Tr('1 Saat Bekle')], [3, Tr('3 Saat Bekle')], [6, Tr('6 Saat Bekle')]].map(([h, n]) => ({ label: n, fn: () => { this.closeAll(); G.passTime(h); } })).concat([{ label: Tr('Kalk'), fn: () => this.pop() }]) });
  },
  openWork(jobId, place) {
    const J = JOBS[jobId];
    const mul = (1 + G.skill(J.skill) * 0.05) * (G.hasPerk('worker') ? 1.25 : 1);
    this.menu({
      title: J.n, sub: place, cls: 'small',
      items: [
        { html: `<p>${J.desc}</p><p>${Tr`<b>Süre:</b> ${J.hours} saat<br><b>Ücret:</b> ${fmtMoney(J.pay[0] * mul)} – ${fmtMoney(J.pay[1] * mul)}<br><b>Yorgunluk:</b> -${J.energy} uyku, -${J.hunger} açlık, -${J.thirst} susuzluk`}</p><p class="dim">${Tr`Çalışma saatleri 06:00 – 18:00`}</p>` },
        { label: Tr('Çalış'), fn: () => { if (G.work(jobId, place)) this.closeAll(); } },
        { label: Tr('Vazgeç'), fn: () => this.pop() },
      ],
    });
  },
  openCamp() {
    const P = G.player;
    this.menu({
      title: Tr('Kamp'), cls: 'small', sub: () => Tr`Ateşin başında ısınıyorsun • ${G.timeStr()}`,
      items: [
        { icon: '🛏', label: Tr('Uyu'), fn: () => this.openSleep('camp') },
        { icon: '🍖', label: Tr('Pişir ve Üret'), fn: () => this.openCook() },
        { icon: '⏳', label: Tr('Ateş Başında Bekle'), fn: () => this.openWait() },
        ...(P.has('harmonica') ? [{ icon: '🎵', label: Tr('Mızıka Çal'), fn: () => { const d = Audio_.harmonica(); P.deCore = Math.min(100, P.deCore + 15); P.energy = Math.min(100, P.energy + 3); G.advanceClock(15); this.feed(Tr('🎵 Ateşin başında hüzünlü bir ezgi çaldın.')); } }] : []),
        { icon: '💾', label: Tr('Oyunu Kaydet'), fn: () => G.saveGame() },
        { icon: '⛺', label: Tr('Kampı Topla'), fn: () => { if (G.camp) { G.camp.remove = true; G.ents = G.ents.filter(e => e !== G.camp); G.camp = null; } this.pop(); } },
        { icon: '←', label: Tr('Kapat'), fn: () => this.pop() },
      ],
    });
  },
  openCook() {
    const P = G.player;
    const fishIds = Object.keys(ITEMS).filter(k => k.startsWith('fish_'));
    const can = (R) => {
      for (const k in R.need) {
        if (R.anyFish && k === 'raw_fish') { const n = fishIds.reduce((s, f) => s + P.count(f), 0) + P.count('raw_fish'); if (n < R.need[k]) return false; continue; }
        if (!P.has(k, R.need[k])) return false;
      }
      return true;
    };
    this.menu({
      title: Tr('Pişir ve Üret'), cls: 'shop', side: (it) => it.sideHtml || '',
      build: () => RECIPES.map(R => ({
        icon: R.out ? Icons.item(Object.keys(R.out)[0]) : Icons.weapon('bow'), label: R.n, right: can(R) ? '✔' : '', disabled: !can(R), why: Tr('Gerekli malzemeler eksik.'),
        sideHtml: `<div class="ps-t">${R.n}</div><div class="ps-d">${Tr`Gerekenler:<br>${Object.keys(R.need).map(k => `${Icons.item(k, 'ic inl')} ${R.anyFish && k === 'raw_fish' ? Tr('Herhangi bir balık') : ITEMS[k].n} x${R.need[k]} <small>[${R.anyFish && k === 'raw_fish' ? fishIds.reduce((s, f) => s + P.count(f), 0) + P.count('raw_fish') : P.count(k)}]</small>`).join('<br>')}`}</div>`,
        fn: () => {
          for (const k in R.need) {
            if (R.anyFish && k === 'raw_fish') { let n = R.need[k]; for (const f of ['raw_fish', ...fishIds]) { const r = P.removeItem(f, n); n -= r; if (n <= 0) break; } continue; }
            P.removeItem(k, R.need[k]);
          }
          if (R.out) for (const k in R.out) P.addItem(k, R.out[k]);
          if (R.outAmmo) for (const k in R.outAmmo) { P.ammo[k] = Math.min(AMMO[k].max, P.ammo[k] + R.outAmmo[k]); this.feed(`+${R.outAmmo[k]} ${AMMO[k].n}`); }
          G.advanceClock(10);
          G.skillXp('survival', 2);
          G.qEvent('cook', R.id);
          if (G.hasPerk('camper') && R.id.startsWith('cook')) P.hp = Math.min(P.maxHp, P.hp + 5);
        },
      })),
    });
  },
  openProperty(b) {
    const P = G.player;
    const PR = PROPERTIES.find(p => p.id === b.prop);
    if (!G.props.includes(b.prop)) {
      this.menu({
        title: PR.n, sub: Tr('Satılık'), cls: 'small',
        items: [
          { html: `<p>${PR.perks}</p><p>${Tr`<b>Fiyat:</b> ${fmtMoney(PR.p)}`}</p><p class="dim">${Tr`Mülk sahibi olmak; güvenli uyku, kayıt, eşya sandığı ve evlilik imkânı sağlar.`}</p>` },
          { label: Tr`Satın Al (${fmtMoney(PR.p)})`, disabled: P.money < PR.p, why: Tr('Paran yetmiyor. Bankadaki parayı çekmeyi unutma.'), fn: () => this.buyProperty(PR) },
          { label: Tr('Vazgeç'), fn: () => this.pop() },
        ],
      });
      return;
    }
    this.menu({
      title: PR.n, sub: G.family.spouse ? Tr`${G.family.spouse.name} ile evin` : Tr('Evin'), cls: 'small',
      items: [
        { icon: '🛏', label: Tr('Uyu'), fn: () => this.openSleep('home') },
        { icon: '📦', label: Tr('Sandık'), fn: () => this.openStash() },
        { icon: '🍖', label: Tr('Mutfak (Pişir)'), fn: () => this.openCook() },
        { icon: '💾', label: Tr('Oyunu Kaydet'), fn: () => G.saveGame() },
        { icon: '🚪', label: Tr('Çık'), fn: () => this.pop() },
      ],
    });
  },
  buyProperty(PR) {
    if (!G.spend(PR.p)) return;
    G.props.push(PR.id);
    for (const b of G.world.buildings) if (b.prop === PR.id) { b.owned = true; b.name = PR.n + Tr(' (Evin)'); b.cover = null; G.world.invalidateChunkAt(b.door.x, b.door.y); }
    this.closeAll();
    this.toast(Tr('Mülk Satın Alındı'), PR.n, 'ach');
    Audio_.chime();
  },
  openLand() {
    this.menu({
      title: Tr('Tapu Dairesi'), sub: Tr('Satılık mülkler'), cls: 'shop', wallet: true, side: (it) => it.sideHtml || '',
      build: () => PROPERTIES.map(PR => {
        const own = G.props.includes(PR.id);
        const poi = G.world.pois.find(p => p.prop === PR.id);
        return {
          icon: '🏠', label: PR.n, right: own ? Tr('Sahipsin') : fmtMoney(PR.p), disabled: own,
          sideHtml: `<div class="ps-t">${PR.n}</div><div class="ps-d">${Tr`${PR.perks}<br><br>Konum: ${G.world.regionAt(poi.x, poi.y)}`}</div>`,
          fn: () => { G.rumored.add(poi.id); this.confirm(PR.n, Tr`${fmtMoney(PR.p)} karşılığında satın alınsın mı? (Konum haritada işaretlendi.)`, () => this.buyProperty(PR)); G.setWaypoint(poi.x, poi.y); },
        };
      }),
    });
  },
  openStash() {
    const P = G.player;
    this.menu({
      title: Tr('Sandık'), cls: 'shop', tabs: [Tr('Çantadan Koy'), Tr('Sandıktan Al')],
      build: (m) => {
        if (m.tab === 0) return Object.keys(P.inv).filter(id => id !== 'canteen').map(id => ({ icon: Icons.item(id), label: ITEMS[id].n, right: Tr`x${P.inv[id]} <small>[sandık ${G.stash[id] || 0}]</small>`, fn: () => { P.removeItem(id, 1); G.stash[id] = (G.stash[id] || 0) + 1; } }));
        return Object.keys(G.stash).filter(id => G.stash[id] > 0).map(id => ({ icon: Icons.item(id), label: ITEMS[id].n, right: `x${G.stash[id]}`, fn: () => { if (P.addItem(id, 1, true)) { G.stash[id]--; if (!G.stash[id]) delete G.stash[id]; } else this.feed(Tr('Çantada yer yok.'), 'warn'); } }));
      },
      empty: Tr('Boş.'),
    });
  },
  openHorseShop(b) {
    const P = G.player;
    this.menu({
      title: Tr('At Satın Al'), cls: 'shop', side: (it) => it.sideHtml || '', wallet: true,
      build: () => Object.keys(HORSE_BREEDS).filter(k => HORSE_BREEDS[k].p > 0).map(k => {
        const B = HORSE_BREEDS[k], pr = B.p * G.priceMul(true);
        const bar = (v, mx) => `<div class="statbar"><i style="width:${v / mx * 100}%"></i></div>`;
        return {
          icon: '🐴', label: B.n, right: fmtMoney(pr),
          sideHtml: `<div class="ps-t">${B.n}</div><div class="ps-d">${Tr`Hız${bar(B.spd, 1.3)}Dayanıklılık${bar(B.sta, 170)}Sağlık${bar(B.hp, 190)}`}</div>`,
          fn: () => { if (G.spend(pr)) { const h = new Horse(b.door.x + 20, b.door.y + 20, k, { owner: 'player' }); h.ang = Math.PI / 2; G.setHorse(h); this.toast(Tr('Yeni At'), Tr`${h.name} (${B.n}) artık senin.`, 'horse'); Audio_.neigh(); G.qEvent('horse', h); } },
        };
      }),
    });
  },
  openStable(b) {
    this.menu({
      title: Tr('Ahırdaki Atların'), cls: 'small',
      build: () => G.stable.map((s, i) => ({ icon: '🐴', label: `${s.name} (${HORSE_BREEDS[s.breed].n})`, fn: () => { G.stable.splice(i, 1); const h = new Horse(b.door.x + 20, b.door.y + 20, s.breed, { owner: 'player', name: s.name, look: s.look, bond: s.bond }); G.setHorse(h); this.feed(Tr`🐴 ${h.name} ahırdan çıkarıldı.`); this.pop(); } })),
    });
  },
  openBank() {
    const P = G.player;
    this.menu({
      title: Tr('Banka'), wallet: true, sub: () => Tr`Hesap: <b>${fmtMoney(G.bank)}</b><br><small>Bankadaki para ölünce kaybolmaz ve yıllık %2 faiz kazanır.</small>`, cls: 'small',
      build: () => {
        const it = [];
        for (const v of [1, 10, 50]) it.push({ label: Tr`${fmtMoney(v)} Yatır`, disabled: P.money < v, fn: () => { P.money -= v; G.bank += v; G.qEvent('deposit', v); } });
        it.push({ label: Tr('Tümünü Yatır'), disabled: P.money < 0.01, fn: () => { G.qEvent('deposit', P.money); G.bank += P.money; P.money = 0; } });
        for (const v of [1, 10, 50]) it.push({ label: Tr`${fmtMoney(v)} Çek`, disabled: G.bank < v, fn: () => { G.bank -= v; P.money += v; } });
        it.push({ label: Tr('Tümünü Çek'), disabled: G.bank < 0.01, fn: () => { P.money += G.bank; G.bank = 0; } });
        return it;
      },
    });
  },
  openTrain(b) {
    const P = G.player;
    const here = G.world.towns.find(t => t.id === b.town);
    const stations = G.world.towns.filter(t => t.station && t !== here);
    this.menu({
      title: Tr('Tren Bileti'), sub: Tr`${here.n} İstasyonu`, cls: 'small', wallet: true,
      build: () => stations.map(t => {
        const d = dist(here.cx, here.cy, t.cx, t.cy);
        const pr = Math.max(0.25, d / 5000) * (G.hasPerk('towns') ? 0.5 : 1);
        const hrs = Math.max(1, Math.round(d / 2200));
        return { icon: '🚂', label: t.n, right: Tr`${fmtMoney(pr)} • ${hrs} sa`, fn: () => {
          if (G.law.level > 0) { this.feed(Tr('Aranırken trene binemezsin!'), 'warn'); return; }
          if (!G.spend(pr)) return;
          this.closeAll();
          this.fade(() => {
            G.advanceClock(hrs * 60);
            G.survivalUpdate(hrs * 60, false);
            const st = t.station;
            if (P.riding) P.dismount();
            P.x = st.door.x; P.y = st.door.y + 12;
            if (G.horse && !G.horse.dead) { G.horse.x = P.x + 24; G.horse.y = P.y + 8; G.horse.state = 'idle'; }
            G.cam.x = P.x; G.cam.y = P.y;
            G.stat('trainRides', 1);
            G.prefetch(true);
            G.qEvent('train', t);
          }, Tr`${t.n} yolunda...`);
        } };
      }),
    });
  },
  /* Yolcu posta arabası: tren olmayan kasabalara da gider; daha yavaş ve pahalı, yolda gecikme olabilir */
  openStage(b) {
    const P = G.player, Wd = G.world;
    const here = Wd.towns.find(t => t.id === b.town);
    // gidilebilecek yerler: ziyaret edilmiş kasabalar ve buraya yakın (komşu) kasabalar
    const dests = Wd.towns.filter(t => t !== here && (G.visited.has(t.id) || dist(here.cx, here.cy, t.cx, t.cy) < 7000 || G.storyStageDest(t)))
      .sort((a, c) => dist(here.cx, here.cy, a.cx, a.cy) - dist(here.cx, here.cy, c.cx, c.cy));
    this.menu({
      title: Tr('Posta Arabası'), sub: Tr`${here.n} Durağı`, cls: 'small', wallet: true,
      build: () => dests.map(t => {
        const d = dist(here.cx, here.cy, t.cx, t.cy);
        const pr = Math.max(0.4, d / 3600) * (G.hasPerk('towns') ? 0.75 : 1);
        const hrs = Math.max(2, Math.round(d / 1300));
        return { icon: '🐴', label: t.n + (G.visited.has(t.id) ? '' : Tr(' (yeni)')), right: Tr`${fmtMoney(pr)} • ${hrs} sa`, fn: () => {
          if (G.law.level > 0) { this.feed(Tr('Aranırken arabacı seni almaz!'), 'warn'); return; }
          if (!G.spend(pr)) return;
          this.closeAll();
          const late = chance(0.15) ? rndi(1, 3) : 0;
          this.fade(() => {
            G.advanceClock((hrs + late) * 60);
            G.survivalUpdate((hrs + late) * 60, false);
            if (P.riding) P.dismount();
            const st = t.buildings.find(x => x.type === 'post') || t.buildings.find(x => x.type === 'stable');
            if (st) { P.x = st.door.x; P.y = st.door.y + 14; } else { P.x = t.spawn.x; P.y = t.spawn.y; }
            if (G.horse && !G.horse.dead) { G.horse.x = P.x + 24; G.horse.y = P.y + 8; G.horse.state = 'idle'; }
            G.cam.x = P.x; G.cam.y = P.y;
            G.stat('stageRides', 1);
            G.prefetch(true);
            G.qEvent('stage', t);
            if (late) this.feed(Tr`Yolda bir tekerlek kırıldı; ${late} saat gecikmeyle vardın.`);
          }, Tr`${t.n} yolunda...`);
        } };
      }),
      empty: Tr('Buradan kalkan bir sefer yok.'),
    });
  },
  openBarber() {
    const P = G.player, L = P.look;
    this.menu({
      title: Tr('Berber'), cls: 'small', wallet: true, sub: Tr('Her işlem 15¢'),
      build: () => {
        const it = [{ header: Tr('Saç') }];
        LOOKS.hairStyle.forEach((_, i) => it.push({ label: hairStyleN(L, i) + (L.hairStyle === i ? ' ✔' : ''), fn: () => { if (G.spend(0.15)) { L.hairStyle = i; P._lk = null; P.clean = Math.min(100, P.clean + 10); } } }));
        if (L.sex === 'm') {
          it.push({ header: Tr('Sakal') });
          LOOKS.beard.forEach((n, i) => it.push({ label: n + (L.beard === i ? ' ✔' : ''), fn: () => { if (G.spend(0.15)) { L.beard = i; L.beardLen = 0.2; P._lk = null; } } }));
        }
        return it;
      },
    });
  },
  openGift(e, R) {
    const P = G.player;
    this.menu({
      title: Tr('Hediye Ver'), sub: R.name, cls: 'small',
      build: () => {
        const ids = Object.keys(P.inv).filter(id => ITEMS[id].gift);
        return ids.map(id => ({ icon: Icons.item(id), label: ITEMS[id].n, right: 'x' + P.inv[id], fn: () => { G.giveGift(e, R, id); this.pop(); } }));
      },
      empty: Tr('Hediye edebileceğin bir şey yok. (Çiçek, çikolata, mücevher…)'),
    });
  },
  openBountyBoard() {
    if (!G.bounties) {
      const W = G.world;
      const crimes = [Tr('Tren soygunu'), Tr('Cinayet'), Tr('At hırsızlığı'), Tr('Banka soygunu'), Tr('Posta arabası soygunu'), Tr('Firar'), Tr('Sığır hırsızlığı')];
      G.bounties = [];
      for (let k = 0; k < 3; k++) {
        const cands = W.pois.filter(p => p.kind === 'landmark' || p.kind === 'camp');
        const p = pick(cands);
        const sex = chance(0.85) ? 'm' : 'f';
        G.bounties.push({ id: 'b' + G.day + k, name: pick(NAMES[sex]) + ' "' + pick([Tr('Kara'), Tr('Deli'), Tr('Sessiz'), Tr('Kör'), Tr('Kızıl'), Tr('Tilki'), Tr('Çakal'), Tr('Topal')]) + '" ' + pick(NAMES.last), crime: pick(crimes), reward: rndi(5, 20) * 5, x: p.x + rnd(-60, 60), y: p.y + rnd(-60, 60), where: p.n, hench: rndi(1, 3) });
      }
    }
    this.menu({
      title: Tr('Ödül İlanları'), cls: 'shop board', side: (it) => it.sideHtml || '',
      build: () => {
        const it = [];
        const A = G.activeBounty, sp = G.storyPoster();
        if (sp) it.push({ html: sp });
        if (A) it.push({ html: `<p class="active-b">${Tr`Aktif: <b>${A.name}</b> — ${A.done ? Tr('Etkisiz hale getirildi. Ödülü bir şerif ofisinden al.') : Tr('{0} civarında.', A.where)}`}</p>` });
        for (const b of G.bounties) {
          it.push({ icon: '📜', label: b.name, right: fmtMoney(b.reward), disabled: !!A, why: Tr('Önce aktif ödül avını tamamla.'),
            sideHtml: `<div class="poster"><div class="po-w">ARANIYOR</div><div class="po-n">${b.name}</div><div class="po-c">${b.crime}</div><div class="po-r">${fmtMoney(b.reward)}</div><div class="po-l">${Tr`Son görüldüğü yer:<br>${b.where}`}</div></div>`,
            fn: () => { G.activeBounty = Object.assign({}, b, { done: false, spawned: false }); G.bounties = G.bounties.filter(x => x !== b); G.setWaypoint(b.x, b.y); this.feed(Tr('📜 Ödül avı kabul edildi. Hedef haritada işaretlendi.')); } });
        }
        return it;
      },
    });
  },
  showSign(x, y) {
    const towns = G.world.towns.slice().sort((a, b) => dist2(a.cx, a.cy, x, y) - dist2(b.cx, b.cy, x, y)).slice(0, 5);
    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const rows = towns.map(t => {
      const a = Math.atan2(t.cy - y, t.cx - x);
      const i = Math.round(((a + TAU) % TAU) / (TAU / 8)) % 8;
      const miles = dist(x, y, t.cx, t.cy) / 1609 * 3.2;
      return `<div class="sign-row"><span class="sa">${arrows[i]}</span><span class="sn">${t.n}</span><span class="sm">${miles.toFixed(1)} mil</span></div>`;
    }).join('');
    this.info(Tr('Yol Tabelası'), `<div class="signboard">${rows}</div>`);
  },
  /* Arsa tabelası: satılık arsa, senin arsan ya da süren inşaat */
  showLot(lot) {
    const t = G.world.towns.find(tw => tw.id === lot.town), mine = G.lotOwned(lot), z = G.lotBiz(lot);
    const card = `<div class="signboard"><div class="sign-row"><span class="sn">${t ? t.n : ''}</span><span class="sm">${lot.w}×${lot.h}</span></div>${mine ? '' : `<div class="sign-row"><span class="sn">${Tr('Fiyat')}</span><span class="sm">$${lot.price}</span></div>`}</div>`;
    const items = [];
    if (z && z.site) items.push({ html: card + `<p>${Tr`Burada ${BUILDINGS[z.type].n} inşa ediliyor. Kalan: ${Math.max(0, z.ready - G.day)} gün.`}</p>` });
    else if (mine) { items.push({ html: card + `<p>${Tr('Bu arsa senin. Üzerine bir işletme kurabilirsin.')}</p>` }); items.push({ icon: '🔨', label: Tr('İnşaata Başla'), fn: () => { this.pop(); this.openBuildMenu(lot); } }); }
    else {
      items.push({ html: card + `<p>${Tr('Arsayı satın alıp üzerine kendi işletmeni kurabilirsin. Tapu işleri ilçe binasında da görülür.')}</p>` });
      items.push({ icon: '📜', label: Tr('Arsayı Satın Al'), right: fmtMoney(lot.price), disabled: G.player.money < lot.price, why: Tr('Yeterli paran yok.'), fn: () => { if (G.buyLot(lot)) { this.pop(); this.showLot(lot); } } });
    }
    items.push({ label: Tr('Kapat'), fn: () => this.pop() });
    this.menu({ title: mine ? Tr('Arsan') : Tr('Satılık Arsa'), cls: 'small', items });
  },
  openBuildMenu(lot) {
    const t = G.world.towns.find(tw => tw.id === lot.town);
    this.menu({
      title: Tr('İnşaat'), wallet: true, sub: () => Tr`${t.n} • ${BUILD_DAYS} günde biter`, cls: 'small', side: (it) => it.side || '',
      build: () => G.lotTypes(lot).sort((a, c) => BIZ[a].p - BIZ[c].p).map(k => {
        const pr = G.bizBuildPrice(k, t), B = BIZ[k];
        return { icon: BICON[k] ? Icons.glyph(BICON[k], '#efe6d2') : '🏪', label: BUILDINGS[k].n, right: fmtMoney(pr), disabled: G.player.money < pr, why: Tr('Yeterli paran yok.'),
          side: this.bizSide(k, t), fn: () => { if (G.startBuild(lot, k)) this.closeAll(); } };
      }),
    });
  },
  /* İşletme türü açıklaması (yan panel) */
  bizSide(type, t) {
    const B = BIZ[type];
    return `<div class="ps-t">${BUILDINGS[type].n}</div><div class="ps-d">${Tr`${BIZ_TIERS[B.tier]} işletme`}</div><div class="ps-e">${Tr`Günlük brüt gelir: ~${fmtMoney(B.inc * G.bizTownMul(t))}`}<br>${B.goods ? Tr`Tükettiği mal: <b>${GOODS[B.goods].n}</b> (depo ${B.cap} sandık, günde ~${B.use})` : Tr('Mal gerektirmez.')}</div>`;
  },
  confirmBuyBiz(b) {
    const pr = G.bizPrice(b), kr = G.keeperOf(b);
    this.confirm(Tr('İşletme Satın Al'), Tr`${b.name} — ${fmtMoney(pr)}. ${kr ? Tr`${kr.name} işletmeci olarak kalır.` : ''}`, () => { if (G.buyBiz(b)) this.closeAll(); }, Tr('Vazgeç'), Tr`Satın Al (${fmtMoney(pr)})`);
  },
  /* Sahip olunan işletmenin menü öğeleri */
  bizItems(b, z) {
    const B = BIZ[z.type], T = MGR_TRAITS[z.mgr.trait], it = [];
    it.push({ header: Tr('İşletmen') });
    it.push({ html: `<div class="biz-card"><div><b>${Tr`İşletmeci:`}</b> ${escapeHtml(z.mgr.name)} <span class="dim">(${T.n})</span></div><div><b>${Tr`Stok:`}</b> <span class="st-${G.bizStockCls(z)}">${G.bizStockWord(z)}</span>${B.goods ? ` <span class="dim">— ${GOODS[B.goods].n}</span>` : ''}</div><div><b>${Tr`Dünkü gelir:`}</b> ${fmtMoney(z.last)} &nbsp; <b>${Tr`Toplam:`}</b> ${fmtMoney(z.total)}</div></div>` });
    it.push({ icon: '💵', label: Tr('Kasayı Al'), right: fmtMoney(z.cash), disabled: z.cash < 0.01, why: Tr('Kasa boş.'), fn: () => G.bizCollect(z) });
    const dl = G.deliverables(b);
    if (dl.length) it.push({ icon: '📦', label: Tr`Mal Teslim Et (${dl.length})`, fn: () => G.deliverGoods(b) });
    it.push({ icon: '🏦', label: z.bank ? Tr('Gelir bankaya aktarılıyor (%10 kesinti)') : Tr('Gelir kasada birikiyor'), right: z.bank ? Tr('Açık') : Tr('Kapalı'), fn: () => { z.bank = !z.bank; } });
    it.push({ icon: '👤', label: Tr('İşletmeciyi Değiştir'), right: fmtMoney(5), fn: () => this.confirm(Tr('İşletmeciyi Değiştir'), Tr`${z.mgr.name} gönderilir, yerine yeni biri gelir.`, () => G.bizNewMgr(z)) });
    it.push({ header: Tr('Hizmetler') });
    return it;
  },
  /* Toptan mal satışı */
  openGoods(b) {
    const need = G.goodsNeeded();
    this.menu({
      title: Tr('Toptan Mal'), wallet: true, sub: () => b.name, cls: 'small',
      build: () => {
        const it = [];
        for (const { g, p } of G.goodsAt(b)) {
          const n = need[g] || 0;
          it.push({ header: GOODS[g].n + (n ? Tr` — işletmelerinin ihtiyacı: ${n}` : '') });
          for (const k of [1, 2, 4, 8]) it.push({ icon: '📦', label: Tr`${k} sandık`, right: fmtMoney(p * k), disabled: G.player.money < p * k, why: Tr('Yeterli paran yok.'), fn: () => { G.buyGoods(b, g, p, k); this.closeAll(); } });
        }
        if (!G.biz.length) it.unshift({ html: `<p class="dim">${Tr('Henüz bir işletmen yok. Toptan mal yalnızca işletme sahiplerinin işine yarar.')}</p>` });
        return it;
      },
    });
  },
  /* Nakliyeciler: iş arayanlar ve çalışanların */
  openHaulers(b) {
    const t = G.world.towns.find(x => x.id === b.town) || G.nearestTown(b.door.x, b.door.y);
    const traitSide = (k, name) => `<div class="ps-t">${escapeHtml(name)}</div><div class="ps-d">${HAUL_TRAITS[k].n}</div><div class="ps-e">${HAUL_TRAITS[k].d}<br>${Tr`Peşin ${fmtMoney(HAUL_HIRE)}, günlük maaş ${fmtMoney(HAUL_TRAITS[k].wage)}. Arabası ${HAUL_CAP} sandık taşır.`}</div>`;
    this.menu({
      title: Tr('Nakliyeciler'), wallet: true, sub: () => t.n, cls: 'small', side: (it) => it.side || '',
      build: () => {
        const it = [];
        if (G.haulers.length) {
          it.push({ header: Tr('Nakliyecilerin') });
          for (const h of G.haulers) it.push({ icon: '🚚', label: `${escapeHtml(h.name)} <span class="dim">(${HAUL_TRAITS[h.trait].n})</span>`, right: Tr('İşten Çıkar'), side: traitSide(h.trait, h.name) + `<div class="ps-p">${escapeHtml(G.haulStatus(h))}</div>`, fn: () => this.confirm(Tr('İşten Çıkar'), Tr`${h.name} ile yollarını ayırmak istiyor musun?`, () => G.fireHauler(h)) });
        }
        const C = G.haulCandidates(t);
        it.push({ header: Tr('İş Arayanlar') });
        for (const c of C) it.push({ icon: '🚚', label: `${escapeHtml(c.name)} <span class="dim">(${HAUL_TRAITS[c.trait].n})</span>`, right: Tr`${fmtMoney(HAUL_HIRE)} + ${fmtMoney(HAUL_TRAITS[c.trait].wage)}/gün`, side: traitSide(c.trait, c.name), disabled: G.haulers.length >= HAUL_MAX || G.player.money < HAUL_HIRE, why: G.haulers.length >= HAUL_MAX ? Tr`En fazla ${HAUL_MAX} nakliyeci tutabilirsin.` : Tr('Yeterli paran yok.'), fn: () => { G.hireHauler(c, b); } });
        return it;
      },
    });
  },
  /* İlçe binası / tapu dairesi: satılık işletmeler ve arsalar */
  openBizMarket(b) {
    const here = G.world.towns.find(t => t.id === b.town) || G.nearestTown(G.player.x, G.player.y);
    this.menu({
      title: Tr('Satılık İşletmeler'), wallet: true, cls: 'small', side: (it) => it.side || '',
      tabs: [Tr('İşletmeler'), Tr('Arsalar')],
      build: (m) => {
        const towns = G.world.towns.filter(t => t === here || G.visited.has(t.id)).sort((a, c) => dist(here.cx, here.cy, a.cx, a.cy) - dist(here.cx, here.cy, c.cx, c.cy));
        const it = [];
        for (const t of towns) {
          if (m.tab === 0) {
            const list = t.buildings.filter(x => G.bizForSale(x));
            if (!list.length) continue;
            it.push({ header: t.n });
            for (const x of list) { const pr = G.bizPrice(x); it.push({ icon: BICON[x.type] ? Icons.glyph(BICON[x.type], '#efe6d2') : '🏪', label: BUILDINGS[x.type].n, right: fmtMoney(pr), disabled: G.player.money < pr, why: Tr('Yeterli paran yok.'), side: this.bizSide(x.type, t), fn: () => this.confirmBuyBiz(x) }); }
          } else {
            const lots = (t.lots || []).filter(l => !G.lotBiz(l));
            if (!lots.length) continue;
            it.push({ header: t.n });
            for (const l of lots) {
              if (G.lotOwned(l)) it.push({ icon: '🔨', label: Tr`Arsan (${l.w}×${l.h}) — İnşaata Başla`, fn: () => this.openBuildMenu(l) });
              else it.push({ icon: '📜', label: Tr`Arsa ${l.w}×${l.h}`, right: fmtMoney(l.price), disabled: G.player.money < l.price, why: Tr('Yeterli paran yok.'), side: `<div class="ps-t">${Tr`Arsa ${l.w}×${l.h}`}</div><div class="ps-e">${Tr('Sığan işletmeler:')} ${G.lotTypes(l).map(k => BUILDINGS[k].n).join(', ')}</div>`, fn: () => G.buyLot(l) });
            }
          }
        }
        return it;
      },
      empty: Tr('Şu an satılık bir şey yok. Başka kasabaları gezdikçe liste genişler.'),
    });
  },
  showTreasureMap() {
    const T_ = G.treasure;
    if (!T_) { this.info(Tr('Hazine Haritası'), `<p>${Tr`Harita çok eski ve okunmuyor.`}</p>`); return; }
    this.menu({
      title: Tr('Hazine Haritası'), cls: 'small',
      items: [
        { html: `<div class="tmap"><p>${Tr`Kurşun kalemle çizilmiş eski bir harita. Kenarında şöyle yazıyor:`}</p><p class="quote">${Tr`"${T_.region} bölgesinde, <b>${T_.hint}</b> yakınlarında. Taze toprağı ara, kürekle kaz."`}</p></div>` },
        { label: Tr('Bölgeyi Haritada İşaretle'), fn: () => { G.setWaypoint(T_.x + rnd(-200, 200), T_.y + rnd(-200, 200)); this.pop(); this.feed(Tr('Yaklaşık bölge işaretlendi. Yakınlarda taze toprak ara.')); } },
        { label: Tr('Kapat'), fn: () => this.pop() },
      ],
    });
  },

  /* ================= MİNİ OYUNLAR ================= */
  openBlackjack() {
    const P = G.player;
    const el = el_('div', 'modal panel blackjack');
    const st = { bet: 0.1, phase: 'bet', deck: [], ph: [], dh: [], msg: '' };
    const newDeck = () => { const d = []; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s }); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };
    const val = h => { let v = 0, a = 0; for (const c of h) { const x = c.r > 10 ? 10 : c.r; v += x === 1 ? 11 : x; if (x === 1) a++; } while (v > 21 && a) { v -= 10; a--; } return v; };
    const card = (c, hide) => hide ? '<div class="card back"></div>' : `<div class="card ${c.s % 2 ? 'red' : ''}"><span>${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c.r]}</span><span>${'♠♥♣♦'[c.s]}</span></div>`;
    const draw = () => {
      const pv = val(st.ph), dv = val(st.dh);
      el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Yirmi Bir`}</div><div class="p-sub">${Tr`Cüzdan: ${fmtMoney(P.money)} • Bahis: ${fmtMoney(st.bet)}`}</div></div>
        <div class="bj-table"><div class="bj-h"><div class="bj-l">${Tr`Krupiye ${st.phase === 'play' ? '' : '(' + dv + ')'}`}</div><div class="bj-c">${st.dh.map((c, i) => card(c, st.phase === 'play' && i === 1)).join('')}</div></div>
        <div class="bj-msg">${st.msg}</div>
        <div class="bj-h"><div class="bj-l">${Tr`Sen (${pv})`}</div><div class="bj-c">${st.ph.map(c => card(c)).join('')}</div></div></div>
        <div class="p-foot">${Tr`${st.phase === 'play' ? Tr`${Input.glyph('confirm')} Kart Çek &nbsp; ${Input.glyph('alt')} Dur &nbsp; ${Input.glyph('alt2')} İkiye Katla` : Tr`◀ ▶ Bahis &nbsp; ${Input.glyph('confirm')} Dağıt`} &nbsp; ${Input.glyph('back')} Kalk`}</div>`;
    };
    const finish = () => {
      while (val(st.dh) < 17) st.dh.push(st.deck.pop());
      const pv = val(st.ph), dv = val(st.dh);
      let win = 0;
      if (pv > 21) { st.msg = Tr('Battın!'); win = -1; }
      else if (dv > 21 || pv > dv) { st.msg = Tr('Kazandın!'); win = 1; }
      else if (pv === dv) { st.msg = Tr('Berabere.'); win = 0; }
      else { st.msg = Tr('Kasa kazandı.'); win = -1; }
      if (win > 0) { const bj = pv === 21 && st.ph.length === 2; P.money += st.bet * (bj ? 2.5 : 2); G.stat('bjWins', 1); Audio_.ui('cash'); if (bj) st.msg = Tr('Blackjack!'); }
      else if (win === 0) P.money += st.bet;
      st.phase = 'bet';
      draw();
    };
    const m = this.makeModal(el, { customInput: true });
    m.update = (dt) => {
      const I = Input;
      if (m.born >= this.frame - 1) return;
      if (I.pressed('back')) { this.pop(m); return; }
      if (st.phase === 'bet') {
        const bets = [0.1, 0.25, 0.5, 1];
        if (I.nav('left', dt)) { st.bet = bets[Math.max(0, bets.indexOf(st.bet) - 1)]; draw(); }
        if (I.nav('right', dt)) { st.bet = bets[Math.min(3, bets.indexOf(st.bet) + 1)]; draw(); }
        if (I.pressed('confirm')) {
          if (P.money < st.bet) { this.feed(Tr('Yeterli paran yok.'), 'warn'); return; }
          P.money -= st.bet;
          if (st.deck.length < 15) st.deck = newDeck();
          st.ph = [st.deck.pop(), st.deck.pop()]; st.dh = [st.deck.pop(), st.deck.pop()];
          if (G.hasPerk('gambler') && val(st.ph) < 12 && chance(0.25)) st.ph[1] = st.deck.pop();
          st.phase = 'play'; st.msg = '';
          Audio_.ui('pick');
          if (val(st.ph) === 21) finish(); else draw();
        }
      } else {
        if (I.pressed('confirm')) { st.ph.push(st.deck.pop()); Audio_.ui('pick'); if (val(st.ph) > 21) finish(); else draw(); }
        else if (I.pressed('alt')) finish();
        else if (I.pressed('alt2') && st.ph.length === 2 && P.money >= st.bet) { P.money -= st.bet; st.bet *= 2; st.ph.push(st.deck.pop()); finish(); st.bet /= 2; }
      }
    };
    el.addEventListener('click', (e) => { if (st.phase === 'bet') { Input.state.confirm = true; Input.prev.confirm = false; } });
    draw();
    this.push(m);
  },
  /* Maymuncuk: gösterge tatlı bölgedeyken bas, bütün pimleri yerine oturt.
     Iskalarsan kilit tıkırdar; maymuncuk kırılabilir. */
  openLockpick(b) {
    const P = G.player;
    if (!P.has('lockpick')) { this.feed(Tr('Maymuncuğun yok.'), 'warn'); return; }
    const pins = b.def.svc.includes('robbank') ? 5 : b.def.lock ? 3 : 4;
    const el = el_('div', 'modal panel lockpick');
    const st = { k: 0, pins, pos: 0, dir: 1, zone: rnd(0.25, 0.75), w: 0.17, done: false, msg: '', flash: 0 };
    const speed = () => 0.8 + st.k * 0.22;
    const draw = () => {
      el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Maymuncuk`}</div><div class="p-sub">${escapeHtml(b.name)} · ${Tr`Maymuncuk: ${P.count('lockpick')}`}</div></div>
        <div class="lp-pins">${Array.from({ length: pins }, (_, i) => `<i class="${i < st.k ? 'set' : i === st.k && !st.done ? 'cur' : ''}"></i>`).join('')}</div>
        <div class="lp-bar ${st.flash > 0 ? 'miss' : ''}"><div class="lp-zone" style="left:${(st.zone - st.w / 2) * 100}%;width:${st.w * 100}%"></div><i style="left:${st.pos * 100}%"></i></div>
        <div class="arm-msg">${st.msg || Tr('Gösterge yeşil bölgedeyken bas.')}</div>
        <div class="p-foot">${Tr`${Input.glyph('confirm')} Pimi it &nbsp; ${Input.glyph('back')} Vazgeç`}</div>`;
    };
    const m = this.makeModal(el, { customInput: true, noFocus: true });
    m.lock = st;
    m.tryPin = () => {
      if (st.done) return;
      if (Math.abs(st.pos - st.zone) <= st.w / 2) {
        st.k++; Audio_.tone(900 + st.k * 80, 0.05, 'square', 0.05);
        if (st.k >= pins) { st.done = true; st.msg = Tr('Kilit açıldı!'); draw(); G.pickLock(b); setTimeout(() => this.pop(m), 450); return; }
        st.zone = rnd(0.2, 0.8); st.msg = '';
      } else {
        st.flash = 0.3; Audio_.tone(160, 0.08, 'square', 0.05);
        G.noise(b.door.x, b.door.y, 70, 'quiet');
        if (chance(0.4)) {
          P.removeItem('lockpick', 1);
          if (!P.has('lockpick')) { st.done = true; st.msg = Tr('Maymuncuk kırıldı. Başka maymuncuğun kalmadı.'); draw(); setTimeout(() => this.pop(m), 900); return; }
          st.msg = Tr('Maymuncuk kırıldı! Yenisiyle baştan başla.'); st.k = 0; st.zone = rnd(0.25, 0.75);
        } else st.msg = Tr('Iskaladın, kilit tıkırdadı.');
      }
      draw();
    };
    m.update = (dt) => {
      if (st.done) return;
      st.pos += st.dir * speed() * dt;
      if (st.pos >= 1) { st.pos = 1; st.dir = -1; } else if (st.pos <= 0) { st.pos = 0; st.dir = 1; }
      if (st.flash > 0) st.flash -= dt;
      const bar = $('.lp-bar i', el); if (bar) bar.style.left = st.pos * 100 + '%';
      const lb = $('.lp-bar', el); if (lb) lb.classList.toggle('miss', st.flash > 0);
      if (m.born >= this.frame - 1) return;
      if (Input.pressed('back')) { this.pop(m); return; }
      if (Input.pressed('confirm') || Input.pressed('interact')) m.tryPin();
    };
    el.addEventListener('mousedown', () => m.tryPin());
    draw();
    this.push(m);
  },
  openArmWrestle() {
    const P = G.player;
    if (P.money < 0.25) { this.feed(Tr('Bahis için 25¢ gerekli.'), 'warn'); return; }
    if ((G.dailyTalk.arm || 0) >= 3) { this.feed(Tr('Bugün kimse seninle bilek güreşi yapmak istemiyor. Yarın gel.'), 'warn'); return; }
    G.dailyTalk.arm = (G.dailyTalk.arm || 0) + 1;
    P.money -= 0.25;
    const el = el_('div', 'modal panel arm');
    const opp = { n: randomName('m'), str: rnd(0.8, 1.35) };
    const st = { pos: 0.5, t: 0, done: false, start: 1.5 };
    const draw = () => {
      el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Bilek Güreşi`}</div><div class="p-sub">${Tr`Rakip: ${opp.n}`}</div></div>
        <div class="arm-bar"><div class="arm-zone l"></div><div class="arm-zone r"></div><i style="left:${st.pos * 100}%"></i></div>
        <div class="arm-msg">${st.done ? st.msg : st.start > 0 ? Tr('Hazır ol... ') + Math.ceil(st.start) : Tr('Hızlıca bas!')}</div>
        <div class="p-foot">${Tr`${Input.glyph('confirm')} Tekrar tekrar bas &nbsp; ${st.done ? Input.glyph('back') + Tr(' Kapat') : ''}`}</div>`;
    };
    const m = this.makeModal(el, { customInput: true });
    m.update = (dt) => {
      const I = Input;
      if (m.born >= this.frame - 1) return;
      if (st.done) { if (I.pressed('back') || I.pressed('confirm')) this.pop(m); return; }
      if (st.start > 0) { st.start -= dt; draw(); return; }
      const str = (1 + G.skill('strength') * 0.08) * (G.hasPerk('arm') ? 1.2 : 1) * (P.drunk > 40 ? 0.85 : 1);
      if (I.pressed('confirm') || I.pressed('sprint')) st.pos -= 0.028 * str;
      st.pos += dt * 0.19 * opp.str * (1 + Math.sin(G.t * 3) * 0.3);
      if (st.pos <= 0.05) { st.done = true; st.msg = Tr('KAZANDIN! +50¢'); P.money += 0.5; G.stat('armWins', 1); G.skillXp('strength', 10); Audio_.ui('cash'); }
      if (st.pos >= 0.95) { st.done = true; st.msg = Tr('Kaybettin.'); Audio_.ui('error'); }
      draw();
    };
    draw();
    this.push(m);
  },
  startFishing() {
    const P = G.player, W = G.world;
    const el = el_('div', 'modal fishing');
    const bait = P.has('bait');
    const st = { phase: 'cast', t: 0, wait: rnd(3, 10) * (bait ? 0.6 : 1) * (G.hasPerk('fisher') ? 0.6 : 1), tension: 0.3, dist: 1, fish: null, power: 0 };
    const tile = W.biomeAt(P.x, P.y);
    const heat = W.climateAt(P.x, P.y);
    const pool = heat < 0.3 ? ['fish_trout', 'fish_salmon', 'fish_pike', 'fish_perch'] : tile === 'SWAMP' || tile === 'MUD' || heat > 0.7 ? ['fish_catfish', 'fish_bass', 'fish_perch'] : ['fish_perch', 'fish_bass', 'fish_trout', 'fish_pike', 'fish_catfish'];
    const draw = () => {
      let body = '';
      if (st.phase === 'cast') body = `<div class="f-msg">${Tr`Oltanı atmak için ${Input.glyph('confirm')} basılı tut ve bırak`}</div><div class="f-bar"><i style="width:${st.power * 100}%"></i></div>`;
      else if (st.phase === 'wait') body = `<div class="f-msg">${Tr`Bekle...`} <span class="bob">〰</span></div>`;
      else if (st.phase === 'bite') body = `<div class="f-msg big">${Tr`VURDU! ${Input.glyph('confirm')}`}</div>`;
      else if (st.phase === 'reel') body = `<div class="f-msg">${Tr`Makarayı sar: ${Input.glyph('confirm')} basılı tut — gerginliğe dikkat!`}</div><div class="f-lab">${Tr`Gerginlik`}</div><div class="f-bar tension"><i style="width:${st.tension * 100}%" class="${st.tension > 0.8 ? 'hot' : ''}"></i></div><div class="f-lab">${Tr`Mesafe`}</div><div class="f-bar"><i style="width:${st.dist * 100}%"></i></div>`;
      else body = `<div class="f-msg big">${st.msg}</div><div class="f-msg">${Tr`${Input.glyph('confirm')} Tekrar &nbsp; ${Input.glyph('back')} Bitir`}</div>`;
      el.innerHTML = `<div class="f-inner"><div class="p-title">${Tr`Balık Tutma`}</div>${body}<div class="p-foot">${Tr`${Input.glyph('back')} Bırak`}</div></div>`;
    };
    const m = this.makeModal(el, { customInput: true, transparent: true });
    m.update = (dt) => {
      const I = Input;
      if (m.born >= this.frame - 1) return;
      if (I.pressed('back')) { this.pop(m); return; }
      if (st.phase === 'cast') {
        if (I.down('confirm')) st.power = Math.min(1, st.power + dt * 1.2);
        if (I.released('confirm') && st.power > 0.1) { st.phase = 'wait'; st.t = 0; Audio_.tone(900, 0.2, 'sine', 0.05, null, 0, 400); G.parts.add('splash', P.x + Math.cos(P.ang) * 30 * st.power, P.y + Math.sin(P.ang) * 30 * st.power, 0, 0, 0.8, 5); }
      } else if (st.phase === 'wait') {
        st.t += dt;
        G.advanceClock(dt * MIN_PER_SEC * 3);
        if (st.t > st.wait) { st.phase = 'bite'; st.t = 0; Audio_.tone(1200, 0.08, 'square', 0.06); Audio_.tone(1200, 0.08, 'square', 0.06, null, 0.12); }
        if (I.pressed('confirm')) { st.msg = Tr('Çok erken çektin!'); st.phase = 'end'; }
      } else if (st.phase === 'bite') {
        st.t += dt;
        if (I.pressed('confirm')) { st.phase = 'reel'; st.fish = pick(pool); st.str = rnd(0.6, 1.4) * (ITEMS[st.fish].p / 4); }
        else if (st.t > 1.1) { st.msg = Tr('Balık kaçtı...'); st.phase = 'end'; }
      } else if (st.phase === 'reel') {
        const pull = (0.5 + Math.sin(G.t * 4 + Math.sin(G.t * 1.3) * 3) * 0.5) * st.str;
        if (I.down('confirm')) { st.tension += dt * (0.35 + pull * 0.5); st.dist -= dt * 0.18; }
        else { st.tension -= dt * 0.55; st.dist += dt * 0.04 * pull; }
        st.tension = clamp(st.tension, 0, 1.01); st.dist = clamp(st.dist, 0, 1.2);
        if (st.tension >= 1) { st.msg = Tr('Misina koptu!'); st.phase = 'end'; Audio_.ui('error'); }
        if (st.dist >= 1.2) { st.msg = Tr('Balık kaçtı...'); st.phase = 'end'; }
        if (st.dist <= 0) {
          st.phase = 'end'; const it = ITEMS[st.fish];
          st.msg = Tr`${Icons.item(st.fish, 'ic inl')} ${it.n} tuttun!`; P.addItem(st.fish, 1); G.stat('fish', 1); G.skillXp('survival', 4); Audio_.ui('cash');
          if (bait && chance(0.5)) P.removeItem('bait', 1);
        }
      } else if (st.phase === 'end') {
        if (I.pressed('confirm')) { st.phase = 'cast'; st.power = 0; st.wait = rnd(3, 10) * (P.has('bait') ? 0.6 : 1) * (G.hasPerk('fisher') ? 0.6 : 1); }
      }
      draw();
    };
    draw();
    this.push(m);
  },

  /* ================= ÖLÜM & MİRAS ================= */
  showDeath() {
    const el = el_('div', 'modal deathscreen');
    const hard = G.difficulty === 'hard';
    el.innerHTML = `<div class="ds-inner"><div class="ds-t">${Tr`ÖLDÜN`}</div><div class="ds-rule"></div><div class="ds-c">${Tr`Ölüm sebebi: ${G.deathCause}`}</div><div class="ds-a">${Tr`${G.player.name}, ${G.age} yaşında`}</div>
      <div class="ds-items"><div class="p-item nav pref" id="ds-cont">${hard ? Tr('Hayatının Özeti') : Tr('Devam Et (Doktor)')}</div>${!hard ? `<div class="p-item nav" id="ds-legacy">${Tr`Bu Hayatı Bitir`}</div>` : ''}<div class="p-item nav" id="ds-menu">${Tr`Ana Menü`}</div></div></div>`;
    document.body.classList.add('dying');
    const m = this.makeModal(el, { onBack: () => {}, onClose: () => document.body.classList.remove('dying') });
    this.push(m);
    $('#ds-cont', el).onclick = () => { this.pop(m); if (hard) { G.deleteSave(); this.showLegacy(false); } else G.respawn(); };
    const lg = $('#ds-legacy', el);
    if (lg) lg.onclick = () => { this.pop(m); G.deleteSave(); this.showLegacy(false); };
    $('#ds-menu', el).onclick = () => { this.closeAll(); if (hard) G.deleteSave(); this.showMainMenu(); };
  },
  showLegacy(alive) {
    const P = G.player, S = G.stats;
    const born = START_YEAR - START_AGE;
    const ach = Object.keys(G.achieved).length;
    const epit = alive ? Tr('Seksen yılı devirdi. Batı onu yıpratamadı.') : G.honor > 50 ? Tr('Dürüst bir adamdı; iyi yaşadı, iyi öldü.') : G.honor < -50 ? Tr('Kanunun kovaladığı, halkın korktuğu biriydi.') : Tr('Batının tozunda iz bırakan sıradan bir hayat.');
    const el = el_('div', 'modal legacy');
    el.innerHTML = `<div class="paper"><div class="np-h">${'THE FRONTIER GAZETTE'}</div><div class="np-d">${Tr`${G.dateStr()} • Fiyatı 5 sent`}</div>
      <div class="np-t">${alive ? Tr('BİR EFSANE 80 YAŞINDA') : Tr('ACI KAYIP')}</div>
      <div class="np-body"><canvas id="lg-portrait" width="160" height="192"></canvas>
      <div><h2>${escapeHtml(P.name)}</h2><div class="np-y">${born} – ${alive ? '' : G.year}</div>
      <p>${alive ? Tr`${escapeHtml(P.name)}, dün ${G.age}. yaşını kutladı.` : Tr`${escapeHtml(P.name)}, ${G.age} yaşında ${G.deathCause} sebebiyle hayatını kaybetti.`} ${G.family.spouse ? Tr`Geride eşi ${G.family.spouse.name}` + (G.family.children.length ? Tr` ve ${G.family.children.length} çocuğunu (${G.family.children.map(c => c.name).join(', ')})` : '') + Tr(' bıraktı.') : Tr('Arkasında bir aile bırakmadı.')}</p>
      <p><i>"${epit}"</i></p>
      <table class="stats"><tr><td>${Tr`Yaşanan gün`}</td><td>${G.day}</td></tr><tr><td>${Tr`Avlanan hayvan`}</td><td>${S.animals}</td></tr><tr><td>${Tr`Kazanılan para`}</td><td>${fmtMoney(S.earned)}</td></tr><tr><td>${Tr`Keşfedilen yer`}</td><td>${G.discovered.size}</td></tr><tr><td>${Tr`Başarımlar`}</td><td>${ach}/${ACHIEVEMENTS.length}</td></tr><tr><td>${Tr`Onur`}</td><td>${Math.round(G.honor)}</td></tr></table></div></div>
      <div class="ds-items">${alive ? `<div class="p-item nav pref" id="lg-cont">${Tr`Yaşamaya Devam Et`}</div>` : ''}<div class="p-item nav ${alive ? '' : 'pref'}" id="lg-menu">${Tr('Ana Menü')}</div></div></div>`;
    const m = this.makeModal(el, { onBack: () => {} });
    this.push(m);
    Spr.portrait($('#lg-portrait', el).getContext('2d'), 160, 192, P.look, G.age);
    const c = $('#lg-cont', el);
    if (c) c.onclick = () => this.pop(m);
    $('#lg-menu', el).onclick = () => { this.closeAll(); this.showMainMenu(); };
  },

  /* ================= EKRANLAR ================= */
  hideScreens() { $$('.screen').forEach(s => s.classList.add('hidden')); },
  showLoading(on) {
    $('#loading').classList.toggle('hidden', !on);
    if (!on) return;
    $('#ld-tip').textContent = pick(TIPS).replace(/^[^:]{2,14}:\s*/, '');   // "İpucu:" başlığı kutunun üstünde
    $('#ld-rider').innerHTML = Icons.glyph('horse', '#ecd9b2');
  },
  loading(msg, p) { $('#ld-msg').textContent = msg; const v = Math.round(p * 100) + '%'; $('#ld-fill').style.width = v; $('#ld-rider').style.left = v; },
  showMainMenu() {
    G.state = 'menu';
    this.closeAll();
    $('#hud').classList.add('hidden');
    $('#mapscreen').classList.add('hidden');
    document.body.className = '';
    this.hideScreens();
    const mm = $('#mainmenu');
    mm.classList.remove('hidden');
    const info = G.saveInfo();
    const items = [];
    if (info) items.push(['cont', Tr('Devam Et'), Tr`${info.name} • ${info.age} yaşında • ${fmtMoney(info.money)}`]);
    if (info) items.push(['load', Tr('Kayıt Yükle'), Tr`${SLOTS} kayıt yuvası`]);
    items.push(['new', Tr('Yeni Hayat'), Tr('Bir karakter yarat ve 18 yaşında başla')]);
    items.push(['set', Tr('Ayarlar'), ''], ['ctrl', Tr('Kontroller'), ''], ['about', Tr('Hakkında'), '']);
    if (Platform.canQuit) items.push(['quit', Tr('Masaüstüne Çık'), '']);
    $('#mm-items').innerHTML = items.map(([id, n, s], i) => `<div class="mm-item nav" data-id="${id}" style="--i:${i}"><div class="mm-n">${n}</div>${s ? `<div class="mm-s">${s}</div>` : ''}</div>`).join('');
    $('#mm-foot').innerHTML = Tr`${Input.glyph('confirm')} Seç &nbsp;&nbsp; Oyun kolu desteklenir` + `<span class="mm-ver">v${GAME_VERSION}</span>`;
    // son hayatın kartı: ekran görüntüsü, isim, yer, oynama süresi
    const card = $('#mm-card');
    if (info) {
      const hm = (sec) => { const h = Math.floor(sec / 3600), mi = Math.floor(sec / 60) % 60; return h ? Tr`${h} sa ${mi} dk` : Tr`${mi} dk`; };
      const bg = BACKGROUNDS.find(b => b.id === info.bg);
      card.innerHTML = `${info.thumb ? `<img src="${info.thumb}" alt="">` : '<div class="mmc-noimg"></div>'}<div class="mmc-k">${Tr('Son Hayat')}</div><div class="mmc-n">${escapeHtml(info.name)}</div>
        <div class="mmc-r">${Tr`${info.age} yaşında`}${bg ? ' • ' + bg.n : ''}${info.place ? ' • ' + escapeHtml(info.place) : ''}</div>
        <div class="mmc-r dim">${Tr`Yıl ${info.year || ''}`} • ${fmtMoney(info.money)} • ${Tr`Oynama: ${hm(info.playtime || 0)}`}</div>`;
      card.classList.remove('hidden');
    } else card.classList.add('hidden');
    const m = this.makeModal(mm, { keepEl: true, transparent: true, onBack: () => {}, onFocus: (n) => card.classList.toggle('off', !!info && n.dataset.id !== 'cont' && n.dataset.id !== 'load') });
    $$('.mm-item', mm).forEach(n => {
      n.onmouseenter = () => m.setFocus(n, true);
      n.onclick = () => {
        Audio_.unlock();
        Audio_.ui('ok');
        const id = n.dataset.id;
        if (id === 'cont') { this.pop(m); mm.classList.add('hidden'); G.loadGame(); }
        else if (id === 'load') this.openSlots('load');
        else if (id === 'new') { if (info) this.openSlots('new'); else { this.pop(m); this.showCreate(1); } }
        else if (id === 'set') this.openSettings();
        else if (id === 'ctrl') this.openControls();
        else if (id === 'quit') Platform.quit();
        else if (id === 'about') this.info("Frontier's End", `<p>${Tr`<b>Frontier's End</b>, 1890'lar Amerika'sında geçen 2D açık dünya hayatta kalma ve rol yapma oyunudur.`}</p><p>${Tr`İstersen kısa bir hikâyeyle başla, istersen doğrudan hayatın içine dal. 18 yaşında başla, avlan, çalış, sev, keşfet ve 80 yaşına kadar hayatta kalmaya çalış.`}</p><p class="dim">${Tr`HTML5 Canvas • Prosedürel dünya, grafik ve ses`}</p>`);
      };
    });
    this.stack.push(m);
    m.focusFirst();
    this.updatePauseState();
    Audio_.playMusic('menu');
    this.initMenuBg();
  },
  /* Kayıt yuvaları. mode: 'load' (yükle) ya da 'new' (yeni hayat için yuva seç) */
  openSlots(mode) {
    const el = el_('div', 'modal panel slots');
    let m;
    const when = (t) => { const d = new Date(t); return d.toLocaleDateString(I18N.lang === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short' }) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
    const hm = (s) => { const h = Math.floor(s / 3600), mi = Math.floor(s / 60) % 60; return h ? Tr`${h} sa ${mi} dk` : Tr`${mi} dk`; };
    const inGame = G.state === 'play' || G.state === 'dead';
    const render = () => {
      const L = G.slotList();
      el.innerHTML = `<div class="p-head"><div class="p-title">${mode === 'new' ? Tr('Yeni Hayat: Yuva Seç') : Tr('Kayıt Yükle')}</div><div class="p-sub">${mode === 'new' ? Tr('Yeni hayatın hangi yuvada saklansın? Dolu bir yuva seçersen içindeki hayat silinir.') : Tr('Her yuva ayrı bir hayattır. Otomatik kayıt gün dönümünde, uykuda ve birkaç dakikada bir; manuel kayıt senin istediğin anda alınır.')}</div></div>
        <div class="p-body"><div class="p-list scroll sl-list">${L.map(sl => {
          const meta = sl.auto && sl.manual ? (sl.auto.savedAt > sl.manual.savedAt ? sl.auto : sl.manual) : sl.auto || sl.manual;
          const cur = inGame && G.slot === sl.n;
          if (!meta) return `<div class="sl-card empty ${mode === 'new' ? 'nav' + (sl.n === G.freeSlot() ? ' pref' : '') : ''}" data-act="new" data-n="${sl.n}"><div class="sl-num">${sl.n}</div><div class="sl-thumb none">${Icons.glyph('quill', 'rgba(201,164,92,0.5)')}</div><div class="sl-info"><div class="sl-name">${Tr('Boş Yuva')}</div><div class="sl-row dim">${mode === 'new' ? Tr('Yeni bir hayata burada başla.') : Tr('Burada henüz bir hayat yok.')}</div></div></div>`;
          const bg = BACKGROUNDS.find(b => b.id === meta.bg), df = DIFFICULTIES.find(d => d.id === meta.diff);
          const btn = (kind) => sl[kind] ? `<div class="sl-btn nav" data-act="load" data-kind="${kind}" data-n="${sl.n}"><b>${kind === 'auto' ? Tr('Otomatik Kayıt') : Tr('Manuel Kayıt')}</b><span>${when(sl[kind].savedAt)} • ${Tr`${sl[kind].age} yaş`}</span></div>` : `<div class="sl-btn off"><b>${kind === 'auto' ? Tr('Otomatik Kayıt') : Tr('Manuel Kayıt')}</b><span>${Tr('yok')}</span></div>`;
          return `<div class="sl-card ${cur ? 'cur' : ''} ${mode === 'new' ? 'nav' : ''}" data-act="new" data-n="${sl.n}"><div class="sl-num">${sl.n}</div>
            <div class="sl-thumb">${meta.thumb ? `<img src="${meta.thumb}" alt="">` : Icons.glyph('horse', 'rgba(201,164,92,0.5)')}</div>
            <div class="sl-info"><div class="sl-name">${escapeHtml(meta.name)}${cur ? ` <em>${Tr('şu an oynanan')}</em>` : ''}</div>
              <div class="sl-row">${Tr`${meta.age} yaşında`} • ${bg ? bg.n : ''} • ${df ? df.n : ''}</div>
              <div class="sl-row dim">${meta.place ? escapeHtml(meta.place) + ' • ' : ''}${Tr`Yıl ${meta.year || ''}`} • ${fmtMoney(meta.money)} • ${Tr`Oynama: ${hm(meta.playtime || 0)}`}</div></div>
            ${mode === 'load' ? `<div class="sl-acts">${btn('auto')}${btn('manual')}<div class="sl-btn nav del" data-act="del" data-n="${sl.n}"><b>${Tr('Sil')}</b></div></div>` : ''}</div>`;
        }).join('')}</div></div>
        <div class="p-foot">${Tr`${Input.glyph('confirm')} Seç &nbsp; ${Input.glyph('back')} Geri`}</div>`;
      $$('.nav', el).forEach(n => {
        n.onmouseenter = () => { if (m.focusEl !== n) m.setFocus(n, true); };
        n.onclick = (e) => { e.stopPropagation(); act(n); };
      });
      m.focusFirst();
    };
    const act = (n) => {
      const k = +n.dataset.n, a = n.dataset.act;
      if (a === 'new') {
        const used = G.slotList().find(x => x.n === k);
        const go = () => { this.closeAll(); $('#mainmenu').classList.add('hidden'); this.showCreate(k); };
        if (used.auto || used.manual) this.confirm(Tr('Yuvanın Üzerine Yaz'), Tr`${k}. yuvadaki hayat silinecek ve yerine yenisi başlayacak. Emin misin?`, go, Tr('Vazgeç'), Tr('Sil ve Başla'));
        else go();
      } else if (a === 'load') {
        const go = () => { this.closeAll(); $('#mainmenu').classList.add('hidden'); G.loadGame(k, n.dataset.kind); };
        if (G.state === 'play') this.confirm(Tr('Kayıt Yükle'), Tr('Son kayıttan sonraki ilerleme kaybolacak. Yüklensin mi?'), go, Tr('Vazgeç'), Tr('Yükle'));
        else go();
      } else if (a === 'del') {
        if (inGame && G.slot === k) { this.feed(Tr('Şu an oynadığın hayatın yuvası silinemez.'), 'warn'); return; }
        this.confirm(Tr('Yuvayı Sil'), Tr`${k}. yuvadaki hayat kalıcı olarak silinecek.`, () => {
          G.deleteSlot(k);
          if (m.alive) render();
          if (G.state === 'menu' && !G.hasSave()) { this.closeAll(); this.showMainMenu(); }
        }, Tr('Vazgeç'), Tr('Sil'));
      }
    };
    m = this.makeModal(el, {});
    render();
    this.push(m);
    return m;
  },
  showCreate(slot) {
    const look = randomLook(chance(0.5) ? 'm' : 'f');
    look.coatLen = 0;
    const rndName = (sex) => pick(NAMES[sex]) + ' ' + pick(NAMES.last);
    const prof = { name: rndName(look.sex), look, bg: 'farm', difficulty: 'story', pace: 'normal', story: true, slot: slot || G.freeSlot() || 1 };
    // oyuncu kendi ismini yazdıysa cinsiyet değişince ya da Rastgele'de korunur
    let customName = false, started = false;
    const el = el_('div', 'modal create');
    const TABS = [
      { n: Tr('Kimlik'), g: 'quill', d: Tr('Adını yaz; cinsiyetini, ten ve göz rengini seç.') },
      { n: Tr('Görünüm'), g: 'barber', d: Tr('Saçını ve sakalını belirle. Portre her değişikliği gösterir.') },
      { n: Tr('Kıyafet'), g: 'scissors', d: Tr('Batıya ne giyerek geleceğini seç: şapka, ceket, gömlek, pantolon.') },
      { n: Tr('Hikâye'), g: 'book', d: Tr('Geçmişin başlangıç kasabanı, paranı, atını ve becerilerini belirler. Zorluğu ve yaşlanma hızını seç, sonra hayata başla.') },
    ];
    // her bölüme en az bir kez bakılmadan hayata başlanamaz
    const seen = new Set([0]);
    const allSeen = () => seen.size === TABS.length;
    const rows = [
      { t: 0, k: 'sex', n: Tr('Cinsiyet'), opts: ['m', 'f'], lab: v => (v === 'm' ? Tr('Erkek') : Tr('Kadın')) },
      { t: 0, k: 'skin', n: Tr('Ten Rengi'), opts: LOOKS.skin, sw: 1 },
      { t: 0, k: 'eyes', n: Tr('Göz Rengi'), opts: LOOKS.eyes, sw: 1 },
      { t: 1, k: 'hair', n: Tr('Saç Rengi'), opts: LOOKS.hair, sw: 1 },
      { t: 1, k: 'hairStyle', n: Tr('Saç Stili'), opts: LOOKS.hairStyle.map((_, i) => i), lab: v => hairStyleN(look, v) },
      { t: 1, k: 'beard', n: Tr('Sakal'), opts: LOOKS.beard.map((_, i) => i), lab: v => LOOKS.beard[v], male: 1 },
      // bone yalnızca kadınlarda; seçenek listesi cinsiyete göre
      { t: 2, k: 'hat', n: Tr('Şapka'), get opts() { return look.sex === 'f' ? LOOKS.hat : LOOKS.hat.filter(h => !LOOKS.hatF.includes(h)); }, lab: v => LOOKS.hatN[v] },
      { t: 2, k: 'hatCol', n: Tr('Şapka Rengi'), opts: LOOKS.hatCol, sw: 1 },
      { t: 2, k: 'coat', n: Tr('Ceket'), opts: LOOKS.coat, sw: 1 },
      { t: 2, k: 'shirt', n: Tr('Gömlek'), opts: LOOKS.shirt, sw: 1 },
      { t: 2, k: 'pants', n: Tr('Pantolon'), opts: LOOKS.pants, sw: 1 },
      { t: 3, k: 'bg', n: Tr('Geçmiş'), opts: BACKGROUNDS.map(b => b.id), lab: v => BACKGROUNDS.find(b => b.id === v).n, prof: 1 },
      { t: 3, k: 'difficulty', n: Tr('Zorluk'), opts: DIFFICULTIES.map(b => b.id), lab: v => DIFFICULTIES.find(b => b.id === v).n, prof: 1 },
      { t: 3, k: 'pace', n: Tr('Yaşlanma Hızı'), opts: LIFE_PACES.map(b => b.id), lab: v => LIFE_PACES.find(b => b.id === v).n, prof: 1 },
      { t: 3, k: 'story', n: Tr('Hikâyeli Başlangıç'), opts: [true, false], lab: v => (!STORY_FOR_BG[prof.bg] ? Tr('Bu geçmiş için yakında') : v ? Tr('Açık (önerilir)') : Tr('Kapalı')), prof: 1 },
    ];
    const BGI = { farm: 'wheat', immigrant: 'anchor', outlaw: 'skull', rail: 'train', trapper: 'fox' };
    let tab = 0;
    const get = r => (r.prof ? prof[r.k] : look[r.k]);
    const valHtml = (r) => {
      const v = get(r);
      if (!r.sw) return `<span class="v">${r.lab(v)}</span><span class="cr-dots">${r.opts.map(o => `<i class="${o === v ? 'on' : ''}"></i>`).join('')}</span>`;
      return `<span class="cr-chips">${r.opts.map((o, j) => `<i class="chip ${o === v ? 'on' : ''}" data-j="${j}" style="background:${o}"></i>`).join('')}</span>`;
    };
    const rowsHtml = () => {
      let h = '';
      if (tab === 0) h += `<div class="cr-row nav" id="cr-name-row"><span class="cr-l">${Tr`İsim`}</span><span class="cr-name-w"><input id="cr-name" maxlength="28" value="${escapeHtml(prof.name)}"><span class="cr-rand" id="cr-rn" title="${Tr('Rastgele isim')}">${Icons.glyph('dice', '#c9a45c')}</span></span></div>`;
      rows.forEach((r, i) => {
        if (r.t !== tab || (r.male && look.sex !== 'm')) return;
        h += `<div class="cr-row nav opt ${r.sw ? 'sw' : ''}" data-i="${i}" data-lr><span class="cr-l">${r.n}</span><span class="cr-v"><b class="arr">◀</b>${valHtml(r)}<b class="arr">▶</b></span></div>`;
      });
      if (tab === 3) h += `<div class="cr-cards">${BACKGROUNDS.map(b => `<div class="cr-card ${b.id === prof.bg ? 'on' : ''}" data-bg="${b.id}">${Icons.glyph(BGI[b.id] || 'star', b.id === prof.bg ? '#fff' : '#c9a45c')}<span>${b.n}</span></div>`).join('')}</div>`;
      return h;
    };
    const html = () => `
      <div class="cr-head">
        <div class="cr-title"><div class="p-title">${Tr`Yeni Bir Hayat`}</div><div class="cr-sub">${Tr`Amerika, ${START_YEAR} • 18 yaşındasın`}</div></div>
        <div class="cr-tabs">${Input.glyph('tabL')}${TABS.map((t, i) => `<span class="cr-tab ${i === tab ? 'on' : ''} ${seen.has(i) ? 'seen' : 'new'}" data-t="${i}"><em class="cr-tn">${seen.has(i) && i !== tab ? '✓' : i + 1}</em>${Icons.glyph(t.g, i === tab ? '#fff' : '#a89c88')}${t.n}</span>`).join('')}${Input.glyph('tabR')}</div>
      </div>
      <div class="cr-left"><div class="cr-sec">${Tr`Adım ${tab + 1}/${TABS.length}`} · ${TABS[tab].n}</div><div class="cr-steps">${TABS.map((t, i) => `<i class="${i === tab ? 'on' : seen.has(i) ? 'ok' : ''}"></i>`).join('')}</div><p class="cr-guide">${TABS[tab].d}</p><div class="cr-list">${rowsHtml()}</div></div>
      <div class="cr-stage">
        <div class="cr-frame"><canvas id="cr-portrait" width="400" height="480"></canvas><i class="cr-c tl"></i><i class="cr-c tr"></i><i class="cr-c bl"></i><i class="cr-c br"></i></div>
        <div class="cr-under"><div class="cr-plate"><div class="cr-pn" id="cr-pn"></div><div class="cr-ps" id="cr-ps"></div></div>
        <div class="cr-ped"><canvas id="cr-top" width="96" height="96"></canvas></div></div>
      </div>
      <div class="cr-right" id="cr-desc"></div>
      <div class="cr-foot"><div class="cr-keys">${Tr`${Input.glyph('up')}${Input.glyph('down')} Seç &nbsp; ◀ ▶ Değiştir &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Bölüm &nbsp; ${Input.glyph('back')} Geri`}</div>
        <div class="cr-btns"><div class="p-item nav" id="cr-rand">${Tr`${Icons.glyph('dice', '#e8dcc6')} Rastgele`}</div>${tab > 0 ? `<div class="p-item nav" id="cr-prev">${Tr`◂ Geri`}</div>` : ''}<div class="p-item nav pref ${tab === TABS.length - 1 && allSeen() ? 'go' : 'next'}" id="cr-go">${tab < TABS.length - 1 ? Tr`İleri: ${TABS[tab + 1].n} ▸` : !allSeen() ? Tr`Sırada: ${TABS[TABS.findIndex((t, i) => !seen.has(i))].n} ▸` : Tr`Hayata Başla`} ${Input.glyph('confirm')}</div></div></div>`;
    let m, ptQ = false;
    // portre bir sonraki karede çizilir: ok tuşu basılı tutulunca art arda değişiklikler tek çizimde birleşir
    const drawPortrait = () => {
      if (ptQ) return; ptQ = true;
      requestAnimationFrame(() => { ptQ = false; const c = $('#cr-portrait', el); if (c) Spr.portrait(c.getContext('2d'), 400, 480, look, 18); });
    };
    const refresh = () => {
      drawPortrait();
      const BG = BACKGROUNDS.find(b => b.id === prof.bg), D = DIFFICULTIES.find(d => d.id === prof.difficulty), L = LIFE_PACES.find(p => p.id === prof.pace);
      const town = TOWNS.find(t => t.id === BG.town);
      $('#cr-pn', el).textContent = prof.name || '—';
      $('#cr-ps', el).textContent = Tr`${look.sex === 'm' ? Tr('Erkek') : Tr('Kadın')} • 18 yaşında • ${BG.n}`;
      const sk = Object.keys(BG.skills).map(k => `<span class="cr-tag">${SKILLS[k].n} +${BG.skills[k]}</span>`).join('');
      const items = Object.keys(BG.items).map(id => `<span class="cr-it" title="${ITEMS[id].n}">${Icons.item(id)}</span>`).join('') + BG.weapons.filter(w => w !== 'knife').map(w => `<span class="cr-it wpn" title="${WEAPONS[w].n}">${Icons.weapon(w, 'ic wpn')}</span>`).join('');
      $('#cr-desc', el).innerHTML = `
        <div class="cr-card-big"><div class="cr-cb-h">${Icons.glyph(BGI[BG.id] || 'star', '#c9a45c')}<div><div class="cr-cb-k">${Tr`Geçmiş`}</div><div class="cr-cb-n">${BG.n}</div></div></div>
          <p>${BG.d}</p>
          <div class="cr-facts"><div><span>${Tr`Başlangıç`}</span><b>${BG.start === 'hideout' ? Tr('Saklı Kamp') : town.n}</b></div><div><span>${Tr`Cüzdan`}</span><b>${fmtMoney(BG.money)}</b></div><div><span>${Tr`At`}</span><b>${BG.horse ? HORSE_BREEDS[BG.horse].n : Tr('Yok')}</b></div>${BG.bounty ? `<div><span>${Tr`Ödül`}</span><b class="red">${fmtMoney(BG.bounty)}</b></div>` : ''}</div>
          <div class="cr-tags">${sk}</div><div class="cr-items">${items}</div></div>
        <div class="cr-mini"><div><span>${Tr`Zorluk`}</span><b>${D.n}</b><p>${D.d}</p></div><div><span>${Tr`Yaşlanma`}</span><b>${L.n}</b><p>${L.d}</p></div></div>`;
    };
    const drawTop = () => {
      const c = $('#cr-top', el); if (!c) return;
      const tc = c.getContext('2d');
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, 96, 96);
      tc.imageSmoothingEnabled = false;
      tc.setTransform(5, 0, 0, 5, 48, 50);
      Spr.human(tc, 0, 0, -Math.PI / 2 + Math.sin(performance.now() / 900) * 0.5, look, { walk: performance.now() / 150, mv: 0.6 });
      tc.setTransform(1, 0, 0, 1, 0, 0);
    };
    const setTab = (t, focusRows) => { tab = (t + TABS.length) % TABS.length; seen.add(tab); build(); if (focusRows) { const f = $('.cr-list .nav', el); if (f) m.setFocus(f, true); } else m.setFocus($('#cr-go', el), true); Audio_.ui('move'); };
    const build = () => {
      // isim kutusu odaktayken sayfa yeniden çizilirse blur gelmez: yazı modu açık kalmasın
      Input.textFocus = false;
      el.innerHTML = html();
      const nameIn = $('#cr-name', el);
      if (nameIn) {
        nameIn.onfocus = () => (Input.textFocus = true);
        nameIn.onblur = () => (Input.textFocus = false);
        nameIn.oninput = () => { prof.name = nameIn.value; $('#cr-pn', el).textContent = prof.name || '—'; };
        nameIn.onkeydown = (e) => { if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); nameIn.blur(); } };
        $('#cr-name-row', el).onclick = () => nameIn.focus();
        nameIn.addEventListener('input', () => { customName = !!nameIn.value.trim(); });
        const rn = () => { prof.name = rndName(look.sex); customName = false; nameIn.value = prof.name; refresh(); };
        $('#cr-rn', el).onclick = (e) => { e.stopPropagation(); rn(); };
        $('#cr-name-row', el)._lr = rn;
        $('#cr-name-row', el).dataset.lr = '';
      }
      $$('.cr-tab', el).forEach(n => (n.onclick = () => setTab(+n.dataset.t, true)));
      $$('.cr-card', el).forEach(n => (n.onclick = () => { prof.bg = n.dataset.bg; const f = m.focusEl && m.focusEl.dataset.i; build(); const back = f !== undefined && $(`.opt[data-i="${f}"]`, el); m.setFocus(back || $('.cr-list .nav', el), true); Audio_.ui('move'); }));
      $$('.opt', el).forEach(n => {
        const r = rows[+n.dataset.i];
        const setV = (v) => {
          if (r.prof) prof[r.k] = v; else look[r.k] = v;
          if (r.k === 'sex') { if (v === 'f') look.beard = 0; else if (LOOKS.hatF.includes(look.hat)) look.hat = 'cowboy'; if (!customName) prof.name = rndName(v); }
          const i = +n.dataset.i; build(); const back = $(`.opt[data-i="${i}"]`, el); if (back) m.setFocus(back, true);
        };
        n._lr = (d) => { const i = r.opts.indexOf(get(r)); setV(r.opts[(i + d + r.opts.length) % r.opts.length]); };
        n.onclick = (e) => { if (e.target.classList.contains('chip')) { setV(r.opts[+e.target.dataset.j]); return; } n._lr(1); };
        $$('.arr', n).forEach((a, i) => (a.onclick = (e) => { e.stopPropagation(); n._lr(i ? 1 : -1); }));
        n.onmouseenter = () => m && m.setFocus(n, true);
      });
      $('#cr-rand', el).onclick = () => { const nl = randomLook(look.sex); Object.assign(look, nl, { coatLen: 0 }); if (!customName) prof.name = rndName(look.sex); build(); m.setFocus($('#cr-rand', el), true); };
      const prev = $('#cr-prev', el); if (prev) prev.onclick = () => setTab(tab - 1);
      $('#cr-go', el).onclick = () => {
        if (started || !m.alive) return;   // çift tıklama yeni hayatı iki kez başlatmasın
        if (tab < TABS.length - 1) { setTab(tab + 1); return; }
        // bakılmamış bölüm varsa oraya götür
        const miss = TABS.findIndex((t, i) => !seen.has(i));
        if (miss >= 0) { setTab(miss); return; }
        // < > & " isimde olmasın (isim birçok yerde metin içine yazılır)
        prof.name = (prof.name || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim() || rndName(look.sex);
        look.beardLen = 0.4;
        Input.textFocus = false;
        started = true;
        this.pop(m);
        G.deleteSlot(prof.slot);
        G.newGame({ name: prof.name, look, bg: prof.bg, difficulty: prof.difficulty, pace: prof.pace, story: prof.story, slot: prof.slot });
      };
      refresh(); drawTop();
    };
    m = this.makeModal(el, { onBack: () => { if (tab > 0) { setTab(tab - 1); return; } this.pop(m); this.showMainMenu(); }, onTab: (d) => setTab(tab + d, true) });
    build();
    m.update = () => { if (this.frame % 2 === 0) drawTop(); };
    this.push(m);
    const go = $('#cr-go', el); m.setFocus(go, true);
    // klavyeyle oynayan doğrudan ismini yazabilsin (Enter yazmayı bitirir, ikinci Enter ileri götürür);
    // Steam Deck'te kendiliğinden odaklanmaz: ekran klavyesi yalnızca isim satırı seçilince açılır
    if (Input.device !== 'pad' && !Platform.deck) { const ni = $('#cr-name', el); if (ni) { ni.focus(); ni.select(); } }
  },

  /* Ana menü arka planı: gün batımında çöl (paralaks, döngüsel) */
  initMenuBg() {
    const c = this.menuCanvas;
    const W = 480, H = clamp(Math.round(480 * innerHeight / Math.max(1, innerWidth)), 200, 420);
    c.width = W; c.height = H;
    const R = new RNG(77);
    const L = W * 2; // döngü uzunluğu
    const wave = (n, amp) => { const a = []; for (let k = 0; k < n; k++) a.push([R.int(1, 3 + k * 3), R.range(0, TAU), amp / (k + 1)]); return a; };
    const hor = Math.round(H * 0.64);
    this.bg = {
      t: 0, W, H, L, hor, rider: -60, dust: [],
      layers: [
        { w: wave(4, 1), base: hor - 4, amp: 46, mesa: true, col: '#6a3048', spd: 3 },
        { w: wave(5, 1), base: hor + 6, amp: 26, mesa: false, col: '#44202e', spd: 8 },
        { w: wave(5, 1), base: hor + 26, amp: 14, mesa: false, col: '#2a1219', spd: 16 },
      ],
      stars: Array.from({ length: 70 }, () => [R.range(0, W), R.range(0, hor * 0.55), R.range(0.3, 1), R.range(0, 6)]),
      clouds: Array.from({ length: 7 }, () => [R.range(0, W), R.range(hor * 0.18, hor * 0.62), R.range(40, 110), R.range(2, 5), R.range(1, 3)]),
      cacti: Array.from({ length: 7 }, () => [R.range(0, L), R.range(0.7, 1.3), R.int(0, 2)]),
      poles: Array.from({ length: 6 }, (_, i) => i * (L / 6)),
      scrub: Array.from({ length: 40 }, () => [R.range(0, L), R.range(0, 1), R.range(2, 5)]),
      birds: Array.from({ length: 5 }, (_, i) => [W * 0.62 + i * 9, hor * 0.34 + (i % 2) * 6 + i * 2, R.range(0, 6)]),
    };
  },
  /* Ana menü arka plan videosu (video/menu.mp4, yoksa menu.webm): sessiz döngü.
     Oyun açılırken (açılış videosu sürerken) önden yüklenir; menü açılır açılmaz ilk karesi (menu.jpg)
     görünür, video hazır olunca kesintisiz oynamaya başlar. Çizilen piksel sahne yalnızca video
     açılamazsa çizilir. Menüden çıkınca durur, menüye dönünce yeniden oynar. */
  MENUVID: ['video/menu.mp4', 'video/menu.webm'],
  MENUPOSTER: 'video/menu.jpg',
  menuVidInit() {
    const v = document.getElementById('menuvid');
    if (!v || v.dataset.ready || window.__testNoMenuVid) return;
    v.dataset.ready = '1';
    v.muted = true;
    v.poster = window.__menuVidPoster || this.MENUPOSTER;
    v.addEventListener('playing', () => v.classList.add('on'));
    // kaynakların hepsi açılamazsa çizilen sahneye dön
    const fail = () => { this._mvFail = true; v.classList.remove('on'); $('#mainmenu').classList.remove('vid'); };
    for (const src of window.__menuVidSrc || this.MENUVID) {
      const s = document.createElement('source');
      s.src = src; s.type = src.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      v.appendChild(s);
    }
    const last = v.querySelector('source:last-child');
    if (last) last.addEventListener('error', fail);
    v.addEventListener('error', fail);
    $('#mainmenu').classList.add('vid');
    v.load();
  },
  menuVid(on) {
    const v = document.getElementById('menuvid');
    if (!v || this._mvOn === on) return;
    this._mvOn = on;
    if (!on) { if (!v.paused) v.pause(); return; }
    if (this._mvFail || !v.dataset.ready) return;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  },
  menuBg(dt) {
    // video (ya da yüklenirken ilk karesi) görünüyorsa çizilen sahne çizilmez
    if ($('#mainmenu').classList.contains('vid')) return;
    const c = this.bgctx;
    if (!this.bg || this.bg.W !== this.menuCanvas.width || Math.abs(this.bg.H - clamp(Math.round(480 * innerHeight / Math.max(1, innerWidth)), 200, 420)) > 4) this.initMenuBg();
    const B = this.bg, W = B.W, H = B.H, hor = B.hor, L = B.L;
    B.t += dt;
    // gökyüzü
    const g = c.createLinearGradient(0, 0, 0, hor + 10);
    g.addColorStop(0, '#120c26'); g.addColorStop(0.35, '#3c1d44'); g.addColorStop(0.62, '#a8384a'); g.addColorStop(0.84, '#e8763a'); g.addColorStop(1, '#f8c068');
    c.fillStyle = g; c.fillRect(0, 0, W, hor + 10);
    for (const [x, y, a, p] of B.stars) { c.fillStyle = `rgba(255,240,220,${a * (0.55 + 0.45 * Math.sin(B.t * 1.5 + p)) * (1 - y / (hor * 0.55))})`; c.fillRect(x, y, 1, 1); }
    // güneş
    const sx = W * 0.64, sy = hor - 6;
    const sg = c.createRadialGradient(sx, sy, 4, sx, sy, W * 0.45);
    sg.addColorStop(0, 'rgba(255,220,150,0.55)'); sg.addColorStop(0.25, 'rgba(255,160,80,0.22)'); sg.addColorStop(1, 'rgba(255,120,60,0)');
    c.fillStyle = sg; c.fillRect(0, 0, W, hor + 10);
    c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(sx, sy, 22, 0, TAU); c.fill();
    c.fillStyle = '#fff2c8'; c.beginPath(); c.arc(sx, sy, 16, 0, TAU); c.fill();
    // bulutlar
    for (const cl of B.clouds) {
      cl[0] -= dt * cl[4];
      if (cl[0] + cl[2] < 0) cl[0] = W + 10;
      const [x, y, w, h] = cl;
      const warm = y / hor;
      c.fillStyle = `rgba(${Math.round(120 + warm * 130)},${Math.round(60 + warm * 70)},${Math.round(90 - warm * 20)},0.55)`;
      c.beginPath(); c.ellipse(x + w / 2, y, w / 2, h, 0, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,${Math.round(150 + warm * 60)},120,${0.18 + warm * 0.2})`;
      c.fillRect(x + w * 0.15, y + h * 0.4, w * 0.7, 1);
    }
    // kuşlar
    c.strokeStyle = 'rgba(30,10,20,0.8)'; c.lineWidth = 1;
    for (const b of B.birds) {
      b[0] -= dt * 10; if (b[0] < -10) b[0] = W + 20;
      const f = Math.sin(B.t * 7 + b[2]) * 2;
      c.beginPath(); c.moveTo(b[0] - 3, b[1] - f); c.lineTo(b[0], b[1]); c.lineTo(b[0] + 3, b[1] - f); c.stroke();
    }
    // tepe katmanları (periyodik)
    const hAt = (Lr, x) => {
      let s = 0;
      for (const [k, ph, a] of Lr.w) s += Math.sin(TAU * k * x / L + ph) * a;
      if (Lr.mesa) { const m = clamp((s - 0.15) * 5, 0, 1); return Lr.base - m * Lr.amp - (s + 1) * 3; }
      return Lr.base - (s + 1) * Lr.amp * 0.5;
    };
    for (const Lr of B.layers) {
      const off = (B.t * Lr.spd) % L;
      c.fillStyle = Lr.col;
      c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 2; x += 2) c.lineTo(x, hAt(Lr, (x + off) % L));
      c.lineTo(W, H); c.closePath(); c.fill();
      if (Lr.mesa) { // güneşin vurduğu kenar
        c.strokeStyle = 'rgba(255,170,110,0.35)'; c.lineWidth = 1; c.beginPath();
        for (let x = 0; x <= W; x += 2) { const y = hAt(Lr, (x + off) % L); x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
    }
    // zemin
    const gy = hor + 34;
    const gg = c.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, '#5a2c1c'); gg.addColorStop(0.5, '#3a1a12'); gg.addColorStop(1, '#1c0c08');
    c.fillStyle = gg; c.fillRect(0, gy, W, H - gy);
    c.fillStyle = 'rgba(255,150,90,0.12)'; c.fillRect(0, gy, W, 1);
    const goff = (B.t * 26) % L;
    c.fillStyle = 'rgba(120,60,40,0.8)';
    for (const [x0, yy, w] of B.scrub) { const x = ((x0 - goff) % L + L) % L; if (x < W + 10) c.fillRect(x, gy + 4 + yy * (H - gy - 8), w, 1); }
    // telgraf direkleri
    c.fillStyle = '#0e0606'; c.strokeStyle = 'rgba(14,6,6,0.9)'; c.lineWidth = 0.7;
    const poff = (B.t * 20) % L;
    const px = B.poles.map(p => ((p - poff) % L + L) % L).sort((a, b) => a - b);
    for (const x of px) { if (x > W + 20) continue; c.fillRect(x, gy - 30, 2, 32); c.fillRect(x - 6, gy - 28, 14, 1.5); }
    c.beginPath();
    for (let i = 0; i < px.length - 1; i++) { const a = px[i], b = px[i + 1]; if (a > W + 20) break; c.moveTo(a - 5, gy - 27); c.quadraticCurveTo((a + b) / 2, gy - 21, b - 5, gy - 27); }
    c.stroke();
    // kaktüsler
    c.fillStyle = '#0a0404';
    const coff = (B.t * 30) % L;
    for (const [x0, s, kind] of B.cacti) {
      const x = ((x0 - coff) % L + L) % L;
      if (x > W + 30) continue;
      const by = H - 6 - (1.3 - s) * 20;
      c.fillRect(x, by - 30 * s, 5 * s, 30 * s);
      c.beginPath(); c.arc(x + 2.5 * s, by - 30 * s, 2.5 * s, Math.PI, 0); c.fill();
      if (kind !== 1) { c.fillRect(x - 7 * s, by - 17 * s, 7 * s, 3 * s); c.fillRect(x - 7 * s, by - 25 * s, 3 * s, 10 * s); }
      if (kind !== 2) { c.fillRect(x + 5 * s, by - 13 * s, 6 * s, 3 * s); c.fillRect(x + 8 * s, by - 21 * s, 3 * s, 10 * s); }
    }
    // atlı siluet
    B.rider += dt * 34;
    if (B.rider > W + 60) B.rider = -60;
    const rx = B.rider, ry = gy + (H - gy) * 0.35, p = B.t * 12;
    c.fillStyle = '#080303';
    c.beginPath(); c.ellipse(rx, ry, 13, 6, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(rx + 10, ry - 2); c.lineTo(rx + 19, ry - 12); c.lineTo(rx + 23, ry - 10); c.lineTo(rx + 15, ry + 1); c.fill();
    for (const [lx, ph] of [[-9, 0], [-6, 2], [7, 1], [10, 3]]) { c.save(); c.translate(rx + lx, ry + 3); c.rotate(Math.sin(p + ph) * 0.6); c.fillRect(-1, 0, 2, 11); c.restore(); }
    c.beginPath(); c.moveTo(rx - 12, ry - 2); c.quadraticCurveTo(rx - 20, ry + 2, rx - 18, ry + 9); c.lineTo(rx - 15, ry + 2); c.fill();
    c.fillRect(rx - 3, ry - 17, 7, 12); c.beginPath(); c.arc(rx + 0.5, ry - 20, 3.4, 0, TAU); c.fill();
    c.fillRect(rx - 7, ry - 23, 15, 2); c.fillRect(rx - 3, ry - 27, 7, 5);
    if (Math.random() < 0.5) B.dust.push([rx - 12, ry + 8, 1]);
    c.fillStyle = 'rgba(120,60,40,0.3)';
    for (const d of B.dust) { d[2] -= dt * 0.8; d[0] -= dt * 14; d[1] -= dt * 4; c.globalAlpha = Math.max(0, d[2]); c.beginPath(); c.arc(d[0], d[1], (1 - d[2]) * 6 + 1, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    B.dust = B.dust.filter(d => d[2] > 0);
    // vinyet
    const v = c.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  },
};

const el_ = el;
const GAME_VERSION = '0.9.0';
const I_WHEEL_HINT = (page) => {
  const pad = Input.device === 'pad';
  const sw = pad ? Input.padGlyph(PS.R1) : `${Input.kbGlyph('KeyQ')}${Input.kbGlyph('KeyE')}`;
  const cyc = pad ? `${Input.padGlyph(PS.LEFT)}${Input.padGlyph(PS.RIGHT)}` : Tr('Tekerlek');
  const sel = pad ? Tr('Sağ analog') : Tr('Fare');
  return page ? Tr`${sel}: seç • ${cyc}: aynı türde değiştir • ${pad ? Input.padGlyph(PS.X) : Input.kbGlyph('Mouse0')} kullan • ${sw} Silahlar` : Tr`${sel}: seç • ${cyc}: aynı türde değiştir • ${Input.glyph('wheel')} bırak: kuşan • ${sw} Eşyalar`;
};
const RADAR_B = new Set(['general', 'saloon', 'sheriff', 'doctor', 'gunsmith', 'butcher', 'stable', 'hotel', 'station', 'bank', 'mine', 'lumber', 'docks', 'ranch', 'cabin', 'hermit', 'property', 'fence', 'bakery', 'smith', 'pharmacy', 'gambling', 'brewery', 'mill', 'county', 'post', 'warehouse', 'cantina']);
/* Harita açıklamaları: [simge, ad]; MAP_LEGEND_B: simgenin bina türleri */
const mapLegend = () => [['store', Tr('Mağaza')], ['glass', Tr('Saloon')], ['star', Tr('Şerif')], ['cross', Tr('Doktor')], ['gun', Tr('Silahçı')], ['horseshoe', Tr('Ahır')], ['bed', Tr('Otel')], ['train', Tr('İstasyon')], ['bank', Tr('Banka')], ['house', Tr('Mülk')], ['pick', Tr('İş')], ['tent', Tr('Haydut Kampı')], ['eye', Tr('Önemli Yer')], ['question', Tr('Söylenti')], ['waypoint', Tr('Hedef')]];
const MAP_LEGEND_B = { store: ['general'], glass: ['saloon', 'cantina', 'gambling'], star: ['sheriff'], cross: ['doctor', 'pharmacy'], gun: ['gunsmith'], horseshoe: ['stable'], bed: ['hotel'], train: ['station'], bank: ['bank'], pick: ['mine', 'smith', 'lumber'] };
const BICON = { general: 'store', saloon: 'glass', sheriff: 'star', doctor: 'cross', gunsmith: 'gun', butcher: 'cleaver', stable: 'horseshoe', hotel: 'bed', bank: 'bank', station: 'train', church: 'church', land: 'scroll', barber: 'barber', tailor: 'scissors', fence: 'bag', mine: 'pick', lumber: 'axe', docks: 'anchor', ranch: 'wheat', cabin: 'fox', hermit: 'hut', property: 'house', bakery: 'wheat', smith: 'pick', pharmacy: 'cross', laundry: 'drop', gambling: 'glass', brewery: 'mug', mill: 'windmill', county: 'scroll', post: 'scroll', warehouse: 'bag', cantina: 'glass' };
const PICON = { hideout: 'tent', railcamp: 'train', trappercamp: 'fox', fathercabin: 'hut', camp: 'tent', farm: 'wheat', property: 'house', home: 'hut', crater: 'crater', sequoia: 'tree', ruins: 'ruins', ghost: 'ghost', mine: 'mine', hotspring: 'spring', dino: 'bones', hanging: 'gallows', wreck: 'wheel', lighthouse: 'lighthouse', hermit: 'hut', trapper: 'fox', battlefield: 'swords', fortruin: 'fort', windmill: 'windmill', oasis: 'palm', lookout: 'eye', cave: 'paw', graveyard: 'grave', shipwreck: 'anchor', arch: 'arch' };
const TIPS = [
  'İpucu: Çömelerek hayvanlara daha kolay yaklaşabilirsin.',
  'İpucu: Çiğ et yemek hastalık yapabilir. Kamp ateşinde pişir.',
  'İpucu: Çölde matarani her zaman dolu tut.',
  'İpucu: Karlı dağlarda kürk manto hayat kurtarır.',
  'İpucu: Barmenlerden söylenti dinleyerek gizli yerleri öğrenebilirsin.',
  'İpucu: Bankadaki paran ölünce kaybolmaz.',
  'İpucu: Yüksek tepeler (gözetleme noktaları) haritanın büyük kısmını açar.',
  'İpucu: Atınla bağın geliştikçe silah seslerinden daha az ürker.',
  'İpucu: Başarımlar kalıcı yetenekler (perk) kazandırır.',
  'İpucu: Evlenmek için önce bir mülk sahibi olmalısın.',
  'İpucu: Hızlı kullanım tuşu en uygun yiyeceği ya da ilacı kendiliğinden seçer.',
];
