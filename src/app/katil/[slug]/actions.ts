"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { registerMemberViaLink } from "@/lib/queries/join-links";
import { createSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/queries/audit";
import { DEFAULT_COUNTRY } from "@/data/istanbul-districts";
import {
  parseRegistrationAnswers,
  summarizeAnswers,
} from "@/domain/registration/answers";

/**
 * Kayıt formunun doğrulaması.
 *
 * Zorunlu tutulanlar bilinçli seçildi: **e-posta ve telefon** reklam
 * eşleşmesinin ve salonun ulaşabilmesinin tek yolu; **ad/soyad** hitap ve
 * eşleşme; **doğum tarihi** hem yaş grubu hem yasal (18 altı için veli izni
 * gerekir, salon bunu görmeden kaydı üye yapamaz); **ilçe** salonun nereden
 * öğrenci çektiğini gösteren tek alan.
 *
 * Geri kalanı opsiyonel — zorunlu alan sayısı artınca yarı kalan kayıt artıyor.
 */
const MIN_AGE_YEARS = 10;
const MAX_AGE_YEARS = 90;

const registerSchema = z
  .object({
    slug: z.string().min(3),
    firstName: z.string().trim().min(2, "Adını yaz."),
    lastName: z.string().trim().min(2, "Soyadını yaz."),
    email: z.string().trim().toLowerCase().email("Geçerli bir e-posta yaz."),
    phone: z
      .string()
      .trim()
      .regex(
        /^[0-9+()\s-]{10,20}$/,
        "Telefonu 0555 111 22 33 gibi yaz.",
      ),
    password: z.string().min(8, "Şifre en az 8 karakter olmalı."),
    passwordAgain: z.string(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Doğum tarihini seç."),
    gender: z.enum(["kadin", "erkek", "belirtmedi"]).default("belirtmedi"),
    district: z.string().trim().min(2, "Hangi ilçede yaşıyorsun?"),
    city: z.string().trim().min(2, "Şehir gerekli."),
    state: z.string().trim().min(2, "İl gerekli."),
    country: z.string().trim().min(2).max(40).default(DEFAULT_COUNTRY),
    postalCode: z.string().trim().max(12).optional(),
    emergencyName: z.string().trim().max(80).optional(),
    emergencyPhone: z.string().trim().max(20).optional(),
    healthNote: z.string().trim().max(500).optional(),
    kvkkConsent: z.literal("on", {
      message: "Kayıt için aydınlatma metnini onaylaman gerekiyor.",
    }),
    marketingConsent: z.string().optional(),
  })
  .refine((data) => data.password === data.passwordAgain, {
    message: "Şifreler aynı değil.",
    path: ["passwordAgain"],
  });

export type RegisterState = { error?: string };

export async function registerMemberAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    slug: formData.get("slug"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
    birthDate: formData.get("birthDate"),
    gender: formData.get("gender")?.toString() || "belirtmedi",
    district: formData.get("district"),
    city: formData.get("city"),
    state: formData.get("state"),
    country: formData.get("country")?.toString() || DEFAULT_COUNTRY,
    postalCode: formData.get("postalCode")?.toString() || undefined,
    emergencyName: formData.get("emergencyName")?.toString() || undefined,
    emergencyPhone: formData.get("emergencyPhone")?.toString() || undefined,
    healthNote: formData.get("healthNote")?.toString() || undefined,
    kvkkConsent: formData.get("kvkkConsent") ?? "",
    marketingConsent: formData.get("marketingConsent")?.toString() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  // Meslek, günlük yoğunluk ve antrenman saati tercihi — hepsi zorunlu: antrenör
  // ilk görüşmeden önce sporcunun gününü bilsin.
  const answers = parseRegistrationAnswers({
    occupation: formData.get("occupation")?.toString() ?? "",
    dailyLoad: formData.get("dailyLoad")?.toString() ?? "",
    preferredTimes: formData.getAll("preferredTimes").map(String),
  });
  if (!answers.ok) return { error: answers.error };

  // "Fark etmez" seçeneği boş değer gönderir.
  const chosenCoachUserId =
    formData.get("coachUserId")?.toString().trim() || null;

  // Tarih salon saatine göre değil takvim günü olarak saklanır — doğum günü
  // saat dilimiyle bir gün kaymasın diye UTC gece yarısı.
  const birthDate = new Date(`${parsed.data.birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) {
    return { error: "Doğum tarihi okunamadı." };
  }

  const ageYears =
    (Date.now() - birthDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
  if (ageYears < MIN_AGE_YEARS || ageYears > MAX_AGE_YEARS) {
    return { error: "Doğum tarihini kontrol et." };
  }

  const result = await registerMemberViaLink({
    slug: parsed.data.slug,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    password: parsed.data.password,
    birthDate,
    gender: parsed.data.gender,
    district: parsed.data.district,
    city: parsed.data.city,
    state: parsed.data.state,
    country: parsed.data.country,
    postalCode: parsed.data.postalCode,
    emergencyName: parsed.data.emergencyName,
    emergencyPhone: parsed.data.emergencyPhone,
    healthNote: parsed.data.healthNote,
    marketingConsent: parsed.data.marketingConsent === "on",
    answers: answers.answers,
    chosenCoachUserId,
  });

  if (!result.ok) return { error: result.error };

  await recordAudit({
    organizationId: result.organizationId,
    actorUserId: result.userId,
    actorLabel: result.fullName,
    action: "uye.kendi-kaydoldu",
    entityType: "Member",
    entityId: result.memberId,
    // Yanıtlar tabloya yazılamadıysa (migration bekliyorsa) bilgi kaybolmasın:
    // özet denetim kaydına düşer, antrenör oradan okuyabilir.
    summary: `${result.fullName} kayıt bağlantısıyla (${parsed.data.slug}) kendi kaydını açtı.${
      result.answersSaved
        ? ""
        : ` Kayıt yanıtları: ${summarizeAnswers(answers.answers)}.`
    }`,
  });

  // Personelin "yeni kayıt" kuyruğu anında dolsun.
  revalidatePath("/yonetim/kayit-linki");
  revalidatePath("/yonetim/uyeler");
  revalidatePath("/personel/adaylar");
  revalidatePath("/personel/uyeler");

  // Kaydolan kişiyi giriş ekranına geri göndermek gereksiz bir engel: oturum
  // hemen açılır ve sporcu panelinde karşılanır.
  await createSession({ userId: result.userId });
  redirect("/uye?yeni=1");
}
