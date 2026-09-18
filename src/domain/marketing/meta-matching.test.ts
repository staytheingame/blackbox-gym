import { describe, expect, it } from "vitest";
import {
  ageFrom,
  isMatchable,
  matchScore,
  normalizeCountry,
  normalizeEmail,
  normalizeGender,
  normalizePhone,
  splitName,
  toMatchingRow,
} from "./meta-matching";

describe("normalizeEmail", () => {
  it("küçük harfe çeker ve boşlukları atar", () => {
    expect(normalizeEmail("  Ali@Gmail.COM ")).toBe("ali@gmail.com");
  });

  it("geçersiz adresi boş bırakır", () => {
    expect(normalizeEmail("ali@")).toBe("");
    expect(normalizeEmail("ali")).toBe("");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("normalizePhone", () => {
  it("yerel yazımın başına ülke kodu ekler", () => {
    expect(normalizePhone("0555 111 22 33")).toBe("905551112233");
    expect(normalizePhone("555 111 22 33")).toBe("905551112233");
  });

  it("zaten ülke kodlu numaraya dokunmaz", () => {
    expect(normalizePhone("+90 555 111 22 33")).toBe("905551112233");
    expect(normalizePhone("0090 555 111 22 33")).toBe("905551112233");
  });

  it("yabancı numaranın ülke kodunu korur", () => {
    expect(normalizePhone("+49 151 23456789")).toBe("4915123456789");
  });

  it("tanınmayan uzunlukta ülke kodu uydurmaz", () => {
    expect(normalizePhone("1234")).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("normalizeCountry", () => {
  it("ülke adını ISO koduna çevirir", () => {
    expect(normalizeCountry("Türkiye")).toBe("tr");
    expect(normalizeCountry("TR")).toBe("tr");
  });

  it("tanımadığı ülkeyi boş bırakır — yanlış kod eşleşmeyi bozar", () => {
    expect(normalizeCountry("Ay")).toBe("ay"); // iki harf: olduğu gibi
    expect(normalizeCountry("Bilinmeyen Ülke")).toBe("");
  });
});

describe("splitName", () => {
  it("ayrı alanlar doluysa onları kullanır", () => {
    expect(splitName({ firstName: "Ali", lastName: "Yılmaz" })).toEqual({
      first: "ali",
      last: "yılmaz",
    });
  });

  it("tam addan son kelimeyi soyad sayar", () => {
    expect(splitName({ fullName: "Ali Kemal Yılmaz" })).toEqual({
      first: "ali kemal",
      last: "yılmaz",
    });
  });

  it("tek kelimelik adda soyadı boş bırakır", () => {
    expect(splitName({ fullName: "Ali" })).toEqual({ first: "ali", last: "" });
  });

  it("noktalama ve rakamları atar", () => {
    expect(splitName({ fullName: "Ali-Kemal O'Brien 2" })).toEqual({
      first: "ali kemal",
      last: "obrien",
    });
  });
});

describe("toMatchingRow", () => {
  it("tüm alanları Meta biçimine çevirir", () => {
    expect(
      toMatchingRow({
        email: "Ali@Gmail.com",
        phone: "0555 111 22 33",
        firstName: "Ali",
        lastName: "Yılmaz",
        city: "İstanbul",
        state: "İstanbul",
        country: "Türkiye",
        postalCode: "34 100",
        birthDate: new Date("1996-03-07T00:00:00.000Z"),
        gender: "erkek",
      }),
    ).toEqual({
      email: "ali@gmail.com",
      phone: "905551112233",
      fn: "ali",
      ln: "yılmaz",
      ct: "istanbul",
      st: "istanbul",
      country: "tr",
      zip: "34100",
      dob: "19960307",
      ge: "m",
    });
  });

  it("eksik alanları boş bırakır, satırı düşürmez", () => {
    const row = toMatchingRow({ fullName: "Ali Yılmaz" });
    expect(row.fn).toBe("ali");
    expect(row.email).toBe("");
    expect(row.phone).toBe("");
  });
});

describe("eşleşme gücü", () => {
  it("e-posta ya da telefon yoksa yüklenebilir değil", () => {
    expect(isMatchable(toMatchingRow({ fullName: "Ali Yılmaz" }))).toBe(false);
    expect(isMatchable(toMatchingRow({ phone: "05551112233" }))).toBe(true);
    expect(isMatchable(toMatchingRow({ email: "a@b.com" }))).toBe(true);
  });

  it("dolu alan arttıkça puan artar", () => {
    const az = matchScore(toMatchingRow({ email: "a@b.com" }));
    const cok = matchScore(
      toMatchingRow({
        email: "a@b.com",
        phone: "05551112233",
        firstName: "Ali",
        lastName: "Yılmaz",
      }),
    );
    expect(cok).toBeGreaterThan(az);
  });
});

describe("normalizeGender", () => {
  it("Türkçe değerleri Meta koduna çevirir", () => {
    expect(normalizeGender("kadın")).toBe("f");
    expect(normalizeGender("erkek")).toBe("m");
    expect(normalizeGender("belirtmedi")).toBe("");
  });
});

describe("ageFrom", () => {
  it("doğum günü geçmemişse bir yaş eksik sayar", () => {
    const now = new Date("2026-03-06T00:00:00.000Z");
    expect(ageFrom(new Date("1996-03-07T00:00:00.000Z"), now)).toBe(29);
  });

  it("doğum gününde yaşı bir arttırır", () => {
    const now = new Date("2026-03-07T00:00:00.000Z");
    expect(ageFrom(new Date("1996-03-07T00:00:00.000Z"), now)).toBe(30);
  });

  it("tarih yoksa null döner", () => {
    expect(ageFrom(null)).toBeNull();
  });
});
