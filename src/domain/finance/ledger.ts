/**
 * Salon kasası — gelir, gider, kâr.
 *
 * Muhasebe standardı değil, işletme defteridir: tek kayıt (single entry).
 * Gelir = sporcudan tahsil edilen para. Gider = salonun ödediği para
 * (kira, fatura, ekipman ve **antrenör hakedişi**). Net = gelir − gider.
 *
 * Antrenör hakedişi iki yerde görünür ama **bir kez** gidere yazılır:
 * tahakkuk ettiğinde yalnız "borç" olarak durur, ödendiğinde `Expense`
 * satırı doğar. Böylece kasa, parayı gerçekten çıktığı ayda görür.
 */

export const EXPENSE_CATEGORIES = [
  "kira",
  "fatura",
  "ekipman",
  "maas",
  "hakedis",
  "vergi",
  "temizlik",
  "pazarlama",
  "diger",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  kira: "Kira",
  fatura: "Fatura (elektrik, su, internet)",
  ekipman: "Ekipman & bakım",
  maas: "Maaş & SGK",
  hakedis: "Antrenör hakedişi",
  vergi: "Vergi & resmî ödeme",
  temizlik: "Temizlik & sarf",
  pazarlama: "Pazarlama",
  diger: "Diğer",
};

/** Dar sütunda kullanılan kısa ad. */
export const EXPENSE_CATEGORY_SHORT: Record<ExpenseCategory, string> = {
  kira: "Kira",
  fatura: "Fatura",
  ekipman: "Ekipman",
  maas: "Maaş",
  hakedis: "Hakediş",
  vergi: "Vergi",
  temizlik: "Temizlik",
  pazarlama: "Pazarlama",
  diger: "Diğer",
};

export const PAYMENT_METHODS = ["nakit", "kart", "havale", "diger"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  nakit: "Nakit",
  kart: "Kredi/banka kartı",
  havale: "Havale/EFT",
  diger: "Diğer",
};

export function normalizeExpenseCategory(raw: string): ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as ExpenseCategory)
    : "diger";
}

export function normalizePaymentMethod(raw: string): PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(raw)
    ? (raw as PaymentMethod)
    : "diger";
}

export type LedgerTotals = {
  incomeMinor: number;
  expenseMinor: number;
  /** Gelir − gider. Eksi olabilir. */
  netMinor: number;
  /** Net / gelir (0–1 arası, gelir yoksa 0). Zarar durumunda negatif. */
  marginRatio: number;
};

export function rollup(incomeMinor: number, expenseMinor: number): LedgerTotals {
  const net = incomeMinor - expenseMinor;
  return {
    incomeMinor,
    expenseMinor,
    netMinor: net,
    marginRatio: incomeMinor === 0 ? 0 : net / incomeMinor,
  };
}

/** "%38" — kâr marjı etiketi. Gelir yoksa "—". */
export function formatMarginRatio(totals: LedgerTotals): string {
  if (totals.incomeMinor === 0) return "—";
  return `%${Math.round(totals.marginRatio * 100)}`;
}

/**
 * Bir kategori kırılımını büyükten küçüğe sıralar ve payını hesaplar —
 * "gider nereye gidiyor" çubuğu bunu kullanır.
 */
export function shareBreakdown<T extends { amountMinor: number }>(
  rows: readonly T[],
): (T & { share: number })[] {
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  return [...rows]
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .map((row) => ({
      ...row,
      share: total === 0 ? 0 : row.amountMinor / total,
    }));
}
