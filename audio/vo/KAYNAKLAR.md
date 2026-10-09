# Seslendirme kaynakları

Yalnızca **sinematik** satırları seslendirilir (açılış ve bölüm sinematikleri); oyun içi konuşmalar altyazıyla kalır.

## İngilizce (`en/`): yapay ses

İngilizce kayıtlar [Piper](https://github.com/OHF-Voice/piper1-gpl) metinden sese motoruyla `tools/vo-tts.py` aracıyla üretildi.
Yalnızca **kamu malı ya da CC BY** verilerle **sıfırdan eğitilmiş** ses modelleri kullanıldı. Lisansı ticari kullanıma kapalı
(NC) ya da kökeni belirsiz (lessac tabanlı) modeller kullanılmadı. Piper motorunun kendi lisansı yalnızca aracı ilgilendirir,
üretilen ses dosyalarına geçmez.

| Ses modeli | Kaynak veri | Lisans | Kim konuşuyor |
|---|---|---|---|
| [en_US-john-medium](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/john/medium) | LibriVox kayıtları (Bryce Beattie, kristin modelinden) | Kamu malı | Oyuncu (erkek) |
| [en_US-bryce-medium](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/bryce/medium) | Bryce Beattie'nin kendi sesi | Kamu malı | Walt Boone |
| [en_US-ljspeech-high](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech/high) | [LJ Speech](https://keithito.com/LJ-Speech-Dataset/) | Kamu malı | Oyuncu (kadın) |
| [en_GB-cori-high](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/cori/high) | LibriVox kayıtları (Bryce Beattie, sıfırdan eğitim) | Kamu malı | Greta Halvorsen |
| [en_US-libritts-high](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/libritts/high) | [LibriTTS](http://www.openslr.org/60/) (train-clean-360, sıfırdan eğitim) | **CC BY 4.0** | Dunham Sully (136), baba (595), Hollis Crane (846), Silas Vance (105), Mick (92), Sven (406), Anton (633), şerif (47), Elias Crowe (548), Abel (49) |

**Atıf (CC BY 4.0):** Bu oyundaki bazı İngilizce sesler, *LibriTTS: A Corpus Derived from LibriSpeech for Text-to-Speech*
(H. Zen, V. Dang, R. Clark, Y. Zhang, R. J. Weiss, Y. Jia, Z. Chen, Y. Wu; Google, 2019) veri kümesiyle eğitilmiş
`en_US-libritts-high` Piper modeliyle üretilmiştir. Veri kümesi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
lisanslıdır ve LibriVox'un kamu malı kayıtlarından türetilmiştir. Üretilen sesler kesilip düzeyi eşitlenerek değiştirilmiştir.

Ayraç içindeki sayılar çok konuşmacılı modeldeki konuşmacı numarasıdır. Kayıtlar 22.05 kHz, tek kanal. Baştaki ve sondaki
sessizlik kırpıldı, düzey eşitlendi, `.ogg` (Vorbis) ve `.mp3` yazıldı. Her satır en çok dört aday arasından konuşma
tanımayla (faster-whisper small.en) metne en yakın olanı seçilerek üretildi.

## Türkçe (`tr/`): kayda hazır

Lisansı uygun bir Türkçe ses modeli yok. Türkçe sinematik senaryosu `script_tr.csv` dosyasındadır: dosya adı, hikâye,
sinematik, konuşan, ekrandaki metin ve okunuş. Oyuncunun satırları iki kayıttır, `<anahtar>.m` (erkek oyuncu) ve
`<anahtar>.f` (kadın oyuncu). Kayıtlar `tr/<anahtar>.ogg` olarak bu klasöre konup `node tools/vo-script.js` çalıştırılınca
oyun onları çalar.
