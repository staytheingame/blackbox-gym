import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { getCoachEarningSummaries, listEarnings } from "@/lib/queries/finance";
import {
  EARNING_SOURCE_LABEL,
  describeCompensation,
  quotaOverage,
  remainingSessionQuota,
} from "@/domain/finance/earnings";
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
import { PayoutForm } from "../PayoutForm";
import { accrueSalariesAction, payCoachAction } from "../actions";

export const metadata: Metadata = { title: "Hakediş — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

/**
 * Antrenör hakedişi: dönemde kim ne kadar hak etti, kaç ders verdi, aylık
 * ders hakkının ne kadarı kaldı, ne kadarı hâlâ ödenmedi.
 *
 * Ödeme yapıldığında kasaya "hakediş" kaleminde gider yazılır — salon parayı
 * çıktığı gün görür, tahakkuk ettiği gün değil.
 */
export default async function AdminEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const [summaries, earnings] = await Promise.all([
    getCoachEarningSummaries(membership.organizationId, period),
    listEarnings(membership.organizationId, {
      from: period.start,
      to: period.end,
    }),
  ]);

  const periodTotal = summaries.reduce((sum, row) => sum + row.totalMinor, 0);
  const outstandingTotal = summaries.reduce(
    (sum, row) => sum + row.outstandingMinor,
    0,
  );
  const sessionsTotal = summaries.reduce((sum, row) => sum + row.sessionsGiven, 0);
  const todayKey = toGymDateKey(new Date());

  return (
    <PanelPage
      title="Hakediş"
      description="Antrenörlerin dönem kazancı. Tutarlar doğdukları anda dondurulur — oranı sonradan değiştirmek geçmiş ayı bozmaz."
      action={
        <div className="flex flex-wrap gap-2">
          <form action={accrueSalariesAction}>
            <button type="submit" className={linkClass}>
              Maaşları İşle
            </button>
          </form>
          <Link href="/yonetim/muhasebe" className={linkClass}>
            ← Kasa
          </Link>
        </div>
      }
    >
      <PeriodNav
        basePath="/yonetim/muhasebe/hakedis"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Dönem Hakedişi" value={formatMinorTR(periodTotal)} />
        <StatCard label="Verilen Ders" value={sessionsTotal} suffix="seans" />
        <StatCard
          label="Ödenmemiş"
          value={formatMinorTR(outstandingTotal)}
          highlight={outstandingTotal > 0}
          hint="Tüm dönemler"
        />
      </div>

      <PanelCard
        title="Antrenörler"
        description="Ödeme, ekranda açık olan dönemin ödenmemiş kalemlerini kapatır."
      >
        {summaries.length === 0 ? (
          <EmptyState>Kadroda antrenör yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {summaries.map((row) => {
              const remaining = remainingSessionQuota(
                row.compensation,
                row.sessionsGiven,
              );
              const overage = quotaOverage(row.compensation, row.sessionsGiven);

              return (
                <li key={row.coachUserId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {row.coachName}
                      </div>
                      <div className="mt-1 text-xs text-brand-muted">
                        {describeCompensation(row.compensation)}
                      </div>
                      <div className="mt-1 text-xs text-brand-muted">
                        {row.sessionsGiven} ders
                        {remaining != null && ` · ${remaining} ders hakkı kaldı`}
                        {row.bySource.ders > 0 &&
                          ` · ders ${formatMinorTR(row.bySource.ders)}`}
                        {row.bySource.gelir_payi > 0 &&
                          ` · pay ${formatMinorTR(row.bySource.gelir_payi)}`}
                        {row.bySource.maas > 0 &&
                          ` · maaş ${formatMinorTR(row.bySource.maas)}`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {overage > 0 && (
                        <Pill tone="danger">{overage} ders hak aşımı</Pill>
                      )}
                      {row.outstandingMinor > 0 && (
                        <Pill tone="danger">
                          {formatMinorTR(row.outstandingMinor)} ödenmedi
                        </Pill>
                      )}
                      <Pill tone="yellow">{formatMinorTR(row.totalMinor)}</Pill>
                    </div>
                  </div>

                  {row.outstandingMinor > 0 && (
                    <PayoutForm
                      coachUserId={row.coachUserId}
                      coachName={row.coachName}
                      amountMinor={row.totalMinor}
                      donem={kind}
                      kayma={offset}
                      todayKey={todayKey}
                      action={payCoachAction}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      <PanelCard title={`Dönem Kalemleri (${earnings.length})`}>
        {earnings.length === 0 ? (
          <EmptyState>
            Bu dönemde hakediş kalemi yok. Ders başı ücret yoklama işaretlenince,
            gelir payı tahsilat girilince doğar.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {earnings.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {row.coachName}
                    <span className="ml-2 text-xs text-brand-muted">
                      {EARNING_SOURCE_LABEL[row.sourceType]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatShortDateTR(row.earnedAt)}
                    {row.memberName ? ` · ${row.memberName}` : ""}
                    {row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={row.status === "odendi" ? "neutral" : "yellow"}>
                    {row.status === "odendi" ? "Ödendi" : "Tahakkuk"}
                  </Pill>
                  <span className="text-sm font-semibold text-brand-white">
                    {formatMinorTR(row.amountMinor, row.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
