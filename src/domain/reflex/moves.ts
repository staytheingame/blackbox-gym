export type ReflexMove = {
  id: string;
  label: string;
};

export const REFLEX_MOVES: ReflexMove[] = [
  { id: "sol-jab", label: "Sol Jab" },
  { id: "sag-direkt", label: "Sağ Direkt" },
  { id: "sol-krose", label: "Sol Kroşe" },
  { id: "sag-krose", label: "Sağ Kroşe" },
  { id: "sol-apper", label: "Sol Apper" },
  { id: "sag-apper", label: "Sağ Apper" },
  { id: "roll-sol", label: "Roll Sol" },
  { id: "roll-sag", label: "Roll Sağ" },
  { id: "egil", label: "Eğil" },
  { id: "geri-cekil", label: "Geri Çekil" },
  { id: "guard-yukari", label: "Guard Yukarı" },
  { id: "sol-slip", label: "Sol Slip" },
  { id: "sag-slip", label: "Sağ Slip" },
  { id: "sicra", label: "Sıçra" },
];

export type Difficulty = "kolay" | "orta" | "zor";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  kolay: "Kolay",
  orta: "Orta",
  zor: "Zor",
};

/** [min, max] milisaniye — komutlar arası bekleme aralığı. */
export const DIFFICULTY_INTERVAL_MS: Record<Difficulty, [number, number]> = {
  kolay: [3000, 5000],
  orta: [2000, 3500],
  zor: [1000, 2500],
};

export const DEFAULT_REP_COUNT = 15;
