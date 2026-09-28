/**
 * Kadro kayıt bağlantısı kuralları — saf fonksiyonlar, veritabanı bilmez.
 *
 * Bağlantı iki rolde açılabilir: **antrenör** ve **yönetici**. Yönetici
 * hesabı salonun bütün verisini ve ayarlarını görür, bu yüzden yönetici
 * bağlantısı antrenör bağlantısından çok daha dar tutulur: varsayılan tek
 * kişi, en fazla üç kişi ve en fazla yedi gün. "Bilinmeyen rol" hiçbir
 * zaman yöneticiye yükselmez — emin olunamayan durumda antrenör açılır.
 */

export const STAFF_LINK_ROLES = ["coach", "admin"] as const;
export type StaffLinkRole = (typeof STAFF_LINK_ROLES)[number];

export const STAFF_LINK_ROLE_LABEL: Record<StaffLinkRole, string> = {
  coach: "Antrenör",
  admin: "Yönetici",
};

export const STAFF_LINK_LIMITS: Record<
  StaffLinkRole,
  { defaultMaxUses: number; maxUsesCap: number; defaultDays: number; daysCap: number }
> = {
  coach: { defaultMaxUses: 10, maxUsesCap: 50, defaultDays: 14, daysCap: 30 },
  admin: { defaultMaxUses: 1, maxUsesCap: 3, defaultDays: 3, daysCap: 7 },
};

/** Veritabanından gelen ham değer: yalnız tam "admin" yöneticidir, gerisi antrenör. */
export function normalizeStaffLinkRole(
  raw: string | null | undefined,
): StaffLinkRole {
  return raw === "admin" ? "admin" : "coach";
}

/** Kişi sayısı ve gün sayısını rolün sınırlarına çeker; geçersiz değer varsayılana döner. */
export function clampStaffLink(
  role: StaffLinkRole,
  input: { maxUses: number; days: number },
): { maxUses: number; days: number } {
  const limits = STAFF_LINK_LIMITS[role];
  const clamp = (value: number, fallback: number, cap: number): number => {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), 1), cap);
  };

  return {
    maxUses: clamp(input.maxUses, limits.defaultMaxUses, limits.maxUsesCap),
    days: clamp(input.days, limits.defaultDays, limits.daysCap),
  };
}

export type LinkListEntry = {
  url: string;
  expiresLabel: string;
  maxUses: number;
};

/**
 * Üç gruba gönderilecek bağlantıları tek metinde toplar — yönetici kopyalayıp
 * ilgili gruplara paylaşır. Üretilmeyen grup listede "yok" diye görünmez:
 * hiç yazılmaz, yanlış bir bağlantı olduğu izlenimi doğmasın.
 */
export function composeLinkList(input: {
  clientUrls: string[];
  coach?: LinkListEntry;
  admin?: LinkListEntry;
}): string {
  const lines: string[] = ["BlackBox kayıt bağlantıları"];

  if (input.clientUrls.length > 0) {
    lines.push(
      "",
      "SPORCULAR / DANIŞANLAR — bilgilerini yaz, şifreni belirle:",
      ...input.clientUrls,
    );
  }

  if (input.coach) {
    lines.push(
      "",
      `ANTRENÖRLER — adını, e-postanı ve şifreni yaz (${input.coach.expiresLabel} tarihine kadar, en fazla ${input.coach.maxUses} kişi):`,
      input.coach.url,
    );
  }

  if (input.admin) {
    lines.push(
      "",
      `YÖNETİCİLER — adını, e-postanı ve şifreni yaz (${input.admin.expiresLabel} tarihine kadar, en fazla ${input.admin.maxUses} kişi, başkasıyla paylaşma):`,
      input.admin.url,
    );
  }

  return lines.join("\n");
}
