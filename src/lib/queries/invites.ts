import "server-only";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { memberWhere, type StaffScope } from "@/lib/auth/scope";
import {
  generateToken,
  hashToken,
  inviteExpiry,
  inviteUrl,
  type InviteLink,
} from "@/lib/queries/invite-token";

/**
 * DAVET AKIŞI — antrenör ekler, sporcu kendi şifresini kurar.
 *
 * Eski akışta personel geçici bir şifre yazıyor ve sporcuya WhatsApp'tan
 * gönderiyordu; şifre iki kişinin telefonunda dolaşıyordu. Yeni akış Kong
 * Academy'nin `invite_tokens` deseni:
 *
 *   1. Antrenör sporcuyu ekler → hesapsız `Member` + tek kullanımlık davet
 *   2. Bağlantı sporcuya iletilir (`/davet/<token>`)
 *   3. Sporcu kendi şifresini belirler → `User` açılır, `Member.userId` bağlanır
 *
 * Güvenlik: token veritabanında AÇIK durmaz, yalnız SHA-256 özeti saklanır.
 * Bağlantı bir kez üretilir; kaybolursa yenisi çıkarılır ve eskisi iptal olur.
 * Süre 72 saat — Kong'la aynı, sporcuyu aynı hafta içinde harekete geçirir.
 *
 * Anahtar üretimi/özeti ve tam adres `invite-token.ts`te; aynı altyapıyı
 * personel daveti de (`staff-invites.ts`) kullanır.
 */

async function issueInvite(
  memberId: string,
  email: string,
  createdByUserId: string | null,
  tx: Pick<typeof prisma, "memberInvite"> = prisma,
): Promise<InviteLink> {
  const token = generateToken();
  const expiresAt = inviteExpiry();

  // Eski davetler geçersiz: iki bağlantı dolaşımda kalmasın.
  await tx.memberInvite.updateMany({
    where: { memberId, status: "bekliyor" },
    data: { status: "iptal" },
  });

  await tx.memberInvite.create({
    data: {
      memberId,
      tokenHash: hashToken(token),
      email: email.toLowerCase(),
      expiresAt,
      createdByUserId,
    },
  });

  return { token, expiresAt, url: await inviteUrl(token) };
}

export type CreateMemberInviteInput = {
  fullName: string;
  email: string;
  phone?: string;
  /** Aday (deneme dersi) olarak eklenirse `lead`. */
  status?: "active" | "lead";
  /**
   * Sorumlu antrenör. Boş bırakılırsa sporcuyu **ekleyen** kişi atanır —
   * antrenör kendi eklediği sporcuyu panelinde göremezse iş görmez.
   * Yönetici ekliyorsa başka bir antrenör seçebilir.
   */
  assignedCoachUserId?: string | null;
};

export type CreateMemberInviteResult =
  | { ok: true; memberId: string; invite: InviteLink }
  | { ok: false; error: string };

/**
 * Sporcuyu ekler ve davet bağlantısını üretir. Hesap AÇILMAZ — sporcu
 * bağlantıyı kullanana kadar `Member.userId` boş kalır.
 */
export async function createMemberWithInvite(
  organizationId: string,
  input: CreateMemberInviteInput,
  createdByUserId: string,
): Promise<CreateMemberInviteResult> {
  const email = input.email.toLowerCase().trim();

  const [existingUser, existingMember] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.member.findFirst({
      where: { organizationId, email },
      select: { id: true },
    }),
  ]);

  if (existingUser) return { ok: false, error: "Bu e-posta zaten kayıtlı." };
  if (existingMember) {
    return { ok: false, error: "Bu e-postayla bir sporcu kaydı zaten var." };
  }

  const memberCount = await prisma.member.count({ where: { organizationId } });
  const memberNo = `BB-${String(memberCount + 1).padStart(4, "0")}`;

  const member = await prisma.member.create({
    data: {
      organizationId,
      memberNo,
      fullName: input.fullName.trim(),
      email,
      phone: input.phone?.trim() || null,
      status: input.status ?? "active",
      assignedCoachUserId:
        input.assignedCoachUserId === undefined
          ? createdByUserId
          : input.assignedCoachUserId,
    },
  });

  const invite = await issueInvite(member.id, email, createdByUserId);
  return { ok: true, memberId: member.id, invite };
}

export type ReissueResult =
  | { ok: true; invite: InviteLink }
  | { ok: false; error: string };

/** Bağlantı kaybolduysa/süresi dolduysa yenisini üretir. */
export async function reissueInvite(
  memberId: string,
  organizationId: string,
  createdByUserId: string,
): Promise<ReissueResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, organizationId: true, userId: true, email: true },
  });

  if (!member || member.organizationId !== organizationId) {
    return { ok: false, error: "Sporcu bulunamadı." };
  }
  if (member.userId) {
    return { ok: false, error: "Bu sporcu hesabını zaten kurmuş." };
  }
  if (!member.email) {
    return { ok: false, error: "Sporcunun e-postası kayıtlı değil." };
  }

  return { ok: true, invite: await issueInvite(member.id, member.email, createdByUserId) };
}

export type InviteState =
  | { ok: true; memberId: string; fullName: string; email: string }
  | { ok: false; reason: "gecersiz" | "kullanilmis" | "suresi-doldu" };

/** Davet sayfasının durum kontrolü — hesap açmadan önce. */
export async function readInvite(token: string): Promise<InviteState> {
  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      member: { select: { id: true, fullName: true, email: true, userId: true } },
    },
  });

  if (!invite) return { ok: false, reason: "gecersiz" };
  if (invite.status === "kullanildi" || invite.usedAt || invite.member.userId) {
    return { ok: false, reason: "kullanilmis" };
  }
  if (invite.status === "iptal") return { ok: false, reason: "gecersiz" };
  if (invite.expiresAt < new Date()) return { ok: false, reason: "suresi-doldu" };

  return {
    ok: true,
    memberId: invite.member.id,
    fullName: invite.member.fullName,
    email: invite.email,
  };
}

export type AcceptInviteResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * Sporcu şifresini belirler: hesap açılır, salon üyeliği `member` rolüyle
 * yazılır, davet kapanır. Tümü tek transaction — yarım kalmış hesap olmaz.
 */
export async function acceptInvite(input: {
  token: string;
  password: string;
  fullName: string;
}): Promise<AcceptInviteResult> {
  const tokenHash = hashToken(input.token);

  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash },
    include: {
      member: {
        select: {
          id: true,
          organizationId: true,
          userId: true,
          email: true,
        },
      },
    },
  });

  if (!invite) return { ok: false, error: "Davet bağlantısı geçersiz." };
  if (invite.status !== "bekliyor" || invite.usedAt) {
    return { ok: false, error: "Bu bağlantı daha önce kullanılmış." };
  }
  if (invite.expiresAt < new Date()) {
    return { ok: false, error: "Bağlantının süresi dolmuş. Antrenöründen yeni bağlantı iste." };
  }
  if (invite.member.userId) {
    return { ok: false, error: "Bu sporcunun hesabı zaten kurulmuş." };
  }

  const email = invite.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return { ok: false, error: "Bu e-postayla bir hesap zaten var. Giriş yapmayı dene." };
  }

  const fullName = input.fullName.trim();
  const passwordHash = await hashPassword(input.password);

  try {
    const userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          profile: { create: { displayName: fullName } },
        },
      });

      await tx.organizationUser.create({
        data: {
          organizationId: invite.member.organizationId,
          userId: user.id,
          role: "member",
          status: "active",
        },
      });

      await tx.member.update({
        where: { id: invite.member.id },
        data: { userId: user.id, fullName, email },
      });

      // Yarışta ikinci istek buraya düşerse `count = 0` gelir ve
      // transaction geri alınır — tek kullanım garantisi burada.
      const closed = await tx.memberInvite.updateMany({
        where: { id: invite.id, status: "bekliyor" },
        data: { status: "kullanildi", usedAt: new Date() },
      });
      if (closed.count === 0) {
        throw new Error("Davet aynı anda başka bir yerde kullanıldı.");
      }

      return user.id;
    });

    return { ok: true, userId };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Hesap açılamadı, tekrar dene.",
    };
  }
}

export type PendingInviteRow = {
  memberId: string;
  memberNo: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  invitedAt: Date | null;
  expiresAt: Date | null;
  /** Süresi dolmuş davet — yeniden üretilmeli. */
  expired: boolean;
  /** Hiç davet üretilmemiş (ör. eski kayıt). */
  neverInvited: boolean;
};

/** Hesabını henüz kurmamış sporcular — antrenörün takip listesi. */
export async function listPendingInvites(
  scope: StaffScope,
): Promise<PendingInviteRow[]> {
  const members = await prisma.member.findMany({
    where: memberWhere(scope, { userId: null }),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      memberNo: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      invites: {
        where: { status: "bekliyor" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, expiresAt: true },
      },
    },
  });

  const now = new Date();

  return members.map((member) => {
    const invite = member.invites[0] ?? null;
    return {
      memberId: member.id,
      memberNo: member.memberNo,
      fullName: member.fullName,
      email: member.email ?? "",
      phone: member.phone,
      status: member.status,
      invitedAt: invite?.createdAt ?? null,
      expiresAt: invite?.expiresAt ?? null,
      expired: invite ? invite.expiresAt < now : false,
      neverInvited: invite === null,
    };
  });
}

export async function countPendingInvites(scope: StaffScope): Promise<number> {
  return prisma.member.count({ where: memberWhere(scope, { userId: null }) });
}

/** Token karşılaştırması — sabit zamanlı, log'a token düşmesin diye ayrı. */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(hashToken(a), "hex");
  const right = Buffer.from(hashToken(b), "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
