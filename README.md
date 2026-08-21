# BlackBox — Box & Fight Gym

BlackBox, boks ve fight sporlarına odaklanan bir salonun tanıtım/üyelik
sitesi. Bu proje, `../kong-academy` reposundan tamamen bağımsız,
`../gym-membership-blueprint` altındaki mimari kararlar referans alınarak
sıfırdan kuruldu. Kong Academy'ye hiçbir bağımlılığı yoktur; ayrı `.git`,
ayrı `node_modules`, ayrı bağımlılıklar kullanır.

## Bu sürümün kapsamı

**Faz 1 — izole public site**
- Next.js App Router + TypeScript strict + Tailwind CSS v4.
- Statik/mock veriyle beslenen public tanıtım sitesi.
- Sayfalar: Ana Sayfa, Üyelikler, Antrenman Planları, Ekipman, Dersler,
  Antrenörler, İletişim.
- Marka teması: siyah zemin, beyaz yazı, sarı (boks sarısı) vurgu.

**Faz 2 — üye takip & performans paneli**
- Veritabanı: **Prisma + Supabase Postgres**. (Proje SQLite ile başladı,
  geçiş tamamlandı — bkz. [`SUPABASE-GECIS.md`](./SUPABASE-GECIS.md).)
- Basit yerel oturum: e-posta/şifre (bcrypt) + imzalı httpOnly cookie.
  Public self-signup yok — üyeler `/personel/uyeler`'den personel
  tarafından eklenir.
- **Panel kabuğu:** `/uye/**` ve `/personel/**` tanıtım sitesinin
  Header/Footer'ı içinde değil, kendi kabuğunda açılır (Kong Academy'nin
  `PanelSidebar`/`PanelTabBar` deseni): masaüstünde sabit yan menü,
  mobilde çekmece + alt tab bar. Public sayfalar `app/(site)` route
  group'unda toplandı; kök layout yalnız `<html>/<body>` kurar.
- **Gezinme mimarisi Kong ile birebir:** bölüm → alt sayfa (2 kademe),
  üçüncü kademe yok — alt sekmeler sayfa içinde `?tab=`/`?tur=` ile.
  Personel 8 bölüm, üye 6 bölüm; tek kaynak `src/config/panel-nav.tsx`,
  bölüm şeridi `SectionNav`, bölüm aç/kapa `src/config/feature-flags.ts`.
  Bölüm haritası ve hangi ekranın çalıştığı: [`BACKLOG.md`](./BACKLOG.md).
- Üye paneli (`/uye/**`): özet panosu (skor, puan, lig sırası, check-in
  serisi, son antrenmanlar, rozetler), haftalık check-in formu, antrenman
  logu, performans skor kartı (Kong Academy'nin `scorecard.ts`
  motorundan uyarlanan saf fonksiyon), lig sıralaması, atanan antrenman
  ve kondisyon programları, tartı/sıklet takibi.
- Personel paneli (`/personel/**`): genel bakış (bugünün dersleri, yoklama
  ve check-in kuyrukları), üye listesi ve ekleme (`/personel/uyeler`),
  check-in inceleme (`/personel/check-inler`), üye detayı, antrenman
  loglama, program atama, salon geneli tartı takibi (`/personel/tarti`),
  üyelik & ders hakkı yönetimi (`/personel/uyelikler`).

**Faz 8 — ders programı, rezervasyon ve ders hakkı**
- **Sabit ders takvimi yok:** antrenör boş saatlerini yayımlar
  (`/personel/program`), sporcular ortak tablodan istediğini kapar
  (`/uye/program`). Slot varsayılan olarak birebirdir; dolu bir saate ikinci
  sporcu katılmak isterse istek antrenör onayına düşer
  (`/personel/program/istekler`) ve onaylanınca seans grup dersine döner.
- **Yoklama** (`/personel/program/yoklama`): "geldi" işareti seansın
  süresiyle bir antrenman kaydı yazar — puan, rozet ve gelişim grafiği
  otomatik güncellenir. "Gelmedi" ders hakkını yakar, kayıt üretmez.
- **Üyelik = ders paketi** (ör. 16 ders / 60 gün). Rezervasyon hakkı ayırır,
  yoklama harcar; seanstan önce iptal hakkı geri verir. Uygulamada **ödeme
  takibi yoktur** — yalnız "üyelik ne kadar var, kaç ders kaldı".
- **Gelişim takibi** (`/uye/performans`, sporcu detayı): devamlılık (katılım
  oranı), hacim (son 8 haftanın haftalık dakikası) ve skor geçmişi — üçü
  bilinçli olarak ayrı okunur, tek bir puana ezilmez.
- İş mantığı `src/domain/**` altında saf, Vitest ile test edilen
  fonksiyonlarda (`performance/scorecard.ts`, `gamification/points.ts`,
  `gamification/badges.ts`).
- Auth/veri erişimi yalnız uygulama katmanında korunur
  (`src/lib/auth/guards.ts`) — henüz Postgres RLS yok.

**Faz 9 — davet, hatırlatma, beslenme, analiz ve yönetici paneli**
- **Üç rol, üç panel.** `OrganizationUser.role` artık `member | coach | admin`
  (eski `staff` değeri migration'da `coach`'a çevrildi). Sporcu `/uye`,
  antrenör `/personel`, yönetici `/yonetim` görür; yönetici antrenör
  paneline de girebilir, tersi geçerli değildir. Tek kaynak
  [`src/lib/auth/roles.ts`](./src/lib/auth/roles.ts).
- **Davetle üye kaydı** (Kong Academy'nin `invite_tokens` deseni): antrenör
  sporcuyu ekler, hesap AÇILMAZ; tek kullanımlık `/davet/<token>` bağlantısı
  üretilir (72 saat), sporcu kendi şifresini kurar. Token açık saklanmaz,
  yalnız SHA-256 özeti tutulur. Bekleyenler `/personel/davetler`'de,
  bağlantı kaybolursa yenisi üretilir ve eskisi iptal olur.
- **Ders hatırlatma & bildirim kutusu.** Zamanlanmış iş
  (`/api/cron/hatirlatici`, `vercel.json` ile akşam 20:00 ve sabah 09:00
  Istanbul) her rezervasyon için iki hatırlatma üretir: **dersten bir gün
  önce akşam** ve **dersin olduğu gün sabah**. Ayrıca paket bitiş uyarısı
  (14 gün / 3 ders eşiği) sporcuya ve antrenöre, antrenöre de yarının ders
  özeti gider. İş idempotenttir (`Notification.dedupeKey`) — kaç kez
  çalışırsa çalışsın aynı hatırlatma bir kez düşer.
- **Bildirim kanalları.** Uygulama içi kutu her zaman çalışır
  (`/uye/bildirimler`, `/personel/bildirimler`). E-posta ücretsiz katmanlarla
  bağlanır (Brevo günde 300 / Resend ayda 3.000; ek npm paketi yok, düz HTTP).
  WhatsApp dalı hazır ama sağlayıcı tarafında konuşma başına ücretlidir.
  Sporcu hatırlatmaları kendi panelinden kapatabilir.
- **Günün akışı** (`/personel/bugun`): günün seansları, kimin kayıtlı olduğu,
  kalan ders hakkı, tek dokunuşla yoklama ve "şimdi hatırlat" düğmesi.
  Antrenörün ders arasında telefondan bakacağı tek ekran.
- **Beslenme planları** (Kong Academy'nin `nutrition_plans` modeli): plan →
  öğün → besin. Makro alanları **opsiyonel** — boş "bilinmiyor" demektir,
  sıfır değil. Haftalık döngü için gün seçimi (antrenman/dinlenme günü ayrı
  plan). Sporcu öğünü "yedim" diye işaretler, antrenör uyum yüzdesini görür.
  `/personel/beslenme`, `/uye/beslenme`.
- **Sporcu analizi** (`/personel/uyeler/[id]/analiz`): devamlılık, gelme
  oranı, antrenman hacmi eğilimi, kontrol sürekliliği, kilo, paket yakma
  hızı, program ve beslenme uyumu; her biri kaynağıyla ve önerilen adımla.
  **Teşhis yoktur** — yalnız gözlenen davranış yazılır ve veri azsa güven
  düzeyi açıkça "düşük" denir, uydurma yüzde üretilmez.
- **Yönetici paneli** (`/yonetim`): salon geneli özet, antrenör kadrosu ve rol
  yönetimi, **paket tanımlama formu** (daha önce paketler yalnız seed'den
  geliyordu), doluluk/devamlılık raporları, bildirim kuyruğu dökümü ve
  hatırlatma işini elle çalıştırma.

**Faz 10 — kuşak, onam, bekleme listesi, denetim ve KVKK**

Açık kaynak salon/dojo yazılımlarının (laragym, obikai, VoxelBooking,
GYM-One, gym-management-system, fitness-trainer-crm) özellik setiyle
karşılaştırma sonucu eklenen beş modül:

- **Kuşak & müfredat** (`/personel/kusaklar`, `/uye/kusak`): salona özel
  derece merdiveni (`Rank`), kuşak başına müfredat maddeleri
  (`RankRequirement`), antrenörün madde işaretlemesi (`RequirementCheck`)
  ve append-only terfi kaydı (`MemberRank`). Terfi **otomatik verilmez**:
  üç kapı (müfredat / ders sayısı / süre) ayrı ayrı okunur, karar
  antrenörün (`src/domain/rank/progress.ts`).
- **Onam & sağlık beyanı** (`/personel/onaylar`, `/uye/onaylar`): sağlık
  beyanı, sorumluluk reddi, veli izni ve KVKK metni (`WaiverTemplate`),
  sporcunun elektronik onayı (`MemberWaiver`). Metin sürümü artınca eski
  imza silinmez, "eski" görünür ve yeniden onay istenir. Beyanda "evet"
  işaretlenen maddeler antrenörün ekranına sağlık uyarısı olarak düşer.
  Şu an **uyarı katmanıdır, kapı değil** — imzasız sporcunun rezervasyonu
  engellenmez.
- **Bekleme listesi**: dolu bir seansta yer boşalınca (biri iptal etti)
  kuyruğun başındaki sporcu antrenör onayı beklemeden otomatik geçer ve
  bildirim alır. Kontenjan büyütülmez — o karar hâlâ antrenörün
  (`src/domain/booking/waitlist.ts`).
- **Denetim kaydı** (`/yonetim/kayitlar`): üyelik, yoklama, seans iptali,
  terfi, onam ve dışa aktarma gibi **yazan** işlemler kim/ne zaman/ne
  bilgisiyle `AuditLog` tablosuna düşer. Okuma kaydı tutulmaz.
- **Veri & KVKK** (`/yonetim/kvkk`): altı CSV seti (`/api/export/<tür>`,
  Türkçe Excel için noktalı virgül + BOM), sporcu başına tam veri dökümü
  (`/api/kvkk/<memberId>`, sporcu kendi panelinden de indirir) ve silme
  talebi için anonimleştirme — kimlik alanları silinir, kimliksiz
  istatistik kalır.

**Faz 12 — koç kapsamı, tahsilat ve salon muhasebesi**

Faz 8'de kaldırılan ödeme takibi kullanıcı kararıyla **geri geldi** ve bu kez
salonun tamamını kapsıyor.

- **Her antrenör yalnız kendi sporcusunu görür.** Sporcu kaydında `sorumlu
  antrenör` (`Member.assignedCoachUserId`) alanı var; sporcuyu ekleyen
  antrenör oraya yazılır, yönetici `/yonetim/uyeler` ekranından devreder.
  Kural tek yerde: `src/lib/auth/scope.ts` (`memberWhere` / `slotWhere`).
  Sporcu listeleyen her sorgu bu kapsamı alır — antrenör paneli, menü
  rozetleri, CSV dışa aktarma dahil.
- **Ders saatleri de kapsamlıdır:** antrenör kendi açtığı seansları,
  yoklamasını ve katılım isteklerini görür; yönetici salonun tamamını.
- **Tahsilat** (`Payment`): üyelik başlatılırken anlaşılan tutar yazılır
  (`MemberSubscription.priceMinor`), alınan para ayrı kaydedilir. Borç =
  anlaşılan tutar − tahsilat. Antrenör kendi sporcusundan tahsilat girebilir
  (`/personel/kasa`), yönetici salonun tamamından (`/yonetim/muhasebe/tahsilat`).
- **Gider** (`Expense` + `RecurringExpense`): kira/fatura gibi her ay
  tekrarlayan kalemler şablon olarak tanımlanır, "Bu Ayı İşle" düğmesiyle
  kasaya düşer — iki kez basmak mükerrer kayıt üretmez (`sourceKey` tekildir).
- **Antrenör hakedişi** (`CoachCompensation` + `CoachEarning`): ders başı
  ücret, paket gelirinden yüzde, sabit maaş ya da karma. Ders başı hakediş
  yoklama işaretlenince **seans başına** (kişi başına değil) doğar; gelir payı
  tahsilat girilince. Tutar doğduğu anda dondurulur — oranı sonradan
  değiştirmek geçmiş ayı bozmaz. Ödeme yapıldığında (`CoachPayout`) kasaya
  "hakediş" kaleminde gider yazılır: salon parayı **çıktığı gün** görür.
- **Dönem raporu**: kasa, tahsilat, gider ve hakediş ekranlarının hepsinde
  günlük / haftalık / aylık seçici var (`?donem=gun|hafta|ay&kayma=-1`).
  Sınırlar salon saat diliminde kesilir. Hakediş ekranı antrenör başına
  verilen ders sayısını ve sözleşmedeki **aylık ders hakkının** kalanını
  gösterir.
- Para her yerde **kuruş** tutulur; hesap `src/domain/finance/**` içinde saf
  fonksiyonlarda (53 test).

**Faz 3 — browser tabanlı performans araçları**
- `/araclar` — public (giriş gerektirmez), tamamen client-side üç araç.
- `/araclar/kamera-fight-lab`: tek rotada Boxing Lab ve Wrestling Lab. Ortak webcam + MediaPipe Pose çekirdeği; Boxing reaction/decision/motion/defense protokolleri ile Wrestling W0–W15, Weekly Benchmark ve custom Coach Test'i sunar. Wrestling geçmişi sürüm/hash uyumlu türetilmiş sayısal seanslar olarak yalnız IndexedDB'de tutulur; kamera görüntüsü yüklenmez veya kaydedilmez.
- `/araclar/sesli-refleks`: boks hamlesini Web Speech API ile Türkçe
  seslendiren, tepki süresini ölçen combo-caller trainer.
- `/araclar/dovus-analitigi`: yüklenen videoyu `@mediapipe/tasks-vision`
  (PoseLandmarker, WASM) ile **tamamen tarayıcıda** işleyip guard/ayak
  işi/kafa hareketi/duruş metrikleri çıkaran basitleştirilmiş analiz
  motoru — video hiçbir sunucuya gönderilmez. Kong Academy'nin ayrı
  Python/Railway fight-analytics backend'i **kullanılmadı** (kod olarak
  da mevcut değildi/devre dışıydı) — yalnızca Kong'un kendi client-side
  MediaPipe implementasyonu (`FightAnalyticsDashboard.tsx`) referans
  alındı.
- İş mantığı `src/domain/reflex/**` ve `src/domain/fight-analytics/**`
  içinde saf fonksiyonlarda, Vitest ile test edilir.
- Ana sayfada ("Araçlar" bölümü, hero'dan hemen sonra) ve ana nav'da öne
  çıkarılır.

QR ile salona giriş **henüz yok** — bkz. [`BACKLOG.md`](./BACKLOG.md).

## Geliştirme

```bash
npm install
cp .env.example .env.local   # Supabase bağlantısı + SESSION_SECRET
npx prisma migrate deploy    # şemayı veritabanına uygular
npm run db:seed              # sentetik test verisi (personel + 1 test üye)
npm run dev
```

`http://localhost:3000` adresinde açılır. Test girişleri:
`personel@blackbox.test` / `uye@blackbox.test`, şifre `test1234`
(sentetik, silinebilir — bkz. `BACKLOG.md`).

```bash
npm run typecheck
npm run lint
npm run build
npm run test        # Vitest — domain katmanı unit testleri
npm run test:e2e    # Playwright — Chrome/Edge kritik UI akışları
```

### Zamanlanmış hatırlatma (cron)

Ders hatırlatmaları `/api/cron/hatirlatici` ucundan üretilir. `vercel.json`
bunu günde iki kez çağırır — **saatler UTC yazılıdır**, Istanbul karşılığı:

| vercel.json | Istanbul | Ne üretir |
| --- | --- | --- |
| `0 17 * * *` | 20:00 | Ertesi günün ders hatırlatmaları + antrenörün gün özeti |
| `0 6 * * *`  | 09:00 | O günün ders hatırlatmaları |

Her iki çalışmada paket bitiş uyarıları da kontrol edilir ve süresi dolmuş
üyelikler kapatılır. İş idempotenttir: uç kaç kez çağrılırsa çağrılsın aynı
hatırlatma bir kez düşer (`Notification.dedupeKey`).

Üretimde `CRON_SECRET` tanımlanmalıdır — Vercel Cron `Authorization: Bearer`
başlığını kendiliğinden gönderir. Yerelde elle denemek için:

```bash
curl http://localhost:3000/api/cron/hatirlatici
```

Vercel dışına dağıtılırsa aynı ucu çağıran bir zamanlayıcı kurulmalıdır;
yoksa hatırlatma üretilmez (bkz. [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md)).

### Bildirim e-postası (ücretsiz)

Uygulama içi bildirim kutusu her zaman çalışır. E-posta ile de göndermek
için `.env.local` içine **birini** yaz — ek npm paketi gerekmez:

```bash
NOTIFY_FROM_EMAIL="bildirim@salonunalanadi.com"
BREVO_API_KEY="..."     # günde 300 e-posta, süresiz ücretsiz
# ya da
RESEND_API_KEY="..."    # ayda 3.000 e-posta ücretsiz
```

Gönderen adresin sağlayıcıda doğrulanmış olması gerekir. Hangi kanalın açık
olduğunu `/yonetim/bildirimler` ekranı yazar.

## Klasör yapısı

```text
prisma/
  schema.prisma      # Postgres şema (identity, members, check-ins, training,
                      # performance, gamification, plans, memberships, weight,
                      # davet, bildirim, beslenme, maliye: tahsilat/gider/hakediş)
  seed.mjs            # sentetik test verisi
src/
  app/
    layout.tsx         # kök: yalnız <html>/<body> + fontlar
    (site)/            # public tanıtım sitesi (Header/Footer burada)
      page.tsx, uyelikler/, ekipman/, araclar/, ...
    giris/             # panel girişi (tek işe odaklı ekran)
    davet/[token]/     # sporcu kendi şifresini kurar (giriş gerektirmez)
    api/cron/          # zamanlanmış işler — hatirlatici
    uye/**             # sporcu paneli (özet, ders programı & rezervasyon,
                       # üyelik/ders hakkı, antrenman, kondisyon, beslenme,
                       # tartı, check-in, performans & gelişim, lig,
                       # bildirimler)
    personel/**        # antrenör paneli (genel bakış, bugün, sporcular,
                       # davetler, ders programı/istekler/yoklama, planlar,
                       # beslenme, tartı, check-inler, sporcu analizi,
                       # üyelikler, kasam = hakediş + tahsilat, bildirimler)
                       # HEPSİ kapsamlıdır: antrenör yalnız kendi sporcusunu görür
    yonetim/**         # yönetici paneli (genel bakış, kadro + hakediş ayarı,
                       # sporcular + antrenör devri, paketler, kasa
                       # (özet/tahsilat/giderler/hakediş), raporlar,
                       # bildirim kuyruğu)
  components/
    app-shell/         # public site Header, Footer
    panel/             # PanelShell, PanelSidebar, PanelTabBar, PanelTopbar,
                       # PlanWeek (program haftası kartları),
                       # ui.tsx (PanelPage/PanelCard/StatCard/Pill), icons
    ui/                # PageHero, SectionHeading (public site)
  config/
    navigation.ts       # tek kaynak public nav listesi + site bilgisi
    panel-nav.tsx       # panel menüsü — yan menü ve alt tab bar aynı listeden;
                        # feature flag varsayılanları da burada
  data/                 # public site mock içeriği
  domain/               # saf iş mantığı — DB bilmez, Vitest ile kaplı
    booking/             # credits.ts (ders hakkı + rezervasyon kuralları)
    finance/              # money.ts (kuruş + TR biçim), earnings.ts (hakediş),
                          # dues.ts (üyelik borcu), ledger.ts (gelir/gider),
                          # period.ts (günlük/haftalık/aylık dönem)
    notifications/        # kinds.ts (metinler), schedule.ts (hatırlatma anı)
    nutrition/             # plan.ts (makro toplamı, öğün uyumu, gün eşleşmesi)
    analysis/               # member-analysis.ts (sporcu analizi — teşhis yok)
    performance/             # scorecard.ts, progress.ts (gelişim özeti)
    gamification/          # points.ts, badges.ts
    plans/                  # workload.ts (program günü -> antrenman kaydı)
    weight/                  # cut.ts (güvenli sıklet düşüşü)
    reflex/                   # sesli refleks: hamle listesi, seçim, özet
    fight-analytics/           # video pose landmark -> metrik hesaplama
  lib/
    auth/                 # session, guards, roles, password, server actions
                          # scope.ts = "kim kimi görür" TEK kaynağı
    jobs/                  # reminders.ts (zamanlanmış hatırlatma işi)
    notifications/          # channels.ts (uygulama içi / e-posta / WhatsApp)
    queries/                 # Prisma + domain'i birleştiren adapter katmanı
    date.ts                 # hafta sınırı — Europe/Istanbul
    db.ts                   # tekil PrismaClient
    tts.ts                  # tarayıcı Web Speech API sarmalayıcı
```

## Kaynak

Mimari ve ürün kararları için: `../gym-membership-blueprint/`.

<!-- vercel git baglanti testi -->
