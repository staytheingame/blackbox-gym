"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  TONE_CLASS,
  cellKey,
  type BoardDay,
  type BoardEntry,
  type CalendarTone,
} from "@/components/panel/calendar-grid";
import { primaryButtonClass, rowButtonClass } from "@/components/panel/form";

/**
 * HAFTALIK TAKVİM — antrenörün saat açtığı, sporcunun saat kaptığı ekran.
 *
 * Eski `WeekCalendar` yalnız gösteriyordu: boş hücre bir bağlantıydı, tıklayan
 * sayfanın altındaki forma düşüyordu ve **tek tek** saat açıyordu. Yirmi
 * saatlik bir hafta açmak yirmi tur demekti. Dar ekranda ızgara tamamen
 * gizleniyor, sporcu telefonda takvim yerine düz liste görüyordu.
 *
 * Bu bileşen iki sorunu birlikte çözer:
 *
 *  1. ÇOKLU SEÇİM — boş hücrelere dokun, biriktir, bir kere "Aç"a bas. Gün
 *     başlığına dokunmak o günün tüm boş saatlerini, saat etiketine dokunmak
 *     o saati tüm günlerde seçer ("her akşam 19:00" iki dokunuş).
 *  2. MOBİLDE GERÇEK TAKVİM — 7 sütun 375px'e sığmadığı için dar ekranda
 *     **tek gün** sütunu gösterilir, günler üstte şeritten seçilir. Aynı
 *     seçim durumu iki düzende ortaktır: telefonda Pazartesi'yi seçip
 *     Çarşamba'ya geçebilir, seçim kaybolmaz.
 *
 * Konumlandırma SAAT BANDI iledir, dakikaya göre piksel değil: 19:00 ve 19:30
 * aynı hücrede alt alta durur. Dakika hassasiyetli mutlak konum, çakışan
 * seanslarda hücreleri üst üste bindirip dokunma hedeflerini bozuyordu.
 */

export type ComposerState = { error?: string; success?: string };

export type ComposerConfig = {
  /** Seçilen saatleri açan sunucu eylemi. */
  action: (
    state: ComposerState,
    formData: FormData,
  ) => Promise<ComposerState>;
  /** Tür/süre/kontenjan gibi alanlar — sunucuda üretilir, forma girer. */
  fields: ReactNode;
  /** Gizli alanın adı; sunucu eylemi bu adı okur. */
  inputName: string;
  submitLabel: string;
};

export function WeekBoard({
  days,
  hours,
  entries,
  todayKey,
  composer,
  legend,
  emptyText,
}: {
  days: BoardDay[];
  /** ["08:00", "09:00", …] — pencere sunucuda hesaplanır. */
  hours: string[];
  entries: BoardEntry[];
  todayKey?: string;
  /** Verilirse boş hücreler seçilebilir olur (antrenör paneli). */
  composer?: ComposerConfig;
  legend?: { tone: CalendarTone; label: string }[];
  /** Hiç seans yoksa ızgaranın altında görünen açıklama. */
  emptyText?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDay, setActiveDay] = useState<string>(
    todayKey && days.some((day) => day.key === todayKey)
      ? todayKey
      : (days[0]?.key ?? ""),
  );

  const cells = useMemo(() => {
    const map = new Map<string, BoardEntry[]>();
    for (const entry of entries) {
      const key = cellKey(entry.dateKey, entry.hour);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [entries]);

  const selectable = Boolean(composer);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Bir grup hücreyi tek dokunuşla seçer/bırakır (gün ya da saat şeridi). */
  function toggleGroup(keys: string[]) {
    const free = keys.filter((key) => !cells.has(key));
    if (free.length === 0) return;

    setSelected((current) => {
      const next = new Set(current);
      const allSelected = free.every((key) => next.has(key));
      for (const key of free) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  const dayHasEntry = (dateKey: string) =>
    entries.some((entry) => entry.dateKey === dateKey);

  /**
   * Mobil sütunun saatleri. Antrenörde tüm bantlar durur (boş hücreye
   * dokunacak); sporcuda YALNIZ o günün dersleri kalır — tek seans için on üç
   * boş satır kaydırmak telefonu kullanılmaz kılıyordu.
   */
  const mobileHours = selectable
    ? hours
    : hours.filter((hour) => cells.has(cellKey(activeDay, hour)));

  const dayKeysFor = (dateKey: string) =>
    hours.map((hour) => cellKey(dateKey, hour));
  const hourKeysFor = (hour: string) =>
    days.map((day) => cellKey(day.key, hour));

  const selectedCount = selected.size;
  const perDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const key of selected) {
      const dateKey = key.split("|")[0];
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    }
    return counts;
  }, [selected]);

  const grid = (
    <>
      {/* ── Masaüstü: 7 sütun ── */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-brand-border">
            <div />
            {days.map((day) => {
              const isToday = todayKey === day.key;
              const count = perDay.get(day.key) ?? 0;
              const header = (
                <>
                  {day.label}
                  <span className="ml-1 font-normal normal-case">
                    {day.dayNumber}
                  </span>
                  {count > 0 && (
                    <span className="ml-1 rounded-sm bg-brand-yellow px-1 text-[0.6rem] text-brand-black">
                      {count}
                    </span>
                  )}
                </>
              );

              return (
                <div key={day.key} className="px-1 py-1.5 text-center">
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(dayKeysFor(day.key))}
                      title={`${day.label} gününün tüm boş saatlerini seç`}
                      className={`w-full rounded-sm px-1 py-1 text-[0.7rem] font-bold uppercase tracking-wide transition-colors hover:bg-brand-yellow/15 ${
                        isToday ? "text-brand-yellow" : "text-brand-muted"
                      }`}
                    >
                      {header}
                    </button>
                  ) : (
                    <span
                      className={`block px-1 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${
                        isToday ? "text-brand-yellow" : "text-brand-muted"
                      }`}
                    >
                      {header}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-brand-border/60 last:border-b-0"
            >
              {selectable ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(hourKeysFor(hour))}
                  title={`Her gün ${hour} saatini seç`}
                  className="px-1 py-2 text-right text-[0.7rem] tabular-nums text-brand-muted transition-colors hover:text-brand-yellow"
                >
                  {hour}
                </button>
              ) : (
                <div className="px-1.5 py-2 text-right text-[0.7rem] tabular-nums text-brand-muted">
                  {hour}
                </div>
              )}

              {days.map((day) => (
                <Cell
                  key={day.key}
                  dateKey={day.key}
                  hour={hour}
                  entries={cells.get(cellKey(day.key, hour)) ?? []}
                  selectable={selectable}
                  selected={selected.has(cellKey(day.key, hour))}
                  onToggle={toggle}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobil: tek gün sütunu ── */}
      <div className="sm:hidden">
        <div className="flex gap-1 pb-2">
          {days.map((day) => {
            const count = perDay.get(day.key) ?? 0;
            const isActive = day.key === activeDay;
            const hasEntry = dayHasEntry(day.key);

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setActiveDay(day.key)}
                aria-pressed={isActive}
                // Yedi gün 375px'e sığmalı: sabit genişlik yerine eşit pay.
                className={`flex min-h-11 flex-1 flex-col items-center justify-center rounded-sm border px-0.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide transition-colors ${
                  isActive
                    ? "border-brand-yellow bg-brand-yellow text-brand-black"
                    : todayKey === day.key
                      ? "border-brand-yellow/50 text-brand-yellow"
                      : "border-brand-border text-brand-muted"
                }`}
              >
                <span>{day.label}</span>
                <span className="font-normal">{day.dayNumber}</span>
                <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                  {hasEntry && (
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        isActive ? "bg-brand-black" : "bg-brand-yellow"
                      }`}
                    />
                  )}
                  {count > 0 && (
                    <span
                      className={`text-[0.6rem] ${
                        isActive ? "text-brand-black" : "text-brand-yellow"
                      }`}
                    >
                      +{count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Seçim yapılmayan (sporcu) görünümde boş bir günün on üç boş satırını
            kaydırmanın kimseye faydası yok — tek satır daha dürüst. Antrenörde
            satırlar kalır, çünkü dokunacağı yer onlar. */}
        {!selectable && !dayHasEntry(activeDay) ? (
          <p className="border-t border-brand-border py-6 text-center text-xs text-brand-muted">
            Bu gün için açılmış saat yok. Üstteki şeritten başka bir güne bak.
          </p>
        ) : (
          <div className="divide-y divide-brand-border/60 border-t border-brand-border">
            {mobileHours.map((hour) => (
              <div key={hour} className="grid grid-cols-[3.5rem_minmax(0,1fr)]">
                <div className="flex items-center justify-end pr-2 text-xs tabular-nums text-brand-muted">
                  {hour}
                </div>
                <Cell
                  dateKey={activeDay}
                  hour={hour}
                  entries={cells.get(cellKey(activeDay, hour)) ?? []}
                  selectable={selectable}
                  selected={selected.has(cellKey(activeDay, hour))}
                  onToggle={toggle}
                  roomy
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {emptyText && entries.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-brand-muted">
          {emptyText}
        </p>
      )}

      {legend && legend.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {legend.map((item) => (
            <span
              key={item.tone}
              className="flex items-center gap-1.5 text-[0.7rem] text-brand-muted"
            >
              <span
                aria-hidden
                className={`inline-block h-3 w-3 rounded-sm border ${TONE_CLASS[item.tone]}`}
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </>
  );

  if (!composer) return grid;

  return (
    <Composer
      composer={composer}
      selected={selected}
      onClear={() => setSelected(new Set())}
      count={selectedCount}
    >
      {grid}
    </Composer>
  );
}

/**
 * Seçimi saate çeviren form. Alanlar (tür, süre, kontenjan) ızgaranın
 * ÜSTÜNDE durur çünkü bir kez ayarlanır; "Aç" düğmesi ALTTA, çünkü sıra
 * "ayarla → dokun → aç" şeklinde ilerliyor.
 */
function Composer({
  composer,
  selected,
  count,
  onClear,
  children,
}: {
  composer: ComposerConfig;
  selected: Set<string>;
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(composer.action, {});

  // Açılan saatler ızgarada dolu hücre olarak geri döner; seçimi bırakmazsak
  // aynı saatler seçili kalır ve ikinci basışta "zaten açık" hatası alınır.
  useEffect(() => {
    if (state.success) onClear();
    // `onClear` her render'da yeni bir kapanış; bağımlılığa alınırsa döngü olur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <input
        type="hidden"
        name={composer.inputName}
        value={[...selected].join(",")}
      />

      {composer.fields}

      {children}

      <div className="flex flex-wrap items-center gap-3 border-t border-brand-border pt-4">
        <button
          type="submit"
          disabled={pending || count === 0}
          className={primaryButtonClass}
        >
          {pending
            ? "Açılıyor…"
            : count === 0
              ? composer.submitLabel
              : `${composer.submitLabel} (${count})`}
        </button>

        {count > 0 && (
          <button type="button" onClick={onClear} className={rowButtonClass}>
            Seçimi Temizle
          </button>
        )}

        <span className="text-xs text-brand-muted">
          {count === 0
            ? "Takvimde boş bir hücreye dokun — gün başlığı o günün tamamını, saat etiketi o saati tüm günlerde seçer."
            : `${count} saat seçildi.`}
        </span>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}
    </form>
  );
}

function Cell({
  dateKey,
  hour,
  entries,
  selectable,
  selected,
  onToggle,
  roomy = false,
}: {
  dateKey: string;
  hour: string;
  entries: BoardEntry[];
  selectable: boolean;
  selected: boolean;
  onToggle: (key: string) => void;
  /** Mobilde hücre daha yüksek: parmakla dokunuluyor. */
  roomy?: boolean;
}) {
  const wrapper = roomy
    ? "space-y-1 border-l border-brand-border/60 p-1"
    : "space-y-0.5 border-l border-brand-border/60 p-0.5";

  if (entries.length === 0) {
    if (!selectable) {
      return <div className={wrapper}>{<div className={roomy ? "min-h-12" : "min-h-9"} />}</div>;
    }

    return (
      <div className={wrapper}>
        <button
          type="button"
          onClick={() => onToggle(cellKey(dateKey, hour))}
          aria-pressed={selected}
          aria-label={`${dateKey} ${hour} saatini seç`}
          className={`flex w-full items-center justify-center rounded-sm border text-sm leading-none transition-colors ${
            roomy ? "min-h-12" : "min-h-9"
          } ${
            selected
              ? "border-brand-yellow bg-brand-yellow/30 text-brand-yellow"
              : "border-transparent text-brand-border hover:bg-brand-yellow/10 hover:text-brand-yellow"
          }`}
        >
          <span aria-hidden>{selected ? "✓" : "+"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      {entries.map((entry) => (
        <div key={entry.id} className="space-y-0.5">
          <div
            className={`rounded-sm border px-1.5 py-1 ${TONE_CLASS[entry.tone]}`}
          >
            <div className="text-[0.7rem] font-bold tabular-nums leading-tight">
              {entry.time}
            </div>
            <div className={`${roomy ? "" : "truncate"} text-[0.65rem] leading-tight opacity-90`}>
              {entry.label}
            </div>
            {entry.detail && (
              <div className={`${roomy ? "" : "truncate"} text-[0.6rem] leading-tight opacity-70`}>
                {entry.detail}
              </div>
            )}
          </div>
          {entry.action}
        </div>
      ))}
    </div>
  );
}
