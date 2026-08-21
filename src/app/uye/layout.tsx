import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
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
    const membership = await requireOrganizationMembership(user.id).catch(
      () => null,
    );
    redirect(membership?.role === "staff" ? "/personel" : "/giris");
  }

  const badges = await fetchMemberBadges(member.id);

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
