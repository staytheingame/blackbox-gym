-- Faz 10 — kuşak/derece merdiveni, onam & sağlık beyanı, denetim kaydı, KVKK anonimleştirme.

-- ── KVKK: kimlik alanları silinen sporcu istatistikte kalsın diye işaretlenir
ALTER TABLE "Member" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- ── Kuşak merdiveni
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#facc15',
    "summary" TEXT,
    "minSessions" INTEGER NOT NULL DEFAULT 0,
    "minWeeks" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rank_organizationId_slug_key" ON "Rank"("organizationId", "slug");
CREATE UNIQUE INDEX "Rank_organizationId_order_key" ON "Rank"("organizationId", "order");
CREATE INDEX "Rank_organizationId_order_idx" ON "Rank"("organizationId", "order");

ALTER TABLE "Rank" ADD CONSTRAINT "Rank_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RankRequirement" (
    "id" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "techniqueSlug" TEXT,
    "notes" TEXT,

    CONSTRAINT "RankRequirement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RankRequirement_rankId_position_idx" ON "RankRequirement"("rankId", "position");

ALTER TABLE "RankRequirement" ADD CONSTRAINT "RankRequirement_rankId_fkey"
  FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RequirementCheck" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedByUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "RequirementCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequirementCheck_memberId_requirementId_key" ON "RequirementCheck"("memberId", "requirementId");
CREATE INDEX "RequirementCheck_memberId_idx" ON "RequirementCheck"("memberId");

ALTER TABLE "RequirementCheck" ADD CONSTRAINT "RequirementCheck_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementCheck" ADD CONSTRAINT "RequirementCheck_requirementId_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "RankRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MemberRank" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedByUserId" TEXT,
    "note" TEXT,

    CONSTRAINT "MemberRank_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberRank_memberId_rankId_key" ON "MemberRank"("memberId", "rankId");
CREATE INDEX "MemberRank_memberId_awardedAt_idx" ON "MemberRank"("memberId", "awardedAt");

ALTER TABLE "MemberRank" ADD CONSTRAINT "MemberRank_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberRank" ADD CONSTRAINT "MemberRank_rankId_fkey"
  FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Onam & sağlık beyanı
CREATE TABLE "WaiverTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "body" TEXT NOT NULL,
    "questionsJson" TEXT,
    "requiresGuardian" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiverTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WaiverTemplate_organizationId_isActive_idx" ON "WaiverTemplate"("organizationId", "isActive");

ALTER TABLE "WaiverTemplate" ADD CONSTRAINT "WaiverTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MemberWaiver" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "signedName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "birthDate" TIMESTAMP(3),
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "answersJson" TEXT,
    "healthNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'imzalandi',

    CONSTRAINT "MemberWaiver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberWaiver_memberId_templateId_version_key" ON "MemberWaiver"("memberId", "templateId", "version");
CREATE INDEX "MemberWaiver_memberId_status_idx" ON "MemberWaiver"("memberId", "status");
CREATE INDEX "MemberWaiver_templateId_idx" ON "MemberWaiver"("templateId");

ALTER TABLE "MemberWaiver" ADD CONSTRAINT "MemberWaiver_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberWaiver" ADD CONSTRAINT "MemberWaiver_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "WaiverTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Denetim kaydı
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_organizationId_action_idx" ON "AuditLog"("organizationId", "action");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
