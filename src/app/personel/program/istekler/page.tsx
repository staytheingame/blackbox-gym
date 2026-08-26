import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { SLOT_KIND_LABEL, listPendingRequests } from "@/lib/queries/slots";
import { formatDateTimeTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
} from "@/components/panel/ui";
import { approveRequestAction, rejectRequestAction } from "../actions";
import { rowNameLinkClass } from "@/components/panel/form";

export const metadata: Metadata = {
  title: "Katılım İstekleri — BlackBox Panel",
};

export default async function StaffRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);

  const requests = await listPendingRequests(scope);

  return (
    <PanelPage
      title="Grup Dersi Katılım İstekleri"
      description="Dolu bir saate ikinci sporcu katılmak istediğinde isteği burada görürsün. Onaylarsan kontenjan bir kişilik büyür ve seans grup dersine döner."
    >
      <PanelCard title={`Bekleyen (${requests.length})`}>
        {requests.length === 0 ? (
          <EmptyState>
            Bekleyen istek yok. Boş saatler doğrudan rezerve edilir — onay
            yalnız dolu saate katılım isteğinde gerekir.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {requests.map((request) => (
              <li
                key={request.bookingId}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/personel/uyeler/${request.memberId}`}
                    className={rowNameLinkClass}
                  >
                    {request.memberName}
                    <span className="ml-2 text-xs text-brand-muted">
                      {request.memberNo}
                    </span>
                  </Link>
                  <div className="mt-1 text-xs text-brand-muted">
                    {formatDateTimeTR(request.startsAt)} ·{" "}
                    {request.durationMinutes} dk ·{" "}
                    {SLOT_KIND_LABEL[request.kind] ?? request.kind}
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    Şu an bu saatte:{" "}
                    {request.currentMembers.length > 0
                      ? request.currentMembers.join(", ")
                      : "kimse yok"}{" "}
                    · kontenjan {request.takenSeats}/{request.capacity}
                  </div>
                  {request.note && (
                    <p className="mt-2 max-w-xl text-xs italic text-brand-muted">
                      “{request.note}”
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="yellow">Onay bekliyor</Pill>
                  <form
                    action={approveRequestAction.bind(null, request.bookingId)}
                  >
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black sm:min-h-8"
                    >
                      Onayla
                    </button>
                  </form>
                  <form
                    action={rejectRequestAction.bind(null, request.bookingId)}
                  >
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400 hover:text-red-300 sm:min-h-8"
                    >
                      Reddet
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
