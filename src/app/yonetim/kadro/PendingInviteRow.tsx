"use client";

import { useActionState } from "react";
import { InviteLinkBox } from "@/components/panel/InviteLinkBox";
import {
  reissueStaffInviteAction,
  revokeStaffInviteAction,
  type StaffFormState,
} from "./actions";

const initialState: StaffFormState = {};

const rowButton =
  "rounded-sm border border-brand-border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow";

/**
 * Bekleyen davet satırı. Bağlantı yalnız ÜRETİLDİĞİ anda gösterilir —
 * veritabanında açık token durmadığı için (yalnız SHA-256 özeti) eski
 * bağlantı geri getirilemez; kaybolduysa yenisi üretilir, eskisi ölür.
 */
export function PendingInviteRow({
  inviteId,
  fullName,
}: {
  inviteId: string;
  fullName: string;
}) {
  const [state, formAction, pending] = useActionState(
    reissueStaffInviteAction.bind(null, inviteId),
    initialState,
  );

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <button type="submit" disabled={pending} className={rowButton}>
            {pending ? "Üretiliyor…" : "Yeni Bağlantı Üret"}
          </button>
        </form>
        <form action={revokeStaffInviteAction.bind(null, inviteId)}>
          <button type="submit" className={rowButton}>
            Daveti İptal Et
          </button>
        </form>
      </div>

      {state.error && (
        <p className="text-xs font-semibold text-red-400">{state.error}</p>
      )}

      {state.inviteUrl && (
        <InviteLinkBox
          url={state.inviteUrl}
          memberName={state.staffName ?? fullName}
          kind="personel"
          compact
        />
      )}
    </div>
  );
}
