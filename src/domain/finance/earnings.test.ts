import { describe, expect, it } from "vitest";
import {
  describeCompensation,
  quotaOverage,
  remainingSessionQuota,
  revenueShareMinor,
  salaryAccrualMinor,
  sessionEarningMinor,
  validateCompensation,
  type Compensation,
} from "./earnings";

const perSession: Compensation = {
  model: "ders_basi",
  perSessionMinor: 25000,
  revenueShareBps: null,
  monthlySalaryMinor: null,
  monthlySessionQuota: null,
};

const share: Compensation = {
  model: "gelir_payi",
  perSessionMinor: null,
  revenueShareBps: 4000,
  monthlySalaryMinor: null,
  monthlySessionQuota: null,
};

const salary: Compensation = {
  model: "sabit_maas",
  perSessionMinor: null,
  revenueShareBps: null,
  monthlySalaryMinor: 3_500_000,
  monthlySessionQuota: 60,
};

const mixed: Compensation = {
  model: "karma",
  perSessionMinor: 20000,
  revenueShareBps: 1000,
  monthlySalaryMinor: null,
  monthlySessionQuota: null,
};

describe("ders başı", () => {
  it("seans başına sabit tutar yazar", () => {
    expect(sessionEarningMinor(perSession)).toBe(25000);
  });

  it("başka modeldeyken ders kalemi işlemez", () => {
    expect(sessionEarningMinor(share)).toBe(0);
    expect(sessionEarningMinor(salary)).toBe(0);
  });

  it("ayar yoksa hakediş doğmaz", () => {
    expect(sessionEarningMinor(null)).toBe(0);
    expect(sessionEarningMinor(undefined)).toBe(0);
  });
});

describe("gelir payı", () => {
  it("tahsilatın yüzdesini alır", () => {
    expect(revenueShareMinor(share, 250000)).toBe(100000); // 2.500 ₺ · %40
  });

  it("sıfır ya da eksi tahsilattan pay çıkmaz", () => {
    expect(revenueShareMinor(share, 0)).toBe(0);
    expect(revenueShareMinor(share, -5000)).toBe(0);
  });

  it("oran girilmemişse pay çıkmaz", () => {
    expect(revenueShareMinor({ ...share, revenueShareBps: null }, 100000)).toBe(0);
  });
});

describe("karma model", () => {
  it("dolu olan her kalemi işletir", () => {
    expect(sessionEarningMinor(mixed)).toBe(20000);
    expect(revenueShareMinor(mixed, 100000)).toBe(10000);
    expect(salaryAccrualMinor(mixed)).toBe(0); // maaş girilmemiş
  });
});

describe("sabit maaş", () => {
  it("ay kapanışında tahakkuk eder", () => {
    expect(salaryAccrualMinor(salary)).toBe(3_500_000);
    expect(salaryAccrualMinor(perSession)).toBe(0);
  });
});

describe("aylık ders hakkı", () => {
  it("kalanı hesaplar, eksiye düşmez", () => {
    expect(remainingSessionQuota(salary, 20)).toBe(40);
    expect(remainingSessionQuota(salary, 75)).toBe(0);
  });

  it("hak sınırsızsa null döner", () => {
    expect(remainingSessionQuota(perSession, 30)).toBeNull();
    expect(quotaOverage(perSession, 30)).toBe(0);
  });

  it("aşımı ayrıca bildirir", () => {
    expect(quotaOverage(salary, 75)).toBe(15);
    expect(quotaOverage(salary, 60)).toBe(0);
  });
});

describe("describeCompensation", () => {
  it("kalemleri tek satırda özetler", () => {
    expect(describeCompensation(perSession)).toContain("Ders başı");
    expect(describeCompensation(mixed)).toContain("·");
    expect(describeCompensation(null)).toBe("Hakediş yok");
  });

  it("model seçili ama tutar boşsa uyarır", () => {
    expect(
      describeCompensation({ ...perSession, perSessionMinor: null }),
    ).toBe("Tutar girilmemiş");
  });
});

describe("validateCompensation", () => {
  it("seçilen modelin tutarını zorunlu tutar", () => {
    expect(validateCompensation({ ...perSession, perSessionMinor: null }).ok).toBe(
      false,
    );
    expect(validateCompensation(perSession).ok).toBe(true);
  });

  it("karma modelde en az bir kalem ister", () => {
    expect(
      validateCompensation({
        model: "karma",
        perSessionMinor: null,
        revenueShareBps: null,
        monthlySalaryMinor: null,
        monthlySessionQuota: null,
      }).ok,
    ).toBe(false);
    expect(validateCompensation(mixed).ok).toBe(true);
  });

  it("'yok' her zaman geçerlidir", () => {
    expect(
      validateCompensation({
        model: "yok",
        perSessionMinor: null,
        revenueShareBps: null,
        monthlySalaryMinor: null,
        monthlySessionQuota: null,
      }).ok,
    ).toBe(true);
  });
});
