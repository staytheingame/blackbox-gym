/**
 * META GELİŞMİŞ EŞLEŞME (advanced matching) — üye verisini reklam
 * platformunun beklediği biçime çevirir.
 *
 * Neden: salon reklam veriyor ve "bu reklam kaç üye getirdi" sorusunun yanıtı
 * ancak kayıt olan kişi reklamı gören kişiyle eşleştirilebilirse çıkar. Meta
 * bu eşleştirmeyi normalleştirilmiş alanlar üzerinden yapar; alan adları
 * sabittir ve eşleşme gücü alana göre değişir:
 *
 *   email   (em)            → çok önemli
 *   phone   (ph)            → çok önemli
 *   fn / ln                 → önemli
 *   ct / st / country / zip → ek eşleşme
 *
 * Normalleştirme kuralları Meta'nın müşteri listesi belgesinden: küçük harf,
 * baş/son boşluk yok, noktalama yok, telefon ülke koduyla ve yalnız rakam,
 * ülke ISO-3166 alpha-2 küçük harf.
 *
 * TASARIM KARARI — burada HASH YOK, ham (normalleştirilmiş) değer var.
 * Meta'nın müşteri listesi yükleme ekranı dosyayı tarayıcıda kendisi
 * SHA-256'lar; ham yüklemek eşleşme oranını yükseltir çünkü normalleştirmeyi
 * de kendisi yapar. Hash'i biz üretsek tek bir büyük/küçük harf farkı satırı
 * sessizce eşleşmez kılar ve bunu kimse göremez.
 *
 * Bu dosya SAFtır: veritabanı okumaz, Prisma tiplerine bağlı değil. Girdi düz
 * bir nesnedir; eşlemeyi çağıran yer yapar (`src/lib/export/datasets.ts`).
 */

/** Meta'nın müşteri listesinde beklediği sütun adları. */
export const META_FIELDS = [
  "email",
  "phone",
  "fn",
  "ln",
  "ct",
  "st",
  "country",
  "zip",
  "dob",
  "ge",
] as const;
export type MetaField = (typeof META_FIELDS)[number];

export type MatchingSource = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** `firstName`/`lastName` boşsa buradan bölünür. */
  fullName?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  birthDate?: Date | null;
  /** kadin | erkek | belirtmedi */
  gender?: string | null;
};

export type MatchingRow = Record<MetaField, string>;

/** Noktalama ve rakamları atar, boşlukları teke indirir, küçük harfe çeker. */
function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/['‘’`]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Şehir/il: isimle aynı ama BOŞLUK DA atılır (Meta böyle bekler). */
function normalizePlace(raw: string | null | undefined): string {
  return normalizeName(raw).replace(/\s/g, "");
}

/**
 * Posta kodu — `normalizePlace` kullanılamaz, o rakamları atıyor. Burada harf
 * de rakam da kalır (İngiltere'de "sw1a 1aa" gibi kodlar var), yalnız boşluk
 * ve noktalama gider.
 */
function normalizeZip(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim().toLowerCase();
  // Yarım kalmış kayıt ("ali@", "ali") eşleşmez; boş bırakmak daha temiz.
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(trimmed) ? trimmed : "";
}

/**
 * Telefon — yalnız rakam, ülke koduyla.
 *
 * Türkiye varsayılanı bilinçli: salon İstanbul'da ve numaralar "0555…" ya da
 * "555…" giriliyor. Ülke kodu olmayan numara Meta'da eşleşmez; 10 haneli bir
 * mobil numaranın başına 90 koymak burada doğru varsayımdır. Numara zaten
 * başka ülke kodu taşıyorsa (+49, 0049) dokunulmaz.
 */
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountryCode = "90",
): string {
  if (!raw) return "";

  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // "0090555…" / "00555…" → uluslararası önek atılır.
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (hasPlus) return digits.length >= 8 ? digits : "";

  if (digits.startsWith(defaultCountryCode) && digits.length >= 12) return digits;

  // Yerel yazım: "0555 111 22 33" (11 hane) ya da "555 111 22 33" (10 hane).
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;

  // Tanınmayan uzunluk — yanlış ülke kodu eklemek eşleşmeyi bozar.
  return digits.length >= 11 ? digits : "";
}

/** ISO-3166 alpha-2, küçük harf. Türkçe/İngilizce ülke adları da tanınır. */
export function normalizeCountry(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = normalizePlace(raw);
  if (value.length === 2) return value;
  const named: Record<string, string> = {
    turkiye: "tr",
    türkiye: "tr",
    turkey: "tr",
    almanya: "de",
    germany: "de",
    hollanda: "nl",
    netherlands: "nl",
    azerbaycan: "az",
  };
  return named[value] ?? "";
}

/** Doğum tarihi — Meta `dob` biçimi: YYYYMMDD. */
export function normalizeBirthDate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Cinsiyet — Meta `ge`: "m" | "f". Belirtilmemişse boş. */
export function normalizeGender(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = raw.trim().toLowerCase();
  if (value === "erkek" || value === "m" || value === "male") return "m";
  if (
    value === "kadin" ||
    value === "kadın" ||
    value === "f" ||
    value === "female"
  ) {
    return "f";
  }
  return "";
}

/**
 * Ad/soyad ayrıştırması. Kayıt formu ikisini ayrı alır; eski kayıtlarda yalnız
 * `fullName` var — son kelime soyad, öncesi ad sayılır: "Ali Kemal Yılmaz" →
 * fn "ali kemal", ln "yılmaz". Türkçede çok adlı kişide doğru olan budur.
 */
export function splitName(source: MatchingSource): {
  first: string;
  last: string;
} {
  const first = normalizeName(source.firstName);
  const last = normalizeName(source.lastName);
  if (first && last) return { first, last };

  const parts = normalizeName(source.fullName).split(" ").filter(Boolean);
  if (parts.length === 0) return { first, last };
  if (parts.length === 1) return { first: first || parts[0], last };

  return {
    first: first || parts.slice(0, -1).join(" "),
    last: last || parts[parts.length - 1],
  };
}

/** Üyeyi Meta sütunlarına çevirir. Eksik alan boş dizedir — satır atılmaz. */
export function toMatchingRow(source: MatchingSource): MatchingRow {
  const { first, last } = splitName(source);

  return {
    email: normalizeEmail(source.email),
    phone: normalizePhone(source.phone),
    fn: first,
    ln: last,
    ct: normalizePlace(source.city),
    st: normalizePlace(source.state),
    country: normalizeCountry(source.country),
    zip: normalizeZip(source.postalCode),
    dob: normalizeBirthDate(source.birthDate),
    ge: normalizeGender(source.gender),
  };
}

/**
 * Satırın eşleşme gücü: dolu "çok önemli" alan 2, "önemli" 1, "ek eşleşme"
 * 0,5 puan. Panelde "kaç kaydın verisi reklam eşleşmesine yetiyor" göstergesi
 * bunu kullanır — eksik telefonun maliyeti görünsün.
 */
const FIELD_WEIGHT: Record<MetaField, number> = {
  email: 2,
  phone: 2,
  fn: 1,
  ln: 1,
  ct: 0.5,
  st: 0.5,
  country: 0.5,
  zip: 0.5,
  dob: 0.5,
  ge: 0.25,
};

export const MAX_MATCH_SCORE = Object.values(FIELD_WEIGHT).reduce(
  (sum, weight) => sum + weight,
  0,
);

export function matchScore(row: MatchingRow): number {
  return META_FIELDS.reduce(
    (score, field) => (row[field] ? score + FIELD_WEIGHT[field] : score),
    0,
  );
}

/** Yükleme için yeterli mi: e-posta VEYA telefon olmadan eşleşme olmaz. */
export function isMatchable(row: MatchingRow): boolean {
  return Boolean(row.email || row.phone);
}

/** Kaç yaşında — doğum tarihinden, salon saatine göre değil takvimle. */
export function ageFrom(birthDate: Date | null | undefined, now = new Date()): number | null {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 120 ? age : null;
}
