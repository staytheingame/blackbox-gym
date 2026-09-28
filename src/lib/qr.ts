import "server-only";
import QRCode from "qrcode";

/**
 * QR kod üretimi — kayıt bağlantısı salon girişine basılıp okutulsun diye.
 *
 * Hata düzeltme seviyesi `M`: baskı buruşsa ya da telefon ekranı hafif
 * çiziliyse de okunur, ama `H` kadar yoğun (okuması zor) olmaz. Beyaz zemin
 * sabittir — koyu temada bile QR açık zeminde durmalı, aksi halde okunmaz.
 */

const COLORS = { dark: "#000000", light: "#ffffff" };

/** Ekranda göstermek için — ölçeklenir, boyutu kapsayıcı belirler. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: COLORS,
  });
}

/** Yazdırıp asmak için — 1024 px, geniş beyaz kenarlıkla. */
export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 1024,
    color: COLORS,
  });
}
