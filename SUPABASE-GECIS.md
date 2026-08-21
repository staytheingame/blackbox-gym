# Supabase geçişi — durum

**Geçiş tamamlandı.** Veritabanı artık Supabase Postgres; yerel SQLite
(`prisma/dev.db`) kullanılmıyor. `prisma/schema.prisma` `postgresql`
sağlayıcısıyla çalışıyor, migration geçmişi tek `init` migration'ı olarak
yeniden kuruldu (SQLite lehçesindeki eski migration'lar atıldı).

Doğrulama:

```bash
npx prisma migrate status
```

> `Database schema is up to date!` görmelisin.

## Bağlantı ayarları

`.env.local` (şablon için `.env.example`):

- `DATABASE_URL` — uygulama sorguları, pooler bağlantısı.
- `DIRECT_URL` — migration'lar; pooler üzerinden çalışmaz, doğrudan
  bağlantı ister.
- `SESSION_SECRET` — oturum çerezini imzalar. Değişirse tüm oturumlar düşer.

Şifreyi sohbete yapıştırma; doğrudan `.env.local`'e yaz.

## Kalan iş — RLS (ikinci savunma katmanı)

Yetki şu an **yalnız uygulama katmanında**: `src/lib/auth/guards.ts`
(`requireUser`, `requireStaff`, `requireMemberSelf`,
`requireStaffScopeForMember`). Postgres'e geçildiğine göre satır bazlı
güvenlik (RLS) politikaları da eklenmeli: üye yalnız kendi kayıtlarını,
personel yalnız kendi organizasyonunun kayıtlarını görebilsin. Uygulama
guard'ları kalır — ikisi birlikte (defense in depth).

Engel: BlackBox oturumu Supabase Auth kullanmıyor (kendi imzalı httpOnly
cookie'si var). RLS'i Supabase Auth olmadan kurmak için ya Auth'a
geçilmeli ya da bağlantı bazlı rol + `SET LOCAL` yaklaşımı seçilmeli. Bu
karar verilmedi — bkz. [`BACKLOG.md`](./BACKLOG.md).

## Şema değişikliği yaparken

```bash
npx prisma migrate dev --name <degisiklik-adi>   # canlı DB'ye yazar
npm run typecheck && npm run test && npm run build
```

Migration doğrudan Supabase projesine uygulanır — ayrı bir geliştirme
veritabanı yok. Geri alınması zor bir değişiklikten önce Supabase
panelinden yedek al.
