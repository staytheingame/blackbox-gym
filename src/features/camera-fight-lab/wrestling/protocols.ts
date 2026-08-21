import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import type {
  HandFightTarget,
  MovementStimulus,
  ShotAttack,
  WrestlingDirection,
  WrestlingProtocolId,
  WrestlingStimulus,
} from "./protocolTypes";

export type WrestlingProtocolDefinition = {
  id: WrestlingProtocolId;
  version: string;
  phase: string;
  name: string;
  shortName: string;
  description: string;
  instruction: string;
  trialCount: number;
  t0Definition: string;
};

const p = PERFORMANCE_CONFIG.wrestling.protocols;
export const WRESTLING_PROTOCOLS: Record<WrestlingProtocolId, WrestlingProtocolDefinition> = {
  "shot-reaction": { id: "shot-reaction", version: "1.0.0", phase: "W1", name: "Shot Reaction", shortName: "Shot Reaction", description: "Sol single, sağ single ve double-leg cue'larına çok-eklemli yanıt süresi.", instruction: "Cue yönüne kontrollü savunma hareketiyle yanıt ver.", trialCount: p.shotTrialCount, t0Definition: "Abstract shot cue first visible frame." },
  "sprawl-reaction": { id: "sprawl-reaction", version: "1.0.0", phase: "W2", name: "Sprawl Reaction", shortName: "Sprawl", description: "Controlled sprawl onset, threshold ve stance recovery.", instruction: "Cue geldiğinde güvenli, kontrollü bir sprawl yap ve stance'e dön.", trialCount: p.sprawlTrialCount, t0Definition: "Shot cue first visible frame." },
  "wrestling-choice": { id: "wrestling-choice", version: "1.0.0", phase: "W3", name: "Wrestling Decision Reaction", shortName: "Wrestling Choice", description: "Attack cue'suna doğru wrestling response seçimi.", instruction: "Sol/sağ single cue'suna ilgili yönle, double-leg cue'suna kontrollü sprawl ile yanıt ver.", trialCount: p.choiceTrialCount, t0Definition: "Attack class and required response first visible frame." },
  "fake-real-recognition": { id: "fake-real-recognition", version: "1.0.0", phase: "W4", name: "Fake / Real", shortName: "Fake / Real", description: "Real shot defense ve fake cue restraint doğruluğu.", instruction: "REAL cue'da savun; FAKE cue'da stance'i kontrollü koru.", trialCount: p.recognitionTrialCount, t0Definition: "REAL_SHOT or FAKE cue first visible frame." },
  "movement-lab": { id: "movement-lab", version: "1.0.0", phase: "W5", name: "Movement Lab", shortName: "Movement", description: "Altı yönde stance movement onset, completion ve recovery.", instruction: "Komut yönüne kontrollü hareket et, ayaklarını çaprazlamadan stance'e dön.", trialCount: p.movementTrialCount, t0Definition: "Direction command first visible frame." },
  "stance-consistency": { id: "stance-consistency", version: "1.0.0", phase: "W6", name: "Stance Consistency", shortName: "Stance", description: "Hip height, torso angle, stance width ve body-center stabilitesi.", instruction: "Belirlenen blok boyunca kontrollü wrestling stance hareketini sürdür.", trialCount: 1, t0Definition: "Fixed stance block start frame." },
  "hand-fighting": { id: "hand-fighting", version: "1.0.0", phase: "W7", name: "Hand Fighting", shortName: "Hand Fighting", description: "Wrist control ve inside-control target reaksiyonu.", instruction: "Gösterilen hedefe doğru elle kontrollü temas et ve stance'e dön.", trialCount: p.handFightingTrialCount, t0Definition: "Target zone first visible frame." },
  "chain-wrestling": { id: "chain-wrestling", version: "1.0.0", phase: "W8", name: "Chain Wrestling", shortName: "Chain", description: "Configurable directional sequence timing.", instruction: "Gösterilen hareket sırasını kontrollü biçimde tamamla.", trialCount: p.chainTrialCount, t0Definition: "Sequence cue first visible frame." },
  scramble: { id: "scramble", version: "1.0.0", phase: "W9", name: "Scramble", shortName: "Scramble", description: "High-tempo random wrestling commands.", instruction: "Komutlara hızlı fakat güvenli ve kontrollü yanıt ver.", trialCount: 12, t0Definition: "Each command first visible frame." },
  "wrestling-fatigue": { id: "wrestling-fatigue", version: "1.0.0", phase: "W10", name: "Fatigue Response", shortName: "Fatigue", description: "Baseline, work, post ve optional recovery comparison.", instruction: "Blokları kontrollü tamamla; ağrı veya baş dönmesinde dur.", trialCount: 18, t0Definition: "Each nested cue first visible frame; block boundaries are explicit." },
  "virtual-wrestler": { id: "virtual-wrestler", version: "1.0.0", phase: "W11", name: "Virtual Wrestler", shortName: "Virtual", description: "Lightweight opponent with explicit timing events.", instruction: "Rakibin attack state'ine güvenli wrestling response ile yanıt ver.", trialCount: p.virtualTrialCount, t0Definition: "Protocol-configured cueStart or commitStart event." },
  "opponent-reading": { id: "opponent-reading", version: "1.0.0", phase: "W12", name: "Opponent Reading", shortName: "Opponent Reading", description: "Patterned fake/shot sequence recognition.", instruction: "Patterni oku; gerçek attack'lara yanıt ver, fake'lerde kontrollü kal.", trialCount: p.patternTrialCount, t0Definition: "Each pattern step's explicit cue event." },
  "weekly-benchmark": { id: "weekly-benchmark", version: "1.0.0", phase: "Benchmark", name: "Weekly Wrestling Benchmark", shortName: "Weekly Benchmark", description: "Stable fixed shot, recognition, sprawl, movement and recovery protocol.", instruction: "Sabit benchmark bloklarını aynı kamera kurulumu ile tamamla.", trialCount: 37, t0Definition: "Nested standardized protocol cue frame." },
  "coach-test": { id: "coach-test", version: "1.0.0", phase: "Custom", name: "Coach Test", shortName: "Coach Test", description: "Config-hashed custom wrestling protocol.", instruction: "Koçun ayarladığı protokole kontrollü yanıt ver.", trialCount: 10, t0Definition: "Custom config-defined visible cue frame." },
};

export const WRESTLING_PROTOCOL_LIST = Object.values(WRESTLING_PROTOCOLS);
export const ABSTRACT_WRESTLING_PROTOCOLS = WRESTLING_PROTOCOL_LIST.filter((protocol) => ["W1", "W2", "W3", "W4", "W5", "W6"].includes(protocol.phase));

export const responseForAttack = (attack: ShotAttack): WrestlingDirection =>
  attack === "LEFT_SINGLE" ? "LEFT" : attack === "RIGHT_SINGLE" ? "RIGHT" : "SPRAWL";

export function generateWrestlingStimulus(protocolId: WrestlingProtocolId, rng: () => number = Math.random): WrestlingStimulus {
  const attacks: readonly ShotAttack[] = ["LEFT_SINGLE", "RIGHT_SINGLE", "DOUBLE_LEG"];
  const attack = attacks[Math.min(Math.floor(rng() * attacks.length), attacks.length - 1)];
  if (protocolId === "shot-reaction") return { kind: "SHOT", attack, requiredDirection: responseForAttack(attack) };
  if (protocolId === "sprawl-reaction") return { kind: "SPRAWL", attack, requiredDirection: "SPRAWL" };
  if (protocolId === "wrestling-choice") return { kind: "CHOICE", attack, requiredDirection: responseForAttack(attack) };
  if (protocolId === "fake-real-recognition") {
    const real = rng() >= 0.4;
    return { kind: "RECOGNITION", cue: real ? "REAL_SHOT" : "FAKE", attack: real ? attack : null, requiredDirection: real ? responseForAttack(attack) : "RESTRAINT" };
  }
  if (protocolId === "movement-lab") {
    const commands: readonly MovementStimulus["command"][] = ["LEFT", "RIGHT", "FORWARD", "BACK", "CIRCLE_LEFT", "CIRCLE_RIGHT"];
    const command = commands[Math.min(Math.floor(rng() * commands.length), commands.length - 1)];
    return { kind: "MOVEMENT", command, requiredDirection: command };
  }
  if (protocolId === "stance-consistency") return { kind: "STANCE", durationMs: p.stanceBlockDurationMs };
  if (protocolId === "hand-fighting") {
    const targets: readonly HandFightTarget[] = ["LEFT_WRIST", "RIGHT_WRIST", "COLLAR_TIE", "INSIDE_CONTROL"];
    const target = targets[Math.min(Math.floor(rng() * targets.length), targets.length - 1)];
    return { kind: "HAND_FIGHTING", target, requiredHand: target === "LEFT_WRIST" ? "right" : target === "RIGHT_WRIST" ? "left" : "either" };
  }
  if (protocolId === "chain-wrestling") {
    const sequences: readonly (readonly WrestlingDirection[])[] = [["LEFT", "FORWARD"], ["RIGHT", "FORWARD"], ["LEVEL", "LEFT"], ["LEVEL", "RIGHT"]];
    return { kind: "CHAIN", sequence: sequences[Math.min(Math.floor(rng() * sequences.length), sequences.length - 1)] };
  }
  if (protocolId === "scramble") {
    const commands: readonly WrestlingDirection[] = ["LEFT", "RIGHT", "LEVEL", "SPRAWL", "STAND", "CIRCLE_LEFT", "CIRCLE_RIGHT"];
    return { kind: "SCRAMBLE", command: commands[Math.min(Math.floor(rng() * commands.length), commands.length - 1)] };
  }
  if (protocolId === "wrestling-fatigue") return { kind: "FATIGUE", block: "A_BASELINE", nested: { kind: "SHOT", attack, requiredDirection: responseForAttack(attack) } };
  if (protocolId === "virtual-wrestler") {
    const cueStart = typeof performance === "undefined" ? 0 : performance.now();
    return { kind: "VIRTUAL_WRESTLER", attack, difficulty: 1, events: { cueStart, commitStart: cueStart + 600, attackThreshold: cueStart + 900, recoveryEnd: cueStart + 1_320 } };
  }
  if (protocolId === "opponent-reading") return { kind: "PATTERN", patternId: "fake-double", sequence: ["FAKE", "DOUBLE_LEG"], requiredResponses: ["RESTRAINT", "SPRAWL"] };
  return { kind: "SHOT", attack, requiredDirection: responseForAttack(attack) };
}

export function wrestlingProtocolConfigHash(protocolId: WrestlingProtocolId, customConfig?: unknown): string {
  const serialized = JSON.stringify({ protocol: WRESTLING_PROTOCOLS[protocolId], wrestling: PERFORMANCE_CONFIG.wrestling, customConfig: customConfig ?? null });
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
