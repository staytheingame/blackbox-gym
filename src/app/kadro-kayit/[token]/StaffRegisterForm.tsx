"use client";

import { useActionState } from "react";
import { registerStaffAction, type StaffRegisterState } from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: StaffRegisterState = {};

export function StaffRegisterForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    registerStaffAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="fullName" className={labelClass}>
          Ad Soyad
        </label>
        <input
          id="fullName"
          name="fullName"
          required
          minLength={3}
          autoComplete="name"
          className={inputClass}
        />
        <p className={hintClass}>
          Sporcular seni bu isimle görür — tam adını yaz.
        </p>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className={inputClass}
        />
        <p className={hintClass}>Panele bu adresle gireceksin.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className={labelClass}>
            Şifre
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
          <p className={hintClass}>En az 8 karakter.</p>
        </div>
        <div>
          <label htmlFor="passwordAgain" className={labelClass}>
            Şifre (tekrar)
          </label>
          <input
            id="passwordAgain"
            name="passwordAgain"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
        {pending ? "Hesabın açılıyor…" : "Antrenör Hesabımı Aç"}
      </button>
    </form>
  );
}
