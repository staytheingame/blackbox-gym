"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStaffAction, type StaffFormState } from "./actions";

const initialState: StaffFormState = {};

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState(
    createStaffAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Ad Soyad</label>
          <input name="fullName" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>E-posta</label>
          <input name="email" type="email" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Geçici Şifre</label>
          <input
            name="password"
            type="text"
            minLength={8}
            required
            className={inputClass}
          />
          <p className="mt-1 text-[0.7rem] text-brand-muted">
            En az 8 karakter. İlk girişte değiştirmesini söyle.
          </p>
        </div>
        <div>
          <label className={labelClass}>Rol</label>
          <select name="role" defaultValue="coach" className={inputClass}>
            <option value="coach">Antrenör</option>
            <option value="admin">Yönetici</option>
          </select>
          <p className="mt-1 text-[0.7rem] text-brand-muted">
            Yönetici hem bu paneli hem antrenör panelini görür.
          </p>
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:opacity-60"
      >
        {pending ? "Ekleniyor…" : "Hesap Aç"}
      </button>
    </form>
  );
}

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass = "text-xs font-bold uppercase tracking-wide text-brand-muted";
