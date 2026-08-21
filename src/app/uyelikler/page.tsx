import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/ui/PageHero";
import { membershipPlans } from "@/data/membership-plans";

export const metadata: Metadata = {
  title: "Üyelikler — BlackBox",
  description: "BlackBox üyelik planları, süreler ve haklar.",
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(price);

export default function MembershipsPage() {
  return (
    <div>
      <PageHero
        eyebrow="Üyelikler"
        title="Planını Seç"
        description="Tüm planlar sınırsız salon girişi ve boks & fight grup derslerini içerir. Süre uzadıkça hak da artar."
      />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {membershipPlans.map((plan) => (
            <div
              key={plan.slug}
              className={`flex flex-col rounded-sm border p-6 ${
                plan.highlight
                  ? "border-brand-yellow bg-brand-surface-2"
                  : "border-brand-border bg-brand-surface"
              }`}
            >
              {plan.highlight && (
                <span className="mb-3 inline-block w-fit rounded-sm bg-brand-yellow px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-black">
                  En çok tercih edilen
                </span>
              )}
              <h2 className="font-display text-xl uppercase tracking-wide text-brand-white">
                {plan.name}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {plan.durationLabel}
              </p>
              <div className="font-display mt-4 text-3xl text-brand-yellow">
                {formatPrice(plan.price)}
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-brand-muted">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="text-brand-yellow">•</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/iletisim"
                className="mt-6 rounded-sm bg-brand-yellow px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
              >
                Bu Planı Seç
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-brand-muted">
          Fiyatlar örnek gösterimdir; kesin fiyat ve ödeme seçenekleri
          resepsiyon ile netleştirilir.
        </p>
      </section>
    </div>
  );
}
