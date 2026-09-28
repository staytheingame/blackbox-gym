import { addGymDays, formatTimeTR, toGymDateKey } from "@/lib/date";

/**
 * HAFTALIK SHIFT — antrenörün bu hafta hangi gün hangi saatlerde çalıştığı.
 *
 * Tek tek seans yerine **çalışma aralığı** gösterilir: 10:00, 11:00 ve 12:00
 * saatleri açıksa "10:00–13:00 · 3 ders". Bitişik ya da üst üste binen
 * seanslar tek aralıkta birleşir; aralarda boşluk varsa ayrı aralık olur
 * (öğle arası gibi). İptal edilmiş seans shift'e girmez.
 */

export type ShiftSlotInput = {
  startsAt: Date;
  durationMinutes: number;
  status: string;
  takenSeats: number;
  capacity: number;
};

export type ShiftRange = {
  /** "10:00" — aralığın ilk seansının başlangıcı. */
  start: string;
  /** "13:00" — aralığın son seansının bitişi. */
  end: string;
  /** Aralıktaki seans sayısı. */
  slotCount: number;
  /** Aralıkta yeri tutulmuş toplam sporcu / toplam kontenjan. */
  takenSeats: number;
  capacity: number;
};

export type ShiftDay = {
  /** "2026-09-28" — salon saatiyle. */
  dateKey: string;
  date: Date;
  isToday: boolean;
  ranges: ShiftRange[];
  slotCount: number;
};

const MS_PER_MINUTE = 60_000;

type Interval = { startMs: number; endMs: number; taken: number; capacity: number };

function mergeIntervals(intervals: Interval[]): ShiftRange[] {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: { startMs: number; endMs: number; count: number; taken: number; capacity: number }[] = [];

  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    // Bitişik (son.bitiş == yeni.başlangıç) ve üst üste binen seanslar birleşir.
    if (last && interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs);
      last.count += 1;
      last.taken += interval.taken;
      last.capacity += interval.capacity;
    } else {
      merged.push({
        startMs: interval.startMs,
        endMs: interval.endMs,
        count: 1,
        taken: interval.taken,
        capacity: interval.capacity,
      });
    }
  }

  return merged.map((range) => ({
    start: formatTimeTR(new Date(range.startMs)),
    end: formatTimeTR(new Date(range.endMs)),
    slotCount: range.count,
    takenSeats: range.taken,
    capacity: range.capacity,
  }));
}

/**
 * `weekStart` haftanın Pazartesi 00:00 (salon saati) anıdır
 * (`getWeekStartInstant`). Yedi gün döner, seansı olmayan gün boş aralıkla.
 */
export function buildWeekShift(
  slots: ShiftSlotInput[],
  weekStart: Date,
  now: Date,
): ShiftDay[] {
  const todayKey = toGymDateKey(now);

  const byDay = new Map<string, Interval[]>();
  for (const slot of slots) {
    if (slot.status === "iptal") continue;
    const key = toGymDateKey(slot.startsAt);
    const list = byDay.get(key) ?? [];
    list.push({
      startMs: slot.startsAt.getTime(),
      endMs: slot.startsAt.getTime() + slot.durationMinutes * MS_PER_MINUTE,
      taken: slot.takenSeats,
      capacity: slot.capacity,
    });
    byDay.set(key, list);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addGymDays(weekStart, index);
    const dateKey = toGymDateKey(date);
    const intervals = byDay.get(dateKey) ?? [];

    return {
      dateKey,
      date,
      isToday: dateKey === todayKey,
      ranges: mergeIntervals(intervals),
      slotCount: intervals.length,
    };
  });
}
