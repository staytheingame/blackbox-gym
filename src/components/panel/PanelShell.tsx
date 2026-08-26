import { Suspense, type ReactNode } from "react";
import type { PanelRole } from "@/config/panel-nav";
import { MobileNavProvider } from "./MobileNavContext";
import { PanelSidebar, type PanelUser } from "./PanelSidebar";
import { PanelTabBar } from "./PanelTabBar";
import { PanelTopbar } from "./PanelTopbar";
import { SectionNav } from "./SectionNav";

/**
 * Üye ve personel panellerinin ortak kabuğu: masaüstünde sabit yan menü,
 * mobilde çekmece + alt tab bar. Tanıtım sitesinin Header/Footer'ı burada
 * bilerek yok — panel ayrı bir uygulama gibi durur.
 */
export function PanelShell({
  role,
  user,
  badges,
  children,
}: {
  role: PanelRole;
  user: PanelUser;
  badges?: Partial<Record<string, number>>;
  children: ReactNode;
}) {
  return (
    <MobileNavProvider>
      {/* Dikey ölçü sütun boyunca paylaşılır: `main` kalan boşluğu `flex-1`
          ile doldurur. Eskiden `main` da `min-h-dvh` taşıyordu — mobilde üst
          bar bunun üstüne bindiği için her kısa sayfada 56px'lik boş bir
          kaydırma kalıyordu (telefonda sayfa boşuna zıplıyordu). */}
      <div className="flex min-h-dvh flex-col bg-brand-black">
        <PanelSidebar role={role} user={user} badges={badges} />
        <PanelTopbar role={role} />
        <div className="flex flex-1 flex-col md:pl-60">
          {/* Bölüm şeridi sayfa başlığının üstünde; `useSearchParams`
              kullandığı için Suspense sınırı içinde. */}
          <Suspense fallback={null}>
            <SectionNav role={role} />
          </Suspense>
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
        </div>
        <PanelTabBar role={role} badges={badges} />
      </div>
    </MobileNavProvider>
  );
}
