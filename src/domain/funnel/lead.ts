import { CANCEL_CUTOFF_HOURS } from "@/domain/booking/credits";
import {
  DAILY_LOAD_OPTIONS,
  GOAL_OPTIONS,
  PREFERRED_TIME_OPTIONS,
  isDailyLoad,
  isGoal,
  isPreferredTime,
} from "@/domain/registration/answers";

/**
 * BAŞVURU FUNNEL'I — sporcu olmadan önceki aşama: aday ne istiyor, kim için,
 * nasıl ulaşalım. Saf fonksiyonlar, veritabanı bilmez.
 *
 * Seçenek anahtarları veritabanına yazılır, o yüzden **anahtarlar sabittir**;
 * ekranda görünen ad (`label`) ve metinler istenirse değişir.
 */

// ── Teklif ────────────────────────────────────────────────────

/**
 * Teklifler. FİYAT BİLEREK YOK: sayfada fiyat gösterilmez ve başvuruya fiyat
 * yazılmaz — fiyatı görüşmede konuşuruz. (İlk sürümde 12 ders 20.000 ₺ / 24 ders
 * 36.000 ₺ vardı; sahibi vazgeçti.)
 */
export const FUNNEL_OFFERS = [
  {
    value: "birebir-12",
    kind: "birebir",
    label: "Birebir ders — 12 ders",
    sessions: 12,
  },
  {
    value: "birebir-24",
    kind: "birebir",
    label: "Birebir ders — 24 ders",
    sessions: 24,
  },
  {
    value: "grup",
    kind: "grup",
    label: "Grup dersleri hakkında bilgi almak istiyorum",
    sessions: null,
  },
] as const;

export type FunnelOffer = (typeof FUNNEL_OFFERS)[number]["value"];

export function isBirebirOffer(offer: string): boolean {
  return FUNNEL_OFFERS.some(
    (item) => item.value === offer && item.kind === "birebir",
  );
}

/**
 * Birebir derslerin şartları — teklif kartlarının altında gösterilir.
 * Metin tek yerde durur; değiştirmek için burası yeter.
 */
export const PRIVATE_LESSON_TERMS: readonly string[] = [
  "Dersler her zaman antrenör eşliğinde, sana özel yapılır.",
  "İlk görüşmede hedefine ve gününe göre uzun dönemli bir antrenman planı oluşturulur.",
  "Ders saatlerini antrenörünle birlikte belirlersin; rezervasyonlarını panelden yönetirsin.",
  `Seansa ${CANCEL_CUTOFF_HOURS} saatten fazla varken iptal edebilirsin; daha geç kalan iptal edilemez ve gelinmeyen ders yanar.`,
  "Başlangıç tarihi, fiyat ve ödeme şekli görüşmede birlikte netleştirilir.",
];

// ── Seçenekler ────────────────────────────────────────────────

export const FOR_WHOM_OPTIONS = [
  { value: "kendim", label: "Kendim için" },
  { value: "cocugum", label: "Çocuğum için" },
] as const;
export type ForWhom = (typeof FOR_WHOM_OPTIONS)[number]["value"];

export const CONTACT_CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp'tan yazın" },
  { value: "telefon", label: "Telefonla arayın" },
  { value: "eposta", label: "E-posta ile dönün" },
] as const;
export type ContactChannel = (typeof CONTACT_CHANNEL_OPTIONS)[number]["value"];

export const CONTACT_TIME_OPTIONS = [
  { value: "sabah", label: "Sabah (09:00–12:00)" },
  { value: "ogleden-sonra", label: "Öğleden sonra (12:00–17:00)" },
  { value: "aksam", label: "Akşam (17:00–21:00)" },
  { value: "fark-etmez", label: "Fark etmez" },
] as const;
export type ContactTime = (typeof CONTACT_TIME_OPTIONS)[number]["value"];

export const OCCUPATION_GROUP_OPTIONS = [
  { value: "saglik", label: "Sağlık" },
  { value: "hukuk", label: "Hukuk" },
  { value: "muhendislik-yazilim", label: "Mühendislik / Yazılım" },
  { value: "egitim", label: "Eğitim / Akademi" },
  { value: "ogrenci", label: "Öğrenci" },
  { value: "kamu", label: "Kamu" },
  { value: "yonetici-girisimci", label: "Yönetici / Girişimci" },
  { value: "esnaf-ticaret", label: "Esnaf / Ticaret" },
  { value: "sanat-medya", label: "Sanat / Medya" },
  { value: "spor", label: "Spor" },
  { value: "diger", label: "Diğer" },
] as const;
export type OccupationGroup = (typeof OCCUPATION_GROUP_OPTIONS)[number]["value"];

export const LEAD_STATUS_OPTIONS = [
  { value: "yeni", label: "Yeni" },
  { value: "arandi", label: "Arandı" },
  { value: "deneme", label: "Deneme dersi" },
  { value: "uye-oldu", label: "Üye oldu" },
  { value: "olumsuz", label: "Olumsuz" },
] as const;
export type LeadStatus = (typeof LEAD_STATUS_OPTIONS)[number]["value"];

function labelFrom<T extends readonly { value: string; label: string }[]>(
  options: T,
  value: string | null | undefined,
): string {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? value;
}

const has = <T extends readonly { value: string }[]>(options: T, value: string) =>
  options.some((option) => option.value === value);

export const offerLabel = (v: string | null | undefined) => labelFrom(FUNNEL_OFFERS, v);
export const forWhomLabel = (v: string | null | undefined) => labelFrom(FOR_WHOM_OPTIONS, v);
export const contactChannelLabel = (v: string | null | undefined) =>
  labelFrom(CONTACT_CHANNEL_OPTIONS, v);
export const contactTimeLabel = (v: string | null | undefined) =>
  labelFrom(CONTACT_TIME_OPTIONS, v);
export const occupationGroupLabel = (v: string | null | undefined) =>
  labelFrom(OCCUPATION_GROUP_OPTIONS, v);
export const leadStatusLabel = (v: string | null | undefined) =>
  labelFrom(LEAD_STATUS_OPTIONS, v);
export const isLeadStatus = (v: string): v is LeadStatus => has(LEAD_STATUS_OPTIONS, v);

// ── Telefon ───────────────────────────────────────────────────

/**
 * Telefonu tek biçime getirir: Türkiye numaraları "05551112233" (11 hane).
 * Yurt dışı numarası (başında "+", 90 dışı) rakamlarıyla, "+" korunarak döner.
 * Geçersizse `null`.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const international = trimmed.startsWith("+") && !trimmed.startsWith("+90");
  const digits = trimmed.replace(/\D/g, "");

  if (international) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  let local = digits;
  if (local.startsWith("0090")) local = local.slice(4);
  else if (local.startsWith("90") && local.length === 12) local = local.slice(2);
  else if (local.startsWith("0")) local = local.slice(1);

  // Türkiye cep/sabit numarası: 10 hane, başı 2–5 (alan kodu ya da 5xx).
  if (!/^[2-5]\d{9}$/.test(local)) return null;
  return `0${local}`;
}

/** WhatsApp bağlantısı için rakam dizisi ("905551112233"); geçersizse `null`. */
export function toWhatsAppNumber(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  if (normalized.startsWith("+")) return normalized.slice(1);
  return `90${normalized.slice(1)}`;
}

// ── Doğrulama ─────────────────────────────────────────────────

export type LeadInput = {
  forWhom: string;
  interest: string;
  goals: string[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: string;
  childName: string;
  occupationGroup: string;
  dailyLoad: string;
  preferredTimes: string[];
  contactChannel: string;
  contactTime: string;
  note: string;
  kvkkConsent: boolean;
  marketingConsent: boolean;
};

export type ParsedLead = {
  forWhom: ForWhom;
  interest: FunnelOffer;
  goals: string[];
  fullName: string;
  email: string;
  phone: string;
  age: number;
  childName: string | null;
  occupationGroup: string | null;
  dailyLoad: string | null;
  preferredTimes: string[];
  contactChannel: ContactChannel;
  contactTime: ContactTime | null;
  note: string | null;
  marketingConsent: boolean;
};

export type LeadParseResult =
  | { ok: true; lead: ParsedLead }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SELF_AGE = { min: 12, max: 90 };
const CHILD_AGE = { min: 3, max: 17 };

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/**
 * Formdan gelen ham değerleri doğrular. Listede olmayan bir seçenek (elle
 * bozulmuş form) sessizce atılmaz, reddedilir. Yaş aralığı kimin için
 * olduğuna göre değişir: çocuk için 3–17, kendisi için 12–90.
 */
export function parseFunnelLead(input: LeadInput): LeadParseResult {
  if (!has(FOR_WHOM_OPTIONS, input.forWhom)) {
    return { ok: false, error: "Kimin için olduğunu seç." };
  }
  const forWhom = input.forWhom as ForWhom;

  const offer = FUNNEL_OFFERS.find((item) => item.value === input.interest);
  if (!offer) return { ok: false, error: "İlgilendiğin seçeneği seç." };

  const uniqueGoals = [...new Set(input.goals)];
  if (uniqueGoals.length === 0) return { ok: false, error: "En az bir hedef seç." };
  if (uniqueGoals.some((value) => !isGoal(value))) {
    return { ok: false, error: "Hedef seçimi geçersiz." };
  }
  const goals = GOAL_OPTIONS.map((option) => option.value as string).filter((value) =>
    uniqueGoals.includes(value),
  );

  const firstName = collapse(input.firstName);
  const lastName = collapse(input.lastName);
  if (firstName.length < 2) return { ok: false, error: "Adını yaz." };
  if (lastName.length < 2) return { ok: false, error: "Soyadını yaz." };
  if (firstName.length > 40 || lastName.length > 40) {
    return { ok: false, error: "Ad ve soyad en fazla 40 karakter olabilir." };
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    return { ok: false, error: "Geçerli bir e-posta yaz." };
  }

  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Telefonu 0555 111 22 33 gibi yaz." };

  const ageNumber = Number(input.age.trim());
  const range = forWhom === "cocugum" ? CHILD_AGE : SELF_AGE;
  if (
    !Number.isInteger(ageNumber) ||
    ageNumber < range.min ||
    ageNumber > range.max
  ) {
    return {
      ok: false,
      error:
        forWhom === "cocugum"
          ? `Çocuğunun yaşı ${range.min}–${range.max} arasında olmalı.`
          : `Yaşın ${range.min}–${range.max} arasında olmalı.`,
    };
  }

  let childName: string | null = null;
  if (forWhom === "cocugum") {
    childName = collapse(input.childName);
    if (childName.length < 2) return { ok: false, error: "Çocuğunun adını yaz." };
    if (childName.length > 40) {
      return { ok: false, error: "Çocuğun adı en fazla 40 karakter olabilir." };
    }
  }

  const occupationGroup = input.occupationGroup.trim();
  if (occupationGroup && !has(OCCUPATION_GROUP_OPTIONS, occupationGroup)) {
    return { ok: false, error: "Meslek grubu seçimi geçersiz." };
  }

  const dailyLoad = input.dailyLoad.trim();
  if (dailyLoad && !isDailyLoad(dailyLoad)) {
    return { ok: false, error: "Günlük yoğunluk seçimi geçersiz." };
  }

  const uniqueTimes = [...new Set(input.preferredTimes)];
  if (uniqueTimes.some((value) => !isPreferredTime(value))) {
    return { ok: false, error: "Antrenman saati seçimi geçersiz." };
  }
  const preferredTimes = PREFERRED_TIME_OPTIONS.map((option) => option.value as string).filter(
    (value) => uniqueTimes.includes(value),
  );

  if (!has(CONTACT_CHANNEL_OPTIONS, input.contactChannel)) {
    return { ok: false, error: "Nasıl ulaşmamızı istediğini seç." };
  }

  const contactTime = input.contactTime.trim();
  if (contactTime && !has(CONTACT_TIME_OPTIONS, contactTime)) {
    return { ok: false, error: "Ulaşılacak saat seçimi geçersiz." };
  }

  const note = collapse(input.note);
  if (note.length > 600) {
    return { ok: false, error: "Not en fazla 600 karakter olabilir." };
  }

  if (!input.kvkkConsent) {
    return { ok: false, error: "Devam etmek için aydınlatma metnini onaylaman gerekiyor." };
  }

  return {
    ok: true,
    lead: {
      forWhom,
      interest: offer.value,
      goals,
      fullName: `${firstName} ${lastName}`,
      email,
      phone,
      age: ageNumber,
      childName,
      occupationGroup: occupationGroup || null,
      dailyLoad: dailyLoad || null,
      preferredTimes,
      contactChannel: input.contactChannel as ContactChannel,
      contactTime: (contactTime || null) as ContactTime | null,
      note: note || null,
      marketingConsent: input.marketingConsent,
    },
  };
}

/** Denetim kaydına düşen tek satır özet (tablo yazılamadığında yedek metin). */
export function summarizeLead(lead: ParsedLead): string {
  const parts = [
    `${forWhomLabel(lead.forWhom)} · ${offerLabel(lead.interest)}`,
    `${lead.fullName}${lead.childName ? ` (çocuk: ${lead.childName}, ${lead.age} yaş)` : `, ${lead.age} yaş`}`,
    `tel ${lead.phone}`,
    `e-posta ${lead.email}`,
    `tercih: ${contactChannelLabel(lead.contactChannel)}${lead.contactTime ? ` / ${contactTimeLabel(lead.contactTime)}` : ""}`,
  ];
  if (lead.note) parts.push(`not: ${lead.note}`);
  return parts.join(" — ");
}

// Kullanılmayan içe aktarmaları (ortak seçenek listeleri) formun kullanımı için yeniden dışa aktar.
export { DAILY_LOAD_OPTIONS, GOAL_OPTIONS, PREFERRED_TIME_OPTIONS };
