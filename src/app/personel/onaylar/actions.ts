"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import {
  createWaiverTemplate,
  setWaiverTemplateActive,
  updateWaiverTemplate,
} from "@/lib/queries/waivers";
import { WAIVER_KINDS } from "@/domain/waivers/status";
import { recordAudit } from "@/lib/queries/audit";

function revalidateWaiverViews(): void {
  revalidatePath("/personel/onaylar");
  revalidatePath("/uye/onaylar");
  revalidatePath("/uye");
  revalidatePath("/personel");
}

export type WaiverTemplateState = { error?: string; success?: string };

/** Satır satır yazılan soruları listeye çevirir; boş satırlar atılır. */
function parseQuestions(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 20);
}

const createSchema = z.object({
  kind: z.enum(WAIVER_KINDS),
  title: z.string().trim().min(3, "Başlık gerekli.").max(120),
  body: z.string().trim().min(20, "Metin en az 20 karakter olmalı.").max(8000),
  questions: z.string().max(2000).optional(),
  requiresGuardian: z.boolean(),
  isRequired: z.boolean(),
});

export async function createWaiverTemplateAction(
  _prevState: WaiverTemplateState,
  formData: FormData,
): Promise<WaiverTemplateState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = createSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    body: formData.get("body"),
    questions: formData.get("questions")?.toString() || undefined,
    requiresGuardian: formData.get("requiresGuardian") === "on",
    isRequired: formData.get("isRequired") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const id = await createWaiverTemplate({
    organizationId: membership.organizationId,
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body,
    questions: parseQuestions(parsed.data.questions),
    requiresGuardian: parsed.data.requiresGuardian,
    isRequired: parsed.data.isRequired,
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "onam.sablon",
    entityType: "WaiverTemplate",
    entityId: id,
    summary: `"${parsed.data.title}" onam metni oluşturuldu.`,
  });

  revalidateWaiverViews();
  return { success: `${parsed.data.title} eklendi.` };
}

const updateSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().trim().min(3, "Başlık gerekli.").max(120),
  body: z.string().trim().min(20, "Metin en az 20 karakter olmalı.").max(8000),
  questions: z.string().max(2000).optional(),
  bumpVersion: z.boolean(),
});

/**
 * Metni günceller. `bumpVersion` işaretliyse sürüm artar ve mevcut imzalar
 * "eski" olur — sporculardan yeniden onay istenir. Yazım hatası düzeltmek
 * için işaretlenmez.
 */
export async function updateWaiverTemplateAction(
  _prevState: WaiverTemplateState,
  formData: FormData,
): Promise<WaiverTemplateState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = updateSchema.safeParse({
    templateId: formData.get("templateId"),
    title: formData.get("title"),
    body: formData.get("body"),
    questions: formData.get("questions")?.toString() || undefined,
    bumpVersion: formData.get("bumpVersion") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const ok = await updateWaiverTemplate(
    parsed.data.templateId,
    membership.organizationId,
    {
      title: parsed.data.title,
      body: parsed.data.body,
      questions: parseQuestions(parsed.data.questions),
      bumpVersion: parsed.data.bumpVersion,
    },
  );
  if (!ok) return { error: "Form bulunamadı." };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "onam.sablon",
    entityType: "WaiverTemplate",
    entityId: parsed.data.templateId,
    summary: parsed.data.bumpVersion
      ? `"${parsed.data.title}" güncellendi ve sürüm artırıldı — imzalar yenilenecek.`
      : `"${parsed.data.title}" metninde düzeltme yapıldı (sürüm değişmedi).`,
  });

  revalidateWaiverViews();
  return {
    success: parsed.data.bumpVersion
      ? "Metin güncellendi, sürüm arttı — sporculardan yeniden onay istenecek."
      : "Metin güncellendi.",
  };
}

export async function toggleWaiverTemplateAction(
  templateId: string,
  isActive: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  await setWaiverTemplateActive(templateId, membership.organizationId, isActive);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "onam.sablon",
    entityType: "WaiverTemplate",
    entityId: templateId,
    summary: isActive ? "Onam formu yeniden açıldı." : "Onam formu kapatıldı.",
  });

  revalidateWaiverViews();
}
