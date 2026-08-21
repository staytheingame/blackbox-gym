"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import {
  SLOT_KINDS,
  approveRequest,
  cancelSlot,
  closeSlot,
  createSlots,
  findSlotInOrganization,
  markAttendance,
  rejectRequest,
} from "@/lib/queries/slots";
import { gymDateTimeToInstant } from "@/lib/date";
import { prisma } from "@/lib/db";

function revalidateProgram(): void {
  revalidatePath("/personel/program");
  revalidatePath("/personel/program/istekler");
  revalidatePath("/personel/program/yoklama");
  revalidatePath("/personel");
  revalidatePath("/uye/program");
  revalidatePath("/uye/derslerim");
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih seçilmedi."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Saat seçilmedi."),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  capacity: z.coerce.number().int().min(1).max(20),
  kind: z.enum(SLOT_KINDS),
  title: z.string().max(80).optional(),
  notes: z.string().max(300).optional(),
  repeatWeeks: z.coerce.number().int().min(1).max(12),
});

export type SlotFormState = { error?: string; success?: string };

/** Antrenör boş saat açar; `repeatWeeks > 1` ise aynı saat haftalarca tekrarlar. */
export async function createSlotAction(
  _prevState: SlotFormState,
  formData: FormData,
): Promise<SlotFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const parsed = createSchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    capacity: formData.get("capacity"),
    kind: formData.get("kind"),
    title: formData.get("title")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
    repeatWeeks: formData.get("repeatWeeks"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const startsAt = gymDateTimeToInstant(parsed.data.date, parsed.data.time);
  if (startsAt.getTime() < Date.now()) {
    return { error: "Geçmiş bir saate seans açılamaz." };
  }

  const created = await createSlots({
    organizationId: membership.organizationId,
    coachUserId: user.id,
    startsAt,
    durationMinutes: parsed.data.durationMinutes,
    capacity: parsed.data.capacity,
    kind: parsed.data.kind,
    title: parsed.data.title,
    notes: parsed.data.notes,
    repeatWeeks: parsed.data.repeatWeeks,
  });

  if (created === 0) {
    return { error: "Bu saatler zaten açık — yeni kayıt oluşmadı." };
  }

  revalidateProgram();
  return {
    success:
      created === 1
        ? "Saat açıldı."
        : `${created} hafta için saat açıldı.`,
  };
}

/** Seansı iptal eder — kayıtlı sporcuların hakkı geri döner. */
export async function cancelSlotAction(slotId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const slot = await findSlotInOrganization(slotId, membership.organizationId);
  if (!slot) return;

  await cancelSlot(slot.id);
  revalidateProgram();
}

export async function approveRequestAction(bookingId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const booking = await prisma.slotBooking.findFirst({
    where: { id: bookingId, slot: { organizationId: membership.organizationId } },
    select: { id: true },
  });
  if (!booking) return;

  await approveRequest(booking.id, user.id);
  revalidateProgram();
}

export async function rejectRequestAction(bookingId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const booking = await prisma.slotBooking.findFirst({
    where: { id: bookingId, slot: { organizationId: membership.organizationId } },
    select: { id: true },
  });
  if (!booking) return;

  await rejectRequest(booking.id, user.id);
  revalidateProgram();
}

/** Yoklama: geldi/gelmedi. "Geldi" antrenman kaydı ve puan üretir. */
export async function markAttendanceAction(
  bookingId: string,
  attended: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const booking = await prisma.slotBooking.findFirst({
    where: { id: bookingId, slot: { organizationId: membership.organizationId } },
    select: { id: true, memberId: true },
  });
  if (!booking) return;

  await markAttendance(booking.id, attended, user.id);

  revalidateProgram();
  revalidatePath(`/personel/uyeler/${booking.memberId}`);
  revalidatePath("/uye");
  revalidatePath("/uye/performans");
  revalidatePath("/uye/lig");
}

/** Yoklaması biten seansı kapatır — kuyrukta tekrar görünmesin. */
export async function closeSlotAction(slotId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const slot = await findSlotInOrganization(slotId, membership.organizationId);
  if (!slot) return;

  await closeSlot(slot.id);
  revalidateProgram();
}
