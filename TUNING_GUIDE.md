# Camera Fight Lab V0.1 — Tuning Guide

Ölçüm sonucunu etkileyen bütün eşikler `src/config/performanceConfig.ts` içindeki `PERFORMANCE_CONFIG` nesnesindedir. Bir seans dışa aktarıldığında bu nesne `config.snapshot` alanına eksiksiz kopyalanır; böylece farklı eşiklerle alınmış sonuçlar sonradan ayırt edilebilir.

Her değişiklikten sonra en az şu mocked senaryoları çalıştır:

```bash
npm test -- src/features/camera-fight-lab
```

Gerçek kamera tuning'i yaparken `?debug=1` kullan. Örnek: `/araclar/kamera-fight-lab?debug=1`. Canvas üzerindeki son iki saniyelik mavi/sol ve pembe/sağ velocity çizgilerini, sarı onset çizgisini, guard baseline noktalarını ve T0/T1/T2 değerlerini birlikte izle. Tek bir kişiye göre eşik sabitleme; farklı boy, kamera, ışık ve mesafelerle tekrar et.

## Onset velocity

- Alan: `motion.onsetVelocityMps`
- Varsayılan: `0.50 m/s`
- Amaç: T1 adayının başlayacağı filtrelenmiş world-wrist hızı.
- Jitter veya küçük guard düzeltmeleri T1 üretiyorsa yükselt.
- Gerçek yumruğun ilk bölümünü kaçırıyor ve T1 geç geliyorsa küçük adımlarla düşür.
- `motion.onsetConsecutiveFrames` iki karelik doğrulama yapar; tek kare spike'ı kabul edilmez.
- `motion.strongOnsetVelocityMps`, çok net bir başlangıçta tek kareyle erken T1 yakalamak içindir.
- `motion.onsetExitVelocityMps` histerezis alt eşiğidir; adayın gürültüyle açılıp kapanmasını azaltır.
- `motion.minimumOnsetDisplacementM` guard baseline'dan minimum uzaklaşmayı zorunlu kılar. Detector ayrıca bileğin guard'a geri dönmek yerine guard'dan uzaklaşmasını ister.

## Hit velocity

- Alan: `hit.minimumVelocityMps`
- Varsayılan: `0.72 m/s`
- Amaç: Bileğin hedef bölgesine gerçek bir yumruk hızıyla girmesini zorunlu kılmak.
- Yavaş el yerleştirme hit oluyorsa yükselt.
- Net yumruklar hedefe girip `TOO SLOW` veriyorsa, önce düşük FPS/frame gap ve world-landmark kararlılığını kontrol et; sonra küçük adımlarla düşür.
- `hit.minimumDirectionCosine` bilek hareketinin hedefe genel olarak yönelmesini denetler. Yanlamasına phantom hit varsa yükselt; açılı ama geçerli yumruklar reddediliyorsa düşür.
- `hit.wristTolerancePx` ekranda bilek noktasının yumruk merkezini tam temsil etmemesini telafi eder. Büyük değer phantom hit riskini artırır.

## Smoothing

- Alan: `motion.emaAlpha`
- Varsayılan: `0.55`
- Büyük alpha yeni kareye daha çok ağırlık verir: daha hızlı onset, daha fazla jitter.
- Küçük alpha daha sakin sinyal verir: daha az false positive, daha gecikmiş T1.
- Alpha değiştiğinde onset ve hit velocity eşiklerini birlikte yeniden doğrula.
- `motion.landmarkJumpM` tek karede fiziksel olarak güvenilmez sıçramaları quality flag ile reddeder.
- `motion.maxFrameGapMs` aşıldığında iki kare arasında velocity hesaplanmaz; eski ve yeni konumu bölerek sahte hız üretilmez.

## Target radius

- Alanlar: `target.radiusShoulderRatio`, `target.minRadiusNormalized`, `target.maxRadiusNormalized`
- Radius, kalibre edilmiş normalized omuz genişliğiyle ölçeklenir ve min/max aralığına sıkıştırılır.
- Farklı çözünürlüklerde sabit piksel kullanma. Hedef kolaylaştırılacaksa önce shoulder ratio'yu küçük adımlarla artır.
- Radius değişikliği accuracy'yi doğrudan etkiler; karşılaştırılacak seanslarda aynı config snapshot kullanılmalıdır.

## Target timeout

- Alan: `target.timeoutMs`
- Varsayılan: `2800 ms`
- Kullanıcı hedefe hareket başlatıp ulaşamıyorsa deneme `TARGET_TIMEOUT` olur; güvenilir T1 varsa ham kayıtta korunur ancak headline reaction metriğine yalnız geçerli hit'ler girer.
- Timeout'u çok kısa yapmak hareket kabiliyetiyle reaction ölçümünü karıştırır; çok uzun yapmak test ritmini bozar.

## Confidence

- Alan: `pose.minVisibility`
- Varsayılan: `0.65`
- Omuz, bilek ve kalibrasyon görünürlük kapısıdır; MediaPipe detection/presence/tracking confidence seçeneklerine de aktarılır.
- Düşük ışıkta veri çok sık reddediliyorsa ışık ve kamera konumunu düzeltmeden eşiği düşürme.
- Eşiği düşürmek daha fazla kare üretir ama phantom onset/hit riskini artırır.

## Random delay

- Alanlar: `target.randomDelayMinMs`, `target.randomDelayMaxMs`
- Varsayılan: `900–2200 ms`
- Sabit aralık kullanma. Min değeri çok kısa olursa trial feedback sonrası guard'a dönme süresi anticipation flag ile karışabilir.
- Aralık daraldıkça kullanıcı ritmi tahmin edebilir; ölçüm güvenilirliği düşer.

## FPS warning

- Alan: `camera.fpsWarningBelow`
- Varsayılan: `24 FPS`
- Uyarı ölçümü engellemez; trial'a `LOW_CAMERA_FPS` quality flag'i ekler.
- Pose inference `pose.maxProcessingFps` ile 30 FPS'e sınırlandırılır. Kamera 60 FPS verse bile pose FPS'in 30 civarında olması beklenir.
- Düşük FPS'te T0–T1 ve T1–T2 çözünürlüğü kare aralığıyla sınırlıdır. Önce ışık, kamera çözünürlüğü ve worker durumunu düzelt.

## Calibration

- `calibration.stableWindowMs`: guard'ın ne kadar süre kararlı tutulacağı.
- `calibration.maxWristNoiseM`: baseline sırasında kabul edilen median bilek gürültüsü.
- `calibration.min/maxShoulderWidthNormalized`: kullanıcının kadraja göre çok uzak/yakın olmasını engeller.
- `calibration.guardWristBelowShoulderAllowanceNormalized`: guard kontrolünün düşey toleransı.

Kalibrasyon değişikliklerinde boş kadraj, eksik bilek, iki kişi, kadraj dışı el, sallanan guard ve stabil guard örneklerini birlikte doğrula.

## Session quality formülü

V0.1 session quality puanı:

```text
tracking quality × 0.60
+ FPS quality × 0.25
+ valid-trial ratio × 0.15
```

- `GOOD`: 80 ve üzeri
- `FAIR`: 60–79.9
- `POOR`: 60 altı

Bu kalite puanı ölçüm koşulunu açıklar; atletik veya klinik skor değildir.

## Phase 1 decision protokolleri

### Choice Reaction

- Canonical el eşleşmesi `protocols.ts` içinde mavi + `SOL` ve pembe + `SAĞ` cue'suyla tanımlıdır. Renk tek başına kullanılmaz.
- Aynalı video yalnız display koordinatını değiştirir; MediaPipe `left`/`right` handedness'i ve gereken el değiştirilmez.
- Yanlış elin hız/yön/entry koşullarını geçen ilk teması trial'ı `WRONG_HAND` olarak tamamlar. İkinci elin daha sonra vurması sonucu değiştirmez.

### Go / No-Go

- `decision.noGoProbability`: varsayılan NO_GO olasılığı `0.30`.
- `decision.maxConsecutiveNoGo`: tahmin edilebilir veya aşırı uzun DUR serisini sınırlar; varsayılan `2`.
- `decision.noGoInhibitionWindowMs`: `1100 ms`. T0 sonrasında bu pencere içindeki güvenilir T1 onset'i `FALSE_ATTACK`; pencere boyunca onset olmaması `CORRECT_REJECT` üretir.
- Bu metrik klinik impulse-control veya inhibisyon testi değildir. Pencere değiştiğinde protocol config hash değişir ve sonuçlar eski protokolle otomatik karşılaştırılmamalıdır.

### Peripheral Reaction

- Bölgeler `decision.peripheralZones` altında `center`, `inner-left`, `inner-right`, `outer-left`, `outer-right` olarak kaydedilir.
- Yatay uzaklık kalibre edilmiş normalized omuz genişliğinin çarpanıdır. Viewport margin clamp dışarı taşmayı engeller.
- `peripheralSide` ve `peripheralEccentricity` her trial JSON'una yazılır; sonuçlar yan bazında reaction ve accuracy üretir.
- Webcam pose modeli bakış yönünü ölçmez. Merkez fixation işareti kullanıcı yönergesidir; gerçek göz fiksasyonu doğrulanamaz.

## Protokol sürümü ve config hash

Her export `protocolId`, `protocolVersion`, T0 tanımı ve measurement config'in deterministic `fnv1a32` hash'ini içerir. Ölçüm eşiği, trial sayısı veya decision config'i değiştirildiğinde protocol version da yükseltilmeli ve farklı hash'ler otomatik olarak karşılaştırılmamalıdır.

## Phase 2 boxing motion protokolleri

Bütün eşikler `performanceConfig.ts` içindeki `phase2` bloğundadır.

### Combo Speed

- Sabit el sırası preset'leri: `L-R`, `R-L`, `L-R-L`, `R-L-R` (`comboEngine.ts` → `COMBO_PRESETS`). Yeni bir sıra eklemek protocol version yükseltmesi gerektirir.
- Tek hedef tüm kombinasyon boyunca sabittir; her adım kendi onset/hit tespitini kullanır ve kabul edilen temastan sonra o elin onset detector'ı sıfırlanır.
- **Duplicate contact önleme**: bir adım kabul edildiğinde ilgili el "hedefte" sayılır ve hedeften fiziksel olarak çıkmadan (retraction) sonraki temas yeni adım saymaz — `HAND_ALREADY_IN_TARGET` ile reddedilir ve `duplicateContactRejectedCount`'a yazılır. Bu, tek bir sürekli temasın iki adımı birden tamamlamasını engeller.
- Yanlış el/sıra: beklenen elden farklı bir el hedefe kabul edilebilir hızda girerse trial tek sonuçla `WRONG_HAND` olarak biter (Phase 1 Choice Reaction ile aynı tasarım dili).
- `phase2.comboTotalTimeoutMs` (varsayılan `6000 ms`): tüm kombinasyon için tek bir dış zaman aşımı; adım sayısından bağımsızdır. Uzun sekanslar (L-R-L, R-L-R) için gerekirse artır.
- `interPunchMs` adımlar arası temas farkıdır (adım 0 hariç); `reactionMs` yalnız adım 0'da T0'dan onsete kadar ölçülür. Session summary bunları median + MAD ile robust consistency olarak raporlar.

### Guard Return

- T3 tanımı: elin, kalibre edilmiş guard noktasına (`calibration.leftGuardImage`/`rightGuardImage`) art arda `phase2.guardReturnStableFrames` (varsayılan `5`) kare boyunca girmesi. **Tek kare girişi dönüş saymaz** — bu, gerçek stabil dönüşü kayıtsız bir geçişten ayırt eder.
- Guard bölgesi yarıçapı `phase2.guardReturnZoneRadiusRatio` (varsayılan `1.2`) ile punch hedefiyle aynı shoulder-width tabanlı formülden türetilir; guard bölgesini büyütüp küçültmek için bu oranı değiştir.
- `phase2.guardReturnTimeoutMs` (varsayılan `2500 ms`): vuruştan (T2) itibaren dönüş için tanınan süre. Bu pencerede stabil dönüş olmazsa `FAILED_RETURN` üretilir.
- **Overshoot**: el guard bölgesine girip stabilite eşiğine ulaşmadan tekrar çıkarsa bir overshoot olayı sayılır (`overshootCount`). Bu, aşırı hızlı/kontrolsüz dönüşleri stabil dönüşten ayırt etmek içindir.
- Trial, hedef vuruşundan (T2) sonra da `TARGET_ACTIVE` durumunda kalmaya devam eder; dönüş çözülene kadar bir sonraki trial başlamaz. Dış trial zaman aşımı bu protokolde `target.timeoutMs + phase2.guardReturnTimeoutMs` olarak genişletilir; pose tracking tamamen kesilirse bu dış zaman aşımı `GuardReturnTracker.forceResolve()` ile `FAILED_RETURN` üretir.
- Guard Return klinik motor kontrol veya nöromüsküler değerlendirme değildir; yalnız kamera tabanlı karşılaştırmalı bir dönüş süresi metriğidir.

### Ortak notlar

- İki protokol de aynı pose/kalibrasyon/hit-detection altyapısını (`hitDetector.ts`, `onsetDetector.ts`) paylaşır; yalnız trial orkestrasyonu farklıdır.
- `comboEngine.ts` ve `guardReturnEngine.ts` saf, DOM'dan bağımsız state machine'lerdir ve mocked landmark dizileriyle Vitest üzerinden test edilir. Eşik değiştiğinde önce bu testleri güncelle, sonra gerçek kamerada doğrula.

## Phase 3 — Defense (Slip Left / Slip Right / Duck)

Bütün eşikler `performanceConfig.ts` içindeki `phase3` bloğundadır.

### Baş takibi (`phase3.head`)

- Ayrı bir `HeadMotionTracker` (bkz. `headMotion.ts`), bilek takibinden (`WristMotionTracker`) bağımsız olarak burun (nose) landmark'ını world/image uzayında EMA ile yumuşatır. Bilinçli olarak ayrı tutulmuştur ki Phase 0-2'nin test edilmiş yumruk hattı bu eklemeden etkilenmesin.
- `OnsetDetector`, artık `WristObservation`'a değil generic bir `OnsetObservation` şekline bağlıdır (yapısal olarak geriye uyumlu); bu sayede aynı çok-kare doğrulama/güçlü-eşik mantığı `phase3.head.*` eşikleriyle baş hareketi için de kullanılır.
- `phase3.head.onsetVelocityMps` (0.32 m/s) ve `minimumOnsetDisplacementM` (0.018 m), yumruk eşiklerinden (0.5 m/s, 0.025 m) kasıtlı olarak daha düşüktür — baş hareketi yumruktan çok daha küçük ve daha yavaştır.

### Yön ve displacement (`phase3.defense`)

- Lateral (sola/sağa) ve vertical (aşağı/duck) displacement, **mirrored display koordinatında** ve kalibre edilmiş shoulder-width biriminde ölçülür: `(display - nötr) / canvasBoyutu / shoulderWidthNormalized`. Bu, farklı mesafe/çözünürlüklerde tutarlı kalır.
- **Yön kuralı bilinçli bir tasarım kararıdır**: yumruk el kimliğinde (Choice Reaction) canonical MediaPipe handedness kullanılırken, defense'te mirrored display koordinatı doğrudan kullanılır. Çünkü sporcu ekrana bir aynaya bakar gibi bakar; kendi soluna eğildiğinde ekranda da sola hareket eder (gerçek ayna fiziğiyle örtüşür). "SOLA SLIP" dendiğinde sporcu sezgisel olarak ekran-sola hareket etmeyi bekler — bu davranış test edilmiş ve `defenseEngine.test.ts` içinde doğrulanmıştır.
- `minLateralDisplacementShoulderWidths` (0.42) ve `minVerticalDisplacementShoulderWidths` (0.34): hangi eksenin önce eşiği aştığı "detected action"ı belirler. İkisi de aşılırsa büyük olan kazanır.
- `recoveryStableFrames` (5): T3 onaylanmadan önce nötr pozisyona (guard return ile aynı prensip) art arda kalınması gereken kare sayısı; tek kare geçişi dönüş saymaz.
- `recoveryZoneRadiusShoulderWidths` (0.3) ve `recoveryTimeoutMs` (2200 ms): stabil dönüş bölgesi ve süresi.
- `responseTimeoutMs` (2600 ms): T0'dan itibaren hiç onset başlamazsa `NO_RESPONSE`; onset başladı ama eşik hiç aşılmadıysa `INSUFFICIENT_DISPLACEMENT`.

### Kalibrasyon değişikliği

- `calibrationEngine.ts` artık burun (nose) görünürlüğünü de omuz/bilek gibi zorunlu kılar ve `headNeutralWorld`/`headNeutralImage` medyan baseline'ını kaydeder. Bu, Phase 0-2 kullanıcı deneyimini pratikte değiştirmez (yüz zaten üst gövde framing'i için kadrajda olmak zorundaydı) ama gerçek kamerada yüzü kısmen kadraj dışına çıkaran ekstrem açılarda kalibrasyonu daha önce geçebilen bir durumu artık reddedebilir — saha testinde izlenmelidir.
- Defense-reflex trial'ında görsel hedef, punch hedefinin aksine hiçbir zaman hit-test edilmez; yalnız "gelen darbe" işaretidir (`createDefenseCueTarget`).

## Wrestling Lab tuning

Bütün Wrestling eşikleri `src/config/performanceConfig.ts` içindeki `wrestling` bloğundadır. Eşik, trial count veya timing değiştiğinde ilgili `protocolVersion` ve config hash karşılaştırma davranışını yeniden değerlendir.

### Calibration

- `minimumSamples=24`, `stableWindowMs=1500`: stance baseline örnek sayısı ve pencere süresi.
- `minVisibility=0.60`, `lowerBodyVisibleRatio=0.78`: alt gövde landmark güvenilirliği.
- `minStanceWidthNormalized=0.055`: ayakların ayırt edilebilir stance genişliği.
- Hip-height, torso-angle, stance-width ve body-center MAD eşikleri stabil kalibrasyon gate'ini oluşturur. Farklı kamera açılarıyla manuel test yapılmadan gevşetme.

### Motion ve completion

- `onsetCompositeVelocity=0.42` ve `onsetConsecutiveFrames=2`: hip/body/knee/wrist bileşik onset gate'i.
- `directionDeadZoneNormalized=0.018`: küçük postür gürültüsünün yön sayılmasını engeller.
- Shot ve movement completion displacement değerleri sırasıyla `0.075` ve `0.07` normalized birimdir.
- Sprawl en az iki bileşik sinyal ister: hip displacement, hip-height delta, torso-angle delta veya stance-width delta. Tek landmark ile sprawl kabul etme.
- `restraintWindowMs=1150`: Fake / Real fake trial'ında anlamlı hareketten kaçınma penceresi.

### Stable stance recovery (T3)

- Body center, hip height, torso angle ve stance width baseline toleranslarının tamamı sağlanmalı; composite velocity `0.24` altında olmalıdır.
- Koşullar art arda `5` güvenilir frame sürmeden T3 üretilmez. Timeout `3000 ms`.
- Eşik değişikliklerini valid recovery, tek-frame crossing, noisy fluctuation, timeout ve tracking-loss fixture'larıyla birlikte test et.

### Longitudinal karşılaştırma

- Yalnız aynı `protocolId + protocolVersion + configHash` grubunu karşılaştır.
- Tracking quality `%60` altındaki seanslar adaptive recommendation girdisi değildir.
- Profil skorlarını ham metrikten bağımsız bir gerçek veya nüfus normu gibi sunma.
