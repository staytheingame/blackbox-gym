import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listRankBoard, listRanks } from "@/lib/queries/ranks";
import { REQUIREMENT_KIND_LABEL } from "@/domain/rank/progress";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { AddRequirementForm, CreateRankForm } from "./RankForms";
import { DeleteRequirementButton } from "./RequirementButtons";

export const metadata: Metadata = { title: "Kuşaklar — BlackBox Panel" };

export default async function StaffRanksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);

  const [ladder, board] = await Promise.all([
    listRanks(membership.organizationId),
    listRankBoard(scope),
  ]);

  const ready = board.filter((row) => row.ready);
  const unranked = board.filter((row) => row.currentRankName === null);

  return (
    <PanelPage
      title="Kuşak & Müfredat"
      description="Salonun derece merdiveni, sporcuların ilerlemesi ve terfiye hazır olanlar. Terfiyi sistem vermez — sayaçlar yalnız hazırlığı gösterir, kararı sen imzalarsın."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kuşak Basamağı" value={ladder.length} />
        <StatCard label="Takipteki Sporcu" value={board.length} />
        <StatCard
          label="Terfiye Hazır"
          value={ready.length}
          highlight={ready.length > 0}
          hint="Üç kapı da açık"
        />
        <StatCard
          label="Henüz Kuşaksız"
          value={unranked.length}
          hint="İlk basamağı bekliyor"
        />
      </div>

      {ready.length > 0 && (
        <div className="rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-5 text-sm text-brand-white">
          <strong className="text-brand-yellow">{ready.length} sporcu</strong>{" "}
          bir sonraki kuşağın tüm koşullarını tamamladı:{" "}
          {ready.map((row) => row.memberName).join(", ")}. Kart üzerinden
          değerlendirip terfi verebilirsin.
        </div>
      )}

      <PanelCard
        title={`Sporcu Durumu (${board.length})`}
        description="İlerleme yüzdesi müfredat, ders sayısı ve süre kapılarının ortalamasıdır."
      >
        {board.length === 0 ? (
          <EmptyState>
            Kayıtlı sporcu yok — Sporcular bölümünden ekleyebilirsin.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {board.map((row) => (
              <li key={row.memberId}>
                <Link
                  href={`/personel/kusaklar/${row.memberId}`}
                  className="-mx-5 block px-5 py-3 transition-colors hover:bg-brand-surface-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-block h-8 w-2 rounded-sm border border-brand-border"
                        style={{
                          backgroundColor: row.currentRankColor ?? "transparent",
                        }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-brand-white">
                          {row.memberName}
                          <span className="ml-2 text-xs text-brand-muted">
                            {row.memberNo}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-brand-muted">
                          {row.currentRankName ?? "Kuşaksız"}
                          {row.nextRankName ? ` → ${row.nextRankName}` : " · merdivenin sonu"}
                          {row.missing.length > 0 && ` · eksik: ${row.missing.join(", ")}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-28 rounded-sm bg-brand-surface-2">
                        <div
                          className="h-1.5 rounded-sm bg-brand-yellow"
                          style={{ width: `${row.percent}%` }}
                        />
                      </div>
                      {row.ready ? (
                        <Pill tone="yellow">Terfiye hazır</Pill>
                      ) : (
                        <Pill>%{row.percent}</Pill>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title={`Kuşak Merdiveni (${ladder.length})`}
        description="Sıra kayıt anında belirlenir; yeni kuşak sona eklenir."
      >
        {ladder.length === 0 ? (
          <EmptyState>
            Merdiven boş. Aşağıdaki formdan ilk kuşağı ekle — örneğin
            &quot;Beyaz Kuşak&quot;, 0 ders / 0 hafta.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {ladder.map((rank) => (
              <li
                key={rank.id}
                className="rounded-sm border border-brand-border bg-brand-surface-2 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-block h-6 w-6 rounded-sm border border-brand-border"
                      style={{ backgroundColor: rank.color }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {rank.order + 1}. {rank.name}
                      </div>
                      {rank.summary && (
                        <div className="text-xs text-brand-muted">{rank.summary}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill>{rank.minSessions} ders</Pill>
                    <Pill>{rank.minWeeks} hafta</Pill>
                    <Pill>{rank.awardCount} sporcu</Pill>
                  </div>
                </div>

                {rank.requirements.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-brand-border pt-3">
                    {rank.requirements.map((requirement) => (
                      <li
                        key={requirement.id}
                        className="flex items-center justify-between gap-3 text-sm text-brand-white"
                      >
                        <span>
                          <span className="mr-2 text-xs uppercase tracking-wide text-brand-muted">
                            {REQUIREMENT_KIND_LABEL[requirement.kind]}
                          </span>
                          {requirement.label}
                        </span>
                        <DeleteRequirementButton requirementId={requirement.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <div className="grid gap-8 lg:grid-cols-2">
        <PanelCard
          title="Kuşak Ekle"
          description="Merdivenin sonuna yeni basamak. Ders/hafta eşiği 0 bırakılırsa o kapı aranmaz."
        >
          <CreateRankForm />
        </PanelCard>

        <PanelCard
          title="Müfredat Maddesi Ekle"
          description="Sporcunun o kuşak için göstermesi gereken teknik ya da sınav."
        >
          <AddRequirementForm
            ranks={ladder.map((rank) => ({ id: rank.id, name: rank.name }))}
          />
        </PanelCard>
      </div>
    </PanelPage>
  );
}
