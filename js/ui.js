'use strict';
/* ==========================================================
   DUSTBOUND — arayüz: HUD, menüler, harita, çanta, günlük,
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
        h += `<div class="p-item nav ${it.disabled ? 'dis' : ''} ${it.cls || ''}" data-i="${i}">${it.icon ? `<span class="pi-ic">${it.icon}</span>` : ''}<span class="pi-l">${it.label}</span>${it.right !== undefined ? `<span class="pi-r">${it.right}</span>` : ''}</div>`;
      });
      if (!items.some(it => !it.header && !it.html)) h += `<div class="p-empty">${spec.empty || 'Burada bir şey yok.'}</div>`;
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
    let s = `${Input.glyph('confirm')} ${spec.okLabel || 'Seç'} &nbsp; ${Input.glyph('back')} Geri`;
    if (spec.altLabel) s += ` &nbsp; ${Input.glyph('alt')} ${spec.altLabel}`;
    if (spec.tabs) s += ` &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Sekme`;
    return s;
  },
  confirm(title, text, yes, noLabel = 'Vazgeç', yesLabel = 'Evet') {
    return this.menu({ title, sub: text, cls: 'small', items: [{ label: yesLabel, fn: () => { this.pop(); yes(); } }, { label: noLabel, fn: () => this.pop() }] });
  },
  info(title, html, btn = 'Tamam') {
    return this.menu({ title, cls: 'small', items: [{ html }, { label: btn, fn: () => this.pop() }] });
  },

  /* ================= GERİ BİLDİRİM ================= */
  feedItems: [],
  feed(text, kind) {
    const e = el_('div', 'feed-item ' + (kind || ''), text);
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
    const e = el_('div', 'toast ' + (kind || ''), `<div class="t-k">${{ ach: 'BAŞARIM', skill: 'YETENEK', year: 'YAŞ', family: 'AİLE', bounty: 'ÖDÜL', horse: 'AT', ok: '' }[kind] || ''}</div><div class="t-t">${title}</div><div class="t-s">${sub || ''}</div>`);
    this.el.toasts.appendChild(e);
    setTimeout(() => e.classList.add('out'), 5200);
    setTimeout(() => e.remove(), 6000);
  },
  help(html, dur = 6) {
    const h = this.el.help;
    h.innerHTML = html; h.classList.remove('hidden');
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
    this.toast(reason ? reason.toUpperCase() : 'SUÇ', bounty ? `Başına +${fmtMoney(bounty)} ödül kondu` : 'Kanun peşinde!', 'wanted');
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
    this.setText('hud-age', `${P.name} • ${G.age} yaşında`);
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
    const wk = L.level + '|' + Math.round(L.bounty);
    if (wz._k !== wk) {
      wz._k = wk;
      wz.classList.toggle('hidden', L.level <= 0);
      $('.wanted-stars', wz).innerHTML = '★'.repeat(L.level) + '<span>' + '★'.repeat(5 - L.level) + '</span>';
      $('.wanted-bounty', wz).textContent = 'Ödül: ' + fmtMoney(L.bounty);
      const hb = $('#hud-bounty');
      hb.classList.toggle('hidden', L.level > 0 || L.bounty <= 0);
      hb.textContent = 'Başındaki ödül: ' + fmtMoney(L.bounty);
    }
    // at
    const h = G.horse;
    const hc = this.cache.hc || (this.cache.hc = $('#horse-cores'));
    const showH = h && !h.dead && (P.riding === h || dist(P.x, P.y, h.x, h.y) < 120);
    hc.classList.toggle('hidden', !showH);
    if (showH) { this.setCore('core-hhp', h.hp / h.maxHp, h.bondLv / 4); this.setCore('core-hsta', h.sta / h.maxSta, 1); }
    // durum simgeleri
    const st = [];
    if (P.sick > 0) st.push('<span title="Hasta">🤢</span>');
    if (P.poison > 0) st.push('<span title="Zehirlendin" class="blink">☠️</span>');
    if (P.drunk > 30) st.push('<span title="Sarhoş">🍺</span>');
    if (G.coldness > 0) st.push('<span title="Üşüyorsun" class="blink">❄️</span>');
    if (G.hotness > 0) st.push('<span title="Sıcak" class="blink">☀️</span>');
    if (P.warmBuff > 0) st.push('<span title="Isınmış">♨️</span>');
    if (G.nearFire) st.push('<span title="Ateş başında">🔥</span>');
    if (P.clean < 20) st.push('<span title="Kirlisin">🪰</span>');
    if (P.crouch) st.push('<span title="Gizlilik">👣</span>');
    this.setText('status-icons', st.join(''));
    // silah
    const W = P.W;
    let ammo = '';
    if (W.clip) ammo = `${P.clip[P.weapon] || 0}<small>/${P.ammo[W.ammo]}</small>`;
    else if (W.throw) ammo = `${P.count('dynamite')}`;
    else if (P.weapon === 'bow') ammo = `${P.ammo.arrow}`;
    this.setText('w-icon', W.i); this.setText('w-name', W.n + (P.reloadT > 0 ? ' <em>dolduruluyor…</em>' : '')); this.setText('w-ammo', ammo);
    // efektler
    document.body.classList.toggle('deadeye', !!P.deadeye);
    document.body.classList.toggle('lowhp', P.hp < P.maxHp * 0.25 && G.state === 'play');
    document.body.classList.toggle('drunk', P.drunk > 45);
    const hurt = $('#fx-hurt');
    const fv = Math.min(1, G.fx.flash * 1.4 + (P.hp < P.maxHp * 0.25 ? 0.25 + Math.sin(G.t * 5) * 0.1 : 0));
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
          if (this.holdT >= a0.hold) { this.holdTarget = null; this.curInteract = null; this._scanT = 0; if (!a0.check || a0.check()) a0.fn(); else this.feed('Önce çömelerek (L3 / C) sakince yaklaş.', 'warn'); }
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
      lines.push(`<div class="prompt ${holdPct > 0 ? 'holding' : ''}" style="--p:${holdPct.toFixed(2)}">${I.glyph('interact')}<span>${a0.n}${a0.hold ? ' <em>(basılı tut)</em>' : ''}</span></div>`);
      if (hasMenu) lines.push(`<div class="prompt dim">${I.glyph('interact')}<span>Seçenekler <em>(basılı tut)</em></span></div>`);
    }
    if (P.aiming && P.isArmed && !P.deadeye && P.de > 12) lines.push(`<div class="prompt dim">${I.glyph('deadeye')}<span>Dead Eye</span></div>`);
    if (P.riding) lines.push(`<div class="prompt dim">${I.glyph('sprint')}<span>Dörtnala</span></div>`);
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
    const icon = (wx, wy, ch, col, bg) => {
      let [x, y] = toR(wx, wy);
      const dx = x - R, dy = y - R, d = Math.hypot(dx, dy);
      if (d > R - 10) { if (!bg) return; x = R + dx / d * (R - 10); y = R + dy / d * (R - 10); }
      if (bg) { c.fillStyle = bg; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); }
      c.fillStyle = col; c.fillText(ch, x, y + 0.5);
    };
    c.font = '10px serif';
    for (const b of W.buildings) {
      if (Math.abs(b.door.x - P.x) > 900 || Math.abs(b.door.y - P.y) > 900) continue;
      const ic = BICON[b.type];
      if (ic && RADAR_B.has(b.type) && (b.town ? G.visited.has(b.town) : true)) icon(b.door.x, b.door.y, ic, '#1a120c');
    }
    c.font = 'bold 11px serif';
    for (const p of W.pois) {
      if (!G.discovered.has(p.id) && !G.rumored.has(p.id)) continue;
      icon(p.x, p.y, PICON[p.kind === 'landmark' ? p.type : p.kind] || '•', p.kind === 'camp' ? '#8a1a14' : '#2a1a10');
    }
    if (G.camp) icon(G.camp.x, G.camp.y, '⛺', '#1a120c');
    if (G.activeBounty && !G.activeBounty.done) icon(G.activeBounty.x, G.activeBounty.y, '☠', '#fff', 'rgba(150,20,20,0.9)');
    if (G.waypoint) icon(G.waypoint.x, G.waypoint.y, '✦', '#fff', 'rgba(140,40,140,0.9)');
    // canlılar
    for (const e of G.ents) {
      if (e.dead) continue;
      const [x, y] = toR(e.x, e.y);
      if (Math.hypot(x - R, y - R) > R - 4) continue;
      if (e.kind === 'npc') {
        if (e.hostile && (e.aggro || e.isLaw)) { c.fillStyle = e.isLaw ? '#e0e0ff' : '#e02020'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); c.strokeStyle = e.isLaw ? '#2040c0' : '#400'; c.lineWidth = 1; c.stroke(); }
        else if (e.role === 'romance' || e.role === 'spouse') { c.fillStyle = '#e06090'; c.fillText('♥', x, y); }
        else if (e.role === 'stranger') { c.fillStyle = '#f0f0f0'; c.fillText('?', x, y); }
        else { c.fillStyle = 'rgba(40,30,20,0.55)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); }
      } else if (e.kind === 'animal' && e.state === 'attack') { c.fillStyle = '#e02020'; c.fillRect(x - 2, y - 2, 4, 4); }
      else if (e.kind === 'animal' && P.crouch) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x - 1.5, y - 1.5, 3, 3); }
      else if (e === G.horse) { icon(e.x, e.y, '🐴', '#fff'); }
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
    const m = this.makeModal(scr, { customInput: true, keepEl: true, noFocus: true, onClose: () => scr.classList.add('hidden') });
    m.update = (dt) => this.mapUpdate(dt, m);
    this.stack.push(m);
    this.updatePauseState();
    this.mapResize();
    this.mapDirty = true;
    $('#map-legend').innerHTML = `<div class="ml-t">Açıklamalar</div>` + [['🏪', 'Mağaza'], ['🍺', 'Saloon'], ['⭐', 'Şerif'], ['✚', 'Doktor'], ['🔫', 'Silahçı'], ['🐴', 'Ahır'], ['🛏', 'Otel'], ['🚂', 'İstasyon'], ['🏦', 'Banka'], ['🏠', 'Mülk'], ['⛏', 'İş'], ['⛺', 'Haydut Kampı'], ['❖', 'Önemli Yer'], ['?', 'Söylenti'], ['✦', 'Hedef']].map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join('');
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
    this.feed('📍 Hedef işaretlendi');
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
    if (I.pressed('alt')) { G.setWaypoint(null); this.mapDirty = true; this.feed('Hedef kaldırıldı'); }
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
    for (const t of G.world.towns) if (G.visited.has(t.id) || G.reveal[((t.cy / TS / 4) | 0) * 256 + ((t.cx / TS / 4) | 0)]) { const d = dist2(t.cx, t.cy, wx, wy); if (d < bd * 4) { bd = d / 4; best = { n: t.n, desc: t.desc + (G.visited.has(t.id) ? '' : ' (Henüz ziyaret edilmedi)') }; } }
    let html = '';
    if (best) html = `<div class="mi-n">${best.n}</div><div class="mi-d">${best.desc || ''}${G.rumored.has(best.id) && !G.discovered.has(best.id) ? ' <i>(söylenti)</i>' : ''}</div>`;
    else html = `<div class="mi-n">${G.world.regionAt(wx, wy)}</div>`;
    if (this._mh !== html) { this._mh = html; $('#map-info').innerHTML = html; }
    const hint = `${Input.device === 'pad' ? Input.glyph('confirm') + ' Hedef Koy &nbsp; ' + Input.glyph('alt') + ' Hedefi Kaldır &nbsp; R2/L2 Yakınlaştır &nbsp; ' + Input.glyph('alt2') + ' Konumum' : 'Sol Tık: Hedef Koy &nbsp; Sağ Tık / X: Kaldır &nbsp; Tekerlek: Yakınlaştır &nbsp; Sürükle: Kaydır'} &nbsp; ${Input.glyph('back')} Kapat`;
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
        c.font = '12px serif';
        for (const b of t.buildings) { const ic = BICON[b.type]; if (!ic) continue; const [bx, by] = toS(b.door.x, b.door.y); c.fillStyle = 'rgba(232,220,192,0.85)'; c.beginPath(); c.arc(bx, by, 8, 0, TAU); c.fill(); c.fillStyle = '#1a120c'; c.fillText(ic, bx, by + 1); }
      }
    }
    // yerler
    c.font = '13px serif';
    for (const p of W.pois) {
      const known = G.discovered.has(p.id), rum = G.rumored.has(p.id);
      let show = known || rum;
      if (!show && G.hasPerk('explore20') && dist(p.x, p.y, G.player.x, G.player.y) < 2500) { const [x, y] = toS(p.x, p.y); c.fillStyle = 'rgba(40,20,10,0.5)'; c.fillText('?', x, y); continue; }
      if (!show) continue;
      const [x, y] = toS(p.x, p.y);
      c.fillStyle = p.kind === 'camp' ? 'rgba(150,20,20,0.85)' : 'rgba(40,24,12,0.85)';
      c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
      c.fillStyle = '#f0e4c8'; c.fillText(rum && !known ? '?' : (PICON[p.kind === 'landmark' ? p.type : p.kind] || '❖'), x, y + 1);
      if (M.zoom > 2.2 && known) { c.font = 'italic 12px "IM Fell English", serif'; c.fillStyle = '#2a1a0e'; c.fillText(p.n, x, y + 17); c.font = '13px serif'; }
      if (p.kind === 'property' && G.props.includes(p.prop)) { c.strokeStyle = '#e8c860'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.stroke(); }
    }
    // demiryolu istasyonları
    // hazine
    if (G.treasure && G.player.has('treasure_map')) { const [x, y] = toS(G.treasure.x + G.treasure.ox || G.treasure.x, G.treasure.y); c.strokeStyle = 'rgba(140,20,10,0.6)'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, 180 / TS * M.zoom * 4, 0, TAU); c.stroke(); c.setLineDash([]); }
    if (G.activeBounty && !G.activeBounty.done) { const [x, y] = toS(G.activeBounty.x, G.activeBounty.y); c.fillStyle = 'rgba(150,20,20,0.9)'; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillText('☠', x, y + 1); }
    if (G.camp) { const [x, y] = toS(G.camp.x, G.camp.y); c.fillText('⛺', x, y); }
    if (G.horse && !G.horse.dead) { const [x, y] = toS(G.horse.x, G.horse.y); c.font = '16px serif'; c.fillText('🐴', x, y); }
    if (G.waypoint) { const [x, y] = toS(G.waypoint.x, G.waypoint.y); c.fillStyle = 'rgba(140,40,140,0.95)'; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillText('✦', x, y + 1); }
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

  /* ================= SİLAH ÇARKI ================= */
  openWheel() {
    const w = $('#wheel');
    w.classList.remove('hidden');
    const ring = $('#wheel-ring');
    const P = G.player;
    ring.innerHTML = WHEEL_SLOTS.map((s, i) => {
      const a = (i / WHEEL_SLOTS.length) * TAU - Math.PI / 2;
      const owned = s.w.find(id => P.weapons.has(id) || (id === 'dynamite' && P.has('dynamite')));
      const W = owned ? WEAPONS[owned] : null;
      return `<div class="wslot ${owned ? '' : 'empty'}" data-i="${i}" style="left:${50 + Math.cos(a) * 36}%;top:${50 + Math.sin(a) * 36}%"><div class="ws-i">${W ? W.i : '—'}</div><div class="ws-n">${W ? W.n : s.n}</div></div>`;
    }).join('');
    this.wheelSel = WHEEL_SLOTS.findIndex(s => s.w.includes(P.weapon));
    Audio_.tone(500, 0.1, 'sine', 0.05);
  },
  updateWheel() {
    const I = Input, P = G.player;
    let ang = null;
    if (I.device === 'pad') { const a = I.aimVec(); if (a.m > 0.5) ang = Math.atan2(a.y, a.x); const m = I.moveVec(); if (ang === null && m.m > 0.6 && !m.kb) ang = Math.atan2(m.y, m.x); }
    else { const dx = I.mouse.x - innerWidth / 2, dy = I.mouse.y - innerHeight / 2; if (Math.hypot(dx, dy) > 40) ang = Math.atan2(dy, dx); }
    if (ang !== null) {
      let i = Math.round(((ang + Math.PI / 2) / TAU) * WHEEL_SLOTS.length);
      i = ((i % WHEEL_SLOTS.length) + WHEEL_SLOTS.length) % WHEEL_SLOTS.length;
      if (i !== this.wheelSel) { this.wheelSel = i; Audio_.ui('move'); }
    }
    $$('.wslot').forEach((n, i) => n.classList.toggle('sel', i === this.wheelSel));
    const s = WHEEL_SLOTS[this.wheelSel];
    const owned = s && s.w.find(id => P.weapons.has(id) || (id === 'dynamite' && P.has('dynamite')));
    const W = owned ? WEAPONS[owned] : null;
    $('#wheel-name').textContent = W ? W.n : (s ? s.n : '');
    $('#wheel-ammo').innerHTML = W ? (W.clip ? `${P.clip[owned] || 0} / ${P.ammo[W.ammo]}` : W.throw ? `x${P.count('dynamite')}` : '') : '<i>Sahip değilsin</i>';
  },
  closeWheel() {
    $('#wheel').classList.add('hidden');
    const P = G.player, s = WHEEL_SLOTS[this.wheelSel];
    if (!s) return;
    const owned = s.w.find(id => P.weapons.has(id) || (id === 'dynamite' && P.has('dynamite')));
    if (owned && owned !== P.weapon) { P.weapon = owned; P.reloadT = 0; P.draw_ = 0; Audio_.tone(700, 0.05, 'square', 0.05); if (owned === 'dynamite') P.weapons.add('dynamite'); }
  },

  /* ================= ÇANTA ================= */
  openSatchel() {
    const P = G.player;
    const tabs = ['Yiyecek', 'İlaç & Bitki', 'Av & Değerli', 'Alet & Giysi', 'Silahlar'];
    const cats = [['food'], ['med', 'herb'], ['animal', 'valuable', 'collect'], ['tool', 'horse', 'doc', 'clothing', 'ammo'], []];
    const m = this.menu({
      title: 'Çanta', cls: 'satchel', tabs, side: (it) => it.sideHtml || '', altLabel: 'Bir Tane At', okLabel: 'Kullan',
      sub: () => `${fmtMoney(P.money)} • Matara: ${P.canteen}/5 • ${G.age} yaş`,
      build: (m) => {
        const items = [];
        if (m.tab === 0 && P.has('canteen')) items.push({ icon: '🫗', label: 'Matara', right: `${P.canteen}/5`, fn: () => G.drinkCanteen(), sideHtml: this.itemSide(ITEMS.canteen, `Susuzluk +32`) });
        if (m.tab === 4) {
          for (const w of P.weapons) {
            const W = WEAPONS[w];
            if (w === 'dynamite') continue;
            items.push({ icon: W.i, label: W.n + (P.weapon === w ? ' <em>(elinde)</em>' : ''), right: W.clip ? `${P.clip[w] || 0} / ${P.ammo[W.ammo]}` : '', fn: () => { P.weapon = w; this.feed(`${W.n} kuşanıldı`); }, sideHtml: `<div class="ps-t">${W.i} ${W.n}</div><div class="ps-d">${W.melee ? 'Yakın dövüş' : 'Hasar ' + W.dmg + (W.pellets ? 'x' + W.pellets : '') + ' • Menzil ' + W.range + ' • Şarjör ' + (W.clip || '-')}</div>` });
          }
          items.push({ header: 'Mühimmat' });
          for (const a in AMMO) items.push({ icon: '•', label: AMMO[a].n, right: `${P.ammo[a]} / ${AMMO[a].max}`, disabled: true });
          return items;
        }
        const ids = Object.keys(P.inv).filter(id => cats[m.tab].includes(ITEMS[id].c) && id !== 'canteen').sort((a, b) => ITEMS[a].n.localeCompare(ITEMS[b].n, 'tr'));
        for (const id of ids) {
          const it = ITEMS[id];
          const worn = (P.coat === id) || (it.hat && P.look.hat === it.hat);
          items.push({ id, icon: it.i, label: it.n + (worn ? ' <em>(giyili)</em>' : ''), right: 'x' + P.inv[id], fn: () => { G.consume(id); }, sideHtml: this.itemSide(it) });
        }
        return items;
      },
      onAlt: (it) => { if (!it || !it.id) return; this.confirm('Eşyayı At', `Bir adet ${ITEMS[it.id].n} atılsın mı?`, () => { P.removeItem(it.id, 1); if (P.coat === it.id && !P.has(it.id)) P.coat = null; }); },
      empty: 'Bu bölmede eşyan yok.',
    });
    return m;
  },
  itemSide(it, extra) {
    const e = it.e || {};
    const eff = [];
    const map = { hunger: 'Açlık', thirst: 'Susuzluk', health: 'Sağlık', stamina: 'Dayanıklılık', energy: 'Uyku', deadeye: 'Dead Eye', drunk: 'Sarhoşluk', warmth: 'Isınma' };
    for (const k in map) if (e[k]) eff.push(`${map[k]} ${e[k] > 0 ? '+' : ''}${e[k]}`);
    if (e.cure) eff.push('Hastalığı iyileştirir');
    if (e.poison) eff.push('Zehri yok eder');
    if (it.raw) eff.push('<span class="bad">Çiğ: hastalık riski</span>');
    if (it.coat) eff.push(`Sıcaklık ${it.coat.warm > 0 ? '+' : ''}${it.coat.warm}°C`);
    return `<div class="ps-t">${it.i} ${it.n}</div><div class="ps-d">${it.d || ''}</div>${eff.length || extra ? `<div class="ps-e">${extra || eff.join('<br>')}</div>` : ''}<div class="ps-p">Değeri: ${fmtMoney(it.p)}</div>`;
  },

  /* ================= GÜNLÜK ================= */
  openJournal(tab = 0) {
    const tabs = ['Karakter', 'Yetenekler', 'Başarımlar', 'İstatistikler', 'İlişkiler', 'Rehber'];
    const el = el_('div', 'modal panel journal');
    const m = this.makeModal(el, { scroll: true, noFocus: true, onTab: (d) => { m.tab = (m.tab + d + tabs.length) % tabs.length; render(); Audio_.ui('move'); } });
    m.tab = tab;
    const render = () => {
      el.innerHTML = `<div class="p-head"><div class="p-title">Günlük</div></div><div class="p-tabs">${Input.glyph('tabL')}${tabs.map((t, i) => `<span class="tab ${i === m.tab ? 'on' : ''}" data-tab="${i}">${t}</span>`).join('')}${Input.glyph('tabR')}</div><div class="p-body"><div class="scroll jr">${this.journalTab(m.tab)}</div></div><div class="p-foot">${Input.glyph('back')} Kapat &nbsp; ${Input.glyph('tabL')}${Input.glyph('tabR')} Sekme</div>`;
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
      const honorTxt = G.honor > 60 ? 'Saygın' : G.honor > 20 ? 'Dürüst' : G.honor > -20 ? 'Nötr' : G.honor > -60 ? 'Şüpheli' : 'Kötü Şöhretli';
      const born = START_YEAR - START_AGE;
      return `<div class="jr-char"><canvas id="jr-portrait" width="220" height="264"></canvas><div class="jr-info">
        <h2>${escapeHtml(P.name)}</h2>
        <div class="jr-row"><b>Doğum:</b> ${born} &nbsp; <b>Yaş:</b> ${G.age} &nbsp; <b>Yıl:</b> ${G.year}</div>
        <div class="jr-row"><b>Geçmiş:</b> ${BG ? BG.n : ''}</div>
        <div class="jr-row"><b>Onur:</b> ${honorTxt} (${Math.round(G.honor)})<div class="honorbar"><i style="left:${50 + G.honor / 2}%"></i></div></div>
        <div class="jr-row"><b>Nakit:</b> ${fmtMoney(P.money)} &nbsp; <b>Banka:</b> ${fmtMoney(G.bank)}</div>
        <div class="jr-row"><b>Başındaki Ödül:</b> ${fmtMoney(G.law.bounty)}</div>
        <div class="jr-row"><b>At:</b> ${G.horse ? `${G.horse.name} (${G.horse.def.n}) — Bağ ${G.horse.bondLv}/4` : 'Yok'}</div>
        <div class="jr-row"><b>Mülkler:</b> ${G.props.length ? G.props.map(id => PROPERTIES.find(p => p.id === id).n).join(', ') : 'Yok'}</div>
        <div class="jr-row"><b>Aile:</b> ${G.family.spouse ? `Eşi: ${G.family.spouse.name}` : 'Bekar'}${G.family.children.length ? ' • Çocuklar: ' + G.family.children.map(c => c.name).join(', ') : ''}</div>
        <div class="jr-row"><b>Hayat Hedefi:</b> 80 yaş — kalan ${Math.max(0, GOAL_AGE - G.age)} yıl</div>
        <div class="lifebar"><i style="width:${clamp((G.age - START_AGE) / (GOAL_AGE - START_AGE), 0, 1) * 100}%"></i></div>
        ${G.activeBounty ? `<div class="jr-row"><b>Aktif Ödül Avı:</b> ${G.activeBounty.name} — ${fmtMoney(G.activeBounty.reward)} ${G.activeBounty.done ? '(Tamamlandı, ödülü al)' : ''}</div>` : ''}
      </div></div>`;
    }
    if (t === 1) {
      return `<div class="skills">` + Object.keys(SKILLS).map(k => {
        const s = G.skills[k], need = Math.round(40 * Math.pow(s.lv, 1.5));
        return `<div class="skill"><div class="sk-n">${SKILLS[k].n} <span>Sv. ${s.lv}/10</span></div><div class="sk-d">${SKILLS[k].d}</div><div class="sk-bar"><i style="width:${s.lv >= 10 ? 100 : s.xp / need * 100}%"></i></div></div>`;
      }).join('') + `</div><p class="jr-note">Yetenekler, ilgili işleri yaptıkça gelişir: avlanmak, ateş etmek, at sürmek, ticaret yapmak, insanlarla konuşmak ve çalışmak.</p>`;
    }
    if (t === 2) {
      const n = Object.keys(G.achieved).length;
      return `<div class="ach-sum">${n} / ${ACHIEVEMENTS.length} başarım</div><div class="achs">` + ACHIEVEMENTS.map(A => {
        const got = G.achieved[A.id];
        const prog = A.s ? Math.min(A.v, Math.floor(S[A.s] || (A.s === 'age' ? G.age : 0))) : 0;
        return `<div class="ach ${got ? 'got' : ''}"><div class="a-i">${got ? '★' : '☆'}</div><div><div class="a-n">${A.n}</div><div class="a-d">${A.d}${!got && A.s ? ` <span class="a-p">(${prog}/${A.v})</span>` : ''}</div>${A.perk ? `<div class="a-perk">${A.perk}</div>` : ''}</div></div>`;
      }).join('') + '</div>';
    }
    if (t === 3) {
      const rows = [['Hayatta kalınan gün', G.day], ['Avlanan hayvan', S.animals], ['Öldürülen haydut', S.bandits], ['Toplam öldürülen insan', S.kills], ['Yürünen mesafe', S.walkMiles.toFixed(1) + ' mil'], ['At sırtında', S.rideMiles.toFixed(1) + ' mil'], ['Toplanan bitki', S.herbs], ['Tutulan balık', S.fish], ['Yenen yemek', S.eaten], ['Kazanılan toplam para', fmtMoney(S.earned)], ['Çalışılan vardiya', S.shifts], ['Yardım edilen yabancı', S.helped], ['Keşfedilen yer', G.discovered.size], ['Ziyaret edilen kasaba', G.visited.size + ' / 8'], ['Kurulan kamp', S.camps], ['Tren yolculuğu', S.trainRides], ['Bulunan altın', S.nuggets], ['Kazanılan Yirmi Bir eli', S.bjWins], ['Bilek güreşi zaferi', S.armWins]];
      return `<table class="stats">${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
    }
    if (t === 4) {
      let h = '<div class="rels">';
      for (const t of G.world.towns) {
        const R = G.romances[t.id];
        if (!R) continue;
        const married = G.family.spouse && G.family.spouse.id === R.id;
        const met = G.visited.has(t.id);
        h += `<div class="rel"><div class="r-n">${met ? R.name : '???'}</div><div class="r-t">${t.n}</div><div class="r-bar"><i style="width:${married ? 100 : R.rel}%"></i></div><div class="r-s">${married ? '❤ Eşin' : R.rel >= 80 ? 'Evlenmeye hazır' : R.rel >= 50 ? 'Yakın' : R.rel >= 20 ? 'Tanıdık' : 'Yabancı'}</div></div>`;
      }
      return h + '</div><p class="jr-note">Her kasabada tanışabileceğin biri yaşıyor (haritada ♥). Onlarla her gün sohbet et, hediye ver. Yakınlık 80\'e ulaştığında ve bir mülkün olduğunda evlenme teklif edebilirsin.</p>';
    }
    return this.guideHtml();
  },
  guideHtml() {
    return `<div class="guide">
      <h3>Hayatta Kalma</h3><p><b>Açlık</b>, <b>susuzluk</b> ve <b>uyku</b> sürekli azalır. Sıfırlanırlarsa sağlığın düşer. Sağlık çekirdeği (♥ içi) açlık ve susuzluktan beslenir. Sıcak çöllerde daha çok su içmen, karlı dağlarda ise kalın giysiler giymen gerekir. Kamp ateşleri ve sıcak yemekler seni ısıtır.</p>
      <h3>Yaşlanma</h3><p>18 yaşında başlarsın. Zaman geçtikçe yaşlanırsın; 30'lardan sonra dayanıklılığın, 50'lerden sonra sağlığın azalır. Hedefin <b>80 yaşına kadar hayatta kalmak.</b></p>
      <h3>Para Kazanma</h3><p>Avlan ve postları kasapta sat. Bitki topla. Madende, kerestecide, limanda ya da çiftliklerde <b>çalış</b>. Nehirde altın ele. Ödül ilanlarını takip et. Ya da… kanunun yanlış tarafında yaşa.</p>
      <h3>Kanun</h3><p>Görülürsen suçların başına ödül koydurur. Kanun adamlarının arama alanından (haritadaki kırmızı daire) kaç ve görünmeden bekle. Ödülünü şerif ofisinde ödeyebilirsin.</p>
      <h3>Başarımlar</h3><p>Başarımlar sana kalıcı kazanımlar (perk) sağlar. Günlüğün Başarımlar sekmesine bak.</p>
      <h3>Kontroller</h3>${this.controlsTable()}
    </div>`;
  },
  controlsTable() {
    const rows = [['Hareket', 'Sol Analog', 'W A S D'], ['Nişan / Bakış', 'Sağ Analog', 'Fare'], ['Koş / Dörtnala', '✕ (basılı)', 'Shift'], ['Etkileşim / Ata Bin / İn', '△', 'E'], ['Nişan Al', 'L2', 'Sağ Tık'], ['Ateş Et', 'R2', 'Sol Tık'], ['Şarjör Değiştir', '□', 'R'], ['Yakın Dövüş', '○', 'F'], ['Çömel / Gizlen', 'L3', 'C'], ['Dead Eye (nişan alırken)', 'R3', 'Q'], ['Silah Çarkı', 'L1 (basılı)', 'Tab (basılı)'], ['Hızlı İyileş / Ye', 'R1', 'T'], ['Atı Çağır (ıslık)', 'D-Pad ↑', 'H'], ['Fener', 'D-Pad ←', 'L'], ['Çanta', 'D-Pad →', 'I'], ['Kamp Kur', 'D-Pad ↓ (basılı)', 'B (basılı)'], ['Harita', 'Touchpad', 'M'], ['Günlük', 'Share', 'J'], ['Duraklat', 'Options', 'Esc / P']];
    return `<table class="ctrl"><tr><th>Eylem</th><th>PlayStation</th><th>Klavye / Fare</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td class="c-ps">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>`;
  },

  /* ================= DURAKLAT ================= */
  openPause() {
    Audio_.ui('ok');
    this.menu({
      title: 'Duraklatıldı', cls: 'pause', sub: () => `${G.player.name} • ${G.age} yaşında • ${G.dateStr()}`,
      items: [
        { label: 'Devam Et', fn: () => this.pop() },
        { label: 'Harita', fn: () => { this.pop(); this.openMap(); } },
        { label: 'Çanta', fn: () => { this.pop(); this.openSatchel(); } },
        { label: 'Günlük', fn: () => { this.pop(); this.openJournal(); } },
        { label: 'Oyunu Kaydet', fn: () => G.saveGame() },
        { label: 'Ayarlar', fn: () => this.openSettings() },
        { label: 'Kontroller', fn: () => this.info('Kontroller', this.controlsTable()) },
        { label: 'Ana Menüye Dön', fn: () => this.confirm('Ana Menü', 'Kaydedilmemiş ilerleme kaybolabilir. Kaydedip çıkılsın mı?', () => { G.saveGame(true); this.closeAll(); this.showMainMenu(); }, 'Vazgeç', 'Kaydet ve Çık') },
      ],
    });
  },
  openSettings() {
    const S = G.settings;
    const el = el_('div', 'modal panel settings');
    const rows = [
      ['master', 'Ana Ses', 'vol'], ['music', 'Müzik', 'vol'], ['sfx', 'Efektler', 'vol'], ['amb', 'Ortam Sesleri', 'vol'],
      ['zoom', 'Piksel Ölçeği', 'zoom'], ['shake', 'Ekran Sarsıntısı', 'bool'], ['fps', 'FPS Göster', 'bool'],
    ];
    const val = (k, t) => t === 'vol' ? Math.round(S[k] * 10) * 10 + '%' : t === 'bool' ? (S[k] ? 'Açık' : 'Kapalı') : (S[k] ? S[k] + 'x' : 'Otomatik');
    el.innerHTML = `<div class="p-head"><div class="p-title">Ayarlar</div></div><div class="p-body"><div class="p-list">${rows.map(([k, n, t]) => `<div class="p-item nav opt" data-k="${k}" data-t="${t}" data-lr><span class="pi-l">${n}</span><span class="pi-r"><b class="arr">◀</b> <span class="v">${val(k, t)}</span> <b class="arr">▶</b></span></div>`).join('')}<div class="p-item nav" id="set-back"><span class="pi-l">Kaydet ve Geri Dön</span></div></div></div><div class="p-foot">◀ ▶ Değiştir &nbsp; ${Input.glyph('back')} Geri</div>`;
    const m = this.makeModal(el, { onBack: () => { G.saveSettings(); this.pop(); } });
    $$('.opt', el).forEach(n => {
      const k = n.dataset.k, t = n.dataset.t;
      n._lr = (d) => {
        if (t === 'vol') S[k] = clamp(Math.round((S[k] + d * 0.1) * 10) / 10, 0, 1);
        else if (t === 'bool') S[k] = !S[k];
        else { const opts = [0, 1, 2, 3, 4, 5]; S[k] = opts[(opts.indexOf(S[k]) + d + opts.length) % opts.length]; }
        $('.v', n).textContent = val(k, t);
        G.applySettings();
      };
      n.onclick = () => n._lr(1);
      $$('.arr', n).forEach((a, i) => (a.onclick = (e) => { e.stopPropagation(); n._lr(i ? 1 : -1); }));
      n.onmouseenter = () => m.setFocus(n, true);
    });
    $('#set-back', el).onclick = () => { G.saveSettings(); this.pop(); };
    this.push(m);
  },

  /* ================= BİNALAR ================= */
  openBuilding(b) {
    const d = b.def, P = G.player;
    const svc = d.svc;
    const sub = TOWNS.find(t => t.id === b.town);
    this.menu({
      title: b.name, sub: () => `${sub ? sub.n + ' • ' : ''}${G.timeStr()} • Cüzdan: ${fmtMoney(P.money)}`, cls: 'building',
      build: () => {
        const it = [];
        const closed = (G.hour < 6 || G.hour > 22) && !['saloon', 'hotel', 'sheriff', 'station', 'church', 'mine', 'lumber', 'docks', 'ranch', 'stable'].includes(b.type);
        if (closed) { it.push({ html: '<p class="closed">Dükkan kapalı. Açılış saati 06:00.</p>' }); if (svc.includes('rob')) it.push({ label: 'Kapıyı Kır ve Soy', icon: '🔫', fn: () => this.robStore(b, true) }); return it; }
        for (const s of svc) {
          switch (s) {
            case 'shop': it.push({ icon: '🛒', label: 'Alışveriş', fn: () => this.openShop(d.shop, b.name) }); break;
            case 'meal': it.push({ icon: '🍲', label: 'Sıcak Yemek Ye', right: fmtMoney(2.5 * G.priceMul(true)), fn: () => { if (G.spend(2.5 * G.priceMul(true))) { P.hunger = Math.min(100, P.hunger + 60); P.thirst = Math.min(100, P.thirst + 25); P.hp = Math.min(P.maxHp, P.hp + 20); P.warmBuff = 120; G.stat('eaten', 1); this.feed('🍲 Doyasıya yedin.'); G.advanceClock(20); } } });
              it.push({ icon: '🥃', label: 'Bir Viski İç', right: fmtMoney(1), fn: () => { if (G.spend(1)) { P.addItem('whiskey', 1, true); G.consume('whiskey'); } } }); break;
            case 'blackjack': it.push({ icon: '🃏', label: 'Yirmi Bir Oyna', fn: () => this.openBlackjack() }); break;
            case 'arm': it.push({ icon: '💪', label: 'Bilek Güreşi ($5 bahis)', fn: () => this.openArmWrestle() }); break;
            case 'rumor': it.push({ icon: '👂', label: 'Söylenti Dinle', right: fmtMoney(0.5), fn: () => this.rumor() }); break;
            case 'rob': it.push({ icon: '🔫', label: 'Dükkanı Soy', cls: 'danger', fn: () => this.robStore(b) }); break;
            case 'room': it.push({ icon: '🛏', label: 'Oda Tut ve Uyu', right: fmtMoney(2 * G.priceMul(true)), fn: () => this.openSleep('hotel', 2 * G.priceMul(true)) }); break;
            case 'bath': it.push({ icon: '🛁', label: 'Sıcak Banyo', right: fmtMoney(1), fn: () => { if (G.spend(1)) { P.clean = 100; P.warmBuff = 60; this.feed('🛁 Tertemiz oldun. Kokun bile değişti.'); G.advanceClock(30); } } }); break;
            case 'heal': { const c = 5 * (G.hasPerk('saint') ? 0.5 : 1); it.push({ icon: '✚', label: 'Tedavi Ol (Sağlık, hastalık, zehir)', right: fmtMoney(c), fn: () => { if (G.spend(c)) { P.hp = P.maxHp; P.sick = 0; P.poison = 0; this.feed('✚ Doktor seni muayene edip tedavi etti.'); G.advanceClock(30); } } }); break; }
            case 'bounty':
              if (G.law.bounty > 0) it.push({ icon: '⚖', label: 'Başındaki Ödülü Öde', right: fmtMoney(G.law.bounty), fn: () => G.payBounty() });
              if (G.activeBounty && G.activeBounty.done) it.push({ icon: '💰', label: 'Ödül Avı Ödülünü Al', right: fmtMoney(G.activeBounty.reward), fn: () => { G.earn(G.activeBounty.reward, 'Ödül avı'); G.addHonor(3); G.activeBounty = null; } });
              break;
            case 'board': it.push({ icon: '📜', label: 'Ödül İlanları', fn: () => this.openBountyBoard() }); break;
            case 'horses': it.push({ icon: '🐴', label: 'At Satın Al', fn: () => this.openHorseShop(b) }); if (G.stable.length) it.push({ icon: '🏇', label: 'Ahırdaki Atların', fn: () => this.openStable(b) }); break;
            case 'horsecare': if (G.horse && !G.horse.dead) it.push({ icon: '🧽', label: `${G.horse.name}'i Tımar Ettir`, right: fmtMoney(2), fn: () => { if (dist(G.horse.x, G.horse.y, P.x, P.y) > 200) { this.feed('Atın burada değil.', 'warn'); return; } if (G.spend(2)) { G.horse.hp = G.horse.maxHp; G.horse.sta = G.horse.maxSta; G.horse.addBond(5); this.feed(`🐴 ${G.horse.name} tımar edildi.`); } } }); break;
            case 'bank': it.push({ icon: '🏦', label: 'Banka İşlemleri', right: fmtMoney(G.bank), fn: () => this.openBank() }); break;
            case 'robbank': it.push({ icon: '💣', label: 'Bankayı Soy', cls: 'danger', fn: () => this.robBank(b) }); break;
            case 'train': it.push({ icon: '🚂', label: 'Tren Bileti Al', fn: () => this.openTrain(b) }); break;
            case 'donate': it.push({ icon: '🙏', label: 'Kiliseye Bağış Yap', right: '$5.00', fn: () => { if (G.spend(5)) { G.addHonor(3); this.feed('Rahip sana teşekkür etti.'); } } }); break;
            case 'pray': it.push({ icon: '✝', label: 'Dua Et', fn: () => { const k = 'pray'; if (G.dailyTalk[k]) { this.feed('Bugün zaten dua ettin.'); return; } G.dailyTalk[k] = 1; P.energy = Math.min(100, P.energy + 8); P.deCore = Math.min(100, P.deCore + 20); G.addHonor(0.5); this.feed('İçin huzurla doldu.'); G.advanceClock(20); } }); break;
            case 'property': it.push({ icon: '📜', label: 'Satılık Mülkler', fn: () => this.openLand() }); break;
            case 'barber': it.push({ icon: '💈', label: 'Tıraş Ol / Saç Kestir', right: '$1.50', fn: () => this.openBarber() }); break;
            case 'work': it.push({ icon: '⚒', label: JOBS[d.work].n, fn: () => this.openWork(d.work, b.name) }); break;
          }
        }
        it.push({ icon: '🚪', label: 'Çık', fn: () => this.pop() });
        return it;
      },
    });
  },
  openShop(shopId, title) {
    const S = SHOPS[shopId], P = G.player;
    const regional = 1;
    this.menu({
      title: title || S.n, cls: 'shop', tabs: ['Satın Al', 'Sat'], side: (it) => it.sideHtml || '',
      sub: () => `Cüzdan: <b>${fmtMoney(P.money)}</b>`, okLabel: 'Al / Sat',
      build: (m) => {
        const items = [];
        if (m.tab === 0) {
          if (S.weapons) {
            items.push({ header: 'Silahlar' });
            for (const w of S.weapons) {
              const W = WEAPONS[w], pr = W.p * G.priceMul(true) * regional;
              const own = P.weapons.has(w);
              items.push({ icon: W.i, label: W.n, right: own ? 'Sahipsin' : fmtMoney(pr), disabled: own, sideHtml: `<div class="ps-t">${W.i} ${W.n}</div><div class="ps-d">${W.melee ? 'Yakın dövüş silahı.' : `Hasar: ${W.dmg}${W.pellets ? ' x' + W.pellets : ''}<br>Menzil: ${W.range}<br>Şarjör: ${W.clip}<br>Mühimmat: ${AMMO[W.ammo].n}`}</div>`, fn: () => { if (G.spend(pr)) { P.giveWeapon(w); if (W.ammo) P.ammo[W.ammo] = Math.min(AMMO[W.ammo].max, P.ammo[W.ammo] + AMMO[W.ammo].box); Audio_.ui('cash'); } } });
            }
          }
          if (S.ammo) {
            items.push({ header: 'Mühimmat' });
            for (const a of S.ammo) {
              const A = AMMO[a], pr = A.p * G.priceMul(true);
              items.push({ icon: '•', label: `${A.n} (x${A.box})`, right: `${fmtMoney(pr)} <small>[${P.ammo[a]}]</small>`, disabled: P.ammo[a] >= A.max, why: 'Taşıyabileceğin en fazla mühimmat bu.', sideHtml: `<div class="ps-t">${A.n}</div><div class="ps-d">Kutu başına ${A.box} adet. Taşıma sınırı: ${A.max}</div>`, fn: () => { if (G.spend(pr)) { P.ammo[a] = Math.min(A.max, P.ammo[a] + A.box); Audio_.ui('cash'); } } });
            }
          }
          if (S.sell && S.sell.length) {
            items.push({ header: 'Eşyalar' });
            for (const id of S.sell) {
              const it = ITEMS[id];
              if (!it) continue;
              if (id === 'treasure_map' && (G.treasure || P.has('treasure_map'))) continue;
              const pr = (id === 'treasure_map' ? 25 : it.p) * G.priceMul(true) * regional;
              const full = P.count(id) >= it.max;
              items.push({ icon: it.i, label: it.n, right: `${fmtMoney(pr)} <small>[${P.count(id)}]</small>`, disabled: full, why: 'Daha fazla taşıyamazsın.', sideHtml: this.itemSide(it), fn: () => { if (G.spend(pr)) { P.addItem(id, 1, true); if (id === 'treasure_map') G.makeTreasure(); if (it.autoUse) G.consume(id); Audio_.ui('cash'); } } });
            }
          }
        } else {
          const ids = Object.keys(P.inv).filter(id => G.sellPrice(id, shopId) > 0 && id !== 'canteen').sort((a, b) => ITEMS[a].c.localeCompare(ITEMS[b].c));
          if (!ids.length) items.push({ html: '<p class="p-empty">Bu dükkanın satın alacağı bir eşyan yok.</p>' });
          if (ids.length > 1) {
            const tot = ids.reduce((s, id) => s + G.sellPrice(id, shopId) * P.count(id), 0);
            const cats = new Set(ids.map(id => ITEMS[id].c));
            if (cats.has('animal')) {
              const tA = ids.filter(id => ITEMS[id].c === 'animal').reduce((s, id) => s + G.sellPrice(id, shopId) * P.count(id), 0);
              items.push({ icon: '💰', label: 'Tüm Av Ürünlerini Sat', right: fmtMoney(tA), fn: () => { for (const id of ids) if (ITEMS[id].c === 'animal') { const n = P.count(id); P.removeItem(id, n); } G.earn(tA, 'Satış'); } });
            }
            void tot;
          }
          for (const id of ids) {
            const it = ITEMS[id], pr = G.sellPrice(id, shopId);
            const worn = P.coat === id;
            items.push({ icon: it.i, label: it.n, right: `${fmtMoney(pr)} <small>[${P.count(id)}]</small>`, sideHtml: this.itemSide(it), disabled: worn, why: 'Üzerindeki giysiyi satamazsın.', fn: () => { P.removeItem(id, 1); G.earn(pr, ''); G.skillXp('trade', 1 + pr * 0.1); } });
          }
        }
        return items;
      },
    });
  },
  robStore(b, closed) {
    this.confirm('Dükkanı Soy', 'Bu bir suçtur. Kanun peşine düşecek. Emin misin?', () => {
      const v = rnd(25, 70) * (G.hasPerk('devil') ? 2 : 1) * (closed ? 0.7 : 1);
      this.closeAll();
      G.earn(v, 'Soygun');
      G.crime('storerob', G.player.x, G.player.y);
      Audio_.shot('pistol', 0.6);
    });
  },
  robBank(b) {
    if (!G.player.has('dynamite') && !G.player.isArmed) { this.feed('Banka soymak için silah ya da dinamit gerekli.', 'warn'); return; }
    this.confirm('Bankayı Soy', 'Büyük bir suç. Bütün kanun peşine düşecek (4 yıldız). Emin misin?', () => {
      const v = rnd(250, 700) * (G.hasPerk('devil') ? 1.5 : 1);
      this.closeAll();
      G.earn(v, 'Banka soygunu');
      G.crime('bankrob', G.player.x, G.player.y);
      Audio_.boom(0.6);
    });
  },
  rumor() {
    if (!G.spend(0.5)) return;
    const unk = G.world.pois.filter(p => (p.kind === 'landmark' || p.kind === 'camp') && !G.discovered.has(p.id) && !G.rumored.has(p.id));
    const line = pick(LINES.rumor);
    if (unk.length) {
      const p = pick(unk);
      G.rumored.add(p.id);
      this.info('Barmen Fısıldıyor', `<p class="quote">"${line}"</p><p>Ayrıca <b>${p.n}</b> hakkında bir şeyler duydun. Haritanda <b>?</b> olarak işaretlendi.</p>`);
    } else this.info('Barmen Fısıldıyor', `<p class="quote">"${line}"</p>`);
  },
  openSleep(where, cost) {
    const P = G.player;
    const untilMorning = ((7 - G.hour) + 24) % 24 || 24;
    const opts = [[2, '2 Saat Kestir'], [4, '4 Saat Uyu'], [8, '8 Saat Uyu'], [Math.round(untilMorning), `Sabaha Kadar (${Math.round(untilMorning)} saat)`]];
    this.menu({
      title: where === 'hotel' ? 'Otel Odası' : where === 'home' ? 'Evin' : 'Kamp', cls: 'small', sub: `Uyku: ${Math.round(P.energy)}/100 • ${G.timeStr()}`,
      items: opts.map(([h, n]) => ({ label: n, fn: () => { if (cost && !G.spend(cost)) return; this.closeAll(); G.sleep(h, where); } })).concat([{ label: 'Vazgeç', fn: () => this.pop() }]),
    });
  },
  openWait() {
    this.menu({ title: 'Zaman Geçir', cls: 'small', items: [[1, '1 Saat Bekle'], [3, '3 Saat Bekle'], [6, '6 Saat Bekle']].map(([h, n]) => ({ label: n, fn: () => { this.closeAll(); G.passTime(h); } })).concat([{ label: 'Kalk', fn: () => this.pop() }]) });
  },
  openWork(jobId, place) {
    const J = JOBS[jobId];
    const mul = (1 + G.skill(J.skill) * 0.05) * (G.hasPerk('worker') ? 1.25 : 1);
    this.menu({
      title: J.n, sub: place, cls: 'small',
      items: [
        { html: `<p>${J.desc}</p><p><b>Süre:</b> ${J.hours} saat<br><b>Ücret:</b> ${fmtMoney(J.pay[0] * mul)} – ${fmtMoney(J.pay[1] * mul)}<br><b>Yorgunluk:</b> -${J.energy} uyku, -${J.hunger} açlık, -${J.thirst} susuzluk</p><p class="dim">Çalışma saatleri 06:00 – 18:00</p>` },
        { label: 'Çalış', fn: () => { if (G.work(jobId, place)) this.closeAll(); } },
        { label: 'Vazgeç', fn: () => this.pop() },
      ],
    });
  },
  openCamp() {
    const P = G.player;
    this.menu({
      title: 'Kamp', cls: 'small', sub: () => `Ateşin başında ısınıyorsun • ${G.timeStr()}`,
      items: [
        { icon: '🛏', label: 'Uyu', fn: () => this.openSleep('camp') },
        { icon: '🍖', label: 'Pişir ve Üret', fn: () => this.openCook() },
        { icon: '⏳', label: 'Ateş Başında Bekle', fn: () => this.openWait() },
        { icon: '💾', label: 'Oyunu Kaydet', fn: () => G.saveGame() },
        { icon: '⛺', label: 'Kampı Topla', fn: () => { if (G.camp) { G.camp.remove = true; G.ents = G.ents.filter(e => e !== G.camp); G.camp = null; } this.pop(); } },
        { icon: '←', label: 'Kapat', fn: () => this.pop() },
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
      title: 'Pişir ve Üret', cls: 'shop', side: (it) => it.sideHtml || '',
      build: () => RECIPES.map(R => ({
        icon: R.out ? ITEMS[Object.keys(R.out)[0]].i : '🏹', label: R.n, right: can(R) ? '✔' : '', disabled: !can(R), why: 'Gerekli malzemeler eksik.',
        sideHtml: `<div class="ps-t">${R.n}</div><div class="ps-d">Gerekenler:<br>${Object.keys(R.need).map(k => `${ITEMS[k].i} ${R.anyFish && k === 'raw_fish' ? 'Herhangi bir balık' : ITEMS[k].n} x${R.need[k]} <small>[${R.anyFish && k === 'raw_fish' ? fishIds.reduce((s, f) => s + P.count(f), 0) + P.count('raw_fish') : P.count(k)}]</small>`).join('<br>')}</div>`,
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
        title: PR.n, sub: 'Satılık', cls: 'small',
        items: [
          { html: `<p>${PR.perks}</p><p><b>Fiyat:</b> ${fmtMoney(PR.p)}</p><p class="dim">Mülk sahibi olmak; güvenli uyku, kayıt, eşya sandığı ve evlilik imkânı sağlar.</p>` },
          { label: `Satın Al (${fmtMoney(PR.p)})`, disabled: P.money < PR.p, why: 'Paran yetmiyor. Bankadaki parayı çekmeyi unutma.', fn: () => this.buyProperty(PR) },
          { label: 'Vazgeç', fn: () => this.pop() },
        ],
      });
      return;
    }
    this.menu({
      title: PR.n, sub: G.family.spouse ? `${G.family.spouse.name} ile evin` : 'Evin', cls: 'small',
      items: [
        { icon: '🛏', label: 'Uyu', fn: () => this.openSleep('home') },
        { icon: '📦', label: 'Sandık', fn: () => this.openStash() },
        { icon: '🍖', label: 'Mutfak (Pişir)', fn: () => this.openCook() },
        { icon: '💾', label: 'Oyunu Kaydet', fn: () => G.saveGame() },
        { icon: '🚪', label: 'Çık', fn: () => this.pop() },
      ],
    });
  },
  buyProperty(PR) {
    if (!G.spend(PR.p)) return;
    G.props.push(PR.id);
    for (const b of G.world.buildings) if (b.prop === PR.id) { b.owned = true; b.name = PR.n + ' (Evin)'; G.world.invalidateChunkAt(b.door.x, b.door.y); }
    this.closeAll();
    this.toast('Mülk Satın Alındı', PR.n, 'ach');
    Audio_.chime();
  },
  openLand() {
    this.menu({
      title: 'Tapu Dairesi', sub: 'Satılık mülkler', cls: 'shop', side: (it) => it.sideHtml || '',
      build: () => PROPERTIES.map(PR => {
        const own = G.props.includes(PR.id);
        const poi = G.world.pois.find(p => p.prop === PR.id);
        return {
          icon: '🏠', label: PR.n, right: own ? 'Sahipsin' : fmtMoney(PR.p), disabled: own,
          sideHtml: `<div class="ps-t">${PR.n}</div><div class="ps-d">${PR.perks}<br><br>Konum: ${G.world.regionAt(poi.x, poi.y)}</div>`,
          fn: () => { G.rumored.add(poi.id); this.confirm(PR.n, `${fmtMoney(PR.p)} karşılığında satın alınsın mı? (Konum haritada işaretlendi.)`, () => this.buyProperty(PR)); G.setWaypoint(poi.x, poi.y); },
        };
      }),
    });
  },
  openStash() {
    const P = G.player;
    this.menu({
      title: 'Sandık', cls: 'shop', tabs: ['Çantadan Koy', 'Sandıktan Al'],
      build: (m) => {
        if (m.tab === 0) return Object.keys(P.inv).filter(id => id !== 'canteen').map(id => ({ icon: ITEMS[id].i, label: ITEMS[id].n, right: `x${P.inv[id]} <small>[sandık ${G.stash[id] || 0}]</small>`, fn: () => { P.removeItem(id, 1); G.stash[id] = (G.stash[id] || 0) + 1; } }));
        return Object.keys(G.stash).filter(id => G.stash[id] > 0).map(id => ({ icon: ITEMS[id].i, label: ITEMS[id].n, right: `x${G.stash[id]}`, fn: () => { if (P.addItem(id, 1, true)) { G.stash[id]--; if (!G.stash[id]) delete G.stash[id]; } else this.feed('Çantada yer yok.', 'warn'); } }));
      },
      empty: 'Boş.',
    });
  },
  openHorseShop(b) {
    const P = G.player;
    this.menu({
      title: 'At Satın Al', cls: 'shop', side: (it) => it.sideHtml || '', sub: () => `Cüzdan: ${fmtMoney(P.money)}`,
      build: () => Object.keys(HORSE_BREEDS).filter(k => HORSE_BREEDS[k].p > 0).map(k => {
        const B = HORSE_BREEDS[k], pr = B.p * G.priceMul(true);
        const bar = (v, mx) => `<div class="statbar"><i style="width:${v / mx * 100}%"></i></div>`;
        return {
          icon: '🐴', label: B.n, right: fmtMoney(pr),
          sideHtml: `<div class="ps-t">${B.n}</div><div class="ps-d">Hız${bar(B.spd, 1.3)}Dayanıklılık${bar(B.sta, 170)}Sağlık${bar(B.hp, 190)}</div>`,
          fn: () => { if (G.spend(pr)) { const h = new Horse(b.door.x + 20, b.door.y + 20, k, { owner: 'player' }); h.ang = Math.PI / 2; G.setHorse(h); this.toast('Yeni At', `${h.name} (${B.n}) artık senin.`, 'horse'); Audio_.neigh(); } },
        };
      }),
    });
  },
  openStable(b) {
    this.menu({
      title: 'Ahırdaki Atların', cls: 'small',
      build: () => G.stable.map((s, i) => ({ icon: '🐴', label: `${s.name} (${HORSE_BREEDS[s.breed].n})`, fn: () => { G.stable.splice(i, 1); const h = new Horse(b.door.x + 20, b.door.y + 20, s.breed, { owner: 'player', name: s.name, look: s.look, bond: s.bond }); G.setHorse(h); this.feed(`🐴 ${h.name} ahırdan çıkarıldı.`); this.pop(); } })),
    });
  },
  openBank() {
    const P = G.player;
    this.menu({
      title: 'Banka', sub: () => `Hesap: <b>${fmtMoney(G.bank)}</b> • Cüzdan: <b>${fmtMoney(P.money)}</b><br><small>Bankadaki para ölünce kaybolmaz ve yıllık %2 faiz kazanır.</small>`, cls: 'small',
      build: () => {
        const it = [];
        for (const v of [10, 50, 100]) it.push({ label: `${fmtMoney(v)} Yatır`, disabled: P.money < v, fn: () => { P.money -= v; G.bank += v; } });
        it.push({ label: 'Tümünü Yatır', disabled: P.money < 0.01, fn: () => { G.bank += P.money; P.money = 0; } });
        for (const v of [10, 50, 100]) it.push({ label: `${fmtMoney(v)} Çek`, disabled: G.bank < v, fn: () => { G.bank -= v; P.money += v; } });
        it.push({ label: 'Tümünü Çek', disabled: G.bank < 0.01, fn: () => { P.money += G.bank; G.bank = 0; } });
        return it;
      },
    });
  },
  openTrain(b) {
    const P = G.player;
    const here = G.world.towns.find(t => t.id === b.town);
    const stations = G.world.towns.filter(t => t.station && t !== here);
    this.menu({
      title: 'Tren Bileti', sub: `${here.n} İstasyonu`, cls: 'small',
      build: () => stations.map(t => {
        const d = dist(here.cx, here.cy, t.cx, t.cy);
        const pr = Math.max(1, d / 1400) * (G.hasPerk('towns') ? 0.5 : 1);
        const hrs = Math.max(1, Math.round(d / 2200));
        return { icon: '🚂', label: t.n, right: `${fmtMoney(pr)} • ${hrs} sa`, fn: () => {
          if (G.law.level > 0) { this.feed('Aranırken trene binemezsin!', 'warn'); return; }
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
          }, `${t.n} yolunda...`);
        } };
      }),
    });
  },
  openBarber() {
    const P = G.player, L = P.look;
    this.menu({
      title: 'Berber', cls: 'small', sub: 'Her işlem $1.50',
      build: () => {
        const it = [{ header: 'Saç' }];
        LOOKS.hairStyle.forEach((n, i) => it.push({ label: n + (L.hairStyle === i ? ' ✔' : ''), fn: () => { if (G.spend(1.5)) { L.hairStyle = i; P._lk = null; P.clean = Math.min(100, P.clean + 10); } } }));
        if (L.sex === 'm') {
          it.push({ header: 'Sakal' });
          LOOKS.beard.forEach((n, i) => it.push({ label: n + (L.beard === i ? ' ✔' : ''), fn: () => { if (G.spend(1.5)) { L.beard = i; L.beardLen = 0.2; P._lk = null; } } }));
        }
        return it;
      },
    });
  },
  openGift(e, R) {
    const P = G.player;
    this.menu({
      title: 'Hediye Ver', sub: R.name, cls: 'small',
      build: () => {
        const ids = Object.keys(P.inv).filter(id => ITEMS[id].gift);
        return ids.map(id => ({ icon: ITEMS[id].i, label: ITEMS[id].n, right: 'x' + P.inv[id], fn: () => { G.giveGift(e, R, id); this.pop(); } }));
      },
      empty: 'Hediye edebileceğin bir şey yok. (Çiçek, çikolata, mücevher…)',
    });
  },
  openBountyBoard() {
    if (!G.bounties) {
      const W = G.world;
      const crimes = ['Tren soygunu', 'Cinayet', 'At hırsızlığı', 'Banka soygunu', 'Posta arabası soygunu', 'Firar', 'Sığır hırsızlığı'];
      G.bounties = [];
      for (let k = 0; k < 3; k++) {
        const cands = W.pois.filter(p => p.kind === 'landmark' || p.kind === 'camp');
        const p = pick(cands);
        const sex = chance(0.85) ? 'm' : 'f';
        G.bounties.push({ id: 'b' + G.day + k, name: pick(NAMES[sex]) + ' "' + pick(['Kara', 'Deli', 'Sessiz', 'Kör', 'Kızıl', 'Tilki', 'Çakal', 'Topal']) + '" ' + pick(NAMES.last), crime: pick(crimes), reward: rndi(4, 16) * 10, x: p.x + rnd(-60, 60), y: p.y + rnd(-60, 60), where: p.n, hench: rndi(1, 3) });
      }
    }
    this.menu({
      title: 'Ödül İlanları', cls: 'shop board', side: (it) => it.sideHtml || '',
      build: () => {
        const it = [];
        const A = G.activeBounty;
        if (A) it.push({ html: `<p class="active-b">Aktif: <b>${A.name}</b> — ${A.done ? 'Etkisiz hale getirildi. Ödülü bir şerif ofisinden al.' : A.where + ' civarında.'}</p>` });
        for (const b of G.bounties) {
          it.push({ icon: '📜', label: b.name, right: fmtMoney(b.reward), disabled: !!A, why: 'Önce aktif ödül avını tamamla.',
            sideHtml: `<div class="poster"><div class="po-w">ARANIYOR</div><div class="po-n">${b.name}</div><div class="po-c">${b.crime}</div><div class="po-r">${fmtMoney(b.reward)}</div><div class="po-l">Son görüldüğü yer:<br>${b.where}</div></div>`,
            fn: () => { G.activeBounty = Object.assign({}, b, { done: false, spawned: false }); G.bounties = G.bounties.filter(x => x !== b); G.setWaypoint(b.x, b.y); this.feed('📜 Ödül avı kabul edildi. Hedef haritada işaretlendi.'); } });
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
    this.info('Yol Tabelası', `<div class="signboard">${rows}</div>`);
  },
  showTreasureMap() {
    const T_ = G.treasure;
    if (!T_) { this.info('Hazine Haritası', '<p>Harita çok eski ve okunmuyor.</p>'); return; }
    this.menu({
      title: 'Hazine Haritası', cls: 'small',
      items: [
        { html: `<div class="tmap"><p>Kurşun kalemle çizilmiş eski bir harita. Kenarında şöyle yazıyor:</p><p class="quote">"${T_.region} bölgesinde, <b>${T_.hint}</b> yakınlarında. Taze toprağı ara, kürekle kaz."</p></div>` },
        { label: 'Bölgeyi Haritada İşaretle', fn: () => { G.setWaypoint(T_.x + rnd(-200, 200), T_.y + rnd(-200, 200)); this.pop(); this.feed('Yaklaşık bölge işaretlendi. Yakınlarda taze toprak ara.'); } },
        { label: 'Kapat', fn: () => this.pop() },
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
      el.innerHTML = `<div class="p-head"><div class="p-title">Yirmi Bir</div><div class="p-sub">Cüzdan: ${fmtMoney(P.money)} • Bahis: ${fmtMoney(st.bet)}</div></div>
        <div class="bj-table"><div class="bj-h"><div class="bj-l">Krupiye ${st.phase === 'play' ? '' : '(' + dv + ')'}</div><div class="bj-c">${st.dh.map((c, i) => card(c, st.phase === 'play' && i === 1)).join('')}</div></div>
        <div class="bj-msg">${st.msg}</div>
        <div class="bj-h"><div class="bj-l">Sen (${pv})</div><div class="bj-c">${st.ph.map(c => card(c)).join('')}</div></div></div>
        <div class="p-foot">${st.phase === 'play' ? `${Input.glyph('confirm')} Kart Çek &nbsp; ${Input.glyph('alt')} Dur &nbsp; ${Input.glyph('alt2')} İkiye Katla` : `◀ ▶ Bahis &nbsp; ${Input.glyph('confirm')} Dağıt`} &nbsp; ${Input.glyph('back')} Kalk</div>`;
    };
    const finish = () => {
      while (val(st.dh) < 17) st.dh.push(st.deck.pop());
      const pv = val(st.ph), dv = val(st.dh);
      let win = 0;
      if (pv > 21) { st.msg = 'Battın!'; win = -1; }
      else if (dv > 21 || pv > dv) { st.msg = 'Kazandın!'; win = 1; }
      else if (pv === dv) { st.msg = 'Berabere.'; win = 0; }
      else { st.msg = 'Kasa kazandı.'; win = -1; }
      if (win > 0) { const bj = pv === 21 && st.ph.length === 2; P.money += st.bet * (bj ? 2.5 : 2); G.stat('bjWins', 1); Audio_.ui('cash'); if (bj) st.msg = 'Blackjack!'; }
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
          if (P.money < st.bet) { this.feed('Yeterli paran yok.', 'warn'); return; }
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
    if (P.money < 5) { this.feed('Bahis için $5 gerekli.', 'warn'); return; }
    P.money -= 5;
    const el = el_('div', 'modal panel arm');
    const opp = { n: randomName('m'), str: rnd(0.8, 1.35) };
    const st = { pos: 0.5, t: 0, done: false, start: 1.5 };
    const draw = () => {
      el.innerHTML = `<div class="p-head"><div class="p-title">Bilek Güreşi</div><div class="p-sub">Rakip: ${opp.n}</div></div>
        <div class="arm-bar"><div class="arm-zone l"></div><div class="arm-zone r"></div><i style="left:${st.pos * 100}%"></i></div>
        <div class="arm-msg">${st.done ? st.msg : st.start > 0 ? 'Hazır ol... ' + Math.ceil(st.start) : 'Hızlıca bas!'}</div>
        <div class="p-foot">${Input.glyph('confirm')} Tekrar tekrar bas &nbsp; ${st.done ? Input.glyph('back') + ' Kapat' : ''}</div>`;
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
      if (st.pos <= 0.05) { st.done = true; st.msg = 'KAZANDIN! +$10'; P.money += 10; G.stat('armWins', 1); G.skillXp('strength', 10); Audio_.ui('cash'); }
      if (st.pos >= 0.95) { st.done = true; st.msg = 'Kaybettin.'; Audio_.ui('error'); }
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
      if (st.phase === 'cast') body = `<div class="f-msg">Oltanı atmak için ${Input.glyph('confirm')} basılı tut ve bırak</div><div class="f-bar"><i style="width:${st.power * 100}%"></i></div>`;
      else if (st.phase === 'wait') body = `<div class="f-msg">Bekle... <span class="bob">〰</span></div>`;
      else if (st.phase === 'bite') body = `<div class="f-msg big">VURDU! ${Input.glyph('confirm')}</div>`;
      else if (st.phase === 'reel') body = `<div class="f-msg">Makarayı sar: ${Input.glyph('confirm')} basılı tut — gerginliğe dikkat!</div><div class="f-lab">Gerginlik</div><div class="f-bar tension"><i style="width:${st.tension * 100}%" class="${st.tension > 0.8 ? 'hot' : ''}"></i></div><div class="f-lab">Mesafe</div><div class="f-bar"><i style="width:${st.dist * 100}%"></i></div>`;
      else body = `<div class="f-msg big">${st.msg}</div><div class="f-msg">${Input.glyph('confirm')} Tekrar &nbsp; ${Input.glyph('back')} Bitir</div>`;
      el.innerHTML = `<div class="f-inner"><div class="p-title">Balık Tutma</div>${body}<div class="p-foot">${Input.glyph('back')} Bırak</div></div>`;
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
        if (I.pressed('confirm')) { st.msg = 'Çok erken çektin!'; st.phase = 'end'; }
      } else if (st.phase === 'bite') {
        st.t += dt;
        if (I.pressed('confirm')) { st.phase = 'reel'; st.fish = pick(pool); st.str = rnd(0.6, 1.4) * (ITEMS[st.fish].p / 4); }
        else if (st.t > 1.1) { st.msg = 'Balık kaçtı...'; st.phase = 'end'; }
      } else if (st.phase === 'reel') {
        const pull = (0.5 + Math.sin(G.t * 4 + Math.sin(G.t * 1.3) * 3) * 0.5) * st.str;
        if (I.down('confirm')) { st.tension += dt * (0.35 + pull * 0.5); st.dist -= dt * 0.18; }
        else { st.tension -= dt * 0.55; st.dist += dt * 0.04 * pull; }
        st.tension = clamp(st.tension, 0, 1.01); st.dist = clamp(st.dist, 0, 1.2);
        if (st.tension >= 1) { st.msg = 'Misina koptu!'; st.phase = 'end'; Audio_.ui('error'); }
        if (st.dist >= 1.2) { st.msg = 'Balık kaçtı...'; st.phase = 'end'; }
        if (st.dist <= 0) {
          st.phase = 'end'; const it = ITEMS[st.fish];
          st.msg = `${it.i} ${it.n} tuttun!`; P.addItem(st.fish, 1); G.stat('fish', 1); G.skillXp('survival', 4); Audio_.ui('cash');
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
    el.innerHTML = `<div class="ds-inner"><div class="ds-t">ÖLDÜN</div><div class="ds-c">Ölüm sebebi: ${G.deathCause}</div><div class="ds-a">${G.player.name}, ${G.age} yaşında</div>
      <div class="ds-items"><div class="p-item nav pref" id="ds-cont">${hard ? 'Hayatının Özeti' : 'Devam Et (Doktor)'}</div>${!hard ? '<div class="p-item nav" id="ds-legacy">Bu Hayatı Bitir</div>' : ''}<div class="p-item nav" id="ds-menu">Ana Menü</div></div></div>`;
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
    const epit = alive ? 'Seksen yılı devirdi. Batı onu yıpratamadı.' : G.honor > 50 ? 'Dürüst bir adamdı; iyi yaşadı, iyi öldü.' : G.honor < -50 ? 'Kanunun kovaladığı, halkın korktuğu biriydi.' : 'Batının tozunda iz bırakan sıradan bir hayat.';
    const el = el_('div', 'modal legacy');
    el.innerHTML = `<div class="paper"><div class="np-h">THE DUSTBOUND GAZETTE</div><div class="np-d">${G.dateStr()} • Fiyatı 5 sent</div>
      <div class="np-t">${alive ? 'BİR EFSANE 80 YAŞINDA' : 'ACI KAYIP'}</div>
      <div class="np-body"><canvas id="lg-portrait" width="160" height="192"></canvas>
      <div><h2>${escapeHtml(P.name)}</h2><div class="np-y">${born} – ${alive ? '' : G.year}</div>
      <p>${alive ? `${escapeHtml(P.name)}, dün ${G.age}. yaşını kutladı.` : `${escapeHtml(P.name)}, ${G.age} yaşında ${G.deathCause} sebebiyle hayatını kaybetti.`} ${G.family.spouse ? `Geride eşi ${G.family.spouse.name}` + (G.family.children.length ? ` ve ${G.family.children.length} çocuğunu (${G.family.children.map(c => c.name).join(', ')})` : '') + ' bıraktı.' : 'Arkasında bir aile bırakmadı.'}</p>
      <p><i>"${epit}"</i></p>
      <table class="stats"><tr><td>Yaşanan gün</td><td>${G.day}</td></tr><tr><td>Avlanan hayvan</td><td>${S.animals}</td></tr><tr><td>Kazanılan para</td><td>${fmtMoney(S.earned)}</td></tr><tr><td>Keşfedilen yer</td><td>${G.discovered.size}</td></tr><tr><td>Başarımlar</td><td>${ach}/${ACHIEVEMENTS.length}</td></tr><tr><td>Onur</td><td>${Math.round(G.honor)}</td></tr></table></div></div>
      <div class="ds-items">${alive ? '<div class="p-item nav pref" id="lg-cont">Yaşamaya Devam Et</div>' : ''}<div class="p-item nav ${alive ? '' : 'pref'}" id="lg-menu">Ana Menü</div></div></div>`;
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
    if (info) items.push(['cont', 'Devam Et', `${info.name} • ${info.age} yaşında • ${fmtMoney(info.money)}`]);
    items.push(['new', 'Yeni Hayat', 'Bir karakter yarat ve 18 yaşında başla']);
    items.push(['set', 'Ayarlar', ''], ['ctrl', 'Kontroller', ''], ['about', 'Hakkında', '']);
    $('#mm-items').innerHTML = items.map(([id, n, s]) => `<div class="mm-item nav" data-id="${id}"><div class="mm-n">${n}</div>${s ? `<div class="mm-s">${s}</div>` : ''}</div>`).join('');
    $('#mm-foot').innerHTML = `${Input.glyph('confirm')} Seç &nbsp;&nbsp; PlayStation kolu desteklenir`;
    const m = this.makeModal(mm, { keepEl: true, onBack: () => {} });
    $$('.mm-item', mm).forEach(n => {
      n.onmouseenter = () => m.setFocus(n, true);
      n.onclick = () => {
        Audio_.unlock();
        Audio_.ui('ok');
        const id = n.dataset.id;
        if (id === 'cont') { this.pop(m); mm.classList.add('hidden'); G.loadGame(); }
        else if (id === 'new') { if (info) this.confirm('Yeni Hayat', 'Mevcut kaydın silinecek. Emin misin?', () => { this.pop(m); this.showCreate(); }); else { this.pop(m); this.showCreate(); } }
        else if (id === 'set') this.openSettings();
        else if (id === 'ctrl') this.info('Kontroller', this.controlsTable());
        else if (id === 'about') this.info('Dustbound', '<p><b>Dustbound</b>, 1890\'lar Amerika\'sında geçen 2D açık dünya hayatta kalma ve rol yapma oyunudur.</p><p>Görev yok; sadece hayat var. 18 yaşında başla, avlan, çalış, sev, keşfet ve 80 yaşına kadar hayatta kalmaya çalış.</p><p class="dim">HTML5 Canvas • Prosedürel dünya, grafik ve ses</p>');
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
    const rows = [
      { k: 'sex', n: 'Cinsiyet', opts: ['m', 'f'], lab: v => (v === 'm' ? 'Erkek' : 'Kadın') },
      { k: 'skin', n: 'Ten Rengi', opts: LOOKS.skin, sw: 1 },
      { k: 'hair', n: 'Saç Rengi', opts: LOOKS.hair, sw: 1 },
      { k: 'hairStyle', n: 'Saç Stili', opts: [0, 1, 2, 3, 4], lab: v => LOOKS.hairStyle[v] },
      { k: 'beard', n: 'Sakal', opts: [0, 1, 2, 3, 4], lab: v => LOOKS.beard[v], male: 1 },
      { k: 'eyes', n: 'Göz Rengi', opts: LOOKS.eyes, sw: 1 },
      { k: 'hat', n: 'Şapka', opts: LOOKS.hat, lab: v => LOOKS.hatN[v] },
      { k: 'hatCol', n: 'Şapka Rengi', opts: LOOKS.hatCol, sw: 1 },
      { k: 'coat', n: 'Ceket', opts: LOOKS.coat, sw: 1 },
      { k: 'shirt', n: 'Gömlek', opts: LOOKS.shirt, sw: 1 },
      { k: 'pants', n: 'Pantolon', opts: LOOKS.pants, sw: 1 },
      { k: 'bg', n: 'Geçmiş', opts: BACKGROUNDS.map(b => b.id), lab: v => BACKGROUNDS.find(b => b.id === v).n, prof: 1 },
      { k: 'difficulty', n: 'Zorluk', opts: DIFFICULTIES.map(b => b.id), lab: v => DIFFICULTIES.find(b => b.id === v).n, prof: 1 },
      { k: 'pace', n: 'Yaşlanma Hızı', opts: LIFE_PACES.map(b => b.id), lab: v => LIFE_PACES.find(b => b.id === v).n, prof: 1 },
    ];
    const get = r => (r.prof ? prof[r.k] : look[r.k]);
    const html = () => `<div class="cr-left"><div class="p-title">Karakter Yarat</div><div class="cr-sub">Amerika, ${START_YEAR}. Sen 18 yaşındasın.</div>
      <div class="cr-row nav" id="cr-name-row"><span class="cr-l">İsim</span><input id="cr-name" maxlength="28" value="${escapeHtml(prof.name)}"><span class="cr-rand" id="cr-rn">🎲</span></div>
      ${rows.map((r, i) => `<div class="cr-row nav opt ${r.male && look.sex !== 'm' ? 'hidden' : ''}" data-i="${i}" data-lr><span class="cr-l">${r.n}</span><span class="cr-v"><b class="arr">◀</b><span class="v">${r.sw ? `<i class="swatch" style="background:${get(r)}"></i>` : r.lab(get(r))}</span><b class="arr">▶</b></span></div>`).join('')}
      <div class="cr-btns"><div class="p-item nav" id="cr-rand">Rastgele</div><div class="p-item nav pref" id="cr-go">Hayata Başla</div></div>
      </div><div class="cr-right"><canvas id="cr-portrait" width="300" height="360"></canvas><canvas id="cr-top" width="96" height="96"></canvas><div class="cr-desc" id="cr-desc"></div></div>
      <div class="p-foot">◀ ▶ Değiştir &nbsp; ${Input.glyph('confirm')} Seç &nbsp; ${Input.glyph('back')} Geri</div>`;
    let m;
    const refresh = () => {
      Spr.portrait($('#cr-portrait', el).getContext('2d'), 300, 360, look, 18);
      const tc = $('#cr-top', el).getContext('2d');
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, 96, 96); tc.fillStyle = '#a78b62'; tc.fillRect(0, 0, 96, 96);
      tc.imageSmoothingEnabled = false;
      tc.setTransform(5, 0, 0, 5, 48, 48);
      Spr.human(tc, 0, 0, -Math.PI / 2 + Math.sin(performance.now() / 900) * 0.3, look, { walk: performance.now() / 150, mv: 0.6 });
      tc.setTransform(1, 0, 0, 1, 0, 0);
      const BG = BACKGROUNDS.find(b => b.id === prof.bg), D = DIFFICULTIES.find(d => d.id === prof.difficulty), L = LIFE_PACES.find(p => p.id === prof.pace);
      const town = TOWNS.find(t => t.id === BG.town);
      $('#cr-desc', el).innerHTML = `<b>${BG.n}</b> — ${BG.d}<br><small>Başlangıç: ${town.n} • ${fmtMoney(BG.money)} • ${Object.keys(BG.skills).map(k => SKILLS[k].n + ' +' + BG.skills[k]).join(', ')}${BG.horse ? ' • Atlı' : ' • Atsız'}${BG.bounty ? ' • Başında $' + BG.bounty + ' ödül' : ''}</small><br><b>${D.n}:</b> ${D.d}<br><b>Yaşlanma ${L.n}:</b> ${L.d}`;
    };
    const build = () => {
      el.innerHTML = html();
      const nameIn = $('#cr-name', el);
      nameIn.onfocus = () => (Input.textFocus = true);
      nameIn.onblur = () => (Input.textFocus = false);
      nameIn.oninput = () => (prof.name = nameIn.value);
      nameIn.onkeydown = (e) => { if (e.code === 'Enter' || e.code === 'Escape') nameIn.blur(); };
      $('#cr-name-row', el).onclick = () => nameIn.focus();
      $('#cr-rn', el).onclick = (e) => { e.stopPropagation(); prof.name = pick(NAMES[look.sex]) + ' ' + pick(NAMES.last); nameIn.value = prof.name; };
      $('#cr-name-row', el)._lr = () => { prof.name = pick(NAMES[look.sex]) + ' ' + pick(NAMES.last); nameIn.value = prof.name; };
      $('#cr-name-row', el).dataset.lr = '';
      $$('.opt', el).forEach(n => {
        const r = rows[+n.dataset.i];
        n._lr = (d) => {
          const cur = get(r); const i = r.opts.indexOf(cur);
          const v = r.opts[(i + d + r.opts.length) % r.opts.length];
          if (r.prof) prof[r.k] = v; else look[r.k] = v;
          if (r.k === 'sex') { if (v === 'f') { look.beard = 0; if (look.hairStyle === 3) look.hairStyle = 1; } prof.name = pick(NAMES[v]) + ' ' + pick(NAMES.last); build(); m.setFocus($$('.opt', el)[0], true); return; }
          $('.v', n).innerHTML = r.sw ? `<i class="swatch" style="background:${v}"></i>` : r.lab(v);
          refresh();
        };
        n.onclick = () => n._lr(1);
        $$('.arr', n).forEach((a, i) => (a.onclick = (e) => { e.stopPropagation(); n._lr(i ? 1 : -1); }));
        n.onmouseenter = () => m && m.setFocus(n, true);
      });
      $('#cr-rand', el).onclick = () => { const nl = randomLook(look.sex); Object.assign(look, nl, { coatLen: 0 }); prof.name = pick(NAMES[look.sex]) + ' ' + pick(NAMES.last); build(); m.focusFirst(); };
      $('#cr-go', el).onclick = () => {
        prof.name = (prof.name || '').trim() || pick(NAMES[look.sex]) + ' ' + pick(NAMES.last);
        look.beardLen = 0.4;
        this.pop(m);
        G.deleteSave();
        G.newGame({ name: prof.name, look, bg: prof.bg, difficulty: prof.difficulty, pace: prof.pace });
      };
      refresh();
    };
    m = this.makeModal(el, { onBack: () => { this.pop(m); this.showMainMenu(); } });
    build();
    m.update = () => { if (this.frame % 3 === 0) { const tc = $('#cr-top', el); if (tc) refresh(); } };
    this.push(m);
    const go = $('#cr-go', el); m.setFocus(go, true);
  },

  /* Ana menü arka planı: gün batımında çöl */
  initMenuBg() {
    const c = this.menuCanvas;
    c.width = 480; c.height = 270;
    this.bg = { t: 0, rider: -60, dust: [] };
    const R = new RNG(77);
    this.bg.layers = [0, 1, 2].map(k => { const pts = []; let y = 150 + k * 25; for (let x = 0; x <= 480; x += 8) { y += R.range(-6, 6) * (3 - k) * 0.6; y = clamp(y, 110 + k * 30, 200 + k * 20); pts.push([x, y]); } return pts; });
    this.bg.cacti = [0, 1, 2, 3, 4, 5].map(() => [R.range(0, 480), R.range(0.6, 1.2)]);
  },
  menuBg(dt) {
    if (!this.bg) return;
    const c = this.bgctx, B = this.bg;
    B.t += dt;
    const g = c.createLinearGradient(0, 0, 0, 270);
    g.addColorStop(0, '#1a1030'); g.addColorStop(0.35, '#6a2a3a'); g.addColorStop(0.62, '#e0602a'); g.addColorStop(0.8, '#f0b050');
    c.fillStyle = g; c.fillRect(0, 0, 480, 270);
    c.fillStyle = '#ffd890'; c.beginPath(); c.arc(300, 175, 34, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,220,150,0.25)'; c.beginPath(); c.arc(300, 175, 50, 0, TAU); c.fill();
    const cols = ['#5a2a30', '#3a1a22', '#1e0e12'];
    B.layers.forEach((pts, k) => {
      c.fillStyle = cols[k];
      c.beginPath(); c.moveTo(0, 270);
      const off = (B.t * (4 + k * 6)) % 8;
      for (const [x, y] of pts) c.lineTo(x - off, y);
      c.lineTo(480, 270); c.fill();
    });
    c.fillStyle = '#120808';
    c.fillRect(0, 232, 480, 40);
    for (const [x0, s] of B.cacti) {
      const x = ((x0 - B.t * 22) % 520 + 520) % 520 - 20;
      c.fillRect(x, 232 - 26 * s, 5 * s, 26 * s); c.fillRect(x - 6 * s, 232 - 18 * s, 6 * s, 3 * s); c.fillRect(x - 6 * s, 232 - 24 * s, 3 * s, 8 * s); c.fillRect(x + 5 * s, 232 - 14 * s, 5 * s, 3 * s); c.fillRect(x + 8 * s, 232 - 20 * s, 3 * s, 8 * s);
    }
    // atlı siluet
    B.rider += dt * 30;
    if (B.rider > 540) B.rider = -60;
    const rx = B.rider, ry = 226, p = B.t * 12;
    c.fillStyle = '#0a0404';
    c.beginPath(); c.ellipse(rx, ry, 13, 6, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(rx + 10, ry - 2); c.lineTo(rx + 19, ry - 12); c.lineTo(rx + 23, ry - 10); c.lineTo(rx + 15, ry + 1); c.fill();
    for (const [lx, ph] of [[-9, 0], [-6, 2], [7, 1], [10, 3]]) { c.save(); c.translate(rx + lx, ry + 3); c.rotate(Math.sin(p + ph) * 0.6); c.fillRect(-1, 0, 2, 11); c.restore(); }
    c.beginPath(); c.moveTo(rx - 12, ry - 2); c.quadraticCurveTo(rx - 20, ry + 2, rx - 18, ry + 9); c.lineTo(rx - 15, ry + 2); c.fill();
    c.fillRect(rx - 3, ry - 17, 7, 12); c.beginPath(); c.arc(rx + 0.5, ry - 20, 3.4, 0, TAU); c.fill();
    c.fillRect(rx - 7, ry - 23, 15, 2); c.fillRect(rx - 3, ry - 27, 7, 5);
    if (Math.random() < 0.5) B.dust.push([rx - 12, ry + 8, 1]);
    c.fillStyle = 'rgba(80,40,30,0.35)';
    for (const d of B.dust) { d[2] -= dt * 0.8; d[0] -= dt * 12; d[1] -= dt * 4; c.beginPath(); c.arc(d[0], d[1], (1 - d[2]) * 6 + 1, 0, TAU); c.globalAlpha = Math.max(0, d[2]); c.fill(); }
    c.globalAlpha = 1;
    B.dust = B.dust.filter(d => d[2] > 0);
  },
};

const el_ = el;
const RADAR_B = new Set(['general', 'saloon', 'sheriff', 'doctor', 'gunsmith', 'butcher', 'stable', 'hotel', 'station', 'bank', 'mine', 'lumber', 'docks', 'ranch', 'cabin', 'hermit', 'property', 'fence']);
const BICON = { general: '🏪', saloon: '🍺', sheriff: '⭐', doctor: '✚', gunsmith: '🔫', butcher: '🥩', stable: '🐴', hotel: '🛏', bank: '🏦', station: '🚂', church: '✝', land: '📜', barber: '💈', tailor: '👔', fence: '💰', mine: '⛏', lumber: '🪓', docks: '⚓', ranch: '⛏', cabin: '🦊', hermit: '🧙', property: '🏠' };
const PICON = { camp: '⛺', farm: '🌾', property: '🏠', crater: '☄', sequoia: '🌲', ruins: '🏛', ghost: '👻', mine: '⛏', hotspring: '♨', dino: '🦴', hanging: '⚰', wreck: '🛞', lighthouse: '🗼', hermit: '🛖', trapper: '🦊', battlefield: '⚔', fortruin: '🏰', windmill: '🌀', oasis: '🌴', lookout: '👁', cave: '🐻', graveyard: '✝', shipwreck: '⚓', arch: '🌉' };
const TIPS = [
  'İpucu: Çömelerek (L3 / C) hayvanlara daha kolay yaklaşabilirsin.',
  'İpucu: Çiğ et yemek hastalık yapabilir. Kamp ateşinde pişir.',
  'İpucu: Çölde matarani her zaman dolu tut.',
  'İpucu: Karlı dağlarda kürk manto hayat kurtarır.',
  'İpucu: Barmenlerden söylenti dinleyerek gizli yerleri öğrenebilirsin.',
  'İpucu: Bankadaki paran ölünce kaybolmaz.',
  'İpucu: Yüksek tepeler (gözetleme noktaları) haritanın büyük kısmını açar.',
  'İpucu: Atınla bağın geliştikçe silah seslerinden daha az ürker.',
  'İpucu: Başarımlar kalıcı yetenekler (perk) kazandırır.',
  'İpucu: Evlenmek için önce bir mülk sahibi olmalısın.',
  'İpucu: R1 / T tuşu en uygun yiyeceği ya da ilacı hızlıca kullanır.',
];
