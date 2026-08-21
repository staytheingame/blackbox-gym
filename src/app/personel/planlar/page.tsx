import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import {
  DAY_LABEL,
  PLAN_ITEM_KIND_LABEL,
  PLAN_LEVEL_LABEL,
  getPlanTemplateDetail,
  listPlanTemplates,
  type PlanKind,
} from "@/lib/queries/plans";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Planlar — BlackBox Panel" };

const KIND_TITLE: Record<PlanKind, { heading: string; description: string }> = {
  antrenman: {
    heading: "Antrenman Şablonları",
    description:
      "Haftalık antrenman şablonları — sporcuya atadığında onun programı olur.",
  },
  kondisyon: {
    heading: "Kondisyon Şablonları",
    description: "İp, koşu, interval ve sirkuit blokları.",
  },
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return seconds >= 60 ? `${Math.round(seconds / 60)} dk` : `${seconds} sn`;
}

export default async function StaffPlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const params = await searchParams;
  const rawKind = typeof params.tur === "string" ? params.tur : "antrenman";
  const kind: PlanKind = rawKind === "kondisyon" ? "kondisyon" : "antrenman";
  const selectedId = typeof params.sablon === "string" ? params.sablon : null;

  const templates = await listPlanTemplates(membership.organizationId, kind);
  const detail = selectedId ? await getPlanTemplateDetail(selectedId) : null;

  // Detay yalnız kendi salonunun şablonu için açılır.
  const safeDetail =
    detail && detail.organizationId === membership.organizationId
      ? detail
      : null;

  const week1 = safeDetail?.days.filter((day) => day.weekNumber === 1) ?? [];
  const copy = KIND_TITLE[kind];

  return (
    <PanelPage title={copy.heading} description={copy.description}>
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Şablon" value={templates.length} />
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

      <PanelCard title={`Şablonlar (${templates.length})`}>
        {templates.length === 0 ? (
          <EmptyState>
            Bu türde şablon yok. Örnek şablonlar için{" "}
            <code>node prisma/seed.mjs</code> çalıştırabilirsin.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {templates.map((template) => {
              const active = template.id === selectedId;
              return (
                <li key={template.id}>
                  <Link
                    href={`/personel/planlar?tur=${kind}&sablon=${template.id}`}
                    className={`-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2 ${
                      active ? "bg-brand-surface-2" : ""
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {template.name}
                      </div>
                      <div className="text-xs text-brand-muted">
                        {template.summary}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>{PLAN_LEVEL_LABEL[template.level] ?? template.level}</Pill>
                      <Pill>{template.weeks} hafta</Pill>
                      <Pill tone="yellow">{template.assignmentCount} atama</Pill>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      {safeDetail && (
        <PanelCard
          title={`${safeDetail.name} — 1. Hafta`}
          description={`${safeDetail.weeks} haftalık şablon · sonraki haftalarda round sayısı kademeli artar`}
        >
          {week1.length === 0 ? (
            <EmptyState>Bu şablonda gün tanımlı değil.</EmptyState>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {week1.map((day) => (
                <div
                  key={day.id}
                  className="rounded-sm border border-brand-border bg-brand-surface-2 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm uppercase tracking-wide text-brand-yellow">
                      {DAY_LABEL[day.dayOfWeek]}
                    </h3>
                    <span className="text-xs text-brand-muted">{day.focus}</span>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {day.items.map((item) => {
                      const duration = formatDuration(item.durationSeconds);
                      const meta = [
                        item.rounds ? `${item.rounds} round` : null,
                        duration,
                        item.restSeconds ? `${item.restSeconds} sn dinlenme` : null,
                        item.targetRpe ? `RPE ${item.targetRpe}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <li key={item.id} className="text-sm">
                          <span className="text-brand-white">{item.label}</span>
                          <span className="ml-2 text-xs text-brand-muted">
                            {PLAN_ITEM_KIND_LABEL[item.kind] ?? item.kind}
                            {meta ? ` · ${meta}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <p className="mt-5 text-xs text-brand-muted">
            Şablonu bir sporcuya atamak için sporcu detay sayfasındaki{" "}
            <strong className="text-brand-white">Program Ata</strong> kartını
            kullan.
          </p>
        </PanelCard>
      )}
    </PanelPage>
  );
}
