import Link from "next/link";
import {
  PERIOD_KINDS,
  PERIOD_LABEL,
  periodContaining,
  shiftPeriod,
  type Period,
  type PeriodKind,
} from "@/domain/finance/period";
import {
  activeChipClass,
  secondaryButtonClass,
} from "@/components/panel/form";

/**
 * Günlük / haftalık / aylık dönem seçici + ileri-geri okları.
 *
 * Durum URL'de yaşar (`?donem=ay&kayma=-1`) — sayfa sunucuda render edilir,
 * yenilenince ya da paylaşılınca aynı dönem açılır.
 */

export type PeriodParams = { donem?: string; kayma?: string };

/** URL parametrelerinden dönemi çözer; geçersiz değer bugüne düşer. */
export function resolvePeriod(
  params: PeriodParams,
  now: Date = new Date(),
): { period: Period; kind: PeriodKind; offset: number } {
  const kind = (PERIOD_KINDS as readonly string[]).includes(params.donem ?? "")
    ? (params.donem as PeriodKind)
    : "ay";

  const parsed = Number(params.kayma);
  // Gelecek dönemde kasa boş olur; ileri gitmeye izin yok.
  const offset = Number.isInteger(parsed) ? Math.min(0, parsed) : 0;

  const current = periodContaining(kind, now);
  return {
    period: offset === 0 ? current : shiftPeriod(current, offset),
    kind,
    offset,
  };
}

export function PeriodNav({
  basePath,
  kind,
  offset,
  period,
}: {
  basePath: string;
  kind: PeriodKind;
  offset: number;
  period: Period;
}) {
  const href = (nextKind: PeriodKind, nextOffset: number) =>
    `${basePath}?donem=${nextKind}&kayma=${nextOffset}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {PERIOD_KINDS.map((option) => (
          <Link
            key={option}
            href={href(option, 0)}
            className={option === kind ? activeChipClass : secondaryButtonClass}
          >
            {PERIOD_LABEL[option]}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link href={href(kind, offset - 1)} className={secondaryButtonClass} aria-label="Önceki dönem">
          ‹
        </Link>
        <span className="min-w-40 text-center text-xs font-semibold text-brand-white">
          {period.label}
        </span>
        {offset < 0 ? (
          <Link href={href(kind, offset + 1)} className={secondaryButtonClass} aria-label="Sonraki dönem">
            ›
          </Link>
        ) : (
          <span className={`${secondaryButtonClass} opacity-30`}>›</span>
        )}
      </div>
    </div>
  );
}

/** Yatay oran çubuğu — gider kırılımı ve hakediş dağılımı için. */
export function ShareBar({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: string;
  max: number;
  hint?: string;
  }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-xs text-brand-muted" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 rounded-sm bg-brand-surface-2">
        <div
          className="h-full rounded-sm bg-brand-yellow"
          style={{ width: `${Math.round(Math.min(1, Math.max(0, max)) * 100)}%` }}
        />
      </div>
      <span className="w-32 shrink-0 text-right text-xs text-brand-white">
        {value}
        {hint && <span className="ml-1 text-brand-muted">{hint}</span>}
      </span>
    </li>
  );
}
