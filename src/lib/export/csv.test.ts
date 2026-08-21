import { describe, expect, it } from "vitest";
import { csvFileName, toCsv, type CsvColumn } from "./csv";

type Row = { ad: string; ders: number; not?: string | null };

const columns: CsvColumn<Row>[] = [
  { header: "Ad", value: (row) => row.ad },
  { header: "Ders", value: (row) => row.ders },
  { header: "Not", value: (row) => row.not },
];

/** BOM'u atarak satırlara böler — beklentileri okunur tutmak için. */
function lines(csv: string): string[] {
  return csv.replace(/^﻿/, "").trimEnd().split("\r\n");
}

describe("toCsv", () => {
  it("başlık satırı ve noktalı virgül ayracı yazar", () => {
    const csv = toCsv([{ ad: "Ali", ders: 12 }], columns);

    expect(lines(csv)[0]).toBe("Ad;Ders;Not");
    expect(lines(csv)[1]).toBe("Ali;12;");
  });

  it("Excel için BOM ile başlar", () => {
    expect(toCsv([], columns).startsWith("﻿")).toBe(true);
  });

  it("ayraç içeren hücreyi tırnaklar", () => {
    const csv = toCsv([{ ad: "Yılmaz; Ali", ders: 1 }], columns);
    expect(lines(csv)[1]).toBe('"Yılmaz; Ali";1;');
  });

  it("tırnağı ikileyerek kaçırır", () => {
    const csv = toCsv([{ ad: 'Ali "Boxer"', ders: 1 }], columns);
    expect(lines(csv)[1]).toBe('"Ali ""Boxer""";1;');
  });

  it("satır sonu içeren hücreyi tırnak içinde tutar", () => {
    const csv = toCsv([{ ad: "Ali", ders: 1, not: "bir\niki" }], columns);
    expect(csv).toContain('"bir\niki"');
  });

  it("formülle başlayan hücreyi etkisizleştirir", () => {
    const csv = toCsv([{ ad: "=1+1", ders: 1 }], columns);
    expect(lines(csv)[1]).toBe("'=1+1;1;");
  });

  it("boş ve null hücreleri boş bırakır", () => {
    const csv = toCsv([{ ad: "Ali", ders: 0, not: null }], columns);
    expect(lines(csv)[1]).toBe("Ali;0;");
  });

  it("kayıt yoksa yalnız başlığı yazar", () => {
    expect(lines(toCsv([], columns))).toEqual(["Ad;Ders;Not"]);
  });
});

describe("csvFileName", () => {
  it("dosya adına tarih ekler", () => {
    expect(csvFileName("yoklama", new Date("2026-08-19T21:00:00.000Z"))).toBe(
      "yoklama-2026-08-19.csv",
    );
  });
});
