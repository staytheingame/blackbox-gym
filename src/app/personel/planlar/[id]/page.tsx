import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { getPlanTemplateDetail } from "@/lib/queries/plans";
import {
  DAY_LABEL,
  PLAN_ITEM_KIND_LABEL,
  PLAN_KIND_LABEL,
  PLAN_LEVEL_LABEL,
  describePlanItem,
  type PlanKind,
  type PlanLevel,
} from "@/domain/plans/template";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  StatCard,
} from "@/components/panel/ui";
import { TemplateForm } from "../TemplateForm";
import {
  AddDayForm,
  AddItemForm,
  CopyWeekForm,
  DeleteTemplateButton,
  EditDayForm,
} from "./TemplateEditorForms";
import {
  deleteDayAction,
  deleteItemAction,
  moveItemAction,
  setTemplateActiveAction,
} from "../actions";
import { rowButtonClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Şablon — BlackBox Panel" };

export default async function StaffPlanTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);

  const template = await getPlanTemplateDetail(id);
  // Başka salonun şablonu "yok" sayılır — varlığını sızdırmayalım.
  if (!template || template.organizationId !== membership.organizationId) {
    notFound();
  }

  const rawWeek = Number(
    typeof query.hafta === "string" ? query.hafta : "1",
  );
  const week =
    Number.isInteger(rawWeek) && rawWeek >= 1 && rawWeek <= template.weeks
      ? rawWeek
      : 1;

  const weekDays = template.days.filter((day) => day.weekNumber === week);
  const takenDays = weekDays.map((day) => day.dayOfWeek);
  const itemCount = template.days.reduce(
    (sum, day) => sum + day.items.length,
    0,
  );
  const assignmentCount = template._count.assignments;

  return (
    <PanelPage
      title={template.name}
      description={
        template.summary ??
        `${PLAN_KIND_LABEL[template.kind as PlanKind] ?? template.kind} şablonu · ${template.weeks} hafta`
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/personel/planlar?tur=${template.kind}`}
            className={rowButtonClass}
          >
            ← Şablonlar
          </Link>
          <form
            action={setTemplateActiveAction.bind(
              null,
              template.id,
              !template.isActive,
            )}
          >
            <button type="submit" className={rowButtonClass}>
              {template.isActive ? "Yayından Kaldır" : "Yayına Al"}
            </button>
          </form>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Durum"
          value={template.isActive ? "Yayında" : "Kapalı"}
          highlight={template.isActive}
          hint={
            template.isActive
              ? "Sporcuya atanabilir"
              : "Yeni atamalara kapalı"
          }
        />
        <StatCard
          label="Seviye"
          value={PLAN_LEVEL_LABEL[template.level] ?? template.level}
          hint={`${template.weeks} hafta`}
        />
        <StatCard
          label="Tanımlı Gün"
          value={template.days.length}
          hint={`${itemCount} hareket`}
        />
        <StatCard label="Atama" value={assignmentCount} hint="Aktif + geçmiş" />
      </div>

      <PanelCard
        title="Haftalar"
        description="Bir haftayı kur, sonrakine kopyala, yükü artır. Sporcu programın kaçıncı haftasındaysa o haftanın günlerini görür."
      >
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: template.weeks }, (_, index) => index + 1).map(
            (weekNumber) => {
              const dayCount = template.days.filter(
                (day) => day.weekNumber === weekNumber,
              ).length;
              const activeWeek = weekNumber === week;

              return (
                <Link
                  key={weekNumber}
                  href={`/personel/planlar/${template.id}?hafta=${weekNumber}`}
                  className={`rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                    activeWeek
                      ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow"
                      : "border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
                  }`}
                >
                  {weekNumber}. hafta
                  <span className="ml-2 font-normal normal-case opacity-70">
                    {dayCount} gün
                  </span>
                </Link>
              );
            },
          )}
        </div>
      </PanelCard>

      <PanelCard
        title={`${week}. Hafta — Günler (${weekDays.length})`}
        description="Her gün bir odak ve altında sırayla yapılacak hareketler taşır."
      >
        {weekDays.length === 0 ? (
          <EmptyState>
            Bu haftada gün yok. Aşağıdaki formdan ekle ya da dolu bir haftayı
            kopyala.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            {weekDays.map((day) => (
              <div
                key={day.id}
                className="rounded-sm border border-brand-border bg-brand-surface-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm uppercase tracking-wide text-brand-yellow">
                      {DAY_LABEL[day.dayOfWeek]}
                    </h3>
                    <p className="mt-1 text-xs text-brand-muted">
                      {day.focus}
                      {day.notes ? ` · ${day.notes}` : ""}
                    </p>
                  </div>
                  <form action={deleteDayAction.bind(null, day.id, template.id)}>
                    <button type="submit" className={rowButtonClass}>
                      Günü Sil
                    </button>
                  </form>
                </div>

                {day.items.length === 0 ? (
                  <p className="mt-3 text-xs text-brand-muted">
                    Bu günde hareket yok.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-brand-border">
                    {day.items.map((item, index) => {
                      const meta = describePlanItem(item);
                      return (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                        >
                          <div className="text-sm">
                            <span className="text-brand-white">
                              {item.label}
                            </span>
                            <span className="ml-2 text-xs text-brand-muted">
                              {PLAN_ITEM_KIND_LABEL[item.kind] ?? item.kind}
                              {meta ? ` · ${meta}` : ""}
                            </span>
                            {item.notes && (
                              <span className="block text-xs text-brand-muted">
                                {item.notes}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {index > 0 && (
                              <form
                                action={moveItemAction.bind(
                                  null,
                                  item.id,
                                  template.id,
                                  "yukari",
                                )}
                              >
                                <button
                                  type="submit"
                                  title="Yukarı taşı"
                                  className={rowButtonClass}
                                >
                                  ↑
                                </button>
                              </form>
                            )}
                            {index < day.items.length - 1 && (
                              <form
                                action={moveItemAction.bind(
                                  null,
                                  item.id,
                                  template.id,
                                  "asagi",
                                )}
                              >
                                <button
                                  type="submit"
                                  title="Aşağı taşı"
                                  className={rowButtonClass}
                                >
                                  ↓
                                </button>
                              </form>
                            )}
                            <form
                              action={deleteItemAction.bind(
                                null,
                                item.id,
                                template.id,
                              )}
                            >
                              <button type="submit" className={rowButtonClass}>
                                Sil
                              </button>
                            </form>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brand-yellow">
                    Hareket Ekle
                  </summary>
                  <AddItemForm dayId={day.id} templateId={template.id} />
                </details>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brand-muted">
                    Günü Düzenle
                  </summary>
                  <EditDayForm
                    dayId={day.id}
                    templateId={template.id}
                    focus={day.focus}
                    notes={day.notes}
                  />
                </details>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard title={`${week}. Haftaya Gün Ekle`}>
        <AddDayForm
          templateId={template.id}
          weekNumber={week}
          takenDays={takenDays}
        />
      </PanelCard>

      {template.weeks > 1 && (
        <PanelCard title="Haftayı Kopyala">
          <CopyWeekForm
            templateId={template.id}
            weeks={template.weeks}
            currentWeek={week}
          />
        </PanelCard>
      )}

      <PanelCard
        title="Şablon Ayarları"
        description="Ad, tür, seviye, hafta sayısı ve özet."
      >
        <TemplateForm
          templateId={template.id}
          defaults={{
            name: template.name,
            kind: (template.kind as PlanKind) ?? "antrenman",
            level: (template.level as PlanLevel) ?? "baslangic",
            weeks: template.weeks,
            summary: template.summary ?? "",
          }}
        />

        <div className="mt-6 border-t border-brand-border pt-5">
          <DeleteTemplateButton
            templateId={template.id}
            assignmentCount={assignmentCount}
          />
        </div>
      </PanelCard>

      <p className="text-xs text-brand-muted">
        Şablonu bir sporcuya atamak için sporcu detay sayfasındaki{" "}
        <strong className="text-brand-white">Program Ata</strong> kartını kullan
        — <Link href="/personel/uyeler" className="text-brand-yellow hover:underline">Sporcular</Link>.
      </p>
    </PanelPage>
  );
}
