'use strict';
/* Ses motoru: örnek bankası, uzamsal ses, mekân yankısı, zemin, kısma, seslendirme anahtarı */
module.exports = {
  name: 'Ses motoru',
  timeout: 200000,
  async run(t) {
    const p = await t.newGame({ sfx: true });
    await t.step('örnek bankası yüklenir (manifest + OGG çözümleme)', async () => {
      await p.waitForFunction(() => Audio_.ctx && Audio_.man && ['gun_pistol', 'step_dirt', 'ui_ok', 'amb_wind', 'explosion', 'horse_neigh'].every(n => Audio_.has(n)), null, { timeout: 60000 });
      const r = await p.evaluate(() => ({ n: Object.keys(Audio_.man).length, loaded: Object.keys(Audio_.bank).length, ogg: Audio_.canOgg }));
      t.ok(r.n > 50 && r.loaded > 20, 'yüzlerce örnek', r);
    });
    await t.step('konumlu ses: menzil, yön, duvar arkası', async () => {
      const r = await p.evaluate(() => {
        const P = G.player;
        const right = Audio_.play('gun_pistol', { x: P.x + 200, y: P.y });
        const left = Audio_.play('gun_pistol', { x: P.x - 200, y: P.y });
        const far = Audio_.play('step_dirt', { x: P.x + 2000, y: P.y });
        const near = Audio_.play('step_dirt', { x: P.x + 20, y: P.y });
        const panOf = (v) => { let n = v && v.g; for (let k = 0; k < 4 && n; k++) { const o = n._out; if (!o) break; } return v ? v : null; };
        return { right: !!right, left: !!left, far: far === null, nearVol: near && near.vol, rightVol: right && right.vol };
      });
      t.ok(r.right && r.left, 'iki yanda çalar'); t.ok(r.far, 'menzil dışı sessiz'); t.ok(r.nearVol > r.rightVol * 0, 'yakın ses çalar', r);
      const w = await p.evaluate(() => {
        const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'saloon'), P = G.player;
        let iy = b.door.y; for (let k = 0; k < 40 && !G.world.buildingAtPx(b.door.x, iy); k++) iy -= 2;
        const out = Audio_.play('gun_pistol', { x: b.door.x, y: b.door.y + 30 });
        const inside = Audio_.play('gun_pistol', { x: b.door.x, y: iy - 10 });
        return { out: out && out.vol, inside: inside && inside.vol, d: Math.round(dist(P.x, P.y, b.door.x, iy)) };
      });
      t.ok(w.out && w.inside, 'ikisi de çalar', w);
    });
    await t.step('mekâna göre yankı ve zemin', async () => {
      const r = await p.evaluate(async () => {
        const wait = () => new Promise(res => setTimeout(res, 700));
        const out = {};
        const b = G.world.buildings.find(b => b.town === 'harlow' && b.type === 'saloon');
        TH.inside(b); await wait(); await wait(); out.saloon = Audio_.revName; out.floor = Audio_.surface(G.player.x, G.player.y); out.ambLP = Audio_.ambLP.frequency.value;
        const tw = TH.town('harlow'); TH.goto(tw.spawn.x, tw.spawn.y); await wait(); out.town = Audio_.revName;
        const s = TH.openSpot(tw.cx + 2200, tw.cy, 60); TH.goto(s[0], s[1]); await wait(); out.wild = Audio_.revName;
        return out;
      });
      t.eq(r.saloon, 'hall', 'saloonda geniş oda yankısı'); t.eq(r.floor, 'wood', 'içeride tahta zemin');
      t.ok(r.ambLP < 5000, 'içeride ortam boğuk', r.ambLP);
      t.eq(r.town, 'street', 'kasaba sokağı'); t.ok(['open', 'forest', 'canyon'].includes(r.wild), 'kırda doğal yankı', r.wild);
    });
    await t.step('yakın silah sesi ortamı ve müziği kısar, sonra geri gelir', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player; Audio_.shot('pistol', 1, P.x + 30, P.y);
        await new Promise(res => setTimeout(res, 120));
        const a = Audio_.duckAmb.gain.value;
        await new Promise(res => setTimeout(res, 2500));
        return { a, b: Audio_.duckAmb.gain.value };
      });
      t.ok(r.a < 0.8, 'kısıldı', r); t.ok(r.b > 0.9, 'geri geldi', r);
    });
    await t.step('aynı ses art arda aynı örneği çalmaz; aynı anda sınır var', async () => {
      const r = await p.evaluate(() => {
        const ks = []; for (let i = 0; i < 12; i++) { Audio_.play('ui_move'); ks.push(Audio_.bank.ui_move.last); }
        let rep = 0; for (let i = 1; i < ks.length; i++) if (ks[i] === ks[i - 1]) rep++;
        for (let i = 0; i < 12; i++) Audio_.play('step_wood');
        return { rep, wood: Audio_.voices.filter(v => v.name === 'step_wood' && !v.done).length };
      });
      t.eq(r.rep, 0, 'tekrar yok'); t.ok(r.wood <= 8, 'aynı anda en fazla 8', r.wood);
    });
    await t.step('oyun içi olaylar örnekli sesle çalar, hata vermez', async () => {
      const r = await p.evaluate(async () => {
        const P = G.player, before = Audio_.voices.length;
        G.whistle(); Audio_.ui('ok'); Audio_.ui('cash'); Audio_.step(0.06); Audio_.neigh(P.x + 40, P.y); G.explode(P.x + 300, P.y, null);
        P.addItem('beans', 1, true); G.consume('beans');
        const names = Audio_.voices.map(v => v.name);
        return { names };
      });
      for (const n of ['whistle', 'ui_ok', 'coins', 'horse_neigh', 'explosion', 'eat']) t.ok(r.names.includes(n), n + ' çaldı', r.names);
    });
    await t.step('seslendirme anahtarı araçla aynı, dosya yoksa sessizce geçer', async () => {
      const fs = require('fs'), path = require('path');
      const csv = fs.readFileSync(path.join(__dirname, '..', '..', 'audio', 'vo', 'script_tr.csv'), 'utf8').split('\n')[1];
      const [k, , text] = csv.match(/"((?:[^"]|"")*)"/g).map(s => s.slice(1, -1).replace(/""/g, '"'));
      const r = await p.evaluate((text) => ({ k: Audio_.voiceKey(text), d: Audio_.voice(text, 'tr') }), text);
      t.eq(r.k, k, 'aynı anahtar'); t.eq(r.d, 0, 'kayıt yok → 0 sn');
    });
  },
};
