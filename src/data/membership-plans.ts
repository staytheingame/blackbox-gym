export type MembershipPlan = {
  slug: string;
  name: string;
  durationLabel: string;
  price: number;
  currency: "TRY";
  highlight?: boolean;
  perks: string[];
};

export const membershipPlans: MembershipPlan[] = [
  {
    slug: "aylik",
    name: "Aylık",
    durationLabel: "1 Ay",
    price: 1800,
    currency: "TRY",
    perks: [
      "Sınırsız salon girişi",
      "Boks & fight grup dersleri",
      "Ekipman kullanımı (torba, ring, ped)",
      "Soyunma odası ve duş",
    ],
  },
  {
    slug: "3-aylik",
    name: "3 Aylık",
    durationLabel: "3 Ay",
    price: 4800,
    currency: "TRY",
    highlight: true,
    perks: [
      "Aylık pakete ait her şey",
      "Haftada 1 kişisel antrenman seansı",
      "Antrenman planı takibi",
      "1 kez dondurma hakkı",
    ],
  },
  {
    slug: "6-aylik",
    name: "6 Aylık",
    durationLabel: "6 Ay",
    price: 8700,
    currency: "TRY",
    perks: [
      "3 aylık pakete ait her şey",
      "Sparring seanslarına öncelikli katılım",
      "Beslenme yönlendirme notları",
      "2 kez dondurma hakkı",
    ],
  },
  {
    slug: "yillik",
    name: "Yıllık",
    durationLabel: "12 Ay",
    price: 15600,
    currency: "TRY",
    perks: [
      "6 aylık pakete ait her şey",
      "Yılda 4 kez dondurma hakkı",
      "Fight-prep kampı önceliği",
      "Misafir davet hakkı (ayda 1)",
    ],
  },
];
