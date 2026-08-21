/**
 * Hamle kataloğu. Her hamle, kamera modunda hangi vücut sinyaliyle
 * doğrulanacağını da taşır (`signal` + `side` + `threshold`).
 * Eşikler gövde boyuna (omuz ortası ↔ kalça ortası) oranlanmış birimdir,
 * böylece kişinin kameraya uzaklığından bağımsızdır.
 */

export type MoveSignal =
  | "punch" // bilek ileri/yana uzanır
  | "slip" // kafa yana kayar
  | "roll" // çöküp yana savurma
  | "duck" // gövde aşağı
  | "jump" // gövde yukarı
  | "retreat" // kameradan uzaklaşma
  | "guard"; // eller yüz hizasına

export type MoveSide = "sol" | "sag";

export type ReflexMove = {
  id: string;
  label: string;
  signal: MoveSignal;
  side?: MoveSide;
  /** Sinyalin "yapıldı" sayılması için aşması gereken eşik (gövde boyu birimi). */
  threshold: number;
};

export const REFLEX_MOVES: ReflexMove[] = [
  { id: "sol-jab", label: "Sol Jab", signal: "punch", side: "sol", threshold: 0.42 },
  { id: "sag-direkt", label: "Sağ Direkt", signal: "punch", side: "sag", threshold: 0.42 },
  { id: "sol-krose", label: "Sol Kroşe", signal: "punch", side: "sol", threshold: 0.34 },
  { id: "sag-krose", label: "Sağ Kroşe", signal: "punch", side: "sag", threshold: 0.34 },
  { id: "sol-apper", label: "Sol Apper", signal: "punch", side: "sol", threshold: 0.3 },
  { id: "sag-apper", label: "Sağ Apper", signal: "punch", side: "sag", threshold: 0.3 },
  { id: "roll-sol", label: "Roll Sol", signal: "roll", side: "sol", threshold: 0.12 },
  { id: "roll-sag", label: "Roll Sağ", signal: "roll", side: "sag", threshold: 0.12 },
  { id: "egil", label: "Eğil", signal: "duck", threshold: 0.22 },
  { id: "geri-cekil", label: "Geri Çekil", signal: "retreat", threshold: 0.07 },
  { id: "guard-yukari", label: "Guard Yukarı", signal: "guard", threshold: 0.16 },
  { id: "sol-slip", label: "Sol Slip", signal: "slip", side: "sol", threshold: 0.16 },
  { id: "sag-slip", label: "Sağ Slip", signal: "slip", side: "sag", threshold: 0.16 },
  { id: "sicra", label: "Sıçra", signal: "jump", threshold: 0.1 },
];

export const MOVE_BY_ID = new Map(REFLEX_MOVES.map((move) => [move.id, move]));

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

// --- Round tabanlı seans ayarları ---

export const DEFAULT_ROUND_COUNT = 3;
export const DEFAULT_CUES_PER_ROUND = 10;
export const DEFAULT_REST_SEC = 30;

export const ROUND_COUNT_OPTIONS = [1, 2, 3, 5];
export const CUES_PER_ROUND_OPTIONS = [8, 10, 15, 20];
export const REST_SEC_OPTIONS = [15, 30, 60];

/** Kamera modunda bir komuta bu süre içinde tepki gelmezse "kaçırıldı" sayılır. */
export const REACTION_TIMEOUT_MS = 1600;
