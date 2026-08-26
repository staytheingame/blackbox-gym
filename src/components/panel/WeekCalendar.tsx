import Link from "next/link";
import type { ReactNode } from "react";
import { formatTimeTR, gymDayOfWeek, toGymDateKey } from "@/lib/date";

/**
 * HAFTALIK TAKVIM IZGARASI — antrenörün saat açtığı, sporcunun saat seçtiği
 * ortak görünüm.
 *
 * Neden ızgara: ders programı "hangi günler boşum" sorusudur ve düz liste bu
 * soruya cevap vermiyordu — Salı ile Perşembe arasındaki boşluk listede
 * görünmüyor, ızgarada gözle görülüyor. Aynı bileşen iki panelde de kullanılır
 * (`/personel/program`, `/uye/program`), yalnız hücrenin içeriği değişir.
 *
 * Konumlandırma SAAT BANDI iledir, dakikaya göre piksel değil: 19:00 ve 19:30
 * aynı hücrede alt alta durur. Dakika hassasiyetinde mutlak konumlandırma
 * çakışan seanslarda üst üste biner ve dokunma hedeflerini bozar; salonda bir
 * saatte iki seans zaten nadir.
 *
 * MOBİL: 7 sütun 375px'e sığmaz. `sm` altında ızgara gizlenir, çağıran sayfa
 * `fallback` olarak gün gün listesini basar — ızgarayı yatay kaydırmaya
 * zorlamak yerine. Aynı veri, iki düzen.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Izgarada bir seans. `tone` hücrenin rengini belirler. */
export type CalendarEntry = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  /** Saatin altındaki ilk satır — ders türü ya da başlık. */
  label: string;
  /** İkinci satır — kim kayıtlı, kaç kişi. */
  detail?: string;
  tone: CalendarTone;
  /** Hücreye tıklanınca gidilecek yer (sporcu tarafında kullanılmıyor). */
  href?: string;
  /** Hücrenin altına düşen buton — rezervasyon, iptal. */
  action?: ReactNode;
};

export type CalendarTone =
  | "acik" // boş yeri var
  | "dolu" // kontenjan doldu
  | "benim" // sporcunun kendi rezervasyonu
  | "bekliyor" // onay bekleyen istek
  | "iptal";

const TONE_CLASS: Record<CalendarTone, string> = {
  acik: "border-brand-yellow/50 bg-brand-yellow/10 text-brand-white",
  dolu: "border-brand-border bg-brand-surface-2 text-brand-muted",
  benim: "border-brand-yellow bg-brand-yellow/25 text-brand-white",
  bekliyor: "border-brand-yellow/40 bg-brand-black text-brand-yellow",
  iptal: "border-red-400/30 bg-red-400/5 text-red-300/70 line-through",
};

const DAY_LABEL = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Hiç seans yoksa da tıklanacak bir şey olsun diye varsayılan pencere. */
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 22;

/** Salon saatiyle seansın başladığı saat bandı (0–23). */
function startHour(entry: CalendarEntry): number {
  return Number(formatTimeTR(entry.startsAt).slice(0, 2));
}

function hourWindow(entries: CalendarEntry[]): number[] {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;

  for (const entry of entries) {
    const [hour, minute] = formatTimeTR(entry.startsAt).split(":").map(Number);
    // Seans biterken de görünsün: 21:30 + 90dk 23:00 bandına taşar.
    // `-1`: tam saatte biten seans bir sonraki bandı açmasın (20:00 + 60dk
    // 20:00 bandında biter, 21:00'i gereksiz yere açmaz).
    const endHour = Math.floor((hour * 60 + minute + entry.durationMinutes - 1) / 60);
    if (hour < first) first = hour;
    // Gece yarısını aşan seans varsa pencere 23'te durur; taşan kısım o gün
    // gösterilmez — ertesi güne sarkan seans salonda yok.
    if (endHour > last) last = Math.min(endHour, 23);
  }

  return Array.from({ length: Math.max(last - first + 1, 1) }, (_, i) => first + i);
}

export function WeekCalendar({
  weekStart,
  entries,
  /**
   * Boş hücrenin bağlantısı — antrenör panelinde "bu gün/saate ders aç".
   * Verilmezse boş hücreler tıklanmaz (sporcu paneli).
   */
  emptyHref,
  todayKey,
  fallback,
}: {
  weekStart: Date;
  entries: CalendarEntry[];
  emptyHref?: (dateKey: string, time: string) => string;
  todayKey?: string;
  /** `sm` altında ızgara yerine basılacak düzen. */
  fallback?: ReactNode;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * MS_PER_DAY);
    return { date, key: toGymDateKey(date) };
  });

  const hours = hourWindow(entries);

  // (gün, saat) → o bantta başlayan seanslar
  const cells = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = `${toGymDateKey(entry.startsAt)}|${String(startHour(entry)).padStart(2, "0")}`;
    cells.set(key, [...(cells.get(key) ?? []), entry]);
  }

  return (
    <>
      {/* Dar ekranda ızgara okunmuyor — çağıranın listesi devralır. */}
      {fallback && <div className="sm:hidden">{fallback}</div>}

      <div className="hidden overflow-x-auto sm:block">
        <div className="min-w-[44rem]">
          {/* Gün başlıkları */}
          <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-brand-border">
            <div />
            {days.map((day, index) => {
              const isToday = todayKey === day.key;
              return (
                <div
                  key={day.key}
                  className={`px-1.5 py-2 text-center text-[0.7rem] font-bold uppercase tracking-wide ${
                    isToday ? "text-brand-yellow" : "text-brand-muted"
                  }`}
                >
                  {DAY_LABEL[index]}
                  <span className="ml-1 font-normal normal-case">
                    {day.key.slice(8)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Saat bantları */}
          {hours.map((hour) => {
            const time = `${String(hour).padStart(2, "0")}:00`;
            return (
              <div
                key={hour}
                className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-brand-border/60 last:border-b-0"
              >
                <div className="px-1.5 py-2 text-right text-[0.7rem] tabular-nums text-brand-muted">
                  {time}
                </div>

                {days.map((day) => {
                  const inCell = cells.get(`${day.key}|${String(hour).padStart(2, "0")}`) ?? [];

                  if (inCell.length === 0) {
                    const href = emptyHref?.(day.key, time);
                    return (
                      <div
                        key={day.key}
                        className="border-l border-brand-border/60 p-0.5"
                      >
                        {href ? (
                          <Link
                            href={href}
                            aria-label={`${day.key} ${time} için ders aç`}
                            className="flex min-h-9 w-full items-center justify-center rounded-sm text-brand-border transition-colors hover:bg-brand-yellow/10 hover:text-brand-yellow"
                          >
                            <span aria-hidden className="text-sm leading-none">
                              +
                            </span>
                          </Link>
                        ) : (
                          <div className="min-h-9" />
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={day.key}
                      className="space-y-0.5 border-l border-brand-border/60 p-0.5"
                    >
                      {inCell.map((entry) => (
                        <CalendarCell key={entry.id} entry={entry} />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function CalendarCell({ entry }: { entry: CalendarEntry }) {
  const body = (
    <>
      <div className="text-[0.7rem] font-bold tabular-nums leading-tight">
        {formatTimeTR(entry.startsAt)}
      </div>
      <div className="truncate text-[0.65rem] leading-tight opacity-90">
        {entry.label}
      </div>
      {entry.detail && (
        <div className="truncate text-[0.6rem] leading-tight opacity-70">
          {entry.detail}
        </div>
      )}
    </>
  );

  const className = `block rounded-sm border px-1.5 py-1 ${TONE_CLASS[entry.tone]}`;

  return (
    <div className="space-y-0.5">
      {entry.href ? (
        <Link
          href={entry.href}
          className={`${className} transition-colors hover:border-brand-yellow`}
        >
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
      {entry.action}
    </div>
  );
}

/** Izgaranın altındaki renk açıklaması — hücrelerde metin yerine renk var. */
export function CalendarLegend({
  items,
}: {
  items: { tone: CalendarTone; label: string }[];
}) {
  return (
    <div className="mt-4 hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
      {items.map((item) => (
        <span
          key={item.tone}
          className="flex items-center gap-1.5 text-[0.7rem] text-brand-muted"
        >
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-sm border ${TONE_CLASS[item.tone]}`}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** `gymDayOfWeek` ile aynı sırayı kullanan gün etiketi — dışarıdan da lazım. */
export function shortDayLabel(date: Date): string {
  return DAY_LABEL[gymDayOfWeek(date) - 1];
}
