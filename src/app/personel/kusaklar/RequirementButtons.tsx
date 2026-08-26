"use client";

import { useTransition } from "react";
import {
  deleteRequirementAction,
  revokeRankAction,
  toggleRequirementAction,
} from "./actions";

/**
 * Kuşak ekranının küçük eylemleri. Hepsi `useTransition` ile çalışır:
 * form durumu taşımadıkları için `useActionState` gereksiz, ama basılınca
 * düğmenin kilitlenmesi gerekiyor (çift tıklama işaretlemeyi geri alırdı).
 */

const ghostButton =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-2.5 py-1 text-xs font-semibold text-brand-muted transition-colors hover:border-red-400/60 hover:text-red-300 disabled:opacity-50 sm:min-h-7";

export function DeleteRequirementButton({
  requirementId,
}: {
  requirementId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={ghostButton}
      onClick={() =>
        startTransition(async () => {
          await deleteRequirementAction(requirementId);
        })
      }
    >
      {pending ? "…" : "Sil"}
    </button>
  );
}

export function RequirementToggle({
  memberId,
  requirementId,
  done,
  label,
  kindLabel,
}: {
  memberId: string;
  requirementId: string;
  done: boolean;
  label: string;
  kindLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={done}
      className={`flex w-full items-start gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
        done
          ? "border-brand-yellow/50 bg-brand-yellow/10"
          : "border-brand-border bg-brand-surface-2 hover:border-brand-yellow/40"
      }`}
      onClick={() =>
        startTransition(async () => {
          await toggleRequirementAction(memberId, requirementId);
        })
      }
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
          done
            ? "border-brand-yellow bg-brand-yellow text-brand-black"
            : "border-brand-border text-transparent"
        }`}
      >
        ✓
      </span>
      <span>
        <span className="mr-2 text-xs uppercase tracking-wide text-brand-muted">
          {kindLabel}
        </span>
        <span className="text-sm text-brand-white">{label}</span>
      </span>
    </button>
  );
}

export function RevokeRankButton({
  memberId,
  rankId,
}: {
  memberId: string;
  rankId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={ghostButton}
      onClick={() =>
        startTransition(async () => {
          await revokeRankAction(memberId, rankId);
        })
      }
    >
      {pending ? "…" : "Geri al"}
    </button>
  );
}
