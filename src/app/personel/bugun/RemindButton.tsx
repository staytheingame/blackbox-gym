"use client";

import { useActionState } from "react";
import {
  remindBookingAction,
  type ReminderActionState,
} from "../program/actions";
import { rowButtonClass } from "@/components/panel/form";

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
        className="inline-flex min-h-11 items-center justify-center rounded-sm border border-dashed border-brand-border px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-muted sm:min-h-7 sm:text-[0.65rem]"
      >
        Hatırlatılamaz
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <button type="submit" disabled={pending} className={rowButtonClass}>
        {pending ? "…" : "Hatırlat"}
      </button>
      {state.success && (
        <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow sm:text-[0.65rem]">
          Gitti
        </span>
      )}
      {state.error && (
        <span className="text-xs font-semibold text-red-400 sm:text-[0.65rem]">
          {state.error}
        </span>
      )}
    </form>
  );
}
