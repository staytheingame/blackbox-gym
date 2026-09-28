import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isLeadStatus, type LeadStatus } from "@/domain/funnel/lead";
import {
  readStartAnswers,
  summarizeStartLead,
  type ParsedStartLead,
  type StartAnswers,
} from "@/domain/funnel/start";

/**
 * BAŞLANGIÇ FORMU — görüşme talebi kaydı (herkese açık taraf) ve personel listesi.
 *
 * `funnel.ts` ile aynı iki güvence:
 *   1. Tablo henüz yoksa talep KAYBOLMAZ: bilgileri denetim kaydına yazılır.
 *   2. Personel ekranı tablo yoksa çökmez; `null` döner, ekran bu kaynağı atlar.
 */

const DEDUPE_WINDOW_MS = 15 * 60_000;

export type CreateStartLeadResult =
  | { ok: true; saved: boolean; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Talebi kaydeder. Aynı kişi (e-posta ya da telefon) 15 dakika içinde tekrar
 * gönderirse (çift dokunuş, geri-ileri) yeni satır AÇILMAZ, kullanıcıya yine
 * "alındı" denir.
 */
export async function createStartLead(
  organizationId: string,
  lead: ParsedStartLead,
): Promise<CreateStartLeadResult> {
  try {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await prisma.startLead.findFirst({
      where: {
        organizationId,
        createdAt: { gte: since },
        OR: [{ email: lead.email }, { phone: lead.phone }],
      },
      select: { id: true },
    });
    if (recent) return { ok: true, saved: true, duplicate: true };

    await prisma.startLead.create({
      data: {
        organizationId,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        answers: lead.answers as unknown as Prisma.InputJsonValue,
        noticeAcceptedAt: new Date(),
      },
      select: { id: true },
    });
    return { ok: true, saved: true, duplicate: false };
  } catch (error) {
    console.error("[baslangic] talep tabloya yazılamadı — denetim kaydına düşüyor", error);
  }

  // Tablo yok ya da veritabanı geçici olarak ulaşılamıyor: bilgi kaybolmasın.
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: null,
        actorLabel: "Başlangıç formu",
        action: "baslangic.geldi",
        entityType: "StartLead",
        summary: summarizeStartLead(lead),
      },
    });
    return { ok: true, saved: false, duplicate: false };
  } catch (error) {
    console.error("[baslangic] yedek kayıt da yazılamadı", error);
    return {
      ok: false,
      error: "Talebin şu an alınamadı. Birkaç dakika sonra tekrar dene.",
    };
  }
}

export type StartLeadRow = {
  id: string;
  status: LeadStatus;
  fullName: string;
  phone: string;
  email: string;
  answers: StartAnswers;
  createdAt: Date;
};

/** Tablo yoksa `null` — ekran bu kaynağı atlar, sayfa düşmez. */
export async function listStartLeads(
  organizationId: string,
): Promise<StartLeadRow[] | null> {
  try {
    const rows = await prisma.startLead.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return rows.map((row) => ({
      id: row.id,
      status: isLeadStatus(row.status) ? row.status : "yeni",
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      answers: readStartAnswers(row.answers),
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[baslangic] liste okunamadı", error);
    return null;
  }
}

/** Menü rozeti — henüz aranmamış talep sayısı; tablo yoksa 0. */
export async function countNewStartLeads(organizationId: string): Promise<number> {
  try {
    return await prisma.startLead.count({
      where: { organizationId, status: "yeni" },
    });
  } catch {
    return 0;
  }
}

export type StartLeadActionResult =
  | { ok: true; fullName: string }
  | { ok: false; error: string };

export async function setStartLeadStatus(
  id: string,
  organizationId: string,
  status: LeadStatus,
  handledByUserId: string,
): Promise<StartLeadActionResult> {
  try {
    const lead = await prisma.startLead.findFirst({
      where: { id, organizationId },
      select: { id: true, fullName: true },
    });
    if (!lead) return { ok: false, error: "Talep bulunamadı." };

    await prisma.startLead.update({
      where: { id: lead.id },
      data: { status, handledByUserId },
    });
    return { ok: true, fullName: lead.fullName };
  } catch (error) {
    console.error("[baslangic] durum güncellenemedi", error);
    return { ok: false, error: "Güncellenemedi, tekrar dene." };
  }
}

export async function deleteStartLead(
  id: string,
  organizationId: string,
): Promise<StartLeadActionResult> {
  try {
    const lead = await prisma.startLead.findFirst({
      where: { id, organizationId },
      select: { id: true, fullName: true },
    });
    if (!lead) return { ok: false, error: "Talep bulunamadı." };

    await prisma.startLead.delete({ where: { id: lead.id } });
    return { ok: true, fullName: lead.fullName };
  } catch (error) {
    console.error("[baslangic] silinemedi", error);
    return { ok: false, error: "Silinemedi, tekrar dene." };
  }
}
