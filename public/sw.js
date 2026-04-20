// Minimal service worker: exists only to satisfy Chrome Android's PWA
// installability criteria. No offline cache, no network interception —
// the app is online-only by design (see CLAUDE.md + wiki/conventions.md).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Empty fetch handler: Chrome's install prompt requires the presence of
// a fetch listener, even if it's a passthrough. Returning nothing lets
// the browser handle the request normally.
self.addEventListener('fetch', () => {})
