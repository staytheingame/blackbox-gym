import type { Metadata } from "next";
import Link from "next/link";
import { resolveInvite } from "@/lib/queries/invite-resolver";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = {
  title: "Davet — BlackBox",
  description: "BlackBox hesabını kur.",
  robots: { index: false, follow: false },
};

/** Davet bağlantısı kişiye özeldir; her isteğinde durumu yeniden okunur. */
export const dynamic = "force-dynamic";

const REASON_TEXT: Record<string, { title: string; body: string }> = {
  gecersiz: {
    title: "Bağlantı geçersiz",
    body: "Bu davet bağlantısı tanınmadı ya da iptal edildi. Seni davet eden kişiden yeni bir bağlantı iste.",
  },
  kullanilmis: {
    title: "Bağlantı kullanılmış",
    body: "Bu bağlantıyla hesap zaten kurulmuş. Şifrenle giriş yapabilirsin.",
  },
  "suresi-doldu": {
    title: "Süresi dolmuş",
    body: "Davet bağlantıları 72 saat geçerlidir. Seni davet eden kişiden yenisini iste — birkaç saniyede üretiliyor.",
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display flex items-center gap-1 text-2xl tracking-wide"
        >
          <span className="text-brand-white">BLACK</span>
          <span className="bg-brand-yellow px-1.5 py-0.5 text-brand-black">
            BOX
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await resolveInvite(token);

  if (!invite.ok) {
    const text = REASON_TEXT[invite.reason];
    return (
      <Shell>
        <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
          <h1 className="font-display text-2xl uppercase tracking-wide text-brand-white">
            {text.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            {text.body}
          </p>
          <Link
            href="/giris"
            className="mt-6 block rounded-sm border border-brand-border px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow"
          >
            Giriş Ekranı
          </Link>
        </div>
      </Shell>
    );
  }

  const firstName = invite.fullName.split(" ")[0];
  const isStaff = invite.kind === "personel";

  // Davet türüne göre değişen tek şey metin: personel panelde ders açar ve
  // sporcu yönetir, sporcu ise kendi programını görür.
  const badge = isStaff
    ? invite.role === "admin"
      ? "Yönetici Daveti"
      : "Antrenör Daveti"
    : "Sporcu Daveti";

  const intro = isStaff
    ? invite.role === "admin"
      ? `${invite.organizationName} yönetim paneline davet edildin. Şifreni sen belirliyorsun — kimse görmüyor. Kurduktan sonra kadro, paket, kasa ve raporlara erişebilir, antrenör panelini de kullanabilirsin.`
      : `${invite.organizationName} antrenör paneline davet edildin. Şifreni sen belirliyorsun — kimse görmüyor. Kurduktan sonra kendi sporcularını ekleyebilir, ders saati açabilir, antrenman ve beslenme planı yazabilirsin.`
    : "Şifreni sen belirliyorsun — kimse görmüyor. Kurduktan sonra ders saatlerini görebilir, rezervasyon yapabilir ve hatırlatmalarını alabilirsin.";

  return (
    <Shell>
      <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
          {badge}
        </span>
        <h1 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
          Hoş geldin {firstName}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">{intro}</p>

        <div className="mt-6">
          <InviteForm
            token={token}
            kind={invite.kind}
            fullName={invite.fullName}
            email={invite.email}
          />
        </div>
      </div>

      <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-brand-muted">
        Bağlantı 72 saat geçerlidir ve tek kullanımlıktır.
      </p>
    </Shell>
  );
}
