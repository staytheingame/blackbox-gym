import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { getMemberWaivers } from "@/lib/queries/waivers";
import { WAIVER_KIND_LABEL, WAIVER_STATE_LABEL } from "@/domain/waivers/status";
import { formatDateTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import { SignWaiverForm } from "./SignWaiverForm";

export const metadata: Metadata = { title: "Onaylarım — BlackBox" };

export default async function MemberWaiversPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const waivers = await getMemberWaivers(member.id, membership.organizationId);

  // Tip daraltması: `SignWaiverForm` yalnız imzalanmamış durumları kabul eder.
  const pendingItems = waivers.items.filter(
    (item): item is typeof item & { state: "eksik" | "eski" } =>
      item.state !== "imzali",
  );
  const signedItems = waivers.items.filter((item) => item.state === "imzali");

  return (
    <PanelPage
      title="Onaylarım"
      description="Salonun sağlık beyanı, sorumluluk ve KVKK metinleri. Onayladıkların kayıtlarda durur; metin güncellenirse yeniden onayın istenir."
      action={
        <a
          href={`/api/kvkk/${member.id}`}
          className="rounded-sm border border-brand-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow"
        >
          Verilerimi indir
        </a>
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Toplam Form" value={waivers.items.length} />
        <StatCard
          label="Bekleyen"
          value={waivers.pendingCount}
          highlight={waivers.pendingCount > 0}
          hint={waivers.pendingCount > 0 ? "Onayın gerekiyor" : "Hepsi tamam"}
        />
        <StatCard label="İmzalı" value={signedItems.length} />
      </div>

      {waivers.items.length === 0 && (
        <EmptyState>
          Salon henüz onam formu tanımlamadı — imzalaman gereken bir şey yok.
        </EmptyState>
      )}

      {pendingItems.map((item) => {
        const template = waivers.templates.find(
          (candidate) => candidate.id === item.templateId,
        );
        if (!template) return null;

        return (
          <PanelCard
            key={item.templateId}
            title={item.title}
            description={`${WAIVER_KIND_LABEL[item.kind]} · sürüm ${item.currentVersion}${
              item.isRequired ? " · zorunlu" : " · isteğe bağlı"
            }`}
            action={
              <Pill tone={item.state === "eksik" ? "danger" : "yellow"}>
                {WAIVER_STATE_LABEL[item.state]}
              </Pill>
            }
          >
            <SignWaiverForm
              templateId={template.id}
              title={template.title}
              body={template.body}
              questions={template.questions}
              requiresGuardian={template.requiresGuardian}
              state={item.state}
            />
          </PanelCard>
        );
      })}

      {signedItems.length > 0 && (
        <PanelCard
          title={`Onayladıklarım (${signedItems.length})`}
          description="Hangi metni ne zaman onayladığının dökümü."
        >
          <ul className="divide-y divide-brand-border">
            {signedItems.map((item) => (
              <li
                key={item.templateId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-brand-white">
                    {item.title}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {WAIVER_KIND_LABEL[item.kind]} · sürüm {item.signedVersion}
                    {item.signedAt && ` · ${formatDateTR(item.signedAt)}`}
                  </div>
                </div>
                <Pill tone="yellow">İmzalı</Pill>
              </li>
            ))}
          </ul>
        </PanelCard>
      )}

      <PanelCard
        title="Verilerin"
        description="KVKK kapsamında sistemdeki tüm kayıtlarını indirebilirsin."
      >
        <p className="text-sm leading-relaxed text-brand-muted">
          &quot;Verilerimi indir&quot; düğmesi antrenman, tartı, rezervasyon,
          check-in, beslenme ve onam kayıtlarının tamamını tek bir JSON dosyası
          olarak verir. Kaydının tamamen silinmesini ya da kimliğinin
          anonimleştirilmesini istiyorsan antrenörüne söylemen yeterli.
        </p>
      </PanelCard>
    </PanelPage>
  );
}
