import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveJoinLink } from "@/lib/queries/join-links";
import { getCurrentUser } from "@/lib/auth/guards";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Kayıt — BlackBox",
  description: "BlackBox üyelik kaydını kendin aç.",
  robots: { index: false, follow: false },
};

/** Bağlantının durumu her istekte yeniden okunur — kapatılan link anında düşer. */
export const dynamic = "force-dynamic";

const REASON_TEXT: Record<string, { title: string; body: string }> = {
  gecersiz: {
    title: "Bağlantı tanınmadı",
    body: "Bu kayıt bağlantısı yok ya da adresi yanlış yazılmış. Salondan güncel bağlantıyı iste.",
  },
  kapali: {
    title: "Kayıt kapalı",
    body: "Bu bağlantı şu an kapalı. Salonla iletişime geçersen yeni bir bağlantı açarlar.",
  },
  "suresi-doldu": {
    title: "Süresi dolmuş",
    body: "Bu kayıt bağlantısının süresi geçmiş. Salondan güncel bağlantıyı iste.",
  },
  "kota-doldu": {
    title: "Kontenjan doldu",
    body: "Bu bağlantıdaki kayıt kontenjanı doldu. Salonla iletişime geçebilirsin.",
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

export default async function JoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Oturumu açık biri linke tıklarsa ikinci hesap açmasın — paneline gider.
  const user = await getCurrentUser();
  if (user) redirect("/uye");

  const link = await resolveJoinLink(slug);

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
          <Link
            href="/iletisim"
            className="mt-6 block rounded-sm border border-brand-border px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-brand-white transition-colors hover:border-brand-yellow hover:text-brand-yellow"
          >
            Salona Ulaş
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mt-6 rounded-sm border border-brand-border bg-brand-surface p-6">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-yellow">
          {link.organizationName} · Üyelik Kaydı
        </span>
        <h1 className="font-display mt-1 text-2xl uppercase tracking-wide text-brand-white">
          Kaydını Kendin Aç
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">
          Bilgilerini bir kez yaz, şifreni kendin belirle — hesabın anında
          açılır. Sonrasında ders saatlerini görebilir, boş saatlerden
          rezervasyon yapabilir ve programını takip edebilirsin.
          {link.defaultStatus === "lead"
            ? " Antrenörün seninle iletişime geçip üyeliğini başlatacak."
            : " Ders rezervasyonu, salon ders paketini tanımladığında açılır."}
        </p>

        <div className="mt-6">
          <RegisterForm slug={link.slug} />
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
