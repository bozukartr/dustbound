'use strict';
/* ==========================================================
   FRONTIER'S END — masaüstü: ekran kartı seçimi

   Oyuncu Ayarlar → Görüntü → Ekran Kartı'ndan güçlü (harici) ya da
   tasarruflu (tümleşik) kartı seçer. Tercih desktop.json'a yazılır ve
   bir sonraki açılışta Chromium'a verilir: GPU süreci açıldıktan sonra
   kart değiştirilemez, bu yüzden seçim yeniden başlatınca geçerli olur.

     auto, high → force_high_performance_gpu (Windows/macOS: harici kart)
     low        → force_low_power_gpu
     Linux      → Chromium anahtarı kart seçmez; iki kartlı dizüstünde
                  PRIME değişkenleri verilir (Mesa: DRI_PRIME=1,
                  NVIDIA: render offload). Bu deneme WebGL'i açamazsa
                  (yazılım çizimine düşülürse) bir sonraki açılışta
                  değişkenler kullanılmaz (envBad).
   ========================================================== */
const fs = require('fs'), path = require('path');

const PREFS = ['auto', 'high', 'low'];
const prefOf = (v) => (PREFS.includes(v) ? v : 'auto');
const NVIDIA = 0x10de;

/* Linux: /sys/class/drm/cardN/device altındaki PCI kartları. Chromium libpci olmadan yalnızca etkin kartı
   görür; boot_vga açılış ekranını süren karttır (dizüstünde tümleşik kart). */
function linuxCards(root = '/sys/class/drm') {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(root).filter(n => /^card\d+$/.test(n)).sort(); } catch (e) { return out; }
  for (const n of names) {
    const dir = path.join(root, n, 'device');
    const rd = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8').trim(); } catch (e) { return ''; } };
    const vendorId = parseInt(rd('vendor'), 16), deviceId = parseInt(rd('device'), 16);
    if (!vendorId) continue;
    // aynı PCI aygıtına giden ikinci düğüm sayılmaz (device bağlantısının gerçek yolu: /sys/devices/pci…/0000:01:00.0)
    let slot = dir; try { slot = fs.realpathSync(dir); } catch (e) {}
    if (out.some(c => c.slot === slot)) continue;
    out.push({ vendorId, deviceId: deviceId || 0, bootVga: rd('boot_vga') === '1', slot });
  }
  return out;
}
const nvidiaDriver = () => { try { return fs.existsSync('/proc/driver/nvidia/version'); } catch (e) { return false; } };

/* Açılışta uygulanacak Chromium anahtarları ve ortam değişkenleri */
function launchPlan(pref, platform, o = {}) {
  pref = prefOf(pref);
  const switches = [pref === 'low' ? 'force_low_power_gpu' : 'force_high_performance_gpu'], env = {};
  if (platform === 'linux' && pref !== 'low' && !o.envBad) {
    const cards = o.cards || [], boot = cards.find(c => c.bootVga), other = cards.find(c => !c.bootVga);
    // açılış kartı zaten NVIDIA ise (masaüstü) değişecek bir şey yok
    if (cards.length >= 2 && boot && other && boot.vendorId !== NVIDIA) {
      if (other.vendorId === NVIDIA) { if (o.nvidiaDriver) Object.assign(env, { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' }); }
      else env.DRI_PRIME = '1';
    }
  }
  return { pref, switches, env };
}

/* app.getGPUInfo('complete') → oyuna gidecek sade liste. Linux'ta Chromium'un görmediği kartlar sysfs'ten eklenir. */
function summarize(info, cards = []) {
  const aux = (info && info.auxAttributes) || {};
  const devices = ((info && info.gpuDevice) || []).filter(d => d && d.vendorId).map(d => ({
    vendorId: d.vendorId, deviceId: d.deviceId || 0, name: String(d.deviceString || '').trim(), active: !!d.active, pref: d.gpuPreference | 0,
  }));
  for (const c of cards) {
    // Chromium aygıt kimliğini bilmeyebilir (0): aynı üreticinin kimliksiz kaydı aynı karttır
    const d = devices.find(x => x.vendorId === c.vendorId && x.deviceId === c.deviceId) || devices.find(x => x.vendorId === c.vendorId && !x.deviceId && x.boot === undefined);
    if (d) { d.boot = c.bootVga; if (!d.deviceId) d.deviceId = c.deviceId; }
    else devices.push({ vendorId: c.vendorId, deviceId: c.deviceId, name: '', active: false, pref: 0, boot: c.bootVga });
  }
  return { devices, renderer: String(aux.glRenderer || ''), optimus: !!aux.optimus, amdSwitchable: !!aux.amdSwitchable };
}

module.exports = { PREFS, prefOf, linuxCards, nvidiaDriver, launchPlan, summarize };
