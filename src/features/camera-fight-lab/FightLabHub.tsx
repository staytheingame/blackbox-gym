"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const BoxingLab = dynamic(
  () => import("./CameraFightLab").then((module) => module.CameraFightLab),
  { ssr: false },
);
const WrestlingLab = dynamic(
  () => import("./wrestling/WrestlingLab").then((module) => module.WrestlingLab),
  { ssr: false },
);

export function FightLabHub({ initialDebug = false }: { initialDebug?: boolean }) {
  const [sport, setSport] = useState<"boxing" | "wrestling">("boxing");
  return (
    <div className="min-h-screen bg-black">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="font-display text-lg uppercase text-white">BlackBox <span className="text-brand-yellow">Fight Lab</span></p>
          <div className="flex rounded-xl border border-white/10 bg-white/[.04] p-1" role="group" aria-label="Fight Lab sport seçimi">
            <button type="button" onClick={() => setSport("boxing")} aria-pressed={sport === "boxing"} className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition ${sport === "boxing" ? "bg-brand-yellow text-black" : "text-zinc-400 hover:text-white"}`}>Boxing Lab</button>
            <button type="button" onClick={() => setSport("wrestling")} aria-pressed={sport === "wrestling"} className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition ${sport === "wrestling" ? "bg-brand-yellow text-black" : "text-zinc-400 hover:text-white"}`}>Wrestling Lab</button>
          </div>
        </div>
      </div>
      {sport === "boxing" ? <BoxingLab initialDebug={initialDebug} /> : <WrestlingLab initialDebug={initialDebug} onBack={() => setSport("boxing")} />}
    </div>
  );
}
