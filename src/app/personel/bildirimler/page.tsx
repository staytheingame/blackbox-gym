import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { countUnread, listNotifications } from "@/lib/queries/notifications";
import { NotificationList } from "@/components/panel/NotificationList";
import { PanelCard, PanelPage, StatCard } from "@/components/panel/ui";
import { markAllReadAction } from "@/app/bildirim-actions";
import {
  DEFAULT_REMINDER_CONFIG,
  PACKAGE_WARN_DAYS,
  PACKAGE_WARN_SESSIONS,
} from "@/domain/notifications/schedule";

export const metadata: Metadata = { title: "Bildirimler — BlackBox Panel" };

export const dynamic = "force-dynamic";

export default async function StaffNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  await requireStaff(user.id);

  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, 60),
    countUnread(user.id),
  ]);

  return (
    <PanelPage
      title="Bildirimler"
      description="Sana gelen uyarılar: yarının ders özeti, paketi bitmek üzere olan sporcular, bekleyen işler."
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
      <div className="grid gap-5 sm:grid-cols-2">
        <StatCard label="Okunmamış" value={unread} highlight={unread > 0} />
        <StatCard
          label="Toplam"
          value={notifications.length}
          hint="Son 60 bildirim"
        />
      </div>

      <PanelCard title="Kutu">
        <NotificationList
          notifications={notifications}
          emptyText="Sana gelen bir uyarı yok. Hatırlatma işi her akşam ve her sabah çalışır."
        />
      </PanelCard>

      <PanelCard
        title="Hatırlatmalar Nasıl Çalışıyor"
        description="Sporcuya giden hatırlatmalar otomatiktir; ayrıca 'Bugün' ekranından elden hatırlatma gönderebilirsin."
      >
        <ul className="space-y-2 text-sm text-brand-muted">
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              <strong className="text-brand-white">
                Dersten bir gün önce {DEFAULT_REMINDER_CONFIG.eveningHour}:00
              </strong>{" "}
              — &quot;yarın dersin var&quot;. Gelemeyecek sporcu akşamdan iptal
              eder, yer boşa gitmez.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              <strong className="text-brand-white">
                Dersin olduğu gün 0{DEFAULT_REMINDER_CONFIG.sameDayHour}:00
              </strong>{" "}
              — unutmasın diye ikinci hatırlatma.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              <strong className="text-brand-white">Paket uyarısı</strong> —
              üyeliğe {PACKAGE_WARN_DAYS} gün ya da {PACKAGE_WARN_SESSIONS} ders
              kalınca hem sporcuya hem sana düşer.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              Hesabını kurmamış sporcuya bildirim{" "}
              <strong className="text-brand-white">gitmez</strong> — onları{" "}
              <Link
                href="/personel/davetler"
                className="font-semibold text-brand-yellow hover:underline"
              >
                Davetler
              </Link>{" "}
              sayfasında görürsün.
            </span>
          </li>
        </ul>
      </PanelCard>
    </PanelPage>
  );
}
