import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "İstekler — BlackBox Panel" };

export default function MemberRequestsPage() {
  return (
    <PanelPage title="Destek & İstekler" description="Program değişikliği, dondurma, ekipman talebi gibi istekler.">
      <Scaffold
        mirrors="Kong Academy → Danışan / İstekler"
        summary="Sporcunun açtığı talepler ve durumları — antrenör tarafında kuyruk olarak görünür."
        features={[
          "Talep açma (program değişikliği, üyelik dondurma, ders değişimi)",
          "Talep durumu: açık / işlemde / kapandı",
          "Antrenör yanıtı ve kapanış notu",
          "Geçmiş talepler",
        ]}
        needs={[
          "`MemberRequest` tablosu (type, status, body, resolvedAt)",
          "Personel tarafında talep kuyruğu ekranı",
          "Durum değişiminde bildirim",
        ]}
      />
    </PanelPage>
  );
}
