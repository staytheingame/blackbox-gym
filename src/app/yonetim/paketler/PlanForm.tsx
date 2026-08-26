"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createPlanAction,
  updatePlanAction,
  type PlanFormState,
} from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: PlanFormState = {};

export type PlanDefaults = {
  name: string;
  description: string | null;
  priceMinor: number;
  durationDays: number;
  totalSessions: number | null;
  isActive: boolean;
};

export function PlanForm({
  planId,
  defaults,
}: {
  planId?: string;
  defaults?: PlanDefaults;
}) {
  const action = planId ? updatePlanAction.bind(null, planId) : createPlanAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !planId) formRef.current?.reset();
  }, [state.success, planId]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Paket Adı</label>
          <input
            name="name"
            required
            defaultValue={defaults?.name}
            placeholder="Aylık 12 Ders"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Fiyat (₺)</label>
          <input
            name="priceLira"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={
              defaults ? (defaults.priceMinor / 100).toFixed(2) : undefined
            }
            className={inputClass}
          />
          <p className={hintClass}>
            Tahsilat uygulamada tutulmuyor; bu yalnız &quot;paket ne kadar&quot;
            bilgisi.
          </p>
        </div>
        <div>
          <label className={labelClass}>Süre (gün)</label>
          <input
            name="durationDays"
            type="number"
            min={1}
            required
            defaultValue={defaults?.durationDays ?? 30}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Ders Adedi</label>
          <input
            name="totalSessions"
            type="number"
            min={1}
            defaultValue={defaults?.totalSessions ?? ""}
            placeholder="boş = sınırsız"
            className={inputClass}
          />
          <p className={hintClass}>
            Boş bırakırsan paket süre boyunca sınırsız ders verir.
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass}>Açıklama</label>
        <input
          name="description"
          defaultValue={defaults?.description ?? ""}
          placeholder="Haftada 3 ders, grup dersleri dahil"
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-brand-white">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={defaults?.isActive ?? true}
          className="accent-brand-yellow"
        />
        Satışta (antrenör üyelik başlatırken bu paketi görebilir)
      </label>

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
        {pending ? "Kaydediliyor…" : planId ? "Güncelle" : "Paket Ekle"}
      </button>
    </form>
  );
}

