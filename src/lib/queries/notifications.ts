import "server-only";
import { prisma } from "@/lib/db";
import type {
  NotificationDraft,
  NotificationKind,
} from "@/domain/notifications/kinds";
import { configuredChannels, deliver } from "@/lib/notifications/channels";

/**
 * Bildirim kutusu — kuyruk ve geçmiş aynı tablo.
 *
 * `enqueue` iki kez çağrılırsa ikinci çağrı sessizce düşer: `dedupeKey`
 * benzersizdir. Zamanlanmış iş günde birkaç kez çalışsa da sporcu aynı
 * hatırlatmayı bir kez görür.
 */

export type EnqueueInput = NotificationDraft & {
  organizationId: string;
  userId: string;
  memberId?: string | null;
};

/** Yeni bildirim yazar; aynı `dedupeKey` varsa `false` döner. */
export async function enqueueNotification(
  input: EnqueueInput,
): Promise<boolean> {
  return (await enqueueMany([input])) > 0;
}

export async function enqueueMany(inputs: EnqueueInput[]): Promise<number> {
  if (inputs.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: inputs.map((input) => ({
      organizationId: input.organizationId,
      userId: input.userId,
      memberId: input.memberId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey,
      scheduledFor: input.scheduledFor,
      status: "gonderildi",
      sentAt: new Date(),
    })),
    skipDuplicates: true,
  });

  if (result.count > 0) {
    await deliverExternal(inputs.map((input) => input.dedupeKey));
  }

  return result.count;
}

/**
 * Yeni yazılmış bildirimleri dış kanala (e-posta/WhatsApp) verir.
 *
 * `dedupeKey` üzerinden okunur çünkü `createMany` id döndürmez ve
 * `skipDuplicates` yüzünden hangilerinin gerçekten yazıldığı belli değildir.
 * Yalnız DAHA ÖNCE dış kanala verilmemiş satırlar (`channel = "uygulama"`)
 * işlenir — böylece tekrar çağrı ikinci e-posta göndermez.
 *
 * Hata bildirimi düşürmez: satır kutuda kalır, `error` alanına sebep yazılır
 * ve yönetici bunu bildirim dökümünde görür.
 */
async function deliverExternal(dedupeKeys: string[]): Promise<void> {
  const channels = configuredChannels().filter(
    (channel) => channel !== "uygulama",
  );
  if (channels.length === 0 || dedupeKeys.length === 0) return;

  const rows = await prisma.notification.findMany({
    where: { dedupeKey: { in: dedupeKeys }, channel: "uygulama" },
    select: {
      id: true,
      title: true,
      body: true,
      user: {
        select: {
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      member: { select: { phone: true } },
    },
  });

  for (const row of rows) {
    for (const channel of channels) {
      const result = await deliver({
        channel,
        target: {
          email: row.user.email,
          phone: row.member?.phone ?? null,
          displayName: row.user.profile?.displayName ?? row.user.email,
        },
        title: row.title,
        body: row.body,
      });

      await prisma.notification.update({
        where: { id: row.id },
        data: result.ok
          ? { channel, status: "gonderildi", error: null }
          : { status: "basarisiz", error: result.error?.slice(0, 500) ?? null },
      });

      // İlk başarılı kanal yeterli — aynı hatırlatmayı hem e-posta hem
      // WhatsApp ile göndermek sporcuyu iki kez rahatsız eder.
      if (result.ok) break;
    }
  }
}

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export async function listNotifications(
  userId: string,
  limit = 50,
): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt,
    readAt: row.readAt,
  }));
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export type NotificationLogRow = NotificationView & {
  recipient: string;
  memberName: string | null;
  status: string;
  channel: string;
  scheduledFor: Date;
  error: string | null;
};

/** Yönetici panelindeki bildirim dökümü — kim ne aldı. */
export async function listOrganizationNotifications(
  organizationId: string,
  limit = 100,
): Promise<NotificationLogRow[]> {
  const rows = await prisma.notification.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { email: true, profile: { select: { displayName: true } } } },
      member: { select: { fullName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    href: row.href,
    createdAt: row.createdAt,
    readAt: row.readAt,
    recipient: row.user.profile?.displayName ?? row.user.email,
    memberName: row.member?.fullName ?? null,
    status: row.status,
    channel: row.channel,
    scheduledFor: row.scheduledFor,
    error: row.error,
  }));
}

export type NotificationStats = {
  total: number;
  unread: number;
  last24h: number;
  byKind: { kind: string; count: number }[];
};

export async function getNotificationStats(
  organizationId: string,
): Promise<NotificationStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, unread, last24h, grouped] = await Promise.all([
    prisma.notification.count({ where: { organizationId } }),
    prisma.notification.count({ where: { organizationId, readAt: null } }),
    prisma.notification.count({
      where: { organizationId, createdAt: { gte: since } },
    }),
    prisma.notification.groupBy({
      by: ["kind"],
      where: { organizationId },
      _count: { kind: true },
    }),
  ]);

  return {
    total,
    unread,
    last24h,
    byKind: grouped
      .map((row) => ({ kind: row.kind, count: row._count.kind }))
      .sort((a, b) => b.count - a.count),
  };
}
