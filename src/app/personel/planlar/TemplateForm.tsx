"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  PLAN_KINDS,
  PLAN_KIND_LABEL,
  PLAN_LEVELS,
  PLAN_LEVEL_LABEL,
  type PlanKind,
  type PlanLevel,
} from "@/domain/plans/template";
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateFormState,
} from "./actions";

const initialState: TemplateFormState = {};

export type TemplateDefaults = {
  name: string;
  kind: PlanKind;
  level: PlanLevel;
  weeks: number;
  summary: string;
};

/**
 * Şablonun künyesi. `templateId` verilirse güncelleme, verilmezse oluşturma
 * kipinde çalışır — iki ekranda iki ayrı form tutmak, alan eklendiğinde
 * birini güncellemeyi unutmak demekti.
 */
export function TemplateForm({
  templateId,
  defaults,
}: {
  templateId?: string;
  defaults?: TemplateDefaults;
}) {
  const [state, formAction, pending] = useActionState(
    templateId
      ? updateTemplateAction.bind(null, templateId)
      : createTemplateAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!templateId && state.success) formRef.current?.reset();
  }, [state.success, templateId]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Şablon Adı</label>
          <input
            name="name"
            required
            minLength={3}
            defaultValue={defaults?.name}
            placeholder="4 Haftalık Temel Boks"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Tür</label>
          <select
            name="kind"
            defaultValue={defaults?.kind ?? "antrenman"}
            className={inputClass}
          >
            {PLAN_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PLAN_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
          <p className={hintClass}>
            Sporcu antrenman ve kondisyon programını aynı anda taşıyabilir.
          </p>
        </div>

        <div>
          <label className={labelClass}>Seviye</label>
          <select
            name="level"
            defaultValue={defaults?.level ?? "baslangic"}
            className={inputClass}
          >
            {PLAN_LEVELS.map((level) => (
              <option key={level} value={level}>
                {PLAN_LEVEL_LABEL[level]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Hafta Sayısı</label>
          <input
            name="weeks"
            type="number"
            min={1}
            max={24}
            required
            defaultValue={defaults?.weeks ?? 4}
            className={inputClass}
          />
          <p className={hintClass}>
            {templateId
              ? "Azaltırsan kalan haftalardaki günler silinir."
              : "Program bittiğinde sporcuya yenisi atanır."}
          </p>
        </div>

        <div>
          <label className={labelClass}>Özet (opsiyonel)</label>
          <input
            name="summary"
            defaultValue={defaults?.summary}
            placeholder="Jab-cross temelli, haftada 3 gün"
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black hover:bg-brand-white disabled:opacity-60"
      >
        {pending
          ? "Kaydediliyor…"
          : templateId
            ? "Ayarları Kaydet"
            : "Şablonu Oluştur"}
      </button>
    </form>
  );
}

const inputClass =
  "mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-sm text-brand-white outline-none focus:border-brand-yellow";
const labelClass = "text-xs font-bold uppercase tracking-wide text-brand-muted";
const hintClass = "mt-1 text-[0.7rem] text-brand-muted";
