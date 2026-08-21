/**
 * Salonun takvimi Türkiye saatiyle işler: Pazartesi 00:00 Istanbul'da yeni
 * hafta başlar, UTC'de değil. Aradaki 3 saat gerçek bir farktır — Pazartesi
 * sabah 01:00'de yapılan check-in UTC'ye göre hâlâ "geçen hafta" sayılırdı.
 *
 * İki ayrı kavram var, karıştırılmamalı:
 *   - `getWeekStart`        → haftanın ETİKETİ (UTC gece yarısı olarak saklanır,
 *                             `CheckIn.weekStart` ve `MemberPlan.startDate` anahtarı)
 *   - `getWeekStartInstant` → haftanın gerçekten başladığı AN (zaman damgası
 *                             filtrelerinde: `loggedAt >= ...`)
 */
export const GYM_TIME_ZONE = "Europe/Istanbul";

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GYM_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date): ZonedParts {
  const parts = zonedFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

/** Salon saat diliminin o andaki UTC farkı (ms) — DST'ye girilirse de doğru kalır. */
function zoneOffsetMs(date: Date): number {
  const parts = zonedParts(date);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds(),
  );
  return asIfUtc - date.getTime();
}

/**
 * Verilen anın Istanbul'da ait olduğu haftanın Pazartesi'si — takvim günü
 * olarak, UTC gece yarısına sabitlenmiş hâlde (veritabanı anahtarı budur).
 */
export function getWeekStart(date: Date): Date {
  const parts = zonedParts(date);
  const civil = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOfWeek = civil.getUTCDay(); // 0 = Pazar, 1 = Pazartesi …
  civil.setUTCDate(civil.getUTCDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
  return civil;
}

/**
 * Haftanın gerçek başlangıç anı: Istanbul'da Pazartesi 00:00 (= UTC Pazar
 * 21:00). `loggedAt`/`createdAt` gibi zaman damgalarını haftaya göre
 * süzerken bunu kullan — `getWeekStart` üç saat ileriyi işaret eder.
 */
export function getWeekStartInstant(date: Date): Date {
  const civilMonday = getWeekStart(date);
  // İki geçiş: ilk tahmin offset'i yanlış tarafta kalırsa (DST sınırı) düzelir.
  const guess = new Date(civilMonday.getTime() - zoneOffsetMs(date));
  return new Date(civilMonday.getTime() - zoneOffsetMs(guess));
}

/** Salon saat diliminde `YYYY-MM-DD` — takvim günü karşılaştırmaları için. */
export function toGymDateKey(date: Date): string {
  const parts = zonedParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatDateTR(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: GYM_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "19:00" — salon saatiyle. */
export function formatTimeTR(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: GYM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "18 Ağustos Salı" */
export function formatDayTR(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: GYM_TIME_ZONE,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
}

/** "18 Ağustos Salı · 19:00" */
export function formatDateTimeTR(date: Date): string {
  return `${formatDayTR(date)} · ${formatTimeTR(date)}`;
}

/** Salon saatinde 1 = Pazartesi … 7 = Pazar. */
export function gymDayOfWeek(date: Date): number {
  const parts = zonedParts(date);
  const civil = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = civil.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Salon saatiyle verilen gün+saati gerçek bir ana çevirir.
 * `dateKey` = "2026-08-18", `time` = "19:00".
 */
export function gymDateTimeToInstant(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // İki geçiş: ilk tahminin offset'i DST sınırında kayarsa düzelir.
  const guess = new Date(naive - zoneOffsetMs(new Date(naive)));
  return new Date(naive - zoneOffsetMs(guess));
}

/** Salon saatinde günün başlangıç anı — "bugünün tahsilatı" filtresi için. */
export function getDayStartInstant(date: Date): Date {
  return gymDateTimeToInstant(toGymDateKey(date), "00:00");
}

/** Salon saatinde ayın ilk gününün başlangıç anı. */
export function getMonthStartInstant(date: Date): Date {
  return gymDateTimeToInstant(`${toGymMonthKey(date)}-01`, "00:00");
}

/** "2026-08" — salon saatiyle ay anahtarı (maaş tahakkuku bunu kullanır). */
export function toGymMonthKey(date: Date): string {
  return toGymDateKey(date).slice(0, 7);
}

/** Takvim günü ekler ve sonucun gün başlangıcını verir (DST'de kaymaz). */
export function addGymDays(date: Date, days: number): Date {
  const [year, month, day] = toGymDateKey(date).split("-").map(Number);
  const civil = new Date(Date.UTC(year, month - 1, day + days));
  return gymDateTimeToInstant(civil.toISOString().slice(0, 10), "00:00");
}

/** Takvim ayı ekler; sonuç her zaman ayın 1'inin başlangıcıdır. */
export function addGymMonths(date: Date, months: number): Date {
  const [year, month] = toGymMonthKey(date).split("-").map(Number);
  const civil = new Date(Date.UTC(year, month - 1 + months, 1));
  return gymDateTimeToInstant(civil.toISOString().slice(0, 10), "00:00");
}

/** "Ağustos 2026" */
export function formatMonthTR(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: GYM_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "18.08.2026" — tabloda dar sütun için kısa gün. */
export function formatShortDateTR(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: GYM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
