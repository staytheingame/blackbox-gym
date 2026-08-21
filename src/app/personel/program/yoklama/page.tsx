import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import {
  SLOT_KIND_LABEL,
  listSlotsNeedingAttendance,
} from "@/lib/queries/slots";
import { formatDateTimeTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
} from "@/components/panel/ui";
import { closeSlotAction, markAttendanceAction } from "../actions";

export const metadata: Metadata = { title: "Yoklama — BlackBox Panel" };

const buttonClass =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

export default async function StaffAttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const slots = await listSlotsNeedingAttendance(membership.organizationId);

  return (
    <PanelPage
      title="Geçmiş Seans Yoklaması"
      description="Geldi işareti sporcunun antrenman kaydını ve puanını oluşturur; gelmedi işareti ders hakkını yakar ama kayıt üretmez."
    >
      <PanelCard title={`Yoklama Bekleyen (${slots.length})`}>
        {slots.length === 0 ? (
          <EmptyState>
            Bekleyen yoklama yok — geçmiş tüm seanslar işaretlendi.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {slots.map((slot) => {
              const undecided = slot.seats.filter(
                (seat) => seat.status === "onayli",
              );

              return (
                <li key={slot.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-brand-white">
                      {formatDateTimeTR(slot.startsAt)}
                      <span className="ml-2 text-xs font-normal text-brand-muted">
                        {slot.durationMinutes} dk ·{" "}
                        {SLOT_KIND_LABEL[slot.kind] ?? slot.kind}
                        {slot.title ? ` · ${slot.title}` : ""}
                      </span>
                    </div>
                    {undecided.length === 0 && (
                      <form action={closeSlotAction.bind(null, slot.id)}>
                        <button type="submit" className={buttonClass}>
                          Seansı Kapat
                        </button>
                      </form>
                    )}
                  </div>

                  <ul className="mt-3 space-y-2">
                    {slot.seats.map((seat) => (
                      <li
                        key={seat.bookingId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-brand-border bg-brand-surface-2 px-3 py-2"
                      >
                        <Link
                          href={`/personel/uyeler/${seat.memberId}`}
                          className="text-sm text-brand-white transition-colors hover:text-brand-yellow"
                        >
                          {seat.memberName}
                          <span className="ml-2 text-xs text-brand-muted">
                            {seat.memberNo}
                          </span>
                        </Link>

                        <div className="flex flex-wrap items-center gap-2">
                          {seat.status === "katildi" && <Pill tone="yellow">Katıldı</Pill>}
                          {seat.status === "gelmedi" && <Pill tone="danger">Gelmedi</Pill>}
                          <form
                            action={markAttendanceAction.bind(
                              null,
                              seat.bookingId,
                              true,
                            )}
                          >
                            <button
                              type="submit"
                              className="rounded-sm border border-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black"
                            >
                              Geldi
                            </button>
                          </form>
                          <form
                            action={markAttendanceAction.bind(
                              null,
                              seat.bookingId,
                              false,
                            )}
                          >
                            <button
                              type="submit"
                              className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400 hover:text-red-300"
                            >
                              Gelmedi
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
