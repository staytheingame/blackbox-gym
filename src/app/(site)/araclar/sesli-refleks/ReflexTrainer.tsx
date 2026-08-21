"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CUES_PER_ROUND_OPTIONS,
  DEFAULT_CUES_PER_ROUND,
  DEFAULT_REST_SEC,
  DEFAULT_ROUND_COUNT,
  DIFFICULTY_LABELS,
  MOVE_BY_ID,
  REACTION_TIMEOUT_MS,
  REST_SEC_OPTIONS,
  ROUND_COUNT_OPTIONS,
  type Difficulty,
  type ReflexMove,
} from "@/domain/reflex/moves";
import {
  analyzeSession,
  pickIntervalMs,
  pickNextMove,
  type ReflexRep,
  type RoundReport,
  type SessionMode,
  type SessionReport,
} from "@/domain/reflex/session";
import {
  averageFeatures,
  detectReaction,
  framesBetween,
  guardUpRatio,
} from "@/domain/reflex/detect";
import {
  beep,
  initAudio,
  isSpeechSupported,
  releaseAudio,
  speak,
  stopSpeaking,
  turkishVoiceAvailable,
} from "@/lib/audio/voice";
import { SoundControls, initialMuted } from "@/components/ui/SoundControls";
import { useReflexCamera, type CameraStatus } from "./useReflexCamera";

type Phase =
  | "idle"
  | "calibrating"
  | "countdown"
  | "cue"
  | "waiting"
  | "rest"
  | "finished";

type Feedback = {
  kind: "hit" | "wrong" | "miss";
  text: string;
};

/** Komut öncesi kaç ms'lik duruş, referans "baseline" olarak alınır. */
const BASELINE_WINDOW_MS = 500;
/** Tepki penceresi kaç ms'de bir değerlendirilir. */
const DETECT_POLL_MS = 60;
/** Kalibrasyon: kişi kaç ms kesintisiz kadrajda kalmalı. */
const CALIBRATION_MS = 1600;

export function ReflexTrainer() {
  const [mode, setMode] = useState<SessionMode>("manuel");
  const [phase, setPhase] = useState<Phase>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("orta");
  const [roundCount, setRoundCount] = useState(DEFAULT_ROUND_COUNT);
  const [cuesPerRound, setCuesPerRound] = useState(DEFAULT_CUES_PER_ROUND);
  const [restSec, setRestSec] = useState(DEFAULT_REST_SEC);

  const [countdown, setCountdown] = useState(3);
  const [restLeft, setRestLeft] = useState(0);
  const [calibrationPct, setCalibrationPct] = useState(0);
  const [currentMove, setCurrentMove] = useState<ReflexMove | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [cueIndex, setCueIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [restReport, setRestReport] = useState<RoundReport | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [muted, setMutedState] = useState(false);
  const [turkishVoiceMissing, setTurkishVoiceMissing] = useState(false);

  const {
    videoRef,
    canvasRef,
    framesRef,
    status: cameraStatus,
    error: cameraError,
    personVisible,
    setTone,
    resetBuffer,
  } = useReflexCamera(mode === "kamera");

  const phaseRef = useRef<Phase>("idle");
  const modeRef = useRef<SessionMode>("manuel");
  const repsRef = useRef<ReflexRep[]>([]);
  const roundIndexRef = useRef(0);
  const cueIndexRef = useRef(0);
  const currentMoveRef = useRef<ReflexMove | null>(null);
  const cueStartRef = useRef(0);
  const lastMoveIdRef = useRef<string | null>(null);
  const baselineRef = useRef<ReturnType<typeof averageFeatures>>(null);
  const pendingGuardRef = useRef<number | null>(null);
  const waitStartRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    // Yalnızca tarayıcıda bilinebilen yetenek kontrolleri.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSpeechSupported(isSpeechSupported());
    setMutedState(initialMuted());
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      releaseAudio();
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // --- Seans akışı ---

  const finishSession = useCallback(() => {
    clearTimers();
    setTone("idle");
    stopSpeaking();
    beep("finish");
    setReport(analyzeSession(repsRef.current, modeRef.current));
    setPhase("finished");
  }, [clearTimers, setTone]);

  const issueNextCue = useCallback(() => {
    const move = pickNextMove(lastMoveIdRef.current);
    lastMoveIdRef.current = move.id;
    currentMoveRef.current = move;
    setCurrentMove(move);
    setFeedback(null);

    const now = performance.now();
    cueStartRef.current = now;

    if (modeRef.current === "kamera") {
      const frames = framesRef.current;
      baselineRef.current = averageFeatures(
        framesBetween(frames, now - BASELINE_WINDOW_MS, now),
      );
      // Komutlar arası guard disiplini bu tekrara yazılır.
      pendingGuardRef.current =
        waitStartRef.current > 0
          ? guardUpRatio(framesBetween(frames, waitStartRef.current, now))
          : null;
      setTone("cue");
    }

    // Komut hem sesli okunur hem ekranda büyük yazar — ses çalışmazsa
    // (izin yok / Türkçe ses yok) antrenman akışı yine de sürer.
    speak(move.label, { rate: 1.1 });
    setPhase("cue");
  }, [framesRef, setTone]);

  const registerRep = useCallback(
    (rep: ReflexRep) => {
      clearTimers();
      repsRef.current = [...repsRef.current, rep];
      cueIndexRef.current += 1;
      setCueIndex(cueIndexRef.current);

      const roundDone = cueIndexRef.current >= cuesPerRound;
      const sessionDone = roundDone && roundIndexRef.current >= roundCount - 1;

      if (sessionDone) {
        finishSession();
        return;
      }

      if (roundDone) {
        setTone("idle");
        beep("rest");
        const rounds = analyzeSession(repsRef.current, modeRef.current).rounds;
        setRestReport(
          rounds.find((item) => item.roundIndex === roundIndexRef.current) ?? null,
        );
        setRestLeft(restSec);
        setPhase("rest");
        return;
      }

      setPhase("waiting");
      waitStartRef.current = performance.now();
      const delay = pickIntervalMs(difficulty);
      timeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "waiting") issueNextCue();
      }, delay);
    },
    [clearTimers, cuesPerRound, difficulty, finishSession, issueNextCue, restSec, roundCount, setTone],
  );

  /** Kamera modu: komut sonrası pencereyi periyodik olarak değerlendirir. */
  useEffect(() => {
    if (phase !== "cue" || mode !== "kamera") return;
    const move = currentMoveRef.current;
    if (!move) return;

    const cueStart = cueStartRef.current;
    const baseline = baselineRef.current;
    const guard = pendingGuardRef.current;

    pollRef.current = setInterval(() => {
      const now = performance.now();
      const windowFrames = framesBetween(framesRef.current, cueStart, now);
      const result = detectReaction(baseline, windowFrames, move, cueStart);
      const elapsed = now - cueStart;

      if (result.matched) {
        setTone("hit");
        beep("hit");
        setFeedback({
          kind: "hit",
          text: `${move.label} doğrulandı · ${result.onsetMs ?? result.completionMs} ms`,
        });
        registerRep({
          moveId: move.id,
          reactionMs: result.onsetMs ?? result.completionMs ?? Math.round(elapsed),
          completionMs: result.completionMs,
          roundIndex: roundIndexRef.current,
          verified: true,
          confidence: result.confidence,
          guardUpRatio: guard,
        });
        return;
      }

      if (elapsed >= REACTION_TIMEOUT_MS) {
        const moved = result.onsetMs !== null;
        setTone("miss");
        beep(moved ? "wrong" : "miss");
        const wrongLabel = result.detectedMoveId
          ? MOVE_BY_ID.get(result.detectedMoveId)?.label
          : null;
        setFeedback({
          kind: moved ? "wrong" : "miss",
          text: moved
            ? wrongLabel
              ? `Yanlış hamle — kamera "${wrongLabel}" gördü`
              : `${move.label} tamamlanmadı (hareket %${Math.round(result.peakProgress * 100)})`
            : "Hareket algılanmadı",
        });
        registerRep({
          moveId: move.id,
          reactionMs: result.onsetMs ?? 0,
          completionMs: null,
          roundIndex: roundIndexRef.current,
          verified: false,
          detectedMoveId: result.detectedMoveId,
          confidence: result.confidence,
          missed: !moved,
          guardUpRatio: guard,
        });
      }
    }, DETECT_POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [phase, mode, framesRef, registerRep, setTone]);

  /** Manuel mod: butona/boşluğa basınca tepki kaydı. */
  const handleManualReact = useCallback(() => {
    if (phaseRef.current !== "cue" || modeRef.current !== "manuel") return;
    const move = currentMoveRef.current;
    if (!move) return;
    beep("hit");
    registerRep({
      moveId: move.id,
      reactionMs: Math.round(performance.now() - cueStartRef.current),
      roundIndex: roundIndexRef.current,
    });
  }, [registerRep]);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.code === "Space" && phaseRef.current === "cue") {
        event.preventDefault();
        handleManualReact();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [handleManualReact]);

  function startSession() {
    // ★ Kullanıcı hareketi içindeyiz — speechSynthesis ve AudioContext
    //   yalnızca burada açılabilir (iOS/Chrome autoplay kuralı).
    initAudio();
    setTurkishVoiceMissing(isSpeechSupported() && !turkishVoiceAvailable());
    repsRef.current = [];
    roundIndexRef.current = 0;
    cueIndexRef.current = 0;
    lastMoveIdRef.current = null;
    waitStartRef.current = 0;
    pendingGuardRef.current = null;
    setRoundIndex(0);
    setCueIndex(0);
    setReport(null);
    setRestReport(null);
    setFeedback(null);
    setCountdown(3);
    if (mode === "kamera") {
      resetBuffer();
      setCalibrationPct(0);
      setPhase("calibrating");
    } else {
      setPhase("countdown");
    }
  }

  function stopSession() {
    clearTimers();
    stopSpeaking();
    setTone("idle");
    if (repsRef.current.length > 0) {
      setReport(analyzeSession(repsRef.current, mode));
      setPhase("finished");
    } else {
      setPhase("idle");
    }
  }

  // Kalibrasyon: kişi kadrajda kesintisiz kalınca geri sayıma geç.
  useEffect(() => {
    if (phase !== "calibrating") return;
    let held = 0;
    const step = 100;
    const id = setInterval(() => {
      held = personVisible ? held + step : 0;
      setCalibrationPct(Math.min(100, Math.round((held / CALIBRATION_MS) * 100)));
      if (held >= CALIBRATION_MS) {
        clearInterval(id);
        setCountdown(3);
        setPhase("countdown");
      }
    }, step);
    return () => clearInterval(id);
  }, [phase, personVisible]);

  // Geri sayım → ilk komut.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      beep("go");
      waitStartRef.current = 0;
      issueNextCue();
      return;
    }
    beep("tick");
    const id = setTimeout(() => setCountdown((value) => value - 1), 800);
    return () => clearTimeout(id);
  }, [phase, countdown, issueNextCue]);

  // Round arası dinlenme.
  useEffect(() => {
    if (phase !== "rest") return;
    if (restLeft <= 0) {
      roundIndexRef.current += 1;
      cueIndexRef.current = 0;
      setRoundIndex(roundIndexRef.current);
      setCueIndex(0);
      setCountdown(3);
      setPhase("countdown");
      return;
    }
    const id = setTimeout(() => setRestLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, restLeft]);

  const cameraActive = mode === "kamera";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {!speechSupported && (
        <p className="rounded-sm border border-brand-yellow bg-brand-surface-2 px-4 py-3 text-sm text-brand-white">
          Tarayıcın sesli okumayı desteklemiyor gibi görünüyor — hamle adı yine
          de ekranda büyük yazıyla gösterilecek.
        </p>
      )}

      {turkishVoiceMissing && (
        <p className="rounded-sm border border-brand-yellow bg-brand-surface-2 px-4 py-3 text-sm text-brand-white">
          Cihazında Türkçe ses paketi bulunamadı — komutlar aksanlı okunur.
          Aşağıdaki listeden başka bir ses seçebilirsin.
        </p>
      )}

      {cameraActive && (
        <CameraStage
          videoRef={videoRef}
          canvasRef={canvasRef}
          status={cameraStatus}
          error={cameraError}
          personVisible={personVisible}
          phase={phase}
          feedback={feedback}
          calibrationPct={calibrationPct}
        />
      )}

      {phase === "idle" && (
        <div className="space-y-6 rounded-sm border border-brand-border bg-brand-surface p-8">
          <OptionRow label="Ses">
            <SoundControls muted={muted} onMutedChange={setMutedState} />
          </OptionRow>

          <OptionRow label="Mod">
            <ToggleButton
              active={mode === "manuel"}
              onClick={() => setMode("manuel")}
              label="Manuel"
            />
            <ToggleButton
              active={mode === "kamera"}
              onClick={() => setMode("kamera")}
              label="Kamera (Doğrulamalı)"
            />
          </OptionRow>

          {cameraActive && (
            <p className="rounded-sm border border-brand-border bg-brand-surface-2 px-4 py-3 text-xs text-brand-muted">
              Kamera modunda tepki süresi butona basışla değil, iskeletteki ilk
              hareketle ölçülür; hamlenin doğru yapılıp yapılmadığı eklem
              konumlarından doğrulanır. Görüntü cihazından çıkmaz, hiçbir
              sunucuya gönderilmez.
            </p>
          )}

          <OptionRow label="Zorluk">
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((level) => (
              <ToggleButton
                key={level}
                active={difficulty === level}
                onClick={() => setDifficulty(level)}
                label={DIFFICULTY_LABELS[level]}
              />
            ))}
          </OptionRow>

          <OptionRow label="Round sayısı">
            {ROUND_COUNT_OPTIONS.map((count) => (
              <ToggleButton
                key={count}
                active={roundCount === count}
                onClick={() => setRoundCount(count)}
                label={`${count}`}
              />
            ))}
          </OptionRow>

          <OptionRow label="Round başına komut">
            {CUES_PER_ROUND_OPTIONS.map((count) => (
              <ToggleButton
                key={count}
                active={cuesPerRound === count}
                onClick={() => setCuesPerRound(count)}
                label={`${count}`}
              />
            ))}
          </OptionRow>

          <OptionRow label="Round arası dinlenme (sn)">
            {REST_SEC_OPTIONS.map((sec) => (
              <ToggleButton
                key={sec}
                active={restSec === sec}
                onClick={() => setRestSec(sec)}
                label={`${sec}`}
              />
            ))}
          </OptionRow>

          <button
            type="button"
            onClick={startSession}
            disabled={cameraActive && cameraStatus !== "ready"}
            className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cameraActive && cameraStatus !== "ready"
              ? "Kamera hazırlanıyor…"
              : "Başlat"}
          </button>
        </div>
      )}

      {phase === "calibrating" && (
        <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-brand-white">
            Kalibrasyon
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            Tüm gövden kadraja girsin, guard&apos;ını al ve sabit dur.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-black">
            <div
              className="h-full bg-brand-yellow transition-all"
              style={{ width: `${calibrationPct}%` }}
            />
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="flex h-56 flex-col items-center justify-center rounded-sm border border-brand-border bg-brand-surface">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Round {roundIndex + 1} / {roundCount}
          </span>
          <span className="font-display text-7xl text-brand-yellow">
            {countdown > 0 ? countdown : "GİT!"}
          </span>
        </div>
      )}

      {(phase === "cue" || phase === "waiting") && (
        <div className="space-y-4">
          <div className="flex h-44 flex-col items-center justify-center rounded-sm border border-brand-yellow bg-brand-surface-2 text-center">
            {phase === "cue" ? (
              <>
                <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Hamle
                </span>
                <span className="font-display mt-2 text-4xl uppercase text-brand-white">
                  {currentMove?.label}
                </span>
              </>
            ) : (
              <span className="text-sm font-bold uppercase tracking-wide text-brand-muted">
                Hazır ol…
              </span>
            )}
          </div>

          {mode === "manuel" ? (
            <button
              type="button"
              onClick={handleManualReact}
              disabled={phase !== "cue"}
              className="w-full rounded-sm bg-brand-yellow px-4 py-4 text-lg font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tepki Ver (Boşluk)
            </button>
          ) : (
            <p className="text-center text-xs text-brand-muted">
              Hamleyi gerçekten yap — kamera eklem hareketinden ölçüyor.
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-brand-muted">
            <span>
              Round {roundIndex + 1}/{roundCount} · Komut {cueIndex}/{cuesPerRound}
            </span>
            <button
              type="button"
              onClick={stopSession}
              className="font-bold uppercase tracking-wide hover:text-brand-yellow"
            >
              Durdur
            </button>
          </div>
        </div>
      )}

      {phase === "rest" && (
        <div className="space-y-4">
          <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-6 text-center">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Dinlenme — Round {roundIndex + 2} başlıyor
            </span>
            <div className="font-display text-6xl text-brand-yellow">{restLeft}</div>
          </div>
          {restReport && <RoundReportCard report={restReport} mode={mode} compact />}
          <button
            type="button"
            onClick={stopSession}
            className="w-full rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
          >
            Seansı Bitir
          </button>
        </div>
      )}

      {phase === "finished" && report && (
        <SessionReportView
          report={report}
          onRestart={() => {
            setPhase("idle");
            setFeedback(null);
          }}
        />
      )}
    </div>
  );
}

// --- Alt bileşenler ---

function CameraStage({
  videoRef,
  canvasRef,
  status,
  error,
  personVisible,
  phase,
  feedback,
  calibrationPct,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  error: string | null;
  personVisible: boolean;
  phase: Phase;
  feedback: Feedback | null;
  calibrationPct: number;
}) {
  const toneBorder =
    feedback?.kind === "hit"
      ? "border-green-500"
      : feedback?.kind === "wrong" || feedback?.kind === "miss"
        ? "border-red-500"
        : phase === "cue"
          ? "border-brand-yellow"
          : "border-brand-border";

  return (
    <div className={`relative overflow-hidden rounded-sm border ${toneBorder} bg-black`}>
      <video
        ref={videoRef}
        muted
        playsInline
        className="h-auto w-full -scale-x-100"
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
      />

      <div className="absolute left-0 top-0 flex items-center gap-2 bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            personVisible ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-brand-white">
          {status === "loading"
            ? "Motor yükleniyor…"
            : status === "error"
              ? "Kamera hatası"
              : personVisible
                ? "İskelet takipte"
                : "Kadrajda değilsin"}
        </span>
        {phase === "calibrating" && (
          <span className="text-brand-muted">· kalibrasyon %{calibrationPct}</span>
        )}
      </div>

      {feedback && (
        <div
          className={`absolute bottom-0 left-0 right-0 px-3 py-2 text-center text-sm font-bold ${
            feedback.kind === "hit" ? "bg-green-600/80" : "bg-red-600/80"
          } text-white`}
        >
          {feedback.text}
        </div>
      )}

      {status === "error" && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </span>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-16 flex-1 rounded-sm border px-3 py-2 text-sm font-bold uppercase tracking-wide ${
        active
          ? "border-brand-yellow bg-brand-yellow text-brand-black"
          : "border-brand-border text-brand-white hover:border-brand-yellow"
      }`}
    >
      {label}
    </button>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div>
      <div className="flex justify-between text-xs text-brand-muted">
        <span className="font-bold uppercase tracking-wide">{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-black">
        <div className="h-full bg-brand-yellow" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RoundReportCard({
  report,
  mode,
  compact = false,
}: {
  report: RoundReport;
  mode: SessionMode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-sm border border-brand-border bg-brand-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          {report.roundIndex < 0 ? "Seans Toplamı" : `Round ${report.roundIndex + 1}`}
        </span>
        <span className="font-display text-2xl text-brand-yellow">
          {report.focusScore}
          <span className="text-xs text-brand-muted">/100 odak</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Ortalama" value={`${report.averageMs} ms`} />
        <Stat label="En Hızlı" value={`${report.bestMs} ms`} />
        <Stat label="Sapma" value={`±${report.stdDevMs} ms`} />
        <Stat
          label={mode === "kamera" ? "Doğru Hamle" : "Tekrar"}
          value={
            mode === "kamera"
              ? `${report.hitCount}/${report.cueCount}`
              : `${report.cueCount}`
          }
        />
      </div>

      {!compact && (
        <div className="mt-4 space-y-2">
          <ScoreBar label="Hız" value={report.speedScore} />
          <ScoreBar label="Tutarlılık" value={report.consistencyScore} />
          <ScoreBar label="Hamle Doğruluğu" value={report.accuracyScore} />
          <ScoreBar label="Guard Disiplini" value={report.guardScore} />
          <ScoreBar label="Dayanıklılık" value={report.enduranceScore} />
        </div>
      )}

      <p className="mt-3 text-xs text-brand-muted">
        Yorulma eğilimi: {report.fatigueDriftMs > 0 ? "+" : ""}
        {report.fatigueDriftMs} ms
        {mode === "kamera" && (
          <>
            {" · "}
            {report.wrongMoveCount} yanlış hamle · {report.missCount} kaçan komut
          </>
        )}
      </p>
    </div>
  );
}

function SessionReportView({
  report,
  onRestart,
}: {
  report: SessionReport;
  onRestart: () => void;
}) {
  const trendLabel =
    report.focusTrend === "yukselen"
      ? "Yükselen"
      : report.focusTrend === "dusen"
        ? "Düşen"
        : "Stabil";

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-6 text-center">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          Odak Skoru · {report.mode === "kamera" ? "Kamera Doğrulamalı" : "Manuel"}
        </span>
        <div className="font-display text-6xl text-brand-yellow">
          {report.focusScore}
        </div>
        <p className="mt-1 text-xs text-brand-muted">
          Round eğilimi: {trendLabel}
          {report.bestRoundIndex !== null && (
            <> · En iyi round: {report.bestRoundIndex + 1}</>
          )}
          {report.worstRoundIndex !== null && (
            <> · En zayıf round: {report.worstRoundIndex + 1}</>
          )}
        </p>
        <p className="mt-3 text-sm text-brand-white">{report.verdict}</p>
      </div>

      <RoundReportCard report={report.overall} mode={report.mode} />

      {report.rounds.length > 1 && (
        <div className="space-y-3">
          {report.rounds.map((round) => (
            <RoundReportCard
              key={round.roundIndex}
              report={round}
              mode={report.mode}
              compact
            />
          ))}
        </div>
      )}

      {report.highlights.length > 0 && (
        <ul className="space-y-2 rounded-sm border border-brand-border bg-brand-surface p-5 text-sm text-brand-white">
          {report.highlights.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="text-brand-yellow">→</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      {report.overall.perMove.length > 0 && (
        <div className="rounded-sm border border-brand-border bg-brand-surface">
          <ul className="divide-y divide-brand-border">
            {report.overall.perMove.map((stat) => (
              <li
                key={stat.moveId}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-brand-white">{stat.label}</span>
                <span className="text-brand-muted">
                  {stat.averageMs} ms · {stat.count}x
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white"
      >
        Yeni Seans
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-brand-border bg-brand-surface-2 p-3 text-center">
      <div className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="font-display mt-1 text-lg text-brand-white">{value}</div>
    </div>
  );
}
