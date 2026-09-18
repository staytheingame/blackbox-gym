"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireMemberInScope,
  requireStaff,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import {
  PLAN_ITEM_KINDS,
  PLAN_KINDS,
  PLAN_LEVELS,
} from "@/domain/plans/template";
import {
  addPlanDay,
  addPlanItem,
  assignPlanToMember,
  copyPlanWeek,
  createPlanTemplate,
  deletePlanDay,
  deletePlanItem,
  deletePlanTemplate,
  movePlanItem,
  updatePlanDay,
  updatePlanTemplate,
} from "@/lib/queries/plans";
import { recordAudit } from "@/lib/queries/audit";

/**
 * Antrenman/kondisyon şablonu düzenleme aksiyonları.
 *
 * Yetki: `requireStaff` — şablon kütüphanesi salon geneli ortak bir varlık,
 * sporcu kapsamı (`StaffScope`) burada geçerli değil. Antrenör de yönetici de
 * aynı kütüphaneyi kurar; sporcuya atama ayrı bir adımdır ve orada kapsam
 * yeniden uygulanır (bkz. `uyeler/[id]/actions.ts`).
 */

function revalidateTemplates(templateId?: string): void {
  revalidatePath("/personel/planlar");
  if (templateId) revalidatePath(`/personel/planlar/${templateId}`);
  // Atanmış şablon değiştiyse sporcunun programı da tazelensin.
  revalidatePath("/uye/program");
  revalidatePath("/uye/antrenman");
}

/** Boş metin alanını `null`'a çevirir — "" ile null aynı şey değil. */
function optionalText(value: FormDataEntryValue | null): string | null {
  const text = value?.toString().trim();
  return text ? text : null;
}

/** Boş sayı alanı `null`; geçersiz sayı da `null` sayılır. */
function optionalInt(value: FormDataEntryValue | null): number | null {
  const text = value?.toString().trim();
  if (!text) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export type TemplateFormState = { error?: string; success?: string };

const templateSchema = z.object({
  name: z.string().trim().min(3, "Şablon adı en az 3 karakter olmalı."),
  kind: z.enum(PLAN_KINDS),
  level: z.enum(PLAN_LEVELS),
  weeks: z
    .number()
    .int("Hafta sayısı tam sayı olmalı.")
    .min(1, "En az 1 hafta.")
    .max(24, "En fazla 24 hafta."),
  summary: z.string().trim().max(300).nullable(),
});

function readTemplateForm(formData: FormData) {
  return {
    name: formData.get("name")?.toString() ?? "",
    kind: formData.get("kind")?.toString() ?? "antrenman",
    level: formData.get("level")?.toString() ?? "baslangic",
    weeks: optionalInt(formData.get("weeks")) ?? 4,
    summary: optionalText(formData.get("summary")),
  };
}

export async function createTemplateAction(
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = templateSchema.safeParse(readTemplateForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createPlanTemplate(
    membership.organizationId,
    parsed.data,
    user.id,
  );
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "plan.sablon-eklendi",
    entityType: "PlanTemplate",
    entityId: result.templateId,
    summary: `"${parsed.data.name}" şablonu oluşturuldu (${parsed.data.weeks} hafta).`,
  });

  revalidateTemplates(result.templateId);
  redirect(`/personel/planlar/${result.templateId}`);
}

export async function updateTemplateAction(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = templateSchema.safeParse(readTemplateForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await updatePlanTemplate(
    templateId,
    membership.organizationId,
    parsed.data,
  );
  if (!result.ok) return { error: result.error ?? "Şablon güncellenemedi." };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "plan.sablon-guncellendi",
    entityType: "PlanTemplate",
    entityId: templateId,
    summary: `"${parsed.data.name}" şablonunun ayarları güncellendi.`,
  });

  revalidateTemplates(templateId);
  return { success: "Şablon güncellendi." };
}

/** Yayından kaldırma/geri alma — atanmış şablonlar için silmenin yerine geçer. */
export async function setTemplateActiveAction(
  templateId: string,
  isActive: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await updatePlanTemplate(templateId, membership.organizationId, { isActive });
  revalidateTemplates(templateId);
}

export async function deleteTemplateAction(
  templateId: string,
  _prevState: TemplateFormState,
  _formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const result = await deletePlanTemplate(templateId, membership.organizationId);
  if (!result.ok) return { error: result.error ?? "Şablon silinemedi." };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "plan.sablon-silindi",
    entityType: "PlanTemplate",
    entityId: templateId,
    summary: "Şablon silindi (hiçbir sporcuya atanmamıştı).",
  });

  revalidateTemplates();
  redirect("/personel/planlar");
}

const daySchema = z.object({
  weekNumber: z.number().int().min(1).max(24),
  dayOfWeek: z.number().int().min(1, "Gün seç.").max(7),
  focus: z.string().trim().min(2, "Günün odağını yaz (ör. Ped & kombinasyon)."),
  notes: z.string().trim().max(500).nullable(),
});

export async function addDayAction(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = daySchema.safeParse({
    weekNumber: optionalInt(formData.get("weekNumber")) ?? 1,
    dayOfWeek: optionalInt(formData.get("dayOfWeek")) ?? 0,
    focus: formData.get("focus")?.toString() ?? "",
    notes: optionalText(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await addPlanDay(
    templateId,
    membership.organizationId,
    parsed.data,
  );
  if (!result.ok) return { error: result.error ?? "Gün eklenemedi." };

  revalidateTemplates(templateId);
  return { success: "Gün eklendi." };
}

export async function updateDayAction(
  dayId: string,
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const focus = formData.get("focus")?.toString().trim() ?? "";
  if (focus.length < 2) return { error: "Günün odağını yaz." };

  const result = await updatePlanDay(dayId, membership.organizationId, {
    focus,
    notes: optionalText(formData.get("notes")),
  });
  if (!result.ok) return { error: result.error ?? "Gün güncellenemedi." };

  revalidateTemplates(templateId);
  return { success: "Gün güncellendi." };
}

export async function deleteDayAction(
  dayId: string,
  templateId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await deletePlanDay(dayId, membership.organizationId);
  revalidateTemplates(templateId);
}

const itemSchema = z.object({
  kind: z.enum(PLAN_ITEM_KINDS),
  label: z.string().trim().min(2, "Hareket adı gerekli."),
  techniqueSlug: z.string().trim().max(80).nullable(),
  rounds: z.number().int().min(1).max(50).nullable(),
  durationSeconds: z.number().int().min(5).max(7200).nullable(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  targetRpe: z.number().int().min(1).max(10).nullable(),
  notes: z.string().trim().max(300).nullable(),
});

export async function addItemAction(
  dayId: string,
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  // Süre dakika olarak yazılır — antrenör "3 dakikalık round" der, saniye değil.
  const minutes = optionalInt(formData.get("durationMinutes"));

  const parsed = itemSchema.safeParse({
    kind: formData.get("kind")?.toString() ?? "teknik",
    label: formData.get("label")?.toString() ?? "",
    techniqueSlug: optionalText(formData.get("techniqueSlug")),
    rounds: optionalInt(formData.get("rounds")),
    durationSeconds: minutes === null ? null : minutes * 60,
    restSeconds: optionalInt(formData.get("restSeconds")),
    targetRpe: optionalInt(formData.get("targetRpe")),
    notes: optionalText(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await addPlanItem(
    dayId,
    membership.organizationId,
    parsed.data,
  );
  if (!result.ok) return { error: result.error ?? "Hareket eklenemedi." };

  revalidateTemplates(templateId);
  return { success: "Hareket eklendi." };
}

export async function deleteItemAction(
  itemId: string,
  templateId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await deletePlanItem(itemId, membership.organizationId);
  revalidateTemplates(templateId);
}

export async function moveItemAction(
  itemId: string,
  templateId: string,
  direction: "yukari" | "asagi",
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await movePlanItem(itemId, membership.organizationId, direction);
  revalidateTemplates(templateId);
}

export async function copyWeekAction(
  templateId: string,
  _prevState: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const fromWeek = optionalInt(formData.get("fromWeek"));
  const toWeek = optionalInt(formData.get("toWeek"));
  if (fromWeek === null || toWeek === null) {
    return { error: "Kaynak ve hedef haftayı seç." };
  }

  const result = await copyPlanWeek(
    templateId,
    membership.organizationId,
    fromWeek,
    toWeek,
  );
  if (!result.ok) return { error: result.error ?? "Hafta kopyalanamadı." };

  revalidateTemplates(templateId);
  return {
    success: `${fromWeek}. hafta ${toWeek}. haftaya kopyalandı.`,
  };
}

// ── Toplu atama ───────────────────────────────────────────────

const bulkAssignSchema = z.object({
  templateId: z.string().min(1, "Şablon seç."),
  memberIds: z.array(z.string().min(1)).min(1, "En az bir sporcu seç."),
});

export type BulkAssignState = { error?: string; success?: string };

/**
 * Bir şablonu birden çok sporcuya birden atar.
 *
 * Neden: aynı programı on kişiye vermek, on kez sporcu kartına girip formu
 * doldurmak demekti. Grup dersi veren salonda program çoğu zaman ortak; kişiye
 * özel olan azınlıktır ve o zaten sporcu kartından atanmaya devam eder.
 *
 * Kapsam her sporcu için TEK TEK doğrulanır (`requireMemberInScope`): formdan
 * gelen kimlik listesine güvenilmez, antrenör başkasının sporcusuna program
 * yazamaz.
 */
export async function assignPlanBulkAction(
  _prevState: BulkAssignState,
  formData: FormData,
): Promise<BulkAssignState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = bulkAssignSchema.safeParse({
    templateId: formData.get("templateId"),
    memberIds: formData.getAll("memberIds").map((value) => value.toString()),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const scope = staffScopeFor(membership, user.id);

  let assigned = 0;
  const failed: string[] = [];

  for (const memberId of parsed.data.memberIds) {
    const member = await requireMemberInScope(scope, memberId).catch(() => null);
    if (!member) {
      failed.push(memberId);
      continue;
    }

    const result = await assignPlanToMember(
      memberId,
      parsed.data.templateId,
      user.id,
    );
    if (result.ok) {
      assigned += 1;
      revalidatePath(`/personel/uyeler/${memberId}`);
    } else {
      failed.push(member.fullName);
    }
  }

  if (assigned === 0) {
    return { error: "Hiçbir sporcuya atanamadı. Kapsamını kontrol et." };
  }

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "plan.toplu-atandi",
    entityType: "PlanTemplate",
    entityId: parsed.data.templateId,
    summary: `Şablon ${assigned} sporcuya atandı.`,
  });

  revalidateTemplates(parsed.data.templateId);
  revalidatePath("/personel/uyeler");

  return {
    success:
      `${assigned} sporcuya atandı.` +
      (failed.length > 0 ? ` ${failed.length} tanesi atlandı.` : ""),
  };
}
