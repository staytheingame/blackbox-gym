import { toggleRemindersAction } from "./actions";

export function ReminderToggle({ enabled }: { enabled: boolean }) {
  return (
    <form
      action={toggleRemindersAction}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div>
        <div className="text-sm font-semibold text-brand-white">
          Ders hatırlatmaları {enabled ? "açık" : "kapalı"}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-brand-muted">
          Açıkken: dersten bir gün önce akşam 20:00 ve dersin olduğu gün sabah
          09:00 hatırlatma düşer. Üyeliğin bitmeye yaklaşınca da haber verilir.
        </p>
      </div>

      <button
        type="submit"
        className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
          enabled
            ? "border border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
            : "bg-brand-yellow text-brand-black hover:bg-brand-white"
        }`}
      >
        {enabled ? "Kapat" : "Aç"}
      </button>
    </form>
  );
}
