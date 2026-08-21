/**
 * Public tanıtım sitesindeki paket vitrini.
 *
 * Panel tarafındaki gerçek paketler veritabanında (`MembershipPlan`) durur;
 * burası yalnız pazarlama metnidir. İkisi **aynı modeli** anlatmalı: BlackBox
 * üyeliği bir **ders paketi**dir — kaç ders, ne kadar sürede kullanılacak.
 * Fiyat/ders adedi değişirse iki tarafı birlikte güncelle.
 */
export type MembershipPlan = {
  slug: string;
  name: string;
  durationLabel: string;
  /** Pakette kaç ders var; `null` = sınırsız. */
  sessions: number | null;
  price: number;
  currency: "TRY";
  highlight?: boolean;
  perks: string[];
};

export const membershipPlans: MembershipPlan[] = [
  {
    slug: "8-ders",
    name: "8 Derslik Başlangıç",
    durationLabel: "45 gün içinde",
    sessions: 8,
    price: 1600,
    currency: "TRY",
    perks: [
      "Haftada iki ders temposu",
      "Birebir ya da grup — fark etmez",
      "Antrenörün açık saatlerinden kendin seç",
      "Ekipman kullanımı (torba, ring, ped)",
    ],
  },
  {
    slug: "16-ders",
    name: "16 Derslik Standart",
    durationLabel: "60 gün içinde",
    sessions: 16,
    price: 2800,
    currency: "TRY",
    highlight: true,
    perks: [
      "Başlangıç paketindeki her şey",
      "Kişisel antrenman programı takibi",
      "Haftalık kontrol ve performans kartı",
      "Tartı & sıklet takibi",
    ],
  },
  {
    slug: "24-ders",
    name: "24 Derslik Maç Kampı",
    durationLabel: "90 gün içinde",
    sessions: 24,
    price: 6500,
    currency: "TRY",
    perks: [
      "Standart paketteki her şey",
      "Maç kampı protokolü ve sparring geceleri",
      "Kamp boyunca sıklet planlaması",
      "Ring formu analizi (dövüş analitiği)",
    ],
  },
  {
    slug: "aylik-sinirsiz",
    name: "Aylık Sınırsız",
    durationLabel: "30 gün",
    sessions: null,
    price: 3200,
    currency: "TRY",
    perks: [
      "Ders sınırı yok",
      "Açık olan her saate rezervasyon",
      "Grup derslerine katılım önceliği",
      "Tüm takip ekranları dahil",
    ],
  },
];
