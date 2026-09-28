"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import {
  createJoinLink,
  setJoinLinkActive,
  updateJoinLinkDefaults,
} from "@/lib/queries/join-links";
import { recordAudit } from "@/lib/queries/audit";

function revalidateJoin(): void {
  revalidatePath("/yonetim/kayit-linki");
  revalidatePath("/yonetim/uyeler");
}

const createSchema = z.object({
  label: z.string().trim().min(3, "Bağlantıya bir ad ver (ör. Resepsiyon QR)."),
  slug: z.string().trim().max(40).optional(),
  defaultCoachUserId: z.string().trim().optional(),
  defaultStatus: z.enum(["lead", "active"]).default("active"),
  maxUses: z.coerce.number().int().min(1).max(5000).optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type JoinLinkFormState = {
  error?: string;
  success?: string;
  url?: string;
};

/**
 * Yeni kayıt bağlantısı üretir. Birden fazla link olması bilinçli: her kanal
 * (QR, Instagram, tabela, kampanya) ayrı satır olursa "hangi link kaç üye
 * getirdi" ölçülebilir hâle gelir.
 */
export async function createJoinLinkAction(
  _prevState: JoinLinkFormState,
  formData: FormData,
): Promise<JoinLinkFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = createSchema.safeParse({
    label: formData.get("label"),
    slug: formData.get("slug")?.toString() || undefined,
    defaultCoachUserId: formData.get("defaultCoachUserId")?.toString() || undefined,
    defaultStatus: formData.get("defaultStatus")?.toString() || "active",
    maxUses: formData.get("maxUses")?.toString() || undefined,
    expiresAt: formData.get("expiresAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createJoinLink({
    organizationId: membership.organizationId,
    label: parsed.data.label,
    slug: parsed.data.slug,
    defaultCoachUserId: parsed.data.defaultCoachUserId || null,
    defaultStatus: parsed.data.defaultStatus,
    maxUses: parsed.data.maxUses ?? null,
    // Gün sonunda kapanır: "31 Ağustos'a kadar" denince 31'i de kapsasın.
    expiresAt: parsed.data.expiresAt
      ? new Date(`${parsed.data.expiresAt}T23:59:59.000+03:00`)
      : null,
    createdByUserId: user.id,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kayit-linki.uretildi",
    entityType: "MemberJoinLink",
    entityId: result.id,
    summary: `"${parsed.data.label}" kayıt bağlantısı üretildi (/katil/${result.slug}).`,
  });

  revalidateJoin();
  return { success: "Kayıt bağlantısı hazır.", url: result.url };
}

/** Bağlantıyı kapatır/açar. Silmek yok: kapatılan link kimin nereden geldiğini
 *  tutmaya devam eder. */
export async function toggleJoinLinkAction(
  linkId: string,
  isActive: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return;

  const changed = await setJoinLinkActive(
    linkId,
    membership.organizationId,
    isActive,
  );
  if (!changed) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kayit-linki.durum",
    entityType: "MemberJoinLink",
    entityId: linkId,
    summary: isActive
      ? "Kayıt bağlantısı yeniden açıldı."
      : "Kayıt bağlantısı kapatıldı.",
  });

  revalidateJoin();
}

const defaultsSchema = z.object({
  linkId: z.string().min(1),
  defaultCoachUserId: z.string().trim().optional(),
  defaultStatus: z.enum(["lead", "active"]),
});

/** Linkin varsayılanları — sonradan değişebilir, üretilen adres değişmez. */
export async function updateJoinLinkAction(
  _prevState: JoinLinkFormState,
  formData: FormData,
): Promise<JoinLinkFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const parsed = defaultsSchema.safeParse({
    linkId: formData.get("linkId"),
    defaultCoachUserId: formData.get("defaultCoachUserId")?.toString() || undefined,
    defaultStatus: formData.get("defaultStatus")?.toString() || "lead",
  });
  if (!parsed.success) return { error: "Form geçersiz." };

  const ok = await updateJoinLinkDefaults(
    parsed.data.linkId,
    membership.organizationId,
    {
      defaultCoachUserId: parsed.data.defaultCoachUserId || null,
      defaultStatus: parsed.data.defaultStatus,
    },
  );
  if (!ok) return { error: "Bağlantı bulunamadı." };

  revalidateJoin();
  return { success: "Güncellendi." };
}
