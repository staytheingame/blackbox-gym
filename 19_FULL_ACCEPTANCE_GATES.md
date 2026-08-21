# BlackBox Fight Lab — Full Product Pack Acceptance Gates

Bu dosya, `IMPLEMENTATION_STATUS.md`'deki faz ilerlemesinin resmi kabul kaydıdır. 18 Ağustos 2026 itibarıyla gate sistemi ikiye ayrılmıştır.

## Gate sistemi

Her faz artık **iki bağımsız gate** ile değerlendirilir:

### 1. DEVELOPMENT_GATE (otomatik, geliştirmeyi bloke eder)

Şunları kapsar:

- `npm run typecheck`
- `npm test` (unit + mocked landmark sequence testleri)
- State machine testleri (`gameStateMachine.test.ts` ve ilgili protokol/engine state machine testleri)
- Coordinate/mirroring testleri (`coordinates.test.ts`, mirror invariance testleri)
- Protocol testleri (`protocols.test.ts`)
- `npm run build` (production build)
- Browser automation ile doğrulanabilen maddeler (Playwright E2E: mod seçimi, güvenlik metni, kamera izni reddi akışı, POST/PUT/PATCH yokluğu)

**Kural:** Bir sonraki faz DEVELOPMENT_GATE'i geçmeden başlamaz. DEVELOPMENT_GATE geçen bir faz `IMPLEMENTED` sayılır — ama henüz `RELEASE-READY` değildir.

### 2. MANUAL_HARDWARE_GATE (zorunlu, ama sonraki fazın geliştirmesini bloke etmez)

Şunları kapsar:

- Gerçek webcam
- Gerçek insan hareketi / gerçek yumruk
- Skeleton'ın fiziksel vücutla hizalanması
- Gerçek FPS ve tracking-loss davranışı
- Gerçek kullanım ergonomisi (kalibrasyon, guard pozisyonu, mesafe)

**Kural:** MANUAL_HARDWARE_GATE, **release öncesi zorunludur** — production'a "bu faz tamamen doğrulandı" denilemez. Ancak eksik olması sonraki fazın **geliştirmesini** bloke etmez; yalnız o fazın release/production kabulünü bloke eder. Bir faz DEVELOPMENT_GATE'i geçip MANUAL_HARDWARE_GATE'i beklerken durumu:

```
IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING
```

olarak işaretlenir. Bu asla "tamamlandı" veya "doğrulandı" ile eş tutulmaz.

## Durum değerleri

| Değer | Anlamı |
| --- | --- |
| `PASS` | Kontrol çalıştırıldı ve geçti |
| `FAIL` | Kontrol çalıştırıldı ve başarısız oldu; düzeltilmeden ilerlenemez |
| `MANUAL_VERIFICATION_PENDING` | Gerçek donanım/kullanıcı gerektirir; bu ortamda otomatik doğrulanamaz, henüz yapılmadı |
| `NOT_STARTED` | Faz için henüz kod/test yazılmadı |

Hiçbir manuel madde, gerçekten yapılmadan `PASS` olarak işaretlenmez.

## Faz durumu matrisi

| Faz | DEVELOPMENT_GATE | MANUAL_HARDWARE_GATE | Genel durum |
| --- | --- | --- | --- |
| Phase 0 — Core Measurement | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| Phase 1 — Decision Tests | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| Phase 2 — Boxing Motion | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| Phase 3 — Defense | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| Phase 4 — Virtual Opponent | NOT_STARTED | NOT_STARTED | Başlanmadı |
| Phase 5 — Pattern Recognition | NOT_STARTED | NOT_STARTED | Başlanmadı |
| Phase 6 — Fatigue Protocol | NOT_STARTED | NOT_STARTED | Başlanmadı |
| Phase 7 — Longitudinal Athlete Profile | NOT_STARTED | NOT_STARTED | Başlanmadı |
| Phase 8 — Adaptive Training Engine | NOT_STARTED | NOT_STARTED | Başlanmadı |
| Phase 9 — BlackBox Combat Profile | NOT_STARTED | NOT_STARTED | Başlanmadı |

## Phase 0 — DEVELOPMENT_GATE detayı: PASS

| Kontrol | Sonuç |
| --- | --- |
| Typecheck | PASS |
| Unit / mocked landmark testleri | PASS |
| Production build | PASS |
| Chrome/Edge E2E (başlangıç akışı, kamera reddi) | PASS |

## Phase 0 — MANUAL_HARDWARE_GATE detayı: MANUAL_VERIFICATION_PENDING

Bkz. `MANUAL_TEST_CHECKLIST.md` → "Phase 0" bölümü.

## Phase 1 — DEVELOPMENT_GATE detayı: PASS

| Kontrol | Sonuç |
| --- | --- |
| Typecheck | PASS |
| Unit / mocked landmark testleri (Choice/Go-No-Go/Peripheral) | PASS |
| Protocol testleri | PASS |
| Production build | PASS |
| Chrome/Edge E2E (4 mod seçimi, güvenlik metni) | PASS |

## Phase 1 — MANUAL_HARDWARE_GATE detayı: MANUAL_VERIFICATION_PENDING

Bkz. `MANUAL_TEST_CHECKLIST.md` → "Phase 1" bölümü.

## Phase 2 — DEVELOPMENT_GATE detayı: PASS (18 Ağustos 2026)

| Kontrol | Sonuç |
| --- | --- |
| `npm run lint` | PASS — 0 hata |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 25 dosya, 180/180 test |
| Combo Speed mocked landmark testleri (valid L-R/R-L/L-R-L, wrong order, same-hand-twice, duplicate contact) | PASS |
| Guard Return mocked landmark testleri (valid return, tek-kare false crossing, timeout, noisy fluctuation) | PASS |
| Protocol generation testleri (combo preset seçimi, guard-return target üretimi) | PASS |
| Session metrics testleri (combo completion/inter-punch/consistency, guard return T3/overshoot) | PASS |
| `npm run build` | PASS |
| Chrome/Edge E2E (Combo Speed + Guard Return mod seçimi, instruction metni) | PASS — 8/8 |
| Regresyon (Phase 0/1 test paketi) | PASS |

## Phase 2 — MANUAL_HARDWARE_GATE detayı: MANUAL_VERIFICATION_PENDING

Bkz. `MANUAL_TEST_CHECKLIST.md` → "Phase 2" bölümü. Aşağıdaki maddeler gerçek webcam ve fiziksel yumruk gerektirir; bu ortamda doğrulanamaz:

- [ ] Combo Speed: L-R, R-L, L-R-L, R-L-R sekansları fiziksel olarak tamamlanabiliyor mu?
- [ ] Combo Speed: yanlış el/sıra ile atılan yumruk `WRONG_HAND` üretiyor mu?
- [ ] Combo Speed: bir yumruktan sonra eli geri çekmeden tekrar hedefe dokundurmak ikinci adımı tamamlamıyor mu (duplicate contact)?
- [ ] Guard Return: gerçek vuruş sonrası ele guard'a dönüş fiziksel olarak doğru ölçülüyor mu (T3)?
- [ ] Guard Return: guard bölgesinin görsel konumu gerçek guard pozisyonuyla hizalı mı?
- [ ] Guard Return: yavaş/tereddütlü dönüş `FAILED_RETURN` olarak mı, yoksa yanlışlıkla `RETURNED` olarak mı işaretleniyor?
- [ ] Düşük FPS ve tracking-loss durumunda her iki protokolün davranışı beklenen gibi mi?

## Phase 3 — DEVELOPMENT_GATE detayı: PASS (18 Ağustos 2026)

| Kontrol | Sonuç |
| --- | --- |
| Boxing dosyaları için `eslint` (izole) | PASS — 0 hata, 0 uyarı |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 30 dosya, 214/214 test |
| Defense Reflex mocked landmark testleri (doğru slip left/right/duck, yanlış yön, yetersiz displacement, yanıtsız, başarısız toparlanma, tek-kare stabil sayılmama) | PASS — 8/8 |
| `npm run build` | PASS |
| Chrome/Edge E2E (boks paketi, Defense mod seçimi ve instruction metni dahil) | PASS — 12/12 |
| Regresyon (Phase 0/1/2 test paketi) | PASS |

## Phase 3 — MANUAL_HARDWARE_GATE detayı: MANUAL_VERIFICATION_PENDING

Bkz. `MANUAL_TEST_CHECKLIST.md` → "Phase 3" bölümü. Aşağıdaki maddeler gerçek webcam ve fiziksel slip/duck hareketi gerektirir; bu ortamda doğrulanamaz:

- [ ] SOLA SLIP / SAĞA SLIP / DUCK cue'larına fiziksel doğru yön hareketi `CORRECT` üretiyor mu?
- [ ] Yanlış yönde hareket `WRONG_DIRECTION` üretiyor mu?
- [ ] Hareketten sonra nötr pozisyona stabil dönüş T3'ü doğru ölçüyor mu; dönmemek `FAILED_RECOVERY` üretiyor mu?
- [ ] Aynalı görüntüde yön sporcunun sezgisel beklentisiyle örtüşüyor mu?
- [ ] Düşük FPS/tracking-loss davranışı beklenen gibi mi?

## Sonraki adım

Phase 3 DEVELOPMENT_GATE geçtiği için Phase 4 — Virtual Opponent geliştirmesine başlanabilir. Phase 0/1/2/3'ün MANUAL_HARDWARE_GATE'i tamamlanmadan hiçbiri "release-ready" veya "doğrulandı" olarak raporlanmayacaktır.

---

## Wrestling Lab acceptance özeti — 18 Ağustos 2026

| Kapsam | DEVELOPMENT_GATE | MANUAL_HARDWARE_GATE | Genel durum |
| --- | --- | --- | --- |
| W0 — Calibration | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| W1–W6 — Reaction, decision, movement, stance | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| W7–W10 — Hand fighting, chain, scramble, fatigue | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| W11–W12 — Virtual wrestler, opponent reading | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| W13–W15 — symmetry, recovery, profile | PASS | MANUAL_VERIFICATION_PENDING | IMPLEMENTED — MANUAL HARDWARE VERIFICATION PENDING |
| Adaptive recommendations / longitudinal dashboard | PASS | N/A | IMPLEMENTED |

### Wrestling DEVELOPMENT_GATE kanıtı

| Kontrol | Sonuç |
| --- | --- |
| Lint / typecheck | PASS |
| Saf motor + mocked pose + protocol + profile testleri | PASS |
| Tüm unit/regression paketi | PASS — 30 dosya, 214/214 |
| Production build | PASS |
| Chrome/Edge E2E | PASS — 14/14 |
| Camera denial + mutating request yokluğu | PASS — Boxing ve Wrestling |

Gerçek mat/atlet/webcam doğrulaması otomatik testin yerine geçmez. Ayrıntılı W0–W15 fiziksel maddeleri `WRESTLING_MANUAL_TEST_CHECKLIST.md` içinde ve tamamı `MANUAL_VERIFICATION_PENDING` durumundadır.
