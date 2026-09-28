import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveStaffJoinLink } from "@/lib/queries/staff-join-links";
import { getCurrentUser } from "@/lib/auth/guards";
import { STAFF_LINK_ROLE_LABEL } from "@/domain/registration/staff-link";
import { StaffRegisterForm } from "./StaffRegisterForm";

export const metadata: Metadata = {
  title: "Antrenör Kaydı — BlackBox",
  robots: { index: false, follow: false },
};

/** Bağlantının durumu her istekte yeniden okunur — kapatılan bağlantı anında düşer. */
export const dynamic = "force-dynamic";

const REASON_TEXT: Record<string, { title: string; body: string }> = {
  gecersiz: {
    title: "Bağlantı tanınmadı",
    body: "Bu kadro bağlantısı yok ya da adresi eksik kopyalanmış. Yöneticiden güncel bağlantıyı iste.",
  },
  kapali: {
    title: "Bağlantı kapalı",
    body: "Bu bağlantı kapatılmış. Yöneticiden yenisini iste.",
  },
  "suresi-doldu": {
    title: "Süresi dolmuş",
    body: "Bu bağlantının süresi geçmiş. Yöneticiden yenisini iste.",
  },
  "kota-doldu": {
    title: "Kontenjan doldu",
    body: "Bu bağlantıyla açılabilecek hesap sayısı doldu. Yöneticiden yenisini iste.",
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl">
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

export default async function StaffJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Oturumu açık biri bağlantıya tıklarsa ikinci hesap açmasın.
  const user = await getCurrentUser();
  if (user) redirect("/personel");

  const link = await resolveStaffJoinLink(token);

  if (!link.ok) {
    const text = REASON_TEXT[link.reason];
    return (
      <Shell>
        <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
          <h1 className="font-display text-2xl uppercase tracking-wide text-brand-white">
            {text.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            {text.body}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
          {link.organizationName} · {STAFF_LINK_ROLE_LABEL[link.role]} Kaydı
        </span>
        <h1 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
          {STAFF_LINK_ROLE_LABEL[link.role]} Hesabını Aç
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">
          Adını, e-postanı ve şifreni kendin yaz — hesabın anında açılır.
          {link.role === "admin"
            ? " Yönetici hesabı salonun tüm verisini ve ayarlarını görür; bu bağlantıyı kimseyle paylaşma."
            : " Sporcuların kayıt olurken seni koç olarak seçebilmesi için hesabının açık olması yeterli."}
        </p>

        <div className="mt-6">
          <StaffRegisterForm token={token} role={link.role} />
        </div>
      </div>

      <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-brand-muted">
        Hesabın var mı?{" "}
        <Link href="/giris" className="text-brand-yellow hover:text-brand-white">
          Giriş yap
        </Link>
      </p>
    </Shell>
  );
}
