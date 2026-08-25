import { describe, expect, it } from "vitest";
import {
  compareRadarPriority,
  countByBand,
  countBySignal,
  evaluateMemberRadar,
  RADAR_BAND_CUTOFF,
  type MemberRadarInput,
} from "./member-radar";

const NOW = new Date("2026-08-21T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);
const weeksAgo = (n: number) => new Date(NOW.getTime() - n * WEEK);

/** Hiçbir sinyal üretmeyen sağlıklı sporcu — testler bundan sapar. */
function healthy(overrides: Partial<MemberRadarInput> = {}): MemberRadarInput {
  return {
    now: NOW,
    memberSince: daysAgo(120),
    lastActivityAt: daysAgo(2),
    lastCheckInWeek: weeksAgo(1),
    overallScore: 78,
    sorenessFlag: false,
    settledBookings: 10,
    noShowCount: 1,
    membership: { daysLeft: 60, remaining: 18, unlimited: false },
    overdueMinor: 0,
    pendingWaivers: 0,
    hasAccount: true,
    hasCoach: true,
    ...overrides,
  };
}

const keysOf = (input: MemberRadarInput) =>
  evaluateMemberRadar(input).signals.map((signal) => signal.key);

describe("evaluateMemberRadar — temel", () => {
  it("sağlıklı sporcuda sinyal üretmez", () => {
    const radar = evaluateMemberRadar(healthy());
    expect(radar.signals).toEqual([]);
    expect(radar.riskScore).toBe(0);
    expect(radar.band).toBe("yolunda");
  });

  it("risk puanı 100'de kapanır", () => {
    const radar = evaluateMemberRadar(
      healthy({
        lastActivityAt: daysAgo(40),
        lastCheckInWeek: null,
        overallScore: 20,
        sorenessFlag: true,
        settledBookings: 10,
        noShowCount: 8,
        membership: null,
        overdueMinor: 500_00,
        pendingWaivers: 2,
        hasAccount: false,
        hasCoach: false,
      }),
    );
    expect(radar.riskScore).toBe(100);
    expect(radar.band).toBe("kritik");
  });

  it("sinyalleri önce ağırlığa göre değil, önce şiddete göre sıralar", () => {
    const radar = evaluateMemberRadar(
      healthy({ sorenessFlag: true, pendingWaivers: 1 }),
    );
    // Ağrı (kritik, 12) onam eksiğinin (uyarı, 10) üstünde durur.
    expect(radar.signals[0].key).toBe("agri");
    expect(radar.signals[1].key).toBe("onam-eksik");
  });
});

describe("devamlılık sinyalleri", () => {
  it("sessizlik süresine göre ağırlık artar", () => {
    const at = (days: number) =>
      evaluateMemberRadar(healthy({ lastActivityAt: daysAgo(days) }));

    expect(at(5).signals).toEqual([]);
    expect(at(8).riskScore).toBe(10);
    expect(at(16).riskScore).toBe(25);
    expect(at(30).riskScore).toBe(45);
  });

  it("üç haftalık sessizlik tek başına kritik banda taşır", () => {
    expect(evaluateMemberRadar(healthy({ lastActivityAt: daysAgo(25) })).band).toBe(
      "kritik",
    );
    expect(evaluateMemberRadar(healthy({ lastActivityAt: daysAgo(16) })).band).toBe(
      "izle",
    );
  });

  it("yeni sporcunun kısa sessizliğini işaretlemez", () => {
    const yeni = healthy({
      memberSince: daysAgo(9),
      lastActivityAt: daysAgo(8),
      lastCheckInWeek: null,
    });
    expect(keysOf(yeni)).not.toContain("gelmiyor");
    expect(evaluateMemberRadar(yeni).band).toBe("yeni");
  });

  it("yeni sporcu bile iki haftayı geçince işaretlenir", () => {
    const radar = evaluateMemberRadar(
      healthy({ memberSince: daysAgo(13), lastActivityAt: daysAgo(15) }),
    );
    expect(radar.signals.map((s) => s.key)).toContain("gelmiyor");
  });

  it("hiç kaydı olmayan yeni sporcu ilk günlerde sıraya girmez", () => {
    const radar = evaluateMemberRadar(
      healthy({
        memberSince: daysAgo(4),
        lastActivityAt: null,
        lastCheckInWeek: null,
      }),
    );
    expect(radar.signals).toEqual([]);
    expect(radar.band).toBe("yeni");
    expect(radar.daysQuiet).toBeNull();
  });

  it("on günü geçtiği hâlde hiç başlamayanı ayrı sinyalle işaretler", () => {
    const radar = evaluateMemberRadar(
      healthy({
        memberSince: daysAgo(12),
        lastActivityAt: null,
        lastCheckInWeek: null,
      }),
    );
    expect(radar.signals.map((s) => s.key)).toContain("hic-baslamadi");
    expect(radar.signals.map((s) => s.key)).not.toContain("gelmiyor");
    expect(radar.band).toBe("kritik");
  });

  it("gelme oranını yalnız yeterli yoklama varken hesaplar", () => {
    const az = evaluateMemberRadar(
      healthy({ settledBookings: 3, noShowCount: 3 }),
    );
    expect(az.showRate).toBeNull();
    expect(az.signals.map((s) => s.key)).not.toContain("gelmedi-cok");

    const yeterli = evaluateMemberRadar(
      healthy({ settledBookings: 10, noShowCount: 4 }),
    );
    expect(yeterli.showRate).toBe(60);
    expect(yeterli.signals.map((s) => s.key)).toContain("gelmedi-cok");
  });

  it("kontrol gecikmesini haftaya göre derecelendirir", () => {
    const ikiHafta = evaluateMemberRadar(
      healthy({ lastCheckInWeek: weeksAgo(2) }),
    );
    const dortHafta = evaluateMemberRadar(
      healthy({ lastCheckInWeek: weeksAgo(5) }),
    );
    expect(ikiHafta.riskScore).toBe(8);
    expect(dortHafta.riskScore).toBe(15);
  });

  it("ilk haftasındaki sporcudan kontrol beklemez", () => {
    const radar = evaluateMemberRadar(
      healthy({
        memberSince: daysAgo(5),
        lastActivityAt: daysAgo(1),
        lastCheckInWeek: null,
      }),
    );
    expect(radar.signals.map((s) => s.key)).not.toContain("kontrol-yok");
  });

  it("ağrıyı kritik sayar", () => {
    const radar = evaluateMemberRadar(healthy({ sorenessFlag: true }));
    expect(radar.signals[0]).toMatchObject({ key: "agri", severity: "kritik" });
  });
});

describe("ticari sinyaller", () => {
  it("üyeliksiz aktif sporcuyu kritik işaretler", () => {
    const radar = evaluateMemberRadar(healthy({ membership: null }));
    expect(radar.signals.map((s) => s.key)).toContain("uyelik-yok");
    expect(radar.riskScore).toBe(30);
  });

  it("biten üyeliği aciliyetine göre ayırır", () => {
    const yakin = evaluateMemberRadar(
      healthy({ membership: { daysLeft: 12, remaining: 8, unlimited: false } }),
    );
    const acil = evaluateMemberRadar(
      healthy({ membership: { daysLeft: 3, remaining: 8, unlimited: false } }),
    );
    expect(yakin.riskScore).toBe(12);
    expect(acil.riskScore).toBe(20);
  });

  it("sınırsız pakette ders hakkı sinyali üretmez", () => {
    const radar = evaluateMemberRadar(
      healthy({
        membership: { daysLeft: 60, remaining: null, unlimited: true },
      }),
    );
    expect(radar.signals).toEqual([]);
  });

  it("biten ders hakkını kritik, azalanı uyarı sayar", () => {
    const bitti = evaluateMemberRadar(
      healthy({ membership: { daysLeft: 40, remaining: 0, unlimited: false } }),
    );
    const azaldi = evaluateMemberRadar(
      healthy({ membership: { daysLeft: 40, remaining: 2, unlimited: false } }),
    );
    expect(bitti.signals[0]).toMatchObject({
      key: "hak-bitti",
      severity: "kritik",
    });
    expect(azaldi.signals[0]).toMatchObject({
      key: "hak-bitti",
      severity: "uyari",
    });
  });

  it("gecikmiş borcu tutarıyla yazar", () => {
    const radar = evaluateMemberRadar(healthy({ overdueMinor: 125_000 }));
    const [signal] = radar.signals;
    expect(signal.key).toBe("borc-gecikti");
    expect(signal.label).toContain("1.250");
  });
});

describe("idari sinyaller", () => {
  it("eksik onamı, hesapsızlığı ve antrenörsüzlüğü ayrı işaretler", () => {
    const keys = keysOf(
      healthy({ pendingWaivers: 2, hasAccount: false, hasCoach: false }),
    );
    expect(keys).toEqual(
      expect.arrayContaining(["onam-eksik", "hesap-yok", "antrenorsuz"]),
    );
  });

  it("yalnız idari sinyaller sporcuyu kritik banda taşımaz", () => {
    const radar = evaluateMemberRadar(
      healthy({ pendingWaivers: 1, hasAccount: false, hasCoach: false }),
    );
    expect(radar.riskScore).toBeLessThan(RADAR_BAND_CUTOFF.kritik);
    expect(radar.band).toBe("izle");
  });
});

describe("bant ve sıralama", () => {
  it("eşikleri banda çevirir", () => {
    // 30 (üyelik yok) + 25 (16 gün sessiz) = 55 → kritik
    expect(
      evaluateMemberRadar(
        healthy({ membership: null, lastActivityAt: daysAgo(16) }),
      ).band,
    ).toBe("kritik");
    // 20 (borç) → izle
    expect(evaluateMemberRadar(healthy({ overdueMinor: 100 })).band).toBe(
      "izle",
    );
    // 10 (8 gün sessiz) → eşiğin altı
    expect(
      evaluateMemberRadar(healthy({ lastActivityAt: daysAgo(8) })).band,
    ).toBe("yolunda");
  });

  it("eşit puanda daha uzun süredir sessiz olan üstte durur", () => {
    const rows = [
      { riskScore: 30, daysQuiet: 5 },
      { riskScore: 30, daysQuiet: 40 },
      { riskScore: 55, daysQuiet: 1 },
    ];
    expect([...rows].sort(compareRadarPriority)).toEqual([
      { riskScore: 55, daysQuiet: 1 },
      { riskScore: 30, daysQuiet: 40 },
      { riskScore: 30, daysQuiet: 5 },
    ]);
  });

  it("hiç kaydı olmayanı sıralamada en sona iter (eşit puanda)", () => {
    const rows = [
      { riskScore: 40, daysQuiet: null },
      { riskScore: 40, daysQuiet: 0 },
    ];
    expect([...rows].sort(compareRadarPriority)[0].daysQuiet).toBe(0);
  });
});

describe("toplu sayımlar", () => {
  it("bant başına sayar", () => {
    const rows = [
      { band: "kritik" as const },
      { band: "kritik" as const },
      { band: "yolunda" as const },
    ];
    expect(countByBand(rows)).toEqual({
      kritik: 2,
      izle: 0,
      yeni: 0,
      yolunda: 1,
    });
  });

  it("sinyal başına kaç sporcu olduğunu çoktan aza sıralar", () => {
    const rows = [
      evaluateMemberRadar(healthy({ membership: null })),
      evaluateMemberRadar(healthy({ membership: null, sorenessFlag: true })),
      evaluateMemberRadar(healthy()),
    ];
    expect(countBySignal(rows)).toEqual([
      { key: "uyelik-yok", count: 2 },
      { key: "agri", count: 1 },
    ]);
  });
});
