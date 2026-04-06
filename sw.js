// ── Service Worker — ระบบจองรถ PWA ──
const CACHE = 'booking-v2';

self.addEventListener('install', e => {
  // cache เฉพาะที่แน่ใจว่ามีอยู่จริง
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      './',
      './manifest.json',
    ]).catch(err => console.warn('Cache addAll partial fail:', err)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // ไม่ cache request ไป Google Apps Script และ Google Fonts
  if (e.request.url.includes('script.google.com')) return;
  if (e.request.url.includes('fonts.googleapis.com')) return;
  if (e.request.url.includes('fonts.gstatic.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (e.request.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
