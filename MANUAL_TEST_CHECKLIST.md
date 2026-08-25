# BlackBox Fight Lab — Manuel Donanım Test Kontrol Listesi

Bu liste, gerçek webcam ve fiziksel kullanıcı gerektiren ve bu geliştirme ortamında otomatik olarak doğrulanamayan bütün MANUAL_HARDWARE_GATE maddelerini tek bir fiziksel test oturumunda toplu yürütmek içindir. Gate durumları için bkz. `19_FULL_ACCEPTANCE_GATES.md`.

**Hiçbir madde, gerçekten çalıştırılmadan işaretlenmemelidir.** Bu liste doğrulanmış gibi davranmak, kabul kaydını geçersiz kılar.

## Hazırlık

- Güncel Chrome ve güncel Edge, gerçek webcam bağlı, HTTPS veya localhost.
- Sırayla: `/araclar/kamera-fight-lab`
- Her protokolde en az bir tam seans (20 veya 12 trial) tamamla; `?debug=1` ile diagnostics açık test tekrarı da yap.
- Farklı boy/kol uzunluğu ve farklı ışık koşuluyla en az bir kez tekrar et (tek kişiye göre eşik sabitlenmemiş olmalı).

## Phase 0 — Core Measurement (Full Reaction)

- [ ] Kalibrasyon: tek kişi, omuz/bilek görünürlüğü, üst gövde framing, guard pozisyonu doğru reddediyor/kabul ediyor mu?
- [ ] Skeleton/hedef hizalaması: debug modunda çizilen iskelet gerçek vücutla örtüşüyor mu?
- [ ] Gerçek yumrukla T0/T1/T2 mantıklı mı (reaction ~150–400ms aralığında, movement kısa)?
- [ ] Erken hareket (premature) doğru reddediliyor mu?
- [ ] Yavaş el yerleştirme `TOO SLOW` / `INVALID_HIT_SPEED` ile reddediliyor mu?
- [ ] Kamerayı elle kapatıp tracking-loss/düşük FPS davranışı kontrollü mü (uygulama çökmüyor, quality flag düşüyor)?
- [ ] JSON export indirilebiliyor ve kamera görüntüsü/video içermiyor mu?

## Phase 1 — Decision Tests

### Choice Reaction

- [ ] Gereken elle (mavi SOL / pembe SAĞ) vuruş `HIT` üretiyor mu?
- [ ] Yanlış elle vuruş `WRONG_HAND` üretiyor mu?
- [ ] Aynalı video, el mantığını tersine çevirmiyor mu (fiziksel sol el her zaman canonical sol olarak mı değerlendiriliyor)?

### Go / No-Go

- [ ] Yeşil VUR hedefinde fiziksel yumruk doğru ölçülüyor mu?
- [ ] Kırmızı DUR hedefinde fiziksel hareket (false attack) doğru yakalanıyor mu?
- [ ] DUR hedefinde tam hareketsizlik `CORRECT_REJECT` üretiyor mu?

### Peripheral Reaction

- [ ] Center, inner-left, inner-right, outer-left, outer-right hedefleri fiziksel olarak erişilebiliyor mu (ekran dışına taşmıyor mu)?
- [ ] Merkez fixation'a bakarken yan hedefe vuruş doğal hissettiriyor mu?

## Phase 2 — Boxing Motion

### Combo Speed

- [ ] L-R, R-L, L-R-L, R-L-R sekansları fiziksel olarak tamamlanabiliyor mu?
- [ ] Yanlış el/sırayla atılan yumruk trial'ı `WRONG_HAND` ile doğru bitiyor mu?
- [ ] Bir yumruktan sonra eli geri çekmeden (retraction yapmadan) hedefte tutmak, ikinci adımı yanlışlıkla tamamlamıyor mu (duplicate contact önleme)?
- [ ] Hedefte gösterilen canlı cue (SOL/SAĞ) her adımda doğru elle güncelleniyor mu?
- [ ] Inter-punch timing (adımlar arası süre) gerçekçi mi?

### Guard Return

- [ ] Gerçek vuruş sonrası ekranda beliren guard halkası, gerçek guard pozisyonuyla görsel olarak hizalı mı?
- [ ] Elini kontrollü biçimde guard'a geri çekmek `RETURNED` ve makul bir T3 süresi üretiyor mu?
- [ ] Eli guard bölgesine sokup hemen çekmek (tek kare geçiş) yanlışlıkla dönüş saymıyor mu?
- [ ] Eli kasıtlı olarak guard'a geri getirmemek `FAILED_RETURN` üretiyor mu?
- [ ] Düşük FPS veya tracking-loss durumunda guard return davranışı kontrollü mü (uygulama takılmıyor, dış güvenlik zaman aşımı çalışıyor)?

## Phase 3 — Defense

### Defense Reflex

- [ ] SOLA SLIP cue'sunda fiziksel olarak sola eğilmek `CORRECT` üretiyor mu?
- [ ] SAĞA SLIP cue'sunda fiziksel olarak sağa eğilmek `CORRECT` üretiyor mu?
- [ ] DUCK cue'sunda fiziksel olarak eğilmek `CORRECT` üretiyor mu?
- [ ] Yanlış yönde hareket (ör. SOLA SLIP cue'sunda sağa eğilmek) `WRONG_DIRECTION` üretiyor mu?
- [ ] Cue'da yazan eylemden hemen sonra nötr pozisyona dönmek stabil `RETURNED`/T3 üretiyor mu; dönmemek `FAILED_RECOVERY` üretiyor mu?
- [ ] Küçük/yetersiz bir hareket `INSUFFICIENT_DISPLACEMENT` olarak mı, yoksa yanlışlıkla `CORRECT` olarak mı işaretleniyor?
- [ ] Hiç hareket etmemek `NO_RESPONSE` üretiyor mu?
- [ ] Aynalı görüntüde "sola" hareket gerçekten ekranda sola görünüyor mu (sporcunun sezgisel beklentisiyle örtüşüyor mu)?
- [ ] Düşük FPS veya tracking-loss durumunda defense davranışı kontrollü mü?

## Ortak regresyon

- [ ] Dört Phase 1 modu + iki Phase 2 modu arasında geçiş yaparken hiçbir konsol hatası oluşmuyor.
- [ ] Hiçbir modda kamera karesi/videosu ağa gönderilmiyor (Network sekmesinde POST/PUT/PATCH yok).
- [ ] Diagnostics panel (`?debug=1`) her modda T0/T1/T2 (ve Guard Return'de T3) değerlerini tutarlı gösteriyor.

## Sonuç kaydı

Bu kontrol listesi tamamlandığında `19_FULL_ACCEPTANCE_GATES.md` içindeki ilgili fazların MANUAL_HARDWARE_GATE satırı `PASS` olarak güncellenmeli ve hangi tarihte, hangi tarayıcı/donanımla yürütüldüğü not edilmelidir. Kısmi tamamlanma `MANUAL_VERIFICATION_PENDING` olarak kalmaya devam eder.

## Faz 9 — davet, hatırlatma, beslenme, analiz, yönetim

Seed hesapları: `yonetici@blackbox.test`, `personel@blackbox.test`,
`uye@blackbox.test` — hepsinin şifresi `test1234`.

### Davetle üye kaydı
- [ ] Antrenör olarak `/personel/uyeler` → ad, e-posta gir → "Ekle ve Davet
      Bağlantısı Üret". Bağlantı kutusu çıkıyor ve adres **tam** (http ile
      başlıyor), göreli değil.
- [ ] "Hazır Mesajı Kopyala" panoya sporcunun adıyla bir metin koyuyor.
- [ ] Bağlantıyı gizli sekmede aç → ad düzenlenebiliyor, e-posta kilitli.
- [ ] 8 karakterden kısa şifre reddediliyor; iki şifre farklıysa uyarıyor.
- [ ] Şifre kurulunca **doğrudan** `/uye` açılıyor (tekrar giriş istemiyor).
- [ ] Aynı bağlantı ikinci kez açılınca "Bağlantı kullanılmış" diyor.
- [ ] `/personel/davetler` hesabını kurmayanları listeliyor; "Yeni Bağlantı
      Üret" eskisini iptal edip yenisini veriyor.

### Ders hatırlatma
- [ ] Sporcu olarak yarına bir ders kap (`/uye/program`).
- [ ] Yönetici olarak `/yonetim/bildirimler` → "Hatırlatmaları Şimdi Çalıştır".
      Sonuç satırında kaç hatırlatma üretildiği yazıyor.
- [ ] Sporcunun `/uye/bildirimler` kutusunda "Yarın … dersin var" görünüyor.
- [ ] Aynı düğmeye tekrar basınca **ikinci kez düşmüyor** (dedupe).
- [ ] Sporcu "Kapat" ile hatırlatmayı kapatınca yeni hatırlatma üretilmiyor.
- [ ] `/personel/bugun` → sporcunun yanındaki "Hatırlat" düğmesi elden
      bildirim gönderiyor ("Gitti" yazısı çıkıyor).
- [ ] Hesabını kurmamış sporcuda "Hatırlatılamaz" görünüyor.

### Günün akışı & yoklama
- [ ] `/personel/bugun` gün gezinmesi (önceki/sonraki/bugün) çalışıyor.
- [ ] "Geldi" işareti antrenman kaydı üretiyor (sporcunun performans kartı
      ve puanı güncelleniyor).
- [ ] "Gelmedi" ders hakkını yakıyor, antrenman kaydı üretmiyor.

### Beslenme
- [ ] `/personel/beslenme` → plan oluştur → plan sayfasına yönlendiriyor.
- [ ] Öğün ve besin ekleniyor; makro alanları boş bırakılabiliyor.
- [ ] Plan "Taslak" iken sporcu görmüyor; "Yayına Al" sonrası görüyor.
- [ ] Gün seçimi yapılmış plan yalnız o günlerde "Bugün" etiketli çıkıyor.
- [ ] Sporcu "Yedim" işaretini koyup geri alabiliyor; sayaç güncelleniyor.

### Sporcu analizi
- [ ] `/personel/uyeler/<id>/analiz` açılıyor; veri yoksa uydurma yüzde
      göstermiyor, "yorum yapacak veri yok" diyor.
- [ ] Her bölümün altında "Kaynak: …" satırı var.
- [ ] Yeni yazılmış beslenme planı "uyumsuz" bayrağı üretmiyor.

### Yönetici paneli
- [ ] Antrenör hesabıyla `/yonetim` açılmıyor, `/personel`'e yönlendiriyor.
- [ ] `/yonetim/paketler` → paket ekleme, güncelleme, satıştan kaldırma.
- [ ] `/yonetim/kadro` → antrenör daveti, rol değiştirme; **son yönetici**
      rolünü bırakamıyor ve hesabını kapatamıyor.
- [ ] `/yonetim/raporlar` → 7/30/90 gün aralıkları, saat ve gün dağılımı.

## Faz 12 — koç kapsamı, tahsilat ve muhasebe

Bu bölüm **iki antrenör hesabı** gerektirir (A ve B) — kapsam ayrımı tek
hesapla kanıtlanamaz. `/yonetim/kadro` ekranından ikinci bir antrenör davet et ve davet
bağlantısından şifresini kur.

### Görünürlük kapsamı (en kritik)
- [ ] A antrenörü sporcu eklediğinde sporcu **kendiliğinden A'ya** atanıyor.
- [ ] B antrenörü `/personel/uyeler` listesinde A'nın sporcusunu **görmüyor**.
- [ ] B, A'nın sporcusunun detay adresini (`/personel/uyeler/<id>`) elle
      yazınca **404** alıyor (adres bilse bile açamıyor).
- [ ] B'nin `/personel` genel bakış sayaçları yalnız kendi sporcularını sayıyor.
- [ ] B'nin menü rozetleri (check-in, davet, onam, kuşak) A'nın sporcularından
      beslenmiyor.
- [ ] `/personel/program` her antrenöre **yalnız kendi açtığı** saatleri
      gösteriyor; yoklama ve katılım istekleri de öyle.
- [ ] Yönetici `/personel/uyeler` ekranında **hepsini** görüyor ve her satırda
      sorumlu antrenör yazıyor.
- [ ] `/yonetim/uyeler` satırındaki açılır menüden devir yapılınca sporcu
      eski antrenörün listesinden düşüyor, yenisinde çıkıyor.

### Hakediş ayarı
- [ ] `/yonetim/kadro` → antrenör satırındaki "Hakediş" bölümü açılıyor.
- [ ] Model "Ders başı" seçilince yalnız ders başı alanı, "Karma" seçilince
      üçü birden görünüyor.
- [ ] Tutar boş bırakılıp kaydedilirse hata veriyor ("Ders başı ücret girilmeli").
- [ ] Yüzde alanına 101 yazılırsa reddediyor.
- [ ] Kaydedilen ayar satır başlığında özet olarak görünüyor.

### Tahsilat ve borç
- [ ] `/personel/uyelikler` → üyelik başlatırken anlaşılan tutar paketin
      fiyatıyla doluyor; düşürülebiliyor.
- [ ] "Şimdi alınan" boş bırakılınca üyelik satırında **borç** görünüyor.
- [ ] Peşinat girilince satırda "kısmi ödeme" ve kalan tutar görünüyor.
- [ ] `/personel/kasa` → A antrenörü yalnız **kendi** sporcularını listeliyor;
      B'nin sporcusu açılır menüde yok.
- [ ] Tahsilat girilince sporcu detayındaki ödeme çubuğu ilerliyor.
- [ ] Üyelik süresi geçmiş ve borcu olan kayıt **"Gecikmiş"** görünüyor.

### Antrenör hakedişi
- [ ] Gelir payı tanımlı antrenörün sporcusundan tahsilat girilince hakediş
      satırı doğuyor (tutar = tahsilatın yüzdesi).
- [ ] Ders başı ücret tanımlıyken yoklama işaretlenince hakediş doğuyor;
      **grup dersinde ikinci sporcuyu işaretlemek ikinci ödeme üretmiyor**.
- [ ] "Gelmedi" işareti de hakediş üretiyor (salon saati tuttu).
- [ ] Seans iptal edilince ödenmemiş ders hakedişi siliniyor.
- [ ] `/yonetim/muhasebe/hakedis` → "Maaşları İşle" iki kez basılınca ikinci
      kez tahakkuk **yazmıyor**.
- [ ] "Öde" düğmesi hakedişleri "Ödendi" yapıyor ve `/yonetim/muhasebe/giderler`
      listesinde "hakediş" kaleminde gider çıkıyor.
- [ ] Otomatik doğan hakediş gideri elle **silinemiyor**.

### Kasa ve dönemler
- [ ] `/yonetim/muhasebe` → Günlük/Haftalık/Aylık geçişleri çalışıyor.
- [ ] "‹" ile önceki döneme gidiliyor, "›" bugünden ileri gitmiyor.
- [ ] Gece yarısından hemen sonra girilen tahsilat **ertesi güne** düşüyor
      (salon saati, UTC değil).
- [ ] Net = gelir − gider; zarar durumunda kart kırmızı vurguyla çıkıyor.
- [ ] `/yonetim/muhasebe/giderler` → sabit gider ekleniyor; "Bu Ayı İşle"
      ikinci kez basılınca mükerrer kayıt oluşmuyor.
- [ ] Antrenör hesabıyla `/yonetim/muhasebe` açılmıyor.

## Faz 13 — personel daveti ve antrenman şablonu düzenleyici

### Kadroya davet (şifreyi personel kurar)
- [ ] `/yonetim/kadro` → "Kadroya Davet Et" formunda **şifre alanı yok**.
- [ ] Ad, e-posta ve rol yazılıp gönderilince davet bağlantısı ekranda çıkıyor;
      "Kopyala" ve "WhatsApp'ta Aç" düğmeleri çalışıyor.
- [ ] Davet, "Bekleyen Davetler" kartında rolüyle birlikte listeleniyor.
- [ ] Bağlantı gizli sekmede açılınca rolüne uygun başlık çıkıyor
      ("Antrenör Daveti" / "Yönetici Daveti").
- [ ] Şifre 8 karakterden kısa girilirse reddediyor; iki şifre farklıysa
      "Şifreler aynı değil" diyor.
- [ ] Şifre kurulunca oturum **hemen** açılıyor ve rolün açılış ekranına
      düşüyor (antrenör → `/personel`, yönetici → `/yonetim`).
- [ ] Aynı bağlantı ikinci kez açılınca "Bağlantı kullanılmış" diyor.
- [ ] Kurulan hesap "Bekleyen Davetler" listesinden düşüp kadroda çıkıyor.
- [ ] "Yeni Bağlantı Üret" sonrası **eski bağlantı** artık çalışmıyor.
- [ ] "Daveti İptal Et" sonrası bağlantı "Bağlantı geçersiz" veriyor.
- [ ] Zaten hesabı olan bir e-postaya davet çıkarılamıyor (uyarı veriyor).
- [ ] Sporcu davet bağlantısı (`/personel/uyeler` → ekle) hâlâ çalışıyor —
      aynı adres iki davet türünü de karşılıyor.

### Antrenman şablonu düzenleyici
- [ ] `/personel/planlar` → "Yeni Şablon" formu şablonu oluşturup düzenleyici
      sayfasına yönlendiriyor.
- [ ] Aynı adla ikinci şablon oluşturulamıyor.
- [ ] Şablon sayfasında hafta düğmeleri arasında geçiş yapılıyor; her düğme
      o haftadaki gün sayısını gösteriyor.
- [ ] Güne hareket eklenince round/süre/dinlenme/RPE satırı doğru okunuyor
      (süre **dakika** yazılıyor, listede "3 dk" çıkıyor).
- [ ] Hareket "↑/↓" ile taşınıyor; silinince sıra numaraları boşluk bırakmıyor.
- [ ] Aynı haftada aynı gün ikinci kez eklenemiyor (gün listesinde çıkmıyor).
- [ ] "Haftayı Kopyala" → hedef haftadaki günler kaynağın kopyasıyla değişiyor.
- [ ] Hafta sayısı düşürülünce fazla haftaların günleri siliniyor.
- [ ] Şablon bir sporcuya atandıktan sonra "Şablonu Sil" **kapalı**; gerekçe
      yazıyor ve "Yayından Kaldır" çalışıyor.
- [ ] Yayından kaldırılan şablon listede "Yayında değil" rozetiyle çıkıyor.
- [ ] Başka salonun şablon adresi elle yazılınca **404** veriyor.
- [ ] Sporcuya atanan şablon `/uye/antrenman` ekranında doğru haftayla çıkıyor.
