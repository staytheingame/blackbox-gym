import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { equipmentCatalog, type EquipmentItem } from "@/data/equipment";

export const metadata: Metadata = {
  title: "Ekipman — BlackBox",
  description: "BlackBox salonundaki boks ve fight ekipmanları.",
};

const categories: EquipmentItem["category"][] = [
  "Vuruş",
  "Koruma",
  "Kondisyon",
  "Ring & Saha",
];

export default function EquipmentPage() {
  return (
    <div>
      <PageHero
        eyebrow="Boks & Fight Ekipmanları"
        title="Salonda Seni Bekleyen Ekipman"
        description="Vuruş istasyonlarından koruma ekipmanına, kondisyon aletlerinden ringe kadar antrenmanın için gereken her şey."
      />

      <section className="mx-auto max-w-6xl space-y-12 px-4 py-14 sm:px-6">
        {categories.map((category) => {
          const items = equipmentCatalog.filter(
            (item) => item.category === category,
          );
          if (items.length === 0) return null;
          return (
            <div key={category}>
              <h2 className="font-display text-2xl uppercase tracking-wide text-brand-yellow">
                {category}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.slug}
                    className="rounded-sm border border-brand-border bg-brand-surface p-5"
                  >
                    <h3 className="text-base font-semibold text-brand-white">
                      {item.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
