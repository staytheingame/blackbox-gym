import type { Metadata } from "next";
import { PanelPage, Scaffold } from "@/components/panel/ui";

export const metadata: Metadata = { title: "Başvurular — BlackBox Panel" };

export default function StaffLeadsPage() {
  return (
    <PanelPage title="Site Başvuruları" description="İletişim formundan gelen üyelik başvuruları.">
      <Scaffold
        mirrors="Kong Academy → Koç / Başvurular (leads)"
        summary="Public sitedeki iletişim formu şu an hiçbir yere kayıt atmıyor; bu ekran o başvuruların düştüğü kuyruk olacak."
        features={[
          "Form başvuruları listesi (ad, telefon, ilgi alanı)",
          "Durum: yeni / arandı / deneme dersi / üye oldu",
          "Aday kaydına dönüştürme (tek tıkla üye oluşturma)",
          "Kaynak takibi (hangi sayfadan geldi)",
        ]}
        needs={[
          "`Lead` tablosu + iletişim formunun server action'a bağlanması",
          "Aday → üye dönüştürme akışı",
          "Spam koruması",
        ]}
      />
    </PanelPage>
  );
}
