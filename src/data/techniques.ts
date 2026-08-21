/**
 * Teknik & kombinasyon kütüphanesi — panelin fight ekseninin içerik kaynağı.
 *
 * Kong Academy'nin "Egzersiz Kütüphanesi"nin karşılığı; oradaki fitness
 * hareketleri yerine boks/kickbox teknikleri ve kombinasyonlar. Şimdilik
 * statik: veri modeli geldiğinde (`Technique` tablosu) buradan okunmaya
 * devam eden arayüz aynı kalır.
 */

export type TechniqueCategory = "vurus" | "savunma" | "ayak-isi" | "kombinasyon";

export type Technique = {
  slug: string;
  name: string;
  category: TechniqueCategory;
  level: "Başlangıç" | "Orta" | "İleri";
  /** Numaralı boks dizilimi (1 = jab, 2 = cross, 3 = sol kroşe …). */
  numbering?: string;
  summary: string;
  cues: string[];
  commonMistakes: string[];
};

export const TECHNIQUE_CATEGORY_LABEL: Record<TechniqueCategory, string> = {
  vurus: "Vuruş",
  savunma: "Savunma",
  "ayak-isi": "Ayak İşi",
  kombinasyon: "Kombinasyon",
};

export const techniques: Technique[] = [
  {
    slug: "jab",
    name: "Jab",
    category: "vurus",
    level: "Başlangıç",
    numbering: "1",
    summary:
      "Öndeki elle atılan, mesafe ölçen ve ritmi kuran en temel vuruş. Kampın her haftasında tekrar edilir.",
    cues: [
      "Omuz çeneyi korur, dirsek gövdeye yakın çıkar",
      "Yumruk hedefte döner, geri dönüş gidişten hızlı",
      "Arka el çenede kalır",
    ],
    commonMistakes: [
      "Vuruştan önce eli aşağı indirmek (telegraf)",
      "Geri çekerken guard'ı düşürmek",
      "Ağırlığı tamamen öne bindirmek",
    ],
  },
  {
    slug: "cross",
    name: "Cross (Sağ Direkt)",
    category: "vurus",
    level: "Başlangıç",
    numbering: "2",
    summary:
      "Arka elden gelen güç vuruşu; kalça ve arka ayak dönüşünden beslenir.",
    cues: [
      "Arka topuk dışa döner, kalça vuruşu iter",
      "Ön el çeneyi korur",
      "Vuruş bittiğinde duruşa geri dön",
    ],
    commonMistakes: [
      "Yalnız kolla vurmak, kalçayı döndürmemek",
      "Çeneyi havada bırakmak",
      "Aşırı uzanıp dengeyi kaybetmek",
    ],
  },
  {
    slug: "sol-krose",
    name: "Sol Kroşe",
    category: "vurus",
    level: "Orta",
    numbering: "3",
    summary:
      "Yakın mesafede, yatay yay çizen vuruş. Ön ayak dönüşüyle güç kazanır.",
    cues: [
      "Dirsek omuz hizasında, 90 derece",
      "Ön ayak topuğu dışa döner",
      "Gövde döner, kol taşınır",
    ],
    commonMistakes: [
      "Kolu savurmak (loop)",
      "Ayak dönüşü olmadan sadece kol kullanmak",
      "Vuruş sonrası guard'a dönmemek",
    ],
  },
  {
    slug: "aper",
    name: "Aper (Uppercut)",
    category: "vurus",
    level: "Orta",
    numbering: "5-6",
    summary: "Yakın mesafede aşağıdan yukarı gelen, guard'ı açan vuruş.",
    cues: [
      "Dizden hafif çök, bacakla it",
      "Avuç içi kendine bakar",
      "Kısa yol — omuzdan uzağa çıkma",
    ],
    commonMistakes: [
      "Çok geriden savurmak",
      "Çeneyi öne uzatmak",
      "Mesafeyi ayarlamadan denemek",
    ],
  },
  {
    slug: "slip",
    name: "Slip (Baş Kaydırma)",
    category: "savunma",
    level: "Başlangıç",
    summary:
      "Gelen direkt vuruşun yanına baş hareketiyle çıkma — vuruş menzilinde kalırsın, karşı vuruş açılır.",
    cues: [
      "Belden değil dizden hareket",
      "Gözler rakipte kalır",
      "Kayma minimal, abartma",
    ],
    commonMistakes: [
      "Gövdeyi tamamen yana yatırmak",
      "Gözü kapatmak",
      "Kaydıktan sonra merkeze dönmemek",
    ],
  },
  {
    slug: "roll",
    name: "Roll (Rulo)",
    category: "savunma",
    level: "Orta",
    summary: "Gelen kroşenin altından U çizerek geçme; karşı kroşe açar.",
    cues: [
      "Dizler yaylanır, sırt dik",
      "U hareketi kısa ve hızlı",
      "Çıkışta guard yerinde",
    ],
    commonMistakes: [
      "Öne eğilip başı hedefe sunmak",
      "Çok geniş rulo yapmak",
      "Elleri indirmek",
    ],
  },
  {
    slug: "pivot",
    name: "Pivot",
    category: "ayak-isi",
    level: "Orta",
    summary:
      "Ön ayak etrafında dönerek açı alma — köşeden çıkmanın ve karşı vuruşun anahtarı.",
    cues: [
      "Ön ayak topuğu üzerinde dön",
      "Arka ayak yay çizer",
      "Dönüş sırasında guard sabit",
    ],
    commonMistakes: [
      "Ayakları çaprazlamak",
      "Dönerken dengeyi kaybetmek",
      "Dönüş sonrası vuruş üretmemek",
    ],
  },
  {
    slug: "cift-jab-cross",
    name: "Çift Jab — Cross",
    category: "kombinasyon",
    level: "Başlangıç",
    numbering: "1-1-2",
    summary:
      "Mesafe kapatan klasik giriş kombinasyonu; ikinci jab rakibi meşgul eder, cross gelir.",
    cues: [
      "İlk jab mesafe ölçer, ikincisi baskı yapar",
      "Cross'ta kalça döner",
      "Kombinasyon sonunda yandan çık",
    ],
    commonMistakes: [
      "İki jab'ı aynı tempoda atmak",
      "Kombinasyon sonrası aynı yerde kalmak",
      "Nefesi tutmak",
    ],
  },
  {
    slug: "jab-cross-krose",
    name: "Jab — Cross — Sol Kroşe",
    category: "kombinasyon",
    level: "Orta",
    numbering: "1-2-3",
    summary:
      "Üçlü temel seri: düz hattan gelip yandan bitirir. Ped ve torba çalışmasının belkemiği.",
    cues: [
      "Her vuruşta ağırlık aktarımı",
      "Kroşede ön ayak döner",
      "Seri sonunda slip ya da pivot",
    ],
    commonMistakes: [
      "Vuruşları birbirine yapıştırmak (güç kaybı)",
      "Kroşeyi kolla savurmak",
      "Guard'ı unutmak",
    ],
  },
  {
    slug: "roll-krose-aper",
    name: "Roll — Sol Kroşe — Aper",
    category: "kombinasyon",
    level: "İleri",
    numbering: "roll-3-6",
    summary:
      "Savunmadan hücuma geçiş serisi: gelen kroşenin altından geçip yakın mesafede iki vuruşla karşılık ver.",
    cues: [
      "Rulodan çıkarken ayak zemine basar",
      "Kroşe kısa mesafede",
      "Aper'de dizden güç al",
    ],
    commonMistakes: [
      "Ruloyu çok yavaş yapmak",
      "Karşı vuruşu geciktirmek",
      "Yakın mesafede guard'ı açmak",
    ],
  },
];

export function techniquesByCategory(
  category: TechniqueCategory | "hepsi",
): Technique[] {
  if (category === "hepsi") return techniques;
  return techniques.filter((technique) => technique.category === category);
}

/** Plan/müfredat maddelerinden teknik kartına köprü. */
export function techniqueBySlug(slug: string): Technique | undefined {
  return techniques.find((technique) => technique.slug === slug);
}
