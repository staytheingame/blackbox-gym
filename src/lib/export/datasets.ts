import "server-only";
import { prisma } from "@/lib/db";
import { organizationScope } from "@/lib/auth/scope";
import { toCsv, csvFileName, type CsvColumn } from "@/lib/export/csv";
import { formatDateTR, formatDateTimeTR } from "@/lib/date";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/domain/booking/credits";
import { SLOT_KIND_LABEL } from "@/lib/queries/slots";
import { listRankBoard } from "@/lib/queries/ranks";
import { listWaiverBoard } from "@/lib/queries/waivers";
import { listAuditLog } from "@/lib/queries/audit";

/**
 * Dışa aktarılabilir veri setleri — "salonun defterini Excel'de aç".
 *
 * Her set tek bir soruya yanıt verir ve **kimliği olan** alanları yalnız
 * personel görebileceği yerlerde taşır (uçlar `requireStaff` ile korunur,
 * bkz. `app/api/export/[kind]/route.ts`).
 */

export const EXPORT_KINDS = [
  "sporcular",
  "yoklama",
  "uyelikler",
  "kusaklar",
  "onaylar",
  "denetim",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const EXPORT_KIND_LABEL: Record<ExportKind, string> = {
  sporcular: "Sporcu listesi",
  yoklama: "Yoklama & rezervasyon dökümü",
  uyelikler: "Üyelik dökümü",
  kusaklar: "Kuşak durumu",
  onaylar: "Onam & sağlık beyanı durumu",
  denetim: "Denetim kaydı",
};

export const EXPORT_KIND_HINT: Record<ExportKind, string> = {
  sporcular: "Ad, üye no, iletişim, durum, kayıt tarihi.",
  yoklama: "Son 12 ayın tüm rezervasyonları ve yoklama sonuçları.",
  uyelikler: "Paket, dönem, ders hakkı ve durum.",
  kusaklar: "Güncel kuşak, hedef kuşak, ilerleme yüzdesi.",
  onaylar: "Eksik/eski imzalar ve sağlık notu bulunan sporcular.",
  denetim: "Son 500 yönetim işlemi — kim, ne zaman, ne yaptı.",
};

export type ExportFile = { fileName: string; csv: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function membersCsv(organizationId: string): Promise<string> {
  const rows = await prisma.member.findMany({
    where: { organizationId },
    orderBy: { fullName: "asc" },
    include: {
      user: { select: { email: true } },
      homeBranch: { select: { name: true } },
    },
  });

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "Üye No", value: (row) => row.memberNo },
    { header: "Ad Soyad", value: (row) => row.fullName },
    { header: "E-posta", value: (row) => row.email ?? row.user?.email ?? "" },
    { header: "Telefon", value: (row) => row.phone },
    { header: "Durum", value: (row) => row.status },
    { header: "Şube", value: (row) => row.homeBranch?.name },
    { header: "Hesap Kuruldu", value: (row) => (row.userId ? "evet" : "hayır") },
    { header: "Hatırlatma", value: (row) => (row.remindersEnabled ? "açık" : "kapalı") },
    { header: "Kayıt Tarihi", value: (row) => formatDateTR(row.createdAt) },
    {
      header: "Anonimleştirildi",
      value: (row) => (row.anonymizedAt ? formatDateTR(row.anonymizedAt) : ""),
    },
  ];

  return toCsv(rows, columns);
}

async function attendanceCsv(organizationId: string): Promise<string> {
  const since = new Date(Date.now() - 365 * MS_PER_DAY);

  const rows = await prisma.slotBooking.findMany({
    where: { slot: { organizationId, startsAt: { gte: since } } },
    orderBy: { slot: { startsAt: "desc" } },
    include: {
      member: { select: { fullName: true, memberNo: true } },
      slot: {
        select: { startsAt: true, durationMinutes: true, kind: true, title: true },
      },
    },
  });

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "Tarih", value: (row) => formatDateTimeTR(row.slot.startsAt) },
    { header: "Üye No", value: (row) => row.member.memberNo },
    { header: "Sporcu", value: (row) => row.member.fullName },
    {
      header: "Ders Türü",
      value: (row) => SLOT_KIND_LABEL[row.slot.kind] ?? row.slot.kind,
    },
    { header: "Başlık", value: (row) => row.slot.title },
    { header: "Süre (dk)", value: (row) => row.slot.durationMinutes },
    {
      header: "Durum",
      value: (row) =>
        BOOKING_STATUS_LABEL[row.status as BookingStatus] ?? row.status,
    },
    { header: "Not", value: (row) => row.note },
  ];

  return toCsv(rows, columns);
}

async function subscriptionsCsv(organizationId: string): Promise<string> {
  const rows = await prisma.memberSubscription.findMany({
    where: { member: { organizationId } },
    orderBy: { endDate: "desc" },
    include: {
      member: { select: { fullName: true, memberNo: true } },
      plan: { select: { name: true, durationDays: true } },
    },
  });

  const bookingCounts = await prisma.slotBooking.groupBy({
    by: ["memberId", "status"],
    where: { member: { organizationId } },
    _count: { _all: true },
  });

  const usedByMember = new Map<string, number>();
  for (const row of bookingCounts) {
    if (row.status !== "katildi" && row.status !== "gelmedi") continue;
    usedByMember.set(
      row.memberId,
      (usedByMember.get(row.memberId) ?? 0) + row._count._all,
    );
  }

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "Üye No", value: (row) => row.member.memberNo },
    { header: "Sporcu", value: (row) => row.member.fullName },
    { header: "Paket", value: (row) => row.plan.name },
    { header: "Başlangıç", value: (row) => formatDateTR(row.startDate) },
    { header: "Bitiş", value: (row) => formatDateTR(row.endDate) },
    { header: "Durum", value: (row) => row.status },
    {
      header: "Paket Ders",
      value: (row) => (row.sessionsTotal === null ? "sınırsız" : row.sessionsTotal),
    },
    {
      header: "Harcanan Ders (toplam)",
      value: (row) => usedByMember.get(row.memberId) ?? 0,
    },
    { header: "Not", value: (row) => row.note },
  ];

  return toCsv(rows, columns);
}

async function ranksCsv(organizationId: string): Promise<string> {
  const rows = await listRankBoard(organizationScope(organizationId));

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "Üye No", value: (row) => row.memberNo },
    { header: "Sporcu", value: (row) => row.memberName },
    { header: "Güncel Kuşak", value: (row) => row.currentRankName ?? "—" },
    { header: "Hedef Kuşak", value: (row) => row.nextRankName ?? "—" },
    { header: "İlerleme (%)", value: (row) => row.percent },
    { header: "Terfiye Hazır", value: (row) => (row.ready ? "evet" : "hayır") },
    { header: "Eksikler", value: (row) => row.missing.join(" · ") },
  ];

  return toCsv(rows, columns);
}

async function waiversCsv(organizationId: string): Promise<string> {
  const rows = await listWaiverBoard(organizationScope(organizationId));

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "Üye No", value: (row) => row.memberNo },
    { header: "Sporcu", value: (row) => row.memberName },
    { header: "Eksik İmza", value: (row) => row.missingCount },
    { header: "Eski Sürüm", value: (row) => row.outdatedCount },
    { header: "Bekleyen Toplam", value: (row) => row.pendingCount },
    { header: "Sağlık Notu", value: (row) => row.healthNotes.join(" · ") },
  ];

  return toCsv(rows, columns);
}

async function auditCsv(organizationId: string): Promise<string> {
  const rows = await listAuditLog(organizationId, { limit: 500 });

  const columns: CsvColumn<(typeof rows)[number]>[] = [
    { header: "Tarih", value: (row) => formatDateTimeTR(row.createdAt) },
    { header: "Kim", value: (row) => row.actorLabel },
    { header: "İşlem", value: (row) => row.actionLabel },
    { header: "Kayıt Türü", value: (row) => row.entityType },
    { header: "Kayıt", value: (row) => row.entityId },
    { header: "Özet", value: (row) => row.summary },
  ];

  return toCsv(rows, columns);
}

export async function buildExport(
  kind: ExportKind,
  organizationId: string,
): Promise<ExportFile> {
  const builders: Record<ExportKind, () => Promise<string>> = {
    sporcular: () => membersCsv(organizationId),
    yoklama: () => attendanceCsv(organizationId),
    uyelikler: () => subscriptionsCsv(organizationId),
    kusaklar: () => ranksCsv(organizationId),
    onaylar: () => waiversCsv(organizationId),
    denetim: () => auditCsv(organizationId),
  };

  return {
    fileName: csvFileName(`blackbox-${kind}`),
    csv: await builders[kind](),
  };
}

export function isExportKind(value: string): value is ExportKind {
  return (EXPORT_KINDS as readonly string[]).includes(value);
}
