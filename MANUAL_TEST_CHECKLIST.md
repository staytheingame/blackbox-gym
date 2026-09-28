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

## Faz 14 — takvim, kayıt linki, kişisel bilgiler

### Takvimden toplu saat açma (antrenör)
- [ ] `/personel/program` → takvimde boş bir hücreye dokununca hücre sarıya
      dönüyor ve "Saatleri Aç (1)" yazıyor.
- [ ] İkinci, üçüncü hücre eklenince sayı artıyor; gün başlığındaki rozet o
      günde kaç saat seçildiğini gösteriyor.
- [ ] **Gün başlığına** dokununca o günün tüm boş saatleri seçiliyor; ikinci
      dokunuşta bırakıyor.
- [ ] **Saat etiketine** dokununca o saat tüm günlerde seçiliyor.
- [ ] Dolu (seansı olan) hücre grup seçiminde atlanıyor — üstüne yazmıyor.
- [ ] "Saatleri Aç" sonrası seçim temizleniyor ve "N seans açıldı." yazıyor.
- [ ] "Kaç hafta tekrarlansın = 4" ile açılan saatler sonraki haftalarda da
      görünüyor (hafta ileri okuyla bak).
- [ ] Zaten açık bir saat seçilip gönderilirse mesaj "… zaten açıktı" diyor,
      diğer saatler yine de açılıyor.
- [ ] Geçmiş saat seçilirse atlanıyor; hepsi geçmişse uyarı veriyor.
- [ ] "Başlangıç dakikası = Buçuk" ile açılan seans 19:30 olarak görünüyor.
- [ ] Kimse kapmamış seansın hücresindeki "Kaldır" seansı iptal ediyor ve
      **seçim kaybolmuyor**.
- [ ] Dolu seansın hücresinde "Kaldır" düğmesi YOK (iptal aşağıdaki listeden).

### Takvim — telefon (375px)
- [ ] `/personel/program` dar ekranda tek gün sütunu gösteriyor; üstteki
      gün şeridinde yedi gün de yatay kaydırma olmadan sığıyor.
- [ ] Gün değiştirince seçim kaybolmuyor (Pzt'de 2 seç, Çar'a geç, Pzt'ye dön).
- [ ] `/uye/program` telefonda: dersi olan günlerde sarı nokta var; boş günde
      "Bu gün için açılmış saat yok" yazıyor, on üç boş satır YOK.
- [ ] Gelecekteki bir seansın altında "Kap" düğmesi var; geçmiş seansta yok.

### Tek kayıt linki
- [ ] `/yonetim/kayit-linki` → ad yazıp "Bağlantıyı Üret" deyince adres
      (`/katil/<slug>`) ekranda çıkıyor; "Kopyala" ve WhatsApp düğmeleri
      çalışıyor.
- [ ] Bağlantı gizli sekmede açılınca salon adıyla kayıt formu geliyor.
- [ ] Zorunlu alanlar boşken form gönderilmiyor; KVKK kutusu işaretlenmeden
      kayıt olmuyor.
- [ ] Şifre 8 karakterden kısa ya da tekrarı farklıysa uyarı veriyor.
- [ ] Kayıt tamamlanınca oturum **hemen** açılıyor, `/uye` ekranında
      "Kaydın açıldı" kutusu çıkıyor.
- [ ] Aynı e-postayla ikinci kez kaydolunamıyor ("hesap zaten var").
- [ ] Yeni kayıt `/yonetim/kayit-linki` alt listesinde ve `/personel/adaylar`
      ekranında görünüyor; durumu **Aday**.
- [ ] Linkte "Gelenler kime atansın" doluysa sporcu o antrenöre atanıyor;
      boşsa "Antrenör atanmadı" rozeti çıkıyor.
- [ ] Kontenjan 1 verilen link ikinci kayıtta "Kontenjan doldu" diyor.
- [ ] Son günü geçmiş link "Süresi dolmuş" diyor.
- [ ] "Kapat" denen link `/katil/<slug>` adresinde "Kayıt kapalı" veriyor ve
      `/personel/davetler` ekranından da kalkıyor.
- [ ] Oturumu açık bir kullanıcı `/katil/<slug>` açarsa `/uye`ye gidiyor —
      ikinci hesap açılmıyor.
- [ ] `/personel/davetler` ekranında açık kayıt bağlantısı kopyalanabiliyor
      (antrenör de paylaşabilsin), üretme/kapatma düğmesi YOK.

### Kişisel bilgiler
- [ ] `/uye/profil` → "Kişisel Bilgilerim" kartında eksik alanlar üstte
      listeleniyor ("Eksik bilgi: telefon, doğum tarihi, ilçe").
- [ ] Bilgiler kaydedilince menüdeki ad da güncelleniyor (ad/soyad değişince).
- [ ] Sağlık notu `/personel/uyeler/<id>` kartında sarı kutuda görünüyor.
- [ ] İlçe alanı listeden seçilebiliyor ama elle de yazılabiliyor.

### Reklam eşleşme dosyası
- [ ] `/api/export/reklam-eslesme` personel oturumuyla CSV indiriyor; başlık
      satırı `email,phone,fn,ln,ct,st,country,zip,dob,ge` ve ayraç **virgül**.
- [ ] "0555 111 22 33" numarası dosyada `905551112233` olarak çıkıyor.
- [ ] Şehir/il küçük harf ve boşluksuz ("istanbul"), ülke `tr`.
- [ ] E-postası ve telefonu olmayan üye dosyada YOK.
- [ ] İndirme `/yonetim/kayitlar` denetim kaydına düşüyor.

### Toplu program ataması / beslenme kopyası
- [ ] `/personel/planlar` → "Toplu Ata": şablon seç, birkaç sporcu işaretle,
      "Programı Ata (N)" deyince "N sporcuya atandı." çıkıyor.
- [ ] Zaten programı olan sporcunun satırında "şu an: … — atama bunu kapatır"
      uyarısı var; atamadan sonra `/uye/antrenman` yeni programı gösteriyor.
- [ ] Antrenör hesabı yalnız KENDİ sporcularını listede görüyor.
- [ ] `/personel/beslenme/<id>` → "Başka Sporcuya Kopyala" sonrası hedef
      sporcuda **taslak** plan var, öğünler ve besinler kopyalanmış, öğün
      işaretleri boş.

## Faz 16 — kayıt formu yanıtları, antrenör bağlantısı, QR, paket fiyatı

> Önce `npx prisma migrate deploy` (yeni iki tablo). Uygulanmadan da kayıt
> çalışır ama yanıtlar sporcu kartına değil denetim kaydına düşer.

### Sporcu kayıt formu (`/katil/<slug>`)
- [ ] Form şunları soruyor: mesleğin, günlük yoğunluğun, tercih edilen antrenman
      saatleri (çoklu), koçunuz kim. Meslek/yoğunluk/en az bir saat boşsa gönderilmiyor.
- [ ] "Koçunuz kim?" listesinde salonun aktif antrenörleri var; başında "Fark
      etmez" seçili. Listede e-posta ya da başka bilgi görünmüyor.
- [ ] Bir antrenör seçilerek kayıt olununca sporcu o antrenörün listesinde
      çıkıyor (`/personel/uyeler` o antrenörle giriş yapılarak).
- [ ] "Fark etmez" ile kayıt olununca antrenör atanmıyor (havuzda) — bağlantıda
      varsayılan antrenör tanımlıysa o atanıyor.
- [ ] Sporcu kartında (`/personel/uyeler/<id>`) "Kayıt Yanıtları" bölümü meslek,
      yoğunluk, saatler ve seçilen koçu gösteriyor.
- [ ] Formu elle bozup listede olmayan saat/yoğunluk göndermek reddediliyor.

### Antrenör kayıt bağlantısı (`/yonetim/kayit-linki`)
- [ ] "Antrenör Bağlantısı Üret" adres gösteriyor; sayfa yenilenince adres
      GÖRÜNMÜYOR (yalnız özet saklı) ama satır listede duruyor.
- [ ] Yeni bağlantı üretmek öncekini "Kapalı" yapıyor.
- [ ] Bağlantıyla kayıt: ad, e-posta, şifre → hesap açılıyor, `/personel`e düşüyor.
      Rol her zaman **antrenör**; yönetici menüsü açılmıyor.
- [ ] Kullanım sayısı dolunca / süre bitince / kapatılınca sayfa "Kontenjan doldu /
      Süresi dolmuş / Bağlantı kapalı" diyor.
- [ ] Var olan e-postayla kayıt "hesap zaten var" diyor.
- [ ] Kaydolan antrenör "Koçunuz kim?" listesinde çıkıyor.
- [ ] `/yonetim/kadro`dan bir antrenörü yöneticiye çevirmek çalışıyor.
- [ ] Yönetici olmayan biri `/yonetim/kayit-linki`ye giremiyor.

### QR kod
- [ ] Açık her sporcu bağlantısının altında QR görünüyor; kapalı bağlantıda yok.
- [ ] Telefon kamerasıyla okutunca kayıt sayfası açılıyor.
- [ ] "QR'ı İndir (PNG)" dosyayı indiriyor; yazdırılınca da okunuyor.
- [ ] `/yonetim/kayit-linki/qr/<id>` çıkış yapılmışken 401/giriş; başka salonun
      bağlantı kimliğiyle 404.

### Paket fiyatı (antrenör)
- [ ] Antrenör menüsünde Yönetim → "Paket Fiyatları" var.
- [ ] Fiyatı değiştirip kaydetmek `/yonetim/paketler` ve üyelik başlatma
      ekranında yeni fiyatı gösteriyor; **mevcut üyeliklerin tutarı değişmiyor**.
- [ ] Negatif, boş ya da 1.000.000 ₺ üstü fiyat reddediliyor.
- [ ] Denetim kaydında "Paket fiyatı düzeltildi" satırı eski → yeni tutarla var.
- [ ] Antrenör bu ekrandan paket ekleyemiyor/kaldıramıyor/süre-ders adedini
      değiştiremiyor (yalnız fiyat alanı var).

## Faz 17 — üye ekleme tek link, uygulama olarak kurulum (PWA)

### Yeni üye ekleme (`/personel/uyeler`)
- [ ] "Yeni Üye Ekle" kartında ad/soyad/e-posta alanı YOK; salonun kayıt
      bağlantısı, kopyala/WhatsApp düğmeleri ve QR görünüyor.
- [ ] Hiç bağlantı yokken sayfayı açmak "Genel kayıt bağlantısı"nı kendiliğinden
      üretiyor (yönetici ve antrenör için).
- [ ] Açık bağlantı yoksa (hepsi kapalı) kart "yönetici yeniden açabilir" diyor.
- [ ] "Bağlantıyı kullanamayan biri için elle ekle" kapalı duruyor; açılınca
      eski form çalışıyor.
- [ ] Antrenör hesabıyla QR'ı indir (PNG) çalışıyor; oturumsuz 401 veriyor.
- [ ] Giriş ekranındaki metin artık "salondan kayıt bağlantısını iste" diyor.

### Uygulama olarak kurulum (PWA)
- [ ] Chrome/Edge masaüstü: adres çubuğunda "Yükle" simgesi çıkıyor; panel yan
      menüsündeki "Uygulamayı Yükle" sistem penceresini açıyor. Kurulunca
      düğme kayboluyor.
- [ ] Android Chrome: giriş ekranında ve menüde "Uygulamayı Yükle" var; kurulan
      uygulama kendi penceresinde (adres çubuğu yok) açılıyor, ikon siyah zemin
      üstünde sarı "BB".
- [ ] iPhone Safari: "Uygulamayı Yükle" adımları (Paylaş → Ana Ekrana Ekle)
      gösteriyor; eklenen simge doğru; uygulama tam ekran açılıyor.
- [ ] Uygulamayı açınca **oturum açıksa doğrudan rolünün paneline** (sporcu
      `/uye`, antrenör `/personel`, yönetici `/yonetim`) düşüyor, giriş formunu
      görmüyor; oturum yoksa `/giris`.
- [ ] Uçak modunda uygulamayı açmak "Çevrimdışısın" ekranını gösteriyor; internet
      gelince "Tekrar Dene" paneli açıyor.
- [ ] Çıkış yapıp uçak moduna geçince önceki sayfalar AÇILMIYOR (kişisel veri
      önbellekte kalmıyor).
- [ ] Geliştirme modunda (`npm run dev`) service worker kaydedilmiyor.

## Faz 18 — yönetici kayıt bağlantısı, tek dokunuşla üç grup listesi

> Önce `npx prisma migrate deploy` (Faz 16 + bu fazın `role` sütunu).

- [ ] `/yonetim/kayit-linki` → "Tüm Bağlantıları Hazırla" antrenör VE yönetici
      bağlantısı üretiyor; altında sporcu + antrenör + yönetici adresleri tek
      listede, "Listeyi Kopyala" çalışıyor.
- [ ] "Yalnız Antrenör" yönetici bağlantısını KAPATMIYOR; "Yalnız Yönetici"
      antrenör bağlantısını kapatmıyor. Aynı rolde yenisi eskisini kapatıyor.
- [ ] Yönetici bağlantısı varsayılan **1 kişi / 3 gün**; kişi sayısına 4 ya da
      gün sayısına 8 yazınca hata veriyor (üst sınır 3 kişi / 7 gün).
- [ ] Yönetici bağlantısıyla kayıt: sayfa "Yönetici Hesabını Aç" diyor, hesap
      açılınca `/yonetim`e düşüyor; yönetici menüsü açık.
- [ ] Antrenör bağlantısıyla kayıt: "Antrenör Hesabını Aç", `/personel`e düşüyor,
      `/yonetim` açılmıyor.
- [ ] Yönetici bağlantısı tek kullanımdan sonra "Kontenjan doldu" diyor.
- [ ] Yönetici olmayan biri bağlantı üretemiyor.
- [ ] Faz 16'da üretilmiş bağlantılar (rol sütunu öncesi) antrenör olarak çalışıyor.
