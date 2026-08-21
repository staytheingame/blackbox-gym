export type EquipmentItem = {
  slug: string;
  name: string;
  category: "Vuruş" | "Koruma" | "Kondisyon" | "Ring & Saha";
  description: string;
};

export const equipmentCatalog: EquipmentItem[] = [
  {
    slug: "boks-torbasi",
    name: "Boks Torbası",
    category: "Vuruş",
    description:
      "Ağır torba istasyonları; vuruş gücü, kombinasyon ve dayanıklılık çalışması için.",
  },
  {
    slug: "odak-pedi",
    name: "Odak Pedi (Focus Mitts)",
    category: "Vuruş",
    description: "Antrenörle birebir kombinasyon ve reaksiyon çalışması.",
  },
  {
    slug: "hız-topu",
    name: "Hız Topu (Speed Bag)",
    category: "Vuruş",
    description: "El hızı, ritim ve omuz dayanıklılığı geliştirme istasyonu.",
  },
  {
    slug: "boks-eldiveni",
    name: "Boks Eldiveni",
    category: "Koruma",
    description: "Torba ve sparring için farklı ağırlıklarda salon eldivenleri.",
  },
  {
    slug: "kafa-koruyucu",
    name: "Kafa Koruyucu",
    category: "Koruma",
    description: "Sparring seanslarında zorunlu güvenlik ekipmanı.",
  },
  {
    slug: "ağız-ve-şok-koruyucu",
    name: "Ağızlık & Şok Koruyucu",
    category: "Koruma",
    description: "Kontrollü sparring için standart koruma seti.",
  },
  {
    slug: "ip-atlama",
    name: "İp Atlama",
    category: "Kondisyon",
    description: "Ayak işi, kalp-damar kondisyonu ve ısınma çalışmaları.",
  },
  {
    slug: "denge-ve-güç-alanı",
    name: "Fonksiyonel Güç Alanı",
    category: "Kondisyon",
    description: "Kettlebell, direnç bandı ve slam ball ile kondisyon istasyonu.",
  },
  {
    slug: "boks-ringi",
    name: "Boks Ringi",
    category: "Ring & Saha",
    description: "Kontrollü sparring ve fight-prep seansları için tam boy ring.",
  },
  {
    slug: "mma-kafesi",
    name: "Fight Alanı (Kafes)",
    category: "Ring & Saha",
    description: "Fight-prep programı kapsamında serbest çalışma ve taktik alanı.",
  },
];
