/**
 * Para — TEK kural: her tutar **kuruş** (minor unit) olarak `number` tutulur.
 * Kayan noktalı lira asla saklanmaz; 19,90 ₺ = 1990.
 *
 * Bu dosya bilerek `server-only` değildir: aynı biçimlendirme hem sunucu
 * sayfasında hem form bileşeninde kullanılıyor.
 */

export const DEFAULT_CURRENCY = "TRY";

/** 125050 → "1.250,50 ₺" (kuruş sıfırsa "1.250 ₺"). */
export function formatMinorTR(
  amountMinor: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const hasCents = amountMinor % 100 !== 0;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amountMinor / 100);
}

/** İşaretli gösterim — kâr/zarar satırlarında "+" görünsün diye. */
export function formatSignedMinorTR(
  amountMinor: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const text = formatMinorTR(Math.abs(amountMinor), currency);
  if (amountMinor > 0) return `+${text}`;
  if (amountMinor < 0) return `−${text}`;
  return text;
}

/**
 * Kullanıcının yazdığı tutarı kuruşa çevirir. Türk klavyesinde binlik nokta,
 * ondalık virgüldür ("1.250,50"); yapıştırılan değer İngilizce biçimde de
 * gelebilir ("1250.50"). İkisini de kabul eder.
 *
 * Geçersiz/negatif giriş `null` döner — çağıran yer hata mesajını verir.
 */
export function parseAmountToMinor(raw: string): number | null {
  const trimmed = raw.trim().replace(/[₺\s]/g, "");
  if (trimmed === "") return null;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  // Ondalık ayracı: en sonda duran işaret. İkisi de yoksa tam sayıdır.
  const decimalSeparator =
    lastComma > lastDot ? "," : lastDot > lastComma ? "." : "";

  let normalized = trimmed;
  if (decimalSeparator === ",") {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (decimalSeparator === ".") {
    // "1.250" binlik mi ondalık mı? Noktadan sonra 3 hane ve birden çok nokta
    // varsa binliktir; tek nokta + 3 hane belirsizdir — binlik kabul edilir.
    const decimals = trimmed.length - lastDot - 1;
    normalized = decimals === 3 ? trimmed.replace(/\./g, "") : trimmed;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const minor = Math.round(Number(normalized) * 100);
  return Number.isFinite(minor) ? minor : null;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Yüzde payı — baz puan (bps) ile: %40 = 4000. Yarım kuruş yukarı yuvarlanır. */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10_000);
}

/** 4000 → "%40" (gereksiz sıfır göstermez: 4250 → "%42,5"). */
export function formatBps(bps: number): string {
  const percent = bps / 100;
  return `%${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(percent)}`;
}

/** "%40" / "40" / "42,5" → 4250. Aralık dışı ya da geçersizse `null`. */
export function parsePercentToBps(raw: string): number | null {
  const trimmed = raw.trim().replace(/%/g, "").replace(",", ".");
  if (trimmed === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const bps = Math.round(Number(trimmed) * 100);
  if (bps < 0 || bps > 10_000) return null;
  return bps;
}
