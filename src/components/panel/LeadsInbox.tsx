import Link from "next/link";
import { absoluteUrl } from "@/lib/app-url";
import { listFunnelLeads, type LeadRow } from "@/lib/queries/funnel";
import { listStartLeads, type StartLeadRow } from "@/lib/queries/start-leads";
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
import { describeStartAnswers } from "@/domain/funnel/start";
import {
  dailyLoadLabel,
  goalLabel,
  preferredTimeLabel,
} from "@/domain/registration/answers";
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
import {
  deleteLeadAction,
  setLeadStatusAction,
} from "@/app/personel/basvurular/actions";

/**
 * BAŞVURULAR — iki formdan gelen adaylar tek listede: "Sana Uygun Başlangıcı
 * Bulalım" (`/baslangic`) ve seçenek/şart sorulan ilk form (`/basvuru`).
 * Koç (`/personel/basvurular`) ve yönetici (`/yonetim/basvurular`) aynı
 * bileşeni kullanır; yalnız bağlantı tabanı ve silme yetkisi değişir.
 *
 * Bir kaynağın tablosu henüz yoksa (`null`) o kaynak atlanır, diğeri çalışır.
 */

type InboxLead =
  | { kind: "baslangic"; createdAt: Date; row: StartLeadRow }
  | { kind: "basvuru"; createdAt: Date; row: LeadRow };

const FORMS = [
  {
    kind: "baslangic",
    path: "/baslangic",
    title: "Sana Uygun Başlangıcı Bulalım",
    description:
      "Sekiz soruluk tanışma formu: hedef, engel, spor geçmişi, günlük yoğunluk, uygun zamanlar ve iletişim.",
    message: (url: string) =>
      `BlackBox — Sana uygun başlangıcı bulalım: ${url} — yaklaşık 1 dakika sürer.`,
  },
  {
    kind: "basvuru",
    path: "/basvuru",
    title: "Başvuru (birebir / grup)",
    description:
      "Kimin için, birebir 12 ya da 24 ders ya da grup bilgisi seçilen ilk form.",
    message: (url: string) =>
      `BlackBox başvuru: ${url} — üç kısa adımda hedefini yaz, seni arayalım.`,
  },
] as const;

const STATUS_TONE: Record<string, "neutral" | "yellow" | "danger"> = {
  yeni: "yellow",
  arandi: "neutral",
  deneme: "neutral",
  "uye-oldu": "neutral",
  olumsuz: "danger",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Tercih edilen kanal varsa o düğme vurgulu; yoksa WhatsApp vurgulu. */
function ContactButtons({
  phone,
  email,
  preferred,
}: {
  phone: string;
  email: string;
  preferred: string | null;
}) {
  const whatsapp = toWhatsAppNumber(phone);
  const primary = preferred ?? "whatsapp";

  return (
    <div className="flex flex-wrap gap-2">
      {CONTACT_CHANNEL_OPTIONS.map((option) => {
        const className = primary === option.value ? rowPrimaryButtonClass : rowButtonClass;

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
            <a key={option.value} href={`tel:${phone}`} className={className}>
              Ara
            </a>
          );
        }
        return (
          <a
            key={option.value}
            href={`mailto:${email}?subject=${encodeURIComponent("BlackBox görüşme talebin")}`}
            className={className}
          >
            E-posta
          </a>
        );
      })}
    </div>
  );
}

function DetailRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2">
          <dt className="w-32 shrink-0 text-xs font-bold uppercase tracking-wide text-brand-muted">
            {row.label}
          </dt>
          <dd className="min-w-0 break-words text-brand-white">
            {row.value || <span className="text-brand-muted">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatusAndDelete({
  kind,
  id,
  status,
  fullName,
  isAdmin,
}: {
  kind: "baslangic" | "basvuru";
  id: string;
  status: string;
  fullName: string;
  isAdmin: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {LEAD_STATUS_OPTIONS.filter(
        (option) => option.value !== status && option.value !== "yeni",
      ).map((option) => (
        <form key={option.value} action={setLeadStatusAction.bind(null, kind, id, option.value)}>
          <button type="submit" className={rowButtonClass}>
            {option.label}
          </button>
        </form>
      ))}
      {isAdmin && (
        <ConfirmActionButton
          action={deleteLeadAction.bind(null, kind, id)}
          confirmText={`${fullName} kaydı kalıcı olarak silinecek. Bu geri alınamaz. Devam edilsin mi?`}
          className={dangerButtonClass}
        >
          Sil
        </ConfirmActionButton>
      )}
    </div>
  );
}

function StartLeadCard({ lead, isAdmin }: { lead: StartLeadRow; isAdmin: boolean }) {
  return (
    <li className="space-y-3 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-brand-white">{lead.fullName}</div>
          <div className="mt-0.5 text-xs text-brand-muted">
            {formatDateTimeTR(lead.createdAt)} · {lead.phone} · {lead.email}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS_TONE[lead.status] ?? "neutral"}>
            {leadStatusLabel(lead.status)}
          </Pill>
          <Pill tone="yellow">Başlangıç formu</Pill>
        </div>
      </div>

      <DetailRows rows={describeStartAnswers(lead.answers)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContactButtons phone={lead.phone} email={lead.email} preferred={null} />
        <StatusAndDelete
          kind="baslangic"
          id={lead.id}
          status={lead.status}
          fullName={lead.fullName}
          isAdmin={isAdmin}
        />
      </div>
    </li>
  );
}

function FunnelLeadCard({ lead, isAdmin }: { lead: LeadRow; isAdmin: boolean }) {
  return (
    <li className="space-y-3 py-5 first:pt-0 last:pb-0">
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
            {formatDateTimeTR(lead.createdAt)} · {lead.phone} · {lead.email}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS_TONE[lead.status] ?? "neutral"}>
            {leadStatusLabel(lead.status)}
          </Pill>
          <Pill tone="yellow">{offerLabel(lead.interest)}</Pill>
          {/* Eski kayıtlarda fiyat vardı; yeni başvurulara fiyat yazılmıyor. */}
          {lead.quotedPriceMinor !== null && <Pill>{formatMinorTR(lead.quotedPriceMinor)}</Pill>}
        </div>
      </div>

      <DetailRows
        rows={[
          { label: "Kimin için", value: `${forWhomLabel(lead.forWhom)} · ${lead.age} yaş` },
          { label: "Hedefler", value: lead.goals.map(goalLabel).join(", ") },
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
            label: "Meslek / yoğunluk",
            value: [occupationGroupLabel(lead.occupationGroup), dailyLoadLabel(lead.dailyLoad)]
              .filter(Boolean)
              .join(" · "),
          },
          { label: "Saatler", value: lead.preferredTimes.map(preferredTimeLabel).join(", ") },
        ]}
      />

      {lead.note && (
        <p className="rounded-sm border border-brand-border bg-brand-black/30 p-3 text-sm leading-relaxed text-brand-white">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-muted">Not: </span>
          {lead.note}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContactButtons phone={lead.phone} email={lead.email} preferred={lead.contactChannel} />
        <StatusAndDelete
          kind="basvuru"
          id={lead.id}
          status={lead.status}
          fullName={lead.fullName}
          isAdmin={isAdmin}
        />
      </div>
    </li>
  );
}

export async function LeadsInbox({
  organizationId,
  isAdmin,
  basePath,
  status,
}: {
  organizationId: string;
  isAdmin: boolean;
  /** Filtre bağlantılarının kökü: `/personel/basvurular` ya da `/yonetim/basvurular`. */
  basePath: string;
  status?: string;
}) {
  const activeStatus = status && isLeadStatus(status) ? status : undefined;

  const [funnel, start, formUrls] = await Promise.all([
    listFunnelLeads(organizationId),
    listStartLeads(organizationId),
    Promise.all(FORMS.map((form) => absoluteUrl(form.path))),
  ]);

  const everything: InboxLead[] = [
    ...(start ?? []).map((row) => ({ kind: "baslangic" as const, createdAt: row.createdAt, row })),
    ...(funnel ?? []).map((row) => ({ kind: "basvuru" as const, createdAt: row.createdAt, row })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const visible = everything.filter((lead) => !activeStatus || lead.row.status === activeStatus);

  const now = new Date();
  const counts = new Map<string, number>();
  for (const lead of everything) counts.set(lead.row.status, (counts.get(lead.row.status) ?? 0) + 1);
  const lastWeek = everything.filter(
    (lead) => now.getTime() - lead.createdAt.getTime() < WEEK_MS,
  ).length;
  const bothMissing = funnel === null && start === null;

  return (
    <PanelPage
      title="Başvurular"
      description="Formları dolduran adaylar. Hedefleri, günlük hayatları ve iletişim bilgileri burada."
    >
      <PanelCard
        title="Form Bağlantıları"
        description="Bağlantıyı Instagram'a, WhatsApp'a ya da reklamlara koy; gelen talepler aşağıda toplanır."
      >
        <div className="space-y-8">
          {FORMS.map((form, index) => (
            <div key={form.kind} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-brand-white">{form.title}</h3>
                <p className="mt-0.5 text-xs text-brand-muted">{form.description}</p>
              </div>
              <JoinLinkBox
                url={formUrls[index]}
                label="Paylaşılacak adres"
                message={form.message(formUrls[index])}
              />
              <div className="flex flex-wrap items-center gap-4 rounded-sm border border-brand-border bg-brand-black/30 p-4">
                <QrCode value={formUrls[index]} size={128} label={`${form.title} QR kodu`} />
                <div className="space-y-2">
                  <p className="max-w-xs text-xs leading-relaxed text-brand-muted">
                    Telefon kamerasıyla okutan forma gider.
                  </p>
                  <a
                    href={`/personel/basvurular/qr?form=${form.kind}`}
                    download
                    className={rowButtonClass}
                  >
                    QR&apos;ı İndir (PNG)
                  </a>
                  <Link
                    href={form.path}
                    target="_blank"
                    className={`${secondaryButtonClass} ml-2`}
                  >
                    Sayfayı Aç
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      {bothMissing ? (
        <PanelCard title="Başvurular">
          <EmptyState>
            Bu ekran veritabanı güncellemesini bekliyor. Yöneticinin verdiği
            kurulum SQL&apos;i çalıştırılınca açılır. O zamana kadar gelen talepler
            kaybolmaz: yönetici panelindeki Denetim Kaydı&apos;nda &quot;geldi&quot;
            satırları olarak durur.
          </EmptyState>
        </PanelCard>
      ) : (
        <>
          {(funnel === null || start === null) && (
            <p className="text-xs leading-relaxed text-brand-muted">
              {start === null
                ? "Başlangıç formunun tablosu henüz kurulmadı; o formdan gelenler bu listede görünmez (denetim kaydında durur)."
                : "İlk başvuru formunun tablosu henüz kurulmadı; o formdan gelenler bu listede görünmez (denetim kaydında durur)."}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard
              label="Yeni"
              value={counts.get("yeni") ?? 0}
              highlight={(counts.get("yeni") ?? 0) > 0}
              hint="Henüz aranmadı"
            />
            <StatCard label="Son 7 Gün" value={lastWeek} hint="Gelen talep" />
            <StatCard label="Toplam" value={everything.length} hint="İki formdan" />
          </div>

          <PanelCard title={`Talepler (${visible.length})`}>
            <div className="mb-4 flex flex-wrap gap-2">
              <Link href={basePath} className={!activeStatus ? activeChipClass : secondaryButtonClass}>
                Tümü ({everything.length})
              </Link>
              {LEAD_STATUS_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={`${basePath}?durum=${option.value}`}
                  className={activeStatus === option.value ? activeChipClass : secondaryButtonClass}
                >
                  {option.label} ({counts.get(option.value) ?? 0})
                </Link>
              ))}
            </div>

            {visible.length === 0 ? (
              <EmptyState>
                {everything.length === 0
                  ? "Henüz talep yok. Yukarıdaki bağlantıyı açıp kendin bir test talebi gönderebilirsin."
                  : "Bu durumda talep yok."}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-brand-border">
                {visible.map((lead) =>
                  lead.kind === "baslangic" ? (
                    <StartLeadCard key={`s-${lead.row.id}`} lead={lead.row} isAdmin={isAdmin} />
                  ) : (
                    <FunnelLeadCard key={`f-${lead.row.id}`} lead={lead.row} isAdmin={isAdmin} />
                  ),
                )}
              </ul>
            )}
          </PanelCard>
        </>
      )}
    </PanelPage>
  );
}
