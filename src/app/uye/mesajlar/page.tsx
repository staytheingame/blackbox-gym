import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Mesajlar — BlackBox Panel" };

export default function MemberMessagesPage() {
  return (
    <PanelPage title="Antrenörümle Mesajlar" description="Antrenörünle birebir yazışma.">
      <Scaffold
        mirrors="Kong Academy → Danışan / Mesajlar"
        summary="Antrenör ile sporcu arasındaki birebir mesajlaşma; okunmamış sayısı yan menüde rozet olarak görünür."
        features={[
          "Birebir mesaj akışı (sporcu ↔ antrenör)",
          "Okundu bilgisi ve okunmamış rozeti",
          "Antrenmandan/check-in'den mesaja hızlı geçiş",
          "Dosya/video eki ile teknik sorusu",
        ]}
        needs={[
          "`Message` tablosu (threadId, senderId, body, readAt)",
          "Gerçek zamanlı güncelleme (polling ya da websocket)",
          "Bildirim tercihleri",
        ]}
      />
    </PanelPage>
  );
}
