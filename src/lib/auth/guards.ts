import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import {
  isAdminRole,
  isStaffRole,
  normalizeRole,
  type OrgRole,
} from "@/lib/auth/roles";
import { staffScopeFor, type StaffScope } from "@/lib/auth/scope";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { profile: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.profile?.displayName ?? user.email,
  };
});

/** Oturum açmamışsa AuthError fırlatır. Sayfa seviyesinde yönlendirme
 * middleware'in işi; bu yalnız server action/route handler'lar için
 * ikinci bir güvenlik katmanıdır. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Oturum açılmamış");
  return user;
}

export type OrganizationMembership = {
  organizationId: string;
  role: OrgRole;
  status: string;
};

export const getOrganizationMembership = cache(
  async (userId: string): Promise<OrganizationMembership | null> => {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId, status: "active" },
    });
    if (!membership) return null;
    return {
      organizationId: membership.organizationId,
      role: normalizeRole(membership.role),
      status: membership.status,
    };
  },
);

export async function requireOrganizationMembership(
  userId: string,
): Promise<OrganizationMembership> {
  const membership = await getOrganizationMembership(userId);
  if (!membership) {
    throw new AuthError("Organizasyon üyeliği bulunamadı");
  }
  return membership;
}

/** Antrenör paneli yetkisi — yönetici de dahildir. */
export async function requireStaff(userId: string): Promise<OrganizationMembership> {
  const membership = await requireOrganizationMembership(userId);
  if (!isStaffRole(membership.role)) {
    throw new AuthError("Bu işlem yalnızca personel içindir");
  }
  return membership;
}

/** Yalnız yönetici — paket tanımı, antrenör kadrosu, salon ayarları. */
export async function requireAdmin(userId: string): Promise<OrganizationMembership> {
  const membership = await requireOrganizationMembership(userId);
  if (!isAdminRole(membership.role)) {
    throw new AuthError("Bu işlem yalnızca yönetici içindir");
  }
  return membership;
}

export const getCurrentMember = cache(async (userId: string) => {
  return prisma.member.findUnique({ where: { userId } });
});

export async function requireMemberSelf(userId: string, memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.userId !== userId) {
    throw new AuthError("Bu üyeye erişim yetkin yok");
  }
  return member;
}

/**
 * Personel, `memberId`'nin **kapsamında** olduğunu doğrular: yönetici için
 * "aynı salon", antrenör için "benim sporcum".
 *
 * Eski `requireStaffScopeForMember` yalnız salon kontrolü yapıyordu; antrenör
 * başkasının sporcusuna yazabiliyordu. Yerini bu aldı.
 */
export async function requireMemberInScope(scope: StaffScope, memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.organizationId !== scope.organizationId) {
    throw new AuthError("Bu üye senin organizasyonuna ait değil");
  }
  if (scope.coachUserId && member.assignedCoachUserId !== scope.coachUserId) {
    throw new AuthError("Bu sporcu senin sorumluluğunda değil");
  }
  return member;
}

/**
 * Oturum + personel yetkisi + görünürlük kapsamı — antrenör ekranlarının
 * açılış satırı. Yönetici çağırırsa kapsam salonun tamamıdır.
 */
export async function requireStaffScope(
  userId: string,
): Promise<{ membership: OrganizationMembership; scope: StaffScope }> {
  const membership = await requireStaff(userId);
  return { membership, scope: staffScopeFor(membership, userId) };
}
