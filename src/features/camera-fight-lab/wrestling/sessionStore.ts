import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import type { CameraSnapshot } from "../types";
import { browserEnvironment, createSessionId } from "../sessionExport";
import { WRESTLING_PROTOCOLS, wrestlingProtocolConfigHash } from "./protocols";
import type { WrestlingCalibrationSnapshot } from "./types";
import type { WrestlingProtocolId, WrestlingSession, WrestlingSessionSummary, WrestlingTrial } from "./protocolTypes";

const DB_NAME = "blackbox-fight-lab";
const STORE_NAME = "wrestling-sessions";
const DB_VERSION = 1;
const ATHLETE_KEY = "blackbox-wrestling-athlete-id/v1";

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Wrestling session database could not be opened."));
});

export function localAthleteId(): string {
  if (typeof window === "undefined") return "anonymous-server";
  const existing = window.localStorage.getItem(ATHLETE_KEY);
  if (existing) return existing;
  const created = createSessionId();
  window.localStorage.setItem(ATHLETE_KEY, created);
  return created;
}

export async function saveWrestlingSession(session: WrestlingSession): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Wrestling session could not be saved."));
  });
  database.close();
}

export async function listWrestlingSessions(athleteId: string): Promise<WrestlingSession[]> {
  const database = await openDatabase();
  const records = await new Promise<WrestlingSession[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as WrestlingSession[]).filter((session) => session.athleteId === athleteId));
    request.onerror = () => reject(request.error ?? new Error("Wrestling sessions could not be read."));
  });
  database.close();
  return records.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function createWrestlingSession(input: {
  sessionId?: string;
  athleteId: string;
  label: string;
  startedAt: string;
  endedAt: string;
  protocolId: WrestlingProtocolId;
  camera: CameraSnapshot;
  calibration: WrestlingCalibrationSnapshot;
  trials: WrestlingTrial[];
  summary: WrestlingSessionSummary;
  customConfig?: unknown;
}): WrestlingSession {
  const protocol = WRESTLING_PROTOCOLS[input.protocolId];
  return {
    schemaVersion: PERFORMANCE_CONFIG.wrestling.schemaVersion,
    sport: "wrestling",
    sessionId: input.sessionId ?? createSessionId(),
    athleteId: input.athleteId,
    label: input.label.trim() || null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    protocolId: input.protocolId,
    protocolVersion: protocol.version,
    configHash: wrestlingProtocolConfigHash(input.protocolId, input.customConfig),
    cameraMetadata: input.camera,
    calibrationSnapshot: input.calibration,
    configSnapshot: { wrestling: PERFORMANCE_CONFIG.wrestling, customConfig: input.customConfig ?? null, environment: browserEnvironment() },
    rawTrials: input.trials,
    summary: input.summary,
    qualityFlags: input.summary.qualityFlags,
  };
}

export function downloadWrestlingSession(session: WrestlingSession): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `blackbox-wrestling-lab-${session.sessionId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
