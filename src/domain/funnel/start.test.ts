import { describe, expect, it } from "vitest";
import {
  START_QUESTIONS,
  describeStartAnswers,
  parseStartLead,
  readStartAnswers,
  startOptionLabel,
  summarizeStartLead,
  type StartLeadInput,
} from "./start";

const valid: StartLeadInput = {
  goal: "kilo-vermek",
  pain: "gobek-bel",
  barrier: "is-yogun",
  history: "eskiden-duzenli",
  turnoff: "duz-kardiyo",
  expectations: ["boks-gibi", "kilo-vermek"],
  occupation: "Avukat",
  dailyLoad: "yogun",
  timeWindows: ["aksam", "sabah"],
  weeklyDays: "3",
  fullName: "Ali Veli",
  phone: "0555 111 22 33",
  email: "Ali@Ornek.com",
};

const ok = (o: Partial<StartLeadInput> = {}) => {
  const r = parseStartLead({ ...valid, ...o });
  if (!r.ok) throw new Error(`beklenmedik ret: ${r.error}`);
  return r.lead;
};
const err = (o: Partial<StartLeadInput>) => {
  const r = parseStartLead({ ...valid, ...o });
  return r.ok ? null : r.error;
};

describe("sorular ve seçenekler (sahibinin metniyle)", () => {
  const count = (key: keyof typeof START_QUESTIONS) => START_QUESTIONS[key].options.length;

  it("her sorunun seçenek sayısı istenen listeyle aynı", () => {
    expect(count("goal")).toBe(6);
    expect(count("pain")).toBe(7);
    expect(count("barrier")).toBe(7);
    expect(count("history")).toBe(6);
    expect(count("turnoff")).toBe(7);
    expect(count("expectations")).toBe(8);
    expect(count("dailyLoad")).toBe(5);
    expect(count("timeWindows")).toBe(5);
    expect(count("weeklyDays")).toBe(4);
  });

  it("seçenek metinleri sahibinin yazdığıyla birebir", () => {
    expect(startOptionLabel("goal", "kilo-vermek")).toBe("Kilo vermek");
    expect(startOptionLabel("goal", "kaslanmak")).toBe("Kaslanmak / güçlenmek");
    expect(startOptionLabel("pain", "gobek-bel")).toBe("Göbek / bel çevrem");
    expect(startOptionLabel("turnoff", "duz-kardiyo")).toBe(
      "Koşu bandı / bisiklet gibi düz kardiyo yapmak",
    );
    expect(startOptionLabel("expectations", "boks-gibi")).toBe(
      "Boks gibi farklı şeyler de öğreneyim",
    );
    expect(startOptionLabel("dailyLoad", "degisiyor")).toBe("Gününe göre değişiyor");
    expect(startOptionLabel("timeWindows", "sabah")).toBe("Sabah 07:00–10:00");
    expect(startOptionLabel("weeklyDays", "4-plus")).toBe("4+ gün");
    expect(startOptionLabel("weeklyDays", "degisir")).toBe("Programıma göre değişir");
  });

  it("çoklu seçim sorularında 'Birden fazla seçebilirsin.' ipucu var; tekli sorularda yok", () => {
    expect(START_QUESTIONS.expectations.hint).toBe("Birden fazla seçebilirsin.");
    expect(START_QUESTIONS.timeWindows.hint).toBe("Birden fazla seçebilirsin.");
    expect("hint" in START_QUESTIONS.goal).toBe(false);
  });

  it("hiçbir seçenek metninde fiyat yok", () => {
    const all = JSON.stringify(START_QUESTIONS);
    expect(all).not.toMatch(/₺|\bTL\b|\d\.\d{3}/);
  });

  it("anahtarlar her soruda tekil", () => {
    for (const question of Object.values(START_QUESTIONS)) {
      const keys = question.options.map((o) => o.value);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("parseStartLead — geçerli", () => {
  it("geçerli başvuruyu kabul eder, alanları düzenler", () => {
    const lead = ok();

    expect(lead.fullName).toBe("Ali Veli");
    expect(lead.email).toBe("ali@ornek.com");
    expect(lead.phone).toBe("05551112233");
    expect(lead.answers.goal).toBe("kilo-vermek");
    expect(lead.answers.occupation).toBe("Avukat");
  });

  it("çoklu seçimleri sorudaki sıraya dizer, tekilleştirir", () => {
    const lead = ok({
      expectations: ["boks-gibi", "kilo-vermek", "boks-gibi"],
      timeWindows: ["hafta-sonu", "sabah", "aksam"],
    });

    expect(lead.answers.expectations).toEqual(["kilo-vermek", "boks-gibi"]);
    expect(lead.answers.timeWindows).toEqual(["sabah", "aksam", "hafta-sonu"]);
  });

  it("mesleğin baş/son ve tekrarlı boşluklarını temizler", () => {
    expect(ok({ occupation: "  Yazılım   mühendisi " }).answers.occupation).toBe(
      "Yazılım mühendisi",
    );
  });

  it("üç sözcüklü ad soyadı kabul eder", () => {
    expect(ok({ fullName: "Ali Can Yılmaz" }).fullName).toBe("Ali Can Yılmaz");
  });

  it("telefonu farklı yazımlarda tek biçime getirir", () => {
    expect(ok({ phone: "+90 555 111 22 33" }).phone).toBe("05551112233");
  });
});

describe("parseStartLead — reddedilen", () => {
  it("cevaplanmamış her soru 'Tüm soruları yanıtla.' der", () => {
    for (const key of ["goal", "pain", "barrier", "history", "turnoff", "dailyLoad", "weeklyDays"] as const) {
      expect(err({ [key]: "" }), key).toBe("Tüm soruları yanıtla.");
    }
    expect(err({ expectations: [] })).toBe("Tüm soruları yanıtla.");
    expect(err({ timeWindows: [] })).toBe("Tüm soruları yanıtla.");
  });

  it("listede olmayan seçeneği sessizce atmaz, reddeder", () => {
    expect(err({ goal: "ucmak" })).toContain("geçersiz");
    expect(err({ expectations: ["kilo-vermek", "ucmak"] })).toContain("geçersiz");
    expect(err({ timeWindows: ["gece-yarisi"] })).toContain("geçersiz");
    expect(err({ weeklyDays: "9" })).toContain("geçersiz");
  });

  it("bir sorunun anahtarı başka sorunun listesinde geçerli olsa da reddedilir", () => {
    // "kilo-vermek" hedef listesinde var ama engel listesinde yok.
    expect(err({ barrier: "kilo-vermek" })).toContain("geçersiz");
  });

  it("meslek çok kısa ya da çok uzun", () => {
    expect(err({ occupation: " " })).toBe("Mesleğini yaz.");
    expect(err({ occupation: "A" })).toBe("Mesleğini yaz.");
    expect(err({ occupation: "x".repeat(61) })).toContain("60");
  });

  it("ad soyad tek sözcük ya da çok kısa parçalı", () => {
    expect(err({ fullName: "Ali" })).toBe("Adını ve soyadını yaz.");
    expect(err({ fullName: "A V" })).toBe("Adını ve soyadını yaz.");
    expect(err({ fullName: "" })).toBe("Adını ve soyadını yaz.");
  });

  it("geçersiz telefon ve e-posta", () => {
    expect(err({ phone: "123" })).toBe("Telefonu 0555 111 22 33 gibi yaz.");
    expect(err({ email: "ali@ornek" })).toBe("Geçerli bir e-posta yaz.");
    expect(err({ email: "" })).toBe("Geçerli bir e-posta yaz.");
  });
});

describe("readStartAnswers", () => {
  it("geçerli JSON'u aynen okur", () => {
    const answers = ok().answers;
    expect(readStartAnswers(JSON.parse(JSON.stringify(answers)))).toEqual(answers);
  });

  it("bozuk, boş ve eksik veriyle çökmez, boş alan döner", () => {
    for (const bad of [null, undefined, "x", 5, [], { goal: 3, expectations: "a" }]) {
      const read = readStartAnswers(bad);
      expect(read.goal).toBe("");
      expect(read.expectations).toEqual([]);
      expect(read.timeWindows).toEqual([]);
    }
  });

  it("dizideki metin olmayan öğeleri atar", () => {
    expect(readStartAnswers({ expectations: ["eglenceli", 7, null] }).expectations).toEqual([
      "eglenceli",
    ]);
  });
});

describe("describeStartAnswers / summarizeStartLead", () => {
  it("on satır üretir ve anahtarları okunur etikete çevirir", () => {
    const rows = describeStartAnswers(ok().answers);

    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ label: "Ana hedef", value: "Kilo vermek" });
    expect(rows.find((r) => r.label === "Beklentiler")?.value).toBe(
      "Kilo vermeme yardımcı olsun, Boks gibi farklı şeyler de öğreneyim",
    );
    expect(rows.find((r) => r.label === "Uygun zamanlar")?.value).toBe(
      "Sabah 07:00–10:00, Akşam 18:00–22:00",
    );
  });

  it("bilinmeyen anahtarı olduğu gibi gösterir (eski kayıt ekranı bozmaz)", () => {
    const rows = describeStartAnswers(readStartAnswers({ goal: "eski-anahtar" }));
    expect(rows[0].value).toBe("eski-anahtar");
  });

  it("özet iletişim bilgilerini ve yanıtları tek satırda verir", () => {
    const text = summarizeStartLead(ok());

    expect(text).toContain("Ali Veli");
    expect(text).toContain("05551112233");
    expect(text).toContain("ali@ornek.com");
    expect(text).toContain("Ana hedef: Kilo vermek");
    expect(text).not.toContain("\n");
  });
});
