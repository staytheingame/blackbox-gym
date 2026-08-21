import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getCurrentMember, getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { getLeaderboard } from "@/lib/queries/performance";

export const metadata: Metadata = {
  title: "Lig — BlackBox",
};

export default async function LeaguePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const membership = await requireOrganizationMembership(user.id);
  const leaderboard = await getLeaderboard(membership.organizationId);

  return (
    <div>
      <PageHero
        eyebrow="BlackBox Ligi"
        title="Sıralama"
        description="Check-in ve antrenman puanlarına göre salon sıralaması."
      />
      <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <ol className="divide-y divide-brand-border rounded-sm border border-brand-border bg-brand-surface">
          {leaderboard.map((entry, index) => (
            <li
              key={entry.memberId}
              className={`flex items-center justify-between gap-4 px-5 py-4 ${
                entry.memberId === member.id ? "bg-brand-surface-2" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="font-display w-8 text-lg text-brand-yellow">
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {entry.fullName}
                    {entry.memberId === member.id && (
                      <span className="ml-2 text-xs text-brand-yellow">
                        (sen)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {entry.badgeCount} rozet
                  </div>
                </div>
              </div>
              <span className="font-display text-lg text-brand-white">
                {entry.points} p
              </span>
            </li>
          ))}
        </ol>
        {leaderboard.length === 0 && (
          <p className="text-sm text-brand-muted">Henüz sıralama yok.</p>
        )}
      </section>
    </div>
  );
}
