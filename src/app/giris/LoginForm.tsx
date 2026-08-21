"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow"
        />
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60"
      >
        {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
      </button>
    </form>
  );
}
