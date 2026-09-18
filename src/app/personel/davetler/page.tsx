import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/guards";
import { staffScopeFor } from "@/lib/auth/scope";
import { listPendingInvites } from "@/lib/queries/invites";
import { listJoinLinks } from "@/lib/queries/join-links";
import { formatDateTimeTR } from "@/lib/date";
import { EmptyState, PanelCard, PanelPage, Pill, StatCard } from "@/components/panel/ui";
import { ReissueButton } from "./ReissueButton";
import { JoinLinkBox } from "@/components/panel/JoinLinkBox";
import { rowNameLinkClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Davetler — BlackBox Panel" };

export default async function StaffInvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireStaff(user.id);
  const scope = staffScopeFor(membership, user.id);

  const [pending, joinLinks] = await Promise.all([
    listPendingInvites(scope),
    listJoinLinks(membership.organizationId),
  ]);
  // Salonun herkese açık kayıt bağlantıları — antrenör de paylaşabilsin.
  // Üretmek/kapatmak yönetici işi (bkz. /yonetim/kayit-linki), burada yalnız
  // kopyalanır: sporcu eklemenin en hızlı yolu çoğu zaman bu bağlantıdır.
  const shareable = joinLinks.filter((link) => link.usable);
  const expired = pending.filter((row) => row.expired || row.neverInvited);
  const waiting = pending.filter((row) => !row.expired && !row.neverInvited);

  return (
    <PanelPage
      title="Davetler"
      description="Kaydı açılmış ama hesabını henüz kurmamış sporcular. Bağlantı 72 saat geçerlidir; süresi dolan için yenisini üret."
      action={
        <Link
          href="/personel/uyeler"
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-yellow hover:text-brand-yellow sm:min-h-9"
        >
          Sporcu Ekle
        </Link>
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Bekleyen Davet"
          value={waiting.length}
          hint="Bağlantısı hâlâ geçerli"
        />
        <StatCard
          label="Süresi Dolmuş"
          value={expired.length}
          highlight={expired.length > 0}
          hint="Yeni bağlantı üretilmeli"
        />
        <StatCard
          label="Toplam"
          value={pending.length}
          hint="Hesabı olmayan sporcu"
        />
      </div>

      {shareable.length > 0 && (
        <PanelCard
          title="Salonun Kayıt Bağlantısı"
          description="Tek tek davet üretmek yerine bu bağlantıyı paylaş — gelen kişi kendi bilgilerini yazıp hesabını kendi açar."
        >
          <div className="space-y-4">
            {shareable.map((link) => (
              <JoinLinkBox
                key={link.id}
                url={link.url}
                label={link.label}
              />
            ))}
          </div>
        </PanelCard>
      )}

      {pending.length === 0 ? (
        <PanelCard title="Bekleyen yok">
          <EmptyState>
            Bütün sporcuların hesabı kurulmuş. Yeni sporcu eklediğinde davet
            bağlantısı burada da görünür.
          </EmptyState>
        </PanelCard>
      ) : (
        <PanelCard
          title={`Hesabını Kurmayanlar (${pending.length})`}
          description="Bildirimler ve ders hatırlatmaları yalnız hesabı kurulmuş sporculara gider."
        >
          <ul className="divide-y divide-brand-border">
            {pending.map((row) => (
              <li
                key={row.memberId}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/personel/uyeler/${row.memberId}`}
                      className={rowNameLinkClass}
                    >
                      {row.fullName}
                      <span className="ml-2 text-xs text-brand-muted">
                        {row.memberNo}
                      </span>
                    </Link>
                    <div className="mt-1 text-xs text-brand-muted">
                      {row.email}
                      {row.phone ? ` · ${row.phone}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {row.neverInvited
                        ? "Hiç davet üretilmemiş"
                        : `Gönderildi: ${formatDateTimeTR(row.invitedAt!)} · Son geçerlilik: ${formatDateTimeTR(row.expiresAt!)}`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {row.status === "lead" && <Pill>Aday</Pill>}
                    {row.neverInvited ? (
                      <Pill tone="danger">Davet yok</Pill>
                    ) : row.expired ? (
                      <Pill tone="danger">Süresi doldu</Pill>
                    ) : (
                      <Pill tone="yellow">Bekliyor</Pill>
                    )}
                  </div>
                </div>

                <ReissueButton
                  memberId={row.memberId}
                  memberName={row.fullName}
                  label={row.neverInvited ? "Davet Üret" : "Yeni Bağlantı Üret"}
                />
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
    </PanelPage>
  );
}
