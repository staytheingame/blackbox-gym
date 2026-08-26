import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentMember,
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { ORG_ROLE_LABEL } from "@/lib/auth/roles";
import { formatDateTR } from "@/lib/date";
import { logoutAction } from "@/lib/auth/actions";
import { PanelCard, PanelPage, Pill, Scaffold } from "@/components/panel/ui";
import { PasswordChangeForm } from "@/components/panel/PasswordChangeForm";

export const metadata: Metadata = { title: "Profil — BlackBox Panel" };

export default async function MemberProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const member = await getCurrentMember(user.id);
  if (!member) redirect("/giris");

  const membership = await requireOrganizationMembership(user.id);

  const rows: { label: string; value: string }[] = [
    { label: "Ad Soyad", value: member.fullName },
    { label: "Üye No", value: member.memberNo },
    { label: "E-posta", value: member.email ?? user.email },
    { label: "Telefon", value: member.phone ?? "—" },
    { label: "Üyelik Durumu", value: member.status },
    { label: "Kayıt Tarihi", value: formatDateTR(member.createdAt) },
    { label: "Rol", value: ORG_ROLE_LABEL[membership.role] },
  ];

  return (
    <PanelPage
      title="Profil"
      description="Hesap bilgilerin ve panel tercihlerin."
      action={
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-brand-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-muted transition-colors hover:border-red-400/50 hover:text-red-400 sm:min-h-9"
          >
            Çıkış Yap
          </button>
        </form>
      }
    >
      <PanelCard
        title="Hesap Bilgileri"
        action={
          <Pill tone={member.status === "active" ? "yellow" : "neutral"}>
            {member.status === "active" ? "Aktif" : member.status}
          </Pill>
        }
      >
        <dl className="divide-y divide-brand-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
            >
              <dt className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                {row.label}
              </dt>
              <dd className="text-sm text-brand-white">{row.value}</dd>
            </div>
          ))}
        </dl>
      </PanelCard>

      <PanelCard
        title="Şifre Değiştir"
        description="Panele girdiğin şifre. Davet bağlantısıyla kurduğun şifreyi buradan yenileyebilirsin."
      >
        <PasswordChangeForm />
      </PanelCard>

      <Scaffold
        mirrors="Kong Academy → Danışan / Profil (settings)"
        summary="Şifre değiştirme çalışıyor; iletişim bilgisi ve sporcu bilgileri şu an yalnız okunur — düzenlemeyi antrenör yapıyor."
        features={[
          "İletişim bilgisi güncelleme",
          "Bildirim tercihleri",
          "Sıklet / boy gibi sporcu bilgileri",
        ]}
        needs={[
          "Profil güncelleme server action + zod şeması",
          "Zorunlu ilk şifre değişimi bayrağı (`User.mustChangePassword`)",
        ]}
      />
    </PanelPage>
  );
}
