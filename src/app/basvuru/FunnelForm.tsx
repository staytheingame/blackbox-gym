"use client";

import { useRef, useState, useTransition } from "react";
import { submitFunnelLeadAction } from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "@/components/panel/form";
import {
  CONTACT_CHANNEL_OPTIONS,
  CONTACT_TIME_OPTIONS,
  DAILY_LOAD_OPTIONS,
  FOR_WHOM_OPTIONS,
  FUNNEL_OFFERS,
  GOAL_OPTIONS,
  OCCUPATION_GROUP_OPTIONS,
  PREFERRED_TIME_OPTIONS,
  PRIVATE_LESSON_TERMS,
  isBirebirOffer,
} from "@/domain/funnel/lead";

const STEPS = ["İlgin", "Seni tanıyalım", "Ulaşalım"] as const;

const choiceClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-brand-border bg-brand-black/40 px-3 py-2 text-sm text-brand-white transition-colors has-[:checked]:border-brand-yellow has-[:checked]:bg-brand-yellow/10";

/**
 * BAŞVURU FUNNEL'I — üç adım: (1) kimin için + ne ilgisi + hedef, (2) kişi
 * bilgileri, (3) nasıl ulaşalım.
 *
 * Form `action={}` ile değil `onSubmit` ile gönderilir: React 19, `action`
 * bitince kontrolsüz alanları SIFIRLAR — doğrulama hatasında kişinin yazdığı her
 * şey silinirdi. Adımlar `hidden` ile saklanır (kaldırılmaz), böylece bütün
 * alanlar tek FormData'da gider.
 */
export function FunnelForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [forWhom, setForWhom] = useState("");
  const [interest, setInterest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isChild = forWhom === "cocugum";

  /** O adımdaki alanları tarayıcının kendi doğrulamasıyla denetler. */
  function stepIsValid(index: number): boolean {
    const fieldset = formRef.current?.querySelector<HTMLFieldSetElement>(
      `[data-step="${index}"]`,
    );
    if (!fieldset) return true;
    for (const element of Array.from(fieldset.elements)) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        if (!element.checkValidity()) {
          element.reportValidity();
          return false;
        }
      }
    }
    return true;
  }

  /** Çoklu seçimde "en az biri" kuralı — HTML `required` onay kutusu grubunda çalışmaz. */
  function goalsSelected(): boolean {
    return (formRef.current?.querySelectorAll('input[name="goals"]:checked').length ?? 0) > 0;
  }

  function next() {
    setError(null);
    if (step === 0 && !goalsSelected()) {
      setError("En az bir hedef seç.");
      return;
    }
    if (!stepIsValid(step)) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!stepIsValid(step)) return;

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitFunnelLeadAction(formData);
      // Başarıda sunucu teşekkür sayfasına yönlendirir; buraya yalnız hata döner.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate={false}>
      {/* Bal küpü: insan görmez, bot doldurur. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Web sitesi
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <ol className="flex gap-2" aria-label="Adımlar">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`flex-1 border-t-2 pt-2 text-[0.7rem] font-bold uppercase tracking-wide ${
              index <= step
                ? "border-brand-yellow text-brand-yellow"
                : "border-brand-border text-brand-muted"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {/* ── Adım 1 ─────────────────────────────────────────── */}
      <fieldset data-step="0" hidden={step !== 0} className="space-y-6">
        <div>
          <span className={labelClass}>Antrenman kimin için?</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {FOR_WHOM_OPTIONS.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="radio"
                  name="forWhom"
                  value={option.value}
                  required
                  checked={forWhom === option.value}
                  onChange={() => setForWhom(option.value)}
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Ne ile ilgileniyorsun?</span>
          <div className="mt-2 space-y-2">
            {FUNNEL_OFFERS.map((offer) => (
              <label key={offer.value} className={choiceClass}>
                <input
                  type="radio"
                  name="interest"
                  value={offer.value}
                  required
                  checked={interest === offer.value}
                  onChange={() => setInterest(offer.value)}
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                <span className="font-semibold">{offer.label}</span>
              </label>
            ))}
          </div>

          {isBirebirOffer(interest) && (
            <div className="mt-3 rounded-sm border border-brand-yellow/30 bg-brand-yellow/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                Birebir ders şartları
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-brand-muted">
                {PRIVATE_LESSON_TERMS.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <span className={labelClass}>Hedefin ne?</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {GOAL_OPTIONS.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="checkbox"
                  name="goals"
                  value={option.value}
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className={hintClass}>Bir ya da birden fazla seçebilirsin.</p>
        </div>
      </fieldset>

      {/* ── Adım 2 ─────────────────────────────────────────── */}
      <fieldset data-step="1" hidden={step !== 1} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={labelClass}>
              Adın
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              minLength={2}
              maxLength={40}
              autoComplete="given-name"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>
              Soyadın
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              minLength={2}
              maxLength={40}
              autoComplete="family-name"
              className={inputClass}
            />
          </div>

          {isChild && (
            <div>
              <label htmlFor="childName" className={labelClass}>
                Çocuğunun adı
              </label>
              <input
                id="childName"
                name="childName"
                required
                minLength={2}
                maxLength={40}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="age" className={labelClass}>
              {isChild ? "Çocuğunun yaşı" : "Yaşın"}
            </label>
            <input
              id="age"
              name="age"
              type="number"
              inputMode="numeric"
              required
              min={isChild ? 3 : 12}
              max={isChild ? 17 : 90}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="occupationGroup" className={labelClass}>
              Meslek grubun{" "}
              <span className="font-normal normal-case">(opsiyonel)</span>
            </label>
            <select
              id="occupationGroup"
              name="occupationGroup"
              defaultValue=""
              className={inputClass}
            >
              <option value="">Seç</option>
              {OCCUPATION_GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dailyLoad" className={labelClass}>
              Günlük yoğunluğun{" "}
              <span className="font-normal normal-case">(opsiyonel)</span>
            </label>
            <select id="dailyLoad" name="dailyLoad" defaultValue="" className={inputClass}>
              <option value="">Seç</option>
              {DAILY_LOAD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className={labelClass}>
            Tercih ettiğin antrenman saatleri{" "}
            <span className="font-normal normal-case">(opsiyonel)</span>
          </span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PREFERRED_TIME_OPTIONS.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="checkbox"
                  name="preferredTimes"
                  value={option.value}
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* ── Adım 3 ─────────────────────────────────────────── */}
      <fieldset data-step="2" hidden={step !== 2} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
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

        <div>
          <span className={labelClass}>Sana nasıl ulaşalım?</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {CONTACT_CHANNEL_OPTIONS.map((option, index) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="radio"
                  name="contactChannel"
                  value={option.value}
                  required
                  defaultChecked={index === 0}
                  className="h-5 w-5 shrink-0 accent-brand-yellow"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="contactTime" className={labelClass}>
            Ne zaman ulaşalım?{" "}
            <span className="font-normal normal-case">(opsiyonel)</span>
          </label>
          <select id="contactTime" name="contactTime" defaultValue="" className={inputClass}>
            <option value="">Fark etmez</option>
            {CONTACT_TIME_OPTIONS.filter((option) => option.value !== "fark-etmez").map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="note" className={labelClass}>
            Eklemek istediğin bir şey var mı?{" "}
            <span className="font-normal normal-case">(opsiyonel)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={600}
            placeholder="Sakatlık, daha önce spor geçmişin, sormak istediğin bir şey…"
            className={textareaClass}
          />
        </div>

        <div className="space-y-3 rounded-sm border border-brand-border bg-brand-black/40 p-4">
          <label className="flex items-start gap-3 text-xs leading-relaxed text-brand-muted">
            <input
              type="checkbox"
              name="kvkkConsent"
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-yellow"
            />
            <span>
              Bilgilerimin başvurumu yanıtlamak ve benimle iletişime geçmek için
              işlenmesini kabul ediyorum.{" "}
              <span className="text-brand-white">Zorunlu.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-xs leading-relaxed text-brand-muted">
            <input
              type="checkbox"
              name="marketingConsent"
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-yellow"
            />
            <span>Kampanya ve duyurular için bana ulaşılabilir.</span>
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" onClick={back} className={`${secondaryButtonClass} flex-1`}>
            Geri
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className={`${primaryButtonClass} flex-1`}>
            Devam
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className={`${primaryButtonClass} flex-1`}
          >
            {pending ? "Gönderiliyor…" : "Başvuruyu Gönder"}
          </button>
        )}
      </div>
    </form>
  );
}
