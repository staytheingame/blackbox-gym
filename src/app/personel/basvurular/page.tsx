import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { absoluteUrl } from "@/lib/app-url";
import { listFunnelLeads, type LeadRow } from "@/lib/queries/funnel";
import {
  CONTACT_CHANNEL_OPTIONS,
  LEAD_STATUS_OPTIONS,
  contactChannelLabel,
  contactTimeLabel,
  forWhomLabel,
  isLeadStatus,
  leadStatusLabel,
  occupationGroupLabel,
  offerLabel,
  toWhatsAppNumber,
} from "@/domain/funnel/lead";
import { dailyLoadLabel, goalLabel, preferredTimeLabel } from "@/domain/registration/answers";
import { formatMinorTR } from "@/domain/finance/money";
import { formatDateTimeTR } from "@/lib/date";
import { EmptyState, PanelCard, PanelPage, Pill, StatCard } from "@/components/panel/ui";
import {
  activeChipClass,
  dangerButtonClass,
  rowButtonClass,
  rowPrimaryButtonClass,
  secondaryButtonClass,
} from "@/components/panel/form";
import { JoinLinkBox } from "@/components/panel/JoinLinkBox";
import { QrCode } from "@/components/panel/QrCode";
import { ConfirmActionButton } from "@/components/panel/ConfirmActionButton";
import { deleteLeadAction, setLeadStatusAction } from "./actions";

export const metadata: Metadata = { title: "Başvurular — BlackBox Panel" };

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "yellow" | "danger"> = {
  yeni: "yellow",
  arandi: "neutral",
  deneme: "neutral",
  "uye-oldu": "neutral",
  olumsuz: "danger",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Tercih edilen kanalın düğmesi vurgulu, diğerleri sönük. */
function ContactButtons({ lead }: { lead: LeadRow }) {
  const whatsapp = toWhatsAppNumber(lead.phone);
  const items = CONTACT_CHANNEL_OPTIONS.map((option) => {
    const preferred = lead.contactChannel === option.value;
    const className = preferred ? rowPrimaryButtonClass : rowButtonClass;

    if (option.value === "whatsapp") {
      if (!whatsapp) return null;
      return (
        <a
          key={option.value}
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          WhatsApp
        </a>
      );
    }
    if (option.value === "telefon") {
      return (
        <a key={option.value} href={`tel:${lead.phone}`} className={className}>
          Ara
        </a>
      );
    }
    return (
      <a
        key={option.value}
        href={`mailto:${lead.email}?subject=${encodeURIComponent("BlackBox başvurun")}`}
        className={className}
      >
        E-posta
      </a>
    );
  });

  return <div className="flex flex-wrap gap-2">{items}</div>;
}

export default async function StaffFunnelLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);
  const isAdmin = membership.role === "admin";

  const activeStatus = durum && isLeadStatus(durum) ? durum : undefined;
  const [all, funnelUrl] = await Promise.all([
    listFunnelLeads(membership.organizationId),
    absoluteUrl("/basvuru"),
  ]);

  const now = new Date();
  const leads = all?.filter((lead) => !activeStatus || lead.status === activeStatus) ?? [];
  const counts = new Map<string, number>();
  for (const lead of all ?? []) counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1);
  const lastWeek = (all ?? []).filter(
    (lead) => now.getTime() - lead.createdAt.getTime() < WEEK_MS,
  ).length;

  return (
    <PanelPage
      title="Başvurular"
      description="Başvuru sayfasını dolduran adaylar. İlgi, hedef ve tercih ettikleri iletişim yolu burada."
      action={
        <Link href="/basvuru" target="_blank" className={secondaryButtonClass}>
          Sayfayı Aç
        </Link>
      }
    >
      <PanelCard
        title="Başvuru Sayfası"
        description="Bu bağlantıyı Instagram'a, WhatsApp'a ya da reklamlara koy; gelen başvurular aşağıda toplanır."
      >
        <div className="space-y-4">
          <JoinLinkBox
            url={funnelUrl}
            label="Paylaşılacak adres"
            message={`BlackBox başvuru: ${funnelUrl} — üç kısa adımda hedefini yaz, seni arayalım.`}
          />
          <div className="flex flex-wrap items-center gap-4 rounded-sm border border-brand-border bg-brand-black/30 p-4">
            <QrCode value={funnelUrl} size={160} label="Başvuru sayfası QR kodu" />
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                QR kod
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-brand-muted">
                Telefon kamerasıyla okutan başvuru sayfasına gider. Afiş ya da
                broşür için baskıya hazır PNG&apos;yi indir.
              </p>
              <a href="/personel/basvurular/qr" download className={rowButtonClass}>
                QR&apos;ı İndir (PNG)
              </a>
            </div>
          </div>
        </div>
      </PanelCard>

      {all === null ? (
        <PanelCard title="Başvurular">
          <EmptyState>
            Bu ekran veritabanı güncellemesini bekliyor. Yöneticinin verdiği
            kurulum SQL&apos;i çalıştırılınca açılır. O zamana kadar gelen
            başvurular kaybolmaz: yönetici panelindeki Denetim Kaydı&apos;nda
            &quot;Başvuru geldi&quot; satırı olarak durur.
          </EmptyState>
        </PanelCard>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard
              label="Yeni"
              value={counts.get("yeni") ?? 0}
              highlight={(counts.get("yeni") ?? 0) > 0}
              hint="Henüz aranmadı"
            />
            <StatCard label="Son 7 Gün" value={lastWeek} hint="Gelen başvuru" />
            <StatCard label="Toplam" value={all.length} hint="Tüm zamanlar" />
          </div>

          <PanelCard title={`Başvurular (${leads.length})`}>
            <div className="mb-4 flex flex-wrap gap-2">
              <Link
                href="/personel/basvurular"
                className={!activeStatus ? activeChipClass : secondaryButtonClass}
              >
                Tümü ({all.length})
              </Link>
              {LEAD_STATUS_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={`/personel/basvurular?durum=${option.value}`}
                  className={
                    activeStatus === option.value ? activeChipClass : secondaryButtonClass
                  }
                >
                  {option.label} ({counts.get(option.value) ?? 0})
                </Link>
              ))}
            </div>

            {leads.length === 0 ? (
              <EmptyState>
                {all.length === 0
                  ? "Henüz başvuru yok. Yukarıdaki bağlantıyı açıp kendin bir test başvurusu gönderebilirsin."
                  : "Bu durumda başvuru yok."}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-brand-border">
                {leads.map((lead) => (
                  <li key={lead.id} className="space-y-3 py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-brand-white">
                          {lead.fullName}
                          {lead.childName && (
                            <span className="ml-2 text-sm font-normal text-brand-muted">
                              · çocuğu {lead.childName}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-brand-muted">
                          {formatDateTimeTR(lead.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={STATUS_TONE[lead.status] ?? "neutral"}>
                          {leadStatusLabel(lead.status)}
                        </Pill>
                        <Pill tone="yellow">{offerLabel(lead.interest)}</Pill>
                        {lead.quotedPriceMinor !== null && (
                          <Pill>{formatMinorTR(lead.quotedPriceMinor)}</Pill>
                        )}
                      </div>
                    </div>

                    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      {[
                        {
                          label: "Kimin için",
                          value: `${forWhomLabel(lead.forWhom)} · ${lead.age} yaş`,
                        },
                        {
                          label: "Hedefler",
                          value: lead.goals.map(goalLabel).join(", "),
                        },
                        {
                          label: "Tercih",
                          value: [
                            contactChannelLabel(lead.contactChannel),
                            lead.contactTime ? contactTimeLabel(lead.contactTime) : "",
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        },
                        {
                          label: "İletişim",
                          value: `${lead.phone} · ${lead.email}`,
                        },
                        {
                          label: "Meslek / yoğunluk",
                          value: [
                            occupationGroupLabel(lead.occupationGroup),
                            dailyLoadLabel(lead.dailyLoad),
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        },
                        {
                          label: "Saatler",
                          value: lead.preferredTimes.map(preferredTimeLabel).join(", "),
                        },
                      ].map((row) => (
                        <div key={row.label} className="flex items-baseline gap-2">
                          <dt className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-brand-muted">
                            {row.label}
                          </dt>
                          <dd className="min-w-0 break-words text-brand-white">
                            {row.value || <span className="text-brand-muted">—</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {lead.note && (
                      <p className="rounded-sm border border-brand-border bg-brand-black/30 p-3 text-sm leading-relaxed text-brand-white">
                        <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                          Not:{" "}
                        </span>
                        {lead.note}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <ContactButtons lead={lead} />

                      <div className="flex flex-wrap gap-2">
                        {LEAD_STATUS_OPTIONS.filter(
                          (option) => option.value !== lead.status && option.value !== "yeni",
                        ).map((option) => (
                          <form
                            key={option.value}
                            action={setLeadStatusAction.bind(null, lead.id, option.value)}
                          >
                            <button type="submit" className={rowButtonClass}>
                              {option.label}
                            </button>
                          </form>
                        ))}
                        {isAdmin && (
                          <ConfirmActionButton
                            action={deleteLeadAction.bind(null, lead.id)}
                            confirmText={`${lead.fullName} başvurusu kalıcı olarak silinecek. Bu geri alınamaz. Devam edilsin mi?`}
                            className={dangerButtonClass}
                          >
                            Sil
                          </ConfirmActionButton>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </>
      )}
    </PanelPage>
  );
}
