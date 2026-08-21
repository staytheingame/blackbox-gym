import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import { Header } from "@/components/app-shell/Header";
import { Footer } from "@/components/app-shell/Footer";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-brand-black text-brand-white">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
