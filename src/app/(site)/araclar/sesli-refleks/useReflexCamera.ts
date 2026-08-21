"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPoseLandmarker,
  POSE_CONNECTIONS,
  type PoseLandmarkerLike,
} from "@/lib/pose/landmarker";
import { extractFeatures, type PoseFeatures } from "@/domain/reflex/detect";
import type { PoseLandmark } from "@/domain/fight-analytics/metrics";

export type CameraStatus = "idle" | "loading" | "ready" | "error";

/** Tamponda tutulan geçmiş (ms) — kalibrasyon ve tepki penceresi için yeter. */
const BUFFER_MS = 6000;

const TONE_COLOR: Record<"idle" | "cue" | "hit" | "miss", string> = {
  idle: "#9ca3af",
  cue: "#f5c400",
  hit: "#22c55e",
  miss: "#ef4444",
};

export type OverlayTone = keyof typeof TONE_COLOR;

/**
 * Web kamerasını açar, her karede MediaPipe ile iskeleti çıkarır ve
 * ölçülebilir özellikleri (`PoseFeatures`) halka tamponda biriktirir.
 * Görüntü sayfadan dışarı çıkmaz.
 */
export function useReflexCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<PoseFeatures[]>([]);
  const toneRef = useRef<OverlayTone>("idle");

  const landmarkerRef = useRef<PoseLandmarkerLike>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [personVisible, setPersonVisible] = useState(false);

  const setTone = useCallback((tone: OverlayTone) => {
    toneRef.current = tone;
  }, []);

  const resetBuffer = useCallback(() => {
    framesRef.current = [];
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let visibleFlag = false;

    async function boot() {
      setStatus("loading");
      setError(null);
      try {
        const [landmarker, stream] = await Promise.all([
          createPoseLandmarker("VIDEO"),
          navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: "user" },
            audio: false,
          }),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          landmarker?.close?.();
          return;
        }
        landmarkerRef.current = landmarker;
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("Video öğesi hazır değil.");
        video.srcObject = stream;
        await video.play();

        setStatus("ready");
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.name === "NotAllowedError"
              ? "Kamera izni verilmedi. Tarayıcı adres çubuğundaki kamera simgesinden izin ver."
              : err.message
            : "Kamera başlatılamadı.",
        );
        setStatus("error");
      }
    }

    function loop() {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (cancelled || !video || !landmarker) return;

      if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const now = performance.now();
        let landmarks: PoseLandmark[] | null = null;
        try {
          const result = landmarker.detectForVideo(video, Math.round(now));
          landmarks = (result?.landmarks?.[0] as PoseLandmark[] | undefined) ?? null;
        } catch {
          landmarks = null;
        }

        const features = extractFeatures(landmarks, now);
        if (features) {
          framesRef.current.push(features);
          const cutoff = now - BUFFER_MS;
          while (framesRef.current.length > 0 && framesRef.current[0].tMs < cutoff) {
            framesRef.current.shift();
          }
        }

        if (!!features !== visibleFlag) {
          visibleFlag = !!features;
          setPersonVisible(visibleFlag);
        }

        draw(landmarks, video);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    function draw(landmarks: PoseLandmark[] | null, video: HTMLVideoElement) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      if (!landmarks) return;

      const color = TONE_COLOR[toneRef.current];
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(2, width / 260);

      for (const [from, to] of POSE_CONNECTIONS) {
        const a = landmarks[from];
        const b = landmarks[to];
        if (!a || !b) continue;
        if ((a.visibility ?? 1) < 0.3 || (b.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      }

      const radius = Math.max(3, width / 200);
      for (const index of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
        const point = landmarks[index];
        if (!point || (point.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      lastVideoTimeRef.current = -1;
      framesRef.current = [];
      setStatus("idle");
      setPersonVisible(false);
    };
  }, [enabled]);

  return {
    videoRef,
    canvasRef,
    framesRef,
    status,
    error,
    personVisible,
    setTone,
    resetBuffer,
  };
}
