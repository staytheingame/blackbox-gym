/* BlackBox — service worker.
 *
 * Bilerek TEK işi var: internet yokken beyaz hata sayfası yerine "çevrimdışısın"
 * ekranı göstermek. Sayfaları ya da veriyi ÖNBELLEĞE ALMAZ: panelde sağlık
 * notu, telefon, ödeme gibi kişisel veri var; ortak bir telefonda ya da
 * bilgisayarda çıkış yapıldıktan sonra eski sayfaların önbellekten açılması
 * bir veri sızıntısı olurdu. Yani: her zaman ağdan, ağ yoksa çevrimdışı ekran.
 */
const CACHE = "blackbox-offline-v1";
const OFFLINE_URL = "/cevrimdisi.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("blackbox-offline-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Yalnız sayfa gezintisi. API, form gönderimi ve dosyalara dokunulmaz.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const offline = await caches.match(OFFLINE_URL);
      return (
        offline ||
        new Response("Çevrimdışısın. İnternete bağlanınca tekrar dene.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
