import "server-only";
import { prisma } from "@/lib/db";

/**
 * Denetim kaydı — "bunu kim yaptı" sorusunun tek yanıt yeri.
 *
 * Kurallar:
 *   - Yalnız **yazan** işlem düşer; kimin neye baktığı tutulmaz.
 *   - Kayıt asla güncellenmez ya da silinmez (append-only).
 *   - `actorLabel` çağrı anında kopyalanır: personel hesabı sonradan
 *     silinse bile kaydın kim tarafından yapıldığı okunabilir kalır.
 *   - Kayıt yazılamazsa asıl işlem **düşmez** — denetim ikinci
 *     derecedir, sporcunun rezervasyonunu iptal etmesine engel olamaz.
 */

export const AUDIT_ACTIONS = [
  "uye.eklendi",
  "uye.kendi-kaydoldu",
  "uye.bilgi-guncelledi",
  "uye.koc-atandi",
  "uye.anonimlestirildi",
  "uye.duzenlendi",
  "uye.silindi",
  "personel.duzenlendi",
  "personel.silindi",
  "davet.uretildi",
  "kayit-linki.uretildi",
  "kayit-linki.durum",
  "kadro-linki.uretildi",
  "kadro-linki.kapatildi",
  "paket.fiyat-degisti",
  "personel.davet",
  "personel.davet-iptal",
  "personel.hesap-kuruldu",
  "personel.rol",
  "personel.durum",
  "plan.sablon-eklendi",
  "plan.sablon-guncellendi",
  "plan.sablon-silindi",
  "plan.toplu-atandi",
  "uyelik.baslatildi",
  "uyelik.durum",
  "seans.acildi",
  "seans.iptal",
  "yoklama.isaretlendi",
  "istek.onaylandi",
  "istek.reddedildi",
  "kusak.terfi",
  "kusak.geri-alindi",
  "kusak.tanimlandi",
  "onam.imzalandi",
  "onam.sablon",
  "veri.disa-aktarildi",
  "hakedis.ayarlandi",
  "tahsilat.eklendi",
  "tahsilat.silindi",
  "gider.eklendi",
  "gider.silindi",
  "hakedis.odendi",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "uye.eklendi": "Sporcu eklendi",
  "uye.kendi-kaydoldu": "Sporcu kayıt linkinden kaydoldu",
  "uye.bilgi-guncelledi": "Sporcu kişisel bilgilerini güncelledi",
  "uye.koc-atandi": "Sorumlu antrenör değişti",
  "uye.anonimlestirildi": "Sporcu anonimleştirildi",
  "uye.duzenlendi": "Sporcu bilgileri düzenlendi",
  "uye.silindi": "Sporcu silindi",
  "personel.duzenlendi": "Personel bilgileri düzenlendi",
  "personel.silindi": "Personel silindi",
  "davet.uretildi": "Davet bağlantısı üretildi",
  "kayit-linki.uretildi": "Kayıt bağlantısı üretildi",
  "kayit-linki.durum": "Kayıt bağlantısı açıldı/kapatıldı",
  "kadro-linki.uretildi": "Antrenör kayıt bağlantısı üretildi",
  "kadro-linki.kapatildi": "Antrenör kayıt bağlantısı kapatıldı",
  "paket.fiyat-degisti": "Paket fiyatı düzeltildi",
  "personel.davet": "Kadroya davet çıkarıldı",
  "personel.davet-iptal": "Personel daveti iptal edildi",
  "personel.hesap-kuruldu": "Personel hesabını kurdu",
  "personel.rol": "Personel rolü değişti",
  "personel.durum": "Personel hesabı açıldı/kapatıldı",
  "plan.sablon-eklendi": "Antrenman şablonu oluşturuldu",
  "plan.sablon-guncellendi": "Antrenman şablonu güncellendi",
  "plan.sablon-silindi": "Antrenman şablonu silindi",
  "plan.toplu-atandi": "Şablon birden çok sporcuya atandı",
  "uyelik.baslatildi": "Üyelik başlatıldı/yenilendi",
  "uyelik.durum": "Üyelik durumu değişti",
  "seans.acildi": "Ders saati açıldı",
  "seans.iptal": "Seans iptal edildi",
  "yoklama.isaretlendi": "Yoklama işaretlendi",
  "istek.onaylandi": "Katılım isteği onaylandı",
  "istek.reddedildi": "Katılım isteği reddedildi",
  "kusak.terfi": "Kuşak verildi",
  "kusak.geri-alindi": "Kuşak geri alındı",
  "kusak.tanimlandi": "Kuşak/müfredat tanımlandı",
  "onam.imzalandi": "Onam formu imzalandı",
  "onam.sablon": "Onam metni değişti",
  "veri.disa-aktarildi": "Veri dışa aktarıldı",
  "hakedis.ayarlandi": "Hakediş ayarı değişti",
  "tahsilat.eklendi": "Tahsilat girildi",
  "tahsilat.silindi": "Tahsilat silindi",
  "gider.eklendi": "Gider girildi",
  "gider.silindi": "Gider silindi",
  "hakedis.odendi": "Antrenör hakedişi ödendi",
};

export type AuditInput = {
  organizationId: string;
  actorUserId?: string | null;
  actorLabel: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
};

/** Kaydı yazar; hata olursa yutar (asıl işlem geri alınmasın). */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        actorLabel: input.actorLabel,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metaJson: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (error) {
    console.error("[audit] kayıt yazılamadı", input.action, error);
  }
}

export type AuditRow = {
  id: string;
  action: AuditAction;
  actionLabel: string;
  actorLabel: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
};

export async function listAuditLog(
  organizationId: string,
  {
    action,
    entityId,
    limit = 100,
  }: { action?: AuditAction; entityId?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(action ? { action } : {}),
      ...(entityId ? { entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action as AuditAction,
    actionLabel:
      AUDIT_ACTION_LABEL[row.action as AuditAction] ?? row.action,
    actorLabel: row.actorLabel,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    createdAt: row.createdAt,
  }));
}

/** Kayıt sayıları — hangi işlem ne sıklıkta yapılıyor. */
export async function auditActionCounts(
  organizationId: string,
  { sinceDays = 30 }: { sinceDays?: number } = {},
): Promise<{ action: AuditAction; label: string; count: number }[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { organizationId, createdAt: { gte: since } },
    _count: { _all: true },
  });

  return rows
    .map((row) => ({
      action: row.action as AuditAction,
      label: AUDIT_ACTION_LABEL[row.action as AuditAction] ?? row.action,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}
