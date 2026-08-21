import Link from "next/link";
import {
  TECHNIQUE_CATEGORY_LABEL,
  techniquesByCategory,
  type TechniqueCategory,
} from "@/data/techniques";
import { PanelCard, Pill } from "./ui";

const CATEGORIES: (TechniqueCategory | "hepsi")[] = [
  "hepsi",
  "vurus",
  "savunma",
  "ayak-isi",
  "kombinasyon",
];

function label(category: TechniqueCategory | "hepsi"): string {
  return category === "hepsi"
    ? "Hepsi"
    : TECHNIQUE_CATEGORY_LABEL[category];
}

/**
 * Teknik kütüphanesi — üye ve personel panelinde aynı içerik, farklı
 * çerçevede kullanılır (Kong'un "Egzersiz Kütüphanesi"nin fight karşılığı).
 */
export function TechniqueLibrary({
  basePath,
  category,
}: {
  /** Filtre linklerinin gideceği rota: `/uye/teknikler` ya da `/personel/teknikler`. */
  basePath: string;
  category: TechniqueCategory | "hepsi";
}) {
  const list = techniquesByCategory(category);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => {
          const active = item === category;
          const href = item === "hepsi" ? basePath : `${basePath}?kategori=${item}`;
          return (
            <Link
              key={item}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                active
                  ? "border-brand-yellow bg-brand-yellow text-brand-black"
                  : "border-brand-border text-brand-muted hover:border-brand-yellow/40 hover:text-brand-white"
              }`}
            >
              {label(item)}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {list.map((technique) => (
          <PanelCard
            key={technique.slug}
            title={technique.name}
            description={`${TECHNIQUE_CATEGORY_LABEL[technique.category]} · ${technique.level}`}
            action={
              technique.numbering ? (
                <Pill tone="yellow">{technique.numbering}</Pill>
              ) : undefined
            }
          >
            <p className="text-sm leading-relaxed text-brand-muted">
              {technique.summary}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                  Anahtar noktalar
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {technique.cues.map((cue) => (
                    <li key={cue} className="flex gap-2 text-sm text-brand-white">
                      <span className="text-brand-yellow">·</span>
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                  Sık yapılan hata
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {technique.commonMistakes.map((mistake) => (
                    <li key={mistake} className="flex gap-2 text-sm text-brand-muted">
                      <span>·</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </PanelCard>
        ))}
      </div>
    </>
  );
}

/** `?kategori=` değerini güvenli biçimde çözer. */
export function parseCategory(
  value: string | string[] | undefined,
): TechniqueCategory | "hepsi" {
  const valid: (TechniqueCategory | "hepsi")[] = CATEGORIES;
  return typeof value === "string" &&
    (valid as string[]).includes(value)
    ? (value as TechniqueCategory)
    : "hepsi";
}
