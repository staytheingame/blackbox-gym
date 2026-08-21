import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { tools } from "@/config/tools";

export const metadata: Metadata = {
  title: "Araçlar — BlackBox",
  description: "BlackBox'ın sanal rakip oyunu, sesli refleks testi, fight lab ve dövüş analitiği araçları.",
};

export default function ToolsPage() {
  return (
    <div>
      <PageHero
        eyebrow="Araçlar"
        title="Salonun Dijital Araçları"
        description="Üye olmasan bile deneyebilirsin — hepsi tarayıcında çalışır, kamera görüntüsü ve video sunucuya gönderilmez."
      />
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={tool.href}
              className="group flex flex-col justify-between rounded-sm border border-brand-border bg-brand-surface p-8 transition-colors hover:border-brand-yellow"
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
                  {tool.tagline}
                </span>
                <h2 className="font-display mt-2 text-2xl uppercase tracking-wide text-brand-white">
                  {tool.name}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                  {tool.description}
                </p>
              </div>
              <span className="mt-6 text-sm font-bold uppercase tracking-wide text-brand-yellow group-hover:text-brand-white">
                Aracı Aç →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
