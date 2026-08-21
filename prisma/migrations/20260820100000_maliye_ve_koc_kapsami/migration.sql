-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "assignedCoachUserId" TEXT;

-- AlterTable
ALTER TABLE "MemberSubscription" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "priceMinor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CoachCompensation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'yok',
    "perSessionMinor" INTEGER,
    "revenueShareBps" INTEGER,
    "monthlySalaryMinor" INTEGER,
    "monthlySessionQuota" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachCompensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "method" TEXT NOT NULL DEFAULT 'nakit',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "spentAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachEarning" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "memberId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'tahakkuk',
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachPayout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'havale',
    "note" TEXT,
    "expenseId" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachCompensation_coachUserId_key" ON "CoachCompensation"("coachUserId");

-- CreateIndex
CREATE INDEX "CoachCompensation_organizationId_idx" ON "CoachCompensation"("organizationId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidAt_idx" ON "Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_memberId_paidAt_idx" ON "Payment"("memberId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_sourceKey_key" ON "Expense"("sourceKey");

-- CreateIndex
CREATE INDEX "Expense_organizationId_spentAt_idx" ON "Expense"("organizationId", "spentAt");

-- CreateIndex
CREATE INDEX "Expense_organizationId_category_idx" ON "Expense"("organizationId", "category");

-- CreateIndex
CREATE INDEX "RecurringExpense_organizationId_isActive_idx" ON "RecurringExpense"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "CoachEarning_organizationId_coachUserId_earnedAt_idx" ON "CoachEarning"("organizationId", "coachUserId", "earnedAt");

-- CreateIndex
CREATE INDEX "CoachEarning_coachUserId_status_idx" ON "CoachEarning"("coachUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CoachEarning_organizationId_sourceType_sourceKey_key" ON "CoachEarning"("organizationId", "sourceType", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "CoachPayout_expenseId_key" ON "CoachPayout"("expenseId");

-- CreateIndex
CREATE INDEX "CoachPayout_organizationId_coachUserId_paidAt_idx" ON "CoachPayout"("organizationId", "coachUserId", "paidAt");

-- CreateIndex
CREATE INDEX "Member_organizationId_assignedCoachUserId_idx" ON "Member"("organizationId", "assignedCoachUserId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_assignedCoachUserId_fkey" FOREIGN KEY ("assignedCoachUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCompensation" ADD CONSTRAINT "CoachCompensation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCompensation" ADD CONSTRAINT "CoachCompensation_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "MemberSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachEarning" ADD CONSTRAINT "CoachEarning_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachEarning" ADD CONSTRAINT "CoachEarning_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachEarning" ADD CONSTRAINT "CoachEarning_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachEarning" ADD CONSTRAINT "CoachEarning_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachEarning" ADD CONSTRAINT "CoachEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CoachPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPayout" ADD CONSTRAINT "CoachPayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPayout" ADD CONSTRAINT "CoachPayout_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPayout" ADD CONSTRAINT "CoachPayout_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

