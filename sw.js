// Kaartbeheer service worker: alles lokaal bewaren zodat de app offline werkt.
// Het buildnummer wordt bij elke deploy ingevuld, zodat elke nieuwe versie een verse cache krijgt.
const CACHE = 'kaartbeheer-__BUILD__';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './vendor/tesseract.min.js',
  './vendor/jsbarcode.min.js',
  './vendor/qrcode.js',
  './vendor/zxing.min.js',
  './vendor/worker.min.js',
  './vendor/core/tesseract-core-lstm.wasm.js',
  './vendor/core/tesseract-core-simd-lstm.wasm.js',
  './vendor/lang/eng.traineddata.gz'
];

// cache: 'reload' omzeilt de browsercache (GitHub Pages bewaart bestanden 10 minuten),
// zodat een nieuwe versie nooit de vorige pagina opslaat.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isPage = (req) => req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);

// De pagina zelf: eerst het netwerk (zodat je altijd de nieuwste versie krijgt),
// zonder netwerk of na 4 seconden de bewaarde versie.
function pageFirstNetwork(req) {
  const fromCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'));
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000)).then(fromCache);
  return Promise.race([net.catch(fromCache), timeout]).then((res) => res || net);
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (isPage(e.request)) { e.respondWith(pageFirstNetwork(e.request)); return; }
  // Overige bestanden (scanbibliotheken, iconen) veranderen zelden: eerst uit de cache.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
