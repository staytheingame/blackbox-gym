"use client";

import { useState } from "react";
import { rowButtonClass } from "@/components/panel/form";

/**
 * Paylaşılabilir kayıt bağlantısı kutusu.
 *
 * Davet kutusundan (`InviteLinkBox`) farkı: bu bağlantı KİŞİYE ÖZEL DEĞİL —
 * hazır mesaj "Merhaba Ali" diye başlamaz, çünkü aynı metin Instagram
 * biyografisine de konacak. Metin herkese aynı gider.
 */
export function JoinLinkBox({
  url,
  label,
  fresh = false,
}: {
  url: string;
  label: string;
  fresh?: boolean;
}) {
  const [copied, setCopied] = useState<"url" | "mesaj" | null>(null);

  const message = `BlackBox üyelik kaydı: ${url} — bilgilerini yaz, şifreni belirle, hesabın anında açılır.`;

  async function copy(text: string, which: "url" | "mesaj") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div
      className={`rounded-sm border p-4 ${
        fresh
          ? "border-brand-yellow/40 bg-brand-yellow/10"
          : "border-brand-border bg-brand-black/30"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
        {label}
      </p>

      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-2 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 font-mono text-base text-brand-white outline-none sm:text-xs"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(url, "url")}
          className={rowButtonClass}
        >
          {copied === "url" ? "Kopyalandı" : "Bağlantıyı Kopyala"}
        </button>
        <button
          type="button"
          onClick={() => copy(message, "mesaj")}
          className={rowButtonClass}
        >
          {copied === "mesaj" ? "Kopyalandı" : "Hazır Mesajı Kopyala"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={rowButtonClass}
        >
          WhatsApp&apos;ta Paylaş
        </a>
      </div>
    </div>
  );
}
