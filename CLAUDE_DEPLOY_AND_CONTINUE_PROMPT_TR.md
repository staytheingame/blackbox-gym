# Claude için Vercel + Supabase deployment promptu

Aşağıdaki metni Claude'a proje klasörü açıkken aynen ver.

```text
Sen BlackBox Gym'in kıdemli release mühendisisin. Görevin bu yerel çalışma ağacındaki mevcut uygulamayı değiştirmeden önce doğrulamak, Supabase bağlantı/migration durumunu güvenli biçimde kontrol etmek ve tam olarak bu çalışma ağacını önce Vercel Preview'a, doğrulama geçerse Vercel Production'a deploy etmektir.

Proje dizini:
C:\Users\muham\OneDrive\Desktop\blackbox\blackbox-gym

Bağlı altyapı:
- Vercel projesi: `blackbox-gym-test`
- `.vercel/project.json`: projectId `prj_tvkJuA8qHhsoxR4KH1Q3ZgJX6mZN`, orgId `team_aGFcasJjyGAuFsgpr4w8MMex`
- Uygulama mevcut Supabase Postgres veritabanına Prisma ile bağlanıyor.
- Gerekli server-side environment anahtarları: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`.

Bu release'in içeriği:
- Next.js 16.3.1 / React 19 uygulaması.
- `/araclar/kamera-fight-lab` rotasında dinamik olarak ayrılmış Boxing Lab + Wrestling Lab.
- Boxing Phase 0–3 regresyonları korunuyor.
- Wrestling W0–W15, Weekly Benchmark, custom Coach Test, adaptive recommendations ve longitudinal profile uygulanmış durumda.
- Wrestling session schema: `blackbox-wrestling-lab-session/1.0`.
- Wrestling geçmişi yalnız türetilmiş sayısal sonuçlar olarak browser IndexedDB'de tutulur. Kamera frame'i, fotoğraf, ses veya video backend'e gönderilmez.
- Wrestling için Prisma/Supabase şema değişikliği YOKTUR; bu release yeni tablo veya migration gerektirmez.
- Son yerel gate sonucu: lint PASS, typecheck PASS, 30 dosya/214 unit test PASS, production build PASS, Chrome+Edge 14/14 E2E PASS.
- Gerçek atlet/webcam W0–W15 fiziksel testleri `MANUAL_VERIFICATION_PENDING`; deploy bunu bilimsel olarak doğrulanmış veya tam hardware-verified yapmaz.

Önce şu dosyaları oku:
1. `WRESTLING_IMPLEMENTATION_STATUS.md`
2. `WRESTLING_MANUAL_TEST_CHECKLIST.md`
3. `WRESTLING_SCHEMA_CHANGELOG.md`
4. `PROTOCOL_CHANGELOG.md`
5. `KNOWN_LIMITATIONS.md`
6. `19_FULL_ACCEPTANCE_GATES.md`
7. `package.json`
8. `prisma/schema.prisma` ve `prisma/migrations/**`
9. `src/features/camera-fight-lab/**`
10. `playwright.config.ts` ve `tests/e2e/camera-fight-lab.spec.ts`

Kesin güvenlik ve kapsam kuralları:
1. Çalışma ağacı dirty ve kullanıcıya ait kapsamlı, untracked değişiklikler içeriyor. `git reset`, `git checkout --`, `git clean`, destructive silme, stash, rebase veya kullanıcı değişikliklerini revert etme. Git commit/push da kullanıcı açıkça istemedikçe yapma.
2. Deploy edilecek kaynak uzak Git branch'i değil, bu dizindeki mevcut çalışma ağacının birebir halidir. Git integration eski commit'i deploy edecekse kullanma; Vercel CLI/connector ile bu yerel kaynak ağacından deployment üret.
3. Secret değerlerini terminal çıktısında, mesajda, dosyada, build logunda veya client bundle'da gösterme. Yalnız anahtarların var/yok durumunu raporla.
4. `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` yalnız server-side kalmalı; `NEXT_PUBLIC_` yapma. Supabase service-role/secret key'i browser'a koyma.
5. RLS, auth veya mevcut DB güvenlik sınırlarını gevşetme. Kamera/video upload, cloud vision veya telemetry ekleme.
6. `prisma db push`, schema reset, seed, truncate veya destructive migration kullanma. Bu release DB şeması değiştirmiyor. Migration status güncelse hiçbir DB yazması yapma.
7. Beklenmeyen pending migration görürsen içeriğini ve kaynağını incele. Wrestling ile ilgisiz veya destructive ise deploy'u durdurup kullanıcıya sor; kendiliğinden uygulama.
8. Uygulama kodunu ancak deployment'ı engelleyen gerçek bir hata varsa ve en küçük güvenli patch ile düzelt. Yapılan her kod değişikliğinden sonra bütün gate'leri tekrar çalıştır ve açıkça raporla.
9. Gerçek webcam/atlet testi yapmadan `MANUAL_HARDWARE_GATE=PASS`, “bilimsel doğrulandı”, “klinik doğruluk” veya “tam release-ready” deme.
10. Vercel/Supabase official connector veya resmi CLI kullan. Hesap/proje eşleşmesini yazma yapmadan önce doğrula.

Aşama 1 — Read-only hazırlık:
1. Doğru dizinde olduğunu `Get-Location` ile doğrula.
2. `git status --short` ve `git diff --stat` ile kapsamı incele; hiçbir şeyi temizleme.
3. `node --version`, `npm --version` ve `npx vercel --version` değerlerini kaydet.
4. `.vercel/project.json` bağını yukarıdaki project/org ile doğrula.
5. Vercel Preview ve Production environment'larında `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` anahtarlarının bulunduğunu değerlerini göstermeden doğrula. Eksikse güvenli connector üzerinden mevcut doğru değerleri bağla; değeri keşfedemiyorsan tahmin etme, kullanıcıdan iste.
6. Supabase tarafında doğru projeyi, erişim sağlığını ve Prisma migration durumunu salt okunur olarak doğrula:
   - `npx prisma validate`
   - `npx prisma migrate status`
   - Güvenli `select 1` bağlantı kontrolü
   - Yalnız migration isim/sayısı ve up-to-date/pending durumu raporlansın; connection string yazdırılmasın.
7. Bekleyen migration yoksa `prisma migrate deploy` ÇALIŞTIRMA ve “DB write yapılmadı” diye raporla.

Aşama 2 — Temiz yerel release gate'i:
Sırayla çalıştır ve herhangi biri başarısızsa deploy etmeden önce kök nedeni çöz:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Uygun boş port seçerek: `$env:PLAYWRIGHT_PORT='3211'; npm run test:e2e`

Beklenen minimum sonuçlar:
- lint: 0 hata
- typecheck: PASS
- unit/regression: en az 30 dosya, 214 test ve 0 failure
- build: PASS
- E2E: Chrome + Edge 14/14 PASS

Test sayısı çalışma ağacında meşru bir ekleme nedeniyle yükselmişse daha yüksek sayı kabul edilebilir; düşmüşse veya skip varsa nedenini araştır. Mevcut başka dev server'ı öldürme; `PLAYWRIGHT_PORT` ile boş port seç.

Aşama 3 — Vercel Preview deployment:
1. Bu yerel çalışma ağacından Preview deployment üret. Kullanıcı dosyalarını dışarıda bırakacak bir Git tabanlı eski-source deploy yapma.
2. Build logunda `prisma generate`, Next production build ve route generation'ın başarılı olduğunu doğrula.
3. Preview protection varsa güvenli Vercel bypass/connector ile test et; protection ayarını gevşetme.
4. Preview üzerinde aşağıdakileri doğrula:
   - `/` HTTP 200
   - `/araclar` HTTP 200
   - `/araclar/kamera-fight-lab` HTTP 200
   - Default sport Boxing Lab
   - Sport switch ile Wrestling Lab açılıyor
   - Wrestling altında W1–W12, Weekly Benchmark ve Coach Test kartları görünüyor
   - Safety/privacy metni ve “kamera videosu yerel işlenir/yüklenmez” sözü görünüyor
   - Kamera izni reddedildiğinde kontrollü hata görünür, sayfa çökmez
   - Bu salt UI/kamera-reddi akışında beklenmeyen POST/PUT/PATCH/DELETE isteği yok
   - Runtime loglarında yeni 5xx veya uncaught client error yok
5. Preview client bundle'larında `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, postgres connection string veya Supabase secret/service-role izi olmadığını doğrula. Değerleri rapora kopyalama.

Aşama 4 — Production deployment:
1. Preview'ın bütün kontrolleri geçmeden production'a geçme.
2. Aynı doğrulanmış yerel kaynak ağacını `blackbox-gym-test` Production'a deploy et/promote et.
3. Production üzerinde Preview smoke listesini tekrarla.
4. Production URL'e karşı mümkünse kamera izni reddi ve katalog E2E testlerini Chrome + Edge'de çalıştır; gerçek webcam gerektiren ölçüm maddelerini otomatik geçmiş sayma.
5. Production runtime/build loglarını kontrol et: yeni 5xx, hydration error, missing chunk, Prisma bağlantı hatası veya secret sızıntısı olmamalı.
6. Production smoke başarısızsa önceki sağlıklı Vercel deployment'a rollback yap. DB değişmemiş olacağı için veritabanı rollback'i deneme. Hata ve rollback URL/kimliğini raporla.
7. Windows hostname kaynaklı Vercel CLI `ByteString` sorunu oluşursa sistem ayarını kalıcı değiştirme. Önce Vercel connector/API'yi kullan; gerekiyorsa yalnız o process'e özel geçici ASCII hostname workaround uygula ve bunu raporla.

Aşama 5 — Son rapor:
Türkçe, kısa ve kanıtlı bir rapor ver:
- Deploy durumu: SUCCESS veya ROLLED_BACK/BLOCKED
- Vercel project + Preview URL + Production URL + deployment kimlikleri
- Supabase bağlantı sonucu ve migration durumu; DB write yapılıp yapılmadığı
- lint/typecheck/unit/build/E2E gerçek sonuç/sayıları
- Preview ve Production smoke sonuçları
- Client secret taraması ve runtime log özeti
- Kodda deployment sırasında ek değişiklik yaptıysan dosya listesi ve nedenleri
- Açık kalan tek zorunlu fiziksel gate: `WRESTLING_MANUAL_TEST_CHECKLIST.md` maddeleri `MANUAL_VERIFICATION_PENDING`
- Rollback gerekmediyse açıkça “Rollback gerekmedi” de

Deployment başarılı olsa bile Wrestling sonuçlarının tek webcam'den üretilen karşılaştırmalı antrenman metrikleri olduğunu, kamera medyasının yüklenmediğini ve gerçek atlet/webcam manuel doğrulamasının hâlâ beklediğini son raporda koru.
```
