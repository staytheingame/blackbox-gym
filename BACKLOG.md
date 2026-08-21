# Backlog

## Yapıldı (Faz 1 — public site)

- İzole proje iskeleti (Next.js + TS strict + Tailwind v4).
- BlackBox marka teması (siyah/sarı/beyaz) ve app shell (Header/Footer).
- Public sayfalar: `/`, `/uyelikler`, `/antrenman-planlari`, `/ekipman`,
  `/dersler`, `/antrenorler`, `/iletisim` (statik/mock veri).

## Yapıldı (Faz 2 — üye takip & performans paneli)

- Prisma + SQLite yerel veritabanı (`prisma/schema.prisma`, `prisma/dev.db`).
  **Neden Supabase değil:** kullanıcının Supabase hesabında ücretsiz proje
  limiti doluydu (KONG ACADEMY + KONG Family OS = 2/2) ve ortamda Docker
  yok. Kullanıcı "önce local kalsın, sonra taşırız" dedi.
- Basit yerel auth: bcrypt + imzalı httpOnly session cookie
  (`src/lib/auth/session.ts`), uygulama katmanı yetki guard'ları
  (`src/lib/auth/guards.ts`: `requireUser`, `requireStaff`,
  `requireOrganizationMembership`, `requireMemberSelf`,
  `requireStaffScopeForMember`).
- Domain katmanı (Kong Academy'nin `scorecard.ts`/`gamification.ts`
  desenlerinden uyarlandı, gerçek veri kopyalanmadı):
  `src/domain/performance/scorecard.ts`, `src/domain/gamification/points.ts`,
  `src/domain/gamification/badges.ts` — 14 Vitest testiyle kaplı.
- Üye paneli: özet, haftalık check-in, antrenman logu, performans skor
  kartı, lig sıralaması + rozetler.
- Personel paneli: üye ekleme (kendi geçici şifresiyle), üye detayı,
  antrenman loglama, check-in inceleme.
- Uçtan uca tarayıcı testiyle doğrulandı: personel girişi → üye ekleme →
  antrenman loglama (puan işledi) → üye girişi → check-in gönderme →
  skor kartı/puan/rozet/lig güncellendi → rol izolasyonu (üye `/personel`'e
  giremiyor, otomatik `/uye`'ye yönleniyor) → oturumsuz erişim `/giris`'e
  yönleniyor.

## Yapıldı (Faz 3 — sesli refleks & dövüş analitiği)

- `/araclar`, `/araclar/sesli-refleks`, `/araclar/dovus-analitigi` —
  public (giriş gerektirmez), tamamen client-side, backend/DB'ye
  dokunmuyor.
- **Sesli refleks:** Kong Academy'deki "Fight Refleks" özelliği yalnızca
  `kong-academy/BACKLOG.md`'de tasarım olarak vardı — gerçek kod
  (`src/lib/fight/commands.ts`, `scripts/verify-fight-reaction.ts`) üç
  worktree'de de fiziksel olarak bulunamadı (grep ile doğrulandı).
  Kopyalanacak kod yoktu; sıfırdan yazıldı (`src/domain/reflex/**`,
  Web Speech API tabanlı `ReflexTrainer.tsx`).
- **Dövüş analitiği:** Kong Academy'de gerçek, çalışan implementasyon
  bulundu — `FightAnalyticsDashboard.tsx`, tamamen client-side
  `@mediapipe/tasks-vision` (PoseLandmarker). Ayrı bir Python/FastAPI
  backend de vardı (`fight-analytics/`, Railway'e deploy edilmek üzere)
  ama kullanılmıyordu (`src/lib/fightAnalytics.ts` kod yorumunda "Python
  backend kaldırıldı" yazıyor) — BlackBox'a da o Python backend
  **taşınmadı**, yalnızca client-side MediaPipe yaklaşımı basitleştirilip
  uyarlandı (`src/domain/fight-analytics/metrics.ts`).
- Her iki domain katmanı da Vitest ile test edildi.
- Ana sayfada "Araçlar" bölümü (hero'dan hemen sonra) + nav'da "Araçlar"
  linki eklendi.

## Yapıldı (Faz 4 — panel kabuğu)

- Panel artık tanıtım sitesinin içinde değil: public sayfalar
  `app/(site)` route group'una alındı, Header/Footer oraya taşındı, kök
  layout yalnız `<html>/<body>` + fontları kuruyor.
- Kong Academy'nin `PanelSidebar`/`PanelTabBar`/`MobileNavContext`
  deseni BlackBox temasıyla yeniden yazıldı (kod kopyalanmadı; Kong
  CSS Module + Supabase'e bağlıydı, buradaki sürüm Tailwind + yerel
  auth): `src/components/panel/**`, tek nav kaynağı
  `src/config/panel-nav.tsx` — yan menü ve mobil alt bar aynı listeden
  türer.
- Panel sayfa dili `PageHero` (pazarlama hero'su) yerine
  `PanelPage`/`PanelCard`/`StatCard`/`Pill` bileşenleri.
- Üye özeti panoya dönüştü: skor, puan, lig sırası, check-in serisi,
  son antrenmanlar, rozetler.
- Personel paneli üç sayfaya ayrıldı: `/personel` genel bakış (sayaçlar +
  inceleme kuyruğu), `/personel/uyeler` (liste + üye ekleme),
  `/personel/check-inler` (inceleme kuyruğu, menüde bekleyen sayısı
  rozetiyle). `reviewCheckInAction` iki sayfadan da çağrıldığı için
  `app/personel/actions.ts`'e taşındı.
- `/giris` marketing hero'sundan çıkıp tek işe odaklı bir giriş ekranı
  oldu; public header'a "Giriş" linki eklendi.
- Personel hesabı `/uye`'ye giderse artık `/giris`'e değil `/personel`'e
  yönleniyor.

## Yapıldı (Faz 5 — Kong yapısının birebir portu)

Kullanıcı kararı: "Kong Academy'nin yapısı birebir aynı olsun, BlackBox
yazsın, ana tema fight olsun." Kong'un **gezinme mimarisi** (bölüm → alt
sayfa, 2 kademe; üçüncü kademe yok, sekmeler sayfa içinde `?tab=`) birebir
port edildi; içerik fight eksenine çevrildi.

- `src/config/panel-nav.tsx` — Kong'un `nav-config.tsx` modeli:
  `sectionsForRole` / `mobileTabsForRole` / `sectionForPath` /
  `isNavigableRoot` / `splitHref` / `matchesPath`, rozet anahtarları,
  feature flag'ler. **Personel 8 bölüm, üye 6 bölüm** — Kong'daki koç 8 /
  danışan 6 ile birebir.
- `src/components/panel/SectionNav.tsx` — Kong'un bölüm şeridi: aktiflik
  önce yola sonra `?tab=`/`?tur=` sorgusuna bakar, kayıt detayında gizlenir.
- `src/config/feature-flags.ts` — `NEXT_PUBLIC_FEATURE_*` ile bölüm
  aç/kapa (Kong'un `lib/feature-flags.ts` deseni).
- `src/lib/queries/nav-badges.ts` — yalnız "senden bir şey bekleniyor"
  sayıları (Kong'un rozet kuralı).

### Kong → BlackBox bölüm haritası

| Kong (koç/danışan) | BlackBox | Durum |
| --- | --- | --- |
| Genel Bakış | `/personel` | çalışıyor |
| Danışanlar → Liste / Aranacaklar | `/personel/uyeler`, `/personel/adaylar` | liste çalışıyor, aday takibi kısmi |
| Planlar (library) | `/personel/planlar?tur=antrenman\|kondisyon`, `/personel/tarti` | şablon listesi + atama + tartı çalışıyor; şablon düzenleme yok |
| Egzersiz Kütüphanesi | `/personel/teknikler` | çalışıyor (statik teknik havuzu) |
| Protokoller | `/personel/protokoller` | iskelet |
| Akademi | — | **kaldırıldı** (Faz 8); yerine `/personel/program` ders programı |
| Takip → Kontroller / İçgörüler / Mesajlar | `/personel/check-inler`, `/personel/icgoruler`, `/personel/mesajlar` | ilk ikisi çalışıyor |
| Yönetim → Satışlar / Başvurular / Duyurular / Etkinlikler | `/personel/uyelikler`, `/personel/basvurular`, `/personel/duyurular`, `/personel/etkinlikler` | abonelik yönetimi + etkinlik listesi çalışıyor; tahsilat yok |
| Ayarlar | `/personel/ayarlar` | iskelet |
| Danışan Ana Sayfa | `/uye` | çalışıyor |
| Planım → Antrenman / Kardiyo / Beslenme / Egzersizler | `/uye/antrenman`, `/uye/kondisyon`, `/uye/tarti`, `/uye/teknikler` | dördü de çalışıyor (antrenman ve kondisyon programı ayrı yürür) |
| Akademi | — | **kaldırıldı** (Faz 8); yerine `/uye/program`, `/uye/derslerim`, `/uye/uyelik`, `/uye/etkinlikler` |
| Kontrol ve Gelişim | `/uye/check-in`, `/uye/performans`, `/uye/ring-formu`, `/uye/lig` | hepsi çalışıyor |
| Mesajlar → Koçum / İstekler | `/uye/mesajlar`, `/uye/istekler` | iskelet |
| Profil → Ayarlar / Notlar / Araçlar | `/uye/profil`, `/uye/notlar`, `/uye/araclar` | profil + araçlar çalışıyor |

**Fight uyarlamaları:** Kong'un beslenme/kalori ekseni yerine — Beslenme →
**Tartı & sıklet takibi**, Egzersiz Kütüphanesi → **Teknik & kombinasyon
kütüphanesi**, Hareket Analizi → **Ring Formu** (mevcut dövüş analitiği +
sesli refleks), Etkinlikler → **sparring geceleri / iç turnuva**,
Protokoller → **maç kampı protokolleri**.

**Yer tutucu ekranlar boş değil:** her biri ne yapacağını, Kong'da neyin
karşılığı olduğunu ve çalışması için hangi tablonun gerektiğini yazıyor
(`Scaffold` bileşeni).

## Yapıldı (Faz 6 — Planlar/Programım + Üyelik/Tartı)

Kullanıcı önceliği: "tamamen dövüş odaklı; Planlar + Programım, Üyelik +
tartı/sıklet."

- **Yeni tablolar (9):** `PlanTemplate` / `PlanDay` / `PlanItem` /
  `MemberPlan` / `PlanCompletion`, `MembershipPlan` /
  `MemberSubscription`, `WeightEntry` / `WeightGoal`.
  Migration: `20260817145531_plans_and_memberships`.
- **Planlar (personel):** `/personel/planlar?tur=antrenman|kondisyon`
  şablon listesi + 1. hafta önizlemesi; atama sporcu detayındaki
  "Program Ata" kartından (`assignPlanAction`) — yeni atama eskisini
  kapatır, geçmiş silinmez.
- **Programım (üye):** `/uye/antrenman` artık atanan programın **bulunduğu
  haftasını** gösteriyor; gün gün round/teknik/RPE listesi ve
  "Tamamla" işareti (`togglePlanDayAction`, sahiplik `memberOwnsPlan` ile
  doğrulanıyor).
- **Tartı & sıklet (üye):** `/uye/tarti` — tartı kaydı, sıklet hedefi,
  maç tarihi, haftalık trend ve **güvenli düşüş kontrolü**.
  Kural: haftalık kayıp vücut ağırlığının %1'ini geçerse "riskli",
  1.5 katını geçerse "sürede yetişmez" (`src/domain/weight/cut.ts`,
  9 Vitest testi).
- **Üyelik & ödeme (personel):** `/personel/uyelikler` — paketler, aktif
  abonelikler, bitmek üzere olanlar (14 gün), ödeme bekleyenler, aktif
  ciro (`src/lib/queries/memberships.ts`).
- **Sıklet tablosu:** `src/data/weight-classes.ts` (amatör boks sıkletleri).
- **Seed:** 3 üyelik paketi, 3 plan şablonu (4 haftalık Temel Boks,
  8 haftalık Maç Kampı, 4 haftalık Kondisyon Bloğu — haftalara göre round
  artışıyla), test üyesine atanmış program + abonelik + 4 haftalık tartı
  geçmişi ve sıklet hedefi.

**Veritabanı:** kullanıcı yeni bir Supabase hesabı açtı; geçiş adımları
[`SUPABASE-GECIS.md`](./SUPABASE-GECIS.md) dosyasında. Claude'a bağlı
Supabase MCP hâlâ eski hesabı (`yigitkong's`) gösteriyor — geçiş
connection string ile yapılacak, MCP şart değil.

## Yapıldı (Faz 7 — eksik kapatma turu)

Önceki turda "açık iş" diye bırakılan, veri modeli gerektirmeyen
parçalar kapatıldı.

- **`/personel/tarti` ekranı eklendi.** Menüde linki vardı ama sayfa
  yoktu (404). Şimdi: salon geneli tartı listesi (son tartı, haftalık
  eğilim, sıklet durumu), "tartı gecikti" uyarısı, personelin sporcu
  adına tartı girmesi ve sıklet hedefi ataması
  (`WeightEntry.recordedByUserId` artık gerçekten doluyor).
- **Program tamamlama puana işliyor.** "Tamamla"ya basınca o günün
  planından bir `TrainingLog` türetiliyor (round/süre/RPE toplanarak —
  `src/domain/plans/workload.ts`, 7 test) ve normal antrenman kaydı gibi
  puan/rozet zincirini tetikliyor. Geri alma kaydı siler ve puanı
  **ters kayıtla** iade eder (`training_reverted`); puan defteri
  append-only kalır, rozet geri alınmaz.
- **Antrenman ve kondisyon programı ayrı yürüyor.** Eskiden yeni atama
  sporcunun *tüm* aktif planlarını kapatıyordu, bu yüzden kimse aynı anda
  hem antrenman hem kondisyon programı taşıyamıyordu. Artık tür başına
  bir aktif plan: `assignPlanToMember` yalnız aynı türü kapatır,
  `getActiveMemberPlan(memberId, kind)` türe göre okur.
- **`/uye/kondisyon` gerçek ekran oldu** (Scaffold değil): atanan
  kondisyon programının bulunduğu haftası, haftalık kondisyon hacmi ve
  kondisyon tipli antrenman geçmişi. Program haftası kartları antrenman
  ekranıyla ortak (`src/components/panel/PlanWeek.tsx`).
- **Abonelik yönetimi panelden yapılıyor.** `/personel/uyelikler`:
  başlatma/yenileme (yenilemede yeni dönem eskisi bitince başlar, kalan
  günler yanmaz), ödendi işareti, dondurma/devam ettirme/iptal. Süresi
  geçmiş "aktif" kayıtlar listede zaten `bitti` görünüyor; kaydı da
  kapatan toplu düğme var (`closeExpiredSubscriptions` — cron kurulunca
  aynı fonksiyon çağrılacak). Sporcu detayında üyelik + tartı özet
  kartları eklendi.
- **Hafta sınırı Europe/Istanbul'a çekildi.** `getWeekStart` artık
  salonun saat dilimine göre Pazartesi'yi buluyor; zaman damgası
  filtreleri için ayrı `getWeekStartInstant` var (Pazartesi 00:00
  Istanbul = Pazar 21:00 UTC). Öncesinde Pazartesi 00:00–03:00 arasındaki
  check-in/antrenman "geçen hafta" sayılıyordu. 11 test.
- **N+1 sorgu kaldırıldı:** `listMembers` üye başına ayrı puan sorgusu
  atıyordu; tek `groupBy` oldu.
- **Feature flag varsayılanları tek kaynağa indi.** `panel-nav.tsx` ile
  `feature-flags.ts` farklı varsayılanlar tutuyordu (`mesajlar` birinde
  açık, diğerinde kapalı); artık `DEFAULT_FEATURE_FLAGS` tek doğru kaynak.
- **`npm run typecheck` betiği eklendi** (README'de yazıyordu ama
  `package.json`'da yoktu); ayrıca `test:watch` ve `db:seed`.
- **Dokümanlar güncellendi:** `.env.example` ve `SUPABASE-GECIS.md` hâlâ
  SQLite anlatıyordu — geçiş çoktan tamamlanmıştı.

## Yapıldı (Faz 8 — ders programı, rezervasyon ve ders hakkı)

Kullanıcı kararı: **"Akademiyi ve ödemeleri kaldır; yerine spor salonu gibi
üyelik takip sistemi olsun — kaç ders, dersler ne zaman, üyeler ders seansı
seçebilsin; performans ve gelişim kayıt altında olsun."**

### Kaldırılanlar

- **Akademi bölümü tamamen silindi** (`/personel/akademi`, `/uye/akademi`,
  `akademi` feature flag'i, `pendingAcademy` rozeti). Boşalan bölüm yerini
  **Ders Programı** (personel) / **Dersler** (üye) aldı.
- **Ödeme takibi silindi.** Şemadan `MemberSubscription.priceMinor` ve
  `paidAt`, `MembershipPlan.sessionsPerWeek` düştü. "Ödendi/ödenmedi", ciro,
  tahsilat ekranları yok. `MembershipPlan.priceMinor` **kaldı** ama yalnız
  paketin etiket fiyatıdır — para salonun kendi yöntemiyle alınır.

### Ders programı modeli (kullanıcının tarifi)

Sabit haftalık ders takvimi **yok**. Antrenör boş saatlerini yayımlar,
sporcular ortak tablodan istediğini kapar:

- **`TrainingSlot`** — antrenörün açtığı saat. `capacity = 1` birebir
  demektir; tek seferlik ya da haftalık tekrarlı açılır (`repeatWeeks`).
- **`SlotBooking`** — sporcunun kaydı. Yer boşsa doğrudan `onayli`; doluysa
  `bekliyor` düşer ve **antrenör onayıyla** kontenjan bir kişilik büyür,
  seans grup dersine döner (kullanıcının istediği akış birebir bu).
- Durumlar: `onayli` / `bekliyor` / `reddedildi` / `iptal` / `katildi` /
  `gelmedi`.
- Migration: `20260818000000_ders_programi_ve_rezervasyon`.

### Ders hakkı (toplam paket modeli)

Üyelik bir **ders paketi**: "16 ders / 60 gün". Kural
(`src/domain/booking/credits.ts`, 22 test):

- Rezervasyon **ayırır**, harcamaz — hak `katildi` ya da `gelmedi`
  işaretlenince düşer. Gelmemek de hak yakar (salon o saati tuttu).
- Seanstan önce iptal ayrılan hakkı geri verir; son 3 saatte iptal kapanır.
- Kalan hak = toplam − harcanan − ayrılan; kimse hakkından fazla rezerve
  edemez. `totalSessions = null` → sınırsız paket.
- Hak, **aboneliğin dönemine düşen** rezervasyonlara göre sayılır: önceki
  dönemin dersleri yeni paketten düşmez.

### Ekranlar

| Rol | Ekran | Ne yapar |
| --- | --- | --- |
| Personel | `/personel/program` | Haftalık tablo: açık saatler, kim kapmış, boş yer; saat açma (tek/tekrarlı), iptal |
| Personel | `/personel/program/istekler` | Grup dersi katılım isteklerini onayla/reddet |
| Personel | `/personel/program/yoklama` | Geçmiş seanslarda geldi/gelmedi; "geldi" antrenman kaydı + puan üretir |
| Personel | `/personel/uyelikler` | Paketler, üyelik başlat/yenile, kalan ders dökümü, dondur/iptal |
| Üye | `/uye/program` | Antrenörün açık saatleri; boşu kap, doluya katılım isteği gönder, vazgeç |
| Üye | `/uye/derslerim` | Yaklaşan dersler + geçmiş katılım, katılım oranı |
| Üye | `/uye/uyelik` | Kalan gün, kalan ders, paket kullanım çubuğu, üyelik geçmişi |

### Performans & gelişim

- **Yoklama performansa işler:** "geldi" işareti seansın süresiyle bir
  `TrainingLog` yazar → puan, rozet ve haftalık hacim grafiği güncellenir.
  İşaret değiştirilirse önceki kayıt geri alınır (ters puan kaydıyla).
- `src/domain/performance/progress.ts` (14 test) üç ekseni **ayrı** tutar —
  tek bir "genel puan"a ezmez:
  - **Devamlılık:** katılım oranı (katıldı / yoklaması alınmış).
  - **Hacim:** son 8 haftanın haftalık dakikası + son 4 haftanın önceki
    4 haftaya göre % değişimi.
  - **Skor:** check-in performans kartı geçmişi (ilk → son → en iyi).
- `ProgressPanel` bileşeni hem `/uye/performans` hem sporcu detayında —
  üye ve antrenör aynı sayıları görür.
- Personel genel bakışına **bugünün dersleri**, yoklama bekleyen ve katılım
  isteği sayaçları eklendi; menü rozetleri (`pendingBookings`,
  `pendingAttendance`) buna bağlandı.

### Yan işler

- Vitest'e `@/` alias'ı eklendi (`vitest.config.mts`) — domain testleri artık
  `@/lib/date` gibi yolları çözebiliyor.
- `src/lib/date.ts`: `formatTimeTR`, `formatDayTR`, `formatDateTimeTR`,
  `gymDayOfWeek`, `gymDateTimeToInstant` — seans saatleri salon saat
  diliminde girilip okunuyor.
- Seed yeni modele göre: 4 ders paketi (8/16/24 ders + sınırsız), test
  üyesine 16 derslik paket, önümüzdeki 2 hafta için 28 açık saat
  (hafta içi sabah/akşam birebir, Salı & Cumartesi kondisyon grubu).
- Public `/uyelikler` sayfası da ders paketi diliyle güncellendi — vitrin ile
  panel aynı modeli anlatsın.

## Sonraki adımlar / açık işler

### Planlar/tartı modüllerinin kalan parçaları

- **Şablon düzenleme arayüzü yok:** antrenman/kondisyon şablonları ve üyelik
  paketleri şu an yalnız seed ile oluşuyor; panelden ekleme-düzenleme ekranı
  gerekiyor.
- **Süresi biten üyeliği kapatan zamanlanmış iş yok:**
  `closeExpiredSubscriptions(organizationId)` hazır, çağıracak bir cron
  (ör. Vercel Cron → korumalı route handler) kurulmalı.
- **Ders programının kalan parçaları:**
  - Seans hatırlatma bildirimi yok (üyeye "yarın 19:00 dersin var").
  - Bekleme listesi yok: dolu bir saate katılım isteği antrenör onayına
    gider, reddedilirse sporcu haberdar olmaz.
  - Antrenör seansı iptal edince sporcuya bildirim gitmiyor (hakkı geri
    dönüyor ama ekrana bakması gerekiyor).
  - Çoklu antrenör yok: slotlar `coachUserId` tutuyor ama panelde antrenör
    filtresi/seçimi yok — tek antrenörlü salon varsayımı.
  - Yoklama alınmayan geçmiş seanslar süresiz kuyrukta kalır; otomatik
    "gelmedi" sayma kuralı yok (bilinçli — karar antrenörün).

### Kong portunun kalan kısmı (veri modeli gerektirenler)

Kong'un 60+ tablosunun BlackBox karşılığı henüz yok. Sıradaki tablolar:

- **Mesajlaşma:** `Message` (thread, okundu) — iki paneldeki mesaj ekranları
  ve `unreadMessages` rozeti buna bağlı.
- **Protokoller:** `Protocol` / `ProtocolWeek` / `MemberProtocol`.
- **Etkinlik:** `Event` / `EventParticipant` (şu an statik
  `src/data/events.ts`; katılım/kayıt yok).
- **Aday:** `Lead` / `LeadFollowUp` + iletişim formunun bağlanması.
  `/personel/basvurular` ve `/personel/adaylar`'ın gerçek kaynağı bu olacak;
  adaylar şimdilik yalnız `Member.status = "lead"` üzerinden listeleniyor.
- **Araç sonuçları:** `ReflexSession` / `FightAnalysisResult`.

Tamamlananlar (bu listede artık yok): `PlanTemplate`/`PlanDay`/`PlanItem`/
`MemberPlan`/`PlanCompletion`, `MembershipPlan`/`MemberSubscription`,
`WeightEntry`/`WeightGoal`.

Kong'un kopyalanmayacak parçaları ve nedenleri: Supabase Auth/RLS (BlackBox
yerel oturum kullanıyor), Stripe (ödeme kararı yok), Telegram/Resend/push
(Kong'un kendi hesapları), AI uçları (@anthropic/openai anahtarları),
PWA/serwist (ayrı karar).

- **RLS yok (Postgres geçişi tamamlandı, güvenlik katmanı yarım):** veritabanı
  artık Supabase Postgres ama yetki hâlâ yalnız uygulama katmanında
  (`src/lib/auth/guards.ts`). Satır bazlı güvenlik politikaları eklenmeli —
  engel: BlackBox Supabase Auth kullanmıyor, kendi imzalı cookie'si var
  (bkz. `SUPABASE-GECIS.md`).
- **Davet e-postası akışı yok:** personel üyeyi doğrudan geçici şifreyle
  oluşturuyor; üye ilk girişte şifre değiştiremiyor (zorunlu şifre
  değiştirme akışı eklenmeli).
- **Tam 5 rollü personel hiyerarşisi yok:** şu an yalnızca `member`/`staff`;
  reception/trainer/manager/owner ayrımı `gym-membership-blueprint`'te
  tanımlı, henüz uygulanmadı.
- **QR giriş ve ders rezervasyonu hâlâ yok** — bunlar
  `gym-membership-blueprint/07-uygulama-yol-haritasi.md` Faz 4-7'nin
  konusu; iş kararları (`09-baslangic-kararlari.md`) netleşmeden
  uygulanmamalı. (Üyelik/plan tarafı Faz 6-7'de kapandı; kalan yalnız
  ödeme tahsilatı.)
- **Araç sonuçlarının üyeye kaydedilmesi:** şu an sesli refleks ve dövüş
  analitiği sonuçları hiçbir yere kaydedilmiyor (sayfa yenilenince
  kaybolur). İleride: giriş yapmış üye için sonucu `TrainingLog`'a
  otomatik eklemek (gamification puanı da tetikler).
- **Dövüş analitiği basitleştirilmiş bir motordur:** Kong'un çok
  bileşenli Python analyzer'larının (guard/shoulder/footwork/head/
  conditioning ayrı modüller) birebir karşılığı değil — tek bir basit
  guard/ayak-işi/kafa-hareketi/duruş hesaplaması. Arayüzde bu açıkça
  belirtiliyor.
- **Test verisi (silinebilir):** `personel@blackbox.test` /
  `uye@blackbox.test`, şifre `test1234` — sentetik, gerçek Kong Academy
  danışanı değil. `npm run db:seed` ile yeniden kurulur; seed varolan
  kayıtların üstüne yazmaz (her bölüm önce "zaten var mı" diye bakar).

## Bu sürümde bilinen sınırlar

- İletişim formu gönderim yapmıyor (yalnızca yerel onay mesajı gösteriyor);
  `Lead` tablosu gelince `/personel/basvurular` kuyruğuna bağlanacak.
- `/iletisim` sayfasındaki harita bir yer tutucudur.
- Fiyatlar ve program içerikleri örnek/mock veridir, gerçek değerler
  değildir.
- Program günü tamamlama, elle antrenman loglamayla **aynı** puanı verir
  (`training_logged`, 5 puan). Programa uymanın ayrı bir ödülü yok — bu
  bir ürün kararı, kural değişirse `src/domain/gamification/points.ts`.
- Program günü tamamlandığında üretilen antrenman kaydının süresi/şiddeti
  plandan **tahmin edilir** (`src/domain/plans/workload.ts`), sporcunun
  gerçekte ne yaptığı sorulmaz. Süre yazılmayan gün 45 dk sayılır.
