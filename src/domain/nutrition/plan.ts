/**
 * Beslenme planı kuralları — saf fonksiyonlar, veritabanı bilmez.
 *
 * Model Kong Academy'den geliyor (plan → öğün → besin), dövüşçüye göre
 * uyarlandı: makro alanları ZORUNLU DEĞİL. Sıklet düşen sporcuda kalori
 * hesabı işe yarar, çoğu üyede ise "sabah şunu ye, antrenman sonrası bunu"
 * listesi yeterli. Boş makro alanı "bilinmiyor" demektir — sıfır değil, bu
 * yüzden toplamlar `null` besinleri saymaz ve hangi besinin eksik olduğunu
 * ayrıca bildirir.
 */

export const NUTRITION_STATUSES = ["taslak", "aktif", "arsiv"] as const;
export type NutritionStatus = (typeof NUTRITION_STATUSES)[number];

export const NUTRITION_STATUS_LABEL: Record<NutritionStatus, string> = {
  taslak: "Taslak",
  aktif: "Aktif",
  arsiv: "Arşiv",
};

export const DAY_TYPES = [
  "antrenman",
  "dinlenme",
  "tarti-haftasi",
  "serbest",
] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  antrenman: "Antrenman günü",
  dinlenme: "Dinlenme günü",
  "tarti-haftasi": "Tartı haftası",
  serbest: "Serbest",
};

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
  7: "Paz",
};

/** "1,3,5" → [1, 3, 5]. Bozuk/boş girdi boş dizi döner. */
export function parseWeekDays(csv: string | null | undefined): number[] {
  if (!csv) return [];
  const days = csv
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function formatWeekDays(csv: string | null | undefined): string {
  const days = parseWeekDays(csv);
  if (days.length === 0) return "Her gün";
  if (days.length === 7) return "Her gün";
  return days.map((day) => WEEKDAY_SHORT[day]).join(", ");
}

export function serializeWeekDays(days: number[]): string | null {
  const clean = [...new Set(days.filter((day) => day >= 1 && day <= 7))].sort(
    (a, b) => a - b,
  );
  return clean.length === 0 ? null : clean.join(",");
}

// ── Makro toplamları ──────────────────────────────────────────

export type FoodMacros = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Makrosu girilmemiş besin sayısı — toplam "en az bu kadar" demektir. */
  missing: number;
  /** Hiçbir besinde makro yoksa toplam gösterilmez. */
  hasData: boolean;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function sumMacros(foods: FoodMacros[]): MacroTotals {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let missing = 0;
  let counted = 0;

  for (const food of foods) {
    const empty =
      food.calories === null &&
      food.proteinG === null &&
      food.carbsG === null &&
      food.fatG === null;

    if (empty) {
      missing += 1;
      continue;
    }

    counted += 1;
    calories += food.calories ?? 0;
    proteinG += food.proteinG ?? 0;
    carbsG += food.carbsG ?? 0;
    fatG += food.fatG ?? 0;
  }

  return {
    calories: Math.round(calories),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
    missing,
    hasData: counted > 0,
  };
}

/**
 * Plandaki hedefe göre sapma. Hedef yoksa `null` — uydurma yüzde üretilmez.
 * Değer yüzde cinsinden: +8 → hedefin %8 üstünde.
 */
export function macroDeviationPercent(
  actual: number,
  target: number | null | undefined,
): number | null {
  if (!target || target <= 0) return null;
  return Math.round(((actual - target) / target) * 100);
}

// ── Uyum (öğün işaretleme) ────────────────────────────────────

export type ComplianceInput = {
  /** Planda kaç öğün var. */
  mealsPerDay: number;
  /** Kaç gün için bakılıyor. */
  days: number;
  /** Toplam işaretlenmiş öğün sayısı. */
  checked: number;
};

export type Compliance = {
  expected: number;
  checked: number;
  percent: number;
  /** Veri az olduğunda yüzde yanıltıcıdır — açıkça söylenir. */
  confidence: "yok" | "dusuk" | "yeterli";
  label: string;
};

/**
 * Öğün uyumu. Kong'un "danışan planı uyguluyor mu" sorusunun karşılığı.
 *
 * Güven düzeyi bilinçli: 3 günden az veriyle çıkan %100 gerçek bir başarı
 * değildir. Antrenöre "veri az" demek, sahte kesinlikten iyidir.
 */
export function computeCompliance(input: ComplianceInput): Compliance {
  const expected = Math.max(input.mealsPerDay, 0) * Math.max(input.days, 0);

  if (expected === 0) {
    return {
      expected: 0,
      checked: input.checked,
      percent: 0,
      confidence: "yok",
      label: "Plan yok",
    };
  }

  const percent = Math.min(Math.round((input.checked / expected) * 100), 100);
  const confidence = input.days < 3 ? "dusuk" : "yeterli";

  let label: string;
  if (confidence === "dusuk") label = "Veri az";
  else if (percent >= 80) label = "İyi";
  else if (percent >= 50) label = "Dalgalı";
  else label = "Düşük";

  return { expected, checked: input.checked, percent, confidence, label };
}

/** Bugün bu plan geçerli mi? Gün listesi boşsa plan her gün geçerlidir. */
export function planAppliesToDay(
  weekDaysCsv: string | null | undefined,
  gymDayOfWeek: number,
): boolean {
  const days = parseWeekDays(weekDaysCsv);
  return days.length === 0 || days.includes(gymDayOfWeek);
}
