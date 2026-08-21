"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import {
  SLOT_KINDS,
  approveRequest,
  cancelSlot,
  closeSlot,
  createSlots,
  findSlotInScope,
  markAttendance,
  rejectRequest,
} from "@/lib/queries/slots";
import { formatDateTimeTR, gymDateTimeToInstant } from "@/lib/date";
import { prisma } from "@/lib/db";
import { enqueueNotification } from "@/lib/queries/notifications";
import {
  dersIptal,
  dersOnaylandi,
  dersReddedildi,
} from "@/domain/notifications/kinds";
import { sendManualReminder } from "@/lib/jobs/reminders";
import { recordAudit } from "@/lib/queries/audit";

function revalidateProgram(): void {
  revalidatePath("/personel/bugun");
  revalidatePath("/personel/program");
  revalidatePath("/personel/program/istekler");
  revalidatePath("/personel/program/yoklama");
  revalidatePath("/personel");
  revalidatePath("/uye/program");
  revalidatePath("/uye/derslerim");
  revalidatePath("/uye/bildirimler");
  revalidatePath("/personel/bildirimler");
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

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "seans.acildi",
    entityType: "TrainingSlot",
    summary: `${formatDateTimeTR(startsAt)} · ${created} seans açıldı (${parsed.data.kind}).`,
  });

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

  const slot = await findSlotInScope(staffScopeFor(membership, user.id), slotId);
  if (!slot) return;

  // İptal bildirimi seans SİLİNMEDEN önce toplanır — iptalden sonra kimin
  // kayıtlı olduğu bilgisi durum değiştiği için kaybolur.
  const affected = await prisma.slotBooking.findMany({
    where: { slotId: slot.id, status: { in: ["onayli", "bekliyor"] } },
    select: {
      id: true,
      member: { select: { id: true, userId: true, organizationId: true } },
      slot: { select: { startsAt: true } },
    },
  });

  await cancelSlot(slot.id);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "seans.iptal",
    entityType: "TrainingSlot",
    entityId: slot.id,
    summary: `${formatDateTimeTR(slot.startsAt)} seansı iptal edildi (${affected.length} kayıt).`,
  });

  for (const booking of affected) {
    if (!booking.member.userId) continue;
    await enqueueNotification({
      ...dersIptal({
        bookingId: booking.id,
        dateTimeLabel: formatDateTimeTR(booking.slot.startsAt),
      }),
      organizationId: booking.member.organizationId,
      userId: booking.member.userId,
      memberId: booking.member.id,
    });
  }

  revalidateProgram();
}

export async function approveRequestAction(bookingId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const booking = await prisma.slotBooking.findFirst({
    where: { id: bookingId, slot: { organizationId: membership.organizationId } },
    select: {
      id: true,
      member: { select: { id: true, userId: true, organizationId: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!booking) return;

  await approveRequest(booking.id, user.id);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "istek.onaylandi",
    entityType: "SlotBooking",
    entityId: booking.id,
    summary: `${formatDateTimeTR(booking.slot.startsAt)} seansına katılım isteği onaylandı.`,
  });

  if (booking.member.userId) {
    await enqueueNotification({
      ...dersOnaylandi({
        bookingId: booking.id,
        dateTimeLabel: formatDateTimeTR(booking.slot.startsAt),
      }),
      organizationId: booking.member.organizationId,
      userId: booking.member.userId,
      memberId: booking.member.id,
    });
  }

  revalidateProgram();
}

export async function rejectRequestAction(bookingId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return;

  const booking = await prisma.slotBooking.findFirst({
    where: { id: bookingId, slot: { organizationId: membership.organizationId } },
    select: {
      id: true,
      member: { select: { id: true, userId: true, organizationId: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!booking) return;

  await rejectRequest(booking.id, user.id);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "istek.reddedildi",
    entityType: "SlotBooking",
    entityId: booking.id,
    summary: `${formatDateTimeTR(booking.slot.startsAt)} seansı için katılım isteği reddedildi.`,
  });

  if (booking.member.userId) {
    await enqueueNotification({
      ...dersReddedildi({
        bookingId: booking.id,
        dateTimeLabel: formatDateTimeTR(booking.slot.startsAt),
      }),
      organizationId: booking.member.organizationId,
      userId: booking.member.userId,
      memberId: booking.member.id,
    });
  }

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
    select: {
      id: true,
      memberId: true,
      member: { select: { fullName: true } },
      slot: { select: { startsAt: true } },
    },
  });
  if (!booking) return;

  await markAttendance(booking.id, attended, user.id);

  await recordAudit({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorLabel: user.displayName,
    action: "yoklama.isaretlendi",
    entityType: "SlotBooking",
    entityId: booking.id,
    summary: `${booking.member.fullName} · ${formatDateTimeTR(booking.slot.startsAt)} · ${attended ? "katıldı" : "gelmedi"}.`,
  });

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

  const slot = await findSlotInScope(staffScopeFor(membership, user.id), slotId);
  if (!slot) return;

  await closeSlot(slot.id);
  revalidateProgram();
}

export type ReminderActionState = { error?: string; success?: string };

/**
 * "Şimdi hatırlat" — antrenör tek sporcuya elden bildirim gönderir.
 * Otomatik hatırlatmalardan bağımsızdır; günde birkaç kez basılabilir.
 */
export async function remindBookingAction(
  bookingId: string,
  _prevState: ReminderActionState,
  _formData: FormData,
): Promise<ReminderActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Oturum açılmamış." };
  const membership = await requireStaff(user.id).catch(() => null);
  if (!membership) return { error: "Personel yetkisi gerekli." };

  const result = await sendManualReminder(bookingId, membership.organizationId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/personel/bugun");
  revalidatePath("/uye/bildirimler");
  return { success: "Hatırlatma gönderildi." };
}
