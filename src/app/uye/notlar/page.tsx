import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Not Defterim — BlackBox Panel" };

export default function MemberNotesPage() {
  return (
    <PanelPage title="Not Defterim" description="Kendine özel notlar — antrenör görmez.">
      <Scaffold
        mirrors="Kong Academy → Danışan / Not Defterim"
        summary="Sporcunun kendine tuttuğu özel notlar: maç planı, rakip gözlemi, antrenman sonrası hisler."
        features={[
          "Serbest not yazma ve düzenleme",
          "Tarihe göre listeleme",
          "Antrenmana/check-in'e bağlı not",
          "Yalnız sporcunun görebildiği gizlilik",
        ]}
        needs={[
          "`MemberNote` tablosu (memberId, body, createdAt)",
          "Yalnız-sahibi erişim kuralı (guards.requireMemberSelf)",
        ]}
      />
    </PanelPage>
  );
}
