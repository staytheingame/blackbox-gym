import "server-only";
import { prisma } from "@/lib/db";
import { computeCutPlan, weeklyTrendKg, type CutPlan } from "@/domain/weight/cut";

export type WeightSummary = {
  entries: { id: string; takenAt: Date; weightKg: number; bodyFatPercent: number | null; note: string | null }[];
  latestKg: number | null;
  trendKgPerWeek: number | null;
  goal: {
    id: string;
    targetKg: number;
    weightClass: string | null;
    fightDate: Date | null;
  } | null;
  cut: CutPlan | null;
};

export async function getWeightSummary(
  memberId: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<WeightSummary> {
  const [rows, goal] = await Promise.all([
    prisma.weightEntry.findMany({
      where: { memberId },
      orderBy: { takenAt: "desc" },
      take: limit,
    }),
    prisma.weightGoal.findFirst({
      where: { memberId, status: "aktif" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const entries = rows.map((row) => ({
    id: row.id,
    takenAt: row.takenAt,
    weightKg: row.weightKg,
    bodyFatPercent: row.bodyFatPercent,
    note: row.note,
  }));

  const latestKg = entries[0]?.weightKg ?? null;

  return {
    entries,
    latestKg,
    trendKgPerWeek: weeklyTrendKg(entries),
    goal: goal
      ? {
          id: goal.id,
          targetKg: goal.targetKg,
          weightClass: goal.weightClass,
          fightDate: goal.fightDate,
        }
      : null,
    cut:
      goal && latestKg !== null
        ? computeCutPlan({
            currentKg: latestKg,
            targetKg: goal.targetKg,
            fightDate: goal.fightDate,
            today: new Date(),
          })
        : null,
  };
}

export type StaffWeightRow = {
  memberId: string;
  fullName: string;
  memberNo: string;
  latestKg: number | null;
  lastTakenAt: Date | null;
  trendKgPerWeek: number | null;
  targetKg: number | null;
  weightClass: string | null;
  fightDate: Date | null;
  cut: CutPlan | null;
  /** `staleDays` gündür (ya da hiç) tartılmamış. */
  isStale: boolean;
};

/**
 * Salondaki tüm sporcuların tartı durumu — antrenörün "kim sıklete
 * yetişiyor" ekranı. Üye başına ayrı sorgu yok: son kayıtlar ve aktif hedef
 * tek `findMany` içinde iç içe çekilir.
 *
 * "Bugün" değeri burada okunur; sayfa bileşenleri saf kalsın diye
 * (`react-hooks/purity`) tarih hesabı render'a taşınmaz.
 */
export async function listMemberWeights(
  organizationId: string,
  { trendWindow = 6, staleDays = 10 }: {
    trendWindow?: number;
    staleDays?: number;
  } = {},
): Promise<StaffWeightRow[]> {
  const rows = await prisma.member.findMany({
    where: { organizationId, status: { in: ["active", "lead"] } },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      weightEntries: {
        orderBy: { takenAt: "desc" },
        take: trendWindow,
        select: { takenAt: true, weightKg: true },
      },
      weightGoals: {
        where: { status: "aktif" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { targetKg: true, weightClass: true, fightDate: true },
      },
    },
  });

  const today = new Date();
  const staleBefore = new Date(
    today.getTime() - staleDays * 24 * 60 * 60 * 1000,
  );

  return rows.map((row) => {
    const latest = row.weightEntries[0] ?? null;
    const goal = row.weightGoals[0] ?? null;

    return {
      memberId: row.id,
      fullName: row.fullName,
      memberNo: row.memberNo,
      latestKg: latest?.weightKg ?? null,
      lastTakenAt: latest?.takenAt ?? null,
      trendKgPerWeek: weeklyTrendKg(row.weightEntries),
      targetKg: goal?.targetKg ?? null,
      weightClass: goal?.weightClass ?? null,
      fightDate: goal?.fightDate ?? null,
      cut:
        goal && latest
          ? computeCutPlan({
              currentKg: latest.weightKg,
              targetKg: goal.targetKg,
              fightDate: goal.fightDate,
              today,
            })
          : null,
      isStale: !latest || latest.takenAt < staleBefore,
    };
  });
}

export async function addWeightEntry(
  memberId: string,
  input: { weightKg: number; bodyFatPercent?: number; note?: string },
  recordedByUserId?: string,
): Promise<void> {
  await prisma.weightEntry.create({
    data: {
      memberId,
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent,
      note: input.note,
      recordedByUserId,
    },
  });
}

/** Yeni hedef eskisini kapatır — geçmiş hedefler silinmez. */
export async function setWeightGoal(
  memberId: string,
  input: { targetKg: number; weightClass?: string; fightDate?: Date },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.weightGoal.updateMany({
      where: { memberId, status: "aktif" },
      data: { status: "iptal" },
    });

    await tx.weightGoal.create({
      data: {
        memberId,
        targetKg: input.targetKg,
        weightClass: input.weightClass,
        fightDate: input.fightDate,
        status: "aktif",
      },
    });
  });
}
