import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import {
  getNotificationStats,
  listOrganizationNotifications,
} from "@/lib/queries/notifications";
import {
  NOTIFICATION_KIND_LABEL,
  type NotificationKind,
} from "@/domain/notifications/kinds";
import {
  EMAIL_PROVIDER_LABEL,
  configuredChannels,
  emailProvider,
} from "@/lib/notifications/channels";
import {
  DEFAULT_REMINDER_CONFIG,
  PACKAGE_WARN_DAYS,
  PACKAGE_WARN_SESSIONS,
} from "@/domain/notifications/schedule";
import { formatDateTimeTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { RunRemindersForm } from "./RunRemindersForm";

export const metadata: Metadata = { title: "Bildirimler — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  const [stats, rows] = await Promise.all([
    getNotificationStats(membership.organizationId),
    listOrganizationNotifications(membership.organizationId, 100),
  ]);

  const channels = configuredChannels();
  const externalChannels = channels.filter((channel) => channel !== "uygulama");
  const provider = emailProvider();

  return (
    <PanelPage
      title="Bildirim Kuyruğu"
      description="Salonda kime hangi hatırlatmanın gittiği. Kuyruk ve geçmiş aynı yerde; aynı hatırlatma iki kez düşmez."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam" value={stats.total} />
        <StatCard label="Son 24 Saat" value={stats.last24h} />
        <StatCard label="Okunmamış" value={stats.unread} />
        <StatCard
          label="Dış Kanal"
          value={externalChannels.length === 0 ? "Yok" : externalChannels.length}
          hint={
            externalChannels.length === 0
              ? "Yalnız uygulama içi"
              : externalChannels.join(", ")
          }
        />
      </div>

      <PanelCard
        title="Hatırlatma İşi"
        description="Zamanlanmış iş her akşam ve her sabah çalışır. Buradan elle de tetikleyebilirsin — tekrar basmak zararsızdır."
      >
        <RunRemindersForm />

        <ul className="mt-5 space-y-2 text-sm text-brand-muted">
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              Ders hatırlatması: bir gün önce{" "}
              {DEFAULT_REMINDER_CONFIG.eveningHour}:00 ve ders günü 0
              {DEFAULT_REMINDER_CONFIG.sameDayHour}:00.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              Paket uyarısı: {PACKAGE_WARN_DAYS} gün ya da{" "}
              {PACKAGE_WARN_SESSIONS} ders kalınca sporcuya ve antrenöre.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              Uygulama içi kutu her zaman çalışır.{" "}
              {provider ? (
                <>
                  E-posta kanalı açık:{" "}
                  <strong className="text-brand-white">
                    {EMAIL_PROVIDER_LABEL[provider]}
                  </strong>
                  .
                </>
              ) : (
                <>
                  E-posta kanalı kapalı — ücretsiz açmak için{" "}
                  <code>BREVO_API_KEY</code> (günde 300) ya da{" "}
                  <code>RESEND_API_KEY</code> (ayda 3.000) ve{" "}
                  <code>NOTIFY_FROM_EMAIL</code> tanımla.
                </>
              )}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-yellow">·</span>
            <span>
              WhatsApp hatırlatması sağlayıcı tarafında konuşma başına
              ücretlidir; kod hazır ama ücretsiz bir yolu yok.
            </span>
          </li>
        </ul>
      </PanelCard>

      {stats.byKind.length > 0 && (
        <PanelCard title="Tür Dağılımı">
          <div className="flex flex-wrap gap-2">
            {stats.byKind.map((row) => (
              <Pill key={row.kind}>
                {NOTIFICATION_KIND_LABEL[row.kind as NotificationKind] ??
                  row.kind}
                : {row.count}
              </Pill>
            ))}
          </div>
        </PanelCard>
      )}

      <PanelCard title={`Son Gönderimler (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState>
            Henüz bildirim üretilmedi. Rezervasyonlar oluştukça hatırlatmalar
            burada görünür.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-brand-muted">
                  <th className="py-2 pr-3">Zaman</th>
                  <th className="py-2 pr-3">Alıcı</th>
                  <th className="py-2 pr-3">Tür</th>
                  <th className="py-2 pr-3">Başlık</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-brand-border/60">
                    <td className="py-2 pr-3 text-xs text-brand-muted">
                      {formatDateTimeTR(row.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-brand-white">
                      {row.recipient}
                      {row.memberName && row.memberName !== row.recipient && (
                        <span className="block text-brand-muted">
                          konu: {row.memberName}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-brand-muted">
                      {NOTIFICATION_KIND_LABEL[row.kind] ?? row.kind}
                    </td>
                    <td className="py-2 pr-3 text-xs text-brand-white">
                      {row.title}
                    </td>
                    <td className="py-2 text-xs">
                      {row.readAt ? (
                        <span className="text-brand-muted">Okundu</span>
                      ) : (
                        <span className="text-brand-yellow">Okunmadı</span>
                      )}
                      {row.error && (
                        <span className="block text-red-300">{row.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </PanelPage>
  );
}
