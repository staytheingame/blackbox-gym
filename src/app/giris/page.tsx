import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Giriş — BlackBox",
  description: "BlackBox üye ve personel girişi.",
};

export default function LoginPage() {
  return (
    <div>
      <PageHero
        eyebrow="Üye & Personel"
        title="Giriş Yap"
        description="Hesabın yoksa salonda resepsiyonla iletişime geç — üyeler personel tarafından sisteme eklenir."
      />
      <section className="mx-auto max-w-sm px-4 py-14 sm:px-6">
        <LoginForm />
      </section>
    </div>
  );
}
