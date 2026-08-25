import Link from "next/link";
import {
  RADAR_BAND_LABEL,
  type RadarBand,
  type RadarSignal,
} from "@/domain/analysis/member-radar";
import type { MemberRadarRow } from "@/lib/queries/radar";
import { formatShortDateTR } from "@/lib/date";
import { EmptyState, Pill } from "@/components/panel/ui";

/**
 * Radar satırı — hem antrenörün "Takip" ekranında hem yöneticinin koç
 * karnesinde aynı görünür. Tek kaynak olması bilinçli: iki ekran aynı
 * sporcuya baktığında aynı gerekçeyi okumalı.
 *
 * Her sinyal pilinin `title`'ında kanıt ve yapılacak iş durur — sayının
 * nereden geldiği tıklamadan görülebilsin (bkz. member-radar.ts dil kuralı).
 */

const BAND_TONE: Record<RadarBand, "neutral" | "yellow" | "danger"> = {
  kritik: "danger",
  izle: "yellow",
  yeni: "neutral",
  yolunda: "neutral",
};

function signalTone(signal: RadarSignal): "neutral" | "yellow" | "danger" {
  if (signal.severity === "kritik") return "danger";
  if (signal.severity === "uyari") return "yellow";
  return "neutral";
}

export function RadarSignalPills({ signals }: { signals: RadarSignal[] }) {
  if (signals.length === 0) {
    return <Pill tone="neutral">Sinyal yok</Pill>;
  }

  return (
    <>
      {signals.map((signal) => (
        <Pill
          key={signal.key}
          tone={signalTone(signal)}
          title={`${signal.evidence} — ${signal.action}`}
        >
          {signal.label}
        </Pill>
      ))}
    </>
  );
}

/** Sağ üstteki risk rozeti — sayı sporcunun değeri değil, sıradaki yeri. */
function RiskBadge({ score, band }: { score: number; band: RadarBand }) {
  return (
    <span
      title={`Risk puanı ${score}/100 — ${RADAR_BAND_LABEL[band]}. Sporcunun notu değil, ilgilenme sırası.`}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border text-sm font-bold ${
        band === "kritik"
          ? "border-red-400/40 bg-red-400/10 text-red-300"
          : band === "izle"
            ? "border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow"
            : "border-brand-border bg-brand-surface-2 text-brand-muted"
      }`}
    >
      {score}
    </span>
  );
}

export function RadarRow({
  row,
  showCoach = false,
}: {
  row: MemberRadarRow;
  /** Yönetici ekranlarında sorumlu antrenör de görünsün. */
  showCoach?: boolean;
}) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <RiskBadge score={row.radar.riskScore} band={row.radar.band} />
          <div className="min-w-0">
            <Link
              href={`/personel/uyeler/${row.id}`}
              className="text-sm font-semibold text-brand-white transition-colors hover:text-brand-yellow"
            >
              {row.fullName}
              <span className="ml-2 text-xs text-brand-muted">
                {row.memberNo}
              </span>
            </Link>
            <p className="mt-1 text-xs text-brand-muted">
              {row.radar.headline}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Son kayıt{" "}
              {row.lastActivityAt
                ? formatShortDateTR(row.lastActivityAt)
                : "yok"}
              {" · "}
              {row.membershipLabel ?? "üyelik yok"}
              {row.overallScore !== null && ` · skor ${row.overallScore}`}
              {showCoach && ` · ${row.coachName ?? "antrenör atanmadı"}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Pill tone={BAND_TONE[row.radar.band]}>
            {RADAR_BAND_LABEL[row.radar.band]}
          </Pill>
          <Link
            href={`/personel/uyeler/${row.id}/analiz`}
            className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-brand-yellow"
          >
            Analiz
          </Link>
        </div>
      </div>

      {row.radar.signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          <RadarSignalPills signals={row.radar.signals} />
        </div>
      )}
    </li>
  );
}

export function RadarList({
  rows,
  showCoach = false,
  empty = "Bu filtreye uyan sporcu yok.",
}: {
  rows: MemberRadarRow[];
  showCoach?: boolean;
  empty?: string;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;

  return (
    <ul className="divide-y divide-brand-border">
      {rows.map((row) => (
        <RadarRow key={row.id} row={row} showCoach={showCoach} />
      ))}
    </ul>
  );
}
