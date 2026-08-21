import { describe, expect, it } from "vitest";
import {
  canCancelBooking,
  evaluateBooking,
  summarizeCredits,
  type BookingStatus,
} from "./credits";

const NOW = new Date("2026-08-18T09:00:00.000Z");
const LATER = new Date("2026-08-20T17:00:00.000Z");
const EARLIER = new Date("2026-08-10T17:00:00.000Z");

describe("summarizeCredits", () => {
  it("yoklaması alınan dersleri harcanmış sayar", () => {
    const statuses: BookingStatus[] = ["katildi", "katildi", "gelmedi"];
    const summary = summarizeCredits({ total: 24, bookingStatuses: statuses });

    expect(summary.used).toBe(3);
    expect(summary.remaining).toBe(21);
  });

  it("gelmemeyi de hak yakar sayar", () => {
    expect(
      summarizeCredits({ total: 10, bookingStatuses: ["gelmedi"] }).used,
    ).toBe(1);
  });

  it("ileri tarihli rezervasyonları ayrılmış gösterir, harcanmış değil", () => {
    const summary = summarizeCredits({
      total: 10,
      bookingStatuses: ["onayli", "bekliyor", "katildi"],
    });

    expect(summary.used).toBe(1);
    expect(summary.reserved).toBe(2);
    expect(summary.remaining).toBe(7);
  });

  it("iptal ve reddedilen kayıtlar hakkı etkilemez", () => {
    const summary = summarizeCredits({
      total: 10,
      bookingStatuses: ["iptal", "reddedildi", "iptal"],
    });

    expect(summary.used).toBe(0);
    expect(summary.reserved).toBe(0);
    expect(summary.remaining).toBe(10);
  });

  it("sınırsız pakette kalan hak hesaplanmaz", () => {
    const summary = summarizeCredits({
      total: null,
      bookingStatuses: ["katildi", "onayli"],
    });

    expect(summary.unlimited).toBe(true);
    expect(summary.remaining).toBeNull();
    expect(summary.used).toBe(1);
  });

  it("hak aşılsa bile negatife düşmez", () => {
    const summary = summarizeCredits({
      total: 2,
      bookingStatuses: ["katildi", "katildi", "katildi"],
    });

    expect(summary.remaining).toBe(0);
  });
});

const membership = { endDate: new Date("2026-12-31T00:00:00.000Z"), remainingCredits: 5 };
const openSlot = { startsAt: LATER, status: "acik", capacity: 1, takenSeats: 0 };

describe("evaluateBooking", () => {
  it("boş slotu doğrudan rezerve eder", () => {
    const result = evaluateBooking({
      slot: openSlot,
      membership,
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, kind: "rezerve" });
  });

  it("dolu slotu reddetmez — grup isteğine çevirir", () => {
    const result = evaluateBooking({
      slot: { ...openSlot, takenSeats: 1 },
      membership,
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, kind: "grup-istegi" });
  });

  it("kontenjanı artırılmış grup dersinde yer varsa doğrudan rezerve eder", () => {
    const result = evaluateBooking({
      slot: { ...openSlot, capacity: 3, takenSeats: 2 },
      membership,
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, kind: "rezerve" });
  });

  it("geçmiş saate kayıt almaz", () => {
    const result = evaluateBooking({
      slot: { ...openSlot, startsAt: EARLIER },
      membership,
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "gecmis-seans" });
  });

  it("iptal edilmiş seansa kayıt almaz", () => {
    const result = evaluateBooking({
      slot: { ...openSlot, status: "iptal" },
      membership,
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "seans-iptal" });
  });

  it("aktif üyeliği olmayanı geri çevirir", () => {
    const result = evaluateBooking({
      slot: openSlot,
      membership: { endDate: null, remainingCredits: null },
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "uyelik-yok" });
  });

  it("üyelik seanstan önce bitiyorsa kayıt almaz", () => {
    const result = evaluateBooking({
      slot: openSlot,
      membership: {
        endDate: new Date("2026-08-19T00:00:00.000Z"),
        remainingCredits: 5,
      },
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "uyelik-bitti" });
  });

  it("ders hakkı bitmişse kayıt almaz", () => {
    const result = evaluateBooking({
      slot: openSlot,
      membership: { ...membership, remainingCredits: 0 },
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "hak-bitti" });
  });

  it("sınırsız pakette hak kontrolü yapılmaz", () => {
    const result = evaluateBooking({
      slot: openSlot,
      membership: { ...membership, remainingCredits: null },
      alreadyBooked: false,
      now: NOW,
    });

    expect(result.ok).toBe(true);
  });

  it("aynı seansa iki kez kaydolmayı engeller", () => {
    const result = evaluateBooking({
      slot: openSlot,
      membership,
      alreadyBooked: true,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "zaten-kayitli" });
  });

  it("geçmiş seans kontrolü üyelik kontrolünden önce gelir", () => {
    const result = evaluateBooking({
      slot: { ...openSlot, startsAt: EARLIER },
      membership: { endDate: null, remainingCredits: null },
      alreadyBooked: false,
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "gecmis-seans" });
  });
});

describe("canCancelBooking", () => {
  it("seansa 3 saatten fazla varsa iptale izin verir", () => {
    expect(
      canCancelBooking(new Date("2026-08-18T13:00:00.000Z"), NOW),
    ).toBe(true);
  });

  it("son 3 saate girildiyse iptali kapatır", () => {
    expect(
      canCancelBooking(new Date("2026-08-18T11:00:00.000Z"), NOW),
    ).toBe(false);
  });

  it("tam sınırda iptale izin verir", () => {
    expect(
      canCancelBooking(new Date("2026-08-18T12:00:00.000Z"), NOW),
    ).toBe(true);
  });
});
