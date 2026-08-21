import Link from "next/link";
import { formatDateTimeTR } from "@/lib/date";
import {
  NOTIFICATION_KIND_LABEL,
  type NotificationKind,
} from "@/domain/notifications/kinds";
import { EmptyState, Pill } from "@/components/panel/ui";
import type { NotificationView } from "@/lib/queries/notifications";

/**
 * Bildirim kutusu listesi — üye, antrenör ve yönetici panellerinde aynı.
 * Okunmamışlar sol kenardan sarı şeritle ayrılır; tıklanınca ilgili ekrana
 * gider (`href`), böylece bildirim bir işin başlangıcı olur, duyuru değil.
 */
export function NotificationList({
  notifications,
  emptyText = "Henüz bildirim yok.",
}: {
  notifications: NotificationView[];
  emptyText?: string;
}) {
  if (notifications.length === 0) {
    return <EmptyState>{emptyText}</EmptyState>;
  }

  return (
    <ul className="divide-y divide-brand-border">
      {notifications.map((item) => {
        const unread = item.readAt === null;
        const body = (
          <div
            className={`flex flex-col gap-1 border-l-2 py-4 pl-4 first:pt-0 ${
              unread ? "border-brand-yellow" : "border-transparent"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-sm font-semibold ${
                  unread ? "text-brand-white" : "text-brand-muted"
                }`}
              >
                {item.title}
              </span>
              <span className="text-[0.7rem] text-brand-muted">
                {formatDateTimeTR(item.createdAt)}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-brand-muted">
              {item.body}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill>
                {NOTIFICATION_KIND_LABEL[item.kind as NotificationKind] ??
                  item.kind}
              </Pill>
              {unread && <Pill tone="yellow">Yeni</Pill>}
            </div>
          </div>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="block transition-colors hover:bg-brand-surface-2"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
