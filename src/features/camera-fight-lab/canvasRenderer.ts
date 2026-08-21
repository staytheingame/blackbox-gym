import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { POSE_CONNECTIONS } from "@/lib/pose/landmarker";
import { imageToDisplayCanvas, type CanvasSize } from "./coordinates";
import { scaleTarget, type GuardZoneSnapshot } from "./trialGenerator";
import { clamp } from "./vectorMath";
import type {
  CalibrationSnapshot,
  PoseSample,
  TargetSnapshot,
  TrialStimulus,
  VirtualOpponentAttackType,
  WristHistoryPoint,
  WristObservation,
} from "./types";

export type CanvasFeedback = {
  text: string;
  tone: "hit" | "miss" | "slow" | "early" | "tracking";
} | null;

export type CanvasRenderModel = {
  pose: PoseSample | null;
  target: TargetSnapshot | null;
  targetVisible: boolean;
  stimulus: TrialStimulus | null;
  /** combo-speed'de o anki adımın beklediği eli gösteren canlı cue metni; null ise stimulus.cueLabel kullanılır. */
  comboStepLabel: string | null;
  /** guard-return'de vuruş sonrası dönüş hedefini gösteren halka. */
  guardZone: (GuardZoneSnapshot & { stable: boolean }) | null;
  /** virtual-opponent'ta rakibin cueStart→attackCommit→attackLand zaman çizelgesini gösteren üst overlay. */
  opponentCue: {
    attackType: VirtualOpponentAttackType;
    cueStartMs: number;
    attackCommitMs: number;
    attackLandMs: number;
  } | null;
  showCenterFixation: boolean;
  countdown: number | null;
  feedback: CanvasFeedback;
  debug: boolean;
  calibration: CalibrationSnapshot | null;
  leftObservation: WristObservation | null;
  rightObservation: WristObservation | null;
  leftHistory: readonly WristHistoryPoint[];
  rightHistory: readonly WristHistoryPoint[];
  stateLabel: string;
  t0Ms: number | null;
  t1Ms: number | null;
  t2Ms: number | null;
};

export function fitCanvas(canvas: HTMLCanvasElement): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  return { width, height };
}

export function renderFightLabCanvas(
  canvas: HTMLCanvasElement,
  model: CanvasRenderModel,
): CanvasSize {
  const size = fitCanvas(canvas);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) return size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  const scaledTarget = model.target ? scaleTarget(model.target, size) : null;

  if (model.debug && model.pose) drawSkeleton(ctx, model.pose, size);
  if (model.debug && model.calibration) drawGuardBaseline(ctx, model.calibration, size);
  if (model.showCenterFixation) drawCenterFixation(ctx, size);
  if (scaledTarget && model.targetVisible) {
    drawTarget(ctx, scaledTarget, model.stimulus, model.comboStepLabel);
  }
  if (model.guardZone) drawGuardZone(ctx, model.guardZone);
  if (model.opponentCue) drawOpponentCue(ctx, size, model.opponentCue);
  if (model.debug) {
    drawVelocityVector(ctx, model.leftObservation, "#38bdf8", scaledTarget);
    drawVelocityVector(ctx, model.rightObservation, "#fb7185", scaledTarget);
    drawDiagnosticsGraph(ctx, size, model.leftHistory, model.rightHistory);
    drawDebugText(ctx, size, model);
  }
  if (model.countdown !== null) drawCountdown(ctx, size, model.countdown);
  if (model.feedback) drawFeedback(ctx, size, model.feedback);
  return size;
}

function drawTarget(
  ctx: CanvasRenderingContext2D,
  target: TargetSnapshot,
  stimulus: TrialStimulus | null,
  labelOverride: string | null = null,
): void {
  const pulse = 1 + Math.sin(performance.now() / 90) * 0.035;
  const radius = target.radiusPx * pulse;
  const color = stimulus?.cueColor ?? "#f5c400";
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = `${color}33`;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, radius * 0.09);
  ctx.beginPath();
  ctx.arc(target.displayX, target.displayY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = `800 ${Math.max(15, radius * 0.32)}px var(--font-oswald), sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labelOverride ?? stimulus?.cueLabel ?? "VUR", target.displayX, target.displayY);
  ctx.restore();
}

function drawGuardZone(
  ctx: CanvasRenderingContext2D,
  guardZone: GuardZoneSnapshot & { stable: boolean },
): void {
  const color = guardZone.hand === "left" ? "#38bdf8" : "#fb7185";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (!guardZone.stable) ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(guardZone.displayX, guardZone.displayY, guardZone.radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.font = "700 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("GUARD", guardZone.displayX, guardZone.displayY - guardZone.radiusPx - 10);
  ctx.restore();
}

/**
 * cueStart→attackCommit→attackLand zaman çizelgesini basit bir daralan
 * halka + renk geçişiyle gösterir. Yeni bir detector değildir; yalnız
 * VirtualOpponentTracker'ın zaten sakladığı timeline'ı görselleştirir.
 */
function drawOpponentCue(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  cue: {
    attackType: VirtualOpponentAttackType;
    cueStartMs: number;
    attackCommitMs: number;
    attackLandMs: number;
  },
): void {
  const now = performance.now();
  const totalMs = Math.max(1, cue.attackLandMs - cue.cueStartMs);
  const progress = clamp((now - cue.cueStartMs) / totalMs, 0, 1);
  const committed = now >= cue.attackCommitMs;
  const x = size.width / 2;
  const y = size.height * 0.14;
  const maxRadius = Math.min(size.width, size.height) * 0.085;
  const radius = maxRadius * (1 - progress * 0.55);
  const color = progress >= 1 ? "#ef4444" : committed ? "#f59e0b" : "#f5c400";

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(6, radius), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "800 12px var(--font-oswald), sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    cue.attackType === "PUNCH_COMBO" ? "RAKİP · KONTRA GEREKİYOR" : "RAKİP · SAVUN GEREKİYOR",
    x,
    y + maxRadius + 18,
  );
  ctx.restore();
}

function drawCenterFixation(ctx: CanvasRenderingContext2D, size: CanvasSize): void {
  const x = size.width / 2;
  const y = size.height * 0.44;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x + 9, y);
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x, y + 9);
  ctx.stroke();
  ctx.restore();
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  pose: PoseSample,
  size: CanvasSize,
): void {
  const imagePoints = new Map<number, { x: number; y: number; visibility: number }>();
  const entries = [
    [0, pose.image.nose, pose.visibility.nose],
    [11, pose.image.leftShoulder, pose.visibility.leftShoulder],
    [12, pose.image.rightShoulder, pose.visibility.rightShoulder],
    [13, pose.image.leftElbow, pose.visibility.leftElbow],
    [14, pose.image.rightElbow, pose.visibility.rightElbow],
    [15, pose.image.leftWrist, pose.visibility.leftWrist],
    [16, pose.image.rightWrist, pose.visibility.rightWrist],
    [23, pose.image.leftHip, pose.visibility.leftHip],
    [24, pose.image.rightHip, pose.visibility.rightHip],
    [25, pose.image.leftKnee, pose.visibility.leftKnee],
    [26, pose.image.rightKnee, pose.visibility.rightKnee],
    [27, pose.image.leftAnkle, pose.visibility.leftAnkle],
    [28, pose.image.rightAnkle, pose.visibility.rightAnkle],
    [29, pose.image.leftHeel, pose.visibility.leftHeel],
    [30, pose.image.rightHeel, pose.visibility.rightHeel],
    [31, pose.image.leftFootIndex, pose.visibility.leftFootIndex],
    [32, pose.image.rightFootIndex, pose.visibility.rightFootIndex],
  ] as const;
  for (const [index, point, visibility] of entries) {
    if (!point) continue;
    const display = imageToDisplayCanvas(point, size);
    imagePoints.set(index, { ...display, visibility });
  }

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(245,196,0,.72)";
  for (const [from, to] of POSE_CONNECTIONS) {
    const a = imagePoints.get(from);
    const b = imagePoints.get(to);
    if (!a || !b || a.visibility < 0.3 || b.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const [index, point] of imagePoints) {
    ctx.fillStyle = index === 15 ? "#38bdf8" : index === 16 ? "#fb7185" : "#f5c400";
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 15 || index === 16 ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (index === 15 || index === 16) {
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText(index === 15 ? "L" : "R", point.x + 10, point.y - 9);
    }
  }
  ctx.restore();
}

function drawGuardBaseline(
  ctx: CanvasRenderingContext2D,
  calibration: CalibrationSnapshot,
  size: CanvasSize,
): void {
  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1.5;
  for (const [point, color] of [
    [calibration.leftGuardImage, "#38bdf8"],
    [calibration.rightGuardImage, "#fb7185"],
  ] as const) {
    const display = imageToDisplayCanvas(point, size);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(display.x, display.y, 12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVelocityVector(
  ctx: CanvasRenderingContext2D,
  observation: WristObservation | null,
  color: string,
  target: TargetSnapshot | null,
): void {
  if (!observation?.previousDisplay) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(observation.previousDisplay.x, observation.previousDisplay.y);
  ctx.lineTo(observation.display.x, observation.display.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(observation.display.x, observation.display.y, 7, 0, Math.PI * 2);
  ctx.fill();
  if (target) {
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(observation.display.x, observation.display.y);
    ctx.lineTo(target.displayX, target.displayY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDiagnosticsGraph(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  left: readonly WristHistoryPoint[],
  right: readonly WristHistoryPoint[],
): void {
  const width = Math.min(size.width - 24, 430);
  const height = 88;
  const x = 12;
  const y = size.height - height - 12;
  const now = Math.max(left.at(-1)?.timestampMs ?? 0, right.at(-1)?.timestampMs ?? 0);
  const windowMs = 2_000;
  const maxVelocity = 3;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.72)";
  ctx.fillRect(x, y, width, height);
  const thresholdY = y + height -
    (PERFORMANCE_CONFIG.motion.onsetVelocityMps / maxVelocity) * height;
  ctx.strokeStyle = "rgba(245,196,0,.85)";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, thresholdY);
  ctx.lineTo(x + width, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  const drawLine = (history: readonly WristHistoryPoint[], color: string) => {
    const points = history.filter((point) => point.timestampMs >= now - windowMs);
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x + ((point.timestampMs - (now - windowMs)) / windowMs) * width;
      const py = y + height - Math.min(point.velocityMps, maxVelocity) / maxVelocity * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  };
  drawLine(left, "#38bdf8");
  drawLine(right, "#fb7185");
  ctx.fillStyle = "#d4d4d4";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText(`2s velocity · onset ${PERFORMANCE_CONFIG.motion.onsetVelocityMps.toFixed(2)} m/s`, x + 6, y + 12);
  ctx.restore();
}

function drawDebugText(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  model: CanvasRenderModel,
): void {
  const left = model.leftObservation?.velocityMps ?? 0;
  const right = model.rightObservation?.velocityMps ?? 0;
  const lines = [
    `STATE ${model.stateLabel}`,
    `L ${left.toFixed(2)} m/s · R ${right.toFixed(2)} m/s`,
    `T0 ${formatTime(model.t0Ms)} · T1 ${formatTime(model.t1Ms)} · T2 ${formatTime(model.t2Ms)}`,
  ];
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.72)";
  ctx.fillRect(12, 12, Math.min(410, size.width - 24), 62);
  ctx.fillStyle = "#f5c400";
  ctx.font = "11px ui-monospace, monospace";
  lines.forEach((line, index) => ctx.fillText(line, 20, 29 + index * 17));
  ctx.restore();
}

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  countdown: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.48)";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.fillStyle = "#f5c400";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.min(150, size.width * 0.22)}px var(--font-oswald), sans-serif`;
  ctx.fillText(countdown > 0 ? String(countdown) : "BAŞLA", size.width / 2, size.height / 2);
  ctx.restore();
}

function drawFeedback(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  feedback: NonNullable<CanvasFeedback>,
): void {
  const color =
    feedback.tone === "hit"
      ? "#22c55e"
      : feedback.tone === "slow"
        ? "#f59e0b"
        : "#ef4444";
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.62)";
  ctx.fillRect(0, size.height * 0.38, size.width, size.height * 0.24);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.min(58, size.width * 0.1)}px var(--font-oswald), sans-serif`;
  ctx.fillText(feedback.text, size.width / 2, size.height / 2);
  ctx.restore();
}

const formatTime = (value: number | null): string =>
  value === null ? "—" : value.toFixed(1);
