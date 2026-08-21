import type { Metadata } from "next";
import { FightLabHub } from "@/features/camera-fight-lab/FightLabHub";

export const metadata: Metadata = {
  title: "BlackBox Fight Lab — Boxing & Wrestling Performance",
  description:
    "Webcam ve yerel pose tracking ile Boxing Lab ve Wrestling Lab reaction, movement, defense, recovery ve decision performans testleri.",
};

export default async function CameraFightLabPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string | string[] }>;
}) {
  const params = await searchParams;
  return <FightLabHub initialDebug={params.debug === "1"} />;
}
