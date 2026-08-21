import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { getMemberInsights, type MemberInsight } from "@/lib/queries/staff";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "İçgörüler — BlackBox Panel" };

const FLAG_LABEL: Record<MemberInsight["flags"][number], string> = {
  "check-in-yok": "Bu hafta check-in yok",
  "antrenman-yok": "14 gündür antrenman yok",
  agri: "Ağrı bildirdi",
  "skor-dusuk": "Skor 50 altı",
};

export default async function StaffInsightsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const insights = await getMemberInsights(membership.organizationId);

  const needsAttention = insights.filter((i) => i.flags.length > 0);
  const inactive = insights.filter((i) => i.flags.includes("antrenman-yok"));
  const soreness = insights.filter((i) => i.sorenessFlag);

  return (
    <PanelPage
      title="Sporcu İçgörüleri"
      description="Kim düşüyor, kim ağrı bildirdi, kim oyundan çıkıyor — aksiyon gerektirenler üstte."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aktif Sporcu" value={insights.length} />
        <StatCard
          label="Aksiyon Gereken"
          value={needsAttention.length}
          highlight={needsAttention.length > 0}
        />
        <StatCard label="14 Gün Sessiz" value={inactive.length} />
        <StatCard label="Ağrı Bildiren" value={soreness.length} />
      </div>

      <PanelCard
        title="Sporcu Durumu"
        description="En çok işaret alan sporcu en üstte"
      >
        {insights.length === 0 ? (
          <EmptyState>Aktif sporcu yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {insights.map((insight) => (
              <li key={insight.id} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={`/personel/uyeler/${insight.id}`}
                  className="flex flex-wrap items-start justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {insight.fullName}
                      <span className="ml-2 text-xs text-brand-muted">
                        {insight.memberNo}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      Skor:{" "}
                      {insight.overallScore === null
                        ? "—"
                        : insight.overallScore}
                      {" · "}
                      Son check-in:{" "}
                      {insight.lastCheckInWeek
                        ? formatDateTR(insight.lastCheckInWeek)
                        : "yok"}
                      {" · "}
                      Son antrenman:{" "}
                      {insight.lastTrainingAt
                        ? formatDateTR(insight.lastTrainingAt)
                        : "yok"}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {insight.flags.length === 0 ? (
                      <Pill tone="yellow">Yolunda</Pill>
                    ) : (
                      insight.flags.map((flag) => (
                        <Pill
                          key={flag}
                          tone={flag === "agri" ? "danger" : "neutral"}
                        >
                          {FLAG_LABEL[flag]}
                        </Pill>
                      ))
                    )}
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
