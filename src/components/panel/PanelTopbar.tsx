"use client";

import Link from "next/link";
import { PANEL_ROLE_LABEL, type PanelRole } from "@/config/panel-nav";
import { useMobileNav } from "./MobileNavContext";
import { MenuIcon } from "./icons";

/** Mobil üst bar — çekmeceyi açan hamburger + marka. Masaüstünde gizli. */
export function PanelTopbar({ role }: { role: PanelRole }) {
  const { toggle } = useMobileNav();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-brand-border bg-brand-black/95 px-4 backdrop-blur md:hidden">
      <button
        type="button"
        onClick={toggle}
        aria-label="Menüyü aç"
        className="flex h-10 w-10 items-center justify-center rounded-sm border border-brand-border text-brand-white"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <Link
        href={role === "staff" ? "/personel" : "/uye"}
        className="font-display flex items-center gap-1 text-base tracking-wide"
      >
        <span className="text-brand-white">BLACK</span>
        <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">
          BOX
        </span>
      </Link>
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-yellow">
        {PANEL_ROLE_LABEL[role]}
      </span>
    </header>
  );
}
