import { qrSvg } from "@/lib/qr";

/**
 * Ekranda QR kod. Sunucuda üretilir (istemciye kütüphane gitmez); çıktı
 * kendi ürettiğimiz SVG olduğu için `dangerouslySetInnerHTML` güvenlidir —
 * içine kullanıcı metni yerleştirilmez, yalnız bağlantı kodlanır.
 */
export async function QrCode({
  value,
  size = 176,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  const svg = await qrSvg(value);

  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="shrink-0 overflow-hidden rounded-sm bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
