"use client";

import { useActionState } from "react";
import { updatePlanPriceAction, type PriceFormState } from "./actions";
import { inputClass, primaryButtonClass } from "@/components/panel/form";

const initialState: PriceFormState = {};

export function PriceForm({
  planId,
  priceMinor,
  planName,
}: {
  planId: string;
  priceMinor: number;
  planName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePlanPriceAction.bind(null, planId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label
          htmlFor={`price-${planId}`}
          className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          Fiyat (₺)
        </label>
        <input
          id={`price-${planId}`}
          name="priceLira"
          type="number"
          inputMode="decimal"
          min={0}
          max={1000000}
          step="1"
          required
          defaultValue={priceMinor / 100}
          aria-label={`${planName} fiyatı`}
          className={`${inputClass} w-40`}
        />
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kaydediliyor…" : "Fiyatı Kaydet"}
      </button>
      {state.error && (
        <span className="text-xs font-semibold text-red-400">{state.error}</span>
      )}
      {state.success && (
        <span className="text-xs font-semibold text-brand-yellow">
          {state.success}
        </span>
      )}
    </form>
  );
}
