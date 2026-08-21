import type { CameraSnapshot, Vec3 } from "../types";
import type { WrestlingCalibrationSnapshot } from "./types";

export type WrestlingProtocolId =
  | "shot-reaction"
  | "sprawl-reaction"
  | "wrestling-choice"
  | "fake-real-recognition"
  | "movement-lab"
  | "stance-consistency"
  | "hand-fighting"
  | "chain-wrestling"
  | "scramble"
  | "wrestling-fatigue"
  | "virtual-wrestler"
  | "opponent-reading"
  | "weekly-benchmark"
  | "coach-test";

export type ShotAttack = "LEFT_SINGLE" | "RIGHT_SINGLE" | "DOUBLE_LEG";
export type WrestlingDirection =
  | "LEFT"
  | "RIGHT"
  | "FORWARD"
  | "BACK"
  | "CIRCLE_LEFT"
  | "CIRCLE_RIGHT"
  | "LEVEL"
  | "SPRAWL"
  | "STAND";
export type HandFightTarget = "LEFT_WRIST" | "RIGHT_WRIST" | "COLLAR_TIE" | "INSIDE_CONTROL";

export type ShotStimulus = { kind: "SHOT"; attack: ShotAttack; requiredDirection: WrestlingDirection };
export type SprawlStimulus = { kind: "SPRAWL"; attack: ShotAttack; requiredDirection: "SPRAWL" };
export type ChoiceStimulus = { kind: "CHOICE"; attack: ShotAttack; requiredDirection: WrestlingDirection };
export type RecognitionStimulus = { kind: "RECOGNITION"; cue: "REAL_SHOT" | "FAKE"; attack: ShotAttack | null; requiredDirection: WrestlingDirection | "RESTRAINT" };
export type MovementStimulus = { kind: "MOVEMENT"; command: Extract<WrestlingDirection, "LEFT" | "RIGHT" | "FORWARD" | "BACK" | "CIRCLE_LEFT" | "CIRCLE_RIGHT">; requiredDirection: WrestlingDirection };
export type StanceStimulus = { kind: "STANCE"; durationMs: number };
export type HandFightingStimulus = { kind: "HAND_FIGHTING"; target: HandFightTarget; requiredHand: "left" | "right" | "either" };
export type ChainStimulus = { kind: "CHAIN"; sequence: readonly WrestlingDirection[] };
export type ScrambleStimulus = { kind: "SCRAMBLE"; command: WrestlingDirection };
export type FatigueStimulus = { kind: "FATIGUE"; block: "A_BASELINE" | "B_WORK" | "C_POST" | "D_RECOVERY"; nested: ShotStimulus | MovementStimulus | SprawlStimulus };
export type VirtualWrestlerStimulus = { kind: "VIRTUAL_WRESTLER"; attack: ShotAttack | "FAKE"; difficulty: number; events: { cueStart: number; commitStart: number; attackThreshold: number; recoveryEnd: number } };
export type PatternStimulus = { kind: "PATTERN"; patternId: string; sequence: readonly (ShotAttack | "FAKE" | "RESET" | "CIRCLE")[]; requiredResponses: readonly (WrestlingDirection | "RESTRAINT")[] };

export type WrestlingStimulus =
  | ShotStimulus
  | SprawlStimulus
  | ChoiceStimulus
  | RecognitionStimulus
  | MovementStimulus
  | StanceStimulus
  | HandFightingStimulus
  | ChainStimulus
  | ScrambleStimulus
  | FatigueStimulus
  | VirtualWrestlerStimulus
  | PatternStimulus;

export type WrestlingQualityFlag =
  | "LOW_TRACKING_CONFIDENCE"
  | "LOWER_BODY_OUT_OF_FRAME"
  | "STANCE_NOT_STABLE"
  | "SPRAWL_NOT_DETECTED"
  | "RESPONSE_DIRECTION_UNCLEAR"
  | "RECOVERY_NOT_DETECTED"
  | "MULTIPLE_MOVEMENTS"
  | "POSE_OCCLUSION"
  | "INSUFFICIENT_HIP_TRACKING"
  | "INSUFFICIENT_KNEE_TRACKING"
  | "PREMATURE_MOVEMENT"
  | "TRACKING_LOSS"
  | "TRIAL_TIMEOUT";

export type WrestlingTrialOutcome =
  | "CORRECT"
  | "WRONG_DIRECTION"
  | "FALSE_DEFENSE"
  | "MISSED_DEFENSE"
  | "NO_RESPONSE"
  | "INCOMPLETE"
  | "INVALID";

export type WrestlingMotionSnapshot = {
  bodyDisplacement: { x: number; y: number; magnitude: number };
  hipDisplacementM: number;
  hipHeightDeltaNormalized: number;
  torsoAngleDeltaDeg: number;
  stanceWidthDeltaNormalized: number;
  compositeVelocity: number;
  detectedDirection: WrestlingDirection | null;
};

export type WrestlingTrialBase = {
  trialIndex: number;
  protocolId: WrestlingProtocolId;
  protocolVersion: string;
  stimulus: WrestlingStimulus;
  t0Ms: number;
  t1Ms: number | null;
  t2Ms: number | null;
  t3Ms: number | null;
  reactionTimeMs: number | null;
  executionTimeMs: number | null;
  totalResponseMs: number | null;
  recoveryToStanceMs: number | null;
  outcome: WrestlingTrialOutcome;
  correct: boolean;
  motion: WrestlingMotionSnapshot;
  trackingQualityPct: number;
  qualityFlags: WrestlingQualityFlag[];
};

export type ShotTrial = WrestlingTrialBase & { type: "shot"; attack: ShotAttack; responseDirection: WrestlingDirection | null };
export type SprawlTrial = WrestlingTrialBase & { type: "sprawl"; attack: ShotAttack; sprawlSignalsPassed: number; recovered: boolean };
export type ChoiceTrial = WrestlingTrialBase & { type: "choice"; attack: ShotAttack; expectedResponse: WrestlingDirection; detectedResponse: WrestlingDirection | null };
export type RecognitionTrial = WrestlingTrialBase & { type: "recognition"; cue: "REAL_SHOT" | "FAKE"; classification: "CORRECT_DEFENSE" | "CORRECT_RESTRAINT" | "FALSE_DEFENSE" | "MISSED_DEFENSE" };
export type MovementTrial = WrestlingTrialBase & { type: "movement"; command: MovementStimulus["command"]; stanceHeightDeviation: number; centerDisplacement: number };
export type StanceTrial = WrestlingTrialBase & { type: "stance"; hipHeightVariation: number; torsoAngleVariation: number; stanceWidthVariation: number; bodyCenterVariation: number; stanceConsistencyPct: number };
export type HandFightingTrial = WrestlingTrialBase & { type: "hand-fighting"; target: HandFightTarget; requiredHand: "left" | "right" | "either"; detectedHand: "left" | "right" | null; contactTimeMs: number | null; returnTimeMs: number | null };
export type ChainTrial = WrestlingTrialBase & { type: "chain"; expectedSequence: readonly WrestlingDirection[]; detectedSequence: readonly WrestlingDirection[]; transitionTimesMs: readonly number[]; error: "WRONG_ORDER" | "INCOMPLETE" | "DUPLICATE_MOVEMENT" | null };
export type ScrambleTrial = WrestlingTrialBase & { type: "scramble"; command: WrestlingDirection; commandIndex: number };
export type FatigueTrial = WrestlingTrialBase & { type: "fatigue"; block: FatigueStimulus["block"]; nestedType: WrestlingStimulus["kind"] };
export type VirtualWrestlerTrial = WrestlingTrialBase & { type: "virtual-wrestler"; difficulty: number; timingEvents: VirtualWrestlerStimulus["events"] };
export type PatternTrial = WrestlingTrialBase & { type: "pattern"; patternId: string; expectedResponses: readonly (WrestlingDirection | "RESTRAINT")[]; detectedResponses: readonly WrestlingDirection[]; patternErrors: number };

export type WrestlingTrial = ShotTrial | SprawlTrial | ChoiceTrial | RecognitionTrial | MovementTrial | StanceTrial | HandFightingTrial | ChainTrial | ScrambleTrial | FatigueTrial | VirtualWrestlerTrial | PatternTrial;

export type WrestlingSessionSummary = {
  trialCount: number;
  validTrialCount: number;
  correctCount: number;
  accuracyPct: number;
  medianReactionTimeMs: number | null;
  medianExecutionTimeMs: number | null;
  medianTotalResponseMs: number | null;
  medianRecoveryToStanceMs: number | null;
  reactionConsistencyMadMs: number | null;
  movementConsistencyMad: number | null;
  stanceConsistencyPct: number | null;
  falseDefenseRatePct: number | null;
  leftMedianMs: number | null;
  rightMedianMs: number | null;
  absoluteDifferenceMs: number | null;
  relativeDifferencePct: number | null;
  trackingQualityPct: number;
  qualityFlags: WrestlingQualityFlag[];
};

export type WrestlingSession = {
  schemaVersion: "blackbox-wrestling-lab-session/1.0";
  sport: "wrestling";
  sessionId: string;
  athleteId: string;
  label: string | null;
  startedAt: string;
  endedAt: string;
  protocolId: WrestlingProtocolId;
  protocolVersion: string;
  configHash: string;
  cameraMetadata: CameraSnapshot;
  calibrationSnapshot: WrestlingCalibrationSnapshot;
  configSnapshot: unknown;
  rawTrials: WrestlingTrial[];
  summary: WrestlingSessionSummary;
  qualityFlags: WrestlingQualityFlag[];
};

export type WrestlingFeatureDelta = {
  bodyCenter: Vec3;
  hipCenter: Vec3;
  kneeCenter: Vec3;
};
