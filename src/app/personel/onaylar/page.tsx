import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listWaiverBoard, listWaiverTemplates } from "@/lib/queries/waivers";
import { WAIVER_KIND_LABEL } from "@/domain/waivers/status";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  CreateWaiverForm,
  EditWaiverForm,
  ToggleWaiverButton,
} from "./WaiverForms";

export const metadata: Metadata = { title: "Onaylar — BlackBox Panel" };

export default async function StaffWaiversPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const scope = staffScopeFor(membership, user.id);

  const [templates, board] = await Promise.all([
    listWaiverTemplates(membership.organizationId, { includeInactive: true }),
    listWaiverBoard(scope),
  ]);

  const pending = board.filter((row) => row.pendingCount > 0);
  const withHealthNotes = board.filter((row) => row.healthNotes.length > 0);
  const requiredCount = templates.filter(
    (template) => template.isRequired && template.isActive,
  ).length;

  return (
    <PanelPage
      title="Onam & Sağlık Beyanı"
      description="Sağlık beyanı, sorumluluk reddi, veli izni ve KVKK metni. Metin güncellenip sürümü artınca eski imza silinmez, yalnız 'eski' görünür ve sporcudan yeniden onay istenir."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aktif Form" value={requiredCount} hint="Zorunlu ve açık" />
        <StatCard label="Takipteki Sporcu" value={board.length} />
        <StatCard
          label="İmzası Eksik"
          value={pending.length}
          highlight={pending.length > 0}
          hint="Eksik ya da eski sürüm"
        />
        <StatCard
          label="Sağlık Notu Olan"
          value={withHealthNotes.length}
          highlight={withHealthNotes.length > 0}
          hint="Beyanda 'evet' işaretlenmiş"
        />
      </div>

      {withHealthNotes.length > 0 && (
        <div className="rounded-sm border border-red-400/40 bg-red-400/10 p-5 text-sm text-red-200">
          <strong>Sağlık uyarısı:</strong> aşağıdaki sporcular beyanlarında en
          az bir maddeye &quot;evet&quot; dedi. Ağır yüklenme ve sparring
          kararlarını buna göre ver.
          <ul className="mt-3 space-y-1">
            {withHealthNotes.map((row) => (
              <li key={row.memberId}>
                <span className="font-semibold">{row.memberName}</span> —{" "}
                {row.healthNotes.join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PanelCard
        title={`Sporcu Durumu (${board.length})`}
        description="İmzası eksik olanlar üstte."
      >
        {board.length === 0 ? (
          <EmptyState>Kayıtlı sporcu yok.</EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {[...board]
              .sort((a, b) => b.pendingCount - a.pendingCount)
              .map((row) => (
                <li key={row.memberId}>
                  <Link
                    href={`/personel/uyeler/${row.memberId}`}
                    className="-mx-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-surface-2"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {row.memberName}
                        <span className="ml-2 text-xs text-brand-muted">
                          {row.memberNo}
                        </span>
                      </div>
                      {row.healthNotes.length > 0 && (
                        <div className="mt-0.5 text-xs text-red-300">
                          {row.healthNotes.join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.missingCount > 0 && (
                        <Pill tone="danger">{row.missingCount} eksik</Pill>
                      )}
                      {row.outdatedCount > 0 && (
                        <Pill tone="yellow">{row.outdatedCount} eski</Pill>
                      )}
                      {row.pendingCount === 0 && <Pill>Tamam</Pill>}
                    </div>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title={`Formlar (${templates.length})`}
        description="Sporcunun panelinde imzalayacağı metinler."
      >
        {templates.length === 0 ? (
          <EmptyState>
            Henüz form yok. Aşağıdan sağlık beyanını ekleyerek başla.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {templates.map((template) => (
              <li
                key={template.id}
                className="rounded-sm border border-brand-border bg-brand-surface-2 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {template.title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Pill>{WAIVER_KIND_LABEL[template.kind]}</Pill>
                      <Pill>v{template.version}</Pill>
                      <Pill>{template.signedCount} imza</Pill>
                      {template.isRequired ? (
                        <Pill tone="yellow">Zorunlu</Pill>
                      ) : (
                        <Pill>İsteğe bağlı</Pill>
                      )}
                      {!template.isActive && <Pill tone="danger">Kapalı</Pill>}
                      {template.requiresGuardian && <Pill>Veli isteniyor</Pill>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <EditWaiverForm template={template} />
                    <ToggleWaiverButton
                      templateId={template.id}
                      isActive={template.isActive}
                    />
                  </div>
                </div>

                {template.questions.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-brand-border pt-3 text-xs text-brand-muted">
                    {template.questions.map((question) => (
                      <li key={question}>· {question}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="Yeni Form"
        description="Metni buraya yaz; sporcu panelinde okuyup adını yazarak onaylar."
      >
        <CreateWaiverForm />
      </PanelCard>
    </PanelPage>
  );
}
