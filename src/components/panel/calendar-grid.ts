import {
  formatTimeTR,
  gymDayOfWeek,
  toGymDateKey,
} from "@/lib/date";

/**
 * TAKVIM IZGARASININ SAF KISMI — tipler, renkler, gün/saat hesapları.
 *
 * `WeekBoard` bir istemci bileşenidir; buradaki hesaplar ise sunucuda da
 * lazım (gün anahtarları salon saat diliminde üretilmek zorunda, tarayıcının
 * saatine göre değil — Istanbul'da 00:30'da açılan panel bir önceki günü
 * göstermemeli). Bu yüzden saf olan her şey bu dosyada, "use client" yok.
 */

export type CalendarTone =
  | "acik" // boş yeri var
  | "dolu" // kontenjan doldu
  | "benim" // sporcunun kendi rezervasyonu
  | "bekliyor" // onay bekleyen istek
  | "iptal";

export const TONE_CLASS: Record<CalendarTone, string> = {
  acik: "border-brand-yellow/50 bg-brand-yellow/10 text-brand-white",
  dolu: "border-brand-border bg-brand-surface-2 text-brand-muted",
  benim: "border-brand-yellow bg-brand-yellow/25 text-brand-white",
  bekliyor: "border-brand-yellow/40 bg-brand-black text-brand-yellow",
  iptal: "border-red-400/30 bg-red-400/5 text-red-300/70 line-through",
};

/** Izgaradaki bir seans. Konum `dateKey`+`hour` ile; dakika hassasiyeti yok. */
export type BoardEntry = {
  id: string;
  /** "2026-09-18" — salon saatiyle. */
  dateKey: string;
  /** "19:30" — hücre içinde yazar, hücre yerini `hour` belirler. */
  time: string;
  /** Hangi saat bandına düşsün (0–23). */
  hour: number;
  /** İlk satır: ders türü ya da başlık. */
  label: string;
  /** İkinci satır: kim kayıtlı, kaç kişi. */
  detail?: string;
  tone: CalendarTone;
  /**
   * Hücrenin altına düşen buton — rezervasyon, iptal (sunucuda üretilir).
   *
   * DİKKAT: ızgara `composer` ile kullanıldığında burada `<form>` OLAMAZ;
   * ızgara o durumda bir formun içindedir ve HTML iç içe form kabul etmez
   * (React hidrasyonu patlar, form hiç gönderilmez). Eylem o zaman
   * `formAction` + `formNoValidate` taşıyan bir `<button>` olarak verilir —
   * örnek: `src/app/personel/program/page.tsx`.
   */
  action?: React.ReactNode;
};

export type BoardDay = {
  /** "2026-09-18" */
  key: string;
  /** "Pzt" */
  label: string;
  /** "18" */
  dayNumber: string;
  /** "18 Eyl" — mobil gün seçicide. */
  shortLabel: string;
};

const DAY_LABEL = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

/** `gymDayOfWeek` ile aynı sırayı kullanan gün etiketi. */
export function shortDayLabel(date: Date): string {
  return DAY_LABEL[gymDayOfWeek(date) - 1];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Haftanın yedi günü — etiketler salon saat diliminde üretilir. */
export function buildDays(weekStart: Date): BoardDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * MS_PER_DAY);
    const key = toGymDateKey(date);
    const dayNumber = key.slice(8);
    const monthIndex = Number(key.slice(5, 7)) - 1;

    return {
      key,
      label: DAY_LABEL[index],
      dayNumber,
      shortLabel: `${Number(dayNumber)} ${MONTH_SHORT[monthIndex] ?? ""}`.trim(),
    };
  });
}

/** Saat bandına düşen başlangıç saati (0–23), salon saatiyle. */
export function entryHour(startsAt: Date): number {
  return Number(formatTimeTR(startsAt).slice(0, 2));
}

export type HourWindow = { first: number; last: number };

/**
 * Izgaranın saat penceresi.
 *
 * `bounds` çağıranın istediği en geniş aralık: antrenör saat AÇARKEN sabah
 * 07'den gece 23'e kadar her bandı görmeli (boş hücreye basacak), sporcu ise
 * yalnız ders olan saatleri görsün diye pencere seansa göre daralır.
 * Seans pencerenin dışına taşarsa pencere genişler — 06:00'daki bir seans
 * gizlenmez.
 */
export function hourWindow(
  entries: { hour: number; durationMinutes?: number; time?: string }[],
  bounds: HourWindow = { first: 8, last: 22 },
): string[] {
  let first = bounds.first;
  let last = bounds.last;

  for (const entry of entries) {
    const minute = entry.time ? Number(entry.time.slice(3, 5)) : 0;
    // Seans biterken de görünsün: 21:30 + 90dk 23:00 bandına taşar.
    // `-1`: tam saatte biten seans bir sonraki bandı açmasın.
    const endHour = Math.floor(
      (entry.hour * 60 + minute + (entry.durationMinutes ?? 60) - 1) / 60,
    );
    if (entry.hour < first) first = entry.hour;
    // Gece yarısını aşan seansta pencere 23'te durur.
    if (endHour > last) last = Math.min(endHour, 23);
  }

  return Array.from({ length: Math.max(last - first + 1, 1) }, (_, index) =>
    `${String(first + index).padStart(2, "0")}:00`,
  );
}

/** "2026-09-18|19" — hücre anahtarı. */
export function cellKey(dateKey: string, hour: number | string): string {
  const padded =
    typeof hour === "number" ? String(hour).padStart(2, "0") : hour.slice(0, 2);
  return `${dateKey}|${padded}`;
}
