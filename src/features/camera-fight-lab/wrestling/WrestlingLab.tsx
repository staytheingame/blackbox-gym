"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { beep, initAudio, releaseAudio, speak, stopSpeaking } from "@/lib/audio/voice";
import { WRESTLING_AUDIO_MODE_LABELS, wrestlingCueBeep, wrestlingCueSpeech } from "./audioCues";
import type { AudioMode } from "../types";
import { cameraErrorMessage, openCamera, stopCamera } from "../cameraManager";
import { VideoFrameScheduler } from "../frameScheduler";
import { PoseClient, type InferenceMode } from "../poseClient";
import { WristMotionTracker } from "../velocity";
import { createSessionId } from "../sessionExport";
import { distance3 } from "../vectorMath";
import type { CalibrationSnapshot, CameraSnapshot, Hand, PoseSample, TargetSnapshot } from "../types";
import { buildScrambleSummary, buildVirtualWrestlerStimulus, ChainSequenceTracker, compareFatigueBlocks, evaluatePatternTrial } from "./advancedEngines";
import { evaluateWrestlingCalibration } from "./calibration";
import { extractWrestlingFeatures } from "./features";
import { createHandFightingTarget, HandFightingEngine } from "./handFightingEngine";
import { buildWrestlingSessionSummary } from "./metrics";
import { buildAdaptiveRecommendations, buildProtocolTrend, buildWrestlingProfile } from "./profile";
import { generateWrestlingStimulus, WRESTLING_PROTOCOL_LIST, WRESTLING_PROTOCOLS } from "./protocols";
import { renderWrestlingCanvas } from "./renderer";
import { createWrestlingSession, downloadWrestlingSession, listWrestlingSessions, localAthleteId, saveWrestlingSession } from "./sessionStore";
import { WrestlingTrialEngine } from "./trialEngine";
import type { WrestlingCalibrationEvaluation, WrestlingCalibrationSnapshot } from "./types";
import type {
  FatigueStimulus,
  WrestlingDirection,
  WrestlingMotionSnapshot,
  WrestlingProtocolId,
  WrestlingSession,
  WrestlingStimulus,
  WrestlingTrial,
} from "./protocolTypes";

type Screen = "intro" | "permission" | "calibration" | "ready" | "countdown" | "trial" | "results" | "profile" | "error";
type CoachConfig = {
  protocol: "shot" | "sprawl" | "movement" | "hand-fighting";
  requiredResponse: WrestlingDirection;
  targetZone: "LEFT_WRIST" | "RIGHT_WRIST" | "COLLAR_TIE" | "INSIDE_CONTROL";
  trialCount: number;
  attackSide: "mixed" | "left" | "right";
  telegraphMs: number;
  fakeProbabilityPct: number;
  durationSeconds: number;
  difficulty: number;
};

const EMPTY_EVALUATION: WrestlingCalibrationEvaluation = { ready: false, progressPct: 0, issues: [], snapshot: null, usableSampleCount: 0 };
const DEFAULT_COACH_CONFIG: CoachConfig = { protocol: "shot", requiredResponse: "LEFT", targetZone: "LEFT_WRIST", trialCount: 10, attackSide: "mixed", telegraphMs: 500, fakeProbabilityPct: 30, durationSeconds: 30, difficulty: 2 };
const SAFETY = ["Çevrendeki alanı boşalt.", "Stabil ayakkabı ve zemin kullan.", "Kameradan yeterli mesafe bırak.", "Hızlı fakat kontrollü hareket et.", "Güvensiz zeminde maksimal darbeli sprawl yapma.", "Ağrı veya baş dönmesinde dur."] as const;

const initialMotion = (): WrestlingMotionSnapshot => ({ bodyDisplacement: { x: 0, y: 0, magnitude: 0 }, hipDisplacementM: 0, hipHeightDeltaNormalized: 0, torsoAngleDeltaDeg: 0, stanceWidthDeltaNormalized: 0, compositeVelocity: 0, detectedDirection: null });

export function WrestlingLab({ initialDebug = false, onBack }: { initialDebug?: boolean; onBack: () => void }) {
  const [screen, setScreen] = useState<Screen>("intro");
  const screenRef = useRef<Screen>(screen);
  const [protocolId, setProtocolId] = useState<WrestlingProtocolId>("shot-reaction");
  const protocolRef = useRef<WrestlingProtocolId>(protocolId);
  const [coachConfig, setCoachConfig] = useState<CoachConfig>(DEFAULT_COACH_CONFIG);
  const [label, setLabel] = useState("");
  const [camera, setCamera] = useState<CameraSnapshot | null>(null);
  const cameraRef = useRef<CameraSnapshot | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [inferenceMode, setInferenceMode] = useState<InferenceMode | null>(null);
  const [evaluation, setEvaluation] = useState<WrestlingCalibrationEvaluation>(EMPTY_EVALUATION);
  const [calibration, setCalibration] = useState<WrestlingCalibrationSnapshot | null>(null);
  const calibrationRef = useRef<WrestlingCalibrationSnapshot | null>(null);
  const [debug, setDebug] = useState(initialDebug);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [launchNonce, setLaunchNonce] = useState(0);
  const [cue, setCue] = useState<WrestlingStimulus | null>(null);
  const cueRef = useRef<WrestlingStimulus | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<AudioMode>("voice");
  const audioModeRef = useRef<AudioMode>("voice");
  const [trialIndex, setTrialIndex] = useState(0);
  const trialIndexRef = useRef(0);
  const [trials, setTrials] = useState<WrestlingTrial[]>([]);
  const trialsRef = useRef<WrestlingTrial[]>([]);
  const [history, setHistory] = useState<WrestlingSession[]>([]);
  const [savedSession, setSavedSession] = useState<WrestlingSession | null>(null);
  const [latestMotion, setLatestMotion] = useState<WrestlingMotionSnapshot>(initialMotion);
  const latestMotionRef = useRef<WrestlingMotionSnapshot>(initialMotion());
  const [poseFps, setPoseFps] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseClientRef = useRef<PoseClient | null>(null);
  const schedulerRef = useRef<VideoFrameScheduler | null>(null);
  const latestPoseRef = useRef<PoseSample | null>(null);
  const calibrationSamplesRef = useRef<PoseSample[]>([]);
  const poseTimesRef = useRef<number[]>([]);
  const currentEngineRef = useRef<WrestlingTrialEngine | null>(null);
  const handEngineRef = useRef<HandFightingEngine | null>(null);
  const chainEngineRef = useRef<ChainSequenceTracker | null>(null);
  const targetRef = useRef<TargetSnapshot | null>(null);
  const leftWristRef = useRef(new WristMotionTracker("left"));
  const rightWristRef = useRef(new WristMotionTracker("right"));
  const sessionStartedRef = useRef("");
  const sessionIdRef = useRef("");
  const trialTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const renderRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef(0);
  const lastChainEventRef = useRef<{ direction: WrestlingDirection | null; timestampMs: number }>({ direction: null, timestampMs: 0 });
  const finishingRef = useRef(false);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { protocolRef.current = protocolId; }, [protocolId]);
  useEffect(() => {
    const athleteId = localAthleteId();
    void listWrestlingSessions(athleteId).then(setHistory).catch(() => setWarning("Yerel geçmiş şu anda okunamadı; test yine çalışabilir."));
  }, []);

  const stopPipeline = useCallback(() => {
    schedulerRef.current?.stop(); schedulerRef.current = null;
    poseClientRef.current?.close(); poseClientRef.current = null;
    stopCamera(streamRef.current); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    audioModeRef.current = audioMode;
    if (audioMode === "off") stopSpeaking();
  }, [audioMode]);
  // Bilesen kapanirken konusma ve AudioContext birakilir.
  useEffect(() => () => releaseAudio(), []);

  const playBeep = useCallback((kind: Parameters<typeof beep>[0]) => {
    if (audioModeRef.current !== "off") beep(kind);
  }, []);

  /** Cue duyurusu: her modda nötr efekt, "voice" modunda ayrıca Türkçe komut. */
  const announceCue = useCallback((stimulus: WrestlingStimulus) => {
    if (audioModeRef.current === "off") return;
    playBeep(wrestlingCueBeep(stimulus));
    if (audioModeRef.current !== "voice") return;
    const phrase = wrestlingCueSpeech(stimulus);
    if (phrase) speak(phrase, { rate: 1.15 });
  }, [playBeep]);

  const totalTrials = useCallback((id: WrestlingProtocolId): number => id === "coach-test" ? coachConfig.trialCount : WRESTLING_PROTOCOLS[id].trialCount, [coachConfig.trialCount]);

  const finishTrial = useCallback((result: WrestlingTrial) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (trialTimerRef.current !== null) {
      window.clearTimeout(trialTimerRef.current);
      trialTimerRef.current = null;
    }
    let finalized = result;
    const currentCue = cueRef.current;
    if (protocolRef.current === "wrestling-fatigue" && currentCue?.kind === "FATIGUE") {
      finalized = { ...result, type: "fatigue", stimulus: currentCue, block: currentCue.block, nestedType: currentCue.nested.kind } as WrestlingTrial;
    } else if (protocolRef.current === "virtual-wrestler" && currentCue?.kind === "VIRTUAL_WRESTLER") {
      finalized = { ...result, type: "virtual-wrestler", stimulus: currentCue, difficulty: currentCue.difficulty, timingEvents: currentCue.events } as WrestlingTrial;
    } else if (protocolRef.current === "opponent-reading" && currentCue?.kind === "PATTERN") {
      const detected = result.motion.detectedDirection ? [result.motion.detectedDirection] : [];
      finalized = evaluatePatternTrial({ trialIndex: result.trialIndex, stimulus: currentCue, detectedResponses: detected, t0Ms: result.t0Ms, eventTimesMs: result.t2Ms ? [result.t2Ms] : [], motion: result.motion });
    }
    trialsRef.current = [...trialsRef.current, finalized];
    setTrials(trialsRef.current);
    setFeedback(finalized.correct ? "GEÇERLİ YANIT" : finalized.outcome.replaceAll("_", " "));
    playBeep(finalized.correct ? "hit" : "miss");
    currentEngineRef.current = null; handEngineRef.current = null; chainEngineRef.current = null;
    const nextIndex = trialIndexRef.current + 1;
    if (nextIndex >= totalTrials(protocolRef.current)) {
      window.setTimeout(() => {
        finishingRef.current = false;
        setScreen("results");
        playBeep("finish");
        if (audioModeRef.current === "voice") speak("Seans tamamlandı", { rate: 1 });
      }, 750);
      return;
    }
    trialIndexRef.current = nextIndex;
    setTrialIndex(nextIndex);
    trialTimerRef.current = window.setTimeout(() => {
      finishingRef.current = false;
      setFeedback(null);
      setLaunchNonce((value) => value + 1);
    }, PERFORMANCE_CONFIG.session.interTrialFeedbackMs);
  }, [playBeep, totalTrials]);

  const handlePoseSample = useCallback((sample: PoseSample) => {
    latestPoseRef.current = sample;
    poseTimesRef.current.push(sample.timestampMs);
    const cutoff = sample.timestampMs - 2_000;
    while (poseTimesRef.current.length && poseTimesRef.current[0] < cutoff) poseTimesRef.current.shift();
    const duration = poseTimesRef.current.length > 1 ? poseTimesRef.current.at(-1)! - poseTimesRef.current[0] : 0;
    const fps = duration > 0 ? ((poseTimesRef.current.length - 1) * 1_000) / duration : 0;

    if (screenRef.current === "calibration" && cameraRef.current) {
      calibrationSamplesRef.current.push(sample);
      calibrationSamplesRef.current = calibrationSamplesRef.current.filter((item) => item.timestampMs >= sample.timestampMs - PERFORMANCE_CONFIG.wrestling.calibration.stableWindowMs - 300);
      const next = evaluateWrestlingCalibration(calibrationSamplesRef.current, cameraRef.current, sample.timestampMs);
      if (sample.timestampMs - lastUiUpdateRef.current > 150) { setEvaluation(next); setPoseFps(fps); lastUiUpdateRef.current = sample.timestampMs; }
      if (next.ready && next.snapshot) {
        calibrationRef.current = next.snapshot; setCalibration(next.snapshot); setScreen("ready");
      }
      return;
    }

    if (screenRef.current !== "trial" || !calibrationRef.current) return;
    let result: WrestlingTrial | null = null;
    if (handEngineRef.current && targetRef.current) {
      const boxingCalibration = wrestlingAsBoxingCalibration(calibrationRef.current);
      const canvas = { width: targetRef.current.canvasWidth, height: targetRef.current.canvasHeight };
      const observations: Record<Hand, ReturnType<WristMotionTracker["update"]>> = {
        left: leftWristRef.current.update(sample, boxingCalibration, canvas),
        right: rightWristRef.current.update(sample, boxingCalibration, canvas),
      };
      result = handEngineRef.current.update(observations);
    } else if (chainEngineRef.current) {
      const motion = motionFromSample(sample, calibrationRef.current);
      latestMotionRef.current = motion;
      if (chainEngineRef.current) {
        if (motion.detectedDirection && (motion.detectedDirection !== lastChainEventRef.current.direction || sample.timestampMs - lastChainEventRef.current.timestampMs > 500)) {
          result = chainEngineRef.current.recordMovement(motion.detectedDirection, sample.timestampMs, motion);
          lastChainEventRef.current = { direction: motion.detectedDirection, timestampMs: sample.timestampMs };
        } else if (!motion.detectedDirection) {
          lastChainEventRef.current.direction = null;
        }
        result ??= chainEngineRef.current.updateRecovery(motion, sample.timestampMs);
      }
    } else if (currentEngineRef.current) {
      result = currentEngineRef.current.update(sample);
      latestMotionRef.current = result?.motion ?? motionFromSample(sample, calibrationRef.current);
    }
    if (sample.timestampMs - lastUiUpdateRef.current > 250) { setLatestMotion(latestMotionRef.current); setPoseFps(fps); lastUiUpdateRef.current = sample.timestampMs; }
    if (result) finishTrial(result);
  }, [finishTrial]);

  const bootPipeline = useCallback(async (deviceId?: string) => {
    setWarning(null);
    try {
      stopPipeline();
      const opened = await openCamera(deviceId);
      streamRef.current = opened.stream; cameraRef.current = opened.snapshot; setCamera(opened.snapshot); setDevices(opened.devices); setSelectedDeviceId(opened.snapshot.deviceId ?? deviceId ?? "");
      const video = videoRef.current;
      if (!video) throw new Error("Kamera önizlemesi hazırlanamadı.");
      video.srcObject = opened.stream; await video.play();
      const poseClient = new PoseClient(); poseClientRef.current = poseClient;
      const mode = await poseClient.initialize(handlePoseSample, (message) => setWarning(`Pose frame atlandı: ${message}`));
      setInferenceMode(mode);
      const scheduler = new VideoFrameScheduler(video, (timestampMs) => { void poseClient.processFrame(video, timestampMs); });
      schedulerRef.current = scheduler; scheduler.start(); setScreen("calibration");
    } catch (cause) {
      stopPipeline(); setError(cameraErrorMessage(cause)); setScreen("error");
    }
  }, [handlePoseSample, stopPipeline]);

  useEffect(() => {
    if (screen !== "permission") return;
    const frame = requestAnimationFrame(() => { void bootPipeline(selectedDeviceId || undefined); });
    return () => cancelAnimationFrame(frame);
  }, [bootPipeline, screen, selectedDeviceId]);

  const startTrial = useCallback(() => {
    const calibrationValue = calibrationRef.current;
    if (!calibrationValue) return;
    const id = protocolRef.current;
    const stimulus = sessionStimulus(id, trialIndexRef.current, coachConfig);
    cueRef.current = stimulus; setCue(stimulus); targetRef.current = null;
    requestAnimationFrame(() => {
      const t0Ms = performance.now();
      if (stimulus.kind === "HAND_FIGHTING") {
        const canvas = canvasRef.current;
        const size = canvas ? { width: Math.max(1, canvas.getBoundingClientRect().width), height: Math.max(1, canvas.getBoundingClientRect().height) } : { width: 1_000, height: 600 };
        const target = createHandFightingTarget(calibrationValue, size, stimulus);
        targetRef.current = target;
        leftWristRef.current.reset(); rightWristRef.current.reset();
        handEngineRef.current = new HandFightingEngine(trialIndexRef.current, id, stimulus, calibrationValue, target, t0Ms);
      } else if (stimulus.kind === "CHAIN") {
        chainEngineRef.current = new ChainSequenceTracker(trialIndexRef.current, stimulus, t0Ms);
      } else {
        let engineStimulus = stimulus;
        if (stimulus.kind === "FATIGUE") engineStimulus = stimulus.nested;
        if (stimulus.kind === "VIRTUAL_WRESTLER") engineStimulus = stimulus.attack === "FAKE" ? { kind: "RECOGNITION", cue: "FAKE", attack: null, requiredDirection: "RESTRAINT" } : { kind: "SHOT", attack: stimulus.attack, requiredDirection: stimulus.attack === "LEFT_SINGLE" ? "LEFT" : stimulus.attack === "RIGHT_SINGLE" ? "RIGHT" : "SPRAWL" };
        if (stimulus.kind === "PATTERN") engineStimulus = { kind: "SPRAWL", attack: "DOUBLE_LEG", requiredDirection: "SPRAWL" };
        currentEngineRef.current = new WrestlingTrialEngine({ trialIndex: trialIndexRef.current, protocolId: id, stimulus: engineStimulus, calibration: calibrationValue, t0Ms });
      }
      setScreen("trial");
      // Ses T0'dan SONRA: seslendirme gecikmesi cue zamanlamasını kaydırmasın.
      announceCue(stimulus);
      trialTimerRef.current = window.setTimeout(() => {
        const result = currentEngineRef.current?.forceTimeout(performance.now()) ?? handEngineRef.current?.forceTimeout() ?? chainEngineRef.current?.forceTimeout(performance.now());
        if (result) finishTrial(result);
      }, PERFORMANCE_CONFIG.wrestling.motion.trialTimeoutMs + PERFORMANCE_CONFIG.wrestling.recovery.timeoutMs + 400);
    });
  }, [announceCue, coachConfig, finishTrial]);
  useEffect(() => {
    if (launchNonce > 0) startTrial();
  }, [launchNonce, startTrial]);

  const startSession = useCallback(() => {
    trialsRef.current = []; setTrials([]); trialIndexRef.current = 0; setTrialIndex(0); setSavedSession(null);
    sessionStartedRef.current = new Date().toISOString(); sessionIdRef.current = createSessionId();
    setCountdown(3); setScreen("countdown");
    // ★ Kullanıcı hareketi içindeyiz — ses motorları yalnızca burada açılabilir.
    if (audioModeRef.current !== "off") {
      initAudio();
      playBeep("tick");
      if (audioModeRef.current === "voice") speak("Hazır ol");
    }
    let value = 3;
    countdownTimerRef.current = window.setInterval(() => {
      value -= 1; setCountdown(value);
      if (value > 0) { playBeep("tick"); return; }
      if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      playBeep("go");
      setLaunchNonce((current) => current + 1);
    }, 1_000);
  }, [playBeep]);

  const summary = useMemo(() => buildWrestlingSessionSummary(trials), [trials]);
  const fatigueComparison = useMemo(() => {
    if (protocolId !== "wrestling-fatigue") return null;
    const block = (name: FatigueStimulus["block"]) => buildWrestlingSessionSummary(trials.filter((trial) => trial.type === "fatigue" && trial.block === name));
    return compareFatigueBlocks(block("A_BASELINE"), block("C_POST"), block("D_RECOVERY"));
  }, [protocolId, trials]);
  const scrambleSummary = useMemo(() => protocolId === "scramble" ? buildScrambleSummary(trials.filter((trial) => trial.type === "scramble")) : null, [protocolId, trials]);
  const profile = useMemo(() => buildWrestlingProfile(history), [history]);
  const recommendations = useMemo(() => buildAdaptiveRecommendations({ sessions: history }), [history]);
  const currentTrend = useMemo(() => buildProtocolTrend(history, protocolId), [history, protocolId]);

  useEffect(() => {
    if (screen !== "results" || !camera || !calibration || trials.length === 0 || savedSession) return;
    const session = createWrestlingSession({ sessionId: sessionIdRef.current, athleteId: localAthleteId(), label, startedAt: sessionStartedRef.current, endedAt: new Date().toISOString(), protocolId, camera, calibration, trials, summary, customConfig: protocolId === "coach-test" ? coachConfig : undefined });
    setSavedSession(session);
    void saveWrestlingSession(session).then(() => setHistory((current) => [...current.filter((item) => item.sessionId !== session.sessionId), session].toSorted((a, b) => a.startedAt.localeCompare(b.startedAt)))).catch(() => setWarning("Sonuç JSON olarak indirilebilir; yerel profile kaydetme başarısız oldu."));
  }, [camera, calibration, coachConfig, label, protocolId, savedSession, screen, summary, trials]);

  useEffect(() => {
    let active = true;
    const draw = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      if (canvas) renderWrestlingCanvas(canvas, { pose: latestPoseRef.current, calibration: calibrationRef.current, stimulus: cueRef.current, target: targetRef.current, motion: latestMotionRef.current, debug, t0Ms: trialsRef.current.at(-1)?.t0Ms ?? null, t1Ms: trialsRef.current.at(-1)?.t1Ms ?? null, t2Ms: trialsRef.current.at(-1)?.t2Ms ?? null, t3Ms: trialsRef.current.at(-1)?.t3Ms ?? null, processingFps: poseFps });
      renderRef.current = requestAnimationFrame(draw);
    };
    renderRef.current = requestAnimationFrame(draw);
    return () => { active = false; if (renderRef.current !== null) cancelAnimationFrame(renderRef.current); };
  }, [debug, poseFps]);

  useEffect(() => () => {
    stopPipeline();
    if (trialTimerRef.current !== null) window.clearTimeout(trialTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
  }, [stopPipeline]);

  if (screen === "intro" || screen === "profile") return (
    <WrestlingIntro
      protocolId={protocolId} onProtocol={setProtocolId} label={label} onLabel={setLabel}
      coachConfig={coachConfig} onCoachConfig={setCoachConfig} onStart={() => setScreen("permission")}
      onBack={onBack} history={history} profile={profile} recommendations={recommendations}
      currentTrend={currentTrend} showProfile={screen === "profile"} onShowProfile={() => setScreen(screen === "profile" ? "intro" : "profile")}
    />
  );

  if (screen === "error") return (
    <main className="mx-auto min-h-[75vh] max-w-3xl px-5 py-16 text-white"><section className="rounded-3xl border border-red-400/30 bg-red-950/25 p-8"><p className="text-xs font-black uppercase tracking-[.28em] text-red-300">Wrestling Lab</p><h1 className="mt-3 font-display text-4xl uppercase">Test başlatılamadı</h1><p className="mt-4 text-zinc-300">{error}</p><div className="mt-7 flex gap-3"><button className={primaryButton} onClick={() => setScreen("permission")}>Tekrar Dene</button><button className={secondaryButton} onClick={() => { stopPipeline(); setScreen("intro"); }}>Modlara Dön</button></div></section></main>
  );

  return (
    <main className="mx-auto min-h-[86vh] max-w-7xl px-4 py-6 text-white sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[.26em] text-brand-yellow">BlackBox Wrestling Lab</p><h1 className="font-display text-3xl uppercase">{WRESTLING_PROTOCOLS[protocolId].name}</h1></div>
        <div className="flex flex-wrap gap-2"><div role="group" aria-label="Ses kademesi" className="flex overflow-hidden rounded-xl border border-white/15">{(["off", "cues", "voice"] as AudioMode[]).map((value) => <button key={value} type="button" onClick={() => { if (value !== "off") initAudio(); setAudioMode(value); }} aria-pressed={audioMode === value} className={`px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${audioMode === value ? "bg-brand-yellow text-black" : "text-zinc-400 hover:text-white"}`}>{WRESTLING_AUDIO_MODE_LABELS[value]}</button>)}</div><button className={secondaryButton} onClick={() => setDebug((value) => !value)} aria-pressed={debug}>Diagnostics {debug ? "Açık" : "Kapalı"}</button><button className={secondaryButton} onClick={() => { stopPipeline(); setScreen("intro"); }}>Çık</button></div>
      </div>
      {warning ? <p className="mb-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{warning}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
        <section className="relative aspect-video overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
          <video ref={videoRef} className="h-full w-full scale-x-[-1] object-cover" muted playsInline aria-label="Wrestling Lab kamera önizlemesi" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {screen === "countdown" ? <div className="absolute inset-0 grid place-items-center bg-black/55"><span className="font-display text-9xl text-brand-yellow">{countdown > 0 ? countdown : "BAŞLA"}</span></div> : null}
          {screen === "trial" && cue ? <CueOverlay stimulus={cue} /> : null}
          {feedback ? <div className="absolute inset-x-0 top-[42%] bg-black/75 py-5 text-center font-display text-4xl uppercase text-brand-yellow">{feedback}</div> : null}
        </section>
        <section className="space-y-4">
          {screen === "permission" ? <StatusCard title="Kamera hazırlanıyor" text="Kamera ve yerel pose modeli başlatılıyor." /> : null}
          {screen === "calibration" ? <CalibrationCard evaluation={evaluation} /> : null}
          {screen === "ready" && calibration ? <ReadyCard calibration={calibration} protocolId={protocolId} onStart={startSession} /> : null}
          {screen === "countdown" || screen === "trial" ? <TrialCard protocolId={protocolId} trialIndex={trialIndex} total={totalTrials(protocolId)} motion={latestMotion} poseFps={poseFps} inferenceMode={inferenceMode} /> : null}
          {screen === "results" ? <ResultsCard summary={summary} session={savedSession} fatigue={fatigueComparison} scramble={scrambleSummary} onDownload={() => savedSession && downloadWrestlingSession(savedSession)} onAgain={startSession} onModes={() => setScreen("intro")} /> : null}
          {camera && devices.length > 1 && ["calibration", "ready"].includes(screen) ? <label className="block rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Kamera</span><select className="w-full rounded-xl border border-white/15 bg-black px-3 py-2" value={selectedDeviceId} onChange={(event) => { setSelectedDeviceId(event.target.value); calibrationSamplesRef.current = []; setEvaluation(EMPTY_EVALUATION); setScreen("permission"); }}><option value="">Varsayılan</option>{devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || "Kamera"}</option>)}</select></label> : null}
        </section>
      </div>
    </main>
  );
}

function WrestlingIntro(props: {
  protocolId: WrestlingProtocolId; onProtocol: (id: WrestlingProtocolId) => void; label: string; onLabel: (value: string) => void;
  coachConfig: CoachConfig; onCoachConfig: (value: CoachConfig) => void; onStart: () => void; onBack: () => void;
  history: WrestlingSession[]; profile: ReturnType<typeof buildWrestlingProfile>; recommendations: ReturnType<typeof buildAdaptiveRecommendations>;
  currentTrend: ReturnType<typeof buildProtocolTrend>; showProfile: boolean; onShowProfile: () => void;
}) {
  const selected = WRESTLING_PROTOCOLS[props.protocolId];
  return (
    <main className="mx-auto max-w-7xl px-5 py-12 text-white sm:py-16">
      <button onClick={props.onBack} className="text-sm font-bold text-zinc-400 transition hover:text-white">← Boxing Lab</button>
      <div className="mt-7 grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <section>
          <p className="text-xs font-black uppercase tracking-[.32em] text-brand-yellow">BlackBox Fight Lab</p>
          <h1 className="mt-3 font-display text-5xl uppercase leading-none sm:text-7xl">BlackBox<br /><span className="text-brand-yellow">Wrestling Lab</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">Webcam + MediaPipe ile shot, defense, movement, recovery ve decision performansını aynı ölçüm çekirdeğinde takip et. Kamera görüntüsü cihazından çıkmaz.</p>
          <div className="mt-7 flex flex-wrap gap-3"><button className={primaryButton} onClick={props.onStart}>Kamerayı Aç ve Wrestling Testine Başla</button>{props.history.length ? <button className={secondaryButton} onClick={props.onShowProfile}>{props.showProfile ? "Modları Göster" : `Wrestling Profile · ${props.history.length} seans`}</button> : null}</div>
          <p className="mt-4 text-sm text-zinc-500">Bu sistem performans ölçer; tıbbi güvenlik, teknik doğruluk veya tanı hizmeti değildir.</p>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
          <h2 className="font-display text-2xl uppercase">Güvenli alan kontrolü</h2>
          <ul className="mt-4 grid gap-2 text-sm text-zinc-300">{SAFETY.map((item) => <li key={item} className="flex gap-2"><span className="text-brand-yellow">●</span>{item}</li>)}</ul>
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">Kamera videosu yerel olarak işlenir ve yüklenmez. Yalnız türetilmiş sayısal sonuçlar bu cihazdaki Wrestling Profile&apos;a kaydedilir.</div>
        </section>
      </div>

      {props.showProfile ? <ProfileDashboard profile={props.profile} history={props.history} recommendations={props.recommendations} /> : (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-zinc-500">Game modes</p><h2 className="font-display text-3xl uppercase">Wrestling protokolünü seç</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{selected.phase} · {selected.trialCount} trial</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{WRESTLING_PROTOCOL_LIST.map((protocol) => <button key={protocol.id} onClick={() => props.onProtocol(protocol.id)} aria-pressed={props.protocolId === protocol.id} className={`rounded-2xl border p-4 text-left transition ${props.protocolId === protocol.id ? "border-brand-yellow bg-brand-yellow/10" : "border-white/10 bg-white/[.025] hover:border-white/25"}`}><span className="text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">{protocol.phase}</span><strong className="mt-1 block font-display text-xl uppercase">{protocol.shortName}</strong><span className="mt-2 block text-xs leading-5 text-zinc-400">{protocol.description}</span></button>)}</div>
          <div className="mt-5 grid gap-4 rounded-3xl border border-white/10 bg-black/35 p-6 md:grid-cols-[1fr_auto] md:items-end"><div><h3 className="font-display text-2xl uppercase text-brand-yellow">{selected.name}</h3><p className="mt-2 text-zinc-300">{selected.instruction}</p>{props.currentTrend ? <p className="mt-3 text-sm text-zinc-500">Uyumlu geçmiş: baseline {formatMs(props.currentTrend.baseline)} · latest {formatMs(props.currentTrend.latest)} · personal best {formatMs(props.currentTrend.personalBest)}</p> : null}</div><label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Seans etiketi<input value={props.label} onChange={(event) => props.onLabel(event.target.value)} placeholder="Örn. Salı akşamı" className="mt-2 block w-full min-w-64 rounded-xl border border-white/15 bg-black px-3 py-2 text-sm font-normal normal-case tracking-normal text-white" /></label></div>
          {props.protocolId === "coach-test" ? <CoachConfigPanel config={props.coachConfig} onChange={props.onCoachConfig} /> : null}
          {props.protocolId === "virtual-wrestler" ? <VirtualConfigPanel config={props.coachConfig} onChange={props.onCoachConfig} /> : null}
        </section>
      )}
    </main>
  );
}

function ProfileDashboard({ profile, history, recommendations }: { profile: ReturnType<typeof buildWrestlingProfile>; history: WrestlingSession[]; recommendations: ReturnType<typeof buildAdaptiveRecommendations> }) {
  return <section className="mt-12"><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.25em] text-zinc-500">W15 · personal longitudinal view</p><h2 className="font-display text-4xl uppercase">BlackBox Wrestling Profile</h2></div><span className="text-sm text-zinc-500">{history.length} seans</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{profile.map((dimension) => <article key={dimension.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{dimension.label}</p><p className="mt-2 font-display text-4xl text-brand-yellow">{dimension.score ?? "—"}</p><p className="mt-2 text-sm text-zinc-300">{dimension.rawMetric}</p><p className="mt-3 text-[11px] leading-4 text-zinc-600">Experimental product score; ham metriğin yerini almaz.</p></article>)}</div><div className="mt-6 rounded-3xl border border-white/10 bg-white/[.025] p-6"><h3 className="font-display text-2xl uppercase">Adaptive focus</h3>{recommendations.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{recommendations.map((item) => <article key={item.ruleId} className="rounded-2xl border border-brand-yellow/20 bg-brand-yellow/[.06] p-4"><strong className="text-brand-yellow">{item.title}</strong><p className="mt-2 text-sm leading-6 text-zinc-300">{item.reason}</p></article>)}</div> : <p className="mt-3 text-sm text-zinc-400">Yeterli, kaliteli ve sürüm-uyumlu seans biriktiğinde açıklanabilir öneriler burada görünür.</p>}</div></section>;
}

function CoachConfigPanel({ config, onChange }: { config: CoachConfig; onChange: (value: CoachConfig) => void }) {
  return <div className="mt-4 grid gap-4 rounded-3xl border border-violet-300/20 bg-violet-400/[.06] p-5 sm:grid-cols-2 lg:grid-cols-3"><SelectField label="Protocol" value={config.protocol} options={["shot", "sprawl", "movement", "hand-fighting"]} onChange={(protocol) => onChange({ ...config, protocol: protocol as CoachConfig["protocol"] })} /><SelectField label="Required response" value={config.requiredResponse} options={["LEFT", "RIGHT", "FORWARD", "BACK", "LEVEL", "SPRAWL"]} onChange={(requiredResponse) => onChange({ ...config, requiredResponse: requiredResponse as WrestlingDirection })} /><SelectField label="Target zone" value={config.targetZone} options={["LEFT_WRIST", "RIGHT_WRIST", "COLLAR_TIE", "INSIDE_CONTROL"]} onChange={(targetZone) => onChange({ ...config, targetZone: targetZone as CoachConfig["targetZone"] })} /><NumberField label="Trial" value={config.trialCount} min={3} max={30} onChange={(trialCount) => onChange({ ...config, trialCount })} /><NumberField label="Telegraph (ms)" value={config.telegraphMs} min={250} max={1_000} onChange={(telegraphMs) => onChange({ ...config, telegraphMs })} /><NumberField label="Fake (%)" value={config.fakeProbabilityPct} min={0} max={70} onChange={(fakeProbabilityPct) => onChange({ ...config, fakeProbabilityPct })} /><NumberField label="Duration (s)" value={config.durationSeconds} min={10} max={60} onChange={(durationSeconds) => onChange({ ...config, durationSeconds })} /><NumberField label="Difficulty" value={config.difficulty} min={1} max={5} onChange={(difficulty) => onChange({ ...config, difficulty })} /><SelectField label="Attack side" value={config.attackSide} options={["mixed", "left", "right"]} onChange={(attackSide) => onChange({ ...config, attackSide: attackSide as CoachConfig["attackSide"] })} /><p className="sm:col-span-2 lg:col-span-3 text-xs text-zinc-500">Custom Coach Test ayrı config hash ile saklanır; Weekly Benchmark sonuçlarıyla karıştırılmaz.</p></div>;
}

function VirtualConfigPanel({ config, onChange }: { config: CoachConfig; onChange: (value: CoachConfig) => void }) {
  return <div className="mt-4 grid gap-4 rounded-3xl border border-brand-yellow/20 bg-brand-yellow/[.05] p-5 sm:grid-cols-3"><NumberField label="Difficulty (1–5)" value={config.difficulty} min={1} max={5} onChange={(difficulty) => onChange({ ...config, difficulty })} /><NumberField label="Fake frequency (%)" value={config.fakeProbabilityPct} min={0} max={70} onChange={(fakeProbabilityPct) => onChange({ ...config, fakeProbabilityPct })} /><SelectField label="Attack side" value={config.attackSide} options={["mixed", "left", "right"]} onChange={(attackSide) => onChange({ ...config, attackSide: attackSide as CoachConfig["attackSide"] })} /></div>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}<input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-white" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black px-3 py-2 text-white">{options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label>;
}

function CalibrationCard({ evaluation }: { evaluation: WrestlingCalibrationEvaluation }) {
  return <StatusCard title="W0 · Wrestling Calibration" text="Wrestling stance'te baş, omuz, kalça, diz, ayak bileği ve bileklerini görünür tut."><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-yellow transition-all" style={{ width: `${evaluation.progressPct}%` }} /></div><div className="mt-4 space-y-2 text-sm text-zinc-300">{evaluation.issues.length ? evaluation.issues.map((entry) => <p key={entry.code}>• {entry.message}</p>) : <p>• Stance baseline toplanıyor; kısa süre sabit kal.</p>}</div></StatusCard>;
}

function ReadyCard({ calibration, protocolId, onStart }: { calibration: WrestlingCalibrationSnapshot; protocolId: WrestlingProtocolId; onStart: () => void }) {
  return <StatusCard title="Kalibrasyon tamam" text={WRESTLING_PROTOCOLS[protocolId].instruction}><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><Info label="Stance width" value={`${calibration.stanceWidthNormalized.toFixed(3)} frame`} /><Info label="Torso angle" value={`${calibration.torsoAngleDeg.toFixed(1)}°`} /><Info label="Knee proxy L/R" value={`${calibration.leftKneeFlexionProxyDeg.toFixed(0)}° / ${calibration.rightKneeFlexionProxyDeg.toFixed(0)}°`} /><Info label="Pose FPS" value={calibration.estimatedProcessingFps.toFixed(1)} /></dl><button className={`${primaryButton} mt-6 w-full`} onClick={onStart}>Testi Başlat</button></StatusCard>;
}

function TrialCard({ protocolId, trialIndex, total, motion, poseFps, inferenceMode }: { protocolId: WrestlingProtocolId; trialIndex: number; total: number; motion: WrestlingMotionSnapshot; poseFps: number; inferenceMode: InferenceMode | null }) {
  return <StatusCard title={`Trial ${trialIndex + 1} / ${total}`} text={WRESTLING_PROTOCOLS[protocolId].instruction}><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><Info label="Direction" value={motion.detectedDirection ?? "Bekleniyor"} /><Info label="Composite velocity" value={`${motion.compositeVelocity.toFixed(2)} m/s`} /><Info label="Hip delta" value={motion.hipHeightDeltaNormalized.toFixed(3)} /><Info label="Pose" value={`${poseFps.toFixed(1)} FPS · ${inferenceMode ?? "—"}`} /></dl></StatusCard>;
}

function ResultsCard({ summary, session, fatigue, scramble, onDownload, onAgain, onModes }: { summary: ReturnType<typeof buildWrestlingSessionSummary>; session: WrestlingSession | null; fatigue: ReturnType<typeof compareFatigueBlocks> | null; scramble: ReturnType<typeof buildScrambleSummary> | null; onDownload: () => void; onAgain: () => void; onModes: () => void }) {
  return <StatusCard title="Session complete" text={`${summary.correctCount}/${summary.validTrialCount} doğru · tracking %${summary.trackingQualityPct}`}><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Reaction" value={formatMs(summary.medianReactionTimeMs)} /><Metric label="Execution" value={formatMs(summary.medianExecutionTimeMs)} /><Metric label="Recovery T3" value={formatMs(summary.medianRecoveryToStanceMs)} /><Metric label="Accuracy" value={`%${summary.accuracyPct}`} /><Metric label="Consistency MAD" value={formatMs(summary.reactionConsistencyMadMs)} /><Metric label="L / R difference" value={formatMs(summary.absoluteDifferenceMs)} />{fatigue ? <><Metric label="Reaction change" value={formatMs(fatigue.reactionChangeMs)} /><Metric label="Accuracy change" value={`${fatigue.accuracyChangePoints > 0 ? "+" : ""}${fatigue.accuracyChangePoints} pt`} /><Metric label="Movement change" value={formatMs(fatigue.movementTimeChangeMs)} /><Metric label="Recovery retest" value={formatMs(fatigue.recoveryRetestChangeMs)} /></> : null}{scramble ? <><Metric label="Late reaction change" value={scramble.reactionDeteriorationPct === null ? "—" : `%${scramble.reactionDeteriorationPct}`} /><Metric label="Accuracy deterioration" value={scramble.accuracyDeteriorationPoints === null ? "—" : `${scramble.accuracyDeteriorationPoints} pt`} /></> : null}</div>{summary.qualityFlags.length ? <p className="mt-4 text-xs leading-5 text-amber-200">Quality flags: {summary.qualityFlags.join(", ")}</p> : null}<p className="mt-4 text-xs leading-5 text-zinc-500">Ham metrikler kamera-türevlidir. Composite sonuçlar bilimsel olarak doğrulanmış dereceler değildir.</p><div className="mt-5 grid gap-2"><button className={primaryButton} onClick={onDownload} disabled={!session}>JSON İndir</button><button className={secondaryButton} onClick={onAgain}>Tekrarla</button><button className={secondaryButton} onClick={onModes}>Modlara Dön</button></div></StatusCard>;
}

function CueOverlay({ stimulus }: { stimulus: WrestlingStimulus }) {
  const label = cueLabel(stimulus);
  const virtual = stimulus.kind === "VIRTUAL_WRESTLER";
  return <div className="pointer-events-none absolute inset-0 grid place-items-center"><div className={`rounded-3xl border px-8 py-6 text-center shadow-2xl backdrop-blur-sm ${stimulus.kind === "RECOGNITION" && stimulus.cue === "FAKE" ? "border-violet-300/50 bg-violet-950/70" : "border-brand-yellow/50 bg-black/70"}`}>{virtual ? <div className="mx-auto mb-4 h-28 w-20 rounded-[45%_45%_35%_35%] border-4 border-brand-yellow bg-brand-yellow/10 shadow-[0_0_40px_rgba(250,204,21,.25)]" /> : null}<p className="text-xs font-black uppercase tracking-[.3em] text-zinc-400">{stimulus.kind.replaceAll("_", " ")}</p><p className="mt-2 font-display text-5xl uppercase text-brand-yellow sm:text-7xl">{label}</p></div></div>;
}

function StatusCard({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return <article className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="font-display text-2xl uppercase">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>{children}</article>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-black/35 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</dt><dd className="mt-1 text-zinc-100">{value}</dd></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-black/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 font-display text-xl text-brand-yellow">{value}</p></div>; }

const primaryButton = "rounded-xl bg-brand-yellow px-5 py-3 text-sm font-black uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-40";
const secondaryButton = "rounded-xl border border-white/15 bg-white/[.04] px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-white/30 hover:bg-white/[.08]";
const formatMs = (value: number | null): string => value === null ? "—" : `${value.toFixed(0)} ms`;

function cueLabel(stimulus: WrestlingStimulus): string {
  if (stimulus.kind === "SHOT" || stimulus.kind === "SPRAWL" || stimulus.kind === "CHOICE") return stimulus.attack.replaceAll("_", " ");
  if (stimulus.kind === "RECOGNITION") return stimulus.cue === "FAKE" ? "FAKE · STANCE" : `REAL · ${stimulus.attack?.replaceAll("_", " ")}`;
  if (stimulus.kind === "MOVEMENT" || stimulus.kind === "SCRAMBLE") return ("command" in stimulus ? stimulus.command : "").replaceAll("_", " ");
  if (stimulus.kind === "STANCE") return "STANCE HOLD";
  if (stimulus.kind === "HAND_FIGHTING") return stimulus.target.replaceAll("_", " ");
  if (stimulus.kind === "CHAIN") return stimulus.sequence.join(" → ").replaceAll("_", " ");
  if (stimulus.kind === "FATIGUE") return `${stimulus.block.replaceAll("_", " ")} · ${cueLabel(stimulus.nested)}`;
  if (stimulus.kind === "VIRTUAL_WRESTLER") return stimulus.attack.replaceAll("_", " ");
  return stimulus.patternId.replaceAll("-", " ");
}

function sessionStimulus(id: WrestlingProtocolId, index: number, coach: CoachConfig): WrestlingStimulus {
  if (id === "weekly-benchmark") {
    if (index < 10) return generateWrestlingStimulus("shot-reaction");
    if (index < 20) return generateWrestlingStimulus("fake-real-recognition");
    if (index < 26) return generateWrestlingStimulus("sprawl-reaction");
    if (index < 32) return generateWrestlingStimulus("movement-lab");
    return { kind: "STANCE", durationMs: 1_500 };
  }
  if (id === "coach-test") {
    const attack = coach.attackSide === "left" ? "LEFT_SINGLE" : coach.attackSide === "right" ? "RIGHT_SINGLE" : Math.random() < 0.5 ? "LEFT_SINGLE" : "RIGHT_SINGLE";
    if (Math.random() * 100 < coach.fakeProbabilityPct) return { kind: "RECOGNITION", cue: "FAKE", attack: null, requiredDirection: "RESTRAINT" };
    if (coach.protocol === "sprawl") return { kind: "SPRAWL", attack: "DOUBLE_LEG", requiredDirection: "SPRAWL" };
    if (coach.protocol === "movement") return { kind: "MOVEMENT", command: coach.requiredResponse === "RIGHT" ? "RIGHT" : coach.requiredResponse === "FORWARD" ? "FORWARD" : coach.requiredResponse === "BACK" ? "BACK" : "LEFT", requiredDirection: coach.requiredResponse };
    if (coach.protocol === "hand-fighting") return { kind: "HAND_FIGHTING", target: coach.targetZone, requiredHand: coach.targetZone === "LEFT_WRIST" ? "right" : coach.targetZone === "RIGHT_WRIST" ? "left" : "either" };
    return { kind: "SHOT", attack, requiredDirection: attack === "LEFT_SINGLE" ? "LEFT" : "RIGHT" };
  }
  if (id === "wrestling-fatigue") {
    const block: FatigueStimulus["block"] = index < 5 ? "A_BASELINE" : index < 11 ? "B_WORK" : index < 16 ? "C_POST" : "D_RECOVERY";
    const nested = block === "B_WORK" ? generateWrestlingStimulus("movement-lab") : generateWrestlingStimulus("shot-reaction");
    return { kind: "FATIGUE", block, nested: nested as FatigueStimulus["nested"] };
  }
  if (id === "virtual-wrestler") {
    const attack = Math.random() * 100 < coach.fakeProbabilityPct ? "FAKE" : coach.attackSide === "left" ? "LEFT_SINGLE" : coach.attackSide === "right" ? "RIGHT_SINGLE" : generateWrestlingStimulus("shot-reaction");
    const resolvedAttack = typeof attack === "string" ? attack : attack.kind === "SHOT" ? attack.attack : "DOUBLE_LEG";
    return buildVirtualWrestlerStimulus(resolvedAttack, coach.difficulty, performance.now());
  }
  return generateWrestlingStimulus(id);
}

function wrestlingAsBoxingCalibration(value: WrestlingCalibrationSnapshot): CalibrationSnapshot {
  return {
    completedAt: value.completedAt, shoulderWidthM: value.shoulderWidthM, shoulderWidthNormalized: value.shoulderWidthNormalized,
    leftShoulderWorld: value.torsoCenterWorld, rightShoulderWorld: value.torsoCenterWorld,
    leftShoulderImage: value.torsoCenterImage, rightShoulderImage: value.torsoCenterImage,
    leftGuardWorld: value.leftWristBaselineWorld, rightGuardWorld: value.rightWristBaselineWorld,
    leftGuardImage: value.leftWristBaselineImage, rightGuardImage: value.rightWristBaselineImage,
    torsoCenterWorld: value.torsoCenterWorld, torsoCenterImage: value.torsoCenterImage,
    headNeutralWorld: value.torsoCenterWorld, headNeutralImage: value.torsoCenterImage,
    leftWristNoiseM: 0, rightWristNoiseM: 0, camera: value.camera, estimatedProcessingFps: value.estimatedProcessingFps,
  };
}

function motionFromSample(sample: PoseSample, calibration: WrestlingCalibrationSnapshot): WrestlingMotionSnapshot {
  const feature = extractWrestlingFeatures(sample);
  if (!feature) return initialMotion();
  const dx = feature.bodyCenterImage.x - calibration.bodyCenterImage.x;
  const dy = feature.bodyCenterImage.y - calibration.bodyCenterImage.y;
  const hipDisplacementM = distance3(feature.hipCenterWorld, calibration.hipCenterWorld);
  const torsoDelta = feature.torsoAngleDeg - calibration.torsoAngleDeg;
  const stanceDelta = feature.stanceWidthNormalized - calibration.stanceWidthNormalized;
  const dead = PERFORMANCE_CONFIG.wrestling.motion.directionDeadZoneNormalized;
  let detectedDirection: WrestlingDirection | null = null;
  const sprawlSignals = [hipDisplacementM >= PERFORMANCE_CONFIG.wrestling.motion.sprawlHipDisplacementM, Math.abs(dy) >= PERFORMANCE_CONFIG.wrestling.motion.sprawlHipHeightDeltaNormalized, Math.abs(torsoDelta) >= PERFORMANCE_CONFIG.wrestling.motion.sprawlTorsoAngleDeltaDeg, Math.abs(stanceDelta) >= dead].filter(Boolean).length;
  if (sprawlSignals >= 2) detectedDirection = "SPRAWL";
  else if (dy > dead) detectedDirection = "LEVEL";
  else if (Math.abs(dx) >= dead) detectedDirection = dx < 0 ? "LEFT" : "RIGHT";
  else if (dy < -dead) detectedDirection = "STAND";
  return { bodyDisplacement: { x: dx, y: dy, magnitude: Math.hypot(dx, dy) }, hipDisplacementM, hipHeightDeltaNormalized: feature.hipCenterImage.y - calibration.hipHeightNormalized, torsoAngleDeltaDeg: torsoDelta, stanceWidthDeltaNormalized: stanceDelta, compositeVelocity: 0, detectedDirection };
}
