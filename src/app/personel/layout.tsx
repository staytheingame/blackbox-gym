import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { fetchStaffBadges } from "@/lib/queries/nav-badges";

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

  const badges = await fetchStaffBadges(membership.organizationId);

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
