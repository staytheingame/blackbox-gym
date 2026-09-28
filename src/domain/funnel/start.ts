import { normalizePhone } from "@/domain/funnel/lead";

/**
 * "SANA UYGUN BAŞLANGICI BULALIM" — sekiz soruluk tanışma funnel'ı
 * (`/baslangic`). Fiyat yok; amaç görüşme talebi toplamak ve görüşmeye hazır
 * gelmek. Saf fonksiyonlar, veritabanı bilmez.
 *
 * Bu dosya soruların TEK kaynağıdır: form buradan çizer, doğrulama buradan
 * yapar, yönetici ekranı yanıtları buradan okunur etiketlere çevirir.
 *
 * Seçenek anahtarları veritabanına yazılır, o yüzden **anahtarlar sabittir**;
 * ekranda görünen ad (`label`) ve soru metinleri istenirse değişir.
 */

type Option = { value: string; label: string };

export const START_QUESTIONS = {
  goal: {
    title: "Şu an ana hedefin ne?",
    options: [
      { value: "kilo-vermek", label: "Kilo vermek" },
      { value: "fit-gorunmek", label: "Daha fit ve sıkı görünmek" },
      { value: "kaslanmak", label: "Kaslanmak / güçlenmek" },
      { value: "kondisyon", label: "Kondisyonumu artırmak" },
      { value: "yeniden-baslamak", label: "Spora yeniden başlamak" },
      { value: "enerjik", label: "Daha enerjik ve iyi hissetmek" },
    ],
  },
  pain: {
    title: "Şu an seni en çok rahatsız eden şey ne?",
    options: [
      { value: "kilolar", label: "Aldığım kilolar" },
      { value: "ayna", label: "Aynadaki görüntüm" },
      { value: "gobek-bel", label: "Göbek / bel çevrem" },
      { value: "cabuk-yorulmak", label: "Çabuk yorulmam" },
      { value: "gucsuz-formsuz", label: "Güçsüz ve formsuz hissetmem" },
      { value: "eskiden-formda", label: "Eskiden daha formda olmam" },
      { value: "kendime-vakit", label: "Kendime yeterince vakit ayıramamam" },
    ],
  },
  barrier: {
    title: "Forma girmenin önündeki en büyük engel sence ne?",
    options: [
      { value: "is-yogun", label: "İş ve günlük hayat çok yoğun" },
      { value: "zaman-yok", label: "Spora ayıracak zaman bulamıyorum" },
      { value: "devam-edemiyorum", label: "Başlıyorum ama devam ettiremiyorum" },
      { value: "motivasyon", label: "Tek başıma motive olamıyorum" },
      { value: "beslenme", label: "Beslenme tarafını sürdüremiyorum" },
      { value: "ne-yapacagimi-bilmiyorum", label: "Ne yapmam gerektiğini tam bilmiyorum" },
      { value: "sikiliyorum", label: "Antrenman yapmaktan çabuk sıkılıyorum" },
    ],
  },
  history: {
    title: "Daha önce sporla ilişkin nasıldı?",
    options: [
      { value: "duzenli", label: "Düzenli spor yapıyorum" },
      { value: "eskiden-duzenli", label: "Eskiden düzenliydim, bıraktım" },
      { value: "basla-birak", label: "Sürekli başlayıp bırakıyorum" },
      { value: "ara-sira", label: "Ara sıra yapıyorum" },
      { value: "uzun-suredir-yok", label: "Uzun zamandır hiç yapmıyorum" },
      { value: "ilk-kez", label: "İlk kez düzenli başlayacağım" },
    ],
  },
  turnoff: {
    title: "Antrenmanda seni en çok ne soğutuyor?",
    options: [
      { value: "ayni-hareketler", label: "Sürekli aynı hareketleri yapmak" },
      { value: "sadece-agirlik", label: "Sadece ağırlık indirip kaldırmak" },
      { value: "duz-kardiyo", label: "Koşu bandı / bisiklet gibi düz kardiyo yapmak" },
      { value: "tek-basima", label: "Tek başıma antrenman yapmak" },
      { value: "uzun-antrenman", label: "Çok uzun antrenmanlar" },
      { value: "bilmemek", label: "Ne yapacağımı bilmemek" },
      { value: "sikilmiyorum", label: "Aslında antrenman yapmaktan sıkılmıyorum" },
    ],
  },
  expectations: {
    title: "Bir antrenmandan en çok ne bekliyorsun?",
    hint: "Birden fazla seçebilirsin.",
    options: [
      { value: "kilo-vermek", label: "Kilo vermeme yardımcı olsun" },
      { value: "fit-gorunmek", label: "Daha fit görünmemi sağlasın" },
      { value: "guclenmek", label: "Güçleneyim" },
      { value: "kondisyon", label: "Kondisyonum gelişsin" },
      { value: "stres-atmak", label: "Stres atayım" },
      { value: "boks-gibi", label: "Boks gibi farklı şeyler de öğreneyim" },
      { value: "eglenceli", label: "Eğlenceli olsun, sıkılmayayım" },
      { value: "takip-yonlendirme", label: "Birinin beni takip etmesi ve yönlendirmesi" },
    ],
  },
  dailyLoad: {
    title: "Günlük yoğunluğun",
    options: [
      { value: "cok-yogun", label: "Çok yoğun" },
      { value: "yogun", label: "Yoğun" },
      { value: "orta", label: "Orta" },
      { value: "rahat", label: "Rahat" },
      { value: "degisiyor", label: "Gününe göre değişiyor" },
    ],
  },
  timeWindows: {
    title: "Sana uygun antrenman zamanları hangileri?",
    hint: "Birden fazla seçebilirsin.",
    options: [
      { value: "sabah", label: "Sabah 07:00–10:00" },
      { value: "ogle", label: "Öğlen 10:00–14:00" },
      { value: "ogleden-sonra", label: "Öğleden sonra 14:00–18:00" },
      { value: "aksam", label: "Akşam 18:00–22:00" },
      { value: "hafta-sonu", label: "Hafta sonu" },
    ],
  },
  weeklyDays: {
    title: "Haftada gerçekçi olarak:",
    options: [
      { value: "2", label: "2 gün" },
      { value: "3", label: "3 gün" },
      { value: "4-plus", label: "4+ gün" },
      { value: "degisir", label: "Programıma göre değişir" },
    ],
  },
} as const satisfies Record<string, { title: string; hint?: string; options: readonly Option[] }>;

export type StartQuestionKey = keyof typeof START_QUESTIONS;

const OCCUPATION_MIN = 2;
const OCCUPATION_MAX = 60;

function optionValues(key: StartQuestionKey): readonly string[] {
  return START_QUESTIONS[key].options.map((option) => option.value);
}

export function startOptionLabel(
  key: StartQuestionKey,
  value: string | null | undefined,
): string {
  if (!value) return "";
  const options: readonly Option[] = START_QUESTIONS[key].options;
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Yanıtlar veritabanında JSON olarak durur; bu tip o JSON'un şeklidir. */
export type StartAnswers = {
  goal: string;
  pain: string;
  barrier: string;
  history: string;
  turnoff: string;
  expectations: string[];
  occupation: string;
  dailyLoad: string;
  timeWindows: string[];
  weeklyDays: string;
};

export type StartLeadInput = {
  goal: string;
  pain: string;
  barrier: string;
  history: string;
  turnoff: string;
  expectations: string[];
  occupation: string;
  dailyLoad: string;
  timeWindows: string[];
  weeklyDays: string;
  fullName: string;
  phone: string;
  email: string;
};

export type ParsedStartLead = {
  fullName: string;
  phone: string;
  email: string;
  answers: StartAnswers;
};

export type StartParseResult =
  | { ok: true; lead: ParsedStartLead }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** Tek seçimli soru: listede olmalı. Boşsa "seç", bozuksa "geçersiz". */
function single(
  key: StartQuestionKey,
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: false, error: "Tüm soruları yanıtla." };
  if (!optionValues(key).includes(raw)) {
    return { ok: false, error: "Bir seçim geçersiz. Sayfayı yenileyip tekrar dene." };
  }
  return { ok: true, value: raw };
}

/** Çoklu seçimli soru: en az biri, hepsi listede; sıra soru listesindeki sıra. */
function multi(
  key: StartQuestionKey,
  raw: string[],
): { ok: true; value: string[] } | { ok: false; error: string } {
  const unique = [...new Set(raw)];
  if (unique.length === 0) return { ok: false, error: "Tüm soruları yanıtla." };
  const allowed = optionValues(key);
  if (unique.some((value) => !allowed.includes(value))) {
    return { ok: false, error: "Bir seçim geçersiz. Sayfayı yenileyip tekrar dene." };
  }
  return { ok: true, value: allowed.filter((value) => unique.includes(value)) };
}

/**
 * Formdan gelen ham değerleri doğrular. Listede olmayan bir seçenek (elle
 * bozulmuş form) sessizce atılmaz, reddedilir. Boş bırakılan soru
 * "Tüm soruları yanıtla." hatası verir.
 */
export function parseStartLead(input: StartLeadInput): StartParseResult {
  const goal = single("goal", input.goal);
  if (!goal.ok) return goal;
  const pain = single("pain", input.pain);
  if (!pain.ok) return pain;
  const barrier = single("barrier", input.barrier);
  if (!barrier.ok) return barrier;
  const history = single("history", input.history);
  if (!history.ok) return history;
  const turnoff = single("turnoff", input.turnoff);
  if (!turnoff.ok) return turnoff;
  const expectations = multi("expectations", input.expectations);
  if (!expectations.ok) return expectations;

  const occupation = collapse(input.occupation);
  if (occupation.length < OCCUPATION_MIN) return { ok: false, error: "Mesleğini yaz." };
  if (occupation.length > OCCUPATION_MAX) {
    return { ok: false, error: `Meslek en fazla ${OCCUPATION_MAX} karakter olabilir.` };
  }

  const dailyLoad = single("dailyLoad", input.dailyLoad);
  if (!dailyLoad.ok) return dailyLoad;
  const timeWindows = multi("timeWindows", input.timeWindows);
  if (!timeWindows.ok) return timeWindows;
  const weeklyDays = single("weeklyDays", input.weeklyDays);
  if (!weeklyDays.ok) return weeklyDays;

  // Tek alanda "Ad Soyad": en az iki sözcük, her biri en az 2 harf.
  const fullName = collapse(input.fullName);
  const words = fullName.split(" ").filter(Boolean);
  if (words.length < 2 || words.some((word) => word.length < 2)) {
    return { ok: false, error: "Adını ve soyadını yaz." };
  }
  if (fullName.length > 80) {
    return { ok: false, error: "Ad soyad en fazla 80 karakter olabilir." };
  }

  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Telefonu 0555 111 22 33 gibi yaz." };

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    return { ok: false, error: "Geçerli bir e-posta yaz." };
  }

  return {
    ok: true,
    lead: {
      fullName,
      phone,
      email,
      answers: {
        goal: goal.value,
        pain: pain.value,
        barrier: barrier.value,
        history: history.value,
        turnoff: turnoff.value,
        expectations: expectations.value,
        occupation,
        dailyLoad: dailyLoad.value,
        timeWindows: timeWindows.value,
        weeklyDays: weeklyDays.value,
      },
    },
  };
}

/**
 * Veritabanından gelen JSON'u güvenle okur. Eski/bozuk/eksik alan ekranı
 * çökertmez: eksik alan boş, bilinmeyen anahtar olduğu gibi gösterilir.
 */
export function readStartAnswers(raw: unknown): StartAnswers {
  const object =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const text = (key: string): string =>
    typeof object[key] === "string" ? (object[key] as string) : "";
  const list = (key: string): string[] =>
    Array.isArray(object[key])
      ? (object[key] as unknown[]).filter((v): v is string => typeof v === "string")
      : [];

  return {
    goal: text("goal"),
    pain: text("pain"),
    barrier: text("barrier"),
    history: text("history"),
    turnoff: text("turnoff"),
    expectations: list("expectations"),
    occupation: text("occupation"),
    dailyLoad: text("dailyLoad"),
    timeWindows: list("timeWindows"),
    weeklyDays: text("weeklyDays"),
  };
}

/** Yönetici ekranında gösterilecek "soru → yanıt" satırları (boş yanıtlar çıkarılmaz). */
export function describeStartAnswers(
  answers: StartAnswers,
): { label: string; value: string }[] {
  const joined = (key: StartQuestionKey, values: string[]) =>
    values.map((value) => startOptionLabel(key, value)).join(", ");

  return [
    { label: "Ana hedef", value: startOptionLabel("goal", answers.goal) },
    { label: "En çok rahatsız eden", value: startOptionLabel("pain", answers.pain) },
    { label: "En büyük engel", value: startOptionLabel("barrier", answers.barrier) },
    { label: "Spor geçmişi", value: startOptionLabel("history", answers.history) },
    { label: "Antrenmanda soğutan", value: startOptionLabel("turnoff", answers.turnoff) },
    { label: "Beklentiler", value: joined("expectations", answers.expectations) },
    { label: "Meslek", value: answers.occupation },
    { label: "Günlük yoğunluk", value: startOptionLabel("dailyLoad", answers.dailyLoad) },
    { label: "Uygun zamanlar", value: joined("timeWindows", answers.timeWindows) },
    { label: "Haftada", value: startOptionLabel("weeklyDays", answers.weeklyDays) },
  ];
}

/** Denetim kaydına düşen tek satır özet (tablo yazılamadığında yedek metin). */
export function summarizeStartLead(lead: ParsedStartLead): string {
  const rows = describeStartAnswers(lead.answers)
    .map((row) => `${row.label}: ${row.value}`)
    .join(" · ");
  return `${lead.fullName} — tel ${lead.phone} — e-posta ${lead.email} — ${rows}`;
}
