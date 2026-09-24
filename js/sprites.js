'use strict';
/* ==========================================================
   DUSTBOUND — prosedürel çizimler (üstten 3/4 görünüm)
   ========================================================== */

const SIGN_TEXT = {
  general: 'GENERAL', saloon: 'SALOON', sheriff: 'SHERIFF', doctor: 'DOCTOR', gunsmith: 'GUNS', butcher: 'BUTCHER', stable: 'STABLE',
  hotel: 'HOTEL', bank: 'BANK', station: 'STATION', land: 'LAND', barber: 'BARBER', tailor: 'TAILOR', fence: 'TRADER', mine: 'MINING CO',
  lumber: 'LUMBER', docks: 'DOCKS', ranch: 'RANCH', property: 'FOR SALE', cabin: 'FURS', hermit: '', church: '',
};

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

  object(g, o, type, x, y, h, world) {
    switch (type) {
      case O.PINE: case O.SNOWPINE: {
        const r = 7 + h * 3.5;
        this.shadow(g, x + 5, y + 3, r * 0.95, r * 0.55, 0.3);
        g.fillStyle = '#4a3322'; g.fillRect(x - 1.2, y - 5, 2.4, 8);
        this.pine(o, x, y - 7, r, '#20361f', '#2c4a28', '#3a5d33', h, type === O.SNOWPINE);
        break;
      }
      case O.OAK: case O.APPLE: {
        const r = 8 + h * 3.5;
        this.shadow(g, x + 5, y + 3, r, r * 0.6, 0.3);
        g.fillStyle = '#4e3826'; g.fillRect(x - 1.6, y - 6, 3.2, 9);
        this.canopy(o, x, y - 8, r, '#314d22', '#3f6129', '#557a35', h);
        if (type === O.APPLE) for (let k = 0; k < 7; k++) { const a = k * 1.9 + h * 7; this.circ(o, x + Math.cos(a) * r * 0.55, y - 8 + Math.sin(a) * r * 0.5, 1.1, '#c0302a'); }
        break;
      }
      case O.BIRCH: {
        const r = 6 + h * 3;
        this.shadow(g, x + 4, y + 3, r, r * 0.55, 0.26);
        g.fillStyle = '#e8e4d8'; g.fillRect(x - 1.2, y - 6, 2.4, 9);
        g.fillStyle = '#2a2420'; g.fillRect(x - 1.2, y - 3, 1.2, 0.8); g.fillRect(x, y, 1.2, 0.8);
        this.canopy(o, x, y - 8, r, '#4a6a2a', '#5e8436', '#7a9e48', h, 5);
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
        const c = h > 0.5 ? ['#3a5a26', '#4a6e30', '#5e8440'] : ['#40562a', '#506a34', '#688246'];
        this.circ(g, x - 2.5, y, 3.8, c[0]); this.circ(g, x + 2.5, y + 0.5, 3.6, c[0]); this.circ(g, x, y - 2, 4, c[1]); this.circ(g, x - 1, y - 3, 2, c[2]);
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
        const cols = ['#e8d040', '#c060c0', '#f0f0f0', '#e05a3a', '#7090e0'];
        for (let k = 0; k < 5; k++) { const a = k * 2.3 + h * 9; this.circ(g, x + Math.cos(a) * 4, y + Math.sin(a) * 3, 0.9, cols[(k + Math.floor(h * 5)) % 5]); }
        break;
      }
      case O.TUFT: {
        g.strokeStyle = 'rgba(40,60,20,0.55)'; g.lineWidth = 1;
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
    const cols = {
      [O.BERRY]: ['#3a5a26', '#3048a0'], [O.GINSENG]: ['#4a7a2e', '#c03020'], [O.YARROW]: ['#5a7a3a', '#f0f0e0'], [O.SAGE]: ['#8aa080', '#b0c0a8'],
      [O.MINT]: ['#3a8a3a', '#6ac06a'], [O.OREGANO]: ['#5a7a3a', '#b080c0'], [O.MILKWEED]: ['#6a8a4a', '#f0d0e0'], [O.MUSHROOM]: ['#e8dcc8', '#a03a2a'], [O.WFLOWER]: ['#4a7a2e', '#e8c040'],
    }[type] || ['#5a7a3a', '#fff'];
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
  building(g, o, b) {
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
    // Ön cephe
    const wallC = b.def.ruin ? '#5a4c3c' : wall;
    g.fillStyle = wallC; g.fillRect(X, wy, W, FW);
    if (d.brick) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let yy = wy; yy < Y + H; yy += 3) for (let xx = X + ((yy / 3) % 2) * 3; xx < X + W; xx += 6) g.fillRect(xx, yy, 1, 3);
      for (let yy = wy; yy < Y + H; yy += 3) g.fillRect(X, yy, W, 0.6);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let xx = X + 2; xx < X + W; xx += 4) g.fillRect(xx, wy, 1, FW);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X, wy, W, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X, Y + H - 2, W, 2);
    // kapı
    const dx = b.door.x;
    if (b.type === 'stable' || b.type === 'barn') {
      g.fillStyle = '#2a1e14'; g.fillRect(dx - 10, Y + H - 16, 20, 16);
      g.strokeStyle = '#c8b090'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx - 10, Y + H - 16); g.lineTo(dx + 10, Y + H); g.moveTo(dx + 10, Y + H - 16); g.lineTo(dx - 10, Y + H); g.stroke();
    } else if (b.type === 'station') {
      g.fillStyle = '#2a2016'; g.fillRect(dx - 5, Y + H - 14, 10, 14);
    } else {
      g.fillStyle = '#2a1c12'; g.fillRect(dx - 4, Y + H - 14, 8, 14);
      if (b.type === 'saloon') { g.fillStyle = '#8a6040'; g.fillRect(dx - 4, Y + H - 11, 3.6, 6); g.fillRect(dx + 0.4, Y + H - 11, 3.6, 6); }
      else { g.fillStyle = '#5a3e26'; g.fillRect(dx - 3, Y + H - 13, 6, 12); g.fillStyle = '#c8a040'; g.fillRect(dx + 1.5, Y + H - 7, 1, 1); }
    }
    // pencereler
    const nWin = Math.max(1, Math.floor(b.w / 3));
    for (let k = 0; k < nWin; k++) {
      const cx = X + (k + 0.5) * W / nWin;
      if (Math.abs(cx - dx) < 10) continue;
      g.fillStyle = '#3a2a1c'; g.fillRect(cx - 4, wy + FW - 16, 8, 9);
      g.fillStyle = b.def.ruin ? '#101010' : '#27394a'; g.fillRect(cx - 3, wy + FW - 15, 6, 7);
      g.fillStyle = 'rgba(200,220,240,0.25)'; g.fillRect(cx - 3, wy + FW - 15, 2, 7);
      if (d.tall) { g.fillStyle = '#3a2a1c'; g.fillRect(cx - 4, wy + 3, 8, 7); g.fillStyle = '#27394a'; g.fillRect(cx - 3, wy + 4, 6, 5); }
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

  /* ---------- İnsan ---------- */
  human(ctx, x, y, ang, look, st) {
    ctx.save();
    ctx.translate(x, y);
    if (st.dead) {
      this.ell(ctx, 2, 2, 8, 5, 'rgba(110,10,10,0.55)');
      ctx.rotate(ang);
      this.ell(ctx, 0, 0, 5.5, 3.2, look.coat);
      ctx.fillStyle = look.pants; ctx.fillRect(-9, -2.4, 5, 1.8); ctx.fillRect(-9, 0.6, 5, 1.8);
      this.circ(ctx, 5.5, 0, 2.6, look.hat === 'none' ? look.hair : look.skin);
      ctx.restore();
      return;
    }
    this.shadow(ctx, 1, 2.5, 6, 3.8, 0.3);
    ctx.rotate(ang);
    const cr = st.crouch ? 0.88 : 1;
    ctx.scale(cr, cr);
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
    } else {
      this.circ(ctx, -sw * 0.7, -4.8, 1.7, look.coat); this.circ(ctx, sw * 0.7, 4.8, 1.7, look.coat);
      this.circ(ctx, -sw * 0.7 + 0.8, -5.2, 1, look.skin); this.circ(ctx, sw * 0.7 + 0.8, 5.2, 1, look.skin);
      if (st.hasGun) { ctx.fillStyle = '#2a1c14'; ctx.fillRect(-1, 3.8, 3, 1.6); }
    }
    // kafa
    const hc = look.hairNow || look.hair;
    if (look.sex === 'f' && look.hairStyle !== 3) this.ell(ctx, -2.6, 0, 2.3, 2.6, hc);
    if (look.hat && look.hat !== 'none') {
      const br = look.hat === 'wide' ? 5.6 : look.hat === 'bowler' ? 3.8 : look.hat === 'flat' ? 3.4 : 4.8;
      this.ell(ctx, 0, 0, br, br * 0.95, look.hatCol);
      if (look.hat === 'flat') this.ell(ctx, 2.6, 0, 2, 2.6, shadeHex(look.hatCol, -0.2));
      this.ell(ctx, -0.2, 0, 2.7, 2.5, shadeHex(look.hatCol, -0.28));
      if (look.hat === 'cowboy' || look.hat === 'wide') { ctx.fillStyle = shadeHex(look.hatCol, 0.25); ctx.fillRect(-0.8, -2.4, 1, 4.8); }
    } else {
      this.circ(ctx, 0, 0, 2.9, hc);
      this.ell(ctx, 1.9, 0, 1.2, 1.9, look.skin);
    }
    ctx.restore();
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
    this.ell(ctx, 2, 2.5, 13, 6, 'rgba(0,0,0,0.28)');
    const p = st.phase || 0, m = Math.min(1, st.mv || 0);
    const lc = shadeHex(look.col, -0.35);
    const legs = [[6, -3.4, 0], [6, 3.4, Math.PI], [-6, -3.4, Math.PI * 0.6], [-6, 3.4, Math.PI * 1.6]];
    for (const [lx, ly, ph] of legs) { const o = Math.sin(p + ph) * 3.2 * m; this.ell(ctx, lx + o, ly, 2, 1.3, lc); ctx.fillStyle = '#1a1410'; ctx.fillRect(lx + o + 1.2, ly - 0.8, 1, 1.6); }
    ctx.strokeStyle = look.mane; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9.5, 0); ctx.quadraticCurveTo(-13, Math.sin(p * 0.5) * 2 * m, -15, Math.sin(p) * 1.5 * m); ctx.stroke();
    this.ell(ctx, 0, 0, 10.5, 4.6, look.col);
    this.ell(ctx, -1, -1.2, 7, 1.8, shadeHex(look.col, 0.12));
    const nk = st.graze ? 0.5 : 0;
    this.ell(ctx, 8.6, 0, 4.2, 2.7, look.col);
    this.ell(ctx, 12.8 + nk * 2, 0, 3.6, 2, look.col);
    this.ell(ctx, 15.4 + nk * 2, 0, 1.5, 1.6, shadeHex(look.col, -0.2));
    if (look.blaze) { ctx.fillStyle = '#f0ece4'; ctx.fillRect(12 + nk * 2, -0.5, 4, 1); }
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
      this.ell(ctx, 0, L * 0.1, L * 0.55, Wd * 0.9, 'rgba(110,10,10,0.5)');
      ctx.globalAlpha = a.skinned ? 1 : 1;
    } else this.ell(ctx, 1, 2, L * 0.55, Wd * 0.75, 'rgba(0,0,0,0.25)');
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

  /* ---------- Portre (karakter yaratma / günlük) ---------- */
  portrait(ctx, W, H, look, age) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const s = W / 200;
    ctx.scale(s, s);
    const aging = clamp((age - 35) / 45, 0, 1);
    const grey = clamp((age - 42) / 30, 0, 1);
    const hair = grey > 0 ? mixHex(look.hair, '#d8d4cc', grey) : look.hair;
    const skin = look.skin;
    // arka plan
    const bg = ctx.createRadialGradient(100, 90, 20, 100, 110, 130);
    bg.addColorStop(0, '#d8c8a0'); bg.addColorStop(1, '#7a6444');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 200, 240);
    // uzun saç arkası
    if (look.hairStyle === 1 || (look.sex === 'f' && look.hairStyle !== 3)) { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(100, 128, 48, 62, 0, 0, TAU); ctx.fill(); }
    // omuzlar
    ctx.fillStyle = look.coat;
    ctx.beginPath(); ctx.moveTo(18, 240); ctx.quadraticCurveTo(24, 168, 100, 160); ctx.quadraticCurveTo(176, 168, 182, 240); ctx.fill();
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.moveTo(78, 240); ctx.lineTo(84, 164); ctx.lineTo(116, 164); ctx.lineTo(122, 240); ctx.fill();
    ctx.fillStyle = shadeHex(look.coat, -0.25); ctx.beginPath(); ctx.moveTo(84, 164); ctx.lineTo(96, 210); ctx.lineTo(70, 176); ctx.fill(); ctx.beginPath(); ctx.moveTo(116, 164); ctx.lineTo(104, 210); ctx.lineTo(130, 176); ctx.fill();
    if (look.sex === 'm') { ctx.fillStyle = '#6a1a14'; ctx.beginPath(); ctx.moveTo(92, 168); ctx.lineTo(108, 168); ctx.lineTo(100, 178); ctx.fill(); }
    // boyun
    ctx.fillStyle = shadeHex(skin, -0.12); ctx.fillRect(86, 138, 28, 30);
    // yüz
    const fw = look.sex === 'f' ? 30 : 33;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(100, 108, fw, 40, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(100 - fw, 110, 5, 9, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(100 + fw, 110, 5, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.ellipse(112, 116, 18, 30, 0, 0, TAU); ctx.fill();
    // gözler
    ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.ellipse(87, 104, 6, 3.2, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(113, 104, 6, 3.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = look.eyes || '#3a2a1a'; ctx.beginPath(); ctx.arc(88, 104, 2.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(114, 104, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(88, 104, 1.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(114, 104, 1.2, 0, TAU); ctx.fill();
    // kaşlar
    ctx.strokeStyle = shadeHex(hair, -0.2); ctx.lineWidth = look.sex === 'f' ? 2 : 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(79, 96); ctx.quadraticCurveTo(87, 92, 95, 96); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(105, 96); ctx.quadraticCurveTo(113, 92, 121, 96); ctx.stroke();
    // burun
    ctx.strokeStyle = shadeHex(skin, -0.3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(100, 104); ctx.lineTo(97, 121); ctx.lineTo(103, 123); ctx.stroke();
    // ağız
    ctx.strokeStyle = look.sex === 'f' ? '#a04a44' : shadeHex(skin, -0.4); ctx.lineWidth = look.sex === 'f' ? 3 : 2.2;
    ctx.beginPath(); ctx.moveTo(90, 134); ctx.quadraticCurveTo(100, 137, 110, 134); ctx.stroke();
    // yaşlılık çizgileri
    if (aging > 0) {
      ctx.strokeStyle = `rgba(80,40,20,${0.15 + aging * 0.35})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(82, 84); ctx.lineTo(118, 84); ctx.stroke();
      if (aging > 0.3) { ctx.beginPath(); ctx.moveTo(85, 79); ctx.lineTo(115, 79); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(90, 124); ctx.quadraticCurveTo(86, 132, 88, 138); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(110, 124); ctx.quadraticCurveTo(114, 132, 112, 138); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(78, 108); ctx.lineTo(74, 110); ctx.moveTo(122, 108); ctx.lineTo(126, 110); ctx.stroke();
    }
    // sakal
    const bl = look.beardLen === undefined ? 1 : look.beardLen;
    if (look.sex === 'm' && look.beard > 0 && bl > 0.05) {
      ctx.fillStyle = hair; ctx.globalAlpha = look.beard === 3 ? 0.55 : 1;
      if (look.beard === 1 || look.beard === 2 || look.beard === 4) { ctx.beginPath(); ctx.moveTo(86, 130); ctx.quadraticCurveTo(100, 124, 114, 130); ctx.lineTo(114, 133); ctx.quadraticCurveTo(100, 128, 86, 133); ctx.fill(); }
      if (look.beard === 2) { ctx.beginPath(); ctx.ellipse(100, 144, 7, 6 + bl * 6, 0, 0, TAU); ctx.fill(); }
      if (look.beard === 3 || look.beard === 4) {
        const len = look.beard === 4 ? 10 + bl * 22 : 6;
        ctx.beginPath(); ctx.moveTo(68, 110); ctx.quadraticCurveTo(70, 140 + len, 100, 148 + len); ctx.quadraticCurveTo(130, 140 + len, 132, 110); ctx.quadraticCurveTo(128, 136, 100, 138); ctx.quadraticCurveTo(72, 136, 68, 110); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // saç
    ctx.fillStyle = hair;
    const hs = look.hairStyle;
    if (hs !== 3) {
      ctx.beginPath(); ctx.ellipse(100, 82, fw + 3, 26, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(100 - fw + 2, 96, 6, 16, 0.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(100 + fw - 2, 96, 6, 16, -0.2, 0, TAU); ctx.fill();
      if (hs === 4) for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(72 + k * 9, 74, 7, 0, TAU); ctx.fill(); }
      if (hs === 2) { ctx.beginPath(); ctx.arc(100, 56, 14, 0, TAU); ctx.fill(); }
    } else {
      ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(100, 82, fw + 1, 22, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
    }
    // şapka
    if (look.hat && look.hat !== 'none') {
      const hc = look.hatCol;
      if (look.hat === 'cowboy' || look.hat === 'wide') {
        const bw = look.hat === 'wide' ? 78 : 66;
        ctx.fillStyle = shadeHex(hc, -0.15); ctx.beginPath(); ctx.ellipse(100, 74, bw, 13, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(66, 74); ctx.quadraticCurveTo(64, 30, 100, 34); ctx.quadraticCurveTo(136, 30, 134, 74); ctx.fill();
        ctx.fillStyle = shadeHex(hc, -0.3); ctx.beginPath(); ctx.moveTo(96, 34); ctx.quadraticCurveTo(100, 48, 104, 34); ctx.fill();
        ctx.fillStyle = '#2a1c14'; ctx.fillRect(66, 64, 68, 7);
        ctx.fillStyle = shadeHex(hc, 0.15); ctx.beginPath(); ctx.ellipse(100, 70, bw - 4, 5, 0, Math.PI, 0); ctx.fill();
      } else if (look.hat === 'bowler') {
        ctx.fillStyle = shadeHex(hc, -0.15); ctx.beginPath(); ctx.ellipse(100, 72, 48, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(100, 64, 35, 30, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(65, 62, 70, 10);
        ctx.fillStyle = '#1a1210'; ctx.fillRect(65, 62, 70, 5);
      } else if (look.hat === 'flat') {
        ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(100, 70, 40, 18, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = shadeHex(hc, -0.2); ctx.beginPath(); ctx.ellipse(106, 72, 38, 6, 0, 0, Math.PI); ctx.fill();
      }
    }
    ctx.restore();
  },
};
