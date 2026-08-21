import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import {
  getCoachEarningSummaries,
  getLedgerSummary,
  getLedgerTrend,
} from "@/lib/queries/finance";
import { getMembershipOverview } from "@/lib/queries/memberships";
import {
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  formatMarginRatio,
} from "@/domain/finance/ledger";
import { formatMinorTR, formatSignedMinorTR } from "@/domain/finance/money";
import { recentPeriods } from "@/domain/finance/period";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { PeriodNav, ShareBar, resolvePeriod } from "@/components/panel/PeriodNav";

export const metadata: Metadata = { title: "Kasa — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

/**
 * Salon kasası — gelir, gider, kâr. Dönem seçicisi günlük/haftalık/aylık
 * çalışır; rakamlar salon saat diliminde kesilir (bkz. `domain/finance/period`).
 */
export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);
  const scope = organizationScope(membership.organizationId);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const [summary, trend, coachSummaries, memberships] = await Promise.all([
    getLedgerSummary(membership.organizationId, period),
    getLedgerTrend(membership.organizationId, recentPeriods(kind, 6)),
    getCoachEarningSummaries(membership.organizationId, period),
    getMembershipOverview(scope),
  ]);

  const maxTrend = Math.max(
    ...trend.map((row) =>
      Math.max(row.totals.incomeMinor, row.totals.expenseMinor),
    ),
    1,
  );
  const maxExpense = Math.max(
    ...summary.expensesByCategory.map((row) => row.amountMinor),
    1,
  );
  const activeCoaches = coachSummaries.filter(
    (row) => row.totalMinor > 0 || row.sessionsGiven > 0,
  );

  return (
    <PanelPage
      title="Kasa"
      description="Salonun parası: tahsilat, gider ve kâr. Antrenörler bu ekranı görmez — kendi panellerinde yalnız kendi sporcularının ödemesi ve kendi hakedişi görünür."
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/yonetim/muhasebe/tahsilat" className={linkClass}>
            Tahsilat
          </Link>
          <Link href="/yonetim/muhasebe/giderler" className={linkClass}>
            Giderler
          </Link>
          <Link href="/yonetim/muhasebe/hakedis" className={linkClass}>
            Hakediş
          </Link>
        </div>
      }
    >
      <PeriodNav
        basePath="/yonetim/muhasebe"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gelir"
          value={formatMinorTR(summary.incomeMinor)}
          hint={`${summary.paymentCount} tahsilat`}
        />
        <StatCard label="Gider" value={formatMinorTR(summary.expenseMinor)} />
        <StatCard
          label="Net"
          value={formatSignedMinorTR(summary.netMinor)}
          hint={`kâr marjı ${formatMarginRatio(summary)}`}
          highlight={summary.netMinor < 0}
        />
        <StatCard
          label="Açık Alacak"
          value={formatMinorTR(memberships.unpaidTotalMinor)}
          hint={`${memberships.unpaidCount} üyelikte`}
          highlight={memberships.unpaidCount > 0}
        />
      </div>

      {summary.pendingEarningsMinor > 0 && (
        <PanelCard title="Ödenmemiş Antrenör Hakedişi">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-muted">
              Bu dönemde tahakkuk eden{" "}
              <span className="font-semibold text-brand-white">
                {formatMinorTR(summary.pendingEarningsMinor)}
              </span>{" "}
              henüz ödenmedi. Ödendiğinde gidere yazılır — kasa parayı çıktığı
              gün görür.
            </p>
            <Link href="/yonetim/muhasebe/hakedis" className={linkClass}>
              Hakedişe Git
            </Link>
          </div>
        </PanelCard>
      )}

      <PanelCard
        title="Trend"
        description="Son 6 dönem — üst çubuk gelir, alt çubuk gider."
      >
        <ul className="space-y-4">
          {trend.map((row) => (
            <li key={row.period.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-brand-white">
                  {row.period.shortLabel}
                </span>
                <span className="text-brand-muted">
                  net {formatSignedMinorTR(row.totals.netMinor)}
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                <div className="h-2 rounded-sm bg-brand-surface-2">
                  <div
                    className="h-full rounded-sm bg-brand-yellow"
                    style={{
                      width: `${(row.totals.incomeMinor / maxTrend) * 100}%`,
                    }}
                  />
                </div>
                <div className="h-2 rounded-sm bg-brand-surface-2">
                  <div
                    className="h-full rounded-sm bg-red-400/70"
                    style={{
                      width: `${(row.totals.expenseMinor / maxTrend) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PanelCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="Gider Nereye Gitti">
          {summary.expensesByCategory.length === 0 ? (
            <EmptyState>Bu dönemde gider kaydı yok.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {summary.expensesByCategory.map((row) => (
                <ShareBar
                  key={row.category}
                  label={EXPENSE_CATEGORY_LABEL[row.category]}
                  value={formatMinorTR(row.amountMinor)}
                  max={row.amountMinor / maxExpense}
                />
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Tahsilat Nasıl Alındı">
          {summary.paymentsByMethod.length === 0 ? (
            <EmptyState>Bu dönemde tahsilat yok.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {summary.paymentsByMethod.map((row) => (
                <li
                  key={row.method}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-brand-muted">
                    {PAYMENT_METHOD_LABEL[row.method]}
                  </span>
                  <span className="font-semibold text-brand-white">
                    {formatMinorTR(row.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard
        title="Antrenör Dökümü"
        description="Dönemde verilen ders, hak edilen tutar ve ödenmemiş bakiye."
      >
        {activeCoaches.length === 0 ? (
          <EmptyState>
            Bu dönemde ders verilmemiş ya da hakediş ayarı girilmemiş.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {activeCoaches.map((row) => (
              <li
                key={row.coachUserId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {row.coachName}
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {row.sessionsGiven} ders
                    {row.compensation.monthlySessionQuota != null &&
                      ` / ${row.compensation.monthlySessionQuota} hak`}
                    {row.bySource.gelir_payi > 0 &&
                      ` · pay ${formatMinorTR(row.bySource.gelir_payi)}`}
                    {row.bySource.maas > 0 &&
                      ` · maaş ${formatMinorTR(row.bySource.maas)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {row.outstandingMinor > 0 && (
                    <Pill tone="danger">
                      {formatMinorTR(row.outstandingMinor)} ödenmedi
                    </Pill>
                  )}
                  <Pill tone="yellow">{formatMinorTR(row.totalMinor)}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
