/**
 * Faz 12 geçiş betiği — migration'dan SONRA bir kez çalıştırılır.
 *
 *   node scripts/backfill-maliye.mjs           # ne yapacağını yazar, yazmaz
 *   node scripts/backfill-maliye.mjs --uygula  # değişiklikleri yazar
 *
 * Neden gerekli: `Member.assignedCoachUserId` yeni bir alan, mevcut sporcular
 * için boş. Boş kalırsa o sporcu HİÇBİR antrenörün panelinde görünmez (yalnız
 * yönetici görür). Aynı şekilde `MemberSubscription.priceMinor` varsayılan 0
 * gelir — geçmiş üyelikler "ücretsiz" görünür.
 *
 * Bu betik:
 *   1. Salonda **tek** antrenör varsa sahipsiz sporcuları ona atar. Birden çok
 *      antrenör varsa DOKUNMAZ — kimin sporcusu olduğunu yazılım bilemez,
 *      atama `/yonetim/uyeler` ekranından elle yapılır.
 *   2. Tutarı 0 kalmış üyeliklere paketin etiket fiyatını yazar.
 *   3. Sıfır tutarlı tahsilat/hakediş satırlarını temizler (seed artığı).
 *
 * Tekrar çalıştırmak zararsızdır.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--uygula");

function log(action, detail) {
  console.log(`${apply ? "[yazıldı]" : "[deneme]"} ${action} — ${detail}`);
}

async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  for (const organization of organizations) {
    console.log(`\n=== ${organization.name} ===`);

    // 1) Sahipsiz sporcular
    const coaches = await prisma.organizationUser.findMany({
      where: {
        organizationId: organization.id,
        status: "active",
        role: { in: ["coach", "admin", "staff"] },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
    const onlyCoaches = coaches.filter((row) => row.role !== "admin");
    const target = onlyCoaches.length === 1 ? onlyCoaches[0] : null;

    const orphans = await prisma.member.count({
      where: { organizationId: organization.id, assignedCoachUserId: null },
    });

    if (orphans === 0) {
      console.log("Sahipsiz sporcu yok.");
    } else if (!target) {
      console.log(
        `${orphans} sporcunun antrenörü yok ve kadroda ${onlyCoaches.length} antrenör var — ` +
          "atama elle yapılmalı (/yonetim/uyeler).",
      );
    } else {
      log("koç ataması", `${orphans} sporcu → ${target.user.email}`);
      if (apply) {
        await prisma.member.updateMany({
          where: { organizationId: organization.id, assignedCoachUserId: null },
          data: { assignedCoachUserId: target.user.id },
        });
      }
    }

    // 2) Tutarı girilmemiş üyelikler
    const zeroPriced = await prisma.memberSubscription.findMany({
      where: { member: { organizationId: organization.id }, priceMinor: 0 },
      include: { plan: { select: { name: true, priceMinor: true, currency: true } } },
    });
    for (const subscription of zeroPriced) {
      if (subscription.plan.priceMinor <= 0) continue;
      log(
        "üyelik tutarı",
        `${subscription.plan.name} → ${subscription.plan.priceMinor / 100} ₺`,
      );
      if (apply) {
        await prisma.memberSubscription.update({
          where: { id: subscription.id },
          data: {
            priceMinor: subscription.plan.priceMinor,
            currency: subscription.plan.currency,
          },
        });
      }
    }

    // 3) Sıfır tutarlı artıklar
    const zeroPayments = await prisma.payment.count({
      where: { organizationId: organization.id, amountMinor: { lte: 0 } },
    });
    if (zeroPayments > 0) {
      log("sıfır tahsilat temizliği", `${zeroPayments} kayıt siliniyor`);
      if (apply) {
        // Bağlı hakediş satırı onDelete: Cascade ile birlikte gider.
        await prisma.payment.deleteMany({
          where: { organizationId: organization.id, amountMinor: { lte: 0 } },
        });
      }
    }

    const zeroEarnings = await prisma.coachEarning.count({
      where: {
        organizationId: organization.id,
        amountMinor: { lte: 0 },
        status: "tahakkuk",
      },
    });
    if (zeroEarnings > 0) {
      log("sıfır hakediş temizliği", `${zeroEarnings} kayıt siliniyor`);
      if (apply) {
        await prisma.coachEarning.deleteMany({
          where: {
            organizationId: organization.id,
            amountMinor: { lte: 0 },
            status: "tahakkuk",
          },
        });
      }
    }
  }

  if (!apply) {
    console.log("\nHiçbir şey yazılmadı. Uygulamak için: --uygula");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
