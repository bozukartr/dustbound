# Seslendirme kaynakları

Yalnızca **sinematik** satırları seslendirilir (açılış ve bölüm sinematikleri); oyun içi konuşmalar altyazıyla kalır.
Şimdilik yalnızca İngilizce kayıt var: oyun dili Türkçe olsa da satırın İngilizce kaydı çalar (altyazı Türkçe kalır).

## İngilizce (`en/`): yapay ses

İngilizce kayıtlar `tools/vo-tts.py` aracıyla [Chatterbox Turbo](https://github.com/resemble-ai/chatterbox) (Resemble AI,
**MIT lisansı**) metinden sese modeliyle üretildi. Chatterbox her karakterin sesini kısa bir örnek kayıttan kopyalar
ve ürettiği her kayda duyulmayan bir yapay ses filigranı (Perth) ekler. Bu sesler yapaydır; hiçbir satırı gerçek bir
seslendirme sanatçısı okumadı.

**Karakter sesleri.** Her karakterin örnek kaydı (`tools/vo-ref/<ses>.ogg`, `tools/vo-ref.py` kurar)
[LibriTTS-R](https://www.openslr.org/141/) veri kümesinin (**CC BY 4.0**) dev-clean bölümünden bir okurun iki üç
cümlesidir. Bu kayıtların gırtlak rengi (formant oranı) ve perdesi Praat ile değiştirildi: karakter sesleri okurların
kendi seslerinin aynısı değil, karakterin yaşına ve yapısına göre kurulmuş yeni seslerdir.

| Ses | Kim konuşuyor | LibriTTS-R okuru (cümleler) | Değişiklik |
|---|---|---|---|
| `sully` | Dunham Sully: yaşlı çiftçi | 652 (`652_130737_000012_000000`, `652_129742_000010_000003`, `652_130737_000035_000000`) | formant ×0.95, perde 100 Hz |
| `pa` | baba (Çiftçi Çocuğu) | 6295 (`6295_64301_000007_000003`, `6295_244435_000032_000000`) | formant ×0.96, perde 104 Hz, perde aralığı ×1.1 |
| `hollis` | Hollis Crane: yaşlı kanun kaçağı | 3752 (`3752_4943_000029_000002`, `3752_4943_000018_000001`) | formant ×0.94, perde 98 Hz |
| `silas` | Silas Vance | 8297 (`8297_275155_000022_000002`, `8297_275155_000029_000001`) | formant ×1.04, perde 112 Hz |
| `walt` | Walt Boone: ustabaşı | 6241 (`6241_61943_000032_000000`, `6241_61943_000006_000000`) | formant ×0.95, perde 108 Hz |
| `mick` | Mick | 777 (`777_126732_000074_000000`, `777_126732_000076_000000`) | formant ×1.04, perde 125 Hz |
| `sven` | Sven | 5536 (`5536_43359_000005_000002`, `5536_43358_000011_000000`) | formant ×0.96, perde 104 Hz |
| `greta` | Greta Halvorsen | 6313 (`6313_66125_000061_000000`, `6313_76958_000047_000000`) | formant ×0.97, perde 176 Hz |
| `anton` | Anton, ağabey | 5694 (`5694_64038_000024_000025`, `5694_64038_000024_000002`) | formant ×1.03, perde 132 Hz |
| `sheriff` | şerif | 2086 (`2086_149220_000035_000000`, `2086_149220_000046_000000`) | formant ×0.95, perde 112 Hz |
| `elias` | Elias Crowe: yaşlı tuzakçı | 3000 (`3000_15664_000013_000001`, `3000_15664_000002_000003`) | formant ×0.95, perde 98 Hz |
| `abel` | Abel, baba (Tuzakçı) | 1272 (`1272_141231_000022_000000`, `1272_135031_000053_000002`, `1272_141231_000019_000000`) | formant ×0.95, perde 112 Hz |
| `player_m` | oyuncu (erkek) | 251 (`251_137823_000051_000001`, `251_137823_000025_000002`) | formant ×1.05, perde 142 Hz |
| `player_f` | oyuncu (kadın) | 1462 (`1462_170142_000038_000006`, `1462_170145_000008_000003`) | formant ×1.05, perde 215 Hz |

**Atıf (CC BY 4.0):** Bu oyundaki İngilizce karakter sesleri, *LibriTTS-R: A Restored Multi-Speaker Text-to-Speech
Corpus* (Y. Koizumi, H. Zen, S. Karita, Y. Ding, K. Yatabe, N. Morioka, M. Bacchiani, Y. Zhang, W. Han, A. Bapna;
Google, 2023) veri kümesindeki kayıtlardan türetilmiştir. Veri kümesi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
lisanslıdır; *LibriTTS* (H. Zen ve ark., Google, 2019, CC BY 4.0) üzerinden LibriVox'un kamu malı sesli kitap
kayıtlarından türetilmiştir. Değişiklikler: kayıtlar kesilip birleştirildi, gırtlak rengi ve perdesi değiştirildi,
yapay sesle üretilen satırlar kesilip düzeyi eşitlendi.

Kayıtlar 24 kHz, tek kanal. Baştaki ve sondaki sessizlik kırpıldı, düzey eşitlendi, `.ogg` (Vorbis) ve `.mp3` yazıldı.
Her satır en çok üç aday arasından seçildi: konuşma tanıma (faster-whisper small.en) metni doğru duymalı, sonra
doğallık tahmini (UTMOS) en yüksek olan alınır.

## Türkçe (`tr/`): kayda hazır

Türkçe kayıt henüz yok; Türkçe oyunda satırların İngilizce kayıtları çalar. Türkçe sinematik senaryosu
`script_tr.csv` dosyasındadır: dosya adı, hikâye, sinematik, konuşan, ekrandaki metin ve okunuş. Oyuncunun satırları iki
kayıttır, `<anahtar>.m` (erkek oyuncu) ve `<anahtar>.f` (kadın oyuncu). Kayıtlar `tr/<anahtar>.ogg` olarak bu klasöre
konup `node tools/vo-script.js` çalıştırılınca oyun Türkçede onları çalar (kaydı olmayan satırda yine İngilizce kayıt).
