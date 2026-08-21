# BlackBox Fight Lab — Protocol Changelog

Bu kayıt yalnız ölçüm davranışını etkileyen protokol değişikliklerini izler. Farklı `protocolVersion` veya config hash'e sahip seanslar otomatik olarak karşılaştırılmamalıdır.

## 18 Ağustos 2026 — Wrestling W0

### `wrestling-calibration@1.0.0`

- Boxing calibration korunurken head/shoulder/hip/knee/ankle/wrist görünürlüğü ve full-body framing kapıları eklendi.
- Wrestling stance baseline; hip height, knee-flexion proxy, torso angle, stance width, body center ve foot-lead relationship alanlarını kaydeder.
- Bunlar tek RGB kameradan türetilen karşılaştırmalı hareket özellikleridir; laboratuvar biyomekaniği veya teknik doğruluk iddiası değildir.

### `shot-reaction@1.0.0` / `sprawl-reaction@1.0.0`

- Shot cue ilk görünür frame'i T0; çok-eklemli onset T1; directional/compound threshold T2; stable stance recovery T3'tür.
- Sprawl tek landmark ile sınıflanmaz; hip displacement, hip-height delta, torso-angle delta ve stance-width delta sinyallerinden en az ikisini ister.

### `wrestling-choice@1.0.0` / `fake-real-recognition@1.0.0`

- Single/double attack sınıfı required response'a deterministik eşlenir.
- Fake trial, tanımlı restraint penceresinde anlamlı çok-eklemli onset yoksa `CORRECT_RESTRAINT`; onset varsa `FALSE_DEFENSE` üretir.

### `movement-lab@1.0.0` / `stance-consistency@1.0.0`

- Movement; LEFT, RIGHT, FORWARD, BACK, CIRCLE_LEFT ve CIRCLE_RIGHT komutlarını body-center displacement ile ölçer ve stance recovery T3'ü kaydeder.
- Stance consistency hip-height, torso-angle, stance-width ve body-center variation'dan açıklanabilir bir ürün metriği üretir; teknik veya sakatlık değerlendirmesi değildir.

### `hand-fighting@1.0.0` / `chain-wrestling@1.0.0`

- Hand Fighting hedef teması, doğru el, onset/contact ve stable return sürelerini ortak wrist-motion çekirdeğiyle ölçer.
- Chain Wrestling konfigüre edilmiş yön dizisini, adım geçiş sürelerini, yanlış sıra, incomplete ve duplicate hareket hatalarını kaydeder.

### `scramble@1.0.0` / `wrestling-fatigue@1.0.0`

- Scramble rastgele kontrollü wrestling komutlarını ve başlangıç/son blok performans değişimini raporlar.
- Fatigue protokolü A baseline, B work, C post ve optional D recovery bloklarını aynı kişisel config içinde karşılaştırır; klinik yorgunluk veya recovery tanısı değildir.

### `virtual-wrestler@1.0.0` / `opponent-reading@1.0.0`

- Virtual Wrestler için T0 semantiği protokol ayarına bağlı `cueStart` veya `commitStart` olayıdır; commit ve threshold zamanları stimulus kaydında açıkça tutulur.
- Opponent Reading pattern kimliğini, cue dizisini, beklenen response dizisini ve pattern error sayısını kaydeder; gizli bir AI skoru üretmez.

### `weekly-benchmark@1.0.0` / `coach-test@1.0.0`

- Weekly Benchmark sabit shot, recognition, sprawl, movement ve recovery bloklarıyla sürüm/hash uyumlu kişisel karşılaştırma sağlar.
- Coach Test, koç ayarını ayrı config snapshot/hash girdisi olarak kaydeder; farklı custom konfigürasyonlar otomatik karşılaştırılmaz.

### Ortak W13–W15 davranışı

- Sol/sağ farkı hem mutlak milisaniye hem kişisel ortalamaya göre yüzde olarak raporlanır.
- T3, baseline stance toleranslarının art arda beş güvenilir kare boyunca korunmasıdır.
- Wrestling Profile yalnız aynı protocol version + config hash içindeki sayısal geçmişi kullanır; sekiz ürün boyutu deneysel olarak etiketlenir ve ham metriği görünür tutar.

## 18 Ağustos 2026 — Session schema 0.2 / Phase 1

### `full-reaction@1.0.0`

- Phase 0 davranışı korunmuştur: 20 trial, canvas frame T0, pose-frame T1/T2, hız/yön/entry kontrollü hit.
- Export sözleşmesine protocol kimliği, sürümü ve deterministic config hash eklenmiştir; ölçüm algoritması değiştirilmemiştir.

### `choice-reaction@1.0.0`

- 20 trial.
- T0: SOL/SAĞ cue'su ve hedefin aynı canvas frame'inde ilk çiziminden hemen önce alınan `performance.now()`.
- Mavi + SOL canonical sol eli, pembe + SAĞ canonical sağ eli ister.
- İlk geçerli target entry gereken elle ise `HIT`, diğer elle ise `WRONG_HAND`.

### `go-no-go@1.0.0`

- 20 trial; NO_GO olasılığı `0.30`, arka arkaya en fazla 2 NO_GO.
- T0: VUR/DUR cue'sunun ilk canvas çiziminden hemen önce alınan `performance.now()`.
- DUR penceresi `1100 ms`. Pencere içindeki güvenilir T1 `FALSE_ATTACK`; onset olmadan pencere sonu `CORRECT_REJECT`.
- Klinik impulse-control iddiası yoktur.

### `peripheral-reaction@1.0.0`

- 20 trial.
- T0: peripheral hedefin ilk canvas çiziminden hemen önce alınan `performance.now()`.
- Bölgeler: center, inner-left, inner-right, outer-left, outer-right.
- Her trial side/eccentricity kaydeder; summary yan reaction ve accuracy metriklerini içerir.
- Merkez fixation görseldir; göz takibi yapılmaz.

## 18 Ağustos 2026 — Phase 2 / Boxing Motion

Gate sistemi bu tarihte DEVELOPMENT_GATE (otomatik) ve MANUAL_HARDWARE_GATE (gerçek webcam/fiziksel kullanıcı) olarak ikiye ayrıldı. Aşağıdaki protokoller DEVELOPMENT_GATE'i geçmiştir; fiziksel doğrulaması `MANUAL_TEST_CHECKLIST.md`'de bekliyor.

### `combo-speed@1.0.0`

- 12 trial; sabit el sırası preset'leri: `L-R`, `R-L`, `L-R-L`, `R-L-R` (rastgele seçilir, art arda aynı preset tekrar etmez).
- T0: hedefin ve ilk el adımının canvas üzerinde ilk çiziminden hemen önce alınan `performance.now()`.
- Her adım kendi onset/hit tespitini kullanır. Kabul edilen temastan sonra ilgili el hedeften fiziksel olarak çıkmadan (retraction) yeni temas bir sonraki adımı tamamlayamaz (`DUPLICATE_CONTACT_REJECTED`).
- Beklenenden farklı bir el kabul edilebilir hızda hedefe girerse trial `WRONG_HAND` ile tek sonuçla biter.
- Export'a adım bazlı `combo.steps[]` (onset/contact/reaction/inter-punch/peak velocity), `combo.outcome`, `combo.errorStepIndex` ve `combo.duplicateContactRejectedCount` eklenmiştir. Klinik motor sıralama testi değildir.

### `guard-return@1.0.0`

- 12 trial; hedef üretimi Full Reaction ile aynıdır.
- T0/T1/T2 tanımı Full Reaction ile aynıdır. Vuruştan (T2) sonra trial `TARGET_ACTIVE` durumunda kalmaya devam eder ve T3 — elin kalibre edilmiş guard bölgesine art arda 5 kare boyunca stabil dönüşü — ölçülür. Tek kare girişi dönüş saymaz.
- Guard bölgesine stabilite eşiğine ulaşmadan girip çıkma "overshoot" olarak sayılır; 2500 ms içinde stabil dönüş olmazsa `FAILED_RETURN`.
- Export'a `t3Ms` (T0/T1/T2 ile aynı monotonic performance.now() alanında) ve `guardReturn` (hand/hitMs/t3Ms/returnTimeMs/outcome/overshootCount) eklenmiştir. Klinik nöromüsküler kontrol testi değildir.

## 18 Ağustos 2026 — Phase 3 / Defense

### `defense-reflex@1.0.0`

- 15 trial; her trial'da SLIP_LEFT, SLIP_RIGHT veya DUCK cue'sundan biri rastgele seçilir (art arda aynı eylem tekrar etmez).
- T0: defense cue'sunun canvas üzerinde ilk çiziminden hemen önce alınan `performance.now()`.
- T1 (onset): burun (nose) landmark'ının kalibre edilmiş nötr pozisyondan world-space'te güvenilir şekilde uzaklaşmaya başladığı an; Phase 0'daki OnsetDetector, baş hareketine özgü ayrı eşiklerle (daha düşük hız/displacement) yeniden kullanılır.
- T2 (completion): mirrored display koordinatında ve shoulder-width birimiyle ölçülen lateral/vertical displacement'in cued eylem için gereken eşiği ilk aştığı an. Yön, sporcunun kendi aynadaki sezgisiyle örtüşecek şekilde mirrored koordinatta değerlendirilir (SOLA SLIP = ekranda sola hareket).
- T3 (recovery): T2'den sonra elin değil, başın kalibre edilmiş nötr pozisyona art arda 5 kare boyunca stabil dönüşü. Tek kare geçişi dönüş saymaz.
- Sonuç sınıfları: `CORRECT` (doğru yön + yeterli displacement + stabil dönüş), `WRONG_DIRECTION` (yanlış yönde tamamlama — trial tek sonuçla biter), `INSUFFICIENT_DISPLACEMENT` (hareket başladı ama eşiği hiç aşmadı), `FAILED_RECOVERY` (doğru savunma ama nötr pozisyona dönemedi — Guard Return'deki FAILED_RETURN ile aynı mantıkla üst düzey `outcome` yine `HIT` kalır), `NO_RESPONSE` (hiç hareket başlamadı).
- Export'a `defense` (action/detectedAction/onsetMs/completionMs/recoveryMs/reactionMs/movementMs/recoveryTimeMs/outcome/peakLateral·VerticalDisplacementShoulderWidths) eklenmiştir; `t3Ms` alanı Guard Return ile aynı şekilde yeniden kullanılır. Klinik reaksiyon/denge/vestibüler değerlendirme değildir.
- Kalibrasyon artık burun (nose) görünürlüğünü de zorunlu kılar ve `headNeutralWorld`/`headNeutralImage` baseline'ını kaydeder (Phase 0-2 protokolleri bu alanları kullanmaz, geriye dönük davranış değişmez).
