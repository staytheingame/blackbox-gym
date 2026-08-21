import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { POSE_MODEL_URL, POSE_WASM_BASE } from "@/lib/pose/landmarker";
import { mapPoseResult } from "./poseMapper";

type WorkerRequest =
  | { type: "init" }
  | { type: "frame"; frame: ImageBitmap; timestampMs: number }
  | { type: "close" };

let landmarker: Awaited<ReturnType<typeof PoseLandmarker.createFromOptions>> | null = null;

async function initialize(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(POSE_WASM_BASE);
  const create = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      // İkinci bir kişi görünürse kalibrasyonun bunu reddedebilmesi için 2.
      numPoses: 2,
      minPoseDetectionConfidence: PERFORMANCE_CONFIG.pose.minVisibility,
      minPosePresenceConfidence: PERFORMANCE_CONFIG.pose.minVisibility,
      minTrackingConfidence: PERFORMANCE_CONFIG.pose.minVisibility,
    });
  try {
    landmarker = await create("GPU");
  } catch {
    landmarker = await create("CPU");
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      await initialize();
      self.postMessage({ type: "ready" });
      return;
    }
    if (message.type === "close") {
      landmarker?.close();
      landmarker = null;
      self.close();
      return;
    }
    if (message.type === "frame") {
      if (!landmarker) throw new Error("Pose worker is not initialized.");
      try {
        const result = landmarker.detectForVideo(message.frame, message.timestampMs);
        self.postMessage({
          type: "result",
          sample: mapPoseResult(result, message.timestampMs),
        });
      } finally {
        message.frame.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Pose worker error",
    });
  }
};
