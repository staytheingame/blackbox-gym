"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { runReminderJob } from "@/lib/jobs/reminders";

export type RunState = { error?: string; success?: string };

/**
 * Hatırlatma işini elle çalıştırır. Zamanlanmış iş (`/api/cron/hatirlatici`)
 * ile AYNI kodu çağırır — yönetici "şimdi çalıştır" diyebilsin, cron'un
 * çalışıp çalışmadığını beklemeden görebilsin diye.
 *
 * İş idempotent olduğu için tekrar basmak zararsız: aynı hatırlatma
 * ikinci kez düşmez.
 */
export async function runRemindersAction(
  _prevState: RunState,
  _formData: FormData,
): Promise<RunState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireAdmin(user.id).catch(() => null);
  if (!membership) return { error: "Yönetici yetkisi gerekli." };

  const result = await runReminderJob({
    organizationId: membership.organizationId,
  });

  revalidatePath("/yonetim/bildirimler");
  revalidatePath("/personel/bildirimler");
  revalidatePath("/uye/bildirimler");

  const parcalar = [
    `${result.dersHatirlatma} ders hatırlatması`,
    `${result.paketUyarisi} paket uyarısı`,
    `${result.kocUyarisi} antrenör uyarısı`,
    `${result.kocGunOzeti} gün özeti`,
  ];

  const uyari =
    result.hesapsizUye > 0
      ? ` ${result.hesapsizUye} sporcuya gidemedi (hesabını kurmamış).`
      : "";

  return { success: `Çalıştı: ${parcalar.join(", ")}.${uyari}` };
}
