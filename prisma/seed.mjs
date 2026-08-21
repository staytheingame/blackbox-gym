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

  // --- Antrenör (coach) ---
  let staffUser = await prisma.user.findUnique({
    where: { email: "personel@blackbox.test" },
  });
  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: {
        email: "personel@blackbox.test",
        passwordHash,
        profile: { create: { displayName: "BlackBox Antrenör" } },
      },
    });
    await prisma.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: staffUser.id,
        role: "coach",
        status: "active",
      },
    });
    console.log("Antrenör oluşturuldu: personel@blackbox.test / test1234");
  } else {
    console.log("Antrenör zaten vardı: personel@blackbox.test");
  }

  // --- Yönetici (admin) — /yonetim paneli ---
  let adminUser = await prisma.user.findUnique({
    where: { email: "yonetici@blackbox.test" },
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: "yonetici@blackbox.test",
        passwordHash,
        profile: { create: { displayName: "BlackBox Yönetici" } },
      },
    });
    await prisma.organizationUser.create({
      data: {
        organizationId: org.id,
        userId: adminUser.id,
        role: "admin",
        status: "active",
      },
    });
    console.log("Yönetici oluşturuldu: yonetici@blackbox.test / test1234");
  } else {
    console.log("Yönetici zaten vardı: yonetici@blackbox.test");
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
        // Antrenör panelinde görünmesi için sorumlu antrenör şart.
        assignedCoachUserId: staffUser.id,
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
  await seedNutrition(org.id, staffUser.id, testMember);
  await seedPendingInvite(org.id, staffUser.id);
  await seedRanks(org.id, staffUser.id, testMember);
  await seedWaivers(org.id);
  await seedFinance(org.id, staffUser.id, testMember);
}

// ── Maliye: hakediş ayarı, tahsilat, gider ─────────────────────
async function seedFinance(organizationId, coachUserId, member) {
  // Antrenör: ders başı 250 ₺ + tahsilatın %10'u, aylık 60 ders hakkı.
  await prisma.coachCompensation.upsert({
    where: { coachUserId },
    update: {},
    create: {
      organizationId,
      coachUserId,
      model: "karma",
      perSessionMinor: 25000,
      revenueShareBps: 1000,
      monthlySessionQuota: 60,
      note: "Örnek ayar — kendi anlaşmanı Kadro ekranından gir.",
    },
  });

  const existingRecurring = await prisma.recurringExpense.count({
    where: { organizationId },
  });
  if (existingRecurring === 0) {
    await prisma.recurringExpense.createMany({
      data: [
        {
          organizationId,
          category: "kira",
          title: "Salon kirası",
          amountMinor: 4500000,
          dayOfMonth: 5,
        },
        {
          organizationId,
          category: "fatura",
          title: "Elektrik + su + internet",
          amountMinor: 850000,
          dayOfMonth: 15,
        },
        {
          organizationId,
          category: "temizlik",
          title: "Temizlik & sarf malzeme",
          amountMinor: 300000,
          dayOfMonth: 20,
        },
      ],
    });
    console.log("3 sabit gider tanımlandı (kira, fatura, temizlik).");
  }

  const existingPayment = await prisma.payment.count({ where: { organizationId } });
  if (existingPayment === 0 && member) {
    const subscription = await prisma.memberSubscription.findFirst({
      where: { memberId: member.id },
      orderBy: { createdAt: "desc" },
    });

    // Paketin yarısı peşin alınmış: kalan borç ekranlarda görünsün.
    const half = Math.round((subscription?.priceMinor ?? 280000) / 2);
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        memberId: member.id,
        subscriptionId: subscription?.id ?? null,
        amountMinor: half,
        method: "nakit",
        paidAt: new Date(),
        note: "Peşinat",
        recordedByUserId: coachUserId,
      },
    });

    // Gelir payı hakedişi — uygulamadaki `recordPayment` ile aynı kural.
    await prisma.coachEarning.create({
      data: {
        organizationId,
        coachUserId,
        memberId: member.id,
        sourceType: "gelir_payi",
        sourceKey: payment.id,
        paymentId: payment.id,
        amountMinor: Math.round((half * 1000) / 10000),
        earnedAt: payment.paidAt,
      },
    });

    console.log("Örnek tahsilat ve antrenör payı yazıldı.");
  }

  const existingExpense = await prisma.expense.count({ where: { organizationId } });
  if (existingExpense === 0) {
    await prisma.expense.createMany({
      data: [
        {
          organizationId,
          category: "ekipman",
          title: "Kum torbası ve eldiven yenileme",
          amountMinor: 1250000,
          spentAt: new Date(),
          recordedByUserId: coachUserId,
        },
        {
          organizationId,
          category: "pazarlama",
          title: "Instagram reklamı",
          amountMinor: 400000,
          spentAt: new Date(),
          recordedByUserId: coachUserId,
        },
      ],
    });
    console.log("2 örnek gider yazıldı.");
  }
}

// ── Beslenme planı ─────────────────────────────────────────────
async function seedNutrition(organizationId, staffUserId, member) {
  if (!member) return;

  const existing = await prisma.nutritionPlan.count({ where: { organizationId } });
  if (existing > 0) {
    console.log("Beslenme planı zaten vardı.");
    return;
  }

  const plan = await prisma.nutritionPlan.create({
    data: {
      organizationId,
      memberId: member.id,
      createdByUserId: staffUserId,
      title: "Antrenman Günü — Sıklet Koruma",
      goal: "Kas kaybetmeden formu korumak",
      status: "aktif",
      dailyCalories: 2600,
      proteinG: 170,
      carbsG: 280,
      fatG: 80,
      notes: "Antrenman öncesi son öğün 90 dakika önce. Günde 3–4 litre su.",
      dayType: "antrenman",
      weekDaysCsv: "1,3,5",
    },
  });

  const meals = [
    {
      title: "Kahvaltı",
      timeLabel: "08:00",
      foods: [
        { name: "Yulaf ezmesi", amount: "80 g", calories: 300, proteinG: 10, carbsG: 54, fatG: 6, alternatives: "Tam buğday ekmeği 2 dilim" },
        { name: "Yumurta", amount: "3 adet", calories: 210, proteinG: 18, carbsG: 1, fatG: 15 },
      ],
    },
    {
      title: "Ara Öğün",
      timeLabel: "11:00",
      foods: [
        { name: "Yoğurt", amount: "200 g", calories: 120, proteinG: 12, carbsG: 9, fatG: 4 },
        { name: "Ceviz", amount: "20 g", calories: 130, proteinG: 3, carbsG: 3, fatG: 13, alternatives: "Badem 20 g" },
      ],
    },
    {
      title: "Öğle",
      timeLabel: "13:00",
      foods: [
        { name: "Tavuk göğsü", amount: "180 g", calories: 300, proteinG: 55, carbsG: 0, fatG: 7 },
        { name: "Pirinç", amount: "150 g pişmiş", calories: 200, proteinG: 4, carbsG: 44, fatG: 1, alternatives: "Bulgur 150 g" },
        { name: "Salata", amount: "1 kase", calories: 80, proteinG: 2, carbsG: 8, fatG: 5 },
      ],
    },
    {
      title: "Antrenman Sonrası",
      timeLabel: "Antrenmandan hemen sonra",
      notes: "Ringden çıkınca 30 dakika içinde.",
      foods: [
        { name: "Whey protein", amount: "1 ölçek", calories: 120, proteinG: 24, carbsG: 3, fatG: 2, alternatives: "Süt 400 ml" },
        { name: "Muz", amount: "1 adet", calories: 105, proteinG: 1, carbsG: 27, fatG: 0 },
      ],
    },
    {
      title: "Akşam",
      timeLabel: "20:00",
      foods: [
        { name: "Somon", amount: "150 g", calories: 310, proteinG: 34, carbsG: 0, fatG: 20, alternatives: "Hindi but 180 g" },
        { name: "Fırın sebze", amount: "1 tabak", calories: 150, proteinG: 5, carbsG: 25, fatG: 4 },
      ],
    },
  ];

  for (const [index, meal] of meals.entries()) {
    const created = await prisma.nutritionMeal.create({
      data: {
        planId: plan.id,
        position: index + 1,
        title: meal.title,
        timeLabel: meal.timeLabel,
        notes: meal.notes ?? null,
      },
    });

    await prisma.nutritionFood.createMany({
      data: meal.foods.map((food, foodIndex) => ({
        mealId: created.id,
        position: foodIndex + 1,
        name: food.name,
        amount: food.amount ?? null,
        calories: food.calories ?? null,
        proteinG: food.proteinG ?? null,
        carbsG: food.carbsG ?? null,
        fatG: food.fatG ?? null,
        alternatives: food.alternatives ?? null,
      })),
    });
  }

  console.log(`Beslenme planı oluşturuldu: ${meals.length} öğün.`);
}

// ── Davet bekleyen sporcu ──────────────────────────────────────
// Davet ekranını boş görmemek için: hesabı olmayan bir sporcu + bekleyen
// davet. Token'ın kendisi saklanmaz (yalnız özeti), bu yüzden bağlantı
// panelden "Yeni Bağlantı Üret" ile alınır.
async function seedPendingInvite(organizationId, staffUserId) {
  const existing = await prisma.member.findFirst({
    where: { organizationId, memberNo: "BB-0002" },
  });
  if (existing) {
    console.log("Davet bekleyen sporcu zaten vardı.");
    return;
  }

  const member = await prisma.member.create({
    data: {
      organizationId,
      memberNo: "BB-0002",
      fullName: "Davet Bekleyen Sporcu",
      email: "davetli@blackbox.test",
      phone: "0555 000 00 00",
      status: "active",
    },
  });

  const { createHash, randomBytes } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");

  await prisma.memberInvite.create({
    data: {
      memberId: member.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      email: member.email,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      createdByUserId: staffUserId,
    },
  });

  console.log(`Davet bekleyen sporcu oluşturuldu. Bağlantı: /davet/${token}`);
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
        // Anlaşılan tutar paketin etiket fiyatı; yarısı peşin alınmış
        // varsayılır ki "borçlu üyelik" ekranı boş görünmesin.
        priceMinor: pack.priceMinor,
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

// ── Kuşak merdiveni & müfredat ─────────────────────────────────
/**
 * Amatör boks/kickbox salonlarında yaygın olan beş kademeli merdiven.
 * Eşikler bilinçli ölçülü: ilk kuşak katılımı ödüllendirir, üst kuşaklar
 * hem ders sayısı hem süre ister — kuşak satın alınan bir şey olmasın diye.
 */
async function seedRanks(organizationId, staffUserId, member) {
  const existing = await prisma.rank.count({ where: { organizationId } });
  if (existing > 0) {
    console.log("Kuşak merdiveni zaten vardı.");
    return;
  }

  const ladder = [
    {
      slug: "beyaz",
      name: "Beyaz Kuşak",
      color: "#e5e7eb",
      minSessions: 0,
      minWeeks: 0,
      summary: "Başlangıç. Duruş, temel guard ve salon kuralları.",
      requirements: [
        { kind: "teknik", label: "Duruşu koruyarak öne-arkaya hareket" },
        { kind: "teknik", label: "Jab — ped üzerinde temiz 2 round", techniqueSlug: "jab" },
        { kind: "katilim", label: "İlk 4 derse katılım" },
      ],
    },
    {
      slug: "sari",
      name: "Sarı Kuşak",
      color: "#facc15",
      minSessions: 16,
      minWeeks: 8,
      summary: "Temel vuruşlar ve savunma refleksinin oturması.",
      requirements: [
        { kind: "teknik", label: "Jab-cross kombinasyonu, ped üzerinde 3 round", techniqueSlug: "jab" },
        { kind: "teknik", label: "Slip ve blok ile 1 round savunma çalışması" },
        { kind: "kondisyon", label: "3 round ip atlama, round arası 1 dk" },
        { kind: "sinav", label: "Antrenör önünde teknik gösterim" },
      ],
    },
    {
      slug: "turuncu",
      name: "Turuncu Kuşak",
      color: "#fb923c",
      minSessions: 40,
      minWeeks: 16,
      summary: "Kombinasyon zinciri, mesafe ve ritim.",
      requirements: [
        { kind: "teknik", label: "Üçlü kombinasyon (1-2-3) hareket hâlinde" },
        { kind: "teknik", label: "Geri adım + karşı vuruş" },
        { kind: "kondisyon", label: "5 round torba, RPE 7 altında kalarak" },
        { kind: "sinav", label: "Kontrollü sparring — teknik değerlendirme" },
      ],
    },
    {
      slug: "yesil",
      name: "Yeşil Kuşak",
      color: "#4ade80",
      minSessions: 80,
      minWeeks: 28,
      summary: "Sparring yetkinliği ve maç okuma.",
      requirements: [
        { kind: "teknik", label: "Açı alarak çıkış (pivot) ve karşı seri" },
        { kind: "teknik", label: "Gövde vuruşlarını kombinasyona katma" },
        { kind: "kondisyon", label: "8 round sparring temposu" },
        { kind: "sinav", label: "İç turnuva ya da salon maçında görev" },
      ],
    },
    {
      slug: "siyah",
      name: "Siyah Kuşak",
      color: "#111827",
      minSessions: 160,
      minWeeks: 52,
      summary: "Salonun ileri seviyesi; yeni başlayanlara yardım sorumluluğu.",
      requirements: [
        { kind: "sinav", label: "Tam teknik sınavı (vuruş, savunma, ayak işi)" },
        { kind: "katilim", label: "En az 3 ay yeni başlayanlara asistanlık" },
        { kind: "sinav", label: "Resmî ya da iç turnuva müsabakası" },
      ],
    },
  ];

  for (const [index, rank] of ladder.entries()) {
    await prisma.rank.create({
      data: {
        organizationId,
        order: index,
        slug: rank.slug,
        name: rank.name,
        color: rank.color,
        summary: rank.summary,
        minSessions: rank.minSessions,
        minWeeks: rank.minWeeks,
        requirements: {
          create: rank.requirements.map((requirement, position) => ({
            position: position + 1,
            kind: requirement.kind,
            label: requirement.label,
            techniqueSlug: requirement.techniqueSlug ?? null,
          })),
        },
      },
    });
  }
  console.log(`${ladder.length} kuşak ve müfredatı oluşturuldu.`);

  // Test üyesi beyaz kuşakla başlasın; sarıya doğru ilerlediği görünsün.
  const white = await prisma.rank.findFirst({
    where: { organizationId, slug: "beyaz" },
  });
  const yellow = await prisma.rank.findFirst({
    where: { organizationId, slug: "sari" },
    include: { requirements: { orderBy: { position: "asc" } } },
  });

  if (white) {
    const awardedAt = new Date();
    awardedAt.setUTCDate(awardedAt.getUTCDate() - 70);
    await prisma.memberRank.create({
      data: {
        memberId: member.id,
        rankId: white.id,
        awardedByUserId: staffUserId,
        awardedAt,
        note: "İlk 4 dersini tamamladı.",
      },
    });
  }

  if (yellow) {
    for (const requirement of yellow.requirements.slice(0, 2)) {
      await prisma.requirementCheck.create({
        data: {
          memberId: member.id,
          requirementId: requirement.id,
          checkedByUserId: staffUserId,
        },
      });
    }
    console.log("Test üyesine beyaz kuşak ve 2 müfredat işareti verildi.");
  }
}

// ── Onam & sağlık beyanı ───────────────────────────────────────
/**
 * Örnek metinler — hukuki danışmanlık değildir, salonun kendi avukatıyla
 * gözden geçirmesi beklenir. Amaç akışın (imza → sürüm → yenileme) boş
 * ekranla değil gerçek bir metinle denenebilmesi.
 */
async function seedWaivers(organizationId) {
  const existing = await prisma.waiverTemplate.count({
    where: { organizationId },
  });
  if (existing > 0) {
    console.log("Onam formları zaten vardı.");
    return;
  }

  const templates = [
    {
      kind: "saglik",
      title: "Sağlık Beyanı",
      requiresGuardian: false,
      isRequired: true,
      questions: [
        "Kalp, tansiyon veya solunum rahatsızlığın var mı?",
        "Son 6 ayda ameliyat geçirdin ya da kırık/çıkık yaşadın mı?",
        "Düzenli kullandığın ilaç var mı?",
        "Baş dönmesi, bayılma veya nöbet öykün var mı?",
        "Antrenmanı etkileyebilecek başka bir sağlık durumun var mı?",
      ],
      body: [
        "Bu beyanı doldururken verdiğim bilgilerin doğru ve eksiksiz olduğunu kabul ederim.",
        "",
        "Dövüş sporlarının temas içeren bir faaliyet olduğunu, antrenmanların yüksek tempolu olabileceğini ve sağlık durumumu doğru bildirmemenin kendi güvenliğimi riske attığını biliyorum.",
        "",
        "Sağlık durumumda bir değişiklik olduğunda (yeni teşhis, sakatlık, ilaç değişikliği, hamilelik) antrenörüme gecikmeden bildireceğimi taahhüt ederim.",
        "",
        "Antrenman sırasında rahatsızlık hissettiğimde derhâl durup antrenörümü bilgilendireceğimi kabul ederim.",
      ].join("\n"),
    },
    {
      kind: "sorumluluk",
      title: "Sorumluluk ve Salon Kuralları",
      requiresGuardian: false,
      isRequired: true,
      questions: [],
      body: [
        "Boks, kickbox ve benzeri dövüş sporlarının yaralanma riski taşıdığını biliyor ve bu riski kendi isteğimle üstleniyorum.",
        "",
        "Antrenörün verdiği talimatlara uyacağımı; ağızlık, bandaj, eldiven ve gerekli koruyucu ekipmanı belirtilen çalışmalarda kullanacağımı kabul ederim.",
        "",
        "Sparring çalışmalarına yalnız antrenörün uygun gördüğü seviyede ve onun gözetiminde katılacağımı, izinsiz sparring yapmayacağımı kabul ederim.",
        "",
        "Salon içinde diğer sporculara ve ekipmana saygılı davranacağımı, öğrendiğim teknikleri salon dışında kavga amacıyla kullanmayacağımı beyan ederim.",
        "",
        "Kendi ihmalimden kaynaklanan sakatlıklarda salonun sorumlu tutulamayacağını kabul ederim. Bu beyan, salonun kendi kusurundan doğan yasal sorumluluğunu ortadan kaldırmaz.",
      ].join("\n"),
    },
    {
      kind: "veli-izni",
      title: "Veli İzni (18 Yaş Altı)",
      requiresGuardian: true,
      isRequired: false,
      questions: [
        "Çocuğunuzun bilinen bir sağlık sorunu var mı?",
        "Acil durumda ilk yardım uygulanmasına izin veriyor musunuz?",
      ],
      body: [
        "Velisi olduğum sporcunun BlackBox bünyesindeki antrenmanlara katılmasına izin veriyorum.",
        "",
        "Sporcunun sağlık durumunu doğru bildirdiğimi, değişiklik olduğunda salonu bilgilendireceğimi kabul ederim.",
        "",
        "Acil bir durumda ulaşılamadığım takdirde sporcunun en yakın sağlık kuruluşuna götürülmesine onay veriyorum.",
        "",
        "Sporcunun salona geliş-gidiş sorumluluğunun bana ait olduğunu biliyorum.",
      ].join("\n"),
    },
    {
      kind: "kvkk",
      title: "KVKK Aydınlatma Metni",
      requiresGuardian: false,
      isRequired: true,
      questions: [],
      body: [
        "BlackBox; üyelik ve antrenman takibi amacıyla ad-soyad, iletişim bilgisi, doğum tarihi, sağlık beyanı, antrenman ve tartı kayıtlarını işler.",
        "",
        "Veriler yalnız salonun antrenör ve yöneticileri tarafından, hizmetin yürütülmesi amacıyla görülür; üçüncü kişilerle paylaşılmaz.",
        "",
        "Kişisel verilerine erişme, düzeltilmesini ve silinmesini isteme hakkın vardır. Verilerinin tamamını panelindeki Verilerimi indir bağlantısından her zaman indirebilirsin.",
        "",
        "Silme talebinde kimlik bilgilerin kalıcı olarak kaldırılır; salonun doluluk istatistikleri kimliksiz olarak korunur.",
      ].join("\n"),
    },
  ];

  for (const template of templates) {
    await prisma.waiverTemplate.create({
      data: {
        organizationId,
        kind: template.kind,
        title: template.title,
        body: template.body,
        questionsJson: template.questions.length
          ? JSON.stringify(template.questions)
          : null,
        requiresGuardian: template.requiresGuardian,
        isRequired: template.isRequired,
      },
    });
  }
  console.log(`${templates.length} onam formu oluşturuldu.`);
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
