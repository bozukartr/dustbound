#!/usr/bin/env python3
"""FRONTIER'S END — İngilizce sinematik seslendirmesini yapay sesle üretir.

Yalnızca sinematik satırları (audio/vo/lines.json, tools/vo-script.js yazar) seslendirilir. Motor: Chatterbox Turbo
(Resemble AI, MIT lisansı): sesi kısa bir örnek kayıttan kopyalayan, tonlaması doğal bir metinden sese modeli.
Her karakterin örnek kaydı tools/vo-ref/<ses>.ogg dosyasıdır: LibriTTS-R (CC BY 4.0) okurlarının birkaç cümlesi,
gırtlak rengi ve perdesi değiştirilerek yeni bir karakter sesine dönüştürülmüştür (tools/vo-ref.py, kaynaklar:
audio/vo/KAYNAKLAR.md). Oyuncunun satırları erkek ve kadın sesiyle iki kayıttır (<anahtar>.m / .f). Türkçe ses yok:
Türkçe oyunda da İngilizce kayıtlar çalar; Türkçe senaryo (script_tr.csv) kayda hazırdır.

Kurulum ve çalıştırma (bir kez; Python 3.11):
    python3 -m venv .venv-tts && .venv-tts/bin/pip install chatterbox-tts faster-whisper
    node tools/vo-script.js                       # satır listesi
    .venv-tts/bin/python tools/vo-tts.py --utmos  # eksik kayıtları üretir (--force: hepsini yeniden)

Chatterbox Turbo ilk çalıştırmada Hugging Face'ten (ResembleAI/chatterbox-turbo) indirilir. İşlemcide (4 çekirdek)
bir saniyelik ses yaklaşık iki saniyede üretilir.

Seçim: sentez her seferinde biraz farklıdır. Her satır için en çok --takes aday üretilir; konuşma tanıma
(faster-whisper, small.en) metni doğru duymazsa ya da doğallık tahmini (--utmos: UTMOS, insan dinleyici puanını
tahmin eden model, balacoon/utmos) düşükse yeni aday denenir. Metni en doğru duyulan, eşitse en doğal aday seçilir.

Kayıtlar: 24 kHz tek kanal; baştaki ve sondaki sessizlik kırpılır, ses düzeyi eşitlenir (konuşma RMS -20 dBFS, tepe
en çok -1.5 dBFS), 70 Hz altı süzülür; audio/vo/en/<anahtar>.ogg (Vorbis) ve .mp3 yazılır. Chatterbox her kayda
duyulmayan bir yapay ses filigranı (Perth) ekler.
"""
import argparse, json, os, re, subprocess, sys, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VO = ROOT / 'audio' / 'vo'
REF = ROOT / 'tools' / 'vo-ref'

# karakter → örnek kayıt (tools/vo-ref/<ses>.ogg); oyuncunun erkek ve kadın sesi bütün hikâyelerde aynı
PLAYER = {'m': 'player_m', 'f': 'player_f'}
CAST = {
    ('sully', 'S'): 'sully',        # Dunham Sully: yaşlı çiftçi
    ('sully', 'F'): 'pa',           # baba
    ('outlaw', 'S'): 'hollis',      # Hollis Crane: yaşlı kanun kaçağı
    ('outlaw', 'R'): 'silas',       # Silas Vance
    ('rail', 'S'): 'walt',          # Walt Boone: ustabaşı
    ('rail', 'Mick'): 'mick',
    ('rail', 'Sven'): 'sven',
    ('immigrant', 'S'): 'greta',    # Greta Halvorsen
    ('immigrant', 'K'): 'anton',    # Anton, ağabey
    ('immigrant', 'W'): 'sheriff',  # şerif
    ('trapper', 'S'): 'elias',      # Elias Crowe: yaşlı tuzakçı
    ('trapper', 'K'): 'abel',       # Abel, baba
}


def voice_for(item):
    if item['w'] == 'P':
        return PLAYER[item['sex'] or 'm']
    v = CAST.get((item['story'], item['w']))
    if not v:
        sys.exit(f"sesi atanmamış konuşan: {item['story']} {item['w']} ({item['name']})")
    return v


# okunuş düzeltmeleri (yalnızca seslendirilen metinde; altyazı değişmez): (metin, okunuş)
SAY = []


def speech_text(t, say=True):
    # tırnaklar okunmaz, uzun çizgi duraklamadır, satır başındaki üç nokta atlanır
    for a, b in SAY if say else []:
        t = t.replace(a, b)
    t = t.replace('“', '').replace('”', '').replace('"', '').replace('—', ', ').replace('–', ', ')
    t = re.sub(r'^\.\.\.\s*', '', t.strip())
    return re.sub(r'\s+', ' ', t).strip()


NUM = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
NUM.update({w: 10 * (i + 2) for i, w in enumerate('twenty thirty forty fifty sixty seventy eighty ninety'.split())})
# tanımanın yazım farkları ve kısaltmalar (kesme işareti atılmış hâlleriyle)
SAME = {'co op': 'coop', 'okay': 'ok', 'o k': 'ok', 'mr': 'mister', 'mrs': 'missus', 'im': 'i am', 'youre': 'you are', 'theyre': 'they are',
        'dont': 'do not', 'doesnt': 'does not', 'didnt': 'did not', 'cant': 'can not', 'cannot': 'can not', 'wont': 'will not', 'isnt': 'is not',
        'arent': 'are not', 'wasnt': 'was not', 'werent': 'were not', 'havent': 'have not', 'hasnt': 'has not', 'couldnt': 'could not',
        'wouldnt': 'would not', 'shouldnt': 'should not', 'ive': 'i have', 'youve': 'you have', 'weve': 'we have', 'thats': 'that is',
        'whats': 'what is', 'theres': 'there is', 'hes': 'he is', 'shes': 'she is', 'youll': 'you will', 'ill': 'i will',
        'id': 'i would', 'youd': 'you would',
        # sesteşler ve özel adların yazımı (tanıma duyduğunu başka yazar)
        'st': 'saint', 'planes': 'plains', 'crow': 'crowe', 'halvorson': 'halvorsen', 'halverson': 'halvorsen'}


def words(t):
    # karşılaştırma için: küçük harf, noktalama ve kesme işareti yok, kısaltmalar açık, sayılar rakam ("thirty-one" → 31)
    t = ' ' + re.sub(r"[^a-z0-9 -]", ' ', t.lower().replace("'", '').replace('’', '')).replace('-', ' ') + ' '
    for a, b in SAME.items():
        t = t.replace(f' {a} ', f' {b} ')
    out = []
    for w in t.split():
        if w in NUM and out and out[-1].isdigit() and int(out[-1]) % 10 == 0 and int(out[-1]) >= 20 and NUM[w] < 10:
            out[-1] = str(int(out[-1]) + NUM[w])
        elif w in NUM:
            out.append(str(NUM[w]))
        elif w:
            out.append(w)
    return out


def joined(a, b):
    # bitişik/ayrı yazım farkı ("trapline" / "trap line"): öbür tarafta bitişik hâli olan ardışık iki sözcüğü birleştir
    va, out = set(a), []
    for w in b:
        if out and out[-1] + w in va and out[-1] not in va:
            out[-1] += w
        else:
            out.append(w)
    return out


def wer(ref, hyp):
    a, b = words(ref), words(hyp)
    a, b = joined(b, a), joined(a, b)
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
    # baştaki ve sondaki sessizliği kırp (en yüksek düzeyin 40 dB altı), başta 60 ms, sonda 160 ms bırak
    env = np.abs(y)
    win = max(1, int(sr * 0.01))
    env = np.convolve(env, np.ones(win) / win, 'same')
    on = np.where(env > float(env.max()) * 10 ** (-40 / 20))[0]
    if len(on):
        y = y[max(0, on[0] - int(sr * 0.06)): min(len(y), on[-1] + int(sr * 0.16))]
    # düzey: sesli bölümlerin RMS'i -20 dBFS, tepe en çok -1.5 dBFS
    fr = int(sr * 0.03)
    rms = [float(np.sqrt(np.mean(y[i:i + fr] ** 2))) for i in range(0, max(1, len(y) - fr), fr)]
    top = max(rms) if rms else 1.0
    voiced = [r for r in rms if r > top * 0.1] or rms
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


def utmos_model(cache):
    # balacoon/utmos: UTMOS (SpeechMOS yarışması, UTokyo-SaruLab) TorchScript; ekran kartına bağlı kaydedilmiş, işlemciye çevrilir
    import torch
    cpu = cache / 'utmos_cpu.jit'
    if not cpu.exists():
        src = cache / 'utmos.jit'
        if not src.exists():
            print('  UTMOS indiriliyor (~400 MB)', flush=True)
            cache.mkdir(parents=True, exist_ok=True)
            tmp = src.with_suffix('.part')
            with urllib.request.urlopen('https://huggingface.co/balacoon/utmos/resolve/main/utmos.jit') as r, open(tmp, 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            tmp.replace(src)
        with zipfile.ZipFile(src) as z, zipfile.ZipFile(cpu, 'w', zipfile.ZIP_STORED) as o:
            for i in z.infolist():
                if i.filename.endswith('.debug_pkl'):
                    continue
                b = z.read(i.filename)
                if i.filename.endswith('.py'):
                    b = b.replace(b'torch.device("cuda:0")', b'torch.device("cpu")')
                o.writestr(i, b)
    return torch.jit.load(str(cpu), map_location='cpu').eval()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=str(Path.home() / '.cache' / 'frontiers-end-voices'))
    ap.add_argument('--force', action='store_true', help='var olan kayıtları da yeniden üret')
    ap.add_argument('--only', nargs='*', help='yalnızca bu anahtarlar (ör. 6123b07e.m)')
    ap.add_argument('--voice', nargs='*', help='yalnızca bu sesler (ör. sully player_f)')
    ap.add_argument('--takes', type=int, default=3, help='satır başına en çok bu kadar aday')
    ap.add_argument('--utmos', action='store_true', help='adaylar arasında doğallık tahminiyle de seç')
    ap.add_argument('--recheck', action='store_true', help='var olan kayıtları dinle; metni yanlış duyulanları yeniden üret (eskisi de aday)')
    args = ap.parse_args()
    import numpy as np
    import soundfile as sf
    import torch
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    from faster_whisper import WhisperModel
    torch.set_num_threads(max(1, os.cpu_count() or 1))
    cache = Path(args.cache).expanduser()

    items = [x for x in json.loads((VO / 'lines.json').read_text('utf8')) if x['lang'] == 'en']
    if args.only:
        items = [x for x in items if x['key'] in args.only]
    if args.voice:
        items = [x for x in items if voice_for(x) in args.voice]
    out = VO / 'en'
    out.mkdir(parents=True, exist_ok=True)
    have = lambda x: (out / (x['key'] + '.ogg')).exists() and (out / (x['key'] + '.mp3')).exists()
    items = [x for x in items if args.force or args.recheck or not have(x)]
    if not items:
        print('kayıtlar hazır')
    else:
        tts = ChatterboxTurboTTS.from_pretrained(device='cpu')
        asr = WhisperModel('small.en', device='cpu', compute_type='int8', download_root=str(cache / 'whisper'))
        mos = utmos_model(cache) if args.utmos else None
        def judge(y, sr, text, plain, n_words):
            # metin doğru duyuluyor mu (okunuşa ya da asıl söze yakınlık), süre makul mü, ne kadar doğal
            y16 = np.interp(np.arange(0, len(y), sr / 16000), np.arange(len(y)), y).astype(np.float32)   # tanıma 16 kHz ister
            segs, _ = asr.transcribe(y16, language='en', beam_size=5)
            heard = ' '.join(x.text for x in segs).strip()
            e = min(wer(text, heard), wer(plain, heard))
            # uzun sessizlik ya da uydurma ek ses olmasın: kelime başına en çok ~0.75 sn
            if len(y) / sr > 1.2 + 0.75 * n_words:
                e += 0.5
            q = 0.0
            if mos is not None:
                with torch.no_grad():
                    q = float(mos(torch.tensor(np.clip(y16 * 32767, -32768, 32767).astype(np.int16)).unsqueeze(0)).item())
            return e, q, heard

        done, cur, sr = 0, None, tts.sr
        for it in sorted(items, key=voice_for):
            v = voice_for(it)
            text, plain = speech_text(it['read']), speech_text(it['read'], say=False)
            n_words = len(words(plain))
            # yeterince iyi: metin doğru duyuldu (uzun satırda bir sesteş yanılgı olabilir) ve doğal
            good = lambda e, q: (e == 0 or (n_words > 6 and e <= 0.1)) and (mos is None or q >= 4.0)
            best = None
            if args.recheck and not args.force and have(it):
                y0, sr0 = sf.read(str(out / (it['key'] + '.ogg')), dtype='float64')
                e, q, heard = judge(y0, sr0, text, plain, n_words)
                if e == 0:
                    continue
                best = (e, q, y0.astype(np.float32), heard, -1)
            if v != cur:
                tts.prepare_conditionals(str(REF / f'{v}.ogg'))
                cur = v
            again = 100 if best else 0   # yeniden denetimde ilk üretimden farklı tohumlar
            for k in range(max(1, args.takes)):
                torch.manual_seed(int(it['key'][:8], 16) + 7919 * (k + again))
                y = process(tts.generate(text).squeeze(0).numpy().astype(np.float64), sr, np)
                e, q, heard = judge(y, sr, text, plain, n_words)
                if best is None or (e, -q) < (best[0], -best[1]):
                    best = (e, q, y, heard, k)
                if good(e, q) and (e == 0 or best[4] != -1):
                    break
            e, q, y, heard, k = best
            if k < 0:
                print(f"{it['key']:<12} eski kayıt kaldı  WER {e:.2f}  [duyulan: {heard[:50]}]", flush=True)
                continue
            ogg, mp3 = out / (it['key'] + '.ogg'), out / (it['key'] + '.mp3')
            sf.write(str(ogg), y, sr, format='OGG', subtype='VORBIS', compression_level=0.55)
            sf.write(str(mp3), y, sr, format='MP3', subtype='MPEG_LAYER_III', compression_level=0.45, bitrate_mode='VARIABLE')
            done += 1
            print(f"{it['key']:<12} {len(y) / sr:5.2f} sn  {v:<9} aday {k + 1}  WER {e:.2f}" + (f'  UTMOS {q:.2f}' if mos is not None else '')
                  + f"  {it['read'][:50]}" + (f'  [duyulan: {heard[:50]}]' if e > 0 else ''), flush=True)
        print(f'{done} kayıt üretildi.')
    try:
        subprocess.run(['node', str(ROOT / 'tools' / 'vo-script.js')], check=True)
    except Exception as e:
        print('Manifesti yenilemek için: node tools/vo-script.js', e)


if __name__ == '__main__':
    main()
