import "server-only";
import { prisma } from "@/lib/db";
import { getWeekStart } from "@/lib/date";
import { summarizePlanDay } from "@/domain/plans/workload";
import type {
  PlanItemKind,
  PlanKind,
  PlanLevel,
} from "@/domain/plans/template";
import { logTraining, revertTrainingLog } from "@/lib/queries/performance";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";

/**
 * Şablon sözlüğü domain katmanında (`domain/plans/template.ts`) — istemci
 * formları da aynı listeleri okuyor, bu dosya ise `server-only`. Sunucu
 * tarafındaki eski çağrılar bozulmasın diye buradan yeniden dışa veriliyor.
 */
export {
  DAY_LABEL,
  PLAN_ITEM_KINDS,
  PLAN_ITEM_KIND_LABEL,
  PLAN_KINDS,
  PLAN_KIND_LABEL,
  PLAN_LEVELS,
  PLAN_LEVEL_LABEL,
  type PlanItemKind,
  type PlanKind,
  type PlanLevel,
} from "@/domain/plans/template";

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
      // Atama sayısı silme kuralını belirliyor (atanmış şablon silinemez),
      // o yüzden detayla birlikte geliyor.
      _count: { select: { assignments: true } },
    },
  });
}

/**
 * ŞABLON YAZMA KATMANI — antrenör kendi programını panelden kurar.
 *
 * Şablonlar salon geneli olsa da (`organizationId`), gün ve hareket
 * düzenlemesi hep şablonun salonu üzerinden doğrulanır: `dayId`/`itemId`
 * doğrudan formdan gelir, o yüzden her yazma işleminden önce zincir yukarı
 * çıkılıp "bu benim salonumun şablonu mu" sorusu sorulur.
 *
 * Atanmış şablonu SİLMEK yasak: sporcunun yürüyen programı ona bağlı,
 * silmek geçmişi bozardı — yerine "yayından kaldır" (`isActive = false`).
 */

/** Gün/hareket değişince şablonun `updatedAt` alanı da ilerlesin. */
async function touchTemplate(templateId: string): Promise<void> {
  await prisma.planTemplate.update({
    where: { id: templateId },
    data: { updatedAt: new Date() },
  });
}

export type SaveTemplateInput = {
  name: string;
  kind: PlanKind;
  level: PlanLevel;
  weeks: number;
  summary: string | null;
};

export type CreateTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; error: string };

export async function createPlanTemplate(
  organizationId: string,
  input: SaveTemplateInput,
  createdByUserId: string,
): Promise<CreateTemplateResult> {
  const duplicate = await prisma.planTemplate.findFirst({
    where: { organizationId, name: input.name, kind: input.kind },
    select: { id: true },
  });
  if (duplicate) {
    return { ok: false, error: "Bu adla bir şablon zaten var." };
  }

  const template = await prisma.planTemplate.create({
    data: {
      organizationId,
      name: input.name,
      kind: input.kind,
      level: input.level,
      weeks: input.weeks,
      summary: input.summary,
      createdByUserId,
    },
    select: { id: true },
  });

  return { ok: true, templateId: template.id };
}

export type UpdateTemplateResult = { ok: boolean; error?: string };

/**
 * Şablon ayarlarını günceller. Hafta sayısı DÜŞÜRÜLÜRSE artık var olmayan
 * haftaların günleri silinir — aksi hâlde hiçbir ekranda görünmeyen, ama
 * atama sırasında ortaya çıkan hayalet günler kalırdı.
 */
export async function updatePlanTemplate(
  templateId: string,
  organizationId: string,
  input: Partial<SaveTemplateInput> & { isActive?: boolean },
): Promise<UpdateTemplateResult> {
  const template = await prisma.planTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, name: true, kind: true },
  });
  if (!template) return { ok: false, error: "Şablon bulunamadı." };

  if (input.name && input.name !== template.name) {
    const duplicate = await prisma.planTemplate.findFirst({
      where: {
        organizationId,
        name: input.name,
        kind: input.kind ?? template.kind,
        id: { not: templateId },
      },
      select: { id: true },
    });
    if (duplicate) return { ok: false, error: "Bu adla bir şablon zaten var." };
  }

  const weeks = input.weeks;

  await prisma.$transaction(async (tx) => {
    if (weeks !== undefined) {
      await tx.planDay.deleteMany({
        where: { templateId, weekNumber: { gt: weeks } },
      });
    }

    await tx.planTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(weeks !== undefined ? { weeks } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  });

  return { ok: true };
}

/** Atanmamış şablonu siler; atanmışta "yayından kaldır"a yönlendirir. */
export async function deletePlanTemplate(
  templateId: string,
  organizationId: string,
): Promise<UpdateTemplateResult> {
  const template = await prisma.planTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, _count: { select: { assignments: true } } },
  });
  if (!template) return { ok: false, error: "Şablon bulunamadı." };

  if (template._count.assignments > 0) {
    return {
      ok: false,
      error:
        "Bu şablon sporculara atanmış — silinemez. Yeni atamalara kapatmak için yayından kaldır.",
    };
  }

  await prisma.planTemplate.delete({ where: { id: templateId } });
  return { ok: true };
}

export type PlanDayInput = {
  weekNumber: number;
  dayOfWeek: number;
  focus: string;
  notes: string | null;
};

export async function addPlanDay(
  templateId: string,
  organizationId: string,
  input: PlanDayInput,
): Promise<UpdateTemplateResult> {
  const template = await prisma.planTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, weeks: true },
  });
  if (!template) return { ok: false, error: "Şablon bulunamadı." };
  if (input.weekNumber < 1 || input.weekNumber > template.weeks) {
    return {
      ok: false,
      error: `Hafta 1 ile ${template.weeks} arasında olmalı.`,
    };
  }

  const existing = await prisma.planDay.findUnique({
    where: {
      templateId_weekNumber_dayOfWeek: {
        templateId,
        weekNumber: input.weekNumber,
        dayOfWeek: input.dayOfWeek,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "Bu hafta için o gün zaten tanımlı." };
  }

  await prisma.planDay.create({
    data: {
      templateId,
      weekNumber: input.weekNumber,
      dayOfWeek: input.dayOfWeek,
      focus: input.focus,
      notes: input.notes,
    },
  });

  await touchTemplate(templateId);
  return { ok: true };
}

export async function updatePlanDay(
  dayId: string,
  organizationId: string,
  input: { focus?: string; notes?: string | null },
): Promise<UpdateTemplateResult> {
  const day = await prisma.planDay.findFirst({
    where: { id: dayId, template: { organizationId } },
    select: { id: true, templateId: true },
  });
  if (!day) return { ok: false, error: "Gün bulunamadı." };

  await prisma.planDay.update({
    where: { id: dayId },
    data: {
      ...(input.focus !== undefined ? { focus: input.focus } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });

  await touchTemplate(day.templateId);
  return { ok: true };
}

export async function deletePlanDay(
  dayId: string,
  organizationId: string,
): Promise<UpdateTemplateResult> {
  const day = await prisma.planDay.findFirst({
    where: { id: dayId, template: { organizationId } },
    select: { id: true, templateId: true },
  });
  if (!day) return { ok: false, error: "Gün bulunamadı." };

  await prisma.planDay.delete({ where: { id: dayId } });
  await touchTemplate(day.templateId);
  return { ok: true };
}

export type PlanItemInput = {
  kind: PlanItemKind;
  label: string;
  techniqueSlug: string | null;
  rounds: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  targetRpe: number | null;
  notes: string | null;
};

export async function addPlanItem(
  dayId: string,
  organizationId: string,
  input: PlanItemInput,
): Promise<UpdateTemplateResult> {
  const day = await prisma.planDay.findFirst({
    where: { id: dayId, template: { organizationId } },
    select: { id: true, templateId: true, _count: { select: { items: true } } },
  });
  if (!day) return { ok: false, error: "Gün bulunamadı." };

  await prisma.planItem.create({
    data: {
      dayId,
      position: day._count.items + 1,
      kind: input.kind,
      label: input.label,
      techniqueSlug: input.techniqueSlug,
      rounds: input.rounds,
      durationSeconds: input.durationSeconds,
      restSeconds: input.restSeconds,
      targetRpe: input.targetRpe,
      notes: input.notes,
    },
  });

  await touchTemplate(day.templateId);
  return { ok: true };
}

export async function deletePlanItem(
  itemId: string,
  organizationId: string,
): Promise<UpdateTemplateResult> {
  const item = await prisma.planItem.findFirst({
    where: { id: itemId, day: { template: { organizationId } } },
    select: { id: true, day: { select: { id: true, templateId: true } } },
  });
  if (!item) return { ok: false, error: "Hareket bulunamadı." };

  const dayId = item.day.id;

  await prisma.$transaction(async (tx) => {
    await tx.planItem.delete({ where: { id: itemId } });

    // Sıra numaraları boşluksuz kalsın — "yukarı/aşağı taşı" komşuyu
    // pozisyonla bulduğu için delik açık kalırsa sıralama tutarsızlaşır.
    const rest = await tx.planItem.findMany({
      where: { dayId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    for (const [index, row] of rest.entries()) {
      await tx.planItem.update({
        where: { id: row.id },
        data: { position: index + 1 },
      });
    }
  });

  await touchTemplate(item.day.templateId);
  return { ok: true };
}

/** Hareketi gün içinde bir sıra yukarı/aşağı taşır (komşuyla yer değiştirir). */
export async function movePlanItem(
  itemId: string,
  organizationId: string,
  direction: "yukari" | "asagi",
): Promise<UpdateTemplateResult> {
  const item = await prisma.planItem.findFirst({
    where: { id: itemId, day: { template: { organizationId } } },
    select: {
      id: true,
      position: true,
      dayId: true,
      day: { select: { templateId: true } },
    },
  });
  if (!item) return { ok: false, error: "Hareket bulunamadı." };

  const neighbor = await prisma.planItem.findFirst({
    where: {
      dayId: item.dayId,
      position:
        direction === "yukari" ? { lt: item.position } : { gt: item.position },
    },
    orderBy: { position: direction === "yukari" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  if (!neighbor) return { ok: true }; // uçtaki hareket; yapacak bir şey yok

  // İki adımda takas benzersizlik kısıtı olmadığı için güvenli, ama yine de
  // tek transaction: yarıda kalırsa iki hareket aynı sırayı taşırdı.
  await prisma.$transaction([
    prisma.planItem.update({
      where: { id: item.id },
      data: { position: neighbor.position },
    }),
    prisma.planItem.update({
      where: { id: neighbor.id },
      data: { position: item.position },
    }),
  ]);

  await touchTemplate(item.day.templateId);
  return { ok: true };
}

/**
 * Bir haftayı olduğu gibi başka haftaya kopyalar — 4 haftalık şablonu dört
 * kez elle yazmak yerine 1. haftayı kur, kopyala, farkları düzelt. Hedef
 * haftadaki günler ÖNCE silinir: aynı gün iki kez tanımlanamayacağı için
 * "üzerine ekleme" zaten yarıda patlardı.
 */
export async function copyPlanWeek(
  templateId: string,
  organizationId: string,
  fromWeek: number,
  toWeek: number,
): Promise<UpdateTemplateResult> {
  if (fromWeek === toWeek) {
    return { ok: false, error: "Kaynak ve hedef hafta aynı." };
  }

  const template = await prisma.planTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true, weeks: true },
  });
  if (!template) return { ok: false, error: "Şablon bulunamadı." };
  if (
    fromWeek < 1 ||
    toWeek < 1 ||
    fromWeek > template.weeks ||
    toWeek > template.weeks
  ) {
    return {
      ok: false,
      error: `Haftalar 1 ile ${template.weeks} arasında olmalı.`,
    };
  }

  const source = await prisma.planDay.findMany({
    where: { templateId, weekNumber: fromWeek },
    orderBy: { dayOfWeek: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (source.length === 0) {
    return { ok: false, error: `${fromWeek}. haftada kopyalanacak gün yok.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.planDay.deleteMany({ where: { templateId, weekNumber: toWeek } });

    for (const day of source) {
      await tx.planDay.create({
        data: {
          templateId,
          weekNumber: toWeek,
          dayOfWeek: day.dayOfWeek,
          focus: day.focus,
          notes: day.notes,
          items: {
            create: day.items.map((item) => ({
              position: item.position,
              kind: item.kind,
              label: item.label,
              techniqueSlug: item.techniqueSlug,
              rounds: item.rounds,
              durationSeconds: item.durationSeconds,
              restSeconds: item.restSeconds,
              targetRpe: item.targetRpe,
              notes: item.notes,
            })),
          },
        },
      });
    }
  });

  await touchTemplate(templateId);
  return { ok: true };
}

export type AssignmentTarget = {
  id: string;
  fullName: string;
  memberNo: string;
  /** Aynı türde yürüyen program — atama bunu kapatacağı için ekranda yazar. */
  currentPlanName: string | null;
};

/**
 * Toplu atama ekranının sporcu listesi: **kapsam içindeki** aktif ve aday
 * sporcular. Pasif/engelli kayıt listeye girmez — kapanmış bir kayda program
 * atamak sessiz bir hatadır, seçenek olarak görünmemeli.
 */
export async function listAssignmentTargets(
  scope: StaffScope,
  kind: PlanKind,
): Promise<AssignmentTarget[]> {
  const members = await prisma.member.findMany({
    where: memberWhere(scope, { status: { in: ["active", "lead"] } }),
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      memberPlans: {
        where: { status: "aktif", template: { kind } },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { template: { select: { name: true } } },
      },
    },
  });

  return members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    memberNo: member.memberNo,
    currentPlanName: member.memberPlans[0]?.template.name ?? null,
  }));
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
