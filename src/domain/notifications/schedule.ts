/**
 * Ders hatırlatmalarının ZAMANI — saf mantık, veritabanı ve saat dilimi
 * dönüşümü dışındaki her şey burada.
 *
 * İki hatırlatma var, ikisi de sporcunun istediği:
 *   1. **Önceki gün akşam** — "yarın dersin var". Amaç plan yapmak:
 *      gelemeyecekse akşamdan iptal eder, hakkı yanmaz, yer başkasına kalır.
 *   2. **Dersin olduğu gün** — sabah. Amaç unutmamak.
 *
 * Kaçırılan çalışma (cron gece düşerse) hatırlatmayı iptal etmez: seans
 * BAŞLAMADIĞI sürece geç de olsa gönderilir. Başlamış seansın hatırlatması
 * ise anlamsızdır — üretilmez.
 */

import { gymDateTimeToInstant, toGymDateKey } from "@/lib/date";

export type ReminderConfig = {
  /** Önceki gün kaçta (salon saati). */
  eveningHour: number;
  /** Ders günü kaçta (salon saati). */
  sameDayHour: number;
  /**
   * Ders bu kadar saatten yakınsa "gün içi" hatırlatması ayrıca üretilmez —
   * sabah 09:00 hatırlatması saat 09:30 dersi için gürültüdür.
   */
  sameDayMinLeadHours: number;
};

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  eveningHour: 20,
  sameDayHour: 9,
  sameDayMinLeadHours: 1,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Salon saatiyle `dateKey`'in bir önceki günü. */
export function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const civil = new Date(Date.UTC(year, month - 1, day));
  civil.setUTCDate(civil.getUTCDate() - 1);
  return `${civil.getUTCFullYear()}-${pad(civil.getUTCMonth() + 1)}-${pad(
    civil.getUTCDate(),
  )}`;
}

/** Seansın bir önceki günü, salon saatiyle akşam saati. */
export function eveningReminderAt(
  slotStartsAt: Date,
  config: ReminderConfig = DEFAULT_REMINDER_CONFIG,
): Date {
  const dayBefore = previousDateKey(toGymDateKey(slotStartsAt));
  return gymDateTimeToInstant(dayBefore, `${pad(config.eveningHour)}:00`);
}

/** Seansın kendi günü, salon saatiyle sabah saati. */
export function sameDayReminderAt(
  slotStartsAt: Date,
  config: ReminderConfig = DEFAULT_REMINDER_CONFIG,
): Date {
  return gymDateTimeToInstant(
    toGymDateKey(slotStartsAt),
    `${pad(config.sameDayHour)}:00`,
  );
}

export type ReminderStage = "aksam" | "gun";

export type ReminderSlot = {
  bookingId: string;
  startsAt: Date;
};

export type DueReminder = {
  bookingId: string;
  stage: ReminderStage;
  /** Hatırlatmanın planlanan anı — geç çalışmada bile bu değer yazılır. */
  scheduledFor: Date;
};

/**
 * `now` anında gönderilmesi gereken hatırlatmalar.
 *
 * Bir hatırlatma "gerekli"dir çünkü: planlanan anı geçmiş, seans henüz
 * başlamamış. Tekrarı `Notification.dedupeKey` engeller — bu fonksiyon aynı
 * satırı her çalışmada üretir, veritabanı ikinciyi yutar.
 */
export function dueReminders(input: {
  slots: ReminderSlot[];
  now: Date;
  config?: ReminderConfig;
}): DueReminder[] {
  const config = input.config ?? DEFAULT_REMINDER_CONFIG;
  const now = input.now.getTime();
  const out: DueReminder[] = [];

  for (const slot of input.slots) {
    const startsAt = slot.startsAt.getTime();
    if (startsAt <= now) continue; // seans başladı — hatırlatmanın işi bitti

    const evening = eveningReminderAt(slot.startsAt, config);
    if (evening.getTime() <= now) {
      out.push({ bookingId: slot.bookingId, stage: "aksam", scheduledFor: evening });
    }

    const sameDay = sameDayReminderAt(slot.startsAt, config);
    const leadMs = startsAt - sameDay.getTime();
    const enoughLead = leadMs >= config.sameDayMinLeadHours * 3_600_000;
    if (enoughLead && sameDay.getTime() <= now) {
      out.push({ bookingId: slot.bookingId, stage: "gun", scheduledFor: sameDay });
    }
  }

  return out;
}

/**
 * Paket uyarısının eşikleri. Antrenörün "bitmeden haberim olsun" dediği an:
 * iki hafta ya da son üç ders — hangisi önce gelirse.
 */
export const PACKAGE_WARN_DAYS = 14;
export const PACKAGE_WARN_SESSIONS = 3;

export type PackageWarning = "yok" | "bitiyor" | "bitti";

export function packageWarning(input: {
  daysLeft: number;
  sessionsRemaining: number | null;
}): PackageWarning {
  if (input.daysLeft < 0) return "bitti";
  if (input.sessionsRemaining !== null && input.sessionsRemaining <= 0) {
    return "bitti";
  }
  if (input.daysLeft <= PACKAGE_WARN_DAYS) return "bitiyor";
  if (
    input.sessionsRemaining !== null &&
    input.sessionsRemaining <= PACKAGE_WARN_SESSIONS
  ) {
    return "bitiyor";
  }
  return "yok";
}
