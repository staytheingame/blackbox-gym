import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { comboLabel, comboPresetIdForSequence, COMBO_PRESETS, pickComboPreset } from "./comboEngine";
import type { CanvasSize } from "./coordinates";
import { defenseActionLabel, pickDefenseAction } from "./defenseEngine";
import {
  createDefenseCueTarget,
  createPeripheralTarget,
  createTarget,
  randomDelayMs,
  type Rng,
} from "./trialGenerator";
import {
  pickVirtualOpponentAttack,
  pickVirtualOpponentTempoLevel,
  virtualOpponentResponseChannelForAttack,
} from "./virtualOpponentEngine";
import type {
  CalibrationSnapshot,
  Hand,
  PeripheralZone,
  ProtocolId,
  TargetSnapshot,
  TrialStimulus,
} from "./types";

export type ProtocolDefinition = {
  id: ProtocolId;
  version: string;
  name: string;
  shortName: string;
  description: string;
  instruction: string;
  trialCount: number;
  t0Definition: string;
};

export const PROTOCOLS: Record<ProtocolId, ProtocolDefinition> = {
  "full-reaction": {
    id: "full-reaction",
    version: "1.0.0",
    name: "Full Reaction Test",
    shortName: "Full Reaction",
    description: "20 hedefte reaction, movement, total response, accuracy ve sağ/sol farkı.",
    instruction: "Sarı hedefe istediğin elinle kontrollü ve hızlı bir düz yumruk at.",
    trialCount: PERFORMANCE_CONFIG.session.trialCount,
    t0Definition: "Canvas hedefinin ilk requestAnimationFrame çiziminden hemen önceki performance.now() timestamp'ı.",
  },
  "choice-reaction": {
    id: "choice-reaction",
    version: "1.0.0",
    name: "Choice Reaction",
    shortName: "Choice",
    description: "Mavi SOL, pembe SAĞ cue'suna doğru elle yanıt ver; hız ve karar doğruluğunu ölç.",
    instruction: "Hedefte yazan eli kullan: mavi SOL, pembe SAĞ. Aynalı görüntü el mantığını değiştirmez.",
    trialCount: PERFORMANCE_CONFIG.decision.choiceTrialCount,
    t0Definition: "El cue'su ve hedefin aynı canvas frame'inde ilk görünmesinden hemen önceki performance.now() timestamp'ı.",
  },
  "go-no-go": {
    id: "go-no-go",
    version: "1.0.0",
    name: "Go / No-Go",
    shortName: "Go / No-Go",
    description: "VUR cue'sunda yumruk at; DUR cue'sunda inhibition penceresi boyunca guard'da kal.",
    instruction: "Yeşil VUR hedefinde yumruk at. Kırmızı DUR hedefinde hiç hareket başlatma.",
    trialCount: PERFORMANCE_CONFIG.decision.goNoGoTrialCount,
    t0Definition: "VUR veya DUR cue'sunun canvas üzerinde ilk çizildiği frame'den hemen önceki performance.now() timestamp'ı.",
  },
  "peripheral-reaction": {
    id: "peripheral-reaction",
    version: "1.0.0",
    name: "Peripheral Reaction",
    shortName: "Peripheral",
    description: "Merkez işaretine yönelirken center, inner ve outer yan hedeflere yanıt ver.",
    instruction: "Bakışını merkez artıda tut; yan hedefe istediğin elinle kontrollü ve hızlı vur.",
    trialCount: PERFORMANCE_CONFIG.decision.peripheralTrialCount,
    t0Definition: "Peripheral hedefin canvas üzerinde ilk çizildiği frame'den hemen önceki performance.now() timestamp'ı.",
  },
  "combo-speed": {
    id: "combo-speed",
    version: "1.0.0",
    name: "Combo Speed",
    shortName: "Combo Speed",
    description: "Tek hedefe konfigüre edilebilir el sırasıyla (Sol-Sağ, Sağ-Sol-Sağ vb.) art arda vur; sıra doğruluğu ve inter-punch süresini ölç.",
    instruction: "Hedefte gösterilen el sırasını takip et: her yumruktan sonra eli geri çek, sonraki eli hedefe gönder.",
    trialCount: PERFORMANCE_CONFIG.phase2.comboTrialCount,
    t0Definition: "Hedefin ve ilk el adımının canvas üzerinde ilk çizildiği frame'den hemen önceki performance.now() timestamp'ı.",
  },
  "guard-return": {
    id: "guard-return",
    version: "1.0.0",
    name: "Guard Return",
    shortName: "Guard Return",
    description: "Hedefe vur, ardından elini kalibre edilmiş guard bölgesine stabil biçimde geri getir; T3 dönüş süresini ölç.",
    instruction: "Hedefe kontrollü ve hızlı vur, hemen ardından elini guard pozisyonuna geri çek ve orada sabit tut.",
    trialCount: PERFORMANCE_CONFIG.phase2.guardReturnTrialCount,
    t0Definition: "Hedefin canvas üzerinde ilk çizildiği frame'den hemen önceki performance.now() timestamp'ı.",
  },
  "defense-reflex": {
    id: "defense-reflex",
    version: "1.0.0",
    name: "Defense Reflex",
    shortName: "Defense",
    description: "Sola slip, sağa slip veya duck cue'suna doğru vücut hareketiyle yanıt ver; yön, displacement ve stabil toparlanmayı ölç.",
    instruction: "Cue'da yazan hareketi yap: SOLA SLIP, SAĞA SLIP veya DUCK. Hareketten hemen sonra nötr pozisyona dön ve orada sabit kal.",
    trialCount: PERFORMANCE_CONFIG.phase3.defenseTrialCount,
    t0Definition: "Defense cue'sunun canvas üzerinde ilk çizildiği frame'den hemen önceki performance.now() timestamp'ı.",
  },
  "virtual-opponent": {
    id: "virtual-opponent",
    version: "1.0.0",
    name: "Virtual Opponent",
    shortName: "Virtual Opponent",
    description: "Rakip iki profilden birini rastgele ve değişken tempoda telegraph eder; rakip vurmadan önce doğru kontra veya savunmayla yanıt ver.",
    instruction: "Rakip kontra istiyorsa hedefe doğru elle vur; savunma istiyorsa SOLA SLIP, SAĞA SLIP veya DUCK yap — ama rakibin saldırısı inmeden önce tamamla.",
    trialCount: PERFORMANCE_CONFIG.phase4.virtualOpponentTrialCount,
    t0Definition: "Rakip cue'sunun canvas üzerinde ilk çizildiği frame'den hemen önceki performance.now() timestamp'ı.",
  },
};

export const PROTOCOL_LIST = Object.values(PROTOCOLS);
export const DEFAULT_PROTOCOL_ID: ProtocolId = "full-reaction";

export type GeneratedProtocolTrial = {
  target: TargetSnapshot;
  targetDelayMs: number;
  stimulus: TrialStimulus;
};

export function createProtocolTrial(input: {
  protocolId: ProtocolId;
  calibration: CalibrationSnapshot;
  canvas: CanvasSize;
  previousZoneIndex: number | null;
  previousStimuli: readonly TrialStimulus[];
  rng?: Rng;
}): GeneratedProtocolTrial {
  const rng = input.rng ?? Math.random;
  const targetDelayMs = randomDelayMs(rng);

  if (input.protocolId === "choice-reaction") {
    const hand: Hand = rng() < 0.5 ? "left" : "right";
    return {
      targetDelayMs,
      target: createTarget(input.calibration, input.canvas, input.previousZoneIndex, rng),
      stimulus: baseStimulus({
        kind: "CHOICE",
        requiredHand: hand,
        cueLabel: hand === "left" ? "SOL" : "SAĞ",
        cueColor: hand === "left" ? "#38bdf8" : "#fb7185",
      }),
    };
  }

  if (input.protocolId === "go-no-go") {
    const recent = input.previousStimuli.slice(-PERFORMANCE_CONFIG.decision.maxConsecutiveNoGo);
    const forceGo =
      recent.length === PERFORMANCE_CONFIG.decision.maxConsecutiveNoGo &&
      recent.every((stimulus) => stimulus.kind === "NO_GO");
    const noGo = !forceGo && rng() < PERFORMANCE_CONFIG.decision.noGoProbability;
    return {
      targetDelayMs,
      target: createTarget(input.calibration, input.canvas, input.previousZoneIndex, rng),
      stimulus: baseStimulus({
        kind: noGo ? "NO_GO" : "GO",
        requiredHand: noGo ? "none" : "either",
        cueLabel: noGo ? "DUR" : "VUR",
        cueColor: noGo ? "#ef4444" : "#22c55e",
        inhibitionWindowMs: noGo
          ? PERFORMANCE_CONFIG.decision.noGoInhibitionWindowMs
          : null,
      }),
    };
  }

  if (input.protocolId === "peripheral-reaction") {
    const previousZone = input.previousStimuli.at(-1)?.peripheralZone ?? null;
    const candidates = PERFORMANCE_CONFIG.decision.peripheralZones.filter(
      (zone) => zone.id !== previousZone,
    );
    const zone = candidates[Math.min(Math.floor(rng() * candidates.length), candidates.length - 1)];
    return {
      targetDelayMs,
      target: createPeripheralTarget(input.calibration, input.canvas, zone),
      stimulus: baseStimulus({
        kind: "PERIPHERAL",
        requiredHand: "either",
        cueLabel: "VUR",
        cueColor: "#f5c400",
        peripheralZone: zone.id as PeripheralZone,
        peripheralSide: zone.side,
        peripheralEccentricity: zone.eccentricity,
      }),
    };
  }

  if (input.protocolId === "combo-speed") {
    const previousPreset = comboPresetIdForSequence(
      input.previousStimuli.at(-1)?.comboSequence ?? null,
    );
    const sequence = COMBO_PRESETS[pickComboPreset(previousPreset, rng)];
    return {
      targetDelayMs,
      target: createTarget(input.calibration, input.canvas, input.previousZoneIndex, rng),
      stimulus: baseStimulus({
        kind: "COMBO",
        requiredHand: "either",
        cueLabel: comboLabel(sequence),
        cueColor: "#f5c400",
        comboSequence: sequence,
      }),
    };
  }

  if (input.protocolId === "guard-return") {
    return {
      targetDelayMs,
      target: createTarget(input.calibration, input.canvas, input.previousZoneIndex, rng),
      stimulus: baseStimulus({
        kind: "GUARD_RETURN",
        requiredHand: "either",
        cueLabel: "VUR",
        cueColor: "#f5c400",
      }),
    };
  }

  if (input.protocolId === "defense-reflex") {
    const previousAction = input.previousStimuli.at(-1)?.defenseAction ?? null;
    const action = pickDefenseAction(previousAction, rng);
    return {
      targetDelayMs,
      target: createDefenseCueTarget(input.calibration, input.canvas),
      stimulus: baseStimulus({
        kind: "DEFENSE",
        requiredHand: "either",
        cueLabel: defenseActionLabel(action),
        cueColor: "#ef4444",
        defenseAction: action,
      }),
    };
  }

  if (input.protocolId === "virtual-opponent") {
    const previousAttack = input.previousStimuli.at(-1)?.virtualOpponentAttackType ?? null;
    const attack = pickVirtualOpponentAttack(previousAttack, rng);
    const responseChannel = virtualOpponentResponseChannelForAttack(attack);
    const tempoLevel = pickVirtualOpponentTempoLevel(rng);

    if (responseChannel === "COUNTER") {
      const hand: Hand = rng() < 0.5 ? "left" : "right";
      return {
        targetDelayMs,
        target: createTarget(input.calibration, input.canvas, input.previousZoneIndex, rng),
        stimulus: baseStimulus({
          kind: "VIRTUAL_OPPONENT",
          requiredHand: "either",
          cueLabel: comboLabel([hand]),
          cueColor: "#f5c400",
          comboSequence: [hand],
          virtualOpponentAttackType: attack,
          virtualOpponentResponseChannel: responseChannel,
          virtualOpponentTempoLevel: tempoLevel,
        }),
      };
    }

    const action = pickDefenseAction(null, rng);
    return {
      targetDelayMs,
      target: createDefenseCueTarget(input.calibration, input.canvas),
      stimulus: baseStimulus({
        kind: "VIRTUAL_OPPONENT",
        requiredHand: "either",
        cueLabel: defenseActionLabel(action),
        cueColor: "#ef4444",
        defenseAction: action,
        virtualOpponentAttackType: attack,
        virtualOpponentResponseChannel: responseChannel,
        virtualOpponentTempoLevel: tempoLevel,
      }),
    };
  }

  return {
    targetDelayMs,
    target: createTarget(input.calibration, input.canvas, input.previousZoneIndex, rng),
    stimulus: baseStimulus({
      kind: "SIMPLE",
      requiredHand: "either",
      cueLabel: "VUR",
      cueColor: "#f5c400",
    }),
  };
}

export function protocolConfigHash(protocolId: ProtocolId): string {
  const serialized = JSON.stringify({
    protocol: PROTOCOLS[protocolId],
    measurement: PERFORMANCE_CONFIG,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function baseStimulus(
  overrides: Partial<TrialStimulus> &
    Pick<TrialStimulus, "kind" | "requiredHand" | "cueLabel" | "cueColor">,
): TrialStimulus {
  return {
    peripheralZone: null,
    peripheralSide: null,
    peripheralEccentricity: null,
    inhibitionWindowMs: null,
    comboSequence: null,
    defenseAction: null,
    virtualOpponentAttackType: null,
    virtualOpponentResponseChannel: null,
    virtualOpponentTempoLevel: null,
    ...overrides,
  };
}
