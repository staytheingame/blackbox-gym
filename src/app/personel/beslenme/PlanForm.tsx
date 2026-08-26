"use client";

import { useActionState } from "react";
import {
  createPlanAction,
  updatePlanAction,
  type PlanFormState,
} from "./actions";
import {
  DAY_TYPES,
  DAY_TYPE_LABEL,
  NUTRITION_STATUSES,
  NUTRITION_STATUS_LABEL,
  WEEKDAY_SHORT,
  parseWeekDays,
  type DayType,
  type NutritionStatus,
} from "@/domain/nutrition/plan";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: PlanFormState = {};

export type PlanFormMember = {
  id: string;
  fullName: string;
  memberNo: string;
};

export type PlanFormDefaults = {
  memberId: string;
  title: string;
  goal: string | null;
  status: string;
  dayType: string | null;
  weekDaysCsv: string | null;
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
};

/**
 * Plan başlığı formu — hem yeni plan hem düzenleme.
 *
 * Makro alanları BOŞ bırakılabilir; boş "bilinmiyor" demektir, sıfır değil
 * (bkz. `src/domain/nutrition/plan.ts`). Bu yüzden `required` yok ve
 * `placeholder` ile "opsiyonel" olduğu söyleniyor.
 */
export function PlanForm({
  members,
  planId,
  defaults,
}: {
  members: PlanFormMember[];
  planId?: string;
  defaults?: PlanFormDefaults;
}) {
  const action = planId ? updatePlanAction.bind(null, planId) : createPlanAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const selectedDays = parseWeekDays(defaults?.weekDaysCsv);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Sporcu</label>
          <select
            name="memberId"
            required
            defaultValue={defaults?.memberId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Sporcu seç
            </option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} ({member.memberNo})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Plan Adı</label>
          <input
            name="title"
            required
            defaultValue={defaults?.title}
            placeholder="Sıklet düşüş — 4. hafta"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Hedef (opsiyonel)</label>
          <input
            name="goal"
            defaultValue={defaults?.goal ?? ""}
            placeholder="Kas koruyarak 3 kg düşmek"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Durum</label>
          <select
            name="status"
            defaultValue={defaults?.status ?? "taslak"}
            className={inputClass}
          >
            {NUTRITION_STATUSES.map((status: NutritionStatus) => (
              <option key={status} value={status}>
                {NUTRITION_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
          <p className={hintClass}>
            Sporcu yalnız <strong>aktif</strong> planları görür.
          </p>
        </div>

        <div>
          <label className={labelClass}>Gün Türü (opsiyonel)</label>
          <select
            name="dayType"
            defaultValue={defaults?.dayType ?? ""}
            className={inputClass}
          >
            <option value="">Belirtme</option>
            {DAY_TYPES.map((type: DayType) => (
              <option key={type} value={type}>
                {DAY_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
          <p className={hintClass}>
            Antrenman/dinlenme günü için ayrı planlar yazacaksan işaretle.
          </p>
        </div>

        <div>
          <label className={labelClass}>Geçerli Günler</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <label
                key={day}
                className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-brand-border bg-brand-black px-2.5 py-1.5 text-xs text-brand-white has-checked:border-brand-yellow has-checked:text-brand-yellow"
              >
                <input
                  type="checkbox"
                  name="weekDays"
                  value={day}
                  defaultChecked={selectedDays.includes(day)}
                  className="accent-brand-yellow"
                />
                {WEEKDAY_SHORT[day]}
              </label>
            ))}
          </div>
          <p className={hintClass}>Hiçbiri seçilmezse plan her gün geçerli.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Kalori</label>
          <input
            name="dailyCalories"
            type="number"
            min={0}
            defaultValue={defaults?.dailyCalories ?? ""}
            placeholder="opsiyonel"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Protein (g)</label>
          <input
            name="proteinG"
            type="number"
            min={0}
            defaultValue={defaults?.proteinG ?? ""}
            placeholder="opsiyonel"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Karbonhidrat (g)</label>
          <input
            name="carbsG"
            type="number"
            min={0}
            defaultValue={defaults?.carbsG ?? ""}
            placeholder="opsiyonel"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Yağ (g)</label>
          <input
            name="fatG"
            type="number"
            min={0}
            defaultValue={defaults?.fatG ?? ""}
            placeholder="opsiyonel"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Not (opsiyonel)</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          placeholder="Tartıya 3 gün kala tuz azaltılacak, su 4 litre."
          className={inputClass}
        />
      </div>

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
        className={primaryButtonClass}
      >
        {pending ? "Kaydediliyor…" : planId ? "Planı Güncelle" : "Plan Oluştur"}
      </button>
    </form>
  );
}

