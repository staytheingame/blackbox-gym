export type BadgeKey =
  | "ilk-yumruk" // ilk check-in
  | "dort-hafta-seri" // 4 hafta üst üste check-in
  | "on-antrenman" // 10 training log
  | "yuksek-performans"; // 85+ genel skor

export const BADGE_DEFINITIONS: Record<
  BadgeKey,
  { name: string; description: string }
> = {
  "ilk-yumruk": {
    name: "İlk Yumruk",
    description: "İlk check-in'ini gönderdin.",
  },
  "dort-hafta-seri": {
    name: "4 Hafta Seri",
    description: "4 hafta üst üste check-in gönderdin.",
  },
  "on-antrenman": {
    name: "10 Antrenman",
    description: "10 antrenman logladın.",
  },
  "yuksek-performans": {
    name: "Yüksek Performans",
    description: "Genel skor 85 ve üzerine ulaştı.",
  },
};

export type BadgeEvalContext = {
  totalCheckIns: number;
  consecutiveWeeks: number;
  totalTrainingLogs: number;
  latestOverallScore: number;
  alreadyAwarded: BadgeKey[];
};

/** Yeni hak edilen (henüz verilmemiş) rozetleri döner. Saf fonksiyon. */
export function evaluateNewBadges(ctx: BadgeEvalContext): BadgeKey[] {
  const earned: BadgeKey[] = [];
  const has = (key: BadgeKey) => ctx.alreadyAwarded.includes(key);

  if (ctx.totalCheckIns >= 1 && !has("ilk-yumruk")) {
    earned.push("ilk-yumruk");
  }
  if (ctx.consecutiveWeeks >= 4 && !has("dort-hafta-seri")) {
    earned.push("dort-hafta-seri");
  }
  if (ctx.totalTrainingLogs >= 10 && !has("on-antrenman")) {
    earned.push("on-antrenman");
  }
  if (ctx.latestOverallScore >= 85 && !has("yuksek-performans")) {
    earned.push("yuksek-performans");
  }

  return earned;
}
