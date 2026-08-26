"use client";

import { useActionState, type ReactNode } from "react";
import { checkInAction, type CheckInState } from "./actions";
import { inputClass } from "@/components/panel/form";

const initialState: CheckInState = {};

const scaleOptions = [1, 2, 3, 4, 5];

export function CheckInForm() {
  const [state, formAction, pending] = useActionState(
    checkInAction,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-sm border border-brand-yellow bg-brand-surface p-6 text-sm text-brand-white">
        Check-in gönderildi. Performans kartın güncellendi —{" "}
        <a href="/uye/performans" className="text-brand-yellow hover:underline">
          skorunu gör
        </a>
        .
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planlanan antrenman (bu hafta)">
          <input
            type="number"
            name="plannedSessions"
            min={0}
            max={14}
            defaultValue={4}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Tamamlanan antrenman">
          <input
            type="number"
            name="completedSessions"
            min={0}
            max={14}
            defaultValue={0}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <ScaleField
        name="sleepQuality"
        label="Uyku kalitesi"
        low="Kötü"
        high="Çok iyi"
      />
      <ScaleField
        name="stressLevel"
        label="Stres seviyesi"
        low="Düşük"
        high="Yüksek"
      />
      <ScaleField
        name="energyLevel"
        label="Enerji seviyesi"
        low="Düşük"
        high="Yüksek"
      />
      <ScaleField name="enjoyment" label="Keyif" low="Düşük" high="Yüksek" />

      <label className="flex items-center gap-2 text-sm text-brand-white">
        <input
          type="checkbox"
          name="sorenessFlag"
          className="h-4 w-4 border-brand-border bg-brand-black accent-[#f5c400]"
        />
        Bu hafta ağrı/sakatlık hissettim
      </label>

      <Field label="Not (opsiyonel)">
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          className={inputClass}
        />
      </Field>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60"
      >
        {pending ? "Gönderiliyor…" : "Check-in Gönder"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function ScaleField({
  name,
  label,
  low,
  high,
}: {
  name: string;
  label: string;
  low: string;
  high: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-brand-muted">
        <span>{label}</span>
        <span className="normal-case tracking-normal text-brand-muted">
          {low} → {high}
        </span>
      </div>
      <div className="mt-2 flex gap-3">
        {scaleOptions.map((value) => (
          <label
            key={value}
            className="flex flex-1 flex-col items-center gap-1 rounded-sm border border-brand-border bg-brand-black py-2 text-sm text-brand-white has-[:checked]:border-brand-yellow has-[:checked]:text-brand-yellow"
          >
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={value === 3}
              required
              className="sr-only"
            />
            {value}
          </label>
        ))}
      </div>
    </div>
  );
}
