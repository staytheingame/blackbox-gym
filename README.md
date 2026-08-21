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
- Yerel veritabanı: **Prisma + SQLite** (`prisma/dev.db`) — Docker yok,
  Supabase hesap limiti doluydu; ileride Postgres/Supabase'e taşınacak
  (bkz. `BACKLOG.md`).
- Basit yerel oturum: e-posta/şifre (bcrypt) + imzalı httpOnly cookie.
  Public self-signup yok — üyeler `/personel`'den personel tarafından
  eklenir.
- Üye paneli (`/uye/**`): özet, haftalık check-in formu, antrenman logu,
  performans skor kartı (Kong Academy'nin `scorecard.ts` motorundan
  uyarlanan saf fonksiyon), lig sıralaması + rozetler.
- Personel paneli (`/personel/**`): üye ekleme, üye detayı, antrenman
  loglama, check-in inceleme.
- İş mantığı `src/domain/**` altında saf, Vitest ile test edilen
  fonksiyonlarda (`performance/scorecard.ts`, `gamification/points.ts`,
  `gamification/badges.ts`).
- Auth/veri erişimi yalnız uygulama katmanında korunur
  (`src/lib/auth/guards.ts`) — henüz Postgres RLS yok.

Auth, ödeme, QR giriş, ders rezervasyonu, çok rollü personel hiyerarşisi
**henüz yok** — bkz. [`BACKLOG.md`](./BACKLOG.md).

## Geliştirme

```bash
npm install
npx prisma migrate dev   # ilk kurulumda: yerel SQLite şemasını oluşturur
node prisma/seed.mjs     # sentetik test verisi (personel + 1 test üye)
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
```

## Klasör yapısı

```text
prisma/
  schema.prisma      # SQLite şema (identity, members, check-ins, training,
                      # performance, gamification)
  seed.mjs            # sentetik test verisi
src/
  app/
    (public sayfalar) # /, /uyelikler, /ekipman, ...
    giris/             # login
    uye/**             # üye paneli (check-in, antrenman, performans, lig)
    personel/**        # personel paneli (üye yönetimi)
  components/
    app-shell/         # Header, Footer
    ui/                # PageHero, SectionHeading
  config/
    navigation.ts       # tek kaynak nav listesi + site bilgisi
  data/                 # public site mock içeriği
  domain/
    performance/         # scorecard.ts (saf fonksiyon) + testler
    gamification/         # points.ts, badges.ts + testler
  lib/
    auth/                 # session, guards, password, server actions
    queries/               # Prisma + domain'i birleştiren adapter katmanı
    db.ts                   # tekil PrismaClient
```

## Kaynak

Mimari ve ürün kararları için: `../gym-membership-blueprint/`.
