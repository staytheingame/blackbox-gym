"use client";

import { useRef, useState, useTransition } from "react";
import { submitStartLeadAction } from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/panel/form";
import { START_QUESTIONS, type StartQuestionKey } from "@/domain/funnel/start";

const TOTAL_QUESTIONS = 8;
/** 0–4 tek seçimli (otomatik ilerler), 5 çoklu, 6 meslek+yoğunluk, 7 zaman+gün, 8 son adım. */
const LAST_STEP = 8;
const AUTO_ADVANCE_MS = 250;

const SINGLE_STEPS: Record<number, StartQuestionKey> = {
  0: "goal",
  1: "pain",
  2: "barrier",
  3: "history",
  4: "turnoff",
};

const choiceClass =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-brand-border bg-brand-black/40 px-4 py-3 text-sm text-brand-white transition-colors has-[:checked]:border-brand-yellow has-[:checked]:bg-brand-yellow/10";
const legendClass =
  "font-display text-xl uppercase leading-tight tracking-wide text-brand-white";

/**
 * "SANA UYGUN BAŞLANGICI BULALIM" — ekranda tek soru. Tek seçimli ilk beş soruda
 * seçimden kısa süre sonra kendiliğinden ilerler (parmakla tek dokunuş); çoklu
 * seçimli ve alanlı adımlarda "Devam" düğmesi var.
 *
 * Form `action=` yerine `onSubmit` ile gönderilir: React 19 `action` bitince
 * kontrolsüz alanları SIFIRLAR — hata durumunda kişinin yazdığı silinirdi.
 * Adımlar `hidden` ile saklanır (kaldırılmaz), bütün yanıtlar tek FormData'da gider.
 */
export function StartForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState(0);
  const [single, setSingle] = useState<Partial<Record<StartQuestionKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** O adımdaki alanların hepsi geçerli mi (tarayıcının kendi doğrulamasıyla + çoklu seçim kuralı). */
  function stepIsValid(index: number): boolean {
    const fieldset = formRef.current?.querySelector<HTMLFieldSetElement>(
      `[data-step="${index}"]`,
    );
    if (!fieldset) return true;

    // Çoklu seçim: en az biri işaretli olmalı (HTML `required` onay kutusu grubunda çalışmaz).
    for (const name of ["expectations", "timeWindows"]) {
      const boxes = fieldset.querySelectorAll(`input[name="${name}"]`);
      if (boxes.length > 0 && fieldset.querySelectorAll(`input[name="${name}"]:checked`).length === 0) {
        setError("En az bir seçenek işaretle.");
        return false;
      }
    }

    for (const element of Array.from(fieldset.elements)) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        if (!element.checkValidity()) {
          element.reportValidity();
          setError(null);
          return false;
        }
      }
    }
    return true;
  }

  function goNext() {
    setError(null);
    if (!stepIsValid(step)) return;
    setStep((current) => Math.min(current + 1, LAST_STEP));
    scrollTop();
  }

  function goBack() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
    scrollTop();
  }

  function choose(key: StartQuestionKey, value: string, index: number) {
    setSingle((current) => ({ ...current, [key]: value }));
    setError(null);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    // Seçim ekranda bir an görünsün, sonra ilerle.
    advanceTimer.current = setTimeout(() => {
      setStep((current) => (current === index ? Math.min(index + 1, LAST_STEP) : current));
      scrollTop();
    }, AUTO_ADVANCE_MS);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!stepIsValid(step)) return;

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitStartLeadAction(formData);
      // Başarıda sunucu teşekkür sayfasına yönlendirir; buraya yalnız hata döner.
      if (result?.error) setError(result.error);
    });
  }

  const isFinal = step === LAST_STEP;
  const progress = Math.round((Math.min(step, TOTAL_QUESTIONS) / TOTAL_QUESTIONS) * 100);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      {/* Bal küpü: insan görmez, bot doldurur. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web sitesi
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-[0.7rem] font-bold uppercase tracking-wide">
          <span className="text-brand-yellow">
            {isFinal ? "Son adım" : `Soru ${step + 1} / ${TOTAL_QUESTIONS}`}
          </span>
          <span className="text-brand-muted">%{progress}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-2 h-1 w-full bg-brand-border"
        >
          <div
            className="h-1 bg-brand-yellow transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── 1–5: tek seçimli sorular (seçince ilerler) ─────────── */}
      {Object.entries(SINGLE_STEPS).map(([index, key]) => {
        const question = START_QUESTIONS[key];
        const stepIndex = Number(index);
        return (
          <fieldset
            key={key}
            data-step={stepIndex}
            hidden={step !== stepIndex}
            className="space-y-4"
          >
            <legend className={legendClass}>{question.title}</legend>
            <div className="space-y-2">
              {question.options.map((option) => (
                <label key={option.value} className={choiceClass}>
                  <input
                    type="radio"
                    name={key}
                    value={option.value}
                    required
                    checked={single[key] === option.value}
                    onChange={() => choose(key, option.value, stepIndex)}
                    className="h-5 w-5 shrink-0 accent-brand-yellow"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}

      {/* ── 6: beklentiler (çoklu) ─────────────────────────────── */}
      <fieldset data-step="5" hidden={step !== 5} className="space-y-4">
        <legend className={legendClass}>{START_QUESTIONS.expectations.title}</legend>
        <p className={hintClass}>{START_QUESTIONS.expectations.hint}</p>
        <div className="space-y-2">
          {START_QUESTIONS.expectations.options.map((option) => (
            <label key={option.value} className={choiceClass}>
              <input
                type="checkbox"
                name="expectations"
                value={option.value}
                className="h-5 w-5 shrink-0 accent-brand-yellow"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* ── 7: günlük hayat ────────────────────────────────────── */}
      <fieldset data-step="6" hidden={step !== 6} className="space-y-5">
        <legend className={legendClass}>Günlük hayatını biraz tanıyalım.</legend>
        <div>
          <label htmlFor="occupation" className={labelClass}>
            Mesleğin
          </label>
          <input
            id="occupation"
            name="occupation"
            required
            minLength={2}
            maxLength={60}
            autoComplete="organization-title"
            className={inputClass}
          />
        </div>
        <div>
          <span className={labelClass}>{START_QUESTIONS.dailyLoad.title}</span>
          <div className="mt-2 space-y-2">
            {START_QUESTIONS.dailyLoad.options.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="radio"
                  name="dailyLoad"
                  value={option.value}
                  required
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* ── 8: zamanlar ────────────────────────────────────────── */}
      <fieldset data-step="7" hidden={step !== 7} className="space-y-5">
        <legend className={legendClass}>{START_QUESTIONS.timeWindows.title}</legend>
        <div>
          <p className={hintClass}>{START_QUESTIONS.timeWindows.hint}</p>
          <div className="mt-2 space-y-2">
            {START_QUESTIONS.timeWindows.options.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="checkbox"
                  name="timeWindows"
                  value={option.value}
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className={labelClass}>{START_QUESTIONS.weeklyDays.title}</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {START_QUESTIONS.weeklyDays.options.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="radio"
                  name="weeklyDays"
                  value={option.value}
                  required
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* ── Son adım ───────────────────────────────────────────── */}
      <fieldset data-step="8" hidden={step !== 8} className="space-y-4">
        <legend className={legendClass}>Son adım</legend>
        <div>
          <label htmlFor="fullName" className={labelClass}>
            Ad Soyad
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            minLength={5}
            maxLength={80}
            autoComplete="name"
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
            autoComplete="tel"
            inputMode="tel"
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
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-400">
          {error}
        </p>
      )}

      {isFinal ? (
        <div className="space-y-3">
          <button
            type="submit"
            disabled={pending}
            className={`${primaryButtonClass} w-full`}
          >
            {pending ? "GÖNDERİLİYOR…" : "GÖRÜŞME TALEBİ OLUŞTUR"}
          </button>
          <p className="text-xs leading-relaxed text-brand-muted">
            Bilgilerini ve cevaplarını inceleyip sana uygun başlangıcı görüşmede
            birlikte belirleyeceğiz.
          </p>
          <p className="text-[0.7rem] leading-relaxed text-brand-muted">
            Butona basarak bilgilerinin bu talebi yanıtlamak ve seninle iletişime
            geçmek için işlenmesini kabul edersin.
          </p>
        </div>
      ) : (
        step >= 5 && (
          <button type="button" onClick={goNext} className={`${primaryButtonClass} w-full`}>
            Devam
          </button>
        )
      )}

      {step > 0 && (
        <button type="button" onClick={goBack} className={`${secondaryButtonClass} w-full`}>
          Geri
        </button>
      )}
    </form>
  );
}
