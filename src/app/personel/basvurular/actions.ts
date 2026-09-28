"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireAdmin,
  requireStaff,
} from "@/lib/auth/guards";
import { deleteLead, setLeadStatus } from "@/lib/queries/funnel";
import { isLeadStatus, leadStatusLabel } from "@/domain/funnel/lead";
import { recordAudit } from "@/lib/queries/audit";

/** Başvurunun durumunu işler (arandı, deneme dersi, üye oldu, olumsuz) — tüm personel. */
export async function setLeadStatusAction(
  leadId: string,
  status: string,
): Promise<void> {
  if (!isLeadStatus(status)) return;

  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const result = await setLeadStatus(
    leadId,
    membership.organizationId,
    status,
    user.id,
  );
  if (!result.ok) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "basvuru.durum",
    entityType: "FunnelLead",
    entityId: leadId,
    summary: `${result.fullName} başvurusu "${leadStatusLabel(status)}" olarak işaretlendi.`,
  });

  revalidatePath("/personel/basvurular");
}

/** Başvuruyu kalıcı siler — yalnız yönetici (test başvurularını temizlemek için de). */
export async function deleteLeadAction(
  leadId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Silmek için yönetici yetkisi gerekli." };

  const result = await deleteLead(leadId, membership.organizationId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "basvuru.silindi",
    entityType: "FunnelLead",
    entityId: leadId,
    summary: `${result.fullName} başvurusu silindi.`,
  });

  revalidatePath("/personel/basvurular");
  return {};
}
