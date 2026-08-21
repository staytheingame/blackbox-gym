import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Mesajlar — BlackBox Panel" };

export default function StaffMessagesPage() {
  return (
    <PanelPage title="Sporcu Mesajları" description="Tüm sporcularla yazışmalar tek kutuda.">
      <Scaffold
        mirrors="Kong Academy → Koç / Mesajlar"
        summary="Antrenörün tüm sporcularıyla yazışması; yanıt bekleyenler üstte, okunmamış sayısı menüde rozet."
        features={[
          "Sporcu bazlı mesaj kutusu",
          "Yanıt bekleyenler önce",
          "Toplu/hızlı yanıt şablonları",
          "Sporcu detayından mesaja geçiş",
        ]}
        needs={[
          "`Message` tablosu ve thread modeli",
          "Okunmamış sayacı (nav-badges ile bağlanacak)",
          "Bildirim tercihleri",
        ]}
      />
    </PanelPage>
  );
}
