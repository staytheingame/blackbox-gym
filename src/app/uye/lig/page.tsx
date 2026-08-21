import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getLeaderboard } from "@/lib/queries/performance";
import { EmptyState, PanelCard, PanelPage } from "@/components/panel/ui";

export const metadata: Metadata = {
  title: "Lig — BlackBox Panel",
};

export default async function LeaguePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const membership = await requireOrganizationMembership(user.id);
  const leaderboard = await getLeaderboard(membership.organizationId);
  const myRank = leaderboard.findIndex((e) => e.memberId === member.id);

  return (
    <PanelPage
      title="BlackBox Ligi"
      description="Check-in ve antrenman puanlarına göre salon sıralaması."
    >
      <div className="max-w-2xl">
        <PanelCard
          title="Sıralama"
          description={
            myRank >= 0
              ? `Şu an ${myRank + 1}. sıradasın.`
              : "Puan topladıkça listeye girersin."
          }
        >
          {leaderboard.length === 0 ? (
            <EmptyState>Henüz sıralama yok.</EmptyState>
          ) : (
            <ol className="divide-y divide-brand-border">
              {leaderboard.map((entry, index) => {
                const isMe = entry.memberId === member.id;
                return (
                  <li
                    key={entry.memberId}
                    className={`flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 ${
                      isMe ? "-mx-5 bg-brand-surface-2 px-5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`font-display w-7 text-lg ${
                          index < 3 ? "text-brand-yellow" : "text-brand-muted"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-brand-white">
                          {entry.fullName}
                          {isMe && (
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
                      {entry.points}
                      <span className="ml-1 text-xs text-brand-muted">p</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </PanelCard>
      </div>
    </PanelPage>
  );
}
