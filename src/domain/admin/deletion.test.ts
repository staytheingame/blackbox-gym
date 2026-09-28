import { describe, expect, it } from "vitest";
import {
  memberDeleteBlock,
  memberDeleteConfirmText,
  staffDeleteBlock,
  staffDeleteConfirmText,
} from "./deletion";

const cleanStaff = {
  isSelf: false,
  isLastActiveAdmin: false,
  slotsWithBookings: 0,
  earningCount: 0,
  payoutCount: 0,
};

describe("memberDeleteBlock", () => {
  it("tahsilatı olmayan sporcuyu (ör. test hesabı) silmeye izin verir", () => {
    expect(memberDeleteBlock({ paymentCount: 0 })).toBeNull();
  });

  it("tahsilat kaydı olan sporcuyu siltmez ve pasife almayı önerir", () => {
    const reason = memberDeleteBlock({ paymentCount: 3 });

    expect(reason).toContain("3 tahsilat");
    expect(reason).toContain("Pasif");
  });
});

describe("staffDeleteBlock", () => {
  it("hiç işlem görmemiş antrenörü (ör. test hesabı) silmeye izin verir", () => {
    expect(staffDeleteBlock(cleanStaff)).toBeNull();
  });

  it("kendini silmeyi engeller", () => {
    expect(staffDeleteBlock({ ...cleanStaff, isSelf: true })).toBe(
      "Kendi hesabını silemezsin.",
    );
  });

  it("son aktif yöneticiyi silmeyi engeller", () => {
    expect(staffDeleteBlock({ ...cleanStaff, isLastActiveAdmin: true })).toContain(
      "tek aktif yönetici",
    );
  });

  it("hakediş ya da ödeme kaydı olanı siltmez ve hesabı kapatmayı önerir", () => {
    const withEarnings = staffDeleteBlock({ ...cleanStaff, earningCount: 2 });
    const withPayouts = staffDeleteBlock({ ...cleanStaff, payoutCount: 1 });

    expect(withEarnings).toContain("Kapat");
    expect(withPayouts).toContain("Kapat");
  });

  it("sporcu kaydı olan seansı bulunan antrenörü siltmez", () => {
    const reason = staffDeleteBlock({ ...cleanStaff, slotsWithBookings: 4 });

    expect(reason).toContain("4 seans");
    expect(reason).toContain("Kapat");
  });

  it("kendini silme kuralı diğer sebeplerden önce gelir", () => {
    const reason = staffDeleteBlock({
      ...cleanStaff,
      isSelf: true,
      earningCount: 5,
      isLastActiveAdmin: true,
    });

    expect(reason).toBe("Kendi hesabını silemezsin.");
  });
});

describe("onay metinleri", () => {
  it("isim içerir ve geri alınamayacağını söyler", () => {
    expect(memberDeleteConfirmText("Ali Veli")).toContain("Ali Veli");
    expect(memberDeleteConfirmText("Ali Veli")).toContain("geri alınamaz");
    expect(staffDeleteConfirmText("Dilara")).toContain("Dilara");
    expect(staffDeleteConfirmText("Dilara")).toContain("geri alınamaz");
  });
});
