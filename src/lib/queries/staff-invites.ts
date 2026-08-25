import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { normalizeRole, type OrgRole } from "@/lib/auth/roles";
import {
  generateToken,
  hashToken,
  inviteExpiry,
  inviteUrl,
  type InviteLink,
} from "@/lib/queries/invite-token";

/**
 * PERSONEL DAVETİ — yönetici kadroya çağırır, gelen kendi şifresini kurar.
 *
 * Eski akışta yönetici geçici bir şifre yazıyor ve antrenöre iletiyordu;
 * şifre iki kişinin telefonunda dolaşıyor, çoğu zaman hiç değiştirilmiyordu.
 * Sporcu tarafındaki davet deseni (`invites.ts`) buraya da taşındı:
 *
 *   1. Yönetici ad/e-posta/rol yazar → `StaffInvite` satırı + bağlantı
 *   2. Bağlantı kişiye iletilir (`/davet/<token>`)
 *   3. Kişi şifresini belirler → `User` + `OrganizationUser` birlikte doğar
 *
 * Sporcudan farkı: davet kabul edilene kadar ortada hesap da kayıt da yok.
 * Yarım kalmış davet yalnız bu tabloda durur, kadroyu kirletmez.
 */

export type StaffInviteRole = Exclude<OrgRole, "member">;

/** `normalizeRole` tanımadığı değeri `member` yapar; kadroda karşılığı yok. */
function toStaffRole(raw: string): StaffInviteRole {
  const role = normalizeRole(raw);
  return role === "member" ? "coach" : role;
}

async function issueStaffInvite(
  inviteId: string,
  createdByUserId: string | null,
): Promise<InviteLink> {
  const token = generateToken();
  const expiresAt = inviteExpiry();

  await prisma.staffInvite.update({
    where: { id: inviteId },
    data: {
      tokenHash: hashToken(token),
      expiresAt,
      status: "bekliyor",
      usedAt: null,
      createdByUserId,
    },
  });

  return { token, expiresAt, url: await inviteUrl(token) };
}

export type CreateStaffInviteInput = {
  fullName: string;
  email: string;
  role: StaffInviteRole;
};

export type CreateStaffInviteResult =
  | { ok: true; inviteId: string; invite: InviteLink }
  | { ok: false; error: string };

/**
 * Kadroya davet çıkarır. Hesap AÇILMAZ — kişi bağlantıyı kullanana kadar
 * `User` satırı yoktur, dolayısıyla kimse onun adına giriş yapamaz.
 *
 * Aynı e-postaya ikinci davet çıkarılırsa eskisi tazelenir: iki bağlantı
 * dolaşımda kalmasın, yönetici de "zaten davet etmiştim" duvarına toslamasın.
 */
export async function createStaffInvite(
  organizationId: string,
  input: CreateStaffInviteInput,
  createdByUserId: string,
): Promise<CreateStaffInviteResult> {
  const email = input.email.toLowerCase().trim();
  const fullName = input.fullName.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return {
      ok: false,
      error:
        "Bu e-postayla bir hesap zaten var. Kadro listesinden rolünü değiştirebilirsin.",
    };
  }

  const pending = await prisma.staffInvite.findFirst({
    where: { organizationId, email, status: "bekliyor" },
    select: { id: true },
  });

  const invite = pending
    ? await prisma.staffInvite.update({
        where: { id: pending.id },
        data: { fullName, role: input.role },
        select: { id: true },
      })
    : await prisma.staffInvite.create({
        data: {
          organizationId,
          email,
          fullName,
          role: input.role,
          // Gerçek özet hemen ardından `issueStaffInvite` ile yazılır;
          // `tokenHash` benzersiz olduğundan geçici bir değer gerekiyor.
          tokenHash: `beklemede:${generateToken()}`,
          expiresAt: inviteExpiry(),
          createdByUserId,
        },
        select: { id: true },
      });

  return {
    ok: true,
    inviteId: invite.id,
    invite: await issueStaffInvite(invite.id, createdByUserId),
  };
}

export type ReissueStaffInviteResult =
  | { ok: true; invite: InviteLink; fullName: string }
  | { ok: false; error: string };

/** Bağlantı kaybolduysa/süresi dolduysa yenisini üretir, eskisini geçersizler. */
export async function reissueStaffInvite(
  inviteId: string,
  organizationId: string,
  createdByUserId: string,
): Promise<ReissueStaffInviteResult> {
  const invite = await prisma.staffInvite.findFirst({
    where: { id: inviteId, organizationId },
    select: { id: true, status: true, fullName: true },
  });
  if (!invite) return { ok: false, error: "Davet bulunamadı." };
  if (invite.status === "kullanildi") {
    return { ok: false, error: "Bu davet kullanılmış; hesap zaten kurulmuş." };
  }

  return {
    ok: true,
    fullName: invite.fullName,
    invite: await issueStaffInvite(invite.id, createdByUserId),
  };
}

/** Daveti iptal eder — bağlantı o an ölür. */
export async function revokeStaffInvite(
  inviteId: string,
  organizationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await prisma.staffInvite.updateMany({
    where: { id: inviteId, organizationId, status: "bekliyor" },
    data: { status: "iptal" },
  });
  if (result.count === 0) {
    return { ok: false, error: "Bekleyen davet bulunamadı." };
  }
  return { ok: true };
}

export type StaffInviteState =
  | {
      ok: true;
      inviteId: string;
      fullName: string;
      email: string;
      role: StaffInviteRole;
      organizationName: string;
    }
  | { ok: false; reason: "gecersiz" | "kullanilmis" | "suresi-doldu" };

/** Davet sayfasının durum kontrolü — hesap açmadan önce. */
export async function readStaffInvite(
  token: string,
): Promise<StaffInviteState> {
  const invite = await prisma.staffInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { name: true } } },
  });

  if (!invite) return { ok: false, reason: "gecersiz" };
  if (invite.status === "kullanildi" || invite.usedAt) {
    return { ok: false, reason: "kullanilmis" };
  }
  if (invite.status === "iptal") return { ok: false, reason: "gecersiz" };
  if (invite.expiresAt < new Date()) {
    return { ok: false, reason: "suresi-doldu" };
  }

  return {
    ok: true,
    inviteId: invite.id,
    fullName: invite.fullName,
    email: invite.email,
    role: toStaffRole(invite.role),
    organizationName: invite.organization.name,
  };
}

export type AcceptStaffInviteResult =
  | { ok: true; userId: string; role: StaffInviteRole; organizationId: string }
  | { ok: false; error: string };

/**
 * Personel şifresini belirler: hesap açılır, salon üyeliği davetteki rolle
 * yazılır, davet kapanır. Tümü tek transaction — yarım kalmış, rolü olmayan
 * bir hesap ortada kalmaz.
 */
export async function acceptStaffInvite(input: {
  token: string;
  password: string;
  fullName: string;
}): Promise<AcceptStaffInviteResult> {
  const invite = await prisma.staffInvite.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      status: true,
      usedAt: true,
      expiresAt: true,
    },
  });

  if (!invite) return { ok: false, error: "Davet bağlantısı geçersiz." };
  if (invite.status !== "bekliyor" || invite.usedAt) {
    return { ok: false, error: "Bu bağlantı daha önce kullanılmış." };
  }
  if (invite.expiresAt < new Date()) {
    return {
      ok: false,
      error: "Bağlantının süresi dolmuş. Yöneticinden yeni bağlantı iste.",
    };
  }

  const email = invite.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return {
      ok: false,
      error: "Bu e-postayla bir hesap zaten var. Giriş yapmayı dene.",
    };
  }

  const role = toStaffRole(invite.role);
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
          organizationId: invite.organizationId,
          userId: user.id,
          role,
          status: "active",
        },
      });

      // Yarışta ikinci istek buraya düşerse `count = 0` gelir ve
      // transaction geri alınır — tek kullanım garantisi burada.
      const closed = await tx.staffInvite.updateMany({
        where: { id: invite.id, status: "bekliyor" },
        data: { status: "kullanildi", usedAt: new Date() },
      });
      if (closed.count === 0) {
        throw new Error("Davet aynı anda başka bir yerde kullanıldı.");
      }

      return user.id;
    });

    return { ok: true, userId, role, organizationId: invite.organizationId };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Hesap açılamadı, tekrar dene.",
    };
  }
}

export type PendingStaffInviteRow = {
  id: string;
  fullName: string;
  email: string;
  role: StaffInviteRole;
  createdAt: Date;
  expiresAt: Date;
  /** Süresi dolmuş davet — yeniden üretilmeli. */
  expired: boolean;
};

/** Hesabını henüz kurmamış personel — yöneticinin takip listesi. */
export async function listPendingStaffInvites(
  organizationId: string,
): Promise<PendingStaffInviteRow[]> {
  const rows = await prisma.staffInvite.findMany({
    where: { organizationId, status: "bekliyor" },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: toStaffRole(row.role),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    expired: row.expiresAt < now,
  }));
}

export async function countPendingStaffInvites(
  organizationId: string,
): Promise<number> {
  return prisma.staffInvite.count({
    where: { organizationId, status: "bekliyor" },
  });
}
