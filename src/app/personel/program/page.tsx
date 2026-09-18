import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { SLOT_KIND_LABEL, listSlots, type SlotView } from "@/lib/queries/slots";
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
import {
  dangerButtonClass,
  secondaryButtonClass,
} from "@/components/panel/form";
import { SlotFields } from "./SlotFields";
import { cancelSlotAction, createSlotAction } from "./actions";

export const metadata: Metadata = { title: "Ders Programı — BlackBox Panel" };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Antrenör saat açarken sabahtan geceye tüm bantları görmeli. */
const OPENING_HOURS = { first: 7, last: 23 };

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

export default async function StaffProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ hafta?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);

  const { hafta } = await searchParams;
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
  const attendanceDue = slots.filter((slot) => slot.needsAttendance).length;

  const entries: BoardEntry[] = slots.map((slot) => ({
    id: slot.id,
    dateKey: toGymDateKey(slot.startsAt),
    time: formatTimeTR(slot.startsAt),
    hour: entryHour(slot.startsAt),
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
    // Yanlış açılan saati olduğu yerde kaldırmak için. Bilinçli olarak `<form>`
    // DEĞİL, `formAction` taşıyan bir düğme: ızgara seçim formunun içinde
    // duruyor ve HTML iç içe form kabul etmiyor (hidrasyon hatası verirdi).
    // `formNoValidate` da şart — yoksa tarayıcı seçim formunun zorunlu
    // alanlarını doğrulamaya kalkar ve iptal isteği hiç gitmez.
    // Dolu seansta düğme yok: yanlışlıkla basılıp sporcunun yeri gitmesin,
    // o iptal aşağıdaki listeden bilerek yapılır.
    action:
      slot.status === "acik" && slot.takenSeats === 0 ? (
        <button
          type="submit"
          formAction={cancelSlotAction.bind(null, slot.id)}
          formNoValidate
          aria-label={`${formatTimeTR(slot.startsAt)} seansını kaldır`}
          className="inline-flex min-h-7 w-full items-center justify-center rounded-sm border border-brand-border px-1 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400 hover:text-red-300"
        >
          Kaldır
        </button>
      ) : undefined,
  }));

  const days = buildDays(from);
  const hours = hourWindow(
    slots.map((slot) => ({
      hour: entryHour(slot.startsAt),
      time: formatTimeTR(slot.startsAt),
      durationMinutes: slot.durationMinutes,
    })),
    OPENING_HOURS,
  );

  return (
    <PanelPage
      title="Ders Takvimi"
      description="Boş hücrelere dokun, biriktir, bir kere “Saatleri Aç”a bas — tek tek açmak yok. Gün başlığı o günün tamamını, saat etiketi o saati tüm günlerde seçer. Sporcular aynı takvimden istediği saati kapar."
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

      {attendanceDue > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-4">
          <p className="text-sm text-brand-white">
            {attendanceDue} seansın yoklaması alınmadı — hakediş yoklamadan
            doğuyor.
          </p>
          <Link href="/personel/program/yoklama" className={secondaryButtonClass}>
            Yoklamaya Git
          </Link>
        </div>
      )}

      <PanelCard
        title="Saat Aç"
        description="Ayarları bir kez yap, takvimde istediğin kadar hücreye dokun."
      >
        <WeekBoard
          days={days}
          hours={hours}
          entries={entries}
          todayKey={toGymDateKey(new Date())}
          composer={{
            action: createSlotAction,
            fields: <SlotFields />,
            inputName: "cells",
            submitLabel: "Saatleri Aç",
          }}
          legend={[
            { tone: "acik", label: "Boş yeri var" },
            { tone: "dolu", label: "Kontenjan doldu" },
            { tone: "iptal", label: "İptal" },
          ]}
          emptyText="Bu hafta hiç seans yok — takvimdeki boş hücrelere dokunup açabilirsin."
        />
      </PanelCard>

      {slots.length === 0 ? (
        <PanelCard title="Bu Hafta">
          <EmptyState>
            Bu hafta için açık saat yok — yukarıdaki takvimden açabilirsin.
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
