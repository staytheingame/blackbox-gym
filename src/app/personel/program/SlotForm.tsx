"use client";

import { useActionState } from "react";
import { createSlotAction, type SlotFormState } from "./actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: SlotFormState = {};

const KINDS = [
  { value: "boks", label: "Boks" },
  { value: "kickbox", label: "Kickbox" },
  { value: "fight_prep", label: "Fight Prep" },
  { value: "kondisyon", label: "Kondisyon" },
  { value: "teknik", label: "Teknik Çalışma" },
];

/**
 * Takvimdeki boş hücreye basınca sayfa `?tarih=&saat=` ile döner ve buradaki
 * varsayılanlar dolar. Form istemci bileşeni olduğu için çağıran sayfa
 * `key={`${tarih}-${saat}`}` verir — yoksa React alanları yeniden kurmaz ve
 * ikinci tıklamada eski saat ekranda kalır.
 */
export function SlotForm({
  defaultDate,
  defaultTime = "19:00",
}: {
  defaultDate: string;
  defaultTime?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createSlotAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="slot-date" className={labelClass}>
            Tarih
          </label>
          <input
            id="slot-date"
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="slot-time" className={labelClass}>
            Saat
          </label>
          <input
            id="slot-time"
            name="time"
            type="time"
            required
            defaultValue={defaultTime}
            step={900}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="slot-duration" className={labelClass}>
            Süre (dk)
          </label>
          <input
            id="slot-duration"
            name="durationMinutes"
            type="number"
            min={15}
            max={240}
            step={15}
            required
            defaultValue={60}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="slot-kind" className={labelClass}>
            Tür
          </label>
          <select
            id="slot-kind"
            name="kind"
            defaultValue="boks"
            className={inputClass}
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="slot-capacity" className={labelClass}>
            Kontenjan
          </label>
          <input
            id="slot-capacity"
            name="capacity"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={1}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-brand-muted">
            1 = birebir. İkinci kişi isterse onayınla grup olur.
          </p>
        </div>

        <div>
          <label htmlFor="slot-repeat" className={labelClass}>
            Kaç hafta tekrarlansın
          </label>
          <input
            id="slot-repeat"
            name="repeatWeeks"
            type="number"
            min={1}
            max={12}
            required
            defaultValue={1}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-brand-muted">
            1 = tek seferlik. 4 yazarsan aynı saat 4 hafta boyunca açılır.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="slot-title" className={labelClass}>
            Başlık (opsiyonel)
          </label>
          <input
            id="slot-title"
            name="title"
            maxLength={80}
            placeholder="Sabah boks · teknik ağırlıklı"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="slot-notes" className={labelClass}>
          Not (opsiyonel)
        </label>
        <input
          id="slot-notes"
          name="notes"
          maxLength={300}
          placeholder="Eldiven ve bandaj getir"
          className={inputClass}
        />
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? "Açılıyor…" : "Saati Aç"}
      </button>
    </form>
  );
}
