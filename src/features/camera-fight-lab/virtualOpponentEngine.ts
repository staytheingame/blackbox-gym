import { PERFORMANCE_CONFIG } from "@/config/performanceConfig";
import { ComboSequenceTracker } from "./comboEngine";
import { DefenseReflexTracker } from "./defenseEngine";
import { roundMetric } from "./statistics";
import type {
  ComboTrialResult,
  DefenseAction,
  DefenseTrialResult,
  Hand,
  HeadObservation,
  TargetSnapshot,
  Vec2,
  VirtualOpponentAttackType,
  VirtualOpponentOutcome,
  VirtualOpponentResponseChannel,
  VirtualOpponentTempoLevel,
  VirtualOpponentTimeline,
  VirtualOpponentTrialResult,
  WristObservation,
} from "./types";

export const VIRTUAL_OPPONENT_ATTACKS: readonly VirtualOpponentAttackType[] = [
  "PUNCH_COMBO",
  "DEFEND_CUE",
];

export function virtualOpponentAttackLabel(attack: VirtualOpponentAttackType): string {
  return attack === "PUNCH_COMBO" ? "RAKİP · KONTRA GEREKİYOR" : "RAKİP · SAVUN GEREKİYOR";
}

/** PUNCH_COMBO → COUNTER (ComboSequenceTracker); DEFEND_CUE → DEFEND (DefenseReflexTracker). */
export function virtualOpponentResponseChannelForAttack(
  attack: VirtualOpponentAttackType,
): VirtualOpponentResponseChannel {
  return attack === "PUNCH_COMBO" ? "COUNTER" : "DEFEND";
}

export function pickVirtualOpponentAttack(
  previousAttack: VirtualOpponentAttackType | null,
  rng: () => number = Math.random,
): VirtualOpponentAttackType {
  const candidates = VIRTUAL_OPPONENT_ATTACKS.filter((attack) => attack !== previousAttack);
  const pool = candidates.length > 0 ? candidates : VIRTUAL_OPPONENT_ATTACKS;
  const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  return pool[index];
}

const TEMPO_LEVELS: readonly VirtualOpponentTempoLevel[] = [1, 2, 3];

export function pickVirtualOpponentTempoLevel(
  rng: () => number = Math.random,
): VirtualOpponentTempoLevel {
  const index = Math.min(Math.floor(rng() * TEMPO_LEVELS.length), TEMPO_LEVELS.length - 1);
  return TEMPO_LEVELS[index];
}

/**
 * cueStart→commit ve commit→land gecikmeleri tempo başına sabit bir taban
 * değerden ve küçük bir jitter'dan türetilir (Wrestling'in
 * buildVirtualWrestlerStimulus'ndaki cueStart→commit→threshold zaman
 * çizelgesi şekline gevşek biçimde benzer, ama boks'un iki-kanallı tasarımına
 * uyarlanmıştır; wrestling'in difficulty-progression semantiği kopyalanmamıştır
 * — tempo her trial'da rastgele seçilir, adaptif değildir).
 */
export function buildVirtualOpponentTimeline(
  cueStartMs: number,
  tempoLevel: VirtualOpponentTempoLevel,
  rng: () => number = Math.random,
): VirtualOpponentTimeline {
  const tempo = PERFORMANCE_CONFIG.phase4.virtualOpponentTempo[tempoLevel];
  const jitter = PERFORMANCE_CONFIG.phase4.virtualOpponentTempoJitterMs;
  const commitJitter = (rng() * 2 - 1) * jitter;
  const landJitter = (rng() * 2 - 1) * jitter;
  const commitDelayMs = Math.max(120, tempo.commitDelayMs + commitJitter);
  const landDelayMs = Math.max(150, tempo.landDelayMs + landJitter);
  const attackCommitMs = cueStartMs + commitDelayMs;
  const attackLandMs = attackCommitMs + landDelayMs;
  return { attackCommitMs, attackLandMs };
}

/**
 * Tek bir virtual-opponent trial'ını izleyen saf wrapper state machine.
 * `onsetDetector.ts`, `hitDetector.ts`, `comboEngine.ts` ve `defenseEngine.ts`
 * değiştirilmez; bu sınıf yalnız bunları sarar. Saldırı tipine göre gerekli
 * response kanalı belirlenir: PUNCH_COMBO → COUNTER (ComboSequenceTracker,
 * tek adımlık ["left"]/["right"] sekansıyla), DEFEND_CUE → DEFEND
 * (DefenseReflexTracker). `attackLandMs`, doğru kanalın tamamlanması gereken
 * hard deadline'dır; `attackLandMs + phase4.virtualOpponentGraceMs` dış grace
 * penceresidir — bu pencere `checkDeadline`/`finishExternally` ile zorla
 * kapatılır (guard-return/defense-reflex'teki dış timeout deseniyle aynı).
 */
export class VirtualOpponentTracker {
  private readonly comboTracker: ComboSequenceTracker | null = null;
  private readonly defenseTracker: DefenseReflexTracker | null = null;
  private resolved: VirtualOpponentTrialResult | null = null;

  constructor(
    private readonly attackType: VirtualOpponentAttackType,
    private readonly responseChannel: VirtualOpponentResponseChannel,
    requiredResponse: readonly Hand[] | DefenseAction,
    private readonly t0Ms: number,
    private readonly tempoLevel: VirtualOpponentTempoLevel,
    private readonly timeline: VirtualOpponentTimeline,
    shoulderWidthNormalized = 0.2,
  ) {
    if (responseChannel === "COUNTER") {
      this.comboTracker = new ComboSequenceTracker(requiredResponse as readonly Hand[], t0Ms);
    } else {
      this.defenseTracker = new DefenseReflexTracker(
        requiredResponse as DefenseAction,
        t0Ms,
        shoulderWidthNormalized,
      );
    }
  }

  get isFinished(): boolean {
    return this.resolved !== null;
  }

  /** attackLandMs + grace penceresi; bu ana kadar dönüş yoksa dış zaman aşımı tetiklenmelidir. */
  get graceDeadlineMs(): number {
    return this.timeline.attackLandMs + PERFORMANCE_CONFIG.phase4.virtualOpponentGraceMs;
  }

  /**
   * Tek bir video frame'inin sol/sağ bilek ve baş gözlemlerini, gerekli
   * kanala göre sarılan tracker'a yönlendirir. `target`/`neutralDisplay`,
   * diğer protokollerle aynı şekilde o anki canvas boyutuna göre her çağrıda
   * taze verilir.
   */
  update(input: {
    left: WristObservation | null;
    right: WristObservation | null;
    head: HeadObservation | null;
    target: TargetSnapshot;
    neutralDisplay: Vec2;
    canvasWidth: number;
    canvasHeight: number;
  }): VirtualOpponentTrialResult | null {
    if (this.resolved) return this.resolved;

    if (this.comboTracker) {
      const combo = this.comboTracker.update({ left: input.left, right: input.right }, input.target);
      if (combo) this.finishFromCombo(combo);
    } else if (this.defenseTracker && input.head) {
      const defense = this.defenseTracker.update(
        input.head,
        input.neutralDisplay,
        input.canvasWidth,
        input.canvasHeight,
      );
      if (defense) this.finishFromDefense(defense);
    }

    return this.resolved;
  }

  /** Her frame/tick çağrılarak dış grace-window deadline'ını denetler. */
  checkDeadline(nowMs: number): VirtualOpponentTrialResult | null {
    if (this.resolved) return this.resolved;
    if (nowMs >= this.graceDeadlineMs) this.resolveFromTimeout(nowMs);
    return this.resolved;
  }

  /** Trial dışından (dış protokol zaman aşımı / tracking kaybı) tetiklenen zorunlu sonuç. */
  finishExternally(nowMs: number): VirtualOpponentTrialResult {
    if (!this.resolved) this.resolveFromTimeout(nowMs);
    return this.resolved!;
  }

  private finishFromCombo(combo: ComboTrialResult): void {
    const onsetMs = combo.steps[0]?.onsetMs ?? null;
    if (combo.outcome === "COMPLETE") {
      const completionMs = combo.steps[0]?.contactMs ?? null;
      const outcome: VirtualOpponentOutcome =
        completionMs !== null && completionMs < this.timeline.attackLandMs
          ? "DEFEATED_ATTACK"
          : "TOO_LATE";
      this.finish(outcome, onsetMs, completionMs, combo, null);
    } else if (combo.outcome === "WRONG_HAND") {
      this.finish("WRONG_RESPONSE", onsetMs, null, combo, null);
    } else {
      // TIMEOUT / INVALID — dış grace-window zaman aşımı üzerinden geldi.
      this.finish("NO_RESPONSE", onsetMs, null, combo, null);
    }
  }

  private finishFromDefense(defense: DefenseTrialResult): void {
    if (defense.outcome === "CORRECT" || defense.outcome === "FAILED_RECOVERY") {
      const completionMs = defense.completionMs;
      const outcome: VirtualOpponentOutcome =
        completionMs !== null && completionMs < this.timeline.attackLandMs
          ? "DEFEATED_ATTACK"
          : "TOO_LATE";
      this.finish(outcome, defense.onsetMs, completionMs, null, defense);
    } else if (defense.outcome === "WRONG_DIRECTION") {
      this.finish("WRONG_RESPONSE", defense.onsetMs, null, null, defense);
    } else {
      // INSUFFICIENT_DISPLACEMENT / NO_RESPONSE — hiçbir geçerli yanıt yok.
      this.finish("NO_RESPONSE", defense.onsetMs, null, null, defense);
    }
  }

  private resolveFromTimeout(nowMs: number): void {
    if (this.comboTracker && !this.comboTracker.isFinished) {
      this.finishFromCombo(this.comboTracker.finishExternally("TIMEOUT", nowMs));
      return;
    }
    if (this.defenseTracker && !this.defenseTracker.isFinished) {
      this.finishFromDefense(this.defenseTracker.finishExternally(nowMs));
      return;
    }
    if (!this.resolved) this.finish("NO_RESPONSE", null, null, null, null);
  }

  private finish(
    outcome: VirtualOpponentOutcome,
    onsetMs: number | null,
    completionMs: number | null,
    combo: ComboTrialResult | null,
    defense: DefenseTrialResult | null,
  ): void {
    const reactionMs = onsetMs !== null ? roundMetric(onsetMs - this.t0Ms, 1) : null;
    const responseTimeMs = completionMs !== null ? roundMetric(completionMs - this.t0Ms, 1) : null;
    const beatDeadlineMarginMs =
      completionMs !== null ? roundMetric(this.timeline.attackLandMs - completionMs, 1) : null;
    this.resolved = {
      attackType: this.attackType,
      responseChannel: this.responseChannel,
      tempoLevel: this.tempoLevel,
      cueStartMs: this.t0Ms,
      attackCommitMs: this.timeline.attackCommitMs,
      attackLandMs: this.timeline.attackLandMs,
      onsetMs,
      completionMs,
      reactionMs,
      responseTimeMs,
      beatDeadlineMarginMs,
      outcome,
      combo,
      defense,
    };
  }
}
