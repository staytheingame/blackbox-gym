import "server-only";
import { prisma } from "@/lib/db";
import { formatDateTimeTR, formatTimeTR, toGymDateKey } from "@/lib/date";
import { SLOT_KIND_LABEL } from "@/lib/queries/slots";
import { enqueueMany, type EnqueueInput } from "@/lib/queries/notifications";
import {
  dersHatirlatmaAksam,
  dersHatirlatmaGun,
  kocGunOzeti,
  kocPaketBitiyor,
  paketBitiyor,
  paketBitti,
} from "@/domain/notifications/kinds";
import {
  DEFAULT_REMINDER_CONFIG,
  dueReminders,
  packageWarning,
  previousDateKey,
  type ReminderConfig,
} from "@/domain/notifications/schedule";
import { summarizeCredits, type BookingStatus } from "@/domain/booking/credits";
import { GYM_TIME_ZONE } from "@/lib/date";

/**
 * Zamanlanmış hatırlatma işi — `/api/cron/hatirlatici` bunu çağırır.
 *
 * İş IDEMPOTENT'tir: aynı gün içinde kaç kez çalışırsa çalışsın her hatırlatma
 * bir kez düşer (`Notification.dedupeKey`). Bu yüzden cron'u sık çalıştırmak
 * zararsızdır; önerilen ritim akşam 20:00 ve sabah 09:00 (bkz. `vercel.json`).
 *
 * Ürettikleri:
 *   1. Sporcuya ders hatırlatması — önceki gün akşam + dersin olduğu gün
 *   2. Sporcuya paket uyarısı — bitiyor / bitti
 *   3. Antrenöre paket uyarısı — yenileme konuşması zamanında yapılsın diye
 *   4. Antrenöre yarının ders özeti
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReminderRunResult = {
  ranAt: Date;
  dersHatirlatma: number;
  paketUyarisi: number;
  kocUyarisi: number;
  kocGunOzeti: number;
  /** Hesabı olmadığı için bildirim düşemeyen sporcu sayısı. */
  hesapsizUye: number;
};

export async function runReminderJob(options?: {
  now?: Date;
  config?: ReminderConfig;
  organizationId?: string;
}): Promise<ReminderRunResult> {
  const now = options?.now ?? new Date();
  const config = options?.config ?? DEFAULT_REMINDER_CONFIG;
  const organizationId = options?.organizationId;

  const [dersSonuc, paketSonuc, ozetSonuc] = await Promise.all([
    dersHatirlatmalari(now, config, organizationId),
    paketUyarilari(now, organizationId),
    kocGunOzetleri(now, config, organizationId),
  ]);

  return {
    ranAt: now,
    dersHatirlatma: dersSonuc.yazilan,
    hesapsizUye: dersSonuc.hesapsiz,
    paketUyarisi: paketSonuc.uyeye,
    kocUyarisi: paketSonuc.koca,
    kocGunOzeti: ozetSonuc,
  };
}

// ── 1. Ders hatırlatmaları ────────────────────────────────────

async function dersHatirlatmalari(
  now: Date,
  config: ReminderConfig,
  organizationId?: string,
): Promise<{ yazilan: number; hesapsiz: number }> {
  // Yalnız yaklaşan ve yeri kesinleşmiş rezervasyonlar. "bekliyor" durumundaki
  // grup isteği henüz ders değil — onaylanınca ayrı bildirim gider.
  const bookings = await prisma.slotBooking.findMany({
    where: {
      status: "onayli",
      slot: {
        status: "acik",
        startsAt: { gte: now, lte: new Date(now.getTime() + 3 * MS_PER_DAY) },
        ...(organizationId ? { organizationId } : {}),
      },
      member: { remindersEnabled: true },
    },
    select: {
      id: true,
      member: { select: { id: true, userId: true, organizationId: true } },
      slot: { select: { startsAt: true, kind: true, title: true } },
    },
  });

  const due = dueReminders({
    slots: bookings.map((booking) => ({
      bookingId: booking.id,
      startsAt: booking.slot.startsAt,
    })),
    now,
    config,
  });

  const byId = new Map(bookings.map((booking) => [booking.id, booking]));
  const drafts: EnqueueInput[] = [];
  const hesapsiz = new Set<string>();

  for (const item of due) {
    const booking = byId.get(item.bookingId);
    if (!booking) continue;

    if (!booking.member.userId) {
      // Davet kabul edilmemiş: bildirim gidecek hesap yok. Antrenör bunu üye
      // listesinde "davet bekliyor" rozetiyle görüyor.
      hesapsiz.add(booking.member.id);
      continue;
    }

    const startsAt = booking.slot.startsAt;
    const payload = {
      bookingId: booking.id,
      dateKey: toGymDateKey(startsAt),
      timeLabel: formatTimeTR(startsAt),
      kindLabel:
        booking.slot.title ??
        SLOT_KIND_LABEL[booking.slot.kind] ??
        booking.slot.kind,
      scheduledFor: item.scheduledFor,
    };

    const draft =
      item.stage === "aksam"
        ? dersHatirlatmaAksam(payload)
        : dersHatirlatmaGun(payload);

    drafts.push({
      ...draft,
      organizationId: booking.member.organizationId,
      userId: booking.member.userId,
      memberId: booking.member.id,
    });
  }

  return { yazilan: await enqueueMany(drafts), hesapsiz: hesapsiz.size };
}

// ── 2 & 3. Paket uyarıları ────────────────────────────────────

async function paketUyarilari(
  now: Date,
  organizationId?: string,
): Promise<{ uyeye: number; koca: number }> {
  const subscriptions = await prisma.memberSubscription.findMany({
    where: {
      status: "aktif",
      ...(organizationId ? { member: { organizationId } } : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      sessionsTotal: true,
      member: {
        select: {
          id: true,
          fullName: true,
          userId: true,
          organizationId: true,
          remindersEnabled: true,
        },
      },
    },
  });
  if (subscriptions.length === 0) return { uyeye: 0, koca: 0 };

  const bookings = await prisma.slotBooking.findMany({
    where: { memberId: { in: subscriptions.map((row) => row.member.id) } },
    select: {
      memberId: true,
      status: true,
      slot: { select: { startsAt: true } },
    },
  });

  const bookingsByMember = new Map<
    string,
    { status: BookingStatus; startsAt: Date }[]
  >();
  for (const row of bookings) {
    const list = bookingsByMember.get(row.memberId) ?? [];
    list.push({
      status: row.status as BookingStatus,
      startsAt: row.slot.startsAt,
    });
    bookingsByMember.set(row.memberId, list);
  }

  const dateKey = toGymDateKey(now);
  const uyeDraftlari: EnqueueInput[] = [];
  const kocDraftlari: EnqueueInput[] = [];

  const staffByOrg = await staffUserIdsByOrganization([
    ...new Set(subscriptions.map((row) => row.member.organizationId)),
  ]);

  for (const subscription of subscriptions) {
    const inPeriod = (bookingsByMember.get(subscription.member.id) ?? []).filter(
      (booking) =>
        booking.startsAt >= subscription.startDate &&
        booking.startsAt <= subscription.endDate,
    );
    const credits = summarizeCredits({
      total: subscription.sessionsTotal,
      bookingStatuses: inPeriod.map((booking) => booking.status),
    });
    const daysLeft = Math.ceil(
      (subscription.endDate.getTime() - now.getTime()) / MS_PER_DAY,
    );

    const warning = packageWarning({
      daysLeft,
      sessionsRemaining: credits.remaining,
    });
    if (warning === "yok") continue;

    if (subscription.member.userId && subscription.member.remindersEnabled) {
      const draft =
        warning === "bitti"
          ? paketBitti({
              subscriptionId: subscription.id,
              dateKey,
              scheduledFor: now,
            })
          : paketBitiyor({
              subscriptionId: subscription.id,
              dateKey,
              daysLeft,
              sessionsRemaining: credits.remaining,
              scheduledFor: now,
            });

      uyeDraftlari.push({
        ...draft,
        organizationId: subscription.member.organizationId,
        userId: subscription.member.userId,
        memberId: subscription.member.id,
      });
    }

    // Antrenöre yalnız "bitiyor" gider: bitmiş paket zaten üyelik ekranında
    // kırmızı duruyor, ikinci bildirim gürültü olurdu.
    if (warning === "bitiyor") {
      const draft = kocPaketBitiyor({
        subscriptionId: subscription.id,
        memberName: subscription.member.fullName,
        dateKey,
        daysLeft,
        sessionsRemaining: credits.remaining,
        scheduledFor: now,
      });

      const staffIds = staffByOrg.get(subscription.member.organizationId) ?? [];
      for (const userId of staffIds) {
        kocDraftlari.push({
          ...draft,
          dedupeKey: `${draft.dedupeKey}:${userId}`,
          organizationId: subscription.member.organizationId,
          userId,
          memberId: subscription.member.id,
        });
      }
    }
  }

  const [uyeye, koca] = await Promise.all([
    enqueueMany(uyeDraftlari),
    enqueueMany(kocDraftlari),
  ]);

  return { uyeye, koca };
}

async function staffUserIdsByOrganization(
  organizationIds: string[],
): Promise<Map<string, string[]>> {
  const rows = await prisma.organizationUser.findMany({
    where: {
      organizationId: { in: organizationIds },
      status: "active",
      role: { in: ["coach", "admin", "staff"] },
    },
    select: { organizationId: true, userId: true },
  });

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.organizationId) ?? [];
    list.push(row.userId);
    map.set(row.organizationId, list);
  }
  return map;
}

// ── 4. Antrenörün gün özeti ───────────────────────────────────

const gymHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GYM_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

async function kocGunOzetleri(
  now: Date,
  config: ReminderConfig,
  organizationId?: string,
): Promise<number> {
  // Özet akşam hatırlatmasıyla aynı anda çıkar: "yarın şu kadar seansın var".
  const yarinKey = toGymDateKey(new Date(now.getTime() + MS_PER_DAY));
  if (previousDateKey(yarinKey) !== toGymDateKey(now)) return 0;
  if (Number(gymHourFormatter.format(now)) < config.eveningHour) return 0;

  const slots = await prisma.trainingSlot.findMany({
    where: {
      status: "acik",
      startsAt: { gte: now, lte: new Date(now.getTime() + 2 * MS_PER_DAY) },
      ...(organizationId ? { organizationId } : {}),
    },
    select: {
      coachUserId: true,
      organizationId: true,
      startsAt: true,
      bookings: {
        where: { status: { in: ["onayli", "bekliyor"] } },
        select: { id: true },
      },
    },
  });

  type Sayac = { organizationId: string; toplam: number; dolu: number };
  const byCoach = new Map<string, Sayac>();

  for (const slot of slots) {
    if (toGymDateKey(slot.startsAt) !== yarinKey) continue;
    const current = byCoach.get(slot.coachUserId) ?? {
      organizationId: slot.organizationId,
      toplam: 0,
      dolu: 0,
    };
    current.toplam += 1;
    if (slot.bookings.length > 0) current.dolu += 1;
    byCoach.set(slot.coachUserId, current);
  }

  const drafts: EnqueueInput[] = [...byCoach.entries()].map(
    ([coachUserId, sayac]) => ({
      ...kocGunOzeti({
        coachUserId,
        dateKey: yarinKey,
        slotCount: sayac.toplam,
        bookedCount: sayac.dolu,
        emptyCount: sayac.toplam - sayac.dolu,
        scheduledFor: now,
      }),
      organizationId: sayac.organizationId,
      userId: coachUserId,
    }),
  );

  return enqueueMany(drafts);
}

/** Antrenörün "şimdi hatırlat" düğmesi — tek rezervasyona elden bildirim. */
export async function sendManualReminder(
  bookingId: string,
  organizationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const booking = await prisma.slotBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      member: { select: { id: true, userId: true, organizationId: true } },
      slot: { select: { startsAt: true, kind: true, title: true } },
    },
  });

  if (!booking || booking.member.organizationId !== organizationId) {
    return { ok: false, error: "Rezervasyon bulunamadı." };
  }
  if (!booking.member.userId) {
    return { ok: false, error: "Sporcu henüz hesabını kurmadı." };
  }
  if (booking.status !== "onayli") {
    return {
      ok: false,
      error: "Yalnız kesinleşmiş rezervasyona hatırlatma gider.",
    };
  }

  const startsAt = booking.slot.startsAt;
  const draft = dersHatirlatmaGun({
    bookingId: booking.id,
    // Elden gönderim tekrarlanabilsin diye anahtar ana bağlanır — otomatik
    // hatırlatmanın günlük anahtarını bozmaz.
    dateKey: `elden-${Date.now()}`,
    timeLabel: formatDateTimeTR(startsAt),
    kindLabel:
      booking.slot.title ??
      SLOT_KIND_LABEL[booking.slot.kind] ??
      booking.slot.kind,
    scheduledFor: new Date(),
  });

  await enqueueMany([
    {
      ...draft,
      organizationId,
      userId: booking.member.userId,
      memberId: booking.member.id,
    },
  ]);

  return { ok: true };
}
