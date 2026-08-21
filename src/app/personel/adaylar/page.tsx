import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listLeads } from "@/lib/queries/staff";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  Scaffold,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Adaylar — BlackBox Panel" };

export default async function StaffLeadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);
  const leads = await listLeads(scope);

  return (
    <PanelPage
      title="Aday & Deneme Dersi Takibi"
      description="Deneme dersine gelen, henüz üyeliğe geçmemiş kayıtlar."
    >
      <PanelCard title={`Adaylar (${leads.length})`}>
        {leads.length === 0 ? (
          <EmptyState>
            Aday kaydı yok — durumu <code>lead</code> olan sporcular burada
            listelenir.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/personel/uyeler/${lead.id}`}
                  className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {lead.fullName}
                    </div>
                    <div className="text-xs text-brand-muted">
                      {lead.memberNo} · {lead.email ?? "e-posta yok"} ·{" "}
                      {formatDateTR(lead.createdAt)}
                    </div>
                  </div>
                  <Pill>Aday</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <Scaffold
        mirrors="Kong Academy → Koç / Danışanlar → Aranacaklar"
        summary="Adaylar şu an yalnız `Member.status = lead` üzerinden listeleniyor; arama sırası, not ve dönüşüm takibi veri modeliyle gelecek."
        features={[
          "Arama sırası: kim aranacak, kim arandı",
          "Görüşme notu ve sonraki temas tarihi",
          "Deneme dersi planlama",
          "Tek tıkla üyeliğe dönüştürme",
        ]}
        needs={[
          "`Lead` / `LeadFollowUp` tabloları (ya da `Member` üzerinde takip alanları)",
          "Site başvuru formunun bu kuyruğa bağlanması",
          "Dönüşüm oranı raporu",
        ]}
      />
    </PanelPage>
  );
}
