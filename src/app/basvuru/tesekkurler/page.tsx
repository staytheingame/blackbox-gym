import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Teşekkürler — BlackBox",
  robots: { index: false, follow: false },
};

export default function FunnelThanksPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="font-display flex items-center gap-1 text-2xl tracking-wide"
        >
          <span className="text-brand-white">BLACK</span>
          <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">BOX</span>
        </Link>

        <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
            Başvurun alındı
          </span>
          <h1 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
            Teşekkürler
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Başvurunu aldık. Seçtiğin iletişim yolundan, belirttiğin saatlerde
            sana dönüş yapacağız. Görüşmede hedefini konuşup sana uygun
            programı birlikte netleştireceğiz.
          </p>
          <Link
            href="/"
            className="mt-6 block rounded-sm border border-brand-border px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow"
          >
            Siteye Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
