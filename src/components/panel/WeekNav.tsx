import Link from "next/link";
import { formatDateTR } from "@/lib/date";
import { secondaryButtonClass } from "./form";

/**
 * Hafta ileri/geri şeridi. Hafta `?hafta=` sorgusuyla taşınır (0 = bu hafta),
 * böylece sunucu bileşeni kalır — istemci durumu gerekmiyor.
 */
export function WeekNav({
  basePath,
  offset,
  weekStart,
  weekEnd,
}: {
  basePath: string;
  offset: number;
  weekStart: Date;
  weekEnd: Date;
}) {
  const link = (value: number) =>
    value === 0 ? basePath : `${basePath}?hafta=${value}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={link(offset - 1)}
        aria-label="Önceki hafta"
        className={secondaryButtonClass}
      >
        ← Önceki
      </Link>
      <span className="text-xs text-brand-muted">
        {formatDateTR(weekStart)} – {formatDateTR(weekEnd)}
        {offset === 0 && (
          <span className="ml-2 text-brand-yellow">bu hafta</span>
        )}
      </span>
      <Link
        href={link(offset + 1)}
        aria-label="Sonraki hafta"
        className={secondaryButtonClass}
      >
        Sonraki →
      </Link>
      {offset !== 0 && (
        <Link href={basePath} className={secondaryButtonClass}>
          Bu hafta
        </Link>
      )}
    </div>
  );
}

/** `?hafta=` değerini makul bir aralığa sıkıştırır. */
export function parseWeekOffset(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.trunc(parsed), -26), 26);
}
