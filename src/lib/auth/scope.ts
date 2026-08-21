import type { Prisma } from "@prisma/client";
import { isAdminRole, type OrgRole } from "@/lib/auth/roles";

/**
 * "Bu personel kimi görebilir" — TEK doğru kaynak.
 *
 * Kural (kullanıcı kararı): **antrenör yalnız kendi sporcularını görür.**
 * Sorumluluk `Member.assignedCoachUserId` alanındadır; sporcuyu ekleyen
 * antrenör oraya yazılır, yönetici devredebilir.
 *
 *   coach → yalnız sorumlusu olduğu sporcular
 *   admin → salonun tamamı (`coachUserId = null`)
 *
 * Sporcu listeleyen HER sorgu bu kapsamı almalı; doğrudan
 * `where: { organizationId }` yazmak sızıntıdır. Yeni ekran eklerken
 * `memberWhere(scope)` kullan.
 */
export type StaffScope = {
  organizationId: string;
  /** `null` = kısıt yok (yönetici). Dolu = yalnız bu antrenörün sporcuları. */
  coachUserId: string | null;
};

/** Rolüne göre kapsamı çıkarır. */
export function staffScopeFor(
  membership: { organizationId: string; role: OrgRole },
  userId: string,
): StaffScope {
  return {
    organizationId: membership.organizationId,
    coachUserId: isAdminRole(membership.role) ? null : userId,
  };
}

/** Salon geneli kapsam — yönetici ekranları ve zamanlanmış işler için. */
export function organizationScope(organizationId: string): StaffScope {
  return { organizationId, coachUserId: null };
}

/** `prisma.member.findMany({ where: memberWhere(scope) })` */
export function memberWhere(
  scope: StaffScope,
  extra?: Prisma.MemberWhereInput,
): Prisma.MemberWhereInput {
  const base: Prisma.MemberWhereInput = { organizationId: scope.organizationId };
  if (scope.coachUserId) base.assignedCoachUserId = scope.coachUserId;
  return extra ? { ...base, ...extra } : base;
}

/** Sporcuya bağlı kayıtlar için: `where: { member: memberFilter(scope) }` */
export function memberFilter(scope: StaffScope): Prisma.MemberWhereInput {
  return memberWhere(scope);
}

/**
 * Ders saatleri için kapsam: antrenör **kendi açtığı** seansları görür.
 *
 * Sporcu kapsamından ayrı bir eksendir. Sporcular ortak tablodan ders seçtiği
 * için bir antrenörün seansına başka antrenörün sporcusu da kaydolabilir;
 * o seansın yoklamasını alan kişi seansı açandır. Bu yüzden yoklama ve
 * katılım isteği ekranları `slotWhere`, sporcu listeleri `memberWhere` kullanır.
 */
export function slotWhere(
  scope: StaffScope,
  extra?: Prisma.TrainingSlotWhereInput,
): Prisma.TrainingSlotWhereInput {
  const base: Prisma.TrainingSlotWhereInput = {
    organizationId: scope.organizationId,
  };
  if (scope.coachUserId) base.coachUserId = scope.coachUserId;
  return extra ? { ...base, ...extra } : base;
}

/** Kapsam salonun tamamını mı görüyor? Ekran metinleri buna göre değişir. */
export function isOrganizationWide(scope: StaffScope): boolean {
  return scope.coachUserId === null;
}
