#!/usr/bin/env python3
"""
FRONTIER'S END — ses tasarımı (çevrimdışı)

Oyunun efekt seslerini katmanlı sentezle üretir ve audio/sfx/ altına OGG Vorbis
olarak yazar; audio/sfx/manifest.json her sesin örnek sayısını ve karışım
bilgilerini (ses düzeyi, perde oynaması, yankı payı, duyulma mesafesi) tutar.

Bu dosyalar geçicidir: gerçek kayıtlar (CC0 ya da lisanslı paketler) aynı adlarla
audio/sfx/ altına konunca onların yerini alır. Bir ses için kayıt varsa o olayın
satırını SOUNDS içinden silmek ya da 'keep' demek yeterlidir; manifest yeniden
yazılırken klasördeki bütün dosyalar sayılır.

Kullanım:
  pip install numpy scipy soundfile
  python3 tools/sfx-render.py            # hepsini üret
  python3 tools/sfx-render.py gun step   # adında "gun" ya da "step" geçenler
"""
import json, os, sys, glob
import numpy as np
from scipy import signal
import soundfile as sf

SR = 44100
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'audio', 'sfx')
rng = np.random.default_rng(1890)

# ------------------------------------------------------------------ temel araçlar
def n_(d): return max(1, int(round(SR * d)))
def tt(d): return np.arange(n_(d)) / SR
def white(d): return rng.standard_normal(n_(d))
def pink(d):
    x = white(d)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, x) * 3.5
def brown(d):
    x = np.cumsum(white(d)); x -= signal.savgol_filter(x, 2001 if len(x) > 2001 else (len(x) // 2) * 2 - 1, 2) if len(x) > 7 else 0
    return x / (np.max(np.abs(x)) + 1e-9)

def sos(kind, f, order=2):
    nyq = SR / 2
    if kind == 'bp': return signal.butter(order, [max(20, f[0]) / nyq, min(f[1], nyq * 0.98) / nyq], 'bandpass', output='sos')
    return signal.butter(order, min(f, nyq * 0.98) / nyq, {'lp': 'lowpass', 'hp': 'highpass'}[kind], output='sos')
def lp(x, f, o=2): return signal.sosfilt(sos('lp', f, o), x)
def hp(x, f, o=2): return signal.sosfilt(sos('hp', f, o), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(sos('bp', (lo, hi), o), x)
def peak(x, f, q, gain_db):
    """tepe (peaking) eşitleyici"""
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    return signal.lfilter(b, a, x)
def reson(x, f, q):
    """dar bant rezonatör (ahşap gövde, metal)"""
    w = 2 * np.pi * f / SR; r = np.exp(-w / (2 * q))
    return signal.lfilter([1 - r], [1, -2 * r * np.cos(w), r * r], x)

def env(n, a=0.002, d=0.2, curve=1.0, hold=0.0):
    """saldırı-tutma-sönüm zarfı (örnek sayısı n)"""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    rel = np.clip(t - a - hold, 0, None)
    e = e * np.exp(-rel / max(d, 1e-6) * curve)
    return e
def adsr(n, a, d, s, r, sus_t):
    t = np.arange(n) / SR
    e = np.interp(t, [0, a, a + d, a + d + sus_t, a + d + sus_t + r], [0, 1, s, s, 0])
    return e
def fit(x, n):
    if len(x) >= n: return x[:n]
    return np.pad(x, (0, n - len(x)))
def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(fit(p, n) for p in parts)
def at(x, delay, total=None):
    k = n_(delay); y = np.pad(x, (k, 0))
    return fit(y, total) if total else y
def sat(x, drive=1.5): return np.tanh(x * drive) / np.tanh(drive)
def fade(x, fin=0.002, fout=0.02):
    x = x.copy(); a, b = n_(fin), n_(fout)
    x[:a] *= np.linspace(0, 1, a); x[-b:] *= np.linspace(1, 0, b)
    return x
def norm(x, peak_db=-1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * 10 ** (peak_db / 20)
def trim(x, thr=1e-4):
    idx = np.where(np.abs(x) > thr)[0]
    return x[: idx[-1] + n_(0.01)] if len(idx) else x
def chirp(f0, f1, d, kind='exp', phase=0):
    t = tt(d)
    if kind == 'exp' and f0 > 0 and f1 > 0:
        k = np.log(f1 / f0) / d; ph = 2 * np.pi * f0 * (np.exp(k * t) - 1) / k
    else: ph = 2 * np.pi * (f0 * t + (f1 - f0) * t * t / (2 * d))
    return np.sin(ph + phase)
def osc(freq_curve, kind='sin'):
    """değişken frekanslı osilatör (frekans dizisi)"""
    ph = 2 * np.pi * np.cumsum(freq_curve) / SR
    if kind == 'saw': return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == 'tri': return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    if kind == 'pulse': return np.sign(np.sin(ph))
    return np.sin(ph)
def modal(freqs, decays, amps, d, exc=None):
    """kipsel (modal) sentez: tahta, metal, kemik vuruşları"""
    t = tt(d); y = np.zeros_like(t)
    for f, dc, a in zip(freqs, decays, amps):
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / dc)
    if exc is not None: y = signal.fftconvolve(y, exc)[: len(t)]
    return y
def grains(d, rate, dur=(0.0005, 0.003), band=(800, 6000), amp=(0.2, 1.0), shape=1.0):
    """tanecikli doku: çakıl, kum, kar, ateş çatırtısı, yağmur"""
    y = np.zeros(n_(d)); count = int(rate * d)
    for _ in range(count):
        p = rng.integers(0, len(y)); g = n_(rng.uniform(*dur))
        burst = rng.standard_normal(g) * np.exp(-np.linspace(0, 6, g)) * rng.uniform(*amp) ** shape
        e = min(len(y), p + g); y[p:e] += burst[: e - p]
    return bp(y, *band)
def bubble(f0, d, rise=1.8, amp=1.0):
    """su kabarcığı (Minnaert): yükselen sinüs, hızlı sönüm"""
    t = tt(d); f = f0 * (1 + rise * t / d)
    return amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (d * 0.3))

# ------------------------------------------------------------------ yansıma (kısa, doğal)
def slap(x, delays=(0.011, 0.023, 0.041), gains=(0.35, 0.22, 0.12), lpf=3500):
    """yere ve yakın yüzeylere çarpan ilk yansımalar"""
    y = x.copy(); n = len(x)
    for dl, g in zip(delays, gains):
        y = mix(y, at(lp(x, lpf) * g, dl))
    return y
def tail(x, length=0.6, wet=0.25, lpf=2500, density=1.0):
    """yayvan kuyruk: süzülmüş, sönen gürültü ile evrişim"""
    ir = white(length) * np.exp(-tt(length) / (length * 0.22)) * density
    ir = lp(ir, lpf); ir[0] = 0
    w = signal.fftconvolve(x, ir) * wet / np.sqrt(np.sum(ir ** 2) + 1e-9) * 0.25
    return mix(x, w)

# ------------------------------------------------------------------ yazma
MANIFEST = {}
def out(name, variants, meta=None):
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, name + '_[0-9][0-9].ogg')): os.remove(f)
    for i, x in enumerate(variants):
        x = np.asarray(x, dtype=np.float64)
        x = fade(trim(x), 0.0005, 0.01)
        x = np.clip(x, -1, 1).astype(np.float32)
        sf.write(os.path.join(OUT, f'{name}_{i + 1:02d}.ogg'), x, SR, format='OGG', subtype='VORBIS')
    MANIFEST[name] = dict(meta or {})
    print(f'  {name:22s} x{len(variants)}')

# ================================================================== SİLAHLAR
def gunshot(kind, k):
    """crack (süpersonik çatlama) + blast (namlu patlaması gövdesi) + mekanik + yer yansımaları"""
    P = {
        'pistol':   dict(body=(110, 0.09), crack=0.9, noise=(0.16, 4200), sub=0.8, mech=('rev', 0.16), slap=0.5, ln=0.9),
        'repeater': dict(body=(95, 0.11), crack=1.0, noise=(0.2, 5200), sub=0.7, mech=('lever', 0.0), slap=0.55, ln=1.0),
        'rifle':    dict(body=(70, 0.16), crack=1.0, noise=(0.28, 6000), sub=1.0, mech=None, slap=0.6, ln=1.4),
        'shotgun':  dict(body=(60, 0.2), crack=0.55, noise=(0.32, 3200), sub=1.1, mech=None, slap=0.65, ln=1.4),
    }[kind]
    d = P['ln']; L = n_(d); v = 1 + rng.uniform(-0.06, 0.06)
    # çatlama: birkaç ms'lik geniş bant N-dalgası
    cl = n_(0.0035 * v)
    crack = np.concatenate([np.linspace(1, -1, cl), np.zeros(4)]) * P['crack']
    crack = mix(crack, hp(white(0.012) * env(n_(0.012), 0.0002, 0.002), 1500) * 0.8)
    # namlu patlaması: alçak frekanslı darbe, perde düşer
    f0, bd = P['body']; f0 *= v
    fr = f0 * (2.2 * np.exp(-tt(d) / 0.008) + 1)
    blast = osc(fr) * env(L, 0.0008, bd * 0.45) * P['sub'] * 0.55
    # gövde gürültüsü: patlayan gaz
    nd, nf = P['noise']
    body = lp(pink(d), nf) * env(L, 0.0005, nd * 0.3) * 1.1
    body += bp(white(d), 250, 1600) * env(L, 0.0005, nd * 0.55) * 0.55
    body += lp(brown(d), 400) * env(L, 0.002, nd * 0.8) * 0.5   # gazın alçak uğultusu
    y = mix(crack, blast, body)
    y = sat(y * 1.4, 1.8)
    # mekanik ayrıntı
    m = P['mech']
    if m and m[0] == 'rev':   # horoz/silindir tıkırtısı (ateş sonrası)
        clk = modal([2400, 3900, 5600], [0.006, 0.004, 0.003], [1, 0.6, 0.4], 0.04) * 0.12
        y = mix(y, at(clk, m[1] + rng.uniform(0, 0.03)))
    y = slap(y, delays=(0.006 + rng.uniform(0, 0.004), 0.019 + rng.uniform(0, 0.01), 0.037), gains=(P['slap'] * 0.6, P['slap'] * 0.35, P['slap'] * 0.2), lpf=2800)
    y = tail(y, 0.5, 0.18, 2200)
    return norm(peak(y, 180, 1.0, 2.5), -0.8)

def bow_shot(k):
    d = 0.5; L = n_(d)
    twang = modal([180 * (1 + rng.uniform(-0.05, 0.05)), 362, 541], [0.09, 0.05, 0.03], [1, 0.4, 0.2], d) * 0.7
    snap = hp(white(0.02), 900) * env(n_(0.02), 0.0003, 0.004) * 0.8
    whoosh = bp(white(0.35), 600, 3000) * np.sin(np.linspace(0, np.pi, n_(0.35))) ** 2 * 0.25
    return norm(mix(snap, twang, at(whoosh, 0.02)), -3)

def explosion(k):
    d = 3.2; L = n_(d)
    boom = osc(45 * (1 + 3 * np.exp(-tt(d) / 0.05))) * env(L, 0.004, 0.45) * 1.2
    blast = lp(brown(d), 700) * env(L, 0.003, 0.7) * 1.5
    crack = hp(white(0.05), 1200) * env(n_(0.05), 0.0002, 0.012) * 0.8
    debris = grains(2.5, 90, (0.002, 0.02), (900, 5000), (0.05, 0.5), 2) * np.linspace(1, 0, n_(2.5)) ** 2
    rumble = lp(white(d), 160) * env(L, 0.15, 1.1) * 2.0
    y = mix(crack, boom, blast, at(debris, 0.15), rumble)
    y = sat(y, 2.2)
    return norm(tail(y, 1.6, 0.35, 900), -0.5)

def dry_click(k):
    return norm(mix(modal([3100, 4700, 6900], [0.004, 0.003, 0.002], [1, 0.5, 0.3], 0.06), hp(white(0.004), 2000) * 0.3), -8)

def reload_rev(k):
    """silindir dönüşü: tık tık tık, fişek takma"""
    y = np.zeros(n_(1.0))
    for i in range(6):
        tick = modal([2600 + rng.uniform(-200, 200), 4100, 6200], [0.006, 0.004, 0.002], [1, 0.5, 0.25], 0.05) * rng.uniform(0.5, 0.8)
        y = mix(y, at(tick, 0.08 + i * 0.13 + rng.uniform(-0.01, 0.01)))
    shell = modal([1800, 3300, 5200], [0.02, 0.012, 0.006], [1, 0.4, 0.2], 0.08) * 0.5
    return norm(mix(y, at(shell, 0.88)), -6)
def reload_lever(k):
    """manivela: aç (metal sürtünme + çat), kapa (çat)"""
    a = mix(modal([1400, 2900, 4300], [0.02, 0.01, 0.006], [1, 0.6, 0.3], 0.12), bp(white(0.08), 2000, 6000) * env(n_(0.08), 0.01, 0.03) * 0.3)
    b = modal([1250, 2600, 5100], [0.025, 0.012, 0.006], [1, 0.6, 0.3], 0.14)
    return norm(mix(a, at(b, 0.22 + rng.uniform(0, 0.04))), -5)
def reload_shotgun(k):
    brk = modal([900, 2100, 3600], [0.03, 0.015, 0.008], [1, 0.5, 0.3], 0.15)
    shells = mix(*(at(modal([1500, 2700], [0.012, 0.008], [1, 0.4], 0.05) * 0.6, 0.35 + i * 0.25) for i in range(2)))
    close = modal([800, 1900, 3800], [0.04, 0.02, 0.008], [1, 0.6, 0.3], 0.18)
    return norm(mix(brk, shells, at(close, 0.95)), -5)

def ricochet(k):
    d = 0.7; f = rng.uniform(2200, 3200)
    whine = chirp(f, f * rng.uniform(0.45, 0.6), d) * env(n_(d), 0.002, 0.25) * 0.5
    hit = hp(white(0.02), 1500) * env(n_(0.02), 0.0002, 0.004)
    return norm(mix(hit, whine), -6)
def impact_flesh(k):
    thump = osc(np.full(n_(0.12), 90.0)) * env(n_(0.12), 0.001, 0.03)
    wet = bp(white(0.1), 400, 2500) * env(n_(0.1), 0.0005, 0.02) * 0.7
    return norm(mix(thump, wet), -6)
def impact_dirt(k):
    pf = lp(white(0.15), 1800) * env(n_(0.15), 0.0005, 0.03)
    grit = grains(0.25, 140, (0.0005, 0.002), (1500, 7000), (0.05, 0.4), 2) * np.linspace(1, 0, n_(0.25))
    return norm(mix(pf, grit), -7)
def impact_wood(k):
    knock = modal([420, 980, 1650, 2700], [0.03, 0.02, 0.01, 0.006], [1, 0.6, 0.4, 0.2], 0.15)
    return norm(mix(knock, hp(white(0.01), 2000) * 0.4), -6)

# ================================================================== AYAK SESLERİ VE TOYNAK
SURF = {
    'dirt':  dict(lp=2600, body=(160, 0.025), grit=(220, (1200, 6000), 0.18), modal=None),
    'grass': dict(lp=3800, body=(140, 0.02), grit=(380, (2500, 9000), 0.22), modal=None),
    'sand':  dict(lp=3000, body=(120, 0.03), grit=(600, (1800, 8000), 0.3), modal=None),
    'stone': dict(lp=5000, body=(220, 0.012), grit=(120, (2500, 9000), 0.15), modal=([1100, 2300, 3700], [0.012, 0.008, 0.005])),
    'wood':  dict(lp=4000, body=(180, 0.02), grit=(40, (2000, 7000), 0.06), modal=([210, 470, 890, 1500], [0.05, 0.03, 0.02, 0.012])),
    'mud':   dict(lp=1500, body=(110, 0.04), grit=(0, (500, 2000), 0.0), modal=None, squelch=True),
    'snow':  dict(lp=3500, body=(100, 0.03), grit=(900, (900, 5000), 0.35), modal=None),
    'water': dict(lp=3000, body=(90, 0.03), grit=(0, (800, 4000), 0.0), modal=None, splash=True),
}
def footstep(surf, k, hoof=False):
    S = SURF[surf]; d = 0.35 if not hoof else 0.4; L = n_(d)
    heavy = 2.2 if hoof else 1.0
    f0, bd = S['body']; f0 = f0 * (0.65 if hoof else 1) * rng.uniform(0.9, 1.1)
    thump = osc(f0 * (1 + 0.8 * np.exp(-tt(d) / 0.006))) * env(L, 0.001, bd * (0.9 if hoof else 0.5)) * 0.45 * heavy
    thump += lp(brown(d), 300) * env(L, 0.001, 0.03) * 0.5 * heavy          # toprağın tok basışı
    scuff = lp(white(d), S['lp']) * env(L, 0.001, 0.03) * 0.7
    y = mix(thump, scuff)
    if hoof and surf in ('stone', 'wood', 'dirt'):
        # nal: metalik çınlama
        y = mix(y, modal([2900 * rng.uniform(0.95, 1.05), 4600, 6800], [0.02, 0.012, 0.006], [1, 0.4, 0.2], 0.1) * (0.5 if surf != 'dirt' else 0.12))
    if S['modal']:
        fr, dc = S['modal']; fr = [f * rng.uniform(0.92, 1.08) for f in fr]
        y = mix(y, modal(fr, dc, [1, 0.6, 0.35, 0.2][: len(fr)], 0.2) * (0.6 if surf == 'wood' else 0.3) * heavy)
    rate, band, ga = S['grit']
    if rate:
        g = grains(0.12, rate, (0.0003, 0.002), band, (0.05, 1.0), 2) * ga * heavy
        y = mix(y, at(g * np.linspace(1, 0.2, len(g)), 0.004))
    if S.get('squelch'):
        sq = bp(white(0.18), 300, 1400) * env(n_(0.18), 0.02, 0.05) * 0.6
        sq = mix(sq, bubble(rng.uniform(180, 320), 0.06, 1.2) * 0.4)
        y = mix(y, at(sq, 0.01))
    if S.get('splash'):
        sp = hp(white(0.25), 700) * env(n_(0.25), 0.002, 0.06) * 0.5
        for _ in range(rng.integers(4, 9)):
            sp = mix(sp, at(bubble(rng.uniform(600, 1800), rng.uniform(0.01, 0.04)) * rng.uniform(0.1, 0.4), rng.uniform(0, 0.12)))
        y = mix(y, sp)
    # topuk + parmak ucu (insan) / ikinci basış (at)
    second = at(y * (0.45 if not hoof else 0.3), rng.uniform(0.035, 0.06))
    y = mix(y, second)
    return norm(y, -3)

# ================================================================== AT VE HAYVANLAR
def formant_voice(f0_curve, formants, breath=0.15, jitter=0.01, kind='saw'):
    """kaynak + formant süzgeci: kişneme, uluma, böğürme"""
    f0 = f0_curve * (1 + jitter * lp(white(len(f0_curve) / SR), 30))
    src = osc(f0, kind) + breath * white(len(f0_curve) / SR)
    y = sum(a * signal.lfilter(*_bpf(f, q), src) for f, q, a in formants)
    return y
def _bpf(f, q):
    w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    return [al, 0, -al], [1 + al, -2 * np.cos(w), 1 - al]

def neigh(k):
    """kişneme: yükselen, titreyen ve düşen; sonunda burundan horlama"""
    d = rng.uniform(1.1, 1.5); t = tt(d)
    peakf = rng.uniform(820, 1000)
    f0 = np.interp(t, [0, 0.12, 0.35, d * 0.75, d], [420, peakf, peakf * 0.9, 380, 240])
    trem = 1 + 0.08 * np.sin(2 * np.pi * rng.uniform(14, 19) * t) * np.clip(t / 0.3, 0, 1)
    v = formant_voice(f0 * trem, [(900, 6, 1.0), (1700, 7, 0.6), (2900, 9, 0.25)], breath=0.25, jitter=0.03)
    v *= adsr(len(t), 0.05, 0.2, 0.75, d * 0.35, d * 0.4)
    snort = bp(white(0.35), 200, 1500) * env(n_(0.35), 0.02, 0.08) * 0.5
    y = mix(v * 0.6, at(snort, d - 0.05))
    return norm(tail(y, 0.4, 0.12, 3000), -3)
def snort(k):
    d = 0.45
    y = bp(white(d), 150, 1200) * adsr(n_(d), 0.03, 0.05, 0.6, 0.2, 0.12)
    y += bp(white(d), 1500, 4000) * adsr(n_(d), 0.02, 0.05, 0.3, 0.15, 0.1) * 0.3
    y = y * (1 + 0.6 * np.sin(2 * np.pi * rng.uniform(25, 40) * tt(d)))   # dudak titreşimi
    return norm(y, -4)
def nicker(k):
    d = 0.8; t = tt(d)
    f0 = 140 + 30 * np.sin(2 * np.pi * 3 * t)
    am = (np.sin(2 * np.pi * rng.uniform(9, 12) * t) > 0).astype(float) * 0.8 + 0.2
    v = formant_voice(f0, [(500, 5, 1), (1200, 6, 0.4)], breath=0.3) * lp(am, 60) * adsr(len(t), 0.05, 0.1, 0.8, 0.25, 0.4)
    return norm(v, -5)

def howl(k, wolf=True):
    d = rng.uniform(2.4, 3.4) if wolf else rng.uniform(1.4, 2.0); t = tt(d)
    if wolf:
        base = rng.uniform(380, 460)
        f0 = np.interp(t, [0, 0.5, d * 0.6, d], [base * 0.8, base * 1.55, base * 1.5, base * 0.9])
    else:   # çakal: kesik kesik yipleme + kısa uluma
        f0 = np.interp(t, np.linspace(0, d, 9), rng.uniform(500, 1100, 9))
    f0 = f0 * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t))
    v = formant_voice(f0, [(f, 10, a) for f, a in [(700, 1), (1100, 0.5), (2400, 0.15)]], breath=0.06, kind='tri')
    if not wolf:
        gate = lp(((np.sin(2 * np.pi * 4.2 * t) > -0.2).astype(float)), 40)
        v = v * gate
    v *= adsr(len(t), 0.3 if wolf else 0.05, 0.3, 0.85, d * 0.3, d * 0.3)
    return norm(tail(v, 1.8, 0.45, 2200), -5)
def growl(k, big=False):
    d = rng.uniform(0.9, 1.4) * (1.3 if big else 1); t = tt(d)
    f0 = rng.uniform(55, 75) * (0.7 if big else 1) * (1 + 0.1 * np.sin(2 * np.pi * 2 * t))
    rough = 1 + 0.5 * lp(white(d), 45)
    v = formant_voice(f0 * rough, [(350, 3, 1), (800, 4, 0.6), (1600, 5, 0.25)], breath=0.5, kind='pulse')
    v *= adsr(len(t), 0.12, 0.2, 0.8, 0.3, d * 0.4)
    return norm(sat(v, 2), -3)
def cougar(k):
    d = 1.0; t = tt(d)
    f0 = np.interp(t, [0, 0.15, 0.6, d], [300, 520, 420, 200])
    v = formant_voice(f0, [(1100, 4, 1), (2300, 5, 0.6), (3600, 6, 0.3)], breath=0.8, kind='saw')
    return norm(sat(v * adsr(len(t), 0.02, 0.15, 0.7, 0.3, 0.4), 2.5), -4)
def chicken(k):
    y = np.zeros(n_(1.2)); t0 = 0
    for i in range(rng.integers(2, 5)):
        d = rng.uniform(0.07, 0.16); t = tt(d)
        f0 = np.interp(t, [0, d * 0.3, d], [rng.uniform(450, 600), rng.uniform(700, 900), 450])
        c = formant_voice(f0, [(1300, 5, 1), (2600, 6, 0.4)], breath=0.4) * adsr(len(t), 0.005, 0.02, 0.8, 0.03, d * 0.5)
        y = mix(y, at(c, t0)); t0 += d + rng.uniform(0.05, 0.18)
    return norm(y, -6)
def cow(k):
    d = rng.uniform(1.2, 1.7); t = tt(d)
    f0 = np.interp(t, [0, 0.25, d * 0.7, d], [95, 135, 125, 80])
    v = formant_voice(f0, [(400, 4, 1), (800, 5, 0.7), (2000, 6, 0.2)], breath=0.15, kind='saw')
    v *= adsr(len(t), 0.15, 0.2, 0.85, 0.4, d * 0.4)
    return norm(lp(v, 3000), -5)

# ================================================================== ORTAM DÖNGÜLERİ
def rms_norm(x, db=-20.0, ceil=-1.0):
    r = np.sqrt(np.mean(x ** 2)) + 1e-9
    y = x / r * 10 ** (db / 20)
    m = np.max(np.abs(y)); c = 10 ** (ceil / 20)
    return sat(y / c, 1.2) * c if m > c else y
def loop_seam(x, xf=0.5):
    """kesintisiz döngü: sonu başıyla çapraz geçiş"""
    k = n_(xf); a = x[:k]; b = x[-k:]
    w = np.linspace(0, 1, k)
    y = x[:-k].copy(); y[:k] = a * w + b * (1 - w)
    return y
def wind_loop(k, strong=False):
    d = 14
    base = pink(d)
    # rüzgârın uğultusu: bant geçiren süzgecin merkezi yavaşça dolaşır (zarf ile)
    gust = 0.55 + 0.45 * lp(white(d), 0.25) / 0.05
    gust = np.clip(gust, 0.15, 1.6)
    lo = bp(base, 150, 600) * gust; mid = bp(base, 500, 1600) * gust ** 2 * 0.5
    whistle = bp(white(d), 1800, 2400) * np.clip(gust - 0.9, 0, None) * (0.25 if strong else 0.08)
    y = lo + mid + whistle
    if strong: y = y + bp(white(d), 2500, 7000) * gust ** 3 * 0.15
    return rms_norm(loop_seam(y, 1.5), -20)
def rain_loop(k):
    d = 12
    hiss = bp(pink(d), 1500, 9000) * 0.5
    drops = grains(d, 2500, (0.0003, 0.0015), (2000, 10000), (0.05, 1.0), 2.5) * 0.7
    patter = grains(d, 300, (0.001, 0.004), (500, 2500), (0.05, 0.5), 2) * 0.4
    return rms_norm(loop_seam(hiss + drops + patter, 1.0), -20)
def fire_loop(k):
    d = 10
    roar = norm(lp(brown(d), 500), 0) * (0.75 + 0.25 * np.clip(lp(white(d), 1) / 0.1, -1, 1))
    hiss = norm(bp(pink(d), 2000, 6000), 0) * 0.12
    y = roar * 0.5 + hiss
    for _ in range(int(d * 9)):   # çıtırtılar
        p = rng.uniform(0, d - 0.05)
        c = hp(white(0.01), 1500) * env(n_(0.01), 0.0001, rng.uniform(0.0008, 0.003)) * rng.uniform(0.1, 0.6) ** 2
        y = mix(y, at(c, p, len(y)))
    for _ in range(int(d * 0.8)):   # büyük çatırtı
        p = rng.uniform(0, d - 0.1)
        c = grains(0.08, 300, (0.0003, 0.002), (1500, 8000), (0.2, 1), 1.5)
        y = mix(y, at(c, p, len(y)))
    return rms_norm(loop_seam(y, 0.8), -20)
def river_loop(k):
    d = 12
    rush = bp(pink(d), 300, 3000) * 0.5
    y = rush
    for _ in range(int(d * 60)):   # şırıltı: kabarcıklar
        p = rng.uniform(0, d - 0.06)
        y = mix(y, at(bubble(rng.uniform(500, 2500), rng.uniform(0.008, 0.03)) * rng.uniform(0.03, 0.18), p, len(y)))
    return rms_norm(loop_seam(y, 1.0), -20)
def crickets_loop(k):
    d = 10; t = tt(d); y = np.zeros(len(t))
    for c in range(5):
        f = rng.uniform(3800, 5200); rate = rng.uniform(12, 18); per = rng.uniform(0.6, 1.4); ph = rng.uniform(0, 1)
        chirp_on = ((t * (1 / per) + ph) % 1) < rng.uniform(0.25, 0.45)
        pulses = (np.sin(2 * np.pi * rate * t) > 0.3).astype(float)
        a = lp(chirp_on * pulses, 300) * rng.uniform(0.2, 0.6)
        y += np.sin(2 * np.pi * f * t) * a * (1 + 0.3 * np.sin(2 * np.pi * 0.07 * t + c))
    y += bp(pink(d), 200, 800) * 0.05
    return rms_norm(loop_seam(y, 0.8), -20)
def crowd_loop(k):
    """kasaba uğultusu: anlaşılmaz konuşma mırıltısı (formantlı kesik sesler) + uzak sesler"""
    d = 12; y = bp(pink(d), 150, 900) * 0.12
    for _ in range(140):
        dd = rng.uniform(0.15, 0.5); p = rng.uniform(0, d - dd); t = tt(dd)
        f0 = rng.uniform(100, 240) * (1 + 0.15 * np.sin(2 * np.pi * rng.uniform(2, 5) * t))
        syl = (np.sin(2 * np.pi * rng.uniform(4, 7) * t) > -0.3).astype(float)
        v = formant_voice(f0, [(rng.uniform(500, 800), 3, 1), (rng.uniform(1100, 2000), 4, 0.5)], breath=0.3) * lp(syl, 30) * adsr(len(t), 0.03, 0.05, 0.8, 0.08, dd * 0.6)
        y = mix(y, at(v * rng.uniform(0.02, 0.08), p, len(y)))
    return rms_norm(loop_seam(lp(y, 2500), 1.0), -20)

# ================================================================== ORTAM TEKİLLERİ
def bird(k):
    kind = k % 4; y = np.zeros(n_(1.6)); t0 = 0
    for i in range(rng.integers(2, 6)):
        if kind == 0:   d = rng.uniform(0.06, 0.12); s = chirp(rng.uniform(3000, 4200), rng.uniform(2000, 2800), d)
        elif kind == 1: d = rng.uniform(0.15, 0.3); s = chirp(rng.uniform(1800, 2400), rng.uniform(3200, 4000), d) * (1 + 0.5 * np.sin(2 * np.pi * 40 * tt(d)))
        elif kind == 2: d = 0.08; s = np.sin(2 * np.pi * rng.uniform(4500, 5500) * tt(d) + 3 * np.sin(2 * np.pi * 90 * tt(d)))
        else:           d = rng.uniform(0.25, 0.4); s = chirp(2600, 1700, d, 'lin') * (np.sin(2 * np.pi * 22 * tt(d)) > 0)
        s = s * adsr(len(s), 0.005, 0.02, 0.8, d * 0.4, d * 0.3)
        y = mix(y, at(s, t0)); t0 += d + rng.uniform(0.03, 0.15)
    return norm(tail(y, 0.5, 0.2, 6000), -9)
def owl(k):
    y = np.zeros(n_(2.2)); t0 = 0
    for d in [0.35, 0.18, 0.55]:
        t = tt(d); f = np.interp(t, [0, d * 0.3, d], [380, 410, 360])
        s = formant_voice(f, [(400, 6, 1)], breath=0.1, kind='sin') * adsr(len(t), 0.05, 0.05, 0.9, d * 0.4, d * 0.4)
        y = mix(y, at(s, t0)); t0 += d + 0.12
    return norm(tail(y, 1.2, 0.35, 2500), -8)
def hawk(k):
    d = 1.3; t = tt(d)
    f0 = np.interp(t, [0, 0.1, d], [2600, 3100, 1900])
    v = formant_voice(f0, [(3000, 4, 1), (5000, 5, 0.4)], breath=0.5, kind='saw') * adsr(len(t), 0.02, 0.2, 0.6, 0.6, 0.4)
    return norm(tail(v, 1.4, 0.45, 5000), -9)
def thunder(k):
    d = 6; t = tt(d)
    crack = hp(white(0.25), 400) * env(n_(0.25), 0.002, 0.05) * (0.9 if k % 2 == 0 else 0.2)
    roll = lp(brown(d), 220) * (np.interp(t, [0, 0.3, 1.2, 3, d], [0, 1, 0.7, 0.35, 0]) * (0.6 + 0.4 * np.abs(lp(white(d), 3)) / 0.05))
    y = mix(crack, roll * 1.6)
    return norm(sat(y, 1.5), -2)
def train_whistle(k):
    d = 2.6; t = tt(d)
    pitch = np.interp(t, [0, 0.15, d - 0.3, d], [0.94, 1.0, 1.0, 0.9])
    y = sum(osc(f * pitch, 'saw') * a for f, a in [(370, 1), (466, 0.8), (554, 0.7)])
    y = bp(y, 300, 3500) + bp(white(d), 1000, 4000) * 0.2
    y *= adsr(len(t), 0.12, 0.1, 0.9, 0.5, d - 0.75)
    return norm(tail(y, 2.0, 0.5, 2500), -6)
def train_chug_loop(k):
    d = 4; y = np.zeros(n_(d)); per = 0.25
    for i in range(int(d / per)):
        p = bp(white(0.16), 200, 2000) * env(n_(0.16), 0.004, 0.05) * (1 if i % 2 == 0 else 0.6)
        y = mix(y, at(p, i * per, len(y)))
    y += lp(brown(d), 120) * 0.3
    return rms_norm(loop_seam(y, 0.2), -20)

# ================================================================== ETKİLEŞİM VE FOLEY
def punch(k):
    d = 0.3
    thump = osc(np.full(n_(d), rng.uniform(70, 100)) * (1 + np.exp(-tt(d) / 0.008))) * env(n_(d), 0.001, 0.025) * 0.6
    thump += lp(brown(d), 500) * env(n_(d), 0.001, 0.04) * 0.6
    slap = bp(white(0.06), 700, 4500) * env(n_(0.06), 0.0003, 0.015) * 1.3
    cloth = bp(white(0.15), 1500, 5000) * env(n_(0.15), 0.01, 0.03) * 0.2
    return norm(sat(mix(slap, thump, cloth), 1.6), -2)
def body_fall(k):
    d = 0.8
    hit = mix(lp(white(d), 900) * env(n_(d), 0.002, 0.06), osc(np.full(n_(d), 60.0)) * env(n_(d), 0.002, 0.09) * 0.8)
    dust = grains(0.5, 300, (0.0005, 0.002), (1500, 6000), (0.05, 0.4), 2) * np.linspace(1, 0, n_(0.5)) * 0.5
    second = at(hit * 0.4, 0.14)
    return norm(mix(hit, second, at(dust, 0.02)), -3)
def thud(k):
    d = 0.25
    return norm(osc(np.full(n_(d), 110.0) * (1 + np.exp(-tt(d) / 0.02))) * env(n_(d), 0.001, 0.05) + lp(white(d), 1200) * env(n_(d), 0.001, 0.02) * 0.6, -3)
def door_open(k):
    """gıcırtı: yapış-kay sürtünme darbeleri ahşap rezonatörden geçer + mandal"""
    d = rng.uniform(0.7, 1.1); t = tt(d)
    rate = np.interp(t, [0, d * 0.3, d], [rng.uniform(60, 90), rng.uniform(140, 220), rng.uniform(70, 110)])
    ph = np.cumsum(rate) / SR; pulses = np.diff(np.floor(ph), prepend=0) > 0
    exc = pulses.astype(float) * (0.5 + 0.5 * rng.random(len(t)))
    cr = sum(reson(exc, f, 25) * a for f, a in [(rng.uniform(600, 800), 1), (1500, 0.6), (2700, 0.3)])
    cr *= adsr(len(t), 0.05, 0.1, 0.9, 0.2, d * 0.6)
    cr = norm(cr, 0) * 0.9
    latch = norm(modal([2100, 3500], [0.01, 0.006], [1, 0.5], 0.05), 0) * 0.5
    return norm(mix(latch, at(cr, 0.03)), -4)
def door_close(k):
    knock = modal([140, 330, 620, 1100], [0.06, 0.04, 0.02, 0.01], [1, 0.7, 0.4, 0.2], 0.4) * 1.2
    latch = modal([2300, 3800], [0.012, 0.006], [1, 0.5], 0.05) * 0.5
    return norm(mix(knock, lp(white(0.4), 1200) * env(n_(0.4), 0.001, 0.02) * 0.5, at(latch, 0.03)), -2)
def saloon_door(k):
    y = np.zeros(n_(1.4))
    for i in range(4):
        y = mix(y, at(modal([300 + i * 15, 720, 1400], [0.03, 0.02, 0.01], [1, 0.5, 0.25], 0.12) * (0.9 ** i) * (1 if i % 2 == 0 else 0.7), i * 0.22))
    return norm(mix(y, door_open(k) * 0.25), -4)
def coins(k):
    y = np.zeros(n_(0.8))
    for i in range(rng.integers(3, 7)):
        f = rng.uniform(3000, 5200)
        c = modal([f, f * 2.7, f * 4.1], [0.12, 0.06, 0.03], [1, 0.4, 0.2], 0.4) * rng.uniform(0.3, 1)
        y = mix(y, at(c, rng.uniform(0, 0.25)))
    return norm(y, -6)
def drink(k):
    y = np.zeros(n_(1.0)); t0 = 0
    for i in range(rng.integers(2, 4)):
        g = mix(bp(white(0.12), 200, 900) * env(n_(0.12), 0.01, 0.04), bubble(rng.uniform(250, 400), 0.08, 2) * 0.5)
        y = mix(y, at(g, t0)); t0 += rng.uniform(0.22, 0.32)
    return norm(y, -6)
def eat(k):
    y = np.zeros(n_(0.9))
    for i in range(rng.integers(3, 6)):
        c = grains(0.08, 900, (0.0003, 0.002), (1200, 6000), (0.1, 1), 1.5) * env(n_(0.08), 0.005, 0.03)
        y = mix(y, at(c, i * rng.uniform(0.12, 0.18)))
    return norm(y, -7)
def lasso_throw(k):
    d = 0.8; t = tt(d)
    sw = bp(white(d), 400, 2500) * (np.sin(2 * np.pi * rng.uniform(4, 6) * t) ** 2) * adsr(len(t), 0.1, 0.2, 0.8, 0.3, 0.2)
    rush = bp(white(0.4), 800, 4000) * np.sin(np.linspace(0, np.pi, n_(0.4))) ** 2
    return norm(mix(sw * 0.6, at(rush, 0.42)), -6)
def rope_tie(k):
    y = np.zeros(n_(1.0))
    for i in range(5):
        y = mix(y, at(bp(white(0.12), 700, 3500) * adsr(n_(0.12), 0.02, 0.03, 0.6, 0.05, 0.02), i * 0.17 + rng.uniform(0, 0.03)))
    return norm(y, -6)
def skin(k):
    d = 0.9
    tear = bp(white(d), 400, 3000) * adsr(n_(d), 0.05, 0.1, 0.7, 0.3, 0.3)
    wet = sum(at(bubble(rng.uniform(200, 500), 0.05, 1) * 0.3, rng.uniform(0, 0.7), n_(d)) for _ in range(5))
    return norm(mix(tear * 0.5, wet), -6)
def whistle_human(k):
    """iki parmakla çalınan ıslık: yükselen ve inen iki ses"""
    d = 0.75; t = tt(d)
    f = np.interp(t, [0, 0.08, 0.25, 0.32, 0.5, d], [1700, 2500, 2400, 2300, 2700, 2000]) * rng.uniform(0.95, 1.05)
    v = osc(f * (1 + 0.004 * np.sin(2 * np.pi * 6 * t))) + 0.15 * bp(white(d), 1800, 3500)
    v *= adsr(len(t), 0.03, 0.05, 0.85, 0.15, d * 0.6) * (1 - 0.7 * np.exp(-((t - 0.28) / 0.03) ** 2))
    return norm(tail(v, 0.8, 0.25, 6000), -4)
def splash(k):
    y = hp(white(0.6), 400) * env(n_(0.6), 0.003, 0.12)
    for _ in range(14): y = mix(y, at(bubble(rng.uniform(300, 1500), rng.uniform(0.02, 0.06)) * rng.uniform(0.1, 0.5), rng.uniform(0, 0.4), len(y)))
    return norm(y, -4)
def paper(k):
    return norm(bp(white(0.35), 1500, 7000) * adsr(n_(0.35), 0.02, 0.05, 0.6, 0.1, 0.15) * (0.6 + 0.4 * (lp(white(0.35), 40) > 0)), -9)
def chop(k):
    hit = modal([380, 900, 1700], [0.04, 0.02, 0.01], [1, 0.5, 0.25], 0.3)
    return norm(mix(hit, hp(white(0.02), 1500) * 0.6), -4)
def pickaxe(k):
    clank = modal([1900, 3300, 5100, 7200], [0.06, 0.04, 0.02, 0.01], [1, 0.6, 0.35, 0.2], 0.4)
    grit = grains(0.3, 300, (0.0005, 0.002), (2000, 8000), (0.1, 0.6), 2) * np.linspace(1, 0, n_(0.3))
    return norm(mix(clank, grit * 0.6), -3)

# ================================================================== ARAYÜZ (batı temalı: tahta, deri, metal, tel)
def pluck_ks(freq, d=1.2, damp=0.996, bright=0.5):
    """Karplus-Strong tel"""
    N = int(SR / freq); y = np.zeros(n_(d)); buf = rng.uniform(-1, 1, N) * (1 - bright) + rng.standard_normal(N) * bright * 0.3
    y[:N] = buf
    for i in range(N, len(y)): y[i] = damp * 0.5 * (y[i - N] + y[i - N + 1])
    return lp(y, 5000)
def ui_move(k): return norm(mix(modal([1800 * rng.uniform(0.97, 1.03), 3300], [0.012, 0.006], [1, 0.3], 0.05), hp(white(0.005), 3000) * 0.2), -14)
def ui_ok(k):
    a = pluck_ks(392, 0.8) ; b = pluck_ks(587, 0.8)
    return norm(mix(a, at(b, 0.06)), -10)
def ui_back(k): return norm(mix(pluck_ks(330, 0.6), at(pluck_ks(247, 0.6), 0.05)), -12)
def ui_error(k): return norm(mix(modal([180, 410], [0.05, 0.03], [1, 0.4], 0.2), lp(white(0.1), 600) * env(n_(0.1), 0.001, 0.02) * 0.5), -10)
def ui_pick(k): return norm(mix(bp(white(0.15), 1500, 6000) * adsr(n_(0.15), 0.01, 0.03, 0.5, 0.05, 0.05) * 0.5, modal([2500], [0.02], [0.3], 0.05)), -12)
def chime(k):
    """başarım: gitar arpeji + küçük çan"""
    y = np.zeros(n_(3.0))
    for i, f in enumerate([196, 247, 294, 392, 494]):
        y = mix(y, at(pluck_ks(f, 2.5) * (0.8 + 0.2 * i / 4), i * 0.09))
    bell = modal([1568, 1568 * 2.76, 1568 * 5.4], [0.8, 0.4, 0.2], [0.25, 0.1, 0.05], 2.0)
    return norm(tail(mix(y, at(bell, 0.45)), 1.2, 0.25, 6000), -6)
def discover(k):
    y = np.zeros(n_(2.6))
    for i, f in enumerate([220, 277, 330, 440]): y = mix(y, at(pluck_ks(f, 2.2), i * 0.13))
    return norm(tail(y, 1.0, 0.2, 5000), -7)
def quest(k):
    y = np.zeros(n_(2.2))
    for i, f in enumerate([294, 370, 440]): y = mix(y, at(pluck_ks(f, 2.0), i * 0.08))
    return norm(tail(y, 0.8, 0.2, 5000), -9)

# ================================================================== LİSTE
# name: (üretici, örnek sayısı, karışım bilgisi)
#  vol: temel ses düzeyi, pitch: ±perde oynaması, rev: yankı payı, dist: duyulma mesafesi (px),
#  bus: sfx | amb | ui, loop: döngü, max: aynı anda en fazla
SOUNDS = {
    'gun_pistol':   (lambda k: gunshot('pistol', k), 5, dict(vol=0.9, pitch=0.05, rev=0.9, dist=1600, max=6)),
    'gun_repeater': (lambda k: gunshot('repeater', k), 4, dict(vol=0.95, pitch=0.04, rev=0.9, dist=1700, max=6)),
    'gun_rifle':    (lambda k: gunshot('rifle', k), 4, dict(vol=1.0, pitch=0.03, rev=1.0, dist=2200, max=4)),
    'gun_shotgun':  (lambda k: gunshot('shotgun', k), 4, dict(vol=1.0, pitch=0.04, rev=0.9, dist=1600, max=4)),
    'gun_bow':      (bow_shot, 3, dict(vol=0.6, pitch=0.06, rev=0.3, dist=500)),
    'gun_dry':      (dry_click, 2, dict(vol=0.5, pitch=0.05, rev=0.1, dist=300)),
    'reload_pistol': (reload_rev, 2, dict(vol=0.5, pitch=0.03, rev=0.15, dist=300)),
    'reload_repeater': (reload_lever, 3, dict(vol=0.5, pitch=0.04, rev=0.15, dist=300)),
    'reload_shotgun': (reload_shotgun, 2, dict(vol=0.5, pitch=0.03, rev=0.15, dist=300)),
    'explosion':    (explosion, 3, dict(vol=1.0, pitch=0.06, rev=1.0, dist=2600, max=3)),
    'ricochet':     (ricochet, 4, dict(vol=0.4, pitch=0.08, rev=0.5, dist=600)),
    'hit_flesh':    (impact_flesh, 4, dict(vol=0.55, pitch=0.1, rev=0.2, dist=500)),
    'hit_dirt':     (impact_dirt, 4, dict(vol=0.4, pitch=0.1, rev=0.2, dist=500)),
    'hit_wood':     (impact_wood, 3, dict(vol=0.45, pitch=0.1, rev=0.3, dist=500)),
    **{f'step_{s}': ((lambda s: lambda k: footstep(s, k))(s), 6, dict(vol=0.32, pitch=0.08, rev=0.2, dist=280, max=8)) for s in SURF},
    **{f'hoof_{s}': ((lambda s: lambda k: footstep(s, k, True))(s), 6, dict(vol=0.42, pitch=0.07, rev=0.2, dist=420, max=10)) for s in SURF},
    'horse_neigh':  (neigh, 4, dict(vol=0.6, pitch=0.06, rev=0.6, dist=900)),
    'horse_snort':  (snort, 4, dict(vol=0.4, pitch=0.08, rev=0.3, dist=400)),
    'horse_nicker': (nicker, 2, dict(vol=0.4, pitch=0.05, rev=0.3, dist=300)),
    'wolf_howl':    (lambda k: howl(k, True), 3, dict(vol=0.45, pitch=0.05, rev=1.0, dist=3000, bus='amb')),
    'coyote_howl':  (lambda k: howl(k, False), 3, dict(vol=0.4, pitch=0.06, rev=1.0, dist=3000, bus='amb')),
    'growl':        (growl, 3, dict(vol=0.6, pitch=0.08, rev=0.4, dist=600)),
    'growl_bear':   (lambda k: growl(k, True), 3, dict(vol=0.75, pitch=0.06, rev=0.4, dist=800)),
    'cougar':       (cougar, 2, dict(vol=0.6, pitch=0.06, rev=0.4, dist=700)),
    'chicken':      (chicken, 4, dict(vol=0.3, pitch=0.1, rev=0.2, dist=350, bus='amb')),
    'cow':          (cow, 3, dict(vol=0.35, pitch=0.08, rev=0.4, dist=700, bus='amb')),
    'amb_wind':     (lambda k: wind_loop(k), 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_wind_strong': (lambda k: wind_loop(k, True), 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_rain':     (rain_loop, 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_fire':     (fire_loop, 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_river':    (river_loop, 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_crickets': (crickets_loop, 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_crowd':    (crowd_loop, 1, dict(vol=1.0, loop=True, bus='amb')),
    'amb_train':    (train_chug_loop, 1, dict(vol=1.0, loop=True, bus='amb')),
    'bird':         (bird, 8, dict(vol=0.25, pitch=0.08, rev=0.4, dist=900, bus='amb')),
    'owl':          (owl, 2, dict(vol=0.3, pitch=0.05, rev=0.8, dist=1500, bus='amb')),
    'hawk':         (hawk, 2, dict(vol=0.3, pitch=0.05, rev=0.9, dist=2500, bus='amb')),
    'thunder':      (thunder, 4, dict(vol=0.9, pitch=0.08, rev=0.3, bus='amb')),
    'train_whistle': (train_whistle, 2, dict(vol=0.6, pitch=0.02, rev=0.9, dist=4000, bus='amb')),
    'punch':        (punch, 4, dict(vol=0.6, pitch=0.08, rev=0.2, dist=500)),
    'body_fall':    (body_fall, 3, dict(vol=0.6, pitch=0.08, rev=0.3, dist=500)),
    'thud':         (thud, 3, dict(vol=0.5, pitch=0.1, rev=0.2, dist=400)),
    'door_open':    (door_open, 4, dict(vol=0.45, pitch=0.06, rev=0.3, dist=350)),
    'door_close':   (door_close, 3, dict(vol=0.5, pitch=0.05, rev=0.3, dist=400)),
    'saloon_door':  (saloon_door, 2, dict(vol=0.45, pitch=0.05, rev=0.3, dist=400)),
    'coins':        (coins, 4, dict(vol=0.45, pitch=0.06, rev=0.1, bus='ui')),
    'drink':        (drink, 3, dict(vol=0.45, pitch=0.06, rev=0.1, dist=200)),
    'eat':          (eat, 3, dict(vol=0.45, pitch=0.06, rev=0.1, dist=200)),
    'lasso':        (lasso_throw, 3, dict(vol=0.5, pitch=0.06, rev=0.2, dist=400)),
    'rope':         (rope_tie, 2, dict(vol=0.45, pitch=0.05, rev=0.1, dist=300)),
    'skin':         (skin, 3, dict(vol=0.45, pitch=0.06, rev=0.1, dist=300)),
    'whistle':      (whistle_human, 3, dict(vol=0.5, pitch=0.03, rev=0.5, dist=900)),
    'splash':       (splash, 3, dict(vol=0.45, pitch=0.08, rev=0.3, dist=500)),
    'paper':        (paper, 3, dict(vol=0.5, pitch=0.08, rev=0.0, bus='ui')),
    'chop':         (chop, 3, dict(vol=0.5, pitch=0.06, rev=0.4, dist=600)),
    'pickaxe':      (pickaxe, 3, dict(vol=0.5, pitch=0.06, rev=0.4, dist=600)),
    'ui_move':      (ui_move, 3, dict(vol=0.6, pitch=0.03, rev=0, bus='ui')),
    'ui_ok':        (ui_ok, 2, dict(vol=0.6, pitch=0.0, rev=0, bus='ui')),
    'ui_back':      (ui_back, 2, dict(vol=0.6, pitch=0.0, rev=0, bus='ui')),
    'ui_error':     (ui_error, 2, dict(vol=0.6, pitch=0.03, rev=0, bus='ui')),
    'ui_pick':      (ui_pick, 3, dict(vol=0.6, pitch=0.05, rev=0, bus='ui')),
    'chime':        (chime, 1, dict(vol=0.6, pitch=0.0, rev=0, bus='ui')),
    'discover':     (discover, 1, dict(vol=0.55, pitch=0.0, rev=0, bus='ui')),
    'quest':        (quest, 1, dict(vol=0.5, pitch=0.0, rev=0, bus='ui')),
}

def main():
    only = [a for a in sys.argv[1:] if a != '--manifest']
    keep = '--manifest' in sys.argv  # yalnız manifesti yenile, hiçbir sesi üretme
    path = os.path.join(OUT, 'manifest.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    for name, (fn, count, meta) in SOUNDS.items():
        if keep or (only and not any(o in name for o in only)):
            if name in old: MANIFEST[name] = old[name]
            continue
        out(name, [fn(k) for k in range(count)], meta)
    # klasördeki her ses (elle eklenen kayıtlar dahil) sayılır
    man = {}
    for f in sorted(glob.glob(os.path.join(OUT, '*_[0-9][0-9].ogg'))):
        base = os.path.basename(f)[:-7]
        m = man.setdefault(base, dict(MANIFEST.get(base) or old.get(base) or {}))
        m['n'] = m.get('n', 0) + 1 if 'counted' in m else 1
        m['counted'] = True
    for m in man.values(): m.pop('counted', None)
    json.dump(man, open(path, 'w'), indent=1, sort_keys=True, ensure_ascii=False)
    size = sum(os.path.getsize(f) for f in glob.glob(os.path.join(OUT, '*.ogg')))
    print(f'{len(man)} ses, {size / 1024 / 1024:.2f} MB')

if __name__ == '__main__':
    main()
