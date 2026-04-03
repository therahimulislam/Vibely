const CACHE_NAME = 'vibely-shell-v3';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const NEVER_CACHE_PATH_PREFIXES = ['/api', '/socket.io'];
const NETWORK_FIRST_DESTINATIONS = new Set(['script', 'style', 'document', 'font', 'worker']);

const isCacheableResponse = (response) =>
    response && response.status === 200 && ['basic', 'default', 'cors'].includes(response.type);

const shouldBypassCache = (requestUrl) =>
    NEVER_CACHE_PATH_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix));

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (shouldBypassCache(url)) {
        return;
    }

    const isNavigation = event.request.mode === 'navigate';
    const isNetworkFirstAsset =
        NETWORK_FIRST_DESTINATIONS.has(event.request.destination)
        || url.pathname.startsWith('/assets/')
        || url.pathname.endsWith('.js')
        || url.pathname.endsWith('.css');

    if (isNavigation || isNetworkFirstAsset) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (isCacheableResponse(response)) {
                        const responseClone = response.clone();
                        const cacheKey = isNavigation ? '/' : event.request;
                        caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, responseClone));
                    }
                    return response;
                })
                .catch(async () => {
                    const fallback = await caches.match(isNavigation ? '/' : event.request);
                    return fallback || Response.error();
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (!isCacheableResponse(response)) {
                    return response;
                }

                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                return response;
            });
        })
    );
});
