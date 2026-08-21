import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { trainingPlans } from "@/data/training-plans";

export const metadata: Metadata = {
  title: "Antrenman Planları — BlackBox",
  description: "Seviyene göre boks ve fight antrenman planları.",
};

export default function TrainingPlansPage() {
  return (
    <div>
      <PageHero
        eyebrow="Antrenman Planları"
        title="Seviyene Uygun Program"
        description="Başlangıçtan fight-prep kampına kadar üç seviyeli antrenman yapısı. Antrenörün, ilerlemene göre haftalık planı günceller."
      />

      <section className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:px-6">
        {trainingPlans.map((plan) => (
          <div
            key={plan.slug}
            className="rounded-sm border border-brand-border bg-brand-surface p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
                  {plan.level}
                </span>
                <h2 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
                  {plan.title}
                </h2>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
              {plan.summary}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {plan.weeklySplit.map((item) => (
                <div
                  key={item.day}
                  className="rounded-sm border border-brand-border bg-brand-black px-4 py-3"
                >
                  <div className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                    {item.day}
                  </div>
                  <div className="mt-1 text-sm text-brand-white">
                    {item.focus}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
