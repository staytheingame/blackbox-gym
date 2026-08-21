import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getTrainingLogs } from "@/lib/queries/performance";
import { formatDateTR } from "@/lib/date";
import { TrainingLogForm } from "./TrainingLogForm";

export const metadata: Metadata = {
  title: "Antrenman — BlackBox",
};

const typeLabels: Record<string, string> = {
  boks: "Boks",
  kickbox: "Kickbox",
  fight_prep: "Fight Prep",
  kondisyon: "Kondisyon",
};

export default async function TrainingLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const logs = await getTrainingLogs(member.id);

  return (
    <div>
      <PageHero
        eyebrow="Antrenman"
        title="Antrenman Geçmişin"
        description="Yeni bir antrenman logla veya geçmiş kayıtlarını gör."
      />
      <section className="mx-auto max-w-3xl space-y-10 px-4 py-14 sm:px-6">
        <div className="rounded-sm border border-brand-border bg-brand-surface p-6">
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Yeni Kayıt
          </h2>
          <div className="mt-4">
            <TrainingLogForm />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Geçmiş
          </h2>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">
              Henüz antrenman kaydın yok.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-brand-border rounded-sm border border-brand-border bg-brand-surface">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-semibold text-brand-white">
                      {typeLabels[log.type] ?? log.type}
                    </span>
                    <span className="ml-2 text-xs text-brand-muted">
                      {formatDateTR(log.loggedAt)}
                    </span>
                  </div>
                  <div className="text-xs text-brand-muted">
                    {log.durationMinutes} dk
                    {log.rounds ? ` · ${log.rounds} round` : ""} · RPE{" "}
                    {log.intensity}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
