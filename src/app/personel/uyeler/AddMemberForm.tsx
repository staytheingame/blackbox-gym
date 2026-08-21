"use client";

import { useActionState, useRef, useEffect } from "react";
import { createMemberAction, type CreateMemberState } from "./actions";

const initialState: CreateMemberState = {};

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState(
    createMemberAction,
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
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Ad Soyad
          </label>
          <input name="fullName" required className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Telefon (opsiyonel)
          </label>
          <input name="phone" className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            E-posta
          </label>
          <input name="email" type="email" required className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-brand-muted">
            Geçici Şifre
          </label>
          <input
            name="password"
            type="text"
            minLength={6}
            required
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          Üye oluşturuldu.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:opacity-60"
      >
        {pending ? "Ekleniyor…" : "Üye Ekle"}
      </button>
    </form>
  );
}

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
