export type Coach = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  focus: string[];
};

export const coaches: Coach[] = [
  {
    slug: "emre-kaya",
    name: "Emre Kaya",
    role: "Baş Antrenör — Boks",
    bio: "12 yıllık aktif boks geçmişi ve fight-prep kampı deneyimiyle salonun teknik direktörü.",
    focus: ["Fight-prep", "Sparring", "İleri kombinasyon"],
  },
  {
    slug: "deniz-ay",
    name: "Deniz Ay",
    role: "Kickbox Antrenörü",
    bio: "Kickbox ve temel boks derslerinde başlangıç/orta seviye sporculara odaklanır.",
    focus: ["Kickbox", "Temel teknik", "Ayak işi"],
  },
  {
    slug: "selin-er",
    name: "Selin Er",
    role: "Kondisyon Antrenörü",
    bio: "Boksa özel kondisyon, kalp-damar dayanıklılığı ve fonksiyonel güç programları hazırlar.",
    focus: ["Kondisyon", "Fonksiyonel güç", "Toparlanma"],
  },
];
