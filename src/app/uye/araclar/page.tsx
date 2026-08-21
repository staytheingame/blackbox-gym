import type { Metadata } from "next";
import Link from "next/link";
import { tools } from "@/config/tools";
import { PanelCard, PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Araçlar — BlackBox Panel" };

export default function MemberToolsPage() {
  return (
    <PanelPage
      title="Araçlar"
      description="Tarayıcında çalışan antrenman araçları — hiçbiri sunucuya veri göndermez."
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
                className="rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black"
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
        mirrors="Kong Academy → Danışan / Araçlar (supplement & hesaplayıcılar)"
        summary="Kong'da bu bölüm kalori ve supplement hesaplayıcılarıydı; BlackBox'ta fight tarafına kayıyor."
        features={[
          "Sıklet düşüş hesaplayıcı (güvenli haftalık kayıp)",
          "Round zamanlayıcı (3dk/1dk özelleştirilebilir)",
          "Kombinasyon üretici (numaralı seriler)",
          "Sonuçları profile kaydetme",
        ]}
        needs={[
          "Hesaplayıcılar için saf fonksiyon + Vitest testleri (`src/domain/**`)",
          "Sonuç kaydı için üye bağlantılı tablo",
        ]}
      />
    </PanelPage>
  );
}
