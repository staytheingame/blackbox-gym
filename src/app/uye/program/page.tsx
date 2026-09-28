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
import { WeekBoard } from "@/components/panel/WeekBoard";
import {
  buildDays,
  entryHour,
  hourWindow,
  type BoardEntry,
} from "@/components/panel/calendar-grid";
import { dangerButtonClass } from "@/components/panel/form";
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

  // Tek "şimdi" — ızgara ve liste aynı anı kullansın; iki ayrı okuma,
  // sınırdaki bir seansı bir yerde "geçti" bir yerde "geçmedi" gösterirdi.
  // `Date.now()` değil `new Date()`: react-hooks/purity kuralı render içinde
  // `Date.now`ı yasaklıyor.
  const now = new Date().getTime();

  const open = slots.filter((slot) => slot.status === "acik");
  const noCredits = credits !== null && credits.remaining === 0;
  const canBook = Boolean(credits) && !noCredits;

  /** Bu sporcunun o seanstaki kaydı (varsa) — hem ızgara hem liste kullanır. */
  const mineIn = (slot: SlotView) =>
    [...slot.seats, ...slot.pendingSeats].find(
      (seat) => seat.memberId === member.id,
    );

  const entries: BoardEntry[] = open.map((slot) => {
    const mine = mineIn(slot);
    const full = slot.takenSeats >= slot.capacity;
    const past = slot.startsAt.getTime() < now;

    return {
      id: slot.id,
      dateKey: toGymDateKey(slot.startsAt),
      time: formatTimeTR(slot.startsAt),
      hour: entryHour(slot.startsAt),
      label: slot.title ?? SLOT_KIND_LABEL[slot.kind] ?? slot.kind,
      // Rezerve edilmiş hücrede de kontenjan kalsın: grup dersinde "yerim var
      // ama kaç kişiyiz" sorusu rezervasyondan sonra da soruluyor.
      detail: mine
        ? `${BOOKING_STATUS_LABEL[mine.status]} · ${slot.takenSeats}/${slot.capacity}`
        : full
          ? `dolu · ${slot.takenSeats}/${slot.capacity}`
          : `${slot.capacity - slot.takenSeats} boş yer`,
      tone: mine
        ? mine.status === "bekliyor"
          ? "bekliyor"
          : "benim"
        : full
          ? "dolu"
          : "acik",
      action: past ? undefined : mine ? (
        mine.status === "onayli" || mine.status === "bekliyor" ? (
          <form action={cancelBookingAction.bind(null, mine.bookingId)}>
            <button
              type="submit"
              aria-label={`${formatTimeTR(slot.startsAt)} rezervasyonundan vazgeç`}
              className="inline-flex min-h-7 w-full items-center justify-center rounded-sm border border-brand-border px-1 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400 hover:text-red-300"
            >
              Vazgeç
            </button>
          </form>
        ) : undefined
      ) : (
        <BookButton slotId={slot.id} full={full} disabled={!canBook} compact />
      ),
    };
  });

  // Sporcuya boş sabah bantları gösterilmez: pencere ders olan saatlere göre
  // daralır, antrenörün açma ekranındaki geniş pencere burada gereksizdir.
  const hourValues = entries.map((entry) => entry.hour);
  const bounds =
    hourValues.length > 0
      ? { first: Math.min(...hourValues), last: Math.max(...hourValues) }
      : { first: 18, last: 21 };

  const days = buildDays(from);
  const hours = hourWindow(
    open.map((slot) => ({
      hour: entryHour(slot.startsAt),
      time: formatTimeTR(slot.startsAt),
      durationMinutes: slot.durationMinutes,
    })),
    bounds,
  );

  return (
    <PanelPage
      title="Antrenörün Açık Saatleri"
      description="Takvimden istediğin saati doğrudan kapabilirsin. Telefonda üstteki gün şeridinden gün seç. Dolu bir saate katılmak istersen isteğin antrenöre gider; onaylarsa grup dersi olarak katılırsın."
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
              ? `${credits.used} kullanıldı${credits.burned > 0 ? ` (${credits.burned} yanan)` : ""} · ${credits.reserved} rezerve`
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

      <PanelCard
        title="Haftalık Takvim"
        description={
          canBook
            ? "Boş bir saatteki Kap düğmesine bas — yerin anında ayrılır."
            : "Rezervasyon için aktif üyelik gerekiyor."
        }
      >
        {open.length === 0 ? (
          <EmptyState>
            Bu hafta için açılmış saat yok. Sonraki haftaya bakabilirsin.
          </EmptyState>
        ) : (
          <WeekBoard
            days={days}
            hours={hours}
            entries={entries}
            todayKey={toGymDateKey(new Date())}
            legend={[
              { tone: "acik", label: "Boş — kapabilirsin" },
              { tone: "benim", label: "Senin rezervasyonun" },
              { tone: "bekliyor", label: "Onay bekliyor" },
              { tone: "dolu", label: "Dolu — istek gönderebilirsin" },
            ]}
          />
        )}
      </PanelCard>

      {open.length > 0 &&
        dayGroups(open).map((group) => (
          <PanelCard
            key={toGymDateKey(group[0].startsAt)}
            title={formatDayTR(group[0].startsAt)}
            description={`${group.length} seans`}
            className="hidden sm:block"
          >
            <ul className="divide-y divide-brand-border">
              {group.map((slot) => {
                const mine = mineIn(slot);
                const full = slot.takenSeats >= slot.capacity;
                const past = slot.startsAt.getTime() < now;
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
                            tone={
                              mine.status === "bekliyor" ? "neutral" : "yellow"
                            }
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
                                  className={dangerButtonClass}
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
                          disabled={past || !canBook}
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
        ))}
    </PanelPage>
  );
}
