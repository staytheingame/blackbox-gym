import type { IconProps } from "@/components/panel/icons";
import {
  BeltIcon,
  CalendarIcon,
  ChartIcon,
  ClipboardIcon,
  ClockIcon,
  GloveIcon,
  GridIcon,
  InboxIcon,
  AppleIcon,
  BellIcon,
  MessageIcon,
  PlanIcon,
  ScaleIcon,
  SettingsIcon,
  ShieldIcon,
  SignatureIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/panel/icons";

/**
 * Panel gezinmesinin TEK doğru kaynağı — personel ve üye, masaüstü ve mobil.
 *
 * Yapı Kong Academy'nin `nav-config.tsx` modelinden alındı (bölüm → alt sayfa,
 * 2 kademe; üçüncü kademe yok, alt sekmeler sayfa içinde `?tab=` ile yaşar).
 * İçerik BlackBox'a göre yeniden yazıldı: beslenme/kalori ekseni yerine
 * **fight** ekseni — kamp, tartı, teknik, sparring, ring formu.
 *
 *   - `sectionsForRole(role)`   → yan menü bölümleri
 *   - `mobileTabsForRole(role)` → mobil alt bar (aynı kaynaktan, `mobileOrder`)
 *   - `SectionNav`              → bulunduğun bölümün alt sayfaları (yatay şerit)
 *
 * Yeni sayfa eklerken buraya da ekle — aksi hâlde hiçbir menüde çıkmaz.
 * Menüden çıkarmak sayfayı silmez; rota çalışmaya devam eder.
 */

/**
 * Üç panel var, üç menü: sporcu (/uye), antrenör (/personel), yönetici
 * (/yonetim). Yönetici antrenör panelini de görebilir — kabuğa hangi rolün
 * menüsünü basacağı bulunduğu yola göre seçilir (bkz. ilgili `layout.tsx`).
 */
export type PanelRole = "member" | "staff" | "admin";

/** Rozet anahtarları — sayıları `src/lib/queries/nav-badges.ts` hesaplar. */
export type BadgeKey =
  | "pendingCheckIns" // personel: incelenmemiş check-in
  | "pendingBookings" // personel: onay bekleyen grup dersi isteği
  | "pendingAttendance" // personel: yoklaması alınmamış geçmiş seans
  | "pendingInvites" // personel/yönetici: hesabını kurmamış davetli sporcu
  | "unassignedRegistrations" // yönetici: kayıt linkinden gelip antrenörü atanmamış
  | "newLeads" // personel: başvuru sayfasından gelip henüz aranmamış aday
  | "pendingWaivers" // personel: onam/sağlık beyanı eksik sporcu
  | "rankReady" // personel: terfiye hazır sporcu
  | "checkInDue" // üye: bu haftanın kontrolü gönderilmedi
  | "waiverDue" // üye: imzalanmamış ya da eskimiş onam formu
  | "unreadNotifications" // her üç rol: okunmamış bildirim
  | "unreadMessages"; // her iki rol

/** Kapalı bayraklı bölüm menüde çıkmaz (bkz. `src/config/feature-flags.ts`). */
export type FeatureFlag = "mesajlar" | "protokoller" | "kusaklar" | "onaylar";

export type PanelNavItem = {
  id: string;
  label: string;
  href: string;
  icon: (props: IconProps) => React.ReactNode;
  roles: PanelRole[];
  children?: PanelNavItem[];
  badgeKey?: BadgeKey;
  featureFlag?: FeatureFlag;
  /** Mobil alt barda kaçıncı sırada (yoksa alt barda çıkmaz). */
  mobileOrder?: number;
  /** Alt barda / dar şeritte kullanılan kısa ad. */
  shortLabel?: string;
  /** Şeritte kısa etiket sığmıyorsa sayfa başlığında görünen tam ad. */
  title?: string;
};

/* ═══════════════════════════════════════════════════════════════
   PERSONEL — 8 bölüm (Kong'un koç panelinin fight karşılığı)
   ═══════════════════════════════════════════════════════════════ */
const STAFF_NAV: PanelNavItem[] = [
  {
    id: "genel-bakis",
    label: "Genel Bakış",
    href: "/personel",
    icon: GridIcon,
    roles: ["staff"],
    mobileOrder: 1,
    shortLabel: "Panel",
  },

  {
    id: "sporcular",
    label: "Sporcular",
    href: "/personel/uyeler",
    icon: UsersIcon,
    roles: ["staff"],
    mobileOrder: 3,
    children: [
      {
        id: "sporcu-liste",
        label: "Liste",
        href: "/personel/uyeler",
        icon: UsersIcon,
        roles: ["staff"],
        title: "Sporcu Listesi",
      },
      {
        id: "sporcu-davetler",
        label: "Davetler",
        href: "/personel/davetler",
        icon: InboxIcon,
        roles: ["staff"],
        title: "Hesabını Kurmayı Bekleyenler",
        badgeKey: "pendingInvites",
      },
      {
        id: "sporcu-adaylar",
        label: "Adaylar",
        href: "/personel/adaylar",
        icon: InboxIcon,
        roles: ["staff"],
        title: "Aday & Deneme Dersi Takibi",
      },
      {
        id: "sporcu-onaylar",
        label: "Onaylar",
        href: "/personel/onaylar",
        icon: SignatureIcon,
        roles: ["staff"],
        title: "Onam & Sağlık Beyanı",
        badgeKey: "pendingWaivers",
        featureFlag: "onaylar",
      },
    ],
  },

  {
    id: "kasam",
    label: "Kasam",
    href: "/personel/kasa",
    icon: WalletIcon,
    roles: ["staff"],
    shortLabel: "Kasa",
    title: "Hakedişim & Sporcularımın Ödemeleri",
  },

  {
    id: "planlar",
    label: "Planlar",
    href: "/personel/planlar",
    icon: PlanIcon,
    roles: ["staff"],
    children: [
      {
        id: "plan-antrenman",
        label: "Antrenman",
        href: "/personel/planlar?tur=antrenman",
        icon: GloveIcon,
        roles: ["staff"],
        title: "Antrenman Şablonları",
      },
      {
        id: "plan-kondisyon",
        label: "Kondisyon",
        href: "/personel/planlar?tur=kondisyon",
        icon: ChartIcon,
        roles: ["staff"],
        title: "Kondisyon Şablonları",
      },
      {
        id: "plan-beslenme",
        label: "Beslenme",
        href: "/personel/beslenme",
        icon: AppleIcon,
        roles: ["staff"],
        title: "Beslenme Planları",
      },
      {
        id: "plan-kusaklar",
        label: "Kuşaklar",
        href: "/personel/kusaklar",
        icon: BeltIcon,
        roles: ["staff"],
        title: "Kuşak & Müfredat",
        badgeKey: "rankReady",
        featureFlag: "kusaklar",
      },
      {
        id: "plan-teknikler",
        label: "Teknikler",
        href: "/personel/teknikler",
        icon: GloveIcon,
        roles: ["staff"],
        title: "Teknik & Kombinasyon Kütüphanesi",
      },
      {
        id: "plan-tarti",
        label: "Tartı",
        href: "/personel/tarti",
        icon: ScaleIcon,
        roles: ["staff"],
        title: "Kilo & Tartı Takibi",
      },
    ],
  },

  {
    id: "protokoller",
    label: "Kamp Protokolleri",
    href: "/personel/protokoller",
    icon: ShieldIcon,
    roles: ["staff"],
    featureFlag: "protokoller",
    title: "Hazır Maç Kampı Protokolleri",
    shortLabel: "Kamp",
  },

  {
    id: "ders-programi",
    label: "Ders Programı",
    href: "/personel/bugun",
    icon: CalendarIcon,
    roles: ["staff"],
    mobileOrder: 2,
    shortLabel: "Program",
    badgeKey: "pendingBookings",
    children: [
      {
        id: "program-bugun",
        label: "Bugün",
        href: "/personel/bugun",
        icon: ClockIcon,
        roles: ["staff"],
        title: "Günün Akışı — Kim Geliyor",
      },
      {
        id: "program-takvim",
        label: "Saatlerim",
        href: "/personel/program",
        icon: CalendarIcon,
        roles: ["staff"],
        title: "Açık Saatler & Rezervasyonlar",
      },
      {
        id: "program-istekler",
        label: "İstekler",
        href: "/personel/program/istekler",
        icon: InboxIcon,
        roles: ["staff"],
        title: "Grup Dersi Katılım İstekleri",
        badgeKey: "pendingBookings",
      },
      {
        id: "program-yoklama",
        label: "Yoklama",
        href: "/personel/program/yoklama",
        icon: ClipboardIcon,
        roles: ["staff"],
        title: "Geçmiş Seans Yoklaması",
        badgeKey: "pendingAttendance",
      },
    ],
  },

  {
    id: "takip",
    label: "Takip",
    href: "/personel/check-inler",
    icon: ClipboardIcon,
    roles: ["staff"],
    badgeKey: "pendingCheckIns",
    mobileOrder: 4,
    shortLabel: "Takip",
    children: [
      {
        id: "takip-kontroller",
        label: "Kontroller",
        href: "/personel/check-inler",
        icon: ClipboardIcon,
        roles: ["staff"],
        title: "Haftalık Kontroller",
        badgeKey: "pendingCheckIns",
      },
      {
        id: "takip-radar",
        label: "Radar",
        href: "/personel/icgoruler",
        icon: ChartIcon,
        roles: ["staff"],
        title: "Takip Radarı — Bugün Kimden Başlanacak",
      },
      {
        id: "takip-karne",
        label: "Karnem",
        href: "/personel/karne",
        icon: TrophyIcon,
        roles: ["staff"],
        title: "Karnem — Derslerim ve Bekleyen İşlerim",
      },
      {
        id: "takip-mesajlar",
        label: "Mesajlar",
        href: "/personel/mesajlar",
        icon: MessageIcon,
        roles: ["staff"],
        featureFlag: "mesajlar",
        badgeKey: "unreadMessages",
      },
    ],
  },

  {
    id: "yonetim",
    label: "Yönetim",
    href: "/personel/uyelikler",
    icon: ShieldIcon,
    roles: ["staff"],
    // Yeni başvuru (henüz aranmamış aday) varsa menüde sayı görünür.
    badgeKey: "newLeads",
    children: [
      {
        id: "yonetim-uyelikler",
        label: "Üyelikler",
        href: "/personel/uyelikler",
        icon: ShieldIcon,
        roles: ["staff"],
        title: "Üyelik & Ödeme Durumu",
      },
      {
        id: "yonetim-paketler",
        label: "Paket Fiyatları",
        href: "/personel/paketler",
        icon: ShieldIcon,
        roles: ["staff"],
        title: "Paket Fiyatları",
      },
      {
        id: "yonetim-basvurular",
        label: "Başvurular",
        href: "/personel/basvurular",
        icon: InboxIcon,
        roles: ["staff"],
        title: "Başvurular",
        badgeKey: "newLeads",
      },
      {
        id: "yonetim-duyurular",
        label: "Duyurular",
        href: "/personel/duyurular",
        icon: MessageIcon,
        roles: ["staff"],
      },
      {
        id: "yonetim-etkinlikler",
        label: "Etkinlikler",
        href: "/personel/etkinlikler",
        icon: TrophyIcon,
        roles: ["staff"],
        title: "Sparring Geceleri & Fight Night",
      },
    ],
  },

  {
    id: "bildirimler",
    label: "Bildirimler",
    href: "/personel/bildirimler",
    icon: BellIcon,
    roles: ["staff"],
    badgeKey: "unreadNotifications",
    mobileOrder: 5,
    shortLabel: "Bildirim",
    title: "Bildirim Kutusu & Hatırlatmalar",
  },

  {
    id: "ayarlar",
    label: "Ayarlar",
    href: "/personel/ayarlar",
    icon: SettingsIcon,
    roles: ["staff"],
  },
];

/* ═══════════════════════════════════════════════════════════════
   ÜYE — 6 bölüm (Kong'un danışan panelinin fight karşılığı)
   ═══════════════════════════════════════════════════════════════ */
const MEMBER_NAV: PanelNavItem[] = [
  {
    id: "ana-sayfa",
    label: "Ana Sayfa",
    href: "/uye",
    icon: GridIcon,
    roles: ["member"],
    mobileOrder: 1,
    shortLabel: "Ana Sayfa",
  },

  {
    id: "programim",
    label: "Programım",
    href: "/uye/antrenman",
    icon: PlanIcon,
    roles: ["member"],
    mobileOrder: 2,
    shortLabel: "Program",
    children: [
      {
        id: "program-antrenman",
        label: "Antrenman",
        href: "/uye/antrenman",
        icon: GloveIcon,
        roles: ["member"],
        title: "Antrenman Programım",
      },
      {
        id: "program-kondisyon",
        label: "Kondisyon",
        href: "/uye/kondisyon",
        icon: ChartIcon,
        roles: ["member"],
        title: "Kondisyon Programım",
      },
      {
        id: "program-beslenme",
        label: "Beslenme",
        href: "/uye/beslenme",
        icon: AppleIcon,
        roles: ["member"],
        title: "Beslenme Planım",
      },
      {
        id: "program-tarti",
        label: "Tartı",
        href: "/uye/tarti",
        icon: ScaleIcon,
        roles: ["member"],
        title: "Kilo & Tartı Takibim",
      },
      {
        id: "program-teknikler",
        label: "Teknikler",
        href: "/uye/teknikler",
        icon: GloveIcon,
        roles: ["member"],
        title: "Teknik & Kombinasyon Kütüphanesi",
      },
    ],
  },

  {
    id: "dersler",
    label: "Dersler",
    href: "/uye/program",
    icon: CalendarIcon,
    roles: ["member"],
    mobileOrder: 3,
    shortLabel: "Dersler",
    children: [
      {
        id: "dersler-program",
        label: "Boş Saatler",
        href: "/uye/program",
        icon: CalendarIcon,
        roles: ["member"],
        title: "Antrenörün Açık Saatleri",
      },
      {
        id: "dersler-rezervasyon",
        label: "Derslerim",
        href: "/uye/derslerim",
        icon: ClipboardIcon,
        roles: ["member"],
        title: "Rezervasyonlarım",
      },
      {
        id: "dersler-uyelik",
        label: "Üyeliğim",
        href: "/uye/uyelik",
        icon: ShieldIcon,
        roles: ["member"],
        title: "Üyelik & Ders Hakkım",
      },
      {
        id: "dersler-etkinlikler",
        label: "Etkinlikler",
        href: "/uye/etkinlikler",
        icon: TrophyIcon,
        roles: ["member"],
        title: "Sparring Geceleri",
      },
    ],
  },

  {
    id: "kontrol",
    label: "Kontrol ve Gelişim",
    href: "/uye/check-in",
    icon: ClipboardIcon,
    roles: ["member"],
    badgeKey: "checkInDue",
    mobileOrder: 4,
    shortLabel: "Kontrol",
    children: [
      {
        id: "kontrol-haftalik",
        label: "Haftalık Kontrol",
        href: "/uye/check-in",
        icon: ClipboardIcon,
        roles: ["member"],
        badgeKey: "checkInDue",
      },
      {
        id: "kontrol-gelisim",
        label: "Gelişim",
        href: "/uye/performans",
        icon: ChartIcon,
        roles: ["member"],
        title: "Performans Kartım",
      },
      {
        id: "kontrol-ring-formu",
        label: "Ring Formu",
        href: "/uye/ring-formu",
        icon: GloveIcon,
        roles: ["member"],
        title: "Dövüş Analitiği & Refleks",
      },
      {
        id: "kontrol-kusak",
        label: "Kuşağım",
        href: "/uye/kusak",
        icon: BeltIcon,
        roles: ["member"],
        title: "Kuşak & Müfredat",
        featureFlag: "kusaklar",
      },
      {
        id: "kontrol-lig",
        label: "Lig",
        href: "/uye/lig",
        icon: TrophyIcon,
        roles: ["member"],
        title: "BlackBox Ligi",
      },
    ],
  },

  {
    id: "mesajlar",
    label: "Mesajlar",
    href: "/uye/mesajlar",
    icon: MessageIcon,
    roles: ["member"],
    featureFlag: "mesajlar",
    badgeKey: "unreadMessages",
    shortLabel: "Mesaj",
    children: [
      {
        id: "mesajlar-antrenor",
        label: "Antrenörüm",
        href: "/uye/mesajlar",
        icon: MessageIcon,
        roles: ["member"],
        badgeKey: "unreadMessages",
      },
      {
        id: "mesajlar-istekler",
        label: "İstekler",
        href: "/uye/istekler",
        icon: InboxIcon,
        roles: ["member"],
        title: "Destek & İstekler",
      },
    ],
  },

  {
    id: "uye-bildirimler",
    label: "Bildirimler",
    href: "/uye/bildirimler",
    icon: BellIcon,
    roles: ["member"],
    badgeKey: "unreadNotifications",
    mobileOrder: 5,
    shortLabel: "Bildirim",
    title: "Ders Hatırlatmaları & Duyurular",
  },

  {
    id: "profil",
    label: "Profil",
    href: "/uye/profil",
    icon: UserIcon,
    roles: ["member"],
    // Bölüm, alt sayfadaki onam rozetini yansıtır: yan menü yalnız
    // bölümün kendi `badgeKey`'ini gösterir, imzasız form da sporcunun
    // başka yerden fark edemeyeceği bir "senden bekleniyor" işidir.
    badgeKey: "waiverDue",
    children: [
      {
        id: "profil-ayarlar",
        label: "Ayarlar",
        href: "/uye/profil",
        icon: SettingsIcon,
        roles: ["member"],
      },
      {
        id: "profil-onaylar",
        label: "Onaylarım",
        href: "/uye/onaylar",
        icon: SignatureIcon,
        roles: ["member"],
        title: "Onam, Sağlık Beyanı & Verilerim",
        badgeKey: "waiverDue",
        featureFlag: "onaylar",
      },
      {
        id: "profil-notlar",
        label: "Not Defterim",
        href: "/uye/notlar",
        icon: PlanIcon,
        roles: ["member"],
      },
      {
        id: "profil-araclar",
        label: "Araçlar",
        href: "/uye/araclar",
        icon: GloveIcon,
        roles: ["member"],
        title: "Sesli Refleks & Hesaplayıcılar",
      },
    ],
  },
];


/* ═══════════════════════════════════════════════════════════════
   YÖNETİCİ — salonun işletme katmanı (/yonetim)
   
   Antrenör paneli "bugün kim geliyor, kim nasıl gidiyor" sorusuna bakar;
   yönetici paneli "salon nasıl gidiyor" sorusuna. Bilinçli ayrım: paket
   tanımı, antrenör kadrosu, doluluk ve bildirim kuyruğu antrenörün günlük
   işine karışmasın diye burada durur.
   ═══════════════════════════════════════════════════════════════ */
const ADMIN_NAV: PanelNavItem[] = [
  {
    id: "yonetici-genel",
    label: "Genel Bakış",
    href: "/yonetim",
    icon: GridIcon,
    roles: ["admin"],
    mobileOrder: 1,
    shortLabel: "Panel",
  },

  {
    id: "yonetici-kadro",
    label: "Kadro",
    href: "/yonetim/kadro",
    icon: ShieldIcon,
    roles: ["admin"],
    mobileOrder: 2,
    shortLabel: "Kadro",
    title: "Antrenör & Yönetici Kadrosu",
  },

  {
    id: "yonetici-kocluk",
    label: "Koçluk",
    href: "/yonetim/kocluk",
    icon: ChartIcon,
    roles: ["admin"],
    shortLabel: "Koçluk",
    title: "Antrenör Karneleri & Bekleyen İşler",
  },

  {
    id: "yonetici-sporcular",
    label: "Sporcular",
    href: "/yonetim/uyeler",
    icon: UsersIcon,
    roles: ["admin"],
    mobileOrder: 3,
    shortLabel: "Sporcu",
    badgeKey: "pendingInvites",
    title: "Tüm Sporcular & Davet Durumu",
    children: [
      {
        id: "yonetici-sporcu-liste",
        label: "Liste",
        href: "/yonetim/uyeler",
        icon: UsersIcon,
        roles: ["admin"],
        title: "Tüm Sporcular & Davet Durumu",
      },
      {
        id: "yonetici-kayit-linki",
        label: "Kayıt Linki",
        href: "/yonetim/kayit-linki",
        icon: InboxIcon,
        roles: ["admin"],
        title: "Kayıt Bağlantısı & Gelen Kayıtlar",
        badgeKey: "unassignedRegistrations",
      },
    ],
  },

  {
    id: "yonetici-paketler",
    label: "Paketler",
    href: "/yonetim/paketler",
    icon: PlanIcon,
    roles: ["admin"],
    mobileOrder: 4,
    shortLabel: "Paket",
    title: "Üyelik Paketleri",
  },

  {
    id: "yonetici-muhasebe",
    label: "Kasa",
    href: "/yonetim/muhasebe",
    icon: WalletIcon,
    roles: ["admin"],
    mobileOrder: 5,
    shortLabel: "Kasa",
    title: "Gelir, Gider ve Kâr",
    children: [
      {
        id: "muhasebe-ozet",
        label: "Özet",
        href: "/yonetim/muhasebe",
        icon: WalletIcon,
        roles: ["admin"],
        title: "Kasa Özeti — Gelir, Gider, Kâr",
      },
      {
        id: "muhasebe-tahsilat",
        label: "Tahsilat",
        href: "/yonetim/muhasebe/tahsilat",
        icon: ClipboardIcon,
        roles: ["admin"],
        title: "Tahsilat & Borç Takibi",
      },
      {
        id: "muhasebe-giderler",
        label: "Giderler",
        href: "/yonetim/muhasebe/giderler",
        icon: ClipboardIcon,
        roles: ["admin"],
        title: "Salon Giderleri & Sabit Maliyet",
      },
      {
        id: "muhasebe-hakedis",
        label: "Hakediş",
        href: "/yonetim/muhasebe/hakedis",
        icon: ChartIcon,
        roles: ["admin"],
        title: "Antrenör Hakedişi & Ödeme",
      },
    ],
  },

  {
    id: "yonetici-raporlar",
    label: "Raporlar",
    href: "/yonetim/raporlar",
    icon: ChartIcon,
    roles: ["admin"],
    title: "Doluluk, Devamlılık ve Üyelik Raporu",
  },

  {
    id: "yonetici-kayitlar",
    label: "Kayıtlar",
    href: "/yonetim/kayitlar",
    icon: ClipboardIcon,
    roles: ["admin"],
    shortLabel: "Kayıt",
    children: [
      {
        id: "yonetici-denetim",
        label: "Denetim",
        href: "/yonetim/kayitlar",
        icon: ClipboardIcon,
        roles: ["admin"],
        title: "Denetim Kaydı — Kim Ne Yaptı",
      },
      {
        id: "yonetici-kvkk",
        label: "Veri & KVKK",
        href: "/yonetim/kvkk",
        icon: ShieldIcon,
        roles: ["admin"],
        title: "Dışa Aktarma, Veri Dökümü ve Silme Talebi",
      },
    ],
  },

  {
    id: "yonetici-bildirimler",
    label: "Bildirimler",
    href: "/yonetim/bildirimler",
    icon: BellIcon,
    roles: ["admin"],
    mobileOrder: 6,
    shortLabel: "Bildirim",
    title: "Hatırlatma Kuyruğu & Gönderim Dökümü",
  },
];

/** Rol ayrımı olmayan tek kaynak — türetmeler aşağıdaki yardımcılarla. */
export const NAVIGATION: PanelNavItem[] = [
  ...STAFF_NAV,
  ...MEMBER_NAV,
  ...ADMIN_NAV,
];

// ── Türetmeler ─────────────────────────────────────────────────

/**
 * Bayrakların varsayılan değerleri — tek kaynak burada durur, çünkü
 * `FeatureFlag` tipi de burada. `src/config/feature-flags.ts` bunu okur ve
 * ortam değişkenleriyle ezer; ters yönde import döngü yaratırdı.
 */
export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  mesajlar: true,
  // Kamp protokolleri ve kuşak merdiveni şimdilik KAPALI: panel sade kalsın,
  // antrenör yalnız ders/üye/takip işlerini görsün. Rotalar ve veri silinmedi;
  // geri açmak için Vercel ortam değişkeni yeterli
  // (NEXT_PUBLIC_FEATURE_PROTOKOLLER=true, NEXT_PUBLIC_FEATURE_KUSAKLAR=true).
  protokoller: false,
  kusaklar: false,
  // Onam formları hukuki bir gerek olduğu için varsayılan açık.
  onaylar: true,
};

const DEFAULT_ENABLED_FLAGS: ReadonlySet<FeatureFlag> = new Set(
  (Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlag[]).filter(
    (flag) => DEFAULT_FEATURE_FLAGS[flag],
  ),
);

function passesFlags(
  item: PanelNavItem,
  enabled: ReadonlySet<FeatureFlag>,
): boolean {
  return !item.featureFlag || enabled.has(item.featureFlag);
}

export function sectionsForRole(
  role: PanelRole,
  enabledFlags: ReadonlySet<FeatureFlag> = DEFAULT_ENABLED_FLAGS,
): PanelNavItem[] {
  return NAVIGATION.filter(
    (item) => item.roles.includes(role) && passesFlags(item, enabledFlags),
  ).map((item) => ({
    ...item,
    children: item.children?.filter((child) => passesFlags(child, enabledFlags)),
  }));
}

/** Mobil alt bar — yan menüyle AYNI kaynaktan, `mobileOrder` sırasına göre. */
export function mobileTabsForRole(
  role: PanelRole,
  enabledFlags: ReadonlySet<FeatureFlag> = DEFAULT_ENABLED_FLAGS,
): PanelNavItem[] {
  return sectionsForRole(role, enabledFlags)
    .filter((item) => item.mobileOrder != null)
    .sort((a, b) => (a.mobileOrder ?? 99) - (b.mobileOrder ?? 99));
}

/** '/personel/planlar?tur=antrenman' → { path, query } */
export function splitHref(href: string): { path: string; query: string } {
  const i = href.indexOf("?");
  return i === -1
    ? { path: href, query: "" }
    : { path: href.slice(0, i), query: href.slice(i + 1) };
}

/** `/uye/antrenman` ile `/uye/antrenman-plani` karışmasın diye sınır kontrollü. */
export function matchesPath(pathname: string, href: string): boolean {
  const { path } = splitHref(href);
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Bir yolun ait olduğu bölüm — en uzun eşleşen href kazanır. */
export function sectionForPath(
  sections: PanelNavItem[],
  pathname: string,
): PanelNavItem | undefined {
  let best: PanelNavItem | undefined;
  let bestLength = -1;

  for (const section of sections) {
    const candidates = section.children?.length
      ? section.children.map((child) => child.href)
      : [section.href];

    for (const href of [...candidates, section.href]) {
      const { path } = splitHref(href);
      if (matchesPath(pathname, href) && path.length > bestLength) {
        best = section;
        bestLength = path.length;
      }
    }
  }

  return best;
}

/**
 * Bu yol menüden tek dokunuşla ulaşılabilir mi? Kayıt detayları
 * (`/personel/uyeler/123`) hiçbirine tam eşleşmez — ana ekrana eklenmiş
 * uygulamada tarayıcı geri oku olmadığı için topbar'ın geri butonu çıkar.
 */
export function isNavigableRoot(
  sections: PanelNavItem[],
  pathname: string,
): boolean {
  return sections.some((section) => {
    if (splitHref(section.href).path === pathname) return true;
    return (section.children ?? []).some(
      (child) => splitHref(child.href).path === pathname,
    );
  });
}

export const PANEL_ROLE_LABEL: Record<PanelRole, string> = {
  member: "Sporcu Paneli",
  staff: "Antrenör Paneli",
  admin: "Yönetici Paneli",
};

/** Panelin kök yolu — kabuğun logosu ve "geri" düğmesi buraya bakar. */
export const PANEL_ROLE_HOME: Record<PanelRole, string> = {
  member: "/uye",
  staff: "/personel",
  admin: "/yonetim",
};
