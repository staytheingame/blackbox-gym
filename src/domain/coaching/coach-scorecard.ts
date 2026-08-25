/**
 * ANTRENÖR KARNESİ — "bu antrenörün masasında ne birikti" sorusunun cevabı.
 *
 * DİL KURALI (sporcu analiziyle aynı, ama insan kaynağı olduğu için daha
 * katı): **Bu modül antrenörü NOTLANDIRMAZ.** "İyi antrenör / kötü antrenör"
 * çıktısı üretmez, üretmemelidir. Ölçtüğü üç şey vardır:
 *
 *   1. **Birikmiş iş**  — alınmamış yoklama, incelenmemiş kontrol.
 *      Bunlar antrenörün *yapmadığı* değil, *yapılmayı bekleyen* işlerdir;
 *      sayı ne kadar yüksekse o kadar acil, o kadarı.
 *   2. **Portföyün durumu** — sorumlu olduğu sporcuların radar dağılımı.
 *      Riskli sporcu sayısı antrenörün suçu değildir; salonun nereye
 *      yardım göndereceğinin işaretidir.
 *   3. **Yük** — açtığı seans, dolan kontenjan, sözleşmedeki ders kotası.
 *
 * Doluluk ve gelme oranı gibi oranlar **antrenörün tek başına kontrol
 * etmediği** büyüklüklerdir (saat, hava, sporcunun işi). Bu yüzden düşük
 * oran bir "başarısızlık" değil, konuşulacak bir konu olarak sunulur.
 *
 * Saf modül: sayılar dışarıdan gelir, veritabanı bilmez.
 */

export const COACH_THRESHOLDS = {
  /** Bu sayının üstündeki yoklama birikmesi seans kayıtlarını bozmaya başlar. */
  attendanceBacklogWarn: 3,
  attendanceBacklogCritical: 8,
  checkInBacklogWarn: 3,
  checkInBacklogCritical: 8,
  /** Portföyün bu oranı kritik bandaysa yardım gerekiyor demektir. */
  riskRatioWarn: 0.2,
  riskRatioCritical: 0.35,
  fillRateFloor: 50,
  showRateFloor: 70,
  /** Oranlar ancak bu kadar veriden sonra anlamlı — altında "—" gösterilir. */
  minSlotsForFillRate: 4,
  minSettledForShowRate: 6,
  /** Kotanın bu kadarı aşıldıysa sözleşme dışına çıkılmış demektir. */
  quotaOverBy: 1,
  /** Kotanın altında kalan bu oran "boş kapasite" sayılır. */
  quotaIdleRatio: 0.5,
} as const;

export const COACH_ATTENTION_KEYS = [
  "yoklama-birikti",
  "kontrol-birikti",
  "riskli-portfoy",
  "sessiz-sporcu",
  "doluluk-dusuk",
  "gelme-orani-dusuk",
  "kota-asildi",
  "kota-bos",
  "sporcu-yok",
  "hakedis-tanimsiz",
] as const;
export type CoachAttentionKey = (typeof COACH_ATTENTION_KEYS)[number];

export type CoachAttentionSeverity = "kritik" | "uyari" | "bilgi";

export type CoachAttention = {
  key: CoachAttentionKey;
  severity: CoachAttentionSeverity;
  label: string;
  /** Sayının hangi kayıttan geldiği. */
  evidence: string;
  /** Yöneticinin ya da antrenörün yapacağı iş. */
  action: string;
  weight: number;
};

/**
 * Karnenin tek kelimelik hâli. Antrenörün niteliği değil, **masasının
 * durumu**: temiz mi, birikmiş mi.
 */
export const COACH_STATES = ["temiz", "izle", "birikmis"] as const;
export type CoachState = (typeof COACH_STATES)[number];

export const COACH_STATE_LABEL: Record<CoachState, string> = {
  temiz: "Masası temiz",
  izle: "Birkaç iş bekliyor",
  birikmis: "İş birikmiş",
};

export const COACH_STATE_CUTOFF = { birikmis: 40, izle: 15 } as const;

// ── Girdi ─────────────────────────────────────────────────────

export type CoachScorecardInput = {
  /** Sorumlusu olduğu sporcu sayısı (her durum). */
  portfolio: number;
  activeMembers: number;
  /** Radarda `kritik` banda düşen sporcuları. */
  criticalMembers: number;
  watchMembers: number;
  /** 14+ gündür kaydı olmayan sporcuları. */
  quietMembers: number;

  /** Dönemde açtığı seans sayısı. */
  slotsOpened: number;
  /** Açtığı seansların toplam kontenjanı. */
  capacityOffered: number;
  /** O kontenjandan dolan yer sayısı. */
  seatsBooked: number;
  /** Dönemde yoklaması alınmış seans sayısı — hakediş de buna bakar. */
  sessionsHeld: number;
  seatsAttended: number;
  seatsNoShow: number;

  /** Başlangıcı geçmiş ama yoklaması alınmamış seans sayısı (birikmiş iş). */
  attendanceBacklog: number;
  /** İncelenmemiş haftalık kontrol sayısı (birikmiş iş). */
  checkInBacklog: number;

  /** Sözleşmedeki aylık ders hakkı; `null` = sınırsız. */
  monthlySessionQuota: number | null;
  /** Hakediş modeli tanımlı mı — `yok` ise ders verse de kalem doğmaz. */
  hasCompensation: boolean;
  /** Hesabı açık mı; kapalı hesap için uyarı üretilmez. */
  isActive: boolean;
};

// ── Çıktı ─────────────────────────────────────────────────────

export type CoachScorecard = {
  /** 0–100; antrenörün notu değil, masasındaki birikmenin ağırlığı. */
  backlogScore: number;
  state: CoachState;
  /** Dolan kontenjan oranı; yeterli seans yoksa `null`. */
  fillRate: number | null;
  /** Gelme oranı; yeterli yoklama yoksa `null`. */
  showRate: number | null;
  /** Portföyünün yüzde kaçı kritik bantta. */
  riskRatio: number | null;
  /** Aktif sporcu başına dönemde düşen seans — yük dağılımı. */
  sessionsPerMember: number | null;
  /** Kotanın ne kadarı kullanıldı (`null` = kota yok). */
  quotaUsage: number | null;
  attention: CoachAttention[];
};

// ── Oranlar ───────────────────────────────────────────────────

export function fillRateOf(input: CoachScorecardInput): number | null {
  if (
    input.slotsOpened < COACH_THRESHOLDS.minSlotsForFillRate ||
    input.capacityOffered === 0
  ) {
    return null;
  }
  return Math.round((input.seatsBooked / input.capacityOffered) * 100);
}

export function showRateOf(input: CoachScorecardInput): number | null {
  const settled = input.seatsAttended + input.seatsNoShow;
  if (settled < COACH_THRESHOLDS.minSettledForShowRate) return null;
  return Math.round((input.seatsAttended / settled) * 100);
}

export function riskRatioOf(input: CoachScorecardInput): number | null {
  if (input.activeMembers === 0) return null;
  return input.criticalMembers / input.activeMembers;
}

// ── Dikkat maddeleri ──────────────────────────────────────────

function backlogAttention(input: CoachScorecardInput): CoachAttention[] {
  const items: CoachAttention[] = [];

  if (input.attendanceBacklog >= COACH_THRESHOLDS.attendanceBacklogCritical) {
    items.push({
      key: "yoklama-birikti",
      severity: "kritik",
      label: `${input.attendanceBacklog} seansın yoklaması alınmadı`,
      evidence: "Başlangıcı geçmiş, hâlâ 'rezerve' duran kayıtlar",
      action:
        "Yoklama alınmadan ders hakkı düşmez ve hakediş doğmaz — kuyruğu bugün kapat.",
      weight: 30,
    });
  } else if (input.attendanceBacklog >= COACH_THRESHOLDS.attendanceBacklogWarn) {
    items.push({
      key: "yoklama-birikti",
      severity: "uyari",
      label: `${input.attendanceBacklog} seansın yoklaması alınmadı`,
      evidence: "Başlangıcı geçmiş, hâlâ 'rezerve' duran kayıtlar",
      action: "Yoklama ekranından işaretle; ders hakkı ve hakediş buna bağlı.",
      weight: 15,
    });
  }

  if (input.checkInBacklog >= COACH_THRESHOLDS.checkInBacklogCritical) {
    items.push({
      key: "kontrol-birikti",
      severity: "kritik",
      label: `${input.checkInBacklog} kontrol incelenmedi`,
      evidence: "Sporcuların gönderdiği, 'incelendi' işaretlenmemiş kontroller",
      action:
        "Cevapsız kalan kontrol sporcunun göndermeyi bırakmasının en yaygın nedeni.",
      weight: 25,
    });
  } else if (input.checkInBacklog >= COACH_THRESHOLDS.checkInBacklogWarn) {
    items.push({
      key: "kontrol-birikti",
      severity: "uyari",
      label: `${input.checkInBacklog} kontrol incelenmedi`,
      evidence: "Sporcuların gönderdiği, 'incelendi' işaretlenmemiş kontroller",
      action: "Kontrol kuyruğunu bu hafta içinde boşalt.",
      weight: 12,
    });
  }

  return items;
}

function portfolioAttention(input: CoachScorecardInput): CoachAttention[] {
  const items: CoachAttention[] = [];

  if (input.portfolio === 0) {
    items.push({
      key: "sporcu-yok",
      severity: "bilgi",
      label: "Sorumlu olduğu sporcu yok",
      evidence: "`Member.assignedCoachUserId` bu antrenörü göstermiyor",
      action:
        "Sporcu atanmadıkça bu antrenörün panelinde hiçbir sporcu görünmez.",
      weight: 5,
    });
    return items;
  }

  const ratio = riskRatioOf(input);
  if (ratio !== null && ratio >= COACH_THRESHOLDS.riskRatioCritical) {
    items.push({
      key: "riskli-portfoy",
      severity: "kritik",
      label: `Sporcularının %${Math.round(ratio * 100)}'i kritik bantta`,
      evidence: `${input.activeMembers} aktif sporcunun ${input.criticalMembers} tanesi`,
      action:
        "Yükü paylaştır ya da birlikte bir arama listesi çıkarın — tek başına kapanacak bir sayı değil.",
      weight: 25,
    });
  } else if (ratio !== null && ratio >= COACH_THRESHOLDS.riskRatioWarn) {
    items.push({
      key: "riskli-portfoy",
      severity: "uyari",
      label: `Sporcularının %${Math.round(ratio * 100)}'i kritik bantta`,
      evidence: `${input.activeMembers} aktif sporcunun ${input.criticalMembers} tanesi`,
      action: "Radar ekranından kimler olduğuna bak ve sırayla ara.",
      weight: 12,
    });
  }

  if (input.quietMembers > 0) {
    items.push({
      key: "sessiz-sporcu",
      severity: input.quietMembers >= 5 ? "uyari" : "bilgi",
      label: `${input.quietMembers} sporcu 14+ gündür sessiz`,
      evidence: "Son antrenman/katılım kaydı olmayan sporcular",
      action: "Sessizleşenleri ara — dönüş oranı ilk üç haftada en yüksek.",
      weight: input.quietMembers >= 5 ? 10 : 5,
    });
  }

  return items;
}

function loadAttention(input: CoachScorecardInput): CoachAttention[] {
  const items: CoachAttention[] = [];

  const fill = fillRateOf(input);
  if (fill !== null && fill < COACH_THRESHOLDS.fillRateFloor) {
    items.push({
      key: "doluluk-dusuk",
      severity: "uyari",
      label: `Doluluk %${fill}`,
      evidence: `${input.slotsOpened} seansta ${input.capacityOffered} kontenjandan ${input.seatsBooked} tanesi doldu`,
      action:
        "Saatler sporcuların gelemeyeceği zamanlara düşmüş olabilir; program saatlerini gözden geçirin.",
      weight: 10,
    });
  }

  const show = showRateOf(input);
  if (show !== null && show < COACH_THRESHOLDS.showRateFloor) {
    items.push({
      key: "gelme-orani-dusuk",
      severity: "uyari",
      label: `Gelme oranı %${show}`,
      evidence: `${input.seatsAttended} geldi, ${input.seatsNoShow} gelmedi`,
      action:
        "Rezerve edip gelmeyen çok — hatırlatma ve iptal kuralını birlikte konuşun.",
      weight: 10,
    });
  }

  if (input.monthlySessionQuota !== null && input.monthlySessionQuota > 0) {
    const over = input.sessionsHeld - input.monthlySessionQuota;
    if (over >= COACH_THRESHOLDS.quotaOverBy) {
      items.push({
        key: "kota-asildi",
        severity: "uyari",
        label: `Kota ${over} ders aşıldı`,
        evidence: `Sözleşmedeki ${input.monthlySessionQuota} derse karşılık ${input.sessionsHeld} ders`,
        action:
          "Fazla dersin ücreti sözleşmede yoksa konuşulmalı — hakediş yine de yazıldı.",
        weight: 12,
      });
    } else if (
      input.sessionsHeld <
      input.monthlySessionQuota * COACH_THRESHOLDS.quotaIdleRatio
    ) {
      items.push({
        key: "kota-bos",
        severity: "bilgi",
        label: `Kotanın ${input.monthlySessionQuota - input.sessionsHeld} dersi kullanılmadı`,
        evidence: `Sözleşmedeki ${input.monthlySessionQuota} derse karşılık ${input.sessionsHeld} ders`,
        action: "Boş kapasite var — yeni sporcu bu antrenöre atanabilir.",
        weight: 5,
      });
    }
  }

  if (!input.hasCompensation && input.sessionsHeld > 0) {
    items.push({
      key: "hakedis-tanimsiz",
      severity: "uyari",
      label: `${input.sessionsHeld} ders verdi, hakediş tanımı yok`,
      evidence: "Kadro ekranındaki hakediş modeli 'yok'",
      action:
        "Model tanımlanmadan geçmiş dersler için kalem doğmaz; tanımla ve dersleri yeniden işaretle.",
      weight: 15,
    });
  }

  return items;
}

const SEVERITY_ORDER: Record<CoachAttentionSeverity, number> = {
  kritik: 0,
  uyari: 1,
  bilgi: 2,
};

// ── Ana hesap ─────────────────────────────────────────────────

export function evaluateCoachScorecard(
  input: CoachScorecardInput,
): CoachScorecard {
  // Kapalı hesap için iş listesi üretmenin anlamı yok: o kişi zaten
  // panele giremiyor. Yalnız portföyü hâlâ üstündeyse görünsün diye
  // "sporcu-yok" dışındaki her şey susturulur.
  const attention = input.isActive
    ? [
        ...backlogAttention(input),
        ...portfolioAttention(input),
        ...loadAttention(input),
      ].sort((a, b) => {
        const bySeverity =
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        return bySeverity !== 0 ? bySeverity : b.weight - a.weight;
      })
    : [];

  const backlogScore = Math.min(
    100,
    attention.reduce((total, item) => total + item.weight, 0),
  );

  let state: CoachState;
  if (backlogScore >= COACH_STATE_CUTOFF.birikmis) {
    state = "birikmis";
  } else if (backlogScore >= COACH_STATE_CUTOFF.izle) {
    state = "izle";
  } else {
    state = "temiz";
  }

  return {
    backlogScore,
    state,
    fillRate: fillRateOf(input),
    showRate: showRateOf(input),
    riskRatio: riskRatioOf(input),
    sessionsPerMember:
      input.activeMembers === 0
        ? null
        : Math.round((input.sessionsHeld / input.activeMembers) * 10) / 10,
    quotaUsage:
      input.monthlySessionQuota && input.monthlySessionQuota > 0
        ? Math.round((input.sessionsHeld / input.monthlySessionQuota) * 100)
        : null,
    attention,
  };
}

/**
 * Kadro sıralaması: birikmiş işi çok olan üstte, eşitlikte portföyü büyük
 * olan. Yönetici listeye baktığında önce yardım gerekeni görsün.
 */
export function compareCoachPriority(
  a: { backlogScore: number; portfolio: number },
  b: { backlogScore: number; portfolio: number },
): number {
  if (b.backlogScore !== a.backlogScore) return b.backlogScore - a.backlogScore;
  return b.portfolio - a.portfolio;
}

/**
 * Salon geneli yük dağılımı — "bir antrenörde 40 sporcu, diğerinde 3" gibi
 * dengesizlik burada görünür. `spread` 0 = kusursuz eşit dağılım.
 */
export function portfolioBalance(
  coaches: readonly { portfolio: number }[],
): { total: number; average: number; max: number; min: number; spread: number } {
  if (coaches.length === 0) {
    return { total: 0, average: 0, max: 0, min: 0, spread: 0 };
  }

  const sizes = coaches.map((coach) => coach.portfolio);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const average = total / coaches.length;
  const max = Math.max(...sizes);
  const min = Math.min(...sizes);

  return {
    total,
    average: Math.round(average * 10) / 10,
    max,
    min,
    // Ortalamaya oranlanmış fark: sporcu sayısı büyüdükçe eşiği kaymasın.
    spread: average === 0 ? 0 : Math.round(((max - min) / average) * 100) / 100,
  };
}
