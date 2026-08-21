import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/auth/actions";

export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/personel");

  const membership = await requireOrganizationMembership(user.id).catch(
    () => null,
  );
  if (!membership || membership.role !== "staff") {
    redirect("/uye");
  }

  return (
    <div>
      <div className="border-b border-brand-border bg-brand-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/personel"
            className="text-xs font-bold uppercase tracking-wide text-brand-muted hover:text-brand-yellow"
          >
            Üyeler
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-brand-muted">{user.displayName}</span>
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
