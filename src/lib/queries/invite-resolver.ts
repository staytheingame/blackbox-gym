import "server-only";
import { readInvite } from "@/lib/queries/invites";
import { readStaffInvite, type StaffInviteRole } from "@/lib/queries/staff-invites";

/**
 * `/davet/<token>` iki tabloya birden bakar: sporcu daveti (`MemberInvite`)
 * ve personel daveti (`StaffInvite`).
 *
 * Tek adres olması bilinçli — davet edilen kişiye "sporcu musun personel mi"
 * diye sormak, yanlış bağlantıya tıklatmak demekti. Token 32 baytlık rastgele
 * bir anahtar; iki tabloda birden karşılık bulma ihtimali yok.
 */

export type ResolvedInvite =
  | {
      ok: true;
      kind: "sporcu";
      fullName: string;
      email: string;
    }
  | {
      ok: true;
      kind: "personel";
      fullName: string;
      email: string;
      role: StaffInviteRole;
      organizationName: string;
    }
  | { ok: false; reason: "gecersiz" | "kullanilmis" | "suresi-doldu" };

export async function resolveInvite(token: string): Promise<ResolvedInvite> {
  const staff = await readStaffInvite(token);
  if (staff.ok) {
    return {
      ok: true,
      kind: "personel",
      fullName: staff.fullName,
      email: staff.email,
      role: staff.role,
      organizationName: staff.organizationName,
    };
  }

  const member = await readInvite(token);
  if (member.ok) {
    return {
      ok: true,
      kind: "sporcu",
      fullName: member.fullName,
      email: member.email,
    };
  }

  // İkisi de olumsuz: "gecersiz" = hiç bulunamadı demek, diğer taraftaki
  // daha açıklayıcı gerekçeyi (kullanılmış / süresi dolmuş) öne al.
  return member.reason === "gecersiz" ? staff : member;
}
