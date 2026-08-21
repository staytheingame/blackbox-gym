"use client";

import { useActionState } from "react";
import { runRemindersAction, type RunState } from "./actions";

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
        className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:opacity-60"
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
