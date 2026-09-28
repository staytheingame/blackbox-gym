"use server";

import { redirect } from "next/navigation";
import { createFunnelLead, getPublicOrganization } from "@/lib/queries/funnel";
import { parseFunnelLead } from "@/domain/funnel/lead";

export type FunnelState = { error?: string };

/**
 * Herkese açık başvuru formu. Oturum gerektirmez; bu yüzden üç savunma var:
 *   - bal küpü alanı (`website`): insan görmez, bot doldurur → sessizce "alındı"
 *     denir ama HİÇBİR ŞEY kaydedilmez
 *   - sunucu tarafı doğrulama (`parseFunnelLead`): form elle bozulsa da geçmez
 *   - kısa sürede aynı kişi/aynı seçenek tekrar gelirse yeni satır açılmaz
 *
 * Başarılıysa teşekkür sayfasına yönlendirir.
 */
export async function submitFunnelLeadAction(
  formData: FormData,
): Promise<FunnelState> {
  const text = (name: string) => formData.get(name)?.toString() ?? "";

  // Bot tuzağı: dolu geldiyse gerçek bir kişi değildir.
  if (text("website").trim() !== "") {
    redirect("/basvuru/tesekkurler");
  }

  const parsed = parseFunnelLead({
    forWhom: text("forWhom"),
    interest: text("interest"),
    goals: formData.getAll("goals").map(String),
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
    age: text("age"),
    childName: text("childName"),
    occupationGroup: text("occupationGroup"),
    dailyLoad: text("dailyLoad"),
    preferredTimes: formData.getAll("preferredTimes").map(String),
    contactChannel: text("contactChannel"),
    contactTime: text("contactTime"),
    note: text("note"),
    kvkkConsent: text("kvkkConsent") === "on",
    marketingConsent: text("marketingConsent") === "on",
  });
  if (!parsed.ok) return { error: parsed.error };

  const organization = await getPublicOrganization();
  if (!organization) {
    return { error: "Başvuru şu an alınamıyor. Lütfen salonla iletişime geç." };
  }

  const result = await createFunnelLead(organization.id, parsed.lead);
  if (!result.ok) return { error: result.error };

  redirect("/basvuru/tesekkurler");
}
