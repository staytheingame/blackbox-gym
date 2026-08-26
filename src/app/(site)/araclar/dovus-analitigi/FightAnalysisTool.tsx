"use client";

import { useEffect, useRef, useState } from "react";
import {
  analyzeFightFrames,
  type FightAnalysisReport,
  type PoseFrame,
} from "@/domain/fight-analytics/metrics";
import { spokenReportSummary } from "@/domain/fight-analytics/narration";
import { SoundControls, initialMuted } from "@/components/ui/SoundControls";
import { beep, initAudio, releaseAudio, speak, stopSpeaking } from "@/lib/audio/voice";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type ModelStatus = "loading" | "ready" | "error";
type RunStatus = "idle" | "processing" | "done";

export function FightAnalysisTool() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>("loading");
  const [modelError, setModelError] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState(0); // 0-100
  const [report, setReport] = useState<FightAnalysisReport | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        const { FilesetResolver, PoseLandmarker } = await import(
          "@mediapipe/tasks-vision"
        );
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        let landmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        }
        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setModelStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setModelError(
          err instanceof Error ? err.message : "Model yüklenemedi.",
        );
        setModelStatus("error");
      }
    }

    void loadModel();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close?.();
      releaseAudio();
    };
  }, []);

  useEffect(() => {
    // Sustur tercihi cihazda saklanıyor — ilk render'da okunur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(initialMuted());
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // ★ Dosya seçimi bir kullanıcı hareketidir — ses motorları burada açılır.
    initAudio();
    stopSpeaking();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    framesRef.current = [];
    setReport(null);
    setProgress(0);
    setRunStatus("idle");
    setVideoUrl(URL.createObjectURL(file));
  }

  function handlePlay() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;
    framesRef.current = [];
    setRunStatus("processing");

    function loop() {
      if (!video || video.paused || video.ended) return;
      const timestampMs = Math.round(video.currentTime * 1000);
      const result = landmarker.detectForVideo(video, timestampMs);
      const landmarks = result.landmarks?.[0] ?? null;
      framesRef.current.push({ timestampMs, landmarks });
      if (video.duration > 0) {
        setProgress(Math.min(100, Math.round((video.currentTime / video.duration) * 100)));
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function finishAnalysis() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setProgress(100);
    const finished = analyzeFightFrames(framesRef.current);
    setReport(finished);
    setRunStatus("done");
    // Analiz bitişi duyulur olmalı: kullanıcı video oynarken ekrana bakmıyor
    // olabiliyor — bitiş sesi + rapor özeti sesli okunur.
    beep("finish");
    speak(spokenReportSummary(finished), { rate: 1 });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {modelStatus === "loading" && (
        <div className="rounded-sm border border-brand-border bg-brand-surface p-6 text-sm text-brand-muted">
          Analiz motoru yükleniyor (MediaPipe, tarayıcıda çalışır)…
        </div>
      )}
      {modelStatus === "error" && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-6 text-sm text-red-300">
          Analiz motoru yüklenemedi{modelError ? `: ${modelError}` : "."}{" "}
          İnternet bağlantını kontrol edip sayfayı yenile.
        </div>
      )}

      {modelStatus === "ready" && (
        <div className="rounded-sm border border-brand-border bg-brand-surface p-6">
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Video Seç
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="mt-2 block w-full text-base text-brand-white file:mr-4 file:rounded-sm file:border-0 file:bg-brand-yellow file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-brand-black hover:file:bg-brand-white sm:text-sm"
          />
          <p className="mt-2 text-xs text-brand-muted">
            Kısa bir klip öner (30 sn - 2 dk). Video hiçbir sunucuya
            gönderilmez, işlem tamamen bu sekmede yapılır.
          </p>
          <div className="mt-4 border-t border-brand-border pt-4">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
              Ses
            </span>
            <SoundControls muted={muted} onMutedChange={setMuted} className="mt-2" />
            <p className="mt-2 text-xs text-brand-muted">
              Analiz bitince rapor özeti sesli okunur.
            </p>
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="space-y-4">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            onPlay={handlePlay}
            onEnded={finishAnalysis}
            onPause={() => {
              if (runStatus === "processing" && videoRef.current?.ended === false && videoRef.current.currentTime > 0 && videoRef.current.currentTime >= videoRef.current.duration - 0.2) {
                finishAnalysis();
              }
            }}
            className="w-full rounded-sm border border-brand-border bg-black"
          />

          {runStatus === "processing" && (
            <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-4">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-brand-muted">
                <span>İşleniyor…</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-black">
                <div
                  className="h-full bg-brand-yellow transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {runStatus === "done" && report && (
        <ReportView
          report={report}
          onRepeat={() => speak(spokenReportSummary(report), { rate: 1 })}
        />
      )}
    </div>
  );
}

function ReportView({
  report,
  onRepeat,
}: {
  report: FightAnalysisReport;
  onRepeat: () => void;
}) {
  if (!report.personDetected) {
    return (
      <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-6 text-sm text-brand-white">
        Videoda yeterli sayıda karede bir kişi tespit edilemedi. Kişinin
        kadrajda ve net görünür olduğu bir klip dene.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-6 text-center">
        <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          Genel Skor
        </span>
        <div className="font-display text-5xl text-brand-yellow">
          {report.overallScore}
        </div>
        <p className="mt-2 text-xs text-brand-muted">
          Bu basitleştirilmiş bir tahmin motorudur, profesyonel değerlendirme
          yerine geçmez.
        </p>
        <button
          type="button"
          onClick={onRepeat}
          className="mt-4 rounded-sm border border-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-yellow hover:bg-brand-yellow hover:text-brand-black"
        >
          Raporu sesli oku
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Guard Skoru"
          value={`${report.guardScore}/100`}
          detail={`Karelerin %${Math.round(report.guardDropFrameRatio * 100)}'inde guard düşük`}
        />
        <MetricCard
          label="Ayak İşi"
          value={`${report.footworkScore}/100`}
          detail="Ayak bileği hareketliliğine göre"
        />
        <MetricCard
          label="Kafa Hareketi Aktivitesi"
          value={`${report.headActivityScore}/100`}
          detail={`${report.headSlipCount} yön değişimi tespit edildi`}
        />
        <MetricCard
          label="Duruş Genişliği Oranı"
          value={report.stanceRatio.toFixed(2)}
          detail="Ayak açıklığı / omuz genişliği"
        />
      </div>

      <p className="text-xs text-brand-muted">
        {report.validFrameCount} / {report.frameCount} karede poz tespit
        edildi · {report.durationSec} sn analiz edildi.
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-sm border border-brand-border bg-brand-surface p-5">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="font-display mt-1 text-2xl text-brand-white">
        {value}
      </div>
      <p className="mt-1 text-xs text-brand-muted">{detail}</p>
    </div>
  );
}
