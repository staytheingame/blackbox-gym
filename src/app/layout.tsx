import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const display = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BlackBox — Box & Fight Gym",
  description:
    "BlackBox, boks ve fight sporlarına odaklanan salon. Üyelik planları, antrenman programları, ekipman ve ders takvimi.",
};

/**
 * Kök layout yalnız `<html>/<body>` ve fontları kurar.
 *
 * Tanıtım sitesinin Header/Footer'ı `(site)/layout.tsx`'e taşındı: panel
 * rotaları (`/uye`, `/personel`) ve giriş ekranı kendi kabuğunu kuruyor,
 * pazarlama başlığının içinde açılmıyor.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-brand-black text-brand-white">
        {children}
      </body>
    </html>
  );
}
