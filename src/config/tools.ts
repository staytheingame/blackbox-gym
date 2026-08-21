export type ToolInfo = {
  slug: string;
  href: string;
  name: string;
  tagline: string;
  description: string;
};

export const tools: ToolInfo[] = [
  {
    slug: "sesli-refleks",
    href: "/araclar/sesli-refleks",
    name: "Sesli Refleks",
    tagline: "Hamleyi duy, tepki ver",
    description:
      "Sistem rastgele aralıklarla sesli olarak bir boks hamlesi söyler (\"Sol Jab\", \"Sağ Kroşe\", \"Roll Sol\" vb.) — sen duyar duymaz tepki verirsin. Tepki sürelerin ölçülür ve özetlenir.",
  },
  {
    slug: "dovus-analitigi",
    href: "/araclar/dovus-analitigi",
    name: "Dövüş Analitiği",
    tagline: "Videonu yükle, tarayıcıda analiz et",
    description:
      "Bir antrenman videosu yükle — guard, ayak işi ve kafa hareketini tarayıcında (MediaPipe ile) analiz edip basit bir performans raporu çıkarır. Video hiçbir sunucuya gönderilmez.",
  },
];
