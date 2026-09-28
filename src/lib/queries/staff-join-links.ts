import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { absoluteUrl } from "@/lib/app-url";
import { generateToken, hashToken } from "@/lib/queries/invite-token";
import {
  clampStaffLink,
  normalizeStaffLinkRole,
  type StaffLinkRole,
} from "@/domain/registration/staff-link";

/**
 * KADRO KAYIT BAĞLANTISI — antrenörler tek bağlantıdan kendi hesabını açar.
 *
 * Kişiye özel `StaffInvite` her antrenör için e-posta ister. Kadronun
 * e-postaları elde değilken ya da isimlerin bir kısmı belli değilken, yönetici
 * bu bağlantıyı üretip gruba gönderir; herkes adını, e-postasını ve şifresini
 * kendisi yazar.
 *
 * Bu bir YETKİ kapısıdır (hesap açar, sporcu verisi görür), bu yüzden kayıt
 * linkinden (`MemberJoinLink`) daha sıkıdır:
 *   - adres 43 karakterlik tahmin edilemez anahtar; veritabanında yalnız
 *     SHA-256 özeti durur, yani adres sonradan panelde tekrar gösterilemez
 *     (kaybolursa yenisi üretilir, eskisi kapanır)
 *   - son gün ve kullanım sınırı zorunlu
 *   - iki rol var: antrenör (10 kişi / 14 gün varsayılan) ve yönetici
 *     (1 kişi / 3 gün varsayılan, en fazla 3 kişi / 7 gün). Bağlantıyı yalnız
 *     yönetici üretir; bilinmeyen rol değeri antrenöre iner, yöneticiye çıkmaz.
 */

export async function staffJoinUrl(token: string): Promise<string> {
  return absoluteUrl(`/kadro-kayit/${token}`);
}

export type StaffJoinLinkRow = {
  id: string;
  label: string;
  role: StaffLinkRole;
  isActive: boolean;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdAt: Date;
  /** Kullanılabilir mi — kapalı, süresi dolmuş ya da kontenjanı dolmuş değil mi. */
  usable: boolean;
};

/**
 * Salonun kadro bağlantıları. Tablo henüz yoksa (migration bekliyorsa) `null`
 * döner — yönetim ekranı bölümü "kurulum bekliyor" diye gösterir, sayfa düşmez.
 */
export async function listStaffJoinLinks(
  organizationId: string,
): Promise<StaffJoinLinkRow[] | null> {
  try {
    const rows = await prisma.staffJoinLink.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      take: 20,
    });
    const now = new Date();

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      role: normalizeStaffLinkRole(row.role),
      isActive: row.isActive,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      usable:
        row.isActive && row.expiresAt > now && row.usedCount < row.maxUses,
    }));
  } catch (error) {
    console.error("[kadro-linki] liste okunamadı", error);
    return null;
  }
}

export type CreateStaffJoinLinkResult =
  | { ok: true; id: string; url: string; expiresAt: Date; maxUses: number }
  | { ok: false; error: string };

/**
 * Yeni kadro bağlantısı üretir ve AYNI ROLDEKİ öncekileri KAPATIR: her rolde
 * dolaşımda tek geçerli bağlantı kalsın, kaybolan eski bir adres kapı olarak
 * açık durmasın. Antrenör bağlantısı üretmek yönetici bağlantısını kapatmaz.
 * Kişi ve gün sayısı rolün sınırlarına çekilir (yönetici: en fazla 3 / 7).
 */
export async function createStaffJoinLink(input: {
  organizationId: string;
  label: string;
  role: StaffLinkRole;
  maxUses: number;
  days: number;
  createdByUserId: string;
}): Promise<CreateStaffJoinLinkResult> {
  const role = normalizeStaffLinkRole(input.role);
  const { maxUses, days } = clampStaffLink(role, {
    maxUses: input.maxUses,
    days: input.days,
  });
  const token = generateToken();
  const expiresAt = new Date(Date.now() + days * 24 * 3_600_000);

  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.staffJoinLink.updateMany({
        where: { organizationId: input.organizationId, isActive: true, role },
        data: { isActive: false },
      });
      return tx.staffJoinLink.create({
        data: {
          organizationId: input.organizationId,
          tokenHash: hashToken(token),
          label: input.label.trim(),
          role,
          maxUses,
          expiresAt,
          createdByUserId: input.createdByUserId,
        },
        select: { id: true },
      });
    });

    return {
      ok: true,
      id: row.id,
      url: await staffJoinUrl(token),
      expiresAt,
      maxUses,
    };
  } catch (error) {
    console.error("[kadro-linki] üretilemedi", error);
    return {
      ok: false,
      error:
        "Bağlantı üretilemedi. Veritabanı güncellemesi (migration) uygulanmamış olabilir.",
    };
  }
}

export async function closeStaffJoinLink(
  id: string,
  organizationId: string,
): Promise<boolean> {
  try {
    const result = await prisma.staffJoinLink.updateMany({
      where: { id, organizationId },
      data: { isActive: false },
    });
    return result.count > 0;
  } catch (error) {
    console.error("[kadro-linki] kapatılamadı", error);
    return false;
  }
}

export type StaffJoinState =
  | {
      ok: true;
      linkId: string;
      organizationId: string;
      organizationName: string;
      role: StaffLinkRole;
    }
  | { ok: false; reason: "gecersiz" | "kapali" | "suresi-doldu" | "kota-doldu" };

/** Kayıt sayfasının durum kontrolü — hesap açmadan önce. */
export async function resolveStaffJoinLink(token: string): Promise<StaffJoinState> {
  if (token.length < 20 || token.length > 100) {
    return { ok: false, reason: "gecersiz" };
  }

  try {
    const link = await prisma.staffJoinLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organization: { select: { id: true, name: true, status: true } } },
    });

    if (!link) return { ok: false, reason: "gecersiz" };
    if (!link.isActive || link.organization.status !== "active") {
      return { ok: false, reason: "kapali" };
    }
    if (link.expiresAt <= new Date()) return { ok: false, reason: "suresi-doldu" };
    if (link.usedCount >= link.maxUses) return { ok: false, reason: "kota-doldu" };

    return {
      ok: true,
      linkId: link.id,
      organizationId: link.organization.id,
      organizationName: link.organization.name,
      role: normalizeStaffLinkRole(link.role),
    };
  } catch (error) {
    console.error("[kadro-linki] çözülemedi", error);
    return { ok: false, reason: "gecersiz" };
  }
}

/** Kullanıcıya olduğu gibi gösterilecek, beklenen bir ret. */
class JoinRefusal extends Error {}

export type StaffSelfRegisterResult =
  | { ok: true; userId: string; organizationId: string; role: StaffLinkRole }
  | { ok: false; error: string };

const CLOSED_MESSAGE: Record<string, string> = {
  gecersiz: "Bağlantı geçersiz. Yöneticiden güncel bağlantıyı iste.",
  kapali: "Bu bağlantı kapatılmış. Yöneticiden yenisini iste.",
  "suresi-doldu": "Bağlantının süresi dolmuş. Yöneticiden yenisini iste.",
  "kota-doldu": "Bu bağlantının kontenjanı dolmuş. Yöneticiden yenisini iste.",
};

/**
 * Antrenör hesabı açar: `User` + `Profile` + `OrganizationUser(coach)` tek
 * transaction'da doğar, bağlantının sayacı artar.
 *
 * Kontenjan yarışı: iki kişi son hakka aynı anda basarsa ikisi de "hak var"
 * görür. Sayaç, OKUNAN değere koşullu güncellenir; ikincisinin güncellemesi
 * 0 satır etkiler ve transaction geri alınır.
 */
export async function registerStaffViaLink(input: {
  token: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<StaffSelfRegisterResult> {
  const state = await resolveStaffJoinLink(input.token);
  if (!state.ok) return { ok: false, error: CLOSED_MESSAGE[state.reason] };

  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "Bu e-postayla bir hesap zaten var. Giriş yapmayı dene.",
    };
  }

  const passwordHash = await hashPassword(input.password);
  const fullName = input.fullName.trim();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const fresh = await tx.staffJoinLink.findUnique({
        where: { id: state.linkId },
        select: {
          usedCount: true,
          maxUses: true,
          isActive: true,
          expiresAt: true,
          role: true,
        },
      });
      if (
        !fresh ||
        !fresh.isActive ||
        fresh.expiresAt <= new Date() ||
        fresh.usedCount >= fresh.maxUses
      ) {
        throw new JoinRefusal("Bu bağlantı artık kullanılamıyor.");
      }

      const claimed = await tx.staffJoinLink.updateMany({
        where: { id: state.linkId, usedCount: fresh.usedCount, isActive: true },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count === 0) {
        throw new JoinRefusal(
          "Bağlantı aynı anda başka biri tarafından kullanıldı, tekrar dene.",
        );
      }

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          profile: { create: { displayName: fullName } },
        },
        select: { id: true },
      });

      // Rol bağlantının kendisinden, işlem içinde okunan değerden gelir; formdan
      // rol alınmaz. Tanınmayan değer antrenöre iner.
      const role = normalizeStaffLinkRole(fresh.role);
      await tx.organizationUser.create({
        data: {
          organizationId: state.organizationId,
          userId: user.id,
          role,
          status: "active",
        },
      });

      return { id: user.id, role };
    });

    return {
      ok: true,
      userId: created.id,
      organizationId: state.organizationId,
      role: created.role,
    };
  } catch (error) {
    if (error instanceof JoinRefusal) return { ok: false, error: error.message };
    // Aynı e-posta iki istekle aynı anda gelirse ikincisi benzersizlik kısıtına çarpar.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Bu e-postayla bir hesap açılmış. Giriş yapmayı dene.",
      };
    }
    console.error("[kadro-linki] hesap açılamadı", error);
    return { ok: false, error: "Hesap açılamadı, tekrar dene." };
  }
}
