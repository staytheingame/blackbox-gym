import { describe, expect, it } from "vitest";
import {
  compareCoachPriority,
  evaluateCoachScorecard,
  fillRateOf,
  portfolioBalance,
  riskRatioOf,
  showRateOf,
  type CoachScorecardInput,
} from "./coach-scorecard";

/** Masası temiz, portföyü sağlıklı antrenör — testler bundan sapar. */
function clean(
  overrides: Partial<CoachScorecardInput> = {},
): CoachScorecardInput {
  return {
    portfolio: 12,
    activeMembers: 10,
    criticalMembers: 1,
    watchMembers: 2,
    quietMembers: 0,
    slotsOpened: 20,
    capacityOffered: 40,
    seatsBooked: 32,
    sessionsHeld: 18,
    seatsAttended: 28,
    seatsNoShow: 3,
    attendanceBacklog: 0,
    checkInBacklog: 0,
    monthlySessionQuota: null,
    hasCompensation: true,
    isActive: true,
    ...overrides,
  };
}

const keysOf = (input: CoachScorecardInput) =>
  evaluateCoachScorecard(input).attention.map((item) => item.key);

describe("oranlar", () => {
  it("yeterli seans yoksa doluluk hesaplamaz", () => {
    expect(fillRateOf(clean({ slotsOpened: 3 }))).toBeNull();
    expect(fillRateOf(clean({ slotsOpened: 20, capacityOffered: 0 }))).toBeNull();
  });

  it("doluluğu kontenjan üzerinden hesaplar", () => {
    expect(fillRateOf(clean({ capacityOffered: 40, seatsBooked: 30 }))).toBe(75);
  });

  it("yeterli yoklama yoksa gelme oranı hesaplamaz", () => {
    expect(showRateOf(clean({ seatsAttended: 3, seatsNoShow: 1 }))).toBeNull();
  });

  it("gelme oranını yoklaması alınmış yerler üzerinden hesaplar", () => {
    expect(showRateOf(clean({ seatsAttended: 15, seatsNoShow: 5 }))).toBe(75);
  });

  it("sporcusu olmayan antrenörde risk oranı yoktur", () => {
    expect(riskRatioOf(clean({ activeMembers: 0 }))).toBeNull();
  });
});

describe("birikmiş iş", () => {
  it("temiz masada dikkat maddesi üretmez", () => {
    const card = evaluateCoachScorecard(clean());
    expect(card.attention).toEqual([]);
    expect(card.backlogScore).toBe(0);
    expect(card.state).toBe("temiz");
  });

  it("yoklama birikmesini eşiğe göre derecelendirir", () => {
    const az = evaluateCoachScorecard(clean({ attendanceBacklog: 2 }));
    const orta = evaluateCoachScorecard(clean({ attendanceBacklog: 4 }));
    const cok = evaluateCoachScorecard(clean({ attendanceBacklog: 12 }));

    expect(az.attention).toEqual([]);
    expect(orta.backlogScore).toBe(15);
    expect(cok.backlogScore).toBe(30);
    expect(cok.attention[0].severity).toBe("kritik");
  });

  it("incelenmemiş kontrolleri ayrı madde yazar", () => {
    const card = evaluateCoachScorecard(clean({ checkInBacklog: 9 }));
    expect(card.attention[0]).toMatchObject({
      key: "kontrol-birikti",
      severity: "kritik",
    });
  });

  it("iki birikme bir arada masayı 'birikmis' yapar", () => {
    const card = evaluateCoachScorecard(
      clean({ attendanceBacklog: 10, checkInBacklog: 10 }),
    );
    expect(card.backlogScore).toBe(55);
    expect(card.state).toBe("birikmis");
  });
});

describe("portföy", () => {
  it("sporcusu olmayan antrenörü bilgi maddesiyle işaretler", () => {
    const card = evaluateCoachScorecard(
      clean({ portfolio: 0, activeMembers: 0, criticalMembers: 0 }),
    );
    expect(card.attention).toHaveLength(1);
    expect(card.attention[0]).toMatchObject({
      key: "sporcu-yok",
      severity: "bilgi",
    });
  });

  it("kritik sporcu oranını eşiğe göre derecelendirir", () => {
    const uyari = evaluateCoachScorecard(
      clean({ activeMembers: 10, criticalMembers: 3 }),
    );
    const kritik = evaluateCoachScorecard(
      clean({ activeMembers: 10, criticalMembers: 4 }),
    );

    expect(uyari.attention[0]).toMatchObject({
      key: "riskli-portfoy",
      severity: "uyari",
    });
    expect(kritik.attention[0]).toMatchObject({
      key: "riskli-portfoy",
      severity: "kritik",
    });
    expect(kritik.riskRatio).toBeCloseTo(0.4);
  });

  it("sessiz sporcuyu sayısına göre bilgi ya da uyarı yapar", () => {
    expect(
      evaluateCoachScorecard(clean({ quietMembers: 2 })).attention[0].severity,
    ).toBe("bilgi");
    expect(
      evaluateCoachScorecard(clean({ quietMembers: 6 })).attention[0].severity,
    ).toBe("uyari");
  });
});

describe("yük ve kota", () => {
  it("düşük doluluğu ve düşük gelme oranını ayrı ayrı yazar", () => {
    const keys = keysOf(
      clean({
        capacityOffered: 40,
        seatsBooked: 12,
        seatsAttended: 8,
        seatsNoShow: 6,
      }),
    );
    expect(keys).toEqual(
      expect.arrayContaining(["doluluk-dusuk", "gelme-orani-dusuk"]),
    );
  });

  it("kota aşımını yazar", () => {
    const card = evaluateCoachScorecard(
      clean({ monthlySessionQuota: 16, sessionsHeld: 20 }),
    );
    expect(card.attention[0]).toMatchObject({ key: "kota-asildi" });
    expect(card.quotaUsage).toBe(125);
  });

  it("yarısı kullanılmayan kotayı boş kapasite sayar", () => {
    const card = evaluateCoachScorecard(
      clean({ monthlySessionQuota: 40, sessionsHeld: 10 }),
    );
    expect(card.attention[0]).toMatchObject({
      key: "kota-bos",
      severity: "bilgi",
    });
  });

  it("kota yoksa kullanım oranı üretmez", () => {
    expect(evaluateCoachScorecard(clean()).quotaUsage).toBeNull();
  });

  it("ders verip hakediş tanımı olmayanı uyarır", () => {
    expect(keysOf(clean({ hasCompensation: false }))).toContain(
      "hakedis-tanimsiz",
    );
    // Hiç ders vermediyse tanımsız hakediş bir sorun değildir.
    expect(
      keysOf(clean({ hasCompensation: false, sessionsHeld: 0 })),
    ).not.toContain("hakedis-tanimsiz");
  });

  it("aktif sporcu başına düşen seansı verir", () => {
    expect(
      evaluateCoachScorecard(clean({ sessionsHeld: 18, activeMembers: 10 }))
        .sessionsPerMember,
    ).toBe(1.8);
  });
});

describe("kapalı hesap", () => {
  it("kapalı hesap için iş listesi üretmez", () => {
    const card = evaluateCoachScorecard(
      clean({ isActive: false, attendanceBacklog: 20, checkInBacklog: 20 }),
    );
    expect(card.attention).toEqual([]);
    expect(card.state).toBe("temiz");
  });

  it("kapalı hesabın oranları yine de okunur", () => {
    const card = evaluateCoachScorecard(clean({ isActive: false }));
    expect(card.fillRate).toBe(80);
    expect(card.showRate).toBe(90);
  });
});

describe("sıralama ve denge", () => {
  it("birikmiş işi çok olanı üste alır, eşitlikte portföyü büyük olanı", () => {
    const rows = [
      { backlogScore: 10, portfolio: 30 },
      { backlogScore: 50, portfolio: 5 },
      { backlogScore: 10, portfolio: 40 },
    ];
    expect([...rows].sort(compareCoachPriority)).toEqual([
      { backlogScore: 50, portfolio: 5 },
      { backlogScore: 10, portfolio: 40 },
      { backlogScore: 10, portfolio: 30 },
    ]);
  });

  it("boş kadroda denge hesabı çökmez", () => {
    expect(portfolioBalance([])).toEqual({
      total: 0,
      average: 0,
      max: 0,
      min: 0,
      spread: 0,
    });
  });

  it("eşit dağılımda yayılım sıfırdır", () => {
    expect(
      portfolioBalance([{ portfolio: 10 }, { portfolio: 10 }]).spread,
    ).toBe(0);
  });

  it("dengesiz dağılımı ortalamaya oranlar", () => {
    const balance = portfolioBalance([
      { portfolio: 40 },
      { portfolio: 4 },
      { portfolio: 4 },
    ]);
    expect(balance.total).toBe(48);
    expect(balance.average).toBe(16);
    expect(balance.max).toBe(40);
    expect(balance.min).toBe(4);
    expect(balance.spread).toBe(2.25);
  });
});
