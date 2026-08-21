import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import {
  SLOT_KIND_LABEL,
  getMembershipCredits,
  listSlots,
  type SlotView,
} from "@/lib/queries/slots";
import { BOOKING_STATUS_LABEL } from "@/domain/booking/credits";
import {
  formatDayTR,
  formatTimeTR,
  getWeekStartInstant,
  toGymDateKey,
} from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { WeekNav, parseWeekOffset } from "@/components/panel/WeekNav";
import { BookButton } from "./BookButton";
import { cancelBookingAction } from "./actions";

export const metadata: Metadata = { title: "Boş Saatler — BlackBox Panel" };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayGroups(slots: SlotView[]): SlotView[][] {
  const groups = new Map<string, SlotView[]>();
  for (const slot of slots) {
    const key = toGymDateKey(slot.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, rows]) => rows);
}

export default async function MemberProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ hafta?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const { hafta } = await searchParams;
  const offset = parseWeekOffset(hafta);

  const thisWeekStart = getWeekStartInstant(new Date());
  const from = new Date(thisWeekStart.getTime() + offset * 7 * MS_PER_DAY);
  const to = new Date(from.getTime() + 7 * MS_PER_DAY);

  const [slots, credits] = await Promise.all([
    listSlots(organizationScope(member.organizationId), { from, to }),
    getMembershipCredits(member.id),
  ]);

  const open = slots.filter((slot) => slot.status === "acik");
  const noCredits = credits !== null && credits.remaining === 0;

  return (
    <PanelPage
      title="Antrenörün Açık Saatleri"
      description="Boş bir saati doğrudan kapabilirsin. Dolu bir saate katılmak istersen isteğin antrenöre gider; onaylarsa grup dersi olarak katılırsın."
      action={
        <WeekNav
          basePath="/uye/program"
          offset={offset}
          weekStart={from}
          weekEnd={new Date(to.getTime() - MS_PER_DAY)}
        />
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Üyelik"
          value={credits ? credits.planName : "Yok"}
          hint={credits ? `${credits.daysLeft} gün kaldı` : "Antrenörünle konuş"}
          highlight={!credits}
        />
        <StatCard
          label="Kalan Ders"
          value={
            credits === null
              ? "—"
              : credits.unlimited
                ? "Sınırsız"
                : (credits.remaining ?? 0)
          }
          highlight={noCredits}
          hint={
            credits && !credits.unlimited
              ? `${credits.used} kullanıldı · ${credits.reserved} rezerve`
              : undefined
          }
        />
        <StatCard
          label="Bu Hafta Açık Seans"
          value={open.length}
          hint={`${open.reduce((sum, s) => sum + Math.max(s.capacity - s.takenSeats, 0), 0)} boş yer`}
        />
      </div>

      {!credits && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          Aktif üyeliğin yok, bu yüzden rezervasyon yapamıyorsun. Antrenörünle
          konuş — üyeliğin başlatıldığında bu ekrandan saat kapabilirsin.
        </div>
      )}

      {noCredits && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          Paketindeki dersler bitti. Yeni rezervasyon için üyeliğinin
          yenilenmesi gerekiyor.
        </div>
      )}

      {open.length === 0 ? (
        <PanelCard title="Bu Hafta">
          <EmptyState>
            Bu hafta için açılmış saat yok. Sonraki haftaya bakabilirsin.
          </EmptyState>
        </PanelCard>
      ) : (
        dayGroups(open).map((group) => (
          <PanelCard
            key={toGymDateKey(group[0].startsAt)}
            title={formatDayTR(group[0].startsAt)}
            description={`${group.length} seans`}
          >
            <ul className="divide-y divide-brand-border">
              {group.map((slot) => {
                const mine = [...slot.seats, ...slot.pendingSeats].find(
                  (seat) => seat.memberId === member.id,
                );
                const full = slot.takenSeats >= slot.capacity;
                const past = slot.startsAt.getTime() < Date.now();
                const others = slot.seats
                  .filter((seat) => seat.memberId !== member.id)
                  .map((seat) => seat.memberName);

                return (
                  <li
                    key={slot.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {formatTimeTR(slot.startsAt)}
                        <span className="ml-2 text-xs font-normal text-brand-muted">
                          {slot.durationMinutes} dk ·{" "}
                          {SLOT_KIND_LABEL[slot.kind] ?? slot.kind}
                          {slot.title ? ` · ${slot.title}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-brand-muted">
                        {slot.capacity > 1
                          ? `Grup dersi · ${slot.takenSeats}/${slot.capacity} dolu`
                          : full
                            ? "Birebir · dolu"
                            : "Birebir · boş"}
                        {others.length > 0 && ` · ${others.join(", ")}`}
                      </div>
                      {slot.notes && (
                        <p className="mt-1 text-xs italic text-brand-muted">
                          {slot.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {mine ? (
                        <>
                          <Pill
                            tone={mine.status === "bekliyor" ? "neutral" : "yellow"}
                          >
                            {BOOKING_STATUS_LABEL[mine.status]}
                          </Pill>
                          {!past &&
                            (mine.status === "onayli" ||
                              mine.status === "bekliyor") && (
                              <form
                                action={cancelBookingAction.bind(
                                  null,
                                  mine.bookingId,
                                )}
                              >
                                <button
                                  type="submit"
                                  className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400 hover:text-red-300"
                                >
                                  Vazgeç
                                </button>
                              </form>
                            )}
                        </>
                      ) : (
                        <BookButton
                          slotId={slot.id}
                          full={full}
                          disabled={past || !credits || noCredits}
                          disabledReason={
                            past
                              ? "Bu saat geçti"
                              : !credits
                                ? "Üyelik gerekli"
                                : "Ders hakkın bitti"
                          }
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </PanelCard>
        ))
      )}
    </PanelPage>
  );
}
