"use client";

import { useState } from "react";

/**
 * Davet bağlantısı kutusu — antrenör kopyalayıp WhatsApp'tan gönderir.
 *
 * Bağlantı bilinçli olarak SEÇİLEBİLİR bir metin alanında durur: kopyalama
 * izni olmayan tarayıcılarda (ya da HTTP'de) "Kopyala" düğmesi çalışmaz,
 * kullanıcı elle seçip kopyalayabilsin. Hazır bir WhatsApp mesajı da
 * üretilir — antrenörün metin yazması gerekmesin.
 *
 * Adres sunucuda tam hâliyle üretilir (bkz. `inviteUrl`), burada yalnız
 * gösterilir — istemcide tamamlama yapılmaz.
 */
export function InviteLinkBox({
  url,
  memberName,
  kind = "sporcu",
  compact = false,
}: {
  url: string;
  memberName: string;
  /** Hazır mesajın ve açıklamanın dili buna göre değişir. */
  kind?: "sporcu" | "personel";
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const panelLabel = kind === "personel" ? "antrenör panelin" : "sporcu panelin";
  const message = `Merhaba ${memberName.split(" ")[0]}, BlackBox ${panelLabel} hazır. Şu bağlantıdan kendi şifreni belirle: ${url} (bağlantı 72 saat geçerli)`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={`rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 ${
        compact ? "p-3" : "p-5"
      }`}
    >
      {!compact && (
        <>
          <h3 className="font-display text-sm uppercase tracking-wide text-brand-yellow">
            Davet bağlantısı hazır
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-brand-white">
            {memberName} bu bağlantıdan kendi şifresini belirleyecek. Bağlantı
            72 saat geçerli ve tek kullanımlık — kaybolursa{" "}
            {kind === "personel" ? "aşağıdaki bekleyen davetler" : "Davetler"}{" "}
            listesinden yenisini üretebilirsin.
          </p>
        </>
      )}

      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-3 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 font-mono text-base text-brand-white outline-none sm:text-xs"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(url)}
          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white sm:min-h-8"
        >
          {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
        </button>
        <button
          type="button"
          onClick={() => copy(message)}
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-8"
        >
          Hazır Mesajı Kopyala
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-8"
        >
          WhatsApp&apos;ta Aç
        </a>
      </div>
    </div>
  );
}
