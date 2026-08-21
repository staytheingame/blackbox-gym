import type { Metadata } from "next";
import { PanelPage } from "@/components/panel/ui";
import {
  TechniqueLibrary,
  parseCategory,
} from "@/components/panel/TechniqueLibrary";

export const metadata: Metadata = { title: "Teknikler — BlackBox Panel" };

export default async function StaffTechniquesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const category = parseCategory(params.kategori);

  return (
    <PanelPage
      title="Teknik & Kombinasyon Kütüphanesi"
      description="Antrenman şablonlarında ve akademi derslerinde kullanılan teknik havuzu."
    >
      <TechniqueLibrary basePath="/personel/teknikler" category={category} />
    </PanelPage>
  );
}
