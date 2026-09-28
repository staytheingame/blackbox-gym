-- Kadro kayıt bağlantısına rol: antrenör (varsayılan) ya da yönetici.
--
-- Mevcut satırlar 'coach' kalır — yani daha önce üretilmiş bağlantılar
-- antrenör bağlantısı olarak çalışmaya devam eder. IF NOT EXISTS: aynı SQL
-- Supabase SQL düzenleyicisinden elle çalıştırılmış olsa bile `migrate deploy`
-- hata vermez.
ALTER TABLE "StaffJoinLink" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'coach';
