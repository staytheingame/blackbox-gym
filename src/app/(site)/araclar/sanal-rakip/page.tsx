import type { Metadata } from "next";
import { VirtualSparringLoader } from "@/features/virtual-sparring/VirtualSparringLoader";

export const metadata: Metadata = {
  title: "Sanal Rakip — Kameraya Karşı Dövüş",
  description:
    "Ekrandaki 3B rakip sana saldırıyor; vuruşunu yüklenmesinden oku ve o vurmadan önce doğru yanıtı tamamla. Tepki süren ve hataların analiz edilir, görüntü cihazından çıkmaz.",
};

export default function SanalRakipPage() {
  return (
    <div className="min-h-screen bg-black">
      <VirtualSparringLoader />
    </div>
  );
}
