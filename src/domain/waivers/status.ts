/**
 * Onam & sağlık beyanı durumu — saf fonksiyonlar, veritabanı bilmez.
 *
 * Salonun hukuki tarafı: sağlık beyanı, sorumluluk reddi, 18 yaş altı için
 * veli izni, KVKK aydınlatma metni. Kural basit:
 *
 *   - Şablonun `version`'ı artınca eski imza **geçersiz olmaz, eskir** —
 *     kayıt durur, sporcudan yeni sürüm istenir.
 *   - Yalnız `isRequired` şablonlar "eksik" sayılır; isteğe bağlı olanlar
 *     (ör. fotoğraf izni) listede görünür ama kimseyi uyarıya düşürmez.
 *
 * Bu ekran bir **uyarı** katmanıdır, kapı değil: onamı olmayan sporcunun
 * rezervasyonu engellenmez, antrenörün önüne "şu imzalar eksik" diye düşer.
 * Engellemeye çevirmek istenirse tek yer `lib/queries/waivers.ts`.
 */

export const WAIVER_KINDS = [
  "saglik",
  "sorumluluk",
  "veli-izni",
  "kvkk",
] as const;
export type WaiverKind = (typeof WAIVER_KINDS)[number];

export const WAIVER_KIND_LABEL: Record<WaiverKind, string> = {
  saglik: "Sağlık Beyanı",
  sorumluluk: "Sorumluluk Reddi",
  "veli-izni": "Veli İzni",
  kvkk: "KVKK Aydınlatma",
};

export type WaiverState = "imzali" | "eksik" | "eski";

export const WAIVER_STATE_LABEL: Record<WaiverState, string> = {
  imzali: "İmzalı",
  eksik: "İmzalanmadı",
  eski: "Eski sürüm",
};

export type WaiverTemplateRef = {
  id: string;
  kind: WaiverKind;
  title: string;
  version: number;
  isRequired: boolean;
  requiresGuardian: boolean;
};

export type SignatureRef = {
  templateId: string;
  version: number;
  status: string;
  signedAt: Date;
};

export type WaiverItem = {
  templateId: string;
  title: string;
  kind: WaiverKind;
  state: WaiverState;
  isRequired: boolean;
  requiresGuardian: boolean;
  currentVersion: number;
  /** İmzalanan sürüm; hiç imzalanmadıysa `null`. */
  signedVersion: number | null;
  signedAt: Date | null;
};

export type WaiverSummary = {
  items: WaiverItem[];
  /** Hiç imzalanmamış zorunlu form sayısı. */
  missingCount: number;
  /** Eski sürümde kalmış zorunlu form sayısı. */
  outdatedCount: number;
  /** Sporcudan beklenen toplam imza (eksik + eski). */
  pendingCount: number;
  allSigned: boolean;
};

/**
 * Sporcunun imza tablosu. Aynı şablon birden çok kez imzalanmış olabilir
 * (sürüm yükselmiştir) — **en yüksek sürümlü geçerli imza** dikkate alınır.
 */
export function summarizeWaivers(input: {
  templates: WaiverTemplateRef[];
  signatures: SignatureRef[];
}): WaiverSummary {
  const items: WaiverItem[] = input.templates.map((template) => {
    const signed = input.signatures
      .filter(
        (signature) =>
          signature.templateId === template.id &&
          signature.status === "imzalandi",
      )
      .sort((a, b) => b.version - a.version)[0];

    const state: WaiverState = !signed
      ? "eksik"
      : signed.version >= template.version
        ? "imzali"
        : "eski";

    return {
      templateId: template.id,
      title: template.title,
      kind: template.kind,
      state,
      isRequired: template.isRequired,
      requiresGuardian: template.requiresGuardian,
      currentVersion: template.version,
      signedVersion: signed?.version ?? null,
      signedAt: signed?.signedAt ?? null,
    };
  });

  const required = items.filter((item) => item.isRequired);
  const missingCount = required.filter((item) => item.state === "eksik").length;
  const outdatedCount = required.filter((item) => item.state === "eski").length;

  return {
    items,
    missingCount,
    outdatedCount,
    pendingCount: missingCount + outdatedCount,
    allSigned: missingCount + outdatedCount === 0,
  };
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Doğum tarihine göre yaş; tarih yoksa `null`. */
export function ageAt(birthDate: Date | null, now: Date): number | null {
  if (!birthDate) return null;
  return Math.floor((now.getTime() - birthDate.getTime()) / MS_PER_YEAR);
}

/** 18 yaşından küçük mü — yaş bilinmiyorsa `false` (zorlamayız, sorarız). */
export function isMinor(birthDate: Date | null, now: Date): boolean {
  const age = ageAt(birthDate, now);
  return age !== null && age < 18;
}

/**
 * Bu imza veli bilgisi ister mi? İki koşuldan biri yeterli: şablon her
 * durumda veli istiyordur (veli izni formu) ya da sporcu 18 yaş altıdır.
 */
export function needsGuardian(input: {
  template: Pick<WaiverTemplateRef, "requiresGuardian">;
  birthDate: Date | null;
  now: Date;
}): boolean {
  return input.template.requiresGuardian || isMinor(input.birthDate, input.now);
}

/**
 * Sağlık sorularına verilen yanıtlardan antrenörün okuması gereken notu
 * çıkarır: "evet" yanıtları risk işaretidir, hepsi "hayır" ise not yok.
 */
export function healthNoteFrom(
  answers: Record<string, string>,
): string | null {
  const flagged = Object.entries(answers)
    .filter(([, value]) => value === "evet")
    .map(([question]) => question);

  return flagged.length === 0 ? null : flagged.join(" · ");
}
