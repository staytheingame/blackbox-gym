/**
 * Antrenman şablonu sözlüğü — tür, seviye, hareket cinsi ve gün adları.
 *
 * Domain katmanında duruyor çünkü hem sunucu sorguları (`lib/queries/plans.ts`)
 * hem de istemci formları (şablon düzenleyici) aynı listeleri okuyor.
 * `lib/queries/plans.ts` `server-only` işaretli; oradan import eden bir
 * "use client" bileşeni derlenmez.
 */

export const PLAN_KINDS = ["antrenman", "kondisyon"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  antrenman: "Antrenman",
  kondisyon: "Kondisyon",
};

export const PLAN_LEVELS = ["baslangic", "orta", "ileri"] as const;
export type PlanLevel = (typeof PLAN_LEVELS)[number];

export const PLAN_LEVEL_LABEL: Record<string, string> = {
  baslangic: "Başlangıç",
  orta: "Orta",
  ileri: "İleri",
};

export const PLAN_ITEM_KINDS = [
  "teknik",
  "torba",
  "ped",
  "sparring",
  "kondisyon",
  "kuvvet",
  "esneme",
] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

export const PLAN_ITEM_KIND_LABEL: Record<string, string> = {
  teknik: "Teknik",
  torba: "Torba",
  ped: "Ped",
  sparring: "Sparring",
  kondisyon: "Kondisyon",
  kuvvet: "Kuvvet",
  esneme: "Esneme",
};

export const DAY_LABEL: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

/** Saniye → panelde okunan kısa süre metni. Boş/sıfır süre `null` döner. */
export function formatItemDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return seconds >= 60 ? `${Math.round(seconds / 60)} dk` : `${seconds} sn`;
}

/** Hareketin round/süre/dinlenme/RPE satırı — "3 round · 3 dk · RPE 7". */
export function describePlanItem(item: {
  rounds: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  targetRpe: number | null;
}): string {
  return [
    item.rounds ? `${item.rounds} round` : null,
    formatItemDuration(item.durationSeconds),
    item.restSeconds ? `${item.restSeconds} sn dinlenme` : null,
    item.targetRpe ? `RPE ${item.targetRpe}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
