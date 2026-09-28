import { describe, expect, it } from "vitest";
import {
  FUNNEL_OFFERS,
  PRIVATE_LESSON_TERMS,
  isBirebirOffer,
  normalizePhone,
  parseFunnelLead,
  pricePerSessionMinor,
  summarizeLead,
  toWhatsAppNumber,
  type LeadInput,
} from "./lead";

const valid: LeadInput = {
  forWhom: "kendim",
  interest: "birebir-12",
  goals: ["boks"],
  firstName: "Ali",
  lastName: "Veli",
  email: "Ali@Ornek.com",
  phone: "0555 111 22 33",
  age: "32",
  childName: "",
  occupationGroup: "hukuk",
  dailyLoad: "yogun",
  preferredTimes: ["aksam"],
  contactChannel: "whatsapp",
  contactTime: "aksam",
  note: "",
  kvkkConsent: true,
  marketingConsent: false,
};

function ok(overrides: Partial<LeadInput> = {}) {
  const result = parseFunnelLead({ ...valid, ...overrides });
  if (!result.ok) throw new Error(`beklenmedik ret: ${result.error}`);
  return result.lead;
}
function err(overrides: Partial<LeadInput>) {
  const result = parseFunnelLead({ ...valid, ...overrides });
  return result.ok ? null : result.error;
}

describe("teklifler", () => {
  it("birebir 12 ders 20.000 ₺, 24 ders 36.000 ₺", () => {
    const price = (value: string) =>
      FUNNEL_OFFERS.find((offer) => offer.value === value)?.priceMinor;

    expect(price("birebir-12")).toBe(2_000_000);
    expect(price("birebir-24")).toBe(3_600_000);
  });

  it("grup seçeneğinin fiyatı ve ders adedi yok", () => {
    const grup = FUNNEL_OFFERS.find((offer) => offer.value === "grup");

    expect(grup?.priceMinor).toBeNull();
    expect(grup?.sessions).toBeNull();
    expect(pricePerSessionMinor("grup")).toBeNull();
  });

  it("ders başı fiyatı doğru hesaplar: 12 derste ≈1.667 ₺, 24 derste 1.500 ₺", () => {
    expect(pricePerSessionMinor("birebir-12")).toBe(166_667);
    expect(pricePerSessionMinor("birebir-24")).toBe(150_000);
  });

  it("yalnız birebir seçenekleri birebir sayılır", () => {
    expect(isBirebirOffer("birebir-12")).toBe(true);
    expect(isBirebirOffer("birebir-24")).toBe(true);
    expect(isBirebirOffer("grup")).toBe(false);
    expect(isBirebirOffer("baska")).toBe(false);
  });

  it("şartlar antrenör eşliğini, uzun dönem planı ve iptal kuralını söyler", () => {
    const text = PRIVATE_LESSON_TERMS.join(" ");

    expect(text).toContain("antrenör eşliğinde");
    expect(text).toContain("uzun dönemli");
    expect(text).toContain("3 saatten fazla");
    expect(text).toContain("yanar");
  });
});

describe("normalizePhone", () => {
  it("farklı yazımları tek biçime getirir", () => {
    for (const raw of [
      "0555 111 22 33",
      "555 111 22 33",
      "+90 555 111 22 33",
      "0090 555 111 22 33",
      "905551112233",
      "(0555) 111-22-33",
    ]) {
      expect(normalizePhone(raw), raw).toBe("05551112233");
    }
  });

  it("geçersiz numarayı reddeder", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("0155 111 22 33")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("yurt dışı numarasını + ile korur", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });
});

describe("toWhatsAppNumber", () => {
  it("Türkiye numarasını 90 ile başlatır", () => {
    expect(toWhatsAppNumber("0555 111 22 33")).toBe("905551112233");
  });

  it("yurt dışı numarasında + olmadan rakamları verir", () => {
    expect(toWhatsAppNumber("+44 7911 123456")).toBe("447911123456");
  });

  it("geçersizde null", () => {
    expect(toWhatsAppNumber("12")).toBeNull();
  });
});

describe("parseFunnelLead — geçerli başvuru", () => {
  it("kendisi için başvuruyu kabul eder ve alanları düzenler", () => {
    const lead = ok();

    expect(lead.fullName).toBe("Ali Veli");
    expect(lead.email).toBe("ali@ornek.com");
    expect(lead.phone).toBe("05551112233");
    expect(lead.age).toBe(32);
    expect(lead.childName).toBeNull();
    expect(lead.quotedPriceMinor).toBe(2_000_000);
  });

  it("teklif anındaki fiyatı başvuruya kopyalar; grupta fiyat yok", () => {
    expect(ok({ interest: "birebir-24" }).quotedPriceMinor).toBe(3_600_000);
    expect(ok({ interest: "grup" }).quotedPriceMinor).toBeNull();
  });

  it("çocuk için başvuruda çocuğun adı ve yaşı alınır", () => {
    const lead = ok({ forWhom: "cocugum", childName: "Mert", age: "9" });

    expect(lead.forWhom).toBe("cocugum");
    expect(lead.childName).toBe("Mert");
    expect(lead.age).toBe(9);
  });

  it("birden fazla hedef listedeki sıraya dizilir, tekrar tekilleşir", () => {
    const lead = ok({ goals: ["kilo-alma", "boks", "boks", "fitness"] });

    expect(lead.goals).toEqual(["boks", "fitness", "kilo-alma"]);
  });

  it("isteğe bağlı alanlar boş bırakılabilir", () => {
    const lead = ok({
      occupationGroup: "",
      dailyLoad: "",
      preferredTimes: [],
      contactTime: "",
      note: "  ",
    });

    expect(lead.occupationGroup).toBeNull();
    expect(lead.dailyLoad).toBeNull();
    expect(lead.preferredTimes).toEqual([]);
    expect(lead.contactTime).toBeNull();
    expect(lead.note).toBeNull();
  });

  it("üç iletişim kanalını da kabul eder", () => {
    for (const channel of ["whatsapp", "telefon", "eposta"]) {
      expect(ok({ contactChannel: channel }).contactChannel).toBe(channel);
    }
  });
});

describe("parseFunnelLead — reddedilenler", () => {
  it("kimin için olduğu seçilmemişse", () => {
    expect(err({ forWhom: "" })).toBe("Kimin için olduğunu seç.");
    expect(err({ forWhom: "arkadasim" })).toBe("Kimin için olduğunu seç.");
  });

  it("ilgilenilen seçenek seçilmemiş ya da bozuksa", () => {
    expect(err({ interest: "" })).toBe("İlgilendiğin seçeneği seç.");
    expect(err({ interest: "birebir-99" })).toBe("İlgilendiğin seçeneği seç.");
  });

  it("hedef seçilmemişse ya da listede yoksa", () => {
    expect(err({ goals: [] })).toBe("En az bir hedef seç.");
    expect(err({ goals: ["boks", "uzay"] })).toBe("Hedef seçimi geçersiz.");
  });

  it("kısa ad ve soyadı", () => {
    expect(err({ firstName: "A" })).toBe("Adını yaz.");
    expect(err({ lastName: "" })).toBe("Soyadını yaz.");
  });

  it("geçersiz e-posta", () => {
    expect(err({ email: "ali" })).toBe("Geçerli bir e-posta yaz.");
    expect(err({ email: "ali@ornek" })).toBe("Geçerli bir e-posta yaz.");
  });

  it("geçersiz telefon", () => {
    expect(err({ phone: "123" })).toBe("Telefonu 0555 111 22 33 gibi yaz.");
  });

  it("kendisi için yaş 12–90 dışındaysa", () => {
    expect(err({ age: "5" })).toContain("12–90");
    expect(err({ age: "120" })).toContain("12–90");
    expect(err({ age: "abc" })).toContain("12–90");
    expect(err({ age: "32.5" })).toContain("12–90");
  });

  it("çocuk için yaş 3–17 dışındaysa; yetişkin yaşı çocuk için geçmez", () => {
    expect(err({ forWhom: "cocugum", childName: "Mert", age: "30" })).toContain("3–17");
    expect(err({ forWhom: "cocugum", childName: "Mert", age: "2" })).toContain("3–17");
  });

  it("çocuk için başvuruda çocuğun adı zorunlu", () => {
    expect(err({ forWhom: "cocugum", childName: "", age: "9" })).toBe(
      "Çocuğunun adını yaz.",
    );
  });

  it("listede olmayan meslek grubu, yoğunluk, saat, kanal ve ulaşma saati", () => {
    expect(err({ occupationGroup: "astronot" })).toBe("Meslek grubu seçimi geçersiz.");
    expect(err({ dailyLoad: "cilgin" })).toBe("Günlük yoğunluk seçimi geçersiz.");
    expect(err({ preferredTimes: ["gece-yarisi"] })).toBe("Antrenman saati seçimi geçersiz.");
    expect(err({ contactChannel: "" })).toBe("Nasıl ulaşmamızı istediğini seç.");
    expect(err({ contactChannel: "guvercin" })).toBe("Nasıl ulaşmamızı istediğini seç.");
    expect(err({ contactTime: "gece" })).toBe("Ulaşılacak saat seçimi geçersiz.");
  });

  it("çok uzun not", () => {
    expect(err({ note: "x".repeat(601) })).toBe("Not en fazla 600 karakter olabilir.");
  });

  it("KVKK onayı yoksa", () => {
    expect(err({ kvkkConsent: false })).toContain("aydınlatma metnini");
  });
});

describe("summarizeLead", () => {
  it("denetim kaydı için tek satırda iletişim bilgilerini ve tercihi içerir", () => {
    const text = summarizeLead(ok({ note: "Akşam olsun" }));

    expect(text).toContain("Birebir ders — 12 ders");
    expect(text).toContain("Ali Veli");
    expect(text).toContain("05551112233");
    expect(text).toContain("ali@ornek.com");
    expect(text).toContain("WhatsApp");
    expect(text).toContain("Akşam olsun");
  });

  it("çocuk için çocuğun adını ve yaşını yazar", () => {
    const text = summarizeLead(ok({ forWhom: "cocugum", childName: "Mert", age: "9" }));

    expect(text).toContain("çocuk: Mert, 9 yaş");
  });
});
