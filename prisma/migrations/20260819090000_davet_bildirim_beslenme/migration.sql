-- Davet bağlantısı, bildirim/hatırlatma kuyruğu, beslenme planları ve rol ayrımı.

-- ── Roller: staff → coach. Salonun ilk personeli yönetici yapılır.
UPDATE "OrganizationUser" SET "role" = 'coach' WHERE "role" = 'staff';

UPDATE "OrganizationUser" ou
SET "role" = 'admin'
WHERE ou."id" = (
  SELECT inner_ou."id"
  FROM "OrganizationUser" inner_ou
  WHERE inner_ou."organizationId" = ou."organizationId"
    AND inner_ou."role" = 'coach'
  ORDER BY inner_ou."createdAt" ASC
  LIMIT 1
);

-- ── Hatırlatma tercihi
ALTER TABLE "Member" ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- ── Davet
CREATE TABLE "MemberInvite" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'bekliyor',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberInvite_tokenHash_key" ON "MemberInvite"("tokenHash");
CREATE INDEX "MemberInvite_memberId_status_idx" ON "MemberInvite"("memberId", "status");
CREATE INDEX "MemberInvite_expiresAt_idx" ON "MemberInvite"("expiresAt");

ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Bildirim
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'uygulama',
    "status" TEXT NOT NULL DEFAULT 'bekliyor',
    "dedupeKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Beslenme
CREATE TABLE "NutritionPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'taslak',
    "startDate" TIMESTAMP(3),
    "dailyCalories" INTEGER,
    "proteinG" INTEGER,
    "carbsG" INTEGER,
    "fatG" INTEGER,
    "notes" TEXT,
    "groupKey" TEXT,
    "dayType" TEXT,
    "weekDaysCsv" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NutritionPlan_memberId_status_idx" ON "NutritionPlan"("memberId", "status");
CREATE INDEX "NutritionPlan_organizationId_status_idx" ON "NutritionPlan"("organizationId", "status");
CREATE INDEX "NutritionPlan_groupKey_idx" ON "NutritionPlan"("groupKey");

ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NutritionMeal" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "timeLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionMeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NutritionMeal_planId_position_idx" ON "NutritionMeal"("planId", "position");

ALTER TABLE "NutritionMeal" ADD CONSTRAINT "NutritionMeal_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NutritionFood" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "calories" INTEGER,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "alternatives" TEXT,
    "notes" TEXT,

    CONSTRAINT "NutritionFood_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NutritionFood_mealId_position_idx" ON "NutritionFood"("mealId", "position");

ALTER TABLE "NutritionFood" ADD CONSTRAINT "NutritionFood_mealId_fkey"
  FOREIGN KEY ("mealId") REFERENCES "NutritionMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MealCheck" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealCheck_memberId_mealId_logDate_key" ON "MealCheck"("memberId", "mealId", "logDate");
CREATE INDEX "MealCheck_memberId_logDate_idx" ON "MealCheck"("memberId", "logDate");

ALTER TABLE "MealCheck" ADD CONSTRAINT "MealCheck_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealCheck" ADD CONSTRAINT "MealCheck_mealId_fkey"
  FOREIGN KEY ("mealId") REFERENCES "NutritionMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
