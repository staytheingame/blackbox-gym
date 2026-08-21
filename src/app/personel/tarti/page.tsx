import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listMemberWeights } from "@/lib/queries/weight";
import { CUT_STATUS_LABEL } from "@/domain/weight/cut";
import { weightClassBySlug } from "@/data/weight-classes";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  StaffWeightEntryForm,
  StaffWeightGoalForm,
} from "./StaffWeightForms";

export const metadata: Metadata = { title: "Tartı — BlackBox Panel" };

/** Bu kadar gündür tartılmayan sporcu "tartı gecikti" sayılır. */
const STALE_DAYS = 10;

export default async function StaffWeightPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);

  const rows = await listMemberWeights(scope, {
    staleDays: STALE_DAYS,
  });

  const atRisk = rows.filter(
    (row) => row.cut?.status === "riskli" || row.cut?.status === "imkansiz",
  );
  const stale = rows.filter((row) => row.isStale);
  const withGoal = rows.filter((row) => row.targetKg !== null);

  const members = rows.map((row) => ({
    id: row.memberId,
    fullName: row.fullName,
    memberNo: row.memberNo,
  }));

  return (
    <PanelPage
      title="Kilo & Tartı Takibi"
      description="Salondaki tüm sporcuların son tartısı, haftalık eğilimi ve sıklete yetişme durumu."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Takipteki Sporcu" value={rows.length} />
        <StatCard
          label="Sıklet Hedefi Olan"
          value={withGoal.length}
          hint="Aktif hedef kaydı"
        />
        <StatCard
          label="Riskli Düşüş"
          value={atRisk.length}
          highlight={atRisk.length > 0}
          hint="Haftalık %1 sınırının üstünde"
        />
        <StatCard
          label="Tartı Gecikti"
          value={stale.length}
          highlight={stale.length > 0}
          hint={`${STALE_DAYS} gündür kayıt yok`}
        />
      </div>

      {atRisk.length > 0 && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          <strong>{atRisk.length} sporcu</strong> güvenli tempoyla sıklete
          yetişemiyor:{" "}
          {atRisk.map((row) => row.fullName).join(", ")}. Hedef tarihi ya da
          hedef kiloyu gözden geçir — hızlı su atma performansı düşürür.
        </div>
      )}

      <PanelCard
        title="Tartı Gir"
        description="Salon tartısından okuduğun değeri sporcu adına kaydet; kayıt sporcunun kendi ekranında da görünür."
      >
        <StaffWeightEntryForm members={members} />
      </PanelCard>

      <PanelCard
        title="Sıklet Hedefi Ata"
        description="Yeni hedef sporcunun önceki hedefini kapatır; geçmiş silinmez."
      >
        <StaffWeightGoalForm members={members} />
      </PanelCard>

      <PanelCard title={`Sporcu Tartıları (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState>
            Henüz sporcu yok — Sporcular bölümünden ekleyebilirsin.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {rows.map((row) => {
              const weightClass = weightClassBySlug(row.weightClass);
              const risky =
                row.cut?.status === "riskli" || row.cut?.status === "imkansiz";

              return (
                <li key={row.memberId}>
                  <Link
                    href={`/personel/uyeler/${row.memberId}`}
                    className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {row.fullName}
                        <span className="ml-2 text-xs text-brand-muted">
                          {row.memberNo}
                        </span>
                      </div>
                      <div className="text-xs text-brand-muted">
                        {row.latestKg !== null
                          ? `${row.latestKg} kg`
                          : "Tartı kaydı yok"}
                        {row.lastTakenAt
                          ? ` · ${formatDateTR(row.lastTakenAt)}`
                          : ""}
                        {row.targetKg !== null
                          ? ` · hedef ${row.targetKg} kg`
                          : ""}
                        {weightClass ? ` · ${weightClass.name}` : ""}
                        {row.fightDate
                          ? ` · ${formatDateTR(row.fightDate)} tartısı`
                          : ""}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {row.trendKgPerWeek !== null && (
                        <Pill
                          title="Son kayıtlara göre haftalık değişim"
                          tone={row.trendKgPerWeek > 0 ? "neutral" : "yellow"}
                        >
                          {row.trendKgPerWeek > 0 ? "+" : ""}
                          {row.trendKgPerWeek} kg/hafta
                        </Pill>
                      )}
                      {row.isStale && <Pill tone="danger">Tartı gecikti</Pill>}
                      {row.cut && (
                        <Pill
                          tone={risky ? "danger" : "neutral"}
                          title={
                            row.cut.requiredWeeklyKg
                              ? `Gereken: ${row.cut.requiredWeeklyKg} kg/hafta · güvenli sınır ${row.cut.safeWeeklyKg} kg`
                              : undefined
                          }
                        >
                          {CUT_STATUS_LABEL[row.cut.status]}
                        </Pill>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
