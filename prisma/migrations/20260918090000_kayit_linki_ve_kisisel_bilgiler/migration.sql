-- Tek kayıt linki + üyeden alınan kişisel bilgiler.
--
-- 1) Member'a kayıt formunun alanları eklenir. Hepsi NULL kabul eder:
--    eski kayıtlar personel tarafından elle açılmıştı, bu alanlar onlarda boş
--    kalır ve sporcu profilinden sonradan doldurulur.
-- 2) MemberJoinLink: paylaşılabilir kayıt bağlantısı (/katil/<slug>).

ALTER TABLE "Member" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Member" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Member" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN "gender" TEXT;
ALTER TABLE "Member" ADD COLUMN "district" TEXT;
ALTER TABLE "Member" ADD COLUMN "city" TEXT;
ALTER TABLE "Member" ADD COLUMN "state" TEXT;
ALTER TABLE "Member" ADD COLUMN "country" TEXT;
ALTER TABLE "Member" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Member" ADD COLUMN "emergencyName" TEXT;
ALTER TABLE "Member" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "Member" ADD COLUMN "healthNote" TEXT;
ALTER TABLE "Member" ADD COLUMN "selfRegisteredAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN "joinLinkId" TEXT;
ALTER TABLE "Member" ADD COLUMN "kvkkConsentAt" TIMESTAMP(3);
ALTER TABLE "Member" ADD COLUMN "marketingConsentAt" TIMESTAMP(3);

CREATE TABLE "MemberJoinLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultCoachUserId" TEXT,
    "defaultStatus" TEXT NOT NULL DEFAULT 'lead',
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberJoinLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberJoinLink_slug_key" ON "MemberJoinLink"("slug");
CREATE INDEX "MemberJoinLink_organizationId_isActive_idx" ON "MemberJoinLink"("organizationId", "isActive");

CREATE INDEX "Member_organizationId_selfRegisteredAt_idx" ON "Member"("organizationId", "selfRegisteredAt");
CREATE INDEX "Member_joinLinkId_idx" ON "Member"("joinLinkId");

ALTER TABLE "MemberJoinLink" ADD CONSTRAINT "MemberJoinLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Member" ADD CONSTRAINT "Member_joinLinkId_fkey"
  FOREIGN KEY ("joinLinkId") REFERENCES "MemberJoinLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
