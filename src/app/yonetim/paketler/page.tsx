import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import {
  formatPriceTR,
  getMembershipOverview,
} from "@/lib/queries/memberships";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { PlanForm } from "./PlanForm";
import { archivePlanAction, restorePlanAction } from "./actions";

export const metadata: Metadata = { title: "Paketler — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const rowButton =
  "rounded-sm border border-brand-border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

export default async function AdminPlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);
  // Yönetici salonun tamamını görür.
  const scope = organizationScope(membership.organizationId);

  const overview = await getMembershipOverview(scope);
  const active = overview.plans.filter((plan) => plan.isActive);

  return (
    <PanelPage
      title="Üyelik Paketleri"
      description="Salonun sattığı paketler. Antrenör üyelik başlatırken yalnız satıştaki paketleri görür; ders adedi ve süre satın alma anında kopyalanır."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Satıştaki Paket" value={active.length} />
        <StatCard
          label="Toplam Tanım"
          value={overview.plans.length}
          hint="Arşivlenenler dahil"
        />
        <StatCard
          label="Aktif Üyelik"
          value={overview.activeCount}
          hint={`${overview.expiringSoon} tanesi 14 gün içinde bitiyor`}
        />
      </div>

      <PanelCard
        title="Yeni Paket"
        description="Paket tanımı değişirse geçmiş abonelikler etkilenmez — satın alma anındaki değerler kopyalanmıştır."
      >
        <PlanForm />
      </PanelCard>

      <PanelCard title={`Paketler (${overview.plans.length})`}>
        {overview.plans.length === 0 ? (
          <EmptyState>
            Henüz paket tanımlı değil. Yukarıdaki formdan ilk paketi ekle —
            paket olmadan antrenör üyelik başlatamaz.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {overview.plans.map((plan) => (
              <details
                key={plan.id}
                className="rounded-sm border border-brand-border bg-brand-surface-2"
              >
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <span className="text-sm font-semibold text-brand-white">
                      {plan.name}
                    </span>
                    <div className="mt-1 text-xs text-brand-muted">
                      {plan.durationDays} gün ·{" "}
                      {plan.totalSessions
                        ? `${plan.totalSessions} ders`
                        : "sınırsız ders"}
                      {plan.description ? ` · ${plan.description}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Pill>{plan.activeCount} aktif üyelik</Pill>
                    {!plan.isActive && <Pill tone="danger">Arşiv</Pill>}
                    <Pill tone="yellow">
                      {formatPriceTR(plan.priceMinor, plan.currency)}
                    </Pill>
                  </div>
                </summary>

                <div className="space-y-4 border-t border-brand-border px-4 py-4">
                  <PlanForm
                    planId={plan.id}
                    defaults={{
                      name: plan.name,
                      description: plan.description,
                      priceMinor: plan.priceMinor,
                      durationDays: plan.durationDays,
                      totalSessions: plan.totalSessions,
                      isActive: plan.isActive,
                    }}
                  />

                  <div className="flex flex-wrap gap-2 border-t border-brand-border pt-4">
                    {plan.isActive ? (
                      <form action={archivePlanAction.bind(null, plan.id)}>
                        <button type="submit" className={rowButton}>
                          Satıştan Kaldır
                        </button>
                      </form>
                    ) : (
                      <form action={restorePlanAction.bind(null, plan.id)}>
                        <button type="submit" className={rowButton}>
                          Tekrar Satışa Al
                        </button>
                      </form>
                    )}
                    <span className="self-center text-[0.7rem] text-brand-muted">
                      Paketler silinmez — geçmiş üyelikler bu tanıma bağlı.
                    </span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </PanelCard>
    </PanelPage>
  );
}
