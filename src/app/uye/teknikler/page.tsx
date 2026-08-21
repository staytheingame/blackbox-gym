import type { Metadata } from "next";
import { PanelPage } from "@/components/panel/ui";
import {
  TechniqueLibrary,
  parseCategory,
} from "@/components/panel/TechniqueLibrary";

export const metadata: Metadata = { title: "Teknikler — BlackBox Panel" };

export default async function MemberTechniquesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category = parseCategory(params.kategori);

  return (
    <PanelPage
      title="Teknik Kütüphanesi"
      description="Vuruşlar, savunma, ayak işi ve kombinasyonlar — anahtar noktalar ve sık yapılan hatalarla."
    >
      <TechniqueLibrary basePath="/uye/teknikler" category={category} />
    </PanelPage>
  );
}
