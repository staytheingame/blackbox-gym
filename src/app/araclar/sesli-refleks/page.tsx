import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { ReflexTrainer } from "./ReflexTrainer";

export const metadata: Metadata = {
  title: "Sesli Refleks — BlackBox",
  description:
    "Sistem sesli olarak boks hamlesi söyler, sen tepki verirsin. Tepki sürelerini ölç.",
};

export default function VoiceReflexPage() {
  return (
    <div>
      <PageHero
        eyebrow="Araçlar"
        title="Sesli Refleks"
        description="Başlat'a bas, sesli komutu duyunca 'Tepki Ver' butonuna (veya Boşluk tuşuna) bas. Zorluk arttıkça komutlar arası bekleme kısalır."
      />
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <ReflexTrainer />
      </section>
    </div>
  );
}
