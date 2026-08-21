import type { Metadata } from "next";
import { EVENT_TYPE_LABEL, gymEvents } from "@/data/events";
import { formatDateTR } from "@/lib/date";
import { PanelCard, PanelPage, Pill, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Etkinlikler — BlackBox Panel" };

export default function MemberEventsPage() {
  return (
    <PanelPage
      title="Sparring Geceleri & Etkinlikler"
      description="Yaklaşan sparring geceleri, seminerler, seviye testleri ve iç turnuvalar."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {gymEvents.map((event) => {
          const full = event.registered >= event.capacity;
          return (
            <PanelCard
              key={event.slug}
              title={event.title}
              description={`${formatDateTR(new Date(event.date))} · ${event.time}`}
              action={<Pill tone="yellow">{EVENT_TYPE_LABEL[event.type]}</Pill>}
            >
              <p className="text-sm leading-relaxed text-brand-muted">
                {event.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>Seviye: {event.level}</Pill>
                <Pill tone={full ? "danger" : "neutral"}>
                  {event.registered}/{event.capacity} kayıt
                </Pill>
              </div>
            </PanelCard>
          );
        })}
      </div>

      <Scaffold
        mirrors="Kong Academy → Danışan / Etkinlikler"
        summary="Etkinlik içerikleri şu an statik örnek veriden geliyor; katılım bildirme ve kontenjan takibi veri modeli geldiğinde açılacak."
        features={[
          "Katılım bildir / vazgeç",
          "Kontenjan dolunca yedek listesi",
          "Etkinlik hatırlatma bildirimi",
          "Katıldığın etkinlikten puan ve rozet",
        ]}
        needs={[
          "`Event` + `EventParticipant` tabloları",
          "Personel tarafında etkinlik oluşturma ekranı",
          "Kontenjan/yedek kuralları",
        ]}
      />
    </PanelPage>
  );
}
