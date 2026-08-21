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
  compact = false,
}: {
  url: string;
  memberName: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const message = `Merhaba ${memberName.split(" ")[0]}, BlackBox sporcu panelin hazır. Şu bağlantıdan kendi şifreni belirle: ${url} (bağlantı 72 saat geçerli)`;

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
            72 saat geçerli ve tek kullanımlık — kaybolursa Davetler sayfasından
            yenisini üretebilirsin.
          </p>
        </>
      )}

      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-3 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 font-mono text-xs text-brand-white outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(url)}
          className="rounded-sm bg-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
        >
          {copied ? "Kopyalandı" : "Bağlantıyı Kopyala"}
        </button>
        <button
          type="button"
          onClick={() => copy(message)}
          className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow"
        >
          Hazır Mesajı Kopyala
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow"
        >
          WhatsApp&apos;ta Aç
        </a>
      </div>
    </div>
  );
}
