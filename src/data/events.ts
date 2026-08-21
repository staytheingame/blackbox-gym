/**
 * Salon etkinlikleri — sparring geceleri, iç turnuva, seminer.
 *
 * Kong Academy'nin "Etkinlikler" modülünün fight karşılığı. Şimdilik statik
 * örnek veri (tarihler örnektir); `Event` + `EventParticipant` tabloları
 * geldiğinde arayüz aynı kalır, kaynak değişir.
 */

export type GymEventType = "sparring" | "turnuva" | "seminer" | "test";

export type GymEvent = {
  slug: string;
  title: string;
  type: GymEventType;
  /** ISO tarih — yerel saat dilimi inceliği veri modeliyle gelecek. */
  date: string;
  time: string;
  level: "Herkes" | "Orta ve üzeri" | "İleri";
  capacity: number;
  registered: number;
  description: string;
};

export const EVENT_TYPE_LABEL: Record<GymEventType, string> = {
  sparring: "Sparring Gecesi",
  turnuva: "İç Turnuva",
  seminer: "Seminer",
  test: "Seviye Testi",
};

export const gymEvents: GymEvent[] = [
  {
    slug: "sparring-gecesi-agustos",
    title: "Sparring Gecesi",
    type: "sparring",
    date: "2026-08-22",
    time: "20:00",
    level: "Orta ve üzeri",
    capacity: 16,
    registered: 11,
    description:
      "Kontrollü sparring — eşleşmeler seviyeye ve kiloya göre yapılır. Kask, dişlik ve 16 oz eldiven zorunlu.",
  },
  {
    slug: "teknik-seminer-savunma",
    title: "Savunma Semineri: Slip & Roll",
    type: "seminer",
    date: "2026-08-29",
    time: "19:00",
    level: "Herkes",
    capacity: 24,
    registered: 18,
    description:
      "Baş hareketi, rulo ve karşı vuruş üçlüsü üzerine iki saatlik teknik seminer.",
  },
  {
    slug: "seviye-testi-eylul",
    title: "Seviye Testi",
    type: "test",
    date: "2026-09-05",
    time: "18:00",
    level: "Herkes",
    capacity: 30,
    registered: 7,
    description:
      "Teknik, kondisyon ve refleks testleri; sonuç performans kartına işlenir.",
  },
  {
    slug: "ic-turnuva-blackbox-cup",
    title: "BlackBox Cup — İç Turnuva",
    type: "turnuva",
    date: "2026-09-19",
    time: "17:00",
    level: "İleri",
    capacity: 12,
    registered: 5,
    description:
      "Sıklet bazlı iç turnuva. Katılım için son 8 haftada en az 20 antrenman kaydı gerekir.",
  },
];
