import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import { getCurrentUser, getOrganizationMembership } from "@/lib/auth/guards";
import { isAdminRole, isStaffRole } from "@/lib/auth/roles";
import { fetchAdminBadges } from "@/lib/queries/nav-badges";

/**
 * Yönetici paneli — salonun işletme katmanı.
 *
 * Yalnız `admin` rolü girer. Antrenör buraya gelirse kendi paneline
 * yönlendirilir (yetki hatası göstermek yerine; yanlış bağlantıya tıklamış
 * olabilir). Yöneticinin antrenör paneline erişimi ise açıktır.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/yonetim");

  const membership = await getOrganizationMembership(user.id);
  if (!membership) redirect("/giris");

  if (!isAdminRole(membership.role)) {
    redirect(isStaffRole(membership.role) ? "/personel" : "/uye");
  }

  const badges = await fetchAdminBadges(membership.organizationId, user.id);

  return (
    <PanelShell
      role="admin"
      user={{ name: user.displayName, subtitle: user.email }}
      badges={badges}
    >
      {children}
    </PanelShell>
  );
}
