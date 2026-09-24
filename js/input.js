'use strict';
/* ==========================================================
   DUSTBOUND — giriş: klavye, fare ve PlayStation kolu
   (RDR2 / GTA V tarzı tuş yerleşimi)
   ========================================================== */

/* PS standart eşleme indeksleri */
const PS = { X: 0, O: 1, SQ: 2, TRI: 3, L1: 4, R1: 5, L2: 6, R2: 7, SHARE: 8, OPT: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, PSB: 16, TP: 17 };

const BINDS = {
  // oyun içi
  sprint:   { k: ['ShiftLeft', 'ShiftRight'], p: PS.X },
  interact: { k: ['KeyE'], p: PS.TRI },
  aim:      { m: 2, p: PS.L2 },
  fire:     { m: 0, p: PS.R2 },
  reload:   { k: ['KeyR'], p: PS.SQ },
  melee:    { k: ['KeyF'], p: PS.O },
  crouch:   { k: ['KeyC', 'ControlLeft'], p: PS.L3 },
  deadeye:  { k: ['KeyQ'], p: PS.R3 },
  wheel:    { k: ['Tab'], p: PS.L1 },
  quick:    { k: ['KeyT'], p: PS.R1 },
  whistle:  { k: ['KeyH'], p: PS.UP },
  lantern:  { k: ['KeyL'], p: PS.LEFT },
  satchel:  { k: ['KeyI'], p: PS.RIGHT },
  camp:     { k: ['KeyB'], p: PS.DOWN },
  map:      { k: ['KeyM'], p: PS.TP },
  pause:    { k: ['Escape', 'KeyP'], p: PS.OPT },
  journal:  { k: ['KeyJ'], p: PS.SHARE },
  // menüler
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
const KEY_LABEL = { ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Escape: 'Esc', Space: 'Boşluk', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageUp: 'PgUp', PageDown: 'PgDn' };
const MOUSE_LABEL = ['Sol Tık', 'Orta Tık', 'Sağ Tık'];

const Input = {
  keys: new Set(),
  tapped: new Set(),
  mtapped: [false, false, false],
  mouse: { x: 0, y: 0, b: [false, false, false], wheel: 0, moved: false },
  pad: null,
  padIndex: -1,
  btn: new Float32Array(20),
  axes: [0, 0, 0, 0],
  device: 'kb',
  state: {}, prev: {}, hold: {},
  repeatT: {},
  lockCapture: false,
  textFocus: false,

  init() {
    for (const a in BINDS) { this.state[a] = false; this.prev[a] = false; this.hold[a] = 0; this.repeatT[a] = 0; }
    window.addEventListener('keydown', e => {
      if (this.textFocus && e.code !== 'Escape' && e.code !== 'Enter' && e.code !== 'Tab') return;
      this.keys.add(e.code);
      this.tapped.add(e.code);
      this.device = 'kb';
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code) && !this.textFocus) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      if (typeof Audio_ !== 'undefined') Audio_.unlock();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.b = [false, false, false]; });
    window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; if (this.device !== 'kb' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 3)) this.device = 'kb'; });
    window.addEventListener('mousedown', e => { this.mouse.b[e.button] = true; this.mtapped[e.button] = true; this.device = 'kb'; if (typeof Audio_ !== 'undefined') Audio_.unlock(); });
    window.addEventListener('mouseup', e => { this.mouse.b[e.button] = false; });
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('gamepadconnected', e => {
      this.padIndex = e.gamepad.index; this.device = 'pad';
      if (typeof UI !== 'undefined' && UI.toast) UI.feed('🎮 Kol bağlandı: ' + e.gamepad.id.slice(0, 32));
    });
    window.addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === this.padIndex) this.padIndex = -1; });
  },

  poll(dt) {
    // kol
    this.pad = null;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (pads) {
      let p = this.padIndex >= 0 ? pads[this.padIndex] : null;
      if (!p) for (const q of pads) if (q && q.connected) { p = q; this.padIndex = q.index; break; }
      if (p && p.connected) {
        this.pad = p;
        let active = false;
        for (let i = 0; i < 18; i++) {
          const b = p.buttons[i];
          const v = b ? (typeof b === 'object' ? (b.value || (b.pressed ? 1 : 0)) : b) : 0;
          if (v > 0.3 && this.btn[i] <= 0.3) active = true;
          this.btn[i] = v;
        }
        const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
        for (let i = 0; i < 4; i++) { const v = dz(p.axes[i] || 0); if (Math.abs(v) > 0.4 && Math.abs(this.axes[i]) <= 0.4) active = true; this.axes[i] = v; }
        if (active) this.device = 'pad';
      } else { this.btn.fill(0); this.axes = [0, 0, 0, 0]; }
    }
    for (const a in BINDS) {
      const b = BINDS[a];
      let d = false;
      if (b.k) for (const k of b.k) if (this.keys.has(k) || this.tapped.has(k)) { d = true; break; }
      if (!d && b.m !== undefined && (this.mouse.b[b.m] || this.mtapped[b.m])) d = true;
      if (!d && b.p !== undefined && this.btn[b.p] > 0.35) d = true;
      if (!d && b.ax && Math.abs(this.axes[b.ax[0]]) > 0.55 && Math.sign(this.axes[b.ax[0]]) === b.ax[1]) d = true;
      this.prev[a] = this.state[a];
      this.state[a] = d;
      this.hold[a] = d ? this.hold[a] + dt : 0;
    }
    this.tapped.clear();
    this.mtapped[0] = this.mtapped[1] = this.mtapped[2] = false;
  },
  endFrame() { this.mouse.wheel = 0; this.mouse.moved = false; },
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
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
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
  glyph(action) {
    const b = BINDS[action];
    if (!b) return '';
    if (this.device === 'pad' && b.p !== undefined) {
      const [g, c] = GLYPH_PS[b.p] || ['?', 'sh'];
      return `<span class="btn ps ${c}">${g}</span>`;
    }
    if (b.m !== undefined && (action === 'aim' || action === 'fire')) return `<span class="btn kb">${MOUSE_LABEL[b.m]}</span>`;
    const k = b.k ? b.k[0] : '?';
    return `<span class="btn kb">${KEY_LABEL[k] || k.replace('Key', '').replace('Digit', '')}</span>`;
  },
};
