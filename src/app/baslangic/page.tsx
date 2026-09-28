import type { Metadata } from "next";
import Link from "next/link";
import { StartForm } from "./StartForm";

export const metadata: Metadata = {
  title: "Sana Uygun Başlangıcı Bulalım — BlackBox",
  description:
    "Seni, hedefini ve günlük hayatını biraz tanıyalım. Yaklaşık 1 dakika sürer.",
  robots: { index: false, follow: false },
};

export default function StartFunnelPage() {
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
          <h1 className="font-display text-2xl uppercase leading-tight tracking-wide text-brand-white">
            Sana Uygun Başlangıcı Bulalım
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-muted">
            Seni, hedefini ve günlük hayatını biraz tanıyalım.
            <br />
            Yaklaşık 1 dakika sürer.
          </p>

          <div className="mt-6">
            <StartForm />
          </div>
        </div>
      </div>
    </div>
  );
}
