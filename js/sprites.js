'use strict';
/* ==========================================================
   FRONTIER'S END — prosedürel çizimler (üstten 3/4 görünüm)
   ========================================================== */

const NOPF = () => {};
const NOPCTX = new Proxy({}, { get: (t, k) => (k in t ? t[k] : NOPF), set: (t, k, v) => { t[k] = v; return true; } });
const SIGN_TEXT = {
  general: 'GENERAL', saloon: 'SALOON', sheriff: 'SHERIFF', doctor: 'DOCTOR', gunsmith: 'GUNS', butcher: 'BUTCHER', stable: 'STABLE',
  hotel: 'HOTEL', bank: 'BANK', station: 'STATION', land: 'LAND', barber: 'BARBER', tailor: 'TAILOR', fence: 'TRADER', mine: 'MINING CO',
  lumber: 'LUMBER', docks: 'DOCKS', ranch: 'RANCH', property: 'FOR SALE', cabin: 'FURS', hermit: '', church: '',
  bakery: 'BAKERY', smith: 'BLACKSMITH', pharmacy: 'DRUGS', laundry: 'LAUNDRY', gambling: 'GAMBLING HALL', brewery: 'BREWERY',
  mill: 'MILL', county: 'COUNTY', post: 'POST & TELEGRAPH', warehouse: 'WHOLESALE', cantina: 'CANTINA', market: 'MARKET',
};

/* Zengin şehrin modern binaları: cephe taşları ve tente renkleri */
const MODERN_WALLS = [{ c: '#8a3e2e', brick: true }, { c: '#7a4a34', brick: true }, { c: '#964a36', brick: true }, { c: '#b8a27e', brick: false }, { c: '#c8c0b0', brick: false }, { c: '#a89a86', brick: false }];
const MODERN_TYPE_WALL = { bank: '#cfc6b4', county: '#c8c0ae', hotel: '#d4c8b0', sheriff: '#a8a090', doctor: '#d8d2c4', pharmacy: '#d8d2c4' };
const MODERN_AWN = ['#a83a2a', '#2e6a4a', '#2e4a7a', '#7a2a5a', '#a8782a'];
const MODERN_SHOP = new Set(['general', 'tailor', 'bakery', 'pharmacy', 'barber', 'butcher', 'gunsmith', 'saloon', 'gambling', 'laundry', 'brewery', 'fence']);
const MODERN_SKIP = new Set(['church', 'station', 'stable', 'barn', 'lighthouse', 'mineentrance', 'ruin', 'docks', 'warehouse', 'lot']);
const AUTUMN_PAL = [['#7a3416', '#a84e1c', '#d07a2a'], ['#8a5a14', '#b88024', '#e0aa3a'], ['#6a3a1a', '#94501e', '#c07030'], ['#8a6a1a', '#b89424', '#e8c040']];

/* Toplanabilir bitkilerin renkleri (sap, çiçek/meyve): bir kez kurulur, her karede yeniden yaratılmaz */
const HERB_COLS = {
  [O.BERRY]: ['#3a5a26', '#3048a0'], [O.GINSENG]: ['#4a7a2e', '#c03020'], [O.YARROW]: ['#5a7a3a', '#f0f0e0'], [O.SAGE]: ['#8aa080', '#b0c0a8'],
  [O.MINT]: ['#3a8a3a', '#6ac06a'], [O.OREGANO]: ['#5a7a3a', '#b080c0'], [O.MILKWEED]: ['#6a8a4a', '#f0d0e0'], [O.MUSHROOM]: ['#e8dcc8', '#a03a2a'], [O.WFLOWER]: ['#4a7a2e', '#e8c040'],
}, HERB_COL0 = ['#5a7a3a', '#fff'];
const Spr = {
  ell(ctx, x, y, rx, ry, col, rot = 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); },
  circ(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); },
  shadow(ctx, x, y, rx, ry, a = 0.28) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); },
  line(ctx, x1, y1, x2, y2, col, w = 1) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },

  /* ---------- Ağaç taçları ---------- */
  canopy(ctx, x, y, r, c1, c2, c3, h, lumps = 6) {
    for (let k = 0; k < lumps; k++) {
      const a = k / lumps * TAU + h * 6;
      const rr = r * (0.55 + 0.2 * Math.sin(k * 2.1 + h * 9));
      this.circ(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4, rr, c1);
    }
    this.circ(ctx, x, y, r * 0.7, c2);
    for (let k = 0; k < 3; k++) this.circ(ctx, x - r * 0.25 + k * 1.5, y - r * 0.3 - k, r * (0.32 - k * 0.07), c3);
  },
  pine(ctx, x, y, r, c1, c2, c3, h, snow) {
    for (let layer = 0; layer < 3; layer++) {
      const rr = r * (1 - layer * 0.28);
      const cy = y - layer * 2.2;
      ctx.fillStyle = layer === 0 ? c1 : layer === 1 ? c2 : c3;
      ctx.beginPath();
      const pts = 9;
      for (let k = 0; k <= pts * 2; k++) {
        const a = k / (pts * 2) * TAU + h * 3 + layer;
        const rad = k % 2 === 0 ? rr : rr * 0.62;
        const px = x + Math.cos(a) * rad, py = cy + Math.sin(a) * rad * 0.92;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.fill();
      if (snow) {
        ctx.fillStyle = 'rgba(240,244,250,0.85)';
        for (let k = 0; k < 4; k++) { const a = k * 1.7 + h * 5 + layer; this.circ(ctx, x + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.45 - 1, rr * 0.22, 'rgba(236,242,248,0.9)'); }
      }
    }
  },

  bare(o, x, y, r, col, h, snowy) {
    o.strokeStyle = col; o.lineWidth = 1.3; o.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU + h * 5, l = r * (0.6 + 0.3 * Math.sin(k * 3.1 + h * 7));
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l * 0.85;
      o.beginPath(); o.moveTo(x, y); o.lineTo(ex, ey); o.stroke();
      o.beginPath(); o.moveTo(x + (ex - x) * 0.6, y + (ey - y) * 0.6); o.lineTo(ex + Math.cos(a + 0.8) * 3, ey + Math.sin(a + 0.8) * 3); o.stroke();
      if (snowy) { o.fillStyle = 'rgba(240,244,248,0.9)'; o.fillRect(ex - 1, ey - 1, 2, 1.2); }
    }
    o.lineCap = 'butt';
  },
  object(g, o, type, x, y, h, world) {
    const tx = x >> 4, ty = y >> 4;
    const season = world ? world.season : 0;
    const snowy = season === 3 && world.snowyTile(tx, ty);
    switch (type) {
      case O.PINE: case O.SNOWPINE: {
        const r = 7 + h * 3.5;
        this.shadow(g, x + 5, y + 3, r * 0.95, r * 0.55, 0.3);
        g.fillStyle = '#4a3322'; g.fillRect(x - 1.2, y - 5, 2.4, 8);
        this.pine(o, x, y - 7, r, '#20361f', '#2c4a28', '#3a5d33', h, type === O.SNOWPINE || snowy);
        break;
      }
      case O.OAK: case O.APPLE: {
        const r = 8 + h * 3.5;
        this.shadow(g, x + 5, y + 3, r, r * 0.6, 0.3);
        g.fillStyle = '#4e3826'; g.fillRect(x - 1.6, y - 6, 3.2, 9);
        if (world && world.bareTree(tx, ty)) { this.bare(o, x, y - 7, r, '#4e3826', h, snowy); break; }
        if (season === 2) { const pal = AUTUMN_PAL[Math.floor(h * AUTUMN_PAL.length)]; this.canopy(o, x, y - 8, r, pal[0], pal[1], pal[2], h); break; }
        this.canopy(o, x, y - 8, r, season === 1 ? '#2e4a1e' : '#314d22', season === 1 ? '#3c5c26' : '#3f6129', season === 1 ? '#4f7030' : '#557a35', h);
        if (type === O.APPLE) for (let k = 0; k < 7; k++) { const a = k * 1.9 + h * 7; this.circ(o, x + Math.cos(a) * r * 0.55, y - 8 + Math.sin(a) * r * 0.5, 1.1, '#c0302a'); }
        break;
      }
      case O.BIRCH: {
        const r = 6 + h * 3;
        this.shadow(g, x + 4, y + 3, r, r * 0.55, 0.26);
        g.fillStyle = '#e8e4d8'; g.fillRect(x - 1.2, y - 6, 2.4, 9);
        g.fillStyle = '#2a2420'; g.fillRect(x - 1.2, y - 3, 1.2, 0.8); g.fillRect(x, y, 1.2, 0.8);
        if (world && world.bareTree(tx, ty)) { this.bare(o, x, y - 7, r, '#d8d4c8', h, snowy); break; }
        if (season === 2) this.canopy(o, x, y - 8, r, '#b8902a', '#d8b040', '#f0d060', h, 5);
        else this.canopy(o, x, y - 8, r, '#4a6a2a', '#5e8436', '#7a9e48', h, 5);
        break;
      }
      case O.CYPRESS: {
        const r = 8 + h * 3;
        this.shadow(g, x + 4, y + 3, r, r * 0.6, 0.3);
        g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(x, y + 1, 3.2, 2.2, 0, 0, TAU); g.fill(); g.fillRect(x - 1.8, y - 6, 3.6, 7);
        this.canopy(o, x, y - 8, r, '#2e3a22', '#3a4a2a', '#4d5e36', h, 7);
        o.strokeStyle = 'rgba(150,160,130,0.7)'; o.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const px = x - r * 0.7 + k * r * 0.28; o.beginPath(); o.moveTo(px, y - 8 + (k % 2) * 2); o.lineTo(px + 0.5, y - 1 + (k % 3)); o.stroke(); }
        break;
      }
      case O.DEAD: {
        this.shadow(g, x + 3, y + 3, 5, 2.5, 0.2);
        g.fillStyle = '#5a4a3a'; g.fillRect(x - 1.2, y - 8, 2.4, 11);
        o.strokeStyle = '#5a4838'; o.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5 + h; o.beginPath(); o.moveTo(x, y - 7); o.lineTo(x + Math.cos(a) * 8, y - 7 + Math.sin(a) * 7); o.stroke(); }
        break;
      }
      case O.CACTUS: {
        this.shadow(g, x + 2, y + 2, 4, 2, 0.22);
        g.fillStyle = '#4a7a3a'; g.fillRect(x - 1.8, y - 7, 3.6, 9);
        g.fillStyle = '#5e9048'; g.fillRect(x - 0.6, y - 7, 1.2, 9);
        if (h > 0.4) { g.fillStyle = '#4a7a3a'; g.fillRect(x + 1.8, y - 4, 2.5, 1.8); g.fillRect(x + 3, y - 7, 1.8, 3.5); }
        if (h > 0.7) this.circ(g, x, y - 7.5, 1.2, '#e0a0c0');
        break;
      }
      case O.SAGUARO: {
        this.shadow(g, x + 4, y + 3, 5, 2.5, 0.25);
        g.fillStyle = '#3e6e32'; g.fillRect(x - 2.5, y - 5, 5, 8);
        o.fillStyle = '#3e6e32'; o.fillRect(x - 2.5, y - 20, 5, 15.5);
        o.beginPath(); o.arc(x, y - 20, 2.5, Math.PI, 0); o.fill();
        o.fillRect(x - 7, y - 11, 4.5, 2.5); o.fillRect(x - 7, y - 16, 2.5, 6);
        o.fillRect(x + 2.5, y - 9, 4, 2.5); o.fillRect(x + 4.5, y - 15, 2.5, 7);
        o.fillStyle = '#58904a'; o.fillRect(x - 0.8, y - 20, 1.4, 15);
        break;
      }
      case O.BUSH: {
        this.shadow(g, x + 2, y + 3, 6, 3, 0.2);
        const c = season === 2 ? (h > 0.5 ? ['#7a4a1e', '#9a6026', '#b87a30'] : ['#6a5a26', '#8a7230', '#a88a3a']) : season === 3 ? ['#4a4a36', '#5a5a42', '#6a6a50'] : h > 0.5 ? ['#3a5a26', '#4a6e30', '#5e8440'] : ['#40562a', '#506a34', '#688246'];
        this.circ(g, x - 2.5, y, 3.8, c[0]); this.circ(g, x + 2.5, y + 0.5, 3.6, c[0]); this.circ(g, x, y - 2, 4, c[1]); this.circ(g, x - 1, y - 3, 2, c[2]);
        if (snowy) { this.ell(g, x - 0.5, y - 3.5, 4, 2, '#eef2f6'); this.ell(g, x + 2.5, y - 1, 2, 1, '#e2e8ee'); }
        break;
      }
      case O.DRYBUSH: {
        g.strokeStyle = h > 0.5 ? '#8a7446' : '#7a6a48'; g.lineWidth = 1;
        for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4.5, y + Math.sin(a) * 3.5); g.stroke(); }
        this.circ(g, x, y, 2, '#8e7a4e');
        break;
      }
      case O.ROCK: {
        const r = 2.5 + h * 2;
        this.ell(g, x + 1, y + 1.5, r + 0.5, r * 0.7, 'rgba(0,0,0,0.25)');
        this.ell(g, x, y, r, r * 0.75, '#8a8278'); this.ell(g, x - 0.8, y - 0.8, r * 0.55, r * 0.4, '#a8a096');
        break;
      }
      case O.BOULDER: {
        const r = 6 + h * 3;
        this.ell(g, x + 2, y + 3, r + 1, r * 0.6, 'rgba(0,0,0,0.3)');
        this.ell(g, x, y - 1, r, r * 0.8, '#77706a'); this.ell(g, x - 1.5, y - 3, r * 0.6, r * 0.45, '#948c84'); this.ell(g, x + 2, y + 1, r * 0.4, r * 0.25, '#5e5852');
        break;
      }
      case O.REED: {
        g.strokeStyle = '#6a7a3a'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const dx = (k - 2) * 1.6 + h; g.beginPath(); g.moveTo(x + dx, y + 3); g.lineTo(x + dx + (k % 2 ? 1 : -1), y - 5 - k % 3); g.stroke(); }
        this.circ(g, x + h, y - 5, 0.9, '#5a4028');
        break;
      }
      case O.FLOWERS: {
        if (snowy || season === 2 || season === 3) break;
        const cols = ['#e8d040', '#c060c0', '#f0f0f0', '#e05a3a', '#7090e0'];
        for (let k = 0; k < 5; k++) { const a = k * 2.3 + h * 9; this.circ(g, x + Math.cos(a) * 4, y + Math.sin(a) * 3, 0.9, cols[(k + Math.floor(h * 5)) % 5]); }
        break;
      }
      case O.TUFT: {
        if (snowy) break;
        g.strokeStyle = season === 2 ? 'rgba(110,80,30,0.6)' : season === 3 ? 'rgba(80,70,50,0.5)' : 'rgba(40,60,20,0.55)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 3 + k * 2, y + 2); g.lineTo(x - 3 + k * 2 + (k - 1.5) * 0.8, y - 2); g.stroke(); }
        break;
      }
      case O.ORE: {
        this.ell(g, x + 1, y + 2, 6, 3.5, 'rgba(0,0,0,0.3)');
        this.ell(g, x, y, 5.5, 4.2, '#6a625c'); this.ell(g, x - 1, y - 1, 3.5, 2.5, '#827a72');
        g.fillStyle = h > 0.7 ? '#e0c050' : '#c8d0d8';
        g.fillRect(x - 2, y - 1, 1.2, 1.2); g.fillRect(x + 1, y, 1.2, 1.2); g.fillRect(x, y - 2.5, 1, 1);
        break;
      }
      case O.CROP: {
        if (season === 3) { g.strokeStyle = snowy ? '#a8a090' : '#7a6a40'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 4 + k * 4, y + 5); g.lineTo(x - 4 + k * 4, y + 2); g.stroke(); } break; }
        if (season === 2) { g.strokeStyle = '#a8883a'; g.lineWidth = 1.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 4 + k * 4, y + 5); g.lineTo(x - 4 + k * 4, y - 6); g.stroke(); } g.fillStyle = '#e0c050'; g.fillRect(x - 5, y - 3, 1.6, 3); g.fillRect(x + 3, y - 4, 1.6, 3); break; }
        g.strokeStyle = '#5a7a2a'; g.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 4 + k * 4, y + 5); g.lineTo(x - 4 + k * 4, y - 6); g.stroke(); }
        g.fillStyle = '#d8c050'; g.fillRect(x - 5, y - 3, 1.6, 3); g.fillRect(x + 3, y - 4, 1.6, 3);
        g.fillStyle = '#7a9a3a'; g.fillRect(x - 2, y - 7, 3, 1);
        break;
      }
      case O.FENCEH: {
        this.line(g, x - 8, y + 1.5, x + 8, y + 1.5, 'rgba(0,0,0,0.25)', 1.5);
        this.line(g, x - 8, y - 3, x + 8, y - 3, '#7a5a3a', 1.3); this.line(g, x - 8, y, x + 8, y, '#6a4a2e', 1.3);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 1, y - 5, 2, 6.5);
        break;
      }
      case O.FENCEV: {
        this.line(g, x - 1, y - 8, x - 1, y + 8, '#7a5a3a', 1.3); this.line(g, x + 1.5, y - 8, x + 1.5, y + 8, '#6a4a2e', 1);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 1.5, y - 3, 3, 4);
        break;
      }
      case O.CRATE: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 3, y - 1, 9, 7);
        g.fillStyle = '#8a6a40'; g.fillRect(x - 5, y - 6, 10, 10);
        g.fillStyle = '#a8844f'; g.fillRect(x - 5, y - 6, 10, 3);
        g.strokeStyle = '#5a4226'; g.lineWidth = 1; g.strokeRect(x - 4.5, y - 5.5, 9, 9);
        this.line(g, x - 4.5, y + 3.5, x + 4.5, y - 3, '#5a4226', 1);
        break;
      }
      case O.BARREL: {
        this.ell(g, x + 1.5, y + 3, 5, 2.5, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#7a5230'; g.fillRect(x - 4, y - 6, 8, 9);
        this.ell(g, x, y - 6, 4, 2, '#946640'); this.ell(g, x, y + 3, 4, 1.5, '#6a4628');
        g.fillStyle = '#4a4a4a'; g.fillRect(x - 4, y - 3, 8, 1); g.fillRect(x - 4, y + 1, 8, 1);
        break;
      }
      case O.LAMP: {
        this.shadow(g, x + 3, y + 2, 3, 1.5, 0.25);
        g.fillStyle = '#2a2622'; g.fillRect(x - 0.8, y - 10, 1.6, 12);
        o.fillStyle = '#2a2622'; o.fillRect(x - 2.5, y - 16, 5, 6);
        o.fillStyle = '#f0d890'; o.fillRect(x - 1.5, y - 15, 3, 4);
        break;
      }
      case O.WELL: {
        this.shadow(g, x + 3, y + 3, 8, 4, 0.3);
        this.circ(g, x, y, 6.5, '#7a746a'); this.circ(g, x, y, 4.5, '#1e2a30'); this.circ(g, x, y, 3.5, '#2e4450');
        o.fillStyle = '#5a3e26'; o.fillRect(x - 6, y - 14, 1.5, 12); o.fillRect(x + 4.5, y - 14, 1.5, 12);
        o.fillStyle = '#6a3a24'; o.beginPath(); o.moveTo(x - 9, y - 12); o.lineTo(x, y - 19); o.lineTo(x + 9, y - 12); o.closePath(); o.fill();
        break;
      }
      case O.PUMP: {
        this.shadow(g, x + 2, y + 2, 4, 2, 0.25);
        g.fillStyle = '#3a4048'; g.fillRect(x - 2, y - 8, 4, 10); g.fillRect(x + 2, y - 6, 4, 1.5);
        g.fillStyle = '#5a6068'; g.fillRect(x - 1, y - 9, 2, 2);
        this.line(g, x - 2, y - 8, x - 6, y - 11, '#2a2e34', 1.2);
        break;
      }
      case O.TROUGH: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 8, y - 1, 18, 6);
        g.fillStyle = '#6a4a2e'; g.fillRect(x - 10, y - 4, 20, 7);
        g.fillStyle = '#3e6a78'; g.fillRect(x - 8.5, y - 2.5, 17, 4);
        break;
      }
      case O.GRAVE: {
        this.ell(g, x, y + 2, 3.5, 5, '#6a5a42');
        g.fillStyle = '#8a8680'; g.fillRect(x - 3, y - 7, 6, 5); this.ell(g, x, y - 7, 3, 1.5, '#8a8680');
        g.fillStyle = '#6a6660'; g.fillRect(x - 2, y - 5, 4, 0.8);
        break;
      }
      case O.CROSS: {
        this.ell(g, x, y + 2, 3, 4.5, '#6a5a42');
        g.fillStyle = '#6a4a2e'; g.fillRect(x - 0.8, y - 8, 1.6, 9); g.fillRect(x - 3, y - 6, 6, 1.4);
        break;
      }
      case O.CAMPFIRE: {
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; this.circ(g, x + Math.cos(a) * 4.5, y + Math.sin(a) * 3.5, 1.5, '#6a6660'); }
        this.circ(g, x, y, 3.2, '#1a1612');
        this.line(g, x - 3, y - 1, x + 3, y + 1, '#4a3222', 1.8); this.line(g, x - 3, y + 1, x + 3, y - 1, '#4a3222', 1.8);
        break;
      }
      case O.TENT: {
        this.shadow(g, x + 3, y + 4, 9, 4, 0.28);
        g.fillStyle = '#c8b890'; g.beginPath(); g.moveTo(x - 8, y + 5); g.lineTo(x, y - 7); g.lineTo(x + 8, y + 5); g.closePath(); g.fill();
        g.fillStyle = '#a89870'; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 8, y + 5); g.lineTo(x + 2, y + 5); g.closePath(); g.fill();
        g.fillStyle = '#2a2016'; g.beginPath(); g.moveTo(x - 2, y + 5); g.lineTo(x, y - 1); g.lineTo(x + 2, y + 5); g.closePath(); g.fill();
        break;
      }
      case O.HAY: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 5, y - 1, 13, 6);
        g.fillStyle = '#c8a850'; g.fillRect(x - 7, y - 5, 14, 8);
        g.fillStyle = '#e0c068'; g.fillRect(x - 7, y - 5, 14, 3);
        g.fillStyle = '#8a6a30'; g.fillRect(x - 3, y - 5, 1, 8); g.fillRect(x + 3, y - 5, 1, 8);
        break;
      }
      case O.SIGN: {
        this.shadow(g, x + 2, y + 2, 3, 1.5, 0.25);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 0.8, y - 10, 1.6, 12);
        o.fillStyle = '#9a7650'; o.beginPath(); o.moveTo(x - 7, y - 13); o.lineTo(x + 5, y - 13); o.lineTo(x + 8, y - 11); o.lineTo(x + 5, y - 9); o.lineTo(x - 7, y - 9); o.fill();
        o.beginPath(); o.moveTo(x + 7, y - 8); o.lineTo(x - 5, y - 8); o.lineTo(x - 8, y - 6); o.lineTo(x - 5, y - 4); o.lineTo(x + 7, y - 4); o.fill();
        break;
      }
      case O.WINDMILL: {
        this.shadow(g, x + 6, y + 6, 12, 5, 0.3);
        g.strokeStyle = '#5a4a3a'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x - 7, y + 6); g.lineTo(x - 2, y - 14); g.moveTo(x + 7, y + 6); g.lineTo(x + 2, y - 14); g.moveTo(x - 5, y - 2); g.lineTo(x + 5, y - 2); g.moveTo(x - 6, y + 3); g.lineTo(x + 6, y + 3); g.stroke();
        o.strokeStyle = '#8a8680'; o.lineWidth = 2;
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + h; o.beginPath(); o.moveTo(x, y - 22); o.lineTo(x + Math.cos(a) * 11, y - 22 + Math.sin(a) * 11); o.stroke(); }
        this.circ(o, x, y - 22, 2, '#4a4440');
        break;
      }
      case O.CHEST: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 4, y - 1, 10, 5);
        g.fillStyle = '#6a4424'; g.fillRect(x - 5, y - 4, 10, 7);
        g.fillStyle = '#84582e'; g.fillRect(x - 5, y - 5, 10, 3);
        g.fillStyle = '#c8a040'; g.fillRect(x - 5, y - 2.5, 10, 1); g.fillRect(x - 1, y - 3, 2, 2.5);
        break;
      }
      case O.POLE: {
        this.shadow(g, x + 4, y + 2, 3, 1.4, 0.2);
        g.fillStyle = '#5a4430'; g.fillRect(x - 0.8, y - 6, 1.6, 8);
        o.fillStyle = '#5a4430'; o.fillRect(x - 0.8, y - 22, 1.6, 16); o.fillRect(x - 5, y - 20, 10, 1.4);
        break;
      }
      case O.RUINWALL: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 6, y, 14, 6);
        g.fillStyle = h > 0.5 ? '#8a7a64' : '#7a6a58'; g.fillRect(x - 8, y - 4 - h * 5, 16, 9 + h * 5);
        g.fillStyle = '#a8987e'; g.fillRect(x - 8, y - 4 - h * 5, 16, 2);
        g.fillStyle = '#5e5242'; g.fillRect(x - 4, y - 1, 5, 1); g.fillRect(x + 2, y + 2, 5, 1);
        break;
      }
      case O.BONES: {
        g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (k - 1.5) * 2, y, 3, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
        this.circ(g, x + 5, y + 1, 1.8, '#e8e0d0');
        break;
      }
      case O.BIGBONES: {
        g.strokeStyle = '#e4dccb'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 26, y); g.quadraticCurveTo(x, y - 6, x + 22, y + 2); g.stroke();
        g.lineWidth = 1.5;
        for (let k = 0; k < 8; k++) { const px = x - 16 + k * 4.5; g.beginPath(); g.arc(px, y - 1, 7 - Math.abs(k - 3.5), Math.PI * 0.1, Math.PI * 0.9); g.stroke(); g.beginPath(); g.arc(px, y - 1, 7 - Math.abs(k - 3.5), Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
        this.ell(g, x + 26, y + 2, 6, 4, '#e4dccb'); this.circ(g, x + 27, y + 1, 1.2, '#3a3028');
        break;
      }
      case O.WAGON: {
        this.shadow(g, x + 6, y + 5, 14, 5, 0.3);
        g.save(); g.translate(x + 6, y); g.rotate(h * 0.4 - 0.2);
        g.fillStyle = '#7a5836'; g.fillRect(-12, -6, 24, 11);
        g.fillStyle = '#5a3e24'; g.fillRect(-12, -6, 24, 2); g.fillRect(-12, 3, 24, 2);
        g.fillStyle = '#3a2a1a'; g.fillRect(-9, -9, 5, 3); g.fillRect(4, 6, 5, 3); g.fillRect(-9, 6, 5, 3);
        g.restore();
        break;
      }
      case O.HITCH: {
        this.shadow(g, x + 2, y + 3, 9, 2, 0.2);
        g.fillStyle = '#5a3e26'; g.fillRect(x - 8, y - 6, 1.6, 8); g.fillRect(x + 6.5, y - 6, 1.6, 8);
        g.fillStyle = '#7a5836'; g.fillRect(x - 8, y - 6, 16, 1.6);
        break;
      }
      case O.HEDGE: {
        // budanmış çit: koyu yeşil, üstü yuvarlak tümsekli
        this.shadow(g, x + 3, y + 5, 9, 3, 0.25);
        o.fillStyle = '#2e4a24'; o.fillRect(x - 8, y - 9, 16, 14);
        o.fillStyle = '#3e6230'; for (let k = 0; k < 4; k++) this.circ(o, x - 6 + k * 4, y - 8 + ((k + Math.floor(h * 4)) % 2), 3, '#3e6230');
        o.fillStyle = '#527a3c'; for (let k = 0; k < 4; k++) o.fillRect(x - 7 + k * 4, y - 10 + (k % 2), 2, 1);
        if (snowy) { o.fillStyle = 'rgba(236,241,246,0.9)'; o.fillRect(x - 8, y - 11, 16, 3); }
        break;
      }
      case O.FLOWERBED: {
        this.ell(g, x, y + 1, 7, 4.5, '#4a3220'); this.ell(g, x, y + 0.5, 6, 3.6, '#5a3e26');
        if (snowy || season === 3) break;
        const cols = season === 2 ? ['#c87a2a', '#a85a20', '#e0aa3a'] : ['#e04a5a', '#f0d040', '#f0f0f0', '#b060d0', '#f08a3a'];
        for (let k = 0; k < 9; k++) { const a = k * 2.4 + h * 7, r = 1.5 + (k % 3) * 1.5; this.circ(g, x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 0.8, 1.1, cols[(k + Math.floor(h * 5)) % cols.length]); }
        g.fillStyle = 'rgba(60,110,40,0.7)'; for (let k = 0; k < 6; k++) g.fillRect(x - 5 + k * 2, y + 2 + (k % 2), 1, 1.5);
        break;
      }
      case O.FOUNTAIN: {
        // taş havuz, içinde su, ortada kademeli sütun
        this.shadow(g, x + 3, y + 4, 12, 5, 0.3);
        this.ell(g, x, y + 1, 12, 7.5, '#8a847a'); this.ell(g, x, y, 11, 6.6, '#b4ada2'); this.ell(g, x, y + 0.6, 9, 5.2, '#3e6a80');
        g.fillStyle = 'rgba(200,230,240,0.45)'; g.fillRect(x - 6, y - 1, 3, 1); g.fillRect(x + 3, y + 2, 3, 1);
        o.fillStyle = '#a8a196'; o.fillRect(x - 1.5, y - 10, 3, 11); this.ell(o, x, y - 10, 4.5, 2, '#b8b2a8'); this.ell(o, x, y - 10.5, 3.2, 1.3, '#4e7a90');
        o.fillStyle = 'rgba(210,235,245,0.75)'; o.fillRect(x - 0.5, y - 15, 1, 5); this.circ(o, x - 2.5, y - 8, 0.7, 'rgba(210,235,245,0.75)'); this.circ(o, x + 2.5, y - 8, 0.7, 'rgba(210,235,245,0.75)');
        if (snowy) { o.fillStyle = 'rgba(236,241,246,0.9)'; this.ell(o, x, y - 10, 4.5, 1.6, 'rgba(236,241,246,0.9)'); }
        break;
      }
      case O.STATUE: {
        // kaide üstünde bronz bir figür (elini ileri uzatmış kurucu)
        this.shadow(g, x + 3, y + 3, 7, 3, 0.3);
        g.fillStyle = '#8a847a'; g.fillRect(x - 6, y - 3, 12, 6); g.fillStyle = '#a8a196'; g.fillRect(x - 6, y - 4, 12, 2);
        o.fillStyle = '#9a948a'; o.fillRect(x - 4, y - 12, 8, 9); o.fillStyle = '#b4ada2'; o.fillRect(x - 4.5, y - 13, 9, 2);
        o.fillStyle = '#4e6a5a'; o.fillRect(x - 2, y - 24, 4, 11); this.circ(o, x, y - 26, 2.2, '#5a7a68'); o.fillRect(x + 1.5, y - 22, 5, 1.5); o.fillStyle = '#6a8a78'; o.fillRect(x - 2, y - 24, 1, 10);
        if (snowy) { o.fillStyle = 'rgba(236,241,246,0.9)'; o.fillRect(x - 4.5, y - 14, 9, 1.5); this.circ(o, x, y - 27.5, 1.2, 'rgba(236,241,246,0.9)'); }
        break;
      }
      case O.BENCH: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 6, y + 1, 14, 4);
        g.fillStyle = '#7a5836'; g.fillRect(x - 8, y - 3, 16, 4); g.fillStyle = '#5a3e26'; g.fillRect(x - 8, y - 6, 16, 2);
        break;
      }
      case O.SEQUOIA: {
        this.shadow(g, x + 12, y + 8, 32, 18, 0.35);
        this.ell(g, x, y, 9, 7, '#6a3822'); this.ell(g, x - 2, y - 1, 5, 4, '#8a4a2c');
        g.fillStyle = '#7a4028'; g.fillRect(x - 7, y - 16, 14, 16);
        this.canopy(o, x, y - 26, 30, '#1f3a1c', '#2a4a24', '#3a5e30', h, 9);
        break;
      }
      case O.ARCH: {
        this.shadow(g, x + 6, y + 6, 44, 8, 0.3);
        g.fillStyle = '#9a4a2c'; g.fillRect(x - 46, y - 18, 14, 22); g.fillRect(x + 32, y - 18, 14, 22);
        o.fillStyle = '#a8563a'; o.beginPath(); o.moveTo(x - 46, y - 16); o.quadraticCurveTo(x, y - 62, x + 46, y - 16); o.lineTo(x + 32, y - 16); o.quadraticCurveTo(x, y - 44, x - 32, y - 16); o.closePath(); o.fill();
        o.fillStyle = '#c0704e'; o.beginPath(); o.moveTo(x - 44, y - 20); o.quadraticCurveTo(x, y - 60, x + 44, y - 20); o.lineTo(x + 40, y - 20); o.quadraticCurveTo(x, y - 55, x - 40, y - 20); o.closePath(); o.fill();
        break;
      }
      case O.GALLOWS: {
        this.shadow(g, x + 4, y + 4, 12, 6, 0.3);
        g.fillStyle = '#6a4a2e'; g.fillRect(x - 10, y - 6, 20, 12);
        g.fillStyle = '#5a3e24'; for (let k = 0; k < 5; k++) g.fillRect(x - 10, y - 6 + k * 2.6, 20, 0.6);
        o.fillStyle = '#4a3422'; o.fillRect(x - 8, y - 26, 2, 22); o.fillRect(x - 8, y - 26, 16, 2);
        o.strokeStyle = '#a89060'; o.lineWidth = 0.8; o.beginPath(); o.moveTo(x + 5, y - 24); o.lineTo(x + 5, y - 14); o.stroke();
        o.beginPath(); o.arc(x + 5, y - 12.5, 1.6, 0, TAU); o.stroke();
        break;
      }
      case O.LOTSIGN: {
        this.shadow(g, x + 2, y + 2, 5, 1.5, 0.25);
        g.fillStyle = '#4a3422'; g.fillRect(x - 0.8, y - 8, 1.6, 10);
        o.fillStyle = '#3a2818'; o.fillRect(x - 7, y - 17, 14, 10);
        o.fillStyle = '#e8dcc0'; o.fillRect(x - 6, y - 16, 12, 8);
        o.fillStyle = '#b3261e'; o.fillRect(x - 6, y - 16, 12, 2.4);
        o.fillStyle = '#2a6a2a'; o.font = 'bold 6px serif'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('$', x, y - 10.5);
        break;
      }
      case O.BOARD: {
        this.shadow(g, x + 2, y + 2, 6, 1.5, 0.25);
        g.fillStyle = '#4a3422'; g.fillRect(x - 5, y - 10, 1.4, 12); g.fillRect(x + 3.6, y - 10, 1.4, 12);
        o.fillStyle = '#6a4a2e'; o.fillRect(x - 6, y - 17, 12, 9);
        o.fillStyle = '#e0d4b0'; o.fillRect(x - 5, y - 16, 4, 5); o.fillRect(x, y - 15, 4, 5);
        break;
      }
      case O.SHIP: {
        this.shadow(g, x + 6, y + 6, 36, 10, 0.3);
        g.save(); g.translate(x, y); g.rotate(-0.15);
        g.fillStyle = '#5a3e26'; g.beginPath(); g.moveTo(-36, 0); g.quadraticCurveTo(-30, -12, 0, -12); g.lineTo(28, -8); g.lineTo(38, 0); g.lineTo(28, 8); g.lineTo(0, 12); g.quadraticCurveTo(-30, 12, -36, 0); g.fill();
        g.fillStyle = '#7a5836'; g.fillRect(-26, -7, 50, 14);
        g.fillStyle = '#3a2818'; for (let k = 0; k < 8; k++) g.fillRect(-24 + k * 6, -7, 1, 14);
        g.fillStyle = '#2a1c12'; g.fillRect(-6, -3, 9, 7);
        g.restore();
        o.fillStyle = '#4a3422'; o.save(); o.translate(x, y); o.rotate(0.5); o.fillRect(-2, -32, 3, 30); o.restore();
        break;
      }
    }
  },

  /* Dinamik çizilen toplanabilir bitkiler */
  herb(ctx, type, x, y, t, glow) {
    const cols = HERB_COLS[type] || HERB_COL0;
    if (glow) { ctx.fillStyle = 'rgba(255,240,180,0.25)'; ctx.beginPath(); ctx.arc(x, y, 7 + Math.sin(t * 4) * 1, 0, TAU); ctx.fill(); }
    if (type === O.MUSHROOM) {
      ctx.fillStyle = cols[0]; ctx.fillRect(x - 0.8, y - 1, 1.6, 3);
      this.ell(ctx, x, y - 1.5, 3, 2, cols[1]); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2.5, 0.8, 0.8);
      return;
    }
    if (type === O.BERRY) {
      this.circ(ctx, x - 2, y, 3.2, cols[0]); this.circ(ctx, x + 2, y, 3.2, cols[0]); this.circ(ctx, x, y - 2, 3.2, '#4a6a30');
      for (let k = 0; k < 6; k++) this.circ(ctx, x + Math.cos(k * 1.2) * 2.5, y - 1 + Math.sin(k * 1.2) * 2, 0.9, cols[1]);
      return;
    }
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + Math.cos(a) * 4.5, y + 2 + Math.sin(a) * 5); ctx.stroke(); }
    for (let k = 0; k < 3; k++) { ctx.fillStyle = cols[1]; ctx.fillRect(x - 2.5 + k * 2, y - 3 - (k % 2), 1.5, 1.5); }
  },
  sparkle(ctx, x, y, t) {
    const a = 0.5 + Math.sin(t * 5) * 0.4;
    ctx.fillStyle = `rgba(255,240,190,${a})`;
    ctx.fillRect(x - 0.5, y - 3, 1, 6); ctx.fillRect(x - 3, y - 0.5, 6, 1);
  },
  fire(ctx, x, y, t, s = 1) {
    for (let k = 0; k < 5; k++) {
      const f = Math.sin(t * 13 + k * 2.1);
      ctx.fillStyle = k < 2 ? '#e05a1a' : k < 4 ? '#f0a030' : '#fff0a0';
      ctx.beginPath();
      ctx.ellipse(x + (k - 2) * 1.2 * s + f * 0.5, y - 2 * s - (k % 3) * s, (2.4 - k * 0.35) * s, (3.4 + f) * s, 0, 0, TAU);
      ctx.fill();
    }
  },

  /* ---------- Binalar ---------- */
  /* Bina zemini (gölge, iç mekân, veranda direkleri) chunk'a çizilir */
  buildingGround(g, b, world) {
    this.building(g, NOPCTX, b, world);
    if (b.enter) this.interior(g, b, world);
  },
  /* Cephe + çatı: bina başına önbelleğe alınan ayrı tuval (içerideyken soluklaşır) */
  cover(b, world) {
    if (b.cover) return b.cover;
    const X = b.x * TS - 40, Y = b.y * TS - 70;
    const c = makeCanvas(b.w * TS + 80, b.h * TS + 96), ctx = c.getContext('2d');
    ctx.translate(-X, -Y);
    this.building(NOPCTX, ctx, b, world);
    b.cover = { c, x: X, y: Y };
    return b.cover;
  },
  /* ---------- İç mekân ---------- */
  interior(g, b, world) {
    const X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS, t = b.type;
    const hs = (k) => hash2(b.x + k, b.y - k, 41);
    // zemin
    const FL = { saloon: '#5e4028', church: '#9a7a52', doctor: '#a08a6a', sheriff: '#6e5a40', station: '#6a5a44', bank: '#8a7a64', hotel: '#6e4a32', stable: '#8a7250', barn: '#8a7250', lumber: '#8a6a44', docks: '#6a6258' }[t] || '#7a5a3a';
    g.fillStyle = FL; g.fillRect(X, Y, W, H);
    if (t === 'stable' || t === 'barn') {
      for (let k = 0; k < b.w * b.h * 5; k++) { g.fillStyle = hash2(k, b.x, 3) < 0.5 ? '#c8a860' : '#a88a50'; g.fillRect(X + hash2(k, b.y, 4) * W, Y + 16 + hash2(k, b.x, 5) * (H - 16), 3, 1); }
    } else if (t === 'bank') {
      for (let yy = Y; yy < Y + H; yy += 8) for (let xx = X; xx < X + W; xx += 8) if (((xx - X) / 8 + (yy - Y) / 8) % 2 === 0) { g.fillStyle = '#c8b89a'; g.fillRect(xx, yy, 8, 8); }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let yy = Y + 4; yy < Y + H; yy += 5) {
        g.fillRect(X, yy, W, 1);
        const off = ((yy - Y) / 5 | 0) * 11 % 23;
        for (let xx = X + off; xx < X + W; xx += 23) g.fillRect(xx, yy - 4, 1, 4);
      }
      g.fillStyle = 'rgba(255,240,210,0.05)'; for (let yy = Y + 2; yy < Y + H; yy += 10) g.fillRect(X, yy, W, 2);
    }
    // halılar
    const rug = { hotel: '#7a2a2a', sheriff: '#5a3a2a', bank: '#2a4a3a', land: '#4a3a5a', doctor: '#3a5a6a', property: '#7a4a2a', house: '#6a3a2a', saloon: '#4a2418', ranch: '#6a4a2a' }[t];
    if (rug) {
      const rw = Math.min(W - 40, 64), rh = Math.min(H - 40, 34), rx = X + W / 2 - rw / 2 + (t === 'saloon' ? 20 : 0), ry = Y + H / 2 - rh / 2 + 6;
      g.fillStyle = rug; g.fillRect(rx, ry, rw, rh);
      g.strokeStyle = shadeHex(rug, 0.35); g.lineWidth = 1; g.strokeRect(rx + 2.5, ry + 2.5, rw - 5, rh - 5);
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < rw; k += 4) g.fillRect(rx + k, ry + rh, 2, 2);
    }
    if (t === 'church') { g.fillStyle = '#8a2020'; g.fillRect(X + W / 2 - 6, Y + 26, 12, H - 30); g.fillStyle = '#c8a040'; g.fillRect(X + W / 2 - 6, Y + 26, 1, H - 30); g.fillRect(X + W / 2 + 5, Y + 26, 1, H - 30); }
    // arka duvar
    const WP = { saloon: '#6a2a24', hotel: '#4e5e40', bank: '#2e4234', church: '#e8e0d0', doctor: '#d8d0c0', sheriff: '#8a7a60', station: '#6a5e4a', barber: '#b8a890', tailor: '#7a6078', land: '#8a7a5a' }[t] || shadeHex(b.def.wall, -0.05);
    g.fillStyle = WP; g.fillRect(X, Y, W, 16);
    if (t === 'saloon' || t === 'hotel' || t === 'tailor') { g.fillStyle = 'rgba(255,230,180,0.08)'; for (let xx = X + 2; xx < X + W; xx += 5) g.fillRect(xx, Y, 2, 12); }
    else { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let xx = X + 3; xx < X + W; xx += 4) g.fillRect(xx, Y, 1, 12); }
    g.fillStyle = shadeHex(WP, -0.22); g.fillRect(X, Y + 11, W, 5);
    g.fillStyle = shadeHex(WP, -0.2); g.fillRect(X, Y + 11, W, 1);
    g.fillStyle = '#1e140c'; g.fillRect(X, Y, W, 2);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y + 16, W, 3);
    this.wallDecor(g, b, X, Y, W);
    // yan duvarlar ve ön duvar
    const WD = '#3a2818';
    g.fillStyle = WD; g.fillRect(X, Y, 5, H); g.fillRect(X + W - 5, Y, 5, H);
    g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(X + 4, Y + 2, 1, H - 2); g.fillRect(X + W - 5, Y + 2, 1, H - 2);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X + 5, Y + 16, 3, H - 20); g.fillRect(X + W - 8, Y + 16, 3, H - 20);
    const dx = b.door.x;
    g.fillStyle = WD; g.fillRect(X, Y + H - 4, dx - 8 - X, 4); g.fillRect(dx + 8, Y + H - 4, X + W - dx - 8, 4);
    g.fillStyle = '#8a6a44'; g.fillRect(dx - 8, Y + H - 3, 16, 3);
    // ön duvar pencereleri
    const nWin = Math.max(1, Math.floor(b.w / 3));
    for (let k = 0; k < nWin; k++) { const cx = X + (k + 0.5) * W / nWin; if (Math.abs(cx - dx) < 14) continue; g.fillStyle = '#8ab0c8'; g.fillRect(cx - 4, Y + H - 4, 8, 3); g.fillStyle = 'rgba(200,230,255,0.12)'; g.fillRect(cx - 5, Y + H - 16, 10, 12); }
    // yan pencereler
    if (b.h >= 6) { g.fillStyle = '#8ab0c8'; g.fillRect(X + 1, Y + H / 2 - 4, 3, 8); g.fillRect(X + W - 4, Y + H / 2 - 4, 3, 8); }
    // eşyalar
    for (let ly = 1; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) {
      const tx = b.x + lx, ty = b.y + ly, i = ty * WW + tx, o = world.obj[i];
      if (!o) continue;
      const cx = tx * TS + 8, cy = ty * TS + 8;
      if (isFurnO(o)) this.furn(g, o, cx, cy, world, i, b, hash2(tx, ty, 17));
      else Spr.object(g, g, o, cx, cy, hash2(tx, ty, 77), world);
    }
    void hs;
  },
  wallDecor(g, b, X, Y, W) {
    const t = b.type, h = (k) => hash2(b.x * 3 + k, b.y, 29);
    const win = (x) => { g.fillStyle = '#3a2a1c'; g.fillRect(x - 5, Y + 2, 10, 9); g.fillStyle = '#8ab0c8'; g.fillRect(x - 4, Y + 3, 8, 7); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 4, Y + 3, 3, 7); g.fillStyle = '#3a2a1c'; g.fillRect(x - 0.5, Y + 3, 1, 7); };
    const shelf = (x0, x1) => {
      g.fillStyle = '#4a3020'; g.fillRect(x0, Y + 5, x1 - x0, 1.5); g.fillRect(x0, Y + 10, x1 - x0, 1.5);
      const cols = ['#c8402c', '#e0c060', '#4a7aa8', '#6a9a4a', '#d8d0c0', '#8a5a2a', '#b070a0'];
      for (let x = x0 + 1; x < x1 - 2; x += 3) { g.fillStyle = cols[Math.floor(h(x) * cols.length)]; g.fillRect(x, Y + 2 + h(x + 1) * 1.5, 2, 3); g.fillStyle = cols[Math.floor(h(x + 7) * cols.length)]; g.fillRect(x, Y + 7 + h(x + 2) * 1.5, 2, 3); }
    };
    const poster = (x) => { g.fillStyle = '#e8dcb8'; g.fillRect(x - 3, Y + 2, 6, 8); g.fillStyle = '#3a2a1c'; g.fillRect(x - 2, Y + 3, 4, 1); g.fillRect(x - 1.5, Y + 5, 3, 3); g.fillRect(x - 2, Y + 8.5, 4, 0.8); };
    const frame = (x, col) => { g.fillStyle = '#8a6a30'; g.fillRect(x - 5, Y + 2, 10, 8); g.fillStyle = col; g.fillRect(x - 4, Y + 3, 8, 6); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x - 4, Y + 3, 8, 2); };
    const x0 = X + 8, x1 = X + W - 8;
    switch (t) {
      case 'general': case 'fence': case 'mine': case 'cabin': shelf(x0, x1); break;
      case 'doctor': shelf(x0, X + W * 0.55); win(X + W * 0.78); break;
      case 'gunsmith': case 'butcher': {
        for (let x = x0; x < x1; x += 6) {
          if (t === 'gunsmith') { g.fillStyle = '#2a2a2e'; g.fillRect(x, Y + 2, 1.5, 9); g.fillStyle = '#6a4428'; g.fillRect(x - 0.5, Y + 7, 2.5, 4); }
          else { g.fillStyle = '#6a6a6a'; g.fillRect(x, Y + 2, 1, 2); this.ell(g, x + 0.5, Y + 6.5, 2, 3, h(x) < 0.5 ? '#9a3a2a' : '#b8584a'); }
        }
        break;
      }
      case 'saloon': {
        g.fillStyle = '#7a8a90'; g.fillRect(X + 12, Y + 2, 58, 8); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(X + 12, Y + 2, 58, 3);
        g.fillStyle = '#8a6a30'; g.strokeStyle = '#8a6a30'; g.lineWidth = 1; g.strokeRect(X + 11.5, Y + 1.5, 59, 9);
        for (let x = X + 14; x < X + 68; x += 4) { g.fillStyle = ['#6a3a1a', '#3a5a2a', '#8a7a4a', '#5a2a2a'][Math.floor(h(x) * 4)]; g.fillRect(x, Y + 5, 2, 5); }
        frame(X + W * 0.72, '#6a7a5a'); this.ell(g, X + W * 0.86, Y + 6, 5, 3, '#6a4a2a'); g.fillStyle = '#e8dcc8'; g.fillRect(X + W * 0.86 - 6, Y + 3, 3, 2); g.fillRect(X + W * 0.86 + 3, Y + 3, 3, 2);
        break;
      }
      case 'sheriff': poster(X + 14); poster(X + 24); poster(X + 34); win(X + W * 0.72); break;
      case 'church': {
        const cx = X + W / 2;
        g.fillStyle = '#c8a040'; g.fillRect(cx - 0.8, Y + 2, 1.6, 9); g.fillRect(cx - 3, Y + 4, 6, 1.6);
        for (const x of [X + W * 0.2, X + W * 0.8]) { g.fillStyle = '#3a2a1c'; g.fillRect(x - 4, Y + 1, 8, 10); const c = ['#c83a3a', '#3a6ac8', '#e0c040', '#3a9a5a']; for (let k = 0; k < 4; k++) { g.fillStyle = c[k]; g.fillRect(x - 3 + (k % 2) * 3, Y + 2 + (k >> 1) * 4, 3, 4); } }
        break;
      }
      case 'bank': { frame(X + W * 0.3, '#5a4a3a'); this.circ(g, X + W * 0.6, Y + 6, 4, '#c8b060'); this.circ(g, X + W * 0.6, Y + 6, 3, '#f0ead8'); g.fillStyle = '#1a1a1a'; g.fillRect(X + W * 0.6 - 0.4, Y + 3.5, 0.8, 2.5); g.fillRect(X + W * 0.6, Y + 5.6, 2, 0.8); frame(X + W * 0.85, '#3a5a4a'); break; }
      case 'hotel': { for (let k = 0; k < 8; k++) { g.fillStyle = '#6a4a2a'; g.fillRect(X + 10 + k * 3, Y + 4 + (k % 2) * 3, 2, 2); g.fillStyle = '#c8a040'; g.fillRect(X + 10.5 + k * 3, Y + 6 + (k % 2) * 3, 1, 1.5); } frame(X + W * 0.5, '#6a5a3a'); win(X + W * 0.8); break; }
      case 'station': { g.fillStyle = '#1a1a1a'; g.fillRect(X + W * 0.55, Y + 2, 26, 9); g.fillStyle = '#d8d0c0'; for (let k = 0; k < 3; k++) g.fillRect(X + W * 0.55 + 2, Y + 4 + k * 2.4, 22 * (0.6 + h(k) * 0.4), 0.8); this.circ(g, X + 20, Y + 6, 4, '#f0ead8'); break; }
      case 'barber': { for (const x of [X + 24, X + W - 24]) { g.fillStyle = '#8a6a30'; g.fillRect(x - 6, Y + 1, 12, 10); g.fillStyle = '#a8c0c8'; g.fillRect(x - 5, Y + 2, 10, 8); } g.fillStyle = '#e8e0d0'; g.fillRect(X + W / 2 - 1, Y + 1, 2, 10); g.fillStyle = '#c83030'; for (let k = 0; k < 4; k++) g.fillRect(X + W / 2 - 1, Y + 2 + k * 2.5, 2, 1); break; }
      case 'tailor': { for (let x = x0; x < x1 - 20; x += 5) { g.fillStyle = ['#6a2a4a', '#2a4a6a', '#8a6a2a', '#3a5a3a', '#7a3a2a'][Math.floor(h(x) * 5)]; g.fillRect(x, Y + 2, 4, 9); } win(X + W - 16); break; }
      case 'stable': case 'barn': { for (let x = x0 + 4; x < x1; x += 14) { g.strokeStyle = '#6a6a6a'; g.lineWidth = 1; g.beginPath(); g.arc(x, Y + 6, 2.5, 0.3, Math.PI - 0.3, true); g.stroke(); } g.fillStyle = '#5a3a1a'; g.fillRect(X + W * 0.4, Y + 3, 10, 2); break; }
      default: win(X + W * 0.3); if (b.w >= 7) frame(X + W * 0.7, '#5a6a4a'); break;
    }
  },
  furn(g, o, cx, cy, world, i, b, h) {
    const same = (d) => world.obj[i + d] === o;
    const legs = '#3a2416';
    switch (o) {
      case O.COUNTER: case O.BAR: case O.TICKET: {
        const top = o === O.BAR ? '#4a2a18' : o === O.TICKET ? '#6a5236' : b.type === 'bank' ? '#5a3a22' : '#9a7048';
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 5, 16, 3);
        g.fillStyle = shadeHex(top, -0.3); g.fillRect(cx - 8, cy + 1, 16, 6);
        g.fillStyle = top; g.fillRect(cx - 8, cy - 5, 16, 7);
        g.fillStyle = shadeHex(top, 0.2); g.fillRect(cx - 8, cy - 5, 16, 1);
        if (!same(-1)) { g.fillStyle = shadeHex(top, -0.45); g.fillRect(cx - 8, cy - 5, 1.5, 12); }
        if (!same(1)) { g.fillStyle = shadeHex(top, -0.45); g.fillRect(cx + 6.5, cy - 5, 1.5, 12); }
        if (o === O.BAR) { g.fillStyle = '#c8a040'; g.fillRect(cx - 8, cy + 5, 16, 1); if (h < 0.5) { g.fillStyle = 'rgba(220,230,240,0.8)'; g.fillRect(cx - 3 + h * 6, cy - 3, 2, 3); } if (h > 0.6) { g.fillStyle = '#5a2a14'; g.fillRect(cx + 2, cy - 5, 2, 4); } }
        else if (b.type === 'bank' || o === O.TICKET) { g.fillStyle = '#c8b060'; for (let x = cx - 7; x < cx + 8; x += 3) g.fillRect(x, cy - 12, 0.8, 8); g.fillRect(cx - 8, cy - 12, 16, 1); }
        else if (h < 0.25) { g.fillStyle = '#c8b890'; g.fillRect(cx - 3, cy - 4, 5, 4); g.fillStyle = '#e0d0a0'; g.fillRect(cx - 2, cy - 5, 3, 1); }
        else if (h < 0.45) { g.fillStyle = '#8a8a8a'; g.fillRect(cx - 4, cy - 3, 6, 1); g.fillRect(cx - 1.5, cy - 5, 1, 3); g.fillStyle = '#c8a040'; g.fillRect(cx - 5, cy - 4, 2, 1); g.fillRect(cx + 1, cy - 4, 2, 1); }
        else if (h < 0.6) { g.fillStyle = 'rgba(200,220,230,0.8)'; g.fillRect(cx + 1, cy - 5, 4, 4); g.fillStyle = '#c84030'; g.fillRect(cx + 2, cy - 3, 2, 2); }
        break;
      }
      case O.TABLE: case O.CARDTABLE: {
        const chair = (x) => { g.fillStyle = '#4a2e1a'; g.fillRect(x - 2.5, cy - 2, 5, 5); g.fillStyle = '#6a4428'; g.fillRect(x - 2.5, cy - 2, 5, 1); };
        chair(cx - 11); chair(cx + 11);
        this.ell(g, cx + 1, cy + 3, 7, 3, 'rgba(0,0,0,0.25)');
        if (o === O.CARDTABLE) {
          this.circ(g, cx, cy, 7, '#4a2e1a'); this.circ(g, cx, cy, 6, '#2e6a3a');
          g.fillStyle = '#f0ece0'; g.fillRect(cx - 3, cy - 2, 2, 3); g.fillRect(cx + 1, cy - 1, 2, 3); g.fillRect(cx - 1, cy + 2, 2, 2);
          g.fillStyle = '#c83030'; g.fillRect(cx + 3, cy - 3, 1.5, 1.5); g.fillStyle = '#3050c0'; g.fillRect(cx - 4.5, cy + 1, 1.5, 1.5);
        } else {
          this.circ(g, cx, cy, 6, '#4a2e1a'); this.circ(g, cx, cy - 0.5, 5.2, '#6e4a2c');
          g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(cx - 3, cy - 4, 5, 1);
          if (h < 0.6) { g.fillStyle = '#d8c070'; g.fillRect(cx - 2, cy - 2, 2, 2.5); g.fillStyle = '#f0ece0'; g.fillRect(cx - 2, cy - 2.5, 2, 0.8); }
          if (h > 0.4) { g.fillStyle = '#4a2a14'; g.fillRect(cx + 1.5, cy - 3, 1.5, 3.5); }
        }
        break;
      }
      case O.PIANO: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 8, cy + 5, 16, 2);
        g.fillStyle = '#2a1a12'; g.fillRect(cx - 8, cy - 7, 16, 12); g.fillStyle = '#3e2a1c'; g.fillRect(cx - 7, cy - 6, 14, 3);
        g.fillStyle = '#f0ece0'; g.fillRect(cx - 7, cy + 1, 14, 3); g.fillStyle = '#1a1a1a'; for (let x = cx - 6; x < cx + 7; x += 2) g.fillRect(x, cy + 1, 1, 1.8);
        g.fillStyle = '#e8d070'; g.fillRect(cx + 4, cy - 9, 1.5, 3);
        break;
      }
      case O.BED: {
        const bl = ['#8a2a2a', '#2a4a6a', '#6a5a2a', '#4a6a3a'][Math.floor(h * 4)];
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 5, cy - 5, 13, 23);
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 7, cy - 7, 13, 23);
        g.fillStyle = '#e8e4d8'; g.fillRect(cx - 6, cy - 6, 11, 21);
        g.fillStyle = '#f8f4ec'; g.fillRect(cx - 5, cy - 5, 9, 4);
        g.fillStyle = bl; g.fillRect(cx - 6, cy + 1, 11, 14); g.fillStyle = shadeHex(bl, 0.2); g.fillRect(cx - 6, cy + 1, 11, 1.5);
        g.fillStyle = '#3a2416'; g.fillRect(cx - 7, cy - 8, 13, 2);
        break;
      }
      case O.STOVE: {
        this.ell(g, cx + 1, cy + 5, 6, 2, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#3a3a3a'; g.fillRect(cx - 1.5, cy - 14, 3, 10);
        g.fillStyle = '#222226'; g.fillRect(cx - 5, cy - 5, 10, 10); g.fillStyle = '#3a3a40'; g.fillRect(cx - 5, cy - 5, 10, 2);
        g.fillStyle = '#e87020'; g.fillRect(cx - 3, cy + 1, 6, 2); g.fillStyle = '#ffc060'; g.fillRect(cx - 1, cy + 1, 2, 1);
        break;
      }
      case O.DESK: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 7, cy + 4, 29, 3);
        g.fillStyle = '#4a2e1a'; g.fillRect(cx - 7, cy - 1, 29, 6);
        g.fillStyle = '#6e4a2c'; g.fillRect(cx - 7, cy - 6, 29, 7); g.fillStyle = 'rgba(255,230,190,0.15)'; g.fillRect(cx - 7, cy - 6, 29, 1);
        g.fillStyle = '#f0e8d0'; g.fillRect(cx - 3, cy - 5, 6, 4); g.fillRect(cx + 4, cy - 4, 4, 3);
        g.fillStyle = '#1a1a1a'; g.fillRect(cx + 10, cy - 4, 2, 2);
        g.fillStyle = '#e8d070'; this.circ(g, cx + 16, cy - 3, 1.8, '#e8d070'); g.fillStyle = '#6a6a6a'; g.fillRect(cx + 15.5, cy - 2, 1, 2);
        break;
      }
      case O.CELL: {
        const hz = same(-1) || same(1), vt = same(-WW) || same(WW);
        g.fillStyle = '#2e2e34';
        if (hz || !vt) { g.fillRect(cx - 8, cy - 10, 16, 1.5); g.fillRect(cx - 8, cy + 4, 16, 1.5); for (let x = cx - 7; x < cx + 8; x += 3) g.fillRect(x, cy - 10, 1, 15); }
        if (vt) { g.fillRect(cx - 1, cy - 8, 2, 16); for (let y = cy - 7; y < cy + 8; y += 3) g.fillRect(cx - 2, y, 4, 1); }
        break;
      }
      case O.PEW: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 3, 16, 2);
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 8, cy - 5, 16, 3);
        g.fillStyle = '#7a5434'; g.fillRect(cx - 8, cy - 2, 16, 5);
        if (!same(-1)) { g.fillStyle = '#3a2416'; g.fillRect(cx - 8, cy - 5, 1.5, 8); }
        if (!same(1)) { g.fillStyle = '#3a2416'; g.fillRect(cx + 6.5, cy - 5, 1.5, 8); }
        break;
      }
      case O.ALTAR: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 6, cy + 5, 28, 2);
        g.fillStyle = '#6a4a2c'; g.fillRect(cx - 6, cy - 4, 28, 9); g.fillStyle = '#f0ece0'; g.fillRect(cx - 6, cy - 5, 28, 6);
        g.fillStyle = '#c8a040'; g.fillRect(cx - 6, cy, 28, 1); g.fillRect(cx + 7, cy - 4, 1, 4); g.fillRect(cx + 5.5, cy - 3, 4, 1);
        g.fillStyle = '#f8f0d8'; g.fillRect(cx - 3, cy - 8, 1.5, 4); g.fillRect(cx + 17, cy - 8, 1.5, 4); g.fillStyle = '#ffc060'; g.fillRect(cx - 3, cy - 9, 1.5, 1); g.fillRect(cx + 17, cy - 9, 1.5, 1);
        break;
      }
      case O.SAFE: {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 5, cy + 5, 13, 2);
        g.fillStyle = '#2e3238'; g.fillRect(cx - 6, cy - 7, 12, 13); g.fillStyle = '#44484e'; g.fillRect(cx - 5, cy - 6, 10, 11);
        this.circ(g, cx, cy - 1, 2.5, '#c8b060'); this.circ(g, cx, cy - 1, 1, '#2e3238'); g.fillStyle = '#c8b060'; g.fillRect(cx + 3, cy - 2, 1.5, 3);
        break;
      }
      case O.TUB: {
        this.ell(g, cx + 1, cy + 3, 8, 4, 'rgba(0,0,0,0.25)');
        this.ell(g, cx, cy + 1, 7.5, 5, '#9aa0a6'); this.ell(g, cx, cy + 0.5, 6, 3.6, '#7aa8c0'); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx - 3, cy - 1, 3, 1);
        break;
      }
      case O.BCHAIR: {
        this.ell(g, cx, cy + 4, 5, 2, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#c0c4c8'; g.fillRect(cx - 1, cy + 1, 2, 4);
        g.fillStyle = '#6a1818'; g.fillRect(cx - 4.5, cy - 7, 9, 4); g.fillStyle = '#8a2020'; g.fillRect(cx - 4.5, cy - 3, 9, 6);
        g.fillStyle = '#c0c4c8'; g.fillRect(cx - 5.5, cy - 3, 1, 5); g.fillRect(cx + 4.5, cy - 3, 1, 5);
        break;
      }
      case O.RACK: {
        g.fillStyle = '#4a2e1a'; g.fillRect(cx - 7, cy - 8, 14, 2); g.fillRect(cx - 7, cy + 3, 14, 2);
        for (let x = cx - 5; x < cx + 6; x += 3.5) { g.fillStyle = '#2a2a2e'; g.fillRect(x, cy - 9, 1.2, 10); g.fillStyle = '#6a4428'; g.fillRect(x - 0.4, cy, 2, 5); }
        break;
      }
      case O.WORKBENCH: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 8, cy + 4, 16, 3);
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 8, cy, 16, 5); g.fillStyle = '#8a6440'; g.fillRect(cx - 8, cy - 5, 16, 6);
        g.fillStyle = '#9a9ea4'; g.fillRect(cx - 5, cy - 3, 6, 1.5); g.fillStyle = '#6a4428'; g.fillRect(cx + 2, cy - 4, 1.5, 4); g.fillStyle = '#5a5a5a'; g.fillRect(cx + 1, cy - 4.5, 3.5, 1.5);
        if (b.type === 'butcher') { this.ell(g, cx - 1, cy - 2, 3, 2, '#a8382a'); }
        break;
      }
      case O.STALL: {
        this.ell(g, cx, cy + 2, 7, 5, 'rgba(200,168,96,0.5)');
        g.fillStyle = '#5a3a1e'; g.fillRect(cx - 1.5, cy - 8, 3, 16); g.fillStyle = '#7a5430'; g.fillRect(cx - 1.5, cy - 8, 1, 16);
        g.fillStyle = '#4a2e18'; g.fillRect(cx - 2.5, cy - 9, 5, 2);
        break;
      }
      case O.SHELF: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 6, cy + 5, 14, 2);
        g.fillStyle = '#4a2e1a'; g.fillRect(cx - 7, cy - 7, 14, 13);
        const cols = ['#c8402c', '#e0c060', '#4a7aa8', '#6a9a4a', '#d8d0c0', '#8a5a2a'];
        for (let r = 0; r < 3; r++) { g.fillStyle = '#6a4428'; g.fillRect(cx - 6, cy - 6 + r * 4 + 3, 12, 1); for (let k = 0; k < 4; k++) { g.fillStyle = cols[Math.floor(hash2(i, r * 4 + k, 5) * cols.length)]; g.fillRect(cx - 5.5 + k * 3, cy - 6 + r * 4, 2, 3); } }
        break;
      }
      case O.CHAIR: { g.fillStyle = '#4a2e1a'; g.fillRect(cx - 3, cy - 5, 6, 2); g.fillStyle = '#6a4428'; g.fillRect(cx - 3, cy - 3, 6, 6); break; }
      case O.PLANT: {
        g.fillStyle = '#8a4a2a'; g.fillRect(cx - 3, cy + 1, 6, 5); g.fillStyle = '#6a3a1e'; g.fillRect(cx - 3.5, cy + 1, 7, 1.5);
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + h; this.ell(g, cx + Math.cos(a) * 3, cy - 2 + Math.sin(a) * 2.5, 2.4, 1.2, k % 2 ? '#4a7a3a' : '#5a8a44', a); }
        break;
      }
      case O.HOMECHEST: {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 5, cy + 4, 12, 2);
        g.fillStyle = '#6a4428'; g.fillRect(cx - 6, cy - 4, 12, 9); g.fillStyle = '#8a5a34'; g.fillRect(cx - 6, cy - 4, 12, 3);
        g.fillStyle = '#3a2a18'; g.fillRect(cx - 4, cy - 4, 1.5, 9); g.fillRect(cx + 2.5, cy - 4, 1.5, 9); g.fillStyle = '#c8a040'; g.fillRect(cx - 1, cy - 1, 2, 2);
        break;
      }
      case O.MANNEQUIN: {
        g.fillStyle = '#5a3a22'; g.fillRect(cx - 0.5, cy, 1, 6); g.fillRect(cx - 3, cy + 5, 6, 1);
        const c = ['#6a2a4a', '#2a4a6a', '#8a6a2a', '#3a5a3a'][Math.floor(h * 4)];
        this.ell(g, cx, cy - 2, 4, 3.5, c); this.ell(g, cx, cy - 6, 2.2, 1.5, '#d8c8a8');
        break;
      }
    }
    void legs;
  },
  building(g, o, b, world) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS;
    const tall = d.tall ? 30 : 22;
    const FW = b.type === 'mineentrance' ? 14 : tall;
    const wy = Y + H - FW;
    const h = hash2(b.x, b.y, 5);
    const wall = d.wall, roof = d.roof;
    // gölge
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(X + 6, Y + 4, W, H);
    if (b.type === 'mineentrance') {
      g.fillStyle = b.cave ? '#3a342e' : '#4a3a2a'; g.fillRect(X, wy, W, FW);
      this.ell(g, X + W / 2, Y + H - 2, W * 0.32, FW * 0.75, '#0a0806');
      if (!b.cave) { g.fillStyle = '#6a4a2e'; g.fillRect(X + W * 0.15, wy, 3, FW); g.fillRect(X + W * 0.85 - 3, wy, 3, FW); g.fillRect(X + W * 0.12, wy, W * 0.76, 3); }
      return;
    }
    if (b.type === 'lighthouse') {
      this.ell(g, X + W / 2 + 4, Y + H, W * 0.5, 6, 'rgba(0,0,0,0.3)');
      g.fillStyle = '#e8e0d8'; g.fillRect(X + W * 0.2, Y + H - 34, W * 0.6, 34);
      g.fillStyle = '#b0302a'; g.fillRect(X + W * 0.2, Y + H - 24, W * 0.6, 6); g.fillRect(X + W * 0.2, Y + H - 12, W * 0.6, 5);
      g.fillStyle = '#2a2420'; g.fillRect(X + W / 2 - 3, Y + H - 10, 6, 10);
      o.fillStyle = '#e8e0d8'; o.fillRect(X + W * 0.24, Y - 20, W * 0.52, H - 12);
      o.fillStyle = '#b0302a'; o.fillRect(X + W * 0.24, Y - 4, W * 0.52, 6);
      o.fillStyle = '#2a2420'; o.fillRect(X + W * 0.2, Y - 30, W * 0.6, 10);
      o.fillStyle = '#f8e8a0'; o.fillRect(X + W * 0.28, Y - 28, W * 0.44, 6);
      o.fillStyle = '#a02a20'; o.beginPath(); o.moveTo(X + W * 0.18, Y - 30); o.lineTo(X + W / 2, Y - 40); o.lineTo(X + W * 0.82, Y - 30); o.fill();
      return;
    }
    if (b.type === 'market') { this.market(g, o, b, world); return; }
    if (b.modern && !MODERN_SKIP.has(b.type)) { this.modernBuilding(g, o, b, world); return; }
    const f = b.enter ? o : g;
    // Ön cephe
    const wallC = b.def.ruin ? '#5a4c3c' : wall;
    f.fillStyle = wallC; f.fillRect(X, wy, W, FW);
    if (d.brick) {
      f.fillStyle = 'rgba(0,0,0,0.18)';
      for (let yy = wy; yy < Y + H; yy += 3) for (let xx = X + ((yy / 3) % 2) * 3; xx < X + W; xx += 6) f.fillRect(xx, yy, 1, 3);
      for (let yy = wy; yy < Y + H; yy += 3) f.fillRect(X, yy, W, 0.6);
    } else {
      f.fillStyle = 'rgba(0,0,0,0.16)';
      for (let xx = X + 2; xx < X + W; xx += 4) f.fillRect(xx, wy, 1, FW);
      f.fillStyle = 'rgba(255,255,255,0.08)'; f.fillRect(X, wy, W, 2);
    }
    f.fillStyle = 'rgba(0,0,0,0.35)'; f.fillRect(X, Y + H - 2, W, 2);
    // kapı
    const dx = b.door.x;
    if (b.type === 'stable' || b.type === 'barn') {
      f.fillStyle = '#2a1e14'; f.fillRect(dx - 10, Y + H - 16, 20, 16);
      f.strokeStyle = '#c8b090'; f.lineWidth = 1; f.beginPath(); f.moveTo(dx - 10, Y + H - 16); f.lineTo(dx + 10, Y + H); f.moveTo(dx + 10, Y + H - 16); f.lineTo(dx - 10, Y + H); f.stroke();
    } else if (b.type === 'station') {
      f.fillStyle = '#2a2016'; f.fillRect(dx - 5, Y + H - 14, 10, 14);
    } else {
      f.fillStyle = '#2a1c12'; f.fillRect(dx - 4, Y + H - 14, 8, 14);
      if (b.type === 'saloon' || b.type === 'cantina' || b.type === 'gambling') { /* yarım kanatlı kapılar Juice.drawAfterCovers'ta, salınarak çizilir */ }
      else { f.fillStyle = '#5a3e26'; f.fillRect(dx - 3, Y + H - 13, 6, 12); f.fillStyle = '#c8a040'; f.fillRect(dx + 1.5, Y + H - 7, 1, 1); }
    }
    // pencereler
    const nWin = Math.max(1, Math.floor(b.w / 3));
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * W / nWin;
      if (Math.abs(cx - dx) < 10) continue;
      f.fillStyle = '#3a2a1c'; f.fillRect(cx - 4, wy + FW - 16, 8, 9);
      f.fillStyle = b.def.ruin ? '#101010' : '#27394a'; f.fillRect(cx - 3, wy + FW - 15, 6, 7);
      f.fillStyle = 'rgba(200,220,240,0.25)'; f.fillRect(cx - 3, wy + FW - 15, 2, 7);
      if (d.tall) { f.fillStyle = '#3a2a1c'; f.fillRect(cx - 4, wy + 3, 8, 7); f.fillStyle = '#27394a'; f.fillRect(cx - 3, wy + 4, 6, 5); }
    }
    // veranda direkleri & tente
    if (!b.def.ruin && b.type !== 'station' && b.type !== 'barn' && b.type !== 'hermit') {
      o.fillStyle = shadeHex(roof, -0.1); o.fillRect(X - 1, Y + H - 3, W + 2, 5);
      o.fillStyle = 'rgba(0,0,0,0.2)'; o.fillRect(X - 1, Y + H + 1, W + 2, 1);
      g.fillStyle = '#4a3422'; g.fillRect(X + 1, Y + H, 1.6, 14); g.fillRect(X + W - 2.6, Y + H, 1.6, 14);
    }
    // Çatı
    const ry0 = Y - 8, rh = wy - ry0;
    if (b.def.ruin) {
      o.fillStyle = shadeHex(roof, -0.1);
      for (let k = 0; k < b.w; k++) if (hash2(b.x + k, b.y, 3) > 0.4) o.fillRect(X + k * TS, ry0 + hash2(k, b.y, 1) * 8, TS - 2, rh - hash2(k, b.y, 2) * 16);
      o.fillStyle = '#3a3024'; o.fillRect(X, wy - 4, W, 4);
    } else {
      o.fillStyle = shadeHex(roof, 0.08); o.fillRect(X - 2, ry0, W + 4, rh / 2);
      o.fillStyle = shadeHex(roof, -0.12); o.fillRect(X - 2, ry0 + rh / 2, W + 4, rh / 2);
      o.fillStyle = 'rgba(0,0,0,0.18)';
      for (let yy = ry0 + 3; yy < ry0 + rh; yy += 4) o.fillRect(X - 2, yy, W + 4, 1);
      for (let yy = ry0; yy < ry0 + rh; yy += 4) for (let xx = X + ((yy / 4) % 2) * 3; xx < X + W; xx += 7) o.fillRect(xx, yy, 1, 4);
      o.fillStyle = shadeHex(roof, 0.25); o.fillRect(X - 2, ry0 + rh / 2 - 1, W + 4, 2);
      o.fillStyle = 'rgba(0,0,0,0.3)'; o.fillRect(X - 2, ry0 + rh - 2, W + 4, 2);
      // kar örtüsü
      if (world && world.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1))) {
        o.fillStyle = 'rgba(236,241,246,0.92)'; o.fillRect(X - 2, ry0, W + 4, rh * 0.62);
        o.fillStyle = 'rgba(214,222,230,0.9)';
        for (let xx = X - 2; xx < X + W + 2; xx += 4) o.fillRect(xx, ry0 + rh * 0.62, 4, 1 + hash2(xx, b.y, 9) * 3);
      }
      // baca
      if (h > 0.3 && b.type !== 'station') { o.fillStyle = '#5a4a44'; o.fillRect(X + W * (0.2 + h * 0.5), ry0 + 2, 5, 9); o.fillStyle = '#2a2220'; o.fillRect(X + W * (0.2 + h * 0.5), ry0 + 2, 5, 2); }
    }
    // sahte cephe (western tarzı)
    if (!d.church && b.type !== 'station' && b.type !== 'barn' && b.type !== 'hermit' && b.type !== 'cabin' && !b.def.ruin && b.type !== 'house' && b.type !== 'property' && b.type !== 'ranch') {
      const fh = 12 + (d.tall ? 6 : 0);
      o.fillStyle = wallC;
      o.beginPath(); o.moveTo(X, wy); o.lineTo(X, wy - fh + 4); o.lineTo(X + W * 0.2, wy - fh + 4); o.lineTo(X + W * 0.2, wy - fh); o.lineTo(X + W * 0.8, wy - fh); o.lineTo(X + W * 0.8, wy - fh + 4); o.lineTo(X + W, wy - fh + 4); o.lineTo(X + W, wy); o.fill();
      o.fillStyle = 'rgba(0,0,0,0.15)'; for (let xx = X + 2; xx < X + W; xx += 4) o.fillRect(xx, wy - fh, 1, fh);
      o.fillStyle = shadeHex(wallC, -0.35); o.fillRect(X, wy - fh + 3, W, 1);
      const txt = SIGN_TEXT[b.type];
      if (txt) {
        const sw = Math.min(W - 8, txt.length * 4.6 + 6);
        o.fillStyle = d.sign || '#c9a45c'; o.fillRect(X + W / 2 - sw / 2, wy - fh + 1, sw, 8);
        o.fillStyle = '#1a120c'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle';
        o.fillText(txt, X + W / 2, wy - fh + 5.2);
      }
    } else if (SIGN_TEXT[b.type]) {
      const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
      const sw = txt.length * 4.6 + 6;
      o.fillStyle = d.sign || '#c9a45c'; o.fillRect(X + W / 2 - sw / 2, wy - 9, sw, 8);
      o.fillStyle = '#1a120c'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(txt, X + W / 2, wy - 4.8);
    }
    if (d.church) {
      const cx = X + W / 2;
      o.fillStyle = '#e8e0d0'; o.fillRect(cx - 7, ry0 - 26, 14, 30);
      o.fillStyle = '#4a3a34'; o.beginPath(); o.moveTo(cx - 9, ry0 - 26); o.lineTo(cx, ry0 - 42); o.lineTo(cx + 9, ry0 - 26); o.fill();
      o.fillStyle = '#2a2420'; o.fillRect(cx - 3, ry0 - 18, 6, 8);
      o.fillStyle = '#d8c080'; o.fillRect(cx - 0.8, ry0 - 50, 1.6, 9); o.fillRect(cx - 3, ry0 - 47, 6, 1.6);
    }
    if (b.type === 'station') {
      o.fillStyle = '#3a4a5a'; o.fillRect(X - 30, Y + H - 2, W + 60, 6);
      o.fillStyle = 'rgba(0,0,0,0.25)'; o.fillRect(X - 30, Y + H + 4, W + 60, 2);
      g.fillStyle = '#4a3422'; for (let xx = X - 28; xx < X + W + 30; xx += 24) g.fillRect(xx, Y + H + 3, 2, 12);
    }
    if (b.type === 'property' && !b.owned) {
      g.fillStyle = '#5a3e26'; g.fillRect(X + W + 4, Y + H - 2, 1.5, 10);
      g.fillStyle = '#e0d0a0'; g.fillRect(X + W, Y + H - 8, 10, 6);
    }
  },

  /* ---------- Zengin şehrin binaları ----------
     Tuğla ya da kesme taş cephe, iki kat, kornişler, beyaz çerçeveli pencereler, çizgili tente,
     düz çatı ve korkuluk; tabela kapının üstünde koyu levha. */
  modernBuilding(g, o, b, world) {
    const d = b.def, X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS;
    const FW = d.tall ? 40 : 32, wy = Y + H - FW, h = hash2(b.x, b.y, 5);
    const pal = MODERN_WALLS[Math.floor(hash2(b.x, b.y, 7) * MODERN_WALLS.length)];
    const wallC = MODERN_TYPE_WALL[b.type] || pal.c, brick = MODERN_TYPE_WALL[b.type] ? false : pal.brick;
    const f = b.enter ? o : g;
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(X + 6, Y + 4, W, H);
    // cephe ve dokusu
    f.fillStyle = wallC; f.fillRect(X, wy, W, FW);
    if (brick) {
      f.fillStyle = 'rgba(0,0,0,0.2)';
      for (let yy = wy; yy < Y + H; yy += 3) { f.fillRect(X, yy, W, 0.7); for (let xx = X + (((yy - wy) / 3) % 2) * 3; xx < X + W; xx += 6) f.fillRect(xx, yy, 0.8, 3); }
    } else {
      f.fillStyle = 'rgba(0,0,0,0.13)';
      for (let yy = wy; yy < Y + H; yy += 5) { f.fillRect(X, yy, W, 0.7); for (let xx = X + (((yy - wy) / 5) % 2) * 5; xx < X + W; xx += 10) f.fillRect(xx, yy, 0.7, 5); }
    }
    // kat arası ve üst korniş, alt kaide
    const mid = wy + FW - 19;
    f.fillStyle = '#e4dccb'; f.fillRect(X, mid, W, 2); f.fillRect(X - 1, wy, W + 2, 3);
    f.fillStyle = 'rgba(0,0,0,0.25)'; f.fillRect(X, mid + 2, W, 1); f.fillRect(X - 1, wy + 3, W + 2, 1);
    f.fillStyle = '#6a645c'; f.fillRect(X, Y + H - 3, W, 3);
    // kapı: çift kanat, üstünde camlı tepe penceresi
    const dx = b.door.x;
    f.fillStyle = '#e4dccb'; f.fillRect(dx - 6, Y + H - 17, 12, 17);
    f.fillStyle = '#2a1a12'; f.fillRect(dx - 5, Y + H - 15, 10, 15);
    f.fillStyle = '#4a2e1c'; f.fillRect(dx - 4.5, Y + H - 11, 4, 10); f.fillRect(dx + 0.5, Y + H - 11, 4, 10);
    f.fillStyle = '#7aa0b8'; f.fillRect(dx - 4.5, Y + H - 14.5, 9, 2.5);
    f.fillStyle = '#d8b850'; f.fillRect(dx - 1, Y + H - 6, 0.8, 1); f.fillRect(dx + 0.4, Y + H - 6, 0.8, 1);
    // pencereler: altta geniş vitrinler, üstte kemerli dar pencereler
    const shop = MODERN_SHOP.has(b.type), nWin = Math.max(2, Math.floor(b.w / 2.5));
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * W / nWin;
      // üst kat
      f.fillStyle = '#e4dccb'; f.fillRect(cx - 3.5, wy + 5, 7, 11);
      f.fillStyle = '#26384a'; f.fillRect(cx - 2.5, wy + 7, 5, 8); this.ell(f, cx, wy + 7, 2.5, 1.6, '#26384a');
      f.fillStyle = 'rgba(200,225,245,0.3)'; f.fillRect(cx - 2.5, wy + 7, 1.5, 8);
      f.fillStyle = '#e4dccb'; f.fillRect(cx - 0.4, wy + 7, 0.8, 8); f.fillRect(cx - 4, wy + 15.5, 8, 1.2);
      if (d.tall) { f.fillStyle = '#26384a'; f.fillRect(cx - 2.5, mid - 6, 5, 4); f.fillStyle = '#e4dccb'; f.fillRect(cx - 3, mid - 2, 6, 1); }
      // zemin kat
      if (Math.abs(cx - dx) < 11) continue;
      if (shop) {
        f.fillStyle = '#e4dccb'; f.fillRect(cx - 6, Y + H - 15, 12, 11);
        f.fillStyle = '#2a3e52'; f.fillRect(cx - 5, Y + H - 14, 10, 9);
        f.fillStyle = 'rgba(200,225,245,0.28)'; f.fillRect(cx - 5, Y + H - 14, 3, 9);
        f.fillStyle = '#e4dccb'; f.fillRect(cx - 0.4, Y + H - 14, 0.8, 9);
        // vitrinde mallar
        for (let q = 0; q < 3; q++) this.circ(f, cx - 3 + q * 3, Y + H - 6.5, 1, ['#c8a040', '#a0402a', '#d8d0c0'][(q + k) % 3]);
      } else {
        f.fillStyle = '#e4dccb'; f.fillRect(cx - 3.5, Y + H - 15, 7, 10);
        f.fillStyle = '#26384a'; f.fillRect(cx - 2.5, Y + H - 14, 5, 8);
        f.fillStyle = 'rgba(200,225,245,0.3)'; f.fillRect(cx - 2.5, Y + H - 14, 1.5, 8);
      }
    }
    // çizgili tente (dükkânlar) ya da düz saçak
    if (shop) {
      const ac = MODERN_AWN[Math.floor(h * MODERN_AWN.length)], ay = Y + H - 18;
      for (let xx = X - 1, k = 0; xx < X + W + 1; xx += 4, k++) { o.fillStyle = k % 2 ? '#efe8da' : ac; o.fillRect(xx, ay, Math.min(4, X + W + 1 - xx), 5); }
      o.fillStyle = 'rgba(0,0,0,0.18)'; o.fillRect(X - 1, ay + 4, W + 2, 1);
      for (let xx = X - 1, k = 0; xx < X + W + 1; xx += 4, k++) { o.fillStyle = k % 2 ? '#efe8da' : ac; o.beginPath(); o.arc(xx + 2, ay + 5, 2, 0, Math.PI); o.fill(); }
    } else {
      o.fillStyle = '#5a5650'; o.fillRect(X - 1, Y + H - 3, W + 2, 3);
    }
    // düz çatı, korkuluk ve baca
    const ry0 = Y - 8, rh = wy - ry0;
    o.fillStyle = '#4e5058'; o.fillRect(X - 2, ry0, W + 4, rh);
    o.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = ry0 + 5; yy < ry0 + rh; yy += 6) o.fillRect(X, yy, W, 1);
    o.fillStyle = '#d4ccbb'; o.fillRect(X - 2, ry0, W + 4, 2.5); o.fillRect(X - 2, ry0, 2.5, rh); o.fillRect(X + W - 0.5, ry0, 2.5, rh); o.fillRect(X - 2, ry0 + rh - 3, W + 4, 3);
    o.fillStyle = 'rgba(0,0,0,0.3)'; o.fillRect(X - 2, ry0 + rh, W + 4, 1);
    if (world && world.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1))) { o.fillStyle = 'rgba(236,241,246,0.9)'; o.fillRect(X + 1, ry0 + 3, W - 2, rh - 6); }
    const chx = X + W * (0.18 + h * 0.6);
    o.fillStyle = '#7a3e2e'; o.fillRect(chx, ry0 + 4, 6, 10); o.fillStyle = '#3a2420'; o.fillRect(chx - 0.5, ry0 + 3, 7, 2);
    if (d.tall) { o.fillStyle = '#e4dccb'; o.fillRect(X + W / 2 - 10, ry0 - 6, 20, 7); o.fillStyle = '#4e5058'; o.fillRect(X + W / 2 - 8, ry0 - 4, 16, 4); }
    // tabela: kapının üstünde, kat arası kornişin altında koyu levha
    const txt = b.type === 'property' ? (b.owned ? 'HOME' : 'FOR SALE') : SIGN_TEXT[b.type];
    if (txt) {
      const sw = Math.min(W - 6, txt.length * 4.6 + 8);
      o.fillStyle = '#1e2a24'; o.fillRect(X + W / 2 - sw / 2, mid - 9, sw, 8);
      o.fillStyle = '#c8a850'; o.fillRect(X + W / 2 - sw / 2, mid - 9, sw, 0.8); o.fillRect(X + W / 2 - sw / 2, mid - 1.8, sw, 0.8);
      o.fillStyle = '#ead490'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(txt, X + W / 2, mid - 4.8);
    }
    if (b.type === 'property' && !b.owned) { g.fillStyle = '#5a3e26'; g.fillRect(X + W + 4, Y + H - 2, 1.5, 10); g.fillStyle = '#e0d0a0'; g.fillRect(X + W, Y + H - 8, 10, 6); }
  },
  /* Açık hava pazarı: tenteli tezgâhlar, sandıklarda mallar, ortada kemerli tabela */
  market(g, o, b, world) {
    const X = b.x * TS, Y = b.y * TS, W = b.w * TS, H = b.h * TS;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X + 4, Y + 4, W, H);
    g.fillStyle = '#b8ac96'; g.fillRect(X, Y, W, H);
    g.fillStyle = 'rgba(0,0,0,0.1)'; for (let yy = Y; yy < Y + H; yy += 8) g.fillRect(X, yy, W, 0.8);
    const n = 4, sw = W / n, goods = [['#c03a2a', '#d84a3a', '#a02a20'], ['#e8c850', '#d8b040', '#f0d870'], ['#8aa8b8', '#a8c0cc', '#6a8898'], ['#e06a8a', '#f0e070', '#b070d0']];
    const awn = ['#a83a2a', '#2e6a4a', '#2e4a7a', '#a8782a'];
    for (let k = 0; k < n; k++) {
      const sx = X + k * sw + 3, w = sw - 6;
      // tezgâh ve mallar
      g.fillStyle = '#6a4a2c'; g.fillRect(sx, Y + H - 22, w, 10); g.fillStyle = '#8a6440'; g.fillRect(sx, Y + H - 22, w, 2);
      for (let q = 0; q < 8; q++) this.circ(g, sx + 4 + (q % 4) * (w - 8) / 3, Y + H - 18 + (q >> 2) * 4, 1.6, goods[k][q % 3]);
      g.fillStyle = '#7a5434'; g.fillRect(sx + 2, Y + H - 10, 7, 6); g.fillRect(sx + w - 9, Y + H - 10, 7, 6);
      this.circ(g, sx + 5.5, Y + H - 10, 1.4, goods[k][1]); this.circ(g, sx + w - 5.5, Y + H - 10, 1.4, goods[k][0]);
      // direkler ve çizgili tente
      g.fillStyle = '#4a3422'; g.fillRect(sx, Y + 6, 1.5, H - 8); g.fillRect(sx + w - 1.5, Y + 6, 1.5, H - 8);
      for (let xx = sx - 2, q = 0; xx < sx + w + 2; xx += 4, q++) { o.fillStyle = q % 2 ? '#efe8da' : awn[k]; o.fillRect(xx, Y - 4, Math.min(4, sx + w + 2 - xx), H - 20); }
      o.fillStyle = 'rgba(0,0,0,0.16)'; for (let yy = Y; yy < Y + H - 24; yy += 6) o.fillRect(sx - 2, yy, w + 4, 1);
      for (let xx = sx - 2, q = 0; xx < sx + w + 2; xx += 4, q++) { o.fillStyle = q % 2 ? '#efe8da' : awn[k]; o.beginPath(); o.arc(xx + 2, Y + H - 24, 2, 0, Math.PI); o.fill(); }
      if (world && world.snowyTile(b.x + (b.w >> 1), b.y + (b.h >> 1))) { o.fillStyle = 'rgba(236,241,246,0.85)'; o.fillRect(sx - 2, Y - 4, w + 4, 6); }
    }
    // ortada kemerli tabela
    const cx = X + W / 2;
    o.fillStyle = '#4a3422'; o.fillRect(cx - 22, Y - 14, 2, 14); o.fillRect(cx + 20, Y - 14, 2, 14);
    o.fillStyle = '#1e2a24'; o.fillRect(cx - 21, Y - 18, 42, 9);
    o.fillStyle = '#c8a850'; o.fillRect(cx - 21, Y - 18, 42, 1);
    o.fillStyle = '#ead490'; o.font = 'bold 7px monospace'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('MARKET', cx, Y - 13.4);
  },

  /* ---------- İnsan ---------- */
  human(ctx, x, y, ang, look, st) {
    ctx.save();
    ctx.translate(x, y);
    if (st.dead || st.lying) {
      // yerde yatan beden: ölü (kan gölü), yaralı ya da bağlı
      if (st.dead && !st.noPool) {
        // kan gölü yavaşça yayılır ve koyulaşır; kumda zamanla toprağa emilir
        const pk = st.pool === undefined ? 1 : st.pool, r = 3 + 6 * pk;
        this.ell(ctx, 2, 2, r * 1.1, r * 0.66, `rgba(${130 - 62 * pk | 0},10,10,${(0.5 + 0.2 * pk) * (1 - 0.7 * (st.soak || 0))})`);
      }
      else if (!st.noPool) this.shadow(ctx, 0, 1.5, 7, 3.4, 0.22);
      ctx.rotate(ang);
      this.ell(ctx, 0, 0, 5.5, 3.2, look.coat);
      ctx.fillStyle = look.pants; ctx.fillRect(-9, -2.4, 5, 1.8); ctx.fillRect(-9, 0.6, 5, 1.8);
      this.circ(ctx, 5.5, 0, 2.6, look.hat === 'none' ? look.hair : look.skin);
      if (st.tied) {
        // el ve ayak bileklerinde ip
        ctx.fillStyle = '#c8a870';
        ctx.fillRect(-8.2, -2.8, 1.2, 5.6); ctx.fillRect(-1.2, -3.5, 1.2, 7);
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-8.2, -0.3, 1.2, 0.6); ctx.fillRect(-1.2, -0.3, 1.2, 0.6);
      }
      if (st.wriggle) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(6.5 + Math.sin(st.wriggle * 20), -0.4, 1.2, 0.8); }
      ctx.restore();
      return;
    }
    const [sdx, sl] = Juice.sun(6);
    this.shadow(ctx, 1 + sdx, 2.5, 6 * sl, 3.8, 0.3);
    ctx.rotate(ang);
    const cr = st.crouch ? 0.88 : 1;
    ctx.scale(cr, cr);
    // yürürken omuzlar adımla salınır: çocuk sekerek, sarhoş sendeleyerek, bastonlu yaşlı ağır ağır
    const mvk = st.riding ? 0 : Math.min(1, st.mv || 0), gs = st.gait;
    if (mvk > 0.05) {
      const ph = st.walk || 0;
      ctx.rotate(Math.sin(ph) * 0.06 * mvk * (gs === 'drunk' ? 3.5 : gs === 'kid' ? 1.5 : gs === 'cane' ? 1.4 : 1));
      if (gs === 'kid') { const b = 1 + Math.abs(Math.sin(ph)) * 0.06 * mvk; ctx.scale(b, b); }
      else if (gs === 'drunk') ctx.translate(0, Math.sin(ph * 0.5) * 1.3 * mvk);
    }
    if (st.anim === 'laugh') { const q = 1 + Math.abs(Math.sin((st.animT || 0) * 16)) * 0.05; ctx.scale(q, q); }
    const sw = Math.sin(st.walk || 0) * 2.8 * (st.mv || 0);
    if (!st.riding) {
      ctx.fillStyle = look.pants;
      ctx.fillRect(-1.5 + sw, -3.4, 4, 2.3); ctx.fillRect(-1.5 - sw, 1.1, 4, 2.3);
      ctx.fillStyle = '#231710';
      ctx.fillRect(2 + sw, -3.4, 1.6, 2.3); ctx.fillRect(2 - sw, 1.1, 1.6, 2.3);
    }
    // palto eteği
    if (look.coatLen) { ctx.fillStyle = shadeHex(look.coat, -0.12); ctx.beginPath(); ctx.ellipse(-2.2, 0, 2.6 + look.coatLen * 1.6, 4.6, 0, 0, TAU); ctx.fill(); }
    if (st.backGun) { ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-1, 5); ctx.stroke(); }
    // gövde
    this.ell(ctx, 0, 0, 3.4, 5.3, look.coat);
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.ellipse(1.8, 0, 1.3, 1.9, 0, 0, TAU); ctx.fill();
    const wk = st.wk;
    if (st.aim && wk) {
      ctx.strokeStyle = look.coat; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      if (wk === 'long') {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(7, -0.5); ctx.moveTo(0, 4.2); ctx.lineTo(3, 1.5); ctx.stroke();
        ctx.fillStyle = '#3a2618'; ctx.fillRect(-1, -0.2, 8, 2.4);
        ctx.fillStyle = '#2a2a2e'; ctx.fillRect(6, 0.2, 9, 1.4);
        this.circ(ctx, 7.2, -0.3, 1.2, look.skin); this.circ(ctx, 3.2, 1.6, 1.2, look.skin);
      } else if (wk === 'bow') {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(8, 0); ctx.moveTo(0, 4.2); ctx.lineTo(2, 0.5); ctx.stroke();
        ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(6, 0, 6, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(8.7, -5.3); ctx.lineTo(2 - (st.draw || 0) * 2, 0); ctx.lineTo(8.7, 5.3); ctx.stroke();
        this.circ(ctx, 8, 0, 1.2, look.skin);
      } else if (wk === 'throw') {
        ctx.beginPath(); ctx.moveTo(0, 4.2); ctx.lineTo(-2, 7); ctx.stroke();
        this.circ(ctx, -2, 7, 1.2, look.skin); ctx.fillStyle = '#c03020'; ctx.fillRect(-3, 7, 3, 1.4);
      } else if (wk === 'knife' || wk === 'fists') {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(4 + (st.swing || 0) * 3, -2); ctx.moveTo(0, 4.2); ctx.lineTo(4, 2.5); ctx.stroke();
        this.circ(ctx, 4.5 + (st.swing || 0) * 3, -2, 1.3, look.skin); this.circ(ctx, 4.5, 2.5, 1.3, look.skin);
        if (wk === 'knife') { ctx.fillStyle = '#c8ccd0'; ctx.fillRect(5 + (st.swing || 0) * 3, -2.6, 4, 1); }
      } else {
        ctx.beginPath(); ctx.moveTo(0, -4.2); ctx.lineTo(6.5, 0); ctx.moveTo(0, 4.2); ctx.lineTo(6.5, 0.4); ctx.stroke();
        this.circ(ctx, 6.8, 0.2, 1.4, look.skin);
        ctx.fillStyle = '#2a2a2e'; ctx.fillRect(7, -0.5, 5, 1.5); ctx.fillStyle = '#5a3e26'; ctx.fillRect(6, 0.4, 2, 1.5);
      }
      ctx.lineCap = 'butt';
    } else if (st.riding) {
      this.circ(ctx, 3.5, -3.3, 1.5, look.coat); this.circ(ctx, 3.5, 3.3, 1.5, look.coat);
      this.circ(ctx, 5, -2.5, 1.1, look.skin); this.circ(ctx, 5, 2.5, 1.1, look.skin);
    } else if (st.swing) {
      ctx.strokeStyle = look.coat; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 4.2); ctx.lineTo(5 + st.swing * 3, 1); ctx.stroke();
      this.circ(ctx, 5.5 + st.swing * 3, 1, 1.4, look.skin);
      if (wk === 'knife') { ctx.fillStyle = '#c8ccd0'; ctx.fillRect(6 + st.swing * 3, 0.5, 4, 1); }
      this.circ(ctx, -sw * 0.7, -4.8, 1.6, look.coat);
    } else if (st.hold === 'crate') {
      // iki eliyle önünde sandık taşır
      this.circ(ctx, 2, -4.2, 1.6, look.coat); this.circ(ctx, 2, 4.2, 1.6, look.coat);
      ctx.fillStyle = '#6a4626'; ctx.fillRect(3.4, -3.6, 5.4, 7.2);
      ctx.fillStyle = '#9a6e40'; ctx.fillRect(3.8, -3.2, 4.6, 6.4);
      ctx.fillStyle = '#6a4626'; ctx.fillRect(3.8, -0.4, 4.6, 0.8); ctx.fillRect(5.8, -3.2, 0.7, 6.4);
      this.circ(ctx, 3.6, -3.8, 1, look.skin); this.circ(ctx, 3.6, 3.8, 1, look.skin);
    } else if (st.anim && this.gesture(ctx, look, st, sw, 0)) {
      // jest çizildi
    } else if (gs === 'cane' && !st.hold) {
      // baston: sol kol sallanır, sağ el önde bastona dayanır
      this.circ(ctx, -sw * 0.7, -4.8, 1.7, look.coat); this.circ(ctx, -sw * 0.7 + 0.8, -5.2, 1, look.skin);
      const tip = 6.2 + Math.max(0, sw) * 0.6;
      ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(3, 5.2); ctx.lineTo(tip, 6.2); ctx.stroke();
      this.circ(ctx, 1.6, 4.9, 1.6, look.coat); this.circ(ctx, 3, 5.2, 1, look.skin);
    } else {
      this.circ(ctx, -sw * 0.7, -4.8, 1.7, look.coat); this.circ(ctx, sw * 0.7, 4.8, 1.7, look.coat);
      this.circ(ctx, -sw * 0.7 + 0.8, -5.2, 1, look.skin); this.circ(ctx, sw * 0.7 + 0.8, 5.2, 1, look.skin);
      if (st.hasGun) { ctx.fillStyle = '#2a1c14'; ctx.fillRect(-1, 3.8, 3, 1.6); }
      if (st.hold === 'broom') {
        const k = Math.sin((st.walk || 0) * 0.5) * 1.5;
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(sw * 0.7 + 0.8, 5.2); ctx.lineTo(9, 7 + k); ctx.stroke();
        ctx.fillStyle = '#c8a860'; ctx.beginPath(); ctx.ellipse(9.6, 7.2 + k, 1.4, 2.4, 0.5, 0, TAU); ctx.fill();
      } else if (st.hold === 'paper') {
        ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-2.2, 4.4, 4.6, 2.6);
        ctx.fillStyle = '#8a8478'; ctx.fillRect(-1.8, 5.2, 3.8, 0.4); ctx.fillRect(-1.8, 6, 3.8, 0.4);
      }
    }
    // kafa (boşta etrafa bakarken gövdeden bağımsız döner)
    if (st.head) ctx.rotate(st.head);
    const hc = look.hairNow || look.hair;
    const mk = look.mask;
    if (mk === 'bandana') {
      ctx.fillStyle = '#a8281f'; ctx.beginPath(); ctx.moveTo(1, -2.7); ctx.lineTo(1, 2.7); ctx.lineTo(6.2, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8d8c0'; ctx.fillRect(4.6, -0.4, 0.8, 0.8);
    } else if (mk === 'sack') {
      this.ell(ctx, -4.4, 0, 1.8, 1.1, '#b89860'); ctx.fillStyle = '#6a4a28'; ctx.fillRect(-3.6, -1.4, 0.7, 2.8);
    }
    if (mk !== 'sack') this.hairTop(ctx, look, hc);
    if (mk === 'sack') { this.circ(ctx, 0, 0, 3.4, '#8a6a3a'); this.circ(ctx, 0, 0, 3, '#c8a870'); ctx.fillStyle = '#9a7a48'; ctx.fillRect(-2, -0.3, 1.2, 0.6); ctx.fillRect(-0.4, -2.2, 0.6, 1.2); ctx.fillStyle = '#1a1008'; ctx.fillRect(1.6, -1.7, 1.2, 1.1); ctx.fillRect(1.6, 0.6, 1.2, 1.1); }
    if (look.hat && look.hat !== 'none') {
      this.hatTop(ctx, look.hat, look.hatCol, st.hatK || 0);
      if ((st.hatK || 0) > 0.15) this.circ(ctx, 2.4, -3.2, 1.1, look.skin);   // şapkayı düzelten el
    } else if (mk !== 'sack') {
      if (look.hairStyle === 7) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; this.circ(ctx, Math.cos(a) * 2.6 - 0.3, Math.sin(a) * 2.6, 1.1, shadeHex(hc, i % 2 ? -0.2 : 0.05)); }   // kıvırcık
      this.circ(ctx, 0, 0, look.hairStyle === 7 ? 3.1 : 2.9, hc);
      if (look.hairStyle === 9 && look.sex !== 'f') this.ell(ctx, 1.2, 0, 1.3, 1.6, shadeHex(look.skin, -0.05));   // açık alın
      if (look.sex === 'f' && (look.hairStyle === 2 || look.hairStyle === 6)) { this.circ(ctx, -0.3, 0, look.hairStyle === 6 ? 1.7 : 1.4, shadeHex(hc, -0.25)); this.circ(ctx, -0.6, -0.4, 0.6, shadeHex(hc, 0.2)); }   // topuz
      this.ell(ctx, 1.9, 0, 1.2, 1.9, look.skin);
      if (mk === 'bandana') { this.ell(ctx, 2.2, 0, 1, 2.1, '#a8281f'); ctx.fillStyle = '#e8d8c0'; ctx.fillRect(2.4, -1, 0.6, 0.6); ctx.fillRect(2.4, 0.6, 0.6, 0.6); }
    }
    if (st.anim && !st.hold) this.gesture(ctx, look, st, sw, 1);   // yüze götürülen el, şapkadaki el
    ctx.restore();
  },
  /* Başın arkasında/omuzda kalan saç (üstten): uzun saç, at kuyruğu, ense topuzu, örgüler */
  hairTop(ctx, look, hc) {
    const hs = look.hairStyle | 0, f = look.sex === 'f';
    const long = f ? [0, 1, 4, 5, 7].includes(hs) : [1, 4, 7].includes(hs);
    if (long) this.ell(ctx, f ? -2.6 : -2.2, 0, f ? 2.3 : 1.9, f ? 2.6 : 2.4, hc);
    if (!f && hs === 2) this.ell(ctx, -3.4, 0, 1.3, 0.8, shadeHex(hc, -0.15));                 // at kuyruğu
    if (f && hs === 3) this.circ(ctx, -3, 0, 1.3, shadeHex(hc, -0.15));                        // ense topuzu
    const br = hs === 8 ? [-1] : f && hs === 9 ? [-1, 1] : [];                                    // örgüler omuzdan öne
    for (const k of br) for (let i = 0; i < 3; i++) this.circ(ctx, -1.6 + i * 1.3, k * (2.4 + i * 0.5), 0.75, shadeHex(hc, i % 2 ? -0.2 : 0));
  },
  /* Şapka, üstten: kenar, tepe, kasket siperi, kovboy çatısı. k = şapkayı düzeltme jesti (0–1) */
  hatTop(ctx, hat, col, k = 0) {
    const S = LOOKS.hatShape[hat] || LOOKS.hatShape.cowboy, c = hatColor(hat, col), br = S.br * (1 + k * 0.14);
    if (hat === 'bonnet') {
      this.ell(ctx, -0.8, 0, 3.6, 3.3, c); this.ell(ctx, 1.4, 0, 1.3, 2.9, shadeHex(c, 0.18)); this.ell(ctx, -1.4, 0, 2, 2.2, shadeHex(c, -0.2));
      return;
    }
    this.ell(ctx, k * 0.8, 0, br, br * 0.95, c);
    if (hat === 'flat') this.ell(ctx, 2.6, 0, 2, 2.6, shadeHex(c, -0.2));
    if (hat === 'fur') { this.ell(ctx, -0.2, 0, 3, 2.9, shadeHex(c, 0.12)); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; this.circ(ctx, Math.cos(a) * 2.9, Math.sin(a) * 2.8, 0.7, shadeHex(c, i % 2 ? -0.25 : 0.2)); } return; }
    if (hat === 'top') { this.ell(ctx, -0.2, 0, 2.5, 2.4, shadeHex(c, 0.1)); this.ell(ctx, -0.6, -0.5, 1, 0.9, shadeHex(c, 0.35)); return; }
    this.ell(ctx, -0.2, 0, 2.7, 2.5, shadeHex(c, -0.28));
    if (hat === 'cowboy' || hat === 'wide' || hat === 'straw') { ctx.fillStyle = shadeHex(c, 0.25); ctx.fillRect(-0.8, -2.4, 1, 4.8); }
    if (hat === 'straw') { ctx.strokeStyle = shadeHex(c, -0.25); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.ellipse(0, 0, br * 0.75, br * 0.72, 0, 0, TAU); ctx.stroke(); }
  },
  /* NPC jestleri, üstten görünüş (gövde çerçevesi: x ileri, y sağ).
     layer 0: kollar ve eldekiler (true dönerse varsayılan kollar çizilmez); layer 1: başın üstünde kalanlar */
  gesture(ctx, look, st, sw, layer) {
    const k = st.anim, t = st.animT || 0, C = look.coat, S = look.skin;
    if (st.hold || st.aim || st.riding) return false;
    const arm = (sd, hx, hy, ex, ey) => {
      ctx.strokeStyle = C; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, sd * 4); if (ex !== undefined) ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
      this.circ(ctx, hx, hy, 1.1, S);
    };
    const down = (sd) => { this.circ(ctx, sd * sw * 0.7, sd * 4.8, 1.7, C); this.circ(ctx, sd * sw * 0.7 + 0.8, sd * 5.2, 1, S); };
    const cyc = (per, up) => { const u = t % per; return u < up ? Math.sin(u / up * Math.PI) : 0; };
    switch (k) {
      case 'smoke': {
        // önce kibritle yakar, sonra ara ara ağzına götürür; ucu kor gibi yanar
        if (t < 1.3) {
          if (layer === 1) { this.circ(ctx, 4.6, -0.8, 1.1, S); this.circ(ctx, 4.6, 0.8, 1.1, S); if (Math.sin(t * 40) > -0.3) { ctx.fillStyle = '#ffd060'; ctx.fillRect(5.3, -0.4, 0.9, 0.9); } }
          else { arm(-1, 4.6, -0.8); arm(1, 4.6, 0.8); }
          return true;
        }
        const r = cyc(6, 1.3), hx = 2.2 + r * 2.4, hy = 4.6 - r * 3.6;
        if (layer === 0) { down(-1); if (r < 0.35) arm(1, hx, hy); return true; }
        if (r >= 0.35) arm(1, hx, hy);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(hx + 0.6, hy - 0.3, 1.6, 0.6);
        ctx.fillStyle = r > 0.8 ? '#ffb040' : '#d0602a'; ctx.fillRect(hx + 2.1, hy - 0.35, 0.7, 0.7);
        return true;
      }
      case 'drink': {
        const r = cyc(6.5, 1.5), hx = 1.4 + r * 3, hy = 5.4 - r * 4.6;
        if (layer === 0) { down(-1); if (r < 0.35) { arm(1, hx, hy); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(hx - 0.4, hy - 0.9, 2.4, 1.8); } return true; }
        if (r >= 0.35) { arm(1, hx, hy); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(hx + 0.3, hy - 0.8, 2.6, 1.6); ctx.fillStyle = '#c8a040'; ctx.fillRect(hx + 2.7, hy - 0.4, 0.6, 0.8); }
        return true;
      }
      case 'watch':
        if (layer === 1) return true;
        arm(-1, 5.4, -1.2); arm(1, 5.4, 1.2);
        this.circ(ctx, 6.3, 0, 1.3, '#d8b048'); this.circ(ctx, 6.3, 0, 0.8, '#f4ecd8');
        ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(6.3, 0); ctx.lineTo(2.5, 1.5); ctx.stroke();
        return true;
      case 'wave': if (layer === 0) { down(-1); arm(1, 4 + Math.sin(t * 13) * 1.1, 7.6, 1.5, 6.4); } return true;
      case 'cross':
        if (layer === 1) return true;
        arm(-1, 5.2, 2.2, 2.5, -4.6); arm(1, 5.2, -2.2, 2.5, 4.6);
        ctx.fillStyle = C; ctx.fillRect(4.4, -3, 1.8, 6);
        return true;
      case 'hips': if (layer === 0) { arm(-1, -1.4, -5.4, 0.8, -7.6); arm(1, -1.4, 5.4, 0.8, 7.6); } return true;
      case 'scratch':
        if (layer === 0) { down(-1); return true; }
        arm(1, -0.4 + Math.sin(t * 18) * 0.6, 3.2);
        return true;
      case 'stretch': { if (layer === 1) return true; const q = 0.85 + 0.15 * Math.sin(t * 2.2); arm(-1, 1.4, -9.8 * q); arm(1, 1.4, 9.8 * q); return true; }
      case 'shrug': if (layer === 0) { arm(-1, 3.6, -7.6, 0.8, -6.8); arm(1, 3.6, 7.6, 0.8, 6.8); } return true;
      case 'point': if (layer === 0) { down(-1); arm(1, 10.5, 2.6); } return true;
      case 'gesture':
        if (layer === 1) return true;
        arm(1, 5.4 + Math.sin(t * 6.3) * 1.3, 3.4 + Math.cos(t * 4.1) * 1.1);
        arm(-1, 5 + Math.sin(t * 4.7 + 1.3) * 1.1, -3.3 + Math.sin(t * 3.1) * 0.8);
        return true;
      case 'laugh': if (layer === 0) { arm(-1, 4.8, -1.7); arm(1, 4.8, 1.7); } return true;
      case 'fan':
        if (layer === 0) { down(-1); return true; }
        arm(1, 5.2, 1.4 + Math.sin(t * 14) * 1.6);
        return true;
      case 'rub': if (layer === 0) { const j = Math.sin(t * 18) * 0.5; arm(-1, 5.3, -0.9 + j); arm(1, 5.3, 0.9 + j); } return true;
      case 'read':
        if (layer === 1) return true;
        arm(-1, 5.4, -2.9); arm(1, 5.4, 2.9);
        ctx.fillStyle = '#d8d0bc'; ctx.fillRect(5.2, -3.6, 2.6, 7.2);
        ctx.fillStyle = '#8a8478'; ctx.fillRect(5.6, -3, 1.8, 0.4); ctx.fillRect(5.6, -1.6, 1.8, 0.4); ctx.fillRect(5.6, 0.2, 1.8, 0.4); ctx.fillRect(5.6, 1.8, 1.8, 0.4);
        return true;
      case 'tie': if (layer === 0) { arm(-1, 6.2, -1.3 + Math.sin(t * 9) * 0.4); arm(1, 6.2, 1.3); } return true;
      case 'hurry':
        if (layer === 0) return true;
        arm(-1, 0.6, -3.5); arm(1, 0.6, 3.5);
        return true;
      case 'pat': if (layer === 0) { down(-1); arm(1, 7.4 + Math.sin(t * 7) * 0.9, 1.8); } return true;
      case 'nod': return false;
    }
    return false;
  },

  /* ---------- Taşınan yük: post, ceset, leş ---------- */
  /* Katlanmış post (yerde ya da sırtta) */
  pelt(ctx, x, y, ang, col, big) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const w = big ? 7 : 5, h = big ? 4.6 : 3.4;
    this.ell(ctx, 0.8, 1.2, w, h, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w, -h * 0.6); ctx.quadraticCurveTo(0, -h * 1.2, w, -h * 0.6); ctx.lineTo(w * 0.9, h * 0.7); ctx.quadraticCurveTo(0, h * 1.1, -w * 0.9, h * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shadeHex(col, 0.18); ctx.fillRect(-w * 0.7, -h * 0.35, w * 1.4, h * 0.3);
    ctx.fillStyle = shadeHex(col, -0.3); ctx.fillRect(-w * 0.9, h * 0.25, w * 1.8, 0.8);
    ctx.fillStyle = '#c8a870'; ctx.fillRect(-w * 0.35, -h, 1, h * 2); ctx.fillRect(w * 0.3, -h, 1, h * 2);
    ctx.restore();
  },
  /* Omuzda ya da eyerde taşınan varlık. (x, y) çizim merkezi, rot uzun eksenin açısı */
  /* Toptan mal: sandık, fıçı, çuval ya da balya (x, y merkez; üstten görünüş) */
  goods(ctx, x, y, g, sc = 1) {
    const G_ = GOODS[g], look = G_ ? G_.look : 'crate';
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-4, -2, 10, 7);
    if (look === 'barrel') {
      this.circ(ctx, 0, 0, 4.6, '#6a4424'); this.circ(ctx, 0, 0, 3.6, '#8a5a30');
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.stroke();
    } else if (look === 'sack') {
      ctx.fillStyle = '#c8b48a'; ctx.beginPath(); ctx.ellipse(0, 0.5, 4.6, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a8946a'; ctx.fillRect(-1, -4, 2, 2);
      ctx.fillStyle = '#e0cfa4'; ctx.beginPath(); ctx.ellipse(-1.2, -0.5, 2.2, 1.4, 0, 0, TAU); ctx.fill();
    } else if (look === 'ties') {
      // travers demeti: üst üste iki kalın kalas
      for (let k = 0; k < 2; k++) { ctx.fillStyle = k ? '#7a5634' : '#6a4a2c'; ctx.fillRect(-6, 1 - k * 3.2, 12, 3); ctx.fillStyle = '#9a7448'; ctx.fillRect(-6, 1 - k * 3.2, 12, 0.9); }
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-3, -2.4, 0.8, 6.4); ctx.fillRect(2.4, -2.4, 0.8, 6.4);
    } else if (look === 'bale') {
      ctx.fillStyle = '#8a6a8a'; ctx.fillRect(-4.5, -3, 9, 6); ctx.fillStyle = '#a888a8'; ctx.fillRect(-4.5, -3, 9, 1.6);
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-2, -3, 0.8, 6); ctx.fillRect(1.6, -3, 0.8, 6);
    } else {
      ctx.fillStyle = '#7a5434'; ctx.fillRect(-4.5, -4, 9, 8); ctx.fillStyle = '#9a7048'; ctx.fillRect(-4.5, -4, 9, 1.8);
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 0.7; ctx.strokeRect(-4.5, -4, 9, 8); ctx.beginPath(); ctx.moveTo(-4.5, -4); ctx.lineTo(4.5, 4); ctx.stroke();
      if (g === 'meds') { ctx.fillStyle = '#c02a20'; ctx.fillRect(-1, -2.4, 2, 5); ctx.fillRect(-2.5, -0.9, 5, 2); }
    }
    ctx.restore();
  },
  carried(ctx, e, x, y, rot, sc = 1) {
    if (e.kind === 'crate') { this.goods(ctx, x, y, e.g, sc * 1.25); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (e.kind === 'npc') this.human(ctx, 0, 0, rot, e.look, { dead: e.dead, lying: true, tied: e.state === 'tied', noPool: true });
    else if (e.kind === 'pelt') this.pelt(ctx, 0, 0, rot, e.col, e.big);
    else if (e.kind === 'animal') {
      const o = { def: e.def, x: 0, y: 0, ang: rot, dead: true, noPool: true, phase: 0, mv: 0, male: e.male, look: e.look, skinned: false };
      this.animal(ctx, o);
    }
    ctx.restore();
  },
  /* Kement ipi: iki nokta arasında hafif sarkan çizgi */
  rope(ctx, x0, y0, x1, y1, slack) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + slack;
    ctx.strokeStyle = 'rgba(40,26,14,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x0, y0 + 0.6); ctx.quadraticCurveTo(mx, my + 0.6, x1, y1 + 0.6); ctx.stroke();
    ctx.strokeStyle = '#c8a870'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
  },

  /* ---------- At ---------- */
  horse(ctx, x, y, ang, look, st) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (st.dead) {
      this.ell(ctx, 0, 3, 13, 7, 'rgba(110,10,10,0.5)');
      this.ell(ctx, 0, 0, 10, 5, look.col); this.ell(ctx, 11, 2, 4, 2, look.col);
      ctx.fillStyle = shadeHex(look.col, -0.3); for (let k = 0; k < 4; k++) ctx.fillRect(-6 + k * 4, 4, 1.6, 6);
      ctx.restore(); return;
    }
    { const [sdx, sl] = Juice.sun(12); ctx.save(); ctx.rotate(-ang); ctx.translate(sdx, 0); ctx.rotate(ang); this.ell(ctx, 2, 2.5, 13 * (0.8 + 0.2 * sl), 6, 'rgba(0,0,0,0.28)'); ctx.restore(); }
    // şahlanma: ön taraf yükselir (üstten bakınca kısalıp genişler), ön ayaklar havada
    const rk = st.rear || 0;
    if (rk) { ctx.translate(-9, 0); ctx.scale(1 + 0.08 * rk, 1 + 0.2 * rk); ctx.translate(9 + 2 * rk, 0); }
    const p = st.phase || 0, m = Math.min(1, st.mv || 0);
    const lc = shadeHex(look.col, -0.35);
    const legs = [[6, -3.4, 0], [6, 3.4, Math.PI], [-6, -3.4, Math.PI * 0.6], [-6, 3.4, Math.PI * 1.6]];
    for (const [lx, ly, ph] of legs) { const o = Math.sin(p + ph) * 3.2 * m + (lx > 0 ? rk * (2.5 + Math.sin(G.t * 18 + ly) * 1.2) : 0); this.ell(ctx, lx + o, ly, 2, 1.3, lc); ctx.fillStyle = '#1a1410'; ctx.fillRect(lx + o + 1.2, ly - 0.8, 1, 1.6); }
    ctx.strokeStyle = look.mane; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9.5, 0); ctx.quadraticCurveTo(-13, Math.sin(p * 0.5) * 2 * m, -15, Math.sin(p) * 1.5 * m); ctx.stroke();
    this.ell(ctx, 0, 0, 10.5, 4.6, look.col);
    this.ell(ctx, -1, -1.2, 7, 1.8, shadeHex(look.col, 0.12));
    const nk = st.graze ? 0.5 : 0, hy = st.nod || 0;   // hy: baş sallama (yana)
    this.ell(ctx, 8.6, hy * 0.3, 4.2, 2.7, look.col);
    this.ell(ctx, 12.8 + nk * 2, hy, 3.6, 2, look.col);
    this.ell(ctx, 15.4 + nk * 2, hy * 1.2, 1.5, 1.6, shadeHex(look.col, -0.2));
    if (look.blaze) { ctx.fillStyle = '#f0ece4'; ctx.fillRect(12 + nk * 2, -0.5 + hy, 4, 1); }
    ctx.fillStyle = shadeHex(look.col, -0.2);
    ctx.beginPath(); ctx.moveTo(10.5, -1.2); ctx.lineTo(9.8, -3); ctx.lineTo(11.4, -1.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10.5, 1.2); ctx.lineTo(9.8, 3); ctx.lineTo(11.4, 1.6); ctx.fill();
    ctx.strokeStyle = look.mane; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(11, 0); ctx.stroke();
    ctx.lineCap = 'butt';
    if (st.saddle) {
      ctx.fillStyle = look.blanket || '#8a2a20'; ctx.fillRect(-4.5, -4.6, 8, 9.2);
      ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse(-0.5, 0, 3.6, 3.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2412'; ctx.fillRect(2.4, -0.8, 1.6, 1.6);
      if (st.bags) { ctx.fillStyle = '#6a4424'; ctx.fillRect(-7, -5.6, 3, 2); ctx.fillRect(-7, 3.6, 3, 2); }
    }
    ctx.restore();
  },

  /* ---------- Hayvanlar ---------- */
  animal(ctx, a) {
    const d = a.def, x = a.x, y = a.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a.ang);
    const L = d.len, Wd = d.wid, c = d.col, c2 = d.col2;
    const p = a.phase || 0, m = a.dead ? 0 : Math.min(1, a.mv || 0);
    if (a.dead) {
      const pk = Math.min(1, (a.deadT || 0) / 5) * 0.6 + 0.4;
      if (!a.noPool) this.ell(ctx, 0, L * 0.1, L * 0.55 * pk, Wd * 0.9 * pk, `rgba(${125 - 50 * pk | 0},10,10,${0.5 * (1 - 0.7 * Juice.soak(a))})`);
    } else { const [sdx, sl] = Juice.sun(L * 0.5); ctx.save(); ctx.rotate(-a.ang); ctx.translate(sdx, 0); ctx.rotate(a.ang); this.ell(ctx, 1, 2, L * 0.55 * (0.85 + 0.15 * sl), Wd * 0.75, 'rgba(0,0,0,0.25)'); ctx.restore(); }
    const bodyC = a.skinned ? '#9a3a2a' : c;
    if (d.shape === 'snake') {
      ctx.strokeStyle = bodyC; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const px = 6 - k * 1.6, py = Math.sin(p * 1.5 + k * 0.9) * 2.2 * (k / 10 + 0.3); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.strokeStyle = c2; ctx.lineWidth = 0.8; ctx.stroke();
      this.ell(ctx, 7, Math.sin(p * 1.5) * 0.6, 1.8, 1.3, bodyC);
      ctx.lineCap = 'butt'; ctx.restore(); return;
    }
    if (d.shape === 'gator') {
      ctx.fillStyle = bodyC;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(8, -2.6); ctx.lineTo(-2, -4.5); ctx.lineTo(-10, -2); ctx.lineTo(-20 + Math.sin(p) * 1, Math.sin(p) * 2.5); ctx.lineTo(-10, 2); ctx.lineTo(-2, 4.5); ctx.lineTo(8, 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; for (let k = 0; k < 6; k++) ctx.fillRect(-10 + k * 3.5, -0.6, 2, 1.2);
      const lo = Math.sin(p) * 2 * m;
      ctx.fillStyle = bodyC; ctx.fillRect(3 + lo, -7, 2, 3); ctx.fillRect(3 - lo, 4, 2, 3); ctx.fillRect(-6 - lo, -7, 2, 3); ctx.fillRect(-6 + lo, 4, 2, 3);
      this.circ(ctx, 9, -1.8, 0.7, '#e0d040'); this.circ(ctx, 9, 1.8, 0.7, '#e0d040');
      ctx.restore(); return;
    }
    if (d.shape === 'bird') {
      const lo = Math.sin(p * 1.4) * 1.5 * m;
      ctx.fillStyle = '#a07030'; ctx.fillRect(-1 + lo, -1.8, 2, 0.8); ctx.fillRect(-1 - lo, 1, 2, 0.8);
      this.ell(ctx, -2.5, 0, 2.6, Wd * 0.85, shadeHex(bodyC, -0.15));
      this.ell(ctx, 0, 0, L * 0.5, Wd * 0.62, bodyC);
      this.circ(ctx, L * 0.55, 0, 1.4, a.def === ANIMALS.chicken ? '#f0ece4' : '#6a4a3a');
      ctx.fillStyle = c2; ctx.fillRect(L * 0.55 + 0.6, -0.5, 1.5, 1);
      ctx.restore(); return;
    }
    if (d.shape === 'horse') {
      ctx.restore();
      this.horse(ctx, x, y, a.ang, { col: a.look ? a.look.col : c, mane: c2 }, { phase: p, mv: m, dead: a.dead });
      return;
    }
    if (d.shape === 'small') {
      this.ell(ctx, 0, 0, L * 0.6, Wd * 0.6, bodyC);
      this.ell(ctx, -L * 0.45, 0, 1.2, 1.2, c2);
      ctx.fillStyle = shadeHex(c, -0.2); ctx.fillRect(L * 0.1, -1.6, 2.6, 0.9); ctx.fillRect(L * 0.1, 0.7, 2.6, 0.9);
      this.circ(ctx, L * 0.45, 0, 1.4, bodyC);
      ctx.restore(); return;
    }
    // genel dört ayaklı
    const leg = shadeHex(c, -0.35);
    const lx = L * 0.32, ly = Wd * 0.42;
    for (const [px, py, ph] of [[lx, -ly, 0], [lx, ly, Math.PI], [-lx, -ly, Math.PI * 0.6], [-lx, ly, Math.PI * 1.6]]) {
      const o = Math.sin(p + ph) * L * 0.15 * m;
      this.ell(ctx, px + o, py, 1.6 * Wd / 5 + 0.6, 1.1, leg);
    }
    // kuyruk
    ctx.strokeStyle = d.tail ? c : (d.beh === 'hostile' || d === ANIMALS.fox || d === ANIMALS.coyote ? c : c2);
    ctx.lineWidth = (d === ANIMALS.fox || d === ANIMALS.wolf || d === ANIMALS.coyote) ? 2.4 : 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-L * 0.45, 0); ctx.lineTo(-L * 0.45 - (d.tail ? 8 : d.bear ? 1 : 4), Math.sin(p * 0.7) * (d.tail ? 2.5 : 1)); ctx.stroke();
    ctx.lineCap = 'butt';
    if (d === ANIMALS.fox) this.circ(ctx, -L * 0.45 - 4, Math.sin(p * 0.7), 1, '#f0e8e0');
    // gövde
    this.ell(ctx, 0, 0, L * 0.5, Wd * 0.5, bodyC);
    if (d.hump) this.ell(ctx, L * 0.15, 0, L * 0.3, Wd * 0.55, a.skinned ? bodyC : c2);
    if (!a.skinned) { ctx.fillStyle = shadeHex(c, 0.15); ctx.beginPath(); ctx.ellipse(-L * 0.05, 0, L * 0.35, Wd * 0.18, 0, 0, TAU); ctx.fill(); }
    if (d === ANIMALS.deer || d === ANIMALS.pronghorn || d === ANIMALS.elk) this.ell(ctx, -L * 0.45, 0, 1.4, 1.6, c2);
    // baş
    const hx = L * 0.5 + (d.bear ? 1.5 : 2.5), hr = d.bear ? Wd * 0.34 : Wd * 0.28;
    this.ell(ctx, hx - 1.5, 0, 2.5, hr * 0.8, bodyC);
    this.ell(ctx, hx, 0, hr * 1.3, hr, bodyC);
    this.ell(ctx, hx + hr * 1.1, 0, hr * 0.6, hr * 0.55, shadeHex(c, -0.25));
    ctx.fillStyle = shadeHex(c, -0.2);
    ctx.fillRect(hx - 1.5, -hr - 1, 1.6, 1.6); ctx.fillRect(hx - 1.5, hr - 0.6, 1.6, 1.6);
    if (d.antler && a.male) {
      ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 0.9;
      const s = d.antler === 2 ? 1.5 : 1;
      for (const sg of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(hx - 1, sg * 1.5); ctx.lineTo(hx - 4 * s, sg * 6 * s); ctx.moveTo(hx - 2.5 * s, sg * 4 * s); ctx.lineTo(hx + 0.5, sg * 5.5 * s); ctx.moveTo(hx - 3.5 * s, sg * 5.3 * s); ctx.lineTo(hx - 6 * s, sg * 4 * s); ctx.stroke();
      }
    }
    if (d === ANIMALS.boar) { ctx.fillStyle = '#f0e8d8'; ctx.fillRect(hx + 1, -1.8, 1.5, 0.7); ctx.fillRect(hx + 1, 1.1, 1.5, 0.7); }
    if (d === ANIMALS.bison) { ctx.fillStyle = '#d8d0c0'; ctx.fillRect(hx - 1, -hr - 1.6, 1, 1.6); ctx.fillRect(hx - 1, hr, 1, 1.6); }
    if (d === ANIMALS.cow && !a.skinned) { this.circ(ctx, -2, -1, 1.8, c2); this.circ(ctx, 3, 1.5, 1.4, c2); }
    ctx.restore();
  },

  /* ---------- Tren ---------- */
  trainCar(ctx, x, y, ang, kind, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-13, -4, 30, 13);
    if (kind === 'loco') {
      ctx.fillStyle = '#1e1c1c'; ctx.fillRect(-14, -6, 28, 12);
      ctx.fillStyle = '#2e2a2a'; ctx.fillRect(-4, -5, 17, 10);
      ctx.fillStyle = '#3a3434'; for (let k = 0; k < 3; k++) ctx.fillRect(-2 + k * 5, -5, 1, 10);
      ctx.fillStyle = '#6a1a14'; ctx.fillRect(-14, -6.5, 9, 13);
      ctx.fillStyle = '#2a2020'; ctx.fillRect(-13, -5, 7, 10);
      this.circ(ctx, 9, 0, 3, '#141212'); this.circ(ctx, 9, 0, 1.8, '#3a3030');
      ctx.fillStyle = '#b0302a'; ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(19, 0); ctx.lineTo(14, 6); ctx.fill();
      ctx.fillStyle = '#f0e0a0'; ctx.fillRect(13, -1.5, 2, 3);
      ctx.fillStyle = '#c8a040'; ctx.fillRect(1, -1, 5, 2);
    } else if (kind === 'tender') {
      ctx.fillStyle = '#2a2424'; ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = '#141010'; ctx.fillRect(-10, -4.5, 20, 9);
    } else {
      ctx.fillStyle = kind === 'freight' ? '#6a3a24' : '#3a4a3a'; ctx.fillRect(-13, -6, 26, 12);
      ctx.fillStyle = kind === 'freight' ? '#7a4a30' : '#4a5a48'; ctx.fillRect(-13, -6, 26, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-13, 0, 26, 1);
      if (kind !== 'freight') { ctx.fillStyle = '#e8d890'; for (let k = 0; k < 4; k++) { ctx.fillRect(-10 + k * 6, -6.8, 3, 1); ctx.fillRect(-10 + k * 6, 5.8, 3, 1); } }
    }
    ctx.restore();
  },
  /* Portre: js/portrait.js */
};
