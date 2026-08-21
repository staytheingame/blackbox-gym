"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { bookSlot, cancelBooking } from "@/lib/queries/slots";
import { BOOKING_REFUSAL_MESSAGE } from "@/domain/booking/credits";

function revalidateBookingViews(): void {
  revalidatePath("/uye/program");
  revalidatePath("/uye/derslerim");
  revalidatePath("/uye/uyelik");
  revalidatePath("/uye");
  revalidatePath("/personel/program");
  revalidatePath("/personel/program/istekler");
}

export type BookingActionState = { error?: string; success?: string };

/**
 * Sporcu bir saati kapar. Yer boşsa doğrudan rezerve olur; doluysa istek
 * antrenör onayına gider (grup dersi). Yetki ve hak kontrolü sunucuda
 * yapılır — "butonu görüyordum" güvenlik sayılmaz.
 */
export async function bookSlotAction(
  slotId: string,
  _prevState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const member = await getCurrentMember(user.id);
  if (!member) return { error: "Üye kaydı bulunamadı." };

  const note = formData.get("note")?.toString().slice(0, 200) || undefined;
  const result = await bookSlot(member.id, slotId, note);

  if (!result.ok) {
    return { error: BOOKING_REFUSAL_MESSAGE[result.reason] };
  }

  revalidateBookingViews();
  return {
    success:
      result.kind === "rezerve"
        ? "Yerin ayrıldı."
        : "İsteğin antrenöre gitti — onaylarsa grup dersi olarak katılacaksın.",
  };
}

/** Kendi rezervasyonunu iptal eder — ders hakkı geri döner. */
export async function cancelBookingAction(bookingId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const member = await getCurrentMember(user.id);
  if (!member) return;

  await cancelBooking(member.id, bookingId);
  revalidateBookingViews();
}
