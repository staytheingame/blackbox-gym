import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getMemberRankState, listRanks } from "@/lib/queries/ranks";
import { REQUIREMENT_KIND_LABEL } from "@/domain/rank/progress";
import { techniqueBySlug } from "@/data/techniques";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Kuşağım — BlackBox" };

export default async function MemberRankPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const [state, ladder] = await Promise.all([
    getMemberRankState(member.id, membership.organizationId),
    listRanks(membership.organizationId),
  ]);

  if (!state || ladder.length === 0) {
    return (
      <PanelPage
        title="Kuşağım"
        description="Salonun derece merdiveni ve bir sonraki kuşağa ne kaldığı."
      >
        <EmptyState>
          Salon henüz kuşak sistemi tanımlamadı. Antrenörün merdiveni
          kurduğunda burada görünecek.
        </EmptyState>
      </PanelPage>
    );
  }

  const { progress, nextRank, currentRank } = state;

  return (
    <PanelPage
      title="Kuşağım"
      description="Bir sonraki kuşak için üç şey sayılır: müfredat maddeleri, katıldığın ders sayısı ve son terfiden bu yana geçen süre. Terfiyi antrenörün verir."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Kuşağım"
          value={currentRank?.name ?? "Henüz yok"}
          hint={
            state.lastAwardAt
              ? `Son terfi ${formatDateTR(state.lastAwardAt)}`
              : "İlk kuşağını bekliyorsun"
          }
        />
        <StatCard label="Hedef" value={nextRank?.name ?? "Merdivenin sonu"} />
        <StatCard
          label="Katıldığım Ders"
          value={state.attendedSessions}
          hint={nextRank ? `Gereken: ${nextRank.minSessions}` : undefined}
        />
        <StatCard
          label="İlerleme"
          value={progress ? `%${progress.percent}` : "—"}
          highlight={progress?.ready ?? false}
          hint={
            progress?.ready
              ? "Koşullar tamam — antrenörünle konuş"
              : progress?.missing.join(" · ")
          }
        />
      </div>

      {progress?.ready && (
        <div className="rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-5 text-sm text-brand-white">
          <strong className="text-brand-yellow">Hazırsın.</strong> {nextRank?.name}{" "}
          için gereken her şeyi tamamladın. Terfi kararı antrenörün — bir
          sonraki derste konuş.
        </div>
      )}

      {nextRank && (
        <PanelCard
          title={`${nextRank.name} için müfredat`}
          description="İşaretli maddeler antrenörün onayladıklarıdır."
        >
          {state.requirements.length === 0 ? (
            <EmptyState>
              Bu kuşakta madde yok — yalnız ders sayısı ve süre sayılıyor.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {state.requirements.map((requirement) => {
                const technique = requirement.techniqueSlug
                  ? techniqueBySlug(requirement.techniqueSlug)
                  : undefined;

                return (
                  <li
                    key={requirement.id}
                    className={`flex items-start gap-3 rounded-sm border px-3 py-2.5 ${
                      requirement.done
                        ? "border-brand-yellow/50 bg-brand-yellow/10"
                        : "border-brand-border bg-brand-surface-2"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
                        requirement.done
                          ? "border-brand-yellow bg-brand-yellow text-brand-black"
                          : "border-brand-border text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span>
                      <span className="mr-2 text-xs uppercase tracking-wide text-brand-muted">
                        {REQUIREMENT_KIND_LABEL[requirement.kind]}
                      </span>
                      <span className="text-sm text-brand-white">
                        {requirement.label}
                      </span>
                      {technique && (
                        <Link
                          href="/uye/teknikler"
                          className="ml-2 text-xs text-brand-yellow underline"
                        >
                          {technique.name} çalış
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelCard>
      )}

      <PanelCard
        title="Kuşak Merdiveni"
        description="Salonun tüm basamakları — nerede olduğunu gör."
      >
        <ol className="space-y-2">
          {ladder.map((rank) => {
            const owned = state.history.some((award) => award.rankId === rank.id);
            const isNext = nextRank?.id === rank.id;

            return (
              <li
                key={rank.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-sm border px-4 py-3 ${
                  isNext
                    ? "border-brand-yellow/50 bg-brand-yellow/5"
                    : "border-brand-border bg-brand-surface-2"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-block h-6 w-6 rounded-sm border border-brand-border"
                    style={{ backgroundColor: rank.color }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {rank.name}
                    </div>
                    {rank.summary && (
                      <div className="text-xs text-brand-muted">{rank.summary}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill>{rank.minSessions} ders</Pill>
                  <Pill>{rank.minWeeks} hafta</Pill>
                  {owned && <Pill tone="yellow">Aldın</Pill>}
                  {isNext && <Pill tone="yellow">Sıradaki</Pill>}
                </div>
              </li>
            );
          })}
        </ol>
      </PanelCard>

      {state.history.length > 0 && (
        <PanelCard title="Terfi Geçmişim">
          <ul className="divide-y divide-brand-border">
            {state.history.map((award) => (
              <li key={award.rankId} className="flex items-center gap-3 py-3">
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
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
    </PanelPage>
  );
}
