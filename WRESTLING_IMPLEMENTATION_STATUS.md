# BlackBox Wrestling Lab — Implementation Status

Son güncelleme: 18 Ağustos 2026

## Başlangıç incelemesi

- Aktif hedef proje `blackbox-gym`; diğer workspace kopyaları Wrestling Lab için kullanılmayacak.
- Mevcut BlackBox Fight Lab, Next.js 16 + React 19 içinde çalışan tek bir istemci tarafı kamera aracıdır.
- Boxing Phase 0–2 (`full-reaction`, `choice-reaction`, `go-no-go`, `peripheral-reaction`, `combo-speed`, `guard-return`) korunacak ve regresyon testleriyle izlenecek.
- Mevcut reusable sistemler: kamera yöneticisi, MediaPipe worker/main-thread pose pipeline, monotonic video-frame timing, canvas koordinat dönüşümü, EMA smoothing, rolling history, velocity, onset/hit detector, state machine, protocol/config hash, quality flags, robust istatistikler, JSON export ve Vitest/Playwright altyapısı.
- Wrestling Lab ayrı ve çoğaltılmış bir uygulama olmayacak; aynı Fight Lab rotası, kamera/vision çekirdeği, pose örnekleri, zaman alanı, istatistikler ve export yaklaşımı üzerinde sport-specific protokoller olarak çalışacak.

## Gerekli yeni Wrestling sistemleri

- Alt gövde pose noktaları: nose/head proxy, hips, knees, ankles ve feet.
- `WrestlingCalibrationSnapshot` ve wrestling stance baseline.
- Çok-eklemli wrestling feature extractor: hip/body center, torso angle, stance width, knee-flexion proxy, displacement ve velocity.
- Shot, sprawl, choice, fake/real, movement, stance, hand fighting, chain, scramble, fatigue, virtual wrestler ve pattern protocol motorları.
- T3 stable return-to-stance detector.
- Wrestling-specific trial discriminated unions, summary, profile, compatible-version longitudinal trends ve açıklanabilir adaptive recommendations.
- Yalnız türetilmiş sayısal sonuçları saklayan local persistence; kamera karesi veya video saklanmayacak/yüklenmeyecek.

## Şema ekleri

- `sport: "wrestling"`
- `protocolId`, `protocolVersion`, `sessionId`, `athleteId`
- `cameraMetadata`, `calibrationSnapshot`, `configSnapshot`
- Wrestling-specific discriminated `rawTrials`
- `summary`, `qualityFlags`, `configHash`
- Protocol-version/config-hash uyumluluk anahtarı

Ayrıntılı kayıt: `WRESTLING_SCHEMA_CHANGELOG.md`.

## Protokol ekleri ve gate durumu

| Faz | Protokol | DEVELOPMENT_GATE | MANUAL_HARDWARE_GATE |
| --- | --- | --- | --- |
| W0 | Wrestling Calibration | PASS | MANUAL_VERIFICATION_PENDING |
| W1 | Shot Reaction | PASS | MANUAL_VERIFICATION_PENDING |
| W2 | Sprawl Reaction | PASS | MANUAL_VERIFICATION_PENDING |
| W3 | Wrestling Decision Reaction | PASS | MANUAL_VERIFICATION_PENDING |
| W4 | Fake / Real Recognition | PASS | MANUAL_VERIFICATION_PENDING |
| W5 | Movement Lab | PASS | MANUAL_VERIFICATION_PENDING |
| W6 | Stance Consistency | PASS | MANUAL_VERIFICATION_PENDING |
| W7 | Hand Fighting | PASS | MANUAL_VERIFICATION_PENDING |
| W8 | Chain Wrestling | PASS | MANUAL_VERIFICATION_PENDING |
| W9 | Scramble | PASS | MANUAL_VERIFICATION_PENDING |
| W10 | Fatigue Protocol | PASS | MANUAL_VERIFICATION_PENDING |
| W11 | Virtual Wrestler | PASS | MANUAL_VERIFICATION_PENDING |
| W12 | Opponent Reading | PASS | MANUAL_VERIFICATION_PENDING |
| W13 | Left / Right Difference | PASS | MANUAL_VERIFICATION_PENDING |
| W14 | Recovery to Stance | PASS | MANUAL_VERIFICATION_PENDING |
| W15 | BlackBox Wrestling Profile | PASS | MANUAL_VERIFICATION_PENDING |
| — | Adaptive Wrestling Engine | PASS | N/A |
| — | Longitudinal Wrestling Dashboard | PASS | N/A |

## DEVELOPMENT_GATE tanımı

Bir faz için typecheck, ilgili unit/mocked pose testleri, state-machine/protocol testleri ve production build geçmeden `PASS` yazılmaz. Boxing regresyonları aynı gate içinde değerlendirilir.

## MANUAL_HARDWARE_GATE tanımı

Gerçek atlet, gerçek webcam, gerçek stance/sprawl/level-change/lateral movement, framing, tracking quality ve ergonomi testleri otomatik olarak geçmiş sayılmaz. Tüm maddeler `WRESTLING_MANUAL_TEST_CHECKLIST.md` içinde `MANUAL_VERIFICATION_PENDING` kalır; yalnız insan tarafından fiziksel test sonrası güncellenebilir.

## W0 gate kaydı — 18 Ağustos 2026

- MediaPipe pose örnekleri head, knees, ankles, heels ve foot-index noktalarıyla geriye uyumlu biçimde genişletildi.
- `WrestlingCalibrationSnapshot`, stance feature extractor ve alt-gövde/stabilite kalite kapıları eklendi; Boxing `CalibrationSnapshot` değiştirilmedi.
- DEVELOPMENT_GATE: typecheck PASS; W0 + pose mapper + Boxing calibration regresyonu 9/9 PASS; production build PASS.
- MANUAL_HARDWARE_GATE: `MANUAL_VERIFICATION_PENDING`.

## W1–W6 gate kaydı — 18 Ağustos 2026

- Tek `WrestlingTrialEngine`, hip/body/knee/wrist bileşik hızını kullanır; onset iki-kare doğrulamalı, completion ve T3 recovery ayrı olaylardır.
- W1 shot, W2 multi-signal sprawl, W3 required-response choice, W4 real/fake restraint, W5 altı-yön movement ve W6 stance consistency discriminated trial tipleriyle uygulandı.
- Yanlış yön, false defense, missed/no response, tracking loss ve recovery failure ham trial içinde görünür kalır.
- DEVELOPMENT_GATE: typecheck PASS; tüm paket 27 dosya/193 test PASS; production build PASS.
- W1–W6 MANUAL_HARDWARE_GATE: `MANUAL_VERIFICATION_PENDING`.

## W7–W14 gate kaydı — 18 Ağustos 2026

- W7, mevcut wrist motion/onset çekirdeğini wrestling hedef ve stable guard-return mantığıyla yeniden kullanır.
- W8 sıralı hareketleri, geçiş sürelerini, yanlış sıra ve duplicate hareketi; W9 komut bazlı scramble performansını ve blok içi kötüleşmeyi kaydeder.
- W10 kişisel baseline/work/post/optional recovery bloklarını karşılaştırır; tıbbi recovery veya fatigue tanısı üretmez.
- W11'in hafif sanal rakibi `cueStart`, `commitStart`, `attackThreshold` ve `recoveryEnd` olaylarını açıkça kaydeder. W12 fake/shot pattern dizilerini ve adaptasyonu ölçer.
- W13 summary içinde mutlak ve göreli sol/sağ farkını; W14 ortak `StableStanceRecoveryTracker` üzerinden art arda beş stabil kareli T3'ü üretir.
- DEVELOPMENT_GATE: ilgili saf motor, mocked pose ve protokol testleri PASS.
- W7–W14 MANUAL_HARDWARE_GATE: `MANUAL_VERIFICATION_PENDING`.

## W15, adaptive ve longitudinal gate kaydı — 18 Ağustos 2026

- Wrestling geçmişi yalnız türetilmiş sayısal seanslar olarak, sürümlü IndexedDB store'unda tutulur; kamera karesi, fotoğraf, ses veya video saklanmaz.
- Trendler yalnız aynı `protocolId`, `protocolVersion` ve `configHash` grubunda baseline/latest/personal-best/last-3/last-5 değerlerini karşılaştırır.
- Sekiz deneysel ürün boyutu ham metrikle birlikte gösterilir. Açıklanabilir adaptive kurallar düşük tracking-quality seanslarını öneri girdisinden çıkarır.
- Weekly Benchmark sabit protokol; Coach Test ayrı custom config ve config hash ile sunulur. JSON export ham trial ve kalite bayraklarını korur.

## Nihai otomatik doğrulama — 18 Ağustos 2026

| Kontrol | Sonuç |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 30 dosya, 214/214 test |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS — Chrome + Edge, 14/14 |
| Boxing regresyonları | PASS — Phase 0–3 modları ve kamera reddi akışı |
| Wrestling katalog / privacy / kamera reddi | PASS — Chrome + Edge |

**Genel durum:** W0–W15, adaptive engine ve longitudinal dashboard için `DEVELOPMENT_GATE=PASS`. Gerçek atlet + webcam ölçüm doğruluğu hâlâ `MANUAL_VERIFICATION_PENDING`; ürün bu fiziksel gate tamamlanmadan bilimsel olarak doğrulanmış veya tam release-ready diye tanımlanamaz.
