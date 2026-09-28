import { describe, expect, it } from "vitest";
import {
  GOAL_OPTIONS,
  dailyLoadLabel,
  goalLabel,
  parseRegistrationAnswers,
  preferredTimeLabel,
  summarizeAnswers,
} from "./answers";

const valid = {
  goals: ["fitness"],
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

describe("hedefler", () => {
  it("bir hedef seçilebilir", () => {
    const result = parseRegistrationAnswers({ ...valid, goals: ["boks"] });

    expect(result.ok && result.answers.goals).toEqual(["boks"]);
  });

  it("birden fazla hedef seçilebilir ve listedeki sıraya dizilir", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      goals: ["kilo-alma", "boks", "fitness"],
    });

    expect(result.ok && result.answers.goals).toEqual(["boks", "fitness", "kilo-alma"]);
  });

  it("hiç hedef seçilmemişse reddeder", () => {
    expect(parseRegistrationAnswers({ ...valid, goals: [] })).toEqual({
      ok: false,
      error: "En az bir hedef seç.",
    });
  });

  it("listede olmayan hedefi sessizce atmaz, reddeder", () => {
    expect(
      parseRegistrationAnswers({ ...valid, goals: ["fitness", "ucmak"] }),
    ).toEqual({ ok: false, error: "Hedef seçimi geçersiz." });
  });

  it("aynı hedefi iki kez göndermeyi tekilleştirir", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      goals: ["gures", "gures"],
    });

    expect(result.ok && result.answers.goals).toEqual(["gures"]);
  });

  it("kilo verme ile kilo almayı birlikte seçmeye izin verir (yeniden kompozisyon)", () => {
    const result = parseRegistrationAnswers({
      ...valid,
      goals: ["kilo-verme", "kilo-alma"],
    });

    expect(result.ok).toBe(true);
  });

  it("istenen hedeflerin hepsi listede: boks, güreş, fitness, kilo verme, kilo alma", () => {
    const values = GOAL_OPTIONS.map((option) => option.value);

    for (const wanted of ["boks", "gures", "fitness", "kilo-verme", "kilo-alma"]) {
      expect(values).toContain(wanted);
    }
    expect(goalLabel("kilo-alma")).toBe("Kilo alma (kas kütlesi ekleme)");
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
      goals: ["boks", "kilo-verme"],
      occupation: "Doktor",
      dailyLoad: "cok-yogun",
      preferredTimes: ["gece", "hafta-sonu"],
    });

    expect(summary).toBe(
      "hedef: Boks, Kilo verme · meslek: Doktor · günlük yoğunluk: Çok yoğun — günüm dolu · saat tercihi: Gece (20:00–22:00), Hafta sonu",
    );
  });

  it("boş alanları özete katmaz", () => {
    expect(summarizeAnswers({ occupation: "Doktor" })).toBe("meslek: Doktor");
    expect(summarizeAnswers({})).toBe("");
  });
});
