import { describe, expect, it } from "vitest";
import {
  ageAt,
  healthNoteFrom,
  isMinor,
  needsGuardian,
  summarizeWaivers,
  type SignatureRef,
  type WaiverTemplateRef,
} from "./status";

const NOW = new Date("2026-08-19T12:00:00.000Z");

const template = (
  id: string,
  version: number,
  isRequired = true,
): WaiverTemplateRef => ({
  id,
  kind: "saglik",
  title: id,
  version,
  isRequired,
  requiresGuardian: false,
});

const signature = (
  templateId: string,
  version: number,
  status = "imzalandi",
): SignatureRef => ({
  templateId,
  version,
  status,
  signedAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("summarizeWaivers", () => {
  it("hiç imza yoksa hepsini eksik sayar", () => {
    const summary = summarizeWaivers({
      templates: [template("saglik", 1), template("kvkk", 1)],
      signatures: [],
    });

    expect(summary.missingCount).toBe(2);
    expect(summary.allSigned).toBe(false);
  });

  it("güncel sürüm imzalıysa tamam sayar", () => {
    const summary = summarizeWaivers({
      templates: [template("saglik", 2)],
      signatures: [signature("saglik", 2)],
    });

    expect(summary.items[0].state).toBe("imzali");
    expect(summary.allSigned).toBe(true);
  });

  it("şablon sürümü artınca imzayı eski sayar ama silmez", () => {
    const summary = summarizeWaivers({
      templates: [template("saglik", 3)],
      signatures: [signature("saglik", 1)],
    });

    expect(summary.items[0].state).toBe("eski");
    expect(summary.items[0].signedVersion).toBe(1);
    expect(summary.outdatedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
  });

  it("en yüksek sürümlü imzayı esas alır", () => {
    const summary = summarizeWaivers({
      templates: [template("saglik", 2)],
      signatures: [signature("saglik", 1), signature("saglik", 2)],
    });

    expect(summary.items[0].state).toBe("imzali");
  });

  it("iptal edilmiş imzayı saymaz", () => {
    const summary = summarizeWaivers({
      templates: [template("saglik", 1)],
      signatures: [signature("saglik", 1, "iptal")],
    });

    expect(summary.items[0].state).toBe("eksik");
  });

  it("isteğe bağlı form eksik sayılmaz", () => {
    const summary = summarizeWaivers({
      templates: [template("foto", 1, false)],
      signatures: [],
    });

    expect(summary.items[0].state).toBe("eksik");
    expect(summary.missingCount).toBe(0);
    expect(summary.allSigned).toBe(true);
  });
});

describe("yaş ve veli", () => {
  it("doğum tarihi yoksa yaş bilinmez", () => {
    expect(ageAt(null, NOW)).toBeNull();
    expect(isMinor(null, NOW)).toBe(false);
  });

  it("18 yaş altını küçük sayar", () => {
    expect(isMinor(new Date("2012-01-01"), NOW)).toBe(true);
    expect(isMinor(new Date("2000-01-01"), NOW)).toBe(false);
  });

  it("şablon her durumda veli istiyorsa yaşa bakmaz", () => {
    expect(
      needsGuardian({
        template: { requiresGuardian: true },
        birthDate: new Date("1990-01-01"),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("küçük sporcuda veli bilgisi ister", () => {
    expect(
      needsGuardian({
        template: { requiresGuardian: false },
        birthDate: new Date("2013-06-01"),
        now: NOW,
      }),
    ).toBe(true);
  });
});

describe("healthNoteFrom", () => {
  it("evet yanıtlarını nota çevirir", () => {
    expect(
      healthNoteFrom({
        "Kalp rahatsızlığı": "evet",
        "Sakatlık geçmişi": "hayir",
        "Düzenli ilaç": "evet",
      }),
    ).toBe("Kalp rahatsızlığı · Düzenli ilaç");
  });

  it("hepsi hayırsa not üretmez", () => {
    expect(healthNoteFrom({ "Kalp rahatsızlığı": "hayir" })).toBeNull();
  });
});
