"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIFFICULTY_LABELS,
  DEFAULT_REP_COUNT,
  type Difficulty,
  type ReflexMove,
} from "@/domain/reflex/moves";
import {
  pickIntervalMs,
  pickNextMove,
  summarizeSession,
  type ReflexRep,
  type ReflexSummary,
} from "@/domain/reflex/session";
import { isSpeechSupported, primeVoices, speakTurkish } from "@/lib/tts";

type Phase = "idle" | "countdown" | "listening" | "waiting" | "finished";

const REP_COUNT_OPTIONS = [10, 15, 20];

export function ReflexTrainer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("orta");
  const [repTarget, setRepTarget] = useState(DEFAULT_REP_COUNT);
  const [countdown, setCountdown] = useState(3);
  const [currentMove, setCurrentMove] = useState<ReflexMove | null>(null);
  const [reps, setReps] = useState<ReflexRep[]>([]);
  const [summary, setSummary] = useState<ReflexSummary | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const cueStartRef = useRef<number>(0);
  const lastMoveIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    primeVoices();
    // Sunucuda bilinemeyen, yalnızca tarayıcıda anlaşılan bir yetenek
    // kontrolü — mount sonrası tek seferlik güncelleme kasıtlı.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeechSupported(isSpeechSupported());
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (isSpeechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  function clearTimer() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function issueNextCue() {
    const move = pickNextMove(lastMoveIdRef.current);
    lastMoveIdRef.current = move.id;
    setCurrentMove(move);
    speakTurkish(move.label);
    cueStartRef.current = performance.now();
    setPhase("listening");
  }

  function startSession() {
    setReps([]);
    setSummary(null);
    lastMoveIdRef.current = null;
    setCountdown(3);
    setPhase("countdown");
  }

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      issueNextCue();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(id);
  }, [phase, countdown]);

  function handleReact() {
    if (phase !== "listening" || !currentMove) return;
    const reactionMs = Math.round(performance.now() - cueStartRef.current);
    const nextReps = [...reps, { moveId: currentMove.id, reactionMs }];
    setReps(nextReps);

    if (nextReps.length >= repTarget) {
      setSummary(summarizeSession(nextReps));
      setPhase("finished");
      return;
    }

    setPhase("waiting");
    const delay = pickIntervalMs(difficulty);
    timeoutRef.current = setTimeout(() => {
      if (phaseRef.current === "waiting") issueNextCue();
    }, delay);
  }

  function stopSession() {
    clearTimer();
    if (isSpeechSupported()) window.speechSynthesis.cancel();
    if (reps.length > 0) {
      setSummary(summarizeSession(reps));
      setPhase("finished");
    } else {
      setPhase("idle");
    }
  }

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.code === "Space" && phaseRef.current === "listening") {
        event.preventDefault();
        handleReact();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentMove, reps, repTarget, difficulty]);

  return (
    <div className="mx-auto max-w-xl">
      {!speechSupported && (
        <p className="mb-6 rounded-sm border border-brand-yellow bg-brand-surface-2 px-4 py-3 text-sm text-brand-white">
          Tarayıcın sesli okumayı desteklemiyor gibi görünüyor — hamle adı
          yine de ekranda büyük yazıyla gösterilecek.
        </p>
      )}

      {phase === "idle" && (
        <div className="space-y-6 rounded-sm border border-brand-border bg-brand-surface p-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Zorluk
            </span>
            <div className="mt-2 flex gap-2">
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm font-bold uppercase tracking-wide ${
                    difficulty === level
                      ? "border-brand-yellow bg-brand-yellow text-brand-black"
                      : "border-brand-border text-brand-white hover:border-brand-yellow"
                  }`}
                >
                  {DIFFICULTY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Tekrar sayısı
            </span>
            <div className="mt-2 flex gap-2">
              {REP_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setRepTarget(count)}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm font-bold uppercase tracking-wide ${
                    repTarget === count
                      ? "border-brand-yellow bg-brand-yellow text-brand-black"
                      : "border-brand-border text-brand-white hover:border-brand-yellow"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={startSession}
            className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white"
          >
            Başlat
          </button>
        </div>
      )}

      {phase === "countdown" && (
        <div className="flex h-64 flex-col items-center justify-center rounded-sm border border-brand-border bg-brand-surface">
          <span className="font-display text-7xl text-brand-yellow">
            {countdown > 0 ? countdown : "GİT!"}
          </span>
        </div>
      )}

      {(phase === "listening" || phase === "waiting") && (
        <div className="space-y-6">
          <div className="flex h-64 flex-col items-center justify-center rounded-sm border border-brand-yellow bg-brand-surface-2 text-center">
            {phase === "listening" ? (
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
          <button
            type="button"
            onClick={handleReact}
            disabled={phase !== "listening"}
            className="w-full rounded-sm bg-brand-yellow px-4 py-4 text-lg font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Tepki Ver (Boşluk)
          </button>
          <div className="flex items-center justify-between text-xs text-brand-muted">
            <span>
              {reps.length} / {repTarget}
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

      {phase === "finished" && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <SummaryStat label="Ortalama" value={`${summary.averageMs} ms`} />
            <SummaryStat label="En Hızlı" value={`${summary.bestMs} ms`} />
            <SummaryStat label="En Yavaş" value={`${summary.worstMs} ms`} />
          </div>

          {summary.perMove.length > 0 && (
            <div className="rounded-sm border border-brand-border bg-brand-surface">
              <ul className="divide-y divide-brand-border">
                {summary.perMove.map((stat) => (
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
            onClick={() => setPhase("idle")}
            className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white"
          >
            Tekrar Dene
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-brand-border bg-brand-surface p-4 text-center">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="font-display mt-1 text-xl text-brand-yellow">{value}</div>
    </div>
  );
}
