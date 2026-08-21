import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Duyurular — BlackBox Panel" };

export default function StaffAnnouncementsPage() {
  return (
    <PanelPage title="Duyurular" description="Salon geneli duyurular ve bildirimler.">
      <Scaffold
        mirrors="Kong Academy → Koç / Duyurular"
        summary="Tüm sporculara ya da seçili gruba duyuru: tatil günleri, ders iptali, sparring gecesi çağrısı."
        features={[
          "Duyuru yazma ve yayınlama",
          "Hedef kitle: herkes / seviye / ders grubu",
          "Panelde ve ana sayfada gösterim",
          "Okundu bilgisi",
        ]}
        needs={[
          "`Announcement` tablosu (title, body, audience, publishedAt)",
          "Üye panelinde duyuru bileşeni",
          "İsteğe bağlı e-posta/push gönderimi",
        ]}
      />
    </PanelPage>
  );
}
