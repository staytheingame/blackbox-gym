import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaffScope } from "@/lib/auth/guards";
import { isOrganizationWide } from "@/lib/auth/scope";
import {
  getCoachFinanceView,
  listPayableMembers,
  listPayments,
} from "@/lib/queries/finance";
import {
  describeCompensation,
  quotaOverage,
  remainingSessionQuota,
} from "@/domain/finance/earnings";
import { PAYMENT_METHOD_LABEL } from "@/domain/finance/ledger";
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
import { PaymentForm } from "@/app/yonetim/muhasebe/PaymentForm";
import { recordOwnMemberPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Kasam — BlackBox Panel" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

/**
 * Antrenörün kendi mali ekranı (kullanıcı kararı): **kendi hakedişi + kendi
 * sporcularının ödemeleri**. Salon geneli ciro, gider ve diğer antrenörlerin
 * rakamları burada YOKTUR — onlar `/yonetim/muhasebe` ekranındadır.
 */
export default async function StaffLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const { scope } = await requireStaffScope(user.id);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const [view, payments, payableMembers] = await Promise.all([
    getCoachFinanceView(scope, user.id, period),
    listPayments(scope, { from: period.start, to: period.end, limit: 50 }),
    listPayableMembers(scope),
  ]);

  const earning = view.earning;
  const remaining = earning
    ? remainingSessionQuota(earning.compensation, earning.sessionsGiven)
    : null;
  const overage = earning
    ? quotaOverage(earning.compensation, earning.sessionsGiven)
    : 0;

  return (
    <PanelPage
      title="Kasam"
      description={
        isOrganizationWide(scope)
          ? "Yönetici olarak salonun tamamını görüyorsun. Salon geneli gelir-gider için Kasa ekranını kullan."
          : "Kendi sporcularının ödemeleri ve kendi hakedişin. Salon geneli ciro ve giderler yöneticidedir."
      }
      action={
        isOrganizationWide(scope) ? (
          <Link href="/yonetim/muhasebe" className={linkClass}>
            Salon Kasası →
          </Link>
        ) : null
      }
    >
      <PeriodNav
        basePath="/personel/kasa"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Hakedişim"
          value={formatMinorTR(earning?.totalMinor ?? 0)}
          hint={describeCompensation(earning?.compensation)}
        />
        <StatCard
          label="Verdiğim Ders"
          value={earning?.sessionsGiven ?? 0}
          suffix="seans"
          hint={
            remaining != null
              ? `${remaining} ders hakkı kaldı`
              : "sınırsız ders hakkı"
          }
          highlight={overage > 0}
        />
        <StatCard
          label="Sporcularımdan Tahsilat"
          value={formatMinorTR(view.incomeFromMyMembersMinor)}
          hint={`${view.paymentCount} ödeme`}
        />
        <StatCard
          label="Ödenmemiş Hakedişim"
          value={formatMinorTR(earning?.outstandingMinor ?? 0)}
          highlight={(earning?.outstandingMinor ?? 0) > 0}
          hint="Tüm dönemler"
        />
      </div>

      {earning && earning.totalMinor > 0 && (
        <PanelCard title="Hakediş Kırılımı">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-brand-muted">Ders başı</span>
              <span className="font-semibold text-brand-white">
                {formatMinorTR(earning.bySource.ders)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-brand-muted">Gelir payı</span>
              <span className="font-semibold text-brand-white">
                {formatMinorTR(earning.bySource.gelir_payi)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-brand-muted">Maaş</span>
              <span className="font-semibold text-brand-white">
                {formatMinorTR(earning.bySource.maas)}
              </span>
            </li>
          </ul>
        </PanelCard>
      )}

      <PanelCard
        title={`Borcu Olan Sporcularım (${view.unpaidMembers.length})`}
        description="Üyeliği başladığı hâlde ödemesi tamamlanmamış sporcular."
      >
        {view.unpaidMembers.length === 0 ? (
          <EmptyState>Açık borcu olan sporcun yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {view.unpaidMembers.map((row) => (
              <li
                key={`${row.memberId}-${row.endDate.toISOString()}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Link
                  href={`/personel/uyeler/${row.memberId}`}
                  className="text-sm font-semibold text-brand-white transition-colors hover:text-brand-yellow"
                >
                  {row.memberName}
                  <span className="ml-2 text-xs text-brand-muted">
                    {row.memberNo}
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-brand-muted">
                    bitiş {formatShortDateTR(row.endDate)}
                  </span>
                  <Pill tone="yellow">{formatMinorTR(row.balanceMinor)}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="Tahsilat Gir"
        description="Salonda parayı sen aldıysan buradan kaydet — yalnız kendi sporcuların listelenir."
      >
        <PaymentForm
          members={payableMembers}
          action={recordOwnMemberPaymentAction}
          todayKey={toGymDateKey(new Date())}
        />
      </PanelCard>

      <PanelCard title={`Dönem Tahsilatları (${payments.length})`}>
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
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatShortDateTR(row.paidAt)} ·{" "}
                    {PAYMENT_METHOD_LABEL[row.method]}
                    {row.planName ? ` · ${row.planName}` : ""}
                  </div>
                </div>
                <span className="text-sm font-semibold text-brand-yellow">
                  {formatMinorTR(row.amountMinor, row.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <p className="text-xs text-brand-muted">
        Hakediş tutarları doğdukları anda dondurulur: ders başı ücret yoklamayı
        işaretlediğinde, gelir payı tahsilat girildiğinde yazılır. Ödeme
        yapıldığında yönetici tarafında gider olarak görünür.
      </p>
    </PanelPage>
  );
}
