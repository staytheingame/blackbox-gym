"use client";

import { useActionState } from "react";
import { InviteLinkBox } from "@/components/panel/InviteLinkBox";
import {
  reissueStaffInviteAction,
  revokeStaffInviteAction,
  type StaffFormState,
} from "./actions";
import { rowButtonClass } from "@/components/panel/form";

const initialState: StaffFormState = {};

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
          <button type="submit" disabled={pending} className={rowButtonClass}>
            {pending ? "Üretiliyor…" : "Yeni Bağlantı Üret"}
          </button>
        </form>
        <form action={revokeStaffInviteAction.bind(null, inviteId)}>
          <button type="submit" className={rowButtonClass}>
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
