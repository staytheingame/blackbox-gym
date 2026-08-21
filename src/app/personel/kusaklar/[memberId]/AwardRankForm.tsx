"use client";

import { useActionState } from "react";
import { awardRankAction, type RankActionState } from "../actions";

const initial: RankActionState = {};

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass = "text-xs font-bold uppercase tracking-wide text-brand-muted";

/**
 * Terfi düğmesi. Koşullar tamamlanmamışsa da terfi verilebilir — antrenör
 * sayacın göremediğini görmüş olabilir; bu durumda ekran uyarır, engellemez.
 */
export function AwardRankForm({
  memberId,
  rankId,
  rankName,
  ready,
}: {
  memberId: string;
  rankId: string;
  rankName: string;
  ready: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    awardRankAction.bind(null, memberId, rankId),
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="award-note" className={labelClass}>
          Terfi notu (opsiyonel)
        </label>
        <input
          id="award-note"
          name="note"
          maxLength={200}
          placeholder="Sınavda jab-cross-hook serisini temiz çıkardı"
          className={inputClass}
        />
      </div>

      {!ready && (
        <p className="rounded-sm border border-brand-border bg-brand-surface-2 px-3 py-2 text-xs text-brand-muted">
          Koşulların hepsi tamamlanmadı. Yine de terfi verebilirsin — karar
          senin, sistem yalnız hatırlatır.
        </p>
      )}

      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-brand-yellow">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60"
      >
        {/* Kuşak adları zaten "… Kuşak" ile bitiyor — etiketi tekrarlama. */}
        {pending ? "Veriliyor…" : `${rankName} ver`}
      </button>
    </form>
  );
}
