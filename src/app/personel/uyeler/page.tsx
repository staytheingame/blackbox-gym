import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { isOrganizationWide, staffScopeFor } from "@/lib/auth/scope";
import { listMembers } from "@/lib/queries/staff";
import { listCoaches } from "@/lib/queries/admin";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
} from "@/components/panel/ui";
import { AddMemberForm } from "./AddMemberForm";

export const metadata: Metadata = {
  title: "Üyeler — BlackBox Panel",
};

export default async function StaffMembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  // Antrenör YALNIZ kendi sporcularını görür; yönetici salonun tamamını.
  const scope = staffScopeFor(membership, user.id);
  const canSeeEveryone = isOrganizationWide(scope);

  const [members, coaches] = await Promise.all([
    listMembers(scope),
    canSeeEveryone ? listCoaches(membership.organizationId) : Promise.resolve([]),
  ]);

  return (
    <PanelPage
      title="Üyeler"
      description={
        canSeeEveryone
          ? "Salonun tüm sporcuları. Her sporcunun bir sorumlu antrenörü vardır."
          : "Sorumlusu olduğun sporcular. Diğer antrenörlerin sporcuları listede çıkmaz."
      }
    >
      <PanelCard
        title="Yeni Üye Ekle"
        description="Sporcu davet bağlantısıyla eklenir — şifresini kendisi belirler."
      >
        <AddMemberForm coaches={coaches} />
      </PanelCard>

      <PanelCard title={`Üye Listesi (${members.length})`}>
        {members.length === 0 ? (
          <EmptyState>
            {canSeeEveryone
              ? "Henüz üye eklenmedi."
              : "Sana atanmış sporcu yok. Eklediğin sporcular otomatik olarak burada görünür."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {members.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/personel/uyeler/${member.id}`}
                  className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {member.fullName}
                    </div>
                    <div className="text-xs text-brand-muted">
                      {member.memberNo} · {member.email} ·{" "}
                      {formatDateTR(member.createdAt)} tarihinde eklendi
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canSeeEveryone && (
                      <Pill title="Sorumlu antrenör">
                        {member.coachName ?? "Antrenör atanmadı"}
                      </Pill>
                    )}
                    {member.status !== "active" && <Pill>{member.status}</Pill>}
                    <Pill tone="yellow">{member.points} p</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
