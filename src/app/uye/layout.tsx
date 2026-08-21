import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import {
  getCurrentMember,
  getCurrentUser,
  getOrganizationMembership,
} from "@/lib/auth/guards";
import { homePathForRole } from "@/lib/auth/roles";
import { fetchMemberBadges } from "@/lib/queries/nav-badges";

export default async function MemberLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/uye");

  const member = await getCurrentMember(user.id);
  if (!member) {
    // Personel hesabının üye kaydı yok — giriş ekranına değil kendi paneline.
    const membership = await getOrganizationMembership(user.id);
    redirect(membership ? homePathForRole(membership.role) : "/giris");
  }

  const badges = await fetchMemberBadges(
    member.id,
    user.id,
    member.organizationId,
  );

  return (
    <PanelShell
      role="member"
      user={{ name: member.fullName, subtitle: member.memberNo }}
      badges={badges}
    >
      {children}
    </PanelShell>
  );
}
