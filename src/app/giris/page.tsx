import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Giriş — BlackBox",
  description: "BlackBox üye ve personel paneli girişi.",
};

/**
 * Panel girişi — tanıtım sitesinin Header/Footer'ı bilerek yok
 * (bkz. `app/(site)/layout.tsx`); ekran tek işe odaklanır.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display flex items-center gap-1 text-2xl tracking-wide">
          <span className="text-brand-white">BLACK</span>
          <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">
            BOX
          </span>
        </Link>

        <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
            Üye & Personel
          </span>
          <h1 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
            Panele Giriş
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-brand-muted">
            Hesabın yoksa resepsiyonla iletişime geç — üyeler personel
            tarafından sisteme eklenir.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <Link
          href="/"
          className="mt-6 block text-center text-xs font-bold uppercase tracking-wide text-brand-muted hover:text-brand-yellow"
        >
          ← Siteye dön
        </Link>
      </div>
    </div>
  );
}
