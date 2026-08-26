"use client";

import { useActionState } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from "@/domain/finance/ledger";
import type { FinanceState } from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: FinanceState = {};

type Action = (
  state: FinanceState,
  formData: FormData,
) => Promise<FinanceState>;

/** Tek seferlik gider — kira dışı her şey (ekipman, tamir, malzeme). */
export function ExpenseForm({
  action,
  todayKey,
}: {
  action: Action;
  todayKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Gider Adı</label>
          <input
            name="title"
            required
            placeholder="Kum torbası değişimi"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Kategori</label>
          <select name="category" defaultValue="diger" className={inputClass}>
            {EXPENSE_CATEGORIES.filter((c) => c !== "hakedis").map((category) => (
              <option key={category} value={category}>
                {EXPENSE_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
          <p className={hintClass}>
            Antrenör hakedişi elle girilmez — ödeme yapılınca kendiliğinden düşer.
          </p>
        </div>
        <div>
          <label className={labelClass}>Tutar (₺)</label>
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="4.750"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Tarih</label>
          <input
            name="spentAt"
            type="date"
            defaultValue={todayKey}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Not (opsiyonel)</label>
          <input name="note" className={inputClass} />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">{state.success}</p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kaydediliyor…" : "Gideri Kaydet"}
      </button>
    </form>
  );
}

/** Her ay tekrarlayan sabit gider şablonu (kira, elektrik, internet). */
export function RecurringExpenseForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Sabit Gider</label>
          <input
            name="title"
            required
            placeholder="Dükkân kirası"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Kategori</label>
          <select name="category" defaultValue="kira" className={inputClass}>
            {EXPENSE_CATEGORIES.filter((c) => c !== "hakedis").map((category) => (
              <option key={category} value={category}>
                {EXPENSE_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Tutar (₺)</label>
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="45.000"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Ödeme Günü</label>
          <input
            name="dayOfMonth"
            type="number"
            min={1}
            max={28}
            defaultValue={1}
            className={inputClass}
          />
          <p className={hintClass}>1–28 arası (her ayda var olan günler).</p>
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">{state.success}</p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Ekleniyor…" : "Sabit Gider Ekle"}
      </button>
    </form>
  );
}

