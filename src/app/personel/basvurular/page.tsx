import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { LeadsInbox } from "@/components/panel/LeadsInbox";

export const metadata: Metadata = { title: "Başvurular — BlackBox Panel" };

export const dynamic = "force-dynamic";

export default async function StaffLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);

  return (
    <LeadsInbox
      organizationId={membership.organizationId}
      isAdmin={membership.role === "admin"}
      basePath="/personel/basvurular"
      status={durum}
    />
  );
}
