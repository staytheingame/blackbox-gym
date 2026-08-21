/**
 * Sıklet tablosu — tartı/kilo takibinin fight tarafı.
 *
 * Amatör boks sıkletleri esas alındı; salon içi eşleştirme ve sparring
 * gecelerinde kullanılır. `WeightGoal.weightClass` bu slug'ları tutar.
 */

export type WeightClass = {
  slug: string;
  name: string;
  /** Üst sınır (kg). En ağır sıklette `null` — üstü açık. */
  maxKg: number | null;
};

export const weightClasses: WeightClass[] = [
  { slug: "sinek", name: "Sinek", maxKg: 52 },
  { slug: "horoz", name: "Horoz", maxKg: 56 },
  { slug: "tuy", name: "Tüy", maxKg: 60 },
  { slug: "hafif", name: "Hafif", maxKg: 64 },
  { slug: "yari-orta", name: "Yarı Orta", maxKg: 69 },
  { slug: "orta", name: "Orta", maxKg: 75 },
  { slug: "yari-agir", name: "Yarı Ağır", maxKg: 81 },
  { slug: "agir", name: "Ağır", maxKg: 91 },
  { slug: "super-agir", name: "Süper Ağır", maxKg: null },
];

export function weightClassBySlug(slug: string | null): WeightClass | null {
  if (!slug) return null;
  return weightClasses.find((weightClass) => weightClass.slug === slug) ?? null;
}

/** Verilen kiloya karşılık gelen sıklet. */
export function weightClassForKg(kg: number): WeightClass {
  return (
    weightClasses.find((weightClass) => weightClass.maxKg !== null && kg <= weightClass.maxKg) ??
    weightClasses[weightClasses.length - 1]
  );
}
