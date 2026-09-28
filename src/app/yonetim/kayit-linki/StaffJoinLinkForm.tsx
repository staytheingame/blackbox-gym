"use client";

import { useActionState, useState } from "react";
import {
  createStaffJoinLinksAction,
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
import {
  STAFF_LINK_LIMITS,
  composeLinkList,
} from "@/domain/registration/staff-link";

const initialState: StaffLinkFormState = {};

const coachLimits = STAFF_LINK_LIMITS.coach;
const adminLimits = STAFF_LINK_LIMITS.admin;

/**
 * Kayıt bağlantılarını tek dokunuşla hazırlar: sporcular, antrenörler ve
 * yöneticiler için. Üretince üç grubun adresi tek mesajda toplanır; yönetici
 * "Listeyi Kopyala"yla ilgili gruplara gönderir.
 */
export function StaffJoinLinkForm({
  clientUrls,
}: {
  /** Şu an kullanılabilir sporcu kayıt bağlantıları — listeye eklenir. */
  clientUrls: string[];
}) {
  const [state, formAction, pending] = useActionState(
    createStaffJoinLinksAction,
    initialState,
  );
  const [copied, setCopied] = useState(false);

  const hasResult = Boolean(state.coach || state.admin);
  const list = hasResult
    ? composeLinkList({ clientUrls, coach: state.coach, admin: state.admin })
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
        <p className="text-sm leading-relaxed text-brand-muted">
          Tek dokunuşla hem <strong className="text-brand-white">antrenör</strong>{" "}
          hem <strong className="text-brand-white">yönetici</strong> bağlantısı
          üretilir; sporcu bağlantısıyla birlikte tek mesajda kopyalayabilirsin.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="which"
            value="hepsi"
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? "Hazırlanıyor…" : "Tüm Bağlantıları Hazırla"}
          </button>
          <button
            type="submit"
            name="which"
            value="coach"
            disabled={pending}
            className={rowButtonClass}
          >
            Yalnız Antrenör
          </button>
          <button
            type="submit"
            name="which"
            value="admin"
            disabled={pending}
            className={rowButtonClass}
          >
            Yalnız Yönetici
          </button>
        </div>

        <details className="rounded-sm border border-brand-border bg-brand-black/30 p-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brand-muted hover:text-brand-yellow">
            Kişi sayısı ve süreyi değiştir
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="coachMaxUses" className={labelClass}>
                Antrenör — kaç kişi
              </label>
              <input
                id="coachMaxUses"
                name="coachMaxUses"
                type="number"
                min={1}
                max={coachLimits.maxUsesCap}
                defaultValue={coachLimits.defaultMaxUses}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="coachDays" className={labelClass}>
                Antrenör — kaç gün geçerli
              </label>
              <input
                id="coachDays"
                name="coachDays"
                type="number"
                min={1}
                max={coachLimits.daysCap}
                defaultValue={coachLimits.defaultDays}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="adminMaxUses" className={labelClass}>
                Yönetici — kaç kişi
              </label>
              <input
                id="adminMaxUses"
                name="adminMaxUses"
                type="number"
                min={1}
                max={adminLimits.maxUsesCap}
                defaultValue={adminLimits.defaultMaxUses}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="adminDays" className={labelClass}>
                Yönetici — kaç gün geçerli
              </label>
              <input
                id="adminDays"
                name="adminDays"
                type="number"
                min={1}
                max={adminLimits.daysCap}
                defaultValue={adminLimits.defaultDays}
                className={inputClass}
              />
            </div>
          </div>
        </details>

        <p className={hintClass}>
          Yönetici hesabı salonun tüm verisini ve ayarlarını görür; bu yüzden
          yönetici bağlantısı varsayılan olarak <strong>tek kişilik</strong> ve{" "}
          {adminLimits.defaultDays} gün geçerlidir (en fazla{" "}
          {adminLimits.maxUsesCap} kişi / {adminLimits.daysCap} gün). Bağlantıyı
          yalnızca yönetici olacak kişiye özelden gönder. Yeni bağlantı üretmek
          aynı roldeki öncekini kapatır.
        </p>

        {state.error && (
          <p className="text-sm font-semibold text-red-400">{state.error}</p>
        )}
      </form>

      {hasResult && (
        <div className="space-y-3">
          {state.coach && (
            <JoinLinkBox
              url={state.coach.url}
              label={`Antrenörler — ${state.coach.expiresLabel} tarihine kadar, en fazla ${state.coach.maxUses} kişi`}
              fresh
              message={`BlackBox antrenör kaydı: ${state.coach.url} — adını, e-postanı ve şifreni yaz, hesabın anında açılır.`}
            />
          )}
          {state.admin && (
            <JoinLinkBox
              url={state.admin.url}
              label={`Yöneticiler — ${state.admin.expiresLabel} tarihine kadar, en fazla ${state.admin.maxUses} kişi`}
              fresh
              message={`BlackBox yönetici kaydı: ${state.admin.url} — adını, e-postanı ve şifreni yaz. Bu bağlantıyı kimseyle paylaşma.`}
            />
          )}
          <p className="text-xs text-brand-muted">
            Bu adresler yalnız şimdi görünür (güvenlik için yalnız özetleri
            saklanır). Kaybedersen yeniden üret.
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
