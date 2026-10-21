// Self-destructing service worker.
//
// The site no longer registers a service worker: the previous one (v3) cached RSC
// payloads and static assets cache-first, which fights the per-request CSP nonces.
// Browsers that installed it keep running it until a newer /sw.js replaces it, so this
// file has to stay served at /sw.js long enough for returning visitors to pick it up.
//
// On install it activates immediately; on activate it wipes every cache, unregisters
// itself, and reloads any open tabs so they load straight from the network.
//
// Safe to delete after about 2027-03 (a year after the registration was removed).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        // navigate() refetches the page from the network with no worker in control.
        client.navigate(client.url).catch(() => {});
      }
    })(),
  );
});
