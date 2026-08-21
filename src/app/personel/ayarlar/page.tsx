import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Ayarlar — BlackBox Panel" };

export default function StaffSettingsPage() {
  return (
    <PanelPage title="Ayarlar" description="Salon bilgileri, şubeler ve panel tercihleri.">
      <Scaffold
        mirrors="Kong Academy → Koç / Ayarlar"
        summary="Organizasyon ve şube bilgileri, çalışma saatleri, ders türleri ve panel tercihleri buradan yönetilecek."
        features={[
          "Salon/organizasyon bilgileri ve şubeler",
          "Ders türleri ve seviye tanımları",
          "Personel hesapları ve roller (resepsiyon/antrenör/yönetici)",
          "Bildirim tercihleri",
        ]}
        needs={[
          "`Organization` / `Branch` düzenleme formları",
          "Çok rollü personel hiyerarşisi (şu an yalnız member/staff)",
          "Ayar değişikliklerinde yetki kontrolü",
        ]}
      />
    </PanelPage>
  );
}
