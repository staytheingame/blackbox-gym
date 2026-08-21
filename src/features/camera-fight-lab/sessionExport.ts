import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { PROTOCOLS, protocolConfigHash } from "./protocols";
import type {
  AudioMode,
  CalibrationSnapshot,
  CameraSnapshot,
  SessionExport,
  SessionSummary,
  ProtocolId,
  TrialResult,
} from "./types";

export type SessionExportInput = {
  sessionId: string;
  label: string;
  startedAt: string;
  endedAt: string;
  protocolId: ProtocolId;
  camera: CameraSnapshot;
  calibration: CalibrationSnapshot;
  estimatedPoseFps: number;
  estimatedVideoFps: number;
  trials: TrialResult[];
  summary: SessionSummary;
  audioMode: AudioMode;
  environment?: SessionExport["environment"];
};

export const createSessionId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `blackbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function browserEnvironment(): SessionExport["environment"] {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      userAgent: "unknown",
      language: "unknown",
      screen: { width: 0, height: 0, devicePixelRatio: 1 },
    };
  }
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
    },
  };
}

export function buildSessionExport(input: SessionExportInput): SessionExport {
  const protocol = PROTOCOLS[input.protocolId];
  const configHash = protocolConfigHash(input.protocolId);
  return {
    schemaVersion: PERFORMANCE_CONFIG.schemaVersion,
    appVersion: PERFORMANCE_CONFIG.appVersion,
    sessionId: input.sessionId,
    label: input.label.trim() || null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    protocol: {
      protocolId: protocol.id,
      protocolVersion: protocol.version,
      configHash,
      name: protocol.name,
    },
    timingConvention: `T0: ${protocol.t0Definition} T1 ve T2, aynı monotonic zaman alanındaki pose video-frame timestamp'larını kullanır. NO_GO correct reject, belgelenmiş inhibition penceresinin performance.now() bitiş timestamp'ını decisionCompletedAtMs alanına yazar.`,
    environment: input.environment ?? browserEnvironment(),
    camera: input.camera,
    processing: {
      estimatedPoseFps: input.estimatedPoseFps,
      estimatedVideoFps: input.estimatedVideoFps,
    },
    calibration: input.calibration,
    config: { hash: configHash, snapshot: PERFORMANCE_CONFIG },
    trials: input.trials,
    summary: input.summary,
    audio: { mode: input.audioMode, spokenCues: input.audioMode === "voice" },
  };
}

export function downloadSessionJson(session: SessionExport): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `blackbox-fight-lab-${session.sessionId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
