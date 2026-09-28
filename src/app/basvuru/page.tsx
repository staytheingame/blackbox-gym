import type { Metadata } from "next";
import Link from "next/link";
import { FunnelForm } from "./FunnelForm";

export const metadata: Metadata = {
  title: "Başvuru — BlackBox",
  description: "BlackBox birebir ve grup dersleri için başvur; seni arayalım.",
  robots: { index: false, follow: false },
};

export default function FunnelPage() {
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
            Başvuru
          </span>
          <h1 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
            Antrenmana Nasıl Başlarız?
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-brand-muted">
            Üç kısa adımda hedefini ve ulaşma tercihini yaz. Sana seçtiğin
            yoldan dönelim, birlikte sana uygun planı çıkaralım.
          </p>

          <div className="mt-6">
            <FunnelForm />
          </div>
        </div>
      </div>
    </div>
  );
}
