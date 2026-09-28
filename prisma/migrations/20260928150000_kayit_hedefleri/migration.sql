-- Kayıt formuna "hedefin" sorusu: boks, güreş, fitness, kilo verme, kilo alma …
-- Bir ya da birden fazla seçilir, bu yüzden dizi sütunu.
--
-- Yalnız kendi tablomuza sütun ekler (Member'a dokunmaz). IF NOT EXISTS: aynı SQL
-- Supabase SQL düzenleyicisinden elle çalıştırılmış olsa bile `migrate deploy`
-- hata vermez.
ALTER TABLE "MemberRegistrationAnswer" ADD COLUMN IF NOT EXISTS "goals" TEXT[] DEFAULT ARRAY[]::TEXT[];
