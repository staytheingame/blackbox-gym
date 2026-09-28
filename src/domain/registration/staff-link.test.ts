import { describe, expect, it } from "vitest";
import {
  STAFF_LINK_LIMITS,
  clampStaffLink,
  composeLinkList,
  normalizeStaffLinkRole,
} from "./staff-link";

describe("normalizeStaffLinkRole", () => {
  it("yalnız tam 'admin' değerini yönetici sayar", () => {
    expect(normalizeStaffLinkRole("admin")).toBe("admin");
  });

  it("bilinmeyen, boş ya da büyük harfli değeri antrenöre indirir — yükseltmez", () => {
    expect(normalizeStaffLinkRole("coach")).toBe("coach");
    expect(normalizeStaffLinkRole("ADMIN")).toBe("coach");
    expect(normalizeStaffLinkRole("owner")).toBe("coach");
    expect(normalizeStaffLinkRole("")).toBe("coach");
    expect(normalizeStaffLinkRole(null)).toBe("coach");
    expect(normalizeStaffLinkRole(undefined)).toBe("coach");
  });
});

describe("clampStaffLink", () => {
  it("antrenör sınırlarını uygular (50 kişi, 30 gün)", () => {
    expect(clampStaffLink("coach", { maxUses: 500, days: 365 })).toEqual({
      maxUses: 50,
      days: 30,
    });
  });

  it("yönetici bağlantısını çok daha dar tutar (3 kişi, 7 gün)", () => {
    expect(clampStaffLink("admin", { maxUses: 500, days: 365 })).toEqual({
      maxUses: 3,
      days: 7,
    });
  });

  it("yönetici varsayılanı tek kişi ve 3 gün", () => {
    expect(STAFF_LINK_LIMITS.admin.defaultMaxUses).toBe(1);
    expect(STAFF_LINK_LIMITS.admin.defaultDays).toBe(3);
  });

  it("sıfır ve negatif değeri 1'e çeker", () => {
    expect(clampStaffLink("coach", { maxUses: 0, days: -4 })).toEqual({
      maxUses: 1,
      days: 1,
    });
  });

  it("ondalığı keser, sayı olmayanı rolün varsayılanına döndürür", () => {
    expect(clampStaffLink("coach", { maxUses: 7.9, days: 2.2 })).toEqual({
      maxUses: 7,
      days: 2,
    });
    expect(clampStaffLink("admin", { maxUses: NaN, days: NaN })).toEqual({
      maxUses: 1,
      days: 3,
    });
  });
});

describe("composeLinkList", () => {
  const coach = { url: "https://x.test/kadro-kayit/AAA", expiresLabel: "12.10.2026", maxUses: 10 };
  const admin = { url: "https://x.test/kadro-kayit/BBB", expiresLabel: "01.10.2026", maxUses: 1 };

  it("üç grubu kendi başlığıyla ve sırasıyla yazar", () => {
    const text = composeLinkList({
      clientUrls: ["https://x.test/katil/blackbox-kayit"],
      coach,
      admin,
    });

    const member = text.indexOf("SPORCULAR");
    const coachAt = text.indexOf("ANTRENÖRLER");
    const adminAt = text.indexOf("YÖNETİCİLER");
    expect(member).toBeGreaterThan(-1);
    expect(coachAt).toBeGreaterThan(member);
    expect(adminAt).toBeGreaterThan(coachAt);
    expect(text).toContain("https://x.test/katil/blackbox-kayit");
    expect(text).toContain(coach.url);
    expect(text).toContain(admin.url);
  });

  it("yönetici satırı paylaşma uyarısı ve tek kullanım sınırı taşır", () => {
    const text = composeLinkList({ clientUrls: [], admin });

    expect(text).toContain("başkasıyla paylaşma");
    expect(text).toContain("en fazla 1 kişi");
  });

  it("üretilmeyen grubu hiç yazmaz", () => {
    const text = composeLinkList({ clientUrls: [], coach });

    expect(text).not.toContain("YÖNETİCİLER");
    expect(text).not.toContain("SPORCULAR");
    expect(text).toContain("ANTRENÖRLER");
  });

  it("birden çok sporcu bağlantısını alt alta listeler", () => {
    const text = composeLinkList({
      clientUrls: ["https://x.test/katil/a", "https://x.test/katil/b"],
    });

    expect(text).toContain("https://x.test/katil/a\nhttps://x.test/katil/b");
  });
});
