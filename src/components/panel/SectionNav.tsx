"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  sectionForPath,
  sectionsForRole,
  splitHref,
  type PanelRole,
} from "@/config/panel-nav";
import { enabledFeatureFlags } from "@/config/feature-flags";

/**
 * Bulunduğun bölümün alt sayfaları — başlığın hemen altında yatay şerit
 * (Kong Academy'nin `SectionNav`'ı). Yan menü kısa kalır ama hiçbir sayfa
 * erişilemez hâle gelmez.
 *
 * Şerit hedefleri sorgu dizesi taşıyabilir (`/personel/akademi?tab=odevler`):
 * aynı sayfanın sekmeleri de şeritte görünür. Aktiflik önce yola, sonra sorgu
 * anahtarına bakar; sorgu yoksa o yoldaki İLK kardeş aktif sayılır.
 */
export function SectionNav({ role }: { role: PanelRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sections = sectionsForRole(role, enabledFeatureFlags());
  const section = sectionForPath(sections, pathname);
  const children = section?.children ?? [];

  // Tek sayfalık bölümde (Genel Bakış, Ayarlar…) şeridin anlamı yok.
  if (children.length < 2) return null;

  // Kayıt detayına girildiğinde (/personel/uyeler/123) hiçbiri tam eşleşmez;
  // şerit gizlenir — o sayfaların kendi sekmeleri var.
  const onThisPath = children.filter(
    (child) => splitHref(child.href).path === pathname,
  );
  if (onThisPath.length === 0) return null;

  const matched = onThisPath.find((child) => {
    const { query } = splitHref(child.href);
    if (!query) return false;
    const [key, value] = query.split("=");
    return searchParams.get(key) === value;
  });

  const activeId = (matched ?? onThisPath[0]).id;

  return (
    <nav
      aria-label={`${section?.label} bölümü`}
      className="border-b border-brand-border bg-brand-black"
    >
      <div className="mx-auto max-w-5xl overflow-x-auto px-4 sm:px-6">
        <div className="flex gap-2 py-3">
          {children.map((child) => {
            const active = child.id === activeId;
            return (
              <Link
                key={child.id}
                href={child.href}
                title={child.title ?? child.label}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? "border-brand-yellow bg-brand-yellow text-brand-black"
                    : "border-brand-border text-brand-muted hover:border-brand-yellow/40 hover:text-brand-white"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
