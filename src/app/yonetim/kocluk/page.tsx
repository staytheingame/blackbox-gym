import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { getCoachScoreboard } from "@/lib/queries/coaching";
import { ORG_ROLE_LABEL } from "@/lib/auth/roles";
import { formatMinorTR } from "@/domain/finance/money";
import {
  CoachAttentionList,
  CoachStatePill,
} from "@/components/panel/CoachScorecardPanel";
import { PeriodNav, resolvePeriod } from "@/components/panel/PeriodNav";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  rowNameLinkClass,
  secondaryButtonClass,
} from "@/components/panel/form";

export const metadata: Metadata = { title: "Koçluk — BlackBox Yönetim" };

export const dynamic = "force-dynamic";

function percent(value: number | null): string {
  return value === null ? "—" : `%${value}`;
}

/**
 * KOÇLUK TAKİBİ — kadronun işletme görünümü.
 *
 * `Kadro` ekranı "kim var, rolü ne, nasıl kazanıyor" sorusuna bakar;
 * `Hakediş` ekranı paraya. Burası üçüncüsü: **iş nasıl yürüyor**.
 * Yoklama ve kontrol kuyrukları, doluluk, portföyün radar dağılımı.
 *
 * Bilinçli sınır: bu ekran antrenörü notlandırmaz, birikmiş işi gösterir
 * (bkz. `domain/coaching/coach-scorecard.ts` baş yorumu).
 */
export default async function AdminCoachingPage({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; kayma?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  const { period, kind, offset } = resolvePeriod(await searchParams);
  const board = await getCoachScoreboard(membership.organizationId, period);

  const active = board.rows.filter((row) => row.isActive);
  const needsHelp = active.filter((row) => row.scorecard.state !== "temiz");
  const sessionsTotal = board.rows.reduce(
    (total, row) => total + row.sessionsHeld,
    0,
  );
  const collectedTotal = board.rows.reduce(
    (total, row) => total + row.collectedMinor,
    0,
  );

  return (
    <PanelPage
      title="Koçluk"
      description="Kadronun iş görünümü: kim kaç ders verdi, masasında ne birikti, sorumlu olduğu sporcular ne durumda. Bu ekran antrenörü notlandırmaz — bekleyen işi ve yardım gereken yeri gösterir."
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/yonetim/kadro" className={secondaryButtonClass}>
            Kadro & Hakediş Ayarı
          </Link>
          <Link href="/yonetim/muhasebe/hakedis" className={secondaryButtonClass}>
            Hakediş
          </Link>
        </div>
      }
    >
      <PeriodNav
        basePath="/yonetim/kocluk"
        kind={kind}
        offset={offset}
        period={period}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Aktif Antrenör"
          value={active.length}
          hint={`${board.rows.length - active.length} kapalı hesap`}
        />
        <StatCard
          label="Verilen Ders"
          value={sessionsTotal}
          hint={period.label}
        />
        <StatCard
          label="Yoklama Bekleyen"
          value={board.totalAttendanceBacklog}
          highlight={board.totalAttendanceBacklog > 0}
          hint="Salon geneli birikmiş"
        />
        <StatCard
          label="Kontrol Bekleyen"
          value={board.totalCheckInBacklog}
          highlight={board.totalCheckInBacklog > 0}
          hint="İncelenmemiş kontrol"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Yardım Gereken"
          value={needsHelp.length}
          highlight={needsHelp.length > 0}
          hint="Masasında iş birikmiş antrenör"
        />
        <StatCard
          label="Antrenörsüz Sporcu"
          value={board.unassignedMembers}
          highlight={board.unassignedMembers > 0}
          hint="Hiçbir panelde görünmüyor"
        />
        <StatCard
          label="Antrenör Başına"
          value={board.balance.average}
          suffix="sporcu"
          hint={`En çok ${board.balance.max} · en az ${board.balance.min}`}
        />
        <StatCard
          label="Sporculardan Tahsilat"
          value={formatMinorTR(collectedTotal)}
          hint={period.label}
        />
      </div>

      {board.balance.spread >= 1 && active.length > 1 && (
        <div className="rounded-sm border border-brand-yellow/40 bg-brand-yellow/10 p-5 text-sm text-brand-yellow">
          <strong>Yük dengesiz.</strong> En kalabalık portföy{" "}
          {board.balance.max} sporcu, en küçüğü {board.balance.min}. Yeni
          sporcuları atarken bunu gözet — devir{" "}
          <Link href="/yonetim/uyeler" className="underline">
            Sporcular
          </Link>{" "}
          ekranından yapılır.
        </div>
      )}

      {board.unassignedMembers > 0 && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          <strong>{board.unassignedMembers} sporcunun antrenörü yok.</strong> Bu
          sporcular hiçbir antrenörün panelinde görünmez; kontrolleri de
          kimsenin kuyruğuna düşmez.{" "}
          <Link href="/yonetim/uyeler" className="underline">
            Antrenör ata
          </Link>
          .
        </div>
      )}

      <PanelCard
        title={`Kadro (${board.rows.length})`}
        description="Masasında iş birikmiş antrenör üstte. Satıra tıklayınca o antrenörün karnesi ve sporcuları açılır."
      >
        {board.rows.length === 0 ? (
          <EmptyState>
            Kadro kaydı yok — önce Kadro ekranından antrenör ekle.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {board.rows.map((row) => (
              <li key={row.coachUserId} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/yonetim/kocluk/${row.coachUserId}`}
                      className={rowNameLinkClass}
                    >
                      {row.displayName}
                    </Link>
                    <div className="mt-1 text-xs text-brand-muted">
                      {row.email} · {ORG_ROLE_LABEL[row.role]}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {row.sessionsHeld} ders · doluluk{" "}
                      {percent(row.scorecard.fillRate)} · gelme{" "}
                      {percent(row.scorecard.showRate)} · {row.portfolio} sporcu
                      {row.upcomingSlots > 0 &&
                        ` · ${row.upcomingSlots} yaklaşan seans`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {!row.isActive && <Pill tone="danger">Kapalı hesap</Pill>}
                    {row.criticalMembers > 0 && (
                      <Pill tone="danger">
                        {row.criticalMembers} kritik sporcu
                      </Pill>
                    )}
                    {row.attendanceBacklog > 0 && (
                      <Pill tone="yellow">
                        {row.attendanceBacklog} yoklama
                      </Pill>
                    )}
                    {row.checkInBacklog > 0 && (
                      <Pill tone="yellow">{row.checkInBacklog} kontrol</Pill>
                    )}
                    <CoachStatePill state={row.scorecard.state} />
                  </div>
                </div>

                {row.scorecard.attention.length > 0 && (
                  <div className="mt-3">
                    <CoachAttentionList
                      items={row.scorecard.attention.slice(0, 2)}
                    />
                    {row.scorecard.attention.length > 2 && (
                      <Link
                        href={`/yonetim/kocluk/${row.coachUserId}`}
                        className="mt-2 inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wide text-brand-yellow hover:text-brand-white sm:min-h-0"
                      >
                        +{row.scorecard.attention.length - 2} madde daha →
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <p className="text-xs leading-relaxed text-brand-muted">
        Doluluk ve gelme oranı antrenörün tek başına belirlediği sayılar
        değildir — saat, sporcunun işi ve mevsim etkiler. Düşük oran bir
        başarısızlık değil, birlikte konuşulacak bir konudur. Oranlar yeterli
        veri yoksa &quot;—&quot; gösterilir; sahte kesinlik üretilmez.
      </p>
    </PanelPage>
  );
}
