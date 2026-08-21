import { describe, expect, it } from "vitest";
import { summarizeDue } from "./dues";

const NOW = new Date("2026-08-20T09:00:00.000Z");
const FUTURE = new Date("2026-09-30T20:59:59.000Z");
const PAST = new Date("2026-07-31T20:59:59.000Z");

describe("summarizeDue", () => {
  it("tamamı ödendiyse borç kalmaz", () => {
    const due = summarizeDue({
      priceMinor: 250000,
      paidMinor: 250000,
      endDate: FUTURE,
      now: NOW,
    });
    expect(due.balanceMinor).toBe(0);
    expect(due.status).toBe("odendi");
    expect(due.ratio).toBe(1);
  });

  it("kısmi ödeme kalanı gösterir", () => {
    const due = summarizeDue({
      priceMinor: 250000,
      paidMinor: 100000,
      endDate: FUTURE,
      now: NOW,
    });
    expect(due.balanceMinor).toBe(150000);
    expect(due.status).toBe("kismi");
    expect(due.ratio).toBeCloseTo(0.4);
  });

  it("hiç ödenmemiş ve süresi varsa 'bekliyor'", () => {
    expect(
      summarizeDue({ priceMinor: 250000, paidMinor: 0, endDate: FUTURE, now: NOW })
        .status,
    ).toBe("bekliyor");
  });

  it("üyelik bittiği hâlde borç varsa 'gecikti'", () => {
    expect(
      summarizeDue({ priceMinor: 250000, paidMinor: 50000, endDate: PAST, now: NOW })
        .status,
    ).toBe("gecikti");
  });

  it("biten üyeliğin borcu yoksa gecikmiş saymaz", () => {
    expect(
      summarizeDue({ priceMinor: 250000, paidMinor: 250000, endDate: PAST, now: NOW })
        .status,
    ).toBe("odendi");
  });

  it("ücretsiz üyelik borç doğurmaz", () => {
    const due = summarizeDue({
      priceMinor: 0,
      paidMinor: 0,
      endDate: PAST,
      now: NOW,
    });
    expect(due.status).toBe("odendi");
    expect(due.ratio).toBe(1);
  });

  it("fazla ödemeyi ayrı tutar, borcu eksiye düşürmez", () => {
    const due = summarizeDue({
      priceMinor: 100000,
      paidMinor: 120000,
      endDate: FUTURE,
      now: NOW,
    });
    expect(due.balanceMinor).toBe(0);
    expect(due.overpaidMinor).toBe(20000);
    expect(due.ratio).toBe(1);
  });
});
