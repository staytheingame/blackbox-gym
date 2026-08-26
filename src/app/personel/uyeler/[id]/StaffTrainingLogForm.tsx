"use client";

import { useActionState } from "react";
import {
  logTrainingForMemberAction,
  type StaffTrainingLogState,
} from "./actions";
import {
  inputClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: StaffTrainingLogState = {};

const typeLabels: Record<string, string> = {
  boks: "Boks",
  kickbox: "Kickbox",
  fight_prep: "Fight Prep",
  kondisyon: "Kondisyon",
};

export function StaffTrainingLogForm({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(
    logTrainingForMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Tür
          </label>
          <select name="type" required className={inputClass} defaultValue="boks">
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Süre (dakika)
          </label>
          <input
            type="number"
            name="durationMinutes"
            min={5}
            max={300}
            defaultValue={60}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Round (opsiyonel)
          </label>
          <input type="number" name="rounds" min={0} max={50} className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Yoğunluk (RPE 1-10)
          </label>
          <input
            type="number"
            name="intensity"
            min={1}
            max={10}
            defaultValue={6}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
          Not (opsiyonel)
        </label>
        <textarea name="notes" rows={2} maxLength={500} className={inputClass} />
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          Antrenman kaydedildi.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? "Kaydediliyor…" : "Antrenmanı Logla"}
      </button>
    </form>
  );
}

