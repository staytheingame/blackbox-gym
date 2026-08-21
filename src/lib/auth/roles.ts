/**
 * Salon içi roller — TEK doğru kaynak.
 *
 *   member → sporcu paneli (/uye)
 *   coach  → antrenör paneli (/personel): kendi sporcuları, ders saatleri,
 *            antrenman ve beslenme planları, yoklama
 *   admin  → yönetici paneli (/yonetim): salon geneli — antrenör kadrosu,
 *            paket tanımları, bildirim kuyruğu, doluluk raporu
 *
 * Yönetici antrenör panelini de görür (salonun sahibi çoğu zaman aynı
 * zamanda ders veriyor); tersi geçerli değildir.
 *
 * Eski `staff` değeri 20260819 migration'ında `coach`'a çevrildi. Veritabanında
 * kalmış olabileceği için okuma tarafında hâlâ tanınıyor — yazan yer yok.
 */

export const ORG_ROLES = ["member", "coach", "admin"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  member: "Sporcu",
  coach: "Antrenör",
  admin: "Yönetici",
};

/** Veritabanından gelen ham değeri role çevirir; tanınmayan değer `member`. */
export function normalizeRole(raw: string): OrgRole {
  if (raw === "staff") return "coach"; // geçiş öncesi kayıtlar
  return (ORG_ROLES as readonly string[]).includes(raw)
    ? (raw as OrgRole)
    : "member";
}

/** Antrenör paneline (/personel) girebilenler. */
export function isStaffRole(role: OrgRole): boolean {
  return role === "coach" || role === "admin";
}

/** Yönetici paneline (/yonetim) girebilenler. */
export function isAdminRole(role: OrgRole): boolean {
  return role === "admin";
}

/** Giriş sonrası rolün açılış ekranı. */
export function homePathForRole(role: OrgRole): string {
  if (role === "admin") return "/yonetim";
  if (role === "coach") return "/personel";
  return "/uye";
}
