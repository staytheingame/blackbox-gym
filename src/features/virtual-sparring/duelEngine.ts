/**
 * Sanal Rakip düellosunun kuralları — SAF fonksiyonlar (React/canvas yok).
 *
 * Tespit tarafı yeniden yazılmadı: yanıtın doğru olup olmadığına
 * `camera-fight-lab/virtualOpponentEngine.ts` karar verir. Buradaki katman
 * yalnızca o sonucu OYUNA çevirir — can, seri, puan ve hata sınıflandırması.
 *
 * Hata taksonomisi, sporcuya "neyi yanlış yaptın" diye tek kelimeyle
 * cevaplayabilmek için dört kovaya indirgenmiştir; rapor bunların dağılımını
 * gösterir (en sık hata = üzerinde çalışılacak şey).
 */

import type {
  VirtualOpponentAttackType,
  VirtualOpponentOutcome,
  VirtualOpponentResponseChannel,
} from "../camera-fight-lab/types";

export type DuelMistake =
  /** Doğru yanıt ama rakibin vuruşu inmeden yetişmedi. */
  | "LATE"
  /** Yanlış el / yanlış yön. */
  | "WRONG"
  /** Hiç yanıt yok. */
  | "NONE";

export type DuelExchange = {
  index: number;
  attackType: VirtualOpponentAttackType;
  responseChannel: VirtualOpponentResponseChannel;
  outcome: VirtualOpponentOutcome;
  /** Cue'dan ilk harekete kadar (ms). */
  reactionMs: number | null;
  /** Cue'dan yanıtın tamamlanmasına kadar (ms). */
  responseTimeMs: number | null;
  /** Rakibin vuruşuna kaç ms kala yetişti (negatif = geç). */
  beatDeadlineMarginMs: number | null;
  mistake: DuelMistake | null;
  scoreDelta: number;
  playerDamage: number;
  opponentDamage: number;
};

export type DuelState = {
  playerHealth: number;
  opponentHealth: number;
  score: number;
  combo: number;
  bestCombo: number;
};

export const DUEL_CONFIG = {
  startingHealth: 100,
  /** Rakip vuruşu indiğinde sporcunun kaybettiği can. */
  lateDamage: 12,
  wrongDamage: 9,
  noResponseDamage: 15,
  /** Temiz yanıtın rakibe verdiği taban hasar. */
  cleanDamage: 9,
  /** Temiz yanıtın taban puanı. */
  cleanScore: 100,
  /** Seri çarpanının üst sınırı — seri sonsuza kadar büyümesin. */
  maxComboMultiplier: 4,
  /** Bu kadar erken yetişmek tam hız bonusu verir (ms). */
  fullSpeedBonusMarginMs: 400,
  speedBonusScore: 60,
} as const;

export const INITIAL_DUEL_STATE: DuelState = {
  playerHealth: DUEL_CONFIG.startingHealth,
  opponentHealth: DUEL_CONFIG.startingHealth,
  score: 0,
  combo: 0,
  bestCombo: 0,
};

export function mistakeForOutcome(outcome: VirtualOpponentOutcome): DuelMistake | null {
  switch (outcome) {
    case "DEFEATED_ATTACK":
      return null;
    case "TOO_LATE":
      return "LATE";
    case "WRONG_RESPONSE":
      return "WRONG";
    default:
      return "NONE";
  }
}

export const MISTAKE_LABELS: Record<DuelMistake, string> = {
  LATE: "Geç kaldın",
  WRONG: "Yanlış yanıt",
  NONE: "Yanıt yok",
};

export const MISTAKE_ADVICE: Record<DuelMistake, string> = {
  LATE: "Rakibin yüklenmesini bekleme — omuz geri gittiği anda hareket başlasın.",
  WRONG: "Acele karar veriyorsun. Hangi elin geldiğini gör, sonra yanıtı seç.",
  NONE: "Donuyorsun. Her cue'da bir şey yap — yanlış yapmak, hiç yapmamaktan iyidir.",
};

/** Seri çarpanı: 0-1 seri → 1x, sonra her 2 seride bir artar, tavanı var. */
export function comboMultiplier(combo: number): number {
  return Math.min(DUEL_CONFIG.maxComboMultiplier, 1 + Math.floor(Math.max(0, combo) / 2));
}

/**
 * Hız bonusu: rakibin vuruşundan ne kadar önce yetiştiğine bakar. Ham tepki
 * süresi yerine MARJ kullanılır, çünkü rakibin temposu her alışverişte
 * değişiyor — 300 ms tepki yavaş bir saldırıda rahat, hızlısında geç kalır.
 */
export function speedBonus(beatDeadlineMarginMs: number | null): number {
  if (beatDeadlineMarginMs === null || beatDeadlineMarginMs <= 0) return 0;
  const ratio = Math.min(1, beatDeadlineMarginMs / DUEL_CONFIG.fullSpeedBonusMarginMs);
  return Math.round(DUEL_CONFIG.speedBonusScore * ratio);
}

export type ExchangeInput = {
  index: number;
  attackType: VirtualOpponentAttackType;
  responseChannel: VirtualOpponentResponseChannel;
  outcome: VirtualOpponentOutcome;
  reactionMs: number | null;
  responseTimeMs: number | null;
  beatDeadlineMarginMs: number | null;
};

/** Bir alışverişi puana/hasara çevirir. Durumu DEĞİŞTİRMEZ. */
export function resolveExchange(input: ExchangeInput, state: DuelState): DuelExchange {
  const mistake = mistakeForOutcome(input.outcome);

  if (mistake === null) {
    const bonus = speedBonus(input.beatDeadlineMarginMs);
    const multiplier = comboMultiplier(state.combo);
    return {
      ...input,
      mistake: null,
      scoreDelta: DUEL_CONFIG.cleanScore * multiplier + bonus,
      playerDamage: 0,
      opponentDamage: DUEL_CONFIG.cleanDamage + Math.round(bonus / 12),
    };
  }

  const damage =
    mistake === "LATE"
      ? DUEL_CONFIG.lateDamage
      : mistake === "WRONG"
        ? DUEL_CONFIG.wrongDamage
        : DUEL_CONFIG.noResponseDamage;

  return {
    ...input,
    mistake,
    scoreDelta: 0,
    playerDamage: damage,
    opponentDamage: 0,
  };
}

export function applyExchange(state: DuelState, exchange: DuelExchange): DuelState {
  const clean = exchange.mistake === null;
  const combo = clean ? state.combo + 1 : 0;
  return {
    playerHealth: Math.max(0, state.playerHealth - exchange.playerDamage),
    opponentHealth: Math.max(0, state.opponentHealth - exchange.opponentDamage),
    score: state.score + exchange.scoreDelta,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
  };
}

export type DuelVerdict = "PLAYER_WIN" | "OPPONENT_WIN" | null;

export function duelVerdict(state: DuelState): DuelVerdict {
  if (state.opponentHealth <= 0) return "PLAYER_WIN";
  if (state.playerHealth <= 0) return "OPPONENT_WIN";
  return null;
}

export type DuelReport = {
  exchanges: number;
  cleanCount: number;
  cleanPct: number;
  score: number;
  bestCombo: number;
  /** Yalnız TEMİZ alışverişlerin ortalaması — hatalı denemeler hızı şişirmesin. */
  averageReactionMs: number | null;
  fastestReactionMs: number | null;
  slowestReactionMs: number | null;
  /** Rakibin vuruşuna kalan ortalama pay (ms); düşükse "kıl payı" demektir. */
  averageMarginMs: number | null;
  mistakeCounts: Record<DuelMistake, number>;
  topMistake: DuelMistake | null;
  /** Savunma mı kontra mı daha zayıf — çalışılacak kanalı gösterir. */
  weakestChannel: VirtualOpponentResponseChannel | null;
};

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function summarizeDuel(exchanges: readonly DuelExchange[]): DuelReport {
  const clean = exchanges.filter((exchange) => exchange.mistake === null);
  const reactions = clean
    .map((exchange) => exchange.reactionMs)
    .filter((value): value is number => value !== null);
  const margins = clean
    .map((exchange) => exchange.beatDeadlineMarginMs)
    .filter((value): value is number => value !== null);

  const mistakeCounts: Record<DuelMistake, number> = { LATE: 0, WRONG: 0, NONE: 0 };
  for (const exchange of exchanges) {
    if (exchange.mistake) mistakeCounts[exchange.mistake] += 1;
  }

  const topMistake =
    (Object.keys(mistakeCounts) as DuelMistake[])
      .filter((key) => mistakeCounts[key] > 0)
      .sort((a, b) => mistakeCounts[b] - mistakeCounts[a])[0] ?? null;

  return {
    exchanges: exchanges.length,
    cleanCount: clean.length,
    cleanPct: exchanges.length === 0 ? 0 : Math.round((clean.length / exchanges.length) * 100),
    score: exchanges.reduce((sum, exchange) => sum + exchange.scoreDelta, 0),
    bestCombo: longestCleanRun(exchanges),
    averageReactionMs: average(reactions),
    fastestReactionMs: reactions.length > 0 ? Math.min(...reactions) : null,
    slowestReactionMs: reactions.length > 0 ? Math.max(...reactions) : null,
    averageMarginMs: average(margins),
    mistakeCounts,
    topMistake,
    weakestChannel: weakestChannel(exchanges),
  };
}

function longestCleanRun(exchanges: readonly DuelExchange[]): number {
  let best = 0;
  let run = 0;
  for (const exchange of exchanges) {
    run = exchange.mistake === null ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Hangi kanalda daha çok hata var. Eşitlikte ya da tek kanal denendiyse
 * `null` — uydurma teşhis üretmemek için.
 */
function weakestChannel(
  exchanges: readonly DuelExchange[],
): VirtualOpponentResponseChannel | null {
  const channels: VirtualOpponentResponseChannel[] = ["COUNTER", "DEFEND"];
  const rates = channels.map((channel) => {
    const subset = exchanges.filter((exchange) => exchange.responseChannel === channel);
    return {
      channel,
      attempts: subset.length,
      errorRate:
        subset.length === 0
          ? 0
          : subset.filter((exchange) => exchange.mistake !== null).length / subset.length,
    };
  });
  if (rates.some((rate) => rate.attempts === 0)) return null;
  if (rates[0].errorRate === rates[1].errorRate) return null;
  return rates[0].errorRate > rates[1].errorRate ? rates[0].channel : rates[1].channel;
}
