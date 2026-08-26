import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrganizationMembership } from "@/lib/auth/guards";
import { isOrganizationWide, staffScopeFor } from "@/lib/auth/scope";
import { listMembers } from "@/lib/queries/staff";
import { listCoaches } from "@/lib/queries/admin";
import { getMemberRadarBoard } from "@/lib/queries/radar";
import {
  RADAR_BAND_LABEL,
  type MemberRadar,
  type RadarBand,
} from "@/domain/analysis/member-radar";
import { formatShortDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { AddMemberForm } from "./AddMemberForm";
import {
  MEMBER_SORTS,
  MEMBER_STATUS_LABEL,
  MemberFilters,
  type MemberListQuery,
  type MemberSort,
} from "./MemberFilters";
import { secondaryButtonClass } from "@/components/panel/form";

export const metadata: Metadata = {
  title: "Üyeler — BlackBox Panel",
};

export const dynamic = "force-dynamic";

const BAND_TONE: Record<RadarBand, "neutral" | "yellow" | "danger"> = {
  kritik: "danger",
  izle: "yellow",
  yeni: "neutral",
  yolunda: "neutral",
};

function isSort(value: string | undefined): value is MemberSort {
  return (MEMBER_SORTS as readonly string[]).includes(value ?? "");
}

/** Arama: ad, üye no ve e-posta üzerinde, büyük/küçük harf duyarsız. */
function matchesSearch(
  member: { fullName: string; memberNo: string; email: string | null },
  term: string,
): boolean {
  const needle = term.toLocaleLowerCase("tr-TR");
  return [member.fullName, member.memberNo, member.email ?? ""]
    .join(" ")
    .toLocaleLowerCase("tr-TR")
    .includes(needle);
}

export default async function StaffMembersPage({
  searchParams,
}: {
  searchParams: Promise<MemberListQuery>;
}) {
  const query = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  // Antrenör YALNIZ kendi sporcularını görür; yönetici salonun tamamını.
  const scope = staffScopeFor(membership, user.id);
  const canSeeEveryone = isOrganizationWide(scope);

  const [members, coaches, radarBoard] = await Promise.all([
    listMembers(scope),
    canSeeEveryone ? listCoaches(membership.organizationId) : Promise.resolve([]),
    // Radar yalnız aktif sporcuları tarar; aday/pasif kayıtta "gelmiyor"
    // demek anlamsız olurdu. Liste bu yüzden risk rozetini yalnız aktif
    // sporcularda gösterir.
    getMemberRadarBoard(scope),
  ]);

  const radarByMember = new Map<string, MemberRadar>(
    radarBoard.rows.map((row) => [row.id, row.radar]),
  );
  const lastActivityByMember = new Map(
    radarBoard.rows.map((row) => [row.id, row.lastActivityAt]),
  );

  const statusCounts = new Map<string, number>();
  for (const member of members) {
    statusCounts.set(member.status, (statusCounts.get(member.status) ?? 0) + 1);
  }
  const statuses = [...statusCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  const sort: MemberSort = isSort(query.sirala) ? query.sirala : "risk";

  const filtered = members.filter((member) => {
    if (query.q && !matchesSearch(member, query.q)) return false;
    if (query.durum && member.status !== query.durum) return false;
    if (query.antrenor === "yok" && member.assignedCoachUserId !== null) {
      return false;
    }
    if (
      query.antrenor &&
      query.antrenor !== "yok" &&
      member.assignedCoachUserId !== query.antrenor
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "ad") return a.fullName.localeCompare(b.fullName, "tr-TR");
    if (sort === "yeni") return b.createdAt.getTime() - a.createdAt.getTime();
    // Risk sırası: radarı olmayan (aktif olmayan) kayıt en sona düşer.
    const scoreA = radarByMember.get(a.id)?.riskScore ?? -1;
    const scoreB = radarByMember.get(b.id)?.riskScore ?? -1;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.fullName.localeCompare(b.fullName, "tr-TR");
  });

  const criticalCount = radarBoard.byBand.kritik;

  return (
    <PanelPage
      title="Üyeler"
      description={
        canSeeEveryone
          ? "Salonun tüm sporcuları. Her sporcunun bir sorumlu antrenörü vardır."
          : "Sorumlusu olduğun sporcular. Diğer antrenörlerin sporcuları listede çıkmaz."
      }
      action={
        <Link
          href="/personel/icgoruler"
          className={secondaryButtonClass}
        >
          Takip Radarı →
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Toplam Kayıt" value={members.length} />
        <StatCard
          label="Aktif Sporcu"
          value={radarBoard.total}
          hint="Radarın taradığı"
        />
        <StatCard
          label="Bugün İlgilen"
          value={criticalCount}
          highlight={criticalCount > 0}
          hint="Kritik banttaki sporcu"
        />
      </div>

      <PanelCard
        title="Yeni Üye Ekle"
        description="Sporcu davet bağlantısıyla eklenir — şifresini kendisi belirler."
      >
        <AddMemberForm coaches={coaches} />
      </PanelCard>

      <PanelCard title={`Üye Listesi (${sorted.length})`}>
        <MemberFilters
          query={query}
          statuses={statuses}
          coaches={coaches.map((coach) => ({
            userId: coach.userId,
            displayName: coach.displayName,
          }))}
          resultCount={sorted.length}
          totalCount={members.length}
        />

        <div className="mt-5">
          {sorted.length === 0 ? (
            <EmptyState>
              {members.length === 0
                ? canSeeEveryone
                  ? "Henüz üye eklenmedi."
                  : "Sana atanmış sporcu yok. Eklediğin sporcular otomatik olarak burada görünür."
                : "Bu süzgece uyan sporcu yok."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-brand-border">
              {sorted.map((member) => {
                const radar = radarByMember.get(member.id) ?? null;
                const lastActivityAt =
                  lastActivityByMember.get(member.id) ?? null;

                return (
                  <li key={member.id}>
                    <Link
                      href={`/personel/uyeler/${member.id}`}
                      className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-brand-white">
                          {member.fullName}
                          <span className="ml-2 text-xs text-brand-muted">
                            {member.memberNo}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-brand-muted">
                          {radar
                            ? radar.headline
                            : `${MEMBER_STATUS_LABEL[member.status] ?? member.status} kayıt — radar dışı`}
                        </div>
                        <div className="mt-0.5 text-xs text-brand-muted">
                          Son kayıt{" "}
                          {lastActivityAt
                            ? formatShortDateTR(lastActivityAt)
                            : "yok"}
                          {canSeeEveryone &&
                            ` · ${member.coachName ?? "antrenör atanmadı"}`}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {radar ? (
                          <Pill
                            tone={BAND_TONE[radar.band]}
                            title={`Risk puanı ${radar.riskScore}/100 — ilgilenme sırası`}
                          >
                            {RADAR_BAND_LABEL[radar.band]}
                          </Pill>
                        ) : (
                          <Pill>
                            {MEMBER_STATUS_LABEL[member.status] ?? member.status}
                          </Pill>
                        )}
                        <Pill tone="yellow">{member.points} p</Pill>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PanelCard>
    </PanelPage>
  );
}
