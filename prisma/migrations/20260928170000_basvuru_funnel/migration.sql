-- Başvuru funnel'ı: herkese açık /basvuru sayfasını dolduran adaylar.
--
-- YALNIZ YENİ TABLO: mevcut tablolara sütun eklenmez, hiçbir veri değişmez.
-- Uygulanmadan önce yayına çıkan kod da çalışır (başvuru denetim kaydına düşer,
-- Başvurular ekranı "kurulum bekliyor" der). IF NOT EXISTS: aynı SQL Supabase SQL
-- düzenleyicisinden elle çalıştırılmış olsa bile `migrate deploy` hata vermez.

CREATE TABLE IF NOT EXISTS "FunnelLead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'yeni',
    "interest" TEXT NOT NULL,
    "quotedPriceMinor" INTEGER,
    "forWhom" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "childName" TEXT,
    "occupationGroup" TEXT,
    "dailyLoad" TEXT,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactChannel" TEXT NOT NULL,
    "contactTime" TEXT,
    "note" TEXT,
    "kvkkConsentAt" TIMESTAMP(3) NOT NULL,
    "marketingConsentAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'basvuru',
    "handledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FunnelLead_organizationId_status_createdAt_idx" ON "FunnelLead"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FunnelLead_organizationId_createdAt_idx" ON "FunnelLead"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "FunnelLead" ADD CONSTRAINT "FunnelLead_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
