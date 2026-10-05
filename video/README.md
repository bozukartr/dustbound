# Açılış videosu

Oyun her açıldığında ana menüden önce bu klasördeki `intro.mp4` (yoksa `intro.webm`) tam ekran oynar.
Herhangi bir tuş, tıklama ya da kol tuşu videoyu geçer; dosya yoksa oyun doğrudan menüyle açılır.

- Biçim: MP4 (H.264 + AAC) ya da WebM (VP9 + Opus). 1080p ya da 720p, 15–40 sn önerilir.
- Telefondan yüklenen başka biçimler (ör. iPhone .MOV) önce MP4'e dönüştürülmelidir.
- Masaüstü paketi (`desktop/scripts/prepare.js`) ve demo paketi (`npm run build:demo`) bu klasörü kopyalar.
