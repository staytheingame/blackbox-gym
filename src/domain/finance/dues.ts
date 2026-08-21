/**
 * Üyelik borcu — "bu sporcu ne kadar ödedi, ne kadar kaldı".
 *
 * Borç ödeme planı tutmaz: anlaşılan tutar (`priceMinor`) ile o üyeliğe
 * yazılmış tahsilatların toplamı arasındaki fark borçtur. Taksit isteyen
 * salon tahsilatı parça parça girer; ekran kalanı zaten gösterir.
 */

export const DUE_STATUSES = ["odendi", "kismi", "bekliyor", "gecikti"] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];

export const DUE_STATUS_LABEL: Record<DueStatus, string> = {
  odendi: "Ödendi",
  kismi: "Kısmi ödeme",
  bekliyor: "Ödeme bekliyor",
  gecikti: "Gecikmiş",
};

export type DueInput = {
  /** Anlaşılan tutar (kuruş). 0 ise ücretsiz üyelik — borç doğurmaz. */
  priceMinor: number;
  /** Bu üyeliğe yazılmış tahsilat toplamı (kuruş). */
  paidMinor: number;
  /** Üyeliğin bitiş tarihi — geçtiyse kalan borç "gecikti" sayılır. */
  endDate: Date;
  now?: Date;
};

export type DueSummary = {
  priceMinor: number;
  paidMinor: number;
  /** Kalan borç; fazla ödeme yapıldıysa 0 (fazlası `overpaidMinor`). */
  balanceMinor: number;
  overpaidMinor: number;
  status: DueStatus;
  /** Tahsil edilen oran (0–1) — çubuk için. */
  ratio: number;
};

export function summarizeDue(input: DueInput): DueSummary {
  const now = input.now ?? new Date();
  const price = Math.max(0, input.priceMinor);
  const paid = Math.max(0, input.paidMinor);
  const balance = Math.max(0, price - paid);
  const overpaid = Math.max(0, paid - price);

  let status: DueStatus;
  if (balance === 0) {
    status = "odendi";
  } else if (input.endDate.getTime() < now.getTime()) {
    // Üyelik bitmiş, para hâlâ alınmamış — takip edilmesi gereken tek durum.
    status = "gecikti";
  } else if (paid > 0) {
    status = "kismi";
  } else {
    status = "bekliyor";
  }

  return {
    priceMinor: price,
    paidMinor: paid,
    balanceMinor: balance,
    overpaidMinor: overpaid,
    status,
    ratio: price === 0 ? 1 : Math.min(1, paid / price),
  };
}

/** Borçlu üyelikleri öne alan sıralama — gecikmiş en üstte. */
export const DUE_STATUS_ORDER: Record<DueStatus, number> = {
  gecikti: 0,
  kismi: 1,
  bekliyor: 2,
  odendi: 3,
};
