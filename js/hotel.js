'use strict';
/* ==========================================================
   FRONTIER'S END — otel: iki kat ve oda kiralama (G nesnesine eklenir)
   (iki kat altyapısı malikane ve kulüpte de kullanılır: merdiven, kat değişimi, üst kat odaları)
   - Zemin kat lobidir: girişin karşısında ortada resepsiyon, iki arka köşede üst kata
     merdiven, önde oturma köşeleri. Merdivenden yürüyerek çıkılır ve inilir.
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
    this.hintOnce('hotel', Tr('Odan üst katta: merdivenden yürüyerek çık, odadaki yatakta uyuyabilirsin. Kira bir gün sürer.'), 8);
    this.qEvent('rent', b);
    return true;
  },
  /* Merdiven: merdivenin şeridinde kuzey ucuna kadar yürüyünce öbür kata geçilir (zemin katta merdiveni çıkarsın, üst
     katta merdiven boşluğundan inersin). İki katlı her yapıda (otel, malikane, kulüp) aynı; merdiven sütunları üst kat
     planından gelir. Aranırken ya da omzunda yükle yukarı çıkılmaz: bir adım geri itilirsin. */
  hotelStairsTick() {
    const P = this.player, b = this.insideB, UP = upPlan(b);
    if (!UP || P.riding || UI.state === 'fade') return;
    const lx = (P.x - b.x * TS) / TS, ly = (P.y - b.y * TS) / TS;
    const onL = lx < 2 && UP.stairs.includes(1), onR = lx >= b.w - 2 && UP.stairs.includes(b.w - 2);
    if (!(onL || onR) || ly < 1 || ly >= 1.65) return;   // merdiven şeridinin kuzey ucunda değil
    const up = b.floor !== 1;
    if (up && (this.law.level > 0 || P.carry)) {
      P.y = (b.y + 2) * TS + 8; P.vx = P.vy = 0;
      if (!(this.t < this._stairWarnT)) { UI.feed(this.law.level > 0 ? (b.type === 'hotel' ? Tr('"Kanun peşindeyken yukarı çıkamazsın!" diye bağırıyor resepsiyondaki.') : Tr('Kanun peşindeyken yukarı çıkıp saklanamazsın.')) : Tr('Omzunda yükle merdiveni çıkamazsın.'), 'warn'); this._stairWarnT = this.t + 3; }
      return;
    }
    this.hotelStairs(b, up ? 1 : 0);
  },
  /* Kısa bir kararmayla öbür kata geç: öbür katta merdivenin güney ucunda, merdivenden çıkış yönüne (güneye) bakarak
     durursun. Basılı tutulan yön seni merdivene geri sokmasın diye tuş bırakılana kadar kuzeye yürünmez (stairLatch). */
  hotelStairs(b, lv) {
    const P = this.player;
    UI.fade(() => {
      this.setFloor(b, lv);
      P.y = (b.y + 3) * TS + 8; P.vx = P.vy = 0; P.ang = Math.PI / 2; P.mv = 0;
      this.stairLatch = true;
      this.cam.x = P.x; this.cam.y = P.y;
      Audio_.step(0.4, true);
    }, '', true);
  },
  /* Kat değiştir: binanın iç mekânı, çarpışması ve çizimi o katınki olur; üst kattayken alt kattakiler gizlenir */
  setFloor(b, lv) {
    if (!this.world.setFloor(b, lv, b.type === 'hotel' ? this.hotelRoom(b) : -1)) return false;
    this.upB = lv ? b : null;
    if (typeof Bubbles !== 'undefined') Bubbles.clear();
    if (lv && b.type === 'hotel') this.hintOnce('hotelup', this.hotelRoom(b) >= 0 ? Tr`Kiraladığın odanın kapısı açık. Yatağa yaklaşıp ${Input.glyph('interact')} ile uyuyabilirsin.` : Tr('Odalar kilitli. Oda kiralamak için aşağıdaki resepsiyona git.'), 6);
    return true;
  },
  /* İki katlı yapının üst katında bir yerel karonun bulunduğu oda (koridor ve merdivende -1) */
  upRoomAt(b, lx, ly) {
    const UP = upPlan(b);
    if (!UP || b.floor !== 1) return -1;
    return UP.rooms.findIndex(R => lx >= R.area[0] && lx <= R.area[2] && ly >= R.area[1] && ly <= R.area[3]);
  },
  /* Üst katta eşya (karo i) oyuncuyla aynı odada mı: duvarın öbür yanındaki eşya kullanılmaz (kapılar hariç) */
  upSameRoom(b, i) {
    if (!upPlan(b) || b.floor !== 1) return true;
    const P = this.player;
    return this.upRoomAt(b, (i % WW) - b.x, Math.floor(i / WW) - b.y) === this.upRoomAt(b, Math.floor(P.x / TS) - b.x, Math.floor(P.y / TS) - b.y);
  },
  /* Oyuncu otelin üst katındayken bu nokta o binanın içinde mi (oyuncunun yanında bu, üst kattaki bir nokta demektir) */
  upAt(x, y) {
    const B = this.upB;
    return !!B && x >= B.x * TS && x < (B.x + B.w) * TS && y >= B.y * TS && y < (B.y + B.h) * TS;
  },
  /* Üst kattayken alt kattaki (binanın içindeki) varlıklar görünmez, etkileşilmez, beklemede kalır; vurulamaz,
     hiçbir şey görmez (tanık olmaz, ceset bulmaz) */
  floorHid(e) {
    if (!this.upB || !e || e === this.player || (this.player && e === this.player.carry)) return false;
    return this.upAt(e.x, e.y);
  },
  /* Üst kattan başka bir yolla çıkılınca (ölüm, ışınlanma, yolculuk) bina zemin katına döner */
  floorTick() {
    const B = this.upB;
    if (B && this.world.buildingAtPx(this.player.x, this.player.y) !== B) this.setFloor(B, 0);
  },
};
