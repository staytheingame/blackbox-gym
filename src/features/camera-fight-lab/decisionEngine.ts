import type { Hand, TrialOutcome, TrialStimulus } from "./types";

export function outcomeForTargetHit(
  stimulus: TrialStimulus,
  detectedHand: Hand,
): Extract<TrialOutcome, "HIT" | "WRONG_HAND"> {
  if (
    stimulus.requiredHand !== "either" &&
    stimulus.requiredHand !== "none" &&
    stimulus.requiredHand !== detectedHand
  ) {
    return "WRONG_HAND";
  }
  return "HIT";
}

export function isDecisionCorrect(outcome: TrialOutcome): boolean | null {
  if (outcome === "INVALID") return null;
  return outcome === "HIT" || outcome === "CORRECT_REJECT";
}

export function isNoGoStimulus(stimulus: TrialStimulus | null): boolean {
  return stimulus?.kind === "NO_GO";
}

export function outcomeForNoGoWindow(input: {
  t0Ms: number;
  inhibitionWindowMs: number;
  movementOnsetMs: number | null;
}): Extract<TrialOutcome, "FALSE_ATTACK" | "CORRECT_REJECT"> {
  return input.movementOnsetMs !== null &&
    input.movementOnsetMs >= input.t0Ms &&
    input.movementOnsetMs <= input.t0Ms + input.inhibitionWindowMs
    ? "FALSE_ATTACK"
    : "CORRECT_REJECT";
}
