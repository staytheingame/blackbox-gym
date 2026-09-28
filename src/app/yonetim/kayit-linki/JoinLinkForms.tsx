"use client";

import { useActionState } from "react";
import {
  createJoinLinkAction,
  updateJoinLinkAction,
  type JoinLinkFormState,
} from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";
import { JoinLinkBox } from "@/components/panel/JoinLinkBox";

const initialState: JoinLinkFormState = {};

export type CoachChoice = { userId: string; displayName: string };

/** Yeni kayıt bağlantısı — ad dışındaki her alan opsiyonel. */
export function CreateJoinLinkForm({ coaches }: { coaches: CoachChoice[] }) {
  const [state, formAction, pending] = useActionState(
    createJoinLinkAction,
    initialState,
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="label" className={labelClass}>
              Bağlantı adı
            </label>
            <input
              id="label"
              name="label"
              required
              maxLength={60}
              placeholder="Resepsiyon QR"
              className={inputClass}
            />
            <p className={hintClass}>
              Yalnız panelde görünür — hangi kanal olduğunu sen anla.
            </p>
          </div>

          <div>
            <label htmlFor="slug" className={labelClass}>
              Adres eki <span className="font-normal normal-case">(opsiyonel)</span>
            </label>
            <input
              id="slug"
              name="slug"
              maxLength={40}
              placeholder="blackbox-kayit"
              className={inputClass}
            />
            <p className={hintClass}>
              Boş bırakırsan addan üretilir: /katil/resepsiyon-qr
            </p>
          </div>

          <div>
            <label htmlFor="defaultCoachUserId" className={labelClass}>
              Gelenler kime atansın
            </label>
            <select
              id="defaultCoachUserId"
              name="defaultCoachUserId"
              defaultValue=""
              className={inputClass}
            >
              <option value="">Atanmasın (havuzda bekler)</option>
              {coaches.map((coach) => (
                <option key={coach.userId} value={coach.userId}>
                  {coach.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="defaultStatus" className={labelClass}>
              Kayıt durumu
            </label>
            <select
              id="defaultStatus"
              name="defaultStatus"
              defaultValue="active"
              className={inputClass}
            >
              <option value="active">Doğrudan üye (önerilen)</option>
              <option value="lead">Aday</option>
            </select>
            <p className={hintClass}>
              Doğrudan üye: kayıt olan kimse elle onay beklemez, listede üye
              görünür. Ders hakkı paket tanımlanınca açılır. Aday seçersen
              antrenör görüşüp üyeliği başlatır.
            </p>
          </div>

          <div>
            <label htmlFor="maxUses" className={labelClass}>
              Kontenjan <span className="font-normal normal-case">(opsiyonel)</span>
            </label>
            <input
              id="maxUses"
              name="maxUses"
              type="number"
              min={1}
              max={5000}
              placeholder="sınırsız"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="expiresAt" className={labelClass}>
              Son gün <span className="font-normal normal-case">(opsiyonel)</span>
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              className={inputClass}
            />
            <p className={hintClass}>Kampanya linklerinde işe yarar.</p>
          </div>
        </div>

        {state.error && (
          <p className="text-sm font-semibold text-red-400">{state.error}</p>
        )}

        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Üretiliyor…" : "Bağlantıyı Üret"}
        </button>
      </form>

      {state.url && (
        <JoinLinkBox url={state.url} label="Yeni bağlantı hazır" fresh />
      )}
    </div>
  );
}

/** Linkin varsayılanlarını satır içinde değiştirir. */
export function JoinLinkDefaults({
  linkId,
  coaches,
  defaultCoachUserId,
  defaultStatus,
}: {
  linkId: string;
  coaches: CoachChoice[];
  defaultCoachUserId: string | null;
  defaultStatus: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateJoinLinkAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="linkId" value={linkId} />

      <select
        name="defaultCoachUserId"
        defaultValue={defaultCoachUserId ?? ""}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Gelenler kime atansın"
        className="min-h-11 rounded-sm border border-brand-border bg-brand-black px-2 py-1 text-base text-brand-white outline-none focus:border-brand-yellow disabled:opacity-60 sm:min-h-7 sm:text-xs"
      >
        <option value="">Atanmasın</option>
        {coaches.map((coach) => (
          <option key={coach.userId} value={coach.userId}>
            {coach.displayName}
          </option>
        ))}
      </select>

      <select
        name="defaultStatus"
        defaultValue={defaultStatus}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Kayıt durumu"
        className="min-h-11 rounded-sm border border-brand-border bg-brand-black px-2 py-1 text-base text-brand-white outline-none focus:border-brand-yellow disabled:opacity-60 sm:min-h-7 sm:text-xs"
      >
        <option value="lead">Aday</option>
        <option value="active">Üye</option>
      </select>

      {pending && <span className="text-[0.65rem] text-brand-muted">…</span>}
      {state.error && (
        <span className="text-[0.65rem] text-red-400">{state.error}</span>
      )}
    </form>
  );
}
