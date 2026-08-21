"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  getCurrentUser,
  requireStaff,
  requireMemberInScope,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import {
  addRequirement,
  awardRank,
  createRank,
  deleteRequirement,
  findRankInOrganization,
  findRequirementInOrganization,
  revokeRank,
  toggleRequirementCheck,
} from "@/lib/queries/ranks";
import { REQUIREMENT_KINDS } from "@/domain/rank/progress";
import { recordAudit } from "@/lib/queries/audit";

function revalidateRankViews(memberId?: string): void {
  revalidatePath("/personel/kusaklar");
  revalidatePath("/uye/kusak");
  revalidatePath("/uye");
  if (memberId) {
    revalidatePath(`/personel/kusaklar/${memberId}`);
    revalidatePath(`/personel/uyeler/${memberId}`);
  }
}

export type RankActionState = { error?: string; success?: string };

/**
 * Terfi. Sistem kimseyi otomatik terfi ettirmez — "hazır" göstergesi
 * yalnız bir tavsiyedir, imza antrenörün.
 */
export async function awardRankAction(
  memberId: string,
  rankId: string,
  _prevState: RankActionState,
  formData: FormData,
): Promise<RankActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const member = await requireMemberInScope(
    staffScopeFor(membership, user.id),
    memberId,
  ).catch(() => null);
  if (!member) return { error: "Sporcu bulunamadı." };

  const rank = await findRankInOrganization(rankId, membership.organizationId);
  if (!rank) return { error: "Kuşak bulunamadı." };

  const note = formData.get("note")?.toString().slice(0, 200) || undefined;
  const result = await awardRank({
    memberId: member.id,
    rankId: rank.id,
    awardedByUserId: user.id,
    note,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kusak.terfi",
    entityType: "Member",
    entityId: member.id,
    summary: `${member.fullName} · ${result.rankName} kuşağına terfi etti.`,
  });

  revalidateRankViews(member.id);
  return { success: `${member.fullName} artık ${result.rankName}.` };
}

/** Yanlış verilen terfiyi geri alır. */
export async function revokeRankAction(
  memberId: string,
  rankId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const member = await requireMemberInScope(
    staffScopeFor(membership, user.id),
    memberId,
  ).catch(() => null);
  if (!member) return;

  const rank = await findRankInOrganization(rankId, membership.organizationId);
  if (!rank) return;

  await revokeRank(member.id, rank.id);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kusak.geri-alindi",
    entityType: "Member",
    entityId: member.id,
    summary: `${member.fullName} · ${rank.name} kuşağı geri alındı.`,
  });

  revalidateRankViews(member.id);
}

/** Müfredat maddesini işaretler ya da işareti kaldırır. */
export async function toggleRequirementAction(
  memberId: string,
  requirementId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const member = await requireMemberInScope(
    staffScopeFor(membership, user.id),
    memberId,
  ).catch(() => null);
  if (!member) return;

  const requirement = await findRequirementInOrganization(
    requirementId,
    membership.organizationId,
  );
  if (!requirement) return;

  await toggleRequirementCheck({
    memberId: member.id,
    requirementId: requirement.id,
    checkedByUserId: user.id,
  });

  revalidateRankViews(member.id);
}

const rankSchema = z.object({
  name: z.string().trim().min(2, "Kuşak adı gerekli.").max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalı."),
  minSessions: z.coerce.number().int().min(0).max(500),
  minWeeks: z.coerce.number().int().min(0).max(200),
  summary: z.string().max(200).optional(),
});

/** Merdivene yeni basamak ekler — sona eklenir, sıra sonradan değişmez. */
export async function createRankAction(
  _prevState: RankActionState,
  formData: FormData,
): Promise<RankActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = rankSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    minSessions: formData.get("minSessions"),
    minWeeks: formData.get("minWeeks"),
    summary: formData.get("summary")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const result = await createRank({
    organizationId: membership.organizationId,
    ...parsed.data,
  });
  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kusak.tanimlandi",
    entityType: "Rank",
    entityId: result.id,
    summary: `"${parsed.data.name}" kuşağı merdivene eklendi.`,
  });

  revalidateRankViews();
  return { success: `${parsed.data.name} eklendi.` };
}

const requirementSchema = z.object({
  rankId: z.string().min(1, "Kuşak seçilmedi."),
  kind: z.enum(REQUIREMENT_KINDS),
  label: z.string().trim().min(2, "Madde metni gerekli.").max(120),
  techniqueSlug: z.string().max(60).optional(),
  notes: z.string().max(200).optional(),
});

export async function addRequirementAction(
  _prevState: RankActionState,
  formData: FormData,
): Promise<RankActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = requirementSchema.safeParse({
    rankId: formData.get("rankId"),
    kind: formData.get("kind"),
    label: formData.get("label"),
    techniqueSlug: formData.get("techniqueSlug")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const rank = await findRankInOrganization(
    parsed.data.rankId,
    membership.organizationId,
  );
  if (!rank) return { error: "Kuşak bulunamadı." };

  await addRequirement({
    rankId: rank.id,
    kind: parsed.data.kind,
    label: parsed.data.label,
    techniqueSlug: parsed.data.techniqueSlug,
    notes: parsed.data.notes,
  });

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kusak.tanimlandi",
    entityType: "RankRequirement",
    entityId: rank.id,
    summary: `${rank.name} · müfredata "${parsed.data.label}" eklendi.`,
  });

  revalidateRankViews();
  return { success: "Müfredat maddesi eklendi." };
}

export async function deleteRequirementAction(
  requirementId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const requirement = await findRequirementInOrganization(
    requirementId,
    membership.organizationId,
  );
  if (!requirement) return;

  await deleteRequirement(requirement.id);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "kusak.tanimlandi",
    entityType: "RankRequirement",
    entityId: requirement.rank.id,
    summary: `${requirement.rank.name} · "${requirement.label}" maddesi silindi.`,
  });

  revalidateRankViews();
}
