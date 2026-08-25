"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "./actions";

const initialState: AcceptInviteState = {};

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass =
  "text-xs font-bold uppercase tracking-wide text-brand-muted";

export function InviteForm({
  token,
  kind,
  fullName,
  email,
}: {
  token: string;
  /** Hangi tabloya bakılacağını sunucu tarafı bilir; form yalnız taşır. */
  kind: "sporcu" | "personel";
  fullName: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    acceptInviteAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="kind" value={kind} />

      <div>
        <label htmlFor="email" className={labelClass}>
          E-posta
        </label>
        {/* Davetin bağlı olduğu adres değiştirilemez — hesabın kime ait
            olduğunu daveti çıkaran belirledi. */}
        <input
          id="email"
          value={email}
          readOnly
          disabled
          className={`${inputClass} cursor-not-allowed opacity-60`}
        />
      </div>

      <div>
        <label htmlFor="fullName" className={labelClass}>
          Ad Soyad
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          required
          minLength={3}
          autoComplete="name"
          className={inputClass}
        />
        <p className="mt-1 text-[0.7rem] text-brand-muted">
          Panelde bu isimle görüneceksin. Yanlışsa düzelt.
        </p>
      </div>

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
        <p className="mt-1 text-[0.7rem] text-brand-muted">En az 8 karakter.</p>
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

      {state.error && (
        <p className="rounded-sm border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60"
      >
        {pending ? "Hesap kuruluyor…" : "Şifremi Belirle ve Gir"}
      </button>
    </form>
  );
}
