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

## Sonraki adımlar / açık işler

- **SQLite → Postgres/Supabase geçişi:** kullanıcı hazır olduğunda ya
  Supabase hesabında yer açılır (bir proje duraklatılır/silinir ya da plan
  yükseltilir) ya da başka bir hesap kullanılır. Şema zaten Postgres'e
  taşınabilir şekilde tasarlandı (bkz. `gym-membership-blueprint/05-veri-modeli.md`).
  Geçişte: uygulama-katmanı yetki kontrolleri RLS politikalarıyla
  ikiye katlanmalı (defense in depth), Supabase Auth'a geçilmeli.
- **Davet e-postası akışı yok:** personel üyeyi doğrudan geçici şifreyle
  oluşturuyor; üye ilk girişte şifre değiştiremiyor (zorunlu şifre
  değiştirme akışı eklenmeli).
- **Tam 5 rollü personel hiyerarşisi yok:** şu an yalnızca `member`/`staff`;
  reception/trainer/manager/owner ayrımı `gym-membership-blueprint`'te
  tanımlı, henüz uygulanmadı.
- **Üyelik/plan/ödeme/QR giriş/ders rezervasyonu hâlâ yok** — bunlar
  `gym-membership-blueprint/07-uygulama-yol-haritasi.md` Faz 4-7'nin
  konusu; iş kararları (`09-baslangic-kararlari.md`) netleşmeden
  uygulanmamalı.
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
  danışanı değil. `prisma/dev.db`'yi silip `prisma migrate dev` + seed'i
  tekrar çalıştırarak sıfırlanabilir.

## Bu sürümde bilinen sınırlar

- İletişim formu gönderim yapmıyor (yalnızca yerel onay mesajı gösteriyor).
- `/iletisim` sayfasındaki harita bir yer tutucudur.
- Fiyatlar ve program içerikleri örnek/mock veridir, gerçek değerler
  değildir.
- Check-in haftası hesaplaması UTC Pazartesi'ye göre; zaman dilimi
  (`Europe/Istanbul`) inceliği henüz yok.
