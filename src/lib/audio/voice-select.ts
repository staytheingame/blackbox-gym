/**
 * Ses seçimi — SAF fonksiyonlar (tarayıcı API'si yok, bu yüzden test edilebilir).
 *
 * Sorun: `speechSynthesis.getVoices()` her cihazda bambaşka bir liste döner.
 * "lang'i tr ile başlayan ilk ses" almak Windows'ta çoğu zaman kadın sesini
 * (Filiz/Tülay) seçer; oysa aynı cihazda erkek ses (Tolga) da kuruludur.
 * Bu yüzden puanlama yapıyoruz: önce Türkçe, sonra erkek, sonra doğal/neural.
 */

export type VoiceLike = {
  name: string;
  lang: string;
  voiceURI?: string;
  localService?: boolean;
  default?: boolean;
};

/** Türkçe TTS motorlarında bilinen ERKEK ses adları. */
const MALE_HINTS = [
  "tolga",
  "ahmet",
  "mehmet",
  "burak",
  "emre",
  "kerem",
  "murat",
  "onur",
  "erkek",
  "male",
  "man",
];

/** Türkçe TTS motorlarında bilinen KADIN ses adları. */
const FEMALE_HINTS = [
  "yelda",
  "filiz",
  "emel",
  "tulay",
  "tülay",
  "seda",
  "aylin",
  "zeynep",
  "elif",
  "kadın",
  "kadin",
  "female",
  "woman",
];

/** Daha doğal duyulan motorlar (Edge/Google neural). */
const QUALITY_HINTS = ["neural", "natural", "online", "google", "premium", "enhanced"];

function normalize(value: string): string {
  return (value || "").toLocaleLowerCase("tr-TR");
}

export function isTurkish(voice: VoiceLike): boolean {
  return normalize(voice.lang).startsWith("tr");
}

/**
 * Sesin cinsiyet tahmini. TTS API'si cinsiyet alanı vermez; yalnızca ada
 * bakılabilir. Bilinmiyorsa "unknown" döner — tahmin uydurulmaz.
 */
export function guessGender(voice: VoiceLike): "male" | "female" | "unknown" {
  const name = normalize(voice.name);
  if (MALE_HINTS.some((hint) => name.includes(hint))) return "male";
  if (FEMALE_HINTS.some((hint) => name.includes(hint))) return "female";
  return "unknown";
}

/**
 * Ses puanı — büyük olan tercih edilir. Ağırlıklar şu sırayı bozmayacak
 * şekilde seçildi:
 *   1. Türkçe olmak her şeyden önemli (yanlış dil = komut anlaşılmaz)
 *   2. Erkek ses tercih edilir (koç komutu)
 *   3. Doğal/neural motorlar salonda daha net duyulur
 */
export function scoreVoice(voice: VoiceLike, preferMale = true): number {
  let score = 0;
  if (isTurkish(voice)) score += 1000;

  const gender = guessGender(voice);
  if (preferMale) {
    if (gender === "male") score += 100;
    else if (gender === "unknown") score += 20;
  } else if (gender === "female") {
    score += 100;
  } else if (gender === "unknown") {
    score += 20;
  }

  const name = normalize(voice.name);
  if (QUALITY_HINTS.some((hint) => name.includes(hint))) score += 10;
  if (voice.localService) score += 2; // çevrimdışı da çalışsın
  return score;
}

/**
 * En uygun sesi seçer. Türkçe ses hiç yoksa `null` döner — çağıran taraf
 * kullanıcıyı uyarır. (Sessizce İngilizce motora düşmek komutları
 * anlaşılmaz kılıyordu.)
 */
export function pickVoice(voices: readonly VoiceLike[], preferMale = true): VoiceLike | null {
  const turkish = voices.filter(isTurkish);
  if (turkish.length === 0) return null;
  return [...turkish].sort((a, b) => scoreVoice(b, preferMale) - scoreVoice(a, preferMale))[0];
}

/** Seçim kutusu için sıralı liste: Türkçeler önce, erkek sesler üstte. */
export function sortVoicesForPicker(voices: readonly VoiceLike[]): VoiceLike[] {
  return [...voices].sort(
    (a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name, "tr"),
  );
}

/** Seçim kutusunda gösterilecek etiket. */
export function voiceLabel(voice: VoiceLike): string {
  const gender = guessGender(voice);
  const tag = gender === "male" ? " — erkek" : gender === "female" ? " — kadın" : "";
  return `${voice.name} (${voice.lang})${tag}`;
}
