"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/lib/auth/actions";
import { hintClass, inputClass, labelClass, primaryButtonClass } from "./form";

const initialState: ChangePasswordState = {};

/**
 * Şifre değiştirme — sporcu profilinde ve personel ayarlarında aynı bileşen.
 *
 * Alanlar `autoComplete` ile işaretli: şifre yöneticisi eskiyi tanısın, yeniyi
 * kaydetmeyi teklif etsin. `current-password` / `new-password` ayrımı olmadan
 * tarayıcılar üç alanı da aynı sanıp yanlış değeri dolduruyor.
 */
export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="currentPassword" className={labelClass}>
            Mevcut Şifre
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
          <p className={hintClass}>
            Telefonun başkasının eline geçerse hesabı devralmasın diye soruyoruz.
          </p>
        </div>

        <div>
          <label htmlFor="newPassword" className={labelClass}>
            Yeni Şifre
          </label>
          <input
            id="newPassword"
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
          <label htmlFor="newPasswordAgain" className={labelClass}>
            Yeni Şifre (tekrar)
          </label>
          <input
            id="newPasswordAgain"
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
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Değiştiriliyor…" : "Şifreyi Değiştir"}
      </button>
    </form>
  );
}
