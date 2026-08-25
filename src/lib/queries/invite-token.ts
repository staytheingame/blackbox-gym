import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

/**
 * Davet anahtarı — sporcu ve personel davetlerinin ORTAK altyapısı.
 *
 * İki davet türü de aynı kuralla çalışır: token veritabanında AÇIK durmaz,
 * yalnız SHA-256 özeti saklanır; bağlantı tek kullanımlıktır ve 72 saat
 * sonra düşer. Özet üretimi tek yerde durmalı — iki tabloda iki farklı
 * hash'leme, "bağlantı çalışmıyor" diye dönen bir arıza demek olurdu.
 */

export const INVITE_TTL_HOURS = 72;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** URL'de taşınabilir, tahmin edilemez 43 karakterlik anahtar. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Davetin bitiş anı — çağrıldığı andan itibaren. */
export function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000);
}

export type InviteLink = {
  token: string;
  expiresAt: Date;
  /** Panelde gösterilen tam adres — personel kopyalayıp gönderir. */
  url: string;
};

/**
 * Davet edilene gönderilecek TAM adres.
 *
 * Öncelik sırası bilinçli: yapılandırılmış alan adı → dağıtımın üretim alan
 * adı → isteğin kendi host başlığı. Sonuncusu sayesinde yerelde ve önizleme
 * dağıtımlarında hiçbir ayar yapmadan da kopyalanabilir bir bağlantı çıkar;
 * kimsenin eline yarım bir "/davet/…" yolu geçmez.
 */
export async function inviteUrl(token: string): Promise<string> {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);

  if (configured) return `${configured.replace(/\/$/, "")}/davet/${token}`;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return `/davet/${token}`;

  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}/davet/${token}`;
}
