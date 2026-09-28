"use client";

import { useActionState } from "react";
import { updateStaffAction, type StaffFormState } from "./actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: StaffFormState = {};

/** Antrenör/yönetici adı ve giriş e-postası. Yalnız yönetici görür. */
export function EditStaffForm({
  organizationUserId,
  fullName,
  email,
}: {
  organizationUserId: string;
  fullName: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateStaffAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organizationUserId" value={organizationUserId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`staff-name-${organizationUserId}`} className={labelClass}>
            Ad Soyad
          </label>
          <input
            id={`staff-name-${organizationUserId}`}
            name="fullName"
            required
            minLength={2}
            maxLength={80}
            defaultValue={fullName}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`staff-email-${organizationUserId}`} className={labelClass}>
            E-posta (giriş adresi)
          </label>
          <input
            id={`staff-email-${organizationUserId}`}
            name="email"
            type="email"
            required
            defaultValue={email}
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">{state.success}</p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
