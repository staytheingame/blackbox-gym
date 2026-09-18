import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { absoluteUrl } from "@/lib/app-url";

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
 * Davet edilene gönderilecek TAM adres. Adresin nasıl çözüldüğü
 * `src/lib/app-url.ts` içinde — kayıt linki de aynı kaynağı kullanır.
 */
export async function inviteUrl(token: string): Promise<string> {
  return absoluteUrl(`/davet/${token}`);
}
