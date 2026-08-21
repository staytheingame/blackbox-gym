# Backlog

## Yapıldı (Faz 1)

- İzole proje iskeleti (Next.js + TS strict + Tailwind v4).
- BlackBox marka teması (siyah/sarı/beyaz) ve app shell (Header/Footer).
- Public sayfalar: `/`, `/uyelikler`, `/antrenman-planlari`, `/ekipman`,
  `/dersler`, `/antrenorler`, `/iletisim` (statik/mock veri).

## Sonraki fazlar (gym-membership-blueprint referansı)

Bunlar henüz uygulanmadı; iş kararları netleşmeden (bkz.
`../gym-membership-blueprint/09-baslangic-kararlari.md`) üretime hazır
sayılmamalı:

- **Faz 0 — İş kararları:** plan fiyatları, dondurma kuralları, ödeme
  sağlayıcısı, QR donanımı, KVKK metni sorumlusu.
- **Faz 2 — Supabase/Auth/RLS:** organizations, branches, profiles,
  organization_users, members; rol bazlı erişim.
- **Faz 3 — Üye/personel yönetimi:** CRUD, davet/aktivasyon, audit log.
- **Faz 4 — Plan/üyelik/dondurma:** tarihçeli üyelik modeli,
  `evaluateMembershipAccess()`.
- **Faz 5 — Sipariş/ödeme:** orders/payments/webhook idempotency.
- **Faz 6 — QR giriş:** kısa ömürlü QR, resepsiyon tarama.
- **Faz 7 — Ders rezervasyonu:** kapasite, waitlist, yoklama.
- **Faz 8 — Üye portalı ve bildirimler.**
- **Faz 9 — Raporlar, hardening, preview.**
- **Faz 10 — Production açılışı.**

## Bu sürümde bilinen sınırlar

- İletişim formu gönderim yapmıyor (yalnızca yerel onay mesajı gösteriyor).
- `/iletisim` sayfasındaki harita bir yer tutucudur.
- Fiyatlar ve program içerikleri örnek/mock veridir, gerçek değerler
  değildir.
