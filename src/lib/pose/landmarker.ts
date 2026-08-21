/**
 * MediaPipe PoseLandmarker'ın tek yükleme noktası. Model ve WASM CDN'den
 * gelir, çözümleme tamamen tarayıcıda çalışır — hiçbir görüntü sunucuya
 * gönderilmez.
 */

import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";

export const POSE_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** MediaPipe tipleri yalnızca dinamik import'ta çözüldüğü için gevşek tutuldu. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PoseLandmarkerLike = any;

export async function createPoseLandmarker(
  runningMode: "VIDEO" | "IMAGE" = "VIDEO",
): Promise<PoseLandmarkerLike> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(POSE_WASM_BASE);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
    runningMode,
    // İkinci bir kişi görünürse istemci kalibrasyonu bunu reddedebilsin.
    numPoses: 2,
    minPoseDetectionConfidence: PERFORMANCE_CONFIG.pose.minVisibility,
    minPosePresenceConfidence: PERFORMANCE_CONFIG.pose.minVisibility,
    minTrackingConfidence: PERFORMANCE_CONFIG.pose.minVisibility,
  });

  try {
    return await PoseLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    return await PoseLandmarker.createFromOptions(vision, options("CPU"));
  }
}

/** İskelet çiziminde kullanılan gövde/kol/bacak bağlantıları. */
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // omuzlar
  [11, 13],
  [13, 15], // sol kol
  [12, 14],
  [14, 16], // sağ kol
  [11, 23],
  [12, 24], // gövde
  [23, 24], // kalça
  [23, 25],
  [25, 27], // sol bacak
  [24, 26],
  [26, 28], // sağ bacak
  [0, 11],
  [0, 12], // baş ↔ omuzlar
];
