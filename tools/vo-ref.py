#!/usr/bin/env python3
"""FRONTIER'S END — seslendirme karakter seslerinin örnek kayıtlarını (tools/vo-ref/<ses>.ogg) kurar.

tools/vo-tts.py her karakterin sesini bu örnek kayıtlardan kopyalar. Örnekler LibriTTS-R veri kümesinin (CC BY 4.0,
LibriVox'un kamu malı sesli kitaplarından) dev-clean bölümünden alınır: bir okurun iki üç cümlesi art arda konur
(10-14 sn). Sonra Praat'ın "Change gender" işlemiyle gırtlak rengi (formant oranı) ve perdesi değiştirilir:
çıkan ses okurun kendi sesinin aynısı değil, yaşına ve yapısına göre yeni bir karakter sesidir (<1 oran daha iri ve
yaşlı, >1 daha genç). Kaynaklar ve değişiklikler audio/vo/KAYNAKLAR.md içinde yazılıdır.

Örnek kayıtlar depodadır; bu araç yalnızca onları yeniden kurmak ya da yeni ses eklemek için gerekir:
    .venv-tts/bin/pip install praat-parselmouth "pyarrow<19"
    .venv-tts/bin/python tools/vo-ref.py            # eksik örnekleri kurar (--force: hepsini)
Veri kümesinin dev-clean parçaları (4 x ~380 MB) ilk çalıştırmada Hugging Face'ten (mythicinfinity/libritts_r)
indirilir (--cache, varsayılan ~/.cache/frontiers-end-voices/libritts_r).
"""
import argparse, io, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'tools' / 'vo-ref'
HF = 'https://huggingface.co/datasets/mythicinfinity/libritts_r/resolve/main/data/dev.clean/'
SHARDS = [f'dev.clean-0000{i}-of-00004.parquet' for i in range(4)]

# ses → (LibriTTS-R okuru, cümleler, formant oranı, yeni perde ortancası Hz, perde aralığı katsayısı, kim)
VOICES = {
    'sully': ('652', ['652_130737_000012_000000', '652_129742_000010_000003', '652_130737_000035_000000'], 0.95, 100, 1.0, 'Dunham Sully: yaşlı çiftçi'),
    'pa': ('6295', ['6295_64301_000007_000003', '6295_244435_000032_000000'], 0.96, 104, 1.1, 'baba (Çiftçi Çocuğu)'),
    'hollis': ('3752', ['3752_4943_000029_000002', '3752_4943_000018_000001'], 0.94, 98, 1.0, 'Hollis Crane: yaşlı kanun kaçağı'),
    'silas': ('8297', ['8297_275155_000022_000002', '8297_275155_000029_000001'], 1.04, 112, 1.0, 'Silas Vance'),
    'walt': ('6241', ['6241_61943_000032_000000', '6241_61943_000006_000000'], 0.95, 108, 1.0, 'Walt Boone: ustabaşı'),
    'mick': ('777', ['777_126732_000074_000000', '777_126732_000076_000000'], 1.04, 125, 1.0, 'Mick'),
    'sven': ('5536', ['5536_43359_000005_000002', '5536_43358_000011_000000'], 0.96, 104, 1.0, 'Sven'),
    'greta': ('6313', ['6313_66125_000061_000000', '6313_76958_000047_000000'], 0.97, 176, 1.0, 'Greta Halvorsen'),
    'anton': ('5694', ['5694_64038_000024_000025', '5694_64038_000024_000002'], 1.03, 132, 1.0, 'Anton, ağabey'),
    'sheriff': ('2086', ['2086_149220_000035_000000', '2086_149220_000046_000000'], 0.95, 112, 1.0, 'şerif'),
    'elias': ('3000', ['3000_15664_000013_000001', '3000_15664_000002_000003'], 0.95, 98, 1.0, 'Elias Crowe: yaşlı tuzakçı'),
    'abel': ('1272', ['1272_141231_000022_000000', '1272_135031_000053_000002', '1272_141231_000019_000000'], 0.95, 112, 1.0, 'Abel, baba (Tuzakçı)'),
    'player_m': ('251', ['251_137823_000051_000001', '251_137823_000025_000002'], 1.05, 142, 1.0, 'oyuncu (erkek)'),
    'player_f': ('1462', ['1462_170142_000038_000006', '1462_170145_000008_000003'], 1.05, 215, 1.0, 'oyuncu (kadın)'),
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=str(Path.home() / '.cache' / 'frontiers-end-voices' / 'libritts_r'))
    ap.add_argument('--force', action='store_true', help='var olan örnekleri de yeniden kur')
    args = ap.parse_args()
    import numpy as np
    import soundfile as sf
    import pyarrow.parquet as pq
    import parselmouth
    from parselmouth.praat import call

    todo = {k: v for k, v in VOICES.items() if args.force or not (REF / f'{k}.ogg').exists()}
    if not todo:
        print('örnekler hazır')
        return
    want = {u for v in todo.values() for u in v[1]}
    cache, clips = Path(args.cache).expanduser(), {}
    for s in SHARDS:
        p = cache / s
        if not p.exists():
            print(f'  indiriliyor: {s}', flush=True)
            fetch(HF + s, p)
        t = pq.read_table(p, columns=['id', 'audio'])
        for r in t.to_pylist():
            if r['id'] in want:
                clips[r['id']] = sf.read(io.BytesIO(r['audio']['bytes']), dtype='float64')
    REF.mkdir(parents=True, exist_ok=True)
    for name, (spk, utts, fr, f0, rng, who) in todo.items():
        miss = [u for u in utts if u not in clips]
        if miss:
            sys.exit(f'{name}: veri kümesinde bulunamadı: {miss}')
        sr = clips[utts[0]][1]
        parts = []
        for u in utts:
            parts += [clips[u][0], np.zeros(int(sr * 0.25))]
        y = np.concatenate(parts[:-1])
        snd = call(parselmouth.Sound(y / np.abs(y).max() * 0.9, sampling_frequency=sr), 'Change gender', 60, 450, fr, f0, rng, 1.0)
        z = snd.values[0]
        z = z / max(1e-9, np.abs(z).max()) * 0.9
        sf.write(str(REF / f'{name}.ogg'), z.astype(np.float32), int(snd.sampling_frequency), format='OGG', subtype='VORBIS', compression_level=0.1)
        print(f'{name:<9} {len(z) / snd.sampling_frequency:5.1f} sn  okur {spk}, formant x{fr}, perde {f0} Hz  ({who})', flush=True)


if __name__ == '__main__':
    main()
