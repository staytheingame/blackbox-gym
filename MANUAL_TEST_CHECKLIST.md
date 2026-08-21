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
