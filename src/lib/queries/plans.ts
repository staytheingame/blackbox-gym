import "server-only";
import { prisma } from "@/lib/db";
import { getWeekStart } from "@/lib/date";
import { summarizePlanDay } from "@/domain/plans/workload";
import { logTraining, revertTrainingLog } from "@/lib/queries/performance";

export const PLAN_KINDS = ["antrenman", "kondisyon"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_ITEM_KIND_LABEL: Record<string, string> = {
  teknik: "Teknik",
  torba: "Torba",
  ped: "Ped",
  sparring: "Sparring",
  kondisyon: "Kondisyon",
  kuvvet: "Kuvvet",
  esneme: "Esneme",
};

export const DAY_LABEL: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

export const PLAN_LEVEL_LABEL: Record<string, string> = {
  baslangic: "Başlangıç",
  orta: "Orta",
  ileri: "İleri",
};

export async function listPlanTemplates(
  organizationId: string,
  kind?: PlanKind,
) {
  const templates = await prisma.planTemplate.findMany({
    where: { organizationId, ...(kind ? { kind } : {}) },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { assignments: true, days: true } },
    },
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    kind: template.kind,
    level: template.level,
    weeks: template.weeks,
    summary: template.summary,
    isActive: template.isActive,
    dayCount: template._count.days,
    assignmentCount: template._count.assignments,
  }));
}

export async function getPlanTemplateDetail(templateId: string) {
  return prisma.planTemplate.findUnique({
    where: { id: templateId },
    include: {
      days: {
        orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
        include: { items: { orderBy: { position: "asc" } } },
      },
    },
  });
}

export type AssignPlanResult =
  | { ok: true; memberPlanId: string }
  | { ok: false; error: string };

/**
 * Şablonu sporcuya atar. Her TÜR için tek aktif plan olur — yeni antrenman
 * programı eski antrenman programını kapatır, kondisyon programına
 * dokunmaz (sporcu ikisini birden taşıyabilir). Kapanan plan silinmez,
 * "tamamlandi" işaretlenir.
 */
export async function assignPlanToMember(
  memberId: string,
  templateId: string,
  assignedByUserId: string,
): Promise<AssignPlanResult> {
  const template = await prisma.planTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, organizationId: true, kind: true },
  });
  if (!template) return { ok: false, error: "Şablon bulunamadı." };

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { organizationId: true },
  });
  if (!member || member.organizationId !== template.organizationId) {
    return { ok: false, error: "Şablon bu sporcunun salonuna ait değil." };
  }

  const memberPlan = await prisma.$transaction(async (tx) => {
    const supersededIds = await tx.memberPlan
      .findMany({
        where: { memberId, status: "aktif", template: { kind: template.kind } },
        select: { id: true },
      })
      .then((rows) => rows.map((row) => row.id));

    if (supersededIds.length > 0) {
      await tx.memberPlan.updateMany({
        where: { id: { in: supersededIds } },
        data: { status: "tamamlandi" },
      });
    }

    return tx.memberPlan.create({
      data: {
        memberId,
        templateId,
        startDate: getWeekStart(new Date()),
        assignedByUserId,
        status: "aktif",
      },
    });
  });

  return { ok: true, memberPlanId: memberPlan.id };
}

export type ActivePlanWeek = {
  memberPlanId: string;
  templateName: string;
  kind: string;
  level: string;
  totalWeeks: number;
  /** 1 tabanlı; plan bittiyse `totalWeeks`te sabitlenir. */
  currentWeek: number;
  finished: boolean;
  days: {
    id: string;
    dayOfWeek: number;
    focus: string;
    notes: string | null;
    completed: boolean;
    items: {
      id: string;
      kind: string;
      label: string;
      techniqueSlug: string | null;
      rounds: number | null;
      durationSeconds: number | null;
      restSeconds: number | null;
      targetRpe: number | null;
      notes: string | null;
    }[];
  }[];
};

/**
 * Sporcunun aktif programı — yalnız bulunduğu haftanın günleri.
 * `kind` verilirse o türdeki program döner (antrenman ve kondisyon
 * programları birbirinden bağımsız yürür).
 */
export async function getActiveMemberPlan(
  memberId: string,
  kind?: PlanKind,
): Promise<ActivePlanWeek | null> {
  const memberPlan = await prisma.memberPlan.findFirst({
    where: {
      memberId,
      status: "aktif",
      ...(kind ? { template: { kind } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { name: true, kind: true, level: true, weeks: true } },
      completions: { select: { dayId: true } },
    },
  });
  if (!memberPlan) return null;

  const thisWeek = getWeekStart(new Date());
  const weeksElapsed = Math.floor(
    (thisWeek.getTime() - memberPlan.startDate.getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );
  const rawWeek = weeksElapsed + 1;
  const finished = rawWeek > memberPlan.template.weeks;
  const currentWeek = Math.min(
    Math.max(rawWeek, 1),
    memberPlan.template.weeks,
  );

  const days = await prisma.planDay.findMany({
    where: { templateId: memberPlan.templateId, weekNumber: currentWeek },
    orderBy: { dayOfWeek: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });

  const completed = new Set(memberPlan.completions.map((c) => c.dayId));

  return {
    memberPlanId: memberPlan.id,
    templateName: memberPlan.template.name,
    kind: memberPlan.template.kind,
    level: memberPlan.template.level,
    totalWeeks: memberPlan.template.weeks,
    currentWeek,
    finished,
    days: days.map((day) => ({
      id: day.id,
      dayOfWeek: day.dayOfWeek,
      focus: day.focus,
      notes: day.notes,
      completed: completed.has(day.id),
      items: day.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        techniqueSlug: item.techniqueSlug,
        rounds: item.rounds,
        durationSeconds: item.durationSeconds,
        restSeconds: item.restSeconds,
        targetRpe: item.targetRpe,
        notes: item.notes,
      })),
    })),
  };
}

/**
 * Gün tamamlandı işareti. İşaretle birlikte o günün planından türetilmiş bir
 * `TrainingLog` oluşur — böylece program takibi de puana, rozete ve
 * antrenman geçmişine işler (elle log tutmakla aynı yol). Tekrar basmak yeni
 * kayıt açmaz (idempotent).
 */
export async function completePlanDay(
  memberId: string,
  memberPlanId: string,
  dayId: string,
  createdByUserId: string,
): Promise<void> {
  const existing = await prisma.planCompletion.findUnique({
    where: { memberPlanId_dayId: { memberPlanId, dayId } },
    select: { id: true },
  });
  if (existing) return;

  const day = await prisma.planDay.findUnique({
    where: { id: dayId },
    include: {
      items: true,
      template: { select: { kind: true, name: true } },
    },
  });
  if (!day) return;

  const workload = summarizePlanDay(day.items, day.template.kind);
  const trainingLogId = await logTraining(
    memberId,
    {
      type: workload.type,
      durationMinutes: workload.durationMinutes,
      rounds: workload.rounds > 0 ? workload.rounds : undefined,
      intensity: workload.intensity,
      notes: `${day.template.name} · ${day.weekNumber}. hafta · ${day.focus}`,
    },
    createdByUserId,
  );

  try {
    await prisma.planCompletion.create({
      data: { memberPlanId, dayId, trainingLogId },
    });
  } catch (error) {
    // Aynı anda iki kez basıldıysa benzersizlik kısıtı patlar; sahipsiz
    // kalan antrenman kaydını bırakmayalım.
    await revertTrainingLog(memberId, trainingLogId);
    throw error;
  }
}

/** İşareti kaldırır: türetilmiş antrenman kaydı silinir, puan iade edilir. */
export async function uncompletePlanDay(
  memberId: string,
  memberPlanId: string,
  dayId: string,
): Promise<void> {
  const completion = await prisma.planCompletion.findUnique({
    where: { memberPlanId_dayId: { memberPlanId, dayId } },
    select: { id: true, trainingLogId: true },
  });
  if (!completion) return;

  await prisma.planCompletion.delete({ where: { id: completion.id } });

  if (completion.trainingLogId) {
    await revertTrainingLog(memberId, completion.trainingLogId);
  }
}

/** Bir planın sahibi bu üye mi — server action'larda yetki kontrolü için. */
export async function memberOwnsPlan(
  memberId: string,
  memberPlanId: string,
): Promise<boolean> {
  const count = await prisma.memberPlan.count({
    where: { id: memberPlanId, memberId },
  });
  return count > 0;
}
