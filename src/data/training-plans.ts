export type TrainingPlan = {
  slug: string;
  level: "Başlangıç" | "Orta" | "İleri";
  title: string;
  summary: string;
  weeklySplit: { day: string; focus: string }[];
};

export const trainingPlans: TrainingPlan[] = [
  {
    slug: "baslangic-temel-boks",
    level: "Başlangıç",
    title: "Temel Boks",
    summary:
      "Duruş, adım işi ve temel dört vuruşa (jab, cross, hook, uppercut) odaklanan giriş seviyesi program.",
    weeklySplit: [
      { day: "Pazartesi", focus: "Duruş & jab-cross tekrarları" },
      { day: "Çarşamba", focus: "Ayak işi & gölge boks" },
      { day: "Cuma", focus: "Torba çalışması & temel kombinasyonlar" },
    ],
  },
  {
    slug: "orta-kombinasyon-fight",
    level: "Orta",
    title: "Kombinasyon & Fight Hazırlığı",
    summary:
      "Kombinasyon vuruş dizileri, savunma teknikleri ve kontrollü ped çalışmasıyla ring temposunu artıran program.",
    weeklySplit: [
      { day: "Pazartesi", focus: "Ped çalışması & kombinasyonlar" },
      { day: "Salı", focus: "Kondisyon & interval antrenman" },
      { day: "Perşembe", focus: "Savunma & karşı vuruş (counter)" },
      { day: "Cumartesi", focus: "Kontrollü sparring" },
    ],
  },
  {
    slug: "ileri-fight-prep",
    level: "İleri",
    title: "Fight-Prep Kampı",
    summary:
      "Maça çıkacak veya üst düzey performans hedefleyen sporcular için yoğun sparring, taktik ve kondisyon bloğu.",
    weeklySplit: [
      { day: "Pazartesi", focus: "Taktik sparring" },
      { day: "Salı", focus: "Güç & patlayıcılık" },
      { day: "Çarşamba", focus: "Ped & kombinasyon hızı" },
      { day: "Perşembe", focus: "Kondisyon (HIIT + ip atlama)" },
      { day: "Cuma", focus: "Tam temas sparring" },
      { day: "Cumartesi", focus: "Aktif toparlanma & mobilite" },
    ],
  },
];
