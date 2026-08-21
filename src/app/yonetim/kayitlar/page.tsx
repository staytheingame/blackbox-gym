import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABEL,
  auditActionCounts,
  listAuditLog,
  type AuditAction,
} from "@/lib/queries/audit";
import { formatDateTimeTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";

export const metadata: Metadata = { title: "Denetim Kaydı — BlackBox Yönetim" };

function isAuditAction(value: string | undefined): value is AuditAction {
  return (
    value !== undefined && (AUDIT_ACTIONS as readonly string[]).includes(value)
  );
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ islem?: string }>;
}) {
  const { islem } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const filter = isAuditAction(islem) ? islem : undefined;

  const [rows, counts] = await Promise.all([
    listAuditLog(membership.organizationId, { action: filter, limit: 150 }),
    auditActionCounts(membership.organizationId, { sinceDays: 30 }),
  ]);

  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const actors = new Set(rows.map((row) => row.actorLabel));

  return (
    <PanelPage
      title="Denetim Kaydı"
      description="Salonda yapılan yönetim işlemlerinin dökümü: kim, ne zaman, ne yaptı. Yalnız yazan işlemler düşer — kimin neye baktığı tutulmaz."
      action={
        // Bilinçli olarak `<Link>` değil: `/api/**` bir sayfa değil, indirme
        // ucudur. Link üzerine gelince prefetch atar; bu uç her çağrıldığında
        // CSV üretip denetim kaydı yazdığı için sahte kayıtlar oluşurdu.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/api/export/denetim"
          className="rounded-sm border border-brand-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
        >
          CSV indir
        </a>
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Son 30 Gün" value={total} hint="Kayıtlı işlem" />
        <StatCard label="Listelenen" value={rows.length} hint="En yeni 150" />
        <StatCard label="İşlemi Yapan" value={actors.size} hint="Farklı kişi" />
      </div>

      {counts.length > 0 && (
        <PanelCard
          title="Son 30 Günde Ne Yapıldı"
          description="Başlığa dokunarak listeyi süz."
        >
          <div className="flex flex-wrap gap-2">
            <Link
              href="/yonetim/kayitlar"
              className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === undefined
                  ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow"
                  : "border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
              }`}
            >
              Hepsi ({total})
            </Link>
            {counts.map((row) => (
              <Link
                key={row.action}
                href={`/yonetim/kayitlar?islem=${row.action}`}
                className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === row.action
                    ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow"
                    : "border-brand-border text-brand-muted hover:border-brand-yellow hover:text-brand-yellow"
                }`}
              >
                {row.label} ({row.count})
              </Link>
            ))}
          </div>
        </PanelCard>
      )}

      <PanelCard
        title={
          filter
            ? `${AUDIT_ACTION_LABEL[filter]} (${rows.length})`
            : `Kayıtlar (${rows.length})`
        }
      >
        {rows.length === 0 ? (
          <EmptyState>
            Bu filtreyle kayıt yok. Denetim kaydı yeni açıldıysa, işlemler
            yapıldıkça burada birikecek.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {rows.map((row) => (
              <li key={row.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-brand-white">{row.summary}</div>
                    <div className="mt-0.5 text-xs text-brand-muted">
                      {formatDateTimeTR(row.createdAt)} · {row.actorLabel}
                      {row.entityType && ` · ${row.entityType}`}
                    </div>
                  </div>
                  <Pill>{row.actionLabel}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
