import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { getMembershipBreakdown, listMembers } from "@/lib/queries/staff";
import {
  formatPriceTR,
  getMembershipOverview,
  listActiveMembershipPlans,
} from "@/lib/queries/memberships";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  Scaffold,
  StatCard,
} from "@/components/panel/ui";
import { SubscriptionForm } from "./SubscriptionForm";
import { changeSubscriptionStatusAction, closeExpiredAction } from "./actions";

export const metadata: Metadata = { title: "Üyelikler — BlackBox Panel" };

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  lead: "Aday",
  inactive: "Pasif",
  blocked: "Engelli",
  aktif: "Aktif",
  bitti: "Bitti",
  donduruldu: "Donduruldu",
  iptal: "İptal",
};

const rowButtonClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

export default async function StaffMembershipsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const [overview, breakdown, members, plans] = await Promise.all([
    getMembershipOverview(membership.organizationId),
    getMembershipBreakdown(membership.organizationId),
    listMembers(membership.organizationId),
    listActiveMembershipPlans(membership.organizationId),
  ]);

  return (
    <PanelPage
      title="Üyelik & Ders Hakkı"
      description="Paketler, aktif üyelikler, kalan ders hakları ve bitmek üzere olanlar. Tahsilat uygulamada tutulmuyor."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Aktif Üyelik"
          value={overview.activeCount}
          hint={`${breakdown.total} kayıt içinde`}
        />
        <StatCard
          label="Süresi Bitiyor"
          value={overview.expiringSoon}
          highlight={overview.expiringSoon > 0}
          hint="14 gün içinde"
        />
        <StatCard
          label="Ders Hakkı Bitti"
          value={overview.creditsExhausted}
          highlight={overview.creditsExhausted > 0}
          hint="Süresi var ama ders kalmadı"
        />
        <StatCard
          label="Satıştaki Paket"
          value={plans.length}
          hint={`${overview.plans.length} tanımlı paket`}
        />
      </div>

      {overview.staleActiveCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-5 text-sm text-brand-white">
          <span>
            <strong>{overview.staleActiveCount} üyelik</strong> süresi dolduğu
            hâlde &quot;aktif&quot; duruyor. Listede zaten bitmiş görünüyorlar;
            kaydı da kapatmak için:
          </span>
          <form action={closeExpiredAction}>
            <button
              type="submit"
              className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
            >
              Süresi Geçenleri Kapat
            </button>
          </form>
        </div>
      )}

      <PanelCard
        title="Üyelik Başlat / Yenile"
        description="Paket seç, sporcuya bağla. Ders adedi ve süre paketten kopyalanır."
      >
        <SubscriptionForm
          members={members.map((member) => ({
            id: member.id,
            fullName: member.fullName,
            memberNo: member.memberNo,
          }))}
          plans={plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            priceLabel: formatPriceTR(plan.priceMinor, plan.currency),
            durationDays: plan.durationDays,
            totalSessions: plan.totalSessions,
          }))}
        />
      </PanelCard>

      <PanelCard title={`Paketler (${overview.plans.length})`}>
        {overview.plans.length === 0 ? (
          <EmptyState>
            Paket tanımlı değil — örnek paketler için{" "}
            <code>npm run db:seed</code> çalıştırabilirsin.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {overview.plans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {plan.name}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {plan.description} · {plan.durationDays} gün ·{" "}
                    {plan.totalSessions
                      ? `${plan.totalSessions} ders`
                      : "sınırsız ders"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!plan.isActive && <Pill>Satışta değil</Pill>}
                  <Pill>{plan.activeCount} aktif</Pill>
                  <Pill tone="yellow">
                    {formatPriceTR(plan.priceMinor, plan.currency)}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard title={`Üyelikler (${overview.subscriptions.length})`}>
        {overview.subscriptions.length === 0 ? (
          <EmptyState>Henüz üyelik kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {overview.subscriptions.map((subscription) => {
              const isActive = subscription.effectiveStatus === "aktif";
              const expiring =
                isActive &&
                subscription.daysLeft >= 0 &&
                subscription.daysLeft <= 14;
              const outOfCredits =
                isActive && subscription.sessionsRemaining === 0;

              return (
                <li
                  key={subscription.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <Link
                      href={`/personel/uyeler/${subscription.memberId}`}
                      className="text-sm font-semibold text-brand-white transition-colors hover:text-brand-yellow"
                    >
                      {subscription.memberName}
                      <span className="ml-2 text-xs text-brand-muted">
                        {subscription.memberNo}
                      </span>
                    </Link>
                    <div className="mt-1 text-xs text-brand-muted">
                      {subscription.planName} ·{" "}
                      {formatDateTR(subscription.startDate)} –{" "}
                      {formatDateTR(subscription.endDate)}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {subscription.sessionsTotal === null
                        ? "Sınırsız ders"
                        : `${subscription.sessionsUsed}/${subscription.sessionsTotal} ders kullanıldı · ${subscription.sessionsReserved} rezerve · ${subscription.sessionsRemaining} kaldı`}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {isActive && (
                        <form
                          action={changeSubscriptionStatusAction.bind(
                            null,
                            subscription.id,
                            "donduruldu",
                          )}
                        >
                          <button type="submit" className={rowButtonClass}>
                            Dondur
                          </button>
                        </form>
                      )}
                      {subscription.status === "donduruldu" && (
                        <form
                          action={changeSubscriptionStatusAction.bind(
                            null,
                            subscription.id,
                            "aktif",
                          )}
                        >
                          <button type="submit" className={rowButtonClass}>
                            Devam Ettir
                          </button>
                        </form>
                      )}
                      {subscription.status !== "iptal" &&
                        subscription.status !== "bitti" && (
                          <form
                            action={changeSubscriptionStatusAction.bind(
                              null,
                              subscription.id,
                              "iptal",
                            )}
                          >
                            <button type="submit" className={rowButtonClass}>
                              İptal Et
                            </button>
                          </form>
                        )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {expiring && (
                      <Pill tone="danger">{subscription.daysLeft} gün kaldı</Pill>
                    )}
                    {outOfCredits && <Pill tone="danger">Ders bitti</Pill>}
                    <Pill tone={isActive ? "yellow" : "neutral"}>
                      {STATUS_LABEL[subscription.effectiveStatus] ??
                        subscription.effectiveStatus}
                    </Pill>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <PanelCard title="Kayıt Durumu">
        <div className="flex flex-wrap gap-2">
          {breakdown.byStatus.map((row) => (
            <Pill key={row.status}>
              {STATUS_LABEL[row.status] ?? row.status}: {row.count}
            </Pill>
          ))}
          <Pill tone={breakdown.dormant.length > 0 ? "danger" : "neutral"}>
            30 gün sessiz: {breakdown.dormant.length}
          </Pill>
        </div>
      </PanelCard>

      <Scaffold
        mirrors="Kong Academy → Koç / Yönetim → Satışlar"
        summary="Paket, üyelik, yenileme, dondurma ve ders hakkı takibi panelden yönetiliyor. Tahsilat bilinçli olarak uygulamada değil — para salonun kendi yöntemiyle alınıyor, burada yalnız 'üyelik ne kadar var, kaç ders kaldı' tutuluyor."
        features={[
          "Panelden paket tanımlama/düzenleme",
          "Süresi bitene otomatik kapatma (zamanlanmış iş)",
          "Üyelik bitmeden hatırlatma bildirimi",
        ]}
        needs={[
          "Paket oluşturma formu (şu an paketler yalnız seed'den geliyor)",
          "`closeExpiredSubscriptions` fonksiyonunu çağıran cron ya da Vercel Cron uç noktası",
          "E-posta/SMS bildirim kanalı",
        ]}
      />
    </PanelPage>
  );
}
