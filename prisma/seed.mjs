// Sentetik test verisi. Gerçek Kong Academy danışanı YOK — bkz. BACKLOG.md.
// Çalıştır: node prisma/seed.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "blackbox" },
    update: {},
    create: { name: "BlackBox", slug: "blackbox" },
  });

  await prisma.branch.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "merkez" } },
    update: {},
    create: { organizationId: org.id, name: "Merkez Şube", slug: "merkez" },
  });

  const passwordHash = await bcrypt.hash("test1234", 12);

  // --- Personel (staff) ---
  let staffUser = await prisma.user.findUnique({
    where: { email: "personel@blackbox.test" },
  });
  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: {
        email: "personel@blackbox.test",
        passwordHash,
        profile: { create: { displayName: "BlackBox Personel" } },
      },
    });
    await prisma.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: staffUser.id,
        role: "staff",
        status: "active",
      },
    });
    console.log("Personel oluşturuldu: personel@blackbox.test / test1234");
  } else {
    console.log("Personel zaten vardı: personel@blackbox.test");
  }

  // --- Test üyesi (sentetik) ---
  let memberUser = await prisma.user.findUnique({
    where: { email: "uye@blackbox.test" },
  });
  if (!memberUser) {
    memberUser = await prisma.user.create({
      data: {
        email: "uye@blackbox.test",
        passwordHash,
        profile: { create: { displayName: "Test Üye" } },
      },
    });
    await prisma.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: memberUser.id,
        role: "member",
        status: "active",
      },
    });
    await prisma.member.create({
      data: {
        organizationId: org.id,
        userId: memberUser.id,
        memberNo: "BB-0001",
        fullName: "Test Üye",
        email: "uye@blackbox.test",
        status: "active",
      },
    });
    console.log("Test üyesi oluşturuldu: uye@blackbox.test / test1234");
  } else {
    console.log("Test üyesi zaten vardı: uye@blackbox.test");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
