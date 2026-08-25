/**
 * TAKİP RADARI — "bugün kimi arayacağım" sorusunun tek cevabı.
 *
 * `member-analysis.ts` TEK sporcuyu derinlemesine anlatır (analiz ekranı).
 * Bu modül ise LİSTE seviyesinde çalışır: salonun tamamını tek geçişte
 * tarayıp sırayı kurar. İkisi aynı dil kurallarına uyar:
 *
 *   1. **Teşhis yok.** "İlgisiz", "motivasyonsuz" denmez; gözlenen davranış
 *      yazılır: "17 gündür kayıt yok".
 *   2. **Her sinyalin kanıtı vardır.** Hangi kayıttan geldiği ekranda durur.
 *   3. **Risk puanı sporcuyu değil, SIRAYI ölçer.** 80 puan "kötü sporcu"
 *      demek değil, "bugün önce bununla ilgilen" demektir.
 *
 * Sinyaller bilinçli olarak üç eksenden gelir; biri iyiyken diğeri kötü
 * olabilir ve ikisi de gerçektir:
 *   - **Devamlılık**  → geliyor mu, kontrol gönderiyor mu
 *   - **Ticari**      → üyeliği var mı, hakkı bitti mi, borcu gecikti mi
 *   - **İdari**       → onamı imzalı mı, hesabı kurulu mu, antrenörü var mı
 *
 * Saf modül: tarih ve kayıtlar dışarıdan gelir, veritabanı bilmez.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Eşikler tek yerde — saha tuning'i buradan yapılır, sinyal gövdelerine
 * sayı gömülmez (bkz. TUNING_GUIDE.md).
 */
export const RADAR_THRESHOLDS = {
  /** Kayıttan sonraki bu süre "yeni sporcu" sayılır — sessizliği cezalandırılmaz. */
  newMemberDays: 14,
  /** Yeni sporcu bu kadar gün geçtiği hâlde hiç başlamadıysa bu ayrı bir durumdur. */
  neverStartedDays: 10,
  quietWarnDays: 7,
  quietCriticalDays: 14,
  quietSevereDays: 21,
  /** Gelme oranı ancak bu kadar yoklamalı seanstan sonra anlamlıdır. */
  minSettledForShowRate: 4,
  showRateFloor: 70,
  checkInWarnWeeks: 2,
  checkInCriticalWeeks: 4,
  lowScore: 50,
  membershipWarnDays: 14,
  membershipUrgentDays: 7,
  /** Kalan ders bu sayının altına inince yenileme konuşulur. */
  lowCredits: 2,
} as const;

export const RADAR_SIGNAL_KEYS = [
  "hic-baslamadi",
  "gelmiyor",
  "gelmedi-cok",
  "kontrol-yok",
  "agri",
  "skor-dusuk",
  "uyelik-yok",
  "uyelik-bitiyor",
  "hak-bitti",
  "borc-gecikti",
  "onam-eksik",
  "hesap-yok",
  "antrenorsuz",
] as const;
export type RadarSignalKey = (typeof RADAR_SIGNAL_KEYS)[number];

/** Sinyalin hangi eksenden geldiği — ekranda gruplama ve filtre için. */
export type RadarAxis = "devamlilik" | "ticari" | "idari";

export type RadarSeverity = "kritik" | "uyari" | "bilgi";

export type RadarSignal = {
  key: RadarSignalKey;
  axis: RadarAxis;
  severity: RadarSeverity;
  /** Pilde görünen kısa metin. */
  label: string;
  /** Sayının hangi kayıttan geldiği. */
  evidence: string;
  /** Antrenörün yapacağı iş. */
  action: string;
  /** Risk puanına kattığı ağırlık. */
  weight: number;
};

export const RADAR_BANDS = ["kritik", "izle", "yeni", "yolunda"] as const;
export type RadarBand = (typeof RADAR_BANDS)[number];

export const RADAR_BAND_LABEL: Record<RadarBand, string> = {
  kritik: "Bugün ilgilen",
  izle: "İzlemede",
  yeni: "Yeni sporcu",
  yolunda: "Yolunda",
};

export const RADAR_BAND_DESCRIPTION: Record<RadarBand, string> = {
  kritik: "Birden çok ya da ağır sinyal taşıyor — bırakma riski burada.",
  izle: "Tek bir uyarı var; bu hafta içinde konuşulursa yeter.",
  yeni: "Kaydı yeni — alışma dönemi, sessizliği henüz bir işaret değil.",
  yolunda: "Aksiyon gerektiren bir sinyal yok.",
};

export const RADAR_AXIS_LABEL: Record<RadarAxis, string> = {
  devamlilik: "Devamlılık",
  ticari: "Üyelik & ödeme",
  idari: "Kayıt & onam",
};

/** Bant eşikleri — risk puanı bunlara göre banda düşer. */
export const RADAR_BAND_CUTOFF = { kritik: 45, izle: 18 } as const;

// ── Girdi ─────────────────────────────────────────────────────

export type RadarMembership = {
  /** Üyeliğin bitmesine kalan gün (negatif = geçmiş). */
  daysLeft: number;
  /** Kalan ders hakkı; sınırsız pakette `null`. */
  remaining: number | null;
  unlimited: boolean;
};

export type MemberRadarInput = {
  now: Date;
  /** Salona kayıt tarihi — "yeni sporcu" ayrımı buradan. */
  memberSince: Date;
  /**
   * Son gerçek aktivite: antrenman kaydı ya da katıldığı seans — hangisi
   * yeniyse. Rezervasyon yapmak aktivite değildir, gelmek aktivitedir.
   */
  lastActivityAt: Date | null;
  lastCheckInWeek: Date | null;
  /** En son performans kartı skoru (`PerformanceSnapshot`). */
  overallScore: number | null;
  /** Son check-in'de ağrı işaretlendi mi. */
  sorenessFlag: boolean;
  /** Yoklaması alınmış seans sayısı (katıldı + gelmedi). */
  settledBookings: number;
  noShowCount: number;
  /** Yürürlükteki üyelik; yoksa `null`. */
  membership: RadarMembership | null;
  /** Süresi geçmiş üyelikten kalan borç (kuruş). */
  overdueMinor: number;
  /** İmzası eksik ya da eskimiş onam sayısı. */
  pendingWaivers: number;
  /** Davet bağlantısını kullanıp hesabını kurdu mu — kurmadıysa bildirim gitmez. */
  hasAccount: boolean;
  hasCoach: boolean;
};

// ── Çıktı ─────────────────────────────────────────────────────

export type MemberRadar = {
  /** 0–100. Sporcunun değeri değil, ilgilenme SIRASI. */
  riskScore: number;
  band: RadarBand;
  isNew: boolean;
  /** Kaç gündür kayıt yok (`null` = hiç kayıt olmamış). */
  daysQuiet: number | null;
  /** Gelme oranı; yeterli yoklama yoksa `null`. */
  showRate: number | null;
  signals: RadarSignal[];
  /** Tek satırlık gerekçe — listede sporcu adının altında durur. */
  headline: string;
};

// ── Yardımcılar ───────────────────────────────────────────────

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function weeksBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_WEEK);
}

const SEVERITY_ORDER: Record<RadarSeverity, number> = {
  kritik: 0,
  uyari: 1,
  bilgi: 2,
};

/** Kuruşu okunur liraya çevirir — sinyal metninde para geçtiği tek yer. */
function liraText(minor: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

// ── Sinyaller ─────────────────────────────────────────────────

function devamlilikSignals(input: MemberRadarInput): RadarSignal[] {
  const signals: RadarSignal[] = [];
  const { now, memberSince, lastActivityAt } = input;
  const memberAgeDays = daysBetween(memberSince, now);
  const isNew = memberAgeDays < RADAR_THRESHOLDS.newMemberDays;

  if (lastActivityAt === null) {
    // Hiç kaydı olmayan sporcu iki farklı şeydir: daha dün kaydolmuş biri
    // ile üç haftadır ortada olmayan biri aynı sırada durmamalı.
    if (memberAgeDays >= RADAR_THRESHOLDS.neverStartedDays) {
      signals.push({
        key: "hic-baslamadi",
        axis: "devamlilik",
        severity: "kritik",
        label: "Hiç başlamadı",
        evidence: `${memberAgeDays} gündür kayıtlı, tek antrenman/katılım kaydı yok`,
        action:
          "İlk dersi birlikte planla — ilk üç hafta içinde başlamayan kayıt çoğunlukla hiç başlamıyor.",
        // `gelmiyor` üç hafta gibi tek başına kritik banda taşır: parası
        // alınıp hiç başlamamış kayıt salonun en net kaybıdır.
        weight: 45,
      });
    }
  } else {
    const quiet = daysBetween(lastActivityAt, now);
    // Yeni sporcunun ilk sessiz günleri alışma dönemidir; kritik eşiği
    // geçmedikçe sıraya sokulmaz.
    const skipForNew = isNew && quiet < RADAR_THRESHOLDS.quietCriticalDays;

    if (!skipForNew) {
      if (quiet >= RADAR_THRESHOLDS.quietSevereDays) {
        signals.push({
          key: "gelmiyor",
          axis: "devamlilik",
          severity: "kritik",
          label: `${quiet} gündür yok`,
          evidence: "Son antrenman/katılım kaydı",
          action:
            "Telefonla ara. Üç haftalık sessizlik yazışmayla değil, konuşmayla dönüyor.",
          // Tek başına kritik banda taşır: üç hafta hiçbir kaydın olmaması
          // başka bir sinyalle desteklenmeyi beklemeyecek kadar açık.
          weight: 45,
        });
      } else if (quiet >= RADAR_THRESHOLDS.quietCriticalDays) {
        signals.push({
          key: "gelmiyor",
          axis: "devamlilik",
          severity: "kritik",
          label: `${quiet} gündür yok`,
          evidence: "Son antrenman/katılım kaydı",
          action:
            "Mesaj at ve bir saat öner — iki hafta sessizlik çoğu bırakmanın başlangıcı.",
          weight: 25,
        });
      } else if (quiet >= RADAR_THRESHOLDS.quietWarnDays) {
        signals.push({
          key: "gelmiyor",
          axis: "devamlilik",
          severity: "uyari",
          label: `${quiet} gündür yok`,
          evidence: "Son antrenman/katılım kaydı",
          action: "Bir hafta boşluk normal olabilir; yine de bu hafta bir saat öner.",
          weight: 10,
        });
      }
    }
  }

  const showRate = showRateOf(input);
  if (showRate !== null && showRate < RADAR_THRESHOLDS.showRateFloor) {
    signals.push({
      key: "gelmedi-cok",
      axis: "devamlilik",
      severity: "uyari",
      label: `Gelme oranı %${showRate}`,
      evidence: `${input.settledBookings} yoklamalı seansın ${input.noShowCount} tanesinde gelmedi`,
      action: "Saat sporcuya uymuyor olabilir; birlikte yeni bir saat seçin.",
      weight: 15,
    });
  }

  if (input.lastCheckInWeek === null) {
    // Kontrol hiç gönderilmemişse bu ancak sporcu birkaç haftadır kayıtlıysa
    // bir işarettir; ilk haftasında kimseden kontrol beklenmez.
    if (memberAgeDays >= RADAR_THRESHOLDS.checkInWarnWeeks * 7) {
      signals.push({
        key: "kontrol-yok",
        axis: "devamlilik",
        severity: "uyari",
        label: "Hiç kontrol göndermedi",
        evidence: `${memberAgeDays} gündür kayıtlı, haftalık kontrol kaydı yok`,
        action:
          "Haftalık kontrolü göster — gelişimi görmek için tek düzenli veri bu.",
        weight: 10,
      });
    }
  } else {
    const weeks = weeksBetween(input.lastCheckInWeek, now);
    if (weeks >= RADAR_THRESHOLDS.checkInCriticalWeeks) {
      signals.push({
        key: "kontrol-yok",
        axis: "devamlilik",
        severity: "uyari",
        label: `${weeks} haftadır kontrol yok`,
        evidence: "Son gönderilen haftalık kontrol",
        action: "Kontrolü hatırlat; gelmiyorsa formu birlikte doldurun.",
        weight: 15,
      });
    } else if (weeks >= RADAR_THRESHOLDS.checkInWarnWeeks) {
      signals.push({
        key: "kontrol-yok",
        axis: "devamlilik",
        severity: "uyari",
        label: `${weeks} haftadır kontrol yok`,
        evidence: "Son gönderilen haftalık kontrol",
        action: "Haftalık kontrolü hatırlat.",
        weight: 8,
      });
    }
  }

  if (input.sorenessFlag) {
    signals.push({
      key: "agri",
      axis: "devamlilik",
      severity: "kritik",
      label: "Ağrı bildirdi",
      evidence: "Son haftalık kontroldeki ağrı işareti",
      action:
        "Yüklenme ve sparring kararını buna göre ver; geçmediyse hekime yönlendir.",
      weight: 12,
    });
  }

  if (
    input.overallScore !== null &&
    input.overallScore < RADAR_THRESHOLDS.lowScore
  ) {
    signals.push({
      key: "skor-dusuk",
      axis: "devamlilik",
      severity: "uyari",
      label: `Skor ${input.overallScore}`,
      evidence: "En son hesaplanan performans kartı",
      action: "Analiz ekranında hangi boyutun düşürdüğüne bak.",
      weight: 10,
    });
  }

  return signals;
}

function ticariSignals(input: MemberRadarInput): RadarSignal[] {
  const signals: RadarSignal[] = [];
  const { membership } = input;

  if (membership === null) {
    signals.push({
      key: "uyelik-yok",
      axis: "ticari",
      severity: "kritik",
      label: "Yürürlükte üyelik yok",
      evidence: "Aktif abonelik kaydı bulunamadı",
      action:
        "Üyelik başlat — paketi olmayan sporcu ders rezervasyonu yapamaz.",
      weight: 30,
    });
  } else {
    if (membership.daysLeft <= RADAR_THRESHOLDS.membershipUrgentDays) {
      signals.push({
        key: "uyelik-bitiyor",
        axis: "ticari",
        severity: "kritik",
        label: `Üyelik ${Math.max(membership.daysLeft, 0)} gün sonra bitiyor`,
        evidence: "Yürürlükteki üyeliğin bitiş tarihi",
        action: "Yenileme konuşmasını bugün yap; paket bitince rezervasyon kapanır.",
        weight: 20,
      });
    } else if (membership.daysLeft <= RADAR_THRESHOLDS.membershipWarnDays) {
      signals.push({
        key: "uyelik-bitiyor",
        axis: "ticari",
        severity: "uyari",
        label: `Üyelik ${membership.daysLeft} gün sonra bitiyor`,
        evidence: "Yürürlükteki üyeliğin bitiş tarihi",
        action: "Yenilemeyi gündeme getir.",
        weight: 12,
      });
    }

    if (!membership.unlimited && membership.remaining !== null) {
      if (membership.remaining === 0) {
        signals.push({
          key: "hak-bitti",
          axis: "ticari",
          severity: "kritik",
          label: "Ders hakkı bitti",
          evidence: "Paketteki ders adedi tükendi",
          action: "Yeni paket açılmazsa daha fazla rezervasyon yapamaz.",
          weight: 20,
        });
      } else if (membership.remaining <= RADAR_THRESHOLDS.lowCredits) {
        signals.push({
          key: "hak-bitti",
          axis: "ticari",
          severity: "uyari",
          label: `${membership.remaining} ders kaldı`,
          evidence: "Paketteki kalan ders adedi",
          action: "Yenileme konuşmasını hakkı bitmeden başlat.",
          weight: 10,
        });
      }
    }
  }

  if (input.overdueMinor > 0) {
    signals.push({
      key: "borc-gecikti",
      axis: "ticari",
      severity: "uyari",
      label: `${liraText(input.overdueMinor)} gecikmiş borç`,
      evidence: "Süresi dolmuş üyeliğin tahsil edilmemiş bakiyesi",
      action: "Tahsilatı gir ya da sporcuyla ödeme planını konuş.",
      weight: 20,
    });
  }

  return signals;
}

function idariSignals(input: MemberRadarInput): RadarSignal[] {
  const signals: RadarSignal[] = [];

  if (input.pendingWaivers > 0) {
    signals.push({
      key: "onam-eksik",
      axis: "idari",
      severity: "uyari",
      label: `${input.pendingWaivers} onam eksik`,
      evidence: "İmzalanmamış ya da sürümü eskimiş form",
      action:
        "Sporcu kendi panelinden imzalar; sparringe çıkmadan önce tamamlansın.",
      weight: 10,
    });
  }

  if (!input.hasAccount) {
    signals.push({
      key: "hesap-yok",
      axis: "idari",
      severity: "bilgi",
      label: "Hesabını kurmadı",
      evidence: "Davet bağlantısı henüz kullanılmamış",
      action:
        "Bu sporcuya hatırlatma gitmez — daveti yenile ya da telefonla ulaş.",
      weight: 8,
    });
  }

  if (!input.hasCoach) {
    signals.push({
      key: "antrenorsuz",
      axis: "idari",
      severity: "bilgi",
      label: "Sorumlu antrenörü yok",
      evidence: "`assignedCoachUserId` boş",
      action:
        "Antrenör ata — atanmayan sporcu hiçbir antrenörün panelinde görünmez.",
      weight: 8,
    });
  }

  return signals;
}

function showRateOf(input: MemberRadarInput): number | null {
  if (input.settledBookings < RADAR_THRESHOLDS.minSettledForShowRate) {
    return null;
  }
  const attended = input.settledBookings - input.noShowCount;
  return Math.round((attended / input.settledBookings) * 100);
}

function buildHeadline(
  signals: RadarSignal[],
  input: MemberRadarInput,
): string {
  if (signals.length === 0) {
    return input.lastActivityAt
      ? `Son kayıt ${daysBetween(input.lastActivityAt, input.now)} gün önce — aksiyon gerektiren sinyal yok.`
      : "Aksiyon gerektiren sinyal yok.";
  }

  const [first, ...rest] = signals;
  if (rest.length === 0) return first.label;
  return `${first.label} · +${rest.length} sinyal daha`;
}

// ── Ana hesap ─────────────────────────────────────────────────

/**
 * Tek sporcunun radar satırı. Sinyaller ağırlıklarıyla toplanır ve 100'de
 * kapanır: dört ayrı uyarı taşıyan sporcu ile beş uyarı taşıyan arasındaki
 * fark, ikisinin de "bugün ilgilen" olduğu gerçeğini değiştirmez.
 */
export function evaluateMemberRadar(input: MemberRadarInput): MemberRadar {
  const signals = [
    ...devamlilikSignals(input),
    ...ticariSignals(input),
    ...idariSignals(input),
  ].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : b.weight - a.weight;
  });

  const riskScore = Math.min(
    100,
    signals.reduce((total, signal) => total + signal.weight, 0),
  );

  const isNew =
    daysBetween(input.memberSince, input.now) < RADAR_THRESHOLDS.newMemberDays;

  let band: RadarBand;
  if (riskScore >= RADAR_BAND_CUTOFF.kritik) {
    band = "kritik";
  } else if (riskScore >= RADAR_BAND_CUTOFF.izle) {
    band = "izle";
  } else if (isNew) {
    band = "yeni";
  } else {
    band = "yolunda";
  }

  return {
    riskScore,
    band,
    isNew,
    daysQuiet: input.lastActivityAt
      ? daysBetween(input.lastActivityAt, input.now)
      : null,
    showRate: showRateOf(input),
    signals,
    headline: buildHeadline(signals, input),
  };
}

/**
 * Radar sırası: önce risk puanı, eşitlikte daha uzun süredir sessiz olan.
 * Aynı puanı taşıyan iki sporcudan 20 gündür görünmeyen, 8 gündür
 * görünmeyenin üstünde durur.
 */
export function compareRadarPriority(
  a: Pick<MemberRadar, "riskScore" | "daysQuiet">,
  b: Pick<MemberRadar, "riskScore" | "daysQuiet">,
): number {
  if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
  return (b.daysQuiet ?? -1) - (a.daysQuiet ?? -1);
}

/** Bant başına sayım — ekranın üstündeki dört kutu. */
export function countByBand(
  rows: readonly { band: RadarBand }[],
): Record<RadarBand, number> {
  const counts: Record<RadarBand, number> = {
    kritik: 0,
    izle: 0,
    yeni: 0,
    yolunda: 0,
  };
  for (const row of rows) counts[row.band] += 1;
  return counts;
}

/** Salonda hangi sinyal kaç kişide var — "sistemik sorun" burada görünür. */
export function countBySignal(
  rows: readonly { signals: readonly RadarSignal[] }[],
): { key: RadarSignalKey; count: number }[] {
  const counts = new Map<RadarSignalKey, number>();
  for (const row of rows) {
    // Aynı sporcuda bir anahtar iki kez üretilmez; yine de tekilleştiriyoruz.
    const seen = new Set<RadarSignalKey>();
    for (const signal of row.signals) {
      if (seen.has(signal.key)) continue;
      seen.add(signal.key);
      counts.set(signal.key, (counts.get(signal.key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
