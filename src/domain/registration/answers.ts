/**
 * Kayıt formu yanıtları — saf fonksiyonlar, veritabanı bilmez.
 *
 * Form üç şey sorar: **meslek**, **günlük yoğunluk** ve **tercih edilen
 * antrenman saatleri**. Amaç antrenörün ilk görüşmeden önce sporcunun gününü
 * tanıması: çok yoğun biriyle sabah 06:00 ya da akşam 21:00 konuşulur,
 * esnek biriyle öğle arası da olur.
 *
 * Seçenek anahtarları veritabanına yazılır, o yüzden **anahtarlar sabittir**;
 * ekranda görünen ad (`label`) istenirse değişir.
 */

export const DAILY_LOAD_OPTIONS = [
  { value: "sakin", label: "Sakin — günüm esnek" },
  { value: "orta", label: "Orta tempo" },
  { value: "yogun", label: "Yoğun — molam az" },
  { value: "cok-yogun", label: "Çok yoğun — günüm dolu" },
] as const;

export type DailyLoad = (typeof DAILY_LOAD_OPTIONS)[number]["value"];

export const PREFERRED_TIME_OPTIONS = [
  { value: "sabah-erken", label: "Sabah erken (06:00–09:00)" },
  { value: "sabah", label: "Sabah (09:00–12:00)" },
  { value: "ogle", label: "Öğle (12:00–14:00)" },
  { value: "ikindi", label: "İkindi (14:00–17:00)" },
  { value: "aksam", label: "Akşam (17:00–20:00)" },
  { value: "gece", label: "Gece (20:00–22:00)" },
  { value: "hafta-sonu", label: "Hafta sonu" },
] as const;

export type PreferredTime = (typeof PREFERRED_TIME_OPTIONS)[number]["value"];

const DAILY_LOAD_VALUES: readonly string[] = DAILY_LOAD_OPTIONS.map(
  (option) => option.value,
);
const PREFERRED_TIME_VALUES: readonly string[] = PREFERRED_TIME_OPTIONS.map(
  (option) => option.value,
);

export function isDailyLoad(value: string): value is DailyLoad {
  return DAILY_LOAD_VALUES.includes(value);
}

export function isPreferredTime(value: string): value is PreferredTime {
  return PREFERRED_TIME_VALUES.includes(value);
}

export function dailyLoadLabel(value: string | null | undefined): string {
  if (!value) return "";
  return DAILY_LOAD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function preferredTimeLabel(value: string): string {
  return PREFERRED_TIME_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export type RegistrationAnswers = {
  occupation: string;
  dailyLoad: DailyLoad;
  preferredTimes: PreferredTime[];
};

export type ParsedAnswers =
  | { ok: true; answers: RegistrationAnswers }
  | { ok: false; error: string };

const OCCUPATION_MIN = 2;
const OCCUPATION_MAX = 80;

/**
 * Formdan gelen ham değerleri doğrular. Seçenek listesinde olmayan bir değer
 * (elle bozulmuş form) sessizce atılmaz, reddedilir — tersi, veritabanına
 * ekranda karşılığı olmayan bir anahtar yazardı.
 */
export function parseRegistrationAnswers(input: {
  occupation: string;
  dailyLoad: string;
  preferredTimes: string[];
}): ParsedAnswers {
  const occupation = input.occupation.trim().replace(/\s+/g, " ");
  if (occupation.length < OCCUPATION_MIN) {
    return { ok: false, error: "Mesleğini yaz." };
  }
  if (occupation.length > OCCUPATION_MAX) {
    return { ok: false, error: "Meslek en fazla 80 karakter olabilir." };
  }

  if (!isDailyLoad(input.dailyLoad)) {
    return { ok: false, error: "Günlük yoğunluğunu seç." };
  }

  const unique = [...new Set(input.preferredTimes)];
  if (unique.length === 0) {
    return { ok: false, error: "En az bir antrenman saati seç." };
  }
  const times: PreferredTime[] = [];
  for (const value of unique) {
    if (!isPreferredTime(value)) {
      return { ok: false, error: "Antrenman saati seçimi geçersiz." };
    }
    times.push(value);
  }

  // Ekranda hep aynı sırayla görünsün: seçilme sırası değil, gün sırası.
  times.sort(
    (a, b) => PREFERRED_TIME_VALUES.indexOf(a) - PREFERRED_TIME_VALUES.indexOf(b),
  );

  return {
    ok: true,
    answers: { occupation, dailyLoad: input.dailyLoad, preferredTimes: times },
  };
}

/**
 * Tek satırlık özet — yanıtlar tabloya yazılamazsa denetim kaydına düşen
 * yedek metin. Yazılabildiğinde de sporcu kartındaki başlıkla aynı dili konuşur.
 */
export function summarizeAnswers(answers: {
  occupation?: string | null;
  dailyLoad?: string | null;
  preferredTimes?: string[] | null;
}): string {
  const parts: string[] = [];
  if (answers.occupation) parts.push(`meslek: ${answers.occupation}`);
  if (answers.dailyLoad) {
    parts.push(`günlük yoğunluk: ${dailyLoadLabel(answers.dailyLoad)}`);
  }
  if (answers.preferredTimes && answers.preferredTimes.length > 0) {
    parts.push(
      `saat tercihi: ${answers.preferredTimes.map(preferredTimeLabel).join(", ")}`,
    );
  }
  return parts.join(" · ");
}
