"use client";

import { useActionState } from "react";
import { updateMemberAction, type ManageFormState } from "./manage-actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: ManageFormState = {};

/** Sporcunun temel bilgileri — ad, telefon, e-posta, durum. */
export function EditMemberForm({
  memberId,
  fullName,
  phone,
  email,
  status,
}: {
  memberId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateMemberAction,
    initialState,
  );
  const safeStatus = ["active", "lead", "inactive"].includes(status)
    ? status
    : "active";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-fullName" className={labelClass}>
            Ad Soyad
          </label>
          <input
            id="edit-fullName"
            name="fullName"
            required
            minLength={2}
            maxLength={80}
            defaultValue={fullName}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="edit-phone" className={labelClass}>
            Telefon
          </label>
          <input
            id="edit-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={20}
            defaultValue={phone ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="edit-email" className={labelClass}>
            E-posta
          </label>
          <input
            id="edit-email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-[0.7rem] text-brand-muted">
            Hesabı varsa giriş adresi de bununla değişir.
          </p>
        </div>
        <div>
          <label htmlFor="edit-status" className={labelClass}>
            Durum
          </label>
          <select
            id="edit-status"
            name="status"
            defaultValue={safeStatus}
            className={inputClass}
          >
            <option value="active">Aktif üye</option>
            <option value="lead">Aday</option>
            <option value="inactive">Pasif</option>
          </select>
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
