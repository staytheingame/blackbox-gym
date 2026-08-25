import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { listPlanTemplates } from "@/lib/queries/plans";
import {
  PLAN_LEVEL_LABEL,
  type PlanKind,
} from "@/domain/plans/template";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { TemplateForm } from "./TemplateForm";

export const metadata: Metadata = { title: "Planlar — BlackBox Panel" };

const KIND_TITLE: Record<PlanKind, { heading: string; description: string }> = {
  antrenman: {
    heading: "Antrenman Şablonları",
    description:
      "Haftalık antrenman şablonları — sporcuya atadığında onun programı olur. Şablonu aç, günleri ve hareketleri yaz.",
  },
  kondisyon: {
    heading: "Kondisyon Şablonları",
    description:
      "İp, koşu, interval ve sirkuit blokları. Sporcu antrenman programının yanında kondisyon programını da taşıyabilir.",
  },
};

export default async function StaffPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);

  const params = await searchParams;
  const rawKind = typeof params.tur === "string" ? params.tur : "antrenman";
  const kind: PlanKind = rawKind === "kondisyon" ? "kondisyon" : "antrenman";

  const templates = await listPlanTemplates(membership.organizationId, kind);
  const copy = KIND_TITLE[kind];
  const active = templates.filter((template) => template.isActive);

  return (
    <PanelPage title={copy.heading} description={copy.description}>
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Şablon"
          value={active.length}
          suffix={
            templates.length !== active.length ? `/ ${templates.length}` : undefined
          }
          hint={
            templates.length !== active.length
              ? `${templates.length - active.length} tanesi yayında değil`
              : "Yayında"
          }
        />
        <StatCard
          label="Atama"
          value={templates.reduce((sum, t) => sum + t.assignmentCount, 0)}
          hint="Aktif + geçmiş"
        />
        <StatCard
          label="Toplam Gün"
          value={templates.reduce((sum, t) => sum + t.dayCount, 0)}
          hint="Tüm haftalar"
        />
      </div>

      <PanelCard
        title="Yeni Şablon"
        description="Künyeyi kaydettikten sonra günleri ve hareketleri şablon sayfasında yazacaksın."
      >
        <TemplateForm />
      </PanelCard>

      <PanelCard title={`Şablonlar (${templates.length})`}>
        {templates.length === 0 ? (
          <EmptyState>
            Bu türde şablon yok. Yukarıdaki formdan ilk şablonu oluştur — ya da
            örnek şablonlar için <code>node prisma/seed.mjs</code> çalıştır.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {templates.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/personel/planlar/${template.id}`}
                  className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {template.name}
                    </div>
                    <div className="text-xs text-brand-muted">
                      {template.summary ??
                        `${template.dayCount} gün tanımlı · ${template.weeks} hafta`}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!template.isActive && <Pill tone="danger">Yayında değil</Pill>}
                    <Pill>
                      {PLAN_LEVEL_LABEL[template.level] ?? template.level}
                    </Pill>
                    <Pill>{template.weeks} hafta</Pill>
                    <Pill tone="yellow">{template.assignmentCount} atama</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
