"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  mobileTabsForRole,
  sectionForPath,
  sectionsForRole,
  type PanelRole,
} from "@/config/panel-nav";
import { enabledFeatureFlags } from "@/config/feature-flags";

/**
 * Mobil alt navigasyon — yan menüyle AYNI config'ten türer, `mobileOrder`
 * alanı olan satırlar buraya düşer.
 */
export function PanelTabBar({
  role,
  badges,
}: {
  role: PanelRole;
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const items = mobileTabsForRole(role, enabledFeatureFlags());
  const active = sectionForPath(sectionsForRole(role, enabledFeatureFlags()), pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-brand-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="flex">
        {items.map((item) => {
          const isActive = active?.id === item.id;
          const Icon = item.icon;
          const count = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem] font-bold uppercase tracking-wide transition-colors ${
                  isActive ? "text-brand-yellow" : "text-brand-muted"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-x-4 top-0 h-0.5 bg-brand-yellow" />
                )}
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-yellow px-1 text-[0.55rem] font-bold leading-4 text-brand-black">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
