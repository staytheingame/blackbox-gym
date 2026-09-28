-- Kayıt formu yanıtları + antrenörler için kadro kayıt bağlantısı.
--
-- YALNIZ YENİ TABLO: mevcut tablolara sütun eklenmez, hiçbir veri değişmez.
-- Uygulanmadan önce yayına çıkan kod da çalışır (yanıtlar denetim kaydına
-- düşer, kadro bağlantısı bölümü "tablo yok" der) — bkz. BACKLOG Faz 16.

CREATE TABLE "MemberRegistrationAnswer" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "occupation" TEXT,
    "dailyLoad" TEXT,
    "preferredTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chosenCoachUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRegistrationAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberRegistrationAnswer_memberId_key" ON "MemberRegistrationAnswer"("memberId");

ALTER TABLE "MemberRegistrationAnswer" ADD CONSTRAINT "MemberRegistrationAnswer_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaffJoinLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffJoinLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffJoinLink_tokenHash_key" ON "StaffJoinLink"("tokenHash");
CREATE INDEX "StaffJoinLink_organizationId_isActive_idx" ON "StaffJoinLink"("organizationId", "isActive");

ALTER TABLE "StaffJoinLink" ADD CONSTRAINT "StaffJoinLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
