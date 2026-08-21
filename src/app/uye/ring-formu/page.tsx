import type { Metadata } from "next";
import Link from "next/link";
import { tools } from "@/config/tools";
import { PanelCard, PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Ring Formu — BlackBox Panel" };

/**
 * Kong'daki "Form ve Hareket" (hareket analizi / hareket taraması) ekranının
 * BlackBox karşılığı. Analiz motorları zaten var ve tamamen tarayıcıda
 * çalışıyor — burada panel içinden erişilir.
 */
export default function MemberRingFormPage() {
  return (
    <PanelPage
      title="Ring Formu"
      description="Guard, ayak işi, kafa hareketi ve refleks — tarayıcında çalışan analiz araçları."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {tools.map((tool) => (
          <PanelCard
            key={tool.slug}
            title={tool.name}
            description={tool.tagline}
            action={
              <Link
                href={tool.href}
                className="rounded-sm bg-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
              >
                Aç
              </Link>
            }
          >
            <p className="text-sm leading-relaxed text-brand-muted">
              {tool.description}
            </p>
          </PanelCard>
        ))}
      </div>

      <Scaffold
        mirrors="Kong Academy → Danışan / Form ve Hareket"
        summary="Analiz araçları çalışıyor ama sonuçlar hiçbir yere kaydedilmiyor — sayfa yenilenince kayboluyor. Kaydetme açıldığında sonuçlar performans kartına ve antrenörünün ekranına işleyecek."
        features={[
          "Seans sonucunu profiline kaydetme",
          "Refleks süresi / guard disiplini zaman içinde grafik",
          "Antrenörün sonuçları görmesi ve yorum bırakması",
          "Sonuçtan otomatik antrenman kaydı ve puan",
        ]}
        needs={[
          "`ReflexSession` / `FightAnalysisResult` tabloları",
          "Sonuç → `TrainingLog` + `PointEvent` bağlantısı",
          "Antrenör tarafında sonuç inceleme ekranı",
        ]}
      />
    </PanelPage>
  );
}
