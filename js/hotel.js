'use strict';
/* ==========================================================
   FRONTIER'S END — otel: iki kat ve oda kiralama (G nesnesine eklenir)
   - Zemin kat lobidir: girişin karşısında ortada resepsiyon, iki arka köşede üst kata
     merdiven, önde oturma köşeleri.
   - Üst katta dört oda vardır. Bazıları o gece başka konuklarla doludur; boş odalar da
     kilitlidir, yalnızca resepsiyondan kiralanan odanın kapısı açılır. Otel oyuncunun
     işletmesiyse oda ücretsizdir. Uyumak için üst kata çıkılır, odadaki yatakta uyunur.
   - Kat değişince binanın iç mekânı o katınkiyle değişir (World.setFloor); üst kattayken
     alt kattaki kişiler görünmez ve beklemede kalır (floorHid).
   ========================================================== */
const HotelSystems = {
  /* Bu otelde geçerli kiralık odan varsa oda sırası (0-3), yoksa -1 */
  hotelRoom(b) { const R = this.hotelRent; return R && b && R.b === b.id && this.clock < R.until ? R.room : -1; },
  /* O gece dolu odalar otele ve güne bağlıdır (her oyunda aynı): 1-3 oda dolu, en az biri hep boş; senin odan dolu sayılmaz */
  hotelOccupied(b, k) {
    if (k === this.hotelRoom(b)) return false;
    const n = 1 + Math.floor(hash2(b.id, this.day, 431) * 3);
    const order = [0, 1, 2, 3].sort((a, c) => hash2(b.id * 4 + a, this.day, 433) - hash2(b.id * 4 + c, this.day, 433));
    return order.indexOf(k) < n;
  },
  hotelFree(b) { return [0, 1, 2, 3].filter(k => !this.hotelOccupied(b, k)); },
  /* Üst kattaki bir karo hangi odanın kapısı ya da yatağı: oda sırası, yoksa -1 */
  hotelRoomAt(b, i, part) {
    const lx = (i % WW) - b.x, ly = Math.floor(i / WW) - b.y;
    return HOTEL_UP.rooms.findIndex(R => R[part][0] === lx && R[part][1] === ly);
  },
  /* Oyuncu üst kattaki k odasının içinde mi (yatak duvarın öbür yanından kullanılmasın) */
  hotelInRoom(b, k) {
    const R = HOTEL_UP.rooms[k], P = this.player;
    if (!R || b.floor !== 1) return false;
    const lx = Math.floor(P.x / TS) - b.x, ly = Math.floor(P.y / TS) - b.y, A = R.area;
    return lx >= A[0] && lx <= A[2] && ly >= A[1] && ly <= A[3];
  },
  /* Resepsiyondan oda kirala: ödeme (kendi otelinde ya da hikâyede ücretsiz), boş bir oda; kapısı yalnızca sana açılır.
     Kira bir gün sürer. */
  rentRoom(b, free) {
    if (!isHotel2(b)) return false;
    const has = this.hotelRoom(b);
    if (has >= 0) { UI.feed(Tr`🔑 ${has + 1} numaralı oda zaten senin. Merdivenden üst kata çık.`); return true; }
    const own = !!this.bizOf(b), cost = own || free ? 0 : SVC.room * this.priceMul(true);
    const fr = this.hotelFree(b);
    if (!fr.length) { UI.feed(Tr('Bu gece bütün odalar dolu.'), 'warn'); return false; }
    if (cost && !this.spend(cost)) return false;
    const k = fr[0];
    this.hotelRent = { b: b.id, room: k, until: this.clock + 24 * 60 };
    if (cost) Audio_.ui('cash');
    UI.feed(own ? Tr`🔑 Kendi otelin: ${k + 1} numaralı oda senin, ücret yok.` : free ? Tr`🔑 ${k + 1} numaralı oda senin.` : Tr`🔑 ${k + 1} numaralı odayı kiraladın (${fmtMoney(cost)}). Kapısı yalnızca sana açık.`);
    this.hintOnce('hotel', Tr`Odan üst katta. Merdivene yaklaş ve ${Input.glyph('interact')} ile çık; odadaki yatakta uyuyabilirsin. Kira bir gün sürer.`, 8);
    this.qEvent('rent', b);
    return true;
  },
  /* Merdiven: kısa bir kararmayla öbür kata geçilir; oyuncu merdivenin dibindeki karoya iner (iki katta aynı yer) */
  hotelStairs(b, i) {
    const P = this.player;
    if (P.riding || P.carry) { UI.feed(Tr('Bu hâlde merdivenden çıkamazsın.'), 'warn'); return; }
    const lv = b.floor === 1 ? 0 : 1, L = HOTEL_UP.land[(i % WW) - b.x < b.w / 2 ? 0 : 1];
    // aranırken odalara saklanılmaz (inmek her zaman serbest)
    if (lv && this.law.level > 0) { UI.feed(Tr('"Kanun peşindeyken yukarı çıkamazsın!" diye bağırıyor resepsiyondaki.'), 'warn'); return; }
    UI.fade(() => {
      this.setFloor(b, lv);
      P.x = (b.x + L[0]) * TS + 8; P.y = (b.y + L[1]) * TS + 8; P.ang = Math.PI / 2; P.mv = 0;
      this.cam.x = P.x; this.cam.y = P.y;
      Audio_.step(0.4, true);
    }, '', true);
  },
  /* Kat değiştir: binanın iç mekânı, çarpışması ve çizimi o katınki olur; üst kattayken alt kattakiler gizlenir */
  setFloor(b, lv) {
    if (!this.world.setFloor(b, lv, this.hotelRoom(b))) return false;
    this.upB = lv ? b : null;
    if (typeof Bubbles !== 'undefined') Bubbles.clear();
    if (lv) this.hintOnce('hotelup', this.hotelRoom(b) >= 0 ? Tr`Kiraladığın odanın kapısı açık. Yatağa yaklaşıp ${Input.glyph('interact')} ile uyuyabilirsin.` : Tr('Odalar kilitli. Oda kiralamak için aşağıdaki resepsiyona git.'), 6);
    return true;
  },
  /* Üst kattayken alt kattaki (binanın içindeki) varlıklar görünmez, etkileşilmez, beklemede kalır */
  floorHid(e) {
    const B = this.upB;
    if (!B || !e || e === this.player || (this.player && e === this.player.carry)) return false;
    return e.x >= B.x * TS && e.x < (B.x + B.w) * TS && e.y >= B.y * TS && e.y < (B.y + B.h) * TS;
  },
  /* Üst kattan başka bir yolla çıkılınca (ölüm, ışınlanma, yolculuk) bina zemin katına döner */
  floorTick() {
    const B = this.upB;
    if (B && this.world.buildingAtPx(this.player.x, this.player.y) !== B) this.setFloor(B, 0);
  },
};
