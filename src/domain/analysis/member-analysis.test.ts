import { describe, expect, it } from "vitest";
import {
  analyzeAttendance,
  analyzeCheckIns,
  analyzeMember,
  analyzePackage,
  analyzeVolume,
  analyzeWeight,
  compareTrend,
  type AnalysisInput,
} from "./member-analysis";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const weeksAgo = (n: number) => new Date(NOW.getTime() - n * WEEK);

function baseInput(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    now: NOW,
    memberSince: weeksAgo(12),
    attendance: [],
    trainings: [],
    checkIns: [],
    weights: [],
    planCompletion: null,
    nutritionPercent: null,
    membership: null,
    ...overrides,
  };
}

describe("compareTrend", () => {
  it("iki dönem de boşsa yön yok", () => {
    expect(compareTrend(0, 0)).toBe("belirsiz");
  });

  it("%20 altındaki farkı gürültü sayar", () => {
    expect(compareTrend(11, 10)).toBe("sabit");
    expect(compareTrend(9, 10)).toBe("sabit");
  });

  it("eşiği aşan farkta yön verir", () => {
    expect(compareTrend(13, 10)).toBe("yukselis");
    expect(compareTrend(7, 10)).toBe("dusus");
  });
});

describe("analyzeAttendance", () => {
  it("yalnız yoklaması alınmış seansları sayar", () => {
    const result = analyzeAttendance({
      now: NOW,
      attendance: [
        { startsAt: daysAgo(3), status: "katildi" },
        { startsAt: daysAgo(5), status: "gelmedi" },
        { startsAt: daysAgo(1), status: "onayli" }, // henüz olmadı
        { startsAt: daysAgo(9), status: "iptal" },
      ],
    });

    expect(result.scheduled).toBe(2);
    expect(result.attended).toBe(1);
    expect(result.missed).toBe(1);
    expect(result.showRate).toBe(50);
  });

  it("son 4 hafta ile önceki 4 haftayı ayırır", () => {
    const result = analyzeAttendance({
      now: NOW,
      attendance: [
        { startsAt: weeksAgo(1), status: "katildi" },
        { startsAt: weeksAgo(2), status: "katildi" },
        { startsAt: weeksAgo(5), status: "katildi" },
        { startsAt: weeksAgo(6), status: "katildi" },
        { startsAt: weeksAgo(7), status: "katildi" },
        { startsAt: weeksAgo(9), status: "katildi" }, // pencere dışı
      ],
    });

    expect(result.recentCount).toBe(2);
    expect(result.previousCount).toBe(3);
    expect(result.trend).toBe("dusus");
  });

  it("hiç kayıt yoksa güven yok", () => {
    const result = analyzeAttendance({ now: NOW, attendance: [] });
    expect(result.confidence).toBe("yok");
    expect(result.daysSinceLastVisit).toBeNull();
  });

  it("son gelişten bu yana geçen günü hesaplar", () => {
    const result = analyzeAttendance({
      now: NOW,
      attendance: [
        { startsAt: daysAgo(20), status: "katildi" },
        { startsAt: daysAgo(35), status: "katildi" },
      ],
    });
    expect(result.daysSinceLastVisit).toBe(20);
  });
});

describe("analyzeVolume", () => {
  it("dakikaları dönemlere ayırır ve ortalama şiddeti verir", () => {
    const result = analyzeVolume({
      now: NOW,
      trainings: [
        { loggedAt: weeksAgo(1), durationMinutes: 60, intensity: 7 },
        { loggedAt: weeksAgo(2), durationMinutes: 60, intensity: 9 },
        { loggedAt: weeksAgo(6), durationMinutes: 300, intensity: 6 },
      ],
    });

    expect(result.recentMinutes).toBe(120);
    expect(result.previousMinutes).toBe(300);
    expect(result.trend).toBe("dusus");
    expect(result.averageIntensity).toBe(8);
  });
});

describe("analyzeCheckIns", () => {
  it("üyelik süresini en fazla 8 haftaya sabitler", () => {
    const result = analyzeCheckIns({
      now: NOW,
      memberSince: weeksAgo(40),
      checkIns: [],
    });
    expect(result.expectedWeeks).toBe(8);
  });

  it("yeni üyede güveni düşük işaretler", () => {
    const result = analyzeCheckIns({
      now: NOW,
      memberSince: weeksAgo(1),
      checkIns: [],
    });
    expect(result.expectedWeeks).toBe(1);
    expect(result.confidence).toBe("dusuk");
  });

  it("kesintisiz haftaları seri sayar, boşlukta durur", () => {
    const result = analyzeCheckIns({
      now: NOW,
      memberSince: weeksAgo(12),
      checkIns: [
        { weekStart: weeksAgo(1) },
        { weekStart: weeksAgo(2) },
        { weekStart: weeksAgo(3) },
        { weekStart: weeksAgo(6) },
      ],
    });
    expect(result.streak).toBe(3);
  });
});

describe("analyzeWeight", () => {
  it("ölçüm yoksa null döner", () => {
    const result = analyzeWeight({ weights: [] });
    expect(result.deltaKg).toBeNull();
    expect(result.confidence).toBe("yok");
  });

  it("ilk-son farkını ve haftalık hızı hesaplar", () => {
    const result = analyzeWeight({
      weights: [
        { takenAt: weeksAgo(4), weightKg: 80 },
        { takenAt: weeksAgo(2), weightKg: 78 },
        { takenAt: NOW, weightKg: 76 },
      ],
    });

    expect(result.deltaKg).toBe(-4);
    expect(result.weeklyDeltaKg).toBe(-1);
    expect(result.measurements).toBe(3);
  });

  it("tek günlük aralıkta haftalık hız üretmez", () => {
    const result = analyzeWeight({
      weights: [
        { takenAt: daysAgo(1), weightKg: 80 },
        { takenAt: NOW, weightKg: 79 },
      ],
    });
    expect(result.weeklyDeltaKg).toBeNull();
  });
});

describe("analyzePackage", () => {
  it("üyelik yoksa null", () => {
    expect(analyzePackage({ membership: null }, 2)).toBeNull();
  });

  it("ders hakkı süreden önce bitiyorsa darboğaz haktır", () => {
    const result = analyzePackage(
      {
        membership: {
          endDate: new Date(NOW.getTime() + 60 * DAY),
          daysLeft: 60,
          sessionsRemaining: 4,
          unlimited: false,
        },
      },
      2,
    );

    expect(result?.weeksUntilCreditsOut).toBe(2);
    expect(result?.bottleneck).toBe("hak");
    expect(result?.wastesCredits).toBe(false);
  });

  it("hak bu hızla bitmiyorsa boşa gidiyor uyarısı verir", () => {
    const result = analyzePackage(
      {
        membership: {
          endDate: new Date(NOW.getTime() + 14 * DAY),
          daysLeft: 14,
          sessionsRemaining: 20,
          unlimited: false,
        },
      },
      1,
    );

    expect(result?.wastesCredits).toBe(true);
    expect(result?.bottleneck).toBe("sure");
  });

  it("sınırsız pakette hak hesabı yapılmaz", () => {
    const result = analyzePackage(
      {
        membership: {
          endDate: new Date(NOW.getTime() + 30 * DAY),
          daysLeft: 30,
          sessionsRemaining: null,
          unlimited: true,
        },
      },
      3,
    );

    expect(result?.weeksUntilCreditsOut).toBeNull();
    expect(result?.wastesCredits).toBe(false);
  });
});

describe("analyzeMember", () => {
  it("veri yokken uydurma yüzde üretmez", () => {
    const result = analyzeMember(baseInput());
    expect(result.confidence).toBe("yok");
    expect(result.continuityScore).toBe(0);
    expect(result.summary).toContain("kayıt yok");
    // Yoklama kaydı hiç yokken "gelmiyor"/"gelme oranı düşük" gibi bir
    // sonuç ÜRETİLMEZ; yalnız gerçekten ölçülen kontrol devamlılığı bayrağı
    // çıkar (12 haftalık üyeden tek kontrol gelmemiş).
    expect(result.flags.map((row) => row.key)).toEqual(["kontrol-yok"]);
  });

  it("iki haftadır gelmeyeni yüksek öncelikli bayrakla işaretler", () => {
    const result = analyzeMember(
      baseInput({
        attendance: [
          { startsAt: daysAgo(16), status: "katildi" },
          { startsAt: daysAgo(20), status: "katildi" },
        ],
      }),
    );

    const flag = result.flags.find((row) => row.key === "gelmiyor");
    expect(flag?.severity).toBe("yuksek");
    expect(flag?.label).toContain("16 gün");
  });

  it("ölçülemeyen boyut devamlılık ortalamasına girmez", () => {
    const result = analyzeMember(
      baseInput({
        attendance: [
          { startsAt: daysAgo(2), status: "katildi" },
          { startsAt: daysAgo(4), status: "katildi" },
        ],
        checkIns: [],
        planCompletion: null,
        nutritionPercent: null,
      }),
    );

    // Yalnız gelme oranı (%100) ve kontrol yüzdesi (%0) ortalamaya girer.
    expect(result.continuityScore).toBe(50);
  });

  it("beslenme ve plan uyumu düşükse ikisini de bayraklar", () => {
    const result = analyzeMember(
      baseInput({
        planCompletion: { completed: 2, expected: 12 },
        nutritionPercent: 30,
      }),
    );

    expect(result.planPercent).toBe(17);
    expect(result.flags.map((row) => row.key)).toEqual(
      expect.arrayContaining(["plan-uyumsuz", "beslenme-uyumsuz"]),
    );
  });

  it("güveni düşük beslenme verisi bayrak üretmez ve ortalamayı bozmaz", () => {
    // Yeni yazılmış plan: iki günlük veriyle %20 çıkmış. Bu bir davranış
    // değil, sadece zaman eksikliği — antrenöre "uyumsuz" denemez.
    const dusuk = analyzeMember(
      baseInput({
        attendance: [
          { startsAt: daysAgo(2), status: "katildi" },
          { startsAt: daysAgo(4), status: "katildi" },
        ],
        nutritionPercent: 20,
        nutritionConfidence: "dusuk",
      }),
    );

    expect(dusuk.flags.map((row) => row.key)).not.toContain(
      "beslenme-uyumsuz",
    );
    // Yüzde ekranda yine gösterilir, yalnız yoruma katılmaz.
    expect(dusuk.nutritionPercent).toBe(20);
    expect(dusuk.continuityScore).toBe(50);

    const yeterli = analyzeMember(
      baseInput({
        attendance: [
          { startsAt: daysAgo(2), status: "katildi" },
          { startsAt: daysAgo(4), status: "katildi" },
        ],
        nutritionPercent: 20,
        nutritionConfidence: "yeterli",
      }),
    );

    expect(yeterli.flags.map((row) => row.key)).toContain("beslenme-uyumsuz");
    expect(yeterli.continuityScore).toBe(40);
  });

  it("bayraklar önce yüksek öncelikli olacak şekilde sıralanır", () => {
    const result = analyzeMember(
      baseInput({
        attendance: [
          { startsAt: daysAgo(30), status: "katildi" },
          { startsAt: daysAgo(32), status: "gelmedi" },
          { startsAt: daysAgo(34), status: "gelmedi" },
          { startsAt: daysAgo(36), status: "gelmedi" },
        ],
        nutritionPercent: 10,
      }),
    );

    expect(result.flags[0].severity).toBe("yuksek");
  });

  it("yeterli veride özet gerçek sayıları anlatır", () => {
    const result = analyzeMember(
      baseInput({
        memberSince: weeksAgo(20),
        attendance: [
          { startsAt: weeksAgo(1), status: "katildi" },
          { startsAt: weeksAgo(2), status: "katildi" },
          { startsAt: weeksAgo(3), status: "katildi" },
          { startsAt: weeksAgo(5), status: "katildi" },
          { startsAt: weeksAgo(6), status: "katildi" },
        ],
        checkIns: [
          { weekStart: weeksAgo(1) },
          { weekStart: weeksAgo(2) },
          { weekStart: weeksAgo(3) },
        ],
      }),
    );

    expect(result.confidence).toBe("yeterli");
    expect(result.summary).toContain("Son 4 haftada 3");
    expect(result.summary).toContain("önceki 4 haftada 2");
  });
});
