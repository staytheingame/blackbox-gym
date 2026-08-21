import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { ReflexTrainer } from "./ReflexTrainer";

export const metadata: Metadata = {
  title: "Sesli Refleks — BlackBox",
  description:
    "Sistem sesli olarak boks hamlesi söyler, sen tepki verirsin. Kamera modunda hamle eklem takibiyle doğrulanır, round bazlı odak raporu çıkar.",
};

export default function VoiceReflexPage() {
  return (
    <div>
      <PageHero
        eyebrow="Araçlar"
        title="Sesli Refleks"
        description="Sesli komut gelir, sen tepki verirsin. Manuel modda tuşla, kamera modunda gerçek hamleyle — iskelet takibi hem tepki anını hem hamlenin doğruluğunu ölçer. Seans round'lara bölünür, sonunda round bazlı odak raporu çıkar."
      />
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <ReflexTrainer />
      </section>
    </div>
  );
}
