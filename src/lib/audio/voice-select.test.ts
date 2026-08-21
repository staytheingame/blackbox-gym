import { describe, expect, it } from "vitest";
import {
  guessGender,
  isTurkish,
  pickVoice,
  scoreVoice,
  sortVoicesForPicker,
  voiceLabel,
  type VoiceLike,
} from "./voice-select";

const tolga: VoiceLike = { name: "Microsoft Tolga", lang: "tr-TR", localService: true };
const filiz: VoiceLike = { name: "Microsoft Filiz Desktop", lang: "tr-TR", localService: true };
const emel: VoiceLike = { name: "Google Emel Neural", lang: "tr-TR" };
const david: VoiceLike = { name: "Microsoft David", lang: "en-US", localService: true };
const nameless: VoiceLike = { name: "Türkçe", lang: "tr", localService: true };

describe("isTurkish", () => {
  it("tr-TR ve tr kodlarını Türkçe sayar", () => {
    expect(isTurkish(tolga)).toBe(true);
    expect(isTurkish(nameless)).toBe(true);
  });

  it("diğer dilleri elemez saymaz", () => {
    expect(isTurkish(david)).toBe(false);
  });
});

describe("guessGender", () => {
  it("bilinen erkek ve kadın adlarını ayırır", () => {
    expect(guessGender(tolga)).toBe("male");
    expect(guessGender(filiz)).toBe("female");
  });

  it("tanımadığı adda tahmin uydurmaz", () => {
    expect(guessGender(nameless)).toBe("unknown");
  });
});

describe("scoreVoice", () => {
  it("Türkçe olmayı her şeyin üstünde tutar", () => {
    // İngilizce erkek ses, Türkçe kadın sesini geçemez.
    expect(scoreVoice(filiz)).toBeGreaterThan(scoreVoice(david));
  });

  it("eşit dilde erkek sesi öne alır", () => {
    expect(scoreVoice(tolga)).toBeGreaterThan(scoreVoice(filiz));
  });

  it("preferMale kapalıyken kadın sesi öne geçer", () => {
    expect(scoreVoice(filiz, false)).toBeGreaterThan(scoreVoice(tolga, false));
  });
});

describe("pickVoice", () => {
  it("Türkçe erkek sesi varsa onu seçer", () => {
    expect(pickVoice([filiz, david, tolga])?.name).toBe("Microsoft Tolga");
  });

  it("Türkçe erkek yoksa Türkçe kalır, İngilizceye düşmez", () => {
    expect(pickVoice([david, filiz])?.name).toBe("Microsoft Filiz Desktop");
  });

  it("hiç Türkçe ses yoksa null döner", () => {
    expect(pickVoice([david])).toBeNull();
  });
});

describe("sortVoicesForPicker", () => {
  it("Türkçeleri üste, erkek sesi en başa alır", () => {
    const sorted = sortVoicesForPicker([david, filiz, emel, tolga]);
    expect(sorted[0].name).toBe("Microsoft Tolga");
    expect(sorted.at(-1)?.name).toBe("Microsoft David");
  });

  it("girdiyi mutasyona uğratmaz", () => {
    const input = [david, tolga];
    sortVoicesForPicker(input);
    expect(input[0]).toBe(david);
  });
});

describe("voiceLabel", () => {
  it("cinsiyet bilindiğinde etikete ekler", () => {
    expect(voiceLabel(tolga)).toBe("Microsoft Tolga (tr-TR) — erkek");
    expect(voiceLabel(filiz)).toBe("Microsoft Filiz Desktop (tr-TR) — kadın");
  });

  it("bilinmeyen cinsiyette ek koymaz", () => {
    expect(voiceLabel(nameless)).toBe("Türkçe (tr)");
  });
});
