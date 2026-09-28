import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { LeadsInbox } from "@/components/panel/LeadsInbox";

export const metadata: Metadata = { title: "Başvurular — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

/** Yönetici paneli görünümü — koçun `/personel/basvurular` ekranıyla aynı liste. */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  return (
    <LeadsInbox
      organizationId={membership.organizationId}
      isAdmin
      basePath="/yonetim/basvurular"
      status={durum}
    />
  );
}
