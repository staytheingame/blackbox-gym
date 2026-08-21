import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getMemberRankState } from "@/lib/queries/ranks";
import { REQUIREMENT_KIND_LABEL } from "@/domain/rank/progress";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { RequirementToggle, RevokeRankButton } from "../RequirementButtons";
import { AwardRankForm } from "./AwardRankForm";

export const metadata: Metadata = { title: "Sporcu Kuşağı — BlackBox Panel" };

export default async function StaffMemberRankPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const state = await getMemberRankState(memberId, membership.organizationId);
  if (!state) notFound();

  const { progress, nextRank } = state;

  return (
    <PanelPage
      title={`${state.memberName} — Kuşak`}
      description={`${state.memberNo} · ${state.currentRank ? `Güncel kuşak: ${state.currentRank.name}` : "Henüz kuşağı yok"}`}
      action={
        <Link
          href="/personel/kusaklar"
          className="rounded-sm border border-brand-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
        >
          Kuşak listesi
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Güncel Kuşak"
          value={state.currentRank?.name ?? "—"}
          hint={
            state.lastAwardAt
              ? `Son terfi ${formatDateTR(state.lastAwardAt)}`
              : "Terfi kaydı yok"
          }
        />
        <StatCard label="Hedef" value={nextRank?.name ?? "Merdivenin sonu"} />
        <StatCard
          label="Katıldığı Ders"
          value={state.attendedSessions}
          hint={
            nextRank ? `Gereken: ${nextRank.minSessions}` : "Sayaç durdu"
          }
        />
        <StatCard
          label="İlerleme"
          value={progress ? `%${progress.percent}` : "—"}
          highlight={progress?.ready ?? false}
          hint={progress?.ready ? "Terfiye hazır" : progress?.missing.join(" · ")}
        />
      </div>

      {!nextRank ? (
        <PanelCard title="Merdivenin sonu">
          <p className="text-sm text-brand-muted">
            {state.memberName} tanımlı en yüksek kuşakta. Yeni bir basamak
            eklemek için{" "}
            <Link
              href="/personel/kusaklar"
              className="text-brand-yellow underline"
            >
              kuşak merdivenine
            </Link>{" "}
            git.
          </p>
        </PanelCard>
      ) : (
        <>
          <PanelCard
            title={`${nextRank.name} — Müfredat`}
            description="Maddeye dokunarak işaretle; işaret geri alınabilir, kayıt antrenör adına düşer."
          >
            {state.requirements.length === 0 ? (
              <EmptyState>
                Bu kuşağın müfredatı boş. Kuşak merdiveni ekranından madde
                ekleyebilirsin — madde yoksa yalnız ders ve süre kapıları sayılır.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {state.requirements.map((requirement) => (
                  <li key={requirement.id}>
                    <RequirementToggle
                      memberId={state.memberId}
                      requirementId={requirement.id}
                      done={requirement.done}
                      label={requirement.label}
                      kindLabel={REQUIREMENT_KIND_LABEL[requirement.kind]}
                    />
                    {requirement.done && requirement.checkedAt && (
                      <p className="mt-1 pl-8 text-xs text-brand-muted">
                        {formatDateTR(requirement.checkedAt)} tarihinde işaretlendi
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>

          {progress && (
            <PanelCard
              title="Terfi Kapıları"
              description="Üçü ayrı okunur; tek bir puana indirgenmez."
            >
              <ul className="space-y-3">
                <li className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-brand-white">Müfredat</span>
                  <span className="flex items-center gap-3">
                    <span className="text-brand-muted">
                      {progress.requirementsDone}/{progress.requirementsTotal}
                    </span>
                    <Pill tone={progress.requirementsMet ? "yellow" : "neutral"}>
                      {progress.requirementsMet ? "Tamam" : "Eksik"}
                    </Pill>
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-brand-white">Ders sayısı</span>
                  <span className="flex items-center gap-3">
                    <span className="text-brand-muted">
                      {progress.sessionsDone}/{progress.sessionsNeeded}
                    </span>
                    <Pill tone={progress.sessionsMet ? "yellow" : "neutral"}>
                      {progress.sessionsMet ? "Tamam" : "Eksik"}
                    </Pill>
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-brand-white">Süre</span>
                  <span className="flex items-center gap-3">
                    <span className="text-brand-muted">
                      {progress.weeksDone}/{progress.weeksNeeded} hafta
                    </span>
                    <Pill tone={progress.weeksMet ? "yellow" : "neutral"}>
                      {progress.weeksMet ? "Tamam" : "Eksik"}
                    </Pill>
                  </span>
                </li>
              </ul>
            </PanelCard>
          )}

          <PanelCard
            title="Terfi Ver"
            description={`${state.memberName} → ${nextRank.name}`}
          >
            <AwardRankForm
              memberId={state.memberId}
              rankId={nextRank.id}
              rankName={nextRank.name}
              ready={progress?.ready ?? false}
            />
          </PanelCard>
        </>
      )}

      <PanelCard title={`Terfi Geçmişi (${state.history.length})`}>
        {state.history.length === 0 ? (
          <EmptyState>Henüz terfi kaydı yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {state.history.map((award) => (
              <li
                key={award.rankId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-block h-6 w-6 rounded-sm border border-brand-border"
                    style={{ backgroundColor: award.color }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {award.rankName}
                    </div>
                    <div className="text-xs text-brand-muted">
                      {formatDateTR(award.awardedAt)}
                      {award.note && ` · ${award.note}`}
                    </div>
                  </div>
                </div>
                <RevokeRankButton
                  memberId={state.memberId}
                  rankId={award.rankId}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
