-- "Sana Uygun Başlangıcı Bulalım" formu (/baslangic): görüşme talepleri.
--
-- YALNIZ YENİ TABLO: mevcut tablolara sütun eklenmez, hiçbir veri değişmez.
-- Uygulanmadan önce yayına çıkan kod da çalışır (talep denetim kaydına düşer,
-- Başvurular ekranı bu kaynağı atlar). IF NOT EXISTS: aynı SQL Supabase SQL
-- düzenleyicisinden elle çalıştırılmış olsa bile `migrate deploy` hata vermez.

CREATE TABLE IF NOT EXISTS "StartLead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'yeni',
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "noticeAcceptedAt" TIMESTAMP(3) NOT NULL,
    "handledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StartLead_organizationId_status_createdAt_idx" ON "StartLead"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "StartLead_organizationId_createdAt_idx" ON "StartLead"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "StartLead" ADD CONSTRAINT "StartLead_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
