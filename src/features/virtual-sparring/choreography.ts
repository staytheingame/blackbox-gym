/**
 * Cue → rakip animasyonu eşlemesi (saf, test edilebilir).
 *
 * SAHNE KURALI: rakip bize dönük durur, yani rakibin SAĞ eli ekranın SOLUNDA
 * görünür (bkz. opponentRig.ts koordinat sistemi). Sporcu hangi yöne
 * kaçacağını figürün hareketinden okuyabilmeli, bu yüzden eşleme sabittir:
 *
 *   SOLA SLIP  → ekranın solundan gelen düz vuruş (rakibin sağ eli)
 *   SAĞA SLIP  → ekranın sağından gelen düz vuruş (rakibin sol eli)
 *   ÇÖMEL      → yukarıdan gelen kavisli vuruş (merkez)
 *
 * Kontra kanalında sporcunun kullanacağı el AYNA mantığıyla gösterilir:
 * sporcu sol elini kullanacaksa rakip ekranın solundaki eliyle çalışır —
 * karşındaki adamı aynada taklit etme alışkanlığıyla uyumlu.
 */

import type { TrialStimulus } from "../camera-fight-lab/types";
import type { AttackSide } from "./opponentRig";

export function attackSideForStimulus(stimulus: TrialStimulus): AttackSide {
  if (stimulus.virtualOpponentResponseChannel === "DEFEND" || stimulus.defenseAction) {
    if (stimulus.defenseAction === "SLIP_LEFT") return "right";
    if (stimulus.defenseAction === "SLIP_RIGHT") return "left";
    return "center";
  }
  const hand = stimulus.comboSequence?.[0];
  if (hand === "left") return "right";
  if (hand === "right") return "left";
  return "center";
}

/**
 * Zaman çizelgesinden o anki eylem ve ilerleme. Saf fonksiyon: render döngüsü
 * her karede bunu çağırır, kendi içinde durum tutmaz.
 *
 * `resolvedAt` doluysa alışveriş bitmiştir; sonuç animasyonu (BEATEN/LAND/HURT)
 * oradan itibaren oynar.
 */
export type ChoreographyInput = {
  nowMs: number;
  cueStartMs: number;
  attackCommitMs: number;
  attackLandMs: number;
  /** Alışveriş çözüldüyse çözülme anı. */
  resolvedAtMs: number | null;
  /** Çözüm temiz miydi (sporcu yetişti mi). */
  playerWon: boolean;
};

export type ChoreographyFrame = {
  action: "TELEGRAPH" | "COMMIT" | "LAND" | "BEATEN";
  progress: number;
  /** 0..1 — vuruşun inmesine kalan yakınlık; renderer figürü buna göre kızartır. */
  threat: number;
};

const RESOLUTION_ANIMATION_MS = 420;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function choreographyFrame(input: ChoreographyInput): ChoreographyFrame {
  const { nowMs, cueStartMs, attackCommitMs, attackLandMs } = input;

  if (input.resolvedAtMs !== null) {
    const progress = clamp01((nowMs - input.resolvedAtMs) / RESOLUTION_ANIMATION_MS);
    return input.playerWon
      ? { action: "BEATEN", progress, threat: 0 }
      : { action: "LAND", progress, threat: 1 };
  }

  if (nowMs < attackCommitMs) {
    const span = Math.max(1, attackCommitMs - cueStartMs);
    const progress = clamp01((nowMs - cueStartMs) / span);
    return { action: "TELEGRAPH", progress, threat: progress * 0.5 };
  }

  const span = Math.max(1, attackLandMs - attackCommitMs);
  const progress = clamp01((nowMs - attackCommitMs) / span);
  return { action: "COMMIT", progress, threat: 0.5 + progress * 0.5 };
}
