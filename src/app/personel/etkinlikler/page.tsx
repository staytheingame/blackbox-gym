import type { Metadata } from "next";
import { EVENT_TYPE_LABEL, gymEvents } from "@/data/events";
import { formatDateTR } from "@/lib/date";
import {
  PanelCard,
  PanelPage,
  Pill,
  Scaffold,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Etkinlikler — BlackBox Panel" };

export default function StaffEventsPage() {
  const totalCapacity = gymEvents.reduce((sum, e) => sum + e.capacity, 0);
  const totalRegistered = gymEvents.reduce((sum, e) => sum + e.registered, 0);

  return (
    <PanelPage
      title="Etkinlik Yönetimi"
      description="Sparring geceleri, seminerler, seviye testleri ve iç turnuvalar."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Yaklaşan Etkinlik" value={gymEvents.length} />
        <StatCard
          label="Toplam Kayıt"
          value={totalRegistered}
          hint={`${totalCapacity} kontenjan içinde`}
        />
        <StatCard
          label="Doluluk"
          value={Math.round((totalRegistered / totalCapacity) * 100)}
          suffix="%"
        />
      </div>

      <PanelCard title="Yaklaşan Etkinlikler">
        <ul className="divide-y divide-brand-border">
          {gymEvents.map((event) => (
            <li
              key={event.slug}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <div className="text-sm font-semibold text-brand-white">
                  {event.title}
                </div>
                <div className="text-xs text-brand-muted">
                  {formatDateTR(new Date(event.date))} · {event.time} ·{" "}
                  {event.level}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Pill>{EVENT_TYPE_LABEL[event.type]}</Pill>
                <Pill tone={event.registered >= event.capacity ? "danger" : "yellow"}>
                  {event.registered}/{event.capacity}
                </Pill>
              </div>
            </li>
          ))}
        </ul>
      </PanelCard>

      <Scaffold
        mirrors="Kong Academy → Koç / Etkinlikler"
        summary="Liste statik örnek veriden geliyor; etkinlik oluşturma ve katılımcı yönetimi veri modeli geldiğinde açılacak."
        features={[
          "Etkinlik oluşturma/düzenleme (tarih, kontenjan, seviye)",
          "Katılımcı listesi ve yoklama",
          "Yedek listesi yönetimi",
          "Katılımdan puan/rozet tetikleme",
        ]}
        needs={[
          "`Event` + `EventParticipant` tabloları",
          "Duyuru modülüyle bağ (etkinlik duyurusu)",
          "Yoklama → `TrainingLog` bağlantısı",
        ]}
      />
    </PanelPage>
  );
}
