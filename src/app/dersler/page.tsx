import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { weeklySchedule } from "@/data/classes";

export const metadata: Metadata = {
  title: "Dersler — BlackBox",
  description: "BlackBox haftalık boks, kickbox ve fight-prep ders programı.",
};

export default function ClassesPage() {
  return (
    <div>
      <PageHero
        eyebrow="Dersler"
        title="Haftalık Ders Programı"
        description="Kapasite ve rezervasyon detayları üyelik girişinden sonra görünür. Aşağıda genel program yer alıyor."
      />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {weeklySchedule.map((day) => (
            <div
              key={day.day}
              className="rounded-sm border border-brand-border bg-brand-surface p-5"
            >
              <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
                {day.day}
              </h2>
              <ul className="mt-4 divide-y divide-brand-border">
                {day.sessions.map((session) => (
                  <li
                    key={`${day.day}-${session.time}-${session.name}`}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {session.name}
                      </div>
                      <div className="text-xs text-brand-muted">
                        {session.coach} · {session.level}
                      </div>
                    </div>
                    <span className="font-display text-sm text-brand-white">
                      {session.time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
