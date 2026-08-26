"use client";

import { useActionState, useRef, useEffect } from "react";
import { createMemberAction, type CreateMemberState } from "./actions";
import { InviteLinkBox } from "@/components/panel/InviteLinkBox";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: CreateMemberState = {};

export type CoachChoice = { userId: string; displayName: string };

/**
 * `coaches` yalnız YÖNETİCİYE doldurulur: yönetici sporcuyu hangi antrenöre
 * bağlayacağını seçer. Antrenör eklerken seçim yoktur — sporcu doğrudan
 * ekleyen antrenöre atanır (bkz. `createMemberWithInvite`).
 */
export function AddMemberForm({ coaches = [] }: { coaches?: CoachChoice[] }) {
  const [state, formAction, pending] = useActionState(
    createMemberAction,
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
            <label className={labelClass}>Telefon (opsiyonel)</label>
            <input name="phone" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>E-posta</label>
            <input name="email" type="email" required className={inputClass} />
            <p className="mt-1 text-[0.7rem] text-brand-muted">
              Sporcu bu adresle giriş yapacak.
            </p>
          </div>
          <div>
            <label className={labelClass}>Kayıt Türü</label>
            <select name="status" defaultValue="active" className={inputClass}>
              <option value="active">Üye</option>
              <option value="lead">Aday (deneme dersi)</option>
            </select>
          </div>

          {coaches.length > 0 && (
            <div className="sm:col-span-2">
              <label className={labelClass}>Sorumlu Antrenör</label>
              <select
                name="assignedCoachUserId"
                defaultValue=""
                className={inputClass}
              >
                <option value="">Bana ata (varsayılan)</option>
                {coaches.map((coach) => (
                  <option key={coach.userId} value={coach.userId}>
                    {coach.displayName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.7rem] text-brand-muted">
                Sporcu yalnız sorumlu antrenörünün panelinde görünür.
              </p>
            </div>
          )}
        </div>

        {state.error && (
          <p className="text-sm font-semibold text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={primaryButtonClass}
        >
          {pending ? "Ekleniyor…" : "Ekle ve Davet Bağlantısı Üret"}
        </button>
      </form>

      {state.inviteUrl && (
        <InviteLinkBox
          url={state.inviteUrl}
          memberName={state.memberName ?? "Sporcu"}
        />
      )}
    </div>
  );
}

