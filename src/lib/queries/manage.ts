import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeRole } from "@/lib/auth/roles";
import { memberDeleteBlock, staffDeleteBlock } from "@/domain/admin/deletion";

/**
 * SPORCU VE KADRO — düzenle / sil.
 *
 * Silme bilinçli olarak DAR tutuldu: veritabanı zincirleme siler
 * (sporcuyla birlikte tahsilatları, antrenörle birlikte hakedişleri), bu
 * yüzden parayla ilişkili kaydı olan hesap silinmez, kapatılır/pasife alınır
 * (bkz. `src/domain/admin/deletion.ts`). Test hesabı ve hiç işlem görmemiş
 * kayıt sorunsuz silinir; giriş hesabı (`User`) da gider, aynı e-posta yeniden
 * kayıt olabilir.
 */

export type ManageResult =
  | { ok: true; fullName: string }
  | { ok: false; error: string };

// ── Sporcu ────────────────────────────────────────────────────

export const EDITABLE_MEMBER_STATUSES = ["active", "lead", "inactive"] as const;
export type EditableMemberStatus = (typeof EDITABLE_MEMBER_STATUSES)[number];

export type MemberEditInput = {
  fullName: string;
  phone: string | null;
  email: string | null;
  status: EditableMemberStatus;
};

/** "Ali Can Yılmaz" → { firstName: "Ali Can", lastName: "Yılmaz" }; tek kelimede null. */
export function splitFullName(
  fullName: string,
): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export async function updateMemberBasics(
  memberId: string,
  organizationId: string,
  input: MemberEditInput,
): Promise<ManageResult> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: {
      id: true,
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!member) return { ok: false, error: "Sporcu bulunamadı." };

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const emailChanged = email !== (member.email ?? null);

  if (emailChanged && email) {
    const takenByUser = await prisma.user.findFirst({
      where: { email, ...(member.userId ? { NOT: { id: member.userId } } : {}) },
      select: { id: true },
    });
    const takenByMember = await prisma.member.findFirst({
      where: { organizationId, email, NOT: { id: member.id } },
      select: { id: true },
    });
    if (takenByUser || takenByMember) {
      return { ok: false, error: "Bu e-posta başka bir hesapta kullanılıyor." };
    }
  }

  // Kayıt formundan gelmiş sporcuda ayrık ad/soyad da tutuluyor (reklam
  // eşleşmesi kullanır); ad değişince onlar da uyumlu kalsın.
  const split =
    member.firstName || member.lastName ? splitFullName(fullName) : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: member.id },
        data: {
          fullName,
          phone: input.phone,
          email,
          status: input.status,
          ...(split ? { firstName: split.firstName, lastName: split.lastName } : {}),
        },
      });

      if (member.userId) {
        // Giriş adresi ve panelde görünen ad hesapla birlikte güncellenir.
        if (emailChanged && email) {
          await tx.user.update({ where: { id: member.userId }, data: { email } });
        }
        await tx.profile.updateMany({
          where: { userId: member.userId },
          data: { displayName: fullName },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Bu e-posta başka bir hesapta kullanılıyor." };
    }
    console.error("[yonetim] sporcu düzenlenemedi", error);
    return { ok: false, error: "Kaydedilemedi, tekrar dene." };
  }

  return { ok: true, fullName };
}

export async function deleteMember(
  memberId: string,
  organizationId: string,
): Promise<ManageResult> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true, fullName: true, userId: true },
  });
  if (!member) return { ok: false, error: "Sporcu bulunamadı." };

  const paymentCount = await prisma.payment.count({ where: { memberId } });
  const blocked = memberDeleteBlock({ paymentCount });
  if (blocked) return { ok: false, error: blocked };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.member.delete({ where: { id: member.id } });

      if (member.userId) {
        // Aynı hesap ayrıca antrenör/yöneticiyse giriş hesabına dokunulmaz —
        // yalnız sporcu kaydı gider.
        const staffRole = await tx.organizationUser.findFirst({
          where: { userId: member.userId, role: { in: ["coach", "admin", "staff"] } },
          select: { id: true },
        });
        if (!staffRole) {
          await tx.user.delete({ where: { id: member.userId } });
        }
      }
    });
  } catch (error) {
    console.error("[yonetim] sporcu silinemedi", error);
    return { ok: false, error: "Silinemedi, tekrar dene." };
  }

  return { ok: true, fullName: member.fullName };
}

// ── Kadro ─────────────────────────────────────────────────────

export type StaffEditInput = { fullName: string; email: string };

export async function updateStaffProfile(
  organizationUserId: string,
  organizationId: string,
  input: StaffEditInput,
): Promise<ManageResult> {
  const target = await prisma.organizationUser.findFirst({
    where: { id: organizationUserId, organizationId },
    select: {
      role: true,
      userId: true,
      user: { select: { email: true } },
    },
  });
  if (!target || normalizeRole(target.role) === "member") {
    return { ok: false, error: "Kadro kaydı bulunamadı." };
  }

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();

  if (email !== target.user.email) {
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: target.userId } },
      select: { id: true },
    });
    if (taken) {
      return { ok: false, error: "Bu e-posta başka bir hesapta kullanılıyor." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (email !== target.user.email) {
        await tx.user.update({ where: { id: target.userId }, data: { email } });
      }
      await tx.profile.upsert({
        where: { userId: target.userId },
        update: { displayName: fullName },
        create: { userId: target.userId, displayName: fullName },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "Bu e-posta başka bir hesapta kullanılıyor." };
    }
    console.error("[yonetim] personel düzenlenemedi", error);
    return { ok: false, error: "Kaydedilemedi, tekrar dene." };
  }

  return { ok: true, fullName };
}

export async function deleteStaff(
  organizationUserId: string,
  organizationId: string,
  actorUserId: string,
): Promise<ManageResult> {
  const target = await prisma.organizationUser.findFirst({
    where: { id: organizationUserId, organizationId },
    select: {
      role: true,
      status: true,
      userId: true,
      user: { select: { profile: { select: { displayName: true } }, email: true } },
    },
  });
  if (!target || normalizeRole(target.role) === "member") {
    return { ok: false, error: "Kadro kaydı bulunamadı." };
  }

  const role = normalizeRole(target.role);
  const activeAdmins =
    role === "admin" && target.status === "active"
      ? await prisma.organizationUser.count({
          where: { organizationId, role: "admin", status: "active" },
        })
      : 0;

  const [slotsWithBookings, earningCount, payoutCount] = await Promise.all([
    prisma.trainingSlot.count({
      where: {
        organizationId,
        coachUserId: target.userId,
        bookings: { some: {} },
      },
    }),
    prisma.coachEarning.count({ where: { coachUserId: target.userId } }),
    prisma.coachPayout.count({ where: { coachUserId: target.userId } }),
  ]);

  const blocked = staffDeleteBlock({
    isSelf: target.userId === actorUserId,
    isLastActiveAdmin: role === "admin" && target.status === "active" && activeAdmins <= 1,
    slotsWithBookings,
    earningCount,
    payoutCount,
  });
  if (blocked) return { ok: false, error: blocked };

  const fullName = target.user.profile?.displayName ?? target.user.email;

  try {
    await prisma.$transaction(async (tx) => {
      // Kimsenin yer tutmadığı açık saatleri sahipsiz bırakma; sporcusu olan
      // seans zaten yukarıda engelledi.
      await tx.trainingSlot.deleteMany({
        where: { organizationId, coachUserId: target.userId, bookings: { none: {} } },
      });
      // Atanmış sporcular antrenörsüz kalır (SET NULL) ve havuza düşer;
      // giriş hesabıyla birlikte profil ve salon üyeliği de zincirleme gider.
      await tx.user.delete({ where: { id: target.userId } });
    });
  } catch (error) {
    console.error("[yonetim] personel silinemedi", error);
    return { ok: false, error: "Silinemedi, tekrar dene." };
  }

  return { ok: true, fullName };
}
