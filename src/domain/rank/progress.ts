/**
 * Kuşak/derece ilerlemesi — saf fonksiyonlar, veritabanı bilmez.
 *
 * Model üç kapıdan oluşur ve **üçü de ayrı okunur**, tek yüzdeye ezilmez
 * (`domain/performance/progress.ts` ile aynı ilke):
 *
 *   1. **Müfredat** — kuşağın teknik/sınav maddeleri antrenörce işaretlendi mi.
 *   2. **Ders sayısı** — yoklaması alınmış kaç derse girdi.
 *   3. **Süre** — son terfiden bu yana kaç hafta geçti.
 *
 * `ready` yalnız "kapılar açık" demektir; terfiyi antrenör verir. Sistem
 * kimseyi otomatik terfi ettirmez — kuşak bir karardır, sayaç değil.
 */

export const REQUIREMENT_KINDS = [
  "teknik",
  "kondisyon",
  "katilim",
  "sinav",
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_KIND_LABEL: Record<RequirementKind, string> = {
  teknik: "Teknik",
  kondisyon: "Kondisyon",
  katilim: "Katılım",
  sinav: "Sınav",
};

export type RequirementState = {
  id: string;
  kind: RequirementKind;
  label: string;
  done: boolean;
};

export type RankGate = {
  /** Bu kuşağa geçmek için gereken en az ders (yoklaması alınmış). */
  minSessions: number;
  /** Son terfiden sonra geçmesi gereken en az hafta. */
  minWeeks: number;
};

export type RankProgress = {
  requirementsDone: number;
  requirementsTotal: number;
  requirementsMet: boolean;
  sessionsDone: number;
  sessionsNeeded: number;
  sessionsMet: boolean;
  weeksDone: number;
  weeksNeeded: number;
  weeksMet: boolean;
  /** Üç kapı da açık — antrenörün önüne "terfi edebilir" diye düşer. */
  ready: boolean;
  /** 0–100. Eşiği sıfır olan (kapısı olmayan) ölçüt yüzdeye karışmaz. */
  percent: number;
  /** İnsan okunur eksikler; boşsa hazır. */
  missing: string[];
};

function ratio(done: number, needed: number): number | null {
  if (needed <= 0) return null; // kapı yok — yüzdeye karışmaz
  return Math.min(done / needed, 1);
}

export function evaluateRankProgress(input: {
  gate: RankGate;
  requirements: RequirementState[];
  /** Yoklaması alınmış ders sayısı (katıldı). */
  attendedSessions: number;
  /** Son terfiden bu yana geçen tam hafta; hiç terfi yoksa kayıt yaşı. */
  weeksSinceLastAward: number;
}): RankProgress {
  const { gate, requirements, attendedSessions, weeksSinceLastAward } = input;

  const requirementsTotal = requirements.length;
  const requirementsDone = requirements.filter((item) => item.done).length;
  const requirementsMet = requirementsDone >= requirementsTotal;

  const sessionsMet = attendedSessions >= gate.minSessions;
  const weeksMet = weeksSinceLastAward >= gate.minWeeks;

  const missing: string[] = [];
  if (!requirementsMet) {
    missing.push(`${requirementsTotal - requirementsDone} müfredat maddesi`);
  }
  if (!sessionsMet) {
    missing.push(`${gate.minSessions - attendedSessions} ders`);
  }
  if (!weeksMet) {
    missing.push(`${gate.minWeeks - weeksSinceLastAward} hafta`);
  }

  const parts = [
    ratio(requirementsDone, requirementsTotal),
    ratio(attendedSessions, gate.minSessions),
    ratio(weeksSinceLastAward, gate.minWeeks),
  ].filter((value): value is number => value !== null);

  const percent =
    parts.length === 0
      ? 100
      : Math.round(
          (parts.reduce((sum, value) => sum + value, 0) / parts.length) * 100,
        );

  return {
    requirementsDone,
    requirementsTotal,
    requirementsMet,
    sessionsDone: attendedSessions,
    sessionsNeeded: gate.minSessions,
    sessionsMet,
    weeksDone: weeksSinceLastAward,
    weeksNeeded: gate.minWeeks,
    weeksMet,
    ready: requirementsMet && sessionsMet && weeksMet,
    percent,
    missing,
  };
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** İki tarih arasındaki TAM hafta sayısı; gelecek tarih 0 döner. */
export function weeksBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_WEEK);
}

/**
 * Merdivende bir sonraki kuşak. Sıralama `order`'a göredir; sporcunun
 * güncel kuşağından SONRAKİ ilk aktif kuşak döner. Hiç kuşağı yoksa
 * merdivenin ilk basamağı hedeftir.
 */
export function nextRankAfter<T extends { order: number; isActive: boolean }>(
  ladder: T[],
  currentOrder: number | null,
): T | null {
  const sorted = [...ladder]
    .filter((rank) => rank.isActive)
    .sort((a, b) => a.order - b.order);

  if (currentOrder === null) return sorted[0] ?? null;
  return sorted.find((rank) => rank.order > currentOrder) ?? null;
}
