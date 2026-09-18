import "server-only";
import { headers } from "next/headers";

/**
 * Panelde gösterilen TAM adres — davet bağlantısı, kayıt linki, QR kod.
 *
 * Öncelik sırası bilinçli: yapılandırılmış alan adı → dağıtımın üretim alan
 * adı → isteğin kendi host başlığı. Sonuncusu sayesinde yerelde ve önizleme
 * dağıtımlarında hiçbir ayar yapmadan da kopyalanabilir bir bağlantı çıkar;
 * kimsenin eline yarım bir "/katil/…" yolu geçmez.
 *
 * Bir yerde duruyor çünkü iki akış da (kişiye özel davet, çoğa açık kayıt
 * linki) aynı adresi üretmek zorunda: biri "localhost", öteki üretim alan adı
 * verirse QR kod yanlış yere gider.
 */
export async function absoluteUrl(path: string): Promise<string> {
  const suffix = path.startsWith("/") ? path : `/${path}`;

  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  if (configured) return `${configured.replace(/\/$/, "")}${suffix}`;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return suffix;

  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}${suffix}`;
}
