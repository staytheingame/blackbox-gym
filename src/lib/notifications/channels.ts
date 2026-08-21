import "server-only";
import type { NotificationChannel } from "@/domain/notifications/kinds";

/**
 * Bildirim kanalları — uygulama içi kutu HER ZAMAN çalışır, dış kanallar
 * yapılandırılmışsa devreye girer.
 *
 * Bilinçli tasarım: dış kanal yoksa ya da hata verirse bildirim KAYBOLMAZ,
 * panelde durur. Böylece salon hiçbir servis bağlamadan da sistemi kullanır.
 *
 * ── Neden e-posta, neden WhatsApp değil ──────────────────────
 * WhatsApp Business API'de salonun sporcuya gönderdiği hatırlatma "utility"
 * konuşması sayılır ve KONUŞMA BAŞINA ÜCRETLİDİR (Meta ya da Twilio gibi bir
 * aracı üzerinden). E-posta ise gerçekten ücretsiz katmanlarla çalışır:
 *
 *   - Brevo  → günde 300 e-posta, süresiz ücretsiz, kart istemez
 *   - Resend → ayda 3.000 / günde 100, ücretsiz
 *
 * İkisi de düz HTTP API; ek npm paketi gerekmez. Hangisinin anahtarı
 * tanımlıysa o kullanılır (ikisi de varsa Brevo, kotası daha uygun).
 *
 * WhatsApp bağlanmak istenirse `deliver` içindeki dal hazır: sağlayıcının
 * uç noktası `WHATSAPP_API_URL` + `WHATSAPP_API_TOKEN` ile verilir.
 */

export type DeliveryTarget = {
  email: string | null;
  phone: string | null;
  displayName: string;
};

export type DeliveryResult = {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
};

const FROM_NAME = process.env.NOTIFY_FROM_NAME ?? "BlackBox";
const FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL ?? "";

/** Ortam değişkeni yazılmışsa kanal "yapılandırılmış" sayılır. */
export function configuredChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = ["uygulama"];
  if (emailProvider() !== null) channels.push("eposta");
  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
    channels.push("whatsapp");
  }
  return channels;
}

export type EmailProvider = "brevo" | "resend";

/** Hangi e-posta sağlayıcısı yapılandırılmış — ikisi de varsa Brevo. */
export function emailProvider(): EmailProvider | null {
  if (!FROM_EMAIL) return null;
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

/** Panelde "hangi kanal açık" bilgisini göstermek için okunur ad. */
export const EMAIL_PROVIDER_LABEL: Record<EmailProvider, string> = {
  brevo: "Brevo (günde 300 ücretsiz)",
  resend: "Resend (ayda 3.000 ücretsiz)",
};

/** Düz metni basit bir HTML gövdeye sarar — şablon motoru gerekmiyor. */
function toHtml(title: string, body: string): string {
  const escape = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  return `<!doctype html><html lang="tr"><body style="margin:0;background:#0b0b0b;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:4px">
<tr><td style="padding:24px">
<div style="font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#f5c518">BlackBox</div>
<h1 style="margin:8px 0 0;font-size:20px;color:#fff">${escape(title)}</h1>
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#a3a3a3">${escape(body)}</p>
</td></tr></table>
<p style="margin:16px auto 0;max-width:520px;font-size:11px;color:#6b6b6b">Bu bildirimi BlackBox sporcu panelinden aldın. Hatırlatmaları panelden kapatabilirsin.</p>
</body></html>`;
}

async function sendWithBrevo(input: {
  to: string;
  toName: string;
  title: string;
  body: string;
}): Promise<DeliveryResult> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: input.to, name: input.toName }],
      subject: input.title,
      textContent: input.body,
      htmlContent: toHtml(input.title, input.body),
    }),
  });

  if (response.ok) return { channel: "eposta", ok: true };

  return {
    channel: "eposta",
    ok: false,
    error: `Brevo ${response.status}: ${(await response.text()).slice(0, 200)}`,
  };
}

async function sendWithResend(input: {
  to: string;
  title: string;
  body: string;
}): Promise<DeliveryResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [input.to],
      subject: input.title,
      text: input.body,
      html: toHtml(input.title, input.body),
    }),
  });

  if (response.ok) return { channel: "eposta", ok: true };

  return {
    channel: "eposta",
    ok: false,
    error: `Resend ${response.status}: ${(await response.text()).slice(0, 200)}`,
  };
}

/**
 * Bildirimi dış kanala verir. Uygulama içi kanal için yapacak bir şey yok:
 * satırın kendisi zaten kutuda.
 *
 * Ağ hatası fırlatmaz — sonucu `ok:false` olarak döner ki çağıran taraf
 * bildirimi "gönderilemedi" diye işaretlesin, iş yarıda kesilmesin.
 */
export async function deliver(input: {
  channel: NotificationChannel;
  target: DeliveryTarget;
  title: string;
  body: string;
}): Promise<DeliveryResult> {
  const { channel, target } = input;

  if (channel === "uygulama") return { channel, ok: true };

  try {
    if (channel === "eposta") {
      const provider = emailProvider();
      if (!provider) {
        return {
          channel,
          ok: false,
          error:
            "E-posta sağlayıcısı tanımlı değil (BREVO_API_KEY ya da RESEND_API_KEY + NOTIFY_FROM_EMAIL).",
        };
      }
      if (!target.email) {
        return { channel, ok: false, error: "Alıcının e-postası yok" };
      }

      return provider === "brevo"
        ? sendWithBrevo({
            to: target.email,
            toName: target.displayName,
            title: input.title,
            body: input.body,
          })
        : sendWithResend({
            to: target.email,
            title: input.title,
            body: input.body,
          });
    }

    if (channel === "whatsapp") {
      const url = process.env.WHATSAPP_API_URL;
      const token = process.env.WHATSAPP_API_TOKEN;
      if (!url || !token) {
        return { channel, ok: false, error: "WhatsApp API bilgisi tanımlı değil" };
      }
      if (!target.phone) {
        return { channel, ok: false, error: "Alıcının telefonu yok" };
      }

      // Sağlayıcıdan bağımsız, en yaygın gövde (Meta Cloud API deseni).
      // Farklı bir sağlayıcı kullanılacaksa yalnız burası değişir.
      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizePhone(target.phone),
          type: "text",
          text: { body: `${input.title}\n\n${input.body}` },
        }),
      });

      if (response.ok) return { channel, ok: true };
      return {
        channel,
        ok: false,
        error: `WhatsApp ${response.status}: ${(await response.text()).slice(0, 200)}`,
      };
    }

    return { channel, ok: false, error: `Bilinmeyen kanal: ${channel}` };
  } catch (error) {
    return {
      channel,
      ok: false,
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    };
  }
}

/** "0555 123 45 67" → "905551234567" — WhatsApp uluslararası biçim ister. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}
