/* Service Worker — يجعل بيتي POS يعمل بدون إنترنت (يُفعَّل فقط عند التشغيل عبر خادم أو استضافة) */
const CACHE = 'bayti-pos-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .catch(() => {})
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* الصفحة: الشبكة أولاً حتى تصل التحديثات، والكاش عند انقطاع النت */
  if (sameOrigin && (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'))){
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok){
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  /* بقية الأصول: الكاش أولاً ثم الشبكة */
  if (sameOrigin){
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic'){
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached))
    );
  }
});
