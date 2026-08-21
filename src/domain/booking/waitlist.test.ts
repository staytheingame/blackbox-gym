import { describe, expect, it } from "vitest";
import {
  orderWaitlist,
  promotableFromWaitlist,
  waitlistPosition,
  type WaitlistEntry,
} from "./waitlist";

const NOW = new Date("2026-08-19T09:00:00.000Z");
const FUTURE = new Date("2026-08-20T17:00:00.000Z");
const PAST = new Date("2026-08-18T17:00:00.000Z");

const entry = (id: string, minutes: number): WaitlistEntry => ({
  bookingId: id,
  memberId: `m-${id}`,
  requestedAt: new Date(NOW.getTime() + minutes * 60_000),
});

const queue = [entry("c", 30), entry("a", 0), entry("b", 10)];

describe("orderWaitlist", () => {
  it("ilk gelen ilk alır sırasına dizer", () => {
    expect(orderWaitlist(queue).map((item) => item.bookingId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("kaynağı değiştirmez", () => {
    orderWaitlist(queue);
    expect(queue[0].bookingId).toBe("c");
  });
});

describe("waitlistPosition", () => {
  it("sırayı 1'den başlatır", () => {
    expect(waitlistPosition(queue, "a")).toBe(1);
    expect(waitlistPosition(queue, "c")).toBe(3);
  });

  it("kuyrukta olmayan için null döner", () => {
    expect(waitlistPosition(queue, "yok")).toBeNull();
  });
});

describe("promotableFromWaitlist", () => {
  const base = {
    waitlist: queue,
    slotStartsAt: FUTURE,
    slotStatus: "acik",
    now: NOW,
  };

  it("boş yer kadar sporcuyu sıraya göre yükseltir", () => {
    const promoted = promotableFromWaitlist({
      ...base,
      capacity: 3,
      takenSeats: 1,
    });

    expect(promoted.map((item) => item.bookingId)).toEqual(["a", "b"]);
  });

  it("yer yoksa kimseyi yükseltmez", () => {
    expect(
      promotableFromWaitlist({ ...base, capacity: 2, takenSeats: 2 }),
    ).toEqual([]);
  });

  it("kontenjanı büyütmez — kuyruk uzun olsa da yalnız boş yer kadar", () => {
    const promoted = promotableFromWaitlist({
      ...base,
      capacity: 2,
      takenSeats: 1,
    });

    expect(promoted).toHaveLength(1);
  });

  it("geçmiş seansta kimse yükselmez", () => {
    expect(
      promotableFromWaitlist({
        ...base,
        slotStartsAt: PAST,
        capacity: 5,
        takenSeats: 0,
      }),
    ).toEqual([]);
  });

  it("iptal edilmiş seansta kimse yükselmez", () => {
    expect(
      promotableFromWaitlist({
        ...base,
        slotStatus: "iptal",
        capacity: 5,
        takenSeats: 0,
      }),
    ).toEqual([]);
  });

  it("kuyruk boşsa boş liste döner", () => {
    expect(
      promotableFromWaitlist({
        ...base,
        waitlist: [],
        capacity: 5,
        takenSeats: 0,
      }),
    ).toEqual([]);
  });
});
