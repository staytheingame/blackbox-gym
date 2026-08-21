import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { createPoseLandmarker, type PoseLandmarkerLike } from "@/lib/pose/landmarker";
import { mapPoseResult } from "./poseMapper";
import type { PoseSample } from "./types";

export type InferenceMode = "worker" | "main-thread";

type WorkerMessage =
  | { type: "ready" }
  | { type: "result"; sample: PoseSample }
  | { type: "error"; message: string };

export class PoseClient {
  private worker: Worker | null = null;
  private landmarker: PoseLandmarkerLike = null;
  private busy = false;
  private closed = false;
  private onSample: (sample: PoseSample) => void = () => undefined;
  private onRuntimeError: (message: string) => void = () => undefined;
  mode: InferenceMode = "main-thread";

  async initialize(
    onSample: (sample: PoseSample) => void,
    onRuntimeError: (message: string) => void,
  ): Promise<InferenceMode> {
    this.onSample = onSample;
    this.onRuntimeError = onRuntimeError;
    if (typeof Worker !== "undefined" && typeof createImageBitmap === "function") {
      try {
        await this.initializeWorker();
        this.mode = "worker";
        return this.mode;
      } catch {
        this.worker?.terminate();
        this.worker = null;
      }
    }

    this.landmarker = await createPoseLandmarker("VIDEO");
    this.mode = "main-thread";
    return this.mode;
  }

  async processFrame(video: HTMLVideoElement, timestampMs: number): Promise<boolean> {
    if (this.closed || this.busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return false;
    }
    this.busy = true;
    if (this.worker) {
      try {
        const frame = await createImageBitmap(video);
        if (this.closed) {
          frame.close();
          this.busy = false;
          return false;
        }
        this.worker.postMessage({ type: "frame", frame, timestampMs }, [frame]);
        return true;
      } catch (error) {
        this.busy = false;
        this.onRuntimeError(
          error instanceof Error ? error.message : "Video karesi worker'a aktarılamadı.",
        );
        return false;
      }
    }

    try {
      const result = this.landmarker.detectForVideo(video, timestampMs);
      this.onSample(mapPoseResult(result, timestampMs));
      return true;
    } catch (error) {
      this.onRuntimeError(error instanceof Error ? error.message : "Pose inference başarısız.");
      return false;
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.closed = true;
    if (this.worker) {
      this.worker.postMessage({ type: "close" });
      this.worker.terminate();
    }
    this.worker = null;
    this.landmarker?.close?.();
    this.landmarker = null;
    this.busy = false;
  }

  private initializeWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./pose.worker.ts", import.meta.url), {
        type: "module",
        name: "blackbox-pose-worker",
      });
      this.worker = worker;
      const timeout = window.setTimeout(() => {
        reject(new Error("Pose worker initialization timed out."));
      }, PERFORMANCE_CONFIG.pose.inferenceTimeoutMs);

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === "ready") {
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        if (message.type === "result") {
          this.busy = false;
          this.onSample(message.sample);
          return;
        }
        if (message.type === "error") {
          this.busy = false;
          if (this.mode === "worker") this.onRuntimeError(message.message);
          else reject(new Error(message.message));
        }
      };
      worker.onerror = (event) => {
        this.busy = false;
        window.clearTimeout(timeout);
        reject(new Error(event.message || "Pose worker failed."));
      };
      worker.postMessage({ type: "init" });
    });
  }
}

