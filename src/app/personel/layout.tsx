import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import { getCurrentUser, getOrganizationMembership } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/roles";
import { staffScopeFor } from "@/lib/auth/scope";
import { fetchStaffBadges } from "@/lib/queries/nav-badges";

export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/personel");

  const membership = await getOrganizationMembership(user.id);
  // Yönetici de antrenör panelini görür — salonun sahibi çoğu zaman ders de
  // veriyor. Ters yön geçerli değil: antrenör /yonetim'e giremez.
  if (!membership || !isStaffRole(membership.role)) {
    redirect("/uye");
  }

  const badges = await fetchStaffBadges(
    staffScopeFor(membership, user.id),
    user.id,
  );

  return (
    <PanelShell
      role="staff"
      user={{ name: user.displayName, subtitle: user.email }}
      badges={badges}
    >
      {children}
    </PanelShell>
  );
}
