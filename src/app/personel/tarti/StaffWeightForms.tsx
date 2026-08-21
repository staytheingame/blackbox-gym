"use client";

import { useActionState } from "react";
import { weightClasses } from "@/data/weight-classes";
import {
  addWeightForMemberAction,
  setGoalForMemberAction,
  type StaffWeightEntryState,
  type StaffWeightGoalState,
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass =
  "text-xs font-bold uppercase tracking-wide text-brand-muted";
const buttonClass =
  "rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60";

export type WeighableMember = {
  id: string;
  fullName: string;
  memberNo: string;
};

const entryInitial: StaffWeightEntryState = {};
const goalInitial: StaffWeightGoalState = {};

function MemberSelect({
  id,
  members,
}: {
  id: string;
  members: WeighableMember[];
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Sporcu
      </label>
      <select
        id={id}
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
  );
}

export function StaffWeightEntryForm({
  members,
}: {
  members: WeighableMember[];
}) {
  const [state, formAction, pending] = useActionState(
    addWeightForMemberAction,
    entryInitial,
  );

  if (members.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Kayıtlı sporcu yok — önce Sporcular bölümünden ekle.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MemberSelect id="entry-member" members={members} />

        <div>
          <label htmlFor="staff-weightKg" className={labelClass}>
            Kilo (kg)
          </label>
          <input
            id="staff-weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min={30}
            max={250}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="staff-bodyFat" className={labelClass}>
            Vücut yağı % (ops.)
          </label>
          <input
            id="staff-bodyFat"
            name="bodyFatPercent"
            type="number"
            step="0.1"
            min={3}
            max={60}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="staff-note" className={labelClass}>
          Not (opsiyonel)
        </label>
        <input
          id="staff-note"
          name="note"
          maxLength={200}
          placeholder="Antrenman öncesi salon tartısı"
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

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Kaydediliyor…" : "Tartıyı Kaydet"}
      </button>
    </form>
  );
}

export function StaffWeightGoalForm({
  members,
}: {
  members: WeighableMember[];
}) {
  const [state, formAction, pending] = useActionState(
    setGoalForMemberAction,
    goalInitial,
  );

  if (members.length === 0) return null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MemberSelect id="goal-member" members={members} />

        <div>
          <label htmlFor="staff-targetKg" className={labelClass}>
            Hedef kilo (kg)
          </label>
          <input
            id="staff-targetKg"
            name="targetKg"
            type="number"
            step="0.1"
            min={30}
            max={250}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="staff-weightClass" className={labelClass}>
            Sıklet
          </label>
          <select
            id="staff-weightClass"
            name="weightClass"
            defaultValue=""
            className={inputClass}
          >
            <option value="">Seçilmedi</option>
            {weightClasses.map((weightClass) => (
              <option key={weightClass.slug} value={weightClass.slug}>
                {weightClass.name}
                {weightClass.maxKg
                  ? ` (≤ ${weightClass.maxKg} kg)`
                  : " (üstü açık)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="staff-fightDate" className={labelClass}>
            Maç / tartı tarihi
          </label>
          <input
            id="staff-fightDate"
            name="fightDate"
            type="date"
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Kaydediliyor…" : "Hedefi Kaydet"}
      </button>
    </form>
  );
}
