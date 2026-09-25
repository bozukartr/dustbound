'use strict';
/* ==========================================================
   FRONTIER'S END — giriş: klavye, fare ve PlayStation kolu
   ========================================================== */

/* PS standart eşleme indeksleri */
const PS = { X: 0, O: 1, SQ: 2, TRI: 3, L1: 4, R1: 5, L2: 6, R2: 7, SHARE: 8, OPT: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, PSB: 16, TP: 17 };

/* Değiştirilebilir oyun eylemleri (klavye ve kol ayrı) */
const GAME_ACTIONS = [
  { id: 'moveUp', n: 'İleri', kbOnly: 1 }, { id: 'moveDown', n: 'Geri', kbOnly: 1 }, { id: 'moveLeft', n: 'Sol', kbOnly: 1 }, { id: 'moveRight', n: 'Sağ', kbOnly: 1 },
  { id: 'sprint', n: 'Koş / Dörtnala' }, { id: 'interact', n: 'Etkileşim / Ata Bin' }, { id: 'aim', n: 'Nişan Al' }, { id: 'fire', n: 'Ateş Et' },
  { id: 'reload', n: 'Şarjör Değiştir' }, { id: 'melee', n: 'Yakın Dövüş' }, { id: 'crouch', n: 'Çömel / Gizlen' }, { id: 'deadeye', n: 'Odak' },
  { id: 'wheel', n: 'Silah Çarkı' }, { id: 'quick', n: 'Hızlı İyileş / Ye' }, { id: 'whistle', n: 'Atı Çağır' }, { id: 'lantern', n: 'Fener' },
  { id: 'mask', n: 'Maske Tak / Çıkar' }, { id: 'satchel', n: 'Çanta' }, { id: 'camp', n: 'Kamp Kur (basılı)' }, { id: 'map', n: 'Harita' },
  { id: 'journal', n: 'Günlük' }, { id: 'pause', n: 'Duraklat' }, { id: 'zoomIn', n: 'Yakınlaştır (Piksel Ölçeği +)' }, { id: 'zoomOut', n: 'Uzaklaştır (Piksel Ölçeği −)' },
];
const DEFAULT_KB = {
  moveUp: ['KeyW'], moveDown: ['KeyS'], moveLeft: ['KeyA'], moveRight: ['KeyD'], sprint: ['ShiftLeft'], interact: ['KeyE'], aim: ['Mouse2'], fire: ['Mouse0'],
  reload: ['KeyR'], melee: ['KeyF'], crouch: ['KeyC'], deadeye: ['KeyQ'], wheel: ['Tab'], quick: ['KeyT'], whistle: ['KeyH'], lantern: ['KeyL'],
  mask: ['KeyV'], satchel: ['KeyI'], camp: ['KeyB'], map: ['KeyM'], journal: ['KeyJ'], pause: ['KeyP'], zoomIn: ['Equal', 'NumpadAdd'], zoomOut: ['Minus', 'NumpadSubtract'],
};
const DEFAULT_PAD = {
  sprint: PS.X, interact: PS.TRI, aim: PS.L2, fire: PS.R2, reload: PS.SQ, melee: PS.O, crouch: PS.L3, deadeye: PS.R3, wheel: PS.L1, quick: PS.R1,
  whistle: PS.UP, lantern: PS.LEFT, mask: null, satchel: PS.RIGHT, camp: PS.DOWN, map: PS.TP, journal: PS.SHARE, pause: PS.OPT, zoomIn: null, zoomOut: null,
};
/* Her zaman geçerli ek tuşlar (değiştirilemez) */
const FIXED_KB = { moveUp: ['ArrowUp'], moveDown: ['ArrowDown'], moveLeft: ['ArrowLeft'], moveRight: ['ArrowRight'], pause: ['Escape'] };

/* Menü tuşları (sabit) */
const BINDS = {
  confirm:  { k: ['Enter', 'Space'], p: PS.X },
  back:     { k: ['Escape', 'Backspace'], p: PS.O },
  alt:      { k: ['KeyX'], p: PS.SQ },
  alt2:     { k: ['KeyY', 'KeyE'], p: PS.TRI },
  tabL:     { k: ['KeyQ', 'PageUp'], p: PS.L1 },
  tabR:     { k: ['KeyE', 'PageDown'], p: PS.R1 },
  up:       { k: ['ArrowUp', 'KeyW'], p: PS.UP, ax: [1, -1] },
  down:     { k: ['ArrowDown', 'KeyS'], p: PS.DOWN, ax: [1, 1] },
  left:     { k: ['ArrowLeft', 'KeyA'], p: PS.LEFT, ax: [0, -1] },
  right:    { k: ['ArrowRight', 'KeyD'], p: PS.RIGHT, ax: [0, 1] },
};

const GLYPH_PS = {
  [PS.X]: ['✕', 'x'], [PS.O]: ['○', 'o'], [PS.SQ]: ['□', 'sq'], [PS.TRI]: ['△', 'tri'], [PS.L1]: ['L1', 'sh'], [PS.R1]: ['R1', 'sh'], [PS.L2]: ['L2', 'sh'], [PS.R2]: ['R2', 'sh'],
  [PS.SHARE]: ['SHARE', 'sh sm'], [PS.OPT]: ['OPTIONS', 'sh sm'], [PS.L3]: ['L3', 'sh'], [PS.R3]: ['R3', 'sh'], [PS.UP]: ['⯅', 'dp'], [PS.DOWN]: ['⯆', 'dp'], [PS.LEFT]: ['⯇', 'dp'], [PS.RIGHT]: ['⯈', 'dp'], [PS.TP]: ['▭', 'tp'],
};
const KEY_LABEL = { ShiftLeft: 'Sol Shift', ShiftRight: 'Sağ Shift', ControlLeft: 'Sol Ctrl', ControlRight: 'Sağ Ctrl', AltLeft: 'Alt', AltRight: 'AltGr', Escape: 'Esc', Space: 'Boşluk', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageUp: 'PgUp', PageDown: 'PgDn', Mouse0: 'Sol Tık', Mouse1: 'Orta Tık', Mouse2: 'Sağ Tık', Mouse3: 'Fare 4', Mouse4: 'Fare 5', Backquote: '"', Minus: '-', Equal: '=', BracketLeft: 'Ğ', BracketRight: 'Ü', Semicolon: 'Ş', Quote: 'İ', Comma: 'Ö', Period: 'Ç', Slash: '.', Backslash: ',' };
const PAD_NAME = { [PS.X]: '✕', [PS.O]: '○', [PS.SQ]: '□', [PS.TRI]: '△', [PS.L1]: 'L1', [PS.R1]: 'R1', [PS.L2]: 'L2', [PS.R2]: 'R2', [PS.SHARE]: 'Share', [PS.OPT]: 'Options', [PS.L3]: 'L3', [PS.R3]: 'R3', [PS.UP]: 'D-Pad ↑', [PS.DOWN]: 'D-Pad ↓', [PS.LEFT]: 'D-Pad ←', [PS.RIGHT]: 'D-Pad →', [PS.PSB]: 'PS', [PS.TP]: 'Touchpad' };
const MOUSE_LABEL = ['Sol Tık', 'Orta Tık', 'Sağ Tık'];
/* Xbox ve Steam Deck düzeni: standart eşlemedeki indeksler aynı, yalnızca adlar ve renkler farklı */
const GLYPH_XB = {
  xbox: { [PS.X]: 'A', [PS.O]: 'B', [PS.SQ]: 'X', [PS.TRI]: 'Y', [PS.L1]: 'LB', [PS.R1]: 'RB', [PS.L2]: 'LT', [PS.R2]: 'RT', [PS.SHARE]: '⧉', [PS.OPT]: '☰', [PS.L3]: 'LS', [PS.R3]: 'RS', [PS.TP]: '⧉' },
  deck: { [PS.X]: 'A', [PS.O]: 'B', [PS.SQ]: 'X', [PS.TRI]: 'Y', [PS.L1]: 'L1', [PS.R1]: 'R1', [PS.L2]: 'L2', [PS.R2]: 'R2', [PS.SHARE]: '⧉', [PS.OPT]: '☰', [PS.L3]: 'L3', [PS.R3]: 'R3', [PS.TP]: '⧉' },
};
const XB_FACE = { [PS.X]: 'a', [PS.O]: 'b', [PS.SQ]: 'xx', [PS.TRI]: 'y' };

const Input = {
  keys: new Set(),
  tapped: new Set(),
  justKeys: new Set(), justMouse: [false, false, false],
  mtapped: [false, false, false],
  mouse: { x: 0, y: 0, b: [false, false, false], wheel: 0, moved: false },
  pad: null,
  padIndex: -1,
  btn: new Float32Array(20),
  axes: [0, 0, 0, 0],
  device: 'kb',
  state: {}, prev: {}, hold: {},
  repeatT: {},
  textFocus: false,
  binds: null,
  capture: null,

  init() {
    this.setBinds(null);
    for (const a of [...Object.keys(BINDS), ...GAME_ACTIONS.map(g => g.id)]) { this.state[a] = false; this.prev[a] = false; this.hold[a] = 0; this.repeatT[a] = 0; }
    window.addEventListener('keydown', e => {
      if (this.capture && this.capture.device === 'kb') {
        e.preventDefault();
        if (!e.repeat) this.finishCapture(e.code === 'Escape' ? undefined : e.code);
        return;
      }
      if (this.textFocus && e.code !== 'Escape' && e.code !== 'Enter' && e.code !== 'Tab') return;
      this.keys.add(e.code);
      this.tapped.add(e.code);
      if (!e.repeat) this.justKeys.add(e.code);
      this.device = 'kb';
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code) && !this.textFocus) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      if (typeof Audio_ !== 'undefined') Audio_.unlock();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.b = [false, false, false]; });
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true;
      // kol kullanılırken masadaki farenin ufak kaymaları nişanı fareye kilitlemesin
      if (this.device !== 'kb') { this._mm = (this._mm || 0) + Math.abs(e.movementX) + Math.abs(e.movementY); if (this._mm > 60) { this.device = 'kb'; this._mm = 0; } }
    });
    window.addEventListener('mousedown', e => {
      this.justMouse[e.button] = true;
      if (this.capture && this.capture.device === 'kb') { e.preventDefault(); this.finishCapture('Mouse' + e.button); this.suppressClick = true; return; }
      this.mouse.b[e.button] = true; this.mtapped[e.button] = true; this.device = 'kb'; if (typeof Audio_ !== 'undefined') Audio_.unlock();
    });
    window.addEventListener('click', e => { if (this.suppressClick) { this.suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
    window.addEventListener('mouseup', e => { this.mouse.b[e.button] = false; });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('gamepadconnected', e => {
      this.padIndex = e.gamepad.index; this.device = 'pad'; this.padId = e.gamepad.id;
      if (typeof UI !== 'undefined' && UI.toast) UI.feed(Tr('🎮 Kol bağlandı: ') + e.gamepad.id.slice(0, 32));
    });
    window.addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === this.padIndex) this.padIndex = -1; });
  },

  poll(dt) {
    // kol
    this.btnPrev = this.btn.slice();
    this.pad = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (pads) {
      let p = this.padIndex >= 0 ? pads[this.padIndex] : null;
      if (!p) for (const q of pads) if (q && q.connected) { p = q; this.padIndex = q.index; break; }
      if (p && p.connected) {
        this.pad = p; this.padId = p.id;
        let active = false;
        for (let i = 0; i < 18; i++) {
          const b = p.buttons[i];
          const v = b ? (typeof b === 'object' ? (b.value || (b.pressed ? 1 : 0)) : b) : 0;
          if (v > 0.3 && this.btn[i] <= 0.3) active = true;
          this.btn[i] = v;
        }
        // Standart dışı eşleme (ör. bazı Firefox sürümleri): [LX, LY, L2, RX, RY, R2]
        let rx = 2, ry = 3;
        if (p.mapping !== 'standard' && p.axes.length >= 6) {
          if (this.trigLayout === undefined) this.trigLayout = p.axes[2] < -0.8 && p.axes[5] < -0.8;
          if (this.trigLayout) {
            rx = 3; ry = 4;
            const l2 = (p.axes[2] + 1) / 2, r2 = (p.axes[5] + 1) / 2;
            if (l2 > this.btn[6]) this.btn[6] = l2;
            if (r2 > this.btn[7]) this.btn[7] = r2;
          }
        }
        const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
        const src = [0, 1, rx, ry];
        for (let i = 0; i < 4; i++) { const v = dz(p.axes[src[i]] || 0); if (Math.abs(v) > 0.4 && Math.abs(this.axes[i]) <= 0.4) active = true; this.axes[i] = v; }
        if (active) { this.device = 'pad'; this._mm = 0; }
      } else { this.btn.fill(0); this.axes = [0, 0, 0, 0]; }
    }
    // tuş yakalama (ayarlar ekranı)
    if (this.capture) {
      if (this.capture.device === 'pad') {
        for (let i = 0; i < 18; i++) if (this.btn[i] > 0.5 && !(this.capPrev && this.capPrev[i] > 0.5)) { this.finishCapture(i); break; }
        this.capPrev = Array.from(this.btn);
      }
      if (this.capture && performance.now() - this.capture.t0 > 6000) this.finishCapture(undefined);
      for (const a in this.state) { this.prev[a] = this.state[a] = false; this.hold[a] = 0; }
      this.tapped.clear(); this.mtapped[0] = this.mtapped[1] = this.mtapped[2] = false;
      return;
    }
    const kdown = (code) => {
      if (code.startsWith('Mouse')) { const i = +code.slice(5); return this.mouse.b[i] || this.mtapped[i]; }
      return this.keys.has(code) || this.tapped.has(code);
    };
    const upd = (a, d) => { this.prev[a] = this.state[a]; this.state[a] = d; this.hold[a] = d ? this.hold[a] + dt : 0; };
    for (const g of GAME_ACTIONS) {
      const a = g.id;
      let d = false;
      for (const c of (this.binds.kb[a] || [])) if (c && kdown(c)) { d = true; break; }
      if (!d && FIXED_KB[a]) for (const c of FIXED_KB[a]) if (kdown(c)) { d = true; break; }
      const pb = this.binds.pad[a];
      if (!d && pb !== null && pb !== undefined && this.btn[pb] > 0.35) d = true;
      upd(a, d);
    }
    for (const a in BINDS) {
      const b = BINDS[a];
      let d = false;
      if (b.k) for (const k of b.k) if (kdown(k)) { d = true; break; }
      if (!d && b.p !== undefined && this.btn[b.p] > 0.35) d = true;
      if (!d && b.ax && Math.abs(this.axes[b.ax[0]]) > 0.55 && Math.sign(this.axes[b.ax[0]]) === b.ax[1]) d = true;
      upd(a, d);
    }
    this.tapped.clear();
    this.mtapped[0] = this.mtapped[1] = this.mtapped[2] = false;
  },
  endFrame() { this.mouse.wheel = 0; this.mouse.moved = false; this.justKeys.clear(); this.justMouse[0] = this.justMouse[1] = this.justMouse[2] = false; },
  /* Bu karede basılan ham tuşlar (eylem eşlemesinden bağımsız) */
  keyTap(...codes) { return codes.some(c => this.justKeys.has(c)); },
  padTap(i) { return this.pad && this.btn[i] > 0.5 && !(this.btnPrev && this.btnPrev[i] > 0.5); },
  down(a) { return this.state[a]; },
  pressed(a) { return this.state[a] && !this.prev[a]; },
  released(a) { return !this.state[a] && this.prev[a]; },
  held(a) { return this.hold[a]; },
  /* Menülerde tekrar eden basış */
  nav(a, dt) {
    if (this.pressed(a)) { this.repeatT[a] = 0.38; return true; }
    if (this.state[a]) {
      this.repeatT[a] -= dt;
      if (this.repeatT[a] <= 0) { this.repeatT[a] = 0.09; return true; }
    }
    return false;
  },
  consume(a) { this.prev[a] = true; this.state[a] = this.state[a]; this.hold[a] = 0; this.prev[a] = this.state[a]; },
  moveVec() {
    let x = 0, y = 0;
    if (this.state.moveUp) y -= 1;
    if (this.state.moveDown) y += 1;
    if (this.state.moveLeft) x -= 1;
    if (this.state.moveRight) x += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l, m: 1, kb: true }; }
    const ax = this.axes[0], ay = this.axes[1];
    const m = Math.min(1, Math.hypot(ax, ay));
    if (m > 0.05) return { x: ax / (m || 1), y: ay / (m || 1), m, kb: false };
    return { x: 0, y: 0, m: 0 };
  },
  aimVec() {
    const ax = this.axes[2], ay = this.axes[3];
    const m = Math.min(1, Math.hypot(ax, ay));
    return { x: ax, y: ay, m };
  },
  rumble(strong, weak, ms) {
    const p = this.pad;
    if (!p || this.device !== 'pad') return;
    try {
      if (p.vibrationActuator && p.vibrationActuator.playEffect) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
      else if (p.hapticActuators && p.hapticActuators[0]) p.hapticActuators[0].pulse(strong, ms);
    } catch (e) {}
  },
  /* Kol simge seti: ayar (0 otomatik, 1 PlayStation, 2 Xbox, 3 Steam Deck) ya da bağlı kolun adı */
  padStyle() {
    const s = typeof G !== 'undefined' && G.settings ? G.settings.padGlyphs | 0 : 0;
    if (s) return ['auto', 'ps', 'xbox', 'deck'][s];
    if (typeof Platform !== 'undefined' && Platform.deck) return 'deck';
    const id = (this.padId || '').toLowerCase();
    if (/xbox|xinput|045e/.test(id)) return 'xbox';
    if (/054c|playstation|dualshock|dualsense|wireless controller/.test(id)) return 'ps';
    return id ? 'xbox' : 'ps';
  },
  /* Metin olarak tuş adı (tuş atama listesi) */
  padName(i) {
    const st = this.padStyle();
    if (st !== 'ps' && GLYPH_XB[st][i]) return GLYPH_XB[st][i];
    return PAD_NAME[i] || '?';
  },
  padGlyph(i) {
    if (i === null || i === undefined) return '<span class="btn kb none">—</span>';
    const st = this.padStyle();
    if (st !== 'ps' && GLYPH_XB[st][i]) {
      const face = XB_FACE[i];
      return `<span class="btn pad ${st} ${face ? 'face ' + face : 'sh'}">${GLYPH_XB[st][i]}</span>`;
    }
    const [g, c] = GLYPH_PS[i] || [PAD_NAME[i] || '?', 'sh'];
    const svgKey = { x: 'x', o: 'o', sq: 'sq', tri: 'tri', tp: 'tp' }[c] || (c === 'dp' ? { [PS.UP]: 'up', [PS.DOWN]: 'down', [PS.LEFT]: 'left', [PS.RIGHT]: 'right' }[i] : null);
    if (svgKey && typeof PS_SVG !== 'undefined') return `<span class="btn ps ${c}">${PS_SVG[svgKey]}</span>`;
    return `<span class="btn ps ${c}">${g}</span>`;
  },
  keyLabel(code) {
    if (!code) return '—';
    return KEY_LABEL[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, Tr('Num '));
  },
  kbGlyph(code) { return `<span class="btn kb ${code ? '' : 'none'}">${this.keyLabel(code)}</span>`; },
  glyph(action) {
    const isGame = this.binds && this.binds.kb[action] !== undefined;
    if (this.device === 'pad') {
      if (isGame) { if (this.binds.pad[action] !== null && this.binds.pad[action] !== undefined) return this.padGlyph(this.binds.pad[action]); }
      else if (BINDS[action] && BINDS[action].p !== undefined) return this.padGlyph(BINDS[action].p);
    }
    if (isGame) return this.kbGlyph(this.binds.kb[action][0]);
    const b = BINDS[action];
    return b && b.k ? this.kbGlyph(b.k[0]) : '';
  },
  /* ---- Tuş atama ---- */
  setBinds(saved) {
    const kb = {}, pad = {};
    for (const g of GAME_ACTIONS) {
      kb[g.id] = (saved && saved.kb && Array.isArray(saved.kb[g.id])) ? saved.kb[g.id].slice(0, 2) : DEFAULT_KB[g.id].slice();
      if (!g.kbOnly) pad[g.id] = (saved && saved.pad && g.id in saved.pad) ? saved.pad[g.id] : DEFAULT_PAD[g.id];
    }
    this.binds = { kb, pad };
  },
  resetBinds(device) {
    for (const g of GAME_ACTIONS) {
      if (device === 'kb') this.binds.kb[g.id] = DEFAULT_KB[g.id].slice();
      else if (!g.kbOnly) this.binds.pad[g.id] = DEFAULT_PAD[g.id];
    }
  },
  /* Bir eylemi yeni tuşa bağlar; tuş başka eylemdeyse ikisini takas eder. */
  bind(device, action, value) {
    const B = this.binds[device];
    const old = device === 'kb' ? B[action][0] : B[action];
    let swapped = null;
    for (const g of GAME_ACTIONS) {
      if (g.id === action || (device === 'pad' && g.kbOnly)) continue;
      if (device === 'kb') {
        const i = B[g.id].indexOf(value);
        if (i >= 0) { B[g.id][i] = old || null; B[g.id] = B[g.id].filter(Boolean); if (!B[g.id].length) B[g.id] = [null]; swapped = g.id; }
      } else if (B[g.id] === value) { B[g.id] = old === undefined ? null : old; swapped = g.id; }
    }
    if (device === 'kb') B[action] = [value]; else B[action] = value;
    return swapped;
  },
  startCapture(device, cb) { this.capture = { device, cb, t0: performance.now() }; this.capPrev = Array.from(this.btn); },
  finishCapture(v) {
    const c = this.capture;
    this.capture = null;
    this.keys.clear();
    if (c && c.cb) c.cb(v);
  },
};
