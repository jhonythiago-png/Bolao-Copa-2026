// Service Worker — Bolão Copa 2026
// Estratégia: Network First para tudo — sempre busca versão mais nova

const CACHE_NAME = 'bolao-copa-2026-v1';

// Arquivos que NUNCA devem ser cacheados (mudam com frequência)
const NO_CACHE = ['app.js', 'style.css', 'index.html', 'sw.js'];

self.addEventListener('install', event => {
  self.skipWaiting(); // ativa imediatamente sem esperar fechar abas
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // limpa TODO cache antigo
    )
  );
  self.clients.claim(); // assume controle imediato de todas as abas
});

// Network First — sempre tenta buscar da rede primeiro
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora extensões do Chrome e requisições não-GET
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // APIs externas — sempre network, nunca cachear
  if (url.hostname.includes('supabase') ||
      url.hostname.includes('football-data') ||
      url.hostname.includes('fonts.')) {
    event.respondWith(fetch(event.request));
    return;
  }

  const fileName = url.pathname.split('/').pop();
  const naoCache = NO_CACHE.some(f => fileName === f || url.pathname.endsWith(f));

  if (naoCache) {
    // Network only — nunca usa cache para esses arquivos
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request)) // fallback offline
    );
  } else {
    // Ícones e assets estáticos — cache normal
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

// Sync silencioso a cada 30s para todas as abas
let syncInterval = null;
function startSilentSync() {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'SILENT_SYNC' }));
  }, 30000);
}

self.addEventListener('message', event => {
  if (event.data?.type === 'START_SYNC') startSilentSync();
  if (event.data?.type === 'STOP_SYNC') {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  }
});

self.addEventListener('activate', () => startSilentSync());
