import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth/guards";
import { listCoaches } from "@/lib/queries/admin";
import {
  ensureDefaultJoinLink,
  listJoinLinks,
  listSelfRegistered,
} from "@/lib/queries/join-links";
import { recordAudit } from "@/lib/queries/audit";
import { listStaffJoinLinks } from "@/lib/queries/staff-join-links";
import { STAFF_LINK_ROLE_LABEL } from "@/domain/registration/staff-link";
import { QrCode } from "@/components/panel/QrCode";
import { ageFrom } from "@/domain/marketing/meta-matching";
import { formatDateTR, formatDateTimeTR } from "@/lib/date";
import {
  EmptyState,
  PanelCard,
  PanelPage,
  Pill,
  StatCard,
} from "@/components/panel/ui";
import {
  rowButtonClass,
  rowNameLinkClass,
  secondaryButtonClass,
} from "@/components/panel/form";
import { CreateJoinLinkForm, JoinLinkDefaults } from "./JoinLinkForms";
import { StaffJoinLinkForm } from "./StaffJoinLinkForm";
import { JoinLinkBox } from "@/components/panel/JoinLinkBox";
import { toggleJoinLinkAction } from "./actions";
import { closeStaffJoinLinkAction } from "./staff-actions";

export const metadata: Metadata = {
  title: "Kayıt Bağlantısı — BlackBox Yönetim",
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Üye",
  lead: "Aday",
  inactive: "Pasif",
  blocked: "Engelli",
};

/**
 * KAYIT BAĞLANTISI — "tek link, kendileri kaydolsun".
 *
 * Eskiden her sporcu için ayrı davet bağlantısı üretilip tek tek
 * gönderiliyordu (o akış duruyor, bkz. `/personel/davetler` — tanıdık birini
 * elle eklemek için hâlâ en hızlısı). Burası çoğa açık olanı: bir kere üret,
 * her yere koy, gelen kendi kaydını açar.
 *
 * Ekranın iki yarısı var: üstte bağlantılar (hangi kanal kaç kişi getirdi),
 * altta o bağlantılardan gelen kayıtlar (kim geldi, antrenörü atandı mı).
 */
export default async function AdminJoinLinkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireAdmin(user.id);

  // Hiç bağlantı yoksa kendiliğinden bir tane hazır olsun.
  const created = await ensureDefaultJoinLink({
    organizationId: membership.organizationId,
    createdByUserId: user.id,
  });
  if (created?.ok) {
    await recordAudit({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      actorLabel: user.displayName,
      action: "kayit-linki.uretildi",
      entityType: "MemberJoinLink",
      entityId: created.id,
      summary: `Genel kayıt bağlantısı kendiliğinden hazırlandı (/katil/${created.slug}).`,
    });
  }

  const [links, coaches, registered, staffLinks] = await Promise.all([
    listJoinLinks(membership.organizationId),
    listCoaches(membership.organizationId),
    listSelfRegistered(membership.organizationId),
    listStaffJoinLinks(membership.organizationId),
  ]);

  const coachOptions = coaches.map((coach) => ({
    userId: coach.userId,
    displayName: coach.displayName,
  }));

  // Tek "şimdi": `Date.now()` render içinde yasak (react-hooks/purity).
  const now = new Date();
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const usable = links.filter((link) => link.usable);
  const clientUrls = usable.map((link) => link.url);
  const unassigned = registered.filter((row) => !row.assignedCoachName);
  const last30 = registered.filter(
    (row) => row.registeredAt.getTime() > thirtyDaysAgo,
  );

  return (
    <PanelPage
      title="Kayıt Bağlantısı"
      description="Tek bir bağlantı üret, her yere koy — gelen kişi kendi bilgilerini yazıp şifresini kendisi kurar. Tek tek davet göndermek gerekmez."
      action={
        <div className="flex flex-wrap gap-2">
          <Link href="/yonetim/uyeler" className={secondaryButtonClass}>
            Sporcular
          </Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/export/reklam-eslesme" className={secondaryButtonClass}>
            Reklam Eşleşme CSV
          </a>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Açık Bağlantı"
          value={usable.length}
          hint={`${links.length} bağlantı tanımlı`}
        />
        <StatCard
          label="Kendi Kaydolan"
          value={registered.length}
          hint="Tüm zamanlar"
        />
        <StatCard label="Son 30 Gün" value={last30.length} hint="Yeni kayıt" />
        <StatCard
          label="Antrenörü Atanmamış"
          value={unassigned.length}
          highlight={unassigned.length > 0}
          hint="Dağıtılmayı bekliyor"
        />
      </div>

      <PanelCard
        title="Antrenör ve Yönetici Kayıt Bağlantıları"
        description="Antrenörler ve yöneticiler bu bağlantılardan adını, e-postasını ve şifresini kendisi yazarak hesap açar. Sporcular kayıt olurken koçunu bu kadrodan seçer — o yüzden önce antrenörler kayıt olmalı."
      >
        {staffLinks === null ? (
          <EmptyState>
            Bu bölüm veritabanı güncellemesini bekliyor. Bilgisayarda proje
            klasöründe <code>npx prisma migrate deploy</code> çalıştırıldığında
            açılır; sporcu kayıt bağlantısı bundan etkilenmez.
          </EmptyState>
        ) : (
          <div className="space-y-5">
            <StaffJoinLinkForm clientUrls={clientUrls} />

            {staffLinks.length > 0 && (
              <ul className="divide-y divide-brand-border border-t border-brand-border pt-2">
                {staffLinks.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-brand-white">
                        {row.label}
                        <span className="ml-2 text-[0.7rem] font-normal text-brand-muted">
                          {STAFF_LINK_ROLE_LABEL[row.role]}
                        </span>
                      </div>
                      <div className="text-xs text-brand-muted">
                        {row.usedCount}/{row.maxUses} kişi kaydoldu · son gün{" "}
                        {formatDateTR(row.expiresAt)} ·{" "}
                        {formatDateTR(row.createdAt)} tarihinde açıldı
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {row.usable ? (
                        <Pill tone="yellow">Açık</Pill>
                      ) : (
                        <Pill tone="danger">
                          {!row.isActive
                            ? "Kapalı"
                            : row.expiresAt <= now
                              ? "Süresi doldu"
                              : "Kontenjan doldu"}
                        </Pill>
                      )}
                      {row.usable && (
                        <form
                          action={closeStaffJoinLinkAction.bind(null, row.id)}
                        >
                          <button type="submit" className={rowButtonClass}>
                            Kapat
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PanelCard>

      <PanelCard
        title="Yeni Bağlantı Üret"
        description="Her kanala ayrı bağlantı üretmek en işe yarar yol: hangi bağlantının kaç üye getirdiği aşağıdaki listede görünür."
      >
        <CreateJoinLinkForm coaches={coachOptions} />
      </PanelCard>

      <PanelCard
        title={`Bağlantılar (${links.length})`}
        description="Kapatılan bağlantı silinmez — kimin nereden geldiği kaydı kalır."
      >
        {links.length === 0 ? (
          <EmptyState>
            Henüz kayıt bağlantısı yok. Yukarıdaki formdan birkaç saniyede
            üretebilirsin.
          </EmptyState>
        ) : (
          <ul className="space-y-5">
            {links.map((link) => (
              <li
                key={link.id}
                className="space-y-3 border-b border-brand-border pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-brand-white">
                      {link.label}
                      <span className="ml-2 font-mono text-[0.7rem] font-normal text-brand-muted">
                        /katil/{link.slug}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                      <span>{link.memberCount} kayıt</span>
                      {link.maxUses !== null && (
                        <span>
                          · kontenjan {link.usedCount}/{link.maxUses}
                        </span>
                      )}
                      {link.expiresAt && (
                        <span>· son gün {formatDateTR(link.expiresAt)}</span>
                      )}
                      <span>· {formatDateTR(link.createdAt)} tarihinde açıldı</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {link.usable ? (
                      <Pill tone="yellow">Açık</Pill>
                    ) : (
                      <Pill tone="danger">
                        {!link.isActive
                          ? "Kapalı"
                          : link.expiresAt && link.expiresAt <= now
                            ? "Süresi doldu"
                            : "Kontenjan doldu"}
                      </Pill>
                    )}
                    <form
                      action={toggleJoinLinkAction.bind(
                        null,
                        link.id,
                        !link.isActive,
                      )}
                    >
                      <button type="submit" className={rowButtonClass}>
                        {link.isActive ? "Kapat" : "Aç"}
                      </button>
                    </form>
                  </div>
                </div>

                <JoinLinkBox url={link.url} label="Paylaşılacak adres" />

                {/* QR: salon girişine basılıp okutulsun. Yalnız açık bağlantıda
                    anlamlı — kapalı bağlantının QR'ı boş bir sayfaya götürür. */}
                {link.usable && (
                  <div className="flex flex-wrap items-center gap-4 rounded-sm border border-brand-border bg-brand-black/30 p-4">
                    <QrCode
                      value={link.url}
                      size={160}
                      label={`${link.label} kayıt bağlantısı QR kodu`}
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
                        QR kod
                      </p>
                      <p className="max-w-xs text-xs leading-relaxed text-brand-muted">
                        Telefon kamerasıyla okutan kayıt sayfasına gider.
                        Baskıya hazır PNG&apos;yi indirip salon girişine asabilirsin.
                      </p>
                      <a
                        href={`/yonetim/kayit-linki/qr/${link.id}`}
                        download
                        className={rowButtonClass}
                      >
                        QR&apos;ı İndir (PNG)
                      </a>
                    </div>
                  </div>
                )}

                <JoinLinkDefaults
                  linkId={link.id}
                  coaches={coachOptions}
                  defaultCoachUserId={link.defaultCoachUserId}
                  defaultStatus={link.defaultStatus}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title={`Bu Bağlantılardan Gelenler (${registered.length})`}
        description="Antrenör ataması Sporcular ekranından yapılır; atanmamış olanlar listenin başındadır."
        action={
          <Link href="/yonetim/uyeler" className={secondaryButtonClass}>
            Antrenör Ata
          </Link>
        }
      >
        {registered.length === 0 ? (
          <EmptyState>
            Henüz kimse bu bağlantılardan kaydolmadı. Bağlantıyı Instagram
            biyografisine ya da salon girişine koyunca buraya düşer.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-brand-border">
            {registered.map((row) => {
              const age = ageFrom(row.birthDate);
              return (
                <li
                  key={row.memberId}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <Link
                      href={`/personel/uyeler/${row.memberId}`}
                      className={rowNameLinkClass}
                    >
                      {row.fullName}
                      <span className="ml-2 text-xs font-normal text-brand-muted">
                        {row.memberNo}
                      </span>
                    </Link>
                    <div className="text-xs text-brand-muted">
                      {[
                        row.phone,
                        row.email,
                        age !== null ? `${age} yaş` : null,
                        row.district ?? row.city,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="mt-0.5 text-[0.7rem] text-brand-muted">
                      {formatDateTimeTR(row.registeredAt)}
                      {row.linkLabel ? ` · ${row.linkLabel}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={row.status === "active" ? "yellow" : "neutral"}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Pill>
                    {row.assignedCoachName ? (
                      <span className="text-xs text-brand-muted">
                        {row.assignedCoachName}
                      </span>
                    ) : (
                      <Pill tone="danger">Antrenör atanmadı</Pill>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>
    </PanelPage>
  );
}
