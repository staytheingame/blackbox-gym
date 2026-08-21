import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { listMembers } from "@/lib/queries/staff";
import { AddMemberForm } from "./AddMemberForm";

export const metadata: Metadata = {
  title: "Personel — BlackBox",
};

export default async function StaffMembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const members = await listMembers(membership.organizationId);

  return (
    <div>
      <PageHero
        eyebrow="Personel Paneli"
        title="Üyeler"
        description="Yeni üye ekle, mevcut üyelerin check-in ve antrenman geçmişini incele."
      />
      <section className="mx-auto max-w-5xl space-y-10 px-4 py-14 sm:px-6">
        <div className="rounded-sm border border-brand-border bg-brand-surface p-6">
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Yeni Üye Ekle
          </h2>
          <div className="mt-4">
            <AddMemberForm />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-brand-yellow">
            Üye Listesi ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">
              Henüz üye eklenmedi.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-brand-border rounded-sm border border-brand-border bg-brand-surface">
              {members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/personel/uyeler/${member.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-brand-surface-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {member.fullName}
                      </div>
                      <div className="text-xs text-brand-muted">
                        {member.memberNo} · {member.email}
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                      {member.points} p
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
