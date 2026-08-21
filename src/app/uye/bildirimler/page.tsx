import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { countUnread, listNotifications } from "@/lib/queries/notifications";
import { NotificationList } from "@/components/panel/NotificationList";
import { PanelCard, PanelPage, StatCard } from "@/components/panel/ui";
import { markAllReadAction } from "@/app/bildirim-actions";
import { ReminderToggle } from "./ReminderToggle";

export const metadata: Metadata = { title: "Bildirimler — BlackBox" };

export const dynamic = "force-dynamic";

export default async function MemberNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, 60),
    countUnread(user.id),
  ]);

  return (
    <PanelPage
      title="Bildirimler"
      description="Ders hatırlatmaların, rezervasyon onayların ve üyelik uyarıların. Hatırlatmalar dersten bir gün önce akşam ve dersin olduğu gün gelir."
      action={
        unread > 0 ? (
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
            >
              Hepsini Okundu İşaretle
            </button>
          </form>
        ) : undefined
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Okunmamış" value={unread} highlight={unread > 0} />
        <StatCard
          label="Toplam"
          value={notifications.length}
          hint="Son 60 bildirim"
        />
        <StatCard
          label="Hatırlatma"
          value={member.remindersEnabled ? "Açık" : "Kapalı"}
          hint="Ders hatırlatmaları"
        />
      </div>

      <PanelCard
        title="Hatırlatma Tercihi"
        description="Kapatırsan ders hatırlatmaları ve üyelik uyarıları gelmez; rezervasyon onayı gibi doğrudan cevaplar gelmeye devam eder."
      >
        <ReminderToggle enabled={member.remindersEnabled} />
      </PanelCard>

      <PanelCard title="Kutu">
        <NotificationList
          notifications={notifications}
          emptyText="Henüz bildirim yok. Ders rezervasyonu yaptığında hatırlatmaların burada birikir."
        />
      </PanelCard>
    </PanelPage>
  );
}
