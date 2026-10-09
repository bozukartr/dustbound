#!/usr/bin/env python3
"""FRONTIER'S END — İngilizce sinematik seslendirmesini yapay sesle üretir.

Yalnızca sinematik satırları (audio/vo/lines.json, tools/vo-script.js yazar) Piper ile seslendirilir.
Her karakterin kendi sesi vardır; oyuncunun satırları erkek ve kadın sesiyle iki kayıttır (<anahtar>.m / .f).
Yalnızca kamu malı ya da CC BY verilerle sıfırdan eğitilmiş ses modelleri kullanılır (ayrıntı:
audio/vo/KAYNAKLAR.md). Türkçe için ses modeli yok: Türkçe senaryo (script_tr.csv) kayda hazırdır.

Kurulum ve çalıştırma (bir kez):
    python3 -m venv .venv-tts && .venv-tts/bin/pip install piper-tts soundfile numpy
    node tools/vo-script.js                  # satır listesi
    .venv-tts/bin/python tools/vo-tts.py     # eksik kayıtları üretir (--force: hepsini yeniden)
    node tools/vo-script.js                  # manifesti yeniler

Modeller ilk çalıştırmada Hugging Face'teki rhasspy/piper-voices deposundan indirilir (--models, varsayılan
~/.cache/frontiers-end-voices) ve katalogdaki MD5 özetleriyle doğrulanır.

Kayıtlar: 22.05 kHz tek kanal; baştaki ve sondaki sessizlik kırpılır, ses düzeyi eşitlenir (konuşma RMS
-20 dBFS, tepe en çok -1.5 dBFS), 70 Hz altı süzülür; audio/vo/en/<anahtar>.ogg (Vorbis) ve .mp3 yazılır.

Doğrulama (isteğe bağlı): --verify N ile her satır için en çok N aday üretilir ve konuşma tanıma
(faster-whisper, small.en) ile dinlenir; metne en yakın aday seçilir (sentez her seferinde biraz farklıdır,
kısa satırlarda yanlış okuma olabilir). Gerekli paket: .venv-tts/bin/pip install faster-whisper
"""
import argparse, hashlib, json, os, re, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VO = ROOT / 'audio' / 'vo'
HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/'

# ses modelleri: (katalog adı, katalogdaki yol)
MODELS = {
    'john': 'en/en_US/john/medium/en_US-john-medium',
    'bryce': 'en/en_US/bryce/medium/en_US-bryce-medium',
    'ljspeech': 'en/en_US/ljspeech/high/en_US-ljspeech-high',
    'cori': 'en/en_GB/cori/high/en_GB-cori-high',
    'libritts': 'en/en_US/libritts/high/en_US-libritts-high',
}
# karakter → (model, konuşmacı, konuşma hızı katsayısı: >1 yavaş)
# yaşlılar pes ve ağır konuşur; oyuncunun erkek ve kadın sesi bütün hikâyelerde aynı
PLAYER = {'m': ('john', None, 0.95), 'f': ('ljspeech', None, 0.97)}
CAST = {
    ('sully', 'S'): ('libritts', 136, 1.06),      # Dunham Sully: yaşlı çiftçi
    ('sully', 'F'): ('libritts', 595, 1.05),      # baba
    ('outlaw', 'S'): ('libritts', 846, 1.08),     # Hollis Crane: yaşlı kanun kaçağı
    ('outlaw', 'R'): ('libritts', 105, 1.0),      # Silas Vance
    ('rail', 'S'): ('bryce', None, 0.86),         # Walt Boone: ustabaşı
    ('rail', 'Mick'): ('libritts', 92, 1.0),
    ('rail', 'Sven'): ('libritts', 406, 1.02),
    ('immigrant', 'S'): ('cori', None, 1.0),      # Greta Halvorsen
    ('immigrant', 'K'): ('libritts', 633, 1.0),   # Anton, ağabey
    ('immigrant', 'W'): ('libritts', 47, 1.02),   # şerif
    ('trapper', 'S'): ('libritts', 548, 1.1),     # Elias Crowe: yaşlı tuzakçı
    ('trapper', 'K'): ('libritts', 49, 1.08),     # Abel, baba
}


def fetch(url, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(dst.suffix + '.part')
    with urllib.request.urlopen(url) as r, open(tmp, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    tmp.replace(dst)


def model_path(name, mdir, catalog):
    rel = MODELS[name]
    onnx, cfg = mdir / (Path(rel).name + '.onnx'), mdir / (Path(rel).name + '.onnx.json')
    if not cfg.exists():
        fetch(HF + rel + '.onnx.json', cfg)
    if not onnx.exists():
        print(f'  model indiriliyor: {onnx.name}', flush=True)
        fetch(HF + rel + '.onnx', onnx)
        want = catalog.get(Path(rel).name, {}).get('files', {}).get(rel + '.onnx', {}).get('md5_digest')
        if want and hashlib.md5(onnx.read_bytes()).hexdigest() != want:
            onnx.unlink()
            sys.exit(f'MD5 tutmadı: {onnx.name}')
    return onnx


def voice_for(item):
    if item['w'] == 'P':
        return PLAYER[item['sex'] or 'm']
    v = CAST.get((item['story'], item['w']))
    if not v:
        sys.exit(f"sesi atanmamış konuşan: {item['story']} {item['w']} ({item['name']})")
    return v


# okunuş düzeltmeleri (yalnızca seslendirilen metinde; altyazı değişmez): modellerin yanlış okuduğu sözcükler
# (metin, okunuş, yalnızca bu ses modeli için)
SAY = [
    ('Well... he used to.', 'Well, he used to.', None),
    ('Shh.', 'Hush.', None),
    ('My wallet. My watch. And the deed.', 'My wallet, my watch, and the deed.', None),
    ('The wagon?', 'The wag-on?', 'ljspeech'),
]


def speech_text(t, voice=None, say=True):
    # Piper için: tırnaklar ve uzun çizgiler okunmaz, satır başındaki üç nokta atlanır
    for a, b, only in SAY if say else []:
        if only in (None, voice):
            t = t.replace(a, b)
    t = t.replace('“', '').replace('”', '').replace('"', '').replace('—', ', ').replace('–', ', ')
    t = re.sub(r'^\.\.\.\s*', '', t.strip())
    # "Thirty-one" tireyle okununca araya duraklama girer
    t = re.sub(r'\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b', r'\1 \2', t, flags=re.I)
    return re.sub(r'\s+', ' ', t).strip()


NUM = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
NUM.update({w: 10 * (i + 2) for i, w in enumerate('twenty thirty forty fifty sixty seventy eighty ninety'.split())})


def words(t):
    # karşılaştırma için: küçük harf, noktalama yok, sayılar rakam ("thirty-one" → 31)
    out = []
    for w in re.sub(r"[^a-z0-9' -]", ' ', t.lower()).replace('-', ' ').split():
        w = w.strip("'")
        if w in NUM and out and out[-1].isdigit() and int(out[-1]) % 10 == 0 and int(out[-1]) >= 20 and NUM[w] < 10:
            out[-1] = str(int(out[-1]) + NUM[w])
        elif w in NUM:
            out.append(str(NUM[w]))
        elif w:
            out.append(w)
    return out


def wer(ref, hyp):
    a, b = words(ref), words(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
    return d[len(b)] / max(1, len(a))


def process(a, sr, np):
    # 70 Hz altı (birinci derece yüksek geçiren)
    rc = 1.0 / (2 * np.pi * 70)
    k = rc / (rc + 1.0 / sr)
    y = np.empty_like(a)
    prev_x = prev_y = 0.0
    for i, x in enumerate(a):
        prev_y = k * (prev_y + x - prev_x)
        prev_x = x
        y[i] = prev_y
    # baştaki ve sondaki sessizliği kırp (en çok -45 dBFS), başta 60 ms, sonda 140 ms bırak
    env = np.abs(y)
    win = max(1, int(sr * 0.01))
    env = np.convolve(env, np.ones(win) / win, 'same')
    on = np.where(env > 10 ** (-45 / 20))[0]
    if len(on):
        y = y[max(0, on[0] - int(sr * 0.06)): min(len(y), on[-1] + int(sr * 0.14))]
    # düzey: sesli bölümlerin RMS'i -20 dBFS, tepe en çok -1.5 dBFS
    fr = int(sr * 0.03)
    rms = [float(np.sqrt(np.mean(y[i:i + fr] ** 2))) for i in range(0, max(1, len(y) - fr), fr)]
    voiced = [r for r in rms if r > 10 ** (-40 / 20)] or rms
    g = 10 ** (-20 / 20) / max(1e-6, float(np.sqrt(np.mean(np.square(voiced)))))
    peak = float(np.max(np.abs(y))) * g
    if peak > 10 ** (-1.5 / 20):
        g *= 10 ** (-1.5 / 20) / peak
    y = y * g
    # yumuşak giriş ve çıkış (tıkırtı olmasın)
    n = min(len(y) // 4, int(sr * 0.01))
    if n > 1:
        y[:n] *= np.linspace(0, 1, n)
        y[-n:] *= np.linspace(1, 0, n)
    return y.astype(np.float32)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--models', default=str(Path.home() / '.cache' / 'frontiers-end-voices'))
    ap.add_argument('--force', action='store_true', help='var olan kayıtları da yeniden üret')
    ap.add_argument('--only', nargs='*', help='yalnızca bu anahtarlar (ör. 6123b07e.m)')
    ap.add_argument('--verify', type=int, default=0, help='satır başına en çok bu kadar aday üretip konuşma tanımayla seç')
    args = ap.parse_args()
    import numpy as np
    import soundfile as sf
    from piper import PiperVoice, SynthesisConfig
    asr = None
    if args.verify > 1:
        from faster_whisper import WhisperModel
        asr = WhisperModel('small.en', device='cpu', compute_type='int8', download_root=str(Path(args.models).expanduser() / 'whisper'))

    items = [x for x in json.loads((VO / 'lines.json').read_text('utf8')) if x['lang'] == 'en']
    if args.only:
        items = [x for x in items if x['key'] in args.only]
    out = VO / 'en'
    out.mkdir(parents=True, exist_ok=True)
    mdir = Path(args.models).expanduser()
    mdir.mkdir(parents=True, exist_ok=True)
    cat_path = mdir / 'voices.json'
    if not cat_path.exists():
        fetch(HF + 'voices.json', cat_path)
    catalog = json.loads(cat_path.read_text('utf8'))
    voices, done = {}, 0
    for it in items:
        ogg, mp3 = out / (it['key'] + '.ogg'), out / (it['key'] + '.mp3')
        if not args.force and ogg.exists() and mp3.exists():
            continue
        name, spk, ls = voice_for(it)
        if name not in voices:
            voices[name] = PiperVoice.load(str(model_path(name, mdir, catalog)))
        v = voices[name]
        cfg = SynthesisConfig(speaker_id=spk, length_scale=ls, noise_scale=0.6, noise_w_scale=0.75)
        text = speech_text(it['read'], name)
        best = None
        for k in range(max(1, args.verify)):
            chunks = list(v.synthesize(text, syn_config=cfg))
            sr = chunks[0].sample_rate
            # cümleler arasında kısa duraklama
            gap = np.zeros(int(sr * 0.12), np.float32)
            a = np.concatenate([np.concatenate([c.audio_float_array, gap]) for c in chunks])[:-len(gap)]
            y = process(a.astype(np.float64), sr, np)
            if not asr:
                best = (0, y, '')
                break
            y16 = np.interp(np.arange(0, len(y), sr / 16000), np.arange(len(y)), y).astype(np.float32)   # tanıma 16 kHz ister
            segs, _ = asr.transcribe(y16, language='en', beam_size=5)
            heard = ' '.join(x.text for x in segs).strip()
            e = min(wer(text, heard), wer(speech_text(it['read'], say=False), heard))   # okunuşa ya da asıl söze yakınlık
            if best is None or e < best[0]:
                best = (e, y, heard)
            # yeterince yakın: uzun satırda bir iki kelime (tanımanın sesteş yanılgıları), kısa satırda tam
            if e == 0 or (len(words(text)) > 5 and e <= 0.12):
                break
        e, y, heard = best
        sf.write(str(ogg), y, sr, format='OGG', subtype='VORBIS', compression_level=0.55)
        sf.write(str(mp3), y, sr, format='MP3', subtype='MPEG_LAYER_III', compression_level=0.45, bitrate_mode='VARIABLE')
        done += 1
        print(f"{it['key']:<12} {len(y) / sr:5.2f} sn  {name}{'' if spk is None else '#' + str(spk)}  {it['name']}: {it['read'][:60]}"
              + (f'  [WER {e:.2f}: {heard[:50]}]' if asr else ''), flush=True)
    print(f'{done} kayıt üretildi.')
    try:
        subprocess.run(['node', str(ROOT / 'tools' / 'vo-script.js')], check=True)
    except Exception as e:
        print('Manifesti yenilemek için: node tools/vo-script.js', e)


if __name__ == '__main__':
    main()
