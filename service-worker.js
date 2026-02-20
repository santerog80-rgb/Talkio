/**
 * TALKIO – service-worker.js
 * PWA Service Worker with Cache & Offline Support
 */
const CACHE_NAME = 'talkio-v1.0.0';
const STATIC_ASSETS = [
  '/', '/index.html', '/chat.html', '/grupo.html', '/chamada.html',
  '/perfil.html', '/editar-perfil.html', '/contatos.html', '/notificacoes.html',
  '/configuracoes.html', '/privacidade.html', '/seguranca.html', '/status.html',
  '/upload.html', '/offline.html', '/erro.html', '/loading.html',
  '/app.js', '/signaling.js', '/grupos.js', '/notificacoes.js', '/i18n.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('http') || url.startsWith('https://fonts')));
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis.com/upload')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/offline.html');
      });
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Talkio', {
      body: data.body || 'Nova mensagem',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: data.url || '/chat.html',
      actions: [{ action: 'open', title: 'Abrir' }, { action: 'close', title: 'Fechar' }],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data || '/chat.html';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(windows => {
    for (const w of windows) { if (w.url === url && 'focus' in w) return w.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
