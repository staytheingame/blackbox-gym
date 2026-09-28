/**
 * Ders hakkı ve rezervasyon kuralları — saf fonksiyonlar, veritabanı bilmez.
 *
 * Model: üyelik bir **ders paketi**dir (ör. 24 ders / 90 gün). Hak şöyle
 * tükenir:
 *   - Rezervasyon YAPMAK hakkı harcamaz, **ayırır** (henüz seans olmadı).
 *   - Seans sonrası "katıldı" ya da "gelmedi" işaretlenince hak harcanır.
 *     Gelmemek de hak yakar — salon o saati tuttu. Bu ders **yanan ders**
 *     olarak ayrıca sayılır ve sporcuya öyle gösterilir.
 *   - Seanstan önce iptal ayrılan hakkı geri verir.
 *
 * Böylece sporcunun gördüğü "kalan ders" sayısı hem geçmişi hem ileriye
 * dönük rezervasyonları içerir; kimse hakkından fazlasını rezerve edemez.
 */

export const BOOKING_STATUSES = [
  "onayli",
  "bekliyor",
  "reddedildi",
  "iptal",
  "katildi",
  "gelmedi",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  onayli: "Rezerve",
  bekliyor: "Onay bekliyor",
  reddedildi: "Reddedildi",
  iptal: "İptal",
  katildi: "Katıldı",
  /** Gelmeyen sporcunun hakkı yanar — ekranlarda bu adla görünür. */
  gelmedi: "Yanan ders",
};

/** Seans saati geçmiş ama yoklaması henüz alınmamış rezervasyon. */
export const PENDING_ATTENDANCE_LABEL = "Yoklama bekliyor";

/**
 * Listede gösterilecek ad. Saati geçmiş ama yoklaması alınmamış "rezerve"
 * kaydı "Rezerve" diye kalırsa sporcu dersin ne olduğunu anlamaz; ne
 * "katıldı" ne "yandı" denebilir — yoklama bekliyor.
 */
export function bookingDisplayLabel(
  status: BookingStatus,
  startsAt: Date,
  now: Date,
): string {
  if (status === "onayli" && startsAt.getTime() <= now.getTime()) {
    return PENDING_ATTENDANCE_LABEL;
  }
  return BOOKING_STATUS_LABEL[status];
}

/** Hakkı fiilen harcayan durumlar (yoklama alınmış). */
export function consumesCredit(status: BookingStatus): boolean {
  return status === "katildi" || status === "gelmedi";
}

/** Hakkı ayıran durumlar (seans henüz olmadı ama yer tutuluyor). */
export function reservesCredit(status: BookingStatus): boolean {
  return status === "onayli" || status === "bekliyor";
}

export type CreditSummary = {
  /** Pakette tanımlı ders adedi; `null` = sınırsız. */
  total: number | null;
  /** Yoklaması alınmış dersler (katıldı + gelmedi). */
  used: number;
  /** Bunlardan gelmediği için yanan dersler — `used`un içinde sayılır. */
  burned: number;
  /** İleri tarihli rezervasyonlar ve onay bekleyen istekler. */
  reserved: number;
  /** Yeni rezervasyon için kalan hak; sınırsız pakette `null`. */
  remaining: number | null;
  unlimited: boolean;
};

export function summarizeCredits(input: {
  total: number | null;
  bookingStatuses: BookingStatus[];
}): CreditSummary {
  const used = input.bookingStatuses.filter(consumesCredit).length;
  const burned = input.bookingStatuses.filter(
    (status) => status === "gelmedi",
  ).length;
  const reserved = input.bookingStatuses.filter(reservesCredit).length;
  const unlimited = input.total === null;

  return {
    total: input.total,
    used,
    burned,
    reserved,
    remaining: unlimited ? null : Math.max((input.total ?? 0) - used - reserved, 0),
    unlimited,
  };
}

export type BookingRefusal =
  | "uyelik-yok"
  | "uyelik-bitti"
  | "hak-bitti"
  | "gecmis-seans"
  | "seans-iptal"
  | "zaten-kayitli";

export const BOOKING_REFUSAL_MESSAGE: Record<BookingRefusal, string> = {
  "uyelik-yok": "Aktif üyeliğin yok — antrenörünle konuş.",
  "uyelik-bitti": "Üyeliğinin süresi bu seanstan önce doluyor.",
  "hak-bitti": "Ders hakkın kalmadı.",
  "gecmis-seans": "Bu saat geçti.",
  "seans-iptal": "Bu seans iptal edildi.",
  "zaten-kayitli": "Bu seansa zaten kayıtlısın.",
};

export type BookingDecision =
  /** Yer boş — doğrudan rezerve edilir. */
  | { ok: true; kind: "rezerve" }
  /** Yer dolu ama antrenör onayıyla grup dersi olabilir. */
  | { ok: true; kind: "grup-istegi" }
  | { ok: false; reason: BookingRefusal };

export type SlotState = {
  startsAt: Date;
  status: string;
  capacity: number;
  /** Yer tutan kayıt sayısı (onaylı + yoklaması alınmış). */
  takenSeats: number;
};

export type MembershipState = {
  /** Aktif üyelik yoksa `null`. */
  endDate: Date | null;
  remainingCredits: number | null;
};

/**
 * Sporcu bu slota kaydolabilir mi? Sıralama bilinçli: önce "hiç olmaz"
 * durumları (geçmiş, iptal, zaten kayıtlı), sonra üyelik, en son kontenjan —
 * kontenjan dolu olması bir HATA değil, grup isteğine dönüşür.
 */
export function evaluateBooking(input: {
  slot: SlotState;
  membership: MembershipState;
  alreadyBooked: boolean;
  now: Date;
}): BookingDecision {
  const { slot, membership, alreadyBooked, now } = input;

  if (alreadyBooked) return { ok: false, reason: "zaten-kayitli" };
  if (slot.status === "iptal") return { ok: false, reason: "seans-iptal" };
  if (slot.startsAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "gecmis-seans" };
  }

  if (membership.endDate === null) return { ok: false, reason: "uyelik-yok" };
  if (membership.endDate.getTime() < slot.startsAt.getTime()) {
    return { ok: false, reason: "uyelik-bitti" };
  }
  if (membership.remainingCredits !== null && membership.remainingCredits <= 0) {
    return { ok: false, reason: "hak-bitti" };
  }

  return slot.takenSeats < slot.capacity
    ? { ok: true, kind: "rezerve" }
    : { ok: true, kind: "grup-istegi" };
}

/** Seans başlamadan bu kadar süre öncesine kadar iptal serbest. */
export const CANCEL_CUTOFF_HOURS = 3;

export function canCancelBooking(slotStartsAt: Date, now: Date): boolean {
  const hoursLeft = (slotStartsAt.getTime() - now.getTime()) / 3_600_000;
  return hoursLeft >= CANCEL_CUTOFF_HOURS;
}
