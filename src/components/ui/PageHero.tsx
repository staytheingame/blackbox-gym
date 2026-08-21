export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-brand-border bg-brand-ink">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-brand-yellow">
          {eyebrow}
        </span>
        <h1 className="font-display mt-2 text-4xl uppercase tracking-wide text-brand-white sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
