/**
 * Camera Fight Lab'in ölçüm sonucunu etkileyen bütün eşikler burada yaşar.
 * Bu nesnenin tamamı JSON export içine snapshot olarak eklenir.
 */
export const PERFORMANCE_CONFIG = {
  schemaVersion: "blackbox-fight-lab-session/0.2",
  appVersion: "0.2.0",
  session: {
    trialCount: 20,
    countdownSeconds: 3,
    interTrialFeedbackMs: 850,
  },
  camera: {
    idealWidth: 1280,
    idealHeight: 720,
    idealFrameRate: 60,
    acceptableFrameRate: 30,
    fpsWarningBelow: 24,
  },
  pose: {
    maxProcessingFps: 30,
    minVisibility: 0.65,
    inferenceTimeoutMs: 20_000,
  },
  calibration: {
    stableWindowMs: 1_200,
    minimumSamples: 18,
    maxPoseCount: 1,
    minShoulderWidthNormalized: 0.14,
    maxShoulderWidthNormalized: 0.5,
    maxWristNoiseM: 0.035,
    maxMedianWristVelocityMps: 0.2,
    wristFrameMargin: 0.04,
    shoulderTopMargin: 0.06,
    shoulderBottomLimit: 0.68,
    guardWristBelowShoulderAllowanceNormalized: 0.18,
    guardWristHorizontalReachShoulderWidths: 1.35,
  },
  motion: {
    emaAlpha: 0.55,
    historyWindowMs: 2_500,
    maxFrameGapMs: 140,
    landmarkJumpM: 0.45,
    onsetVelocityMps: 0.5,
    onsetExitVelocityMps: 0.28,
    strongOnsetVelocityMps: 1.15,
    minimumOnsetDisplacementM: 0.025,
    onsetConsecutiveFrames: 2,
    prematureWindowMs: 220,
    prematureVelocityMps: 0.42,
  },
  hit: {
    minimumVelocityMps: 0.72,
    minimumDirectionCosine: 0.18,
    wristTolerancePx: 16,
  },
  target: {
    randomDelayMinMs: 900,
    randomDelayMaxMs: 2_200,
    timeoutMs: 2_800,
    radiusShoulderRatio: 0.28,
    minRadiusNormalized: 0.052,
    maxRadiusNormalized: 0.085,
    viewportMarginNormalized: 0.1,
    /** x/y değerleri torso center'a göre shoulder width çarpanıdır. */
    zones: [
      { x: -0.9, y: -0.42 },
      { x: 0, y: -0.65 },
      { x: 0.9, y: -0.42 },
      { x: -0.65, y: 0.08 },
      { x: 0.65, y: 0.08 },
    ],
  },
  decision: {
    choiceTrialCount: 20,
    goNoGoTrialCount: 20,
    peripheralTrialCount: 20,
    noGoProbability: 0.3,
    noGoInhibitionWindowMs: 1_100,
    maxConsecutiveNoGo: 2,
    peripheralZones: [
      { id: "center", side: "center", eccentricity: "center", xShoulderWidths: 0 },
      { id: "inner-left", side: "left", eccentricity: "inner", xShoulderWidths: -0.85 },
      { id: "inner-right", side: "right", eccentricity: "inner", xShoulderWidths: 0.85 },
      { id: "outer-left", side: "left", eccentricity: "outer", xShoulderWidths: -1.55 },
      { id: "outer-right", side: "right", eccentricity: "outer", xShoulderWidths: 1.55 },
    ],
  },
  quality: {
    goodScoreAtLeast: 80,
    fairScoreAtLeast: 60,
  },
  phase2: {
    comboTrialCount: 12,
    /** Kombinasyon hedefi için tek trial'lık toplam zaman aşımı (adım sayısından bağımsız üst sınır). */
    comboTotalTimeoutMs: 6_000,
    guardReturnTrialCount: 12,
    /** Guard bölgesi yarıçapı, punch hedefiyle aynı shoulder-width oranına bir çarpan uygulanarak türetilir. */
    guardReturnZoneRadiusRatio: 1.2,
    /** T3 onaylanmadan önce guard bölgesinde art arda kalınması gereken kare sayısı; tek kare geçişi dönüş saymaz. */
    guardReturnStableFrames: 5,
    guardReturnTimeoutMs: 2_500,
  },
  phase3: {
    defenseTrialCount: 15,
    head: {
      emaAlpha: 0.5,
      maxFrameGapMs: 140,
      landmarkJumpM: 0.35,
      onsetVelocityMps: 0.32,
      onsetExitVelocityMps: 0.16,
      strongOnsetVelocityMps: 0.85,
      minimumOnsetDisplacementM: 0.018,
      onsetConsecutiveFrames: 2,
    },
    defense: {
      /** Shoulder-width birimiyle ölçeklenir; farklı mesafe/çözünürlüklerde tutarlı kalır. */
      minLateralDisplacementShoulderWidths: 0.42,
      minVerticalDisplacementShoulderWidths: 0.34,
      /** Doğru yönde eşik aşıldıktan sonra baseline'a art arda dönülmesi gereken kare sayısı. */
      recoveryStableFrames: 5,
      recoveryZoneRadiusShoulderWidths: 0.3,
      recoveryTimeoutMs: 2_200,
      /** T0'dan itibaren tepki başlamazsa NO_RESPONSE üretilir. */
      responseTimeoutMs: 2_600,
    },
  },
  phase4: {
    virtualOpponentTrialCount: 15,
    /** T2 (attackLandMs) sonrası, alt tracker'ın (combo/defense) doğal çözümünü beklemeden zorla sonuçlandırmak için sabit ek pencere. */
    virtualOpponentGraceMs: 400,
    /** Tempo başına T0→commit ve commit→land gecikmeleri; her trial'da rastgele küçük jitter eklenir (bkz. virtualOpponentEngine.ts). */
    virtualOpponentTempo: {
      1: { commitDelayMs: 350, landDelayMs: 550 },
      2: { commitDelayMs: 500, landDelayMs: 800 },
      3: { commitDelayMs: 650, landDelayMs: 1_100 },
    },
    virtualOpponentTempoJitterMs: 30,
    /** Tracking tamamen kesilirse (guard-return/defense-reflex ile aynı dış güvenlik ağı deseni) trial'ı zorla kapatan üst sınır; en yavaş tempo + grace'in belirgin şekilde üzerindedir. */
    virtualOpponentSafetyTimeoutMs: 3_000,
  },
  wrestling: {
    schemaVersion: "blackbox-wrestling-lab-session/1.0",
    calibration: {
      stableWindowMs: 1_500,
      minimumSamples: 24,
      minVisibility: 0.6,
      lowerBodyVisibleRatio: 0.78,
      ankleBottomMargin: 0.985,
      headTopMargin: 0.015,
      minStanceWidthNormalized: 0.055,
      maxHipHeightMadNormalized: 0.018,
      maxTorsoAngleMadDeg: 4.5,
      maxStanceWidthMadNormalized: 0.018,
      maxBodyCenterMadNormalized: 0.018,
    },
    motion: {
      onsetCompositeVelocity: 0.42,
      onsetConsecutiveFrames: 2,
      completionConsecutiveFrames: 2,
      directionDeadZoneNormalized: 0.018,
      shotCompletionDisplacementNormalized: 0.075,
      movementCompletionDisplacementNormalized: 0.07,
      sprawlHipDisplacementM: 0.12,
      sprawlHipHeightDeltaNormalized: 0.035,
      sprawlTorsoAngleDeltaDeg: 9,
      restraintWindowMs: 1_150,
      trialTimeoutMs: 3_200,
    },
    recovery: {
      bodyCenterToleranceNormalized: 0.045,
      hipHeightToleranceNormalized: 0.035,
      torsoAngleToleranceDeg: 9,
      stanceWidthToleranceNormalized: 0.04,
      maxCompositeVelocity: 0.24,
      stableFrames: 5,
      timeoutMs: 3_000,
    },
    protocols: {
      shotTrialCount: 10,
      sprawlTrialCount: 6,
      choiceTrialCount: 10,
      recognitionTrialCount: 10,
      movementTrialCount: 8,
      stanceBlockDurationMs: 8_000,
      handFightingTrialCount: 8,
      chainTrialCount: 6,
      scrambleDurationMs: 30_000,
      fatigueWorkDurationMs: 30_000,
      virtualTrialCount: 10,
      patternTrialCount: 8,
    },
  },
} as const;

export type PerformanceConfig = typeof PERFORMANCE_CONFIG;
