import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { FightAnalysisTool } from "./FightAnalysisTool";

export const metadata: Metadata = {
  title: "Dövüş Analitiği — BlackBox",
  description:
    "Antrenman videonu yükle, guard/ayak işi/kafa hareketini tarayıcında analiz et.",
};

export default function FightAnalyticsPage() {
  return (
    <div>
      <PageHero
        eyebrow="Araçlar"
        title="Dövüş Analitiği"
        description="Bir video seç ve oynat — guard, ayak işi ve kafa hareketini MediaPipe ile tarayıcında analiz ederiz. Video hiçbir sunucuya yüklenmez."
      />
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <FightAnalysisTool />
      </section>
    </div>
  );
}
