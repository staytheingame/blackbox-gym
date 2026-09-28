"use client";

import { useActionState, useState } from "react";
import {
  createStaffJoinLinkAction,
  type StaffLinkFormState,
} from "./staff-actions";
import {
  hintClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  rowButtonClass,
} from "@/components/panel/form";
import { JoinLinkBox } from "@/components/panel/JoinLinkBox";

const initialState: StaffLinkFormState = {};

/**
 * Antrenör kayıt bağlantısı üretme formu. Üretilince adres bir kez görünür;
 * yanında sporcu bağlantılarıyla birlikte tek mesajda gönderilecek liste var.
 */
export function StaffJoinLinkForm({
  defaultMaxUses,
  defaultDays,
  clientUrls,
}: {
  defaultMaxUses: number;
  defaultDays: number;
  /** Şu an kullanılabilir sporcu kayıt bağlantıları — listeye eklenir. */
  clientUrls: string[];
}) {
  const [state, formAction, pending] = useActionState(
    createStaffJoinLinkAction,
    initialState,
  );
  const [copied, setCopied] = useState(false);

  const list = state.url
    ? [
        "BlackBox kayıt bağlantıları",
        "",
        `Antrenörler — adını, e-postanı ve şifreni kendin yaz (${state.expiresLabel} tarihine kadar, en fazla ${state.maxUses} kişi):`,
        state.url,
        "",
        clientUrls.length > 1
          ? "Sporcular / danışanlar:"
          : "Sporcular / danışanlar — bilgilerini yaz, şifreni belirle:",
        ...(clientUrls.length > 0
          ? clientUrls
          : ["(açık sporcu bağlantısı yok)"]),
      ].join("\n")
    : "";

  async function copyList() {
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="staff-label" className={labelClass}>
              Bağlantı adı
            </label>
            <input
              id="staff-label"
              name="label"
              defaultValue="Antrenör kayıt bağlantısı"
              maxLength={60}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="staff-maxUses" className={labelClass}>
              Kaç kişi kullanabilir
            </label>
            <input
              id="staff-maxUses"
              name="maxUses"
              type="number"
              min={1}
              max={50}
              defaultValue={defaultMaxUses}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="staff-days" className={labelClass}>
              Kaç gün geçerli
            </label>
            <input
              id="staff-days"
              name="days"
              type="number"
              min={1}
              max={30}
              defaultValue={defaultDays}
              className={inputClass}
            />
          </div>
        </div>

        <p className={hintClass}>
          Bağlantı her zaman <strong>antrenör</strong> hesabı açar. Yönetici
          olacak kişi de önce bu bağlantıyla kaydolur, sonra Kadro
          ekranından yönetici yapılır. Yeni bağlantı üretmek öncekileri
          kapatır.
        </p>

        {state.error && (
          <p className="text-sm font-semibold text-red-400">{state.error}</p>
        )}

        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Üretiliyor…" : "Antrenör Bağlantısı Üret"}
        </button>
      </form>

      {state.url && (
        <div className="space-y-3">
          <JoinLinkBox
            url={state.url}
            label={`Antrenörlere gönderilecek adres — ${state.expiresLabel} tarihine kadar, en fazla ${state.maxUses} kişi`}
            fresh
            message={`BlackBox antrenör kaydı: ${state.url} — adını, e-postanı ve şifreni yaz, hesabın anında açılır.`}
          />
          <p className="text-xs text-brand-muted">
            Bu adres yalnız şimdi görünür. Kaybedersen yeni bağlantı üret.
          </p>

          <div className="rounded-sm border border-brand-border bg-brand-black/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
              Gönderilecek liste
            </p>
            <pre className="mt-2 whitespace-pre-wrap break-all rounded-sm border border-brand-border bg-brand-black p-3 font-mono text-xs text-brand-white">
              {list}
            </pre>
            <button
              type="button"
              onClick={copyList}
              className={`${rowButtonClass} mt-3`}
            >
              {copied ? "Kopyalandı" : "Listeyi Kopyala"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
