"use client";

import { useActionState } from "react";
import { weightClasses } from "@/data/weight-classes";
import {
  addWeightEntryAction,
  setWeightGoalAction,
  type WeightEntryState,
  type WeightGoalState,
} from "./actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const entryInitial: WeightEntryState = {};
const goalInitial: WeightGoalState = {};

export function WeightEntryForm() {
  const [state, formAction, pending] = useActionState(
    addWeightEntryAction,
    entryInitial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="weightKg" className={labelClass}>
            Kilo (kg)
          </label>
          <input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min={30}
            max={250}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="bodyFatPercent" className={labelClass}>
            Vücut yağı % (opsiyonel)
          </label>
          <input
            id="bodyFatPercent"
            name="bodyFatPercent"
            type="number"
            step="0.1"
            min={3}
            max={60}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="note" className={labelClass}>
          Not (opsiyonel)
        </label>
        <input
          id="note"
          name="note"
          maxLength={200}
          placeholder="Sabah aç karnına"
          className={inputClass}
        />
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          Tartı kaydedildi.
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kaydediliyor…" : "Tartıyı Kaydet"}
      </button>
    </form>
  );
}

export function WeightGoalForm({
  defaultTargetKg,
  defaultWeightClass,
  defaultFightDate,
}: {
  defaultTargetKg?: number;
  defaultWeightClass?: string | null;
  /** `YYYY-MM-DD` */
  defaultFightDate?: string;
}) {
  const [state, formAction, pending] = useActionState(
    setWeightGoalAction,
    goalInitial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="targetKg" className={labelClass}>
            Hedef kilo (kg)
          </label>
          <input
            id="targetKg"
            name="targetKg"
            type="number"
            step="0.1"
            min={30}
            max={250}
            required
            defaultValue={defaultTargetKg}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="weightClass" className={labelClass}>
            Sıklet
          </label>
          <select
            id="weightClass"
            name="weightClass"
            defaultValue={defaultWeightClass ?? ""}
            className={inputClass}
          >
            <option value="">Seçilmedi</option>
            {weightClasses.map((weightClass) => (
              <option key={weightClass.slug} value={weightClass.slug}>
                {weightClass.name}
                {weightClass.maxKg ? ` (≤ ${weightClass.maxKg} kg)` : " (üstü açık)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fightDate" className={labelClass}>
            Maç / tartı tarihi
          </label>
          <input
            id="fightDate"
            name="fightDate"
            type="date"
            defaultValue={defaultFightDate}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          Hedef güncellendi.
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kaydediliyor…" : "Hedefi Kaydet"}
      </button>
    </form>
  );
}
