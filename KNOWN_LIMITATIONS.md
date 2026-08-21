# BlackBox Fight Lab — Known Limitations

## Ölçüm iddiası

- Sonuçlar tarayıcı, webcam ve MediaPipe tabanlı karşılaştırmalı antrenman metrikleridir. Klinik, tıbbi veya laboratuvar zamanlaması değildir.
- T0, hedefin `requestAnimationFrame` callback'inde çizilmesinden hemen önce alınan `performance.now()` değeridir. Fiziksel monitör photon-onset zamanı değildir.
- T1 ve T2, analiz edilen video karesinin aynı monotonic zaman alanındaki timestamp'ıdır. Kamera exposure, USB aktarımı, tarayıcı scheduling'i, ekran gecikmesi ve MediaPipe inference gecikmesi sonuçta belirsizlik oluşturur.
- Düşük FPS'te zaman çözünürlüğü kare aralığıyla sınırlıdır; uygulama bunu quality flag ve görünür uyarıyla raporlar.

## Pose ve hit modeli

- Tek RGB kameradan çıkarılan monocular 3D pose koordinatları gerçek glove sensörü veya motion-capture değildir. Peak/mean wrist velocity göreli bir antrenman metriğidir.
- Contact, bilek landmark'ının ekrandaki hedef çemberine hızlı ve hedef yönünde girmesiyle tanımlanır. Gerçek eldiven yüzeyi veya fiziksel temas ölçülmez.
- El landmark modeli kullanılmaz; ana hareket kaynağı özellikle Pose Landmarker world-wrist verisidir.
- Sol/sağ MediaPipe handedness'i korunur; yalnız görüntü aynalanır. Çok örtüşen kollar veya ağır motion blur handedness/tracking kaybına yol açabilir.
- Pose Landmarker en fazla iki kişiyi arar; kalibrasyon birden fazla kişi görülürse reddeder. Kısmi/örtüşen ikinci kişi her kamerada güvenilir biçimde saptanmayabilir.

## Worker ve performans

- Tercih edilen yol, video karesini `ImageBitmap` olarak module Web Worker'a aktarır ve MediaPipe `detectForVideo()` çağrısını worker içinde çalıştırır.
- Worker, `ImageBitmap`, WASM veya browser bundling nedeniyle açılamazsa kontrollü 30 FPS main-thread fallback kullanılır. `detectForVideo()` senkron olduğu için bu fallback zayıf cihazlarda kısa UI takılmaları yaratabilir; target canvas render döngüsü inference döngüsünden ayrı tutulmuştur.
- WASM ve pose model dosyaları şu anda Google/jsDelivr statik CDN'lerinden yüklenir. Kamera kareleri veya türetilmiş seans verisi bu adreslere gönderilmez. Tam çevrimdışı kullanım için model/WASM varlıklarının daha sonra `public/` altına pinlenmesi gerekir.

## Tarayıcı ve donanım doğrulaması

- Otomatik testler saf ölçüm/decision motorunu, state machine'i, Choice/Go-No-Go/Peripheral kurallarını, Chrome/Edge mod seçimini ve kamera izni reddi akışını kapsar.
- Gerçek webcam, gerçek yumruk, aynalanmış skeleton hizası ve eşik tuning'i fiziksel kullanıcı/donanım gerektirir. Bu ortamda otomatik test bunları kanıtlayamaz; release öncesi güncel Chrome ve Edge'de `06_ACCEPTANCE_TESTS.md` protokolüyle manuel doğrulanmalıdır.
- Safari masaüstü nice-to-have durumundadır ve V0.1 release matrisi içinde doğrulanmamıştır.
- Arka plana alınan sekme testi duraklatır. Aktif hedef sırasında uzun frame gap oluşursa trial kalite dışı sayılabilir.

## Phase 2 — Combo Speed ve Guard Return

- Bu iki protokol de bu ortamda yalnız mocked landmark dizileriyle otomatik test edilmiştir (DEVELOPMENT_GATE). Gerçek webcam ve fiziksel yumrukla doğrulanmamıştır; kabul durumu `19_FULL_ACCEPTANCE_GATES.md` içinde `MANUAL_VERIFICATION_PENDING` olarak işaretlidir.
- Combo Speed'in duplicate-contact önleme mantığı (bir elin hedeften fiziksel olarak çıkmadan yeni adım sayılmaması), gerçek kamerada bilek landmark jitter'ı veya kısmi görünürlük nedeniyle beklenenden erken/geç tetiklenebilir; saha tuning'i gerektirir.
- Guard Return'ün T3 tanımı, elin ekran üzerindeki guard bölgesine (kalibre edilmiş bilek konumu + shoulder-width tabanlı yarıçap) art arda 5 kare boyunca girmesidir. Bu, fiziksel guard pozisyonunun kendisini veya kol/omuz açısını doğrulamaz — yalnız bilek landmark'ının ekran mesafesini ölçer.
- Her iki protokol de tek RGB kamera + Pose Landmarker world-wrist verisine dayanır; Phase 0/1 ile aynı monocular pose sınırlamalarını (bkz. "Pose ve hit modeli") miras alır.
- Combo Speed ve Guard Return sonuçları klinik motor sıralama, refleks veya nöromüsküler kontrol değerlendirmesi değildir; yalnız aynı cihaz/kamera/mesafe altında karşılaştırmalı antrenman metrikleridir.
- Trial, Guard Return'de vuruştan sonra da `TARGET_ACTIVE` durumunda kalmaya devam eder (dönüş çözülene kadar). Pose tracking tamamen kesilirse (ör. kişi kadraj dışına çıkarsa) dış güvenlik zaman aşımı trial'ı `FAILED_RETURN` olarak kapatır; bu durum gerçek donanımda henüz gözlemlenmemiştir.

## Phase 3 — Defense Reflex

- Bu protokol bu ortamda yalnız mocked landmark dizileriyle otomatik test edilmiştir (DEVELOPMENT_GATE). Gerçek webcam ve fiziksel slip/duck hareketiyle doğrulanmamıştır; kabul durumu `19_FULL_ACCEPTANCE_GATES.md` içinde `MANUAL_VERIFICATION_PENDING` olarak işaretlidir.
- Yön/displacement ölçümü tek RGB kameradan çıkarılan burun (nose) landmark'ının 2D ekran hareketine dayanır; gerçek 3D kafa dönüşü, boyun açısı veya omuz rotasyonu ayrı ölçülmez. Saf bir baş öteleme (translation) ölçümüdür.
- Slip/duck ayrımı, hangi eksenin (lateral/vertical) önce eşiği aştığına bakar; hızlı ve karışık bir hareket (ör. çapraz bir slip-duck kombinasyonu) yanlış sınıflandırılabilir. Saha tuning'i gerekebilir.
- Premature movement (T0'dan önce erken başlama) Phase 0-2'deki gibi ayrıca tespit edilmez; bu bir sonraki iterasyonda değerlendirilebilir.
- Defense Reflex sonuçları klinik denge, vestibüler, refleks veya nörolojik değerlendirme değildir; yalnız aynı cihaz/kamera/mesafe altında karşılaştırmalı bir antrenman metriğidir.
- Kalibrasyon artık burun görünürlüğünü zorunlu kılar; şapka, maske veya aşırı yan kamera açısı kalibrasyonu daha önce geçebilen bazı durumlarda artık reddedebilir.

## Repo mimarisi farkı

- Spesifikasyon yeni/boş proje için React + TypeScript + Vite önerir. Hedef repo zaten çalışan Next.js 16 + React 19 uygulaması ve iki mevcut browser-only araç içerdiği için V0.1 ayrı Vite uygulaması yerine mevcut App Router içine entegre edilmiştir. React, TypeScript, Canvas, MediaPipe, Web Worker, Vitest ve Playwright gereksinimleri korunmuştur.
- Mevcut Prisma araç zinciri `npm audit --omit=dev` içinde `deepmerge-ts` kaynaklı 3 high uyarı üretir. NPM'in önerdiği çözüm breaking Prisma downgrade gerektirdiğinden otomatik uygulanmamıştır; bu bağımlılık Fight Lab'in tamamen istemci tarafındaki ölçüm hattında kullanılmaz.

## Veri ve ürün kapsamı

- Phase 0–1 yalnız browser belleğinde çalışır; sonuçlar otomatik olarak kullanıcı hesabına, Supabase'e veya localStorage'a kaydedilmez. Kalıcı kayıt yalnız kullanıcının indirdiği JSON dosyasıdır.
- Choice Reaction canonical MediaPipe el kimliğini kullanır. Kol örtüşmesi veya landmark kaybı yanlış-el sınıflandırmasını bozabilir; renk cue'su her zaman SOL/SAĞ metniyle desteklenir.
- Go / No-Go sonucu yalnız tanımlı penceredeki pose tabanlı bilek onset'ini ölçer. Düşük confidence hareketi kaçırabilir; sonuç klinik impulse-control veya inhibisyon ölçümü değildir.
- Peripheral Reaction merkez fixation işareti gösterir fakat webcam pose modeli göz hareketini veya gerçek bakış sabitliğini doğrulamaz. Yan hedef sonuçları görsel alan veya nörolojik değerlendirme değildir.
- Combo Speed, Guard Return ve Defense Reflex uygulanmıştır. Wrestling Lab ayrıca kendi virtual opponent, pattern, fatigue, longitudinal profil ve açıklanabilir adaptive engine kapsamını içerir. Bunlar tek webcam'den türetilen deneysel ürün metrikleridir; bilimsel/klinik skor, AI tanısı, VR, leaderboard veya nüfus normu değildir.
- Headline metrikler kötü-quality trial'ları gizlemez; trial tablosu ve JSON tüm quality flag'leri korur. Buna rağmen eşiklerin farklı vücut tipleri/kameralarla saha tuning'i sürmelidir.

## Wrestling Lab — 18 Ağustos 2026

- W0–W15 için DEVELOPMENT_GATE geçmiştir; bütün gerçek atlet/webcam maddeleri `WRESTLING_MANUAL_TEST_CHECKLIST.md` içinde `MANUAL_VERIFICATION_PENDING` durumundadır.
- Monocular MediaPipe pose, gerçek mat sensörü, kuvvet plakası, motion-capture, reaction-light donanımı veya koç değerlendirmesinin yerine geçmez. Özellikle sprawl, knee-flexion, torso angle ve stance width değerleri kamera perspektifine duyarlıdır.
- W11 Virtual Wrestler hafif, tarayıcı içi görsel bir stimulus motorudur; fiziksel rakip, temas, derinlik veya gerçek takedown başarısı simülasyonu değildir.
- W12 Opponent Reading önceden tanımlanmış fake/shot dizilerini ölçer; genel rakip modelleme veya makine öğrenmesi yapmaz.
- W15'in sekiz boyutlu profil puanları deneysel ve yalnız aynı atletin uyumlu seansları içindeki değişimi görünür kılmak içindir. Bilimsel norm, yetenek notu, sakatlık riski veya seçme/eleme kararı değildir.
- Wrestling seansları bu sürümde browser IndexedDB'de kalır. Hesaplar arasında/cross-device senkronizasyon ve Supabase yedeği yoktur; tarayıcı verisi silinirse yerel geçmiş de silinir. JSON export kullanıcının açık indirme eylemidir.
- Weekly Benchmark ve Coach Test kullanıcıyı hareket güvenliğinden muaf tutmaz. Ağrı, baş dönmesi, kaygan zemin, yetersiz alan veya tracking kaybında test durdurulmalıdır.

## Bildirim & hatırlatma — 19 Ağustos 2026

- **Zamanlanmış iş barındırmaya bağlıdır.** Hatırlatmalar `vercel.json`
  içindeki cron ile `/api/cron/hatirlatici` çağrılarak üretilir (Istanbul
  saatiyle 20:00 ve 09:00; dosyadaki saatler UTC yazılıdır). Vercel dışında
  bir yere dağıtılırsa aynı ucu çağıran bir zamanlayıcı kurulmalıdır —
  yoksa hatırlatma **hiç** üretilmez, uygulama bunu kendiliğinden fark etmez.
  Yönetim panelindeki "Hatırlatmaları Şimdi Çalıştır" düğmesi elle telafi
  eder ama otomatik değildir.
- **`CRON_SECRET` yazılmazsa uç herkese açıktır.** Kötü niyetli çağrı veri
  bozmaz (iş idempotenttir) ama bildirim kuyruğunu erken tetikleyebilir.
- **E-posta ücretsiz katmanla sınırlıdır.** Brevo günde 300, Resend ayda
  3.000 e-posta verir. Salon büyüdükçe (100 sporcu × 2 hatırlatma = günde
  ~200 e-posta) sınıra yaklaşılır; kota dolduğunda bildirim uygulama içi
  kutuda kalır, `status = "basarisiz"` ve sebep `error` alanına yazılır.
  Kota takibi uygulamada yoktur — sağlayıcı panelinden izlenmelidir.
- **WhatsApp ücretsiz değildir.** Kod tarafındaki dal hazırdır
  (`src/lib/notifications/channels.ts`), ancak Meta/Twilio bu tür "utility"
  konuşmaları başına ücret alır. Ayrıca gönderim için önceden onaylanmış
  şablon gerekir; şu anki düz metin gövdesi yalnız 24 saatlik hizmet
  penceresinde çalışır.
- **Push bildirimi yok.** Telefon kapalıyken hatırlatma görünmez; sporcu
  panele girdiğinde ya da e-postasına baktığında görür.
- **Hesabını kurmamış sporcuya bildirim gitmez.** Davet bağlantısı
  kullanılmadan `Member.userId` boş olduğu için gidecek hesap yoktur;
  bu sporcular `/personel/davetler`'de ve "Bugün" ekranında "hesap
  kurulmadı" etiketiyle görünür, antrenör elle arar.

## Sporcu analizi — 19 Ağustos 2026

- **Teşhis yok, ölçüm iddiası sınırlı.** Ekrandaki her sayı kayıtlardan
  türetilir ve kaynağı yazılır. "Motivasyon", "disiplin" gibi kişilik
  yorumları üretilmez.
- **Veri azken yüzde üretilir ama güven düzeyi düşük işaretlenir.** Yeni
  yazılmış beslenme planında uyum penceresi planın yaşıyla sınırlanır;
  güven "yeterli" değilse bayrak çıkmaz ve devamlılık ortalamasına girmez.
- **Antrenman hacmi yalnız sisteme giren kayıtları görür.** Salonda yapılıp
  yoklaması alınmamış ya da elle girilmemiş antrenman "yok" sayılır; bu bir
  ölçüm değil, kayıt eksikliğidir.

## Koç kapsamı ve muhasebe — 20 Ağustos 2026

- **Kapsam uygulama katmanındadır, veritabanında değil.** Antrenörün yalnız
  kendi sporcusunu görmesi `src/lib/auth/scope.ts` üzerinden Prisma `where`
  koşullarıyla sağlanır; Postgres RLS **yok**. Doğrudan veritabanına erişen
  ya da kapsamı almayı unutan yeni bir sorgu bu kuralı delebilir. Yeni ekran
  eklerken `memberWhere(scope)` / `slotWhere(scope)` kullanılmalıdır.
- **Grup dersinde isim sızıntısı kalır (bilinçli).** Sporcular ortak tablodan
  ders seçtiği için bir antrenörün seansına başka antrenörün sporcusu
  kaydolabilir; o seansın yoklama listesinde bu sporcunun adı görünür. Dersi
  veren kişinin kimi yoklayacağını bilmesi gerektiği için engellenmedi.
- **Muhasebe tek kayıt (single entry) defteridir**, çift taraflı muhasebe
  değildir. Fatura, KDV, e-arşiv, tevkifat, kur farkı ve resmî beyanname
  desteği yoktur; mali müşavir yerine geçmez.
- **Taksit planı yoktur.** Borç, anlaşılan tutar ile tahsilat toplamının
  farkıdır; taksitli satış parça parça tahsilat girilerek yürütülür, vade
  tarihi tutulmaz.
- **Tek para birimi.** Alanlar `currency` taşısa da ekranlar TRY varsayar;
  çoklu kur ve kur çevrimi yoktur.
- **İade/iptal kaydı yoktur.** Yanlış girilen tahsilat silinerek geri alınır
  (bağlı antrenör payı da silinir); negatif tutarlı düzeltme satırı desteği
  yoktur, bu yüzden denetim izi silme kaydı üzerinden okunur.
- **Sabit giderler otomatik işlenmez.** "Bu Ayı İşle" düğmesine basılması
  gerekir; zamanlanmış iş (`/api/cron/hatirlatici`) bu adımı çalıştırmaz.
- **Maaş tahakkuku da elle tetiklenir** ("Maaşları İşle"); ay kapanışında
  otomatik değildir.
- **Hakediş tutarları dondurulur.** Oran değişimi geçmişe işlemez — bu
  bilinçlidir; geçmişi düzeltmek isteyen kullanıcı ilgili hakediş satırını
  doğuran kaydı (tahsilat/yoklama) geri alıp yeniden girmelidir.
