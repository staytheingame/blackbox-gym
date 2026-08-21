/**
 * Dövüş analitiği raporunun SESLİ okunacak özeti — saf fonksiyon, test edilebilir.
 *
 * Amaç: sporcunun ekrana bakmadan da sonucu alabilmesi. Sayı yığını okumak
 * anlamsız olurdu; bu yüzden özet "en zayıf halka"yı ve tek bir eylem
 * önerisini söyler — rapor ekranda zaten ayrıntılı duruyor.
 */

import type { FightAnalysisReport } from "./metrics";

export type WeakestLink = "guard" | "footwork" | "head";

const WEAK_LINK_LABELS: Record<WeakestLink, string> = {
  guard: "gard",
  footwork: "ayak işi",
  head: "kafa hareketi",
};

const WEAK_LINK_ADVICE: Record<WeakestLink, string> = {
  guard: "Ellerini çene hizasında tut; vuruştan sonra el hemen garda dönsün.",
  footwork: "Yerinde kalma — her vuruştan sonra bir adımla açı değiştir.",
  head: "Aynı hatta durma; iki vuruş arasında başını hattan çıkar.",
};

/** Üç alt skordan en düşüğü — beraberlikte gard, sonra ayak işi önceliklidir. */
export function weakestLink(report: FightAnalysisReport): WeakestLink {
  const candidates: readonly { key: WeakestLink; score: number }[] = [
    { key: "guard", score: report.guardScore },
    { key: "footwork", score: report.footworkScore },
    { key: "head", score: report.headActivityScore },
  ];
  return candidates.reduce((lowest, item) => (item.score < lowest.score ? item : lowest)).key;
}

/**
 * Sesli okunacak metin. Kişi tespit edilemediyse rapor yerine ne yapılacağı
 * söylenir — sessiz kalıp kullanıcıyı beklemede bırakmak en kötü seçenek.
 */
export function spokenReportSummary(report: FightAnalysisReport): string {
  if (!report.personDetected) {
    return "Videoda yeterli karede kişi tespit edilemedi. Sporcunun tam kadrajda ve net göründüğü bir klip dene.";
  }

  const weakest = weakestLink(report);
  return [
    `Genel skor ${report.overallScore}.`,
    `Gard ${report.guardScore}, ayak işi ${report.footworkScore}, kafa hareketi ${report.headActivityScore}.`,
    `En zayıf halka ${WEAK_LINK_LABELS[weakest]}.`,
    WEAK_LINK_ADVICE[weakest],
  ].join(" ");
}
