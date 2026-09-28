import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { absoluteUrl } from "@/lib/app-url";
import type { RegistrationAnswers } from "@/domain/registration/answers";

/**
 * KAYIT LİNKİ — tek bağlantı, sporcu kendi kaydolur.
 *
 * Eski akış: personel her sporcuyu tek tek ekliyor, her biri için tek
 * kullanımlık davet bağlantısı üretip WhatsApp'tan gönderiyordu. Yirmi kişilik
 * bir grupta yirmi kez aynı işi yapmak demekti.
 *
 * Yeni akış: salon bir kere `/katil/<slug>` bağlantısı üretir — Instagram
 * biyografisine, WhatsApp durumuna, resepsiyondaki QR koda konur. Gelen kişi
 * kendi bilgilerini yazar, şifresini kendi kurar, hesabı anında açılır.
 *
 * Kişiye özel davetten (`invites.ts`) farkları:
 *   - çok kullanımlıdır, sır değildir → güvenlik `isActive`/`expiresAt`/`maxUses`
 *   - kaydı **sporcu** açar → `Member` ile `User` aynı anda doğar
 *   - kanal ölçülür → `Member.joinLinkId` hangi linkten geldiğini tutar
 *
 * Kötüye kullanım: link herkese açıktır, yani sahte kayıt açılabilir. Bunun
 * karşılığı silme ya da elle onay değil, **hak**: kayıt olan varsayılan olarak
 * doğrudan üye açılır (kimse tek tek onaylamakla uğraşmaz) ama ders hakkı
 * yalnız personelin tanımladığı pakette vardır — paketi olmayan kayıt ders
 * rezerve edemez. Bir link "aday" olarak da açılabilir (`defaultStatus`).
 */

const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

/** "Resepsiyon QR" → "resepsiyon-qr" */
export function slugifyLabel(label: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };

  return label
    .trim()
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (char) => map[char] ?? char)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export async function joinUrl(slug: string): Promise<string> {
  return absoluteUrl(`/katil/${slug}`);
}

// ── Yönetim tarafı ────────────────────────────────────────────

export type JoinLinkRow = {
  id: string;
  slug: string;
  label: string;
  isActive: boolean;
  defaultCoachUserId: string | null;
  defaultCoachName: string | null;
  defaultStatus: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  /** Bu linkten gelip hâlâ kayıtlı olan sporcu sayısı. */
  memberCount: number;
  /** Kullanılabilir mi — kapalı, süresi dolmuş ya da kota dolmuş değil mi. */
  usable: boolean;
  url: string;
};

export async function listJoinLinks(
  organizationId: string,
): Promise<JoinLinkRow[]> {
  const rows = await prisma.memberJoinLink.findMany({
    where: { organizationId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { members: true } } },
  });

  const coachIds = [
    ...new Set(
      rows
        .map((row) => row.defaultCoachUserId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const coaches = coachIds.length
    ? await prisma.profile.findMany({
        where: { userId: { in: coachIds } },
        select: { userId: true, displayName: true },
      })
    : [];
  const coachName = new Map(coaches.map((row) => [row.userId, row.displayName]));

  const now = new Date();

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      slug: row.slug,
      label: row.label,
      isActive: row.isActive,
      defaultCoachUserId: row.defaultCoachUserId,
      defaultCoachName: row.defaultCoachUserId
        ? (coachName.get(row.defaultCoachUserId) ?? null)
        : null,
      defaultStatus: row.defaultStatus,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      memberCount: row._count.members,
      usable:
        row.isActive &&
        (row.expiresAt === null || row.expiresAt > now) &&
        (row.maxUses === null || row.usedCount < row.maxUses),
      url: await joinUrl(row.slug),
    })),
  );
}

export type SaveJoinLinkInput = {
  organizationId: string;
  label: string;
  slug?: string;
  defaultCoachUserId?: string | null;
  defaultStatus: "lead" | "active";
  maxUses?: number | null;
  expiresAt?: Date | null;
  createdByUserId: string;
};

export type SaveJoinLinkResult =
  | { ok: true; id: string; slug: string; url: string }
  | { ok: false; error: string };

export async function createJoinLink(
  input: SaveJoinLinkInput,
): Promise<SaveJoinLinkResult> {
  const base = input.slug?.trim() ? slugifyLabel(input.slug) : slugifyLabel(input.label);
  if (!isValidSlug(base)) {
    return {
      ok: false,
      error: "Bağlantı adı en az 3 karakter olmalı; harf, rakam ve tire kullan.",
    };
  }

  // Aynı ad başka salonda da olabileceği için slug GLOBAL benzersizdir:
  // çakışırsa sonuna sayı eklenir, kullanıcıya hata göstermeye gerek yok.
  let slug = base;
  for (let attempt = 2; attempt <= 30; attempt += 1) {
    const taken = await prisma.memberJoinLink.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) break;
    slug = `${base}-${attempt}`;
  }

  const row = await prisma.memberJoinLink.create({
    data: {
      organizationId: input.organizationId,
      slug,
      label: input.label.trim(),
      defaultCoachUserId: input.defaultCoachUserId ?? null,
      defaultStatus: input.defaultStatus,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresAt ?? null,
      createdByUserId: input.createdByUserId,
    },
    select: { id: true, slug: true },
  });

  return { ok: true, id: row.id, slug: row.slug, url: await joinUrl(row.slug) };
}

/** Panel ilk açıldığında kendiliğinden üretilen bağlantının adı. */
export const DEFAULT_JOIN_LINK_LABEL = "Genel kayıt bağlantısı";

/**
 * Salonun hiç kayıt bağlantısı yoksa bir tane üretir — "önce link üret" adımı
 * da elle iş olmasın. Var olan bağlantıya dokunmaz; iki ekran aynı anda
 * açılırsa oluşan ikinci bağlantı zararsızdır (yönetici birini kapatır).
 * Üretildiyse bağlantıyı döndürür.
 */
export async function ensureDefaultJoinLink(input: {
  organizationId: string;
  createdByUserId: string;
}): Promise<SaveJoinLinkResult | null> {
  const existing = await prisma.memberJoinLink.count({
    where: { organizationId: input.organizationId },
  });
  if (existing > 0) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { name: true },
  });

  try {
    return await createJoinLink({
      organizationId: input.organizationId,
      label: DEFAULT_JOIN_LINK_LABEL,
      slug: organization ? `${organization.name} kayit` : undefined,
      defaultStatus: "active",
      createdByUserId: input.createdByUserId,
    });
  } catch {
    // Aynı anda başka bir istek üretmiş olabilir; ekran zaten listeyi okuyacak.
    return null;
  }
}

export async function setJoinLinkActive(
  id: string,
  organizationId: string,
  isActive: boolean,
): Promise<boolean> {
  const result = await prisma.memberJoinLink.updateMany({
    where: { id, organizationId },
    data: { isActive },
  });
  return result.count > 0;
}

export async function updateJoinLinkDefaults(
  id: string,
  organizationId: string,
  data: {
    defaultCoachUserId?: string | null;
    defaultStatus?: "lead" | "active";
    maxUses?: number | null;
    expiresAt?: Date | null;
  },
): Promise<boolean> {
  const result = await prisma.memberJoinLink.updateMany({
    where: { id, organizationId },
    data,
  });
  return result.count > 0;
}

// ── Genel erişim (kayıt sayfası) ──────────────────────────────

export type JoinLinkState =
  | {
      ok: true;
      linkId: string;
      slug: string;
      organizationId: string;
      organizationName: string;
      defaultStatus: string;
    }
  | { ok: false; reason: "gecersiz" | "kapali" | "suresi-doldu" | "kota-doldu" };

/**
 * Kayıt sayfasının durum kontrolü. Bilinçli olarak salon adından fazlasını
 * döndürmez: bağlantı herkese açıktır, kimin üye olduğu ya da kaç kişi olduğu
 * dışarıya sızmamalı.
 */
export async function resolveJoinLink(slug: string): Promise<JoinLinkState> {
  if (!isValidSlug(slug)) return { ok: false, reason: "gecersiz" };

  const link = await prisma.memberJoinLink.findUnique({
    where: { slug },
    include: { organization: { select: { id: true, name: true, status: true } } },
  });

  if (!link) return { ok: false, reason: "gecersiz" };
  if (!link.isActive || link.organization.status !== "active") {
    return { ok: false, reason: "kapali" };
  }
  if (link.expiresAt && link.expiresAt <= new Date()) {
    return { ok: false, reason: "suresi-doldu" };
  }
  if (link.maxUses !== null && link.usedCount >= link.maxUses) {
    return { ok: false, reason: "kota-doldu" };
  }

  return {
    ok: true,
    linkId: link.id,
    slug: link.slug,
    organizationId: link.organization.id,
    organizationName: link.organization.name,
    defaultStatus: link.defaultStatus,
  };
}

export type SelfRegisterInput = {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  birthDate: Date;
  gender?: string | null;
  district?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  healthNote?: string | null;
  marketingConsent: boolean;
  /** Meslek, günlük yoğunluk, antrenman saati tercihi. */
  answers: RegistrationAnswers;
  /** Formda seçilen antrenör; boş = "fark etmez". Geçerliliği burada denetlenir. */
  chosenCoachUserId?: string | null;
};

export type SelfRegisterResult =
  | {
      ok: true;
      userId: string;
      memberId: string;
      organizationId: string;
      fullName: string;
      /** Yanıtlar tabloya yazıldı mı. Yazılamadıysa çağıran denetim kaydına düşer. */
      answersSaved: boolean;
      /** Sporcunun seçtiği ve geçerli bulunan antrenör (yoksa null). */
      chosenCoachUserId: string | null;
    }
  | { ok: false; error: string };

/** "BB-0007" → 7; biçimi bozuksa 0 (yeni numara en büyükten devam eder). */
function memberNoIndex(memberNo: string): number {
  const match = /(\d+)$/.exec(memberNo);
  return match ? Number(match[1]) : 0;
}

async function nextMemberNo(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<string> {
  // Sayma yerine EN BÜYÜK numarayı okur: silinen bir kayıttan sonra `count+1`
  // var olan bir numarayı üretir ve benzersizlik kısıtına çarpar.
  const rows = await tx.member.findMany({
    where: { organizationId },
    select: { memberNo: true },
  });
  const highest = rows.reduce(
    (max, row) => Math.max(max, memberNoIndex(row.memberNo)),
    0,
  );
  return `BB-${String(highest + 1).padStart(4, "0")}`;
}

/**
 * Sporcu kendi kaydını açar: `User` + `Profile` + `OrganizationUser` +
 * `Member` tek transaction'da doğar, kayıt linkinin sayacı artar.
 *
 * Yarış durumu: iki kişi aynı saniyede kaydolursa aynı üye numarasını
 * alabilirler. Numara benzersiz olduğu için ikincisi hata alır; bu yüzden
 * çakışmada birkaç kez yeniden denenir (numara her denemede yeniden okunur).
 */
export async function registerMemberViaLink(
  input: SelfRegisterInput,
): Promise<SelfRegisterResult> {
  const link = await resolveJoinLink(input.slug);
  if (!link.ok) {
    return {
      ok: false,
      error:
        link.reason === "suresi-doldu"
          ? "Kayıt bağlantısının süresi dolmuş. Salondan güncel bağlantıyı iste."
          : link.reason === "kota-doldu"
            ? "Bu kayıt bağlantısı doldu. Salondan yeni bağlantı iste."
            : "Kayıt bağlantısı geçerli değil. Salondan güncel bağlantıyı iste.",
    };
  }

  const email = input.email.toLowerCase().trim();
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

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

  const existingMember = await prisma.member.findFirst({
    where: { organizationId: link.organizationId, email },
    select: { id: true, userId: true },
  });
  if (existingMember) {
    return {
      ok: false,
      error:
        "Bu e-posta salonda kayıtlı. Antrenörün sana özel bir bağlantı gönderdiyse onu kullan, yoksa salonla iletişime geç.",
    };
  }

  const passwordHash = await hashPassword(input.password);
  // Sporcunun seçtiği antrenör linkin varsayılanından önce gelir; ama formdan
  // gelen kimlik güvenilmez — salonun aktif kadrosunda olmalı.
  const chosenCoachUserId = await validCoachFor(
    link.organizationId,
    input.chosenCoachUserId,
  );
  const assignedCoachUserId =
    chosenCoachUserId ?? (await defaultCoachFor(link.linkId));
  const now = new Date();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const memberNo = await nextMemberNo(tx, link.organizationId);

        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            profile: { create: { displayName: fullName } },
          },
          select: { id: true },
        });

        await tx.organizationUser.create({
          data: {
            organizationId: link.organizationId,
            userId: user.id,
            role: "member",
            status: "active",
          },
        });

        const member = await tx.member.create({
          data: {
            organizationId: link.organizationId,
            userId: user.id,
            memberNo,
            fullName,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            email,
            phone: input.phone.trim(),
            status: link.defaultStatus,
            assignedCoachUserId,
            birthDate: input.birthDate,
            gender: input.gender ?? null,
            district: input.district?.trim() || null,
            city: input.city.trim(),
            state: input.state.trim(),
            country: input.country.trim().toLowerCase(),
            postalCode: input.postalCode?.trim() || null,
            emergencyName: input.emergencyName?.trim() || null,
            emergencyPhone: input.emergencyPhone?.trim() || null,
            healthNote: input.healthNote?.trim() || null,
            selfRegisteredAt: now,
            joinLinkId: link.linkId,
            kvkkConsentAt: now,
            marketingConsentAt: input.marketingConsent ? now : null,
          },
          select: { id: true },
        });

        await tx.memberJoinLink.update({
          where: { id: link.linkId },
          data: { usedCount: { increment: 1 } },
        });

        return { userId: user.id, memberId: member.id };
      });

      // Yanıtlar transaction'ın DIŞINDA yazılır: tablo henüz yoksa (migration
      // bekliyorsa) kayıt geri alınmasın, kişi kayıt olabilsin.
      const answersSaved = await saveRegistrationAnswers({
        memberId: created.memberId,
        answers: input.answers,
        chosenCoachUserId,
      });

      return {
        ok: true,
        ...created,
        organizationId: link.organizationId,
        fullName,
        answersSaved,
        chosenCoachUserId,
      };
    } catch (error) {
      const isRace =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      // Üye numarası çakıştıysa yeniden dene; e-posta çakıştıysa (araya başka
      // bir kayıt girdi) kullanıcıya söyle.
      if (!isRace) {
        return { ok: false, error: "Kayıt tamamlanamadı, tekrar dene." };
      }
      const target = String(error.meta?.target ?? "");
      if (target.includes("email")) {
        return {
          ok: false,
          error: "Bu e-postayla bir hesap açılmış. Giriş yapmayı dene.",
        };
      }
    }
  }

  return {
    ok: false,
    error: "Kayıt şu an yoğun, birkaç saniye sonra tekrar dene.",
  };
}

const COACH_ROLES = ["coach", "admin", "staff"];

export type CoachChoice = { userId: string; displayName: string };

/**
 * Kayıt formundaki "koçunuz kim" listesi. Herkese açık sayfada görünür, bu
 * yüzden yalnız ad döner — e-posta ya da başka bir alan sızmaz. Görünen adı
 * olmayan hesap listeye girmez.
 */
export async function listPublicCoachChoices(
  organizationId: string,
): Promise<CoachChoice[]> {
  const rows = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      status: "active",
      role: { in: COACH_ROLES },
    },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      user: { select: { profile: { select: { displayName: true } } } },
    },
  });

  return rows.flatMap((row) => {
    const displayName = row.user.profile?.displayName?.trim();
    return displayName ? [{ userId: row.userId, displayName }] : [];
  });
}

/** Formdan gelen antrenör kimliği salonun aktif kadrosunda değilse `null`. */
async function validCoachFor(
  organizationId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;

  const active = await prisma.organizationUser.findFirst({
    where: {
      organizationId,
      userId,
      status: "active",
      role: { in: COACH_ROLES },
    },
    select: { userId: true },
  });
  return active ? active.userId : null;
}

/**
 * Yanıtları yazar. `true` = HEPSİ tabloya yazıldı.
 *
 * `goals` sütunu sonradan eklendi. Migration henüz uygulanmamışsa (tablo eski
 * hâliyle duruyorsa) tam yazım hata verir; bu durumda hedef DIŞINDAKİ yanıtlar
 * yine de kaydedilir ve `false` döner — çağıran özeti (hedefler dahil) denetim
 * kaydına koyar, hiçbir bilgi kaybolmaz. `select: { id: true }` bilerek: Prisma
 * varsayılan olarak yazılan satırın TÜM sütunlarını geri okur, olmayan sütun
 * yüzünden yazım yine patlardı.
 */
async function saveRegistrationAnswers(input: {
  memberId: string;
  answers: RegistrationAnswers;
  chosenCoachUserId: string | null;
}): Promise<boolean> {
  const base = {
    memberId: input.memberId,
    occupation: input.answers.occupation,
    dailyLoad: input.answers.dailyLoad,
    preferredTimes: input.answers.preferredTimes,
    chosenCoachUserId: input.chosenCoachUserId,
  };

  try {
    await prisma.memberRegistrationAnswer.create({
      data: { ...base, goals: input.answers.goals },
      select: { id: true },
    });
    return true;
  } catch (error) {
    console.error("[kayit] yanıtlar tabloya yazılamadı, hedefsiz denenecek", error);
  }

  try {
    await prisma.memberRegistrationAnswer.create({
      data: base,
      select: { id: true },
    });
  } catch (error) {
    console.error("[kayit] yanıtlar tabloya yazılamadı", error);
  }
  // İkinci deneme başarılı olsa bile hedefler tabloda değil → özet denetime düşsün.
  return false;
}

export type StoredRegistrationAnswers = {
  goals: string[];
  occupation: string | null;
  dailyLoad: string | null;
  preferredTimes: string[];
  chosenCoachName: string | null;
};

/**
 * Sporcu kartında gösterilecek yanıtlar. Tablo yoksa ya da satır yoksa
 * `null` — kart bu bölümü göstermez, sayfa düşmez.
 */
export async function getRegistrationAnswers(
  memberId: string,
): Promise<StoredRegistrationAnswers | null> {
  try {
    let row: {
      goals: string[];
      occupation: string | null;
      dailyLoad: string | null;
      preferredTimes: string[];
      chosenCoachUserId: string | null;
    } | null;
    try {
      row = await prisma.memberRegistrationAnswer.findUnique({
        where: { memberId },
        select: {
          goals: true,
          occupation: true,
          dailyLoad: true,
          preferredTimes: true,
          chosenCoachUserId: true,
        },
      });
    } catch {
      // `goals` sütunu henüz yoksa: hedefsiz oku, kart yine de görünsün.
      const legacy = await prisma.memberRegistrationAnswer.findUnique({
        where: { memberId },
        select: {
          occupation: true,
          dailyLoad: true,
          preferredTimes: true,
          chosenCoachUserId: true,
        },
      });
      row = legacy ? { goals: [], ...legacy } : null;
    }
    if (!row) return null;

    let chosenCoachName: string | null = null;
    if (row.chosenCoachUserId) {
      const profile = await prisma.profile.findFirst({
        where: { userId: row.chosenCoachUserId },
        select: { displayName: true },
      });
      chosenCoachName = profile?.displayName ?? null;
    }

    return {
      goals: row.goals,
      occupation: row.occupation,
      dailyLoad: row.dailyLoad,
      preferredTimes: row.preferredTimes,
      chosenCoachName,
    };
  } catch (error) {
    console.error("[kayit] yanıtlar okunamadı", error);
    return null;
  }
}

/** Link hangi antrenöre bağlıysa o; antrenör hesabı kapanmışsa atanmaz. */
async function defaultCoachFor(linkId: string): Promise<string | null> {
  const link = await prisma.memberJoinLink.findUnique({
    where: { id: linkId },
    select: { defaultCoachUserId: true, organizationId: true },
  });
  if (!link?.defaultCoachUserId) return null;

  const active = await prisma.organizationUser.findFirst({
    where: {
      organizationId: link.organizationId,
      userId: link.defaultCoachUserId,
      status: "active",
    },
    select: { id: true },
  });
  return active ? link.defaultCoachUserId : null;
}

// ── Personel/yönetim listeleri ────────────────────────────────

export type SelfRegisteredRow = {
  memberId: string;
  memberNo: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  district: string | null;
  city: string | null;
  birthDate: Date | null;
  registeredAt: Date;
  linkLabel: string | null;
  assignedCoachName: string | null;
};

/**
 * Kendi kaydolan sporcular — yönetimin "gelen kayıt" kuyruğu. Sorumlu
 * antrenörü atanmamış olanlar başta gelir; iş listesi budur.
 */
export async function listSelfRegistered(
  organizationId: string,
  { limit = 100 }: { limit?: number } = {},
): Promise<SelfRegisteredRow[]> {
  const rows = await prisma.member.findMany({
    where: { organizationId, selfRegisteredAt: { not: null } },
    orderBy: [{ assignedCoachUserId: "asc" }, { selfRegisteredAt: "desc" }],
    take: limit,
    select: {
      id: true,
      memberNo: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      district: true,
      city: true,
      birthDate: true,
      selfRegisteredAt: true,
      joinLink: { select: { label: true } },
      assignedCoach: { select: { profile: { select: { displayName: true } } } },
    },
  });

  return rows.map((row) => ({
    memberId: row.id,
    memberNo: row.memberNo,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    district: row.district,
    city: row.city,
    birthDate: row.birthDate,
    registeredAt: row.selfRegisteredAt ?? new Date(0),
    linkLabel: row.joinLink?.label ?? null,
    assignedCoachName: row.assignedCoach?.profile?.displayName ?? null,
  }));
}

export async function countUnassignedSelfRegistered(
  organizationId: string,
): Promise<number> {
  return prisma.member.count({
    where: {
      organizationId,
      selfRegisteredAt: { not: null },
      assignedCoachUserId: null,
    },
  });
}
