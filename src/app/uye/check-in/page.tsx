import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { CheckInForm } from "./CheckInForm";

export const metadata: Metadata = {
  title: "Check-in — BlackBox",
};

export default function CheckInPage() {
  return (
    <div>
      <PageHero
        eyebrow="Haftalık Check-in"
        title="Bu Hafta Nasıl Geçti?"
        description="Antrenman uyumu, uyku, stres, enerji ve keyif — bu cevaplar performans kartını ve puanlarını günceller."
      />
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6">
        <CheckInForm />
      </section>
    </div>
  );
}
