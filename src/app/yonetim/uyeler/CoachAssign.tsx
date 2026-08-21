"use client";

import { useActionState } from "react";
import { assignCoachAction, type AssignCoachState } from "./actions";

const initialState: AssignCoachState = {};

export type CoachOptionView = { userId: string; displayName: string };

/**
 * Satır içi antrenör devri. Seçim değişince kendiliğinden gönderilir —
 * ayrı "kaydet" düğmesi listeyi gürültüye boğuyordu.
 */
export function CoachAssign({
  memberId,
  currentCoachUserId,
  coaches,
}: {
  memberId: string;
  currentCoachUserId: string | null;
  coaches: CoachOptionView[];
}) {
  const [state, formAction, pending] = useActionState(
    assignCoachAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <select
        name="coachUserId"
        defaultValue={currentCoachUserId ?? ""}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-sm border border-brand-border bg-brand-black px-2 py-1 text-xs text-brand-white outline-none focus:border-brand-yellow disabled:opacity-60"
        aria-label="Sorumlu antrenör"
      >
        <option value="">Atanmadı</option>
        {coaches.map((coach) => (
          <option key={coach.userId} value={coach.userId}>
            {coach.displayName}
          </option>
        ))}
      </select>
      {pending && <span className="text-[0.65rem] text-brand-muted">…</span>}
      {state.error && (
        <span className="text-[0.65rem] text-red-400">{state.error}</span>
      )}
    </form>
  );
}
