import { describe, expect, it } from "vitest";
import {
  computeCompliance,
  formatWeekDays,
  macroDeviationPercent,
  parseWeekDays,
  planAppliesToDay,
  serializeWeekDays,
  sumMacros,
} from "./plan";

describe("parseWeekDays", () => {
  it("sıralar, tekrarı atar, aralık dışını süzer", () => {
    expect(parseWeekDays("5,1,1,9,3")).toEqual([1, 3, 5]);
  });

  it("boş girdi boş dizi", () => {
    expect(parseWeekDays(null)).toEqual([]);
    expect(parseWeekDays("")).toEqual([]);
  });
});

describe("formatWeekDays", () => {
  it("gün yoksa her gün yazar", () => {
    expect(formatWeekDays(null)).toBe("Her gün");
  });

  it("yedi günün hepsi seçiliyse yine her gün", () => {
    expect(formatWeekDays("1,2,3,4,5,6,7")).toBe("Her gün");
  });

  it("kısa gün adlarını sırayla yazar", () => {
    expect(formatWeekDays("3,1")).toBe("Pzt, Çar");
  });
});

describe("serializeWeekDays", () => {
  it("boş seçim null döner", () => {
    expect(serializeWeekDays([])).toBeNull();
  });

  it("sıralar ve tekilleştirir", () => {
    expect(serializeWeekDays([5, 1, 5])).toBe("1,5");
  });
});

describe("sumMacros", () => {
  it("makrosu olmayan besinleri eksik sayar, toplama katmaz", () => {
    const totals = sumMacros([
      { calories: 300, proteinG: 25, carbsG: 40, fatG: 5 },
      { calories: null, proteinG: null, carbsG: null, fatG: null },
    ]);

    expect(totals.calories).toBe(300);
    expect(totals.missing).toBe(1);
    expect(totals.hasData).toBe(true);
  });

  it("kısmi makroyu sayar, boş alanı sıfır kabul eder", () => {
    const totals = sumMacros([{ calories: 120, proteinG: 8, carbsG: null, fatG: null }]);
    expect(totals).toMatchObject({ calories: 120, proteinG: 8, carbsG: 0, fatG: 0 });
  });

  it("hiç veri yoksa hasData false", () => {
    const totals = sumMacros([
      { calories: null, proteinG: null, carbsG: null, fatG: null },
    ]);
    expect(totals.hasData).toBe(false);
    expect(totals.missing).toBe(1);
  });

  it("ondalıkları tek basamağa yuvarlar", () => {
    const totals = sumMacros([
      { calories: 0, proteinG: 10.25, carbsG: 0, fatG: 0 },
      { calories: 0, proteinG: 10.21, carbsG: 0, fatG: 0 },
    ]);
    expect(totals.proteinG).toBe(20.5);
  });
});

describe("macroDeviationPercent", () => {
  it("hedef yoksa null", () => {
    expect(macroDeviationPercent(2000, null)).toBeNull();
    expect(macroDeviationPercent(2000, 0)).toBeNull();
  });

  it("hedefin üstünü artı, altını eksi verir", () => {
    expect(macroDeviationPercent(2200, 2000)).toBe(10);
    expect(macroDeviationPercent(1800, 2000)).toBe(-10);
  });
});

describe("computeCompliance", () => {
  it("plan yoksa yüzde üretmez", () => {
    const result = computeCompliance({ mealsPerDay: 0, days: 7, checked: 0 });
    expect(result).toMatchObject({ percent: 0, confidence: "yok" });
  });

  it("üç günden az veride güveni düşük işaretler", () => {
    const result = computeCompliance({ mealsPerDay: 4, days: 2, checked: 8 });
    expect(result.percent).toBe(100);
    expect(result.confidence).toBe("dusuk");
    expect(result.label).toBe("Veri az");
  });

  it("yüzde 100'ü aşmaz", () => {
    const result = computeCompliance({ mealsPerDay: 3, days: 7, checked: 40 });
    expect(result.percent).toBe(100);
  });

  it("etiketleri eşiklere göre verir", () => {
    // 28 beklenen öğün: 20 → %71 dalgalı, 24 → %86 iyi, 5 → %18 düşük
    expect(
      computeCompliance({ mealsPerDay: 4, days: 7, checked: 20 }).label,
    ).toBe("Dalgalı");
    expect(
      computeCompliance({ mealsPerDay: 4, days: 7, checked: 24 }).label,
    ).toBe("İyi");
    expect(
      computeCompliance({ mealsPerDay: 4, days: 7, checked: 5 }).label,
    ).toBe("Düşük");
  });
});

describe("planAppliesToDay", () => {
  it("gün listesi boşsa her gün geçerli", () => {
    expect(planAppliesToDay(null, 3)).toBe(true);
  });

  it("yalnız listedeki günlerde geçerli", () => {
    expect(planAppliesToDay("1,3,5", 3)).toBe(true);
    expect(planAppliesToDay("1,3,5", 2)).toBe(false);
  });
});
