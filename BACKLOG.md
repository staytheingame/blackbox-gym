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
| Planlar (library) | `/personel/planlar?tur=antrenman\|kondisyon`, `/personel/planlar/<id>`, `/personel/tarti` | şablon oluşturma/düzenleme + atama + tartı çalışıyor |
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

## Yapıldı (Faz 14 — takvimden toplu saat açma, tek kayıt linki, reklam eşleşmesi)

**Sorun:** üç iş de "tek tek" yapılıyordu. Antrenör saatleri birer birer
açıyordu (yirmi saatlik hafta = yirmi tur), sporcu eklemek için her kişiye ayrı
davet bağlantısı üretilip elden gönderiliyordu, aynı programı on sporcuya
vermek on tur sürüyordu. Dar ekranda ise takvim büsbütün gizleniyordu.

### Takvim: dokun, biriktir, bir kere aç
- `src/components/panel/WeekBoard.tsx` — `WeekCalendar`ın yerini aldı.
  Boş hücreye dokununca seçim birikiyor, "Saatleri Aç" hepsini tek işlemde
  açıyor. Gün başlığı o günün tüm boş saatlerini, saat etiketi o saati tüm
  günlerde seçiyor ("her akşam 19:00" iki dokunuş).
- Saf kısmı `src/components/panel/calendar-grid.ts`te (tipler, gün/saat
  pencereleri) — gün anahtarları salon saat diliminde SUNUCUDA üretiliyor.
- **Mobilde gerçek takvim:** 7 sütun 375px'e sığmadığı için dar ekranda tek
  gün sütunu + üstte gün şeridi var. Seçim iki düzende ortak. Sporcu
  tarafında boş bir günde on üç boş satır yerine tek satırlık açıklama çıkıyor.
- `createSlots` artık saat LİSTESİ alıyor (`starts: Date[]`), çakışanları
  atlayıp `{ created, skipped }` döndürüyor — bir saat çakıştı diye ötekiler
  düşmüyor. `startMinute` alanıyla seçilen tüm saatler :00/:15/:30/:45
  başlayabiliyor.
- Hücre içi "Kaldır" düğmesi `formAction` ile yazıldı: ızgara bir formun
  içinde ve HTML iç içe form kabul etmiyor.

### Tek kayıt linki — sporcu kendi kaydolur
- Yeni model `MemberJoinLink` + genel sayfa `/katil/<slug>`: bağlantı çoğa
  açık, Instagram biyografisine/QR koda konur. Gelen kişi bilgilerini yazar,
  şifresini kendi kurar, hesabı anında açılır ve oturumu başlar.
- Kişiye özel davet (`MemberInvite`) duruyor — tanıdık birini elle eklemenin
  hâlâ en hızlı yolu.
- Yönetim ekranı `/yonetim/kayit-linki`: bağlantı üret/kapat, gelenler kime
  atansın, kayıt durumu (aday/üye), kontenjan, son gün. Her kanal ayrı link
  → "hangi link kaç üye getirdi" ölçülüyor (`Member.joinLinkId`).
- Antrenör de paylaşabilsin diye açık bağlantılar `/personel/davetler`
  ekranında kopyalanabilir olarak duruyor (üretmek/kapatmak yönetici işi).
- Kayıt bu yoldan gelenler varsayılan olarak **aday**: ders hakkı ve üyelik
  personel eliyle başlar, sahte kayıt panelin içini karıştırmaz.

### Kişisel bilgiler ve reklam eşleşmesi
- `Member`a ad/soyad (ayrık), doğum tarihi, cinsiyet, ilçe/şehir/il/ülke/posta
  kodu, acil durum kişisi, sağlık notu, KVKK ve iletişim izni alanları eklendi
  (migration `20260918090000_kayit_linki_ve_kisisel_bilgiler`).
- Sporcu kendi bilgilerini `/uye/profil`den günceller; eksik alanlar orada
  listelenir. Antrenör aynı bilgileri sporcu kartında görür (sağlık notu
  vurgulu). Yazma yolu tek: `src/lib/queries/member-profile.ts`.
- `src/domain/marketing/meta-matching.ts` — üye verisini Meta'nın müşteri
  listesi biçimine çevirir (email, phone, fn, ln, ct, st, country, zip, dob,
  ge). Telefon ülke koduyla normalleşir, ülke ISO-2'ye düşer.
- `/api/export/reklam-eslesme` bu listeyi **virgül ayraçlı, BOM'suz** CSV
  verir (Meta böyle bekliyor; Türkçe Excel dosyaları noktalı virgüllü kalır).
  Hash uygulanmaz — Meta dosyayı tarayıcıda kendi SHA-256'lar ve
  normalleştirmeyi de kendi yapar, bizim hash'imiz eşleşmeyi sessizce düşürür.
- E-postası ve telefonu olmayan satır dosyaya girmez; eşleşmeye yetmez.

### Program ve beslenme ataması
- `/personel/planlar` → "Toplu Ata": bir şablon, işaretlenen sporcuların
  hepsine. Kapsam her sporcu için ayrı doğrulanır. Kişiye özel atama sporcu
  kartından yapılmaya devam eder.
- `/personel/beslenme/<id>` → "Başka Sporcuya Kopyala": plan öğünleri ve
  besinleriyle kopyalanır, kopya **taslak** doğar (yanlış kalori yayına
  düşmesin). Öğün işaretleri kopyalanmaz.

## Yapıldı (Faz 15 — kayıt linki elle iş çıkarmasın, yanan ders)

**Sorun:** kayıt linki vardı ama iki yerde hâlâ elle iş çıkarıyordu: bağlantıyı
önce yöneticinin üretmesi gerekiyordu, gelenler varsayılan "aday" düştüğü için
tek tek üyeye çevrilmeleri bekleniyordu. Gelmeyen dersin hakkı zaten
yanıyordu ama sporcuya "Gelmedi" diye görünüyordu; yanan ders ayrı sayılmıyordu.

### Kayıt linki
- Yeni bağlantı formunda varsayılan **doğrudan üye** (eskiden aday). Var olan
  bağlantıların durumuna dokunulmadı; satırdaki seçimle değiştirilir.
- `/yonetim/kayit-linki` açıldığında salonun hiç bağlantısı yoksa
  `ensureDefaultJoinLink` "Genel kayıt bağlantısı"nı kendiliğinden üretir.
- Şema değişmedi → canlı DB'ye migration gerekmiyor.
- Kayıt olanın ders hakkı yine paket tanımlanınca açılır; paketi olmayan ders
  rezerve edemez (`uyelik-yok`). Otomatik paket ataması için `MemberJoinLink`'e
  paket alanı gerekir — migration ister, bilinçli olarak yapılmadı.

### Yanan ders
- `gelmedi` durumunun görünen adı **"Yanan ders"** (`BOOKING_STATUS_LABEL`).
  Hak yakma kuralı değişmedi: yoklamada "Gelmedi" işaretlenince hak gider.
- `summarizeCredits` artık `burned` döndürür (`used`un içinde sayılır).
- Sporcu: `/uye/derslerim` "Yanan Ders" kartı, `/uye/uyelik` "Yanan Ders" kartı
  ve açıklama, `/uye/program` kalan-ders ipucu.
- Personel: üyelik listesinde "(N yanan)", yoklama ve bugün ekranlarında
  "Yanan ders" etiketi. Yoklama düğmesi "Gelmedi" olarak kaldı.
- Saati geçmiş ama yoklaması alınmamış rezervasyon artık "Rezerve" değil
  "Yoklama bekliyor" görünür (`bookingDisplayLabel`).
- Otomatik yakma yok: yoklama alınmayan ders kendiliğinden yanmaz, antrenör
  işaretleyene kadar rezerve sayılmaya devam eder.

## Yapıldı (Faz 16 — kayıt formu yanıtları, antrenör bağlantısı, QR, paket fiyatı)

**Sorun:** kayıt linki sporcuyu kaydediyordu ama antrenörün ilk görüşmede
ihtiyaç duyduğu bilgiyi (meslek, günün yoğunluğu, hangi saatlerde gelebileceği)
ve sporcunun kimin öğrencisi olmak istediğini sormuyordu. Antrenör hesapları
tek tek e-postayla davet edildiği için kadro kurulmadan "koçunuz kim" listesi
boştu. Paket fiyatını yalnız yönetici düzeltebiliyordu.

### Kayıt formu
- `/katil/<slug>`: **meslek**, **günlük yoğunluk** (sakin/orta/yoğun/çok yoğun),
  **tercih edilen antrenman saatleri** (çoklu) ve **koçunuz kim** eklendi;
  hepsi zorunlu, koç "fark etmez" olabilir. Yaş, doğum tarihinden hesaplanır
  (mevcut alan). Seçenek anahtarları `src/domain/registration/answers.ts`te.
- Seçilen antrenör linkin varsayılan antrenöründen önce gelir. Formdan gelen
  kimlik güvenilmez: salonun aktif kadrosunda olmalı, değilse yok sayılır.
- Yanıtlar yeni `MemberRegistrationAnswer` tablosunda; sporcu kartında
  "Kayıt Yanıtları" bölümü. `Member`a sütun EKLENMEDİ.
- **Migration bekliyorsa** kayıt bozulmaz: yanıtlar transaction dışında yazılır,
  yazılamazsa denetim kaydına özet olarak düşer; sporcu kartı bölümü gizler.

### Antrenör kayıt bağlantısı
- Yeni `StaffJoinLink` + `/kadro-kayit/<token>`: antrenörler adını, e-postasını
  ve şifresini kendisi yazıp hesap açar (soyadı bilinmeyen antrenör kendisi yazar).
- Yetki kapısı olduğu için sıkı: adres 43 karakterlik anahtar, veritabanında
  yalnız SHA-256 özeti (adres yalnız üretildiği anda görünür), son gün (≤30 gün)
  ve kullanım sınırı (≤50) zorunlu, yeni bağlantı öncekini kapatır, **rol her
  zaman antrenör** — yönetici yapmak `/yonetim/kadro`dan rol değiştirmekle olur.
- Kontenjan yarışı: sayaç okunan değere koşullu güncellenir, kaybeden istek
  geri alınır.
- `/yonetim/kayit-linki` üstte antrenör bağlantısı kartı + üretince "gönderilecek
  liste" (antrenör + sporcu adresleri tek mesaj).

### QR kod
- `qrcode` paketi. Her açık sporcu bağlantısının altında ekranda QR ve
  `/yonetim/kayit-linki/qr/<id>` ile baskıya hazır 1024 px PNG (yalnız yönetici,
  yalnız kendi salonu). Beyaz zemin sabit; okunuşu doğrulandı.
- `package-lock.json` yalnız yeni paketleri ekler; npm sürüm farkının silmeye
  çalıştığı `libc` alanlarına dokunulmadı.

### Paket fiyatı
- `/personel/paketler`: antrenör yalnız **fiyatı** düzeltir (ad, süre, ders
  adedi, ekleme, arşivleme yönetici işi kalır). Yalnız bundan sonra başlayan
  üyelikleri etkiler; her değişiklik eski → yeni tutarla denetim kaydına düşer.

### Bilinçli olarak yapılmadı / açık
- Yönetici listesindeki herkes "koçunuz kim" listesinde çıkar (yönetici ile
  antrenörü ayıran bir alan yok). Ders vermeyen bir yönetici hesabı varsa
  sporcu onu seçebilir; sporcu kartından devredilir.
- Kayıt olana otomatik paket atanmıyor: `MemberJoinLink`'e paket alanı gerekir
  (mevcut tabloya sütun = migration şart). Paketi olmayan sporcu ders rezerve edemez.

## Yapıldı (Faz 17 — üye ekleme tek link, uygulama olarak kurulum)

**Sorun:** "Yeni Üye Ekle" hâlâ ad/soyad/e-posta yazdırıyordu — kayıt linki
varken elle iş. Panel ayrıca telefona/bilgisayara uygulama gibi kurulamıyordu
(`BACKLOG`ta "PWA — ayrı karar" olarak duruyordu).

### Üye ekleme
- `/personel/uyeler` → "Yeni Üye Ekle" kartı artık salonun kayıt bağlantısını
  (kopyala, WhatsApp, QR) gösterir; ad/soyad/e-posta yazılmaz. Bağlantı yoksa
  kendiliğinden üretilir (`NewMemberLinkCard`). Eski elle ekleme formu
  "bağlantıyı kullanamayan biri için" başlığı altında kapalı durur.
- QR PNG indirme artık antrenöre de açık (`requireStaff`); salon girişine asmak
  yalnız yöneticinin işi olmamalı.

### Uygulama olarak kurulum (PWA)
- `app/manifest.ts` — `standalone`, marka renkleri, 192/512 + maskable ikon
  (`public/icons/`, siyah zemin + sarı "BB"), `start_url = /uygulama`.
- `/uygulama` giriş kapısı: oturum açıksa rolünün paneline, değilse `/giris`
  (uygulama her açılışta giriş formu göstermesin).
- `public/sw.js` — **bilerek yalnız çevrimdışı ekran**: sayfa/veri ÖNBELLEKLENMEZ
  (panelde sağlık notu, telefon, ödeme var; ortak cihazda çıkıştan sonra eski
  sayfa açılırsa veri sızar). Ağ yoksa `public/cevrimdisi.html` (tek dosya, dış
  bağımlılıksız). Yalnız üretimde kaydedilir; `sw.js` önbelleksiz sunulur
  (`next.config.ts`).
- "Uygulamayı Yükle": Chrome/Edge/Android için sistem penceresi, iPhone için
  Paylaş → Ana Ekrana Ekle adımları (`InstallAppCard`; yan menü + giriş ekranı).
  `beforeinstallprompt` kök düzende yakalanır, sonradan açılan düğme kaçırmaz.
- `manifest.test.ts`: ikon dosyaları var mı, bildirilen boyutta mı, service
  worker yalnız çevrimdışı ekranı mı saklıyor.

### Açık
- Kurulum penceresi/ikon/çevrimdışı gerçek cihazda denenmedi (sandbox'ta tarayıcı
  yok); doğrulanan: manifest, `sw.js` başlıkları, ikon boyutları, `/uygulama`
  yönlendirmesi, gerçek `next build` + `next start`.
- Push bildirimi yok (bildirimler panel içi + e-posta/WhatsApp kanalı).
- Çevrimdışı çalışma yok: uygulama internet ister.

## Yapıldı (Faz 12 — koç kapsamı, tahsilat ve salon muhasebesi)

Kullanıcı isteği: **"koç ekleme-üye ekleme, her koçun kendi üyesini görmesi
diğer üyeleri görmemesi, o üyelerin verdiği dersler, bunun mali tablosu, salon
maliyesi/muhasebesi, günlük-haftalık-aylık, koçların ders hakları."**

Bu, Faz 8'deki **"ödemeleri kaldır"** kararını (bkz. aşağıdaki Faz 8 bölümü)
kullanıcı kararıyla geri alır. Paket etiket fiyatı zaten duruyordu; üzerine
tahsilat, gider ve hakediş katmanı eklendi.

### Kullanıcının verdiği kararlar (bu oturumda soruldu)

| Soru | Karar |
| --- | --- |
| Hakediş modeli | **Hepsi seçilebilir**: ders başı / gelir payı / sabit maaş / karma |
| Antrenör ne kadar para görsün | **Kendi hakedişi + kendi üyelerinin ödemeleri**; salon geneli yalnız yöneticide |
| "Koçun kendi üyesi" nasıl belirlenir | **Atanmış koç alanı**; ekleyen otomatik atanır, yönetici devreder |

### Görünürlük kapsamı (en kritik parça)

`src/lib/auth/scope.ts` — `StaffScope` tek doğru kaynak:

- `memberWhere(scope)` → sporcu listeleyen HER sorgu bunu alır.
- `slotWhere(scope)` → ders saatleri ayrı eksen: antrenör **kendi açtığı**
  seansı, yoklamasını ve katılım isteklerini görür.
- `requireMemberInScope(scope, memberId)` — eski `requireStaffScopeForMember`
  yalnız salon kontrolü yapıyordu, antrenör başkasının sporcusuna
  yazabiliyordu; yerini aldı.

Kapsam uygulanan yerler: personel genel bakış, sporcular, sporcu detayı
(+ analiz), adaylar, davetler, check-inler, içgörüler, kuşaklar, tartı,
onaylar, beslenme, üyelikler, ders programı/istekler/yoklama, menü rozetleri,
CSV dışa aktarma. Yönetici ekranları `organizationScope()` ile salonun
tamamını görür; sporcu ders programı bilerek salon genelidir (herkes tüm açık
saatleri görüp seçebilsin).

### Şema (migration `20260820100000_maliye_ve_koc_kapsami`)

- `Member.assignedCoachUserId` — sorumlu antrenör.
- `MemberSubscription.priceMinor` / `currency` — anlaşılan tutar (indirim
  yapılabilir); borç = tutar − tahsilat.
- `Payment` — tahsilat; üyeliğe bağlı ya da serbest.
- `Expense` + `RecurringExpense` — gider ve aylık sabit kalemler.
- `CoachCompensation` — hakediş ayarı (ders başı / bps oranı / maaş / aylık
  ders hakkı).
- `CoachEarning` — doğduğu anda **dondurulmuş** hakediş satırı;
  `@@unique([organizationId, sourceType, sourceKey])` mükerrer kaydı engeller
  (ders → slot.id, gelir payı → payment.id, maaş → "userId:yyyy-mm").
- `CoachPayout` — ödeme; kapsadığı hakedişleri `odendi` yapar ve bir `Expense`
  satırı doğurur.

### Ekranlar

| Rol | Ekran | Ne yapar |
| --- | --- | --- |
| Personel | `/personel/kasa` | Kendi hakedişi, verdiği ders + kalan ders hakkı, kendi sporcularının borcu, tahsilat girişi |
| Personel | `/personel/uyelikler` | Üyelik başlatırken anlaşılan tutar + peşin tahsilat; satırda ödeme durumu |
| Personel | `/personel/uyeler/[id]` | Ödeme durumu kartı: borç çubuğu + tahsilat geçmişi |
| Yönetici | `/yonetim/muhasebe` | Gelir/gider/net, kâr marjı, 6 dönemlik trend, gider kırılımı, antrenör dökümü |
| Yönetici | `/yonetim/muhasebe/tahsilat` | Tahsilat girişi, borçlular, dönem kayıtları |
| Yönetici | `/yonetim/muhasebe/giderler` | Sabit giderler + "bu ayı işle", tek seferlik gider, dönem kayıtları |
| Yönetici | `/yonetim/muhasebe/hakedis` | Antrenör başına ders/hakediş/ders hakkı, maaş tahakkuku, ödeme |
| Yönetici | `/yonetim/kadro` | Her antrenör satırında hakediş ayarı formu |
| Yönetici | `/yonetim/uyeler` | Sporcu satırında antrenör devri + antrenör başına sporcu sayısı |

### Kurallar (domain, 53 test)

- Para **kuruş**; TR biçim/parse (`1.250,50` ve `1250.50` ikisi de okunur).
- Ders başı hakediş **seans başına** doğar, katılan kişi başına değil.
- "Gelmedi" de hakediş doğurur (salon o saati tuttu); seans iptali ödenmemiş
  hakedişi geri alır.
- Dönem sınırları salon saat diliminde ve **yarı açık** (`start <= t < end`).
- Kasa antrenör hakedişini **ödendiği gün** gider yazar, tahakkuk gününde değil.

## Yapıldı (Faz 10 — kuşak, onam, bekleme listesi, denetim, KVKK)

Kaynak: altı açık kaynak salon/dojo yazılımının özellik setinin taranması
(laragym, obikai, VoxelBooking, GYM-One, TajwarSaiyeed/gym-management-system,
FO1ZZY/fitness-trainer-crm) ve BlackBox'ta karşılığı olmayanların seçilmesi.

### Yeni tablolar (6) + 1 alan

`Rank`, `RankRequirement`, `RequirementCheck`, `MemberRank`,
`WaiverTemplate`, `MemberWaiver`, `AuditLog`; `Member.anonymizedAt`.
Migration: `20260819200000_kusak_onam_denetim` — **canlı veritabanına
uygulanmadı**, kullanıcı onayı bekliyor.

### Kuşak & müfredat (obikai rank engine karşılığı)

- Merdiven salona özel: `order` sıralı, renkli, ders/hafta eşikli.
- Kuşak başına müfredat maddeleri (`teknik | kondisyon | katilim | sinav`),
  istenirse `src/data/techniques.ts` teknik slug'ına bağlanır.
- `src/domain/rank/progress.ts` (14 test) üç kapıyı **ayrı** okur:
  müfredat / ders sayısı / süre. Yüzde bunların ortalamasıdır; eşiği sıfır
  olan ölçüt yüzdeye karışmaz.
- Terfi append-only (`MemberRank`), yanlış verilen terfi geri alınabilir.
  Koşullar tamamlanmadan da terfi verilebilir — ekran uyarır, engellemez.
- Ekranlar: `/personel/kusaklar` (merdiven + salon tablosu + kuşak/madde
  ekleme), `/personel/kusaklar/<memberId>` (madde işaretleme + terfi),
  `/uye/kusak` (kendi ilerlemesi + merdiven), sporcu detayında kuşak kartı,
  üye ana sayfasında ilerleme şeridi.

### Onam & sağlık beyanı (obikai waivers)

- `WaiverTemplate` (sürümlü metin + evet/hayır soruları + veli zorunluluğu)
  → `MemberWaiver` (imza, sürüm, veli bilgisi, sağlık yanıtları).
- `src/domain/waivers/status.ts` (14 test): imzalı / eksik / **eski sürüm**
  ayrımı, 18 yaş altı veli kontrolü, "evet" yanıtlarından sağlık notu.
- Sürüm artırmak imzayı silmez; sporcudan yeniden onay ister.
- Sağlık uyarısı antrenörün iki ekranında görünür: `/personel/onaylar` ve
  sporcu detayı.
- **Bilinçli sınır:** onam eksikliği rezervasyonu engellemez. Kapıya
  çevirmek istenirse tek yer `src/lib/queries/slots.ts` içindeki
  `bookSlot`.

### Bekleme listesi (VoxelBooking waitlist)

- Açık işti: "dolu saate istek gönderen sporcu, yer boşalınca haberdar
  olmuyor". Artık `cancelBooking` yer açtığında kuyruğun başındaki sporcu
  otomatik `onayli` olur ve `ders-siradan-yukseldi` bildirimi gider.
- `src/domain/booking/waitlist.ts` (11 test): sıra ilk gelen ilk alır;
  promosyon kontenjanı **büyütmez** (grup dersine çevirme kararı hâlâ
  antrenörün), geçmiş/iptal seansta kimse yükselmez.
- Sporcu `/uye/derslerim`'de kuyruktaki sırasını görür.

### Denetim kaydı (laragym audit trail + VoxelBooking audit log)

- `AuditLog`: kim (`actorLabel` çağrı anında kopyalanır), ne zaman, hangi
  işlem, hangi kayıt, özet. Yalnız yazan işlemler; okuma kaydı yok.
- Bağlandığı işlemler: sporcu ekleme, davet yenileme, üyelik başlatma ve
  durum değişimi, seans açma/iptal, yoklama, katılım isteği onay/ret,
  terfi ve geri alma, kuşak/müfredat tanımı, onam metni ve imzası, veri
  dışa aktarma, anonimleştirme.
- Kayıt yazılamazsa asıl işlem düşmez (denetim ikinci derecedir).
- Ekran: `/yonetim/kayitlar` — işleme göre süzme + CSV.

### Veri & KVKK (GYM-One raporları, FitCRM CSV, VoxelBooking/obikai GDPR)

- `src/lib/export/csv.ts` (9 test): noktalı virgül ayracı, BOM ve Excel
  formül enjeksiyonu koruması (`=`, `+`, `-`, `@` ile başlayan hücre
  tırnaklanır).
- Altı set: sporcular, yoklama, üyelikler, kuşaklar, onaylar, denetim —
  `/api/export/<tür>`, personel yetkisiyle korunur, her indirme denetime
  düşer.
- `/api/kvkk/<memberId>`: sporcunun tüm kayıtları tek JSON. Sporcunun
  kendisi ya da salon personeli çağırabilir; personel çağrısı denetime
  düşer, sporcunun kendi verisini indirmesi düşmez.
- Anonimleştirme (`/yonetim/kvkk`, yalnız yönetici): hesap silinir,
  ad/e-posta/telefon, davetler, bildirimler, onam imzasındaki kimlik
  bilgileri ve serbest metin notları temizlenir; ders/antrenman/tartı
  sayıları kimliksiz kalır. Onay için sporcunun üye numarası elle
  yazılır — **geri alınamaz**.

### Yan işler

- İki yeni bölüm bayrağı: `kusaklar`, `onaylar` (varsayılan açık).
- Üç yeni menü rozeti: `rankReady`, `pendingWaivers` (personel),
  `waiverDue` (üye).
- Yeni bildirim türü: `ders-siradan-yukseldi`.
- Yeni ikonlar: `BeltIcon`, `SignatureIcon`.
- `techniqueBySlug` yardımcı fonksiyonu (`src/data/techniques.ts`).
- Seed: 5 kuşaklı merdiven + müfredat, 4 onam metni, test üyesine beyaz
  kuşak ve 2 işaretli madde.

### Bilinçli olarak ALINMAYANLAR

| Özellik | Kaynak | Neden |
| --- | --- | --- |
| Ödeme/tahsilat, fatura, Stripe | laragym, GYM-One, gym-management-system | Faz 8'de kullanıcı kararıyla kaldırılmıştı; para salonun kendi yöntemiyle alınıyor |
| Hane/aile hesabı (household) | obikai | Tek sporcu modeli yeterli; veli bilgisi onam formunda toplanıyor |
| Çok kiracılı SaaS, EU VAT | obikai | BlackBox tek salon |
| Konaklama/etkinlik rezervasyon desenleri (resource/capacity/event) | VoxelBooking | Salonun modeli timeslot; diğer üçü karşılıksız |
| Aylık takvim görünümü, toplu randevu ekleme | fitness-trainer-crm | Haftalık tablo + `repeatWeeks` aynı işi görüyor |

## Sonraki adımlar / açık işler

### Planlar/tartı modüllerinin kalan parçaları

- ~~**Şablon düzenleme arayüzü yok**~~ — antrenman/kondisyon şablonları
  artık panelden kuruluyor: `/personel/planlar` künye formu,
  `/personel/planlar/<id>` hafta/gün/hareket düzenleyicisi, hafta kopyalama
  ve yayından kaldırma (Faz 13). Üyelik paketleri zaten
  `/yonetim/paketler`ten yönetiliyordu.
- **Süresi biten üyeliği kapatan zamanlanmış iş yok:**
  `closeExpiredSubscriptions(organizationId)` hazır, çağıracak bir cron
  (ör. Vercel Cron → korumalı route handler) kurulmalı.
- **Ders programının kalan parçaları:**
  - Seans hatırlatma bildirimi yok (üyeye "yarın 19:00 dersin var").
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
- **Davet e-postası akışı yok (bağlantı elle iletiliyor):** hem sporcu hem
  personel hesabı artık davet bağlantısıyla açılıyor ve şifreyi kişi kendisi
  kuruyor — geçici şifre kalmadı. Eksik olan yalnız **otomatik e-posta**:
  bağlantıyı panel gösteriyor, ekleyen kişi WhatsApp/e-posta ile elle
  gönderiyor. Ayrıca kurulmuş bir hesap için "şifremi unuttum" akışı yok.
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
