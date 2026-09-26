'use strict';
/* ==========================================================
   FRONTIER'S END — hata ayıklama modu (Ctrl+Alt+C)
   - Sağda sürüklenebilir, sekmeli bir panel: performans, oyuncu,
     dünya, varlık oluşturma, görsel katmanlar, kasaba sakinleri, günlük.
   - Katmanlar oyunun düşük çözünürlüklü tuvaline değil, ekranın üstündeki
     tam çözünürlüklü ayrı bir tuvale çizilir (yazılar net okunur).
   - Hile sayılan bir şey kullanılırsa o kayıtta başarımlar kapanır.
   ========================================================== */
const Debug = {
  open: false,
  tab: 'overview',
  opt: {
    god: false, ammo: false, stamina: false, noclip: false, nolaw: false, speed: 1,
    timeScale: 1, freeze: false, clickTp: false,
    ovHit: false, ovSolid: false, ovLabels: false, ovRoutes: false, ovWagons: false, ovAim: false, ovLaw: false, ovChunks: false, hideHud: false,
  },
  perf: { frames: new Float32Array(180), fi: 0, upd: 0, ren: 0, ovl: 0, last: 0 },
  log: [],
  logFilter: 'all',
  townSel: null,

  /* ---------------- kurulum ---------------- */
  install() {
    // kısayol: pencerenin yakalama aşamasında, oyunun çömelme tuşundan (C) önce
    window.addEventListener('keydown', e => {
      if (this.pin) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.pinKey(e); return; }
      if (e.code === 'KeyC' && e.ctrlKey && e.altKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat) this.toggle();
      }
    }, true);
    // günlük: hatalar ve oyun bildirimleri
    const ce = console.error.bind(console);
    console.error = (...a) => { this.addLog('error', a.map(x => (x && x.message) || String(x)).join(' ')); ce(...a); };
    const cw = console.warn.bind(console);
    console.warn = (...a) => { this.addLog('warn', a.map(String).join(' ')); cw(...a); };
    window.addEventListener('error', e => this.addLog('error', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
    window.addEventListener('unhandledrejection', e => this.addLog('error', String(e.reason)));
    const feed = UI.feed.bind(UI);
    UI.feed = (t, k) => { this.addLog(k === 'warn' ? 'warn' : 'game', String(t).replace(/<[^>]*>/g, '')); return feed(t, k); };
    // zamanlama ve oyun hızı
    const upd = G.update, ren = G.render;
    G.update = function (dt) {
      const t0 = performance.now();
      Debug.preUpdate();
      const ts = Debug.opt.timeScale, clk = this.clock;
      if (ts > 1.01) { const n = Math.ceil(ts); for (let k = 0; k < n; k++) upd.call(this, dt * ts / n); }
      else upd.call(this, dt * ts);
      if (Debug.opt.freeze && this.state === 'play') this.clock = clk;
      Debug.perf.upd = lerp(Debug.perf.upd, performance.now() - t0, 0.1);
    };
    G.render = function (dt) {
      const t0 = performance.now();
      ren.call(this, dt);
      Debug.perf.ren = lerp(Debug.perf.ren, performance.now() - t0, 0.1);
      Debug.frameTick();
    };
    // noclip ve hız çarpanı: oyuncu ve bindiği binek
    const mv = Ent.prototype.move;
    Ent.prototype.move = function (dx, dy) {
      const o = Debug.opt, P = G.player;
      if ((o.noclip || o.speed !== 1) && P && (this === P || this === P.riding)) {
        dx *= o.speed; dy *= o.speed;
        if (o.noclip) { this.x += dx; this.y += dy; return true; }
      }
      return mv.call(this, dx, dy);
    };
    // kanun görmesin
    const crime = G.crime;
    G.crime = function (...a) { if (Debug.opt.nolaw) return; return crime.apply(this, a); };
    // hile kullanılan kayıtta başarım yok
    const unlock = G.unlock, check = G.checkAchievements;
    G.unlock = function (id) { if (this.debugUsed) return; return unlock.call(this, id); };
    G.checkAchievements = function () { if (this.debugUsed) return; return check.call(this); };
    // Alt+tık ile ışınlanma
    window.addEventListener('mousedown', e => {
      if (!this.opt.clickTp || !e.altKey || G.state !== 'play' || !G.player) return;
      const [wx, wy] = this.screenToWorld(e.clientX, e.clientY);
      this.teleport(wx, wy);
      e.stopImmediatePropagation();
    }, true);
    this.build();
  },

  toggle() {
    if (!G.world || !G.player || (G.state !== 'play' && G.state !== 'dead')) return;
    if (!this.open && !this.unlocked) { this.askPin(); return; }
    this.open = !this.open;
    this.el.classList.toggle('hidden', !this.open);
    if (this.open) { this.renderTab(); this.refresh(true); }
    else { Input.textFocus = false; }
    Audio_.ui('move');
  },
  /* ---------------- şifre ----------------
     Panel 4 haneli bir şifreyle açılır (oturum boyunca bir kez sorulur).
     Şifre kaynakta düz yazılmaz; yalnızca özeti tutulur. */
  PIN_HASH: '144crf48',
  pinHash(p) {
    const f = s => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
    let h = 'fe-dbg:' + p;
    for (let i = 0; i < 5000; i++) h = f(h).toString(36) + h.length;
    return h;
  },
  askPin() {
    if (this.lockUntil && performance.now() < this.lockUntil) { UI.feed(Tr`Çok fazla hatalı deneme. ${Math.ceil((this.lockUntil - performance.now()) / 1000)} sn bekle.`, 'warn'); return; }
    if (!this.pinEl) {
      const el = this.pinEl = document.createElement('div');
      el.id = 'dbg-pin'; el.className = 'dbg-pinwrap hidden';
      el.innerHTML = `<div class="dbg dbg-pinbox">
        <div class="dbg-pinic"><svg viewBox="0 0 24 24" class="dbg-ic"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.3"/></svg></div>
        <div class="dbg-pint">${Tr('Hata ayıklama modu')}</div>
        <div class="dbg-pins" id="dbg-pinmsg">${Tr('4 haneli şifreyi gir')}</div>
        <div class="dbg-pinbox4" id="dbg-pinbox4"><i></i><i></i><i></i><i></i></div>
        <div class="dbg-keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="esc" class="fn">${Tr('İptal')}</button><button data-k="0">0</button><button data-k="del" class="fn">⌫</button></div>
      </div>`;
      document.body.appendChild(el);
      for (const ev of ['mousedown', 'mouseup', 'wheel', 'contextmenu']) el.addEventListener(ev, e => e.stopPropagation());
      el.addEventListener('click', e => {
        e.stopPropagation();
        const b = e.target.closest('button');
        if (b) { b.blur(); this.pinKey({ code: b.dataset.k === 'esc' ? 'Escape' : b.dataset.k === 'del' ? 'Backspace' : 'Digit' + b.dataset.k }); }
        else if (e.target === el) this.closePin();
      });
    }
    this.pin = { v: '' };
    this.pinEl.classList.remove('hidden');
    this.pinDraw();
    Audio_.ui('move');
  },
  pinDraw(state) {
    const boxes = this.pinEl.querySelectorAll('#dbg-pinbox4 i'), v = this.pin ? this.pin.v : '';
    boxes.forEach((b, i) => { b.className = (i < v.length ? 'on' : '') + (i === v.length ? ' cur' : '') + (state ? ' ' + state : ''); });
  },
  pinKey(e) {
    const P = this.pin;
    if (!P || P.busy) return;
    const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (e.code === 'Escape') { this.closePin(); return; }
    if (e.code === 'Backspace') { P.v = P.v.slice(0, -1); this.pinDraw(); return; }
    if (!m || P.v.length >= 4) return;
    P.v += m[1];
    this.pinDraw();
    if (P.v.length < 4) return;
    P.busy = true;
    if (this.pinHash(P.v) === this.PIN_HASH) {
      this.pinDraw('ok');
      this.unlocked = true; this.fails = 0;
      Audio_.ui('ok');
      setTimeout(() => { this.closePin(); this.toggle(); }, 260);
    } else {
      this.fails = (this.fails || 0) + 1;
      this.pinDraw('bad');
      const box = this.pinEl.querySelector('.dbg-pinbox');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      Audio_.ui('error');
      const msg = this.pinEl.querySelector('#dbg-pinmsg');
      if (this.fails >= 3) {
        this.lockUntil = performance.now() + 30000; this.fails = 0;
        msg.textContent = Tr('Çok fazla hatalı deneme. 30 sn bekle.');
        setTimeout(() => this.closePin(), 1100);
      } else {
        msg.textContent = Tr('Yanlış şifre');
        setTimeout(() => { if (this.pin) { P.v = ''; P.busy = false; this.pinDraw(); } }, 650);
      }
    }
  },
  closePin() {
    this.pin = null;
    if (this.pinEl) { this.pinEl.classList.add('hidden'); this.pinEl.querySelector('#dbg-pinmsg').textContent = Tr('4 haneli şifreyi gir'); }
  },
  /* bir hile kullanıldı: kayıt işaretlenir */
  mark() {
    if (!G.debugUsed) { G.debugUsed = true; this.refresh(true); }
  },
  addLog(kind, msg) {
    const d = new Date();
    this.log.push({ kind, msg: msg.slice(0, 400), t: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}` });
    if (this.log.length > 300) this.log.shift();
    if (this.open && this.tab === 'log') this._logDirty = true;
    if (kind === 'error' && this.badge) this.badge.classList.add('on');
  },

  /* ---------------- her kare ---------------- */
  preUpdate() {
    const P = G.player, o = this.opt;
    if (!P || G.state !== 'play') return;
    G.godMode = o.god;
    if (o.ammo) for (const w of P.weapons) { const W = WEAPONS[w]; if (W.clip) P.clip[w] = W.clip; if (W.ammo) P.ammo[W.ammo] = AMMO[W.ammo].max; }
    if (o.stamina) { P.sta = P.maxSta; P.de = 100; if (P.riding && P.riding.maxSta) P.riding.sta = P.riding.maxSta; }
    if (o.nolaw && G.law.level > 0) { G.law.level = 0; for (const e of G.ents) if (e.isLaw && e.hostile && !e.personal) { e.hostile = false; e.state = 'idle'; } }
  },
  frameTick() {
    const p = this.perf, now = performance.now();
    if (p.last) { p.frames[p.fi] = now - p.last; p.fi = (p.fi + 1) % p.frames.length; }
    p.last = now;
    this.drawOverlay();
    if (!this.open) return;
    this._t = (this._t || 0) + 1;
    if (this._t % 6 === 0) this.refresh();
    if (this._t % 3 === 0) this.drawGraph();
  },

  /* ---------------- yardımcılar ---------------- */
  screenToWorld(cx, cy) {
    const c = G.canvas, r = c.getBoundingClientRect(), k = c.width / r.width;
    return [G.cam.ox + (cx - r.left) * k, G.cam.oy + (cy - r.top) * k];
  },
  ahead(d = 40) { const P = G.player, a = P.riding ? P.riding.ang : P.ang; return [P.x + Math.cos(a) * d, P.y + Math.sin(a) * d]; },
  teleport(x, y) {
    const P = G.player, W = G.world;
    if (W.blocked(x, y, 4) && !this.opt.noclip) {
      // en yakın boş yer
      for (let r = 8; r < 200; r += 8) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (!W.blocked(nx, ny, 4)) { x = nx; y = ny; r = 999; break; } }
    }
    if (P.riding) { P.riding.x = x; P.riding.y = y; if (P.riding.trail) P.riding.trail(true); }
    P.x = x; P.y = y; G.cam.x = x; G.cam.y = y;
    this.mark();
  },
  fmt(v, d = 1) { return typeof v === 'number' ? v.toFixed(d) : v; },
  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); },

  /* ---------------- panel ---------------- */
  TABS() {
    return [
      ['overview', Tr('Genel'), 'gauge'], ['player', Tr('Oyuncu'), 'user'], ['world', Tr('Dünya'), 'globe'], ['spawn', Tr('Oluştur'), 'plus'],
      ['layers', Tr('Katmanlar'), 'layers'], ['town', Tr('Kasaba'), 'home'], ['log', Tr('Günlük'), 'list'],
    ];
  },
  ICON: {
    gauge: '<path d="M12 14l4-4M4.9 17a8 8 0 1 1 14.2 0"/><circle cx="12" cy="14" r="1.6"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/>',
    plus: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
    layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16L12 20.5 20.5 16"/>',
    home: '<path d="M4 11l8-6.5 8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
    list: '<path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17" r="1"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    min: '<path d="M6 12h12"/>',
  },
  icon(n) { return `<svg viewBox="0 0 24 24" class="dbg-ic">${this.ICON[n]}</svg>`; },
  build() {
    const el = this.el = document.createElement('div');
    el.id = 'dbg'; el.className = 'dbg hidden';
    el.innerHTML = `
      <div class="dbg-head" id="dbg-drag">
        <div class="dbg-brand"><span class="dbg-dot"></span><b>DEBUG</b><span class="dbg-sub" id="dbg-sub"></span></div>
        <div class="dbg-hbtn">
          <span class="dbg-badge" id="dbg-badge" title="${Tr('Hata var')}"></span>
          <button data-a="min" title="${Tr('Küçült')}">${this.icon('min')}</button>
          <button data-a="close" title="${Tr('Kapat (Ctrl+Alt+C)')}">${this.icon('close')}</button>
        </div>
      </div>
      <div class="dbg-kpis">
        <div class="dbg-kpi"><span>FPS</span><b id="dbg-fps">–</b></div>
        <div class="dbg-kpi"><span>${Tr('Kare')}</span><b id="dbg-ft">–</b></div>
        <div class="dbg-kpi"><span>${Tr('Güncelleme')}</span><b id="dbg-upd">–</b></div>
        <div class="dbg-kpi"><span>${Tr('Çizim')}</span><b id="dbg-ren">–</b></div>
        <canvas id="dbg-graph" width="720" height="84"></canvas>
      </div>
      <nav class="dbg-tabs" id="dbg-tabs"></nav>
      <div class="dbg-body" id="dbg-body"></div>
      <div class="dbg-foot" id="dbg-foot"></div>`;
    document.body.appendChild(el);
    this.badge = el.querySelector('#dbg-badge');
    this.ov = document.createElement('canvas');
    this.ov.id = 'dbg-ov';
    document.body.appendChild(this.ov);
    // panel oyunun fare ve klavye girdisini yutmasın
    for (const ev of ['mousedown', 'mouseup', 'click', 'wheel', 'contextmenu']) el.addEventListener(ev, e => e.stopPropagation());
    el.addEventListener('focusin', e => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) Input.textFocus = true; });
    el.addEventListener('focusout', () => { Input.textFocus = false; });
    el.addEventListener('keydown', e => { if (e.code !== 'KeyC' || !e.ctrlKey) e.stopPropagation(); });
    el.addEventListener('click', e => this.onClick(e));
    el.addEventListener('input', e => this.onInput(e));
    el.addEventListener('change', e => this.onInput(e));
    // sürükleme
    const hd = el.querySelector('#dbg-drag');
    hd.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      hd.setPointerCapture(e.pointerId);
      const mvh = ev => { el.style.left = clamp(ev.clientX - ox, 0, innerWidth - 120) + 'px'; el.style.top = clamp(ev.clientY - oy, 0, innerHeight - 40) + 'px'; el.style.right = 'auto'; };
      const up = () => { hd.removeEventListener('pointermove', mvh); hd.removeEventListener('pointerup', up); };
      hd.addEventListener('pointermove', mvh); hd.addEventListener('pointerup', up);
    });
  },
  renderTabs() {
    this.el.querySelector('#dbg-tabs').innerHTML = this.TABS().map(([id, n, ic]) => `<button class="dbg-tab ${this.tab === id ? 'on' : ''}" data-tab="${id}" title="${n}">${this.icon(ic)}<span>${n}</span></button>`).join('');
  },

  /* ---- küçük arayüz yapı taşları ---- */
  sec(title, body, extra = '') { return `<section class="dbg-sec"><header>${title}${extra}</header>${body}</section>`; },
  rows(list) { return `<div class="dbg-rows">${list.map(([k, id]) => `<div class="dbg-r"><span>${k}</span><b id="dbg-v-${id}">–</b></div>`).join('')}</div>`; },
  tog(key, label, hint = '') { return `<label class="dbg-tog"><input type="checkbox" data-opt="${key}" ${this.opt[key] ? 'checked' : ''}><i></i><span>${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`; },
  slider(key, label, min, max, step, val, unit = '') { return `<div class="dbg-sl"><div class="dbg-slh"><span>${label}</span><b id="dbg-sv-${key}">${val}${unit}</b></div><input type="range" data-sl="${key}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`; },
  btn(label, act, cls = '') { return `<button class="dbg-btn ${cls}" data-act="${act}">${label}</button>`; },
  btns(list) { return `<div class="dbg-btns">${list.join('')}</div>`; },
  sel(id, options, val) { return `<select class="dbg-in" id="${id}">${options.map(([v, n]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${this.esc(n)}</option>`).join('')}</select>`; },

  renderTab() {
    this.renderTabs();
    const b = this.el.querySelector('#dbg-body');
    const P = G.player, W = G.world, o = this.opt;
    let h = '';
    switch (this.tab) {
      case 'overview':
        h += this.sec(Tr('Konum'), this.rows([[Tr('Piksel'), 'px'], [Tr('Karo / chunk'), 'tile'], [Tr('Zemin'), 'ground'], [Tr('Bölge'), 'region'], [Tr('Kasaba / bina'), 'place']]));
        h += this.sec(Tr('Zaman ve hava'), this.rows([[Tr('Saat'), 'time'], [Tr('Tarih'), 'date'], [Tr('Hava'), 'weather'], [Tr('Sıcaklık'), 'temp']]));
        h += this.sec(Tr('Varlıklar'), this.rows([[Tr('Toplam'), 'ents'], ['NPC', 'npcs'], [Tr('Hayvan / at'), 'animals'], [Tr('Araba / diğer'), 'other'], [Tr('Parçacık / mermi'), 'parts'], [Tr('Chunk önbelleği'), 'chunks']]));
        h += this.sec(Tr('Kanun ve onur'), this.rows([[Tr('Aranma'), 'law'], [Tr('Tanıklar'), 'wit'], [Tr('Onur'), 'honor']]));
        h += this.sec(Tr('Oturum'), this.rows([[Tr('Dünya tohumu'), 'seed'], [Tr('Bellek'), 'mem'], [Tr('Başarımlar'), 'ach']]) + this.btns([this.btn(Tr('Kaydet'), 'save'), this.btn(Tr('Kaydı yükle'), 'load', 'ghost')]));
        break;
      case 'player':
        h += this.sec(Tr('Hileler'), this.tog('god', Tr('Ölümsüzlük'), Tr('Hasar almazsın')) + this.tog('ammo', Tr('Sınırsız mermi')) + this.tog('stamina', Tr('Sınırsız dayanıklılık ve odak'), Tr('Binek dahil')) + this.tog('noclip', Tr('Duvarlardan geç'), Tr('Çarpışma kapalı')) + this.tog('nolaw', Tr('Kanun görmez'), Tr('Suçlar kaydedilmez, aranma sıfırlanır')) + this.slider('speed', Tr('Hareket hızı'), 0.5, 5, 0.25, o.speed, '×'));
        h += this.sec(Tr('Durum'), this.btns([this.btn(Tr('Canı doldur'), 'heal'), this.btn(Tr('İhtiyaçları doldur'), 'needs'), this.btn(Tr('Temizlen'), 'clean')]) + this.btns([this.btn('+$1', 'money1'), this.btn('+$10', 'money10'), this.btn('+$100', 'money100'), this.btn('+$1000', 'money1000')]) + this.slider('honor', Tr('Onur'), -100, 100, 1, Math.round(G.honor)));
        h += this.sec(Tr('Donanım'), this.btns([this.btn(Tr('Bütün silahlar'), 'weapons'), this.btn(Tr('Mermileri doldur'), 'refill'), this.btn(Tr('Yetenekler 10'), 'skills')]) +
          `<div class="dbg-line">${this.sel('dbg-item', Object.keys(ITEMS).map(id => [id, ITEMS[id].n]).sort((a, b) => a[1].localeCompare(b[1])), 'bread')}<input class="dbg-in num" id="dbg-qty" type="number" min="1" max="99" value="1">${this.btn(Tr('Ver'), 'give', 'pri')}</div>`);
        h += this.sec(Tr('At'), this.btns([this.btn(Tr('Atı yanına getir'), 'horseHere'), this.btn(Tr('Atı iyileştir'), 'horseHeal'), this.btn(Tr('Bağ en yüksek'), 'horseBond')]));
        h += this.sec(Tr('Kanun'), this.btns([this.btn(Tr('Aranmayı temizle'), 'clearLaw'), this.btn(Tr('+$10 ödül'), 'addBounty', 'ghost')]));
        break;
      case 'world':
        h += this.sec(Tr('Zaman'), this.slider('hour', Tr('Saat'), 0, 23.75, 0.25, +(G.hour).toFixed(2), '') + this.btns([this.btn('+1 ' + Tr('saat'), 'h1'), this.btn('+6 ' + Tr('saat'), 'h6'), this.btn('+1 ' + Tr('gün'), 'd1'), this.btn(Tr('Sonraki mevsim'), 'season')]) + this.slider('timeScale', Tr('Oyun hızı'), 0.25, 8, 0.25, o.timeScale, '×') + this.tog('freeze', Tr('Saati dondur')));
        h += this.sec(Tr('Hava'), `<div class="dbg-seg" id="dbg-wx">${[['clear', Tr('Açık hava')], ['cloudy', Tr('Bulutlu')], ['rain', Tr('Yağmurlu')], ['storm', Tr('Fırtınalı')], ['fog', Tr('Sisli')]].map(([k, n]) => `<button data-wx="${k}" class="${G.weather.type === k ? 'on' : ''}">${n}</button>`).join('')}</div>`);
        h += this.sec(Tr('Harita'), this.btns([this.btn(Tr('Haritayı aç'), 'reveal'), this.btn(Tr('Bütün yerleri keşfet'), 'discover'), this.btn(Tr('Kasabaları ziyaret et'), 'visit')]));
        h += this.sec(Tr('Işınlan'), `<div class="dbg-line">${this.sel('dbg-tp', [...W.towns.map(t => ['t:' + t.id, '🏠 ' + t.n]), ...W.pois.filter(p => p.n).map(p => ['p:' + p.id, '• ' + p.n])], '')}${this.btn(Tr('Git'), 'tp', 'pri')}</div>` + this.btns([this.btn(Tr('Hedef noktaya'), 'tpWaypoint'), this.btn(Tr('Atın yanına'), 'tpHorse', 'ghost')]) + this.tog('clickTp', Tr('Alt + tık ile ışınlan'), Tr('Ekranda tıkladığın yere')));
        break;
      case 'spawn':
        h += this.sec(Tr('İnsan'), `<div class="dbg-line">${this.sel('dbg-npc', [['town', Tr('Kasabalı')], ['traveler', Tr('Gezgin')], ['rider', Tr('Atlı gezgin')], ['bandit', Tr('Haydut (düşman)')], ['banditR', Tr('Atlı haydut')], ['law', Tr('Kanun adamı')], ['lawR', Tr('Atlı kanun adamı')]], 'bandit')}${this.btn(Tr('Oluştur'), 'spawnNpc', 'pri')}</div>`);
        h += this.sec(Tr('Hayvan'), `<div class="dbg-line">${this.sel('dbg-ani', Object.keys(ANIMALS).map(k => [k, ANIMALS[k].n]), 'deer')}<input class="dbg-in num" id="dbg-anin" type="number" min="1" max="12" value="1">${this.btn(Tr('Oluştur'), 'spawnAni', 'pri')}</div>`);
        h += this.sec(Tr('Araç ve binek'), this.btns([this.btn(Tr('Yük arabası'), 'wagon'), this.btn(Tr('Posta arabası'), 'stage'), this.btn(Tr('Sahipsiz at'), 'horse')]));
        h += this.sec(Tr('Temizle'), this.btns([this.btn(Tr('Düşmanları öldür'), 'killHostile', 'warn'), this.btn(Tr('Cesetleri kaldır'), 'clearDead', 'ghost'), this.btn(Tr('Yakındaki hayvanları sil'), 'clearAni', 'ghost')]));
        break;
      case 'layers':
        h += this.sec(Tr('Dünya katmanları'), this.tog('ovHit', Tr('Çarpışma çemberleri'), Tr('Varlık türüne göre renkli')) + this.tog('ovSolid', Tr('Engel karoları'), Tr('Duvar, kapı, iç duvar')) + this.tog('ovChunks', Tr('Chunk ve karo ızgarası')));
        h += this.sec(Tr('Yapay zekâ'), this.tog('ovLabels', Tr('NPC etiketleri'), Tr('Ad, durum, plan, can')) + this.tog('ovRoutes', Tr('Sakin rotaları'), Tr('A* yolu ve hedef')) + this.tog('ovWagons', Tr('Araba rotaları'), Tr('Yol noktası ve çeki')) + this.tog('ovLaw', Tr('Kanun ve tanıklar'), Tr('Arama alanı, tanık hedefleri')));
        h += this.sec(Tr('Oyuncu'), this.tog('ovAim', Tr('Nişan ve etkileşim'), Tr('Nişan konisi, kilit, etkileşim hedefi')) + this.tog('hideHud', Tr('Arayüzü gizle'), Tr('Ekran görüntüsü için')));
        break;
      case 'town': {
        const cur = W.townAt(P.x, P.y, 40) || G.nearestTown(P.x, P.y);
        const sel = this.townSel || cur.id;
        h += `<div class="dbg-line">${this.sel('dbg-town', W.towns.map(t => [t.id, t.n + (t.spawned ? ' ●' : '')]), sel)}${this.btn(Tr('Yeniden yükle'), 'townReload', 'ghost')}</div>`;
        h += this.sec(Tr('Nüfus'), this.rows([[Tr('Sakin'), 'tpop'], [Tr('Dışarıda'), 'tout'], [Tr('İçeride'), 'tin'], [Tr('Kasaba dışında / ölü'), 'taway']]) + this.btns([this.btn(Tr('Herkes sevsin'), 'loveTown'), this.btn(Tr('Hafızayı sıfırla'), 'forget', 'ghost')]));
        h += `<div class="dbg-table" id="dbg-res"></div>`;
        break;
      }
      case 'log':
        h += `<div class="dbg-seg sm" id="dbg-lf">${[['all', Tr('Tümü')], ['error', Tr('Hatalar')], ['warn', Tr('Uyarılar')], ['game', Tr('Oyun')]].map(([k, n]) => `<button data-lf="${k}" class="${this.logFilter === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
        h += `<div class="dbg-log" id="dbg-log"></div>` + this.btns([this.btn(Tr('Temizle'), 'logClear', 'ghost'), this.btn(Tr('Kopyala'), 'logCopy', 'ghost')]);
        this.badge.classList.remove('on');
        break;
    }
    b.innerHTML = h;
    this.refresh(true);
  },

  /* ---- canlı değerler ---- */
  set(id, v) { const e = this.el.querySelector('#dbg-v-' + id); if (e && e._v !== v) { e._v = v; e.innerHTML = v; } },
  refresh(force) {
    if (!this.open) return;
    const P = G.player, W = G.world, p = this.perf;
    let sum = 0, n = 0, worst = 0;
    for (const f of p.frames) if (f > 0) { sum += f; n++; worst = Math.max(worst, f); }
    const avg = n ? sum / n : 16.7;
    const q = (id, v, cls) => { const e = this.el.querySelector(id); if (e) { e.textContent = v; e.className = cls || ''; } };
    q('#dbg-fps', Math.round(1000 / avg), avg > 33 ? 'bad' : avg > 20 ? 'mid' : 'good');
    q('#dbg-ft', avg.toFixed(1) + ' ms', worst > 50 ? 'mid' : '');
    q('#dbg-upd', p.upd.toFixed(2) + ' ms');
    q('#dbg-ren', p.ren.toFixed(2) + ' ms');
    this.el.querySelector('#dbg-sub').textContent = `${G.timeStr()} • ${Tr('Gün')} ${G.day + 1}`;
    this.el.querySelector('#dbg-foot').innerHTML = G.debugUsed ? `<span class="warn">●</span> ${Tr('Bu kayıtta hile kullanıldı: başarımlar kapalı.')}` : `<span>●</span> ${Tr('Bilgi ve katmanlar kaydı etkilemez.')} <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>C</kbd>`;
    switch (this.tab) {
      case 'overview': {
        const tx = P.x >> 4, ty = P.y >> 4, t = W.townAt(P.x, P.y, 20), env = G.envCache || {};
        this.set('px', `${Math.round(P.x)}, ${Math.round(P.y)}`);
        this.set('tile', `${tx}, ${ty} <i>/</i> ${Math.floor(P.x / CPX)}, ${Math.floor(P.y / CPX)}`);
        this.set('ground', `${W.biomeAt(P.x, P.y)} <i>${Tr('yükselti')} ${W.elev[ty * WW + tx]}</i>`);
        this.set('region', W.regionAt(P.x, P.y));
        this.set('place', (t ? t.n : '—') + (G.insideB ? ` <i>/ ${G.insideB.name}</i>` : ''));
        this.set('time', `${G.timeStr()} <i>${G.isNight ? Tr('gece') : Tr('gündüz')}</i>`);
        this.set('date', `${G.dateStr()} <i>• ${G.age} ${Tr('yaş')}</i>`);
        const wn = { clear: Tr('Açık hava'), cloudy: Tr('Bulutlu'), rain: Tr('Yağmurlu'), storm: Tr('Fırtınalı'), fog: Tr('Sisli') }[G.weather.type] || G.weather.type;
        this.set('weather', `${wn} <i>i ${G.weather.i.toFixed(2)} • ${Tr('yağmur')} ${(env.rain || 0).toFixed(2)}</i>`);
        this.set('temp', `${G.feltTemp.toFixed(1)}° <i>${Tr('ortam')} ${G.ambientTemp(P.x, P.y).toFixed(1)}° • ${Tr('ateş')} +${(G.fireHeat || 0).toFixed(0)}</i>`);
        const k = {}; for (const e of G.ents) k[e.kind] = (k[e.kind] || 0) + 1;
        const npcs = G.ents.filter(e => e.kind === 'npc'), res = npcs.filter(e => e.res).length, host = npcs.filter(e => e.hostile && !e.dead).length;
        this.set('ents', G.ents.length);
        this.set('npcs', `${npcs.length} <i>${Tr('sakin')} ${res} • ${Tr('düşman')} ${host}</i>`);
        this.set('animals', `${k.animal || 0} / ${k.horse || 0}`);
        this.set('other', `${k.wagon || 0} / ${(k.pelt || 0) + (k.prop || 0) + (k.camp || 0)}`);
        this.set('parts', `${G.parts.list.length} / ${G.projs.length}`);
        this.set('chunks', W.chunks.size);
        this.set('law', `${'★'.repeat(G.law.level)}${'☆'.repeat(5 - G.law.level)} <i>${fmtMoney(G.law.bounty)}</i>`);
        this.set('wit', G.reports.filter(r => !r.done).reduce((a, r) => a + r.ws.length, 0));
        this.set('honor', Math.round(G.honor));
        this.set('seed', G.seed);
        this.set('mem', performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : '—');
        this.set('ach', G.debugUsed ? `<span class="warn">${Tr('kapalı')}</span>` : `${Object.keys(G.achieved).length} / ${ACHIEVEMENTS.length}`);
        break;
      }
      case 'player': {
        const s = this.el.querySelector('[data-sl="honor"]');
        if (s && document.activeElement !== s) { s.value = Math.round(G.honor); this.el.querySelector('#dbg-sv-honor').textContent = Math.round(G.honor); }
        break;
      }
      case 'world': {
        const s = this.el.querySelector('[data-sl="hour"]');
        if (s && document.activeElement !== s) { s.value = G.hour.toFixed(2); this.el.querySelector('#dbg-sv-hour').textContent = G.timeStr(); }
        this.el.querySelectorAll('#dbg-wx button').forEach(b => b.classList.toggle('on', b.dataset.wx === G.weather.type));
        break;
      }
      case 'town': this.refreshTown(force); break;
      case 'log': if (force || this._logDirty) this.refreshLog(); break;
    }
  },
  refreshTown() {
    const W = G.world, id = (this.el.querySelector('#dbg-town') || {}).value;
    const t = W.towns.find(x => x.id === id);
    if (!t) return;
    const R = G.residents(t);
    const out = R.filter(r => r.ent && !r.dead), inside = R.filter(r => !r.ent && r.inside && r.inside !== 'away' && !r.dead);
    this.set('tpop', `${R.length} <i>${t.spawned ? Tr('yüklü') : Tr('yüklü değil')}</i>`);
    this.set('tout', out.length); this.set('tin', inside.length);
    this.set('taway', `${R.filter(r => r.inside === 'away').length} / ${R.filter(r => r.dead).length}`);
    const tb = this.el.querySelector('#dbg-res');
    if (!tb) return;
    const rows = R.map((r, i) => {
      const e = r.ent, m = G.resMem && G.resMem[r.id], op = m ? Math.round(m.op || 0) : 0;
      const where = r.dead ? `<span class="bad">${Tr('ölü')}</span>` : e ? (e.staffOf ? Tr('tezgâhta') : e.state) : r.inside === 'away' ? Tr('kasaba dışı') : r.inside ? r.inside.name || r.inside.type : '—';
      const plan = e && e.plan ? e.plan.act : r.dead ? '' : G.schedule(r).act;
      return `<div class="dbg-tr ${e ? 'live' : ''}" data-res="${i}"><span class="n">${this.esc(r.name)}<small>${this.esc(G.occName(r))}</small></span><span>${plan}</span><span>${where}</span><span class="${op > 20 ? 'good' : op < -20 ? 'bad' : ''}">${op}</span></div>`;
    }).join('');
    const html = `<div class="dbg-tr hd"><span>${Tr('Ad / meslek')}</span><span>${Tr('Plan')}</span><span>${Tr('Nerede')}</span><span>${Tr('Fikir')}</span></div>` + rows;
    if (tb._h !== html) { tb._h = html; tb.innerHTML = html; }
  },
  refreshLog() {
    this._logDirty = false;
    const L = this.el.querySelector('#dbg-log');
    if (!L) return;
    const f = this.logFilter, list = this.log.filter(l => f === 'all' || l.kind === f).slice(-150);
    L.innerHTML = list.length ? list.map(l => `<div class="dbg-ll ${l.kind}"><time>${l.t}</time><span>${this.esc(l.msg)}</span></div>`).join('') : `<div class="dbg-empty">${Tr('Kayıt yok')}</div>`;
    L.scrollTop = L.scrollHeight;
  },
  drawGraph() {
    const c = this.el.querySelector('#dbg-graph');
    if (!c) return;
    const x = c.getContext('2d'), w = c.width, h = c.height, p = this.perf, N = p.frames.length;
    x.clearRect(0, 0, w, h);
    const y = ms => h - Math.min(1, ms / 50) * (h - 6) - 3;
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 2;
    for (const ms of [16.7, 33.3]) { x.beginPath(); x.moveTo(0, y(ms)); x.lineTo(w, y(ms)); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,0.28)'; x.font = '18px ui-monospace, monospace'; x.fillText('60', 6, y(16.7) - 5); x.fillText('30', 6, y(33.3) - 5);
    const grad = x.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(245,165,36,0.35)'); grad.addColorStop(1, 'rgba(245,165,36,0)');
    x.beginPath(); x.moveTo(0, h);
    for (let k = 0; k < N; k++) x.lineTo(k / (N - 1) * w, y(p.frames[(p.fi + k) % N]));
    x.lineTo(w, h); x.closePath(); x.fillStyle = grad; x.fill();
    x.beginPath();
    for (let k = 0; k < N; k++) { const v = p.frames[(p.fi + k) % N]; k ? x.lineTo(k / (N - 1) * w, y(v)) : x.moveTo(0, y(v)); }
    x.strokeStyle = '#f5a524'; x.lineWidth = 2.5; x.stroke();
  },

  /* ---------------- olaylar ---------------- */
  onClick(e) {
    const t = e.target.closest('button,[data-res]');
    if (!t) return;
    if (t.tagName === 'BUTTON') t.blur();
    if (t.dataset.a === 'close') return this.toggle();
    if (t.dataset.a === 'min') { this.el.classList.toggle('min'); return; }
    if (t.dataset.tab) { this.tab = t.dataset.tab; this.renderTab(); return; }
    if (t.dataset.wx) return this.setWeather(t.dataset.wx);
    if (t.dataset.lf) { this.logFilter = t.dataset.lf; this.renderTab(); return; }
    if (t.dataset.res !== undefined) {
      const tw = G.world.towns.find(x => x.id === this.el.querySelector('#dbg-town').value), r = G.residents(tw)[+t.dataset.res];
      if (r && r.ent) this.teleport(r.ent.x + 14, r.ent.y + 10);
      else if (r && r.inside && r.inside.door) this.teleport(r.inside.door.x, r.inside.door.y + 14);
      return;
    }
    if (t.dataset.act) this.act(t.dataset.act);
  },
  onInput(e) {
    const t = e.target;
    if (t.dataset.opt) {
      this.opt[t.dataset.opt] = t.checked;
      if (t.dataset.opt === 'hideHud') document.body.classList.toggle('dbg-nohud', t.checked);
      if (['god', 'ammo', 'stamina', 'noclip', 'nolaw', 'clickTp'].includes(t.dataset.opt) && t.checked) this.mark();
      if (t.dataset.opt === 'god' && !t.checked) G.godMode = false;
      return;
    }
    if (t.dataset.sl) {
      const k = t.dataset.sl, v = +t.value, lab = this.el.querySelector('#dbg-sv-' + k);
      if (k === 'hour') { G.clock = G.day * 1440 + v * 60; if (lab) lab.textContent = G.timeStr(); this.mark(); return; }
      if (k === 'honor') { G.honor = v; if (lab) lab.textContent = v; this.mark(); return; }
      this.opt[k] = v; if (lab) lab.textContent = v + (t.dataset.unit || '');
      if (k === 'speed' && v !== 1) this.mark();
      return;
    }
    if (t.id === 'dbg-town' && e.type === 'change') { this.townSel = t.value; this.refreshTown(true); }
  },
  setWeather(type) {
    const W = G.weather;
    W.type = type; W.t = 600;
    W.i = type === 'storm' ? 1 : type === 'rain' ? 0.6 : 0;
    W.cloud = type === 'clear' ? 0 : type === 'fog' ? 0.4 : type === 'cloudy' ? 0.5 : 0.8;
    W.fogI = type === 'fog' ? 1 : 0;
    G.envCache = G.localWeather(G.player.x, G.player.y);
    this.refresh(true);
  },
  spawnNpc(kind) {
    const [x, y] = this.ahead(50);
    const mounted = kind.endsWith('R') || kind === 'rider';
    const role = kind.replace(/R$/, '') === 'rider' ? 'traveler' : kind.replace(/R$/, '');
    const n = new NPC(x, y, role, { hostile: role === 'bandit', mounted, home: { x, y, r: 80 } });
    if (role === 'bandit') n.aggro = true;
    n.ang = Math.atan2(G.player.y - y, G.player.x - x);
    G.addEnt(n);
  },
  act(a) {
    const P = G.player, W = G.world;
    const money = { money1: 1, money10: 10, money100: 100, money1000: 1000 }[a];
    if (money) { P.money += money; this.mark(); return; }
    switch (a) {
      case 'save': G.saveGame(); break;
      case 'load': G.loadGame(); this.toggle(); break;
      case 'heal': P.hp = P.maxHp; P.poison = 0; this.mark(); break;
      case 'needs': P.hunger = P.thirst = P.energy = 100; P.sick = 0; P.poison = 0; this.mark(); break;
      case 'clean': P.clean = 100; break;
      case 'weapons': for (const w of Object.keys(WEAPONS)) if (w !== 'fists' && !WEAPONS[w].throw) P.giveWeapon(w, true); this.act('refill'); this.mark(); break;
      case 'refill': for (const k of Object.keys(AMMO)) P.ammo[k] = AMMO[k].max; for (const w of P.weapons) if (WEAPONS[w].clip) P.clip[w] = WEAPONS[w].clip; this.mark(); break;
      case 'skills': for (const k in G.skills) G.skills[k].lv = 10; this.mark(); break;
      case 'give': { const id = this.el.querySelector('#dbg-item').value, n = clamp(+this.el.querySelector('#dbg-qty').value || 1, 1, 99); P.addItem(id, n); this.mark(); break; }
      case 'horseHere': { const h = G.horse; if (h && !h.dead && !h.rider) { h.x = P.x + 18; h.y = P.y; h.state = 'idle'; h.spd = 0; } break; }
      case 'horseHeal': { const h = G.horse; if (h) { h.dead = false; h.hp = h.maxHp; h.sta = h.maxSta; } this.mark(); break; }
      case 'horseBond': { const h = G.horse; if (h) h.bond = 400; this.mark(); break; }
      case 'clearLaw': G.law.level = 0; G.law.bounty = 0; G.law.maskBounty = 0; for (const r of G.reports) r.done = true; G.reports = []; for (const e of G.ents) if (e.isLaw && e.hostile) { e.hostile = false; e.state = 'idle'; } this.mark(); break;
      case 'addBounty': G.law.bounty += 10; break;
      case 'h1': G.advanceClock(60); this.mark(); break;
      case 'h6': G.advanceClock(360); this.mark(); break;
      case 'd1': G.advanceClock(1440); this.mark(); break;
      case 'season': { const per = G.dpy / 4, d = G.day % G.dpy, next = Math.floor(d / per + 1) * per; G.advanceClock(Math.max(1, Math.ceil((next - d) * 1440 - (G.clock % 1440)))); this.mark(); break; }
      case 'reveal': G.reveal.fill(1); G.rebuildFog(); this.mark(); break;
      case 'discover': for (const p of W.pois) G.discovered.add(p.id); this.mark(); break;
      case 'visit': for (const t of W.towns) G.visited.add(t.id); this.mark(); break;
      case 'tp': {
        const v = this.el.querySelector('#dbg-tp').value, [k, id] = [v.slice(0, 1), v.slice(2)];
        if (k === 't') { const t = W.towns.find(x => x.id === id); this.teleport(t.spawn.x, t.spawn.y); }
        else { const p = W.pois.find(x => String(x.id) === id); if (p) this.teleport(p.x, p.y + 30); }
        break;
      }
      case 'tpWaypoint': if (G.waypoint) this.teleport(G.waypoint.x, G.waypoint.y); else UI.feed(Tr('Haritada hedef işaretli değil.'), 'warn'); break;
      case 'tpHorse': if (G.horse && !G.horse.dead) this.teleport(G.horse.x + 16, G.horse.y); break;
      case 'spawnNpc': this.spawnNpc(this.el.querySelector('#dbg-npc').value); break;
      case 'spawnAni': { const type = this.el.querySelector('#dbg-ani').value, n = clamp(+this.el.querySelector('#dbg-anin').value || 1, 1, 12); const [x, y] = this.ahead(60); for (let k = 0; k < n; k++) G.addEnt(new Animal(x + rnd(-20, 20), y + rnd(-20, 20), type)); break; }
      case 'wagon': case 'stage': {
        // oyuncuya en yakın yol noktasına
        let best = null, bd = 1e12;
        for (const r of W.roads) for (let i = 1; i < r.pts.length - 1; i += 2) { const d = dist2(r.pts[i][0], r.pts[i][1], P.x, P.y); if (d < bd) { bd = d; best = [r, i]; } }
        if (best) G.addEnt(new Wagon(best[0], best[1], 1, a === 'stage'));
        break;
      }
      case 'horse': { const [x, y] = this.ahead(40); const h = new Horse(x, y, pick(Object.keys(HORSE_BREEDS)), { owner: 'npc' }); G.addEnt(h); break; }
      case 'killHostile': for (const e of G.ents) if (!e.dead && ((e.kind === 'npc' && (e.hostile || e.role === 'bandit')) || (e.kind === 'animal' && e.state === 'attack'))) e.hurt(9999, 'npc'); break;
      case 'clearDead': for (const e of G.ents) if (e.dead && (e.kind === 'npc' || e.kind === 'animal')) e.remove = true; break;
      case 'clearAni': for (const e of G.ents) if (e.kind === 'animal' && dist2(e.x, e.y, P.x, P.y) < 600 * 600) e.remove = true; break;
      case 'townReload': { const t = W.towns.find(x => x.id === this.el.querySelector('#dbg-town').value); if (t && t.spawned) { t.spawned = false; t._res = null; for (const e of G.ents) if (e.town === t.id) e.remove = true; } this.refreshTown(true); break; }
      case 'loveTown': { const t = W.towns.find(x => x.id === this.el.querySelector('#dbg-town').value); for (const r of G.residents(t)) G.mem(r).op = 100; this.mark(); break; }
      case 'forget': G.resMem = {}; break;
      case 'logClear': this.log = []; this.refreshLog(); break;
      case 'logCopy': { const txt = this.log.map(l => `[${l.t}] ${l.kind.toUpperCase()} ${l.msg}`).join('\n'); if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {}); UI.feed(Tr('Günlük panoya kopyalandı.')); break; }
    }
    this.refresh(true);
  },

  /* ---------------- dünya katmanları (tam çözünürlük) ---------------- */
  anyOverlay() { const o = this.opt; return o.ovHit || o.ovSolid || o.ovLabels || o.ovRoutes || o.ovWagons || o.ovAim || o.ovLaw || o.ovChunks; },
  drawOverlay() {
    const cv = this.ov;
    if (!this.anyOverlay() || G.state !== 'play') { if (cv._on) { cv._on = false; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); } return; }
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(innerWidth * dpr) || cv.height !== Math.round(innerHeight * dpr)) { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
    cv._on = true;
    const c = cv.getContext('2d'), gc = G.canvas, r = gc.getBoundingClientRect(), k = r.width / gc.width;
    const C = G.cam, P = G.player, W = G.world, o = this.opt;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    const sx = wx => r.left + (wx - C.ox) * k, sy = wy => r.top + (wy - C.oy) * k;
    const vis = (x, y, m = 40) => x > C.ox - m && x < C.ox + G.vw + m && y > C.oy - m && y < C.oy + G.vh + m;
    c.lineWidth = 1.5; c.font = '600 11px system-ui, sans-serif'; c.textBaseline = 'middle';
    const tx0 = Math.max(0, (C.ox >> 4) - 1), ty0 = Math.max(0, (C.oy >> 4) - 1), tx1 = Math.min(WW - 1, ((C.ox + G.vw) >> 4) + 1), ty1 = Math.min(WH - 1, ((C.oy + G.vh) >> 4) + 1);
    if (o.ovChunks) {
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
      c.beginPath();
      for (let x = tx0; x <= tx1; x++) { c.moveTo(sx(x * TS), sy(ty0 * TS)); c.lineTo(sx(x * TS), sy(ty1 * TS + TS)); }
      for (let y = ty0; y <= ty1; y++) { c.moveTo(sx(tx0 * TS), sy(y * TS)); c.lineTo(sx(tx1 * TS + TS), sy(y * TS)); }
      c.stroke();
      c.strokeStyle = 'rgba(80,200,255,0.55)'; c.lineWidth = 2; c.fillStyle = 'rgba(80,200,255,0.9)';
      for (let x = Math.floor(C.ox / CPX); x <= Math.floor((C.ox + G.vw) / CPX); x++) for (let y = Math.floor(C.oy / CPX); y <= Math.floor((C.oy + G.vh) / CPX); y++) {
        c.strokeRect(sx(x * CPX), sy(y * CPX), CPX * k, CPX * k);
        c.fillText(`${x},${y}`, sx(x * CPX) + 5, sy(y * CPX) + 10);
      }
    }
    if (o.ovSolid) {
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const s = W.solid[y * WW + x];
        if (!s) continue;
        c.fillStyle = s === 3 ? 'rgba(255,210,60,0.45)' : s >= 16 ? 'rgba(255,140,60,0.28)' : s === 5 ? 'rgba(120,255,120,0.32)' : 'rgba(255,60,60,0.3)';
        c.fillRect(sx(x * TS), sy(y * TS), TS * k, TS * k);
      }
    }
    const col = { npc: '#ff6b6b', animal: '#51cf66', horse: '#fcc419', wagon: '#4dabf7', pelt: '#e599f7', prop: '#adb5bd', camp: '#ffa94d' };
    if (o.ovHit) {
      for (const e of G.ents) {
        if (!vis(e.x, e.y)) continue;
        c.strokeStyle = col[e.kind] || '#fff'; c.globalAlpha = e.dead ? 0.35 : 0.9;
        c.beginPath(); c.arc(sx(e.x), sy(e.y), (e.r || 4) * k, 0, TAU); c.stroke();
        c.beginPath(); c.moveTo(sx(e.x), sy(e.y)); c.lineTo(sx(e.x + Math.cos(e.ang) * (e.r + 4)), sy(e.y + Math.sin(e.ang) * (e.r + 4))); c.stroke();
        if (e.kind === 'wagon' && e.bx !== undefined) { c.beginPath(); c.arc(sx(e.bx), sy(e.by), 9 * k, 0, TAU); c.stroke(); }
      }
      c.globalAlpha = 1; c.strokeStyle = '#fff'; c.beginPath(); c.arc(sx(P.x), sy(P.y), P.r * k, 0, TAU); c.stroke();
    }
    if (o.ovRoutes) {
      for (const e of G.ents) {
        if (!e.res || !e.route || e.dead || !vis(e.x, e.y, 400)) continue;
        c.strokeStyle = 'rgba(99,230,190,0.85)'; c.setLineDash([6, 4]); c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(sx(e.x), sy(e.y));
        for (let i = e.ri || 0; i < e.route.length; i++) c.lineTo(sx(e.route[i][0]), sy(e.route[i][1]));
        c.stroke(); c.setLineDash([]);
        if (e.goal) { c.fillStyle = 'rgba(99,230,190,0.9)'; c.beginPath(); c.arc(sx(e.goal.x), sy(e.goal.y), 4, 0, TAU); c.fill(); }
      }
    }
    if (o.ovWagons) {
      for (const w of G.ents) {
        if (w.kind !== 'wagon' || !vis(w.x, w.y, 300)) continue;
        const pt = w.route ? w.route[w.ri] : w.path && w.path[w.pi + w.dir];
        c.strokeStyle = '#4dabf7'; c.lineWidth = 1.5;
        if (pt) { c.setLineDash([4, 4]); c.beginPath(); c.moveTo(sx(w.x), sy(w.y)); c.lineTo(sx(pt[0]), sy(pt[1])); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(sx(pt[0]), sy(pt[1]), 5, 0, TAU); c.stroke(); }
        if (w.bx !== undefined) { c.beginPath(); c.moveTo(sx(w.x), sy(w.y)); c.lineTo(sx(w.x - Math.cos(w.ang) * 8), sy(w.y - Math.sin(w.ang) * 8)); c.lineTo(sx(w.bx), sy(w.by)); c.stroke(); }
        this.tag(c, sx(w.x), sy(w.y) - 22, `${w.stage ? 'stage' : 'freight'} ${Math.round(w.spd)}px/s ${w.parkT > 0 ? 'park ' + w.parkT.toFixed(0) : w.leg || ''}${w.driver ? '' : ' · no driver'}`, '#4dabf7');
      }
    }
    if (o.ovLaw) {
      const L = G.law;
      if (L.level > 0) { c.strokeStyle = 'rgba(255,80,80,0.8)'; c.setLineDash([8, 6]); c.beginPath(); c.arc(sx(L.lastX), sy(L.lastY), L.radius * k, 0, TAU); c.stroke(); c.setLineDash([]); }
      for (const e of G.ents) {
        if (e.kind !== 'npc' || e.dead) continue;
        if (e.witness && e.rTarget) { c.strokeStyle = 'rgba(255,170,60,0.9)'; c.beginPath(); c.moveTo(sx(e.x), sy(e.y)); c.lineTo(sx(e.rTarget.x), sy(e.rTarget.y)); c.stroke(); }
        if (e.isLaw && vis(e.x, e.y)) { c.strokeStyle = e.hostile ? 'rgba(255,80,80,0.5)' : 'rgba(120,160,255,0.35)'; c.beginPath(); c.arc(sx(e.x), sy(e.y), 260 * k, 0, TAU); c.stroke(); }
      }
    }
    if (o.ovAim) {
      const a = P.aimAng, R = (P.W && P.W.range) || 200;
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.moveTo(sx(P.x), sy(P.y)); c.arc(sx(P.x), sy(P.y), R * k, a - 0.35, a + 0.35); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#ffd43b'; c.beginPath(); c.moveTo(sx(P.x), sy(P.y)); c.lineTo(sx(P.x + Math.cos(a) * P.aimDist), sy(P.y + Math.sin(a) * P.aimDist)); c.stroke();
      if (P.lockTarget) { c.strokeStyle = '#ff6b6b'; c.lineWidth = 2; c.beginPath(); c.arc(sx(P.lockTarget.x), sy(P.lockTarget.y), 12, 0, TAU); c.stroke(); c.lineWidth = 1.5; }
      const it = UI.curInteract;
      if (it) { c.strokeStyle = '#63e6be'; c.beginPath(); c.arc(sx(it.x), sy(it.y), 10, 0, TAU); c.stroke(); this.tag(c, sx(it.x), sy(it.y) + 20, it.label, '#63e6be'); }
      this.tag(c, sx(P.x), sy(P.y) + 26, `steady ${(P.aimSteady || 0).toFixed(2)}${P.lockTarget ? ' · lock' : ''}`, '#ffd43b');
    }
    if (o.ovLabels) {
      for (const e of G.ents) {
        if (e.kind !== 'npc' || !vis(e.x, e.y)) continue;
        const plan = e.plan ? e.plan.act : e.role;
        const line = `${e.name.split(' ')[0]} · ${e.state}${plan ? ' · ' + plan : ''}${e.hostile ? ' · !' : ''} · ${Math.round(e.hp)}`;
        this.tag(c, sx(e.x), sy(e.y) - 26, line, e.hostile ? '#ff6b6b' : e.res ? '#63e6be' : e.isLaw ? '#74c0fc' : '#dee2e6');
      }
      for (const e of G.ents) if (e.kind === 'animal' && !e.dead && vis(e.x, e.y)) this.tag(c, sx(e.x), sy(e.y) - 18, `${e.type} · ${e.state}`, '#51cf66');
    }
  },
  tag(c, x, y, text, col) {
    const w = c.measureText(text).width + 10;
    c.fillStyle = 'rgba(12,14,18,0.78)'; c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - 8, w, 16, 5) : c.rect(x - w / 2, y - 8, w, 16); c.fill();
    c.fillStyle = col; c.textAlign = 'center'; c.fillText(text, x, y + 0.5); c.textAlign = 'left';
  },
};
Debug.install();
