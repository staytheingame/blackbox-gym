# BlackBox — Box & Fight Gym

BlackBox, boks ve fight sporlarına odaklanan bir salonun tanıtım/üyelik
sitesi. Bu proje, `../kong-academy` reposundan tamamen bağımsız,
`../gym-membership-blueprint` altındaki mimari kararlar referans alınarak
sıfırdan kuruldu. Kong Academy'ye hiçbir bağımlılığı yoktur; ayrı `.git`,
ayrı `node_modules`, ayrı bağımlılıklar kullanır.

## Bu sürümün kapsamı (Faz 1 — izole public site)

- Next.js App Router + TypeScript strict + Tailwind CSS v4.
- Yalnızca statik/mock veriyle beslenen public tanıtım sitesi.
- Sayfalar: Ana Sayfa, Üyelikler, Antrenman Planları, Ekipman, Dersler,
  Antrenörler, İletişim.
- Marka teması: siyah zemin, beyaz yazı, sarı (boks sarısı) vurgu.
- Auth, veritabanı, ödeme, QR giriş, ders rezervasyonu **henüz yok** —
  bkz. [`BACKLOG.md`](./BACKLOG.md).

## Geliştirme

```bash
npm install
npm run dev
```

`http://localhost:3000` adresinde açılır.

```bash
npm run typecheck
npm run lint
npm run build
```

## Klasör yapısı

```text
src/
  app/               # rotalar (App Router)
  components/
    app-shell/       # Header, Footer
    ui/              # PageHero, SectionHeading gibi paylaşılan parçalar
  config/
    navigation.ts    # tek kaynak nav listesi + site bilgisi
  data/              # mock içerik (planlar, ekipman, dersler, antrenörler)
```

## Kaynak

Mimari ve ürün kararları için: `../gym-membership-blueprint/`.
