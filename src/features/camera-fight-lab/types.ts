import type { PerformanceConfig } from "@/config/performanceConfig";

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
export type Hand = "left" | "right";
export type RequiredHand = Hand | "either" | "none";
export type ProtocolId =
  | "full-reaction"
  | "choice-reaction"
  | "go-no-go"
  | "peripheral-reaction"
  | "combo-speed"
  | "guard-return"
  | "defense-reflex"
  | "virtual-opponent";
export type StimulusKind =
  | "SIMPLE"
  | "CHOICE"
  | "GO"
  | "NO_GO"
  | "PERIPHERAL"
  | "COMBO"
  | "GUARD_RETURN"
  | "DEFENSE"
  | "VIRTUAL_OPPONENT";
export type DefenseAction = "SLIP_LEFT" | "SLIP_RIGHT" | "DUCK";
export type PeripheralZone =
  | "center"
  | "inner-left"
  | "inner-right"
  | "outer-left"
  | "outer-right";
export type PeripheralSide = "center" | "left" | "right";
export type PeripheralEccentricity = "center" | "inner" | "outer";

/** Virtual Opponent'ın çizdiği iki saldırı profili; her biri tek bir gerekli response kanalına eşlenir. */
export type VirtualOpponentAttackType = "PUNCH_COMBO" | "DEFEND_CUE";
/** PUNCH_COMBO → COUNTER (ComboSequenceTracker); DEFEND_CUE → DEFEND (DefenseReflexTracker). */
export type VirtualOpponentResponseChannel = "COUNTER" | "DEFEND";
/** 1 = fast, 2 = medium, 3 = slow; bkz. performanceConfig.ts phase4.virtualOpponentTempo. */
export type VirtualOpponentTempoLevel = 1 | 2 | 3;
export type VirtualOpponentOutcome =
  | "DEFEATED_ATTACK"
  | "WRONG_RESPONSE"
  | "TOO_LATE"
  | "NO_RESPONSE";

export type VirtualOpponentTimeline = {
  /** T1 benzeri değil — rakibin görsel olarak saldırıyı escalate ettiği render cue anı. */
  attackCommitMs: number;
  /** Hard deadline: bu ana kadar doğru response kanalı tamamlanmazsa saldırı "iner". */
  attackLandMs: number;
};

export type TrialStimulus = {
  kind: StimulusKind;
  requiredHand: RequiredHand;
  cueLabel: string;
  cueColor: string;
  peripheralZone: PeripheralZone | null;
  peripheralSide: PeripheralSide | null;
  peripheralEccentricity: PeripheralEccentricity | null;
  inhibitionWindowMs: number | null;
  /** combo-speed'de sabit preset'ten; virtual-opponent'ın COUNTER kanalında tek elden (["left"] veya ["right"]) dolu. */
  comboSequence: readonly Hand[] | null;
  /** defense-reflex'te veya virtual-opponent'ın DEFEND kanalında dolu. */
  defenseAction: DefenseAction | null;
  /** Yalnız virtual-opponent protokolünde dolu. */
  virtualOpponentAttackType: VirtualOpponentAttackType | null;
  virtualOpponentResponseChannel: VirtualOpponentResponseChannel | null;
  virtualOpponentTempoLevel: VirtualOpponentTempoLevel | null;
};

export type PoseVisibility = {
  nose: number;
  leftWrist: number;
  rightWrist: number;
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
  leftHip: number;
  rightHip: number;
  leftKnee: number;
  rightKnee: number;
  leftAnkle: number;
  rightAnkle: number;
  leftHeel: number;
  rightHeel: number;
  leftFootIndex: number;
  rightFootIndex: number;
};

export type PoseSample = {
  /** performance.now() ile aynı monotonic zaman alanı. */
  timestampMs: number;
  poseCount: number;
  image: {
    nose?: Vec3;
    leftWrist?: Vec3;
    rightWrist?: Vec3;
    leftElbow?: Vec3;
    rightElbow?: Vec3;
    leftShoulder?: Vec3;
    rightShoulder?: Vec3;
    leftHip?: Vec3;
    rightHip?: Vec3;
    leftKnee?: Vec3;
    rightKnee?: Vec3;
    leftAnkle?: Vec3;
    rightAnkle?: Vec3;
    leftHeel?: Vec3;
    rightHeel?: Vec3;
    leftFootIndex?: Vec3;
    rightFootIndex?: Vec3;
  };
  world: {
    nose?: Vec3;
    leftWrist?: Vec3;
    rightWrist?: Vec3;
    leftElbow?: Vec3;
    rightElbow?: Vec3;
    leftShoulder?: Vec3;
    rightShoulder?: Vec3;
    leftHip?: Vec3;
    rightHip?: Vec3;
    leftKnee?: Vec3;
    rightKnee?: Vec3;
    leftAnkle?: Vec3;
    rightAnkle?: Vec3;
    leftHeel?: Vec3;
    rightHeel?: Vec3;
    leftFootIndex?: Vec3;
    rightFootIndex?: Vec3;
  };
  visibility: PoseVisibility;
};

export type CameraSnapshot = {
  deviceId?: string;
  deviceLabel: string;
  width: number;
  height: number;
  frameRate: number;
  facingMode?: string;
};

export type CalibrationSnapshot = {
  completedAt: number;
  shoulderWidthM: number;
  shoulderWidthNormalized: number;
  leftShoulderWorld: Vec3;
  rightShoulderWorld: Vec3;
  leftShoulderImage: Vec3;
  rightShoulderImage: Vec3;
  leftGuardWorld: Vec3;
  rightGuardWorld: Vec3;
  leftGuardImage: Vec3;
  rightGuardImage: Vec3;
  torsoCenterWorld: Vec3;
  torsoCenterImage: Vec3;
  /** Baş/burun nötr pozisyonu; slip/duck displacement bu noktaya göre ölçülür. */
  headNeutralWorld: Vec3;
  headNeutralImage: Vec3;
  leftWristNoiseM: number;
  rightWristNoiseM: number;
  camera: CameraSnapshot;
  estimatedProcessingFps: number;
};

export type QualityFlag =
  | "LOW_TRACKING_CONFIDENCE"
  | "LOW_CAMERA_FPS"
  | "PREMATURE_MOVEMENT"
  | "NO_ONSET_DETECTED"
  | "TARGET_TIMEOUT"
  | "FRAME_GAP"
  | "BODY_OUT_OF_FRAME"
  | "INVALID_HIT_SPEED"
  | "INVALID_HIT_DIRECTION"
  | "HAND_ALREADY_IN_TARGET"
  | "LANDMARK_JUMP"
  | "MULTIPLE_PERSON_UNSUPPORTED"
  | "DUPLICATE_CONTACT_REJECTED"
  | "GUARD_RETURN_TIMEOUT"
  | "DEFENSE_RECOVERY_TIMEOUT"
  | "OPPONENT_ATTACK_LANDED";

export type TargetSnapshot = {
  displayX: number;
  displayY: number;
  normalizedX: number;
  normalizedY: number;
  radiusPx: number;
  radiusNormalized: number;
  canvasWidth: number;
  canvasHeight: number;
  zoneIndex: number;
};

export type TrialOutcome =
  | "HIT"
  | "MISS"
  | "TIMEOUT"
  | "INVALID"
  | "WRONG_HAND"
  | "FALSE_ATTACK"
  | "CORRECT_REJECT";

/** COMPLETE/WRONG_HAND motor tarafından üretilir; TIMEOUT/INVALID trial orkestrasyonu tarafından eklenir. */
export type ComboOutcome = "COMPLETE" | "WRONG_HAND" | "TIMEOUT" | "INVALID";

export type ComboStepResult = {
  stepIndex: number;
  expectedHand: Hand;
  actualHand: Hand | null;
  correct: boolean;
  /** Bu adım için onset detector'ın kilitlediği T1 benzeri timestamp. */
  onsetMs: number | null;
  /** Bu adımın kabul edilen temas anı. */
  contactMs: number | null;
  /** Yalnız adım 0: onset - trial T0. */
  reactionMs: number | null;
  /** Adım > 0: bu adımın teması - önceki adımın teması (inter-punch timing). */
  interPunchMs: number | null;
  peakVelocityMps: number | null;
};

export type ComboTrialResult = {
  sequence: readonly Hand[];
  steps: ComboStepResult[];
  outcome: ComboOutcome;
  errorStepIndex: number | null;
  totalComboTimeMs: number | null;
  duplicateContactRejectedCount: number;
};

export type GuardReturnOutcome = "RETURNED" | "FAILED_RETURN";

export type GuardReturnResult = {
  hand: Hand;
  /** Vuruşun T2'si; dönüş süresi bu noktadan itibaren ölçülür. */
  hitMs: number;
  /** T3 — el, art arda stabilite kriterini sağlayarak kalibre edilmiş guard bölgesine döndü. */
  t3Ms: number | null;
  returnTimeMs: number | null;
  outcome: GuardReturnOutcome;
  /** Stabilite eşiğine ulaşmadan guard bölgesine girip çıkma sayısı. */
  overshootCount: number;
};

/** Fiziksel doğru davranış motor tarafından üretilir; TIMEOUT/INVALID trial orkestrasyonu tarafından eklenir. */
export type DefenseOutcome =
  | "CORRECT"
  | "WRONG_DIRECTION"
  | "INSUFFICIENT_DISPLACEMENT"
  | "FAILED_RECOVERY"
  | "NO_RESPONSE"
  | "TIMEOUT"
  | "INVALID";

export type DefenseTrialResult = {
  action: DefenseAction;
  detectedAction: DefenseAction | null;
  /** T1 — baş/üst gövde hareketinin güvenilir başlangıcı. */
  onsetMs: number | null;
  /** T2 — cued eylem için gereken eşiğin ilk aşıldığı an. */
  completionMs: number | null;
  /** T3 — art arda stabilite kriteriyle nötr pozisyona dönüş. */
  recoveryMs: number | null;
  reactionMs: number | null;
  movementMs: number | null;
  recoveryTimeMs: number | null;
  outcome: DefenseOutcome;
  peakLateralDisplacementShoulderWidths: number | null;
  peakVerticalDisplacementShoulderWidths: number | null;
};

export type VirtualOpponentTrialResult = {
  attackType: VirtualOpponentAttackType;
  responseChannel: VirtualOpponentResponseChannel;
  tempoLevel: VirtualOpponentTempoLevel;
  /** T0 — rakip cue'sunun ilk canvas çiziminden hemen önceki performance.now() timestamp'ı. */
  cueStartMs: number;
  /** Rakibin görsel olarak saldırıyı escalate ettiği render anı (yeni bir detector değil). */
  attackCommitMs: number;
  /** Hard deadline — bu ana kadar doğru response kanalı tamamlanmazsa saldırı "iner". */
  attackLandMs: number;
  /** T1 — sarılan tracker'ın (combo/defense) onset'i. */
  onsetMs: number | null;
  /** T2 — yalnız DEFEATED_ATTACK/TOO_LATE için dolu; doğru response kanalının tamamlandığı an. */
  completionMs: number | null;
  reactionMs: number | null;
  responseTimeMs: number | null;
  /** attackLandMs - completionMs; tamamlama yoksa null. Pozitif = deadline'ı yendi. */
  beatDeadlineMarginMs: number | null;
  outcome: VirtualOpponentOutcome;
  /** Yalnız COUNTER kanalında dolu. */
  combo: ComboTrialResult | null;
  /** Yalnız DEFEND kanalında dolu. */
  defense: DefenseTrialResult | null;
};

export type VirtualOpponentSummary = {
  scoredTrialCount: number;
  defeatedCount: number;
  defeatRatePct: number;
  wrongResponseCount: number;
  tooLateCount: number;
  noResponseCount: number;
  medianReactionTimeMs: number | null;
  medianResponseTimeMs: number | null;
  medianBeatDeadlineMarginMs: number | null;
  counterChannelDefeatRatePct: number | null;
  defendChannelDefeatRatePct: number | null;
};

export type TrialResult = {
  trialIndex: number;
  protocolId: ProtocolId;
  protocolVersion: string;
  stimulus: TrialStimulus;
  target: TargetSnapshot;
  targetDelayMs: number;
  t0Ms: number | null;
  t1Ms: number | null;
  t2Ms: number | null;
  /** Yalnız guard-return protokolünde dolu; aynı monotonic performance.now() alanındaki dönüş timestamp'ı. */
  t3Ms: number | null;
  reactionTimeMs: number | null;
  movementTimeMs: number | null;
  totalResponseMs: number | null;
  detectedHand: Hand | null;
  handConfidence: number | null;
  firstHandToValidHit: Hand | null;
  requiredHand: RequiredHand;
  decisionCorrect: boolean | null;
  wrongHand: boolean;
  falseAttack: boolean;
  correctReject: boolean;
  decisionCompletedAtMs: number | null;
  peakVelocityMps: number | null;
  meanPunchVelocityMps: number | null;
  outcome: TrialOutcome;
  timeout: boolean;
  prematureMovement: boolean;
  trackingQualityPct: number;
  processingFps: number;
  qualityFlags: QualityFlag[];
  /** Yalnız combo-speed protokolünde dolu. */
  combo: ComboTrialResult | null;
  /** Yalnız guard-return protokolünde ve bir vuruş kaydedildiğinde dolu. */
  guardReturn: GuardReturnResult | null;
  /** Yalnız defense-reflex protokolünde dolu. */
  defense: DefenseTrialResult | null;
  /** Yalnız virtual-opponent protokolünde dolu. */
  virtualOpponent: VirtualOpponentTrialResult | null;
};

export type SessionQuality = "GOOD" | "FAIR" | "POOR";

export type SessionSummary = {
  scoredTrialCount: number;
  validTrialCount: number;
  hitCount: number;
  missCount: number;
  invalidCount: number;
  accuracyPct: number;
  medianReactionTimeMs: number | null;
  meanReactionTimeMs: number | null;
  fastestReactionTimeMs: number | null;
  slowestReactionTimeMs: number | null;
  reactionConsistencyMadMs: number | null;
  reactionConsistencyPct: number | null;
  medianMovementTimeMs: number | null;
  medianTotalResponseMs: number | null;
  leftMedianReactionTimeMs: number | null;
  rightMedianReactionTimeMs: number | null;
  leftRightDifferenceMs: number | null;
  leftRightDifferencePct: number | null;
  trackingQualityPct: number;
  sessionQualityScore: number;
  sessionQuality: SessionQuality;
  decision: DecisionSummary;
  /** Yalnız combo-speed seanslarında anlamlı; diğer protokollerde sıfır değerli. */
  combo: ComboSequenceSummary;
  /** Yalnız guard-return seanslarında anlamlı; diğer protokollerde sıfır değerli. */
  guardReturn: GuardReturnSummary;
  /** Yalnız defense-reflex seanslarında anlamlı; diğer protokollerde sıfır değerli. */
  defense: DefenseSummary;
  /** Yalnız virtual-opponent seanslarında anlamlı; diğer protokollerde sıfır değerli. */
  virtualOpponent: VirtualOpponentSummary;
};

export type DefenseSummary = {
  scoredTrialCount: number;
  correctCount: number;
  accuracyPct: number;
  medianReactionTimeMs: number | null;
  reactionConsistencyMadMs: number | null;
  medianRecoveryTimeMs: number | null;
  wrongDirectionCount: number;
  insufficientDisplacementCount: number;
  noResponseCount: number;
  failedRecoveryCount: number;
  slipLeftMedianReactionTimeMs: number | null;
  slipRightMedianReactionTimeMs: number | null;
  duckMedianReactionTimeMs: number | null;
  slipLeftRightDifferenceMs: number | null;
};

export type ComboSequenceSummary = {
  scoredTrialCount: number;
  completedCount: number;
  completionRatePct: number;
  wrongHandCount: number;
  medianFirstReactionMs: number | null;
  /** Adım teması arası süre; median ve MAD ile robust consistency. */
  medianInterPunchMs: number | null;
  interPunchConsistencyMadMs: number | null;
  medianTotalComboTimeMs: number | null;
  leftStepMedianMs: number | null;
  rightStepMedianMs: number | null;
  leftRightStepDifferenceMs: number | null;
};

export type GuardReturnSummary = {
  scoredTrialCount: number;
  returnedCount: number;
  failedReturnCount: number;
  medianReturnTimeMs: number | null;
  returnConsistencyMadMs: number | null;
  leftMedianReturnTimeMs: number | null;
  rightMedianReturnTimeMs: number | null;
  leftRightReturnDifferenceMs: number | null;
  overshootRatePct: number | null;
};

export type PeripheralZoneMetric = {
  scoredTrialCount: number;
  correctCount: number;
  accuracyPct: number;
  medianReactionTimeMs: number | null;
};

export type DecisionSummary = {
  scoredTrialCount: number;
  correctDecisionCount: number;
  decisionAccuracyPct: number;
  medianDecisionReactionTimeMs: number | null;
  wrongHandCount: number;
  noGoTrialCount: number;
  correctRejectCount: number;
  falseAttackCount: number;
  falseAttackRatePct: number | null;
  peripheralZoneMetrics: Record<PeripheralZone, PeripheralZoneMetric>;
  peripheralLeftMedianReactionTimeMs: number | null;
  peripheralRightMedianReactionTimeMs: number | null;
  peripheralLeftAccuracyPct: number | null;
  peripheralRightAccuracyPct: number | null;
  peripheralSideDifferenceMs: number | null;
};

/**
 * Seans sesi kademesi — "voice" cue metnini okur ve testi görsel-işitsel
 * hâle getirir; bu yüzden dışa aktarımda saklanır (bkz. audioCues.ts).
 */
export type AudioMode = "off" | "cues" | "voice";

export type SessionExport = {
  schemaVersion: string;
  appVersion: string;
  sessionId: string;
  label: string | null;
  startedAt: string;
  endedAt: string;
  protocol: {
    protocolId: ProtocolId;
    protocolVersion: string;
    configHash: string;
    name: string;
  };
  timingConvention: string;
  environment: {
    userAgent: string;
    language: string;
    screen: { width: number; height: number; devicePixelRatio: number };
  };
  camera: CameraSnapshot;
  processing: { estimatedPoseFps: number; estimatedVideoFps: number };
  calibration: CalibrationSnapshot;
  config: { hash: string; snapshot: PerformanceConfig };
  trials: TrialResult[];
  summary: SessionSummary;
  /** Cue'lar sesli okundu mu — ölçüm karşılaştırmaları buna bakmalı. */
  audio: { mode: AudioMode; spokenCues: boolean };
};

export type WristObservation = {
  hand: Hand;
  timestampMs: number;
  world: Vec3;
  image: Vec3;
  display: Vec2;
  previousDisplay?: Vec2;
  velocityMps: number;
  displacementFromGuardM: number;
  displacementDeltaM: number;
  confidence: number;
  frameGap: boolean;
  landmarkJump: boolean;
};

export type WristHistoryPoint = WristObservation;

/**
 * WristObservation ile aynı alan şeklini paylaşır ki OnsetDetector değişmeden
 * yeniden kullanılabilsin. `displacementFromGuardM` burada "nötr baş
 * pozisyonundan uzaklık" anlamına gelir (guard'a özgü değildir).
 */
export type HeadObservation = {
  timestampMs: number;
  world: Vec3;
  image: Vec3;
  display: Vec2;
  previousDisplay?: Vec2;
  velocityMps: number;
  displacementFromGuardM: number;
  displacementDeltaM: number;
  confidence: number;
  frameGap: boolean;
  landmarkJump: boolean;
};

export type HeadHistoryPoint = HeadObservation;

export const EMPTY_VISIBILITY: PoseVisibility = {
  nose: 0,
  leftWrist: 0,
  rightWrist: 0,
  leftElbow: 0,
  rightElbow: 0,
  leftShoulder: 0,
  rightShoulder: 0,
  leftHip: 0,
  rightHip: 0,
  leftKnee: 0,
  rightKnee: 0,
  leftAnkle: 0,
  rightAnkle: 0,
  leftHeel: 0,
  rightHeel: 0,
  leftFootIndex: 0,
  rightFootIndex: 0,
};
