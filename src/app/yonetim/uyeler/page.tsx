import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { organizationScope } from "@/lib/auth/scope";
import { getMembershipBreakdown } from "@/lib/queries/staff";
import { listPendingInvites } from "@/lib/queries/invites";
import { getMembershipOverview } from "@/lib/queries/memberships";
import { listCoaches } from "@/lib/queries/admin";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { CoachAssign } from "./CoachAssign";
import {
  rowNameLinkClass,
  secondaryButtonClass,
} from "@/components/panel/form";

export const metadata: Metadata = { title: "Sporcular — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  lead: "Aday",
  inactive: "Pasif",
  blocked: "Engelli",
};

export default async function AdminMembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);
  // Yönetici salonun tamamını görür.
  const scope = organizationScope(membership.organizationId);

  const [breakdown, pendingInvites, overview, coaches] = await Promise.all([
    getMembershipBreakdown(scope),
    listPendingInvites(scope),
    getMembershipOverview(scope),
    listCoaches(membership.organizationId),
  ]);

  const coachOptions = coaches.map((coach) => ({
    userId: coach.userId,
    displayName: coach.displayName,
  }));
  const withoutCoach = breakdown.members.filter((row) => !row.coachUserId);

  const withoutAccount = new Set(pendingInvites.map((row) => row.memberId));
  const activeSubscriptionMembers = new Set(
    overview.subscriptions
      .filter((row) => row.effectiveStatus === "aktif")
      .map((row) => row.memberId),
  );

  const withoutMembership = breakdown.members.filter(
    (row) => row.status === "active" && !activeSubscriptionMembers.has(row.id),
  );

  return (
    <PanelPage
      title="Sporcular"
      description="Salon geneli sporcu listesi: hesap durumu, üyelik durumu, sorumlu antrenör ve sessizleşenler. Antrenör kendi panelinde yalnız kendi sporcusunu görür — devir buradan yapılır."
      action={
        <Link href="/personel/uyeler" className={secondaryButtonClass}>
          Sporcu Ekle →
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Kayıt" value={breakdown.total} />
        <StatCard
          label="Hesapsız"
          value={withoutAccount.size}
          highlight={withoutAccount.size > 0}
          hint="Davet bekliyor"
        />
        <StatCard
          label="Üyeliksiz Aktif"
          value={withoutMembership.length}
          highlight={withoutMembership.length > 0}
          hint="Rezervasyon yapamaz"
        />
        <StatCard
          label="Antrenörsüz"
          value={withoutCoach.length}
          highlight={withoutCoach.length > 0}
          hint="Hiçbir antrenör panelinde görünmez"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="30 Gün Sessiz"
          value={breakdown.dormant.length}
          highlight={breakdown.dormant.length > 0}
        />
        {coaches.map((coach) => (
          <StatCard
            key={coach.userId}
            label={coach.displayName}
            value={coach.memberCount}
            suffix="sporcu"
            hint="Sorumlu olduğu"
          />
        ))}
      </div>

      <PanelCard title="Kayıt Durumu">
        <div className="flex flex-wrap gap-2">
          {breakdown.byStatus.map((row) => (
            <Pill key={row.status}>
              {STATUS_LABEL[row.status] ?? row.status}: {row.count}
            </Pill>
          ))}
        </div>
      </PanelCard>

      {withoutMembership.length > 0 && (
        <PanelCard
          title={`Aktif Ama Üyeliksiz (${withoutMembership.length})`}
          description="Kaydı aktif görünüyor ama yürürlükte paketi yok — bu sporcular ders rezervasyonu yapamaz."
          action={
            <Link href="/personel/uyelikler" className={secondaryButtonClass}>
              Üyelik Başlat
            </Link>
          }
        >
          <ul className="divide-y divide-brand-border">
            {withoutMembership.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Link
                  href={`/personel/uyeler/${row.id}`}
                  className={rowNameLinkClass}
                >
                  {row.fullName}
                  <span className="ml-2 text-xs text-brand-muted">
                    {row.memberNo}
                  </span>
                </Link>
                <span className="text-xs text-brand-muted">
                  {row.lastTrainingAt
                    ? `son antrenman ${formatDateTR(row.lastTrainingAt)}`
                    : "hiç antrenman kaydı yok"}
                </span>
              </li>
            ))}
          </ul>
        </PanelCard>
      )}

      {withoutAccount.size > 0 && (
        <PanelCard
          title={`Hesabını Kurmayanlar (${withoutAccount.size})`}
          description="Bu sporculara bildirim ve ders hatırlatması gitmez."
          action={
            <Link href="/personel/davetler" className={secondaryButtonClass}>
              Davetleri Yönet
            </Link>
          }
        >
          <ul className="divide-y divide-brand-border">
            {pendingInvites.map((row) => (
              <li
                key={row.memberId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <span className="text-sm font-semibold text-brand-white">
                    {row.fullName}
                  </span>
                  <span className="ml-2 text-xs text-brand-muted">
                    {row.email}
                  </span>
                </div>
                {row.neverInvited ? (
                  <Pill tone="danger">Davet yok</Pill>
                ) : row.expired ? (
                  <Pill tone="danger">Süresi doldu</Pill>
                ) : (
                  <Pill tone="yellow">Bekliyor</Pill>
                )}
              </li>
            ))}
          </ul>
        </PanelCard>
      )}

      <PanelCard title={`Tüm Sporcular (${breakdown.members.length})`}>
        {breakdown.members.length === 0 ? (
          <EmptyState>Henüz sporcu kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {breakdown.members.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/personel/uyeler/${row.id}`}
                    className={rowNameLinkClass}
                  >
                    {row.fullName}
                    <span className="ml-2 text-xs text-brand-muted">
                      {row.memberNo}
                    </span>
                  </Link>
                  <div className="mt-1 text-xs text-brand-muted">
                    Kayıt {formatDateTR(row.createdAt)}
                    {row.lastTrainingAt
                      ? ` · son antrenman ${formatDateTR(row.lastTrainingAt)}`
                      : " · antrenman kaydı yok"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CoachAssign
                    memberId={row.id}
                    currentCoachUserId={row.coachUserId}
                    coaches={coachOptions}
                  />
                  {withoutAccount.has(row.id) && <Pill tone="danger">Hesapsız</Pill>}
                  {activeSubscriptionMembers.has(row.id) && (
                    <Pill tone="yellow">Üyelik var</Pill>
                  )}
                  <Pill>{STATUS_LABEL[row.status] ?? row.status}</Pill>
                  <Link
                    href={`/personel/uyeler/${row.id}/analiz`}
                    className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-muted transition-colors hover:text-brand-yellow"
                  >
                    Analiz
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
