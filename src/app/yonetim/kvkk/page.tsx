import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  EXPORT_KINDS,
  EXPORT_KIND_HINT,
  EXPORT_KIND_LABEL,
} from "@/lib/export/datasets";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { AnonymizeForm } from "./AnonymizeForm";

export const metadata: Metadata = { title: "Veri & KVKK — BlackBox Yönetim" };

export default async function AdminPrivacyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const members = await prisma.member.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      memberNo: true,
      status: true,
      anonymizedAt: true,
    },
  });

  const active = members.filter((member) => member.anonymizedAt === null);
  const anonymized = members.filter((member) => member.anonymizedAt !== null);

  return (
    <PanelPage
      title="Veri & KVKK"
      description="Salonun defterini Excel'e aktar, bir sporcunun tüm verisini tek dosyada ver, silme talebini yerine getir."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Kayıtlı Sporcu" value={active.length} />
        <StatCard
          label="Anonimleştirilmiş"
          value={anonymized.length}
          hint="Kimlik silindi, sayılar kaldı"
        />
        <StatCard label="Dışa Aktarma Seti" value={EXPORT_KINDS.length} />
      </div>

      <PanelCard
        title="Excel Dışa Aktarma"
        description="Dosyalar Türkçe Excel'e göre üretilir: noktalı virgül ayracı ve BOM. Her indirme denetim kaydına düşer."
      >
        <ul className="divide-y divide-brand-border">
          {EXPORT_KINDS.map((kind) => (
            <li
              key={kind}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-brand-white">
                  {EXPORT_KIND_LABEL[kind]}
                </div>
                <div className="text-xs text-brand-muted">
                  {EXPORT_KIND_HINT[kind]}
                </div>
              </div>
              <a
                href={`/api/export/${kind}`}
                className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
              >
                CSV indir
              </a>
            </li>
          ))}
        </ul>
      </PanelCard>

      <PanelCard
        title="Sporcu Veri Dökümü"
        description="KVKK erişim hakkı: sporcunun tüm kayıtları tek JSON dosyasında. Sporcu bunu kendi panelinden de indirebilir."
      >
        {active.length === 0 ? (
          <EmptyState>Kayıtlı sporcu yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {active.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="text-sm text-brand-white">
                  {member.fullName}
                  <span className="ml-2 text-xs text-brand-muted">
                    {member.memberNo}
                  </span>
                </div>
                <a
                  href={`/api/kvkk/${member.id}`}
                  className="rounded-sm border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
                >
                  JSON indir
                </a>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="Silme Talebi (Anonimleştirme)"
        description="Sporcunun adı, e-postası, telefonu, hesabı, onam imzasındaki kimlik bilgileri ve serbest metin notları silinir. Ders/antrenman sayıları kimliksiz olarak kalır — salonun doluluk geçmişi bozulmasın diye."
      >
        <div className="mb-5 rounded-sm border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">
          <strong>Bu işlem geri alınamaz.</strong> Sporcu bir daha giriş
          yapamaz; kaydı &quot;Anonim &lt;üye no&gt;&quot; olarak görünür.
          Uygulamadan önce dilekçeyi/talebi dosyala ve istersen yukarıdan
          sporcunun veri dökümünü indirip kendisine ver.
        </div>

        <AnonymizeForm members={active} />
      </PanelCard>

      {anonymized.length > 0 && (
        <PanelCard title={`Anonimleştirilmiş Kayıtlar (${anonymized.length})`}>
          <ul className="divide-y divide-brand-border">
            {anonymized.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="text-sm text-brand-white">
                  {member.fullName}
                  <span className="ml-2 text-xs text-brand-muted">
                    {member.memberNo}
                  </span>
                </div>
                <Pill>
                  {member.anonymizedAt
                    ? formatDateTR(member.anonymizedAt)
                    : "—"}
                </Pill>
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
    </PanelPage>
  );
}
