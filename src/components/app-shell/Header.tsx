"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ctaNav, primaryNav, siteConfig } from "@/config/navigation";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-brand-black/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display flex items-center gap-1 text-xl tracking-wide"
          onClick={() => setOpen(false)}
        >
          <span className="text-brand-white">BLACK</span>
          <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">
            BOX
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {primaryNav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-semibold uppercase tracking-wide transition-colors hover:text-brand-yellow ${
                  active ? "text-brand-yellow" : "text-brand-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link
            href={ctaNav.href}
            className="rounded-sm bg-brand-yellow px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
          >
            {ctaNav.label}
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center text-brand-white md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-4 w-6">
            <span
              className={`absolute left-0 h-0.5 w-6 bg-current transition-all ${
                open ? "top-2 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-2 h-0.5 w-6 bg-current transition-opacity ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 h-0.5 w-6 bg-current transition-all ${
                open ? "top-2 -rotate-45" : "top-4"
              }`}
            />
          </span>
        </button>
      </div>

      {open && (
        <nav className="border-t border-brand-border bg-brand-black px-4 pb-6 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {primaryNav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-sm px-2 py-3 text-base font-semibold uppercase tracking-wide ${
                      active
                        ? "text-brand-yellow"
                        : "text-brand-white hover:text-brand-yellow"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-3">
              <Link
                href={ctaNav.href}
                onClick={() => setOpen(false)}
                className="block rounded-sm bg-brand-yellow px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-brand-black"
              >
                {ctaNav.label}
              </Link>
            </li>
          </ul>
        </nav>
      )}
      <span className="sr-only">{siteConfig.name}</span>
    </header>
  );
}
