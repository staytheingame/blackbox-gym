"use client";

import { useActionState } from "react";
import {
  remindBookingAction,
  type ReminderActionState,
} from "../program/actions";

const initialState: ReminderActionState = {};

/** Tek sporcuya elden ders hatırlatması — otomatik hatırlatmadan bağımsız. */
export function RemindButton({
  bookingId,
  disabled,
  disabledReason,
}: {
  bookingId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(
    remindBookingAction.bind(null, bookingId),
    initialState,
  );

  if (disabled) {
    return (
      <span
        title={disabledReason}
        className="rounded-sm border border-dashed border-brand-border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted"
      >
        Hatırlatılamaz
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-brand-border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-60"
      >
        {pending ? "…" : "Hatırlat"}
      </button>
      {state.success && (
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-yellow">
          Gitti
        </span>
      )}
      {state.error && (
        <span className="text-[0.65rem] font-semibold text-red-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
