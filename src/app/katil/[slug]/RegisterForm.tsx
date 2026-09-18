"use client";

import { useActionState } from "react";
import { registerMemberAction, type RegisterState } from "./actions";
import {
  ISTANBUL_DISTRICTS,
  DEFAULT_CITY,
  DEFAULT_COUNTRY,
  DEFAULT_STATE,
} from "@/data/istanbul-districts";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  textareaClass,
} from "@/components/panel/form";

const initialState: RegisterState = {};

/**
 * KAYIT FORMU — tek bağlantıdan gelen sporcu kendini kaydeder.
 *
 * Sıralama işe göre: önce kimlik (ad, iletişim), sonra şifre, sonra "nerede
 * yaşıyor", en sonda salonun seans öncesi bilmesi gerekenler. Zorunlu alan
 * sayısı azdır — telefon ve e-posta dışındaki her zorunlu alan kaydı yarıda
 * bırakan kişi sayısını artırır.
 *
 * Varsayılanlar İstanbul: şehir ve il dolu gelir, gelen kişi yalnız ilçesini
 * seçer. İstanbul dışından biri alanları değiştirebilir.
 */
export function RegisterForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    registerMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />

      <fieldset className="space-y-4">
        <legend className="text-xs font-bold uppercase tracking-[0.15em] text-brand-yellow">
          Kimlik & İletişim
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={labelClass}>
              Ad
            </label>
            <input
              id="firstName"
              name="firstName"
              required
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
              autoComplete="family-name"
              className={inputClass}
            />
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
          <div>
            <label htmlFor="phone" className={labelClass}>
              Telefon
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="0555 111 22 33"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-bold uppercase tracking-[0.15em] text-brand-yellow">
          Şifre
        </legend>

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
            <p className={hintClass}>En az 8 karakter. Kimse görmüyor.</p>
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
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-bold uppercase tracking-[0.15em] text-brand-yellow">
          Seni Tanıyalım
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="birthDate" className={labelClass}>
              Doğum tarihi
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              required
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
              defaultValue="belirtmedi"
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
              required
              list="ilceler"
              autoComplete="address-level3"
              placeholder="Kadıköy"
              className={inputClass}
            />
            <datalist id="ilceler">
              {ISTANBUL_DISTRICTS.map((district) => (
                <option key={district} value={district} />
              ))}
            </datalist>
            <p className={hintClass}>
              Listede yoksa kendin yazabilirsin.
            </p>
          </div>
          <div>
            <label htmlFor="city" className={labelClass}>
              Şehir
            </label>
            <input
              id="city"
              name="city"
              required
              defaultValue={DEFAULT_CITY}
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
              required
              defaultValue={DEFAULT_STATE}
              autoComplete="address-level1"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="postalCode" className={labelClass}>
              Posta kodu <span className="font-normal normal-case">(opsiyonel)</span>
            </label>
            <input
              id="postalCode"
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="34710"
              className={inputClass}
            />
          </div>
        </div>

        <input type="hidden" name="country" value={DEFAULT_COUNTRY} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs font-bold uppercase tracking-[0.15em] text-brand-yellow">
          Güvenlik <span className="font-normal normal-case tracking-normal text-brand-muted">(opsiyonel)</span>
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="emergencyName" className={labelClass}>
              Acil durumda aranacak kişi
            </label>
            <input
              id="emergencyName"
              name="emergencyName"
              maxLength={80}
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
              maxLength={20}
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
            placeholder="Sakatlık, kronik rahatsızlık, kullandığın ilaç — antrenörün bilmesi gerekenler."
            className={textareaClass}
          />
        </div>
      </fieldset>

      <div className="space-y-3 rounded-sm border border-brand-border bg-brand-black/40 p-4">
        <label className="flex items-start gap-3 text-xs leading-relaxed text-brand-muted">
          <input
            type="checkbox"
            name="kvkkConsent"
            required
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand-yellow"
          />
          <span>
            Verilerimin üyelik ve ders takibi için işlenmesini kabul ediyorum.{" "}
            <span className="text-brand-white">Zorunlu.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-xs leading-relaxed text-brand-muted">
          <input
            type="checkbox"
            name="marketingConsent"
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand-yellow"
          />
          <span>
            Kampanya ve duyurular için bana e-posta/mesaj gönderilebilir.
          </span>
        </label>

        <details className="text-[0.7rem] leading-relaxed text-brand-muted">
          <summary className="cursor-pointer text-brand-white">
            Bilgilerim ne için kullanılıyor?
          </summary>
          <p className="mt-2">
            Ad, soyad, e-posta, telefon ve doğum tarihi üyelik kaydı, ders
            rezervasyonu ve hatırlatmalar için; yaşadığın ilçe salonun
            planlaması ve tanıtım çalışmaları için tutulur. Sağlık notu yalnız
            sorumlu antrenörün görür. Verilerinin silinmesini istediğinde
            salona başvurabilirsin — kaydın anonimleştirilir.
          </p>
        </details>
      </div>

      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
        {pending ? "Kaydın açılıyor…" : "Kaydımı Tamamla"}
      </button>
    </form>
  );
}
