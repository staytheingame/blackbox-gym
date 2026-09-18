"use client";

import { useActionState, useState } from "react";
import { assignPlanBulkAction, type BulkAssignState } from "./actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  rowButtonClass,
} from "@/components/panel/form";

const initialState: BulkAssignState = {};

export type BulkTemplate = { id: string; name: string; weeks: number };

export type BulkMember = {
  id: string;
  fullName: string;
  memberNo: string;
  /** Şu an yürüyen aynı türdeki programın adı — atama onu kapatacak. */
  currentPlanName: string | null;
};

/**
 * TOPLU PROGRAM ATAMA — aynı programı bir grubun tamamına vermek için.
 *
 * Grup dersi veren salonda program çoğunlukla ortaktır; onu tek tek yirmi
 * sporcu kartına girip atamak işin kendisinden uzun sürüyordu. Kişiye özel
 * program değişmedi: sporcu kartındaki atama formu duruyor (bkz.
 * `/personel/uyeler/<id>`), bu ekran onun yerine geçmez.
 *
 * Uyarı bilinçli: aynı türde yürüyen program varsa atama onu kapatır. Bu,
 * satırda "şu an X programında" olarak yazılır — sürpriz olmasın.
 */
export function BulkAssignForm({
  templates,
  members,
}: {
  templates: BulkTemplate[];
  members: BulkMember[];
}) {
  const [state, formAction, pending] = useActionState(
    assignPlanBulkAction,
    initialState,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  if (templates.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Önce yayında bir şablon oluştur — atanacak program yok.
      </p>
    );
  }
  if (members.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Sporcu listen boş. Sporcu eklendiğinde buradan toplu atama yapabilirsin.
      </p>
    );
  }

  const visible = filter.trim()
    ? members.filter((member) =>
        `${member.fullName} ${member.memberNo}`
          .toLocaleLowerCase("tr")
          .includes(filter.toLocaleLowerCase("tr")),
      )
    : members;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((member) => selected.has(member.id));

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bulk-template" className={labelClass}>
            Şablon
          </label>
          <select
            id="bulk-template"
            name="templateId"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Şablon seç…
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.weeks} hafta)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bulk-filter" className={labelClass}>
            Sporcu ara
          </label>
          <input
            id="bulk-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Ad ya da üye no"
            className={inputClass}
          />
          <p className={hintClass}>
            {selected.size > 0
              ? `${selected.size} sporcu seçildi.`
              : "Aşağıdan sporcuları işaretle."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setSelected((current) => {
              const next = new Set(current);
              for (const member of visible) {
                if (allVisibleSelected) next.delete(member.id);
                else next.add(member.id);
              }
              return next;
            })
          }
          className={rowButtonClass}
        >
          {allVisibleSelected ? "Seçimi Kaldır" : "Hepsini Seç"}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={rowButtonClass}
          >
            Temizle
          </button>
        )}
      </div>

      <ul className="max-h-80 divide-y divide-brand-border overflow-y-auto rounded-sm border border-brand-border">
        {visible.map((member) => (
          <li key={member.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-brand-surface-2">
              <input
                type="checkbox"
                name="memberIds"
                value={member.id}
                checked={selected.has(member.id)}
                onChange={() => toggle(member.id)}
                className="h-5 w-5 shrink-0 accent-brand-yellow"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-brand-white">
                  {member.fullName}
                  <span className="ml-2 text-xs text-brand-muted">
                    {member.memberNo}
                  </span>
                </span>
                {member.currentPlanName && (
                  <span className="block truncate text-[0.7rem] text-brand-muted">
                    şu an: {member.currentPlanName} — atama bunu kapatır
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-3 py-4 text-sm text-brand-muted">
            Aramaya uyan sporcu yok.
          </li>
        )}
      </ul>

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
        disabled={pending || selected.size === 0}
        className={primaryButtonClass}
      >
        {pending
          ? "Atanıyor…"
          : selected.size === 0
            ? "Programı Ata"
            : `Programı Ata (${selected.size})`}
      </button>
    </form>
  );
}
