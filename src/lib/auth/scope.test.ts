import { describe, expect, it } from "vitest";
import {
  isOrganizationWide,
  memberWhere,
  organizationScope,
  slotWhere,
  staffScopeFor,
} from "./scope";

const ORG = "org_1";
const COACH = "user_coach";
const ADMIN = "user_admin";

describe("staffScopeFor", () => {
  it("antrenörü kendi sporcularıyla sınırlar", () => {
    const scope = staffScopeFor({ organizationId: ORG, role: "coach" }, COACH);
    expect(scope).toEqual({ organizationId: ORG, coachUserId: COACH });
    expect(isOrganizationWide(scope)).toBe(false);
  });

  it("yöneticiye kısıt koymaz", () => {
    const scope = staffScopeFor({ organizationId: ORG, role: "admin" }, ADMIN);
    expect(scope.coachUserId).toBeNull();
    expect(isOrganizationWide(scope)).toBe(true);
  });

  it("sporcu rolü de antrenör gibi kısıtlanır — panele zaten giremez", () => {
    const scope = staffScopeFor({ organizationId: ORG, role: "member" }, "u1");
    expect(scope.coachUserId).toBe("u1");
  });
});

describe("memberWhere", () => {
  it("antrenör filtresine atanmış koç koşulunu ekler", () => {
    const scope = staffScopeFor({ organizationId: ORG, role: "coach" }, COACH);
    expect(memberWhere(scope)).toEqual({
      organizationId: ORG,
      assignedCoachUserId: COACH,
    });
  });

  it("yöneticide yalnız salon koşulu kalır", () => {
    expect(memberWhere(organizationScope(ORG))).toEqual({ organizationId: ORG });
  });

  it("ek koşulları korur", () => {
    const scope = staffScopeFor({ organizationId: ORG, role: "coach" }, COACH);
    expect(memberWhere(scope, { status: "active" })).toEqual({
      organizationId: ORG,
      assignedCoachUserId: COACH,
      status: "active",
    });
  });

  it("ek koşul kapsamı EZEMEZ mi diye: aynı anahtar gelirse çağıran sorumlu", () => {
    // `extra` bilinçli olarak sonra yayılır; kapsamı ezen bir anahtar
    // göndermek çağıranın hatasıdır — bu test davranışı belgeler.
    const scope = staffScopeFor({ organizationId: ORG, role: "coach" }, COACH);
    const where = memberWhere(scope, { assignedCoachUserId: "baskasi" });
    expect(where.assignedCoachUserId).toBe("baskasi");
  });
});

describe("slotWhere", () => {
  it("antrenör yalnız kendi açtığı seansları görür", () => {
    const scope = staffScopeFor({ organizationId: ORG, role: "coach" }, COACH);
    expect(slotWhere(scope, { status: "acik" })).toEqual({
      organizationId: ORG,
      coachUserId: COACH,
      status: "acik",
    });
  });

  it("yönetici salonun tüm seanslarını görür", () => {
    expect(slotWhere(organizationScope(ORG))).toEqual({ organizationId: ORG });
  });
});
