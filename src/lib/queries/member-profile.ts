import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEFAULT_COUNTRY } from "@/data/istanbul-districts";

/**
 * KİŞİSEL BİLGİ GÜNCELLEME — sporcu kendi, personel sporcusu adına.
 *
 * Şema ve yazma işi tek yerde çünkü iki ekran aynı alanları düzenliyor
 * (`/uye/profil` ve `/personel/uyeler/<id>`). İki ayrı doğrulama, bir gün
 * birinde ülke kodu normalleştirilip ötekinde atlanması demekti.
 *
 * `fullName` burada TÜRETİLİR: ekranların tamamı `fullName` okuyor, ad/soyad
 * ise reklam eşleşmesi (fn/ln) ve hitap için ayrı duruyor. İkisinin birbirine
 * karışmaması için tek yazma yolu bu fonksiyon.
 *
 * E-POSTA BİLEREK YOK: giriş kimliği `User.email` ile bağlı, değiştirilmesi
 * ayrı bir doğrulama akışı ister (yeni adrese doğrulama bağlantısı). Sporcu
 * adresini değiştirmek isterse salona söyler.
 */

export const personalInfoSchema = z.object({
  firstName: z.string().trim().min(2, "Adını yaz.").max(40),
  lastName: z.string().trim().min(2, "Soyadını yaz.").max(40),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]{10,20}$/, "Telefonu 0555 111 22 33 gibi yaz."),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Doğum tarihini seç.")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["kadin", "erkek", "belirtmedi"]).optional(),
  district: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  postalCode: z.string().trim().max(12).optional(),
  emergencyName: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(20).optional(),
  healthNote: z.string().trim().max(500).optional(),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

/** Boş dizeyi `null`a çevirir — "" yazmak alanı dolu göstermek olurdu. */
function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function updateMemberPersonalInfo(
  memberId: string,
  input: PersonalInfoInput,
): Promise<{ ok: true; fullName: string }> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = `${firstName} ${lastName}`.trim();

  await prisma.member.update({
    where: { id: memberId },
    data: {
      firstName,
      lastName,
      fullName,
      phone: input.phone.trim(),
      birthDate: input.birthDate
        ? new Date(`${input.birthDate}T00:00:00.000Z`)
        : null,
      gender: input.gender ?? null,
      district: orNull(input.district),
      city: orNull(input.city),
      state: orNull(input.state),
      postalCode: orNull(input.postalCode),
      // Ülke formda sorulmuyor (salon Türkiye'de); kayıt varsa korunur,
      // yoksa varsayılan yazılır ki reklam eşleşmesinde boş kalmasın.
      country: DEFAULT_COUNTRY,
      emergencyName: orNull(input.emergencyName),
      emergencyPhone: orNull(input.emergencyPhone),
      healthNote: orNull(input.healthNote),
    },
  });

  // Panelde görünen ad `Profile.displayName`den geliyor — hesabı olan sporcuda
  // ikisi birlikte değişmezse menüde eski ad kalırdı.
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { userId: true },
  });
  if (member?.userId) {
    await prisma.profile.updateMany({
      where: { userId: member.userId },
      data: { displayName: fullName },
    });
  }

  return { ok: true, fullName };
}

/** Form alanlarını dolduran okuma — tarih `<input type="date">` biçiminde. */
export type PersonalInfoView = PersonalInfoInput & {
  memberNo: string;
  email: string | null;
  /** Eksik olan zorunlu alanlar — ekran "profilini tamamla" der. */
  missing: string[];
};

const REQUIRED_LABELS: { key: keyof PersonalInfoInput; label: string }[] = [
  { key: "phone", label: "telefon" },
  { key: "birthDate", label: "doğum tarihi" },
  { key: "district", label: "ilçe" },
];

export async function getMemberPersonalInfo(
  memberId: string,
): Promise<PersonalInfoView | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      memberNo: true,
      fullName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      gender: true,
      district: true,
      city: true,
      state: true,
      postalCode: true,
      emergencyName: true,
      emergencyPhone: true,
      healthNote: true,
    },
  });
  if (!member) return null;

  // Eski kayıtlarda ad/soyad ayrı tutulmuyordu; forma bir şey basabilmek için
  // tam addan bölünür (son kelime soyad).
  const parts = member.fullName.trim().split(/\s+/);
  const fallbackLast = parts.length > 1 ? parts[parts.length - 1] : "";
  const fallbackFirst =
    parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");

  const view: PersonalInfoView = {
    memberNo: member.memberNo,
    email: member.email,
    firstName: member.firstName ?? fallbackFirst,
    lastName: member.lastName ?? fallbackLast,
    phone: member.phone ?? "",
    birthDate: member.birthDate
      ? member.birthDate.toISOString().slice(0, 10)
      : "",
    gender: (member.gender as PersonalInfoInput["gender"]) ?? "belirtmedi",
    district: member.district ?? "",
    city: member.city ?? "",
    state: member.state ?? "",
    postalCode: member.postalCode ?? "",
    emergencyName: member.emergencyName ?? "",
    emergencyPhone: member.emergencyPhone ?? "",
    healthNote: member.healthNote ?? "",
    missing: [],
  };

  view.missing = REQUIRED_LABELS.filter(({ key }) => !view[key]).map(
    ({ label }) => label,
  );

  return view;
}
