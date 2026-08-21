import type { TargetSnapshot, TrialResult, TrialStimulus } from "./types";

export type GameStatus =
  | "BOOT"
  | "CAMERA_PERMISSION"
  | "CAMERA_READY"
  | "CALIBRATION"
  | "READY"
  | "COUNTDOWN"
  | "WAITING_FOR_TARGET"
  | "TARGET_ACTIVE"
  | "TRIAL_COMPLETE"
  | "SESSION_COMPLETE"
  | "PAUSED"
  | "ERROR";

export type PendingTrial = {
  trialIndex: number;
  target: TargetSnapshot;
  targetDelayMs: number;
  t0Ms: number | null;
  stimulus: TrialStimulus;
};

export type GameState = {
  status: GameStatus;
  trialIndex: number;
  pendingTrial: PendingTrial | null;
  results: TrialResult[];
  error: string | null;
  resumeStatus: GameStatus | null;
};

export const INITIAL_GAME_STATE: GameState = {
  status: "BOOT",
  trialIndex: 0,
  pendingTrial: null,
  results: [],
  error: null,
  resumeStatus: null,
};

export type GameEvent =
  | { type: "START" }
  | { type: "CAMERA_GRANTED" }
  | { type: "BEGIN_CALIBRATION" }
  | { type: "CALIBRATION_PASSED" }
  | { type: "START_SESSION" }
  | { type: "COUNTDOWN_DONE" }
  | { type: "PREPARE_TRIAL"; trial: PendingTrial }
  | { type: "TARGET_SHOWN"; t0Ms: number }
  | { type: "TRIAL_FINISHED"; result: TrialResult }
  | { type: "NEXT_TRIAL"; trialCount: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "FAIL"; error: string }
  | { type: "RESTART" };

export function transitionGameState(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "START":
      return state.status === "BOOT"
        ? { ...state, status: "CAMERA_PERMISSION", error: null }
        : state;
    case "CAMERA_GRANTED":
      return state.status === "CAMERA_PERMISSION"
        ? { ...state, status: "CAMERA_READY" }
        : state;
    case "BEGIN_CALIBRATION":
      return state.status === "CAMERA_READY"
        ? { ...state, status: "CALIBRATION" }
        : state;
    case "CALIBRATION_PASSED":
      return state.status === "CALIBRATION" ? { ...state, status: "READY" } : state;
    case "START_SESSION":
      return state.status === "READY"
        ? { ...state, status: "COUNTDOWN", results: [], trialIndex: 0, pendingTrial: null }
        : state;
    case "COUNTDOWN_DONE":
      return state.status === "COUNTDOWN"
        ? { ...state, status: "WAITING_FOR_TARGET" }
        : state;
    case "PREPARE_TRIAL":
      return state.status === "WAITING_FOR_TARGET"
        ? { ...state, pendingTrial: event.trial }
        : state;
    case "TARGET_SHOWN":
      return state.status === "WAITING_FOR_TARGET" && state.pendingTrial
        ? {
            ...state,
            status: "TARGET_ACTIVE",
            pendingTrial: { ...state.pendingTrial, t0Ms: event.t0Ms },
          }
        : state;
    case "TRIAL_FINISHED":
      return state.status === "TARGET_ACTIVE"
        ? { ...state, status: "TRIAL_COMPLETE", results: [...state.results, event.result] }
        : state;
    case "NEXT_TRIAL": {
      if (state.status !== "TRIAL_COMPLETE") return state;
      const nextIndex = state.trialIndex + 1;
      if (nextIndex >= event.trialCount) {
        return { ...state, status: "SESSION_COMPLETE", pendingTrial: null };
      }
      return {
        ...state,
        status: "WAITING_FOR_TARGET",
        trialIndex: nextIndex,
        pendingTrial: null,
      };
    }
    case "PAUSE":
      return ["COUNTDOWN", "WAITING_FOR_TARGET", "TARGET_ACTIVE"].includes(state.status)
        ? { ...state, status: "PAUSED", resumeStatus: state.status }
        : state;
    case "RESUME":
      return state.status === "PAUSED" && state.resumeStatus
        ? { ...state, status: state.resumeStatus, resumeStatus: null }
        : state;
    case "FAIL":
      return { ...state, status: "ERROR", error: event.error };
    case "RESTART":
      return { ...INITIAL_GAME_STATE };
  }
}
