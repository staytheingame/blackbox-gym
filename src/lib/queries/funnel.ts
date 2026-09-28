import "server-only";
import { prisma } from "@/lib/db";
import {
  isLeadStatus,
  summarizeLead,
  type LeadStatus,
  type ParsedLead,
} from "@/domain/funnel/lead";

/**
 * BAŞVURU FUNNEL'I — aday kaydı (herkese açık taraf) ve personel listesi.
 *
 * İki güvence:
 *   1. Tablo henüz yoksa (migration bekliyorsa) aday KAYBOLMAZ: bilgileri
 *      denetim kaydına yazılır, personel oradan okuyabilir.
 *   2. Personel ekranı tablo yoksa çökmez; `null` döner ve ekran "kurulum
 *      bekliyor" der.
 */

/** Herkese açık sayfa hangi salona yazar: en eski aktif salon (tek salonlu kurulum). */
export async function getPublicOrganization(): Promise<{
  id: string;
  name: string;
} | null> {
  return prisma.organization.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

const DEDUPE_WINDOW_MS = 15 * 60_000;

export type CreateLeadResult =
  | { ok: true; saved: boolean; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Adayı kaydeder. Aynı kişi (e-posta ya da telefon) aynı seçenek için 15
 * dakika içinde tekrar gönderirse (çift dokunuş, geri-ileri) yeni satır
 * AÇILMAZ, kullanıcıya yine "alındı" denir.
 */
export async function createFunnelLead(
  organizationId: string,
  lead: ParsedLead,
): Promise<CreateLeadResult> {
  try {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await prisma.funnelLead.findFirst({
      where: {
        organizationId,
        interest: lead.interest,
        createdAt: { gte: since },
        OR: [{ email: lead.email }, { phone: lead.phone }],
      },
      select: { id: true },
    });
    if (recent) return { ok: true, saved: true, duplicate: true };

    const now = new Date();
    await prisma.funnelLead.create({
      data: {
        organizationId,
        interest: lead.interest,
        forWhom: lead.forWhom,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        age: lead.age,
        childName: lead.childName,
        occupationGroup: lead.occupationGroup,
        dailyLoad: lead.dailyLoad,
        goals: lead.goals,
        preferredTimes: lead.preferredTimes,
        contactChannel: lead.contactChannel,
        contactTime: lead.contactTime,
        note: lead.note,
        kvkkConsentAt: now,
        marketingConsentAt: lead.marketingConsent ? now : null,
      },
      select: { id: true },
    });
    return { ok: true, saved: true, duplicate: false };
  } catch (error) {
    console.error("[basvuru] aday tabloya yazılamadı — denetim kaydına düşüyor", error);
  }

  // Tablo yok ya da veritabanı geçici olarak ulaşılamıyor: bilgi kaybolmasın.
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: null,
        actorLabel: "Başvuru sayfası",
        action: "basvuru.geldi",
        entityType: "FunnelLead",
        summary: summarizeLead(lead),
      },
    });
    return { ok: true, saved: false, duplicate: false };
  } catch (error) {
    console.error("[basvuru] yedek kayıt da yazılamadı", error);
    return {
      ok: false,
      error: "Başvurun şu an alınamadı. Birkaç dakika sonra tekrar dene.",
    };
  }
}

// ── Personel tarafı ───────────────────────────────────────────

export type LeadRow = {
  id: string;
  status: LeadStatus;
  interest: string;
  quotedPriceMinor: number | null;
  forWhom: string;
  fullName: string;
  email: string;
  phone: string;
  age: number;
  childName: string | null;
  occupationGroup: string | null;
  dailyLoad: string | null;
  goals: string[];
  preferredTimes: string[];
  contactChannel: string;
  contactTime: string | null;
  note: string | null;
  marketingConsent: boolean;
  createdAt: Date;
};

/** Tablo yoksa `null` — ekran "kurulum bekliyor" der, sayfa düşmez. */
export async function listFunnelLeads(
  organizationId: string,
  { status }: { status?: string } = {},
): Promise<LeadRow[] | null> {
  try {
    const rows = await prisma.funnelLead.findMany({
      where: {
        organizationId,
        ...(status && isLeadStatus(status) ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return rows.map((row) => ({
      id: row.id,
      status: isLeadStatus(row.status) ? row.status : "yeni",
      interest: row.interest,
      quotedPriceMinor: row.quotedPriceMinor,
      forWhom: row.forWhom,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      age: row.age,
      childName: row.childName,
      occupationGroup: row.occupationGroup,
      dailyLoad: row.dailyLoad,
      goals: row.goals,
      preferredTimes: row.preferredTimes,
      contactChannel: row.contactChannel,
      contactTime: row.contactTime,
      note: row.note,
      marketingConsent: row.marketingConsentAt !== null,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[basvuru] liste okunamadı", error);
    return null;
  }
}

/** Menü rozeti — henüz işlenmemiş başvuru sayısı; tablo yoksa 0. */
export async function countNewLeads(organizationId: string): Promise<number> {
  try {
    return await prisma.funnelLead.count({
      where: { organizationId, status: "yeni" },
    });
  } catch {
    return 0;
  }
}

export type LeadActionResult =
  | { ok: true; fullName: string }
  | { ok: false; error: string };

export async function setLeadStatus(
  id: string,
  organizationId: string,
  status: LeadStatus,
  handledByUserId: string,
): Promise<LeadActionResult> {
  try {
    const lead = await prisma.funnelLead.findFirst({
      where: { id, organizationId },
      select: { id: true, fullName: true },
    });
    if (!lead) return { ok: false, error: "Başvuru bulunamadı." };

    await prisma.funnelLead.update({
      where: { id: lead.id },
      data: { status, handledByUserId },
    });
    return { ok: true, fullName: lead.fullName };
  } catch (error) {
    console.error("[basvuru] durum güncellenemedi", error);
    return { ok: false, error: "Güncellenemedi, tekrar dene." };
  }
}

export async function deleteLead(
  id: string,
  organizationId: string,
): Promise<LeadActionResult> {
  try {
    const lead = await prisma.funnelLead.findFirst({
      where: { id, organizationId },
      select: { id: true, fullName: true },
    });
    if (!lead) return { ok: false, error: "Başvuru bulunamadı." };

    await prisma.funnelLead.delete({ where: { id: lead.id } });
    return { ok: true, fullName: lead.fullName };
  } catch (error) {
    console.error("[basvuru] silinemedi", error);
    return { ok: false, error: "Silinemedi, tekrar dene." };
  }
}
