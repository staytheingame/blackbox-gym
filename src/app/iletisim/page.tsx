import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/ContactForm";
import { siteConfig } from "@/config/navigation";

export const metadata: Metadata = {
  title: "İletişim — BlackBox",
  description: "BlackBox salon adresi, saatleri ve iletişim formu.",
};

export default function ContactPage() {
  return (
    <div>
      <PageHero
        eyebrow="İletişim"
        title="Bize Ulaş"
        description="Sorularını yanıtlayalım, ilk antrenmanına birlikte karar verelim."
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wide text-brand-yellow">
            Salon Bilgileri
          </h2>
          <dl className="mt-4 space-y-4 text-sm text-brand-muted">
            <div>
              <dt className="font-semibold text-brand-white">Adres</dt>
              <dd>{siteConfig.city}, Türkiye</dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-white">Telefon</dt>
              <dd>
                <a href="tel:+902120000000" className="hover:text-brand-yellow">
                  +90 212 000 00 00
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-white">E-posta</dt>
              <dd>
                <a
                  href="mailto:info@blackbox.gym"
                  className="hover:text-brand-yellow"
                >
                  info@blackbox.gym
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-brand-white">
                Çalışma Saatleri
              </dt>
              <dd>Hafta içi 07:00–23:00</dd>
              <dd>Hafta sonu 09:00–21:00</dd>
            </div>
          </dl>

          <div className="mt-8 flex h-48 items-center justify-center rounded-sm border border-dashed border-brand-border text-xs uppercase tracking-wide text-brand-muted">
            Harita — yerel sürümde yer tutucu
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl uppercase tracking-wide text-brand-yellow">
            Mesaj Gönder
          </h2>
          <div className="mt-4">
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
