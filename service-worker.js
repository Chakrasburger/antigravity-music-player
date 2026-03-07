const CACHE_NAME = 'neon-music-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // React & ReactDOM
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  // Babel standalone
  'https://unpkg.com/@babel/standalone/babel.min.js',
  // jsmediatags
  'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js',
  // Tailwind CSS
  'https://cdn.tailwindcss.com',
  // Lucide Icons
  'https://unpkg.com/lucide@latest'
];

// Instalar el Service Worker y guardar en caché el "App Shell"
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caché abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar las peticiones y responder con la caché si es posible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve la respuesta caché si se encuentra, si no hace fetch a la red
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Actualizar el Service Worker y eliminar cachés antiguas
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
