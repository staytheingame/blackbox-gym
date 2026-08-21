import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { listExpenses, listRecurringExpenses } from "@/lib/queries/finance";
import { EXPENSE_CATEGORY_SHORT } from "@/domain/finance/ledger";
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
import { ExpenseForm, RecurringExpenseForm } from "../ExpenseForms";
import {
  applyRecurringExpensesAction,
  deleteExpenseAction,
  recordExpenseAction,
  saveRecurringExpenseAction,
  toggleRecurringExpenseAction,
} from "../actions";

export const metadata: Metadata = { title: "Giderler — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const linkClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";
const rowButton =
  "text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-brand-yellow";

/**
 * Salon maliyeti: tek seferlik giderler + her ay tekrarlayan sabit kalemler.
 * Sabit kalemler "bu ayı işle" düğmesiyle kasaya yazılır; ikinci kez basmak
 * mükerrer kayıt üretmez (`Expense.sourceKey` tekildir).
 */
export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  const { period, kind, offset } = resolvePeriod(await searchParams);

  const [expenses, recurring] = await Promise.all([
    listExpenses(membership.organizationId, {
      from: period.start,
      to: period.end,
    }),
    listRecurringExpenses(membership.organizationId),
  ]);

  const periodTotal = expenses.reduce((sum, row) => sum + row.amountMinor, 0);
  const activeRecurring = recurring.filter((row) => row.isActive);
  const monthlyFixed = activeRecurring.reduce(
    (sum, row) => sum + row.amountMinor,
    0,
  );
  const pendingThisMonth = activeRecurring.filter((row) => !row.appliedThisMonth);

  return (
    <PanelPage
      title="Giderler"
      description="Salonun harcamaları. Sabit kalemler her ay tekrarlar; tek seferlik giderler elle girilir."
      action={
        <Link href="/yonetim/muhasebe" className={linkClass}>
          ← Kasa
        </Link>
      }
    >
      <PeriodNav
        basePath="/yonetim/muhasebe/giderler"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Dönem Gideri" value={formatMinorTR(periodTotal)} />
        <StatCard
          label="Aylık Sabit Maliyet"
          value={formatMinorTR(monthlyFixed)}
          hint={`${activeRecurring.length} kalem`}
        />
        <StatCard
          label="Bu Ay İşlenmemiş"
          value={pendingThisMonth.length}
          suffix="kalem"
          highlight={pendingThisMonth.length > 0}
        />
      </div>

      <PanelCard
        title={`Sabit Giderler (${recurring.length})`}
        description="Kira, fatura, abonelik gibi her ay tekrarlayan kalemler."
        action={
          activeRecurring.length > 0 ? (
            <form action={applyRecurringExpensesAction}>
              <button type="submit" className={linkClass}>
                Bu Ayı İşle
              </button>
            </form>
          ) : null
        }
      >
        {recurring.length === 0 ? (
          <EmptyState>
            Sabit gider tanımlanmadı. Aşağıdan kira ve faturaları ekle.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {recurring.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {row.title}
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {EXPENSE_CATEGORY_SHORT[row.category]} · her ayın{" "}
                    {row.dayOfMonth}. günü
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {row.appliedThisMonth ? (
                    <Pill>Bu ay işlendi</Pill>
                  ) : row.isActive ? (
                    <Pill tone="yellow">Bekliyor</Pill>
                  ) : (
                    <Pill tone="danger">Kapalı</Pill>
                  )}
                  <span className="text-sm font-semibold text-brand-white">
                    {formatMinorTR(row.amountMinor, row.currency)}
                  </span>
                  <form
                    action={toggleRecurringExpenseAction.bind(
                      null,
                      row.id,
                      !row.isActive,
                    )}
                  >
                    <button type="submit" className={rowButton}>
                      {row.isActive ? "Kapat" : "Aç"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-brand-border pt-6">
          <RecurringExpenseForm action={saveRecurringExpenseAction} />
        </div>
      </PanelCard>

      <PanelCard title="Gider Gir">
        <ExpenseForm
          action={recordExpenseAction}
          todayKey={toGymDateKey(new Date())}
        />
      </PanelCard>

      <PanelCard title={`Dönem Kayıtları (${expenses.length})`}>
        {expenses.length === 0 ? (
          <EmptyState>Bu dönemde gider kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {expenses.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {row.title}
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatShortDateTR(row.spentAt)} ·{" "}
                    {EXPENSE_CATEGORY_SHORT[row.category]}
                    {row.note ? ` · ${row.note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-brand-white">
                    {formatMinorTR(row.amountMinor, row.currency)}
                  </span>
                  {row.category === "hakedis" ? (
                    <span
                      className="text-[0.65rem] uppercase tracking-wide text-brand-muted"
                      title="Hakediş ödemesinden doğdu — ödemeyi geri almadan silinemez."
                    >
                      Otomatik
                    </span>
                  ) : (
                    <form action={deleteExpenseAction.bind(null, row.id)}>
                      <button
                        type="submit"
                        className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-red-400"
                      >
                        Sil
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
