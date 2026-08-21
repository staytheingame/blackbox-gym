import type { Metadata } from "next";
import { PanelCard, PanelPage } from "@/components/panel/ui";
import { CheckInForm } from "./CheckInForm";

export const metadata: Metadata = {
  title: "Check-in — BlackBox Panel",
};

export default function CheckInPage() {
  return (
    <PanelPage
      title="Haftalık Check-in"
      description="Antrenman uyumu, uyku, stres, enerji ve keyif — bu cevaplar performans kartını ve puanlarını günceller."
    >
      <div className="max-w-2xl">
        <PanelCard title="Bu Hafta">
          <CheckInForm />
        </PanelCard>
      </div>
    </PanelPage>
  );
}
