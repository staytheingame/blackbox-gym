import {
  DAY_LABEL,
  PLAN_ITEM_KIND_LABEL,
  type ActivePlanWeek,
} from "@/lib/queries/plans";
import { EmptyState, PanelCard, StatCard } from "@/components/panel/ui";

/**
 * Sporcunun bulunduğu haftanın program kartları. Antrenman ve kondisyon
 * ekranları aynı bileşeni kullanır — tek fark hangi türdeki planı
 * beslediğidir (bkz. `getActiveMemberPlan(memberId, kind)`).
 */
function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return seconds >= 60 ? `${Math.round(seconds / 60)} dk` : `${seconds} sn`;
}

export function PlanWeekStats({ plan }: { plan: ActivePlanWeek }) {
  const done = plan.days.filter((day) => day.completed).length;

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <StatCard
        label="Program"
        value={plan.templateName}
        hint={plan.kind === "kondisyon" ? "Kondisyon" : "Antrenman"}
      />
      <StatCard
        label="Bu Hafta"
        value={`${done}/${plan.days.length}`}
        suffix="gün"
        highlight={done < plan.days.length}
      />
      <StatCard
        label="Hafta"
        value={`${plan.currentWeek}/${plan.totalWeeks}`}
        hint={plan.finished ? "Program tamamlandı" : "Devam ediyor"}
      />
    </div>
  );
}

export function PlanWeekDays({
  plan,
  toggleDay,
}: {
  plan: ActivePlanWeek;
  /** Server action — `(memberPlanId, dayId, completed) => void` şeklinde bağlanır. */
  toggleDay: (
    memberPlanId: string,
    dayId: string,
    completed: boolean,
  ) => Promise<void>;
}) {
  if (plan.days.length === 0) {
    return (
      <PanelCard title={`${plan.currentWeek}. hafta`}>
        <EmptyState>
          Bu hafta için gün tanımlanmamış — antrenörün şablonu
          güncellediğinde burada görünecek.
        </EmptyState>
      </PanelCard>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {plan.days.map((day) => (
        <PanelCard
          key={day.id}
          title={DAY_LABEL[day.dayOfWeek]}
          description={day.focus}
          action={
            <form
              action={toggleDay.bind(
                null,
                plan.memberPlanId,
                day.id,
                day.completed,
              )}
            >
              <button
                type="submit"
                className={`rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  day.completed
                    ? "border-brand-yellow bg-brand-yellow text-brand-black"
                    : "border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
                }`}
              >
                {day.completed ? "Tamamlandı" : "Tamamla"}
              </button>
            </form>
          }
        >
          <ul className="space-y-2">
            {day.items.map((item) => {
              const meta = [
                item.rounds ? `${item.rounds} round` : null,
                formatDuration(item.durationSeconds),
                item.restSeconds ? `${item.restSeconds} sn dinlenme` : null,
                item.targetRpe ? `RPE ${item.targetRpe}` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={item.id} className="text-sm">
                  <span className="text-brand-white">{item.label}</span>
                  <span className="ml-2 text-xs text-brand-muted">
                    {PLAN_ITEM_KIND_LABEL[item.kind] ?? item.kind}
                    {meta ? ` · ${meta}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {day.notes && (
            <p className="mt-3 text-xs italic text-brand-muted">{day.notes}</p>
          )}
        </PanelCard>
      ))}
    </div>
  );
}

export function PlanFinishedNotice() {
  return (
    <div className="rounded-sm border border-brand-yellow bg-brand-surface-2 p-5 text-sm text-brand-white">
      Programın son haftasını da bitirdin — antrenörün yeni program atayana
      kadar son haftayı tekrar edebilirsin.
    </div>
  );
}
