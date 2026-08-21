/**
 * Bildirim türleri ve metinleri — saf, veritabanı bilmez.
 *
 * Kural: her bildirim TEK bir işe yarar ve tek bir yere götürür. "Bilgi olsun"
 * diye bildirim üretilmez; sporcunun ya da antrenörün yapacağı bir şey varsa
 * düşer. Sessiz kalmak, gereksiz bildirimden iyidir — telefonda susturulan
 * uygulama hiçbir hatırlatmayı iletmez.
 */

export const NOTIFICATION_KINDS = [
  // Sporcuya giden
  "ders-hatirlatma-aksam", // bir önceki gün akşam: "yarın dersin var"
  "ders-hatirlatma-gun", // dersin olduğu gün sabah
  "ders-onaylandi", // grup dersi isteği onaylandı
  "ders-reddedildi",
  "ders-siradan-yukseldi", // bekleme listesindeyken yer açıldı
  "ders-iptal", // antrenör seansı iptal etti
  "paket-bitiyor", // süre ya da ders hakkı azaldı
  "paket-bitti",
  "kontrol-hatirlatma", // haftalık check-in gönderilmedi
  "gelmedin", // yoklamada "gelmedi" işaretlendi
  // Antrenöre giden
  "koc-gun-ozeti", // yarının/bugünün ders listesi
  "koc-yoklama-bekliyor",
  "koc-istek-bekliyor",
  "koc-paket-bitiyor", // sporcunun paketi bitmek üzere
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  "ders-hatirlatma-aksam": "Ders hatırlatma (akşam)",
  "ders-hatirlatma-gun": "Ders hatırlatma (gün içi)",
  "ders-onaylandi": "Ders onayı",
  "ders-reddedildi": "Ders reddi",
  "ders-siradan-yukseldi": "Bekleme listesinden yer açıldı",
  "ders-iptal": "Ders iptali",
  "paket-bitiyor": "Paket bitiyor",
  "paket-bitti": "Paket bitti",
  "kontrol-hatirlatma": "Kontrol hatırlatma",
  gelmedin: "Gelmedi işareti",
  "koc-gun-ozeti": "Günün özeti",
  "koc-yoklama-bekliyor": "Yoklama bekliyor",
  "koc-istek-bekliyor": "İstek bekliyor",
  "koc-paket-bitiyor": "Sporcu paketi bitiyor",
};

/** Antrenöre giden türler — bildirim merkezinde ayrı sekme. */
export function isCoachKind(kind: NotificationKind): boolean {
  return kind.startsWith("koc-");
}

export const NOTIFICATION_CHANNELS = ["uygulama", "eposta", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationDraft = {
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  /** Aynı hatırlatma iki kez düşmesin: "<kind>:<kayitId>:<gun>". */
  dedupeKey: string;
  scheduledFor: Date;
};

// ── Metin üreticiler ──────────────────────────────────────────
// Hepsi saf: tarih biçimlendirmesi çağıran taraftan hazır gelir, böylece
// saat dilimi mantığı tek yerde (lib/date.ts) kalır.

export function dersHatirlatmaAksam(input: {
  bookingId: string;
  dateKey: string;
  /** "19:00" */
  timeLabel: string;
  /** "Kickbox" */
  kindLabel: string;
  scheduledFor: Date;
}): NotificationDraft {
  return {
    kind: "ders-hatirlatma-aksam",
    title: `Yarın ${input.timeLabel} dersin var`,
    body: `${input.kindLabel} · yarın saat ${input.timeLabel}. Gelemeyeceksen bu akşamdan iptal et ki hakkın yanmasın.`,
    href: "/uye/derslerim",
    dedupeKey: `ders-hatirlatma-aksam:${input.bookingId}:${input.dateKey}`,
    scheduledFor: input.scheduledFor,
  };
}

export function dersHatirlatmaGun(input: {
  bookingId: string;
  dateKey: string;
  timeLabel: string;
  kindLabel: string;
  scheduledFor: Date;
}): NotificationDraft {
  return {
    kind: "ders-hatirlatma-gun",
    title: `Bugün ${input.timeLabel} dersin var`,
    body: `${input.kindLabel} · bugün saat ${input.timeLabel}. Eldiven, ağızlık, su.`,
    href: "/uye/derslerim",
    dedupeKey: `ders-hatirlatma-gun:${input.bookingId}:${input.dateKey}`,
    scheduledFor: input.scheduledFor,
  };
}

export function paketBitiyor(input: {
  subscriptionId: string;
  dateKey: string;
  daysLeft: number;
  sessionsRemaining: number | null;
  scheduledFor: Date;
}): NotificationDraft {
  const parcalar: string[] = [];
  if (input.daysLeft <= 7) parcalar.push(`${input.daysLeft} gün`);
  if (input.sessionsRemaining !== null && input.sessionsRemaining <= 3) {
    parcalar.push(`${input.sessionsRemaining} ders`);
  }

  return {
    kind: "paket-bitiyor",
    title: "Üyeliğin bitmek üzere",
    body: `${parcalar.join(" ve ")} kaldı. Yenilemek için antrenörünle konuş — ara vermeden devam etmek formu korur.`,
    href: "/uye/uyelik",
    dedupeKey: `paket-bitiyor:${input.subscriptionId}:${input.dateKey}`,
    scheduledFor: input.scheduledFor,
  };
}

export function paketBitti(input: {
  subscriptionId: string;
  dateKey: string;
  scheduledFor: Date;
}): NotificationDraft {
  return {
    kind: "paket-bitti",
    title: "Üyeliğin bitti",
    body: "Yeni ders rezervasyonu yapamazsın. Yenilemek için antrenörüne yaz.",
    href: "/uye/uyelik",
    dedupeKey: `paket-bitti:${input.subscriptionId}:${input.dateKey}`,
    scheduledFor: input.scheduledFor,
  };
}

export function kocPaketBitiyor(input: {
  subscriptionId: string;
  memberName: string;
  dateKey: string;
  daysLeft: number;
  sessionsRemaining: number | null;
  scheduledFor: Date;
}): NotificationDraft {
  const kalan =
    input.sessionsRemaining === null
      ? `${input.daysLeft} gün`
      : `${input.daysLeft} gün / ${input.sessionsRemaining} ders`;

  return {
    kind: "koc-paket-bitiyor",
    title: `${input.memberName} — paket bitiyor`,
    body: `${kalan} kaldı. Yenileme konuşmasını şimdi yap; paket bitince sporcu rezervasyon yapamaz.`,
    href: "/personel/uyelikler",
    dedupeKey: `koc-paket-bitiyor:${input.subscriptionId}:${input.dateKey}`,
    scheduledFor: input.scheduledFor,
  };
}

export function kocGunOzeti(input: {
  coachUserId: string;
  dateKey: string;
  slotCount: number;
  bookedCount: number;
  emptyCount: number;
  scheduledFor: Date;
}): NotificationDraft {
  return {
    kind: "koc-gun-ozeti",
    title: `Yarın ${input.slotCount} seans`,
    body: `${input.bookedCount} dolu, ${input.emptyCount} boş saat. Boş saatleri kapatmak ya da yeni saat açmak için programa bak.`,
    href: "/personel/program",
    dedupeKey: `koc-gun-ozeti:${input.coachUserId}:${input.dateKey}`,
    scheduledFor: input.scheduledFor,
  };
}

export function dersOnaylandi(input: {
  bookingId: string;
  dateTimeLabel: string;
}): NotificationDraft {
  return {
    kind: "ders-onaylandi",
    title: "Grup dersi isteğin onaylandı",
    body: `${input.dateTimeLabel} seansına kaydın yapıldı.`,
    href: "/uye/derslerim",
    dedupeKey: `ders-onaylandi:${input.bookingId}`,
    scheduledFor: new Date(),
  };
}

export function dersReddedildi(input: {
  bookingId: string;
  dateTimeLabel: string;
}): NotificationDraft {
  return {
    kind: "ders-reddedildi",
    title: "Grup dersi isteğin reddedildi",
    body: `${input.dateTimeLabel} seansı için yer açılmadı. Başka bir saat seçebilirsin.`,
    href: "/uye/program",
    dedupeKey: `ders-reddedildi:${input.bookingId}`,
    scheduledFor: new Date(),
  };
}

/**
 * Bekleme listesindeki sporcuya yer açıldığında. Antrenör onayı beklemez —
 * kontenjan zaten vardı, sıra ona geldi (bkz. `domain/booking/waitlist.ts`).
 */
export function dersSiradanYukseldi(input: {
  bookingId: string;
  dateTimeLabel: string;
}): NotificationDraft {
  return {
    kind: "ders-siradan-yukseldi",
    title: "Bekleme listesinden yerin açıldı",
    body: `${input.dateTimeLabel} seansında yer boşaldı ve sıra sana geldi — kaydın yapıldı. Gelemeyeceksen iptal et ki hakkın yanmasın.`,
    href: "/uye/derslerim",
    dedupeKey: `ders-siradan-yukseldi:${input.bookingId}`,
    scheduledFor: new Date(),
  };
}

export function dersIptal(input: {
  bookingId: string;
  dateTimeLabel: string;
}): NotificationDraft {
  return {
    kind: "ders-iptal",
    title: "Seans iptal edildi",
    body: `${input.dateTimeLabel} seansı antrenör tarafından iptal edildi. Ders hakkın geri verildi.`,
    href: "/uye/program",
    dedupeKey: `ders-iptal:${input.bookingId}`,
    scheduledFor: new Date(),
  };
}
