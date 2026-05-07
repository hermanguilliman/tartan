var CACHE = "tartan-v1";

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
    "./assets/favicon-light-32.png",
    "./assets/favicon-light-128.png",
    "./assets/favicon-light-180.png",
    "./assets/favicon-light-192.png",
    "./assets/favicon-dark-32.png",
    "./assets/favicon-dark-128.png",
    "./assets/favicon-dark-180.png",
    "./assets/favicon-dark-192.png",
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
