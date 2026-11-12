// Kill-switch service worker.
// A third-party push-ad service worker used to be served from this path. Browsers that
// registered it keep re-checking /sw.js, so this replacement takes over, clears caches,
// unregisters itself and reloads open tabs. Keep this file for a few months, then delete it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* ignore */ }
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
