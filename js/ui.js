'use strict';
/* ==========================================================
   FRONTIER'S END — arayüz: HUD, menüler, harita, çanta, günlük,
   dükkanlar, mini oyunlar, karakter yaratma
   ========================================================== */

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
      this.timers = this.timers || { hud: 0, radar: 0 };
      this.timers.hud -= dt; this.timers.radar -= dt;
      if (this.timers.hud <= 0) { this.timers.hud = 0.1; this.hudUpdate(); }
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
      let h = `<div class="p-head"><div class="p-title">${spec.title}</div>${spec.sub ? `<div class="p-sub">${typeof spec.sub === 'function' ? spec.sub(m) : spec.sub}</div>` : ''}</div>`;
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
  toast(title, sub, kind) {
    const e = el_('div', 'toast tk-' + (kind || 'none'), `<div class="t-k">${{ ach: Tr('BAŞARIM'), skill: Tr('YETENEK'), year: Tr('YAŞ'), family: Tr('AİLE'), bounty: Tr('ÖDÜL'), horse: Tr('AT'), ok: '' }[kind] || ''}</div><div class="t-t">${Icons.iconize(title)}</div><div class="t-s">${Icons.iconize(sub || '')}</div>`);
    this.el.toasts.appendChild(e);
    setTimeout(() => e.classList.add('out'), 5200);
    setTimeout(() => e.remove(), 6000);
  },
  help(html, dur = 6) {
    const h = this.el.help;
    h.innerHTML = Icons.iconize(html); h.classList.remove('hidden');
    clearTimeout(this._helpT);
    this._helpT = setTimeout(() => h.classList.add('hidden'), dur * 1000);
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
  setText(id, t) {
    const e = this.cache[id] || (this.cache[id] = $('#' + id));
    if (e._t !== t) { e._t = t; e.innerHTML = t; }
  },
  hudUpdate() {
    const P = G.player;
    if (!P) return;
    this.setCore('core-hp', P.hp / P.maxHp, Math.min(P.hunger, P.thirst) / 100);
    this.setCore('core-sta', P.sta / Math.max(1, P.maxSta), P.energy / 100);
    this.setCore('core-de', P.de / 100, P.deCore / 100);
    const setNeed = (id, v) => { const e = this.cache[id] || (this.cache[id] = $('#' + id)); const k = Math.round(v); if (e._k !== k) { e._k = k; e.style.setProperty('--v', v / 100); e.classList.toggle('low', v < 20); } };
    setNeed('need-hunger', P.hunger); setNeed('need-thirst', P.thirst); setNeed('need-energy', P.energy); setNeed('need-clean', P.clean);
    this.setText('hud-money', fmtMoney(P.money));
    this.setText('hud-time', G.timeStr());
    this.setText('hud-date', G.dateStr());
    this.setText('hud-age', Tr`${P.name} • ${G.age} yaşında`);
    // sıcaklık
    const ft = Math.round(G.feltTemp);
    const tg = this.cache.tg || (this.cache.tg = $('#temp-gauge'));
    if (tg._k !== ft + '' + (G.coldness > 0) + (G.hotness > 0)) {
      tg._k = ft + '' + (G.coldness > 0) + (G.hotness > 0);
      $('#temp-val').textContent = ft + '°';
      $('#temp-fill').style.height = clamp((ft + 15) / 60, 0, 1) * 100 + '%';
      tg.classList.toggle('cold', G.coldness > 0); tg.classList.toggle('hot', G.hotness > 0);
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
    if (G.nearFire) gi('fire', Tr('Ateş başında'), '#ff9a40');
    if (P.clean < 20) gi('flies', Tr('Kirlisin'), '#c8b890');
    if (P.crouch) gi('feet', Tr('Gizlilik'), '#e8e0d0');
    this.setText('status-icons', st.join(''));
    // silah
    const W = P.W;
    let ammo = '';
    if (W.clip) ammo = `${P.clip[P.weapon] || 0}<small>/${P.ammo[W.ammo]}</small>`;
    else if (W.throw) ammo = `${P.count('dynamite')}`;
    else if (P.weapon === 'bow') ammo = `${P.ammo.arrow}`;
    this.setText('w-icon', Icons.weapon(P.weapon)); this.setText('w-name', W.n + (P.reloadT > 0 ? Tr(' <em>dolduruluyor…</em>') : '')); this.setText('w-ammo', ammo);
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
  drawRadar() {
    const c = this.rctx, W = G.world, P = G.player;
    if (!W || !P) return;
    const S = 200, R = 100;
    const z = P.riding ? 1.35 : 1.8; // px / karo
    const tx = P.x / TS, ty = P.y / TS;
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(R, R, R - 2, 0, TAU); c.clip();
    c.fillStyle = '#c9b48a'; c.fillRect(0, 0, S, S);
    c.imageSmoothingEnabled = false;
    const span = S / z;
    c.drawImage(W.mapCanvas, tx - span / 2, ty - span / 2, span, span, 0, 0, S, S);
    c.imageSmoothingEnabled = true;
    c.drawImage(G.fogCanvas, (tx - span / 2) / 4, (ty - span / 2) / 4, span / 4, span / 4, 0, 0, S, S);
    const toR = (wx, wy) => [R + (wx / TS - tx) * z, R + (wy / TS - ty) * z];
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
      c.moveTo(R, R);
      for (let i = bestI; i < G.gps.length; i++) { const [x, y] = toR(G.gps[i][0], G.gps[i][1]); c.lineTo(x, y); started = true; }
      if (started) c.stroke();
    }
    // simgeler
    c.font = 'bold 11px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const icon = (wx, wy, g, col, bg, sz = 13) => {
      let [x, y] = toR(wx, wy);
      const dx = x - R, dy = y - R, d = Math.hypot(dx, dy);
      if (d > R - 10) { if (!bg) return; x = R + dx / d * (R - 10); y = R + dy / d * (R - 10); }
      c.fillStyle = bg || 'rgba(26,18,12,0.85)'; c.beginPath(); c.arc(x, y, sz * 0.62, 0, TAU); c.fill();
      const im = Icons.img(g, col || '#efe6d2', 32);
      if (im && im.complete) c.drawImage(im, x - sz * 0.42, y - sz * 0.42, sz * 0.84, sz * 0.84);
    };
    c.font = '10px serif';
    for (const b of W.buildings) {
      if (Math.abs(b.door.x - P.x) > 900 || Math.abs(b.door.y - P.y) > 900) continue;
      const ic = BICON[b.type];
      if (ic && RADAR_B.has(b.type) && (b.town ? G.visited.has(b.town) : true)) icon(b.door.x, b.door.y, ic, '#efe6d2', null, 12);
    }
    c.font = 'bold 11px serif';
    for (const p of W.pois) {
      if (!G.discovered.has(p.id) && !G.rumored.has(p.id)) continue;
      icon(p.x, p.y, G.rumored.has(p.id) && !G.discovered.has(p.id) ? 'question' : (PICON[p.kind === 'landmark' ? p.type : p.kind] || 'eye'), '#efe6d2', p.kind === 'camp' ? 'rgba(130,20,14,0.9)' : null);
    }
    if (G.camp) icon(G.camp.x, G.camp.y, 'tent', '#efe6d2');
    if (G.nomads) for (const nc of G.nomads) if (nc.era >= 0 && G.discovered.has(G.nomadId(nc))) icon(nc.x, nc.y, 'tent', '#f0e4c8', 'rgba(120,80,20,0.9)', 13);
    if (G.activeBounty && !G.activeBounty.done && G.activeBounty.status !== 'carried') icon(G.activeBounty.bx || G.activeBounty.x, G.activeBounty.by || G.activeBounty.y, 'skull', '#fff', 'rgba(150,20,20,0.9)', 15);
    if (G.waypoint) icon(G.waypoint.x, G.waypoint.y, 'waypoint', '#fff', 'rgba(140,40,140,0.9)', 15);
    // canlılar
    for (const e of G.ents) {
      if (e.dead) continue;
      const [x, y] = toR(e.x, e.y);
      if (Math.hypot(x - R, y - R) > R - 4) continue;
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
    for (const tr of G.trains) if (tr.pos[0]) { const [x, y] = toR(tr.pos[0][0], tr.pos[0][1]); if (Math.hypot(x - R, y - R) < R - 4) { c.fillStyle = '#222'; c.fillRect(x - 3, y - 3, 6, 6); } }
    // oyuncu oku
    c.translate(R, R); c.rotate(P.riding ? P.riding.ang : P.ang);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -5.5); c.lineTo(-3, 0); c.lineTo(-6, 5.5); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // çerçeve
    c.strokeStyle = 'rgba(20,14,8,0.85)'; c.lineWidth = 4; c.beginPath(); c.arc(R, R, R - 2, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(230,215,180,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(R, R, R - 5, 0, TAU); c.stroke();
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
    $('#map-legend').innerHTML = `<div class="ml-t">${Tr`Açıklamalar`}</div>` + [['store', Tr('Mağaza')], ['glass', Tr('Saloon')], ['star', Tr('Şerif')], ['cross', Tr('Doktor')], ['gun', Tr('Silahçı')], ['horseshoe', Tr('Ahır')], ['bed', Tr('Otel')], ['train', Tr('İstasyon')], ['bank', Tr('Banka')], ['house', Tr('Mülk')], ['pick', Tr('İş')], ['tent', Tr('Haydut Kampı')], ['eye', Tr('Önemli Yer')], ['question', Tr('Söylenti')], ['waypoint', Tr('Hedef')]].map(([a, b]) => `<div><span>${Icons.glyph(a, '#2a1a0e')}</span>${b}</div>`).join('');
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
    if (mv.m > 0) { M.cx += mv.x * mv.m * dt * 500 / M.zoom; M.cy += mv.y * mv.m * dt * 500 / M.zoom; this.mapDirty = true; }
    const a = I.aimVec();
    if (Math.abs(a.y) > 0.2) { M.zoom = clamp(M.zoom * (1 - a.y * dt * 2), 0.5, 8); this.mapDirty = true; }
    if (I.down('fire') && I.device === 'pad') { M.zoom = clamp(M.zoom * (1 + dt * 2), 0.5, 8); this.mapDirty = true; }
    if (I.down('aim') && I.device === 'pad') { M.zoom = clamp(M.zoom * (1 - dt * 2), 0.5, 8); this.mapDirty = true; }
    M.cx = clamp(M.cx, 0, WW); M.cy = clamp(M.cy, 0, WH);
    if (I.pressed('confirm') && I.device === 'pad') { const [wx, wy] = this.mapToWorld(innerWidth / 2, innerHeight / 2); this.mapSetWaypoint(wx, wy); this.mapDirty = true; }
    if (I.pressed('alt')) { G.setWaypoint(null); this.mapDirty = true; this.feed(Tr('Hedef kaldırıldı')); }
    if (I.pressed('alt2') && I.device === 'pad') { M.cx = G.player.x / TS; M.cy = G.player.y / TS; this.mapDirty = true; }
    if (I.pressed('back') || I.pressed('map')) { this.pop(m); return; }
    $('#map-cursor').style.display = I.device === 'pad' ? 'block' : 'none';
    this.mapHover();
    this.drawMap();
  },
  mapHover() {
    const I = Input;
    const sx = I.device === 'pad' ? innerWidth / 2 : I.mouse.x, sy = I.device === 'pad' ? innerHeight / 2 : I.mouse.y;
    const [wx, wy] = this.mapToWorld(sx, sy);
    let best = null, bd = (26 / this.map.zoom * TS) ** 2;
    for (const p of G.world.pois) if (G.discovered.has(p.id) || G.rumored.has(p.id)) { const d = dist2(p.x, p.y, wx, wy); if (d < bd) { bd = d; best = p; } }
    for (const t of G.world.towns) if (G.visited.has(t.id) || G.reveal[((t.cy / TS / 4) | 0) * 256 + ((t.cx / TS / 4) | 0)]) { const d = dist2(t.cx, t.cy, wx, wy); if (d < bd * 4) { bd = d / 4; best = { n: t.n, desc: t.desc + (G.visited.has(t.id) ? '' : Tr(' (Henüz ziyaret edilmedi)')) }; } }
    let html = '';
    if (best) html = `<div class="mi-n">${best.n}</div><div class="mi-d">${best.desc || ''}${G.rumored.has(best.id) && !G.discovered.has(best.id) ? Tr(' <i>(söylenti)</i>') : ''}</div>`;
    else html = `<div class="mi-n">${G.world.regionAt(wx, wy)}</div>`;
    if (this._mh !== html) { this._mh = html; $('#map-info').innerHTML = html; }
    const hint = Tr`${Input.device === 'pad' ? Input.glyph('confirm') + Tr(' Hedef Koy &nbsp; ') + Input.glyph('alt') + Tr(' Hedefi Kaldır &nbsp; ') + Input.padGlyph(PS.R2) + Input.padGlyph(PS.L2) + Tr(' Yakınlaştır &nbsp; ') + Input.glyph('alt2') + Tr(' Konumum') : Tr('Sol Tık: Hedef Koy &nbsp; Sağ Tık / X: Kaldır &nbsp; Tekerlek: Yakınlaştır &nbsp; Sürükle: Kaydır')} &nbsp; ${Input.glyph('back')} Kapat`;
    if (this._mhint !== hint) { this._mhint = hint; $('#map-hint').innerHTML = hint; }
  },
  drawMap() {
    const c = this.mctx, W = G.world, M = this.map, d = this.mapDPR;
    const w = innerWidth, h = innerHeight;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = '#b8a078'; c.fillRect(0, 0, w, h);
    const ox = w / 2 - M.cx * M.zoom, oy = h / 2 - M.cy * M.zoom;
    c.imageSmoothingEnabled = M.zoom < 2;
    c.drawImage(W.mapCanvas, ox, oy, WW * M.zoom, WH * M.zoom);
    c.imageSmoothingEnabled = true;
    c.drawImage(G.fogCanvas, ox, oy, WW * M.zoom, WH * M.zoom);
    const toS = (wx, wy) => [ox + wx / TS * M.zoom, oy + wy / TS * M.zoom];
    const revealed = (wx, wy) => G.reveal[((wy / TS / 4) | 0) * 256 + ((wx / TS / 4) | 0)];
    // bölge isimleri
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `italic ${Math.round(16 + M.zoom * 4)}px "IM Fell English", serif`;
    for (const r of REGIONS) {
      const [x, y] = toS(r.x * WW * TS, r.y * WH * TS);
      c.fillStyle = 'rgba(60,40,20,0.35)'; c.fillText(r.n.toUpperCase().split('').join(' '), x, y);
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
      c.font = `${Math.round(13 + M.zoom * 2.5)}px "IM Fell English SC", serif`;
      c.fillStyle = 'rgba(232,220,192,0.8)'; c.fillText(t.n, x + 1, y - 18 - M.zoom * 4 + 1);
      c.fillStyle = '#2a1a0e'; c.fillText(t.n, x, y - 18 - M.zoom * 4);
      if (M.zoom > 1.8) {
        for (const b of t.buildings) { const ic = BICON[b.type]; if (!ic) continue; const [bx, by] = toS(b.door.x, b.door.y); c.fillStyle = 'rgba(30,20,12,0.85)'; c.beginPath(); c.arc(bx, by, 9, 0, TAU); c.fill(); const im = Icons.img(ic, '#efe6d2', 32); if (im.complete) c.drawImage(im, bx - 6.5, by - 6.5, 13, 13); }
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
      if (p.kind === 'property' && G.props.includes(p.prop)) { c.strokeStyle = '#e8c860'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.stroke(); }
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
    if (G.horse && !G.horse.dead) badge(G.horse.x, G.horse.y, 'horse', 'rgba(60,36,20,0.9)', '#f0d8a8');
    if (G.waypoint) badge(G.waypoint.x, G.waypoint.y, 'waypoint', 'rgba(140,40,140,0.95)');
    // oyuncu
    const P = G.player;
    const [px, py] = toS(P.x, P.y);
    c.save(); c.translate(px, py); c.rotate(P.riding ? P.riding.ang : P.ang);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(11, 0); c.lineTo(-8, -7); c.lineTo(-4, 0); c.lineTo(-8, 7); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // çerçeve gölgesi
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,5,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
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
    if (it.raw) eff.push(`<span class="bad">${Tr`Çiğ: hastalık riski`}</span>`);
    if (it.coat) eff.push(Tr`Sıcaklık ${it.coat.warm > 0 ? '+' : ''}${it.coat.warm}°C`);
    return `<div class="ps-big">${Icons.item(it.id, 'ic big')}</div><div class="ps-t">${it.n}</div><div class="ps-d">${it.d || ''}</div>${eff.length || extra ? `<div class="ps-e">${extra || eff.join('<br>')}</div>` : ''}<div class="ps-p">${Tr`Değeri: ${fmtMoney(it.p)}`}</div>`;
  },

  /* ================= GÜNLÜK ================= */
  openJournal(tab = 0) {
    const tabs = [Tr('Karakter'), Tr('Yetenekler'), Tr('Başarımlar'), Tr('İstatistikler'), Tr('İlişkiler'), Tr('Rehber')];
    const el = el_('div', 'modal panel journal');
    const m = this.makeModal(el, { scroll: true, noFocus: true, onTab: (d) => { m.tab = (m.tab + d + tabs.length) % tabs.length; render(); Audio_.ui('move'); } });
    m.tab = tab;
    const render = () => {
      el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Günlük`}</div></div><div class="p-tabs">${Input.glyph('tabL')}${tabs.map((t, i) => `<span class="tab ${i === m.tab ? 'on' : ''}" data-tab="${i}">${t}</span>`).join('')}${Input.glyph('tabR')}</div><div class="p-body"><div class="scroll jr">${Icons.iconize(this.journalTab(m.tab))}</div></div><div class="p-foot">${Tr`${Input.glyph('back')} Kapat &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Sekme`}</div>`;
      $$('.tab', el).forEach(n => (n.onclick = () => { m.tab = +n.dataset.tab; render(); }));
      const pc = $('#jr-portrait', el);
      if (pc) Spr.portrait(pc.getContext('2d'), pc.width, pc.height, G.player.look, G.age);
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
      const rows = [[Tr('Hayatta kalınan gün'), G.day], [Tr('Avlanan hayvan'), S.animals], [Tr('Öldürülen haydut'), S.bandits], [Tr('Toplam öldürülen insan'), S.kills], [Tr('Yürünen mesafe'), S.walkMiles.toFixed(1) + Tr(' mil')], [Tr('At sırtında'), S.rideMiles.toFixed(1) + Tr(' mil')], [Tr('Toplanan bitki'), S.herbs], [Tr('Tutulan balık'), S.fish], [Tr('Yenen yemek'), S.eaten], [Tr('Kazanılan toplam para'), fmtMoney(S.earned)], [Tr('Çalışılan vardiya'), S.shifts], [Tr('Yardım edilen yabancı'), S.helped], [Tr('Keşfedilen yer'), G.discovered.size], [Tr('Ziyaret edilen kasaba'), G.visited.size + ' / 8'], [Tr('Kurulan kamp'), S.camps], [Tr('Tren yolculuğu'), S.trainRides], [Tr('Bulunan altın'), S.nuggets], [Tr('Kazanılan Yirmi Bir eli'), S.bjWins], [Tr('Bilek güreşi zaferi'), S.armWins]];
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
    return this.guideHtml();
  },
  guideHtml() {
    return `<div class="guide">
      <h3>${Tr`Hayatta Kalma`}</h3><p>${Tr`<b>Açlık</b>, <b>susuzluk</b> ve <b>uyku</b> sürekli azalır. Sıfırlanırlarsa sağlığın düşer. Sağlık çekirdeği (♥ içi) açlık ve susuzluktan beslenir. Sıcak çöllerde daha çok su içmen, karlı dağlarda ise kalın giysiler giymen gerekir. Kamp ateşleri ve sıcak yemekler seni ısıtır.`}</p>
      <h3>${Tr`Yaşlanma`}</h3><p>${Tr`18 yaşında başlarsın. Zaman geçtikçe yaşlanırsın; 30'lardan sonra dayanıklılığın, 50'lerden sonra sağlığın azalır. Hedefin <b>80 yaşına kadar hayatta kalmak.</b>`}</p>
      <h3>${Tr`Para Kazanma`}</h3><p>${Tr`Avlan ve postları kasapta sat. Bitki topla. Madende, kerestecide, limanda ya da çiftliklerde <b>çalış</b>. Nehirde altın ele. Ödül ilanlarını takip et. Ya da… kanunun yanlış tarafında yaşa.`}</p>
      <h3>${Tr`Kanun`}</h3><p>${Tr`Görülürsen suçların başına ödül koydurur. Kanun adamlarının arama alanından (haritadaki kırmızı daire) kaç ve görünmeden bekle. Ödülünü şerif ofisinde ödeyebilirsin.`}</p>
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
  openPause() {
    Audio_.ui('ok');
    this.menu({
      title: Tr('Duraklatıldı'), cls: 'pause', sub: () => Tr`${G.player.name} • ${G.age} yaşında • ${G.dateStr()}`,
      items: [
        { label: Tr('Devam Et'), fn: () => this.pop() },
        { label: Tr('Harita'), fn: () => { this.pop(); this.openMap(); } },
        { label: Tr('Çanta'), fn: () => { this.pop(); this.openSatchel(); } },
        { label: Tr('Günlük'), fn: () => { this.pop(); this.openJournal(); } },
        { label: Tr('Oyunu Kaydet'), fn: () => G.saveGame() },
        { label: Tr('Ayarlar'), fn: () => this.openSettings() },
        { label: Tr('Tuş Atamaları'), fn: () => this.openControls() },
        ...(Platform.canQuit ? [{ label: Tr('Oyundan Çık'), fn: () => this.confirm(Tr('Oyundan Çık'), Tr('Oyun kaydedilip kapatılsın mı?'), () => { G.saveGame(true); Platform.quit(); }, Tr('Vazgeç'), Tr('Kaydet ve Çık')) }] : []),
        { label: Tr('Ana Menüye Dön'), fn: () => this.confirm(Tr('Ana Menü'), Tr('Kaydedilmemiş ilerleme kaybolabilir. Kaydedip çıkılsın mı?'), () => { G.saveGame(true); this.closeAll(); this.showMainMenu(); }, Tr('Vazgeç'), Tr('Kaydet ve Çık')) },
      ],
    });
  },
  openSettings() {
    const S = G.settings;
    const el = el_('div', 'modal panel settings');
    const rows = [
      ['lang', 'Dil / Language', 'lang'],
      ['master', Tr('Ana Ses'), 'vol'], ['music', Tr('Müzik'), 'vol'], ['sfx', Tr('Efektler'), 'vol'], ['amb', Tr('Ortam Sesleri'), 'vol'],
      ['fullscreen', Tr('Tam Ekran'), 'fs'],
      ['zoom', Tr('Piksel Ölçeği'), 'zoom'], ['shake', Tr('Ekran Sarsıntısı'), 'bool'], ['fps', Tr('FPS Göster'), 'bool'],
      ['padGlyphs', Tr('Kol Simgeleri'), 'opt'], ['aimAssist', Tr('Nişan Yardımı (Kol)'), 'opt'], ['aimSens', Tr('Nişan Hassasiyeti (Kol)'), 'opt'], ['fxq', Tr('Görsel Efektler'), 'opt'],
    ];
    const OPTL = { aimAssist: [Tr('Kapalı'), Tr('Hafif'), Tr('Standart'), Tr('Tam Kilit')], aimSens: [Tr('Düşük'), Tr('Normal'), Tr('Yüksek')], padGlyphs: [Tr('Otomatik'), 'PlayStation', 'Xbox', 'Steam Deck'], fxq: [Tr('Tam'), Tr('Sade')] };
    const val = (k, t) => t === 'fs' ? (Platform.isFullscreen() ? Tr('Açık') : Tr('Kapalı')) : t === 'lang' ? (I18N.LANGS.find(l => l[0] === I18N.lang) || I18N.LANGS[0])[1] : t === 'vol' ? Math.round(S[k] * 10) * 10 + '%' : t === 'bool' ? (S[k] ? Tr('Açık') : Tr('Kapalı')) : t === 'opt' ? OPTL[k][S[k]] : (S[k] ? S[k] + 'x' : Tr('Otomatik'));
    el.innerHTML = `<div class="p-head"><div class="p-title">${Tr`Ayarlar`}</div></div><div class="p-body"><div class="p-list">${rows.map(([k, n, t]) => `<div class="p-item nav opt" data-k="${k}" data-t="${t}" data-lr><span class="pi-l">${n}</span><span class="pi-r"><b class="arr">◀</b> <span class="v">${val(k, t)}</span> <b class="arr">▶</b></span></div>`).join('')}<div class="p-item nav" id="set-keys"><span class="pi-l">${Tr`Tuş Atamaları`}</span><span class="pi-r">›</span></div><div class="p-item nav" id="set-back"><span class="pi-l">${Tr`Kaydet ve Geri Dön`}</span></div></div></div><div class="p-foot">${Tr`◀ ▶ Değiştir &nbsp; ${Input.glyph('back')} Geri`}</div>`;
    const m = this.makeModal(el, { onBack: () => { G.saveSettings(); this.pop(); } });
    $$('.opt', el).forEach(n => {
      const k = n.dataset.k, t = n.dataset.t;
      n._lr = (d) => {
        if (t === 'lang') {
          const L = I18N.LANGS, i = L.findIndex(l => l[0] === I18N.lang);
          S.lang = L[(i + d + L.length) % L.length][0];
          I18N.setLang(S.lang); G.saveSettings(); Audio_.ui('move');
          this.relocalize();
          return;
        }
        if (t === 'fs') { Platform.toggleFullscreen(); setTimeout(() => { $('.v', n).textContent = val(k, t); }, 250); return; }
        if (t === 'vol') S[k] = clamp(Math.round((S[k] + d * 0.1) * 10) / 10, 0, 1);
        else if (t === 'bool') S[k] = !S[k];
        else if (t === 'opt') { const n = OPTL[k].length; S[k] = ((S[k] === undefined ? 1 : S[k]) + d + n) % n; }
        else { const opts = [0, 1, 2, 3, 4, 5]; S[k] = opts[(opts.indexOf(S[k]) + d + opts.length) % opts.length]; }
        $('.v', n).textContent = val(k, t);
        G.applySettings();
      };
      n.onclick = () => n._lr(1);
      $$('.arr', n).forEach((a, i) => (a.onclick = (e) => { e.stopPropagation(); n._lr(i ? 1 : -1); }));
      n.onmouseenter = () => m.setFocus(n, true);
    });
    $('#set-keys', el).onclick = () => { G.saveSettings(); this.openControls(); };
    $('#set-back', el).onclick = () => { G.saveSettings(); this.pop(); };
    this.push(m);
    return m;
  },
  /* Dil değişince açık menüleri yeni dilde yeniden kur (ayarlar dil satırında açık kalır) */
  relocalize() {
    if (G.state === 'menu') this.showMainMenu();
    else { this.closeAll(); this.openPause(); }
    const m = this.openSettings();
    const row = $('.opt[data-k="lang"]', m.el);
    if (row) m.setFocus(row, true);
  },

  /* ================= BİNALAR ================= */
  openBuilding(b) {
    const d = b.def, P = G.player;
    const svc = d.svc;
    const sub = TOWNS.find(t => t.id === b.town);
    this.menu({
      title: b.name, sub: () => Tr`${sub ? sub.n + ' • ' : ''}${G.timeStr()} • Cüzdan: ${fmtMoney(P.money)}`, cls: 'building',
      build: () => {
        const it = [];
        const closed = (G.hour < 6 || G.hour > 22) && !['saloon', 'hotel', 'sheriff', 'station', 'church', 'mine', 'lumber', 'docks', 'ranch', 'stable'].includes(b.type);
        if (closed) { it.push({ html: `<p class="closed">${Tr`Dükkan kapalı. Açılış saati 06:00.`}</p>` }); if (svc.includes('rob')) it.push({ label: Tr('Kapıyı Kır ve Soy'), icon: '🔫', fn: () => this.robStore(b, true) }); return it; }
        if (P.masked && b.type !== 'fence') {
          it.push({ html: `<p class="closed">${b.type === 'sheriff' ? Tr('"Maskeyle şerif ofisine mi giriyorsun? Çıkar onu, hemen!"') : b.type === 'bank' ? Tr('"Maskeli müşteriye hizmet yok. Çıkar onu ya da defol."') : Tr('"Maskeni çıkar, yoksa sana hizmet etmem."')}</p>` });
          it.push({ icon: '🎭', label: Tr('Maskeyi Çıkar'), fn: () => G.toggleMask(null, true) });
          if (svc.includes('rob')) it.push({ icon: '🔫', label: Tr('Dükkanı Soy'), cls: 'danger', fn: () => this.robStore(b) });
          if (svc.includes('robbank')) it.push({ icon: '💣', label: Tr('Bankayı Soy'), cls: 'danger', fn: () => this.robBank(b) });
          return it;
        }
        for (const s of svc) it.push(...this.svcItems(b, s));
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
      case 'meal': it.push({ icon: '🍲', label: Tr('Sıcak Yemek Ye'), right: fmtMoney(2.5 * G.priceMul(true)), fn: () => { if (G.spend(2.5 * G.priceMul(true))) { P.hunger = Math.min(100, P.hunger + 60); P.thirst = Math.min(100, P.thirst + 25); P.hp = Math.min(P.maxHp, P.hp + 20); P.warmBuff = 120; G.stat('eaten', 1); this.feed(Tr('🍲 Doyasıya yedin.')); G.advanceClock(20); } } });
        it.push({ icon: '🥃', label: Tr('Bir Viski İç'), right: fmtMoney(1), fn: () => { if (G.spend(1)) { P.addItem('whiskey', 1, true); G.consume('whiskey'); } } }); break;
      case 'blackjack': it.push({ icon: '🃏', label: Tr('Yirmi Bir Oyna'), fn: () => this.openBlackjack() }); break;
      case 'arm': it.push({ icon: '💪', label: Tr('Bilek Güreşi ($5 bahis)'), fn: () => this.openArmWrestle() }); break;
      case 'rumor': it.push({ icon: '👂', label: Tr('Söylenti Dinle'), right: fmtMoney(0.5), fn: () => this.rumor() }); break;
      case 'rob': it.push({ icon: '🔫', label: Tr('Dükkanı Soy'), cls: 'danger', fn: () => this.robStore(b) }); break;
      case 'news': it.push({ icon: '📰', label: Tr('Gazete Oku'), right: '$0.10', fn: () => this.readNews() }); break;
      case 'room': it.push({ icon: '🛏', label: Tr('Oda Tut ve Uyu'), right: fmtMoney(2 * G.priceMul(true)), fn: () => this.openSleep('hotel', 2 * G.priceMul(true)) }); break;
      case 'bath': it.push({ icon: '🛁', label: Tr('Sıcak Banyo'), right: fmtMoney(1), fn: () => { if (G.spend(1)) { P.clean = 100; P.warmBuff = 60; this.feed(Tr('🛁 Tertemiz oldun. Kokun bile değişti.')); G.advanceClock(30); } } }); break;
      case 'heal': { const c = 5 * (G.hasPerk('saint') ? 0.5 : 1); it.push({ icon: '✚', label: Tr('Tedavi Ol (Sağlık, hastalık, zehir)'), right: fmtMoney(c), fn: () => { if (G.spend(c)) { P.hp = P.maxHp; P.sick = 0; P.poison = 0; this.feed(Tr('✚ Doktor seni muayene edip tedavi etti.')); G.advanceClock(30); } } }); break; }
      case 'bounty':
        if (G.law.bounty > 0) it.push({ icon: '⚖', label: Tr('Başındaki Ödülü Öde'), right: fmtMoney(G.law.bounty), fn: () => G.payBounty() });
        if (G.activeBounty && G.activeBounty.done) it.push({ icon: '💰', label: Tr('Ödül Avı Ödülünü Al'), right: fmtMoney(G.activeBounty.reward), fn: () => { G.earn(G.activeBounty.reward, Tr('Ödül avı')); G.addHonor(3); G.activeBounty = null; } });
        // omuzda ya da kapıdaki atın eyerinde getirilen suçlular
        for (const c of G.carriedAll()) if (c.e.kind === 'npc' && G.wantedValue(c.e)) it.push({ icon: '⚖', label: Tr`Teslim Et: ${c.e.name} ${c.e.dead ? Tr('(ölü)') : Tr('(canlı)')}`, right: fmtMoney(G.wantedValue(c.e)), fn: () => { G.deliverToSheriff(c); this.pop(); } });
        break;
      case 'board': it.push({ icon: '📜', label: Tr('Ödül İlanları'), fn: () => this.openBountyBoard() }); break;
      case 'horses': it.push({ icon: '🐴', label: Tr('At Satın Al'), fn: () => this.openHorseShop(b) }); if (G.stable.length) it.push({ icon: '🏇', label: Tr('Ahırdaki Atların'), fn: () => this.openStable(b) }); break;
      case 'horsecare': if (G.horse && !G.horse.dead) it.push({ icon: '🧽', label: Tr`${G.horse.name}'i Tımar Ettir`, right: fmtMoney(2), fn: () => { if (dist(G.horse.x, G.horse.y, P.x, P.y) > 200) { this.feed(Tr('Atın burada değil.'), 'warn'); return; } if (G.spend(2)) { G.horse.hp = G.horse.maxHp; G.horse.sta = G.horse.maxSta; G.horse.addBond(5); this.feed(Tr`🐴 ${G.horse.name} tımar edildi.`); } } }); break;
      case 'bank': it.push({ icon: '🏦', label: Tr('Banka İşlemleri'), right: fmtMoney(G.bank), fn: () => this.openBank() }); break;
      case 'robbank': it.push({ icon: '💣', label: Tr('Bankayı Soy'), cls: 'danger', fn: () => this.robBank(b) }); break;
      case 'train': it.push({ icon: '🚂', label: Tr('Tren Bileti Al'), fn: () => this.openTrain(b) }); break;
      case 'donate': it.push({ icon: '🙏', label: Tr('Kiliseye Bağış Yap'), right: '$5.00', fn: () => { if (G.spend(5)) { G.addHonor(3); this.feed(Tr('Rahip sana teşekkür etti.')); } } }); break;
      case 'pray': it.push({ icon: '✝', label: Tr('Dua Et'), fn: () => { const k = 'pray'; if (G.dailyTalk[k]) { this.feed(Tr('Bugün zaten dua ettin.')); return; } G.dailyTalk[k] = 1; P.energy = Math.min(100, P.energy + 8); P.deCore = Math.min(100, P.deCore + 20); G.addHonor(0.5); this.feed(Tr('İçin huzurla doldu.')); G.advanceClock(20); } }); break;
      case 'property': it.push({ icon: '📜', label: Tr('Satılık Mülkler'), fn: () => this.openLand() }); break;
      case 'barber': it.push({ icon: '💈', label: Tr('Tıraş Ol / Saç Kestir'), right: '$1.50', fn: () => this.openBarber() }); break;
      case 'work': it.push({ icon: '⚒', label: JOBS[d.work].n, fn: () => this.openWork(d.work, b.name) }); break;
    }
    return it;
  },
  openShop(shopId, title) {
    const S = SHOPS[shopId], P = G.player;
    const regional = 1;
    this.menu({
      title: title || S.n, cls: 'shop', tabs: [Tr('Satın Al'), Tr('Sat')], side: (it) => it.sideHtml || '',
      sub: () => Tr`Cüzdan: <b>${fmtMoney(P.money)}</b>`, okLabel: Tr('Al / Sat'),
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
              items.push({ icon: Icons.glyph('ammo', '#d9c8a4'), label: `${A.n} (x${A.box})`, right: `${fmtMoney(pr)} <small>[${P.ammo[a]}]</small>`, disabled: P.ammo[a] >= A.max, why: Tr('Taşıyabileceğin en fazla mühimmat bu.'), sideHtml: `<div class="ps-t">${A.n}</div><div class="ps-d">${Tr`Kutu başına ${A.box} adet. Taşıma sınırı: ${A.max}`}</div>`, fn: () => { if (G.spend(pr)) { P.ammo[a] = Math.min(A.max, P.ammo[a] + A.box); Audio_.ui('cash'); } } });
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
              items.push({ icon: Icons.item(id), label: it.n, right: `${fmtMoney(pr)} <small>[${P.count(id)}]</small>`, disabled: full, why: Tr('Daha fazla taşıyamazsın.'), sideHtml: this.itemSide(it), fn: () => { if (G.spend(pr)) { P.addItem(id, 1, true); if (id === 'treasure_map') G.makeTreasure(); if (it.autoUse) G.consume(id); Audio_.ui('cash'); } } });
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
              items.push({ icon: '💰', label: Tr('Tüm Av Ürünlerini Sat'), right: fmtMoney(tA), fn: () => { for (const id of ids) if (ITEMS[id].c === 'animal') { const n = P.count(id); P.removeItem(id, n); } G.earn(tA, Tr('Satış')); } });
            }
            void tot;
          }
          for (const id of ids) {
            const it = ITEMS[id], pr = G.sellPrice(id, shopId);
            const worn = P.coat === id || (P.masked && P.mask === id);
            items.push({ icon: Icons.item(id), label: it.n, right: `${fmtMoney(pr)} <small>[${P.count(id)}]</small>`, sideHtml: this.itemSide(it), disabled: worn, why: Tr('Üzerindeki giysiyi satamazsın.'), fn: () => { P.removeItem(id, 1); G.earn(pr, ''); G.skillXp('trade', 1 + pr * 0.1); } });
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
      const v = rnd(25, 70) * (G.hasPerk('devil') ? 2 : 1) * (closed ? 0.7 : 1);
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
      const v = rnd(250, 700) * (G.hasPerk('devil') ? 1.5 : 1);
      this.closeAll();
      G.earn(v, Tr('Banka soygunu'));
      G.crime('bankrob', G.player.x, G.player.y);
      Audio_.boom(0.6);
    });
  },
  readNews() {
    if (!G.spend(0.1)) return;
    const [h, t] = pick(HEADLINES);
    const unk = G.world.pois.filter(p => p.kind === 'landmark' && !G.discovered.has(p.id) && !G.rumored.has(p.id));
    let extra = '';
    if (unk.length && chance(0.5)) { const p = pick(unk); G.rumored.add(p.id); extra = `<p class="dim">${Tr`Gazetenin arka sayfasında <b>${p.n}</b> hakkında bir okur mektubu var. Haritanda işaretlendi.`}</p>`; }
    this.info('The Frontier Gazette', `<div class="news"><div class="nw-h">${h}</div><p>${t}</p></div>${extra}`);
  },
  openDuel(e) {
    const P = G.player;
    if (!P.weapons.has('cattleman') && !P.weapons.has('schofield')) { e.say(Tr('Tabancan bile yok. Git başımdan!')); return; }
    const bet = Math.round(e.money + 10);
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
    if (!G.spend(0.5)) return;
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
      title: Tr('Tapu Dairesi'), sub: Tr('Satılık mülkler'), cls: 'shop', side: (it) => it.sideHtml || '',
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
      title: Tr('At Satın Al'), cls: 'shop', side: (it) => it.sideHtml || '', sub: () => Tr`Cüzdan: ${fmtMoney(P.money)}`,
      build: () => Object.keys(HORSE_BREEDS).filter(k => HORSE_BREEDS[k].p > 0).map(k => {
        const B = HORSE_BREEDS[k], pr = B.p * G.priceMul(true);
        const bar = (v, mx) => `<div class="statbar"><i style="width:${v / mx * 100}%"></i></div>`;
        return {
          icon: '🐴', label: B.n, right: fmtMoney(pr),
          sideHtml: `<div class="ps-t">${B.n}</div><div class="ps-d">${Tr`Hız${bar(B.spd, 1.3)}Dayanıklılık${bar(B.sta, 170)}Sağlık${bar(B.hp, 190)}`}</div>`,
          fn: () => { if (G.spend(pr)) { const h = new Horse(b.door.x + 20, b.door.y + 20, k, { owner: 'player' }); h.ang = Math.PI / 2; G.setHorse(h); this.toast(Tr('Yeni At'), Tr`${h.name} (${B.n}) artık senin.`, 'horse'); Audio_.neigh(); } },
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
      title: Tr('Banka'), sub: () => Tr`Hesap: <b>${fmtMoney(G.bank)}</b> • Cüzdan: <b>${fmtMoney(P.money)}</b><br><small>Bankadaki para ölünce kaybolmaz ve yıllık %2 faiz kazanır.</small>`, cls: 'small',
      build: () => {
        const it = [];
        for (const v of [10, 50, 100]) it.push({ label: Tr`${fmtMoney(v)} Yatır`, disabled: P.money < v, fn: () => { P.money -= v; G.bank += v; } });
        it.push({ label: Tr('Tümünü Yatır'), disabled: P.money < 0.01, fn: () => { G.bank += P.money; P.money = 0; } });
        for (const v of [10, 50, 100]) it.push({ label: Tr`${fmtMoney(v)} Çek`, disabled: G.bank < v, fn: () => { G.bank -= v; P.money += v; } });
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
      title: Tr('Tren Bileti'), sub: Tr`${here.n} İstasyonu`, cls: 'small',
      build: () => stations.map(t => {
        const d = dist(here.cx, here.cy, t.cx, t.cy);
        const pr = Math.max(1, d / 1400) * (G.hasPerk('towns') ? 0.5 : 1);
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
          }, Tr`${t.n} yolunda...`);
        } };
      }),
    });
  },
  openBarber() {
    const P = G.player, L = P.look;
    this.menu({
      title: Tr('Berber'), cls: 'small', sub: Tr('Her işlem $1.50'),
      build: () => {
        const it = [{ header: Tr('Saç') }];
        LOOKS.hairStyle.forEach((n, i) => it.push({ label: n + (L.hairStyle === i ? ' ✔' : ''), fn: () => { if (G.spend(1.5)) { L.hairStyle = i; P._lk = null; P.clean = Math.min(100, P.clean + 10); } } }));
        if (L.sex === 'm') {
          it.push({ header: Tr('Sakal') });
          LOOKS.beard.forEach((n, i) => it.push({ label: n + (L.beard === i ? ' ✔' : ''), fn: () => { if (G.spend(1.5)) { L.beard = i; L.beardLen = 0.2; P._lk = null; } } }));
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
        G.bounties.push({ id: 'b' + G.day + k, name: pick(NAMES[sex]) + ' "' + pick([Tr('Kara'), Tr('Deli'), Tr('Sessiz'), Tr('Kör'), Tr('Kızıl'), Tr('Tilki'), Tr('Çakal'), Tr('Topal')]) + '" ' + pick(NAMES.last), crime: pick(crimes), reward: rndi(4, 16) * 10, x: p.x + rnd(-60, 60), y: p.y + rnd(-60, 60), where: p.n, hench: rndi(1, 3) });
      }
    }
    this.menu({
      title: Tr('Ödül İlanları'), cls: 'shop board', side: (it) => it.sideHtml || '',
      build: () => {
        const it = [];
        const A = G.activeBounty;
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
    const st = { bet: 1, phase: 'bet', deck: [], ph: [], dh: [], msg: '' };
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
        const bets = [1, 5, 10, 25];
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
  openArmWrestle() {
    const P = G.player;
    if (P.money < 5) { this.feed(Tr('Bahis için $5 gerekli.'), 'warn'); return; }
    if ((G.dailyTalk.arm || 0) >= 3) { this.feed(Tr('Bugün kimse seninle bilek güreşi yapmak istemiyor. Yarın gel.'), 'warn'); return; }
    G.dailyTalk.arm = (G.dailyTalk.arm || 0) + 1;
    P.money -= 5;
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
      if (st.pos <= 0.05) { st.done = true; st.msg = Tr('KAZANDIN! +$10'); P.money += 10; G.stat('armWins', 1); G.skillXp('strength', 10); Audio_.ui('cash'); }
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
    el.innerHTML = `<div class="ds-inner"><div class="ds-t">${Tr`ÖLDÜN`}</div><div class="ds-c">${Tr`Ölüm sebebi: ${G.deathCause}`}</div><div class="ds-a">${Tr`${G.player.name}, ${G.age} yaşında`}</div>
      <div class="ds-items"><div class="p-item nav pref" id="ds-cont">${hard ? Tr('Hayatının Özeti') : Tr('Devam Et (Doktor)')}</div>${!hard ? `<div class="p-item nav" id="ds-legacy">${Tr`Bu Hayatı Bitir`}</div>` : ''}<div class="p-item nav" id="ds-menu">${Tr`Ana Menü`}</div></div></div>`;
    const m = this.makeModal(el, { onBack: () => {} });
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
  showLoading(on) { $('#loading').classList.toggle('hidden', !on); if (on) $('#ld-tip').textContent = pick(TIPS); },
  loading(msg, p) { $('#ld-msg').textContent = msg; $('#ld-fill').style.width = Math.round(p * 100) + '%'; },
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
    items.push(['new', Tr('Yeni Hayat'), Tr('Bir karakter yarat ve 18 yaşında başla')]);
    items.push(['set', Tr('Ayarlar'), ''], ['ctrl', Tr('Kontroller'), ''], ['about', Tr('Hakkında'), '']);
    if (Platform.canQuit) items.push(['quit', Tr('Masaüstüne Çık'), '']);
    $('#mm-items').innerHTML = items.map(([id, n, s]) => `<div class="mm-item nav" data-id="${id}"><div class="mm-n">${n}</div>${s ? `<div class="mm-s">${s}</div>` : ''}</div>`).join('');
    $('#mm-foot').innerHTML = Tr`${Input.glyph('confirm')} Seç &nbsp;&nbsp; Oyun kolu desteklenir`;
    const m = this.makeModal(mm, { keepEl: true, transparent: true, onBack: () => {} });
    $$('.mm-item', mm).forEach(n => {
      n.onmouseenter = () => m.setFocus(n, true);
      n.onclick = () => {
        Audio_.unlock();
        Audio_.ui('ok');
        const id = n.dataset.id;
        if (id === 'cont') { this.pop(m); mm.classList.add('hidden'); G.loadGame(); }
        else if (id === 'new') { if (info) this.confirm(Tr('Yeni Hayat'), Tr('Mevcut kaydın silinecek. Emin misin?'), () => { this.pop(m); this.showCreate(); }); else { this.pop(m); this.showCreate(); } }
        else if (id === 'set') this.openSettings();
        else if (id === 'ctrl') this.openControls();
        else if (id === 'quit') Platform.quit();
        else if (id === 'about') this.info("Frontier's End", `<p>${Tr`<b>Frontier's End</b>, 1890'lar Amerika'sında geçen 2D açık dünya hayatta kalma ve rol yapma oyunudur.`}</p><p>${Tr`Görev yok; sadece hayat var. 18 yaşında başla, avlan, çalış, sev, keşfet ve 80 yaşına kadar hayatta kalmaya çalış.`}</p><p class="dim">${Tr`HTML5 Canvas • Prosedürel dünya, grafik ve ses`}</p>`);
      };
    });
    this.stack.push(m);
    m.focusFirst();
    this.updatePauseState();
    Audio_.playMusic('menu');
    this.initMenuBg();
  },
  showCreate() {
    const look = randomLook(chance(0.5) ? 'm' : 'f');
    look.coatLen = 0;
    const prof = { name: pick(NAMES[look.sex]) + ' ' + pick(NAMES.last), look, bg: 'farm', difficulty: 'story', pace: 'normal' };
    const el = el_('div', 'modal create');
    const TABS = [{ n: Tr('Kimlik'), g: 'quill' }, { n: Tr('Görünüm'), g: 'barber' }, { n: Tr('Kıyafet'), g: 'scissors' }, { n: Tr('Hikâye'), g: 'book' }];
    const rows = [
      { t: 0, k: 'sex', n: Tr('Cinsiyet'), opts: ['m', 'f'], lab: v => (v === 'm' ? Tr('Erkek') : Tr('Kadın')) },
      { t: 0, k: 'skin', n: Tr('Ten Rengi'), opts: LOOKS.skin, sw: 1 },
      { t: 0, k: 'eyes', n: Tr('Göz Rengi'), opts: LOOKS.eyes, sw: 1 },
      { t: 1, k: 'hair', n: Tr('Saç Rengi'), opts: LOOKS.hair, sw: 1 },
      { t: 1, k: 'hairStyle', n: Tr('Saç Stili'), opts: [0, 1, 2, 3, 4], lab: v => LOOKS.hairStyle[v] },
      { t: 1, k: 'beard', n: Tr('Sakal'), opts: [0, 1, 2, 3, 4], lab: v => LOOKS.beard[v], male: 1 },
      { t: 2, k: 'hat', n: Tr('Şapka'), opts: LOOKS.hat, lab: v => LOOKS.hatN[v] },
      { t: 2, k: 'hatCol', n: Tr('Şapka Rengi'), opts: LOOKS.hatCol, sw: 1 },
      { t: 2, k: 'coat', n: Tr('Ceket'), opts: LOOKS.coat, sw: 1 },
      { t: 2, k: 'shirt', n: Tr('Gömlek'), opts: LOOKS.shirt, sw: 1 },
      { t: 2, k: 'pants', n: Tr('Pantolon'), opts: LOOKS.pants, sw: 1 },
      { t: 3, k: 'bg', n: Tr('Geçmiş'), opts: BACKGROUNDS.map(b => b.id), lab: v => BACKGROUNDS.find(b => b.id === v).n, prof: 1 },
      { t: 3, k: 'difficulty', n: Tr('Zorluk'), opts: DIFFICULTIES.map(b => b.id), lab: v => DIFFICULTIES.find(b => b.id === v).n, prof: 1 },
      { t: 3, k: 'pace', n: Tr('Yaşlanma Hızı'), opts: LIFE_PACES.map(b => b.id), lab: v => LIFE_PACES.find(b => b.id === v).n, prof: 1 },
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
      if (tab === 0) h += `<div class="cr-row nav" id="cr-name-row"><span class="cr-l">${Tr`İsim`}</span><span class="cr-name-w"><input id="cr-name" maxlength="28" value="${escapeHtml(prof.name)}"><span class="cr-rand" id="cr-rn" title="Rastgele isim">${Icons.glyph('dice', '#c9a45c')}</span></span></div>`;
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
        <div class="cr-tabs">${Input.glyph('tabL')}${TABS.map((t, i) => `<span class="cr-tab ${i === tab ? 'on' : ''}" data-t="${i}">${Icons.glyph(t.g, i === tab ? '#fff' : '#a89c88')}${t.n}</span>`).join('')}${Input.glyph('tabR')}</div>
      </div>
      <div class="cr-left"><div class="cr-sec">${TABS[tab].n}</div><div class="cr-list">${rowsHtml()}</div></div>
      <div class="cr-stage">
        <div class="cr-frame"><canvas id="cr-portrait" width="300" height="360"></canvas><i class="cr-c tl"></i><i class="cr-c tr"></i><i class="cr-c bl"></i><i class="cr-c br"></i></div>
        <div class="cr-plate"><div class="cr-pn" id="cr-pn"></div><div class="cr-ps" id="cr-ps"></div></div>
        <div class="cr-ped"><canvas id="cr-top" width="96" height="96"></canvas></div>
      </div>
      <div class="cr-right" id="cr-desc"></div>
      <div class="cr-foot"><div class="cr-keys">${Tr`${Input.glyph('up')}${Input.glyph('down')} Seç &nbsp; ◀ ▶ Değiştir &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Bölüm &nbsp; ${Input.glyph('back')} Geri`}</div>
        <div class="cr-btns"><div class="p-item nav" id="cr-rand">${Tr`${Icons.glyph('dice', '#e8dcc6')} Rastgele`}</div><div class="p-item nav pref" id="cr-go">${Tr`Hayata Başla ${Input.glyph('confirm')}`}</div></div></div>`;
    let m;
    const refresh = () => {
      Spr.portrait($('#cr-portrait', el).getContext('2d'), 300, 360, look, 18);
      const BG = BACKGROUNDS.find(b => b.id === prof.bg), D = DIFFICULTIES.find(d => d.id === prof.difficulty), L = LIFE_PACES.find(p => p.id === prof.pace);
      const town = TOWNS.find(t => t.id === BG.town);
      $('#cr-pn', el).textContent = prof.name || '—';
      $('#cr-ps', el).textContent = Tr`${look.sex === 'm' ? Tr('Erkek') : Tr('Kadın')} • 18 yaşında • ${BG.n}`;
      const sk = Object.keys(BG.skills).map(k => `<span class="cr-tag">${SKILLS[k].n} +${BG.skills[k]}</span>`).join('');
      const items = Object.keys(BG.items).map(id => `<span class="cr-it" title="${ITEMS[id].n}">${Icons.item(id)}</span>`).join('') + BG.weapons.filter(w => w !== 'knife').map(w => `<span class="cr-it wpn" title="${WEAPONS[w].n}">${Icons.weapon(w, 'ic wpn')}</span>`).join('');
      $('#cr-desc', el).innerHTML = `
        <div class="cr-card-big"><div class="cr-cb-h">${Icons.glyph(BGI[BG.id] || 'star', '#c9a45c')}<div><div class="cr-cb-k">${Tr`Geçmiş`}</div><div class="cr-cb-n">${BG.n}</div></div></div>
          <p>${BG.d}</p>
          <div class="cr-facts"><div><span>${Tr`Başlangıç`}</span><b>${town.n}</b></div><div><span>${Tr`Cüzdan`}</span><b>${fmtMoney(BG.money)}</b></div><div><span>${Tr`At`}</span><b>${BG.horse ? HORSE_BREEDS[BG.horse].n : Tr('Yok')}</b></div>${BG.bounty ? `<div><span>${Tr`Ödül`}</span><b class="red">$${BG.bounty}</b></div>` : ''}</div>
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
    const setTab = (t, focusRows) => { tab = (t + TABS.length) % TABS.length; build(); if (focusRows) { const f = $('.cr-list .nav', el); if (f) m.setFocus(f, true); } Audio_.ui('move'); };
    const build = () => {
      el.innerHTML = html();
      const nameIn = $('#cr-name', el);
      if (nameIn) {
        nameIn.onfocus = () => (Input.textFocus = true);
        nameIn.onblur = () => (Input.textFocus = false);
        nameIn.oninput = () => { prof.name = nameIn.value; $('#cr-pn', el).textContent = prof.name || '—'; };
        nameIn.onkeydown = (e) => { if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); nameIn.blur(); } };
        $('#cr-name-row', el).onclick = () => nameIn.focus();
        const rn = () => { prof.name = pick(NAMES[look.sex]) + ' ' + pick(NAMES.last); nameIn.value = prof.name; refresh(); };
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
          if (r.k === 'sex') { if (v === 'f') { look.beard = 0; if (look.hairStyle === 3) look.hairStyle = 1; } prof.name = pick(NAMES[v]) + ' ' + pick(NAMES.last); }
          const i = +n.dataset.i; build(); const back = $(`.opt[data-i="${i}"]`, el); if (back) m.setFocus(back, true);
        };
        n._lr = (d) => { const i = r.opts.indexOf(get(r)); setV(r.opts[(i + d + r.opts.length) % r.opts.length]); };
        n.onclick = (e) => { if (e.target.classList.contains('chip')) { setV(r.opts[+e.target.dataset.j]); return; } n._lr(1); };
        $$('.arr', n).forEach((a, i) => (a.onclick = (e) => { e.stopPropagation(); n._lr(i ? 1 : -1); }));
        n.onmouseenter = () => m && m.setFocus(n, true);
      });
      $('#cr-rand', el).onclick = () => { const nl = randomLook(look.sex); Object.assign(look, nl, { coatLen: 0 }); prof.name = pick(NAMES[look.sex]) + ' ' + pick(NAMES.last); build(); m.setFocus($('#cr-rand', el), true); };
      $('#cr-go', el).onclick = () => {
        prof.name = (prof.name || '').trim() || pick(NAMES[look.sex]) + ' ' + pick(NAMES.last);
        look.beardLen = 0.4;
        this.pop(m);
        G.deleteSave();
        G.newGame({ name: prof.name, look, bg: prof.bg, difficulty: prof.difficulty, pace: prof.pace });
      };
      refresh(); drawTop();
    };
    m = this.makeModal(el, { onBack: () => { this.pop(m); this.showMainMenu(); }, onTab: (d) => setTab(tab + d, true) });
    build();
    m.update = () => { if (this.frame % 2 === 0) drawTop(); };
    this.push(m);
    const go = $('#cr-go', el); m.setFocus(go, true);
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
  menuBg(dt) {
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
const I_WHEEL_HINT = (page) => {
  const pad = Input.device === 'pad';
  const sw = pad ? Input.padGlyph(PS.R1) : `${Input.kbGlyph('KeyQ')}${Input.kbGlyph('KeyE')}`;
  const cyc = pad ? `${Input.padGlyph(PS.LEFT)}${Input.padGlyph(PS.RIGHT)}` : Tr('Tekerlek');
  const sel = pad ? Tr('Sağ analog') : Tr('Fare');
  return page ? Tr`${sel}: seç • ${cyc}: aynı türde değiştir • ${pad ? Input.padGlyph(PS.X) : Input.kbGlyph('Mouse0')} kullan • ${sw} Silahlar` : Tr`${sel}: seç • ${cyc}: aynı türde değiştir • ${Input.glyph('wheel')} bırak: kuşan • ${sw} Eşyalar`;
};
const RADAR_B = new Set(['general', 'saloon', 'sheriff', 'doctor', 'gunsmith', 'butcher', 'stable', 'hotel', 'station', 'bank', 'mine', 'lumber', 'docks', 'ranch', 'cabin', 'hermit', 'property', 'fence']);
const BICON = { general: 'store', saloon: 'glass', sheriff: 'star', doctor: 'cross', gunsmith: 'gun', butcher: 'cleaver', stable: 'horseshoe', hotel: 'bed', bank: 'bank', station: 'train', church: 'church', land: 'scroll', barber: 'barber', tailor: 'scissors', fence: 'bag', mine: 'pick', lumber: 'axe', docks: 'anchor', ranch: 'wheat', cabin: 'fox', hermit: 'hut', property: 'house' };
const PICON = { camp: 'tent', farm: 'wheat', property: 'house', crater: 'crater', sequoia: 'tree', ruins: 'ruins', ghost: 'ghost', mine: 'mine', hotspring: 'spring', dino: 'bones', hanging: 'gallows', wreck: 'wheel', lighthouse: 'lighthouse', hermit: 'hut', trapper: 'fox', battlefield: 'swords', fortruin: 'fort', windmill: 'windmill', oasis: 'palm', lookout: 'eye', cave: 'paw', graveyard: 'grave', shipwreck: 'anchor', arch: 'arch' };
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
