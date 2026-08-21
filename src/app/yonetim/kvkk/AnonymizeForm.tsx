"use client";

import { useActionState, useState } from "react";
import { anonymizeMemberAction, type AnonymizeState } from "./actions";

const initial: AnonymizeState = {};

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass = "text-xs font-bold uppercase tracking-wide text-brand-muted";

export type AnonymizableMember = {
  id: string;
  fullName: string;
  memberNo: string;
};

/**
 * Silme talebi formu. Sporcu seçildikten sonra onay kutusuna o sporcunun
 * üye numarası yazılmadan düğme çalışmaz — yanlış kişiyi silmek için
 * iki ayrı hata yapmak gerekir.
 */
export function AnonymizeForm({ members }: { members: AnonymizableMember[] }) {
  const [state, formAction, pending] = useActionState(
    anonymizeMemberAction,
    initial,
  );
  const [selected, setSelected] = useState("");

  const member = members.find((candidate) => candidate.id === selected);

  if (members.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Anonimleştirilebilecek kayıt yok.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="anon-member" className={labelClass}>
          Sporcu
        </label>
        <select
          id="anon-member"
          name="memberId"
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Sporcu seç…
          </option>
          {members.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.fullName} ({candidate.memberNo})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="anon-confirm" className={labelClass}>
          Onay — üye numarasını yaz
        </label>
        <input
          id="anon-confirm"
          name="confirm"
          required
          autoComplete="off"
          placeholder={member ? member.memberNo : "Önce sporcu seç"}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-brand-muted">
          {member
            ? `${member.fullName} için beklenen değer: ${member.memberNo}`
            : "Seçtiğin sporcunun numarası burada görünecek."}
        </p>
      </div>

      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-brand-yellow">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending || !selected}
        className="rounded-sm border border-red-400/60 bg-red-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-200 transition-colors hover:bg-red-400/20 disabled:opacity-50"
      >
        {pending ? "Siliniyor…" : "Kimlik bilgilerini kalıcı olarak sil"}
      </button>
    </form>
  );
}
