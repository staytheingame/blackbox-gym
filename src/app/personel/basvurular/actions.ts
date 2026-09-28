"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireAdmin,
  requireStaff,
} from "@/lib/auth/guards";
import { deleteLead, setLeadStatus } from "@/lib/queries/funnel";
import { deleteStartLead, setStartLeadStatus } from "@/lib/queries/start-leads";
import { isLeadStatus, leadStatusLabel } from "@/domain/funnel/lead";
import { recordAudit } from "@/lib/queries/audit";

/** İki form vardır; işlem hangisinin kaydına yapılıyor. */
type LeadKind = "baslangic" | "basvuru";

const isKind = (value: string): value is LeadKind =>
  value === "baslangic" || value === "basvuru";

function revalidateInbox(): void {
  revalidatePath("/personel/basvurular");
  revalidatePath("/yonetim/basvurular");
}

/** Talebin durumunu işler (arandı, deneme dersi, üye oldu, olumsuz) — tüm personel. */
export async function setLeadStatusAction(
  kind: string,
  leadId: string,
  status: string,
): Promise<void> {
  if (!isKind(kind) || !isLeadStatus(status)) return;

  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const result =
    kind === "baslangic"
      ? await setStartLeadStatus(leadId, membership.organizationId, status, user.id)
      : await setLeadStatus(leadId, membership.organizationId, status, user.id);
  if (!result.ok) return;

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "basvuru.durum",
    entityType: kind === "baslangic" ? "StartLead" : "FunnelLead",
    entityId: leadId,
    summary: `${result.fullName} talebi "${leadStatusLabel(status)}" olarak işaretlendi.`,
  });

  revalidateInbox();
}

/** Talebi kalıcı siler — yalnız yönetici (test taleplerini temizlemek için de). */
export async function deleteLeadAction(
  kind: string,
  leadId: string,
): Promise<{ error?: string }> {
  if (!isKind(kind)) return { error: "Geçersiz kayıt türü." };

  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Silmek için yönetici yetkisi gerekli." };

  const result =
    kind === "baslangic"
      ? await deleteStartLead(leadId, membership.organizationId)
      : await deleteLead(leadId, membership.organizationId);
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "basvuru.silindi",
    entityType: kind === "baslangic" ? "StartLead" : "FunnelLead",
    entityId: leadId,
    summary: `${result.fullName} talebi silindi.`,
  });

  revalidateInbox();
  return {};
}
