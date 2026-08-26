"use client";

import { useActionState } from "react";
import { runRemindersAction, type RunState } from "./actions";
import { primaryButtonClass } from "@/components/panel/form";

const initialState: RunState = {};

export function RunRemindersForm() {
  const [state, formAction, pending] = useActionState(
    runRemindersAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? "Çalışıyor…" : "Hatırlatmaları Şimdi Çalıştır"}
      </button>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}
    </form>
  );
}
