import { describe, expect, it } from "vitest";
import {
  applyBps,
  formatBps,
  formatMinorTR,
  formatSignedMinorTR,
  parseAmountToMinor,
  parsePercentToBps,
  sumMinor,
} from "./money";

describe("parseAmountToMinor", () => {
  it("Türkçe biçimi okur: binlik nokta, ondalık virgül", () => {
    expect(parseAmountToMinor("1.250,50")).toBe(125050);
    expect(parseAmountToMinor("2.500")).toBe(250000);
    expect(parseAmountToMinor("19,90")).toBe(1990);
  });

  it("yapıştırılan İngilizce biçimi de okur", () => {
    expect(parseAmountToMinor("1250.50")).toBe(125050);
    expect(parseAmountToMinor("0.05")).toBe(5);
  });

  it("tam sayıyı kuruşa çevirir", () => {
    expect(parseAmountToMinor("2500")).toBe(250000);
  });

  it("₺ işaretini ve boşluğu yok sayar", () => {
    expect(parseAmountToMinor(" 1.500 ₺ ")).toBe(150000);
  });

  it("geçersiz girişe null döner", () => {
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("abc")).toBeNull();
    expect(parseAmountToMinor("-100")).toBeNull();
    expect(parseAmountToMinor("1,234")).toBeNull(); // üç ondalık hane
  });
});

describe("formatMinorTR", () => {
  it("kuruş sıfırsa ondalık göstermez", () => {
    expect(formatMinorTR(250000)).toContain("2.500");
    expect(formatMinorTR(250000)).not.toContain(",00");
  });

  it("kuruş varsa iki hane gösterir", () => {
    expect(formatMinorTR(125050)).toContain("1.250,50");
  });

  it("işaretli biçim kâr/zararı ayırır", () => {
    expect(formatSignedMinorTR(1000).startsWith("+")).toBe(true);
    expect(formatSignedMinorTR(-1000).startsWith("−")).toBe(true);
    expect(formatSignedMinorTR(0).startsWith("+")).toBe(false);
  });
});

describe("yüzde (bps)", () => {
  it("payı yarım kuruş yukarı yuvarlar", () => {
    expect(applyBps(100000, 4000)).toBe(40000); // 1.000 ₺ · %40
    expect(applyBps(333, 5000)).toBe(167); // 1,66½ → 1,67
  });

  it("bps'i okunur yüzdeye çevirir", () => {
    expect(formatBps(4000)).toBe("%40");
    expect(formatBps(4250)).toBe("%42,5");
  });

  it("kullanıcı yüzdesini bps'e çevirir, aralık dışını reddeder", () => {
    expect(parsePercentToBps("40")).toBe(4000);
    expect(parsePercentToBps("%42,5")).toBe(4250);
    expect(parsePercentToBps("101")).toBeNull();
    expect(parsePercentToBps("abc")).toBeNull();
  });
});

describe("sumMinor", () => {
  it("boş listede 0 döner", () => {
    expect(sumMinor([])).toBe(0);
    expect(sumMinor([100, 250, -50])).toBe(300);
  });
});
