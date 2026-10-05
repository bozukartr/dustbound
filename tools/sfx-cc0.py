#!/usr/bin/env python3
"""FRONTIER'S END — CC0 ses efektleri
   audio/sfx/ altındaki ses dosyalarını CC0 (kamu malı) kaynaklardan yeniden üretir:
     - Freesound: yalnızca CC0 filtresiyle aranır; her sesin lisansı kendi sayfasından ayrıca
       doğrulanır (CC0 değilse betik durur). Herkese açık yüksek kaliteli önizleme indirilir.
     - Kenney (kenney.nl): bütün paketler CC0.
   Her ses kırpılır, gerekirse tekil darbelere bölünür (adım, toynak), döngüler dikişsiz
   bağlanır, çeşitler aynı algılanan yükseklikte eşitlenir ve mono ogg'a çevrilir.
   audio/sfx/KAYNAKLAR.md: her dosyanın kaynağı, yazarı ve lisansı.

     pip install numpy scipy imageio-ffmpeg
     python3 tools/sfx-cc0.py              # hepsi (önbellek: .sfx-cache/)
     python3 tools/sfx-cc0.py gun_pistol   # yalnızca bir ses
     python3 tools/sfx-cc0.py search "horse neigh" 4   # CC0 aday ara (en çok 4 sn)
   Sonra: node tools/sfx-manifest.js
   Ses düzeyleri tools/sfx-manifest.js (vol) ve js/audio.js (LOOPGAIN) içinde ayarlanır. """
import os, sys, json, glob, subprocess, re, html, urllib.parse
import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.sfx-cache')
OUT = os.path.join(ROOT, 'audio', 'sfx')
SR = 44100
FF = subprocess.run([sys.executable, '-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())'], capture_output=True, text=True).stdout.strip() or 'ffmpeg'
K = os.path.join(CACHE, 'kenney')
KENNEY = ['impact-sounds', 'rpg-audio', 'interface-sounds', 'ui-audio', 'casino-audio']

# ---------------- Freesound (CC0) ----------------
import sys, re, json, urllib.parse, subprocess, os, html
def fetch(url):
    r = subprocess.run(['curl', '-sL', '-m', '40', url], capture_output=True)
    return r.stdout.decode('utf8', 'replace')
def search(q, maxdur=None, mindur=None, page=1):
    f = 'license:"Creative Commons 0"'
    if maxdur or mindur: f += f' duration:[{mindur or 0} TO {maxdur or 9999}]'
    url = 'https://freesound.org/search/?' + urllib.parse.urlencode({'q': q, 'f': f, 'page': page})
    s = fetch(url)
    out = []
    for blk in s.split('class="bw-search__result"')[1:]:
        g = lambda k: (re.search(k + r'="([^"]*)"', blk) or [None, None])[1]
        rating = re.search(r'Average rating of ([\d.]+)', blk)
        nr = re.search(r'\((\d+) ratings?\)', blk)
        out.append({'id': g('data-sound-id'), 'user': g('data-username'), 'title': html.unescape(g('data-title') or ''),
                    'dur': round(float(g('data-duration') or 0), 2), 'dl': int(g('data-num-downloads') or 0),
                    'rating': float(rating.group(1)) if rating else 0, 'sr': g('data-samplerate'),
                    'mp3': (g('data-mp3') or '').replace('-lq.mp3', '-hq.mp3'), 'wave': g('data-waveform'), 'spec': g('data-spectrum')})
    return out
def get(sid, user=None, dest=None):
    page = fetch(f'https://freesound.org/s/{sid}/')
    um = re.search(r'href="/people/([^/"]+)/sounds/' + sid + r'/"', page) or re.search(r'data-username="([^"]+)"', page)
    user = um.group(1) if um else (user or '?')
    lic = re.search(r'creativecommons\.org/(publicdomain/zero|licenses/[a-z-]+)/[\d.]+', page)
    lic = lic.group(0) if lic else 'BİLİNMİYOR'
    if 'publicdomain/zero' not in lic: return {'id': sid, 'license': lic, 'ok': False}
    m = re.search(r'https://cdn\.freesound\.org/previews/\d+/' + sid + r'_\d+-hq\.mp3', page)
    url = m.group(0) if m else None
    if not url:
        m = re.search(r'https://cdn\.freesound\.org/previews/\d+/' + sid + r'_\d+-lq\.mp3', page); url = m and m.group(0).replace('-lq', '-hq')
    title = re.search(r'<title>([^<]*)</title>', page)
    dest = dest or os.path.join(CACHE, 'fs', f'{sid}.mp3')
    subprocess.run(['curl', '-sL', '-m', '60', url, '-o', dest])
    return {'id': sid, 'user': user, 'license': lic, 'ok': True, 'url': f'https://freesound.org/people/{user}/sounds/{sid}/', 'file': dest, 'title': html.unescape(title.group(1).strip()) if title else ''}

def kenney(pack):
    """Kenney paketini (CC0) bir kez indir ve aç"""
    d = os.path.join(K, pack)
    if os.path.isdir(d): return
    os.makedirs(K, exist_ok=True)
    page = fetch('https://kenney.nl/assets/' + pack)
    m = re.search(r'https://kenney\.nl/media/pages/assets/' + pack + r'/[^\'"]+\.zip', page)
    if not m or 'CC0' not in page: raise SystemExit('Kenney paketi bulunamadı ya da CC0 değil: ' + pack)
    z = os.path.join(K, pack + '.zip')
    subprocess.run(['curl', '-sL', '-m', '180', m.group(0), '-o', z], check=True)
    subprocess.run(['unzip', '-qo', z, '-d', d], check=True)

META = {}          # kaynak anahtarı -> {title, user, url, license}
CREDITS = []       # (çıktı dosyası, kaynak anahtarları)

def load(path):
    r = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)

def src(key):
    """'fs:123' ya da 'k:paket/desen' -> [(anahtar, dizi)]"""
    if key.startswith('fs:'):
        sid = key[3:]
        os.makedirs(os.path.join(CACHE, 'fs'), exist_ok=True)
        f = os.path.join(CACHE, 'fs', sid + '.mp3')
        mf = os.path.join(CACHE, 'fs', sid + '.json')
        if not os.path.exists(mf):
            r = get(sid)
            if not r.get('ok'): raise SystemExit(f'LİSANS CC0 DEĞİL: {sid} {r}')
            json.dump(r, open(mf, 'w'), ensure_ascii=False)
        m = json.load(open(mf))
        META[key] = {'title': re.sub(r'^Freesound - ', '', m['title']), 'url': m['url'], 'user': m['user'], 'license': 'CC0 1.0'}
        return [(key, load(f))]
    if key.startswith('k:'):
        pack, pat = key[2:].split('/', 1)
        kenney(pack)
        files = sorted(glob.glob(os.path.join(K, pack, '**', pat), recursive=True))
        if not files: raise SystemExit('Kenney dosyası yok: ' + key)
        out = []
        for f in files:
            kk = 'k:' + pack + '/' + os.path.basename(f)
            META[kk] = {'title': os.path.basename(f), 'url': 'https://kenney.nl/assets/' + pack, 'user': 'Kenney', 'license': 'CC0 1.0'}
            out.append((kk, load(f)))
        return out
    raise ValueError(key)

# ---------------- işlemler ----------
def db(x): return 20 * np.log10(max(x, 1e-12))
def envelope(x, ms=5):
    n = max(1, int(SR * ms / 1000)); return np.convolve(np.abs(x), np.ones(n) / n, mode='same')
def trim(x, head_db=-40, tail_db=-55, pre=0.004, fade=0.03):
    if not len(x): return x
    e = envelope(x, 3); pk = e.max()
    on = np.where(e > pk * 10 ** (head_db / 20))[0]
    if not len(on): return x
    a = max(0, on[0] - int(pre * SR))
    tl = np.where(e > pk * 10 ** (tail_db / 20))[0]
    b = min(len(x), tl[-1] + int(0.02 * SR))
    y = x[a:b].copy()
    nf = min(len(y) // 3, int(fade * SR))
    if nf > 0: y[-nf:] *= np.linspace(1, 0, nf) ** 2
    ni = min(len(y) // 10, int(0.002 * SR))
    if ni > 0: y[:ni] *= np.linspace(0, 1, ni)
    return y
def onsets(x, min_gap=0.12, rel_db=-18):
    e = envelope(x, 4)
    d = np.diff(e, prepend=0)
    pk = e.max(); idx = []
    thr = pk * 10 ** (rel_db / 20)
    gap = int(min_gap * SR); last = -gap
    above = e > thr
    for i in range(1, len(e)):
        if above[i] and not above[i - 1] and i - last >= gap:
            idx.append(i); last = i
    return idx
def slices(x, n=None, length=0.25, min_gap=0.12, rel_db=-18, fade=0.04):
    """tekil darbeleri ayır (adım, toynak, çoklu atış dosyası)"""
    out = []
    ons = onsets(x, min_gap, rel_db)
    for i, o in enumerate(ons):
        a = max(0, o - int(0.006 * SR)); b = min(len(x), a + int(length * SR))
        if i + 1 < len(ons): b = min(b, ons[i + 1] - int(0.004 * SR))
        y = x[a:b].copy()
        if len(y) < int(0.05 * SR): continue
        nf = min(len(y) // 2, int(fade * SR)); y[-nf:] *= np.linspace(1, 0, nf) ** 2
        out.append(y)
    # en güçlü ve birbirine benzeyen darbeler
    out.sort(key=lambda y: -np.sqrt(np.mean(y ** 2)))
    if n: out = out[:n]
    return out
def first_event(x, maxlen, rel_db=-5, min_gap=0.45):
    """dosyada birden çok atış varsa yalnızca ilki (kuyruğuyla)"""
    x = trim(x)
    ons = onsets(x, min_gap, rel_db)
    end = len(x)
    if len(ons) > 1: end = ons[1] - int(0.01 * SR)
    y = x[:min(end, int(maxlen * SR))].copy()
    nf = min(len(y) // 3, int(0.08 * SR)); y[-nf:] *= np.linspace(1, 0, nf) ** 2
    return y
def pitch(x, r):
    """perde (ve süre) oranı: r>1 tiz"""
    if abs(r - 1) < 1e-3: return x
    n = int(len(x) / r)
    return signal.resample(x, n)
def filt(x, kind, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), btype=kind); return signal.lfilter(b, a, x)
def loop(x, length, xf=1.5, start=1.0):
    """döngü: [start, start+length] arası; sonu başına eşit güçte örtüşerek bağlanır"""
    a = int(start * SR); L = int(length * SR); X = int(xf * SR)
    if a + L + X > len(x): a = max(0, len(x) - L - X)
    seg = x[a:a + L + X].copy()
    body, tail = seg[:L].copy(), seg[L:L + X]
    t = np.linspace(0, np.pi / 2, len(tail))
    body[:len(tail)] = body[:len(tail)] * np.sin(t) + tail * np.cos(t)
    return body
def norm_peak(x, peak_db):
    m = np.abs(x).max(); return x / m * 10 ** (peak_db / 20) if m > 0 else x
def norm_rms(x, rms_db=-20, ceil=-3):
    r = np.sqrt(np.mean(x ** 2)); y = x / r * 10 ** (rms_db / 20)
    m = np.abs(y).max(); lim = 10 ** (ceil / 20)
    if m > lim: y = np.tanh(y / lim) * lim
    return y
def dc(x): return filt(x, 'high', 25, 2)
def loud(x, win=0.1):
    W = int(win * SR)
    if len(x) <= W: return np.sqrt(np.mean(x ** 2))
    c = np.cumsum(np.concatenate([[0], x ** 2]))
    return np.sqrt(((c[W:] - c[:-W]) / W).max())
def norm_group(ys, target_db, ceil_db=-3.0):
    """çeşitler aynı algılanan yükseklikte (en yüksek 100 ms RMS); tepe tavanı aşılırsa yumuşak sınır"""
    out = []
    lim = 10 ** (ceil_db / 20)
    for y in ys:
        y = dc(y); y = y / max(loud(y), 1e-9) * 10 ** (target_db / 20)
        m = np.abs(y).max()
        # tavan: hafif aşımda yumuşak sınır (tanh asla tavanı geçmez), çok aşımda önce kıs
        if m > lim * 2: y = y / m * lim * 2
        if np.abs(y).max() > lim * 0.7:
            k = lim * 0.7; a = np.abs(y); over = a > k
            y[over] = np.sign(y[over]) * (k + (lim - k) * np.tanh((a[over] - k) / (lim - k)))
        out.append(y)
    return out

def write(name, k, y, keys, quality=4):
    os.makedirs(OUT, exist_ok=True)
    fn = f'{name}_{k:02d}.ogg'
    p = subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', str(quality), os.path.join(OUT, fn)],
                       input=y.astype(np.float32).tobytes())
    if p.returncode: raise SystemExit('ffmpeg hata ' + fn)
    CREDITS.append((fn, keys))

# ---------- tarif ----------
LV = {  # tepe seviyeleri (dBFS) — eski ses tasarımıyla aynı (manifestteki vol ayarları buna göre)
    'gun_': -0.8, 'gun_bow': -3, 'reload_pistol': -6, 'reload_repeater': -5, 'reload_shotgun': -5, 'explosion': -0.5, 'ricochet': -6,
    'hit_flesh': -6, 'hit_dirt': -7, 'hit_wood': -6, 'step_': -3, 'hoof_': -3, 'horse_neigh': -3, 'wolf_howl': -5, 'coyote_howl': -5,
    'growl': -3, 'growl_bear': -3, 'cougar': -4, 'bird': -9, 'owl': -8, 'hawk': -9, 'thunder': -2, 'train_whistle': -6, 'punch': -2,
    'thud': -3, 'door_open': -4, 'saloon_door': -4, 'coins': -6, 'drink': -6, 'eat': -7, 'lasso': -6, 'rope': -6, 'skin': -6,
    'whistle': -4, 'ui_move': -14, 'ui_ok': -10, 'ui_back': -12, 'ui_error': -10, 'ui_pick': -12, 'chime': -6, 'discover': -7,
}
TL = {  # hedef algılanan yükseklik (en yüksek 100 ms RMS, dBFS)
    'gun_': -10, 'gun_bow': -18, 'reload_': -22, 'explosion': -9, 'ricochet': -20, 'hit_': -18, 'punch': -14, 'thud': -15,
    'step_': -20, 'hoof_': -18, 'horse_neigh': -16, 'whistle': -16, 'growl': -16, 'growl_bear': -16, 'cougar': -16,
    'wolf_howl': -18, 'coyote_howl': -18, 'bird': -24, 'owl': -22, 'hawk': -24, 'thunder': -16, 'train_whistle': -18,
    'door_open': -20, 'saloon_door': -20, 'coins': -22, 'drink': -22, 'eat': -22, 'lasso': -20, 'rope': -24, 'skin': -20,
    'ui_': -26, 'ui_move': -30, 'chime': -20, 'discover': -20,
}
def target(name):
    if name in TL: return TL[name]
    for k, v in TL.items():
        if k.endswith('_') and name.startswith(k): return v
    return -20
def level(name):
    if name in LV: return LV[name]
    for k, v in LV.items():
        if k.endswith('_') and name.startswith(k): return v
    return -6

def one(name, keys, prep=lambda x: trim(x), maxn=None):
    """her kaynak dosyadan bir çeşit"""
    got = []
    for key in keys:
        for kk, x in src(key):
            y = prep(x)
            if y is None or not len(y): continue
            got.append((kk, y))
    if maxn: got = got[:maxn]
    for k, ((kk, _), y) in enumerate(zip(got, norm_group([y for _, y in got], target(name))), 1): write(name, k, y, [kk])
def hits(name, keys, n_each=4, length=0.25, prep=lambda x: x, post=lambda y: y, total=8, rel_db=-18, min_gap=0.12):
    """kaynaklardan tekil darbeleri ayır"""
    pool = []
    for key in keys:
        for kk, x in src(key):
            for y in slices(prep(x), n_each, length, min_gap, rel_db): pool.append((kk, post(y)))
    pool = pool[:total]
    for k, ((kk, _), y) in enumerate(zip(pool, norm_group([y for _, y in pool], target(name))), 1): write(name, k, y, [kk])
def amb(name, key, length=20, start=1.0, prep=lambda x: x, rms=-20, ceil=-3):
    for kk, x in src(key):
        y = loop(prep(x), length, 1.5, start)
        write(name, 1, dc(norm_rms(y, rms, ceil)), [kk], quality=3)
        return

def build(only=None):
    T = lambda nm: only is None or nm in only
    gun = lambda ml: (lambda x: first_event(x, ml))
    # silahlar
    if T('gun_pistol'): one('gun_pistol', ['fs:683186', 'fs:683175', 'fs:392229', 'fs:645316'], gun(1.3))
    if T('gun_repeater'): one('gun_repeater', ['fs:49513', 'fs:46655'], gun(1.6))
    if T('gun_rifle'): one('gun_rifle', ['fs:450853', 'fs:411567', 'fs:484036'], gun(1.9))
    if T('gun_shotgun'): one('gun_shotgun', ['fs:473846', 'fs:405504', 'fs:660299'], gun(1.6))
    if T('gun_bow'): one('gun_bow', ['fs:394179', 'fs:536068'], lambda x: trim(x)[:int(0.6 * SR)])
    if T('reload_pistol'): one('reload_pistol', ['fs:177863', 'fs:722902'], lambda x: trim(x)[:int(2.4 * SR)])
    if T('reload_repeater'): one('reload_repeater', ['fs:523402', 'fs:523401'], lambda x: trim(x))
    if T('reload_shotgun'): one('reload_shotgun', ['fs:200966', 'fs:266105'], lambda x: trim(x)[:int(1.8 * SR)])
    if T('explosion'): one('explosion', ['fs:609587', 'fs:516914', 'fs:398283'], lambda x: trim(x)[:int(4.5 * SR)])
    if T('ricochet'): one('ricochet', ['fs:392975', 'fs:148840'], lambda x: trim(x)[:int(1.2 * SR)])
    # isabet ve dövüş
    if T('hit_flesh'): one('hit_flesh', ['fs:511194', 'fs:528263', 'k:impact-sounds/impactPunch_medium_00[01].ogg'], lambda x: trim(x)[:int(0.6 * SR)])
    if T('hit_dirt'): one('hit_dirt', ['fs:789388', 'k:impact-sounds/impactSoft_medium_00[012].ogg'], lambda x: trim(x)[:int(0.6 * SR)])
    if T('hit_wood'): one('hit_wood', ['k:impact-sounds/impactWood_medium_00[012].ogg', 'k:impact-sounds/impactPlank_medium_000.ogg'])
    if T('punch'): one('punch', ['k:impact-sounds/impactPunch_heavy_00[0-3].ogg'])
    if T('thud'): one('thud', ['k:impact-sounds/impactSoft_heavy_00[0-2].ogg'])
    # ayak sesleri
    if T('step_grass'): one('step_grass', ['k:impact-sounds/footstep_grass_00[0-4].ogg'])
    if T('step_snow'): one('step_snow', ['k:impact-sounds/footstep_snow_00[0-4].ogg'])
    if T('step_wood'): one('step_wood', ['k:impact-sounds/footstep_wood_00[0-4].ogg'])
    if T('step_stone'): one('step_stone', ['k:impact-sounds/footstep_concrete_00[0-4].ogg'])
    if T('step_dirt'): hits('step_dirt', ['fs:353799'], n_each=6, length=0.3, total=6)
    if T('step_mud'): hits('step_mud', ['fs:488069', 'fs:488068'], n_each=3, length=0.4, total=6)
    if T('step_sand'): hits('step_sand', ['fs:725875'], n_each=6, length=0.35, total=6)
    if T('step_water'): hits('step_water', ['fs:861369'], n_each=6, length=0.45, total=6, min_gap=0.2)
    # toynaklar
    if T('hoof_dirt'): hits('hoof_dirt', ['fs:175356', 'fs:581833'], n_each=4, length=0.22, total=8)
    if T('hoof_stone'): hits('hoof_stone', ['fs:479689'], n_each=8, length=0.22, total=8)
    if T('hoof_grass'): hits('hoof_grass', ['fs:564626'], n_each=8, length=0.22, total=8, post=lambda y: filt(y, 'low', 3500))
    if T('hoof_wood'): hits('hoof_wood', ['k:impact-sounds/impactWood_heavy_00[0-4].ogg'], n_each=1, length=0.25, total=5, post=lambda y: filt(pitch(y, 0.8), 'low', 2500))
    if T('hoof_snow'): hits('hoof_snow', ['k:impact-sounds/footstep_snow_00[0-4].ogg'], n_each=1, length=0.3, total=5, post=lambda y: pitch(y, 0.72))
    if T('hoof_mud'): hits('hoof_mud', ['fs:488069'], n_each=6, length=0.35, total=6, post=lambda y: pitch(y, 0.82))
    if T('hoof_water'): hits('hoof_water', ['fs:861369'], n_each=6, length=0.4, total=6, min_gap=0.2, post=lambda y: pitch(y, 0.85))
    if T('hoof_sand'): hits('hoof_sand', ['fs:725875'], n_each=6, length=0.3, total=6, post=lambda y: filt(pitch(y, 0.78), 'low', 3000))
    # at ve hayvanlar
    if T('horse_neigh'): one('horse_neigh', ['fs:269571', 'fs:826753'])
    if T('whistle'): one('whistle', ['fs:320140', 'fs:617012'])
    if T('growl'): one('growl', ['fs:13789', 'fs:342204'], lambda x: trim(x)[:int(2.5 * SR)])
    if T('growl_bear'): one('growl_bear', ['fs:410343', 'fs:77634'], lambda x: trim(x)[:int(3.5 * SR)])
    if T('cougar'): one('cougar', ['fs:516829', 'fs:270383'], lambda x: pitch(trim(x)[:int(3.2 * SR)], 1.18))
    if T('wolf_howl'): one('wolf_howl', ['fs:398430'], lambda x: trim(x))
    if T('coyote_howl'): one('coyote_howl', ['fs:558725', 'fs:398430'], lambda x: pitch(trim(x), 1.3) if len(x) > 6 * SR else trim(x))
    if T('bird'): one('bird', ['fs:233255', 'fs:233254', 'fs:511094'], lambda x: trim(x)[:int(1.6 * SR)])
    if T('owl'): one('owl', ['fs:465697', 'fs:398734'])
    if T('hawk'): one('hawk', ['fs:381200', 'fs:774252'])
    if T('thunder'): one('thunder', ['fs:581124', 'fs:21733', 'fs:38250'], lambda x: trim(x, tail_db=-50, fade=0.8)[:int(9 * SR)])
    if T('train_whistle'): one('train_whistle', ['fs:71778'])
    # ortam döngüleri (RMS -20 dBFS)
    if T('amb_wind'): amb('amb_wind', 'fs:726319', 10, 1.0)
    if T('amb_wind_strong'): amb('amb_wind_strong', 'fs:459981', 20, 4.0)
    if T('amb_rain'): amb('amb_rain', 'fs:595717', 18, 1.5)
    if T('amb_fire'): amb('amb_fire', 'fs:350757', 20, 3.0, ceil=-8)
    if T('amb_river'): amb('amb_river', 'fs:415151', 18, 3.0)
    if T('amb_crickets'): amb('amb_crickets', 'fs:734642', 20, 3.0)
    if T('amb_crowd'): amb('amb_crowd', 'fs:634880', 20, 3.0)
    # eylemler
    if T('door_open'): one('door_open', ['k:rpg-audio/doorOpen_[12].ogg', 'k:rpg-audio/doorClose_[12].ogg'])
    if T('saloon_door'): one('saloon_door', ['k:rpg-audio/creak[12].ogg'])
    if T('drink'): one('drink', ['fs:445970', 'fs:133977'])
    if T('eat'): one('eat', ['fs:275015', 'fs:584290'])
    if T('lasso'): one('lasso', ['fs:719638', 'fs:841835'], lambda x: trim(x)[:int(1.6 * SR)])
    if T('rope'): one('rope', ['fs:450849'])
    if T('skin'): one('skin', ['k:rpg-audio/knifeSlice*.ogg', 'fs:30931'], lambda x: trim(x)[:int(0.9 * SR)])
    if T('coins'): one('coins', ['k:rpg-audio/handleCoins*.ogg'])
    # arayüz
    if T('ui_move'): one('ui_move', ['k:interface-sounds/tick_00[12].ogg'])
    if T('ui_ok'): one('ui_ok', ['k:interface-sounds/select_00[12].ogg'])
    if T('ui_back'): one('ui_back', ['k:interface-sounds/back_00[12].ogg'])
    if T('ui_error'): one('ui_error', ['k:interface-sounds/error_00[45].ogg'])
    if T('ui_pick'): one('ui_pick', ['k:interface-sounds/drop_00[12].ogg'])
    if T('chime'): one('chime', ['k:interface-sounds/confirmation_002.ogg'])
    if T('discover'): one('discover', ['k:interface-sounds/maximize_006.ogg'])

def credits():
    by = {}
    for fn, keys in CREDITS:
        for k in keys: by.setdefault(k, []).append(fn)
    L = ['# Ses dosyalarının kaynakları', '',
         'Bu klasördeki bütün ses dosyaları **CC0 1.0 (kamu malı)** lisanslı kaynaklardan üretildi: ticari kullanım serbest, isim belirtmek gerekmez (yine de aşağıda kayıtlı).',
         'Freesound sesleri yalnızca CC0 filtresiyle seçildi ve her birinin lisansı kendi sayfasından ayrıca doğrulandı. Kenney paketlerinin hepsi CC0\'dır.',
         'Dosyalar kırpıldı, tekil darbelere bölündü, perdesi/süzgeci ayarlandı, seviyesi eşitlendi ve mono ogg\'a çevrildi.', '',
         '| Dosya(lar) | Kaynak | Yazar | Lisans |', '|---|---|---|---|']
    def k_sort(k): return (0 if k.startswith('fs:') else 1, k)
    for k in sorted(by, key=k_sort):
        m = META[k]; fns = by[k]
        names = sorted(set(re.sub(r'_\d+\.ogg$', '', f) for f in fns))
        L.append(f"| {', '.join(f'`{n}`' for n in names)} ({len(fns)}) | [{m['title']}]({m['url']}) | {m['user']} | {m['license']} |")
    open(os.path.join(OUT, 'KAYNAKLAR.md'), 'w').write('\n'.join(L) + '\n')

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'search':
        r = search(sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else None)
        r.sort(key=lambda x: -(x['dl'] * (0.5 + x['rating'] / 5)))
        for x in r[:12]: print(f"{x['id']:>7} {x['user'][:16]:16} {x['dur']:6.2f}s indirme={x['dl']:6} puan={x['rating']:.1f}  {x['title'][:60]}")
        sys.exit(0)
    only = set(sys.argv[1:]) or None
    if only is None:
        for f in glob.glob(os.path.join(OUT, '*.ogg')): os.remove(f)
    build(only)
    if only is None: credits()
    print('yazıldı:', len(CREDITS), 'dosya')
