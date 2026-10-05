#!/usr/bin/env node
'use strict';
/* ==========================================================
   Steam görsellerini dosyalara yazar (tools/steam-assets.html'i başsız tarayıcıda açar):
     steam/achievement-icons/ACH_*.jpg      başarım simgeleri (kazanılmış + kilitli, 64×64)
     steam/icons/community_icon.jpg         topluluk simgesi (184×184)
     steam/icons/client_icon.ico            istemci simgesi (16–256, PNG gömülü ICO)
   Kaynak çizim: build/icon.png. Playwright depo kökünden (npm install) ya da genel kurulumdan yüklenir.
   ========================================================== */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..', '..'), DESK = path.join(__dirname, '..');
const { loadPlaywright } = require(path.join(ROOT, 'tests', 'lib'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

/* PNG'leri tek bir .ico dosyasında birleştir (Windows Vista+ ve Steam PNG gömülü ICO okur) */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(off, o + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.buf)]);
}

(async () => {
  // file:// altında tuval "kirlenir" (toDataURL çalışmaz); küçük bir yerel sunucudan aç
  const srv = http.createServer((req, res) => {
    const f = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await loadPlaywright().chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => { throw e; });
    await page.goto(`http://127.0.0.1:${srv.address().port}/desktop/tools/steam-assets.html`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    const files = await page.evaluate(() => exportAll());
    const ACH = path.join(DESK, 'steam', 'achievement-icons'), ICO = path.join(DESK, 'steam', 'icons');
    fs.rmSync(ACH, { recursive: true, force: true }); fs.mkdirSync(ACH, { recursive: true }); fs.mkdirSync(ICO, { recursive: true });
    const bin = (f) => Buffer.from(f.data.split(',')[1], 'base64');
    const client = [];
    let nAch = 0;
    for (const f of files) {
      if (f.name.startsWith('ACH_')) { fs.writeFileSync(path.join(ACH, f.name), bin(f)); nAch++; }
      else if (f.name.startsWith('client_icon_')) client.push({ size: +f.name.match(/\d+/)[0], buf: bin(f) });
      else fs.writeFileSync(path.join(ICO, f.name), bin(f));
    }
    client.sort((a, b) => a.size - b.size);
    fs.writeFileSync(path.join(ICO, 'client_icon.ico'), ico(client));
    console.log(`${nAch} başarım simgesi → steam/achievement-icons/; topluluk ve istemci simgeleri → steam/icons/`);
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });
