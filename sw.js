const CACHE_NAME = 'pipe-luu-v15'; // CAMBIA LA VERSIÓN CADA VEZ QUE ACTUALICES
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js' // ← AÑADIR
];

// Instalación
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos cacheados');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); // Fuerza activación inmediata
});

// Activación: Limpia cachés viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(thisCacheName => {
          if (thisCacheName !== CACHE_NAME) {
            console.log('Borrando caché vieja:', thisCacheName);
            return caches.delete(thisCacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Toma control de todas las pestañas
  );
});

// Fetch: Siempre intenta red primero, si falla usa caché
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, actualiza la caché
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay internet, usa la caché
        return caches.match(event.request);
      })
  );
});
