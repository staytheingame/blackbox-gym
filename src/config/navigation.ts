export type NavItem = {
  label: string;
  href: string;
};

export const primaryNav: NavItem[] = [
  { label: "Ana Sayfa", href: "/" },
  { label: "Üyelikler", href: "/uyelikler" },
  { label: "Antrenman Planları", href: "/antrenman-planlari" },
  { label: "Ekipman", href: "/ekipman" },
  { label: "Dersler", href: "/dersler" },
  { label: "Antrenörler", href: "/antrenorler" },
  { label: "İletişim", href: "/iletisim" },
];

export const ctaNav: NavItem = { label: "Üye Ol", href: "/uyelikler" };

export const siteConfig = {
  name: "BlackBox",
  tagline: "Box & Fight Gym",
  description:
    "BlackBox, boks ve fight sporlarına odaklanan bir salon. Antrenman planları, ekipman ve ders programıyla ringe hazırlanın.",
  city: "İstanbul",
};
