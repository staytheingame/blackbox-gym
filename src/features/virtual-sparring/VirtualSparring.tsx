"use client";

/**
 * SANAL RAKİP — kameraya karşı oynanan dövüş modu.
 *
 * Fight Lab'den farkı: bu bir TEST değil, bir OYUN. Rakip ekranda 3B bir
 * figür olarak duruyor, vuruşunu telegraph ediyor ve sporcu onu ekranda
 * görerek okumak zorunda; can barı, seri ve puan var. Ölçüm tarafı ise aynı
 * kalıyor — tepki süresi ve hata sınıfı `virtualOpponentEngine` ile
 * hesaplanıyor, seans sonunda hata dağılımı raporlanıyor.
 *
 * Tespit motorları yeniden yazılmadı: kamera/pose hattı, onset, combo ve
 * defense tespiti camera-fight-lab'den olduğu gibi kullanılıyor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { beep, initAudio, isMuted, releaseAudio, setMuted, speak, stopSpeaking } from "@/lib/audio/voice";
import { SoundControls } from "@/components/ui/SoundControls";
import { cameraErrorMessage, openCamera, stopCamera } from "../camera-fight-lab/cameraManager";
import { cueSpeech } from "../camera-fight-lab/audioCues";
import { VideoFrameScheduler } from "../camera-fight-lab/frameScheduler";
import { HeadMotionTracker } from "../camera-fight-lab/headMotion";
import { PoseClient } from "../camera-fight-lab/poseClient";
import { createProtocolTrial } from "../camera-fight-lab/protocols";
import { headNeutralDisplayPoint, scaleTarget } from "../camera-fight-lab/trialGenerator";
import type {
  CalibrationSnapshot,
  CameraSnapshot,
  PoseSample,
  TargetSnapshot,
  TrialStimulus,
  VirtualOpponentTimeline,
  VirtualOpponentTrialResult,
} from "../camera-fight-lab/types";
import { WristMotionTracker } from "../camera-fight-lab/velocity";
import {
  buildVirtualOpponentTimeline,
  VirtualOpponentTracker,
} from "../camera-fight-lab/virtualOpponentEngine";
import { attackSideForStimulus, choreographyFrame } from "./choreography";
import {
  evaluateGameCalibration,
  type GameCalibrationState,
} from "./gameCalibration";
import {
  applyExchange,
  duelVerdict,
  DUEL_CONFIG,
  INITIAL_DUEL_STATE,
  MISTAKE_ADVICE,
  MISTAKE_LABELS,
  resolveExchange,
  summarizeDuel,
  type DuelExchange,
  type DuelState,
} from "./duelEngine";
import {
  cameraForScreenPoint,
  idlePose,
  opponentPose,
  type AttackSide,
} from "./opponentRig";
import { renderOpponentScene, type SceneFeedback } from "./opponentRenderer";

type Phase =
  | "intro"
  | "permission"
  | "calibration"
  | "countdown"
  | "fighting"
  | "result"
  | "error";

export type SparringDifficulty = "kolay" | "normal" | "zor";

const DIFFICULTY_LABELS: Record<SparringDifficulty, string> = {
  kolay: "Kolay",
  normal: "Normal",
  zor: "Zor",
};

const DIFFICULTY_HINTS: Record<SparringDifficulty, string> = {
  kolay: "Rakip yavaş yüklenir, okumak için bol zaman var.",
  normal: "Tempo her alışverişte rastgele değişir.",
  zor: "Rakip en hızlı tempoda çalışır — yüklenmeyi ilk karede yakalaman gerekir.",
};

/** Zorluk → tempo seviyesi. 1 en hızlı, 3 en yavaş (bkz. performanceConfig.phase4). */
const DIFFICULTY_TEMPO: Record<SparringDifficulty, 1 | 2 | 3 | null> = {
  kolay: 3,
  normal: null, // rastgele
  zor: 1,
};

/**
 * Geri bildirim modu — komutlar hangi kanaldan geliyor.
 *   "both"   : ekranda cue metni + sesli komut (varsayılan).
 *   "audio"  : yalnızca sesli komut; ekrandaki cue/sonuç metni gizlenir —
 *              kulağına güvenmen gerekir (rakip figürü ve hedef halkası
 *              yine görünür, yoksa nereye vuracağını göremezsin).
 *   "visual" : ses tamamen kapalı (paylaşılan sustur ayarını kullanır);
 *              komutlar yalnızca ekranda yazar.
 */
export type FeedbackMode = "both" | "audio" | "visual";

const FEEDBACK_MODE_LABELS: Record<FeedbackMode, string> = {
  both: "Ses + Görsel",
  audio: "Sadece Ses",
  visual: "Sadece Görsel",
};

const FEEDBACK_MODE_SHORT_LABELS: Record<FeedbackMode, string> = {
  both: "İkisi",
  audio: "Ses",
  visual: "Görsel",
};

const FEEDBACK_MODE_HINTS: Record<FeedbackMode, string> = {
  both: "Komutlar hem sesli okunur hem ekranda yazar; rakibin saldırısı ayrı bir efektle duyulur.",
  audio: "Komutlar yalnızca sesli okunur, ekranda cue metni yazmaz — kulağına güven. Rakip ve hedef halkası yine görünür.",
  visual: "Ses tamamen kapalı — komutlar yalnızca ekranda yazar.",
};

const FEEDBACK_MODE_KEY = "blackbox.sanalRakip.feedbackMode";

/** "visual" paylaşılan sustur bayrağından türer; "audio"/"both" ayrı saklanır. */
function loadStoredFeedbackMode(): "both" | "audio" {
  try {
    return window.localStorage.getItem(FEEDBACK_MODE_KEY) === "audio" ? "audio" : "both";
  } catch {
    return "both";
  }
}

function initialFeedbackMode(): FeedbackMode {
  if (typeof window === "undefined") return "both";
  return isMuted() ? "visual" : loadStoredFeedbackMode();
}

/** Alışverişler arası nefes payı. */
const EXCHANGE_GAP_MS = 900;
const FEEDBACK_MS = 850;
const MAX_EXCHANGES = 24;

type ExchangeRuntime = {
  index: number;
  stimulus: TrialStimulus;
  target: TargetSnapshot;
  timeline: VirtualOpponentTimeline;
  tracker: VirtualOpponentTracker;
  side: AttackSide;
  t0Ms: number;
  resolvedAtMs: number | null;
  playerWon: boolean;
  /** COMMIT anında saldırı sesi bir kez çalınsın. */
  commitSoundPlayed: boolean;
};

export function VirtualSparring() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [difficulty, setDifficulty] = useState<SparringDifficulty>("normal");
  const [feedbackMode, setFeedbackModeState] = useState<FeedbackMode>("both");
  const [error, setError] = useState<string | null>(null);
  const [calibrationState, setCalibrationState] = useState<GameCalibrationState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [duel, setDuel] = useState<DuelState>(INITIAL_DUEL_STATE);
  const [exchanges, setExchanges] = useState<DuelExchange[]>([]);
  const [lastExchange, setLastExchange] = useState<DuelExchange | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseClientRef = useRef<PoseClient | null>(null);
  const schedulerRef = useRef<VideoFrameScheduler | null>(null);
  const bootingRef = useRef(false);

  const phaseRef = useRef<Phase>("intro");
  const calibrationRef = useRef<CalibrationSnapshot | null>(null);
  const cameraRef = useRef<CameraSnapshot | null>(null);
  const poseSamplesRef = useRef<PoseSample[]>([]);
  const leftTrackerRef = useRef(new WristMotionTracker("left"));
  const rightTrackerRef = useRef(new WristMotionTracker("right"));
  const headTrackerRef = useRef(new HeadMotionTracker());
  const exchangeRef = useRef<ExchangeRuntime | null>(null);
  /** Üretilen cue'lar — aynı saldırının üst üste gelmemesi için motora geri verilir. */
  const previousStimuliRef = useRef<TrialStimulus[]>([]);
  const duelRef = useRef<DuelState>(INITIAL_DUEL_STATE);
  const exchangesRef = useRef<DuelExchange[]>([]);
  const feedbackRef = useRef<SceneFeedback>(null);
  /** Rakibin vuruşu indiğinde ekranı sarsan/kızartan darbe anı. */
  const impactAtRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const nextExchangeTimerRef = useRef<number | null>(null);
  /** Kalibrasyon ekranına girildiği an — "yine de başla" iznini zamanlar. */
  const calibrationStartedAtRef = useRef(0);
  const renderFrameRef = useRef<number | null>(null);
  /** Çizim döngüsü ref'ten okur — state, o kapanışta güncel görünmez. */
  const feedbackModeRef = useRef<FeedbackMode>("both");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);
  useEffect(() => {
    feedbackModeRef.current = feedbackMode;
  }, [feedbackMode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedbackModeState(initialFeedbackMode());
  }, []);

  /** Geri bildirim modu değişince paylaşılan sustur bayrağını da senkronlar. */
  const changeFeedbackMode = useCallback((next: FeedbackMode) => {
    setFeedbackModeState(next);
    setMuted(next === "visual");
    if (next !== "visual") {
      try {
        window.localStorage.setItem(FEEDBACK_MODE_KEY, next);
      } catch {
        /* localStorage kapalı olabilir — mod yine de bu oturumda geçerli kalır */
      }
    }
  }, []);

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

  useEffect(
    () => () => {
      stopPipeline();
      releaseAudio();
      if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
      if (nextExchangeTimerRef.current !== null) window.clearTimeout(nextExchangeTimerRef.current);
    },
    [stopPipeline],
  );

  // ── Alışveriş akışı ─────────────────────────────────────────

  const finishDuel = useCallback(() => {
    exchangeRef.current = null;
    if (nextExchangeTimerRef.current !== null) {
      window.clearTimeout(nextExchangeTimerRef.current);
      nextExchangeTimerRef.current = null;
    }
    beep("finish");
    const verdict = duelVerdict(duelRef.current);
    speak(
      verdict === "PLAYER_WIN"
        ? "Rakibi düşürdün."
        : verdict === "OPPONENT_WIN"
          ? "Nakavt oldun."
          : "Düello bitti.",
      { rate: 1 },
    );
    setPhase("result");
  }, []);

  const startExchange = useCallback(() => {
    const calibration = calibrationRef.current;
    const canvas = canvasRef.current;
    if (!calibration || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    const generated = createProtocolTrial({
      protocolId: "virtual-opponent",
      calibration,
      canvas: size,
      previousZoneIndex: exchangeRef.current?.target.zoneIndex ?? null,
      previousStimuli: previousStimuliRef.current,
    });

    const forcedTempo = DIFFICULTY_TEMPO[difficulty];
    const tempoLevel = forcedTempo ?? generated.stimulus.virtualOpponentTempoLevel ?? 2;
    const stimulus: TrialStimulus = {
      ...generated.stimulus,
      virtualOpponentTempoLevel: tempoLevel,
    };
    previousStimuliRef.current = [...previousStimuliRef.current, stimulus].slice(-4);

    const now = performance.now();
    const timeline = buildVirtualOpponentTimeline(now, tempoLevel);
    const tracker = new VirtualOpponentTracker(
      stimulus.virtualOpponentAttackType ?? "PUNCH_COMBO",
      stimulus.virtualOpponentResponseChannel ?? "COUNTER",
      stimulus.virtualOpponentResponseChannel === "DEFEND"
        ? (stimulus.defenseAction ?? "DUCK")
        : (stimulus.comboSequence ?? ["left"]),
      now,
      tempoLevel,
      timeline,
      calibration.shoulderWidthNormalized,
    );

    exchangeRef.current = {
      index: exchangesRef.current.length,
      stimulus,
      target: generated.target,
      timeline,
      tracker,
      side: attackSideForStimulus(stimulus),
      t0Ms: now,
      resolvedAtMs: null,
      playerWon: false,
      commitSoundPlayed: false,
    };
    feedbackRef.current = null;
    beep("attack");
    const phrase = cueSpeech(stimulus);
    if (phrase) speak(phrase, { rate: 1.2 });
  }, [difficulty]);

  const scheduleNextExchange = useCallback(
    (delayMs: number) => {
      if (nextExchangeTimerRef.current !== null) {
        window.clearTimeout(nextExchangeTimerRef.current);
      }
      nextExchangeTimerRef.current = window.setTimeout(() => {
        nextExchangeTimerRef.current = null;
        if (phaseRef.current !== "fighting") return;
        feedbackRef.current = null;
        startExchange();
      }, delayMs);
    },
    [startExchange],
  );

  const completeExchange = useCallback(
    (runtime: ExchangeRuntime, result: VirtualOpponentTrialResult) => {
      const resolved = resolveExchange(
        {
          index: runtime.index,
          attackType: result.attackType,
          responseChannel: result.responseChannel,
          outcome: result.outcome,
          reactionMs: result.reactionMs,
          responseTimeMs: result.responseTimeMs,
          beatDeadlineMarginMs: result.beatDeadlineMarginMs,
        },
        duelRef.current,
      );

      runtime.resolvedAtMs = performance.now();
      runtime.playerWon = resolved.mistake === null;

      const nextState = applyExchange(duelRef.current, resolved);
      duelRef.current = nextState;
      exchangesRef.current = [...exchangesRef.current, resolved];
      setDuel(nextState);
      setExchanges(exchangesRef.current);
      setLastExchange(resolved);

      if (resolved.mistake === null) {
        beep("hit");
        feedbackRef.current = {
          text: `TEMİZ · ${Math.round(resolved.reactionMs ?? 0)} ms`,
          tone: "hit",
        };
        speak(nextState.combo >= 3 ? `${nextState.combo} seri` : "Temiz", { rate: 1.2 });
      } else {
        beep(resolved.mistake === "WRONG" ? "wrong" : "impact");
        // Yanlış yanıt "ıskaladın"; geç kalma/yanıtsızlık ise rakibin vuruşunun
        // İNMESİ demek — sarsıntı yalnızca gerçekten yediğin darbede olmalı.
        if (resolved.mistake !== "WRONG") impactAtRef.current = performance.now();
        feedbackRef.current = {
          text: MISTAKE_LABELS[resolved.mistake].toLocaleUpperCase("tr-TR"),
          tone: resolved.mistake === "WRONG" ? "wrong" : "miss",
        };
        speak(MISTAKE_LABELS[resolved.mistake], { rate: 1.15 });
      }

      const finished =
        duelVerdict(nextState) !== null || exchangesRef.current.length >= MAX_EXCHANGES;
      if (finished) {
        window.setTimeout(() => {
          if (phaseRef.current === "fighting") finishDuel();
        }, FEEDBACK_MS);
        return;
      }
      scheduleNextExchange(FEEDBACK_MS + EXCHANGE_GAP_MS);
    },
    [finishDuel, scheduleNextExchange],
  );

  // ── Pose hattı ──────────────────────────────────────────────

  /** Kalibrasyonu kabul edip geri sayıma geç — hem otomatik hem elle geçişte. */
  const acceptCalibration = useCallback((snapshot: CalibrationSnapshot) => {
    if (calibrationRef.current) return;
    calibrationRef.current = snapshot;
    leftTrackerRef.current.reset();
    rightTrackerRef.current.reset();
    setCountdown(3);
    setPhase("countdown");
  }, []);


  const handlePoseSample = useCallback(
    (sample: PoseSample) => {
      poseSamplesRef.current.push(sample);
      const cutoff = sample.timestampMs - 6_000;
      while (poseSamplesRef.current.length > 0 && poseSamplesRef.current[0].timestampMs < cutoff) {
        poseSamplesRef.current.shift();
      }

      const canvas = canvasRef.current;
      const canvasSize = canvas
        ? { width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) }
        : { width: cameraRef.current?.width ?? 1, height: cameraRef.current?.height ?? 1 };

      const calibration = calibrationRef.current;
      const left = leftTrackerRef.current.update(sample, calibration, canvasSize);
      const right = rightTrackerRef.current.update(sample, calibration, canvasSize);
      const head = headTrackerRef.current.update(
        sample,
        calibration?.headNeutralWorld ?? null,
        canvasSize,
      );
      if (phaseRef.current === "calibration" && cameraRef.current) {
        const state = evaluateGameCalibration({
          samples: poseSamplesRef.current,
          camera: cameraRef.current,
          nowMs: sample.timestampMs,
          elapsedMs: performance.now() - calibrationStartedAtRef.current,
        });
        setCalibrationState(state);
        if (state.ready && state.snapshot && !calibrationRef.current) {
          acceptCalibration(state.snapshot);
        }
        return;
      }

      const runtime = exchangeRef.current;
      if (!runtime || runtime.resolvedAtMs !== null || !calibration) return;

      const result = runtime.tracker.update({
        left,
        right,
        head,
        target: scaleTarget(runtime.target, canvasSize),
        neutralDisplay: headNeutralDisplayPoint(calibration, canvasSize),
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
      });
      if (result) completeExchange(runtime, result);
    },
    [acceptCalibration, completeExchange],
  );

  const bootPipeline = useCallback(async () => {
    if (bootingRef.current) return;
    bootingRef.current = true;
    try {
      const session = await openCamera();
      streamRef.current = session.stream;
      cameraRef.current = session.snapshot;
      const video = videoRef.current;
      if (!video) throw new Error("Kamera önizlemesi hazırlanamadı.");
      video.srcObject = session.stream;
      await video.play();

      const poseClient = new PoseClient();
      poseClientRef.current = poseClient;
      await poseClient.initialize(handlePoseSample, () => undefined);
      const scheduler = new VideoFrameScheduler(video, (timestampMs) => {
        void poseClient.processFrame(video, timestampMs);
      });
      schedulerRef.current = scheduler;
      scheduler.start();
      calibrationStartedAtRef.current = performance.now();
      setPhase("calibration");
    } catch (caught) {
      stopPipeline();
      setError(cameraErrorMessage(caught));
      setPhase("error");
    } finally {
      bootingRef.current = false;
    }
  }, [handlePoseSample, stopPipeline]);

  useEffect(() => {
    if (phase !== "permission") return;
    const frame = requestAnimationFrame(() => void bootPipeline());
    return () => cancelAnimationFrame(frame);
  }, [bootPipeline, phase]);

  // Geri sayım → ilk alışveriş.
  useEffect(() => {
    if (phase !== "countdown") return;
    beep("tick");
    const timer = window.setInterval(() => {
      const next = (countdownRef.current ?? 1) - 1;
      countdownRef.current = next;
      setCountdown(next > 0 ? next : 0);
      if (next > 0) {
        beep("tick");
        return;
      }
      window.clearInterval(timer);
      beep("go");
      setCountdown(null);
      setPhase("fighting");
    }, 800);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fighting") return;
    startExchange();
    return () => {
      if (nextExchangeTimerRef.current !== null) {
        window.clearTimeout(nextExchangeTimerRef.current);
        nextExchangeTimerRef.current = null;
      }
    };
    // startExchange difficulty'ye bağlı; düello ortasında zorluk değişmiyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Çizim döngüsü ───────────────────────────────────────────

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const now = performance.now();
        const runtime = exchangeRef.current;
        const active = phaseRef.current === "fighting" && runtime !== null;

        // Yanıt gelmezse dış grace penceresi burada kapatılır — pose akışı
        // kesilse bile alışveriş asılı kalmasın (Fight Lab'deki dış timeout
        // güvenlik ağının aynısı).
        if (runtime && runtime.resolvedAtMs === null) {
          const timedOut =
            runtime.tracker.checkDeadline(now) ??
            (now - runtime.t0Ms > PERFORMANCE_CONFIG.phase4.virtualOpponentSafetyTimeoutMs
              ? runtime.tracker.finishExternally(now)
              : null);
          if (timedOut) completeExchange(runtime, timedOut);
        }

        const frame =
          active && runtime !== null
            ? choreographyFrame({
                nowMs: now,
                cueStartMs: runtime.t0Ms,
                attackCommitMs: runtime.timeline.attackCommitMs,
                attackLandMs: runtime.timeline.attackLandMs,
                resolvedAtMs: runtime.resolvedAtMs,
                playerWon: runtime.playerWon,
              })
            : null;

        if (runtime && frame?.action === "COMMIT" && !runtime.commitSoundPlayed) {
          runtime.commitSoundPlayed = true;
          beep("attack");
        }

        const size = { width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) };
        const counterChannel = runtime?.stimulus.virtualOpponentResponseChannel === "COUNTER";
        // Darbe 320 ms içinde sönümlenir.
        const impactAge = impactAtRef.current === null ? Infinity : now - impactAtRef.current;
        const impact = impactAge < 320 ? 1 - impactAge / 320 : 0;
        if (impact === 0) impactAtRef.current = null;
        const scaledTarget = runtime ? scaleTarget(runtime.target, size) : null;
        // "Sadece ses" modunda cue/sonuç metni ekrana sızmaz — kulağa güvenilir.
        const hideTextCue = feedbackModeRef.current === "audio";

        renderOpponentScene(canvas, {
          pose:
            frame && runtime
              ? opponentPose(frame.action, frame.progress, runtime.side, now)
              : idlePose(now),
          action: frame?.action ?? "IDLE",
          threat: frame?.threat ?? 0,
          cueLabel:
            !hideTextCue && active && runtime && runtime.resolvedAtMs === null
              ? runtime.stimulus.cueLabel
              : null,
          cueColor: runtime?.stimulus.cueColor ?? "#f5c400",
          feedback: hideTextCue ? null : feedbackRef.current,
          countdown: phaseRef.current === "countdown" ? (countdownRef.current ?? 0) : null,
          camera:
            counterChannel && scaledTarget
              ? cameraForScreenPoint({ x: scaledTarget.displayX, y: scaledTarget.displayY }, size)
              : undefined,
          flash: impact,
          shake: impact * 9,
          target:
            counterChannel && scaledTarget && runtime?.resolvedAtMs === null
              ? {
                  x: scaledTarget.displayX,
                  y: scaledTarget.displayY,
                  radius: scaledTarget.radiusPx,
                }
              : null,
        });
      }
      renderFrameRef.current = requestAnimationFrame(loop);
    };
    // İlk kare rAF beklenmeden çizilir: sekme arka plandayken veya tarayıcı
    // kareleri kıstığında canvas boş kalmasın.
    loop();
    return () => {
      if (renderFrameRef.current !== null) cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
    };
  }, [completeExchange]);

  // ── Eylemler ────────────────────────────────────────────────

  const startFight = () => {
    // ★ Kullanıcı hareketi — ses motorları yalnızca burada açılabilir.
    initAudio();
    speak("Sanal rakip hazır");
    duelRef.current = INITIAL_DUEL_STATE;
    exchangesRef.current = [];
    exchangeRef.current = null;
    previousStimuliRef.current = [];
    feedbackRef.current = null;
    impactAtRef.current = null;
    calibrationRef.current = null;
    poseSamplesRef.current = [];
    setDuel(INITIAL_DUEL_STATE);
    setExchanges([]);
    setLastExchange(null);
    setError(null);
    setPhase("permission");
  };

  const quit = () => {
    stopPipeline();
    stopSpeaking();
    exchangeRef.current = null;
    setPhase("intro");
  };

  const report = summarizeDuel(exchanges);
  const verdict = duelVerdict(duel);

  if (phase === "intro") {
    return (
      <IntroScreen
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        feedbackMode={feedbackMode}
        onFeedbackModeChange={changeFeedbackMode}
        onStart={startFight}
      />
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto min-h-[70vh] max-w-3xl px-5 py-16 text-white">
        <section className="rounded-3xl border border-red-400/30 bg-red-950/25 p-8">
          <p className="text-xs font-black uppercase tracking-[.28em] text-red-300">Sanal Rakip</p>
          <h1 className="font-display mt-3 text-4xl uppercase">Dövüş başlatılamadı</h1>
          <p className="mt-4 text-zinc-300">{error}</p>
          <button
            type="button"
            onClick={() => setPhase("intro")}
            className="mt-7 rounded-xl bg-brand-yellow px-6 py-3 text-xs font-black uppercase tracking-wider text-black"
          >
            Geri Dön
          </button>
        </section>
      </main>
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        report={report}
        verdict={verdict}
        duel={duel}
        onRestart={startFight}
        onQuit={quit}
      />
    );
  }

  return (
    <main className="mx-auto min-h-[86vh] max-w-7xl px-4 py-6 text-white sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.26em] text-brand-yellow">
            BlackBox · Sanal Rakip
          </p>
          <h1 className="font-display text-3xl uppercase">
            {DIFFICULTY_LABELS[difficulty]} tempo
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FeedbackModeSwitch mode={feedbackMode} onChange={changeFeedbackMode} compact />
          <button
            type="button"
            onClick={quit}
            className="rounded-xl border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-zinc-400 hover:border-red-400 hover:text-red-300"
          >
            Çık
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,.7fr)]">
        <section className="relative aspect-video overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="h-full w-full scale-x-[-1] object-cover opacity-70"
            muted
            playsInline
            aria-label="Sanal Rakip kamera önizlemesi"
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-label="Sanal rakip sahnesi"
          />
          {phase === "permission" && (
            <div className="absolute inset-0 grid place-items-center bg-black/80 text-center">
              <p className="text-sm font-bold uppercase tracking-wide">
                Kamera ve pose motoru hazırlanıyor…
              </p>
            </div>
          )}
          {phase === "calibration" && (
            <CalibrationOverlay
              state={calibrationState}
              onForce={() => {
                if (calibrationState?.snapshot) acceptCalibration(calibrationState.snapshot);
              }}
            />
          )}
        </section>

        <aside className="space-y-4">
          <HealthPanel duel={duel} exchangeCount={exchanges.length} />
          <LastExchangePanel exchange={lastExchange} />
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-xs leading-5 text-zinc-400">
            Rakip vurmadan ÖNCE ekrandaki komutu tamamla. Kontra istiyorsa sarı
            halkaya doğru elinle vur; savunma istiyorsa başını komuttaki yöne
            kaydır ya da çömel. Rakibin omzu geri gittiği an hareket başlasın.
          </div>
        </aside>
      </div>
    </main>
  );
}

/** Üç kademeli geri bildirim anahtarı — ses/görsel kombinasyonunu seçtirir. */
function FeedbackModeSwitch({
  mode,
  onChange,
  compact = false,
  className = "",
}: {
  mode: FeedbackMode;
  onChange: (mode: FeedbackMode) => void;
  compact?: boolean;
  className?: string;
}) {
  const modes: FeedbackMode[] = ["both", "audio", "visual"];
  return (
    <div
      role="group"
      aria-label="Geri bildirim modu"
      title={FEEDBACK_MODE_HINTS[mode]}
      className={`flex overflow-hidden rounded-lg border border-white/15 ${className}`}
    >
      {modes.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            // Kullanıcı hareketi — ses motorları yalnızca burada açılabilir.
            if (value !== "visual") initAudio();
            onChange(value);
          }}
          aria-pressed={mode === value}
          className={`font-black uppercase tracking-wider transition ${
            compact ? "px-2.5 py-2 text-[10px]" : "px-3 py-2 text-xs"
          } ${
            mode === value
              ? "bg-brand-yellow text-black"
              : "bg-white/[.04] text-zinc-400 hover:text-white"
          }`}
        >
          {compact ? FEEDBACK_MODE_SHORT_LABELS[value] : FEEDBACK_MODE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}

/**
 * Kalibrasyon paneli. Eski sürüm yalnızca "%x" ve bir hata cümlesi
 * gösteriyordu; kullanıcı neyin eksik olduğunu göremediği için ekranda
 * takılıyordu. Artık her koşul tek tek işaretli ve takılma hâlinde elle
 * geçiş açılıyor.
 */
function CalibrationOverlay({
  state,
  onForce,
}: {
  state: GameCalibrationState | null;
  onForce: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-black/80 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.22em] text-brand-yellow">
          Hazırlık · %{state?.progressPct ?? 0}
        </p>
        {state?.canForce && (
          <button
            type="button"
            onClick={onForce}
            className="rounded-lg border border-brand-yellow px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-brand-yellow hover:bg-brand-yellow hover:text-black"
          >
            Yine de başla
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-brand-yellow transition-all"
          style={{ width: `${state?.progressPct ?? 0}%` }}
        />
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {(state?.checks ?? []).map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs">
            <span className={item.ok ? "text-emerald-400" : "text-zinc-600"}>
              {item.ok ? "✓" : "○"}
            </span>
            <span className={item.ok ? "text-zinc-400" : "text-zinc-200"}>
              {item.label}
              {!item.ok && item.hint ? ` — ${item.hint}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntroScreen({
  difficulty,
  onDifficulty,
  feedbackMode,
  onFeedbackModeChange,
  onStart,
}: {
  difficulty: SparringDifficulty;
  onDifficulty: (value: SparringDifficulty) => void;
  feedbackMode: FeedbackMode;
  onFeedbackModeChange: (value: FeedbackMode) => void;
  onStart: () => void;
}) {
  return (
    <main className="mx-auto min-h-[80vh] max-w-4xl px-5 py-14 text-white">
      <p className="text-xs font-black uppercase tracking-[.28em] text-brand-yellow">
        BlackBox · Oyun Modu
      </p>
      <h1 className="font-display mt-3 text-5xl uppercase">Sanal Rakip</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-zinc-300">
        Karşındaki 3B rakip sana saldırıyor. Vuruşunu yüklenme anından oku,
        rakip vurmadan önce doğru yanıtı tamamla. Her alışverişte tepki süren
        ve hatan kaydediliyor; seans sonunda en sık hatan ve en zayıf kanalın
        çıkıyor. Görüntü cihazından çıkmaz.
      </p>

      <OpponentPreview />

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-6">
        <p className="text-xs font-black uppercase tracking-[.22em] text-zinc-500">Zorluk</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(Object.keys(DIFFICULTY_LABELS) as SparringDifficulty[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onDifficulty(value)}
              aria-pressed={difficulty === value}
              className={`rounded-2xl border p-4 text-left transition ${
                difficulty === value
                  ? "border-brand-yellow bg-brand-yellow/10"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <strong className="font-display block text-xl uppercase">
                {DIFFICULTY_LABELS[value]}
              </strong>
              <span className="mt-2 block text-xs leading-5 text-zinc-400">
                {DIFFICULTY_HINTS[value]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-xs font-black uppercase tracking-[.22em] text-zinc-500">
            Geri bildirim
          </p>
          <FeedbackModeSwitch mode={feedbackMode} onChange={onFeedbackModeChange} className="mt-3" />
          {feedbackMode !== "visual" && (
            // Ses açıkken hangi Türkçe sesin okuyacağını seçtirir — sustur
            // düğmesi burada gereksiz, yukarıdaki anahtar onun yerini tutuyor.
            <SoundControls muted={false} onMutedChange={() => {}} hideMuteButton className="mt-3" />
          )}
          <p className="mt-2 text-xs text-zinc-500">{FEEDBACK_MODE_HINTS[feedbackMode]}</p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-7 w-full rounded-2xl bg-brand-yellow px-6 py-4 text-sm font-black uppercase tracking-wider text-black hover:bg-white"
        >
          Kamerayı Aç ve Dövüşe Başla
        </button>
      </section>
    </main>
  );
}

/**
 * Giriş ekranındaki canlı önizleme: rakip kamera izni istenmeden önce
 * görünsün — kullanıcı neye "evet" dediğini bilerek izin versin. Aynı zamanda
 * bir demo döngüsü çalıştırır (yüklen → vur → geri çekil).
 */
function OpponentPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const CYCLE_MS = 4_200;
    const loop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const now = performance.now();
        const phaseMs = (now - startedAt) % CYCLE_MS;
        const demo = choreographyFrame({
          nowMs: phaseMs,
          cueStartMs: 1_400,
          attackCommitMs: 2_200,
          attackLandMs: 3_000,
          resolvedAtMs: phaseMs > 3_000 ? 3_000 : null,
          playerWon: true,
        });
        const idling = phaseMs < 1_400;
        renderOpponentScene(canvas, {
          pose: idling ? idlePose(now) : opponentPose(demo.action, demo.progress, "right", now),
          action: idling ? "IDLE" : demo.action,
          threat: idling ? 0 : demo.threat,
          cueLabel: idling ? null : "SOLA SLIP",
          cueColor: "#ef4444",
          feedback: null,
          countdown: null,
          target: null,
        });
      }
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 to-black">
      <canvas
        ref={canvasRef}
        className="aspect-video h-full w-full"
        aria-label="Sanal rakip önizlemesi"
      />
      <p className="border-t border-white/10 px-5 py-3 text-xs text-zinc-500">
        Rakip böyle yükleniyor. Omuz geri gittiği an hareket etmen gerekiyor —
        vuruş indikten sonra tepki vermek geç sayılır.
      </p>
    </div>
  );
}

function HealthPanel({ duel, exchangeCount }: { duel: DuelState; exchangeCount: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <HealthBar label="Sen" value={duel.playerHealth} color="bg-brand-yellow" />
      <HealthBar label="Rakip" value={duel.opponentHealth} color="bg-red-500" />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Puan" value={String(duel.score)} />
        <Stat label="Seri" value={`${duel.combo}x`} />
        <Stat label="Alışveriş" value={`${exchangeCount}/${MAX_EXCHANGES}`} />
      </div>
    </div>
  );
}

function HealthBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/60">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${(value / DUEL_CONFIG.startingHealth) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-2 py-2">
      <div className="font-display text-xl">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function LastExchangePanel({ exchange }: { exchange: DuelExchange | null }) {
  if (!exchange) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 text-xs text-zinc-500">
        İlk alışveriş bekleniyor…
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">
        Son alışveriş
      </p>
      <p
        className={`font-display mt-1 text-2xl uppercase ${
          exchange.mistake === null ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {exchange.mistake === null ? "Temiz" : MISTAKE_LABELS[exchange.mistake]}
      </p>
      <dl className="mt-3 space-y-1 text-xs text-zinc-400">
        <div className="flex justify-between">
          <dt>Tepki</dt>
          <dd>{exchange.reactionMs === null ? "—" : `${Math.round(exchange.reactionMs)} ms`}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Vuruşa kalan</dt>
          <dd>
            {exchange.beatDeadlineMarginMs === null
              ? "—"
              : `${Math.round(exchange.beatDeadlineMarginMs)} ms`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Kanal</dt>
          <dd>{exchange.responseChannel === "COUNTER" ? "Kontra" : "Savunma"}</dd>
        </div>
      </dl>
    </div>
  );
}

function ResultScreen({
  report,
  verdict,
  duel,
  onRestart,
  onQuit,
}: {
  report: ReturnType<typeof summarizeDuel>;
  verdict: ReturnType<typeof duelVerdict>;
  duel: DuelState;
  onRestart: () => void;
  onQuit: () => void;
}) {
  const title =
    verdict === "PLAYER_WIN" ? "Rakibi düşürdün" : verdict === "OPPONENT_WIN" ? "Nakavt" : "Süre doldu";

  return (
    <main className="mx-auto min-h-[80vh] max-w-4xl px-5 py-14 text-white">
      <p className="text-xs font-black uppercase tracking-[.28em] text-brand-yellow">
        Sanal Rakip · Sonuç
      </p>
      <h1 className="font-display mt-3 text-5xl uppercase">{title}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResultCard label="Puan" value={String(duel.score)} detail={`En uzun seri ${report.bestCombo}`} />
        <ResultCard
          label="Temiz yanıt"
          value={`%${report.cleanPct}`}
          detail={`${report.cleanCount}/${report.exchanges} alışveriş`}
        />
        <ResultCard
          label="Ortalama tepki"
          value={report.averageReactionMs === null ? "—" : `${report.averageReactionMs} ms`}
          detail={
            report.fastestReactionMs === null
              ? "Temiz yanıt yok"
              : `En hızlı ${report.fastestReactionMs} ms · en yavaş ${report.slowestReactionMs} ms`
          }
        />
        <ResultCard
          label="Vuruşa kalan pay"
          value={report.averageMarginMs === null ? "—" : `${report.averageMarginMs} ms`}
          detail="Ortalama olarak bu kadar erken yetiştin"
        />
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.025] p-6">
        <h2 className="font-display text-2xl uppercase">Hata dağılımı</h2>
        <div className="mt-4 space-y-2">
          {(Object.keys(report.mistakeCounts) as (keyof typeof report.mistakeCounts)[]).map(
            (key) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{MISTAKE_LABELS[key]}</span>
                <span className="font-display text-lg">{report.mistakeCounts[key]}</span>
              </div>
            ),
          )}
        </div>
        {report.topMistake && (
          <p className="mt-5 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 p-4 text-sm leading-6 text-brand-yellow">
            En sık hatan: <strong>{MISTAKE_LABELS[report.topMistake]}</strong>.{" "}
            {MISTAKE_ADVICE[report.topMistake]}
          </p>
        )}
        {report.weakestChannel && (
          <p className="mt-3 text-sm text-zinc-400">
            Zayıf kanal:{" "}
            <strong className="text-zinc-200">
              {report.weakestChannel === "COUNTER" ? "kontra" : "savunma"}
            </strong>{" "}
            — bir sonraki seansta burayı çalış.
          </p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-2xl bg-brand-yellow px-6 py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-white"
        >
          Tekrar Dövüş
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="rounded-2xl border border-white/15 px-6 py-3 text-xs font-black uppercase tracking-wider text-zinc-300 hover:border-white/40"
        >
          Çıkış
        </button>
      </div>
    </main>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">{label}</div>
      <div className="font-display mt-1 text-3xl">{value}</div>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}
