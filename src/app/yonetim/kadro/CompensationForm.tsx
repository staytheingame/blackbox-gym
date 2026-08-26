"use client";

import { useActionState, useState } from "react";
import {
  COMPENSATION_MODEL_LABEL,
  COMPENSATION_MODELS,
  type CompensationModel,
} from "@/domain/finance/earnings";
import { saveCompensationAction, type CompensationState } from "./actions";
import { hintClass, inputClass, labelClass } from "@/components/panel/form";

const initialState: CompensationState = {};

export type CompensationDefaults = {
  coachUserId: string;
  coachName: string;
  model: CompensationModel;
  /** Formda lira olarak gösterilir — boşsa "" . */
  perSession: string;
  revenueShare: string;
  monthlySalary: string;
  monthlyQuota: string;
};

/**
 * Antrenörün hakediş ayarı. Üç kalem birlikte kullanılabilir (`karma`);
 * hangi alanların açık olacağını seçilen model belirler.
 *
 * Ayar **ileriye** işler: geçmiş hakedişler doğdukları andaki tutarla
 * dondurulmuştur, oran değişimi onları bozmaz.
 */
export function CompensationForm({
  defaults,
}: {
  defaults: CompensationDefaults;
}) {
  const [state, formAction, pending] = useActionState(
    saveCompensationAction,
    initialState,
  );
  const [model, setModel] = useState<CompensationModel>(defaults.model);

  const showSession = model === "ders_basi" || model === "karma";
  const showShare = model === "gelir_payi" || model === "karma";
  const showSalary = model === "sabit_maas" || model === "karma";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="coachUserId" value={defaults.coachUserId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Hakediş Modeli</label>
          <select
            name="model"
            value={model}
            onChange={(event) =>
              setModel(event.target.value as CompensationModel)
            }
            className={inputClass}
          >
            {COMPENSATION_MODELS.map((option) => (
              <option key={option} value={option}>
                {COMPENSATION_MODEL_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        {showSession && (
          <div>
            <label className={labelClass}>Ders Başı Ücret (₺)</label>
            <input
              name="perSession"
              defaultValue={defaults.perSession}
              placeholder="250"
              inputMode="decimal"
              className={inputClass}
            />
            <p className={hintClass}>
              Yoklama işaretlenen her seans için — seans başına, katılan kişi
              başına değil.
            </p>
          </div>
        )}

        {showShare && (
          <div>
            <label className={labelClass}>Gelir Payı (%)</label>
            <input
              name="revenueShare"
              defaultValue={defaults.revenueShare}
              placeholder="40"
              inputMode="decimal"
              className={inputClass}
            />
            <p className={hintClass}>
              Sporcusundan tahsilat girildiğinde tutarın yüzdesi yazılır.
            </p>
          </div>
        )}

        {showSalary && (
          <div>
            <label className={labelClass}>Aylık Maaş (₺)</label>
            <input
              name="monthlySalary"
              defaultValue={defaults.monthlySalary}
              placeholder="35000"
              inputMode="decimal"
              className={inputClass}
            />
            <p className={hintClass}>
              Ay kapanışında &quot;Maaşları işle&quot; ile tahakkuk eder.
            </p>
          </div>
        )}

        {model !== "yok" && (
          <div>
            <label className={labelClass}>Aylık Ders Hakkı (adet)</label>
            <input
              name="monthlyQuota"
              defaultValue={defaults.monthlyQuota}
              placeholder="sınırsız"
              inputMode="numeric"
              className={inputClass}
            />
            <p className={hintClass}>
              Sözleşmedeki üst sınır. Boş bırakılırsa sınırsız.
            </p>
          </div>
        )}
      </div>

      {state.error && (
        <p className="text-xs font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-xs font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-brand-yellow px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-black disabled:opacity-60"
      >
        {pending ? "Kaydediliyor…" : "Hakedişi Kaydet"}
      </button>
    </form>
  );
}

