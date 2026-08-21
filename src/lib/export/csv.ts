/**
 * CSV üretimi — saf, sunucu/istemci ayrımı yok.
 *
 * Hedef Excel'in Türkçe kurulumu: ayraç **noktalı virgül**, dosya başında
 * **BOM**. Virgülle ayrılmış UTF-8 bir dosya Türkçe Excel'de tek sütuna
 * yapışır ve "ş/ğ/ı" bozulur; iki ayar da bunun içindir.
 *
 * Formül enjeksiyonuna karşı `=`, `+`, `-`, `@` ile başlayan hücrelerin
 * başına tek tırnak konur — kullanıcı adı `=cmd|...` olan bir kayıt
 * indirildiğinde Excel'de komut çalışmasın diye.
 */

export const CSV_DELIMITER = ";";
const BOM = "﻿";

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";

  let text = String(raw);

  // Excel formül enjeksiyonu koruması.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  const needsQuotes =
    text.includes(CSV_DELIMITER) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r");

  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Satırları CSV metnine çevirir (BOM dahil, satır sonu CRLF). */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(
    CSV_DELIMITER,
  );

  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(CSV_DELIMITER),
  );

  return BOM + [header, ...body].join("\r\n") + "\r\n";
}

/** Tarayıcıya indirtmek için hazır yanıt başlıkları. */
export function csvResponseHeaders(fileName: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
  };
}

/** "yoklama-2026-08-19.csv" — dosya adları tarihli, üzerine yazılmasın. */
export function csvFileName(prefix: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
