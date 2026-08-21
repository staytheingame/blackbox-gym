export type ToolInfo = {
  slug: string;
  href: string;
  name: string;
  tagline: string;
  description: string;
};

export const tools: ToolInfo[] = [
  {
    slug: "kamera-fight-lab",
    href: "/araclar/kamera-fight-lab",
    name: "BlackBox Fight Lab",
    tagline: "Boxing ve Wrestling hareket zamanını ölç",
    description:
      "Boxing Lab'de yumruk, decision ve guard-return; Wrestling Lab'de shot, sprawl, movement, recognition, recovery ve longitudinal profile testleri. MediaPipe Pose tamamen tarayıcıda çalışır; video cihazından çıkmaz.",
  },
  {
    slug: "sesli-refleks",
    href: "/araclar/sesli-refleks",
    name: "Sesli Refleks",
    tagline: "Hamleyi duy, kamera doğrulasın",
    description:
      "Sistem rastgele aralıklarla sesli olarak bir boks hamlesi söyler (\"Sol Jab\", \"Sağ Kroşe\", \"Roll Sol\" vb.) — sen duyar duymaz tepki verirsin. Kamera modunda tepki süresi eklem hareketinden ölçülür, hamlenin doğru yapılıp yapılmadığı iskelet takibiyle doğrulanır; seans round'lara bölünür ve sonunda hız, tutarlılık, hamle doğruluğu, guard disiplini ve dayanıklılıktan oluşan odak raporu çıkar.",
  },
  {
    slug: "sanal-rakip",
    href: "/araclar/sanal-rakip",
    name: "Sanal Rakip",
    tagline: "Kameraya karşı dövüş — oyun modu",
    description:
      "Karşındaki 3B rakip saldırıyor: vuruşunu yüklenme anından oku ve o vurmadan önce kontra ya da savunmayı tamamla. Can barı, seri ve puan var; seans sonunda tepki süren, en sık hatan ve zayıf kanalın (kontra mı savunma mı) çıkar. Pose takibi tarayıcıda çalışır, görüntü cihazından çıkmaz.",
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
