"use client";

import { useActionState } from "react";
import { bookSlotAction, type BookingActionState } from "./actions";

const initialState: BookingActionState = {};

/**
 * Boş saat için "Kap", dolu saat için "Katılmak İstiyorum".
 * İkisi de aynı server action'a gider; boş/dolu kararını sunucu verir —
 * iki kişi aynı anda basarsa ikincisi otomatik olarak grup isteğine döner.
 */
export function BookButton({
  slotId,
  full,
  disabled,
  disabledReason,
}: {
  slotId: string;
  full: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(
    bookSlotAction.bind(null, slotId),
    initialState,
  );

  if (disabled) {
    return (
      <span className="text-xs font-semibold text-brand-muted">
        {disabledReason}
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      {full && (
        <input
          type="text"
          name="note"
          maxLength={200}
          placeholder="Antrenöre not (ops.)"
          className="w-48 rounded-sm border border-brand-border bg-brand-black px-2 py-1 text-xs text-brand-white outline-none focus:border-brand-yellow"
        />
      )}

      <button
        type="submit"
        disabled={pending}
        className={`rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-60 ${
          full
            ? "border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
            : "border-brand-yellow bg-brand-yellow text-brand-black hover:bg-brand-white"
        }`}
      >
        {pending ? "…" : full ? "Katılmak İstiyorum" : "Kap"}
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
