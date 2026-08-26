"use client";

import { useActionState, useState } from "react";
import { signWaiverAction, type SignWaiverState } from "./actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initial: SignWaiverState = {};

/**
 * Onam formu. Metin açık şekilde ekranda durur — "okudum" kutusu metnin
 * altındadır, üstünde değil. Veli alanları yalnız gerektiğinde çıkar:
 * şablon istiyorsa ya da girilen doğum tarihi 18 yaş altını gösteriyorsa.
 */
export function SignWaiverForm({
  templateId,
  title,
  body,
  questions,
  requiresGuardian,
  state: itemState,
}: {
  templateId: string;
  title: string;
  body: string;
  questions: string[];
  requiresGuardian: boolean;
  state: "eksik" | "eski";
}) {
  const [state, formAction, pending] = useActionState(signWaiverAction, initial);
  const [birthDate, setBirthDate] = useState("");
  // `Date.now()` render sırasında çağrılmaz (React purity kuralı) — yaş
  // hesabı yalnız tarih değiştiğinde, olay işleyicisinde yapılır.
  const [minor, setMinor] = useState(false);

  function handleBirthDateChange(value: string): void {
    setBirthDate(value);

    if (!value) {
      setMinor(false);
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setMinor(false);
      return;
    }
    const years = (Date.now() - parsed.getTime()) / (365.25 * 24 * 3600 * 1000);
    setMinor(years < 18);
  }

  const guardianNeeded = requiresGuardian || minor;

  if (state.success) {
    return (
      <p className="rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow">
        {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="templateId" value={templateId} />

      {itemState === "eski" && (
        <p className="rounded-sm border border-brand-border bg-brand-surface-2 px-3 py-2 text-xs text-brand-muted">
          Bu metin güncellendi. Önceki onayın kayıtlarda duruyor; yeni sürümü
          de onaylaman gerekiyor.
        </p>
      )}

      <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-sm border border-brand-border bg-brand-black p-4 text-sm leading-relaxed text-brand-muted">
        {body}
      </div>

      {questions.length > 0 && (
        <fieldset className="space-y-3">
          <legend className={labelClass}>Sağlık soruları</legend>
          {questions.map((question) => (
            <div
              key={question}
              className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-brand-border bg-brand-surface-2 px-3 py-2"
            >
              <span className="text-sm text-brand-white">{question}</span>
              <span className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs text-brand-muted">
                  <input
                    type="radio"
                    name={`soru:${question}`}
                    value="hayir"
                    defaultChecked
                    className="accent-yellow-400"
                  />
                  Hayır
                </label>
                <label className="flex items-center gap-1.5 text-xs text-brand-muted">
                  <input
                    type="radio"
                    name={`soru:${question}`}
                    value="evet"
                    className="accent-yellow-400"
                  />
                  Evet
                </label>
              </span>
            </div>
          ))}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`name-${templateId}`} className={labelClass}>
            Ad soyad
          </label>
          <input
            id={`name-${templateId}`}
            name="signedName"
            required
            maxLength={80}
            placeholder="Adını ve soyadını yaz"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`birth-${templateId}`} className={labelClass}>
            Doğum tarihi
          </label>
          <input
            id={`birth-${templateId}`}
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(event) => handleBirthDateChange(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {guardianNeeded && (
        <div className="grid gap-4 rounded-sm border border-brand-yellow/40 bg-brand-yellow/5 p-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-xs text-brand-yellow">
            {minor
              ? "18 yaşından küçüksün — veli bilgisi zorunlu."
              : "Bu form veli bilgisi istiyor."}
          </p>
          <div>
            <label htmlFor={`guardian-${templateId}`} className={labelClass}>
              Veli adı soyadı
            </label>
            <input
              id={`guardian-${templateId}`}
              name="guardianName"
              required={guardianNeeded}
              maxLength={80}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`guardian-tel-${templateId}`} className={labelClass}>
              Veli telefonu
            </label>
            <input
              id={`guardian-tel-${templateId}`}
              name="guardianPhone"
              required={guardianNeeded}
              maxLength={30}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-brand-white">
        <input
          type="checkbox"
          name="confirmed"
          required
          className="mt-0.5 h-4 w-4 accent-yellow-400"
        />
        <span>
          <strong>{title}</strong> metnini okudum, verdiğim bilgilerin doğru
          olduğunu ve bu onayın elektronik imza yerine geçtiğini kabul ediyorum.
        </span>
      </label>

      {state.error && <p className="text-sm text-red-300">{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Kaydediliyor…" : "Onaylıyorum"}
      </button>
    </form>
  );
}
