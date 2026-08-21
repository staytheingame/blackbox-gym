export type ClassSession = {
  day: string;
  sessions: { time: string; name: string; coach: string; level: string }[];
};

export const weeklySchedule: ClassSession[] = [
  {
    day: "Pazartesi",
    sessions: [
      { time: "07:00", name: "Sabah Boks", coach: "Emre Kaya", level: "Tüm seviyeler" },
      { time: "18:30", name: "Kickbox", coach: "Deniz Ay", level: "Orta" },
      { time: "20:00", name: "Fight Prep", coach: "Emre Kaya", level: "İleri" },
    ],
  },
  {
    day: "Salı",
    sessions: [
      { time: "07:00", name: "Kondisyon", coach: "Selin Er", level: "Tüm seviyeler" },
      { time: "19:00", name: "Temel Boks", coach: "Deniz Ay", level: "Başlangıç" },
    ],
  },
  {
    day: "Çarşamba",
    sessions: [
      { time: "07:00", name: "Sabah Boks", coach: "Emre Kaya", level: "Tüm seviyeler" },
      { time: "18:30", name: "Kickbox", coach: "Deniz Ay", level: "Orta" },
      { time: "20:00", name: "Kontrollü Sparring", coach: "Emre Kaya", level: "İleri" },
    ],
  },
  {
    day: "Perşembe",
    sessions: [
      { time: "07:00", name: "Kondisyon", coach: "Selin Er", level: "Tüm seviyeler" },
      { time: "19:00", name: "Fight Prep", coach: "Emre Kaya", level: "İleri" },
    ],
  },
  {
    day: "Cuma",
    sessions: [
      { time: "07:00", name: "Sabah Boks", coach: "Emre Kaya", level: "Tüm seviyeler" },
      { time: "18:30", name: "Temel Boks", coach: "Deniz Ay", level: "Başlangıç" },
      { time: "20:00", name: "Tam Temas Sparring", coach: "Emre Kaya", level: "İleri" },
    ],
  },
  {
    day: "Cumartesi",
    sessions: [
      { time: "10:00", name: "Aile Boks", coach: "Selin Er", level: "Tüm seviyeler" },
      { time: "12:00", name: "Kickbox", coach: "Deniz Ay", level: "Orta" },
    ],
  },
];
