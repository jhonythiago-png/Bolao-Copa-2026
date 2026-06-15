// Service Worker — Bolão Copa 2026
// Atualização silenciosa a cada 30 segundos

const CACHE_NAME = 'bolao-copa-2026-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH — Network first para HTML/JS/CSS, cache fallback =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase e APIs externas — sempre network, nunca cachear
  if (url.hostname.includes('supabase') || 
      url.hostname.includes('api-sports') || 
      url.hostname.includes('football-data') ||
      url.hostname.includes('fonts.')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Arquivos estáticos — network first, cache fallback
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// ===== SYNC SILENCIOSO A CADA 30s (Background Sync) =====
// Envia mensagem para todas as abas ativas a cada 30s
let syncInterval = null;

function startSilentSync() {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'SILENT_SYNC' });
    });
  }, 30000);
}

self.addEventListener('message', event => {
  if (event.data?.type === 'START_SYNC') {
    startSilentSync();
  }
  if (event.data?.type === 'STOP_SYNC') {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  }
});

// Inicia ao ativar
self.addEventListener('activate', () => startSilentSync());
