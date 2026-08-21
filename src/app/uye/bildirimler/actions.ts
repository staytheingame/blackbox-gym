"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";

/**
 * Sporcu ders hatırlatmalarını açar/kapatır. Kapalıyken hatırlatma ve paket
 * uyarısı üretilmez (bkz. `src/lib/jobs/reminders.ts`); rezervasyon onayı,
 * iptal gibi doğrudan cevaplar bundan etkilenmez — onlar bilgi değil, karşılık.
 */
export async function toggleRemindersAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const member = await getCurrentMember(user.id);
  if (!member) return;

  await prisma.member.update({
    where: { id: member.id },
    data: { remindersEnabled: !member.remindersEnabled },
  });

  revalidatePath("/uye/bildirimler");
  revalidatePath("/uye/profil");
}
