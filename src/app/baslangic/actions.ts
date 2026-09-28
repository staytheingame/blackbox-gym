"use server";

import { redirect } from "next/navigation";
import { getPublicOrganization } from "@/lib/queries/funnel";
import { createStartLead } from "@/lib/queries/start-leads";
import { parseStartLead } from "@/domain/funnel/start";

export type StartState = { error?: string };

/**
 * "Sana Uygun Başlangıcı Bulalım" formu. Oturum gerektirmez; bu yüzden üç savunma:
 *   - bal küpü alanı (`website`): insan görmez, bot doldurursa sessizce "alındı"
 *     denir ama HİÇBİR ŞEY kaydedilmez
 *   - sunucu tarafı doğrulama (`parseStartLead`): form elle bozulsa da geçmez
 *   - kısa sürede aynı kişi tekrar gelirse yeni satır açılmaz
 *
 * Başarılıysa teşekkür sayfasına yönlendirir.
 */
export async function submitStartLeadAction(
  formData: FormData,
): Promise<StartState> {
  const text = (name: string) => formData.get(name)?.toString() ?? "";

  // Bot tuzağı: dolu geldiyse gerçek bir kişi değildir.
  if (text("website").trim() !== "") {
    redirect("/baslangic/tesekkurler");
  }

  const parsed = parseStartLead({
    goal: text("goal"),
    pain: text("pain"),
    barrier: text("barrier"),
    history: text("history"),
    turnoff: text("turnoff"),
    expectations: formData.getAll("expectations").map(String),
    occupation: text("occupation"),
    dailyLoad: text("dailyLoad"),
    timeWindows: formData.getAll("timeWindows").map(String),
    weeklyDays: text("weeklyDays"),
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const organization = await getPublicOrganization();
  if (!organization) {
    return { error: "Talep şu an alınamıyor. Lütfen salonla iletişime geç." };
  }

  const result = await createStartLead(organization.id, parsed.lead);
  if (!result.ok) return { error: result.error };

  redirect("/baslangic/tesekkurler");
}
