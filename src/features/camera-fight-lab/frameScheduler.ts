import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";

type VideoFrameMetadataLike = { mediaTime: number; presentedFrames?: number };
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameMetadataLike) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export class VideoFrameScheduler {
  private videoHandle: number | null = null;
  private animationHandle: number | null = null;
  private running = false;
  private lastVideoTime = -1;
  private lastInferenceAt = Number.NEGATIVE_INFINITY;
  private frameTimes: number[] = [];

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onFrame: (timestampMs: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const enhanced = this.video as VideoWithFrameCallback;
    // `typeof` ile bakılıyor: DOM tipleri bu API'yi zorunlu ilan ettiği için
    // düz `if (fn)` kontrolü TS2774 veriyor, ama desteklemeyen tarayıcı var.
    if (typeof enhanced.requestVideoFrameCallback === "function") {
      this.scheduleVideoFrame();
    } else {
      this.scheduleAnimationFrame();
    }
  }

  stop(): void {
    this.running = false;
    const enhanced = this.video as VideoWithFrameCallback;
    if (this.videoHandle !== null && enhanced.cancelVideoFrameCallback) {
      enhanced.cancelVideoFrameCallback(this.videoHandle);
    }
    if (this.animationHandle !== null) cancelAnimationFrame(this.animationHandle);
    this.videoHandle = null;
    this.animationHandle = null;
  }

  estimatedVideoFps(): number {
    if (this.frameTimes.length < 2) return 0;
    const duration = this.frameTimes[this.frameTimes.length - 1] - this.frameTimes[0];
    return duration > 0 ? ((this.frameTimes.length - 1) * 1_000) / duration : 0;
  }

  private recordFrame(now: number): void {
    this.frameTimes.push(now);
    const cutoff = now - 2_000;
    while (this.frameTimes.length > 0 && this.frameTimes[0] < cutoff) this.frameTimes.shift();
    const minimumGap = 1_000 / PERFORMANCE_CONFIG.pose.maxProcessingFps;
    if (now - this.lastInferenceAt >= minimumGap) {
      this.lastInferenceAt = now;
      this.onFrame(now);
    }
  }

  private scheduleVideoFrame(): void {
    const enhanced = this.video as VideoWithFrameCallback;
    this.videoHandle = enhanced.requestVideoFrameCallback?.((now) => {
      if (!this.running) return;
      this.recordFrame(now);
      this.scheduleVideoFrame();
    }) ?? null;
  }

  private scheduleAnimationFrame(): void {
    this.animationHandle = requestAnimationFrame((now) => {
      if (!this.running) return;
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        this.recordFrame(now);
      }
      this.scheduleAnimationFrame();
    });
  }
}

