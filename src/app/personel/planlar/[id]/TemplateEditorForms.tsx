"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  DAY_LABEL,
  PLAN_ITEM_KINDS,
  PLAN_ITEM_KIND_LABEL,
} from "@/domain/plans/template";
import {
  addDayAction,
  addItemAction,
  copyWeekAction,
  deleteTemplateAction,
  updateDayAction,
  type TemplateFormState,
} from "../actions";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/panel/form";

const initialState: TemplateFormState = {};

const ghostButton =
  "rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-60";

function Feedback({ state }: { state: TemplateFormState }) {
  return (
    <>
      {state.error && (
        <p className="text-sm font-semibold text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm font-semibold text-brand-yellow">
          {state.success}
        </p>
      )}
    </>
  );
}

/**
 * Açık olan haftaya yeni bir antrenman günü ekler. Hafta seçici bilinçli
 * olarak yok: dolu günler listesi görüntülenen haftaya göre hesaplanıyor,
 * başka hafta seçilebilseydi "boş" görünen bir gün sunucuda çakışırdı.
 */
export function AddDayForm({
  templateId,
  weekNumber,
  takenDays,
}: {
  templateId: string;
  /** Ekranda açık olan hafta. */
  weekNumber: number;
  /** Bu haftada zaten tanımlı günler; listede gösterilmez. */
  takenDays: number[];
}) {
  const [state, formAction, pending] = useActionState(
    addDayAction.bind(null, templateId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const free = [1, 2, 3, 4, 5, 6, 7].filter((day) => !takenDays.includes(day));

  if (free.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        Bu haftanın yedi günü de tanımlı. Değiştirmek için günün kartındaki
        &quot;Düzenle&quot;yi kullan.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="weekNumber" value={weekNumber} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Gün</label>
          <select
            name="dayOfWeek"
            defaultValue={free[0]}
            className={`mt-1 ${inputClass}`}
          >
            {free.map((day) => (
              <option key={day} value={day}>
                {DAY_LABEL[day]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Günün Odağı</label>
          <input
            name="focus"
            required
            minLength={2}
            placeholder="Ped & kombinasyon"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div className="sm:col-span-3">
          <label className={labelClass}>Not (opsiyonel)</label>
          <input
            name="notes"
            placeholder="Isınmadan sonra 2 tur ip"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Ekleniyor…" : "Gün Ekle"}
      </button>
    </form>
  );
}

/** Günün odağı ve notu — kartın içindeki açılır düzenleme formu. */
export function EditDayForm({
  dayId,
  templateId,
  focus,
  notes,
}: {
  dayId: string;
  templateId: string;
  focus: string;
  notes: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateDayAction.bind(null, dayId, templateId),
    initialState,
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Günün Odağı</label>
          <input
            name="focus"
            required
            minLength={2}
            defaultValue={focus}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Not</label>
          <input
            name="notes"
            defaultValue={notes ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={ghostButton}>
        {pending ? "Kaydediliyor…" : "Günü Kaydet"}
      </button>
    </form>
  );
}

/**
 * Güne hareket ekler. Süre DAKİKA olarak yazılır — antrenör "3 dakikalık
 * round" der; saniyeye çeviren sunucu tarafı (bkz. `addItemAction`).
 */
export function AddItemForm({
  dayId,
  templateId,
}: {
  dayId: string;
  templateId: string;
}) {
  const [state, formAction, pending] = useActionState(
    addItemAction.bind(null, dayId, templateId),
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Cins</label>
          <select name="kind" defaultValue="teknik" className={`mt-1 ${inputClass}`}>
            {PLAN_ITEM_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PLAN_ITEM_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Hareket</label>
          <input
            name="label"
            required
            minLength={2}
            placeholder="Jab-cross-hook kombinasyonu"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Round</label>
          <input
            name="rounds"
            type="number"
            min={1}
            max={50}
            placeholder="ops."
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Süre (dk)</label>
          <input
            name="durationMinutes"
            type="number"
            min={1}
            max={120}
            placeholder="3"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Dinlenme (sn)</label>
          <input
            name="restSeconds"
            type="number"
            min={0}
            max={3600}
            placeholder="60"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Hedef RPE</label>
          <input
            name="targetRpe"
            type="number"
            min={1}
            max={10}
            placeholder="7"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Teknik Slug (opsiyonel)</label>
          <input
            name="techniqueSlug"
            placeholder="jab"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className={labelClass}>Not (opsiyonel)</label>
          <input
            name="notes"
            placeholder="Eller çeneden ayrılmasın"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={ghostButton}>
        {pending ? "Ekleniyor…" : "Hareket Ekle"}
      </button>
    </form>
  );
}

/** Bir haftayı olduğu gibi başka haftaya kopyalar. */
export function CopyWeekForm({
  templateId,
  weeks,
  currentWeek,
}: {
  templateId: string;
  weeks: number;
  currentWeek: number;
}) {
  const [state, formAction, pending] = useActionState(
    copyWeekAction.bind(null, templateId),
    initialState,
  );

  const weekOptions = Array.from({ length: weeks }, (_, index) => index + 1);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Kaynak Hafta</label>
          <select
            name="fromWeek"
            defaultValue={currentWeek}
            className={`mt-1 ${inputClass}`}
          >
            {weekOptions.map((week) => (
              <option key={week} value={week}>
                {week}. hafta
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Hedef Hafta</label>
          <select
            name="toWeek"
            defaultValue={Math.min(currentWeek + 1, weeks)}
            className={`mt-1 ${inputClass}`}
          >
            {weekOptions.map((week) => (
              <option key={week} value={week}>
                {week}. hafta
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[0.7rem] text-brand-muted">
        Hedef haftadaki günler silinip kaynağın kopyası yazılır. Round sayısını
        kopyaladıktan sonra artırmak, her haftayı sıfırdan yazmaktan hızlı.
      </p>

      <Feedback state={state} />

      <button type="submit" disabled={pending} className={ghostButton}>
        {pending ? "Kopyalanıyor…" : "Haftayı Kopyala"}
      </button>
    </form>
  );
}

/**
 * Şablonu siler. Atanmış şablonda sunucu reddeder ve gerekçeyi döner —
 * düğmeyi gizlemek yerine nedenini göstermek antrenörü "yayından kaldır"a
 * yönlendiriyor.
 */
export function DeleteTemplateButton({
  templateId,
  assignmentCount,
}: {
  templateId: string;
  assignmentCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    deleteTemplateAction.bind(null, templateId),
    initialState,
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending || assignmentCount > 0}
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-red-400/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-40 sm:min-h-8"
        >
          {pending ? "Siliniyor…" : "Şablonu Sil"}
        </button>
      </form>

      {assignmentCount > 0 && (
        <p className="text-[0.7rem] text-brand-muted">
          {assignmentCount} sporcuya atanmış — silinemez. Yeni atamalara
          kapatmak için yayından kaldır.
        </p>
      )}

      <Feedback state={state} />
    </div>
  );
}
