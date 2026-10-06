# Açılış videosu

Oyun her açıldığında ana menüden önce bu klasördeki `intro.mp4` (yoksa `intro.webm`) tam ekran oynar.
Herhangi bir tuş, tıklama ya da kol tuşu videoyu geçer; dosya yoksa oyun doğrudan menüyle açılır.

- Biçim: MP4 (H.264 + AAC) ya da WebM (VP9 + Opus). 1080p ya da 720p, 15–40 sn önerilir.
- Telefondan yüklenen başka biçimler (ör. iPhone .MOV) önce MP4'e dönüştürülmelidir.
- Masaüstü paketi (`desktop/scripts/prepare.js`) ve demo paketi (`npm run build:demo`) bu klasörü kopyalar.

# Ana menü videosu

Ana menünün arka planında `menu.mp4` (yoksa `menu.webm`) sessiz döngü olarak oynar. Dosya yoksa ya da açılamazsa menü çizilen piksel sahneyle açılır.

`menu.jpg` videonun ilk karesidir: video henüz yüklenmemişken menüde o görünür. Videoyu değiştirirsen ilk karesini de yeniden çıkar:

```
ffmpeg -i menu.mp4 -frames:v 1 -q:v 4 menu.jpg
```

- Biçim: MP4 (H.264, sessiz) ve WebM (VP9, sessiz) yedeği; 1080p, 30 kare/sn. Ses izi yoktur (menünün müziği oyundan gelir).
- Döngü dikişsiz olmalı: dosyanın son karesi ilk karesine doğal biçimde bağlanmalı. Mevcut dosya, kapanış kartı kesilmiş 12 saniyelik kayıttan karıştırma yapılmadan olduğu gibi üretildi:

```
ffmpeg -i kayit.mov -vf "fps=30,format=yuv420p" -an -r 30 -c:v libx264 -preset slow -crf 22 -movflags +faststart menu.mp4
ffmpeg -i menu.mp4 -an -c:v libvpx-vp9 -crf 30 -b:v 0 -row-mt 1 menu.webm
```

`menu.jpg` videonun ilk karesidir: video henüz yüklenmemişken menüde o görünür. Videoyu değiştirirsen ilk karesini de yeniden çıkar:

```
ffmpeg -i menu.mp4 -frames:v 1 -q:v 4 menu.jpg
```

- Biçim: MP4 (H.264, sessiz) ve WebM (VP9, sessiz) yedeği; 1080p, 30 kare/sn. Ses izi yoktur (menünün müziği oyundan gelir).
- Döngü dikişsiz olmalı: dosyanın sonu başına karışmalı. Mevcut dosya, kaydın ilk 12 saniyesinden (sondaki uygulama kapanış kartı kesildi) son 1,5 saniyeyi başın üzerine karıştırarak üretildi:

```
ffmpeg -i kayit.mov -filter_complex "[0:v]fps=30,trim=start_frame=0:end_frame=360,setpts=N/30/TB,format=yuv444p,split=3[a][b][c];[a]trim=start_frame=0:end_frame=45,setpts=N/30/TB[head];[b]trim=start_frame=45:end_frame=315,setpts=N/30/TB[body];[c]trim=start_frame=315:end_frame=360,setpts=N/30/TB[tail];[tail][head]blend=all_expr='A*(1-N/45)+B*(N/45)'[blend];[blend][body]concat=n=2:v=1:a=0,format=yuv420p[v]" -map "[v]" -an -r 30 -c:v libx264 -preset slow -crf 22 -movflags +faststart menu.mp4
ffmpeg -i menu.mp4 -an -c:v libvpx-vp9 -crf 30 -b:v 0 -row-mt 1 menu.webm
```
