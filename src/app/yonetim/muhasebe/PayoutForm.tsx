"use client";

import { useActionState } from "react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/domain/finance/ledger";
import { formatMinorTR } from "@/domain/finance/money";
import type { FinanceState } from "./actions";
import { inputClass, labelClass } from "@/components/panel/form";

const initialState: FinanceState = {};

/**
 * Antrenöre dönem hakedişini öder. Ödenecek tutar ekranda açık olan dönemin
 * **ödenmemiş** kalemlerinin toplamıdır; dönem gizli alanlarla taşınır ki
 * "hangi dönemi ödedim" sorusu kayıtta net kalsın.
 */
export function PayoutForm({
  coachUserId,
  coachName,
  amountMinor,
  donem,
  kayma,
  todayKey,
  action,
}: {
  coachUserId: string;
  coachName: string;
  amountMinor: number;
  donem: string;
  kayma: number;
  todayKey: string;
  action: (state: FinanceState, formData: FormData) => Promise<FinanceState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="coachUserId" value={coachUserId} />
      <input type="hidden" name="donem" value={donem} />
      <input type="hidden" name="kayma" value={kayma} />

      <div>
        <label className={labelClass}>Ödeme Tarihi</label>
        <input
          name="paidAt"
          type="date"
          defaultValue={todayKey}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Şekil</label>
        <select name="method" defaultValue="havale" className={inputClass}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABEL[method]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending || amountMinor <= 0}
        className="rounded-sm border border-brand-yellow px-3 py-2 text-[0.65rem] font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black disabled:opacity-40"
        title={`${coachName} — ${formatMinorTR(amountMinor)}`}
      >
        {pending ? "Ödeniyor…" : `${formatMinorTR(amountMinor)} Öde`}
      </button>

      {state.error && (
        <span className="text-[0.7rem] font-semibold text-red-400">
          {state.error}
        </span>
      )}
      {state.success && (
        <span className="text-[0.7rem] font-semibold text-brand-yellow">
          {state.success}
        </span>
      )}
    </form>
  );
}

