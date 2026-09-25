const CACHE_NAME = 'sei-analista-shell-v4';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/mascote-analista.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Requisições da API e chamadas para IA nunca entram no cache: são dados vivos e sensíveis.
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com')) return;
  // Prioriza sempre o arquivo atual. O cache só é usado se o servidor local estiver
  // indisponível, para que alterações em HTML/CSS/JS apareçam ao reabrir ou atualizar.
  event.respondWith(
    fetch(event.request).then(response => {
      if (url.origin === self.location.origin && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
