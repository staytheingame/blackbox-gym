import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listPendingCheckIns } from "@/lib/queries/staff";
import { formatDateTR } from "@/lib/date";
import { EmptyState, PanelCard, PanelPage, Pill } from "@/components/panel/ui";
import { reviewCheckInAction } from "../actions";
import { rowNameLinkClass } from "@/components/panel/form";

export const metadata: Metadata = {
  title: "Check-in'ler — BlackBox Panel",
};

export default async function StaffCheckInQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);
  const pending = await listPendingCheckIns(scope);

  return (
    <PanelPage
      title="Check-in İnceleme"
      description="Üyelerin gönderdiği, henüz incelenmemiş haftalık check-in'ler."
    >
      <PanelCard title={`Bekleyen (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState>Bekleyen check-in yok — kuyruk temiz.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {pending.map((checkIn) => (
              <li
                key={checkIn.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/personel/uyeler/${checkIn.memberId}`}
                    className={rowNameLinkClass}
                  >
                    {checkIn.memberName}
                  </Link>
                  <span className="ml-2 text-xs text-brand-muted">
                    {checkIn.memberNo}
                  </span>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatDateTR(checkIn.weekStart)} haftası ·{" "}
                    {checkIn.answers.completedSessions}/
                    {checkIn.answers.plannedSessions} antrenman · uyku{" "}
                    {checkIn.answers.sleepQuality}/5 · stres{" "}
                    {checkIn.answers.stressLevel}/5 · enerji{" "}
                    {checkIn.answers.energyLevel}/5
                  </div>
                  {checkIn.answers.note && (
                    <p className="mt-2 max-w-xl text-xs italic text-brand-muted">
                      “{checkIn.answers.note}”
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {checkIn.answers.sorenessFlag && (
                    <Pill tone="danger">Ağrı bildirdi</Pill>
                  )}
                  <form
                    action={reviewCheckInAction.bind(
                      null,
                      checkIn.id,
                      checkIn.memberId,
                    )}
                  >
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black sm:min-h-8"
                    >
                      İncelendi İşaretle
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
