"use client";

import { useActionState } from "react";
import { copyPlanAction, type CopyPlanState } from "../actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: CopyPlanState = {};

export type CopyTargetMember = {
  id: string;
  fullName: string;
  memberNo: string;
};

/**
 * Planı başka bir sporcuya kopyalar.
 *
 * Beslenme planında "şablon" yok, olması da gerekmiyor: salonda yazılan
 * planların çoğu birbirinin türevi. İyi bir planı kopyalayıp üstünde oynamak,
 * her sporcuya sıfırdan öğün yazmaktan çok daha hızlı.
 */
export function CopyPlanForm({
  planId,
  members,
}: {
  planId: string;
  members: CopyTargetMember[];
}) {
  const [state, formAction, pending] = useActionState(
    copyPlanAction,
    initialState,
  );

  if (members.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Kopyalanacak başka sporcu yok.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="planId" value={planId} />

      <div>
        <label htmlFor="copy-target" className={labelClass}>
          Hangi sporcuya
        </label>
        <select
          id="copy-target"
          name="targetMemberId"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Sporcu seç…
          </option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName} ({member.memberNo})
            </option>
          ))}
        </select>
        <p className={hintClass}>
          Öğünler ve besinlerle birlikte kopyalanır; kopya <b>taslak</b> olur,
          sen yayına alana kadar sporcu görmez.
        </p>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kopyalanıyor…" : "Bu Planı Kopyala"}
      </button>
    </form>
  );
}
