var CACHE = "tartan-v2";

var ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/data.js",
    "./js/utils.js",
    "./js/parser.js",
    "./js/generator.js",
    "./js/renderer.js",
    "./js/ui.js",
    "./assets/icon.png",
    "./assets/og-image.png",
    "./assets/favicon.ico",
    "./assets/favicon-16x16.png",
    "./assets/favicon-32x32.png",
    "./assets/favicon-128x128.png",
    "./assets/favicon-192x192.png",
    "./assets/apple-touch-icon.png",
];

self.addEventListener("install", function (e) {
    e.waitUntil(
        caches.open(CACHE).then(function (c) {
            return c.addAll(ASSETS);
        }),
    );
    self.skipWaiting();
});

self.addEventListener("activate", function (e) {
    e.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (k) {
                        return k !== CACHE;
                    })
                    .map(function (k) {
                        return caches.delete(k);
                    }),
            );
        }),
    );
    self.clients.claim();
});

self.addEventListener("fetch", function (e) {
    e.respondWith(
        caches.match(e.request).then(function (r) {
            return r || fetch(e.request);
        }),
    );
});
