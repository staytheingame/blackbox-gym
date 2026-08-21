"use client";

import { useActionState, useState } from "react";
import {
  startSubscriptionAction,
  type SubscriptionFormState,
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass =
  "text-xs font-bold uppercase tracking-wide text-brand-muted";

const initialState: SubscriptionFormState = {};

export type SubscriptionMember = {
  id: string;
  fullName: string;
  memberNo: string;
};

export type SubscriptionPlanOption = {
  id: string;
  name: string;
  priceLabel: string;
  priceMinor: number;
  durationDays: number;
  totalSessions: number | null;
};

export function SubscriptionForm({
  members,
  plans,
}: {
  members: SubscriptionMember[];
  plans: SubscriptionPlanOption[];
}) {
  const [state, formAction, pending] = useActionState(
    startSubscriptionAction,
    initialState,
  );
  // Anlaşılan tutar paketin etiket fiyatından gelir; indirim yapılırsa
  // antrenör üzerine yazar. Borç = anlaşılan tutar − tahsilat.
  const [planId, setPlanId] = useState("");
  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;

  if (plans.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Satışta paket yok — önce üyelik paketi tanımlanmalı.
      </p>
    );
  }
  if (members.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Kayıtlı sporcu yok — önce Sporcular bölümünden ekle.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sub-member" className={labelClass}>
            Sporcu
          </label>
          <select
            id="sub-member"
            name="memberId"
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
        </div>

        <div>
          <label htmlFor="sub-plan" className={labelClass}>
            Paket
          </label>
          <select
            id="sub-plan"
            name="planId"
            required
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Paket seç…
            </option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ·{" "}
                {plan.totalSessions ? `${plan.totalSessions} ders` : "sınırsız"}{" "}
                · {plan.durationDays} gün · {plan.priceLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="sub-price" className={labelClass}>
            Anlaşılan Tutar (₺)
          </label>
          <input
            id="sub-price"
            name="price"
            inputMode="decimal"
            key={planId || "paket-yok"}
            defaultValue={
              selectedPlan ? String(selectedPlan.priceMinor / 100) : ""
            }
            className={inputClass}
          />
          <p className="mt-1 text-[0.7rem] text-brand-muted">
            İndirim yaptıysan düşür. Borç bu tutardan hesaplanır.
          </p>
        </div>

        <div>
          <label htmlFor="sub-paid" className={labelClass}>
            Şimdi Alınan (₺)
          </label>
          <input
            id="sub-paid"
            name="paid"
            inputMode="decimal"
            placeholder="peşinat ya da tamamı"
            className={inputClass}
          />
          <p className="mt-1 text-[0.7rem] text-brand-muted">
            Boş bırakılırsa tahsilat yazılmaz, borç açık kalır.
          </p>
        </div>

        <div>
          <label htmlFor="sub-method" className={labelClass}>
            Ödeme Şekli
          </label>
          <select
            id="sub-method"
            name="method"
            defaultValue="nakit"
            className={inputClass}
          >
            <option value="nakit">Nakit</option>
            <option value="kart">Kredi/banka kartı</option>
            <option value="havale">Havale/EFT</option>
            <option value="diger">Diğer</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="sub-note" className={labelClass}>
          Not (opsiyonel)
        </label>
        <input
          id="sub-note"
          name="note"
          maxLength={200}
          placeholder="Taksit planı, özel not…"
          className={inputClass}
        />
      </div>

      <p className="text-xs text-brand-muted">
        Sporcunun süresi dolmamış üyeliği varsa yeni dönem onun bittiği günün
        ertesinde başlar — kalan günler yanmaz. Ders adedi paketten kopyalanır.
      </p>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60"
      >
        {pending ? "Kaydediliyor…" : "Aboneliği Başlat / Yenile"}
      </button>
    </form>
  );
}
