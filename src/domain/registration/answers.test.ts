import { describe, expect, it } from "vitest";
import {
  dailyLoadLabel,
  parseRegistrationAnswers,
  preferredTimeLabel,
  summarizeAnswers,
} from "./answers";

const valid = {
  occupation: "Avukat",
  dailyLoad: "yogun",
  preferredTimes: ["aksam", "sabah-erken"],
};

describe("parseRegistrationAnswers", () => {
  it("geçerli yanıtı kabul eder ve saatleri gün sırasına dizer", () => {
    const result = parseRegistrationAnswers(valid);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answers.preferredTimes).toEqual(["sabah-erken", "aksam"]);
      expect(result.answers.occupation).toBe("Avukat");
    }
  });

  it("mesleğin baş/son ve tekrarlı boşluklarını temizler", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      occupation: "  Yazılım   mühendisi ",
    });

    expect(result.ok && result.answers.occupation).toBe("Yazılım mühendisi");
  });

  it("boş ya da tek harfli mesleği reddeder", () => {
    expect(parseRegistrationAnswers({ ...valid, occupation: "  " }).ok).toBe(false);
    expect(parseRegistrationAnswers({ ...valid, occupation: "A" }).ok).toBe(false);
  });

  it("çok uzun mesleği reddeder", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      occupation: "x".repeat(81),
    });

    expect(result.ok).toBe(false);
  });

  it("listede olmayan günlük yoğunluğu reddeder", () => {
    const result = parseRegistrationAnswers({ ...valid, dailyLoad: "cilgin" });

    expect(result).toEqual({ ok: false, error: "Günlük yoğunluğunu seç." });
  });

  it("hiç saat seçilmemişse reddeder", () => {
    const result = parseRegistrationAnswers({ ...valid, preferredTimes: [] });

    expect(result).toEqual({
      ok: false,
      error: "En az bir antrenman saati seç.",
    });
  });

  it("listede olmayan saat anahtarını sessizce atmaz, reddeder", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      preferredTimes: ["aksam", "gece-yarisi"],
    });

    expect(result).toEqual({
      ok: false,
      error: "Antrenman saati seçimi geçersiz.",
    });
  });

  it("aynı saati iki kez göndermeyi tekilleştirir", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      preferredTimes: ["aksam", "aksam"],
    });

    expect(result.ok && result.answers.preferredTimes).toEqual(["aksam"]);
  });
});

describe("etiketler ve özet", () => {
  it("bilinen anahtarın ekran adını verir, bilinmeyeni olduğu gibi bırakır", () => {
    expect(dailyLoadLabel("cok-yogun")).toBe("Çok yoğun — günüm dolu");
    expect(dailyLoadLabel("eski-deger")).toBe("eski-deger");
    expect(dailyLoadLabel(null)).toBe("");
    expect(preferredTimeLabel("hafta-sonu")).toBe("Hafta sonu");
  });

  it("özeti tek satırda üretir", () => {
    const summary = summarizeAnswers({
      occupation: "Doktor",
      dailyLoad: "cok-yogun",
      preferredTimes: ["gece", "hafta-sonu"],
    });

    expect(summary).toBe(
      "meslek: Doktor · günlük yoğunluk: Çok yoğun — günüm dolu · saat tercihi: Gece (20:00–22:00), Hafta sonu",
    );
  });

  it("boş alanları özete katmaz", () => {
    expect(summarizeAnswers({ occupation: "Doktor" })).toBe("meslek: Doktor");
    expect(summarizeAnswers({})).toBe("");
  });
});
