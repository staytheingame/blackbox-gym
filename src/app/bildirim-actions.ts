"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guards";
import { markAllRead } from "@/lib/queries/notifications";

/**
 * "Hepsini okundu işaretle" — üç panelin de kullandığı tek eylem.
 * Bildirimler kullanıcıya bağlı olduğu için ayrıca yetki kontrolü gerekmez;
 * `markAllRead` yalnız oturumdaki kullanıcının satırlarına dokunur.
 */
export async function markAllReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await markAllRead(user.id);

  revalidatePath("/uye/bildirimler");
  revalidatePath("/personel/bildirimler");
  revalidatePath("/yonetim/bildirimler");
  revalidatePath("/uye");
  revalidatePath("/personel");
  revalidatePath("/yonetim");
}
