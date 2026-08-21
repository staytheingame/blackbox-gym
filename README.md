# BlackBox — Box & Fight Gym

BlackBox, boks ve fight sporlarına odaklanan bir salonun tanıtım/üyelik
sitesi. Bu proje, `../kong-academy` reposundan tamamen bağımsız,
`../gym-membership-blueprint` altındaki mimari kararlar referans alınarak
sıfırdan kuruldu. Kong Academy'ye hiçbir bağımlılığı yoktur; ayrı `.git`,
ayrı `node_modules`, ayrı bağımlılıklar kullanır.

## Bu sürümün kapsamı

**Faz 1 — izole public site**
- Next.js App Router + TypeScript strict + Tailwind CSS v4.
- Statik/mock veriyle beslenen public tanıtım sitesi.
- Sayfalar: Ana Sayfa, Üyelikler, Antrenman Planları, Ekipman, Dersler,
  Antrenörler, İletişim.
- Marka teması: siyah zemin, beyaz yazı, sarı (boks sarısı) vurgu.

**Faz 2 — üye takip & performans paneli**
- Veritabanı: **Prisma + Supabase Postgres**. (Proje SQLite ile başladı,
  geçiş tamamlandı — bkz. [`SUPABASE-GECIS.md`](./SUPABASE-GECIS.md).)
- Basit yerel oturum: e-posta/şifre (bcrypt) + imzalı httpOnly cookie.
  Public self-signup yok — üyeler `/personel/uyeler`'den personel
  tarafından eklenir.
- **Panel kabuğu:** `/uye/**` ve `/personel/**` tanıtım sitesinin
  Header/Footer'ı içinde değil, kendi kabuğunda açılır (Kong Academy'nin
  `PanelSidebar`/`PanelTabBar` deseni): masaüstünde sabit yan menü,
  mobilde çekmece + alt tab bar. Public sayfalar `app/(site)` route
  group'unda toplandı; kök layout yalnız `<html>/<body>` kurar.
- **Gezinme mimarisi Kong ile birebir:** bölüm → alt sayfa (2 kademe),
  üçüncü kademe yok — alt sekmeler sayfa içinde `?tab=`/`?tur=` ile.
  Personel 8 bölüm, üye 6 bölüm; tek kaynak `src/config/panel-nav.tsx`,
  bölüm şeridi `SectionNav`, bölüm aç/kapa `src/config/feature-flags.ts`.
  Bölüm haritası ve hangi ekranın çalıştığı: [`BACKLOG.md`](./BACKLOG.md).
- Üye paneli (`/uye/**`): özet panosu (skor, puan, lig sırası, check-in
  serisi, son antrenmanlar, rozetler), haftalık check-in formu, antrenman
  logu, performans skor kartı (Kong Academy'nin `scorecard.ts`
  motorundan uyarlanan saf fonksiyon), lig sıralaması, atanan antrenman
  ve kondisyon programları, tartı/sıklet takibi.
- Personel paneli (`/personel/**`): genel bakış (bugünün dersleri, yoklama
  ve check-in kuyrukları), üye listesi ve ekleme (`/personel/uyeler`),
  check-in inceleme (`/personel/check-inler`), üye detayı, antrenman
  loglama, program atama, salon geneli tartı takibi (`/personel/tarti`),
  üyelik & ders hakkı yönetimi (`/personel/uyelikler`).

**Faz 8 — ders programı, rezervasyon ve ders hakkı**
- **Sabit ders takvimi yok:** antrenör boş saatlerini yayımlar
  (`/personel/program`), sporcular ortak tablodan istediğini kapar
  (`/uye/program`). Slot varsayılan olarak birebirdir; dolu bir saate ikinci
  sporcu katılmak isterse istek antrenör onayına düşer
  (`/personel/program/istekler`) ve onaylanınca seans grup dersine döner.
- **Yoklama** (`/personel/program/yoklama`): "geldi" işareti seansın
  süresiyle bir antrenman kaydı yazar — puan, rozet ve gelişim grafiği
  otomatik güncellenir. "Gelmedi" ders hakkını yakar, kayıt üretmez.
- **Üyelik = ders paketi** (ör. 16 ders / 60 gün). Rezervasyon hakkı ayırır,
  yoklama harcar; seanstan önce iptal hakkı geri verir. Uygulamada **ödeme
  takibi yoktur** — yalnız "üyelik ne kadar var, kaç ders kaldı".
- **Gelişim takibi** (`/uye/performans`, sporcu detayı): devamlılık (katılım
  oranı), hacim (son 8 haftanın haftalık dakikası) ve skor geçmişi — üçü
  bilinçli olarak ayrı okunur, tek bir puana ezilmez.
- İş mantığı `src/domain/**` altında saf, Vitest ile test edilen
  fonksiyonlarda (`performance/scorecard.ts`, `gamification/points.ts`,
  `gamification/badges.ts`).
- Auth/veri erişimi yalnız uygulama katmanında korunur
  (`src/lib/auth/guards.ts`) — henüz Postgres RLS yok.

**Faz 3 — browser tabanlı performans araçları**
- `/araclar` — public (giriş gerektirmez), tamamen client-side üç araç.
- `/araclar/kamera-fight-lab`: tek rotada Boxing Lab ve Wrestling Lab. Ortak webcam + MediaPipe Pose çekirdeği; Boxing reaction/decision/motion/defense protokolleri ile Wrestling W0–W15, Weekly Benchmark ve custom Coach Test'i sunar. Wrestling geçmişi sürüm/hash uyumlu türetilmiş sayısal seanslar olarak yalnız IndexedDB'de tutulur; kamera görüntüsü yüklenmez veya kaydedilmez.
- `/araclar/sesli-refleks`: boks hamlesini Web Speech API ile Türkçe
  seslendiren, tepki süresini ölçen combo-caller trainer.
- `/araclar/dovus-analitigi`: yüklenen videoyu `@mediapipe/tasks-vision`
  (PoseLandmarker, WASM) ile **tamamen tarayıcıda** işleyip guard/ayak
  işi/kafa hareketi/duruş metrikleri çıkaran basitleştirilmiş analiz
  motoru — video hiçbir sunucuya gönderilmez. Kong Academy'nin ayrı
  Python/Railway fight-analytics backend'i **kullanılmadı** (kod olarak
  da mevcut değildi/devre dışıydı) — yalnızca Kong'un kendi client-side
  MediaPipe implementasyonu (`FightAnalyticsDashboard.tsx`) referans
  alındı.
- İş mantığı `src/domain/reflex/**` ve `src/domain/fight-analytics/**`
  içinde saf fonksiyonlarda, Vitest ile test edilir.
- Ana sayfada ("Araçlar" bölümü, hero'dan hemen sonra) ve ana nav'da öne
  çıkarılır.

Auth, ödeme, QR giriş, ders rezervasyonu, çok rollü personel hiyerarşisi
**henüz yok** — bkz. [`BACKLOG.md`](./BACKLOG.md).

## Geliştirme

```bash
npm install
cp .env.example .env.local   # Supabase bağlantısı + SESSION_SECRET
npx prisma migrate deploy    # şemayı veritabanına uygular
npm run db:seed              # sentetik test verisi (personel + 1 test üye)
npm run dev
```

`http://localhost:3000` adresinde açılır. Test girişleri:
`personel@blackbox.test` / `uye@blackbox.test`, şifre `test1234`
(sentetik, silinebilir — bkz. `BACKLOG.md`).

```bash
npm run typecheck
npm run lint
npm run build
npm run test        # Vitest — domain katmanı unit testleri
npm run test:e2e    # Playwright — Chrome/Edge kritik UI akışları
```

## Klasör yapısı

```text
prisma/
  schema.prisma      # Postgres şema (identity, members, check-ins, training,
                      # performance, gamification, plans, memberships, weight)
  seed.mjs            # sentetik test verisi
src/
  app/
    layout.tsx         # kök: yalnız <html>/<body> + fontlar
    (site)/            # public tanıtım sitesi (Header/Footer burada)
      page.tsx, uyelikler/, ekipman/, araclar/, ...
    giris/             # panel girişi (tek işe odaklı ekran)
    uye/**             # üye paneli (özet, ders programı & rezervasyon,
                       # üyelik/ders hakkı, antrenman, kondisyon, tartı,
                       # check-in, performans & gelişim, lig)
    personel/**        # personel paneli (genel bakış, sporcular,
                       # ders programı/istekler/yoklama, planlar, tartı,
                       # check-inler, üyelikler)
  components/
    app-shell/         # public site Header, Footer
    panel/             # PanelShell, PanelSidebar, PanelTabBar, PanelTopbar,
                       # PlanWeek (program haftası kartları),
                       # ui.tsx (PanelPage/PanelCard/StatCard/Pill), icons
    ui/                # PageHero, SectionHeading (public site)
  config/
    navigation.ts       # tek kaynak public nav listesi + site bilgisi
    panel-nav.tsx       # panel menüsü — yan menü ve alt tab bar aynı listeden;
                        # feature flag varsayılanları da burada
  data/                 # public site mock içeriği
  domain/               # saf iş mantığı — DB bilmez, Vitest ile kaplı
    booking/             # credits.ts (ders hakkı + rezervasyon kuralları)
    performance/          # scorecard.ts, progress.ts (gelişim özeti)
    gamification/          # points.ts, badges.ts
    plans/                  # workload.ts (program günü -> antrenman kaydı)
    weight/                  # cut.ts (güvenli sıklet düşüşü)
    reflex/                   # sesli refleks: hamle listesi, seçim, özet
    fight-analytics/           # video pose landmark -> metrik hesaplama
  lib/
    auth/                 # session, guards, password, server actions
    queries/               # Prisma + domain'i birleştiren adapter katmanı
    date.ts                 # hafta sınırı — Europe/Istanbul
    db.ts                   # tekil PrismaClient
    tts.ts                  # tarayıcı Web Speech API sarmalayıcı
```

## Kaynak

Mimari ve ürün kararları için: `../gym-membership-blueprint/`.
