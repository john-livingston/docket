const STATIC_CACHE = 'static-v4';
const BASE = new URL('.', self.location).pathname;

const staticAssets = [
    BASE,
    BASE + 'index.html',
    BASE + 'manifest.json',
    BASE + 'sw.js',
    BASE + 'offline.html',
    BASE + 'icon-192.png',
    BASE + 'icon-512.png',
    BASE + 'react.production.min.js',
    BASE + 'react-dom.production.min.js',
    BASE + 'babel.min.js'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(staticAssets))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip cross-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }
    
    // Handle navigation requests (page loads)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Cache the new response
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        return caches.open(STATIC_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(response => response || caches.match(BASE + 'offline.html'))
                        .then(res => res || new Response('Offline', { status: 503 }));
                })
        );
        return;
    }
    
    // Handle other requests (images, scripts, etc.)
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            return caches.open(STATIC_CACHE).then((cache) => {
                                cache.put(request, responseClone);
                                return networkResponse;
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        if (request.headers.get('accept')?.includes('text/html')) {
                            return caches.match(BASE + 'offline.html').then(res => res || new Response('Offline', { status: 503 }));
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({ 'Content-Type': 'text/plain' })
                        });
                    })
            })
    );
});
