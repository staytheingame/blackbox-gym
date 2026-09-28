import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
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
} from "@/components/panel/ui";
import { PriceForm } from "./PriceForm";

export const metadata: Metadata = { title: "Paket Fiyatları — BlackBox Panel" };

export const dynamic = "force-dynamic";

/**
 * PAKET FİYATLARI — antrenör fiyatı kendisi düzeltir.
 *
 * Yalnız fiyat düzenlenir; paket açma/kaldırma, süre ve ders adedi yönetici
 * işidir (`/yonetim/paketler`). Değişiklik yalnız bundan sonra başlayan
 * üyelikleri etkiler, mevcut üyelikler eski tutarı taşır.
 */
export default async function StaffPlanPricesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);

  const overview = await getMembershipOverview(
    organizationScope(membership.organizationId),
  );
  const plans = [...overview.plans].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive),
  );

  return (
    <PanelPage
      title="Paket Fiyatları"
      description="Fiyatı yanlış yazılmış bir paketi buradan düzeltebilirsin. Değişiklik yalnız bundan sonra başlatılan üyelikleri etkiler; mevcut üyelikler eski tutarı korur."
    >
      <PanelCard title={`Paketler (${plans.length})`}>
        {plans.length === 0 ? (
          <EmptyState>
            Henüz paket tanımlı değil. Paketleri yönetici ekler.
          </EmptyState>
        ) : (
          <ul className="space-y-5">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="space-y-3 border-b border-brand-border pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {plan.name}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {plan.durationDays} gün ·{" "}
                      {plan.totalSessions
                        ? `${plan.totalSessions} ders`
                        : "sınırsız ders"}
                      {plan.description ? ` · ${plan.description}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!plan.isActive && <Pill tone="danger">Satışta değil</Pill>}
                    <Pill tone="yellow">
                      {formatPriceTR(plan.priceMinor, plan.currency)}
                    </Pill>
                  </div>
                </div>

                <PriceForm
                  planId={plan.id}
                  planName={plan.name}
                  priceMinor={plan.priceMinor}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
