"use client";

import { useActionState, useMemo, useState } from "react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/domain/finance/ledger";
import { formatMinorTR } from "@/domain/finance/money";
import type { FinanceState } from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: FinanceState = {};

export type PayableMemberView = {
  memberId: string;
  memberName: string;
  memberNo: string;
  coachName: string | null;
  subscriptions: {
    id: string;
    planName: string;
    balanceMinor: number;
    priceMinor: number;
    paidMinor: number;
  }[];
  totalBalanceMinor: number;
};

/**
 * Tahsilat girişi. Sporcu seçilince açık üyelikleri listelenir; birine
 * bağlanan ödeme o üyeliğin borcundan düşer, bağlanmayan serbest gelirdir
 * (ör. eldiven satışı, tek ders).
 *
 * Tutar alanı boş bırakılmaz: seçilen üyeliğin kalan borcu varsayılan gelir.
 */
export function PaymentForm({
  members,
  action,
  todayKey,
}: {
  members: PayableMemberView[];
  action: (
    state: FinanceState,
    formData: FormData,
  ) => Promise<FinanceState>;
  todayKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [memberId, setMemberId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");

  const selected = useMemo(
    () => members.find((row) => row.memberId === memberId) ?? null,
    [members, memberId],
  );

  const selectedSubscription =
    selected?.subscriptions.find((row) => row.id === subscriptionId) ?? null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Sporcu</label>
          <select
            name="memberId"
            required
            value={memberId}
            onChange={(event) => {
              setMemberId(event.target.value);
              setSubscriptionId("");
            }}
            className={inputClass}
          >
            <option value="">Seç…</option>
            {members.map((row) => (
              <option key={row.memberId} value={row.memberId}>
                {row.memberName} ({row.memberNo})
                {row.totalBalanceMinor > 0
                  ? ` — ${formatMinorTR(row.totalBalanceMinor)} borç`
                  : ""}
              </option>
            ))}
          </select>
          {selected?.coachName && (
            <p className={hintClass}>Sorumlu antrenör: {selected.coachName}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Üyelik (opsiyonel)</label>
          <select
            name="subscriptionId"
            value={subscriptionId}
            onChange={(event) => setSubscriptionId(event.target.value)}
            className={inputClass}
            disabled={!selected || selected.subscriptions.length === 0}
          >
            <option value="">Serbest tahsilat</option>
            {selected?.subscriptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.planName} — kalan {formatMinorTR(row.balanceMinor)}
              </option>
            ))}
          </select>
          <p className={hintClass}>
            Üyeliğe bağlanan ödeme o üyeliğin borcundan düşer.
          </p>
        </div>

        <div>
          <label className={labelClass}>Tutar (₺)</label>
          <input
            name="amount"
            required
            inputMode="decimal"
            key={selectedSubscription?.id ?? "serbest"}
            defaultValue={
              selectedSubscription
                ? String(selectedSubscription.balanceMinor / 100)
                : ""
            }
            placeholder="2.500"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Ödeme Şekli</label>
          <select name="method" defaultValue="nakit" className={inputClass}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABEL[method]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Tarih</label>
          <input
            name="paidAt"
            type="date"
            defaultValue={todayKey}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Not (opsiyonel)</label>
          <input name="note" className={inputClass} placeholder="Taksit 1/3" />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClass}
      >
        {pending ? "Kaydediliyor…" : "Tahsilatı Kaydet"}
      </button>
    </form>
  );
}

