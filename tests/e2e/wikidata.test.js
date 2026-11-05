'use strict';
/* Çevrimiçi rehberin (wiki) oyun verisi: tools/wiki-export.js oyunun tablolarından eksiksiz ve tutarlı veri üretir;
   frontiersend deposu oyunun yanında klonluysa wiki'deki kopya güncel olmalıdır (oyunda bir değer değişince
   "node tools/wiki-export.js" çalıştırılıp wiki deposuna gönderilir). */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const TOOL = path.join(ROOT, 'tools', 'wiki-export.js');
const WIKI = path.join(ROOT, '..', 'frontiersend', 'assets', 'data', 'game.js');

module.exports = {
  name: 'Wiki verisi',
  async run(t) {
    await t.step('dışa aktarma oyunun bütün tablolarını İngilizce adlarıyla, tutarlı üretir', async () => {
      const { build } = require(TOOL);
      const { data } = build();
      t.eq(Object.keys(data.items).length, Object.keys(require('vm').runInNewContext('ITEMS', loadData())).length, 'bütün eşyalar');
      t.ok(Object.keys(data.weapons).length >= 9 && !data.weapons.fists, 'silahlar (yumruk hariç)');
      t.ok(data.towns.length === 13 && data.landmarks.length >= 20, 'kasabalar ve önemli yerler');
      t.ok(!data.achievements.some(a => /^story/.test(a.id)), 'hikâye başarımları aktarılmaz');
      const noEn = [];
      const walk = (o) => { if (o && typeof o === 'object') { if (o.tr !== undefined && !o.en) noEn.push(o.tr); Object.values(o).forEach(walk); } };
      walk(data);
      t.eq(noEn, [], 'her adın İngilizcesi var');
      t.ok(Object.values(data.items).every(i => !('d' in i)) && data.towns.every(x => !('desc' in x)) && data.landmarks.every(x => !('desc' in x)), 'oyunun düzyazı açıklamaları aktarılmaz (wiki kendi cümlelerini kurar)');
      t.eq(data.d.hourSec, Math.round(60 / data.c.MIN_PER_SEC), 'hesaplanan değerler');
      t.ok(data.landmarks.find(l => l.id === 'crater').chest.includes('meteorite'), 'önemli yerlerin sandıkları oyunun tablosundan');
      t.ok(data.gather.includes('ginseng') && data.ore.includes('silver_ore'), 'doğada toplananlar ve cevher kayası');
      t.ok(data.backgrounds.outlaw.bounty > 0 && data.props.ranch.income > 0, 'başlangıç geçmişleri ve mülkler');
    });
    await t.step('wiki kopyası güncel (frontiersend oyunun yanındaysa)', async () => {
      if (!fs.existsSync(WIKI)) { t.ok(true, 'frontiersend klonu yok: atlandı'); return; }
      let out = '', ok = true;
      try { out = execFileSync(process.execPath, [TOOL, '--check', WIKI], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { ok = false; out = String(e.stderr || e.stdout || e.message); }
      t.ok(ok, 'wiki verisi oyunla aynı olmalı: ' + out.trim());
    });
  },
};

/* data.js'i yalnızca eşya sayısını karşılaştırmak için ayrı bir bağlamda çalıştırır */
function loadData() {
  const vm = require('vm');
  const Tr = (s, ...v) => Array.isArray(s) ? s.reduce((a, p, i) => a + p + (i < v.length ? v[i] : ''), '') : s;
  const ctx = { Tr, console, Math, JSON, Object, Array, Set, Map, String, Number };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8') + '\n;globalThis.ITEMS = ITEMS;', ctx);
  return ctx;
}
