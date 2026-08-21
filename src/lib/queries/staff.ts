import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { getPointsTotal, getBadgeKeys } from "@/lib/queries/performance";

export async function listMembers(organizationId: string) {
  const members = await prisma.member.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    members.map(async (member) => ({
      ...member,
      points: await getPointsTotal(member.id),
    })),
  );
}

export type CreateMemberInput = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
};

export type CreateMemberResult =
  | { ok: true; memberId: string }
  | { ok: false; error: string };

export async function createMemberWithAccount(
  organizationId: string,
  input: CreateMemberInput,
): Promise<CreateMemberResult> {
  const normalizedEmail = input.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    return { ok: false, error: "Bu e-posta zaten kayıtlı." };
  }

  const memberCount = await prisma.member.count({ where: { organizationId } });
  const memberNo = `BB-${String(memberCount + 1).padStart(4, "0")}`;
  const passwordHash = await hashPassword(input.password);

  const member = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        profile: { create: { displayName: input.fullName } },
      },
    });

    await tx.organizationUser.create({
      data: { organizationId, userId: user.id, role: "member", status: "active" },
    });

    return tx.member.create({
      data: {
        organizationId,
        userId: user.id,
        memberNo,
        fullName: input.fullName,
        email: normalizedEmail,
        phone: input.phone,
        status: "active",
      },
    });
  });

  return { ok: true, memberId: member.id };
}

export async function getMemberDetail(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  const [checkIns, trainingLogs, points, badgeKeys] = await Promise.all([
    prisma.checkIn.findMany({
      where: { memberId },
      orderBy: { weekStart: "desc" },
      take: 12,
    }),
    prisma.trainingLog.findMany({
      where: { memberId },
      orderBy: { loggedAt: "desc" },
      take: 20,
    }),
    getPointsTotal(memberId),
    getBadgeKeys(memberId),
  ]);

  return { member, checkIns, trainingLogs, points, badgeKeys };
}

export async function reviewCheckIn(
  checkInId: string,
  reviewedByUserId: string,
): Promise<void> {
  await prisma.checkIn.update({
    where: { id: checkInId },
    data: { status: "reviewed", reviewedAt: new Date(), reviewedByUserId },
  });
}
