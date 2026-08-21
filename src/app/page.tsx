import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { trainingPlans } from "@/data/training-plans";
import { equipmentCatalog } from "@/data/equipment";

const stats = [
  { label: "Aktif üye", value: "250+" },
  { label: "Haftalık ders", value: "18" },
  { label: "Antrenör", value: "3" },
  { label: "Yıllık deneyim", value: "12+" },
];

const modules = [
  {
    title: "Boks",
    description: "Duruştan ileri kombinasyona, temel boks eğitiminin tamamı.",
    href: "/antrenman-planlari",
  },
  {
    title: "Kickbox",
    description: "Yumruk ve tekme tekniklerini birleştiren yüksek tempolu dersler.",
    href: "/dersler",
  },
  {
    title: "Fight Prep",
    description: "Maça çıkacak sporcular için yoğun sparring ve taktik kampı.",
    href: "/antrenman-planlari",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-brand-border bg-brand-black">
        <div className="absolute inset-0 bg-diagonal-stripes opacity-[0.04]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-brand-yellow">
            BlackBox Box & Fight Gym
          </span>
          <h1 className="font-display mt-4 max-w-3xl text-5xl uppercase leading-[1.05] tracking-wide text-brand-white sm:text-6xl">
            Ringe çık,
            <br />
            <span className="text-brand-yellow">sınırını zorla.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-brand-muted sm:text-lg">
            Boks ve fight sporlarına özel salon: uzman antrenörler, tam
            donanımlı ring ve torba istasyonları, seviyene uygun antrenman
            planı.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/uyelikler"
              className="rounded-sm bg-brand-yellow px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
            >
              Üye Ol
            </Link>
            <Link
              href="/dersler"
              className="rounded-sm border border-brand-border px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow"
            >
              Ders Programını Gör
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-brand-border bg-brand-ink">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-3xl text-brand-yellow sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Programlar"
          title="Neye çalışmak istersen"
          description="Üç ana modülde antrenman: seviyene göre başlangıçtan fight-prep kampına kadar."
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="group flex flex-col justify-between rounded-sm border border-brand-border bg-brand-surface p-6 transition-colors hover:border-brand-yellow"
            >
              <div>
                <h3 className="font-display text-xl uppercase tracking-wide text-brand-white">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  {module.description}
                </p>
              </div>
              <span className="mt-6 text-sm font-bold uppercase tracking-wide text-brand-yellow group-hover:text-brand-white">
                Detaya bak →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-brand-border bg-brand-ink">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHeading
            eyebrow="Antrenman Planları"
            title="Seviyene uygun program"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {trainingPlans.map((plan) => (
              <div
                key={plan.slug}
                className="rounded-sm border border-brand-border bg-brand-surface p-6"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                  {plan.level}
                </span>
                <h3 className="font-display mt-2 text-lg uppercase tracking-wide text-brand-white">
                  {plan.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  {plan.summary}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/antrenman-planlari"
              className="text-sm font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
            >
              Tüm antrenman planlarını gör →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Ekipman"
          title="Salonda seni bekleyen ekipman"
          description="Boks ve fight antrenmanı için gereken her istasyon salonumuzda hazır."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {equipmentCatalog.slice(0, 8).map((item) => (
            <div
              key={item.slug}
              className="rounded-sm border border-brand-border bg-brand-surface p-4"
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-brand-yellow">
                {item.category}
              </span>
              <h3 className="mt-1 text-sm font-semibold text-brand-white">
                {item.name}
              </h3>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/ekipman"
            className="text-sm font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white"
          >
            Tüm ekipmanı gör →
          </Link>
        </div>
      </section>

      <section className="border-t border-brand-border bg-brand-yellow">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl uppercase tracking-wide text-brand-black">
              Ringe ilk adımı at
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-black/80">
              Bugün üye ol, seviyene uygun antrenman planınla salona başla.
            </p>
          </div>
          <Link
            href="/uyelikler"
            className="rounded-sm bg-brand-black px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand-white transition-colors hover:bg-brand-ink"
          >
            Üyelik Planlarını Gör
          </Link>
        </div>
      </section>
    </div>
  );
}
