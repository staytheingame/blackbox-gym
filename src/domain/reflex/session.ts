import { REFLEX_MOVES, type Difficulty, type ReflexMove, DIFFICULTY_INTERVAL_MS } from "./moves";

export type Rng = () => number; // [0, 1)

/** Bir önceki hamleyle aynısını vermeyen rastgele hamle seçer. */
export function pickNextMove(
  previousId: string | null,
  rng: Rng = Math.random,
): ReflexMove {
  const candidates = previousId
    ? REFLEX_MOVES.filter((move) => move.id !== previousId)
    : REFLEX_MOVES;
  const index = Math.floor(rng() * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}

/** Zorluk seviyesine göre rastgele bekleme süresi (ms). */
export function pickIntervalMs(difficulty: Difficulty, rng: Rng = Math.random): number {
  const [min, max] = DIFFICULTY_INTERVAL_MS[difficulty];
  return Math.round(min + rng() * (max - min));
}

export type ReflexRep = {
  moveId: string;
  reactionMs: number;
};

export type MoveStat = {
  moveId: string;
  label: string;
  count: number;
  averageMs: number;
};

export type ReflexSummary = {
  repCount: number;
  averageMs: number;
  bestMs: number;
  worstMs: number;
  perMove: MoveStat[];
};

const moveLabel = (moveId: string): string =>
  REFLEX_MOVES.find((move) => move.id === moveId)?.label ?? moveId;

export function summarizeSession(reps: ReflexRep[]): ReflexSummary {
  if (reps.length === 0) {
    return { repCount: 0, averageMs: 0, bestMs: 0, worstMs: 0, perMove: [] };
  }

  const times = reps.map((rep) => rep.reactionMs);
  const averageMs = Math.round(
    times.reduce((sum, ms) => sum + ms, 0) / times.length,
  );

  const byMove = new Map<string, number[]>();
  for (const rep of reps) {
    const list = byMove.get(rep.moveId) ?? [];
    list.push(rep.reactionMs);
    byMove.set(rep.moveId, list);
  }

  const perMove: MoveStat[] = [...byMove.entries()]
    .map(([moveId, msList]) => ({
      moveId,
      label: moveLabel(moveId),
      count: msList.length,
      averageMs: Math.round(msList.reduce((sum, ms) => sum + ms, 0) / msList.length),
    }))
    .sort((a, b) => a.averageMs - b.averageMs);

  return {
    repCount: reps.length,
    averageMs,
    bestMs: Math.min(...times),
    worstMs: Math.max(...times),
    perMove,
  };
}
