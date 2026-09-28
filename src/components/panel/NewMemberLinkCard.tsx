import Link from "next/link";
import {
  ensureDefaultJoinLink,
  listJoinLinks,
} from "@/lib/queries/join-links";
import { recordAudit } from "@/lib/queries/audit";
import { JoinLinkBox } from "@/components/panel/JoinLinkBox";
import { QrCode } from "@/components/panel/QrCode";
import { rowButtonClass } from "@/components/panel/form";

/**
 * "YENİ ÜYE EKLE" — ad, soyad ya da e-posta YAZILMAZ. Salonun tek kayıt
 * bağlantısı gösterilir; personel bağlantıyı (ya da QR'ı) gönderir, gelen kişi
 * bilgilerini kendisi yazıp hesabını kendisi açar.
 *
 * Bağlantı yoksa kendiliğinden üretilir — "önce link aç" adımı da elle iş
 * olmasın. Üretilen bağlantı yalnız kayıt kabul eder: yetki vermez, ders
 * hakkı açmaz.
 */
export async function NewMemberLinkCard({
  organizationId,
  actor,
}: {
  organizationId: string;
  actor: { id: string; displayName: string };
}) {
  const created = await ensureDefaultJoinLink({
    organizationId,
    createdByUserId: actor.id,
  });
  if (created?.ok) {
    await recordAudit({
      organizationId,
      actorUserId: actor.id,
      actorLabel: actor.displayName,
      action: "kayit-linki.uretildi",
      entityType: "MemberJoinLink",
      entityId: created.id,
      summary: `Genel kayıt bağlantısı kendiliğinden hazırlandı (/katil/${created.slug}).`,
    });
  }

  const links = await listJoinLinks(organizationId);
  const usable = links.filter((link) => link.usable);
  const primary = usable[0];

  if (!primary) {
    return (
      <p className="text-sm leading-relaxed text-brand-muted">
        Şu an açık bir kayıt bağlantısı yok (kapatılmış, süresi dolmuş ya da
        kontenjanı dolmuş). Yönetici{" "}
        <Link
          href="/yonetim/kayit-linki"
          className="font-semibold text-brand-yellow hover:text-brand-white"
        >
          Kayıt Bağlantısı
        </Link>{" "}
        ekranından yenisini açabilir.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <JoinLinkBox url={primary.url} label={primary.label} />

      <div className="flex flex-wrap items-center gap-4 rounded-sm border border-brand-border bg-brand-black/30 p-4">
        <QrCode
          value={primary.url}
          size={160}
          label={`${primary.label} kayıt bağlantısı QR kodu`}
        />
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-yellow">
            QR kod
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-brand-muted">
            Karşındaki kişi telefon kamerasıyla okutur, kayıt sayfası açılır.
            Salon girişine basılı asmak için PNG&apos;yi indir.
          </p>
          <a
            href={`/yonetim/kayit-linki/qr/${primary.id}`}
            download
            className={rowButtonClass}
          >
            QR&apos;ı İndir (PNG)
          </a>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-brand-muted">
        Üye adını, soyadını, e-postasını, telefonunu ve şifresini kendisi yazar;
        hesabı anında açılır ve sen listede görürsün. Yeni üye ders
        rezerve edebilmek için üyelik paketinin başlatılmasını bekler.
      </p>
    </div>
  );
}
