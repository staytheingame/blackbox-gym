"use client";

import { useActionState } from "react";
import { assignPlanAction, type AssignPlanState } from "./actions";
import { primaryButtonClass } from "@/components/panel/form";

const initialState: AssignPlanState = {};

export type AssignableTemplate = {
  id: string;
  name: string;
  kind: string;
  weeks: number;
};

const KIND_LABEL: Record<string, string> = {
  antrenman: "Antrenman",
  kondisyon: "Kondisyon",
};

export function AssignPlanForm({
  memberId,
  templates,
  currentPlans,
}: {
  memberId: string;
  templates: AssignableTemplate[];
  /** Sporcunun şu an yürüyen programları — tür başına en fazla bir tane. */
  currentPlans: { kind: string; templateName: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    assignPlanAction,
    initialState,
  );

  if (templates.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Henüz plan şablonu yok — önce Planlar bölümünden şablon oluştur.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />

      {currentPlans.length > 0 && (
        <div className="space-y-1 text-xs text-brand-muted">
          {currentPlans.map((plan) => (
            <p key={plan.kind}>
              {KIND_LABEL[plan.kind] ?? plan.kind}:{" "}
              <span className="text-brand-white">{plan.templateName}</span>
            </p>
          ))}
          <p>
            Yeni atama yalnız <em>aynı türdeki</em> programı kapatır; diğeri
            yürümeye devam eder. Geçmiş silinmez.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="templateId"
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          Şablon
        </label>
        <select
          id="templateId"
          name="templateId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-base text-brand-white outline-none focus:border-brand-yellow sm:text-sm"
        >
          <option value="" disabled>
            Şablon seç…
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.weeks} hafta ·{" "}
              {template.kind === "kondisyon" ? "kondisyon" : "antrenman"})
            </option>
          ))}
        </select>
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
        className={primaryButtonClass}
      >
        {pending ? "Atanıyor…" : "Programı Ata"}
      </button>
    </form>
  );
}
