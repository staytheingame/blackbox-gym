"use client";

import { useActionState } from "react";
import {
  updatePersonalInfoAction,
  type PersonalInfoState,
} from "./actions";
import type { PersonalInfoView } from "@/lib/queries/member-profile";
import {
  ISTANBUL_DISTRICTS,
  DEFAULT_CITY,
  DEFAULT_STATE,
} from "@/data/istanbul-districts";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  textareaClass,
} from "@/components/panel/form";

const initialState: PersonalInfoState = {};

/**
 * Sporcunun kendi bilgilerini düzenlediği form.
 *
 * Aynı alanlar kayıt formunda da var (`/katil/<slug>`); oradan gelen sporcu
 * burada yalnız değişikliği yapar. Elle eklenmiş eski sporcularda alanlar boş
 * gelir ve üstteki uyarı "şunlar eksik" der — salonun veriyi tek tek telefonla
 * toplaması gerekmesin.
 */
export function PersonalInfoForm({ info }: { info: PersonalInfoView }) {
  const [state, formAction, pending] = useActionState(
    updatePersonalInfoAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {info.missing.length > 0 && !state.success && (
        <p className="rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-3 text-xs leading-relaxed text-brand-white">
          Eksik bilgi: {info.missing.join(", ")}. Doldurursan antrenörün sana
          uygun ders saatlerini ve programı daha iyi ayarlar.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelClass}>
            Ad
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            defaultValue={info.firstName}
            autoComplete="given-name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClass}>
            Soyad
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            defaultValue={info.lastName}
            autoComplete="family-name"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            defaultValue={info.phone}
            autoComplete="tel"
            placeholder="0555 111 22 33"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="birthDate" className={labelClass}>
            Doğum tarihi
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={info.birthDate}
            autoComplete="bday"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="gender" className={labelClass}>
            Cinsiyet
          </label>
          <select
            id="gender"
            name="gender"
            defaultValue={info.gender ?? "belirtmedi"}
            className={inputClass}
          >
            <option value="belirtmedi">Belirtmek istemiyorum</option>
            <option value="kadin">Kadın</option>
            <option value="erkek">Erkek</option>
          </select>
        </div>
        <div>
          <label htmlFor="district" className={labelClass}>
            İlçe
          </label>
          <input
            id="district"
            name="district"
            list="profil-ilceler"
            defaultValue={info.district}
            autoComplete="address-level3"
            placeholder="Kadıköy"
            className={inputClass}
          />
          <datalist id="profil-ilceler">
            {ISTANBUL_DISTRICTS.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="city" className={labelClass}>
            Şehir
          </label>
          <input
            id="city"
            name="city"
            defaultValue={info.city || DEFAULT_CITY}
            autoComplete="address-level2"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="state" className={labelClass}>
            İl / Bölge
          </label>
          <input
            id="state"
            name="state"
            defaultValue={info.state || DEFAULT_STATE}
            autoComplete="address-level1"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="postalCode" className={labelClass}>
            Posta kodu
          </label>
          <input
            id="postalCode"
            name="postalCode"
            inputMode="numeric"
            defaultValue={info.postalCode}
            autoComplete="postal-code"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="emergencyName" className={labelClass}>
            Acil durumda aranacak kişi
          </label>
          <input
            id="emergencyName"
            name="emergencyName"
            defaultValue={info.emergencyName}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="emergencyPhone" className={labelClass}>
            Acil durum telefonu
          </label>
          <input
            id="emergencyPhone"
            name="emergencyPhone"
            type="tel"
            inputMode="tel"
            defaultValue={info.emergencyPhone}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="healthNote" className={labelClass}>
          Sağlık notu
        </label>
        <textarea
          id="healthNote"
          name="healthNote"
          rows={3}
          maxLength={500}
          defaultValue={info.healthNote}
          placeholder="Sakatlık, kronik rahatsızlık, kullandığın ilaç."
          className={textareaClass}
        />
        <p className={hintClass}>Yalnız antrenörün görür.</p>
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
        {pending ? "Kaydediliyor…" : "Bilgilerimi Kaydet"}
      </button>
    </form>
  );
}
