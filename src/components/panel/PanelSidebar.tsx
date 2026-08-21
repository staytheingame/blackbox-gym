"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  PANEL_ROLE_LABEL,
  sectionForPath,
  sectionsForRole,
  type PanelRole,
} from "@/config/panel-nav";
import { enabledFeatureFlags } from "@/config/feature-flags";
import { logoutAction } from "@/lib/auth/actions";
import { useMobileNav } from "./MobileNavContext";
import { CloseIcon, ExternalIcon, LogoutIcon } from "./icons";

export type PanelUser = {
  name: string;
  /** Üye numarası ya da e-posta gibi ikincil satır. */
  subtitle?: string;
};

/**
 * Panel yan menüsü — üye ve personel için TEK bileşen, tek config.
 * Masaüstünde sabit sütun, mobilde soldan açılan çekmece.
 */
export function PanelSidebar({
  role,
  user,
  badges,
}: {
  role: PanelRole;
  user: PanelUser;
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const { open, close } = useMobileNav();

  // Yan menü yalnız BÖLÜMLERİ gösterir; alt sayfalar `SectionNav` şeridinde.
  const items = sectionsForRole(role, enabledFeatureFlags());
  const active = sectionForPath(items, pathname);

  // Rota değişince çekmece kapanır.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Çekmece açıkken arka plan kaymasın.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={close}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r border-brand-border bg-brand-ink transition-transform duration-200 md:w-60 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-brand-border px-5 py-5">
          <Link
            href={role === "staff" ? "/personel" : "/uye"}
            className="font-display flex items-center gap-1 text-lg tracking-wide"
          >
            <span className="text-brand-white">BLACK</span>
            <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">
              BOX
            </span>
          </Link>
          <span className="rounded-sm border border-brand-yellow/30 bg-brand-yellow/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-brand-yellow">
            {PANEL_ROLE_LABEL[role]}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Menüyü kapat"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-sm border border-brand-border text-brand-muted hover:text-brand-white md:hidden"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const isActive = active?.id === item.id;
            const Icon = item.icon;
            const count = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-sm border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-brand-yellow/30 bg-brand-yellow/10 text-brand-yellow"
                    : "border-transparent text-brand-muted hover:bg-white/5 hover:text-brand-white"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-brand-yellow" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {count > 0 && (
                  <span
                    className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1.5 py-0.5 text-[0.65rem] font-bold leading-none text-brand-black"
                    aria-label={`${count} bekliyor`}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-brand-border px-3 py-4">
          <div className="px-3 pb-3">
            <div className="truncate text-sm font-semibold text-brand-white">
              {user.name}
            </div>
            {user.subtitle && (
              <div className="truncate text-xs text-brand-muted">
                {user.subtitle}
              </div>
            )}
          </div>

          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-white"
          >
            <ExternalIcon className="h-5 w-5 shrink-0" />
            <span>Siteye Dön</span>
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold text-brand-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogoutIcon className="h-5 w-5 shrink-0" />
              <span>Çıkış Yap</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
