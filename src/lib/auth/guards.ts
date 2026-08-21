import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/auth/session";

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
  role: "member" | "staff";
  status: string;
};

export async function requireOrganizationMembership(
  userId: string,
): Promise<OrganizationMembership> {
  const membership = await prisma.organizationUser.findFirst({
    where: { userId, status: "active" },
  });
  if (!membership) {
    throw new AuthError("Organizasyon üyeliği bulunamadı");
  }
  return {
    organizationId: membership.organizationId,
    role: membership.role as "member" | "staff",
    status: membership.status,
  };
}

export async function requireStaff(userId: string): Promise<OrganizationMembership> {
  const membership = await requireOrganizationMembership(userId);
  if (membership.role !== "staff") {
    throw new AuthError("Bu işlem yalnızca personel içindir");
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

/** staff, memberId'nin kendi organizasyonuna ait olduğunu doğrular. */
export async function requireStaffScopeForMember(
  organizationId: string,
  memberId: string,
) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.organizationId !== organizationId) {
    throw new AuthError("Bu üye senin organizasyonuna ait değil");
  }
  return member;
}
