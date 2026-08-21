import { DEFAULT_FEATURE_FLAGS, type FeatureFlag } from "@/config/panel-nav";

/**
 * Panel bölümlerinin açma/kapama anahtarları (Kong Academy'nin
 * `lib/feature-flags.ts` deseni). Kapalı bayraklı bölüm menüde çıkmaz;
 * rota silinmez, yalnızca gezinmede görünmez.
 *
 * Değerler build sırasında gömülür — istemci tarafında da okunabilsin diye
 * `NEXT_PUBLIC_` önekli ve `process.env` erişimi düz yazılır (Next bunları
 * statik olarak değiştirir, dinamik anahtar çalışmaz).
 */
const DEFAULTS = DEFAULT_FEATURE_FLAGS;

function read(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export function enabledFeatureFlags(): ReadonlySet<FeatureFlag> {
  const enabled = new Set<FeatureFlag>();

  if (read(process.env.NEXT_PUBLIC_FEATURE_MESAJLAR, DEFAULTS.mesajlar)) {
    enabled.add("mesajlar");
  }
  if (read(process.env.NEXT_PUBLIC_FEATURE_PROTOKOLLER, DEFAULTS.protokoller)) {
    enabled.add("protokoller");
  }
  if (read(process.env.NEXT_PUBLIC_FEATURE_KUSAKLAR, DEFAULTS.kusaklar)) {
    enabled.add("kusaklar");
  }
  if (read(process.env.NEXT_PUBLIC_FEATURE_ONAYLAR, DEFAULTS.onaylar)) {
    enabled.add("onaylar");
  }

  return enabled;
}
