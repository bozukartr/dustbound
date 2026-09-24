'use strict';
/* ==========================================================
   DUSTBOUND — vektör ikon seti (SVG)
   - ITEM_ICONS: çok renkli, konturlu eşya/silah ikonları
   - GLYPHS: tek renkli arayüz glifleri (radar, harita, menü, HUD)
   ========================================================== */

const IC = {
  D: '#24180e', L: '#efe6d2', P: '#d9c8a4', M: '#a88658', B: '#6e4a2c', W: '#8a5a32',
  metal: '#a8adb2', metalD: '#5c6166', gold: '#e2b64a', goldD: '#a8802a', red: '#b8352c', green: '#5f8a3a', leaf: '#6f9a44', blue: '#4f7fae', glass: '#d6e2e2',
};
const _r = (x, y, w, h, f, rx = 0, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"${a}/>`;
const _c = (x, y, r, f, a = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"${a}/>`;
const _e = (x, y, rx, ry, f, rot = 0, a = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}${a}/>`;
const _p = (d, f, a = '') => `<path d="${d}" fill="${f}"${a}/>`;
const _s = (d, col, w = 1.5) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const NS = ' stroke="none"';
const OUT = inner => `<g stroke="${IC.D}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;

/* ---------------- Eşya parçaları ---------------- */
const IK = {
  can: (t, lab = IC.P) => OUT(_p('M9 9 h14 v16 q0 2 -2 2 h-10 q-2 0 -2 -2z', IC.metal) + _r(9, 13, 14, 8, t, 0, NS) + _r(12, 15, 8, 4, lab, 1, NS) + _e(16, 9, 7, 2.2, '#c8ccd0') + _s('M9 13 H23 M9 21 H23', IC.D, 0.8)),
  bread: () => OUT(_p('M4 21 Q4 12 16 11 Q28 12 28 21 Q28 25 24 25 H8 Q4 25 4 21Z', '#c9924a') + _p('M6 20 Q6 14 16 13 Q26 14 26 20', '#dcae68', NS) + _s('M10 14 l3 5 M16 13 l3 6 M22 14 l2 5', '#8a5a2a', 1.3)),
  steak: (t, fat = IC.L) => OUT(_p('M6 16 Q6 8 15 8 Q26 8 26 16 Q26 25 17 25 Q13 25 11 22 Q6 22 6 16Z', t) + _s('M8 17 Q8 10.5 15 10.5', fat, 2.2) + _c(18, 15, 2.6, fat) + _s('M12 19 l2 -1 M20 20 l2 -2 M15 22 l2 -1', 'rgba(0,0,0,0.35)', 1)),
  drum: t => OUT(_s('M18 18 L24.5 24.5', IC.L, 3.4) + _c(26, 24, 2.1, IC.L) + _c(24, 26.5, 2.1, IC.L) + _e(12.5, 12.5, 8.5, 7, t, -40) + _e(10, 10.5, 3, 2, 'rgba(255,255,255,0.25)', -40, NS)),
  fish: (t, b = IC.P) => OUT(_p('M21 16 L28 9.5 L27 16 L28 22.5Z', t) + _p('M3.5 16 Q12 6.5 22 16 Q12 25.5 3.5 16Z', t) + _p('M6 17.5 Q12 22 19 17.5 Q12 20 6 17.5Z', b, NS) + _p('M11 10.5 L14 7.5 L16 11.5', t) + _c(8.5, 14.5, 1.3, IC.D, NS)),
  apple: () => OUT(_c(16, 18, 9, IC.red) + _e(12, 15, 2, 3, '#e07068', -20, NS) + _s('M16 10 Q17 6 19 4.5', IC.B, 1.8) + _p('M17.5 8 Q22 3.5 26 6.5 Q22 10.5 17.5 8Z', IC.leaf)),
  berries: () => OUT(_p('M16 9 Q20 3 26 5 Q22 11 16 9Z', IC.leaf) + _c(11.5, 18, 4.6, '#3b4f9a') + _c(20.5, 18, 4.6, '#3b4f9a') + _c(16, 12.5, 4.6, '#4a5fae') + _c(16, 23.5, 4.3, '#34468a') + _c(10.5, 16.5, 1, '#aab8f0', NS) + _c(15, 11, 1, '#aab8f0', NS) + _c(19.5, 16.5, 1, '#aab8f0', NS)),
  corn: () => OUT(_p('M9 28 Q6 14 12 6 Q11 18 16 28Z', IC.leaf) + _e(16.5, 15, 5, 11, '#e8c048') + _s('M13 9 V22 M16.5 5 V26 M20 9 V22 M12 11 H21 M11.8 15 H21.3 M12 19 H21', '#b8902a', 0.9) + _p('M24 28 Q27 14 21 6 Q22 18 17 28Z', '#7faa4a')),
  choc: () => OUT(_r(7, 5, 18, 22, '#5a3420', 2) + _s('M13 5 V16 M19 5 V16 M7 10.5 H25', '#3a1e10', 1) + _r(7, 16, 18, 11, IC.red, 0) + _r(7, 19.5, 18, 3, IC.gold, 0, NS)),
  jerky: () => OUT(_p('M5 9 Q16 5 27 9 L26 13.5 Q16 10 6 13.5Z', '#8a3a24') + _p('M5 17 Q16 13 27 17 L26 21.5 Q16 18 6 21.5Z', '#7a3020') + _s('M9 10 l1 2 M16 8.5 l1 2 M22 9.5 l1 2 M10 18 l1 2 M18 16.5 l1 2', '#c86a50', 1)),
  coffee: () => OUT(_s('M22 15 q5.5 0 5.5 3.5 q0 3.5 -5.5 3.5', IC.L, 2) + _p('M6 12 h16 v9 q0 6 -6 6 h-4 q-6 0 -6 -6z', IC.L) + _e(14, 12, 8, 2, '#4a2a18') + _s('M11 9 q-1.5 -2 0 -4 M15 9 q-1.5 -2 0 -4 M19 9 q-1.5 -2 0 -4', IC.P, 1.2)),
  beer: () => OUT(_s('M21 13 q6 0 6 5 q0 5 -6 5', IC.glass, 2.5) + _r(7, 10, 14, 17, '#d9a03a', 2) + _r(9, 12, 2, 13, 'rgba(255,255,255,0.3)', 1, NS) + _p('M6 11 q0 -5 5 -4 q2 -3 5 -1 q4 -2 5 2 q2 2 -1 4 h-13 q-2 0 -1 -1z', IC.L)),
  whiskey: () => OUT(_p('M13 4 h6 v6 q4 2 4 6 v11 q0 2 -2 2 h-10 q-2 0 -2 -2 v-11 q0 -4 4 -6z', '#9a5a1e') + _r(10, 17, 12, 7, IC.P, 0) + _s('M12.5 20.5 H19.5', IC.B, 1) + _r(13, 2, 6, 3.5, IC.B, 1) + _r(11, 12, 2, 12, 'rgba(255,255,255,0.25)', 1, NS)),
  stew: () => OUT(_s('M11 9 q-1.5 -2 0 -4 M16 9 q-1.5 -2 0 -4 M21 9 q-1.5 -2 0 -4', IC.P, 1.2) + _p('M3.5 15 h25 q-1 11 -12.5 11 q-11.5 0 -12.5 -11z', IC.B) + _e(16, 15, 12.5, 3, '#9a5020') + _c(12, 15, 1.5, '#e8a040', NS) + _c(19, 14.5, 1.3, IC.leaf, NS)),
  flask: (t) => OUT(_p('M13 4 h6 v6 l5 7 q2 3 0 6 q-2 4 -6 4 h-4 q-4 0 -6 -4 q-2 -3 0 -6 l5 -7z', IC.glass) + _p('M8.7 19 h14.6 q1.8 3 0 5.5 q-2 3.5 -6 3.5 h-2.6 q-4 0 -6 -3.5 q-1.8 -2.5 0 -5.5z', t, NS) + _r(12.5, 2, 7, 3.5, IC.B, 1) + _p('M11 20 q-1 3 1 5', 'none', ' stroke="rgba(255,255,255,0.6)" stroke-width="1.2"')),
  vial: t => OUT(_r(11.5, 5, 9, 23, IC.glass, 4.5) + _r(11.5, 15, 9, 13, t, 4.5, NS) + _r(10.5, 3, 11, 4, IC.B, 1) + _r(13, 8, 1.8, 16, 'rgba(255,255,255,0.5)', 1, NS)),
  bandage: () => OUT(_p('M7 20 L3.5 27.5 L10.5 27.5 L13 23', IC.L) + _r(7, 8, 16, 16, IC.L, 3) + _e(23, 16, 3.5, 8, IC.P) + _e(23, 16, 1.2, 3, IC.M, 0, NS) + _r(13.5, 12.5, 3, 7, IC.red, 0, NS) + _r(11.5, 14.5, 7, 3, IC.red, 0, NS)),
  pouch: () => OUT(_p('M8 13 q0 -4 8 -4 q8 0 8 4 l2 11 q0 4 -10 4 q-10 0 -10 -4z', '#8a6a3a') + _r(9, 11, 14, 3, IC.B, 1) + _p('M16 9 Q19 3 25 4 Q21 9 16 9Z', '#7a8a3a')),
  cig: () => OUT(_r(3, 17, 22, 4.5, IC.L, 1) + _r(20, 17, 5, 4.5, '#d89040', 0) + _c(3.5, 19.2, 2, '#e85020', NS) + _s('M5 14 q-2 -3 1 -5 q3 -2 1 -5', 'rgba(230,230,230,0.8)', 1.3)),
  sprig: (leaf, fl, n = 3) => OUT(_s('M16 29 Q15 18 17 6', '#4a6a2a', 1.8) + _e(11.5, 21, 4.5, 2.2, leaf, -30) + _e(20.5, 18, 4.5, 2.2, leaf, 30) + _e(12.5, 14, 3.8, 1.8, leaf, -35) + _e(20, 11, 3.5, 1.7, leaf, 35) + (fl ? _c(17, 5.5, 2.6, fl) + (n > 1 ? _c(13.5, 8.5, 2, fl) + _c(20.5, 7.5, 2, fl) : '') : '')),
  ginseng: () => OUT(_p('M15 16 q-5 4 -4 12 M15 16 q3 5 7 11 M15 16 q-1 6 1 12', 'none', ` stroke="${IC.D}"`) + _s('M15 16 q-5 4 -4 12 M15 16 q3 5 7 11 M15 16 q-1 6 1 12', '#e8d0a0', 2.4) + _s('M15 16 Q15 10 17 5', '#4a6a2a', 1.6) + _e(11, 11, 4, 2, IC.leaf, -30) + _e(20, 9, 4, 2, IC.leaf, 30) + _c(17, 4.5, 2.2, IC.red) + _c(14.5, 6, 1.6, IC.red)),
  yarrow: () => IK.sprig('#7a9a5a', null) + OUT(_e(16.5, 6.5, 7, 3.2, '#f2eee0') + _c(13, 6, 1, '#d8d0b0', NS) + _c(16.5, 5.5, 1, '#d8d0b0', NS) + _c(20, 6.5, 1, '#d8d0b0', NS)),
  mushroom: () => OUT(_r(12, 16, 8, 11, IC.L, 3) + _p('M4.5 18 Q4.5 6 16 6 Q27.5 6 27.5 18Z', IC.red) + _c(10, 13, 1.8, IC.L, NS) + _c(16, 10, 2, IC.L, NS) + _c(22, 13, 1.6, IC.L, NS)),
  bouquet: () => OUT(_s('M16 28 L12 12 M16 28 L16 10 M16 28 L20 12', '#4a6a2a', 1.4) + _p('M11 21 L16 28 L21 21Z', IC.P) + _c(11, 11, 3.2, '#e8c040') + _c(16, 8, 3.2, '#c060c0') + _c(21, 11, 3.2, '#e05a3a') + _c(13.5, 15, 2.5, '#f0f0f0') + _c(18.5, 15, 2.5, '#7090e0')),
  pelt: (t, t2) => OUT(_p('M10 5 Q16 7.5 22 5 L24 9.5 L28.5 8.5 L26 14 Q27.5 20 25 24 L28.5 27.5 L22.5 27 Q16 29.5 9.5 27 L3.5 27.5 L7 24 Q4.5 20 6 14 L3.5 8.5 L8 9.5Z', t) + _e(16, 17, 5, 8.5, t2 || 'rgba(255,255,255,0.18)', 0, NS)),
  feather: () => OUT(_p('M25 3 Q9 7 6.5 27 Q21 21 25 3Z', IC.L) + _s('M25 3 L5.5 28.5', IC.M, 1.2) + _s('M20 9 l-4 -1 M17 13 l-4 -1 M14 17 l-4 -1 M18 12 l1 4 M15 16 l1 4', 'rgba(0,0,0,0.25)', 0.9)),
  antler: () => `<g stroke="${IC.D}" stroke-width="4.6" fill="none" stroke-linecap="round">${'<path d="M9 28 Q7 16 12 6 M9.5 18 Q15 16 18 11 M11 11 Q16 10 20 5 M8.7 22 Q4 19 3.5 14"/>'}</g>` + _s('M9 28 Q7 16 12 6 M9.5 18 Q15 16 18 11 M11 11 Q16 10 20 5 M8.7 22 Q4 19 3.5 14', IC.P, 2.6),
  nugget: () => OUT(_p('M6 19 L9 10 L17 6.5 L25.5 10.5 L27 19 L20.5 25.5 L11 24.5Z', IC.gold) + _p('M9 10 L17 6.5 L18 13 L11 15Z', '#f6d880', NS) + _p('M18 13 L25.5 10.5 L27 19 L21 18Z', IC.goldD, NS)),
  ore: t => OUT(_p('M4.5 20 L9 11 L17 7.5 L25.5 12 L27.5 21 L19 26.5 L9 25.5Z', '#7a736a') + _p('M9 11 L17 7.5 L17.5 14 L11 16Z', '#958e84', NS) + _c(13, 19, 1.8, t, NS) + _c(19, 16, 1.5, t, NS) + _c(21, 21.5, 1.3, t, NS) + _c(15, 23, 1, t, NS)),
  goldbar: () => OUT(_p('M3.5 24 L8 15 H24 L28.5 24Z', IC.gold) + _p('M8 15 L11 10 H21 L24 15Z', '#f6d880') + _s('M12 20 H20', IC.goldD, 1.2)),
  watch: () => OUT(_s('M16 6 Q24 1 27 6', IC.gold, 1.6) + _r(14, 5, 4, 3.5, IC.gold, 1) + _c(16, 18.5, 9.5, IC.gold) + _c(16, 18.5, 7.3, IC.L) + _s('M16 18.5 V13.5 M16 18.5 L19.5 20.5', IC.D, 1.3) + _c(16, 18.5, 0.9, IC.D, NS)),
  ring: () => `<circle cx="16" cy="20" r="8" fill="none" stroke="${IC.D}" stroke-width="5.4"/><circle cx="16" cy="20" r="8" fill="none" stroke="${IC.gold}" stroke-width="3.2"/>` + OUT(_p('M12 11 L14 7 H18 L20 11 L16 14.5Z', '#8ad0e8')),
  necklace: () => _s('M5 6 Q5 24 16 25 Q27 24 27 6', IC.D, 2.4) + _s('M5 6 Q5 24 16 25 Q27 24 27 6', IC.metal, 1) + OUT([[6, 12], [8, 18], [11.5, 22.5], [16, 24.5], [20.5, 22.5], [24, 18], [26, 12]].map(([x, y]) => _c(x, y, 2.2, IC.L)).join('') + _p('M13 25 L16 30 L19 25Z', '#8ad0e8')),
  meteor: () => OUT(_p('M5 18 L8 9 L16 5 L25 8 L28 17 L22 26 L11 26Z', '#3a3638') + _s('M9 17 L14 14 L16 20 L22 16 M16 20 L15 24 M14 14 L13 9', '#ff8a30', 1.4) + _c(20, 10, 1.3, '#ffb060', NS)),
  arrowhead: () => OUT(_p('M16 3.5 L25 23 L19.5 21 L16 27 L12.5 21 L7 23Z', '#8a8078') + _s('M16 7 L14 13 M16 7 L18 13 M13 16 L16 20 L19 16', 'rgba(255,255,255,0.3)', 1)),
  bone: () => OUT(_p('M8.5 5 A3.5 3.5 0 0 0 5 10.5 A3.5 3.5 0 0 0 9.5 13 L19 22.5 A3.5 3.5 0 0 0 21.5 27 A3.5 3.5 0 0 0 27 23.5 A3.5 3.5 0 0 0 23 19 L13.5 9.5 A3.5 3.5 0 0 0 8.5 5Z', IC.L)),
  coin: () => OUT(_c(16, 16, 11.5, '#b89448') + _c(16, 16, 8.5, '#d4b05c') + _p('M16 10 L17.6 14.2 H22 L18.4 16.8 L19.8 21 L16 18.4 L12.2 21 L13.6 16.8 L10 14.2 H14.4Z', '#8a6a2a', NS)),
  card: () => OUT(_r(8.5, 4, 15, 24, IC.L, 2) + _r(10.5, 6, 11, 13, '#6a8aa8', 1) + _c(16, 10.5, 2.4, IC.P, NS) + _p('M12 19 Q16 12 20 19Z', IC.P, NS) + _s('M11 22 H21 M11 25 H18', IC.M, 1)),
  bedroll: () => OUT(_r(4, 10, 21, 12, '#6a4a3a', 5) + _r(9, 10, 2.5, 12, IC.red, 0, NS) + _r(18, 10, 2.5, 12, IC.red, 0, NS) + _e(25, 16, 3.5, 6, '#8a6a4a') + _s('M25 13 q2 1 0 3 q-2 1 0 3', IC.B, 1)),
  rod: () => _s('M5 28 L27 4', IC.D, 3.6) + _s('M5 28 L27 4', IC.W, 2) + OUT(_c(10, 23, 3.4, IC.metal) + _c(10, 23, 1, IC.D, NS)) + _s('M27 4 Q29.5 16 23 25', IC.L, 0.9) + _s('M23 25 q0 3 -2.5 2', IC.metal, 1.2),
  pan: () => OUT(_r(26, 17, 4, 3, IC.B, 1) + _e(15, 18.5, 13, 6.5, IC.metalD) + _e(15, 17.5, 10, 4.2, IC.metal) + _c(12, 17.5, 1.1, IC.gold, NS) + _c(17, 18.5, 0.9, IC.gold, NS) + _c(15, 16.5, 0.7, IC.gold, NS)),
  pickaxe: () => `<g transform="rotate(-35 16 16)">${OUT(_r(14.5, 7, 3, 23, IC.W, 1) + _p('M3 11 Q16 2 29 11 L28 13.5 Q16 7 4 13.5Z', IC.metal))}</g>`,
  shovel: () => `<g transform="rotate(35 16 16)">${OUT(_r(14.8, 2, 2.4, 17, IC.W, 1) + _r(12, 2, 8, 3, IC.W, 1.5) + _p('M10 18 H22 V23 Q22 29 16 30 Q10 29 10 23Z', IC.metal))}</g>`,
  canteen: () => _s('M8 12 Q4 2 16 3 Q28 2 24 12', IC.B, 1.6) + OUT(_r(13.5, 3.5, 5, 5, IC.metalD, 1) + _c(16, 18, 10, '#6a7a6a') + _c(16, 18, 7, '#8a9a88') + _c(13, 15, 2, 'rgba(255,255,255,0.25)', NS)),
  lantern: () => OUT(_s('M11 7 Q16 1 21 7', IC.metalD, 1.4) + _p('M10 9 L16 5.5 L22 9Z', '#3a3a3a') + _r(10, 9, 12, 16, '#3a3a3a', 2) + _r(12, 11, 8, 12, '#f0c860', 1) + _e(16, 17.5, 2, 3.5, '#fff4c0', 0, NS) + _r(9, 25, 14, 3, '#3a3a3a', 1)),
  hay: () => OUT(_r(5, 8, 22, 18, '#d8b050', 3) + _s('M8 10 L7 24 M11 9 L11 25 M15 9 L15.5 25 M19 9 L19 25 M23 10 L24 24', '#a07a2a', 0.9) + _r(5, 12, 22, 2.2, IC.B, 0, NS) + _r(5, 19.5, 22, 2.2, IC.B, 0, NS)),
  brush: () => OUT(_s('M8 20 V27 M11 20 V27.5 M14 20 V27.5 M17 20 V27.5 M20 20 V27.5 M23 20 V27', '#3a2a1a', 1.2) + _r(5, 11, 22, 9, IC.W, 4) + _r(9, 13, 14, 2, 'rgba(255,255,255,0.25)', 1, NS)),
  syringe: () => `<g transform="rotate(-40 16 16)">${OUT(_s('M16 2 V7', IC.metal, 1) + _r(12, 7, 8, 17, IC.glass, 1) + _r(13, 14, 6, 9, '#8ad08a', 0, NS) + _r(11, 24, 10, 2, IC.metalD, 1) + _r(15, 26, 2, 4, IC.metalD, 0) + _r(12, 29.5, 8, 1.8, IC.metalD, 1))}</g>`,
  worm: () => _s('M5 20 Q9 12 13 19 Q17 26 21 17 Q24 10 27 15', IC.D, 5) + _s('M5 20 Q9 12 13 19 Q17 26 21 17 Q24 10 27 15', '#d88a8a', 3) + _c(27, 15, 1.6, '#c87a7a'),
  harmonica: () => OUT(_r(4, 11, 24, 10, IC.metal, 2) + _r(4, 15, 24, 5, IC.W, 0) + [7, 10.5, 14, 17.5, 21, 24.5].map(x => _r(x, 16, 1.8, 3, IC.D, 0.5, NS)).join('') + _r(6, 12.5, 20, 1.5, 'rgba(255,255,255,0.5)', 0.7, NS)),
  scroll: (x) => OUT(_r(6, 7, 20, 18, IC.P, 1) + _e(6, 16, 2.4, 9.5, IC.M) + _e(26, 16, 2.4, 9.5, IC.M)) + _s('M9 12 Q13 16 16 13 T23 16 M10 20 L14 18 L18 21 L22 19', IC.B, 1) + (x ? _s('M18 15 l4 4 M22 15 l-4 4', IC.red, 2) : ''),
  coat: (t) => OUT(_p('M11 4.5 L16 9 L21 4.5 L27.5 9 L25.5 17 L23 15.5 L23 28 L9 28 L9 15.5 L6.5 17 L4.5 9Z', t) + _p('M11 4.5 L16 9 L14 18 Z M21 4.5 L16 9 L18 18Z', 'rgba(0,0,0,0.25)') + _c(16, 20, 0.9, IC.L, NS) + _c(16, 24, 0.9, IC.L, NS)),
  shirt: (t) => OUT(_p('M11 5 L16 8 L21 5 L27.5 9.5 L25 15 L22.5 13.5 L22.5 27 L9.5 27 L9.5 13.5 L7 15 L4.5 9.5Z', t) + _p('M11 5 L16 8 L21 5 L16 11Z', IC.P) + _s('M16 11 V26', 'rgba(0,0,0,0.3)', 0.8)),
  poncho: (t) => OUT(_p('M16 4 L29.5 21 L22 26.5 L16 23 L10 26.5 L2.5 21Z', t) + _s('M6 19 L16 11 L26 19 M8.5 22 L16 16 L23.5 22', '#e8d098', 1.3) + _c(16, 6.5, 2.5, IC.B, NS)),
  hat: (kind, t) => {
    const d = shadeHex(t, -0.3);
    if (kind === 'bowler') return OUT(_e(16, 22, 12, 3.5, t) + _p('M8 22 Q8 9 16 9 Q24 9 24 22Z', t) + _r(8.5, 18, 15, 2.8, d, 0, NS));
    if (kind === 'flat') return OUT(_p('M4 21 Q4 10 16 10 Q27 10 27 19 L29 22 Q18 25 4 21Z', t) + _s('M8 19 Q16 17 26 19', d, 1));
    const w = kind === 'wide' ? 15 : 13;
    return OUT(_e(16, 22, w, 4, t) + _p('M9 22 Q8 9 13 9 Q16 11 19 9 Q24 9 23 22Z', t) + _r(9, 18, 14, 2.6, d, 0, NS) + _s('M16 10.5 V17', d, 1));
  },
  dynamite: () => `<g transform="rotate(-20 16 16)">${OUT(_r(6, 9, 6, 19, IC.red, 1) + _r(13, 9, 6, 19, '#c8402c', 1) + _r(20, 9, 6, 19, IC.red, 1) + _r(5.5, 13, 21, 2.5, IC.B, 0) + _r(5.5, 22, 21, 2.5, IC.B, 0))}${_s('M16 9 Q16 4 20 3', IC.P, 1.3)}${_c(20.5, 3, 1.8, '#ffd060', NS)}</g>`,
  hide2: t => IK.pelt(t, 'rgba(0,0,0,0.12)'),
};

/* ---------------- Eşya → ikon ---------------- */
const ITEM_ICON = {
  beans: () => IK.can('#8a3a24', '#e8d8a8'), bread: IK.bread, jerky: IK.jerky, apple: IK.apple, berries: IK.berries, peaches: () => IK.can('#e08a40', '#f6e0b0'), corn: IK.corn, chocolate: IK.choc,
  raw_game: () => IK.steak('#b8433a'), cooked_game: () => IK.steak('#7a4426', '#e0c090'), raw_big: () => IK.steak('#a8302a'), cooked_big: () => IK.steak('#6a3a20', '#e8c898'),
  raw_bird: () => IK.drum('#e0a090'), cooked_bird: () => IK.drum('#b8702a'), raw_fish: () => IK.fish('#7a9aa8'), cooked_fish: () => IK.fish('#b8783a', '#e0c090'),
  stew: IK.stew, coffee: IK.coffee, beer: IK.beer, whiskey: IK.whiskey,
  health_cure: () => IK.flask('#c83a3a'), stamina_tonic: () => IK.flask('#d8c040'), snake_oil: () => IK.flask('#d88a2a'), antidote: () => IK.vial('#4a8ad0'), bandage: IK.bandage,
  herbal_tonic: () => IK.flask('#5a9a3a'), tobacco: IK.pouch, cigarette: IK.cig,
  ginseng: IK.ginseng, yarrow: IK.yarrow, sage: () => IK.sprig('#9aaa90', '#b8a8d8'), mint: () => IK.sprig('#4aa04a', null), oregano: () => IK.sprig('#6a8a3a', '#b070c0'),
  milkweed: () => IK.sprig('#7a9a5a', '#f0b8d0', 1), mushroom: IK.mushroom, wildflower: IK.bouquet,
  rabbit_pelt: () => IK.pelt('#a89078'), deer_hide: () => IK.pelt('#a0703e'), elk_hide: () => IK.pelt('#7a5236'), prong_hide: () => IK.pelt('#c89a60'), wolf_pelt: () => IK.pelt('#8a8a8a'),
  coyote_pelt: () => IK.pelt('#a88a64'), fox_pelt: () => IK.pelt('#c8602a'), bear_pelt: () => IK.hide2('#4a3020'), bison_hide: () => IK.hide2('#4a3322'), cougar_pelt: () => IK.pelt('#c09a64'),
  boar_hide: () => IK.hide2('#4e3e32'), gator_skin: () => IK.hide2('#5a6a3e'), snake_skin: () => IK.pelt('#8a7048'), horse_hide: () => IK.pelt('#7a4a2a'), feather: IK.feather, antler: IK.antler,
  fish_perch: () => IK.fish('#8aa05a'), fish_bass: () => IK.fish('#5a7a4a'), fish_trout: () => IK.fish('#a8a8b8', '#e8b0b0'), fish_catfish: () => IK.fish('#6a6258'), fish_salmon: () => IK.fish('#c87a6a', '#f0c0a8'), fish_pike: () => IK.fish('#6a8a5a', '#d8e0b0'),
  gold_nugget: IK.nugget, silver_ore: () => IK.ore('#e8eef4'), iron_ore: () => IK.ore('#c07050'), gold_bar: IK.goldbar, pocket_watch: IK.watch, gold_ring: IK.ring, necklace: IK.necklace, meteorite: IK.meteor,
  arrowhead: IK.arrowhead, dino_bone: IK.bone, old_coin: IK.coin, cig_card: IK.card,
  bedroll: IK.bedroll, fishing_rod: IK.rod, gold_pan: IK.pan, pickaxe: IK.pickaxe, shovel: IK.shovel, canteen: IK.canteen, lantern: IK.lantern, hay: IK.hay, horse_brush: IK.brush,
  horse_reviver: IK.syringe, horse_tonic: () => IK.flask('#8ab040'), bait: IK.worm, harmonica: IK.harmonica, treasure_map: () => IK.scroll(true), region_map: () => IK.scroll(false),
  coat_duster: () => IK.coat('#6b5a44'), coat_sheep: () => IK.coat('#8a6a4a'), coat_fur: () => IK.coat('#4a3a2c'), coat_poncho: () => IK.poncho('#9a4a2a'), coat_linen: () => IK.shirt('#d8cdb4'),
  mask_bandana: () => OUT(_p('M4 10 Q16 7 28 10 L26 15 Q22 26 16 28 Q10 26 6 15Z', '#a8281f') + _p('M4 10 Q16 7 28 10 L27.4 12.5 Q16 9.5 4.6 12.5Z', '#7e1c16', NS) + [[10, 16], [16, 15], [22, 16], [13, 21], [19, 21], [16, 25]].map(([x, y]) => _c(x, y, 1, IC.L, NS)).join('') + _p('M27 11 L31 8.5 L30 13Z', '#a8281f')),
  mask_sack: () => OUT(_p('M7 27 Q4 14 8 8 Q16 1 24 8 Q28 14 25 27Z', '#c8a870') + _e(12, 14, 2.4, 2, IC.D, 0, NS) + _e(20, 14, 2.4, 2, IC.D, 0, NS) + _s('M7 24 Q16 21 25 24', '#7a5a30', 1.6) + _s('M10 9 l1 2 M18 7 l1 2 M22 19 l1 2 M11 20 l1 1', '#9a7a48', 0.9)),
  hat_cowboy: () => IK.hat('cowboy', '#6a4a30'), hat_bowler: () => IK.hat('bowler', '#2a2420'), hat_flat: () => IK.hat('flat', '#5a5048'), hat_wide: () => IK.hat('wide', '#a08a64'),
  dynamite: IK.dynamite,
};

/* ---------------- Silahlar (48x24) ---------------- */
const WPN_ICON = {
  fists: () => OUT(_p('M17 7 h14 q4 0 4 4 v7 q0 5 -5 5 h-9 q-4 0 -4 -4z', '#e0b48c') + _s('M21 7 V13 M25 7 V13 M29 7.5 V13', 'rgba(0,0,0,0.35)', 1) + _p('M17 14 q-4 0 -4 3 q0 3 4 3', '#d0a07a')),
  knife: () => OUT(_p('M20 13 L42 9.5 Q46 10 44 13 L20 15.5Z', IC.metal) + _s('M22 13.3 L42 10.5', 'rgba(255,255,255,0.6)', 0.8) + _r(8, 12, 12, 5, IC.W, 2) + _r(18.5, 10.5, 2, 8, IC.metalD, 1)),
  revolver: (m = IC.metal) => OUT(_r(20, 7, 22, 3.6, m, 1) + _r(20, 10, 14, 1.6, shadeHex(m, -0.2), 0.5) + _r(13, 5.5, 9, 8, IC.metalD, 2) + _p('M11 6 L20 6 L20 13 L17 13 L14 21 L8 21 Q6 21 7 18 L10 12Z', m) + _p('M9 13 L15.5 13 L13 21 L8.5 21 Q6.8 21 7.4 18.5Z', IC.W) + _s('M17 13 Q17 17 20.5 16', IC.metalD, 1.2) + _c(17.5, 9.5, 1, IC.D, NS)),
  repeater: (m = IC.metal, rc = '#c8a040') => OUT(_r(18, 8, 28, 2.6, m, 1) + _r(18, 10.6, 24, 1.8, shadeHex(m, -0.25), 0.8) + _p('M2 12 L12 9 L19 9 L19 13 L12 14 L4 18Z', IC.W) + _r(12, 8, 8, 5.5, rc, 1) + _s('M13 13.5 Q12 19 17 19 Q19 18 18 13.5', m, 1.4)),
  rifle: () => OUT(_r(16, 9, 30, 2.4, IC.metal, 1) + _p('M2 12 L12 9 L22 9.5 L30 10.5 L30 12.5 L20 12.8 L12 14 L4 18Z', IC.W) + _r(14, 5, 12, 2.8, IC.metalD, 1.2) + _r(16, 7.6, 2, 2, IC.metalD, 0) + _r(23, 7.6, 2, 2, IC.metalD, 0) + _r(12, 8.6, 4, 4, IC.metalD, 0.5)),
  shotgun: () => OUT(_r(18, 7.6, 26, 2.2, IC.metal, 1) + _r(18, 9.8, 26, 2.2, shadeHex(IC.metal, -0.2), 1) + _p('M2 12 L12 8.5 L19 8.5 L19 12.5 L12 13.5 L4 18Z', IC.W) + _r(13, 8, 7, 5, IC.metalD, 1) + _p('M20 12 L32 12 L31 14 L21 14Z', IC.W)),
  bow: () => _s('M14 2.5 Q30 12 14 21.5', IC.D, 4) + _s('M14 2.5 Q30 12 14 21.5', IC.W, 2.2) + _s('M14 2.5 L14 21.5', IC.L, 0.8) + OUT(_s('M6 12 L40 12', IC.M, 1.4) + _p('M40 10 L45 12 L40 14Z', IC.metal) + _p('M6 12 L3 9.5 L8 12 L3 14.5Z', IC.red)),
  dynamite: () => `<g transform="translate(8 -4) scale(0.95)">${IK.dynamite()}</g>`,
};
WPN_ICON.cattleman = () => WPN_ICON.revolver(IC.metal);
WPN_ICON.schofield = () => WPN_ICON.revolver('#c8ccd4');
WPN_ICON.winchester = () => WPN_ICON.repeater('#b8bcc0', '#e0b848');

/* ---------------- Tek renkli glifler ---------------- */
const GLYPHS = {
  heart: k => _p('M16 27 C6 20 3 14 5 9.5 C7 5 13 5 16 10 C19 5 25 5 27 9.5 C29 14 26 20 16 27Z', k),
  bolt: k => _p('M18.5 3 L8 18 H15 L13 29 L24 13 H17Z', k),
  deadeye: k => _s('M4 16 Q16 5 28 16 Q16 27 4 16Z', k, 2) + _c(16, 16, 4.2, k) + _s('M16 2 V7 M16 25 V30 M2 16 H6 M26 16 H30', k, 1.8),
  meat: k => _e(12.5, 12.5, 8.5, 7, k, -40) + _s('M18 18 L24.5 24.5', k, 3.4) + _c(26, 24, 2.1, k) + _c(24, 26.5, 2.1, k),
  drop: k => _p('M16 3.5 C16 3.5 7 14.5 7 20 A9 9 0 0 0 25 20 C25 14.5 16 3.5 16 3.5Z', k),
  moon: k => _p('M19 3.5 A12.5 12.5 0 1 0 28.5 22 A10 10 0 0 1 19 3.5Z', k),
  soap: k => _r(5, 14, 17, 12, k, 4) + _c(22, 9, 3.5, 'none', ` stroke="${k}" stroke-width="1.8"`) + _c(27, 15, 2, 'none', ` stroke="${k}" stroke-width="1.5"`) + _c(15, 7, 2.4, 'none', ` stroke="${k}" stroke-width="1.5"`),
  horse: k => _p('M9 29 L10.5 19 Q7 16.5 8.5 12 L12 6 L12.5 2.5 L15 5.5 Q20 4.5 24 9 Q28 13.5 27.5 17.5 L24.5 19.5 L21 16.5 Q19 19.5 20 23.5 L21 29Z', k) + _c(18, 10, 1.1, 'rgba(0,0,0,0.6)'),
  snow: k => _s('M16 3 V29 M4.7 9.5 L27.3 22.5 M4.7 22.5 L27.3 9.5 M13 5 L16 8 L19 5 M13 27 L16 24 L19 27 M5 13 L9 12 L8 8 M27 19 L23 20 L24 24 M5 19 L9 20 L8 24 M27 13 L23 12 L24 8', k, 1.8),
  sun: k => _c(16, 16, 6.5, k) + _s('M16 2.5 V6.5 M16 25.5 V29.5 M2.5 16 H6.5 M25.5 16 H29.5 M6.5 6.5 L9.3 9.3 M22.7 22.7 L25.5 25.5 M6.5 25.5 L9.3 22.7 M22.7 9.3 L25.5 6.5', k, 2),
  skull: k => _p('M16 3.5 C8 3.5 5 9 5 14 C5 18 7 20 9 21 V26 H23 V21 C25 20 27 18 27 14 C27 9 24 3.5 16 3.5Z', k) + _c(11.5, 14.5, 3, 'rgba(0,0,0,0.75)') + _c(20.5, 14.5, 3, 'rgba(0,0,0,0.75)') + _p('M16 17.5 L14.5 20.5 H17.5Z', 'rgba(0,0,0,0.75)') + _s('M12.5 23 V26 M16 23 V26 M19.5 23 V26', 'rgba(0,0,0,0.6)', 1.2),
  sick: k => _r(13, 3, 6, 18, k, 3) + _c(16, 24, 5, k) + _r(15, 8, 2, 12, 'rgba(0,0,0,0.5)', 1) + _s('M22 8 H26 M22 12 H25 M22 16 H26', k, 1.5),
  mug: k => _r(7, 9, 14, 18, k, 2) + _s('M21 13 q6 0 6 5 q0 5 -6 5', k, 2.5) + _p('M6 10 q0 -5 5 -4 q2 -3 5 -1 q4 -2 5 2 q2 2 -1 3 h-13z', k),
  steam: k => _s('M9 27 q-4 -5 0 -10 q4 -5 0 -11 M16 27 q-4 -5 0 -10 q4 -5 0 -11 M23 27 q-4 -5 0 -10 q4 -5 0 -11', k, 2.2),
  fire: k => _p('M16 29 C9 29 6 24 7 19 C8 14 12 12 12 7 C16 9 17 13 17 15 C19 13 19 11 19 9 C23 12 26 16 25 21 C24.5 26 21 29 16 29Z', k) + _p('M16 27 C13 27 12 24.5 13 22 C14 19.5 16 19 16 16 C18 18.5 20 20.5 19.5 23 C19 25.5 18 27 16 27Z', 'rgba(0,0,0,0.35)'),
  flies: k => _e(10, 20, 3.5, 2.5, k) + _e(8, 17, 3, 1.6, k, -30) + _e(12, 17, 3, 1.6, k, 30) + _e(22, 10, 3.5, 2.5, k) + _e(20, 7, 3, 1.6, k, -30) + _e(24, 7, 3, 1.6, k, 30) + _s('M4 26 q6 -4 10 -2 M18 16 q4 -2 8 -1', k, 1),
  feet: k => _e(11, 20, 4, 6.5, k, -10) + _c(8.5, 11.5, 1.5, k) + _c(11, 10.5, 1.4, k) + _c(13.5, 11, 1.3, k) + _e(21, 13, 4, 6.5, k, 10) + _c(18.5, 4.5, 1.5, k) + _c(21, 3.5, 1.4, k) + _c(23.5, 4, 1.3, k),
  store: k => _p('M3.5 12 L7 5 H25 L28.5 12Z', k) + _r(5, 13, 22, 14, k) + _r(13, 18, 6, 9, 'rgba(0,0,0,0.6)') + _s('M10 5 L8.5 12 M16 5 V12 M22 5 L23.5 12', 'rgba(0,0,0,0.55)', 1.2),
  glass: k => _p('M8 7 H24 L21 27 H11Z', k) + _p('M9.5 14 H22.5 L21 25 H11Z', 'rgba(0,0,0,0.3)') + _s('M8 7 H24', k, 2),
  star: k => _p('M16 2.5 L19.8 11.5 L29.5 12.3 L22.2 18.7 L24.4 28.2 L16 23.2 L7.6 28.2 L9.8 18.7 L2.5 12.3 L12.2 11.5Z', k) + _c(16, 16, 3.2, 'rgba(0,0,0,0.4)'),
  cross: k => _r(12.5, 4, 7, 24, k, 1) + _r(4, 12.5, 24, 7, k, 1),
  gun: k => _r(14, 9, 16, 4, k, 1) + _r(9, 8, 8, 8, k, 2) + _p('M8 9 L15 9 L15 15 L13 15 L10.5 26 L4.5 26 Q3 26 3.5 23 L6 15Z', k) + _s('M13 15 Q13 20 17 19', k, 1.6),
  cleaver: k => _p('M4 7 H21 V20 Q13 22 4 20Z', k) + _c(8, 11, 1.6, 'rgba(0,0,0,0.6)') + _r(20, 11, 9, 4, k, 2),
  horseshoe: k => _s('M9 26 L8 14 Q8 5 16 5 Q24 5 24 14 L23 26', k, 5) + [[8.5, 20], [8.3, 14], [23.5, 20], [23.7, 14]].map(([x, y]) => _c(x, y, 0.9, 'rgba(0,0,0,0.7)')).join(''),
  bed: k => _r(3, 17, 26, 6, k, 1) + _r(3, 10, 4, 18, k, 1) + _r(6, 13, 7, 4, k, 2) + _r(25, 15, 4, 13, k, 1) + _r(13, 14, 13, 3, k, 1.5),
  bag: k => _p('M11 9 L9 5 H23 L21 9 Q29 14 28 22 Q27 29 16 29 Q5 29 4 22 Q3 14 11 9Z', k) + _s('M18.5 14.5 Q16 13 13.5 14.5 Q12.5 17 16 18 Q19.5 19 18.5 21.5 Q16 23 13.5 21.5 M16 12 V24', 'rgba(0,0,0,0.65)', 1.6),
  train: k => _r(4, 12, 16, 11, k, 1) + _r(18, 7, 10, 16, k, 1) + _r(6, 7, 4, 5, k) + _p('M2 23 H6 L3 27Z', k) + _c(10, 25, 3.2, k) + _c(22, 25, 3.2, k) + _r(20, 9, 6, 5, 'rgba(0,0,0,0.5)'),
  church: k => _r(14, 2, 4, 26, k, 1) + _r(8, 8, 16, 4, k, 1) + _p('M9 28 Q16 23 23 28Z', k),
  scroll: k => _r(7, 7, 18, 18, k, 1) + _e(7, 16, 2.4, 9.5, k) + _e(25, 16, 2.4, 9.5, k) + _s('M11 12 H21 M11 16 H21 M11 20 H18', 'rgba(0,0,0,0.55)', 1.4),
  barber: k => _r(11, 4, 10, 24, k, 2) + _s('M11 9 L21 5 M11 15 L21 11 M11 21 L21 17 M11 27 L21 23', 'rgba(0,0,0,0.55)', 2.2) + _r(9, 2.5, 14, 3, k, 1) + _r(9, 26.5, 14, 3, k, 1),
  scissors: k => _c(9, 23, 4.5, 'none', ` stroke="${k}" stroke-width="2.4"`) + _c(23, 23, 4.5, 'none', ` stroke="${k}" stroke-width="2.4"`) + _s('M11.5 19.5 L22 4 M20.5 19.5 L10 4', k, 2.6),
  pick: k => `<g transform="rotate(-35 16 16)">${_r(14.5, 7, 3, 23, k, 1) + _p('M3 11 Q16 2 29 11 L28 13.5 Q16 7 4 13.5Z', k)}</g>`,
  axe: k => `<g transform="rotate(30 16 16)">${_r(14.8, 3, 2.6, 26, k, 1) + _p('M17 5 Q27 3 27 11 Q27 17 17 15Z', k)}</g>`,
  anchor: k => _c(16, 6, 3, 'none', ` stroke="${k}" stroke-width="2.2"`) + _s('M16 9 V28 M10 14 H22 M5 19 Q6 28 16 28 Q26 28 27 19', k, 2.6) + _p('M3 20 L7 17 L7.5 22Z M29 20 L25 17 L24.5 22Z', k),
  wheat: k => _s('M16 29 V6', k, 2) + [8, 12, 16, 20].map(y => _e(12.5, y, 3.3, 1.8, k, 35) + _e(19.5, y, 3.3, 1.8, k, -35)).join('') + _e(16, 5, 1.8, 3, k),
  fox: k => _p('M4 4 L11 10 H21 L28 4 L26 16 Q23 25 16 28 Q9 25 6 16Z', k) + _c(11.5, 15.5, 1.4, 'rgba(0,0,0,0.7)') + _c(20.5, 15.5, 1.4, 'rgba(0,0,0,0.7)') + _c(16, 24, 1.8, 'rgba(0,0,0,0.7)'),
  hut: k => _p('M2.5 16 L16 4 L29.5 16Z', k) + _r(6, 16, 20, 12, k) + _r(13, 20, 6, 8, 'rgba(0,0,0,0.6)') + _s('M4 16 L16 6 L28 16', 'rgba(0,0,0,0.3)', 1),
  house: k => _p('M3 15 L16 4 L29 15Z', k) + _r(6, 15, 20, 13, k) + _r(10, 18, 5, 5, 'rgba(0,0,0,0.55)') + _r(18, 20, 5, 8, 'rgba(0,0,0,0.6)') + _r(21, 5, 4, 7, k),
  tent: k => _p('M2 27 L16 5 L30 27Z', k) + _p('M13 27 L16 16 L19 27Z', 'rgba(0,0,0,0.6)') + _s('M16 5 L16 2', k, 1.6),
  crater: k => _e(16, 18, 13, 8, 'none', 0, ` stroke="${k}" stroke-width="2.4"`) + _e(16, 18, 7, 3.5, k) + _p('M20 4 L24 9 L21 11 L18 8Z', k) + _s('M10 6 L17 13', k, 1.2),
  tree: k => _p('M16 2 L25 13 H20 L27 21 H19 V29 H13 V21 H5 L12 13 H7Z', k),
  ruins: k => _r(4, 24, 24, 4, k) + _r(6, 8, 5, 16, k) + _p('M13 24 V13 L18 11 V24Z', k) + _r(21, 16, 5, 8, k) + _r(4, 5, 9, 3, k),
  ghost: k => _p('M6 29 V14 Q6 3 16 3 Q26 3 26 14 V29 L22.5 25.5 L19 29 L16 25.5 L13 29 L9.5 25.5Z', k) + _c(12.5, 13, 2, 'rgba(0,0,0,0.7)') + _c(19.5, 13, 2, 'rgba(0,0,0,0.7)') + _e(16, 20, 2, 3, 'rgba(0,0,0,0.6)'),
  mine: k => _p('M3 29 V14 Q3 3 16 3 Q29 3 29 14 V29 H24 V15 Q24 8 16 8 Q8 8 8 15 V29Z', k) + _r(10, 20, 12, 6, k, 1) + _c(12.5, 27, 2, k) + _c(19.5, 27, 2, k),
  spring: k => _s('M10 14 q-3 -4 0 -8 M16 14 q-3 -4 0 -8 M22 14 q-3 -4 0 -8', k, 2) + _e(16, 23, 13, 5.5, k) + _s('M8 23 q4 -2 8 0 q4 2 8 0', 'rgba(0,0,0,0.45)', 1.4),
  bones: k => `<g transform="rotate(45 16 16)">${_r(14.5, 5, 3, 22, k, 1) + _c(13.5, 5, 2.6, k) + _c(18.5, 5, 2.6, k) + _c(13.5, 27, 2.6, k) + _c(18.5, 27, 2.6, k)}</g><g transform="rotate(-45 16 16)">${_r(14.5, 5, 3, 22, k, 1) + _c(13.5, 5, 2.6, k) + _c(18.5, 5, 2.6, k) + _c(13.5, 27, 2.6, k) + _c(18.5, 27, 2.6, k)}</g>`,
  gallows: k => _r(5, 4, 3, 25, k) + _r(5, 4, 20, 3, k) + _r(2, 26, 12, 3, k) + _s('M8 12 L13 7', k, 2.2) + _s('M22 7 V14', k, 1.4) + _c(22, 17, 3, 'none', ` stroke="${k}" stroke-width="1.8"`),
  wheel: k => _c(16, 16, 11.5, 'none', ` stroke="${k}" stroke-width="3"`) + _c(16, 16, 3.2, k) + _s('M16 5 V27 M5 16 H27 M8.2 8.2 L23.8 23.8 M8.2 23.8 L23.8 8.2', k, 1.8),
  lighthouse: k => _p('M12 29 L13.5 11 H18.5 L20 29Z', k) + _r(11.5, 6, 9, 5, k, 1) + _p('M11 6 L16 2 L21 6Z', k) + _s('M20.5 8 L28 5 M20.5 9 L28 12 M11.5 8 L4 5 M11.5 9 L4 12', k, 1.4) + _r(13, 17, 6, 2.2, 'rgba(0,0,0,0.5)') + _r(12.6, 23, 6.8, 2.2, 'rgba(0,0,0,0.5)'),
  swords: k => _s('M5 5 L24 24 M27 5 L8 24', k, 2.6) + _s('M19 27 L27 19 M13 27 L5 19', k, 2.4) + _c(26, 26, 1.8, k) + _c(6, 26, 1.8, k),
  fort: k => _p('M5 29 V8 H9 V11 H12 V8 H16 V11 H19 V8 H23 V11 H27 V29Z', k) + _p('M13 29 V21 Q16 17 19 21 V29Z', 'rgba(0,0,0,0.6)'),
  windmill: k => _p('M13 29 L14.5 14 H17.5 L19 29Z', k) + `<g transform="rotate(20 16 12)">${_p('M16 12 L14 1 H18Z', k)}${_p('M16 12 L27 10 V14Z', k)}${_p('M16 12 L18 23 H14Z', k)}${_p('M16 12 L5 14 V10Z', k)}</g>` + _c(16, 12, 2, k),
  palm: k => _s('M15 29 Q17 20 15 10', k, 3) + _p('M15 10 Q8 4 2 9 Q9 7 15 10Z', k) + _p('M15 10 Q22 3 29 8 Q22 7 15 10Z', k) + _p('M15 10 Q10 12 7 19 Q12 13 15 10Z', k) + _p('M15 10 Q21 12 24 19 Q19 13 15 10Z', k) + _p('M15 10 Q15 3 19 1 Q16 5 15 10Z', k),
  mask: k => _p('M3 10 Q16 6 29 10 L27 16 Q23 27 16 28.5 Q9 27 5 16Z', k) + _s('M9 15 Q16 13 23 15', 'rgba(0,0,0,0.45)', 1.4) + _c(12, 20, 1.2, 'rgba(0,0,0,0.45)') + _c(20, 20, 1.2, 'rgba(0,0,0,0.45)') + _c(16, 23.5, 1.2, 'rgba(0,0,0,0.45)'),
  witness: k => _p('M3 16 Q16 4 29 16 Q16 28 3 16Z', k) + _c(16, 16, 5, 'rgba(0,0,0,0.7)') + _p('M14.8 9 H17.2 L16.8 17 H15.2Z', k) + _c(16, 20, 1.3, k),
  eye: k => _p('M3 16 Q16 4 29 16 Q16 28 3 16Z', k) + _c(16, 16, 5, 'rgba(0,0,0,0.7)') + _c(17.5, 14.5, 1.5, k),
  paw: k => _e(16, 21, 7, 6, k) + _c(8, 13, 2.6, k) + _c(13, 9, 2.6, k) + _c(19, 9, 2.6, k) + _c(24, 13, 2.6, k),
  grave: k => _p('M3 29 Q16 21 29 29Z', k) + _r(14, 5, 4, 20, k) + _r(9, 9, 14, 4, k),
  arch: k => _p('M3 29 V13 Q3 4 16 4 Q29 4 29 13 V29 H23 V15 Q23 10 16 10 Q9 10 9 15 V29Z', k),
  question: k => _s('M10.5 11 Q10.5 4.5 16 4.5 Q22 4.5 22 10 Q22 14 17 16.5 Q16 17.5 16 20', k, 3) + _c(16, 26, 2.2, k),
  waypoint: k => _p('M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13Z', k),
  cart: k => _s('M3 6 H7 L10 22 H25 L28 10 H8', k, 2.4) + _c(12, 26, 2.2, k) + _c(23, 26, 2.2, k) + _p('M9 11 H27 L25 20 H11Z', k),
  bowl: k => _s('M11 10 q-1.5 -2 0 -4 M16 10 q-1.5 -2 0 -4 M21 10 q-1.5 -2 0 -4', k, 1.6) + _p('M3.5 15 h25 q-1 11 -12.5 11 q-11.5 0 -12.5 -11z', k),
  cards: k => `<g transform="rotate(-12 12 18)">${_r(5, 8, 13, 19, k, 2)}</g><g transform="rotate(12 20 18)">${_r(14, 6, 13, 19, k, 2)}</g>` + _p('M20.5 11 C18 14 17 15.5 20.5 19 C24 15.5 23 14 20.5 11Z', 'rgba(0,0,0,0.65)'),
  fist: k => _p('M7 9 h14 q4 0 4 4 v7 q0 7 -7 7 h-7 q-4 0 -4 -4z', k) + _s('M11 9 V14 M15 9 V14 M19 9 V14', 'rgba(0,0,0,0.5)', 1.2) + _p('M7 15 q-3.5 0 -3.5 3 q0 3 3.5 3', k),
  talk: k => _p('M4 6 H28 V21 H14 L8 27 V21 H4Z', k) + _s('M9 11 H23 M9 15.5 H19', 'rgba(0,0,0,0.55)', 1.6),
  tub: k => _p('M3 14 H29 V18 Q29 25 21 25 H11 Q3 25 3 18Z', k) + _s('M7 25 L6 28 M25 25 L26 28 M6 14 V7 Q6 4 9 4 Q12 4 12 7', k, 2) + _c(11, 10, 1.4, k) + _c(16, 9, 1.6, k) + _c(21, 11, 1.2, k),
  scales: k => _r(15, 5, 2, 22, k) + _r(9, 26, 14, 3, k, 1) + _s('M5 9 H27', k, 2) + _p('M2 18 L5 9 L8 18Z M24 18 L27 9 L30 18Z', 'none', ` stroke="${k}" stroke-width="1.2"`) + _p('M1.5 18 H8.5 Q5 22 1.5 18Z M23.5 18 H30.5 Q27 22 23.5 18Z', k),
  bank: k => _p('M2 11 L16 3 L30 11Z', k) + _r(4, 12, 24, 2.5, k) + [6, 12, 18, 24].map(x => _r(x, 15, 2.5, 10, k)).join('') + _r(3, 26, 26, 3, k),
  brush: k => _r(5, 10, 22, 9, k, 4) + _s('M8 20 V27 M11 20 V27.5 M14 20 V27.5 M17 20 V27.5 M20 20 V27.5 M23 20 V27', k, 1.3),
  coin: k => _c(16, 16, 12, k) + _c(16, 16, 8.5, 'none', ' stroke="rgba(0,0,0,0.45)" stroke-width="1.4"') + _s('M19 12 Q16 10.5 13.5 12 Q12.5 14.5 16 15.5 Q19.5 16.5 18.5 19.5 Q16 21 13 19.5 M16 9.5 V22', 'rgba(0,0,0,0.6)', 1.6),
  newspaper: k => _r(4, 6, 24, 21, k, 1) + _r(7, 9, 18, 4, 'rgba(0,0,0,0.55)') + _s('M7 16 H14 M7 19.5 H14 M7 23 H14', 'rgba(0,0,0,0.5)', 1.3) + _r(17, 16, 8, 8, 'rgba(0,0,0,0.4)'),
  door: k => _r(8, 3, 16, 26, k, 1) + _r(10.5, 5.5, 11, 9, 'rgba(0,0,0,0.3)') + _r(10.5, 16.5, 11, 10, 'rgba(0,0,0,0.3)') + _c(21, 17, 1.3, 'rgba(0,0,0,0.7)'),
  hourglass: k => _r(7, 3, 18, 3, k, 1) + _r(7, 26, 18, 3, k, 1) + _p('M9 6 H23 Q23 13 17 16 Q23 19 23 26 H9 Q9 19 15 16 Q9 13 9 6Z', 'none', ` stroke="${k}" stroke-width="2"`) + _p('M11 25 H21 Q20 21 16 19 Q12 21 11 25Z', k),
  quill: k => _p('M27 3 Q12 6 8 22 L10 23 Q20 16 27 3Z', k) + _s('M9 22 L5 29', k, 1.8) + _s('M4 29 H14', k, 1.4),
  back: k => _s('M27 16 H6 M13 8 L5 16 L13 24', k, 2.8),
  note: k => _c(9, 23, 4, k) + _c(23, 20, 4, k) + _r(11.2, 6, 2.2, 17, k) + _r(25, 3, 2.2, 17, k) + _p('M11.2 6 L27.2 3 V8 L11.2 11Z', k),
  chest: k => _p('M4 13 Q4 6 16 6 Q28 6 28 13Z', k) + _r(4, 14, 24, 13, k, 1) + _r(14, 12, 4, 6, 'rgba(0,0,0,0.6)', 1) + _s('M4 14 H28', 'rgba(0,0,0,0.5)', 1.4),
  pot: k => _r(5, 12, 22, 14, k, 3) + _r(3, 10, 26, 3, k, 1) + _s('M9 8 q-1 -2 0 -4 M16 8 q-1 -2 0 -4 M23 8 q-1 -2 0 -4', k, 1.4),
  check: k => _s('M5 17 L12.5 24.5 L27 8', k, 3.4),
  dynamite: k => `<g transform="rotate(-20 16 16)">${_r(6, 9, 6, 19, k, 1) + _r(13, 9, 6, 19, k, 1) + _r(20, 9, 6, 19, k, 1)}</g>` + _s('M17 8 Q16 4 20 3', k, 1.4) + _c(21, 3, 1.8, k),
  candle: k => _r(12, 13, 8, 16, k, 1) + _p('M16 3 Q20 8 16 11 Q12 8 16 3Z', k) + _r(9, 27, 14, 2.5, k, 1),
  map: k => _p('M3 7 L11 4 L21 7 L29 4 V25 L21 28 L11 25 L3 28Z', k) + _s('M11 4 V25 M21 7 V28', 'rgba(0,0,0,0.4)', 1.2) + _s('M7 18 L13 14 L18 19 L25 12', 'rgba(0,0,0,0.6)', 1.6),
  satchel: k => _p('M5 12 Q5 8 9 8 H23 Q27 8 27 12 V25 Q27 28 24 28 H8 Q5 28 5 25Z', k) + _p('M5 12 Q16 20 27 12', 'none', ' stroke="rgba(0,0,0,0.5)" stroke-width="1.5"') + _r(14, 14, 4, 5, 'rgba(0,0,0,0.55)', 1) + _s('M11 8 Q11 3 16 3 Q21 3 21 8', k, 2),
  book: k => _p('M4 6 Q10 4 16 7 Q22 4 28 6 V26 Q22 24 16 27 Q10 24 4 26Z', k) + _s('M16 7 V27', 'rgba(0,0,0,0.5)', 1.3),
  gear: k => _c(16, 16, 8, k) + [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="14" y="2.5" width="4" height="6" rx="1" fill="${k}" transform="rotate(${a} 16 16)"/>`).join('') + _c(16, 16, 3.2, 'rgba(0,0,0,0.6)'),
  pad: k => _p('M7 10 H25 Q30 10 30.5 17 L31 24 Q31 28 27 27 L23 22 H9 L5 27 Q1 28 1 24 L1.5 17 Q2 10 7 10Z', k) + _c(24, 15, 1.6, 'rgba(0,0,0,0.6)') + _c(21, 18, 1.6, 'rgba(0,0,0,0.6)') + _s('M8 13 V19 M5 16 H11', 'rgba(0,0,0,0.6)', 1.8),
  cash: k => _r(3, 8, 26, 16, k, 2) + _c(16, 16, 4.5, 'rgba(0,0,0,0.45)') + _c(7, 12, 1.4, 'rgba(0,0,0,0.4)') + _c(25, 20, 1.4, 'rgba(0,0,0,0.4)'),
  pin: k => _p('M16 30 Q7 19 7 12 A9 9 0 0 1 25 12 Q25 19 16 30Z', k) + _c(16, 12, 3.5, 'rgba(0,0,0,0.6)'),
  lamp: k => _s('M11 7 Q16 1 21 7', k, 1.6) + _p('M10 9 L16 5.5 L22 9Z', k) + _r(10, 9, 12, 16, 'none', 2, ` stroke="${k}" stroke-width="2"`) + _e(16, 17.5, 2.6, 4, k) + _r(9, 25, 14, 3, k, 1),
  flask: k => _p('M13 4 h6 v6 l5 7 q2 3 0 6 q-2 4 -6 4 h-4 q-4 0 -6 -4 q-2 -3 0 -6 l5 -7z', k),
  heartp: k => GLYPHS.heart(k),
  ammo: k => [7, 14, 21].map(x => _p(`M${x} 27 V13 Q${x} 6 ${x + 2.5} 4 Q${x + 5} 6 ${x + 5} 13 V27Z`, k) + _r(x - 0.5, 23, 6, 4, 'rgba(0,0,0,0.35)')).join(''),
  dice: k => _r(4, 8, 18, 18, k, 3) + _c(9, 13, 1.8, 'rgba(0,0,0,0.65)') + _c(17, 21, 1.8, 'rgba(0,0,0,0.65)') + _c(13, 17, 1.8, 'rgba(0,0,0,0.65)') + `<g transform="rotate(20 22 12)">${_r(16, 4, 12, 12, k, 2.5)}</g>` + _c(22, 10, 1.4, 'rgba(0,0,0,0.65)'),
  trophy: k => _p('M9 4 H23 V11 Q23 19 16 20 Q9 19 9 11Z', k) + _s('M9 7 H4 Q4 14 10 15 M23 7 H28 Q28 14 22 15', k, 2) + _r(14.5, 20, 3, 5, k) + _r(10, 25, 12, 3.5, k, 1),
  skill: k => _p('M16 3 L20 12 L29 13 L22 19 L24 28 L16 23.5 L8 28 L10 19 L3 13 L12 12Z', 'none', ` stroke="${k}" stroke-width="2.2"`) + _c(16, 16, 3.5, k),
};

/* PlayStation tuş simgeleri */
const PS_SVG = {
  x: '<svg viewBox="0 0 24 24"><path d="M7 7 L17 17 M17 7 L7 17" stroke="#86a8ff" stroke-width="2.4" stroke-linecap="round"/></svg>',
  o: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.5" fill="none" stroke="#ff6e6e" stroke-width="2.3"/></svg>',
  sq: '<svg viewBox="0 0 24 24"><rect x="6.8" y="6.8" width="10.4" height="10.4" fill="none" stroke="#f08ad8" stroke-width="2.2"/></svg>',
  tri: '<svg viewBox="0 0 24 24"><path d="M12 5.8 L18.2 16.8 H5.8Z" fill="none" stroke="#62dca9" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 4 L18 11 H14.5 V19 H9.5 V11 H6Z" fill="#e8e8e8"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 20 L18 13 H14.5 V5 H9.5 V13 H6Z" fill="#e8e8e8"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M4 12 L11 6 V9.5 H19 V14.5 H11 V18Z" fill="#e8e8e8"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M20 12 L13 6 V9.5 H5 V14.5 H13 V18Z" fill="#e8e8e8"/></svg>',
  tp: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2.5" fill="none" stroke="#e8e8e8" stroke-width="1.8"/></svg>',
};

/* Emoji → glif eşlemesi (bildirim ve menü metinleri için) */
const EMOJI_GLYPH = {
  '🐴': 'horse', '🏇': 'horse', '⛺': 'tent', '🛏': 'bed', '📜': 'scroll', '♥': 'heart', '❤': 'heart', '✚': 'cross', '🔫': 'gun', '🚂': 'train', '🏠': 'house', '⛏': 'pick', '⚒': 'pick',
  '★': 'star', '⭐': 'star', '🍺': 'glass', '🥃': 'glass', '✦': 'waypoint', '🏦': 'bank', '←': 'back', '💰': 'bag', '✝': 'church', '✔': 'check', '☠': 'skull', '🏪': 'store', '🛒': 'cart',
  '❖': 'eye', '🍲': 'bowl', '🍖': 'meat', '🛁': 'tub', '💈': 'barber', '🚪': 'door', '🎵': 'note', '💾': 'quill', '⚓': 'anchor', '🦊': 'fox', '🤢': 'sick', '❄': 'snow', '☀': 'sun', '♨': 'steam',
  '🔥': 'fire', '🪰': 'flies', '👣': 'feet', '📍': 'pin', '🫗': 'drop', '💧': 'drop', '🧼': 'soap', '🃏': 'cards', '💪': 'fist', '👂': 'talk', '📰': 'newspaper', '⚖': 'scales', '🧽': 'brush',
  '💣': 'dynamite', '🙏': 'candle', '⏳': 'hourglass', '📦': 'chest', '💵': 'cash', '🏮': 'lamp', '🎮': 'pad', '🥩': 'cleaver', '👔': 'scissors', '🪓': 'axe', '🧙': 'hut', '🌾': 'wheat', '☄': 'crater',
  '🌲': 'tree', '🏛': 'ruins', '👻': 'ghost', '🦴': 'bones', '⚰': 'gallows', '🛞': 'wheel', '🗼': 'lighthouse', '🛖': 'hut', '⚔': 'swords', '🏰': 'fort', '🌀': 'windmill', '🌴': 'palm', '👁': 'eye',
  '🐻': 'paw', '🌉': 'arch', '✊': 'fist', '🎲': 'dice', '♠': 'cards', '🎭': 'mask',
};

const Icons = {
  cache: new Map(),
  svg(inner, vb = '0 0 32 32', cls = 'ic') { return `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${inner}</svg>`; },
  item(id, cls = 'ic') {
    const k = 'i:' + id + cls;
    if (this.cache.has(k)) return this.cache.get(k);
    const f = ITEM_ICON[id];
    const s = f ? this.svg(f(), '0 0 32 32', cls) : this.glyph('satchel', '#efe6d2', cls);
    this.cache.set(k, s);
    return s;
  },
  weapon(id, cls = 'ic wpn') {
    const k = 'w:' + id + cls;
    if (this.cache.has(k)) return this.cache.get(k);
    const f = WPN_ICON[id];
    const s = f ? (id === 'fists' || id === 'dynamite' ? this.svg(f(), '0 0 48 24', cls) : this.svg(f(), '0 0 48 24', cls)) : '';
    this.cache.set(k, s);
    return s;
  },
  glyph(name, color = 'currentColor', cls = 'ic g') {
    const f = GLYPHS[name];
    if (!f) return '';
    const k = 'g:' + name + color + cls;
    if (this.cache.has(k)) return this.cache.get(k);
    const s = this.svg(f(color), '0 0 32 32', cls);
    this.cache.set(k, s);
    return s;
  },
  /* Tuval için görsel (radar, harita) */
  imgCache: new Map(),
  img(name, color = '#efe6d2', size = 32) {
    const k = name + color + size;
    let im = this.imgCache.get(k);
    if (im) return im;
    const f = GLYPHS[name];
    if (!f) return null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${f(color)}</svg>`;
    im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    this.imgCache.set(k, im);
    return im;
  },
  /* Metindeki emojileri gliflere çevirir, eşlenmeyenleri kaldırır */
  iconize(str) {
    if (!str || typeof str !== 'string') return str;
    if (!this._re) {
      const keys = Object.keys(EMOJI_GLYPH).sort((x, y) => y.length - x.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      this._re = new RegExp('(' + keys.join('|') + '|\\p{Extended_Pictographic})\\uFE0F?', 'gu');
    }
    return str.replace(this._re, (m, ch) => {
      const g = EMOJI_GLYPH[ch];
      return g ? this.glyph(g, 'currentColor', 'ic g inl') : '';
    });
  },
};
