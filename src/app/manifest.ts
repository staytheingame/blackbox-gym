import type { MetadataRoute } from "next";

/**
 * Web uygulaması bildirimi — BlackBox Panel telefona ve bilgisayara uygulama
 * gibi kurulsun diye. Chrome/Edge (masaüstü ve Android) adres çubuğundan ya da
 * panelin "Uygulamayı Yükle" düğmesinden kurar; iPhone'da Safari → Paylaş →
 * "Ana Ekrana Ekle".
 *
 * `start_url` giriş formu değil `/uygulama`: oturum açıksa doğrudan rolünün
 * paneline düşer. Renkler marka renkleri (`globals.css`): siyah zemin, sarı vurgu.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/uygulama",
    name: "BlackBox Panel",
    short_name: "BlackBox",
    description:
      "BlackBox üye ve antrenör paneli: dersler, rezervasyon, antrenman ve takip.",
    lang: "tr",
    start_url: "/uygulama",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["sports", "fitness", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
