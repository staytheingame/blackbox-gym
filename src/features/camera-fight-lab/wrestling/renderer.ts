import { POSE_CONNECTIONS } from "@/lib/pose/landmarker";
import { imageToDisplayCanvas, type CanvasSize } from "../coordinates";
import type { PoseSample, TargetSnapshot } from "../types";
import type { WrestlingMotionSnapshot, WrestlingStimulus } from "./protocolTypes";
import type { WrestlingCalibrationSnapshot } from "./types";

type WrestlingRenderModel = {
  pose: PoseSample | null;
  calibration: WrestlingCalibrationSnapshot | null;
  stimulus: WrestlingStimulus | null;
  target: TargetSnapshot | null;
  motion: WrestlingMotionSnapshot | null;
  debug: boolean;
  t0Ms: number | null;
  t1Ms: number | null;
  t2Ms: number | null;
  t3Ms: number | null;
  processingFps: number;
};

export function renderWrestlingCanvas(canvas: HTMLCanvasElement, model: WrestlingRenderModel): CanvasSize {
  const rect = canvas.getBoundingClientRect();
  const size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(size.width * dpr);
  const pixelHeight = Math.round(size.height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
  const context = canvas.getContext("2d");
  if (!context) return size;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  if (model.debug && model.pose) drawSkeleton(context, model.pose, size);
  if (model.debug && model.calibration) drawBaseline(context, model.calibration, size);
  if (model.target) drawTarget(context, model.target);
  if (model.debug) drawDiagnostics(context, model, size);
  return size;
}

const points = [
  [0, "nose"], [11, "leftShoulder"], [12, "rightShoulder"], [13, "leftElbow"], [14, "rightElbow"],
  [15, "leftWrist"], [16, "rightWrist"], [23, "leftHip"], [24, "rightHip"], [25, "leftKnee"],
  [26, "rightKnee"], [27, "leftAnkle"], [28, "rightAnkle"], [29, "leftHeel"], [30, "rightHeel"],
  [31, "leftFootIndex"], [32, "rightFootIndex"],
] as const;

function drawSkeleton(context: CanvasRenderingContext2D, pose: PoseSample, size: CanvasSize): void {
  const mapped = new Map<number, { x: number; y: number; visibility: number }>();
  for (const [index, key] of points) {
    const point = pose.image[key];
    if (!point) continue;
    mapped.set(index, { ...imageToDisplayCanvas(point, size), visibility: pose.visibility[key] });
  }
  context.save();
  context.strokeStyle = "rgba(250, 204, 21, .8)";
  context.lineWidth = 2;
  for (const [from, to] of POSE_CONNECTIONS) {
    const a = mapped.get(from); const b = mapped.get(to);
    if (!a || !b || a.visibility < 0.3 || b.visibility < 0.3) continue;
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
  }
  for (const [index, point] of mapped) {
    context.fillStyle = [23, 24].includes(index) ? "#22c55e" : [25, 26].includes(index) ? "#38bdf8" : [15, 16].includes(index) ? "#fb7185" : "#facc15";
    context.beginPath(); context.arc(point.x, point.y, [15, 16, 23, 24, 25, 26].includes(index) ? 5 : 3, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

function drawBaseline(context: CanvasRenderingContext2D, calibration: WrestlingCalibrationSnapshot, size: CanvasSize): void {
  const hip = imageToDisplayCanvas(calibration.hipCenterImage, size);
  const body = imageToDisplayCanvas(calibration.bodyCenterImage, size);
  const leftAnkle = imageToDisplayCanvas(calibration.leftAnkleBaselineImage, size);
  const rightAnkle = imageToDisplayCanvas(calibration.rightAnkleBaselineImage, size);
  context.save();
  context.setLineDash([5, 5]); context.strokeStyle = "rgba(34, 197, 94, .8)"; context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(leftAnkle.x, leftAnkle.y); context.lineTo(rightAnkle.x, rightAnkle.y); context.stroke();
  for (const [point, label] of [[hip, "HIP"], [body, "CENTER"]] as const) {
    context.beginPath(); context.arc(point.x, point.y, 11, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#bbf7d0"; context.font = "10px ui-monospace"; context.fillText(label, point.x + 14, point.y - 8);
  }
  context.restore();
}

function drawTarget(context: CanvasRenderingContext2D, target: TargetSnapshot): void {
  context.save(); context.strokeStyle = "#facc15"; context.fillStyle = "rgba(250, 204, 21, .18)"; context.lineWidth = 4;
  context.beginPath(); context.arc(target.displayX, target.displayY, target.radiusPx, 0, Math.PI * 2); context.fill(); context.stroke(); context.restore();
}

function drawDiagnostics(context: CanvasRenderingContext2D, model: WrestlingRenderModel, size: CanvasSize): void {
  const motion = model.motion;
  const lines = [
    `FPS ${model.processingFps.toFixed(1)} · ${model.stimulus?.kind ?? "CALIBRATION"}`,
    `HIP Δ ${motion?.hipHeightDeltaNormalized.toFixed(3) ?? "—"} · TORSO Δ ${motion?.torsoAngleDeltaDeg.toFixed(1) ?? "—"}°`,
    `CENTER v ${motion?.compositeVelocity.toFixed(2) ?? "—"} · DIR ${motion?.detectedDirection ?? "—"}`,
    `T0 ${format(model.t0Ms)} · T1 ${format(model.t1Ms)} · T2 ${format(model.t2Ms)} · T3 ${format(model.t3Ms)}`,
  ];
  context.save(); context.fillStyle = "rgba(0,0,0,.76)"; context.fillRect(12, 12, Math.min(520, size.width - 24), 82);
  context.fillStyle = "#facc15"; context.font = "11px ui-monospace";
  lines.forEach((line, index) => context.fillText(line, 20, 30 + index * 17)); context.restore();
}

const format = (value: number | null): string => value === null ? "—" : value.toFixed(0);
