import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { listMembers } from "@/lib/queries/staff";
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
  const members = await listMembers(membership.organizationId);

  return (
    <PanelPage
      title="Üyeler"
      description="Yeni üye ekle, mevcut üyelerin check-in ve antrenman geçmişini incele."
    >
      <PanelCard
        title="Yeni Üye Ekle"
        description="Üye hesabı geçici şifreyle oluşturulur — public kayıt yok."
      >
        <AddMemberForm />
      </PanelCard>

      <PanelCard title={`Üye Listesi (${members.length})`}>
        {members.length === 0 ? (
          <EmptyState>Henüz üye eklenmedi.</EmptyState>
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
                    {member.status !== "active" && (
                      <Pill>{member.status}</Pill>
                    )}
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
