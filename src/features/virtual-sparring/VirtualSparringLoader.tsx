"use client";

/**
 * İstemci sarmalayıcı: oyun yalnızca tarayıcıda anlamlı (kamera, canvas,
 * AudioContext), bu yüzden `ssr: false` ile yükleniyor.
 *
 * ★ Next 16'da `ssr: false` bir Server Component içinde KULLANILAMAZ — bu
 *   yüzden dinamik import route dosyasında değil, burada duruyor
 *   (camera-fight-lab/FightLabHub.tsx ile aynı desen).
 */

import dynamic from "next/dynamic";

const VirtualSparring = dynamic(
  () => import("./VirtualSparring").then((module) => module.VirtualSparring),
  { ssr: false },
);

export function VirtualSparringLoader() {
  return <VirtualSparring />;
}
