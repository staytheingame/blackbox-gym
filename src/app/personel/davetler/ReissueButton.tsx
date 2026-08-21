"use client";

import { useActionState } from "react";
import { reissueInviteAction, type ReissueState } from "../uyeler/actions";
import { InviteLinkBox } from "@/components/panel/InviteLinkBox";

const initialState: ReissueState = {};

export function ReissueButton({
  memberId,
  memberName,
  label,
}: {
  memberId: string;
  memberName: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    reissueInviteAction.bind(null, memberId),
    initialState,
  );

  return (
    <div className="w-full">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-60"
        >
          {pending ? "Üretiliyor…" : label}
        </button>
      </form>

      {state.error && (
        <p className="mt-2 text-xs font-semibold text-red-400">{state.error}</p>
      )}

      {state.inviteUrl && (
        <div className="mt-3">
          <InviteLinkBox url={state.inviteUrl} memberName={memberName} compact />
        </div>
      )}
    </div>
  );
}
