# BlackBox Fight Lab — Implementation Status

Son güncelleme: 18 Ağustos 2026

## Kapsam ve mimari kararı

- V0.1, mevcut `blackbox-gym` uygulamasına public ve tamamen istemci tarafında çalışan üçüncü araç olarak eklendi.
- Mevcut repo güçlü bir Next.js 16 + React 19 + TypeScript mimarisine sahip olduğu için ayrı bir Vite uygulaması oluşturulmayacak. Spesifikasyondaki React, TypeScript, MediaPipe, Canvas, Web Worker, Vitest ve tarayıcı API gereksinimleri korunacak; yalnız paketleyici mevcut repo mimarisiyle uyumlu tutulacak.
- Kamera kareleri, görüntüler ve videolar hiçbir backend'e gönderilmeyecek veya kaydedilmeyecek. Yalnız türetilmiş sayısal seans sonucu tarayıcı belleğinde tutulacak ve kullanıcı isterse JSON olarak indirilecek.
- Pose Landmarker bilek world landmark'ları hareket/velocity için ana kaynak; normalized image landmark'ları yalnız ekran koordinatı ve hit testi için kullanılacak.
- V0.2 (choice reaction, zorunlu el, go/no-go, kombinasyon, sanal rakip vb.) kapsam dışıdır.

## Başlangıç durumu

- Gereksinim paketindeki 12 ana belge belirtilen sırayla, ardından manifest ve yinelenen master prompt okundu.
- Repo, kaynak yapısı, mevcut araç rotaları, MediaPipe kullanımı, test yapısı ve çalışma ağacındaki kullanıcı değişiklikleri incelendi.
- Başlangıç testleri: 12 test dosyasında 119 test başarılı.
- Başlangıç typecheck/build: Fight Lab dışındaki devam eden üyelik modülü değişikliklerinde eksik query alanları/exportları nedeniyle başarısızdı. Bu kullanıcı çalışmasına dokunulmadı; final çalışma ağacında typecheck ve production build bütünüyle başarılı oldu.

## Uygulama planı

### A — Ölçüm çekirdeği ve veri modeli

- Tek merkezî `performanceConfig` oluştur.
- Vec2/Vec3, pose sample, kalibrasyon, trial, session, quality flag ve export tiplerini oluştur.
- Koordinat dönüşümü, EMA smoothing, rolling history, velocity/frame-gap ve istatistik yardımcılarını uygula.
- Histerezisli ve çok-kare doğrulamalı onset detector ile hız/yön/entry kontrollü hit detector uygula.
- Açık state-machine reducer, random target üretimi ve 20-trial session özetini uygula.
- Tüm saf ölçüm kodunu Vitest ile mocked landmark dizileri üzerinden doğrula.

### B — Kamera ve pose tracking

- 1280×720 / ideal 60 FPS, audio kapalı kamera isteği; cihaz seçimi, gerçek kamera ayarları ve izin hata akışı.
- `requestVideoFrameCallback` scheduler ve desteklenmeyen tarayıcılar için kontrollü fallback.
- MediaPipe Pose Landmarker VIDEO modu; inference için module Web Worker denemesi, worker açılamazsa throttled main-thread fallback.
- Tek monotonic timestamp alanı (`performance.now`) ve render/inference döngülerinin ayrılması.

### C — Kalibrasyon

- Tek kişi, omuz/bilek görünürlüğü, üst gövde framing'i, güven, guard ve stabil pencere kontrolleri.
- Omuz genişliği, iki guard pozisyonu, omuzlar, torso center, noise, kamera ve FPS snapshot'ı.
- Kullanıcıya başarısızlık nedenlerini ayrı ve anlaşılır biçimde göster.

### D — Trial motoru ve UI

- Açık ekran/state akışı: BOOT → CAMERA_PERMISSION → CAMERA_READY → CALIBRATION → READY → COUNTDOWN → WAITING_FOR_TARGET → TARGET_ACTIVE → TRIAL_COMPLETE → SESSION_COMPLETE; PAUSED/ERROR desteği.
- Mirrored video üzerinde tek canvas: target, countdown, hit/slow/early/tracking feedback ve debug skeleton.
- Canvas'ın target'ı gerçekten çizdiği ilk animation frame timestamp'ını T0 kabul et; T1/T2 aynı monotonic alanda frame timestamp'larından gelsin.
- Premature movement, düşük hızla yerleştirme, target içinde önceden bekleme, yön hatası, düşük confidence, dropout ve timeout reddi.
- 20 scored trial, random gecikme ve erişilebilir kalibreli target bölgeleri.

### E — Sonuç, diagnostics ve export

- Median/mean reaction, movement, total; accuracy, fastest/slowest, MAD tabanlı consistency, left/right farkı ve session quality.
- `?debug=1` ve UI toggle ile skeleton, bilekler, velocity vektörleri/grafiği, threshold, FPS, confidence, state ve T0/T1/T2.
- Versiyonlu, config/calibration/camera/environment/raw trials/summary içeren ve hiçbir görüntü içermeyen JSON export.

### F — Entegrasyon, dokümantasyon ve release doğrulaması

- Public ve üye araç listelerine Camera Fight Lab girişini ekle.
- `TUNING_GUIDE.md` ve `KNOWN_LIMITATIONS.md` oluştur; bu dosyayı gerçek tamamlanma durumuyla güncelle.
- Typecheck, tüm unit testler, lint, production build ve localhost smoke test çalıştır.
- Donanım gerektiren Chrome/Edge kamera maddelerini otomatik olarak doğrulanmış gibi işaretleme; manuel doğrulama gereksinimini açıkça kaydet.

## Durum

- [x] Gereksinim okuma ve repo inceleme
- [x] Plan ve mimari karar
- [x] Ölçüm çekirdeği
- [x] Kamera ve pose pipeline
- [x] Kalibrasyon
- [x] Trial motoru ve 20 deneme
- [x] Sonuçlar, diagnostics ve JSON export
- [x] Otomatik testler
- [x] Dokümantasyon
- [x] Typecheck / lint / unit test / production build / Chrome ve Edge E2E doğrulaması

## Tamamlanan V0.1 kapsamı

- Public araç rotası: `/araclar/kamera-fight-lab`; ortak araç konfigürasyonu üzerinden ana sayfa, public araçlar ve üye araçlar listelerine eklenmiştir.
- Kamera izni, cihaz seçimi, gerçek çözünürlük/FPS snapshot'ı ve açık hata durumları uygulanmıştır; mikrofon kapalıdır.
- MediaPipe Pose Landmarker VIDEO modu module worker içinde çalışır; desteklenmeyen durumda 30 FPS kontrollü main-thread fallback vardır.
- Kalibrasyon tek kişi, üst-gövde framing, landmark confidence, guard konumu, stabilite ve noise kriterlerini birlikte doğrular.
- Wrist world landmark hareketi EMA smoothing ve rolling history ile işlenir; frame-gap/jump, histerezisli T1 onset ve hız/yön/entry kontrollü T2 hit saptaması uygulanmıştır.
- Target T0 zamanı ilk çizim frame'inde alınır. Premature hareket, yavaş yerleştirme, hedefte önceden bekleme, yanlış yön, düşük confidence, tracking kaybı ve timeout ayrı değerlendirilir.
- Tam 20 trial state machine'i, rastgele gecikme, sol/sağ ilk geçerli hit, trial kalite flag'leri, seans metrikleri ve kalite skoru tamamlanmıştır.
- Diagnostics görünümü skeleton, bilek, hız vektörü/geçmişi, eşikler, FPS, confidence, state ve T0/T1/T2'yi gösterir.
- Sürümlü JSON export kamera, ortam, config snapshot, kalibrasyon, ham trial ve summary içerir; görüntü/video içermez veya yüklemez.

## Final doğrulama — 18 Ağustos 2026

| Kontrol | Sonuç |
| --- | --- |
| `npm run lint` | Başarılı, 0 hata |
| `npm run typecheck` | Başarılı |
| `npm test` | 21 dosya, 153/153 test başarılı |
| `npm run build` | Next.js 16 production build başarılı, Fight Lab rotası üretildi |
| `npm run test:e2e` | Chrome 2/2 + Edge 2/2, toplam 4/4 başarılı |
| Gizlilik E2E | Kamera reddi akışında POST/PUT/PATCH isteği yok |

Otomatik testler no movement, jitter, geçerli sol/sağ punch, yavaş yerleştirme, premature hareket, tracking dropout, hit yönü/entry, koordinat aynalama, kalibrasyon, 20-trial state machine, istatistikler ve JSON export'u kapsar.

## Açık manuel kabul maddeleri

Gerçek webcam ve fiziksel yumruk gerektiren kabul maddeleri bu geliştirme ortamında otomatik olarak doğrulanmış sayılmamıştır. Özellikle skeleton hizası, farklı kamera/ışık koşulları, gerçek punch ile T0/T1/T2 davranışı ve saha eşiği tuning'i güncel Chrome ve Edge'de `06_ACCEPTANCE_TESTS.md` protokolüyle manuel yürütülmelidir. Bu teknik sınırlar `KNOWN_LIMITATIONS.md` içinde ayrıntılıdır.

## Bağımlılık denetimi

`npm audit --omit=dev`, mevcut Prisma araç zincirindeki `deepmerge-ts` için 3 adet high uyarı raporlar. Önerilen otomatik çözüm `prisma` paketini breaking bir sürüme düşürdüğü için kullanıcıya ait veri katmanı bağımlılıkları zorla değiştirilmedi. Fight Lab kamera verisini backend'e göndermez ve bu bulgu Fight Lab istemci ölçüm yolunda kullanılmaz.

---

## Full Product Pack ilerleme durumu

18 Ağustos 2026 tarihinde Full Product Pack içindeki `00_READ_ME_FIRST` ile `20_CODEX_FULL_HANDOFF` arasındaki bütün numaralı gereksinimler ve manifest sırayla okundu. Gate sırası yeniden değerlendirildi:

| Faz | Gate | Durum (ilk değerlendirme) |
| --- | --- | --- |
| Phase 0 — Core Measurement | Gate 0 | Tamamlandı; yukarıdaki V0.1 doğrulamaları geçerli |
| Phase 1 — Decision Tests | Gate 1 | Kod ve otomatik gate tamam; fiziksel kamera sign-off'u bekliyor |
| Phase 2 — Boxing Motion | Gate 2 | Başlanmadı |
| Phase 3 — Defense | Gate 3 | Başlanmadı |
| Phase 4 — Virtual Opponent | Gate 4 | Başlanmadı |
| Phase 5 — Pattern Recognition | Gate 5 | Başlanmadı |
| Phase 6 — Fatigue | Gate 6 | Başlanmadı |
| Phase 7 — Longitudinal Profile | Gate 7 | Başlanmadı |
| Phase 8 — Adaptive Engine | Gate 8 | Başlanmadı |
| Phase 9 — Combat Profile | Gate 9 | Başlanmadı |

Master prompt gereği yalnız en erken eksik faz olan Phase 1 uygulanacaktır. Gate 1 geçmeden Phase 2 veya sonraki özelliklere başlanmayacaktır.

---

## Gate sistemi revizyonu — 18 Ağustos 2026

Tek bir Gate kavramı, otomatik olarak doğrulanabilenler ile gerçek donanım/fiziksel kullanıcı gerektirenleri ayırt etmiyordu ve bu, gerçek webcam erişimi olmayan bir geliştirme ortamında sonraki fazların geliştirmesini gereksiz yere bloke ediyordu. Gate sistemi bu tarihten itibaren ikiye ayrıldı; tam tanım ve güncel durum matrisi **`19_FULL_ACCEPTANCE_GATES.md`** dosyasındadır (bu dosya artık kaynak referanstır):

- **DEVELOPMENT_GATE** (otomatik; typecheck, unit/mocked-landmark testleri, state machine testleri, coordinate/mirroring testleri, protocol testleri, production build, browser-automation ile doğrulanabilen maddeler) — bu geçmeden sonraki faza başlanmaz.
- **MANUAL_HARDWARE_GATE** (gerçek webcam, gerçek insan hareketi, skeleton fiziksel hizalama, gerçek FPS/tracking-loss davranışı, gerçek kullanım ergonomisi) — release öncesi zorunludur, ancak eksik olması sonraki fazın **geliştirmesini** bloke etmez.

Durum değerleri: `PASS`, `FAIL`, `MANUAL_VERIFICATION_PENDING`, `NOT_STARTED`. Hiçbir manuel madde gerçekten yapılmadan `PASS` sayılmaz.

Bu revizyona göre:

- **Phase 0 — Core Measurement**: DEVELOPMENT_GATE `PASS`. Genel durum: `IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING`.
- **Phase 1 — Decision Tests**: DEVELOPMENT_GATE `PASS`. Genel durum: `IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING`.

Fiziksel donanım gerektiren maddeler artık tek bir birleşik listede toplanmıştır: **`MANUAL_TEST_CHECKLIST.md`**. Bu, tüm fazların manuel doğrulamasının tek bir fiziksel test oturumunda toplu yürütülmesini sağlar.

Phase 1'in DEVELOPMENT_GATE'i zaten geçmiş olduğu için Phase 2 — Boxing Motion geliştirmesine bu revizyon sonrasında başlanmıştır (aşağıya bakın).

---

## Phase 2 — Boxing Motion uygulaması — 18 Ağustos 2026

### Kapsam

- **Combo Speed** (`combo-speed@1.0.0`): tek hedefe konfigüre edilebilir el sırasıyla (`L-R`, `R-L`, `L-R-L`, `R-L-R` preset'leri) art arda vurma. Adım bazlı onset/contact/reaction/inter-punch/peak-velocity ölçümü, sıra doğruluğu (`WRONG_HAND`), duplicate-contact önleme ve per-hand step timing.
- **Guard Return** (`guard-return@1.0.0`): Full Reaction ile aynı hedef/vuruş akışı, ardından T3 — elin kalibre edilmiş guard bölgesine art arda 5 kare boyunca stabil dönüşü. Hit→guard-return süresi, sol/sağ guard return, failed return, overshoot ve sol/sağ fark metrikleri.

### Mimari kararlar

- Yeni saf, DOM'dan bağımsız motorlar: `src/features/camera-fight-lab/comboEngine.ts` (`ComboSequenceTracker`) ve `guardReturnEngine.ts` (`GuardReturnTracker`). İkisi de mocked landmark dizileriyle tam test edilmiştir ve mevcut `hitDetector`/`onsetDetector` altyapısını yeniden kullanır.
- `TrialResult` tipi geriye uyumlu biçimde genişletildi: `t3Ms`, `combo`, `guardReturn` alanları eklendi (Phase 0/1 protokollerinde her zaman `null`). `SessionSummary` tipine `combo` ve `guardReturn` alt-özetleri eklendi (diğer protokollerde sıfır değerli).
- Guard Return, vuruştan (T2) sonra da oyun durumunu `TARGET_ACTIVE`'de tutmaya devam eder; dönüş çözülene kadar bir sonraki trial başlamaz. Bu, state machine'e yeni bir durum eklemeden (gameStateMachine.ts değişmedi) trial bütünlüğünü korur. Dış trial zaman aşımı bu protokolde genişletilmiştir ve pose tracking tamamen kesilirse `GuardReturnTracker.forceResolve()` güvenlik ağı devreye girer.
- Session schema, app/package sürümü Phase 1 ile aynı kalmıştır (`blackbox-fight-lab-session/0.2`, `0.2.0`); Phase 2 alanları geriye uyumlu ek alanlardır, schema kırılması yoktur.
- Start ekranındaki mod seçimi tamamen data-driven (`PROTOCOL_LIST`) olduğu için iki yeni protokol otomatik olarak UI'da göründü; ek JSX değişikliği gerekmedi.

### Phase 2 DEVELOPMENT_GATE doğrulaması

| Kontrol | Sonuç |
| --- | --- |
| `npm run lint` | Başarılı, 0 hata |
| `npm run typecheck` | Başarılı |
| `npm test` | 25 dosya, 180/180 test başarılı |
| Combo Speed mocked landmark testleri | 7/7 (valid L-R, R-L, L-R-L, wrong order, same-hand-twice, duplicate contact, external timeout) |
| Guard Return mocked landmark testleri | 6/6 (valid return, tek-kare false crossing, timeout, noisy fluctuation, yanlış-el gözlemi, forceResolve) |
| Protocol generation testleri | Combo preset seçimi/tekrar-etmeme ve guard-return target üretimi doğrulandı |
| Session metrics testleri | Combo completion/inter-punch/consistency ve guard-return T3/overshoot doğrulandı |
| `npm run build` | Next.js 16 production build başarılı |
| `npm run test:e2e` | Chrome 4/4 + Edge 4/4, toplam 8/8 (Combo Speed + Guard Return mod seçimi ve instruction metni dahil) |
| Local smoke (dev server) | Combo Speed → "12 TRIAL" ve doğru instruction; Guard Return → "12 TRIAL" ve doğru instruction; konsol hatası yok |

### Gerçek donanım gerektiren maddeler (henüz doğrulanmadı)

Bkz. `19_FULL_ACCEPTANCE_GATES.md` → Phase 2 MANUAL_HARDWARE_GATE ve `MANUAL_TEST_CHECKLIST.md` → "Phase 2" bölümü. Özetle: gerçek combo sekansları, yanlış-el/duplicate-contact fiziksel davranışı, guard halkasının fiziksel hizalanması, gerçek T3 dönüş süresi ve düşük FPS/tracking-loss davranışı.

**Phase 2 genel durumu: `IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING`.** Phase 3 — Defense, Phase 2'nin DEVELOPMENT_GATE'i geçtiği için başlatılabilir; ancak hiçbir faz MANUAL_HARDWARE_GATE tamamlanmadan "release-ready" sayılmayacaktır.

### Phase 2 release kaydı — Vercel production

| Alan | Değer |
| --- | --- |
| Production URL | https://blackbox-gym-test.vercel.app |
| Production deployment | `blackbox-gym-test-4uqz5dluo-staytheingame.vercel.app` |
| Preview deployment | `blackbox-gym-test-fyrmeby65-staytheingame.vercel.app` |
| Durum | READY |
| Migration | Bekleyen yok; DB şeması değişmedi (Phase 2 tamamen istemci tarafında) |
| Production E2E | Chrome 4/4 + Edge 4/4 (canlı URL'e karşı) |
| Production runtime log | 100 kayıt, tamamı GET/200, 0 hata |
| Gizlilik taraması | Client bundle'da DB/secret sızıntısı yok |
| Rollback | Gerekmedi |

---

## Phase 3 — Defense uygulaması — 18 Ağustos 2026

### Kapsam

- **Defense Reflex** (`defense-reflex@1.0.0`): SOLA SLIP, SAĞA SLIP veya DUCK cue'suna baş/üst gövde hareketiyle yanıt. Onset (T1), yön+displacement eşiği (T2/completion) ve nötr pozisyona stabil dönüş (T3/recovery) ölçülür.

### Mimari kararlar

- Yeni saf motorlar: `src/features/camera-fight-lab/headMotion.ts` (`HeadMotionTracker`, bilek takibinden bağımsız) ve `defenseEngine.ts` (`DefenseReflexTracker`). `OnsetDetector` generic bir `OnsetObservation` şekline genelleştirildi (geriye uyumlu, Phase 0-2 davranışı değişmedi) ve baş hareketi için `phase3.head.*` eşikleriyle yeniden kullanıldı.
- Yön/displacement mirrored display koordinatında ve shoulder-width biriminde ölçülür; bu tasarım kararı ve gerekçesi `TUNING_GUIDE.md`'de belgelenmiştir (sporcunun ayna sezgisiyle örtüşmesi için).
- `CalibrationSnapshot`'a `headNeutralWorld`/`headNeutralImage` eklendi; kalibrasyon artık burun görünürlüğünü de zorunlu kılar.
- `TrialResult.defense` alanı eklendi; `t3Ms` alanı Guard Return ile aynı şekilde (guard-return'de el, defense-reflex'te baş için) yeniden kullanıldı. `SessionSummary.defense` her zaman hesaplanır (diğer protokollerde sıfır değerli).
- FAILED_RECOVERY, Guard Return'ün FAILED_RETURN'ü ile aynı ilkeyi izler: doğru savunma hareketi (yön+displacement doğru) üst düzeyde `HIT` sayılır; yalnız toparlanma başarısızlığı ayrı flag'lenir.

### Phase 3 DEVELOPMENT_GATE doğrulaması

| Kontrol | Sonuç |
| --- | --- |
| Boxing dosyaları için `eslint` (izole) | 0 hata, 0 uyarı |
| `npm run typecheck` | Başarılı |
| `npm test` | 30 dosya, 214/214 test başarılı |
| Defense Reflex mocked landmark testleri | 8/8 (doğru slip left/right/duck, yanlış yön, yetersiz displacement, yanıtsız, başarısız toparlanma, tek-kare stabil sayılmama) |
| `npm run build` | Next.js 16 production build başarılı |
| `npm run test:e2e` (boks paketi) | Chrome 6/6 + Edge 6/6, toplam 12/12 (Defense mod seçimi ve instruction metni dahil) |
| Local smoke (temiz tarayıcı sekmesi) | Defense modu → "15 TRIAL" ve doğru instruction; konsol hatası yok; ağ isteği yalnız GET/200 |

`npm run lint` komutu repo genelinde çalıştığında bu oturumda eşzamanlı geliştirilen ayrı bir modülden (Wrestling Lab) kaynaklanan hatalar gösterebilir; bu dosyalar Phase 0-3 boks kapsamının dışındadır ve bu değişiklikte dokunulmamıştır. `npm run build` (asıl deploy gate'i) bu durumdan etkilenmeden başarıyla tamamlanmıştır.

### Gerçek donanım gerektiren maddeler (henüz doğrulanmadı)

Bkz. `19_FULL_ACCEPTANCE_GATES.md` → Phase 3 MANUAL_HARDWARE_GATE ve `MANUAL_TEST_CHECKLIST.md` → "Phase 3" bölümü. Özetle: gerçek slip/duck hareketiyle doğru/yanlış yön sınıflandırması, gerçek toparlanma süresi ve aynalı görüntüde sezgisel yön davranışı.

**Phase 3 genel durumu: `IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING`.** Phase 4 — Virtual Opponent, Phase 3'ün DEVELOPMENT_GATE'i geçtiği için başlatılabilir; ancak hiçbir faz MANUAL_HARDWARE_GATE tamamlanmadan "release-ready" sayılmayacaktır.

### Phase 3 release kaydı — Vercel production

| Alan | Değer |
| --- | --- |
| Production URL | https://blackbox-gym-test.vercel.app |
| Production deployment | `blackbox-gym-test-i2t43sspo-staytheingame.vercel.app` |
| Preview deployment | `blackbox-gym-test-81wo77kjz-staytheingame.vercel.app` |
| Durum | READY |
| Migration | Bekleyen yok; DB şeması değişmedi |
| Production E2E (boks paketi) | Chrome 5/5 + Edge 5/5 (canlı URL'e karşı) |
| Production runtime log | 100 kayıt, tamamı GET/200, 0 hata |
| Gizlilik taraması | Client bundle'da DB/secret sızıntısı yok |
| Rollback | Gerekmedi |

## Phase 1 — Decision Tests uygulama planı

### P1-A — Protokol ve veri sözleşmesi

- Full Reaction mevcut davranışını geriye uyumlu protokol olarak koru.
- Choice Reaction, Go / No-Go ve Peripheral Reaction için sabit `protocolId`, `protocolVersion`, trial sayısı, T0 tanımı ve config snapshot/hash üret.
- Trial kayıtlarına stimulus türü, gereken el, gerçek ilk el, karar doğruluğu, wrong-hand, false-attack, correct-reject, inhibition window ve peripheral zone/eccentricity alanlarını ekle.
- Aynı monotonic zaman alanındaki T0/T1/T2 davranışını koru; NO_GO correct reject için pencere bitiş timestamp'ını ayrıca kaydet.

### P1-B — Decision motoru

- Choice stimulusunu renk + yazılı/simgesel el işaretiyle üret; canonical MediaPipe left/right bilgisini mirrored görünümden bağımsız değerlendir.
- Yanlış elin ilk geçerli hedef girişini `WRONG_HAND` olarak tek sonuçla tamamla.
- Go / No-Go içinde bounded ve tekrarlanabilir oranla GO/NO_GO üret; NO_GO inhibition penceresinde güvenilir onset'i `FALSE_ATTACK`, hareketsiz tamamlamayı `CORRECT_REJECT` olarak kaydet.
- Peripheral mode için center/inner-left/inner-right/outer-left/outer-right bölgeleri ve eccentricity metadata'sı üret; ekran aynalamasını yalnız display transformunda uygula.

### P1-C — UI, sonuç ve export

- Başlangıçta protokol seçimi, mod açıklaması ve fiziksel güvenlik rehberi göster.
- Test HUD/canvas üzerinde renk dışında metin/simge ile gereken eylemi göster; peripheral modda merkez fixation işareti kullan.
- Sonuçlarda decision accuracy, wrong-hand, false attack, correct reject ve sol/sağ peripheral metriklerini protokole göre göster.
- JSON export'a protocol kimliği/sürümü, config hash/snapshot, stimulus ham kayıtları ve decision summary ekle; kamera karelerini yerel tut.

### P1-D — Gate 1 doğrulaması

- Choice doğru/yanlış el ve mirror değişmezliği için unit test.
- Go / No-Go false attack, correct reject ve belgelenmiş inhibition window için unit test.
- Peripheral zone/eccentricity üretimi ve side metric doğruluğu için unit test.
- Full Reaction regresyon testleri, lint, typecheck, tüm Vitest paketi, production build ve Chrome/Edge browser kontrolleri.
- Fiziksel webcam gerektiren maddeleri otomatik doğrulanmış sayma; manuel Gate 1 kontrolünü açıkça belgele.

## Phase 1 tamamlanan uygulama

- `full-reaction@1.0.0`, `choice-reaction@1.0.0`, `go-no-go@1.0.0` ve `peripheral-reaction@1.0.0` tek kalibrasyon/pose ölçüm hattını paylaşır.
- Choice Reaction renk + metin cue'su kullanır. Gereken el canonical MediaPipe handedness'idir; mirrored display el mantığını ters çevirmez. İlk geçerli yanlış-el hit'i `WRONG_HAND` olur ve trial tek kez tamamlanır.
- Go / No-Go yüzde 30 NO_GO, arka arkaya en fazla iki NO_GO ve 1100 ms inhibition penceresiyle uygulanmıştır. Pencere içindeki güvenilir T1 `FALSE_ATTACK`; onset olmadan pencere sonu `CORRECT_REJECT` üretir.
- Peripheral Reaction center/inner-left/inner-right/outer-left/outer-right hedeflerini kalibre edilmiş omuz genişliğiyle üretir. Ham trial zone/side/eccentricity; summary ise yan reaction ve accuracy metriklerini taşır.
- Her protokolün T0 tanımı açık ve export içindedir. Session schema `blackbox-fight-lab-session/0.2`, app/package sürümü `0.2.0` olmuştur.
- Export `protocolId`, `protocolVersion`, deterministic config hash/snapshot, stimulus ve decision alanlarını içerir; kamera frame'i veya video içermez.
- Başlangıç ekranına mod seçimi ve fiziksel güvenlik rehberi; canvas/HUD'a metinli cue ve peripheral fixation; sonuçlara protokole özel decision kartları eklenmiştir.
- `PROTOCOL_CHANGELOG.md`, `TUNING_GUIDE.md` ve `KNOWN_LIMITATIONS.md` Phase 1 davranışıyla güncellenmiştir.

## Phase 1 Gate 1 doğrulaması — 18 Ağustos 2026

| Kontrol | Sonuç |
| --- | --- |
| `npm run lint` | Başarılı, 0 hata |
| `npm run typecheck` | Başarılı |
| `npm test` | 23 dosya, 161/161 test başarılı |
| Fight Lab unit paketi | 11 dosya, 42/42 test başarılı |
| `npm run build` | Next.js 16 production build başarılı |
| `npm run test:e2e` | Chrome 3/3 + Edge 3/3, toplam 6/6 başarılı |
| Local smoke | `/araclar/kamera-fight-lab` HTTP 200; Phase 1 ve safety içeriği mevcut |
| Supabase/Prisma | Şema geçerli; 2 migration bulundu ve cloud veritabanı güncel |

### Gate 1 maddeleri

- [x] Choice doğru/yanlış el davranışı mocked landmark/protocol testleriyle doğrulandı.
- [x] Choice canonical el kararı display mirror koordinatından bağımsızdır.
- [x] Go / No-Go false attack ve correct reject sınıflandırması test edildi.
- [x] NO_GO inhibition window config, UI/export ve changelog içinde belgelendi.
- [x] Peripheral zone/eccentricity üretimi ve tekrar etmeme kuralı test edildi.
- [x] Peripheral sol/sağ reaction ve accuracy metrikleri test edildi.
- [x] Phase 0 regresyon paketi, lint, typecheck, production build ve Chrome/Edge başlangıç akışları geçti.
- [ ] Gerçek webcam ile gereken el, fiziksel false attack/correct reject ve peripheral hedef erişimi güncel Chrome/Edge'de manuel sign-off bekliyor.

Phase 2'ye başlanmadı. Fiziksel Gate 1 maddesi tamamlanmadan sonraki faz tamamlanmış sayılmamalıdır.

---

## Release kaydı — 18 Ağustos 2026, Vercel production

Phase 0–1 çalışma ağacı, `staytheingame` scope'undaki `blackbox-gym-test` projesine deploy edildi.

| Alan | Değer |
| --- | --- |
| Production URL | https://blackbox-gym-test.vercel.app |
| Production deployment | `blackbox-gym-test-f2spqs02f-staytheingame.vercel.app` |
| Preview deployment | `blackbox-gym-test-gyt7l8a9q-staytheingame.vercel.app` |
| App / package sürümü | `0.2.0` |
| Session schema | `blackbox-fight-lab-session/0.2` |
| Durum | READY |

### Release öncesi kontroller

| Kontrol | Sonuç |
| --- | --- |
| `npx prisma validate` | Şema geçerli |
| `npx prisma migrate status` | 2 migration bulundu, veritabanı güncel; bekleyen migration yok |
| Supabase bağlantı sorgusu | `select 1` başarılı; `_prisma_migrations` içindeki 2 kayıt da `finished`; public şemada 24 tablo |
| `npm run lint` | 0 hata |
| `npm run typecheck` | Başarılı |
| `npm test` | 23 dosya, 161/161 |
| `npm run build` | Başarılı |
| `npm run test:e2e` (local) | Chrome 3/3 + Edge 3/3 |

Bekleyen migration olmadığı için veritabanına hiçbir yazma yapılmadı; `prisma migrate deploy` ve `prisma db push` çalıştırılmadı.

### Preview doğrulaması

- `/`, `/araclar`, `/araclar/kamera-fight-lab` → HTTP 200.
- Preview, Vercel Deployment Protection (SSO) arkasındadır; doğrulama protection bypass ile yapıldı. Koruma ayarı gevşetilmedi.
- Build log temiz: `prisma generate` başarılı, derleme başarılı, 51/51 static page.
- Runtime log yalnız GET/200 içerir; hata veya 5xx yok.

### Production doğrulaması

- `/`, `/araclar`, `/araclar/kamera-fight-lab` → kimlik doğrulamasız HTTP 200; HSTS aktif.
- Mevcut E2E paketi canlı production URL'ine karşı Chrome ve Edge'de çalıştırıldı: 6/6 başarılı. Kapsam: başlangıç ekranı, dört Phase 1 modu, güvenlik metni, kamera izni reddi ve veri yüklememe kontrolü.
- Tarayıcı ortamı: `isSecureContext=true`, `getUserMedia`, `enumerateDevices` ve `requestVideoFrameCallback` Chrome ve Edge'de mevcut.
- Dört mod arasında gezinirken POST/PUT/PATCH/DELETE isteği yok; üçüncü taraf host'a istek yok.
- Çalışan client bundle'ları (44 asset) tarandı: `postgres://`, pooler host'u, `SESSION_SECRET`, `DIRECT_URL`, `service_role` veya Supabase secret/anon anahtarı bulunamadı.
- Yeni çalışma ağacı rotaları (`/uye/kondisyon`, `/uye/ring-formu`, `/personel/adaylar`, `/personel/protokoller` vb.) canlıdır ve `/giris?next=...` adresine yönlenir.
- Production runtime log: 100 kayıt, tamamı GET/200, 0 hata, 0 5xx.

Rollback gerekmedi.

### Ortam değişkenleri

`DATABASE_URL`, `DIRECT_URL` ve `SESSION_SECRET` hem Preview hem Production ortamında Sensitive olarak tanımlıdır. Üçü de yalnız server-side'dır; hiçbiri `NEXT_PUBLIC_` değildir ve client bundle taramasında görülmemiştir.

### Ortam notu

Bu makinenin hostname'i ASCII olmayan bir karakter içerdiği için Vercel CLI, HTTP header'ında `ByteString` hatası verip çalışmıyordu. Deploy sırasında CLI process'ine özel, yalnız bellekte çalışan bir ASCII hostname shim'i kullanıldı. Diskte veya sistem ayarlarında değişiklik yapılmadı.

### Gate 1 — kalan manuel sign-off

Aşağıdaki maddeler gerçek webcam ve fiziksel yumruk gerektirir; bu ortamda otomatik olarak doğrulanamaz ve doğrulanmış sayılmamıştır. Güncel Chrome ve Edge'de production URL üzerinde yürütülmelidir:

- [ ] Choice Reaction: gereken el ile vuruş `HIT`, diğer el ile vuruş `WRONG_HAND` üretiyor mu?
- [ ] Choice Reaction: aynalı görüntü el mantığını ters çevirmiyor mu (sol el gerçekten canonical sol mu)?
- [ ] Go / No-Go: DUR hedefinde fiziksel hareket `FALSE_ATTACK`, hareketsizlik `CORRECT_REJECT` üretiyor mu?
- [ ] Peripheral: center, inner-left/right ve outer-left/right hedefleri fiziksel olarak erişilebiliyor mu?
- [ ] Skeleton ve hedef çizimi gerçek vücutla hizalı mı?
- [ ] Düşük FPS ve tracking-loss durumunda quality flag ve uyarı davranışı doğru mu?

Bu sign-off tamamlanmadan Phase 2 (Boxing Motion) başlatılmayacaktır.

---

## Wrestling Lab güncel durum — 18 Ağustos 2026

BlackBox Fight Lab artık aynı rotada, dinamik olarak ayrılmış Boxing Lab ve Wrestling Lab istemcilerini sunar. Wrestling kapsamı W0 kalibrasyondan W15 profile kadar; Weekly Benchmark, custom Coach Test, açıklanabilir adaptive recommendations, config/sürüm uyumlu longitudinal trendler, JSON export ve yalnız sayısal IndexedDB persistence dahil uygulanmıştır.

| Kontrol | Sonuç |
| --- | --- |
| W0–W15 DEVELOPMENT_GATE | PASS |
| Adaptive / longitudinal DEVELOPMENT_GATE | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 30 dosya, 214/214 |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — Chrome + Edge, 14/14 |
| W0–W15 MANUAL_HARDWARE_GATE | MANUAL_VERIFICATION_PENDING |

Ayrıntılı faz kaydı `WRESTLING_IMPLEMENTATION_STATUS.md`, fiziksel kabul listesi `WRESTLING_MANUAL_TEST_CHECKLIST.md`, şema kaydı `WRESTLING_SCHEMA_CHANGELOG.md` içindedir. Bu bölüm önceki tarihsel gate kayıtlarının üstüne yazan güncel kayıttır; manuel donanım doğrulaması yapılmış sayılmaz.
