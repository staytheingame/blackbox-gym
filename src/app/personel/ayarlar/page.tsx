import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  requireOrganizationMembership,
} from "@/lib/auth/guards";
import { ORG_ROLE_LABEL } from "@/lib/auth/roles";
import { logoutAction } from "@/lib/auth/actions";
import { PanelCard, PanelPage, Scaffold } from "@/components/panel/ui";
import { PasswordChangeForm } from "@/components/panel/PasswordChangeForm";
import { secondaryButtonClass } from "@/components/panel/form";

export const metadata: Metadata = { title: "Ayarlar — BlackBox Panel" };

export default async function StaffSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const membership = await requireOrganizationMembership(user.id);

  const rows: { label: string; value: string }[] = [
    { label: "Ad Soyad", value: user.displayName },
    { label: "E-posta", value: user.email },
    { label: "Rol", value: ORG_ROLE_LABEL[membership.role] },
  ];

  return (
    <PanelPage
      title="Ayarlar"
      description="Hesabın, salon bilgileri ve panel tercihleri."
      action={
        <form action={logoutAction}>
          <button type="submit" className={secondaryButtonClass}>
            Çıkış Yap
          </button>
        </form>
      }
    >
      <PanelCard title="Hesabın">
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
        mirrors="Kong Academy → Koç / Ayarlar"
        summary="Organizasyon ve şube bilgileri, çalışma saatleri ve ders türleri buradan yönetilecek."
        features={[
          "Salon/organizasyon bilgileri ve şubeler",
          "Ders türleri ve seviye tanımları",
          "Bildirim tercihleri",
        ]}
        needs={[
          "`Organization` / `Branch` düzenleme formları",
          "Ayar değişikliklerinde yetki kontrolü",
        ]}
      />
    </PanelPage>
  );
}
