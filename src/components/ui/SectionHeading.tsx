export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display mt-2 text-3xl uppercase tracking-wide text-brand-white">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-brand-muted">
          {description}
        </p>
      )}
    </div>
  );
}
