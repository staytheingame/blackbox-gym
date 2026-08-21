import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";

const navItems = [
  { href: "/uye", label: "Özet" },
  { href: "/uye/check-in", label: "Check-in" },
  { href: "/uye/antrenman", label: "Antrenman" },
  { href: "/uye/performans", label: "Performans" },
  { href: "/uye/lig", label: "Lig" },
];

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/uye");

  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  return (
    <div>
      <div className="border-b border-brand-border bg-brand-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <nav className="flex flex-wrap gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs font-bold uppercase tracking-wide text-brand-muted hover:text-brand-yellow"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-xs text-brand-muted">{member.fullName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs font-bold uppercase tracking-wide text-brand-muted hover:text-brand-yellow"
              >
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
