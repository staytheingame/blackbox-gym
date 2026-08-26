"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addFoodAction,
  addMealAction,
  type PlanFormState,
} from "../actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: PlanFormState = {};

export function AddMealForm({ planId }: { planId: string }) {
  const [state, formAction, pending] = useActionState(
    addMealAction.bind(null, planId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Öğün Adı</label>
          <input
            name="title"
            required
            placeholder="Kahvaltı"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Saat / Zaman</label>
          <input
            name="timeLabel"
            placeholder="08:00 ya da antrenman sonrası"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Not</label>
          <input
            name="notes"
            placeholder="Kahve öğünle birlikte"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? "Ekleniyor…" : "Öğün Ekle"}
      </button>
    </form>
  );
}

export function AddFoodForm({
  mealId,
  planId,
}: {
  mealId: string;
  planId: string;
}) {
  const [state, formAction, pending] = useActionState(
    addFoodAction.bind(null, mealId, planId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass}>Besin</label>
          <input
            name="name"
            required
            placeholder="Yulaf ezmesi"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Miktar</label>
          <input
            name="amount"
            placeholder="80 g"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Alternatif</label>
          <input
            name="alternatives"
            placeholder="Yulaf yoksa 1 dilim tam buğday ekmeği"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Kalori</label>
          <input
            name="calories"
            type="number"
            min={0}
            placeholder="ops."
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Protein</label>
          <input
            name="proteinG"
            type="number"
            min={0}
            step="0.1"
            placeholder="ops."
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Karbonhidrat</label>
          <input
            name="carbsG"
            type="number"
            min={0}
            step="0.1"
            placeholder="ops."
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Yağ</label>
          <input
            name="fatG"
            type="number"
            min={0}
            step="0.1"
            placeholder="ops."
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-60 sm:min-h-8"
      >
        {pending ? "Ekleniyor…" : "Besin Ekle"}
      </button>
    </form>
  );
}
