/* Service worker: aplikasi tetap bisa dibuka tanpa internet.
   Naikkan VERSION setiap kali file aplikasi diubah agar HP pengguna mengambil versi baru. */
const VERSION = "pmm-v4";
const SHELL = ["./", "index.html", "style.css", "app.js", "logo.js", "manifest.json",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-64.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Online: ambil versi terbaru lalu simpan. Offline: pakai simpanan.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
