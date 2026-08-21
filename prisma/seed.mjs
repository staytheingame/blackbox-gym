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

  const testMember = await prisma.member.findFirst({
    where: { organizationId: org.id, memberNo: "BB-0001" },
  });

  await seedMembershipPlans(org.id, testMember);
  await seedSlots(org.id, staffUser.id);
  await seedPlanTemplates(org.id, staffUser.id, testMember);
  await seedWeight(testMember);
}

// ── Üyelik paketleri ───────────────────────────────────────────
async function seedMembershipPlans(organizationId, member) {
  const existing = await prisma.membershipPlan.count({ where: { organizationId } });
  if (existing > 0) {
    console.log("Üyelik paketleri zaten vardı.");
    return;
  }

  // Ders paketi modeli: `totalSessions` = pakette kaç ders var, `null` =
  // sınırsız. Fiyat yalnız etikettir; uygulamada tahsilat takibi yok.
  const plans = [
    {
      name: "8 Derslik Başlangıç",
      description: "Haftada iki ders temposuyla bir ay yeter.",
      priceMinor: 160000,
      durationDays: 45,
      totalSessions: 8,
    },
    {
      name: "16 Derslik Standart",
      description: "Düzenli çalışanlar için; birebir ve grup dersi fark etmez.",
      priceMinor: 280000,
      durationDays: 60,
      totalSessions: 16,
    },
    {
      name: "24 Derslik Maç Kampı",
      description: "Kamp dönemi: yoğun tempo, sparring ve teknik seansları.",
      priceMinor: 650000,
      durationDays: 90,
      totalSessions: 24,
    },
    {
      name: "Aylık Sınırsız",
      description: "Süre boyunca ders sınırı yok.",
      priceMinor: 320000,
      durationDays: 30,
      totalSessions: null,
    },
  ];

  const created = [];
  for (const plan of plans) {
    created.push(
      await prisma.membershipPlan.create({ data: { organizationId, ...plan } }),
    );
  }
  console.log(`${created.length} üyelik paketi oluşturuldu.`);

  if (member) {
    const pack = created[1]; // 16 Derslik Standart
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + pack.durationDays);

    await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        planId: pack.id,
        startDate,
        endDate,
        status: "aktif",
        sessionsTotal: pack.totalSessions,
      },
    });
    console.log(`Test üyesine "${pack.name}" üyeliği tanımlandı.`);
  }
}

// ── Ders programı (antrenörün açık saatleri) ───────────────────
/** Salon saatiyle (UTC+3) verilen gün/saati gerçek ana çevirir. */
function istanbulInstant(base, addDays, hour, minute = 0) {
  const day = new Date(base);
  day.setUTCDate(day.getUTCDate() + addDays);
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour - 3,
      minute,
    ),
  );
}

async function seedSlots(organizationId, coachUserId) {
  const existing = await prisma.trainingSlot.count({ where: { organizationId } });
  if (existing > 0) {
    console.log("Ders saatleri zaten vardı.");
    return;
  }

  // Bugünden itibaren iki hafta: hafta içi sabah/akşam birebir saatler,
  // Cumartesi bir grup dersi.
  const today = new Date();
  const pattern = [
    { hour: 7, kind: "boks", capacity: 1, title: "Sabah birebir" },
    { hour: 19, kind: "boks", capacity: 1, title: "Akşam birebir" },
    { hour: 20, kind: "kondisyon", capacity: 4, title: "Kondisyon grubu" },
  ];

  const data = [];
  for (let offset = 1; offset <= 14; offset++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    const dayOfWeek = date.getUTCDay(); // 0 = Pazar
    if (dayOfWeek === 0) continue; // Pazar kapalı

    for (const slot of pattern) {
      // Grup dersi yalnız Salı ve Cumartesi.
      if (slot.capacity > 1 && ![2, 6].includes(dayOfWeek)) continue;

      data.push({
        organizationId,
        coachUserId,
        startsAt: istanbulInstant(today, offset, slot.hour),
        durationMinutes: slot.capacity > 1 ? 75 : 60,
        capacity: slot.capacity,
        kind: slot.kind,
        title: slot.title,
      });
    }
  }

  await prisma.trainingSlot.createMany({ data });
  console.log(`${data.length} ders saati açıldı (önümüzdeki 2 hafta).`);
}

// ── Antrenman / kondisyon şablonları ───────────────────────────
/** Haftalık dönen gün kalıbı — hafta numarasına göre yük artar. */
function buildWeek(weekNumber, pattern) {
  return pattern.map((day) => ({
    ...day,
    items: day.items.map((item, index) => ({
      ...item,
      position: index,
      // İleri haftalarda round sayısı artar (kademeli yüklenme).
      rounds: item.rounds ? item.rounds + Math.floor((weekNumber - 1) / 2) : null,
    })),
  }));
}

const TEMEL_BOKS_PATTERN = [
  {
    dayOfWeek: 1,
    focus: "Duruş & jab mekaniği",
    items: [
      { kind: "esneme", label: "Isınma: ip + omuz açma", durationSeconds: 600 },
      { kind: "teknik", label: "Jab tekrarları (ayna)", techniqueSlug: "jab", rounds: 3, durationSeconds: 180, restSeconds: 60 },
      { kind: "torba", label: "Torbada jab-cross", techniqueSlug: "cross", rounds: 3, durationSeconds: 180, restSeconds: 60, targetRpe: 6 },
      { kind: "kondisyon", label: "Karın & core sirkuit", durationSeconds: 480 },
    ],
  },
  {
    dayOfWeek: 3,
    focus: "Ayak işi & savunma",
    items: [
      { kind: "esneme", label: "Isınma: ip + kalça açma", durationSeconds: 600 },
      { kind: "teknik", label: "Pivot & yön değiştirme", techniqueSlug: "pivot", rounds: 3, durationSeconds: 180, restSeconds: 60 },
      { kind: "teknik", label: "Slip çalışması (partner)", techniqueSlug: "slip", rounds: 3, durationSeconds: 180, restSeconds: 60 },
      { kind: "ped", label: "Pedde 1-2 + slip", rounds: 3, durationSeconds: 180, restSeconds: 60, targetRpe: 7 },
    ],
  },
  {
    dayOfWeek: 5,
    focus: "Kombinasyon & torba",
    items: [
      { kind: "esneme", label: "Isınma: gölge boks", durationSeconds: 480 },
      { kind: "teknik", label: "1-2-3 serisi", techniqueSlug: "jab-cross-krose", rounds: 4, durationSeconds: 180, restSeconds: 60 },
      { kind: "torba", label: "Torbada serbest kombinasyon", rounds: 4, durationSeconds: 180, restSeconds: 60, targetRpe: 8 },
      { kind: "kondisyon", label: "Bitiriş: 30/30 interval", durationSeconds: 480, targetRpe: 8 },
    ],
  },
];

const MAC_KAMPI_PATTERN = [
  {
    dayOfWeek: 1,
    focus: "Teknik yoğunluk",
    items: [
      { kind: "esneme", label: "Isınma & mobilite", durationSeconds: 600 },
      { kind: "teknik", label: "Roll → karşı kroşe", techniqueSlug: "roll-krose-aper", rounds: 4, durationSeconds: 180, restSeconds: 45 },
      { kind: "ped", label: "Pedde kombinasyon serileri", rounds: 5, durationSeconds: 180, restSeconds: 45, targetRpe: 8 },
    ],
  },
  {
    dayOfWeek: 2,
    focus: "Kondisyon",
    items: [
      { kind: "kondisyon", label: "Tempo koşu", durationSeconds: 1800, targetRpe: 7 },
      { kind: "kuvvet", label: "Kettlebell sirkuit", rounds: 4, durationSeconds: 240, restSeconds: 60 },
    ],
  },
  {
    dayOfWeek: 4,
    focus: "Sparring",
    items: [
      { kind: "esneme", label: "Isınma & gölge", durationSeconds: 600 },
      { kind: "sparring", label: "Kontrollü sparring", rounds: 5, durationSeconds: 180, restSeconds: 60, targetRpe: 9 },
      { kind: "teknik", label: "Sparring sonrası düzeltme", durationSeconds: 600 },
    ],
  },
  {
    dayOfWeek: 6,
    focus: "Güç & bitirme",
    items: [
      { kind: "torba", label: "Ağır torba güç serileri", rounds: 5, durationSeconds: 180, restSeconds: 60, targetRpe: 8 },
      { kind: "kondisyon", label: "Piramit interval", durationSeconds: 900, targetRpe: 9 },
    ],
  },
];

const KONDISYON_PATTERN = [
  {
    dayOfWeek: 2,
    focus: "İnterval",
    items: [
      { kind: "kondisyon", label: "30/30 interval", rounds: 8, durationSeconds: 60, restSeconds: 30, targetRpe: 8 },
      { kind: "esneme", label: "Soğuma", durationSeconds: 300 },
    ],
  },
  {
    dayOfWeek: 4,
    focus: "İp & ayak hızı",
    items: [
      { kind: "kondisyon", label: "İp: çift sıçrama blokları", rounds: 5, durationSeconds: 180, restSeconds: 60, targetRpe: 7 },
      { kind: "kuvvet", label: "Baldır & bilek dayanıklılık", durationSeconds: 480 },
    ],
  },
  {
    dayOfWeek: 6,
    focus: "Uzun tempo",
    items: [
      { kind: "kondisyon", label: "Tempo koşu", durationSeconds: 2400, targetRpe: 6 },
    ],
  },
];

async function seedPlanTemplates(organizationId, staffUserId, member) {
  const existing = await prisma.planTemplate.count({ where: { organizationId } });
  if (existing > 0) {
    console.log("Plan şablonları zaten vardı.");
    return;
  }

  const templates = [
    {
      name: "4 Haftalık Temel Boks",
      kind: "antrenman",
      level: "baslangic",
      weeks: 4,
      summary: "Duruş, jab mekaniği, ayak işi ve ilk kombinasyonlar.",
      pattern: TEMEL_BOKS_PATTERN,
    },
    {
      name: "8 Haftalık Maç Kampı",
      kind: "antrenman",
      level: "ileri",
      weeks: 8,
      summary: "Sparring ağırlıklı kamp: teknik yoğunluk, kondisyon, güç bitirme.",
      pattern: MAC_KAMPI_PATTERN,
    },
    {
      name: "4 Haftalık Kondisyon Bloğu",
      kind: "kondisyon",
      level: "orta",
      weeks: 4,
      summary: "Ring kondisyonu: interval, ip ve tempo koşu dengesi.",
      pattern: KONDISYON_PATTERN,
    },
  ];

  const created = [];
  for (const { pattern, ...template } of templates) {
    const row = await prisma.planTemplate.create({
      data: { organizationId, createdByUserId: staffUserId, ...template },
    });

    for (let week = 1; week <= template.weeks; week++) {
      for (const day of buildWeek(week, pattern)) {
        await prisma.planDay.create({
          data: {
            templateId: row.id,
            weekNumber: week,
            dayOfWeek: day.dayOfWeek,
            focus: day.focus,
            items: {
              create: day.items.map((item) => ({
                position: item.position,
                kind: item.kind,
                label: item.label,
                techniqueSlug: item.techniqueSlug ?? null,
                rounds: item.rounds ?? null,
                durationSeconds: item.durationSeconds ?? null,
                restSeconds: item.restSeconds ?? null,
                targetRpe: item.targetRpe ?? null,
              })),
            },
          },
        });
      }
    }

    created.push(row);
  }
  console.log(`${created.length} plan şablonu oluşturuldu.`);

  if (member) {
    const monday = getMonday(new Date());
    // Tür başına bir aktif program: antrenman + kondisyon birlikte yürür.
    const assigned = created.filter((row) =>
      ["4 Haftalık Temel Boks", "4 Haftalık Kondisyon Bloğu"].includes(row.name),
    );

    for (const template of assigned) {
      await prisma.memberPlan.create({
        data: {
          memberId: member.id,
          templateId: template.id,
          startDate: monday,
          assignedByUserId: staffUserId,
          status: "aktif",
        },
      });
    }
    console.log(
      `Test üyesine atandı: ${assigned.map((row) => row.name).join(", ")}`,
    );
  }
}

// ── Tartı / sıklet ─────────────────────────────────────────────
async function seedWeight(member) {
  if (!member) return;

  const existing = await prisma.weightEntry.count({ where: { memberId: member.id } });
  if (existing > 0) {
    console.log("Tartı kayıtları zaten vardı.");
    return;
  }

  // Son 4 hafta, haftada bir tartı — kademeli düşüş.
  const samples = [
    { weeksAgo: 3, weightKg: 73.4, bodyFatPercent: 16.2 },
    { weeksAgo: 2, weightKg: 72.6, bodyFatPercent: 15.8 },
    { weeksAgo: 1, weightKg: 72.1, bodyFatPercent: 15.4 },
    { weeksAgo: 0, weightKg: 71.5, bodyFatPercent: 15.1 },
  ];

  for (const sample of samples) {
    const takenAt = new Date();
    takenAt.setUTCDate(takenAt.getUTCDate() - sample.weeksAgo * 7);
    await prisma.weightEntry.create({
      data: {
        memberId: member.id,
        takenAt,
        weightKg: sample.weightKg,
        bodyFatPercent: sample.bodyFatPercent,
      },
    });
  }

  // BlackBox Cup tarihi (bkz. src/data/events.ts) hedef alındı.
  const fightDate = new Date();
  fightDate.setUTCDate(fightDate.getUTCDate() + 33);

  await prisma.weightGoal.create({
    data: {
      memberId: member.id,
      targetKg: 69,
      weightClass: "yari-orta",
      fightDate,
      status: "aktif",
    },
  });
  console.log("Tartı kayıtları ve sıklet hedefi oluşturuldu.");
}

/** Haftanın Pazartesi'si (UTC) — src/lib/date.ts ile aynı kural. */
function getMonday(date) {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return utc;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
