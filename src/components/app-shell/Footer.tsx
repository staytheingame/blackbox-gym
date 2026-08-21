import Link from "next/link";
import { primaryNav, siteConfig } from "@/config/navigation";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-brand-border bg-brand-ink">
      <div className="h-1 w-full bg-diagonal-stripes" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="font-display flex items-center gap-1 text-lg tracking-wide">
            <span className="text-brand-white">BLACK</span>
            <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">
              BOX
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-muted">
            {siteConfig.description}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-yellow">
            Salon
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-brand-muted">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-brand-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-yellow">
            İletişim
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-brand-muted">
            <li>{siteConfig.city}, Türkiye</li>
            <li>
              <a href="tel:+902120000000" className="hover:text-brand-white">
                +90 212 000 00 00
              </a>
            </li>
            <li>
              <a
                href="mailto:info@blackbox.gym"
                className="hover:text-brand-white"
              >
                info@blackbox.gym
              </a>
            </li>
            <li>Hafta içi 07:00–23:00 · Hafta sonu 09:00–21:00</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-brand-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-brand-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            © {year} {siteConfig.name}. Tüm hakları saklıdır.
          </span>
          <span>Yerel geliştirme sürümü — henüz canlı değil.</span>
        </div>
      </div>
    </footer>
  );
}
