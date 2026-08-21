import type { ReactNode } from "react";

/**
 * Panel sayfa iskeleti — public sitedeki `PageHero`'nun panel karşılığı.
 * Pazarlama hero'su yerine kompakt bir başlık şeridi + içerik kabı.
 */
export function PanelPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="border-b border-brand-border bg-brand-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-4 py-7 sm:px-6">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide text-brand-white sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {children}
      </div>
    </>
  );
}

export function PanelCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-sm border border-brand-border bg-brand-surface ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-5 py-4">
          <div>
            {title && (
              <h2 className="font-display text-base uppercase tracking-wide text-brand-yellow">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-xs text-brand-muted">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Kart içi liste — kenar boşluğu olmadan tam genişlik satırlar için. */
export function PanelList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-brand-border rounded-sm border border-brand-border bg-brand-surface">
      {children}
    </ul>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  hint,
  highlight = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-5 ${
        highlight
          ? "border-brand-yellow bg-brand-surface-2"
          : "border-brand-border bg-brand-surface"
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </div>
      <div className="font-display mt-2 text-2xl text-brand-white">
        {value}
        {suffix && <span className="ml-1 text-sm text-brand-muted">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-brand-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-brand-border px-4 py-6 text-center text-sm text-brand-muted">
      {children}
    </p>
  );
}

/**
 * Yapısı kurulmuş ama veri modeli henüz olmayan ekranların dürüst yer
 * tutucusu. Boş sayfa yerine: bu ekran ne yapacak, Kong'da neyin karşılığı,
 * çalışması için hangi tablo/servis gerekiyor.
 */
export function Scaffold({
  mirrors,
  summary,
  features,
  needs,
}: {
  /** Kong Academy'deki karşılığı — hangi ekrandan geliyor. */
  mirrors: string;
  summary: string;
  /** Bu ekranda olacak işler. */
  features: string[];
  /** Çalışması için eksik olanlar (tablo, servis, entegrasyon). */
  needs: string[];
}) {
  return (
    <PanelCard title="Bu ekran hazırlanıyor" description={mirrors}>
      <p className="text-sm leading-relaxed text-brand-muted">{summary}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
            Burada olacaklar
          </h3>
          <ul className="mt-2 space-y-1.5">
            {features.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-brand-white">
                <span className="text-brand-yellow">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Gereken altyapı
          </h3>
          <ul className="mt-2 space-y-1.5">
            {needs.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-brand-muted">
                <span>·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PanelCard>
  );
}

export function Pill({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "yellow" | "danger";
  title?: string;
}) {
  const tones = {
    neutral: "border-brand-border bg-brand-surface-2 text-brand-white",
    yellow: "border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow",
    danger: "border-red-400/40 bg-red-400/10 text-red-300",
  } as const;

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
