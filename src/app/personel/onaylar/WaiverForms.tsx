"use client";

import { useActionState, useState, useTransition } from "react";
import { WAIVER_KINDS, WAIVER_KIND_LABEL } from "@/domain/waivers/status";
import {
  createWaiverTemplateAction,
  toggleWaiverTemplateAction,
  updateWaiverTemplateAction,
  type WaiverTemplateState,
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass = "text-xs font-bold uppercase tracking-wide text-brand-muted";
const buttonClass =
  "rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white disabled:opacity-60";
const ghostButton =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-50";

const initial: WaiverTemplateState = {};

function Feedback({ state }: { state: WaiverTemplateState }) {
  if (state.error) return <p className="text-sm text-red-300">{state.error}</p>;
  if (state.success)
    return <p className="text-sm text-brand-yellow">{state.success}</p>;
  return null;
}

function CheckboxRow({
  name,
  label,
  hint,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-brand-white">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-yellow-400"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-brand-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function CreateWaiverForm() {
  const [state, formAction, pending] = useActionState(
    createWaiverTemplateAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="waiver-kind" className={labelClass}>
            Tür
          </label>
          <select
            id="waiver-kind"
            name="kind"
            defaultValue="saglik"
            className={inputClass}
          >
            {WAIVER_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {WAIVER_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="waiver-title" className={labelClass}>
            Başlık
          </label>
          <input
            id="waiver-title"
            name="title"
            required
            maxLength={120}
            placeholder="Sağlık Beyanı ve Sorumluluk Onayı"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="waiver-body" className={labelClass}>
          Metin
        </label>
        <textarea
          id="waiver-body"
          name="body"
          required
          rows={6}
          maxLength={8000}
          placeholder="Sporcunun okuyup onaylayacağı metin…"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="waiver-questions" className={labelClass}>
          Evet/hayır soruları — her satıra bir soru
        </label>
        <textarea
          id="waiver-questions"
          name="questions"
          rows={4}
          maxLength={2000}
          placeholder={
            "Kalp veya tansiyon rahatsızlığın var mı?\nSon 6 ayda ameliyat geçirdin mi?\nDüzenli kullandığın ilaç var mı?"
          }
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <CheckboxRow
          name="isRequired"
          label="Zorunlu"
          hint="İmzalanmadıkça sporcunun onam listesinde uyarı olarak kalır."
          defaultChecked
        />
        <CheckboxRow
          name="requiresGuardian"
          label="Veli bilgisi iste"
          hint="18 yaş altı sporcularda zaten istenir; bu kutu herkes için zorunlu kılar."
        />
      </div>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Kaydediliyor…" : "Formu Ekle"}
      </button>
    </form>
  );
}

export function EditWaiverForm({
  template,
}: {
  template: {
    id: string;
    title: string;
    body: string;
    questions: string[];
    version: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateWaiverTemplateAction,
    initial,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ghostButton}
      >
        Düzenle
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 w-full space-y-4">
      <input type="hidden" name="templateId" value={template.id} />

      <div>
        <label htmlFor={`title-${template.id}`} className={labelClass}>
          Başlık
        </label>
        <input
          id={`title-${template.id}`}
          name="title"
          required
          defaultValue={template.title}
          maxLength={120}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`body-${template.id}`} className={labelClass}>
          Metin
        </label>
        <textarea
          id={`body-${template.id}`}
          name="body"
          required
          rows={8}
          defaultValue={template.body}
          maxLength={8000}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={`questions-${template.id}`} className={labelClass}>
          Sorular — her satıra bir soru
        </label>
        <textarea
          id={`questions-${template.id}`}
          name="questions"
          rows={4}
          defaultValue={template.questions.join("\n")}
          maxLength={2000}
          className={inputClass}
        />
      </div>

      <CheckboxRow
        name="bumpVersion"
        label={`Sürümü artır (şu an v${template.version})`}
        hint="İşaretlersen mevcut imzalar eski sayılır ve sporculardan yeniden onay istenir."
      />

      <Feedback state={state} />

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={ghostButton}
        >
          Kapat
        </button>
      </div>
    </form>
  );
}

export function ToggleWaiverButton({
  templateId,
  isActive,
}: {
  templateId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={ghostButton}
      onClick={() =>
        startTransition(async () => {
          await toggleWaiverTemplateAction(templateId, !isActive);
        })
      }
    >
      {pending ? "…" : isActive ? "Kapat" : "Aç"}
    </button>
  );
}
