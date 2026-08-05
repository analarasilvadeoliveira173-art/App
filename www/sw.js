/* ============================================================
   EKKLESIA MUSIC — service worker
   Guarda a "casca" do aplicativo para que ele abra mesmo sem
   internet. Dados do Supabase NUNCA entram no cache: eles mudam
   o tempo todo e mostrar uma escala velha seria pior do que
   avisar que está offline.
   ============================================================ */
const CACHE = 'ekklesia-music-v1';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icone.svg'];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Chamadas de dados e de outras origens passam direto para a rede.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/rest/v1/')) return;

  // O HTML vem da rede quando possível, para a pessoa receber as novidades.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    evento.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Demais arquivos locais: responde do cache e atualiza em segundo plano.
  evento.respondWith(
    caches.match(req).then(cacheado => {
      const rede = fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
