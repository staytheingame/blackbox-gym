import type { ReactNode } from "react";
import { Header } from "@/components/app-shell/Header";
import { Footer } from "@/components/app-shell/Footer";

/** Public tanıtım sitesi kabuğu — panel rotaları bu layout'un dışında. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
