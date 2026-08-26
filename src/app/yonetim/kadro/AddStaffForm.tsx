"use client";

import { useActionState, useEffect, useRef } from "react";
import { InviteLinkBox } from "@/components/panel/InviteLinkBox";
import { inviteStaffAction, type StaffFormState } from "./actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: StaffFormState = {};

/**
 * Kadroya davet formu. Şifre alanı bilinçli olarak YOK: antrenör/yönetici
 * şifresini davet bağlantısından kendisi kurar (bkz. `staff-invites.ts`),
 * böylece geçici şifre iki kişinin telefonunda dolaşmaz.
 */
export function AddStaffForm() {
  const [state, formAction, pending] = useActionState(
    inviteStaffAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.inviteUrl) formRef.current?.reset();
  }, [state.inviteUrl]);

  return (
    <div className="space-y-5">
      <form ref={formRef} action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Ad Soyad</label>
            <input name="fullName" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>E-posta</label>
            <input name="email" type="email" required className={inputClass} />
            <p className="mt-1 text-[0.7rem] text-brand-muted">
              Panele bu adresle girecek.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Rol</label>
            <select name="role" defaultValue="coach" className={inputClass}>
              <option value="coach">Antrenör</option>
              <option value="admin">Yönetici</option>
            </select>
            <p className="mt-1 text-[0.7rem] text-brand-muted">
              Antrenör kendi sporcularını ekler, ders açar, antrenman ve
              beslenme planı yazar. Yönetici bunlara ek olarak kadro, paket,
              kasa ve raporları görür.
            </p>
          </div>
        </div>

        {state.error && (
          <p className="text-sm font-semibold text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={primaryButtonClass}
        >
          {pending ? "Davet üretiliyor…" : "Davet Bağlantısı Üret"}
        </button>
      </form>

      {state.inviteUrl && (
        <InviteLinkBox
          url={state.inviteUrl}
          memberName={state.staffName ?? "Personel"}
          kind="personel"
        />
      )}
    </div>
  );
}

