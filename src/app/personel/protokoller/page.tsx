import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Kamp Protokolleri — BlackBox Panel" };

export default function StaffProtocolsPage() {
  return (
    <PanelPage title="Kamp Protokolleri" description="Hazır çok haftalık maç kampı paketleri.">
      <Scaffold
        mirrors="Kong Academy → Koç / Protokoller"
        summary="Tek tek şablon düzenlemek yerine hazır paketler: 8 haftalık maç kampı, 4 haftalık teknik yoğunlaştırma, sıklet düşüş protokolü."
        features={[
          "Hazır protokol kütüphanesi (8 haftalık kamp, teknik blok, sıklet düşüşü)",
          "Protokolü sporcuya atama — haftalar otomatik açılır",
          "Protokol içinde antrenman + kondisyon + tartı birlikte",
          "Kopyalayıp özelleştirme",
        ]}
        needs={[
          "`Protocol` / `ProtocolWeek` tabloları",
          "Atama tablosu (`MemberProtocol`)",
          "Antrenman ve kondisyon şablonlarıyla bağ",
        ]}
      />
    </PanelPage>
  );
}
