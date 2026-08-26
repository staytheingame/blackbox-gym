import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import {
  SLOT_KIND_LABEL,
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
import {
  CalendarLegend,
  WeekCalendar,
  type CalendarEntry,
} from "@/components/panel/WeekCalendar";
import { dangerButtonClass } from "@/components/panel/form";
import { SlotForm } from "./SlotForm";
import { cancelSlotAction } from "./actions";

export const metadata: Metadata = { title: "Ders Programı — BlackBox Panel" };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayGroups(slots: SlotView[]): { key: string; slots: SlotView[] }[] {
  const groups = new Map<string, SlotView[]>();
  for (const slot of slots) {
    const key = toGymDateKey(slot.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({ key, slots: rows }));
}

/** `?tarih=`/`?saat=` yalnız takvimden gelir; yine de biçim doğrulanır. */
function pickDate(value: string | undefined, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback;
}
function pickTime(value: string | undefined): string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? "") ? value! : "19:00";
}

export default async function StaffProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ hafta?: string; tarih?: string; saat?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);

  const { hafta, tarih, saat } = await searchParams;
  const offset = parseWeekOffset(hafta);

  const thisWeekStart = getWeekStartInstant(new Date());
  const from = new Date(thisWeekStart.getTime() + offset * 7 * MS_PER_DAY);
  const to = new Date(from.getTime() + 7 * MS_PER_DAY);

  const slots = await listSlots(scope, { from, to });

  const open = slots.filter((slot) => slot.status === "acik");
  const freeSeats = open.reduce(
    (sum, slot) => sum + Math.max(slot.capacity - slot.takenSeats, 0),
    0,
  );
  const bookedSeats = open.reduce((sum, slot) => sum + slot.takenSeats, 0);
  const pending = open.reduce((sum, slot) => sum + slot.pendingSeats.length, 0);

  // Takvimden gelen gün/saat formu doldurur; yoksa görüntülenen haftanın başı.
  const defaultDate = pickDate(
    tarih,
    toGymDateKey(
      offset === 0 ? new Date() : new Date(from.getTime() + MS_PER_DAY),
    ),
  );
  const defaultTime = pickTime(saat);

  const entries: CalendarEntry[] = slots.map((slot) => ({
    id: slot.id,
    startsAt: slot.startsAt,
    durationMinutes: slot.durationMinutes,
    label: slot.title ?? SLOT_KIND_LABEL[slot.kind] ?? slot.kind,
    detail:
      slot.status === "iptal"
        ? "iptal"
        : slot.seats.length === 0
          ? `boş · 0/${slot.capacity}`
          : `${slot.seats.map((seat) => seat.memberName.split(" ")[0]).join(", ")} · ${slot.takenSeats}/${slot.capacity}`,
    tone:
      slot.status === "iptal"
        ? "iptal"
        : slot.takenSeats >= slot.capacity
          ? "dolu"
          : "acik",
  }));

  const weekQuery = offset === 0 ? "" : `hafta=${offset}&`;

  return (
    <PanelPage
      title="Açık Saatler & Rezervasyonlar"
      description="Takvimde boş bir hücreye bas, o gün ve saat aşağıdaki formda dolsun. Sporcular aynı takvimden istediği saati kapar; dolu bir saate ikinci kişi katılmak isterse istek İstekler sekmesine düşer."
      action={
        <WeekNav
          basePath="/personel/program"
          offset={offset}
          weekStart={from}
          weekEnd={new Date(to.getTime() - MS_PER_DAY)}
        />
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Açık Seans" value={open.length} hint="Bu hafta" />
        <StatCard label="Dolu Yer" value={bookedSeats} />
        <StatCard
          label="Boş Yer"
          value={freeSeats}
          highlight={freeSeats === 0 && open.length > 0}
        />
        <StatCard
          label="Onay Bekleyen"
          value={pending}
          highlight={pending > 0}
          hint="Grup dersi isteği"
        />
      </div>

      <PanelCard
        title="Haftalık Takvim"
        description="Boş hücredeki + işareti o gün ve saati aşağıdaki forma taşır."
      >
        <WeekCalendar
          weekStart={from}
          entries={entries}
          todayKey={toGymDateKey(new Date())}
          emptyHref={(dateKey, time) =>
            `/personel/program?${weekQuery}tarih=${dateKey}&saat=${time}#saat-ac`
          }
          fallback={
            slots.length === 0 ? (
              <EmptyState>
                Bu hafta için açık saat yok — aşağıdaki formdan ekleyebilirsin.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-brand-border">
                {dayGroups(slots).map((group) => (
                  <li key={group.key} className="py-3 first:pt-0 last:pb-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                      {formatDayTR(group.slots[0].startsAt)}
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {group.slots.map((slot) => (
                        <li key={slot.id} className="text-sm text-brand-white">
                          <span className="tabular-nums font-semibold">
                            {formatTimeTR(slot.startsAt)}
                          </span>
                          <span className="ml-2 text-xs text-brand-muted">
                            {SLOT_KIND_LABEL[slot.kind] ?? slot.kind} ·{" "}
                            {slot.takenSeats}/{slot.capacity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )
          }
        />
        <CalendarLegend
          items={[
            { tone: "acik", label: "Boş yeri var" },
            { tone: "dolu", label: "Kontenjan doldu" },
            { tone: "iptal", label: "İptal" },
          ]}
        />
      </PanelCard>

      <PanelCard
        title="Yeni Saat Aç"
        description="Tek seferlik ya da haftalık tekrarlı. Kontenjan 1 bırakırsan birebir olur."
      >
        <div id="saat-ac" className="scroll-mt-24">
          <SlotForm
            key={`${defaultDate}-${defaultTime}`}
            defaultDate={defaultDate}
            defaultTime={defaultTime}
          />
        </div>
      </PanelCard>

      {slots.length === 0 ? (
        <PanelCard title="Bu Hafta">
          <EmptyState>
            Bu hafta için açık saat yok — yukarıdaki takvimden ya da formdan
            ekleyebilirsin.
          </EmptyState>
        </PanelCard>
      ) : (
        dayGroups(slots).map((group) => (
          <PanelCard
            key={group.key}
            title={formatDayTR(group.slots[0].startsAt)}
            description={`${group.slots.length} seans`}
          >
            <ul className="divide-y divide-brand-border">
              {group.slots.map((slot) => {
                const cancelled = slot.status === "iptal";
                const full = slot.takenSeats >= slot.capacity;

                return (
                  <li key={slot.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                          {slot.seats.length === 0
                            ? "Henüz kimse kapmadı"
                            : slot.seats
                                .map(
                                  (seat) =>
                                    `${seat.memberName} (${BOOKING_STATUS_LABEL[seat.status]})`,
                                )
                                .join(" · ")}
                        </div>
                        {slot.notes && (
                          <p className="mt-1 text-xs italic text-brand-muted">
                            {slot.notes}
                          </p>
                        )}
                        {slot.pendingSeats.length > 0 && (
                          <p className="mt-1 text-xs text-brand-yellow">
                            {slot.pendingSeats.length} katılım isteği onay
                            bekliyor
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {cancelled ? (
                          <Pill tone="danger">İptal</Pill>
                        ) : slot.status === "tamamlandi" ? (
                          <Pill>Tamamlandı</Pill>
                        ) : (
                          <>
                            <Pill tone={full ? "neutral" : "yellow"}>
                              {slot.takenSeats}/{slot.capacity}
                              {slot.capacity > 1 ? " grup" : " birebir"}
                            </Pill>
                            {slot.needsAttendance && (
                              <Pill tone="danger">Yoklama bekliyor</Pill>
                            )}
                            <form action={cancelSlotAction.bind(null, slot.id)}>
                              <button
                                type="submit"
                                className={dangerButtonClass}
                              >
                                İptal Et
                              </button>
                            </form>
                          </>
                        )}
                      </div>
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
