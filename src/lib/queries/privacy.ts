import "server-only";
import { prisma } from "@/lib/db";

/**
 * KVKK katmanı — sporcunun kendi verisini alması ve talep hâlinde
 * kimliğinin silinmesi.
 *
 * İki ayrı hak, iki ayrı işlem:
 *
 *   - **Dışa aktarma** (`buildMemberDataPackage`): sporcunun sistemdeki
 *     tüm kayıtları tek JSON. Sporcu kendisi indirebilir; personel de
 *     onun adına alabilir.
 *   - **Anonimleştirme** (`anonymizeMember`): kimliğe götüren alanlar
 *     silinir, salonun istatistiği (ders sayısı, doluluk) bozulmadan
 *     kalır. Kaydı komple silmek yerine bu tercih edildi çünkü geçmiş
 *     dersler antrenörün ve salonun da verisidir.
 *
 * Anonimleştirme **geri alınamaz**: hesap silinir, ad/e-posta/telefon,
 * onam imzaları ve serbest metin notları temizlenir.
 */

export type MemberDataPackage = Record<string, unknown>;

/** Sporcunun tüm verisi — KVKK "veri sahibinin erişim hakkı" karşılığı. */
export async function buildMemberDataPackage(
  memberId: string,
): Promise<MemberDataPackage | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { email: true, createdAt: true, profile: true } },
      homeBranch: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });
  if (!member) return null;

  const [
    checkIns,
    trainingLogs,
    weightEntries,
    weightGoals,
    bookings,
    subscriptions,
    plans,
    nutritionPlans,
    mealChecks,
    waivers,
    ranks,
    pointEvents,
    badges,
    snapshots,
  ] = await Promise.all([
    prisma.checkIn.findMany({ where: { memberId }, orderBy: { weekStart: "asc" } }),
    prisma.trainingLog.findMany({ where: { memberId }, orderBy: { loggedAt: "asc" } }),
    prisma.weightEntry.findMany({ where: { memberId }, orderBy: { takenAt: "asc" } }),
    prisma.weightGoal.findMany({ where: { memberId } }),
    prisma.slotBooking.findMany({
      where: { memberId },
      include: { slot: { select: { startsAt: true, kind: true, durationMinutes: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.memberSubscription.findMany({
      where: { memberId },
      include: { plan: { select: { name: true, durationDays: true } } },
    }),
    prisma.memberPlan.findMany({
      where: { memberId },
      include: { template: { select: { name: true, kind: true } } },
    }),
    prisma.nutritionPlan.findMany({
      where: { memberId },
      include: { meals: { include: { foods: true } } },
    }),
    prisma.mealCheck.findMany({ where: { memberId } }),
    prisma.memberWaiver.findMany({
      where: { memberId },
      include: { template: { select: { title: true, kind: true } } },
    }),
    prisma.memberRank.findMany({
      where: { memberId },
      include: { rank: { select: { name: true } } },
    }),
    prisma.pointEvent.findMany({ where: { memberId }, orderBy: { occurredAt: "asc" } }),
    prisma.memberBadge.findMany({ where: { memberId } }),
    prisma.performanceSnapshot.findMany({ where: { memberId } }),
  ]);

  return {
    olusturulmaTarihi: new Date().toISOString(),
    aciklama:
      "BlackBox spor salonu — KVKK kapsamında kişisel veri dökümü. Bu dosya yalnız bu sporcuya ait kayıtları içerir.",
    sporcu: {
      id: member.id,
      uyeNo: member.memberNo,
      adSoyad: member.fullName,
      eposta: member.email ?? member.user?.email ?? null,
      telefon: member.phone,
      durum: member.status,
      salon: member.organization.name,
      sube: member.homeBranch?.name ?? null,
      kayitTarihi: member.createdAt,
      anonimlestirildi: member.anonymizedAt,
    },
    hesap: member.user
      ? { eposta: member.user.email, acilis: member.user.createdAt }
      : null,
    haftalikKontroller: checkIns,
    antrenmanKayitlari: trainingLogs,
    tartiKayitlari: weightEntries,
    sikletHedefleri: weightGoals,
    dersRezervasyonlari: bookings,
    uyelikler: subscriptions,
    atananProgramlar: plans,
    beslenmePlanlari: nutritionPlans,
    ogunIsaretleri: mealChecks,
    onamFormlari: waivers,
    kusaklar: ranks,
    puanKayitlari: pointEvents,
    rozetler: badges,
    performansGoruntuleri: snapshots,
  };
}

export type AnonymizeResult =
  | { ok: true; memberNo: string }
  | { ok: false; error: string };

/**
 * Sporcunun kimliğini siler, geçmişini istatistik olarak bırakır.
 *
 * Silinenler: hesap (giriş bilgisi), ad/e-posta/telefon, davet bağlantıları,
 * onam imzalarındaki isim/veli/sağlık yanıtları, bildirimler ve check-in
 * serbest metin notları. Kalanlar: ders/antrenman/tartı sayıları, kuşak
 * geçmişi — hepsi artık kimliksiz.
 */
export async function anonymizeMember(
  memberId: string,
  organizationId: string,
): Promise<AnonymizeResult> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
  });
  if (!member) return { ok: false, error: "Sporcu bulunamadı." };
  if (member.anonymizedAt) {
    return { ok: false, error: "Bu kayıt zaten anonimleştirilmiş." };
  }

  const checkIns = await prisma.checkIn.findMany({
    where: { memberId },
    select: { id: true, answersJson: true },
  });

  await prisma.$transaction(async (tx) => {
    // Serbest metin notlarını temizle, sayısal yanıtları bırak.
    for (const checkIn of checkIns) {
      let cleaned = checkIn.answersJson;
      try {
        const parsed = JSON.parse(checkIn.answersJson) as Record<string, unknown>;
        delete parsed.note;
        cleaned = JSON.stringify(parsed);
      } catch {
        cleaned = "{}";
      }
      await tx.checkIn.update({
        where: { id: checkIn.id },
        data: { answersJson: cleaned },
      });
    }

    await tx.memberInvite.deleteMany({ where: { memberId } });
    await tx.notification.deleteMany({ where: { memberId } });

    await tx.memberWaiver.updateMany({
      where: { memberId },
      data: {
        signedName: "Anonimleştirildi",
        guardianName: null,
        guardianPhone: null,
        birthDate: null,
        answersJson: null,
        healthNote: null,
      },
    });

    await tx.trainingLog.updateMany({ where: { memberId }, data: { notes: null } });
    await tx.weightEntry.updateMany({ where: { memberId }, data: { note: null } });
    await tx.slotBooking.updateMany({ where: { memberId }, data: { note: null } });

    // Hesabı sil: Member.userId ilişkisi opsiyonel olduğu için null'a düşer,
    // Profile/OrganizationUser/Notification cascade ile temizlenir.
    if (member.userId) {
      await tx.user.delete({ where: { id: member.userId } });
    }

    await tx.member.update({
      where: { id: memberId },
      data: {
        fullName: `Anonim ${member.memberNo}`,
        email: null,
        phone: null,
        status: "inactive",
        remindersEnabled: false,
        anonymizedAt: new Date(),
      },
    });
  });

  return { ok: true, memberNo: member.memberNo };
}
