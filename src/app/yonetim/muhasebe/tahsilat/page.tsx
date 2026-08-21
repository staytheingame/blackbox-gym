import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import { listPayableMembers, listPayments } from "@/lib/queries/finance";
import { getMembershipOverview } from "@/lib/queries/memberships";
import { PAYMENT_METHOD_LABEL } from "@/domain/finance/ledger";
import { DUE_STATUS_LABEL, DUE_STATUS_ORDER } from "@/domain/finance/dues";
import { formatMinorTR } from "@/domain/finance/money";
import { formatShortDateTR, toGymDateKey } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { PeriodNav, resolvePeriod } from "@/components/panel/PeriodNav";
import { PaymentForm } from "../PaymentForm";
import { deletePaymentAction, recordPaymentAction } from "../actions";

export const metadata: Metadata = { title: "Tahsilat — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);
  const scope = organizationScope(membership.organizationId);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const [payments, payableMembers, overview] = await Promise.all([
    listPayments(scope, { from: period.start, to: period.end }),
    listPayableMembers(scope),
    getMembershipOverview(scope),
  ]);

  const periodTotal = payments.reduce((sum, row) => sum + row.amountMinor, 0);

  const debtors = overview.subscriptions
    .filter((row) => row.balanceMinor > 0)
    .sort(
      (a, b) =>
        DUE_STATUS_ORDER[a.dueStatus] - DUE_STATUS_ORDER[b.dueStatus] ||
        b.balanceMinor - a.balanceMinor,
    );

  return (
    <PanelPage
      title="Tahsilat"
      description="Sporculardan alınan para. Bir ödeme üyeliğe bağlanırsa o üyeliğin borcundan düşer; bağlanmazsa serbest gelir olarak kasaya girer."
      action={
        <Link href="/yonetim/muhasebe" className={linkClass}>
          ← Kasa
        </Link>
      }
    >
      <PeriodNav
        basePath="/yonetim/muhasebe/tahsilat"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Dönem Tahsilatı" value={formatMinorTR(periodTotal)} />
        <StatCard label="Kayıt" value={payments.length} suffix="adet" />
        <StatCard
          label="Açık Alacak"
          value={formatMinorTR(overview.unpaidTotalMinor)}
          hint={`${overview.unpaidCount} üyelik`}
          highlight={overview.unpaidCount > 0}
        />
      </div>

      <PanelCard title="Tahsilat Gir">
        <PaymentForm
          members={payableMembers}
          action={recordPaymentAction}
          todayKey={toGymDateKey(new Date())}
        />
      </PanelCard>

      <PanelCard
        title={`Borçlular (${debtors.length})`}
        description="Süresi dolduğu hâlde ödenmemiş üyelikler en üstte."
      >
        {debtors.length === 0 ? (
          <EmptyState>Açık borç yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {debtors.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/personel/uyeler/${row.memberId}`}
                    className="text-sm font-semibold text-brand-white transition-colors hover:text-brand-yellow"
                  >
                    {row.memberName}
                  </Link>
                  <div className="mt-1 text-xs text-brand-muted">
                    {row.planName} · {formatMinorTR(row.paidMinor)} /{" "}
                    {formatMinorTR(row.priceMinor)} ödendi · bitiş{" "}
                    {formatShortDateTR(row.endDate)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={row.dueStatus === "gecikti" ? "danger" : "neutral"}>
                    {DUE_STATUS_LABEL[row.dueStatus]}
                  </Pill>
                  <Pill tone="yellow">{formatMinorTR(row.balanceMinor)}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard title={`Dönem Kayıtları (${payments.length})`}>
        {payments.length === 0 ? (
          <EmptyState>Bu dönemde tahsilat kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {payments.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {row.memberName}
                    <span className="ml-2 text-xs text-brand-muted">
                      {row.memberNo}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatShortDateTR(row.paidAt)} ·{" "}
                    {PAYMENT_METHOD_LABEL[row.method]}
                    {row.planName ? ` · ${row.planName}` : " · serbest"}
                    {row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-brand-yellow">
                    {formatMinorTR(row.amountMinor, row.currency)}
                  </span>
                  <form action={deletePaymentAction.bind(null, row.id)}>
                    <button
                      type="submit"
                      className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-red-400"
                    >
                      Sil
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
