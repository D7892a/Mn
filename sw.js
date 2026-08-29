/* Service Worker — يخزّن النظام ليعمل بدون إنترنت (يُستخدم فقط عند تشغيل الموقع عبر خادم محلي أو استضافة) */
const CACHE = 'mst-pos-v3.1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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

    // صفحة التطبيق نفسها (index.html): الشبكة أولًا حتى تصل آخر التحديثات فورًا، والكاش احتياط عند انقطاع النت
    if (sameOrigin && (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html'))) {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
        );
        return;
    }

    // بقية الأصول المحلية: الكاش أولًا ثم الشبكة
    if (sameOrigin) {
        e.respondWith(
            caches.match(req, { ignoreSearch: true }).then((hit) => {
                const net = fetch(req)
                    .then((res) => {
                        if (res && res.ok) {
                            const clone = res.clone();
                            caches.open(CACHE).then((c) => c.put(req, clone));
                        }
                        return res;
                    })
                    .catch(() => hit || caches.match('./index.html'));
                return hit || net;
            })
        );
        return;
    }

    // الخطوط الخارجية (Google Fonts): شبكة أولًا مع تراجع للكاش حتى يعمل الوضع الليلي/الخط عند انقطاع الإنترنت
    if (/fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req))
        );
    }
});

self.addEventListener('message', (e) => {
    if (e.data === 'skip-waiting') self.skipWaiting();
});
