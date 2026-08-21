# BlackBox Wrestling Lab — Manuel Donanım Test Kontrol Listesi

Bu maddelerin tamamı gerçek webcam ve fiziksel kullanıcı gerektirir. Çalıştırılmadan `PASS` olarak işaretlenemez.

## Ortak hazırlık ve güvenlik

- [ ] Güncel Chrome ve Edge, HTTPS/localhost ve gerçek webcam.
- [ ] Alan çevresinde engel yok; zemin ve ayakkabı stabil.
- [ ] Kamera head-to-feet veya protokolün izin verdiği head-to-lower-legs kadrajı sağlıyor.
- [ ] Maksimal darbeli sprawl yapılmıyor; hareketler hızlı fakat kontrollü.
- [ ] Ağ trafiğinde kamera karesi/video upload edilmiyor.

## W0 — Calibration ve stance

- [ ] Omuz, hip, knee, ankle ve wrist görünürlüğü doğru raporlanıyor.
- [ ] Stance hip height, torso angle, stance width ve body-center baseline görsel olarak makul.
- [ ] İki kişi, tracking loss, alt gövde kadraj dışı ve kararsız stance reddediliyor.

## W1–W4 — Shot, sprawl, choice, fake/real

- [ ] LEFT_SINGLE, RIGHT_SINGLE ve DOUBLE_LEG yanıt yönleri doğru ayrılıyor.
- [ ] Sprawl T1/T2 ve stable stance recovery T3 fiziksel hareketle uyumlu.
- [ ] Yanlış yön, no response, false defense ve missed defense doğru sınıflanıyor.
- [ ] Fake cue sırasında kontrollü restraint yanlışlıkla hareket sayılmıyor.

## W5–W9 — Movement, stance, hand fighting, chain, scramble

- [ ] Altı movement yönü kadraj içinde güvenli ve doğru saptanıyor.
- [ ] Stance consistency metrikleri farklı kontrollü/noisy blokları ayırıyor.
- [ ] Sol/sağ wrist-control ve target-zone hizası gerçek vücutla örtüşüyor.
- [ ] Chain sırası, wrong order ve incomplete sonuçları fiziksel sekanslarla uyumlu.
- [ ] 20–45 saniyelik scramble sırasında uygulama takılmıyor ve tracking kaybını gizlemiyor.

## W10–W12 — Fatigue, virtual wrestler, pattern

- [ ] Baseline/post/recovery blok geçişleri ve sürüm/config kaydı doğru.
- [ ] Virtual wrestler `cueStart`, `commitStart`, `attackThreshold`, `recoveryEnd` zamanları görünür state ile uyumlu.
- [ ] Pattern tekrarlarında correct choice, false response ve missed response doğru raporlanıyor.

## W13–W15 — Side difference, recovery, profile

- [ ] Sol/sağ ham metrikler doğru trial'lara bağlanıyor; tanı iddiası yok.
- [ ] T3 yalnız art arda stabil örneklerden sonra oluşuyor.
- [ ] Profile ham metrikleri görünür tutuyor ve yalnız uyumlu protocolVersion/config hash seanslarını karşılaştırıyor.

