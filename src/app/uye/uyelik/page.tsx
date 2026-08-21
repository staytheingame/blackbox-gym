import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember, getCurrentUser } from "@/lib/auth/guards";
import { getMembershipCredits } from "@/lib/queries/slots";
import { listMemberSubscriptions } from "@/lib/queries/memberships";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Üyeliğim — BlackBox Panel" };

const STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  bitti: "Bitti",
  donduruldu: "Donduruldu",
  iptal: "İptal",
};

export default async function MemberMembershipPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const [credits, history] = await Promise.all([
    getMembershipCredits(member.id),
    listMemberSubscriptions(member.id),
  ]);

  const usedPercent =
    credits && !credits.unlimited && credits.total
      ? Math.min(Math.round((credits.used / credits.total) * 100), 100)
      : null;

  return (
    <PanelPage
      title="Üyelik & Ders Hakkım"
      description="Üyeliğin ne zamana kadar geçerli ve kaç dersin kaldı."
      action={
        <Link
          href="/uye/program"
          className="rounded-sm bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
        >
          Ders Al
        </Link>
      }
    >
      {credits ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Paket" value={credits.planName} />
            <StatCard
              label="Kalan Gün"
              value={credits.daysLeft}
              highlight={credits.daysLeft <= 14}
              hint={`${formatDateTR(credits.endDate)} bitiyor`}
            />
            <StatCard
              label="Kalan Ders"
              value={credits.unlimited ? "Sınırsız" : (credits.remaining ?? 0)}
              highlight={credits.remaining === 0}
              hint={
                credits.unlimited
                  ? "Süre boyunca serbest"
                  : `${credits.total} derslik paket`
              }
            />
            <StatCard
              label="Rezerve"
              value={credits.reserved}
              hint="İleri tarihli derslerin"
            />
          </div>

          {usedPercent !== null && (
            <PanelCard
              title="Paket Kullanımı"
              description={`${credits.used} ders kullanıldı, ${credits.reserved} ders rezerve edildi.`}
            >
              <div
                className="h-3 w-full overflow-hidden rounded-sm border border-brand-border bg-brand-black"
                role="img"
                aria-label={`Paketin %${usedPercent} kullanıldı`}
              >
                <div
                  className="h-full bg-brand-yellow"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-brand-muted">
                Ders hakkı yoklama alınınca düşer. Gelmediğin ders de hakkını
                yakar; seanstan önce iptal edersen hakkın geri döner.
              </p>
            </PanelCard>
          )}
        </>
      ) : (
        <PanelCard title="Üyelik">
          <EmptyState>
            Yürürlükte üyeliğin yok. Antrenörünle konuş — üyeliğin
            başlatıldığında ders alabilirsin.
          </EmptyState>
        </PanelCard>
      )}

      <PanelCard title={`Üyelik Geçmişi (${history.length})`}>
        {history.length === 0 ? (
          <EmptyState>Henüz üyelik kaydın yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {row.planName}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {formatDateTR(row.startDate)} – {formatDateTR(row.endDate)}
                    {row.sessionsTotal
                      ? ` · ${row.sessionsTotal} ders`
                      : " · sınırsız"}
                  </div>
                </div>
                <Pill tone={row.status === "aktif" ? "yellow" : "neutral"}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
