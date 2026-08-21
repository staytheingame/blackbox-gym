"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { beep, initAudio, releaseAudio, speak, stopSpeaking } from "@/lib/audio/voice";
import {
  AUDIO_MODE_HINTS,
  AUDIO_MODE_LABELS,
  DEFAULT_AUDIO_MODE,
  cueBeep,
  cueSpeech,
  feedbackBeep,
  type AudioMode,
} from "./audioCues";
import { evaluateCalibration, type CalibrationEvaluation } from "./calibrationEngine";
import { cameraErrorMessage, openCamera, stopCamera } from "./cameraManager";
import {
  fitCanvas,
  renderFightLabCanvas,
  type CanvasFeedback,
} from "./canvasRenderer";
import { ComboSequenceTracker } from "./comboEngine";
import type { CanvasSize } from "./coordinates";
import { DefenseReflexTracker } from "./defenseEngine";
import { VideoFrameScheduler } from "./frameScheduler";
import {
  INITIAL_GAME_STATE,
  transitionGameState,
  type GameState,
} from "./gameStateMachine";
import { GuardReturnTracker } from "./guardReturnEngine";
import { HeadMotionTracker } from "./headMotion";
import { buildVirtualOpponentTimeline, VirtualOpponentTracker } from "./virtualOpponentEngine";
import { checkHit, isInsideTarget } from "./hitDetector";
import {
  isDecisionCorrect,
  isNoGoStimulus,
  outcomeForNoGoWindow,
  outcomeForTargetHit,
} from "./decisionEngine";
import { hasPrematureMovement, OnsetDetector } from "./onsetDetector";
import { PoseClient, type InferenceMode } from "./poseClient";
import {
  DEFAULT_PROTOCOL_ID,
  PROTOCOL_LIST,
  PROTOCOLS,
  createProtocolTrial,
  protocolConfigHash,
  type ProtocolDefinition,
} from "./protocols";
import { buildSessionSummary } from "./sessionMetrics";
import {
  buildSessionExport,
  createSessionId,
  downloadSessionJson,
} from "./sessionExport";
import { mean, roundMetric } from "./statistics";
import { createGuardZone, headNeutralDisplayPoint, scaleTarget } from "./trialGenerator";
import type {
  CalibrationSnapshot,
  CameraSnapshot,
  ComboStepResult,
  ComboTrialResult,
  DefenseAction,
  DefenseTrialResult,
  GuardReturnResult,
  Hand,
  HeadObservation,
  PoseSample,
  QualityFlag,
  ProtocolId,
  TargetSnapshot,
  TrialStimulus,
  TrialOutcome,
  TrialResult,
  VirtualOpponentAttackType,
  VirtualOpponentResponseChannel,
  VirtualOpponentTimeline,
  VirtualOpponentTrialResult,
  WristObservation,
} from "./types";
import { velocitiesBetween, WristMotionTracker } from "./velocity";

type PipelineStatus = "idle" | "camera" | "pose" | "ready";

type TrialRuntime = {
  completed: boolean;
  target: TargetSnapshot | null;
  stimulus: TrialStimulus | null;
  t0Ms: number | null;
  t2Ms: number | null;
  t1ByHand: Record<Hand, number | null>;
  wasOutside: Record<Hand, boolean>;
  premature: boolean;
  trackingFrames: number;
  usableTrackingFrames: number;
  qualityFlags: Set<QualityFlag>;
};

type ComboTelemetry = {
  currentStepIndex: number;
  expectedHand: Hand | null;
  duplicateContactCount: number;
  stepHistory: readonly ComboStepResult[];
} | null;

type GuardReturnTelemetry = {
  hand: Hand;
  consecutiveInsideFrames: number;
  overshootEventCount: number;
} | null;

type DefenseTelemetry = {
  action: DefenseAction;
  onsetMs: number | null;
  isFinished: boolean;
} | null;

type VirtualOpponentTelemetry = {
  attackType: VirtualOpponentAttackType;
  responseChannel: VirtualOpponentResponseChannel;
  tempoLevel: number;
  attackCommitMs: number;
  attackLandMs: number;
  isFinished: boolean;
} | null;

type LiveTelemetry = {
  poseFps: number;
  videoFps: number;
  left: WristObservation | null;
  right: WristObservation | null;
  latestPose: PoseSample | null;
  runtime: TrialRuntime;
  combo: ComboTelemetry;
  guardReturn: GuardReturnTelemetry;
  defense: DefenseTelemetry;
  virtualOpponent: VirtualOpponentTelemetry;
};

const createTrialRuntime = (): TrialRuntime => ({
  completed: false,
  target: null,
  stimulus: null,
  t0Ms: null,
  t2Ms: null,
  t1ByHand: { left: null, right: null },
  wasOutside: { left: false, right: false },
  premature: false,
  trackingFrames: 0,
  usableTrackingFrames: 0,
  qualityFlags: new Set(),
});

const copyTrialRuntime = (runtime: TrialRuntime): TrialRuntime => ({
  ...runtime,
  t1ByHand: { ...runtime.t1ByHand },
  wasOutside: { ...runtime.wasOutside },
  qualityFlags: new Set(runtime.qualityFlags),
});

const createLiveTelemetry = (): LiveTelemetry => ({
  poseFps: 0,
  videoFps: 0,
  left: null,
  right: null,
  latestPose: null,
  runtime: createTrialRuntime(),
  combo: null,
  guardReturn: null,
  defense: null,
  virtualOpponent: null,
});

const snapshotDefenseTracker = (
  tracker: DefenseReflexTracker | null,
  action: DefenseAction | null,
): DefenseTelemetry =>
  tracker && action
    ? { action, onsetMs: tracker.currentOnsetMs, isFinished: tracker.isFinished }
    : null;

const snapshotComboTracker = (tracker: ComboSequenceTracker | null): ComboTelemetry =>
  tracker
    ? {
        currentStepIndex: tracker.currentStepIndex,
        expectedHand: tracker.expectedHand,
        duplicateContactCount: tracker.duplicateContactCount,
        stepHistory: tracker.stepHistory,
      }
    : null;

const snapshotGuardReturnTracker = (tracker: GuardReturnTracker | null): GuardReturnTelemetry =>
  tracker
    ? {
        hand: tracker.hand,
        consecutiveInsideFrames: tracker.consecutiveInsideFrames,
        overshootEventCount: tracker.overshootEventCount,
      }
    : null;

const snapshotVirtualOpponentTracker = (
  tracker: VirtualOpponentTracker | null,
  attackType: VirtualOpponentAttackType | null,
  responseChannel: VirtualOpponentResponseChannel | null,
  tempoLevel: number | null,
  timeline: VirtualOpponentTimeline | null,
): VirtualOpponentTelemetry =>
  tracker && attackType && responseChannel && tempoLevel && timeline
    ? {
        attackType,
        responseChannel,
        tempoLevel,
        attackCommitMs: timeline.attackCommitMs,
        attackLandMs: timeline.attackLandMs,
        isFinished: tracker.isFinished,
      }
    : null;

const EMPTY_CALIBRATION: CalibrationEvaluation = {
  ready: false,
  progressPct: 0,
  issues: [],
  snapshot: null,
  usableSampleCount: 0,
};

const estimateFps = (timestamps: readonly number[]): number => {
  if (timestamps.length < 2) return 0;
  const duration = timestamps[timestamps.length - 1] - timestamps[0];
  return duration > 0 ? ((timestamps.length - 1) * 1_000) / duration : 0;
};

const PROTOCOL_STEPS = [
  "Kamerayı aç ve üst gövdeni kadraja al",
  "Guard pozisyonunda kısa kalibrasyon yap",
  "Seçilen protokolün cue'larına kontrollü yanıt ver",
  "Sonuçları incele ve ham veriyi JSON olarak indir",
] as const;

export function CameraFightLab({ initialDebug = false }: { initialDebug?: boolean }) {
  const [game, dispatch] = useReducer(transitionGameState, INITIAL_GAME_STATE);
  const gameRef = useRef<GameState>(game);
  const [label, setLabel] = useState("");
  const [protocolId, setProtocolId] = useState<ProtocolId>(DEFAULT_PROTOCOL_ID);
  const protocol = PROTOCOLS[protocolId];
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [camera, setCamera] = useState<CameraSnapshot | null>(null);
  const cameraRef = useRef<CameraSnapshot | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [inferenceMode, setInferenceMode] = useState<InferenceMode | null>(null);
  const [calibrationEvaluation, setCalibrationEvaluation] =
    useState<CalibrationEvaluation>(EMPTY_CALIBRATION);
  const [calibration, setCalibration] = useState<CalibrationSnapshot | null>(null);
  const calibrationRef = useRef<CalibrationSnapshot | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<CanvasFeedback>(null);
  const [audioMode, setAudioMode] = useState<AudioMode>(DEFAULT_AUDIO_MODE);
  const feedbackRef = useRef<CanvasFeedback>(null);
  const [debug, setDebug] = useState(initialDebug);
  const [telemetry, setTelemetry] = useState<LiveTelemetry>(createLiveTelemetry);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseClientRef = useRef<PoseClient | null>(null);
  const schedulerRef = useRef<VideoFrameScheduler | null>(null);
  const bootingRef = useRef(false);
  const renderFrameRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const audioModeRef = useRef<AudioMode>(DEFAULT_AUDIO_MODE);
  const lastBeepRef = useRef<{ kind: Parameters<typeof beep>[0]; atMs: number } | null>(null);
  const pendingRevealRef = useRef(false);
  const preparedTrialRef = useRef<number | null>(null);

  const poseSamplesRef = useRef<PoseSample[]>([]);
  const latestPoseRef = useRef<PoseSample | null>(null);
  const poseFrameTimesRef = useRef<number[]>([]);
  const leftTrackerRef = useRef(new WristMotionTracker("left"));
  const rightTrackerRef = useRef(new WristMotionTracker("right"));
  const latestObservationsRef = useRef<Record<Hand, WristObservation | null>>({
    left: null,
    right: null,
  });
  const onsetDetectorsRef = useRef<Record<Hand, OnsetDetector>>({
    left: new OnsetDetector(),
    right: new OnsetDetector(),
  });
  const trialRuntimeRef = useRef<TrialRuntime>(createTrialRuntime());
  const lastUiUpdateRef = useRef(0);
  const comboTrackerRef = useRef<ComboSequenceTracker | null>(null);
  const guardReturnTrackerRef = useRef<GuardReturnTracker | null>(null);
  const guardReturnHitSnapshotRef = useRef<{
    t1Ms: number | null;
    t2Ms: number;
    confidence: number;
    peakVelocityMps: number | null;
    meanPunchVelocityMps: number | null;
  } | null>(null);
  const headTrackerRef = useRef(new HeadMotionTracker());
  const latestHeadObservationRef = useRef<HeadObservation | null>(null);
  const defenseTrackerRef = useRef<DefenseReflexTracker | null>(null);
  const virtualOpponentTrackerRef = useRef<VirtualOpponentTracker | null>(null);
  const virtualOpponentTimelineRef = useRef<VirtualOpponentTimeline | null>(null);

  const sessionIdRef = useRef("");
  const sessionStartedIsoRef = useRef("");
  const sessionEndedIsoRef = useRef("");

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
  useEffect(() => {
    audioModeRef.current = audioMode;
    if (audioMode === "off") stopSpeaking();
  }, [audioMode]);

  /**
   * Aynı geri bildirim tonu ard arda karelerde tetiklenebiliyor (ör. TOO SLOW
   * her frame yeniden yazılır). Aynı sesi 400 ms içinde tekrar çalmıyoruz —
   * yoksa tek bir yavaş vuruş makineli tüfek sesine dönüşüyor.
   */
  const playBeep = useCallback((kind: Parameters<typeof beep>[0]) => {
    if (audioModeRef.current === "off") return;
    const now = performance.now();
    const last = lastBeepRef.current;
    if (last && last.kind === kind && now - last.atMs < 400) return;
    lastBeepRef.current = { kind, atMs: now };
    beep(kind);
  }, []);

  /**
   * Cue duyurusu: her modda nötr bir bip, "voice" modunda ayrıca komutun
   * okunması. Peripheral protokolünde metin `null` gelir — yön sesle
   * sızdırılmaz (bkz. audioCues.ts).
   */
  const announceCue = useCallback(
    (stimulus: TrialStimulus) => {
      if (audioModeRef.current === "off") return;
      playBeep(cueBeep(stimulus));
      if (audioModeRef.current !== "voice") return;
      const phrase = cueSpeech(stimulus);
      if (phrase) speak(phrase, { rate: 1.15 });
    },
    [playBeep],
  );

  const showFeedback = useCallback((next: CanvasFeedback, clearAfterMs = 0) => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    const sound = feedbackBeep(next);
    if (sound) playBeep(sound);
    feedbackRef.current = next;
    setFeedback(next);
    if (clearAfterMs > 0) {
      feedbackTimerRef.current = window.setTimeout(() => {
        feedbackRef.current = null;
        setFeedback(null);
      }, clearAfterMs);
    }
  }, [playBeep]);

  const stopPipeline = useCallback(() => {
    schedulerRef.current?.stop();
    schedulerRef.current = null;
    poseClientRef.current?.close();
    poseClientRef.current = null;
    stopCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    bootingRef.current = false;
  }, []);

  const finalizeTrial = useCallback(
    (
      outcome: TrialOutcome,
      hand?: Hand,
      observation?: WristObservation,
      completedAtMs?: number,
    ) => {
      const state = gameRef.current;
      const runtime = trialRuntimeRef.current;
      if (
        state.status !== "TARGET_ACTIVE" ||
        runtime.completed ||
        !runtime.target ||
        !runtime.stimulus
      ) return;
      runtime.completed = true;

      const t0Ms = runtime.t0Ms;
      const t2Ms =
        (outcome === "HIT" || outcome === "WRONG_HAND") && observation
          ? observation.timestampMs
          : null;
      runtime.t2Ms = t2Ms;
      const t1Ms = hand ? runtime.t1ByHand[hand] : earliestOnset(runtime.t1ByHand);
      const velocities =
        hand && t1Ms !== null && t2Ms !== null
          ? velocitiesBetween(
              hand === "left"
                ? leftTrackerRef.current.getHistory()
                : rightTrackerRef.current.getHistory(),
              t1Ms,
              t2Ms,
            )
          : [];

      if (outcome === "TIMEOUT") runtime.qualityFlags.add("TARGET_TIMEOUT");
      if (outcome === "INVALID" && runtime.premature) {
        runtime.qualityFlags.add("PREMATURE_MOVEMENT");
      }
      if (t1Ms === null && outcome !== "CORRECT_REJECT") {
        runtime.qualityFlags.add("NO_ONSET_DETECTED");
      }
      const poseFps = estimateFps(poseFrameTimesRef.current);
      if (poseFps > 0 && poseFps < PERFORMANCE_CONFIG.camera.fpsWarningBelow) {
        runtime.qualityFlags.add("LOW_CAMERA_FPS");
      }
      const trackingQualityPct =
        runtime.trackingFrames > 0
          ? (runtime.usableTrackingFrames / runtime.trackingFrames) * 100
          : 0;
      if (trackingQualityPct < 80) runtime.qualityFlags.add("LOW_TRACKING_CONFIDENCE");

      const comboResult: ComboTrialResult | null =
        protocolId === "combo-speed" &&
        comboTrackerRef.current &&
        (outcome === "TIMEOUT" || outcome === "INVALID")
          ? comboTrackerRef.current.finishExternally(outcome, completedAtMs ?? performance.now())
          : null;
      if ((comboResult?.duplicateContactRejectedCount ?? 0) > 0) {
        runtime.qualityFlags.add("DUPLICATE_CONTACT_REJECTED");
      }

      const result: TrialResult = {
        trialIndex: state.trialIndex,
        protocolId,
        protocolVersion: protocol.version,
        stimulus: runtime.stimulus,
        target: runtime.target,
        targetDelayMs: state.pendingTrial?.targetDelayMs ?? 0,
        t0Ms,
        t1Ms,
        t2Ms,
        t3Ms: null,
        reactionTimeMs:
          t0Ms !== null && t1Ms !== null ? roundMetric(t1Ms - t0Ms, 2) : null,
        movementTimeMs:
          t1Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t1Ms, 2) : null,
        totalResponseMs:
          t0Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t0Ms, 2) : null,
        detectedHand: hand ?? null,
        handConfidence: observation?.confidence ?? null,
        firstHandToValidHit: outcome === "HIT" ? hand ?? null : null,
        requiredHand: runtime.stimulus.requiredHand,
        decisionCorrect: isDecisionCorrect(outcome),
        wrongHand: outcome === "WRONG_HAND",
        falseAttack: outcome === "FALSE_ATTACK",
        correctReject: outcome === "CORRECT_REJECT",
        decisionCompletedAtMs:
          completedAtMs ?? observation?.timestampMs ?? t2Ms,
        peakVelocityMps:
          velocities.length > 0 ? roundMetric(Math.max(...velocities), 3) : null,
        meanPunchVelocityMps: roundMetric(mean(velocities), 3),
        outcome,
        timeout: outcome === "TIMEOUT",
        prematureMovement: runtime.premature,
        trackingQualityPct: roundMetric(trackingQualityPct) ?? 0,
        processingFps: roundMetric(poseFps) ?? 0,
        qualityFlags: [...runtime.qualityFlags],
        combo: comboResult,
        guardReturn: null,
        defense: null,
        virtualOpponent: null,
      };

      setTelemetry({
        poseFps,
        videoFps: schedulerRef.current?.estimatedVideoFps() ?? 0,
        left: latestObservationsRef.current.left,
        right: latestObservationsRef.current.right,
        latestPose: latestPoseRef.current,
        runtime: copyTrialRuntime(runtime),
        combo: snapshotComboTracker(comboTrackerRef.current),
        guardReturn: snapshotGuardReturnTracker(guardReturnTrackerRef.current),
        defense: null,
        virtualOpponent: null,
      });

      if (outcome === "HIT") {
        showFeedback(
          { text: `DOĞRU · ${Math.round(result.totalResponseMs ?? 0)} ms`, tone: "hit" },
        );
      } else if (outcome === "CORRECT_REJECT") {
        showFeedback({ text: "DOĞRU · BEKLEDİN", tone: "hit" });
      } else if (outcome === "WRONG_HAND") {
        showFeedback({ text: "YANLIŞ EL", tone: "miss" });
      } else if (outcome === "FALSE_ATTACK") {
        showFeedback({ text: "DUR · HAREKET ETME", tone: "miss" });
      } else if (runtime.premature) {
        showFeedback({ text: "EARLY", tone: "early" });
      } else {
        showFeedback({ text: "MISS", tone: "miss" });
      }
      dispatch({ type: "TRIAL_FINISHED", result });
    },
    [protocol.version, protocolId, showFeedback],
  );

  const finalizeComboTrial = useCallback(
    (combo: ComboTrialResult) => {
      const state = gameRef.current;
      const runtime = trialRuntimeRef.current;
      if (
        state.status !== "TARGET_ACTIVE" ||
        runtime.completed ||
        !runtime.target ||
        !runtime.stimulus
      ) return;
      runtime.completed = true;
      if (combo.duplicateContactRejectedCount > 0) {
        runtime.qualityFlags.add("DUPLICATE_CONTACT_REJECTED");
      }
      const poseFps = estimateFps(poseFrameTimesRef.current);
      if (poseFps > 0 && poseFps < PERFORMANCE_CONFIG.camera.fpsWarningBelow) {
        runtime.qualityFlags.add("LOW_CAMERA_FPS");
      }
      const trackingQualityPct =
        runtime.trackingFrames > 0
          ? (runtime.usableTrackingFrames / runtime.trackingFrames) * 100
          : 0;
      if (trackingQualityPct < 80) runtime.qualityFlags.add("LOW_TRACKING_CONFIDENCE");

      const lastStep = combo.steps.at(-1) ?? null;
      const t0Ms = runtime.t0Ms;
      const t1Ms = combo.steps[0]?.onsetMs ?? null;
      const t2Ms = lastStep?.contactMs ?? null;
      const outcome: TrialOutcome = combo.outcome === "COMPLETE" ? "HIT" : "WRONG_HAND";
      const velocities = combo.steps
        .map((step) => step.peakVelocityMps)
        .filter((value): value is number => value !== null);

      const result: TrialResult = {
        trialIndex: state.trialIndex,
        protocolId,
        protocolVersion: protocol.version,
        stimulus: runtime.stimulus,
        target: runtime.target,
        targetDelayMs: state.pendingTrial?.targetDelayMs ?? 0,
        t0Ms,
        t1Ms,
        t2Ms,
        t3Ms: null,
        reactionTimeMs: t0Ms !== null && t1Ms !== null ? roundMetric(t1Ms - t0Ms, 2) : null,
        movementTimeMs: t1Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t1Ms, 2) : null,
        totalResponseMs: t0Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t0Ms, 2) : null,
        detectedHand: lastStep?.actualHand ?? null,
        handConfidence: null,
        firstHandToValidHit: combo.outcome === "COMPLETE" ? combo.steps[0]?.actualHand ?? null : null,
        requiredHand: runtime.stimulus.requiredHand,
        decisionCorrect: combo.outcome === "COMPLETE",
        wrongHand: combo.outcome === "WRONG_HAND",
        falseAttack: false,
        correctReject: false,
        decisionCompletedAtMs: t2Ms,
        peakVelocityMps: velocities.length > 0 ? roundMetric(Math.max(...velocities), 3) : null,
        meanPunchVelocityMps: roundMetric(mean(velocities), 3),
        outcome,
        timeout: false,
        prematureMovement: false,
        trackingQualityPct: roundMetric(trackingQualityPct) ?? 0,
        processingFps: roundMetric(poseFps) ?? 0,
        qualityFlags: [...runtime.qualityFlags],
        combo,
        guardReturn: null,
        defense: null,
        virtualOpponent: null,
      };

      setTelemetry({
        poseFps,
        videoFps: schedulerRef.current?.estimatedVideoFps() ?? 0,
        left: latestObservationsRef.current.left,
        right: latestObservationsRef.current.right,
        latestPose: latestPoseRef.current,
        runtime: copyTrialRuntime(runtime),
        combo: snapshotComboTracker(comboTrackerRef.current),
        guardReturn: snapshotGuardReturnTracker(guardReturnTrackerRef.current),
        defense: null,
        virtualOpponent: null,
      });

      if (outcome === "HIT") {
        showFeedback(
          { text: `COMBO TAMAM · ${Math.round(result.totalResponseMs ?? 0)} ms`, tone: "hit" },
        );
      } else {
        showFeedback({ text: "YANLIŞ SIRA", tone: "miss" });
      }
      dispatch({ type: "TRIAL_FINISHED", result });
    },
    [protocol.version, protocolId, showFeedback],
  );

  const finalizeGuardReturnTrial = useCallback(
    (guardReturn: GuardReturnResult) => {
      const state = gameRef.current;
      const runtime = trialRuntimeRef.current;
      if (
        state.status !== "TARGET_ACTIVE" ||
        runtime.completed ||
        !runtime.target ||
        !runtime.stimulus
      ) return;
      runtime.completed = true;
      guardReturnTrackerRef.current = null;
      const snapshot = guardReturnHitSnapshotRef.current;
      guardReturnHitSnapshotRef.current = null;

      if (guardReturn.outcome === "FAILED_RETURN") {
        runtime.qualityFlags.add("GUARD_RETURN_TIMEOUT");
      }
      const poseFps = estimateFps(poseFrameTimesRef.current);
      if (poseFps > 0 && poseFps < PERFORMANCE_CONFIG.camera.fpsWarningBelow) {
        runtime.qualityFlags.add("LOW_CAMERA_FPS");
      }
      const trackingQualityPct =
        runtime.trackingFrames > 0
          ? (runtime.usableTrackingFrames / runtime.trackingFrames) * 100
          : 0;
      if (trackingQualityPct < 80) runtime.qualityFlags.add("LOW_TRACKING_CONFIDENCE");

      const t0Ms = runtime.t0Ms;
      const t1Ms = snapshot?.t1Ms ?? null;
      const t2Ms = snapshot?.t2Ms ?? guardReturn.hitMs;

      const result: TrialResult = {
        trialIndex: state.trialIndex,
        protocolId,
        protocolVersion: protocol.version,
        stimulus: runtime.stimulus,
        target: runtime.target,
        targetDelayMs: state.pendingTrial?.targetDelayMs ?? 0,
        t0Ms,
        t1Ms,
        t2Ms,
        t3Ms: guardReturn.t3Ms,
        reactionTimeMs: t0Ms !== null && t1Ms !== null ? roundMetric(t1Ms - t0Ms, 2) : null,
        movementTimeMs: t1Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t1Ms, 2) : null,
        totalResponseMs: t0Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t0Ms, 2) : null,
        detectedHand: guardReturn.hand,
        handConfidence: snapshot?.confidence ?? null,
        firstHandToValidHit: guardReturn.hand,
        requiredHand: runtime.stimulus.requiredHand,
        decisionCorrect: true,
        wrongHand: false,
        falseAttack: false,
        correctReject: false,
        decisionCompletedAtMs: guardReturn.t3Ms ?? t2Ms,
        peakVelocityMps: snapshot?.peakVelocityMps ?? null,
        meanPunchVelocityMps: snapshot?.meanPunchVelocityMps ?? null,
        outcome: "HIT",
        timeout: false,
        prematureMovement: false,
        trackingQualityPct: roundMetric(trackingQualityPct) ?? 0,
        processingFps: roundMetric(poseFps) ?? 0,
        qualityFlags: [...runtime.qualityFlags],
        combo: null,
        guardReturn,
        defense: null,
        virtualOpponent: null,
      };

      setTelemetry({
        poseFps,
        videoFps: schedulerRef.current?.estimatedVideoFps() ?? 0,
        left: latestObservationsRef.current.left,
        right: latestObservationsRef.current.right,
        latestPose: latestPoseRef.current,
        runtime: copyTrialRuntime(runtime),
        combo: snapshotComboTracker(comboTrackerRef.current),
        guardReturn: snapshotGuardReturnTracker(guardReturnTrackerRef.current),
        defense: null,
        virtualOpponent: null,
      });

      if (guardReturn.outcome === "RETURNED") {
        showFeedback({ text: `GUARD · ${Math.round(guardReturn.returnTimeMs ?? 0)} ms`, tone: "hit" });
      } else {
        showFeedback({ text: "GUARD'A DÖNEMEDİN", tone: "miss" });
      }
      dispatch({ type: "TRIAL_FINISHED", result });
    },
    [protocol.version, protocolId, showFeedback],
  );

  const finalizeDefenseTrial = useCallback(
    (defense: DefenseTrialResult) => {
      const state = gameRef.current;
      const runtime = trialRuntimeRef.current;
      if (
        state.status !== "TARGET_ACTIVE" ||
        runtime.completed ||
        !runtime.target ||
        !runtime.stimulus
      ) return;
      runtime.completed = true;
      defenseTrackerRef.current = null;

      // Fiziksel olarak doğru yön + yeterli displacement = geçerli savunma; stabil
      // toparlanma başarısız olsa bile (Guard Return'deki FAILED_RETURN ile aynı
      // mantık), asıl savunma hareketi doğru sayılır.
      const outcome: TrialOutcome =
        defense.outcome === "CORRECT" || defense.outcome === "FAILED_RECOVERY"
          ? "HIT"
          : defense.outcome === "WRONG_DIRECTION"
            ? "WRONG_HAND"
            : defense.outcome === "INSUFFICIENT_DISPLACEMENT"
              ? "MISS"
              : "TIMEOUT";

      if (defense.outcome === "FAILED_RECOVERY") {
        runtime.qualityFlags.add("DEFENSE_RECOVERY_TIMEOUT");
      }
      if (defense.outcome === "NO_RESPONSE") {
        runtime.qualityFlags.add("NO_ONSET_DETECTED");
      }
      const poseFps = estimateFps(poseFrameTimesRef.current);
      if (poseFps > 0 && poseFps < PERFORMANCE_CONFIG.camera.fpsWarningBelow) {
        runtime.qualityFlags.add("LOW_CAMERA_FPS");
      }
      const trackingQualityPct =
        runtime.trackingFrames > 0
          ? (runtime.usableTrackingFrames / runtime.trackingFrames) * 100
          : 0;
      if (trackingQualityPct < 80) runtime.qualityFlags.add("LOW_TRACKING_CONFIDENCE");

      const t0Ms = runtime.t0Ms;
      const t1Ms = defense.onsetMs;
      const t2Ms = defense.completionMs;

      const result: TrialResult = {
        trialIndex: state.trialIndex,
        protocolId,
        protocolVersion: protocol.version,
        stimulus: runtime.stimulus,
        target: runtime.target,
        targetDelayMs: state.pendingTrial?.targetDelayMs ?? 0,
        t0Ms,
        t1Ms,
        t2Ms,
        t3Ms: defense.recoveryMs,
        reactionTimeMs: defense.reactionMs,
        movementTimeMs: defense.movementMs,
        totalResponseMs: t0Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t0Ms, 2) : null,
        detectedHand: null,
        handConfidence: null,
        firstHandToValidHit: null,
        requiredHand: runtime.stimulus.requiredHand,
        decisionCorrect: outcome === "HIT" ? true : outcome === "TIMEOUT" ? false : false,
        wrongHand: defense.outcome === "WRONG_DIRECTION",
        falseAttack: false,
        correctReject: false,
        decisionCompletedAtMs: defense.recoveryMs ?? t2Ms ?? t1Ms,
        peakVelocityMps: null,
        meanPunchVelocityMps: null,
        outcome,
        timeout: defense.outcome === "NO_RESPONSE",
        prematureMovement: false,
        trackingQualityPct: roundMetric(trackingQualityPct) ?? 0,
        processingFps: roundMetric(poseFps) ?? 0,
        qualityFlags: [...runtime.qualityFlags],
        combo: null,
        guardReturn: null,
        defense,
        virtualOpponent: null,
      };

      setTelemetry({
        poseFps,
        videoFps: schedulerRef.current?.estimatedVideoFps() ?? 0,
        left: latestObservationsRef.current.left,
        right: latestObservationsRef.current.right,
        latestPose: latestPoseRef.current,
        runtime: copyTrialRuntime(runtime),
        combo: snapshotComboTracker(comboTrackerRef.current),
        guardReturn: snapshotGuardReturnTracker(guardReturnTrackerRef.current),
        defense: null,
        virtualOpponent: null,
      });

      if (outcome === "HIT") {
        showFeedback({
          text:
            defense.outcome === "CORRECT"
              ? `DOĞRU · ${Math.round(defense.reactionMs ?? 0)} ms`
              : "DOĞRU · TOPARLANMA YOK",
          tone: "hit",
        });
      } else if (outcome === "WRONG_HAND") {
        showFeedback({ text: "YANLIŞ YÖN", tone: "miss" });
      } else if (outcome === "MISS") {
        showFeedback({ text: "YETERSİZ HAREKET", tone: "miss" });
      } else {
        showFeedback({ text: "YANIT YOK", tone: "miss" });
      }
      dispatch({ type: "TRIAL_FINISHED", result });
    },
    [protocol.version, protocolId, showFeedback],
  );

  const finalizeVirtualOpponentTrial = useCallback(
    (vo: VirtualOpponentTrialResult) => {
      const state = gameRef.current;
      const runtime = trialRuntimeRef.current;
      if (
        state.status !== "TARGET_ACTIVE" ||
        runtime.completed ||
        !runtime.target ||
        !runtime.stimulus
      ) return;
      runtime.completed = true;
      virtualOpponentTrackerRef.current = null;

      const outcome: TrialOutcome =
        vo.outcome === "DEFEATED_ATTACK"
          ? "HIT"
          : vo.outcome === "WRONG_RESPONSE"
            ? "WRONG_HAND"
            : vo.outcome === "TOO_LATE"
              ? "MISS"
              : "TIMEOUT";

      if (vo.outcome === "TOO_LATE") runtime.qualityFlags.add("OPPONENT_ATTACK_LANDED");
      if (vo.outcome === "NO_RESPONSE") runtime.qualityFlags.add("NO_ONSET_DETECTED");
      if (vo.combo && vo.combo.duplicateContactRejectedCount > 0) {
        runtime.qualityFlags.add("DUPLICATE_CONTACT_REJECTED");
      }
      const poseFps = estimateFps(poseFrameTimesRef.current);
      if (poseFps > 0 && poseFps < PERFORMANCE_CONFIG.camera.fpsWarningBelow) {
        runtime.qualityFlags.add("LOW_CAMERA_FPS");
      }
      const trackingQualityPct =
        runtime.trackingFrames > 0
          ? (runtime.usableTrackingFrames / runtime.trackingFrames) * 100
          : 0;
      if (trackingQualityPct < 80) runtime.qualityFlags.add("LOW_TRACKING_CONFIDENCE");

      const t0Ms = runtime.t0Ms;
      const t1Ms = vo.onsetMs;
      const t2Ms = vo.completionMs;
      const detectedHand = vo.combo?.steps[0]?.actualHand ?? null;

      const result: TrialResult = {
        trialIndex: state.trialIndex,
        protocolId,
        protocolVersion: protocol.version,
        stimulus: runtime.stimulus,
        target: runtime.target,
        targetDelayMs: state.pendingTrial?.targetDelayMs ?? 0,
        t0Ms,
        t1Ms,
        t2Ms,
        t3Ms: null,
        reactionTimeMs: vo.reactionMs,
        movementTimeMs:
          t1Ms !== null && t2Ms !== null ? roundMetric(t2Ms - t1Ms, 2) : null,
        totalResponseMs: vo.responseTimeMs,
        detectedHand,
        handConfidence: null,
        firstHandToValidHit: vo.outcome === "DEFEATED_ATTACK" || vo.outcome === "TOO_LATE" ? detectedHand : null,
        requiredHand: runtime.stimulus.requiredHand,
        decisionCorrect: outcome === "HIT",
        wrongHand: vo.outcome === "WRONG_RESPONSE",
        falseAttack: false,
        correctReject: false,
        decisionCompletedAtMs: t2Ms ?? t1Ms ?? t0Ms,
        peakVelocityMps: vo.combo?.steps[0]?.peakVelocityMps ?? null,
        meanPunchVelocityMps: null,
        outcome,
        timeout: vo.outcome === "NO_RESPONSE",
        prematureMovement: false,
        trackingQualityPct: roundMetric(trackingQualityPct) ?? 0,
        processingFps: roundMetric(poseFps) ?? 0,
        qualityFlags: [...runtime.qualityFlags],
        combo: null,
        guardReturn: null,
        defense: null,
        virtualOpponent: vo,
      };

      setTelemetry({
        poseFps,
        videoFps: schedulerRef.current?.estimatedVideoFps() ?? 0,
        left: latestObservationsRef.current.left,
        right: latestObservationsRef.current.right,
        latestPose: latestPoseRef.current,
        runtime: copyTrialRuntime(runtime),
        combo: snapshotComboTracker(comboTrackerRef.current),
        guardReturn: snapshotGuardReturnTracker(guardReturnTrackerRef.current),
        defense: null,
        virtualOpponent: null,
      });

      if (outcome === "HIT") {
        showFeedback({
          text: `RAKİP ALT EDİLDİ · ${Math.round(vo.responseTimeMs ?? 0)} ms`,
          tone: "hit",
        });
      } else if (outcome === "MISS") {
        showFeedback({ text: "GEÇ KALDIN · RAKİP VURDU", tone: "miss" });
      } else if (outcome === "WRONG_HAND") {
        showFeedback({ text: "YANLIŞ YANIT", tone: "miss" });
      } else {
        showFeedback({ text: "YANIT YOK", tone: "miss" });
      }
      dispatch({ type: "TRIAL_FINISHED", result });
    },
    [protocol.version, protocolId, showFeedback],
  );

  const handlePoseSample = useCallback((sample: PoseSample) => {
    latestPoseRef.current = sample;
    poseSamplesRef.current.push(sample);
    const sampleCutoff = sample.timestampMs - 6_000;
    while (poseSamplesRef.current.length > 0 && poseSamplesRef.current[0].timestampMs < sampleCutoff) {
      poseSamplesRef.current.shift();
    }
    poseFrameTimesRef.current.push(sample.timestampMs);
    const fpsCutoff = sample.timestampMs - 2_000;
    while (poseFrameTimesRef.current.length > 0 && poseFrameTimesRef.current[0] < fpsCutoff) {
      poseFrameTimesRef.current.shift();
    }

    const canvas = canvasRef.current;
    const canvasSize = canvas
      ? { width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) }
      : { width: cameraRef.current?.width ?? 1, height: cameraRef.current?.height ?? 1 };
    const calibrationValue = calibrationRef.current;
    const left = leftTrackerRef.current.update(sample, calibrationValue, canvasSize);
    const right = rightTrackerRef.current.update(sample, calibrationValue, canvasSize);
    latestObservationsRef.current = { left, right };
    const head = headTrackerRef.current.update(
      sample,
      calibrationValue?.headNeutralWorld ?? null,
      canvasSize,
    );
    latestHeadObservationRef.current = head;

    if (gameRef.current.status === "CALIBRATION" && cameraRef.current) {
      const evaluation = evaluateCalibration(
        poseSamplesRef.current,
        cameraRef.current,
        sample.timestampMs,
      );
      setCalibrationEvaluation(evaluation);
      if (evaluation.ready && evaluation.snapshot && !calibrationRef.current) {
        calibrationRef.current = evaluation.snapshot;
        setCalibration(evaluation.snapshot);
        leftTrackerRef.current.reset();
        rightTrackerRef.current.reset();
        dispatch({ type: "CALIBRATION_PASSED" });
      }
    }

    if (gameRef.current.status === "TARGET_ACTIVE") {
      const runtime = trialRuntimeRef.current;
      runtime.trackingFrames += 1;
      if (
        sample.poseCount === 1 &&
        left &&
        right &&
        sample.visibility.leftShoulder >= PERFORMANCE_CONFIG.pose.minVisibility &&
        sample.visibility.rightShoulder >= PERFORMANCE_CONFIG.pose.minVisibility
      ) {
        runtime.usableTrackingFrames += 1;
      } else if (sample.poseCount === 0) {
        runtime.qualityFlags.add("BODY_OUT_OF_FRAME");
      }
      if (sample.poseCount > 1) runtime.qualityFlags.add("MULTIPLE_PERSON_UNSUPPORTED");

      for (const observation of [left, right]) {
        if (!observation || runtime.completed || runtime.t0Ms === null) continue;
        if (observation.frameGap) runtime.qualityFlags.add("FRAME_GAP");
        if (observation.landmarkJump) runtime.qualityFlags.add("LANDMARK_JUMP");
      }

      const activeGuardReturn =
        protocolId === "guard-return" && !runtime.completed ? guardReturnTrackerRef.current : null;

      if (activeGuardReturn && calibrationRef.current) {
        const observation = activeGuardReturn.hand === "left" ? left : right;
        if (observation) {
          const zone = createGuardZone(calibrationRef.current, canvasSize, activeGuardReturn.hand);
          const resolved = activeGuardReturn.update(
            observation,
            { x: zone.displayX, y: zone.displayY },
            zone.radiusPx,
          );
          if (resolved) finalizeGuardReturnTrial(resolved);
        }
      } else if (
        protocolId === "combo-speed" &&
        comboTrackerRef.current &&
        !runtime.completed &&
        runtime.target &&
        runtime.stimulus
      ) {
        const resolved = comboTrackerRef.current.update(
          { left, right },
          scaleTarget(runtime.target, canvasSize),
        );
        if (resolved) finalizeComboTrial(resolved);
      } else if (
        protocolId === "defense-reflex" &&
        defenseTrackerRef.current &&
        !runtime.completed &&
        calibrationRef.current
      ) {
        if (head) {
          const neutral = headNeutralDisplayPoint(calibrationRef.current, canvasSize);
          const resolved = defenseTrackerRef.current.update(
            head,
            neutral,
            canvasSize.width,
            canvasSize.height,
          );
          if (resolved) finalizeDefenseTrial(resolved);
        }
      } else if (
        protocolId === "virtual-opponent" &&
        virtualOpponentTrackerRef.current &&
        !runtime.completed &&
        runtime.target &&
        runtime.stimulus &&
        calibrationRef.current
      ) {
        const neutral = headNeutralDisplayPoint(calibrationRef.current, canvasSize);
        const resolved = virtualOpponentTrackerRef.current.update({
          left,
          right,
          head,
          target: scaleTarget(runtime.target, canvasSize),
          neutralDisplay: neutral,
          canvasWidth: canvasSize.width,
          canvasHeight: canvasSize.height,
        });
        if (resolved) {
          finalizeVirtualOpponentTrial(resolved);
        } else {
          const deadlineResolved = virtualOpponentTrackerRef.current.checkDeadline(
            sample.timestampMs,
          );
          if (deadlineResolved) finalizeVirtualOpponentTrial(deadlineResolved);
        }
      } else {
        for (const observation of [left, right]) {
          if (
            !observation ||
            runtime.completed ||
            runtime.t0Ms === null ||
            !runtime.target ||
            !runtime.stimulus
          ) continue;

          const onset = onsetDetectorsRef.current[observation.hand].update(
            observation,
            runtime.t0Ms,
          );
          if (onset.t1Ms !== null && runtime.t1ByHand[observation.hand] === null) {
            runtime.t1ByHand[observation.hand] = onset.t1Ms;
          }

          if (isNoGoStimulus(runtime.stimulus)) {
            if (onset.t1Ms !== null) {
              finalizeTrial(
                outcomeForNoGoWindow({
                  t0Ms: runtime.t0Ms,
                  inhibitionWindowMs:
                    runtime.stimulus.inhibitionWindowMs ??
                    PERFORMANCE_CONFIG.decision.noGoInhibitionWindowMs,
                  movementOnsetMs: onset.t1Ms,
                }),
                observation.hand,
                observation,
              );
              break;
            }
            continue;
          }

          const hit = checkHit({
            targetActive: true,
            trialCompleted: runtime.completed,
            observation,
            target: scaleTarget(runtime.target, canvasSize),
            t1Ms: runtime.t1ByHand[observation.hand],
            wasOutsideTarget: runtime.wasOutside[observation.hand],
          });
          if (!hit.insideTarget) runtime.wasOutside[observation.hand] = true;
          if (hit.reason === "INVALID_HIT_SPEED") {
            runtime.qualityFlags.add(hit.reason);
            showFeedback({ text: "TOO SLOW", tone: "slow" }, 380);
          } else if (hit.reason === "INVALID_HIT_DIRECTION") {
            runtime.qualityFlags.add(hit.reason);
          } else if (hit.reason === "LOW_TRACKING_CONFIDENCE") {
            runtime.qualityFlags.add(hit.reason);
          }
          if (hit.accepted) {
            if (protocolId === "guard-return" && calibrationRef.current) {
              const t1 = runtime.t1ByHand[observation.hand];
              const t2 = observation.timestampMs;
              const velocities =
                t1 !== null
                  ? velocitiesBetween(
                      observation.hand === "left"
                        ? leftTrackerRef.current.getHistory()
                        : rightTrackerRef.current.getHistory(),
                      t1,
                      t2,
                    )
                  : [];
              guardReturnHitSnapshotRef.current = {
                t1Ms: t1,
                t2Ms: t2,
                confidence: observation.confidence,
                peakVelocityMps:
                  velocities.length > 0 ? roundMetric(Math.max(...velocities), 3) : null,
                meanPunchVelocityMps: roundMetric(mean(velocities), 3),
              };
              guardReturnTrackerRef.current = new GuardReturnTracker(observation.hand, t2);
              showFeedback({ text: "GUARD'A DÖN", tone: "hit" }, 500);
            } else {
              finalizeTrial(
                outcomeForTargetHit(runtime.stimulus, observation.hand),
                observation.hand,
                observation,
              );
            }
            break;
          }
        }
      }
    }

    // Pose/canvas refs frame hızında akar; React HUD yalnız 2 Hz yenilenir.
    if (sample.timestampMs - lastUiUpdateRef.current >= 500) {
      lastUiUpdateRef.current = sample.timestampMs;
      setTelemetry({
        poseFps: estimateFps(poseFrameTimesRef.current),
        videoFps: schedulerRef.current?.estimatedVideoFps() ?? 0,
        left,
        right,
        latestPose: sample,
        runtime: copyTrialRuntime(trialRuntimeRef.current),
        combo: snapshotComboTracker(comboTrackerRef.current),
        guardReturn: snapshotGuardReturnTracker(guardReturnTrackerRef.current),
        defense: snapshotDefenseTracker(
          defenseTrackerRef.current,
          trialRuntimeRef.current.stimulus?.defenseAction ?? null,
        ),
        virtualOpponent: snapshotVirtualOpponentTracker(
          virtualOpponentTrackerRef.current,
          trialRuntimeRef.current.stimulus?.virtualOpponentAttackType ?? null,
          trialRuntimeRef.current.stimulus?.virtualOpponentResponseChannel ?? null,
          trialRuntimeRef.current.stimulus?.virtualOpponentTempoLevel ?? null,
          virtualOpponentTimelineRef.current,
        ),
      });
    }
  }, [
    finalizeComboTrial,
    finalizeDefenseTrial,
    finalizeGuardReturnTrial,
    finalizeTrial,
    finalizeVirtualOpponentTrial,
    protocolId,
    showFeedback,
  ]);

  const bootPipeline = useCallback(
    async (deviceId?: string) => {
      if (bootingRef.current) return;
      bootingRef.current = true;
      setRuntimeWarning(null);
      setPipelineStatus("camera");
      schedulerRef.current?.stop();
      poseClientRef.current?.close();
      stopCamera(streamRef.current);
      streamRef.current = null;

      try {
        const session = await openCamera(deviceId);
        streamRef.current = session.stream;
        cameraRef.current = session.snapshot;
        setCamera(session.snapshot);
        setCameraDevices(session.devices);
        setSelectedDeviceId(session.snapshot.deviceId ?? deviceId ?? "");
        const video = videoRef.current;
        if (!video) throw new Error("Kamera önizlemesi hazırlanamadı.");
        video.srcObject = session.stream;
        await video.play();

        setPipelineStatus("pose");
        const poseClient = new PoseClient();
        poseClientRef.current = poseClient;
        const mode = await poseClient.initialize(
          handlePoseSample,
          (message) => setRuntimeWarning(`Pose frame atlandı: ${message}`),
        );
        setInferenceMode(mode);
        const scheduler = new VideoFrameScheduler(video, (timestampMs) => {
          void poseClient.processFrame(video, timestampMs);
        });
        schedulerRef.current = scheduler;
        scheduler.start();
        setPipelineStatus("ready");
        if (gameRef.current.status === "CAMERA_PERMISSION") {
          dispatch({ type: "CAMERA_GRANTED" });
        }
      } catch (error) {
        stopPipeline();
        dispatch({ type: "FAIL", error: cameraErrorMessage(error) });
      } finally {
        bootingRef.current = false;
      }
    },
    [handlePoseSample, stopPipeline],
  );

  useEffect(() => {
    return () => {
      stopPipeline();
      if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, [stopPipeline]);

  useEffect(() => {
    if (game.status !== "COUNTDOWN") return;
    playBeep("tick");
    const timer = window.setInterval(() => {
      // Sayaç ref üzerinden düşürülür: bip çalmak bir yan etki, bu yüzden
      // setState updater'ının içine konamaz (StrictMode updater'ı iki kez çağırır).
      const next = (countdownRef.current ?? 1) - 1;
      countdownRef.current = next;
      setCountdown(next > 0 ? next : 0);
      if (next > 0) {
        playBeep("tick");
        return;
      }
      window.clearInterval(timer);
      playBeep("go");
      dispatch({ type: "COUNTDOWN_DONE" });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [game.status, playBeep]);

  useEffect(() => {
    if (
      game.status !== "WAITING_FOR_TARGET" ||
      game.pendingTrial ||
      !calibrationRef.current ||
      preparedTrialRef.current === game.trialIndex
    ) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = fitCanvas(canvas);
    const generated = createProtocolTrial({
      protocolId,
      calibration: calibrationRef.current,
      canvas: size,
      previousZoneIndex: game.results.at(-1)?.target.zoneIndex ?? null,
      previousStimuli: game.results.map((result) => result.stimulus),
    });
    preparedTrialRef.current = game.trialIndex;
    dispatch({
      type: "PREPARE_TRIAL",
      trial: {
        trialIndex: game.trialIndex,
        target: generated.target,
        targetDelayMs: generated.targetDelayMs,
        t0Ms: null,
        stimulus: generated.stimulus,
      },
    });
  }, [game.pendingTrial, game.results, game.status, game.trialIndex, protocolId]);

  useEffect(() => {
    if (
      game.status !== "WAITING_FOR_TARGET" ||
      !game.pendingTrial ||
      revealTimerRef.current !== null ||
      pendingRevealRef.current
    ) {
      return;
    }
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      pendingRevealRef.current = true;
    }, game.pendingTrial.targetDelayMs);
    return () => {
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    };
  }, [game.pendingTrial, game.status]);

  useEffect(() => {
    if (game.status !== "TARGET_ACTIVE") return;
    if (trialRuntimeRef.current.premature) {
      finalizeTrial("INVALID");
      return;
    }
    const stimulus = trialRuntimeRef.current.stimulus;
    const isNoGo = isNoGoStimulus(stimulus);
    const duration = isNoGo
      ? stimulus?.inhibitionWindowMs ?? PERFORMANCE_CONFIG.decision.noGoInhibitionWindowMs
      : protocolId === "combo-speed"
        ? PERFORMANCE_CONFIG.phase2.comboTotalTimeoutMs
        : protocolId === "guard-return"
          ? PERFORMANCE_CONFIG.target.timeoutMs + PERFORMANCE_CONFIG.phase2.guardReturnTimeoutMs
          : protocolId === "defense-reflex"
            ? PERFORMANCE_CONFIG.phase3.defense.responseTimeoutMs +
              PERFORMANCE_CONFIG.phase3.defense.recoveryTimeoutMs
            : protocolId === "virtual-opponent"
              ? PERFORMANCE_CONFIG.phase4.virtualOpponentSafetyTimeoutMs
              : PERFORMANCE_CONFIG.target.timeoutMs;
    const timer = window.setTimeout(() => {
      // Tracking tamamen kesilirse (ör. kişi kadraj dışına çıkarsa) guard dönüşü
      // hiç frame almadan sonsuza dek beklemesin diye dış güvenlik ağı.
      if (protocolId === "guard-return" && guardReturnTrackerRef.current) {
        finalizeGuardReturnTrial(guardReturnTrackerRef.current.forceResolve());
        return;
      }
      if (protocolId === "defense-reflex" && defenseTrackerRef.current) {
        finalizeDefenseTrial(defenseTrackerRef.current.finishExternally(performance.now()));
        return;
      }
      if (protocolId === "virtual-opponent" && virtualOpponentTrackerRef.current) {
        finalizeVirtualOpponentTrial(
          virtualOpponentTrackerRef.current.finishExternally(performance.now()),
        );
        return;
      }
      finalizeTrial(
        isNoGo
          ? outcomeForNoGoWindow({
              t0Ms: trialRuntimeRef.current.t0Ms ?? performance.now(),
              inhibitionWindowMs: duration,
              movementOnsetMs: null,
            })
          : "TIMEOUT",
        undefined,
        undefined,
        performance.now(),
      );
    }, duration);
    return () => window.clearTimeout(timer);
  }, [
    finalizeDefenseTrial,
    finalizeGuardReturnTrial,
    finalizeTrial,
    finalizeVirtualOpponentTrial,
    game.status,
    protocolId,
  ]);

  useEffect(() => {
    if (game.status !== "TRIAL_COMPLETE") return;
    const timer = window.setTimeout(() => {
      showFeedback(null);
      preparedTrialRef.current = null;
      dispatch({ type: "NEXT_TRIAL", trialCount: protocol.trialCount });
    }, PERFORMANCE_CONFIG.session.interTrialFeedbackMs);
    return () => window.clearTimeout(timer);
  }, [game.status, protocol.trialCount, showFeedback]);

  useEffect(() => {
    if (game.status === "SESSION_COMPLETE" && !sessionEndedIsoRef.current) {
      sessionEndedIsoRef.current = new Date().toISOString();
      playBeep("finish");
      if (audioModeRef.current === "voice") speak("Seans tamamlandı", { rate: 1 });
    }
  }, [game.status, playBeep]);

  // Bileşen kapanırken konuşma ve AudioContext bırakılır; aksi hâlde sekme
  // değişince komut okumaya devam ediyor.
  useEffect(() => () => releaseAudio(), []);

  useEffect(() => {
    const renderModel = (
      state: GameState,
      target: TargetSnapshot | null,
      targetVisible: boolean,
      canvasSize: CanvasSize,
    ) => {
      const runtime = trialRuntimeRef.current;
      const comboTracker = comboTrackerRef.current;
      const guardTracker = guardReturnTrackerRef.current;
      const calibration = calibrationRef.current;
      const stimulus = state.pendingTrial?.stimulus ?? runtime.stimulus;
      const voTimeline = virtualOpponentTimelineRef.current;
      return {
        pose: latestPoseRef.current,
        target,
        targetVisible,
        stimulus,
        comboStepLabel:
          protocolId === "combo-speed" && comboTracker && !comboTracker.isFinished
            ? handLabel(comboTracker.expectedHand)
            : null,
        guardZone:
          protocolId === "guard-return" && guardTracker && calibration
            ? {
                ...createGuardZone(calibration, canvasSize, guardTracker.hand),
                stable: guardTracker.consecutiveInsideFrames > 0,
              }
            : null,
        opponentCue:
          protocolId === "virtual-opponent" &&
          stimulus?.virtualOpponentAttackType &&
          voTimeline &&
          runtime.t0Ms !== null
            ? {
                attackType: stimulus.virtualOpponentAttackType,
                cueStartMs: runtime.t0Ms,
                attackCommitMs: voTimeline.attackCommitMs,
                attackLandMs: voTimeline.attackLandMs,
              }
            : null,
        showCenterFixation: protocolId === "peripheral-reaction" && isTestState(state.status),
        countdown: state.status === "COUNTDOWN" ? countdownRef.current : null,
        feedback: feedbackRef.current,
        debug,
        calibration,
        leftObservation: latestObservationsRef.current.left,
        rightObservation: latestObservationsRef.current.right,
        leftHistory: leftTrackerRef.current.getHistory(),
        rightHistory: rightTrackerRef.current.getHistory(),
        stateLabel: state.status,
        t0Ms: runtime.t0Ms,
        t1Ms: earliestOnset(runtime.t1ByHand),
        t2Ms: runtime.t2Ms,
      };
    };

    const loop = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const state = gameRef.current;
        const size = fitCanvas(canvas);
        if (
          state.status === "WAITING_FOR_TARGET" &&
          state.pendingTrial &&
          pendingRevealRef.current
        ) {
          const target = scaleTarget(state.pendingTrial.target, size);
          const runtime = createTrialRuntime();
          runtime.target = target;
          runtime.stimulus = state.pendingTrial.stimulus;
          runtime.t0Ms = now;
          runtime.premature =
            hasPrematureMovement(leftTrackerRef.current.getHistory(), now) ||
            hasPrematureMovement(rightTrackerRef.current.getHistory(), now);
          if (runtime.premature) runtime.qualityFlags.add("PREMATURE_MOVEMENT");
          runtime.wasOutside.left = latestObservationsRef.current.left
            ? !isInsideTarget(latestObservationsRef.current.left.display, target)
            : false;
          runtime.wasOutside.right = latestObservationsRef.current.right
            ? !isInsideTarget(latestObservationsRef.current.right.display, target)
            : false;
          trialRuntimeRef.current = runtime;
          onsetDetectorsRef.current.left.reset();
          onsetDetectorsRef.current.right.reset();
          comboTrackerRef.current =
            protocolId === "combo-speed" && state.pendingTrial.stimulus.comboSequence
              ? new ComboSequenceTracker(state.pendingTrial.stimulus.comboSequence, now)
              : null;
          guardReturnTrackerRef.current = null;
          guardReturnHitSnapshotRef.current = null;
          defenseTrackerRef.current =
            protocolId === "defense-reflex" &&
            state.pendingTrial.stimulus.defenseAction &&
            calibrationRef.current
              ? new DefenseReflexTracker(
                  state.pendingTrial.stimulus.defenseAction,
                  now,
                  calibrationRef.current.shoulderWidthNormalized,
                )
              : null;
          if (
            protocolId === "virtual-opponent" &&
            state.pendingTrial.stimulus.virtualOpponentAttackType &&
            state.pendingTrial.stimulus.virtualOpponentResponseChannel &&
            state.pendingTrial.stimulus.virtualOpponentTempoLevel &&
            calibrationRef.current
          ) {
            const voStimulus = state.pendingTrial.stimulus;
            const timeline = buildVirtualOpponentTimeline(
              now,
              voStimulus.virtualOpponentTempoLevel!,
            );
            virtualOpponentTimelineRef.current = timeline;
            virtualOpponentTrackerRef.current = new VirtualOpponentTracker(
              voStimulus.virtualOpponentAttackType!,
              voStimulus.virtualOpponentResponseChannel!,
              voStimulus.virtualOpponentResponseChannel === "COUNTER"
                ? (voStimulus.comboSequence ?? ["left"])
                : (voStimulus.defenseAction ?? "DUCK"),
              now,
              voStimulus.virtualOpponentTempoLevel!,
              timeline,
              calibrationRef.current.shoulderWidthNormalized,
            );
          } else {
            virtualOpponentTimelineRef.current = null;
            virtualOpponentTrackerRef.current = null;
          }
          pendingRevealRef.current = false;
          renderFightLabCanvas(canvas, {
            ...renderModel(state, target, true, size),
            target,
            targetVisible: true,
            t0Ms: now,
          });
          dispatch({ type: "TARGET_SHOWN", t0Ms: now });
          // Ses T0'dan SONRA tetiklenir; seslendirme gecikmesi görsel cue'nun
          // zamanlamasını kaydırmasın.
          announceCue(state.pendingTrial.stimulus);
        } else {
          renderFightLabCanvas(
            canvas,
            renderModel(
              state,
              state.pendingTrial?.target ?? trialRuntimeRef.current.target,
              state.status === "TARGET_ACTIVE" || state.status === "TRIAL_COMPLETE",
              size,
            ),
          );
        }
      }
      renderFrameRef.current = requestAnimationFrame(loop);
    };

    renderFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
    };
  }, [announceCue, debug, protocolId]);

  useEffect(() => {
    const onVisibility = () => {
      if (
        document.hidden &&
        ["COUNTDOWN", "WAITING_FOR_TARGET", "TARGET_ACTIVE"].includes(gameRef.current.status)
      ) {
        dispatch({ type: "PAUSE" });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const { poseFps, videoFps } = telemetry;
  const summary = useMemo(
    () => buildSessionSummary(game.results, poseFps),
    [game.results, poseFps],
  );

  const beginCamera = () => {
    dispatch({ type: "START" });
    requestAnimationFrame(() => void bootPipeline());
  };

  const beginCalibration = () => {
    poseSamplesRef.current = [];
    calibrationRef.current = null;
    setCalibration(null);
    setCalibrationEvaluation(EMPTY_CALIBRATION);
    leftTrackerRef.current.reset();
    rightTrackerRef.current.reset();
    dispatch({ type: "BEGIN_CALIBRATION" });
  };

  const startSession = () => {
    sessionIdRef.current = createSessionId();
    sessionStartedIsoRef.current = new Date().toISOString();
    sessionEndedIsoRef.current = "";
    poseFrameTimesRef.current = [];
    preparedTrialRef.current = null;
    trialRuntimeRef.current = createTrialRuntime();
    comboTrackerRef.current = null;
    guardReturnTrackerRef.current = null;
    guardReturnHitSnapshotRef.current = null;
    defenseTrackerRef.current = null;
    virtualOpponentTrackerRef.current = null;
    virtualOpponentTimelineRef.current = null;
    headTrackerRef.current.reset();
    const initialCountdown = PERFORMANCE_CONFIG.session.countdownSeconds;
    countdownRef.current = initialCountdown;
    setCountdown(initialCountdown);
    showFeedback(null);
    // ★ Kullanıcı hareketi içindeyiz — ses motorları yalnızca burada açılabilir.
    if (audioMode !== "off") {
      initAudio();
      if (audioMode === "voice") speak(`${protocol.shortName} başlıyor`);
    }
    dispatch({ type: "START_SESSION" });
  };

  const restart = () => {
    stopPipeline();
    setPipelineStatus("idle");
    setInferenceMode(null);
    setCamera(null);
    cameraRef.current = null;
    setCameraDevices([]);
    calibrationRef.current = null;
    setCalibration(null);
    setCalibrationEvaluation(EMPTY_CALIBRATION);
    poseSamplesRef.current = [];
    latestPoseRef.current = null;
    setTelemetry(createLiveTelemetry());
    leftTrackerRef.current.reset();
    rightTrackerRef.current.reset();
    preparedTrialRef.current = null;
    pendingRevealRef.current = false;
    sessionEndedIsoRef.current = "";
    comboTrackerRef.current = null;
    guardReturnTrackerRef.current = null;
    guardReturnHitSnapshotRef.current = null;
    defenseTrackerRef.current = null;
    virtualOpponentTrackerRef.current = null;
    virtualOpponentTimelineRef.current = null;
    headTrackerRef.current.reset();
    dispatch({ type: "RESTART" });
  };

  const exportJson = () => {
    if (!camera || !calibration || !sessionStartedIsoRef.current) return;
    const session = buildSessionExport({
      sessionId: sessionIdRef.current,
      label,
      startedAt: sessionStartedIsoRef.current,
      endedAt: sessionEndedIsoRef.current || new Date().toISOString(),
      protocolId,
      camera,
      calibration,
      estimatedPoseFps: poseFps,
      estimatedVideoFps: videoFps,
      trials: game.results,
      summary,
      audioMode,
    });
    downloadSessionJson(session);
  };

  if (game.status === "BOOT") {
    return (
      <StartScreen
        label={label}
        protocolId={protocolId}
        onLabelChange={setLabel}
        onProtocolChange={setProtocolId}
        onStart={beginCamera}
      />
    );
  }

  if (game.status === "SESSION_COMPLETE") {
    return (
      <ResultsScreen
        trials={game.results}
        summary={summary}
        protocol={protocol}
        poseFps={poseFps}
        camera={camera}
        debug={debug}
        onToggleDebug={() => setDebug((value) => !value)}
        onExport={exportJson}
        onRestart={restart}
      />
    );
  }

  if (game.status === "ERROR") {
    return <ErrorScreen message={game.error ?? "Beklenmeyen bir hata oluştu."} onRetry={restart} />;
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-brand-black pb-10">
      <header className="border-b border-brand-border bg-brand-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <span className="font-display text-lg uppercase tracking-wide text-brand-white">
              Camera <span className="text-brand-yellow">Fight Lab</span>
            </span>
            <span className="ml-3 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-muted">
              {protocol.shortName} · {stateLabel(game.status)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AudioModeSwitch mode={audioMode} onChange={setAudioMode} />
            <button
              type="button"
              onClick={() => setDebug((value) => !value)}
              aria-pressed={debug}
              className={`border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                debug
                  ? "border-brand-yellow bg-brand-yellow text-brand-black"
                  : "border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
              }`}
            >
              Diagnostics {debug ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={restart}
              className="border border-brand-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-muted hover:border-red-400 hover:text-red-300"
            >
              Çık
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        {poseFps > 0 && poseFps < PERFORMANCE_CONFIG.camera.fpsWarningBelow && (
          <div className="mb-4 border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Kamera kare hızı düşük. Reaction ölçümleri daha az hassas olabilir.
          </div>
        )}
        {runtimeWarning && debug && (
          <div className="mb-4 border border-red-400/40 bg-red-400/10 px-4 py-3 text-xs text-red-200">
            {runtimeWarning}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative overflow-hidden border border-brand-border bg-black shadow-2xl shadow-black/50">
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                muted
                playsInline
                className="absolute inset-0 h-full w-full -scale-x-100 object-contain"
              />
              <canvas
                ref={canvasRef}
                aria-label="Fight Lab hedef ve pose katmanı"
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {game.status === "CAMERA_PERMISSION" && (
                <LoadingOverlay pipelineStatus={pipelineStatus} />
              )}
              {game.status === "PAUSED" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6 text-center">
                  <span className="font-display text-5xl uppercase text-brand-yellow">Paused</span>
                  <p className="mt-2 text-sm text-brand-muted">
                    Sekmeye döndün. Devam etmeye hazır olduğunda sürdür.
                  </p>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "RESUME" })}
                    className="mt-5 bg-brand-yellow px-6 py-3 text-xs font-bold uppercase tracking-wide text-brand-black"
                  >
                    Devam Et
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            {game.status === "CAMERA_READY" && camera && (
              <CameraReadyPanel
                camera={camera}
                devices={cameraDevices}
                selectedDeviceId={selectedDeviceId}
                inferenceMode={inferenceMode}
                onDeviceChange={(deviceId) => {
                  setSelectedDeviceId(deviceId);
                  void bootPipeline(deviceId);
                }}
                onCalibrate={beginCalibration}
              />
            )}
            {game.status === "CALIBRATION" && (
              <CalibrationPanel evaluation={calibrationEvaluation} />
            )}
            {game.status === "READY" && calibration && (
              <ReadyPanel calibration={calibration} protocol={protocol} onStart={startSession} />
            )}
            {isTestState(game.status) && (
              <TestHud
                game={game}
                protocol={protocol}
                lastResult={game.results.at(-1) ?? null}
                poseFps={poseFps}
              />
            )}
            {debug && (
              <DiagnosticsPanel
                game={game}
                protocol={protocol}
                camera={camera}
                poseFps={poseFps}
                videoFps={videoFps}
                inferenceMode={inferenceMode}
                left={telemetry.left}
                right={telemetry.right}
                latestPose={telemetry.latestPose}
                runtime={telemetry.runtime}
                combo={telemetry.combo}
                guardReturn={telemetry.guardReturn}
                defense={telemetry.defense}
                virtualOpponent={telemetry.virtualOpponent}
              />
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function StartScreen({
  label,
  protocolId,
  onLabelChange,
  onProtocolChange,
  onStart,
}: {
  label: string;
  protocolId: ProtocolId;
  onLabelChange: (value: string) => void;
  onProtocolChange: (value: ProtocolId) => void;
  onStart: () => void;
}) {
  const selectedProtocol = PROTOCOLS[protocolId];
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-brand-black">
      <section className="relative overflow-hidden border-b border-brand-border">
        <div className="absolute inset-0 bg-diagonal-stripes opacity-[0.035]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-brand-yellow">
              BlackBox Performance Protocol · Phase 1
            </span>
            <h1 className="font-display mt-4 text-5xl uppercase leading-none tracking-wide text-brand-white sm:text-6xl">
              Camera
              <br />
              <span className="text-brand-yellow">Fight Lab</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-muted">
              Hedefi gör. Yumruğu başlat. Teması tamamla. Sistem hareket başlangıcını ve
              hedefe ulaşmayı ayrı ayrı ölçerek reaction, movement ve total response
              sürelerini çıkarır.
            </p>
            <p className="mt-4 max-w-xl border-l-2 border-brand-yellow pl-4 text-sm leading-relaxed text-brand-white">
              Bu bir karşılaştırmalı antrenman metriğidir; klinik veya laboratuvar
              ölçümü değildir.
            </p>
            <div className="mt-6 border border-red-400/35 bg-red-400/8 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
                Güvenli alan kontrolü
              </div>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-brand-muted">
                <li>• Yumruk mesafesinde insan veya eşya bırakma.</li>
                <li>• Dengeli ve kaymayan bir zeminde dur.</li>
                <li>• Maksimum güç yerine kontrollü hızlı yumruk kullan.</li>
                <li>• Ağrı veya baş dönmesinde hemen dur.</li>
              </ul>
            </div>
          </div>

          <div className="border border-brand-border bg-brand-surface p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-brand-border pb-4">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-muted">
                Test protokolü
              </span>
              <span className="font-display text-2xl text-brand-yellow">
                {selectedProtocol.trialCount} TRIAL
              </span>
            </div>
            <fieldset className="mt-5">
              <legend className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                Test modu
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PROTOCOL_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={protocolId === item.id}
                    onClick={() => onProtocolChange(item.id)}
                    className={`border p-3 text-left transition-colors ${
                      protocolId === item.id
                        ? "border-brand-yellow bg-brand-yellow/10"
                        : "border-brand-border bg-brand-black hover:border-brand-muted"
                    }`}
                  >
                    <span className="block text-xs font-black uppercase text-brand-white">
                      {item.shortName}
                    </span>
                    <span className="mt-1 block text-[10px] leading-snug text-brand-muted">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="mt-4 border-l-2 border-brand-yellow pl-3 text-xs leading-relaxed text-brand-white">
              {selectedProtocol.instruction}
            </p>
            <ol className="mt-5 grid gap-3 text-sm text-brand-white">
              {PROTOCOL_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="font-display text-brand-yellow">0{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-brand-muted">
              Sporcu / seans etiketi (isteğe bağlı)
              <input
                value={label}
                onChange={(event) => onLabelChange(event.target.value)}
                maxLength={80}
                placeholder="Örn. Yiğit · Sabah testi"
                className="mt-2 w-full border border-brand-border bg-brand-black px-4 py-3 text-sm normal-case tracking-normal text-brand-white outline-none transition-colors placeholder:text-brand-muted/60 focus:border-brand-yellow"
              />
            </label>
            <button
              type="button"
              onClick={onStart}
              className="mt-5 w-full bg-brand-yellow px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-brand-black transition-colors hover:bg-brand-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
            >
              Kamerayı Aç ve Teste Başla
            </button>
            <p className="mt-4 text-center text-xs leading-relaxed text-brand-muted">
              Kamera videosu yerel olarak işlenir ve yüklenmez. Mikrofon izni istenmez.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * Ses kademesi anahtarı. Üç kademe ölçüm anlamını değiştirdiği için etiketin
 * yanında ne yaptığı da yazar (bkz. audioCues.ts ölçüm uyarısı).
 */
function AudioModeSwitch({
  mode,
  onChange,
}: {
  mode: AudioMode;
  onChange: (mode: AudioMode) => void;
}) {
  const modes: AudioMode[] = ["off", "cues", "voice"];
  return (
    <div
      role="group"
      aria-label="Ses kademesi"
      title={AUDIO_MODE_HINTS[mode]}
      className="flex border border-brand-border"
    >
      {modes.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            // Kullanıcı hareketi — ses motorları yalnızca burada açılabilir.
            if (value !== "off") initAudio();
            onChange(value);
          }}
          aria-pressed={mode === value}
          className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
            mode === value
              ? "bg-brand-yellow text-brand-black"
              : "text-brand-muted hover:text-brand-yellow"
          }`}
        >
          {AUDIO_MODE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}

function LoadingOverlay({ pipelineStatus }: { pipelineStatus: PipelineStatus }) {
  const message =
    pipelineStatus === "camera"
      ? "Kamera izni bekleniyor…"
      : pipelineStatus === "pose"
        ? "Pose tracking motoru hazırlanıyor…"
        : "Test alanı hazırlanıyor…";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/85 px-6 text-center">
      <div>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-border border-t-brand-yellow" />
        <p className="mt-4 text-sm font-bold uppercase tracking-wide text-brand-white">{message}</p>
        <p className="mt-2 text-xs text-brand-muted">
          İlk yükleme model dosyaları nedeniyle biraz sürebilir.
        </p>
      </div>
    </div>
  );
}

function CameraReadyPanel({
  camera,
  devices,
  selectedDeviceId,
  inferenceMode,
  onDeviceChange,
  onCalibrate,
}: {
  camera: CameraSnapshot;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  inferenceMode: InferenceMode | null;
  onDeviceChange: (deviceId: string) => void;
  onCalibrate: () => void;
}) {
  return (
    <Panel title="Kamera Hazır" eyebrow="Setup 01">
      <p className="text-sm leading-relaxed text-brand-white">
        Kameradan yaklaşık 1.5–2.5 m uzakta dur. Üst gövden ve yumruk atacağın alan görünür olsun.
      </p>
      {devices.length > 1 && (
        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-brand-muted">
          Kamera
          <select
            value={selectedDeviceId}
            onChange={(event) => onDeviceChange(event.target.value)}
            className="mt-2 w-full border border-brand-border bg-brand-black px-3 py-2 text-xs normal-case text-brand-white"
          >
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Kamera ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Info label="Çözünürlük" value={`${camera.width}×${camera.height}`} />
        <Info
          label="Kamera FPS"
          value={camera.frameRate ? `${camera.frameRate.toFixed(0)}` : "Ölçülüyor"}
        />
        <Info
          label="Inference"
          value={inferenceMode === "worker" ? "Web Worker" : "Throttled main"}
        />
        <Info label="Ses" value="Kapalı" />
      </dl>
      <button type="button" onClick={onCalibrate} className={primaryButtonClass}>
        Kalibrasyona Geç
      </button>
    </Panel>
  );
}

function CalibrationPanel({ evaluation }: { evaluation: CalibrationEvaluation }) {
  return (
    <Panel title="Guard Kalibrasyonu" eyebrow="Setup 02">
      <ol className="space-y-2 text-sm text-brand-white">
        <li>1. Kameraya dön.</li>
        <li>2. İki elini guard&apos;a kaldır.</li>
        <li>3. Omuz ve bilekleri görünür tut.</li>
        <li>4. Kısa süre sabit kal.</li>
      </ol>
      <div className="mt-5 h-2 overflow-hidden bg-brand-black">
        <div
          className="h-full bg-brand-yellow transition-[width] duration-150"
          style={{ width: `${evaluation.progressPct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-wide text-brand-muted">
        <span>{evaluation.usableSampleCount} güvenilir kare</span>
        <span>{evaluation.progressPct}%</span>
      </div>
      <div className="mt-4 min-h-14 border border-brand-border bg-brand-black p-3 text-xs leading-relaxed">
        {evaluation.issues.length > 0 ? (
          <ul className="space-y-1 text-amber-200">
            {[...new Map(evaluation.issues.map((item) => [item.code, item])).values()].map(
              (item) => <li key={item.code}>→ {item.message}</li>,
            )}
          </ul>
        ) : (
          <p className="text-brand-muted">Poz aranıyor; guard&apos;da sabit kal.</p>
        )}
      </div>
    </Panel>
  );
}

function ReadyPanel({
  calibration,
  protocol,
  onStart,
}: {
  calibration: CalibrationSnapshot;
  protocol: ProtocolDefinition;
  onStart: () => void;
}) {
  return (
    <Panel title="Calibration Complete" eyebrow="Ready">
      <p className="text-sm leading-relaxed text-brand-white">
        Omuz genişliği ve iki guard noktası kaydedildi. {protocol.instruction}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Info label="Omuz" value={`${calibration.shoulderWidthM.toFixed(2)} m`} />
        <Info label="Pose FPS" value={calibration.estimatedProcessingFps.toFixed(1)} />
        <Info
          label="Sol noise"
          value={`${(calibration.leftWristNoiseM * 100).toFixed(1)} cm`}
        />
        <Info
          label="Sağ noise"
          value={`${(calibration.rightWristNoiseM * 100).toFixed(1)} cm`}
        />
      </dl>
      <button type="button" onClick={onStart} className={primaryButtonClass}>
        {protocol.trialCount} Trial Başlat
      </button>
    </Panel>
  );
}

function TestHud({
  game,
  protocol,
  lastResult,
  poseFps,
}: {
  game: GameState;
  protocol: ProtocolDefinition;
  lastResult: TrialResult | null;
  poseFps: number;
}) {
  return (
    <Panel
      title={`Trial ${String(game.trialIndex + 1).padStart(2, "0")} / ${protocol.trialCount}`}
      eyebrow="Live test"
    >
      <div className="grid grid-cols-2 gap-2">
        <Info label="Durum" value={stateLabel(game.status)} />
        <Info label="Pose FPS" value={poseFps ? poseFps.toFixed(1) : "—"} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-brand-muted">
        {game.status === "WAITING_FOR_TARGET"
          ? "Guard'da kal ve hedefi bekle. Erken başlama."
          : game.status === "TARGET_ACTIVE"
            ? stimulusInstruction(game.pendingTrial?.stimulus ?? null)
            : game.status === "TRIAL_COMPLETE"
              ? "Deneme kaydedildi. Sonraki hedef hazırlanıyor."
              : "Geri sayım bitene kadar guard'da kal."}
      </p>
      {lastResult && (
        <div className="mt-4 border-t border-brand-border pt-4 text-xs text-brand-muted">
          Son: {lastResult.outcome}
          {lastResult.totalResponseMs !== null &&
            ` · ${Math.round(lastResult.totalResponseMs)} ms`}
          {lastResult.detectedHand &&
            ` · ${lastResult.detectedHand === "left" ? "Sol" : "Sağ"}`}
        </div>
      )}
    </Panel>
  );
}

function DiagnosticsPanel({
  game,
  protocol,
  camera,
  poseFps,
  videoFps,
  inferenceMode,
  left,
  right,
  latestPose,
  runtime,
  combo,
  guardReturn,
  defense,
  virtualOpponent,
}: {
  game: GameState;
  protocol: ProtocolDefinition;
  camera: CameraSnapshot | null;
  poseFps: number;
  videoFps: number;
  inferenceMode: InferenceMode | null;
  left: WristObservation | null;
  right: WristObservation | null;
  latestPose: PoseSample | null;
  runtime: TrialRuntime;
  combo: ComboTelemetry;
  guardReturn: GuardReturnTelemetry;
  defense: DefenseTelemetry;
  virtualOpponent: VirtualOpponentTelemetry;
}) {
  return (
    <div className="border border-brand-yellow/45 bg-black p-4 font-mono text-[11px] leading-relaxed text-brand-muted">
      <div className="mb-2 font-bold uppercase tracking-wide text-brand-yellow">Diagnostics</div>
      <div>state: {game.status}</div>
      <div>protocol: {protocol.id}@{protocol.version}</div>
      <div>config: {protocolConfigHash(protocol.id)}</div>
      <div>
        stimulus: {runtime.stimulus?.kind ?? "—"} / {runtime.stimulus?.requiredHand ?? "—"}
      </div>
      <div>inference: {inferenceMode ?? "—"}</div>
      <div>
        camera: {camera ? `${camera.width}×${camera.height} @ ${camera.frameRate || "?"}` : "—"}
      </div>
      <div>video/pose fps: {videoFps.toFixed(1)} / {poseFps.toFixed(1)}</div>
      <div>pose count: {latestPose?.poseCount ?? 0}</div>
      <div>L velocity: {left?.velocityMps.toFixed(3) ?? "—"} m/s</div>
      <div>R velocity: {right?.velocityMps.toFixed(3) ?? "—"} m/s</div>
      <div>L/R confidence: {left?.confidence.toFixed(2) ?? "—"} / {right?.confidence.toFixed(2) ?? "—"}</div>
      <div>onset threshold: {PERFORMANCE_CONFIG.motion.onsetVelocityMps} m/s</div>
      <div>hit threshold: {PERFORMANCE_CONFIG.hit.minimumVelocityMps} m/s</div>
      <div>T0: {runtime.t0Ms?.toFixed(1) ?? "—"}</div>
      <div>
        T1 L/R: {runtime.t1ByHand.left?.toFixed(1) ?? "—"} / {runtime.t1ByHand.right?.toFixed(1) ?? "—"}
      </div>
      <div>T2: {runtime.t2Ms?.toFixed(1) ?? "—"}</div>
      <div>flags: {[...runtime.qualityFlags].join(", ") || "—"}</div>
      {combo && (
        <>
          <div className="mt-2 font-bold uppercase tracking-wide text-brand-yellow">Combo</div>
          <div>
            step: {combo.currentStepIndex + 1} · expects: {combo.expectedHand ?? "—"}
          </div>
          <div>rejected duplicate hits: {combo.duplicateContactCount}</div>
          <div>
            steps: {combo.stepHistory.map((step) => `${step.actualHand ?? "?"}${step.correct ? "" : "!"}`).join(" ") || "—"}
          </div>
        </>
      )}
      {guardReturn && (
        <>
          <div className="mt-2 font-bold uppercase tracking-wide text-brand-yellow">Guard Return</div>
          <div>hand: {guardReturn.hand}</div>
          <div>inside frames (stable at {PERFORMANCE_CONFIG.phase2.guardReturnStableFrames}): {guardReturn.consecutiveInsideFrames}</div>
          <div>overshoot events: {guardReturn.overshootEventCount}</div>
          <div>T3: pending…</div>
        </>
      )}
      {defense && (
        <>
          <div className="mt-2 font-bold uppercase tracking-wide text-brand-yellow">Defense</div>
          <div>action: {defense.action}</div>
          <div>T1 (onset): {defense.onsetMs?.toFixed(1) ?? "—"}</div>
          <div>finished: {defense.isFinished ? "yes" : "no"}</div>
          <div>
            lateral/vertical threshold: {PERFORMANCE_CONFIG.phase3.defense.minLateralDisplacementShoulderWidths} / {PERFORMANCE_CONFIG.phase3.defense.minVerticalDisplacementShoulderWidths} shoulder-widths
          </div>
        </>
      )}
      {virtualOpponent && (
        <>
          <div className="mt-2 font-bold uppercase tracking-wide text-brand-yellow">Virtual Opponent</div>
          <div>attack: {virtualOpponent.attackType} · channel: {virtualOpponent.responseChannel}</div>
          <div>tempo: {virtualOpponent.tempoLevel}</div>
          <div>
            commit: {virtualOpponent.attackCommitMs.toFixed(1)} · land: {virtualOpponent.attackLandMs.toFixed(1)}
          </div>
          <div>finished: {virtualOpponent.isFinished ? "yes" : "no"}</div>
        </>
      )}
    </div>
  );
}

function ResultsScreen({
  trials,
  summary,
  protocol,
  poseFps,
  camera,
  debug,
  onToggleDebug,
  onExport,
  onRestart,
}: {
  trials: TrialResult[];
  summary: ReturnType<typeof buildSessionSummary>;
  protocol: ProtocolDefinition;
  poseFps: number;
  camera: CameraSnapshot | null;
  debug: boolean;
  onToggleDebug: () => void;
  onExport: () => void;
  onRestart: () => void;
}) {
  const qualityLabel =
    summary.sessionQuality === "GOOD"
      ? "İyi"
      : summary.sessionQuality === "FAIR"
        ? "Orta"
        : "Zayıf";
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-brand-black py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-5 border-b border-brand-border pb-7 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-brand-yellow">
              Session complete
            </span>
            <h1 className="font-display mt-2 text-4xl uppercase tracking-wide text-brand-white sm:text-5xl">
              {protocol.name}
            </h1>
            <p className="mt-2 text-sm text-brand-muted">
              {summary.validTrialCount} güvenilir ölçüm · {summary.decision.correctDecisionCount}/
              {summary.decision.scoredTrialCount} doğru yanıt
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">
              Session quality
            </div>
            <div
              className={`font-display text-3xl ${summary.sessionQuality === "POOR" ? "text-red-300" : "text-brand-yellow"}`}
            >
              {qualityLabel} · {summary.sessionQualityScore}
            </div>
          </div>
        </div>

        {summary.sessionQuality === "POOR" && (
          <p className="mt-5 border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            Bu sonucu dikkatle kullan ve daha iyi kamera/ışık koşullarında testi tekrarla.
          </p>
        )}

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Median Reaction" value={formatMs(summary.medianReactionTimeMs)} primary />
          <MetricCard label="Median Movement" value={formatMs(summary.medianMovementTimeMs)} primary />
          <MetricCard label="Median Total" value={formatMs(summary.medianTotalResponseMs)} primary />
          <MetricCard label="Accuracy" value={`${summary.accuracyPct}%`} primary />
          {protocol.id !== "full-reaction" && (
            <MetricCard
              label="Decision Reaction"
              value={formatMs(summary.decision.medianDecisionReactionTimeMs)}
            />
          )}
          {protocol.id === "choice-reaction" && (
            <MetricCard label="Wrong Hand" value={String(summary.decision.wrongHandCount)} />
          )}
          {protocol.id === "go-no-go" && (
            <>
              <MetricCard
                label="Correct Reject"
                value={`${summary.decision.correctRejectCount}/${summary.decision.noGoTrialCount}`}
              />
              <MetricCard label="False Attack" value={String(summary.decision.falseAttackCount)} />
              <MetricCard
                label="False Attack Rate"
                value={
                  summary.decision.falseAttackRatePct === null
                    ? "—"
                    : `${summary.decision.falseAttackRatePct}%`
                }
                detail="Klinik inhibisyon testi değildir"
              />
            </>
          )}
          {protocol.id === "peripheral-reaction" && (
            <>
              <MetricCard
                label="Peripheral Left"
                value={formatMs(summary.decision.peripheralLeftMedianReactionTimeMs)}
                detail={
                  summary.decision.peripheralLeftAccuracyPct === null
                    ? "Sol bölgede veri yok"
                    : `%${summary.decision.peripheralLeftAccuracyPct} doğruluk`
                }
              />
              <MetricCard
                label="Peripheral Right"
                value={formatMs(summary.decision.peripheralRightMedianReactionTimeMs)}
                detail={
                  summary.decision.peripheralRightAccuracyPct === null
                    ? "Sağ bölgede veri yok"
                    : `%${summary.decision.peripheralRightAccuracyPct} doğruluk`
                }
              />
              <MetricCard
                label="Peripheral Side Difference"
                value={formatMs(summary.decision.peripheralSideDifferenceMs)}
                detail="Tanısal değildir"
              />
            </>
          )}
          {protocol.id === "combo-speed" && (
            <>
              <MetricCard
                label="Combo Completion"
                value={`${summary.combo.completedCount}/${summary.combo.scoredTrialCount}`}
                detail={`%${summary.combo.completionRatePct} tamamlanma`}
              />
              <MetricCard
                label="Median Inter-Punch"
                value={formatMs(summary.combo.medianInterPunchMs)}
                detail={
                  summary.combo.interPunchConsistencyMadMs === null
                    ? undefined
                    : `±${summary.combo.interPunchConsistencyMadMs} ms MAD`
                }
              />
              <MetricCard
                label="Median Combo Time"
                value={formatMs(summary.combo.medianTotalComboTimeMs)}
              />
              <MetricCard label="Wrong Order" value={String(summary.combo.wrongHandCount)} />
              <MetricCard
                label="Combo Left / Right Step"
                value={`${formatMs(summary.combo.leftStepMedianMs)} / ${formatMs(summary.combo.rightStepMedianMs)}`}
                detail={
                  summary.combo.leftRightStepDifferenceMs === null
                    ? "İki elde de veri gerekli"
                    : `${summary.combo.leftRightStepDifferenceMs} ms fark · tanısal değildir`
                }
              />
            </>
          )}
          {protocol.id === "guard-return" && (
            <>
              <MetricCard
                label="Guard Returned"
                value={`${summary.guardReturn.returnedCount}/${summary.guardReturn.scoredTrialCount}`}
                detail={`${summary.guardReturn.failedReturnCount} dönüş başarısız`}
              />
              <MetricCard
                label="Median Return (T3)"
                value={formatMs(summary.guardReturn.medianReturnTimeMs)}
                detail={
                  summary.guardReturn.returnConsistencyMadMs === null
                    ? undefined
                    : `±${summary.guardReturn.returnConsistencyMadMs} ms MAD`
                }
              />
              <MetricCard
                label="Guard Left / Right"
                value={`${formatMs(summary.guardReturn.leftMedianReturnTimeMs)} / ${formatMs(summary.guardReturn.rightMedianReturnTimeMs)}`}
                detail={
                  summary.guardReturn.leftRightReturnDifferenceMs === null
                    ? "İki elde de veri gerekli"
                    : `${summary.guardReturn.leftRightReturnDifferenceMs} ms fark · tanısal değildir`
                }
              />
              <MetricCard
                label="Overshoot Rate"
                value={
                  summary.guardReturn.overshootRatePct === null
                    ? "—"
                    : `%${summary.guardReturn.overshootRatePct}`
                }
                detail="Stabilite eşiğine ulaşmadan girip-çıkma oranı"
              />
            </>
          )}
          {protocol.id === "defense-reflex" && (
            <>
              <MetricCard
                label="Defense Accuracy"
                value={`%${summary.defense.accuracyPct}`}
                detail={`${summary.defense.correctCount}/${summary.defense.scoredTrialCount} doğru`}
              />
              <MetricCard
                label="Median Reaction"
                value={formatMs(summary.defense.medianReactionTimeMs)}
                detail={
                  summary.defense.reactionConsistencyMadMs === null
                    ? undefined
                    : `±${summary.defense.reactionConsistencyMadMs} ms MAD`
                }
              />
              <MetricCard
                label="Median Recovery (T3)"
                value={formatMs(summary.defense.medianRecoveryTimeMs)}
              />
              <MetricCard
                label="Wrong Direction"
                value={String(summary.defense.wrongDirectionCount)}
              />
              <MetricCard
                label="No Response"
                value={String(summary.defense.noResponseCount)}
              />
              <MetricCard
                label="Slip Left / Right"
                value={`${formatMs(summary.defense.slipLeftMedianReactionTimeMs)} / ${formatMs(summary.defense.slipRightMedianReactionTimeMs)}`}
                detail={
                  summary.defense.slipLeftRightDifferenceMs === null
                    ? "İki yönde de veri gerekli"
                    : `${summary.defense.slipLeftRightDifferenceMs} ms fark · tanısal değildir`
                }
              />
              <MetricCard label="Duck Median" value={formatMs(summary.defense.duckMedianReactionTimeMs)} />
            </>
          )}
          {protocol.id === "virtual-opponent" && (
            <>
              <MetricCard
                label="Defeated Attack"
                value={`${summary.virtualOpponent.defeatedCount}/${summary.virtualOpponent.scoredTrialCount}`}
                detail={`%${summary.virtualOpponent.defeatRatePct} rakibi alt etme oranı`}
              />
              <MetricCard
                label="Median Response"
                value={formatMs(summary.virtualOpponent.medianResponseTimeMs)}
                detail="Cue'dan tamamlamaya kadar"
              />
              <MetricCard
                label="Beat Deadline Margin"
                value={formatMs(summary.virtualOpponent.medianBeatDeadlineMarginMs)}
                detail="Pozitif = deadline'ı yendi"
              />
              <MetricCard label="Too Late" value={String(summary.virtualOpponent.tooLateCount)} />
              <MetricCard label="Wrong Response" value={String(summary.virtualOpponent.wrongResponseCount)} />
              <MetricCard label="No Response" value={String(summary.virtualOpponent.noResponseCount)} />
              <MetricCard
                label="Counter / Defend Defeat Rate"
                value={`${
                  summary.virtualOpponent.counterChannelDefeatRatePct === null
                    ? "—"
                    : `%${summary.virtualOpponent.counterChannelDefeatRatePct}`
                } / ${
                  summary.virtualOpponent.defendChannelDefeatRatePct === null
                    ? "—"
                    : `%${summary.virtualOpponent.defendChannelDefeatRatePct}`
                }`}
                detail="Kanal bazlı; tanısal değildir"
              />
            </>
          )}
          <MetricCard label="Fastest Reaction" value={formatMs(summary.fastestReactionTimeMs)} />
          <MetricCard
            label="Consistency (MAD)"
            value={
              summary.reactionConsistencyMadMs === null
                ? "—"
                : `±${summary.reactionConsistencyMadMs} ms`
            }
            detail={
              summary.reactionConsistencyPct === null
                ? undefined
                : `%${summary.reactionConsistencyPct} relative variation`
            }
          />
          <MetricCard label="Left Median" value={formatMs(summary.leftMedianReactionTimeMs)} />
          <MetricCard label="Right Median" value={formatMs(summary.rightMedianReactionTimeMs)} />
          <MetricCard
            label="Left / Right Difference"
            value={formatMs(summary.leftRightDifferenceMs)}
            detail={
              summary.leftRightDifferencePct === null
                ? "İki tarafta da veri gerekli"
                : `%${summary.leftRightDifferencePct} · tanısal değildir`
            }
          />
          <MetricCard label="Tracking Quality" value={`${summary.trackingQualityPct}%`} />
          <MetricCard label="Pose FPS" value={poseFps ? poseFps.toFixed(1) : "—"} />
          <MetricCard label="Camera" value={camera ? `${camera.width}×${camera.height}` : "—"} />
        </section>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={onRestart} className={primaryButtonClass}>
            Retest
          </button>
          <button type="button" onClick={onExport} className={secondaryButtonClass}>
            Export JSON
          </button>
          <button type="button" onClick={onToggleDebug} className={secondaryButtonClass}>
            Debug Details {debug ? "Gizle" : "Göster"}
          </button>
        </div>

        {debug && (
          <section className="mt-7 overflow-x-auto border border-brand-border bg-brand-surface">
            <table className="w-full min-w-[1020px] text-left text-xs">
              <thead className="bg-brand-ink text-[10px] uppercase tracking-wide text-brand-muted">
                <tr>
                  {[
                    "Trial",
                    "Outcome",
                    "Cue",
                    "Required",
                    "Zone",
                    "Hand",
                    "T0",
                    "T1",
                    "T2",
                    "T3",
                    "Reaction",
                    "Movement",
                    "Total",
                    "Peak m/s",
                    "Combo / Defense",
                    "Quality flags",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-brand-white">
                {trials.map((trial) => (
                  <tr key={trial.trialIndex}>
                    <td className="px-3 py-3">{trial.trialIndex + 1}</td>
                    <td className="px-3 py-3">{trial.outcome}</td>
                    <td className="px-3 py-3">{trial.stimulus.cueLabel}</td>
                    <td className="px-3 py-3">{trial.requiredHand}</td>
                    <td className="px-3 py-3">{trial.stimulus.peripheralZone ?? "—"}</td>
                    <td className="px-3 py-3">{trial.detectedHand ?? "—"}</td>
                    <td className="px-3 py-3">{trial.t0Ms?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-3">{trial.t1Ms?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-3">{trial.t2Ms?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-3">{trial.t3Ms?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-3">{formatMs(trial.reactionTimeMs)}</td>
                    <td className="px-3 py-3">{formatMs(trial.movementTimeMs)}</td>
                    <td className="px-3 py-3">{formatMs(trial.totalResponseMs)}</td>
                    <td className="px-3 py-3">{trial.peakVelocityMps ?? "—"}</td>
                    <td className="max-w-56 px-3 py-3 text-brand-muted">
                      {trial.combo
                        ? trial.combo.steps
                            .map((step) => `${step.actualHand ?? "?"}${step.correct ? "" : "!"}`)
                            .join(" ") || "—"
                        : trial.defense
                          ? `${trial.defense.detectedAction ?? "—"} (L${trial.defense.peakLateralDisplacementShoulderWidths ?? "—"}/V${trial.defense.peakVerticalDisplacementShoulderWidths ?? "—"})`
                          : trial.virtualOpponent
                            ? `${trial.virtualOpponent.attackType} → ${trial.virtualOpponent.outcome} (Δ${trial.virtualOpponent.beatDeadlineMarginMs ?? "—"}ms)`
                            : "—"}
                    </td>
                    <td className="max-w-72 px-3 py-3 text-brand-muted">
                      {trial.qualityFlags.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-7 text-xs leading-relaxed text-brand-muted">
          Sonuçlar aynı cihaz, kamera, mesafe ve protokol altında yapılan tekrarları
          karşılaştırmak içindir. Laboratuvar veya klinik ölçüm değildir.
        </p>
      </div>
    </main>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-brand-black px-4">
      <div className="w-full max-w-xl border border-red-400/50 bg-brand-surface p-8 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
          Camera error
        </span>
        <h1 className="font-display mt-3 text-3xl uppercase text-brand-white">
          Test başlatılamadı
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-brand-muted">{message}</p>
        <p className="mt-3 text-xs leading-relaxed text-brand-muted">
          Kamera için HTTPS veya localhost gerekir. Chrome/Edge site ayarlarında kamera iznini kontrol et.
        </p>
        <button type="button" onClick={onRetry} className={primaryButtonClass}>
          Başa Dön
        </button>
      </div>
    </main>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-brand-border bg-brand-surface p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-yellow">
        {eyebrow}
      </div>
      <h2 className="font-display mt-1 text-xl uppercase tracking-wide text-brand-white">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-brand-border bg-brand-black p-3">
      <div className="text-[9px] font-bold uppercase tracking-wide text-brand-muted">{label}</div>
      <div className="mt-1 font-semibold text-brand-white">{value}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  primary = false,
}: {
  label: string;
  value: string;
  detail?: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`border p-5 ${primary ? "border-brand-yellow/60 bg-brand-surface-2" : "border-brand-border bg-brand-surface"}`}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
        {label}
      </div>
      <div
        className={`font-display mt-2 text-3xl ${primary ? "text-brand-yellow" : "text-brand-white"}`}
      >
        {value}
      </div>
      {detail && <p className="mt-1 text-[11px] text-brand-muted">{detail}</p>}
    </div>
  );
}

const primaryButtonClass =
  "mt-5 w-full bg-brand-yellow px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-brand-black transition-colors hover:bg-brand-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButtonClass =
  "w-full border border-brand-border bg-brand-surface px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow";

const stateLabel = (status: GameState["status"]): string =>
  ({
    BOOT: "Başlangıç",
    CAMERA_PERMISSION: "Kamera izni",
    CAMERA_READY: "Kamera hazır",
    CALIBRATION: "Kalibrasyon",
    READY: "Hazır",
    COUNTDOWN: "Geri sayım",
    WAITING_FOR_TARGET: "Hedef bekleniyor",
    TARGET_ACTIVE: "Hedef aktif",
    TRIAL_COMPLETE: "Deneme tamam",
    SESSION_COMPLETE: "Seans tamam",
    PAUSED: "Duraklatıldı",
    ERROR: "Hata",
  })[status];

const isTestState = (status: GameState["status"]): boolean =>
  ["COUNTDOWN", "WAITING_FOR_TARGET", "TARGET_ACTIVE", "TRIAL_COMPLETE", "PAUSED"].includes(
    status,
  );

const earliestOnset = (values: Record<Hand, number | null>): number | null => {
  const available = [values.left, values.right].filter(
    (value): value is number => value !== null,
  );
  return available.length > 0 ? Math.min(...available) : null;
};

const stimulusInstruction = (stimulus: TrialStimulus | null): string => {
  if (!stimulus) return "Cue aktif — seçilen protokol yönergesini uygula.";
  if (stimulus.kind === "NO_GO") {
    return `DUR — ${stimulus.inhibitionWindowMs ?? 0} ms boyunca guard'da hareketsiz kal.`;
  }
  if (stimulus.kind === "CHOICE") {
    return `${stimulus.cueLabel} EL — yalnız istenen elle hedefe vur.`;
  }
  if (stimulus.kind === "PERIPHERAL") {
    return `Merkez artıya bak; ${stimulus.peripheralZone ?? "yan"} hedefe kontrollü hızlı vur.`;
  }
  if (stimulus.kind === "COMBO") {
    return `${stimulus.cueLabel} — sırayla, her yumruktan sonra geri çekerek vur.`;
  }
  if (stimulus.kind === "GUARD_RETURN") {
    return "VUR — sonra elini hemen guard'a geri çek ve orada sabit tut.";
  }
  if (stimulus.kind === "DEFENSE") {
    return `${stimulus.cueLabel} — hareketten hemen sonra nötr pozisyona dön ve orada sabit kal.`;
  }
  if (stimulus.kind === "VIRTUAL_OPPONENT") {
    return stimulus.virtualOpponentResponseChannel === "COUNTER"
      ? `${stimulus.cueLabel} EL İLE KONTRA — rakip vurmadan önce hedefi vur.`
      : `${stimulus.cueLabel} — rakip vurmadan önce doğru savunmayı tamamla.`;
  }
  return "VUR — hızlı, yönlü ve kontrollü bir düz yumruk at.";
};

const handLabel = (hand: Hand | null): string | null =>
  hand === "left" ? "SOL" : hand === "right" ? "SAĞ" : null;

const formatMs = (value: number | null): string =>
  value === null ? "—" : `${Math.round(value)} ms`;
