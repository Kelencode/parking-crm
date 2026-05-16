console.log('[SW] версия: 2.0, время:', new Date().toISOString());

self.addEventListener('install',  e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.url.includes('127.0.0.1:8000')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
  }
});

self.addEventListener('push', function(event) {
  console.log('[SW] push получен, время:', new Date().toISOString());
  console.log('[SW] event.data:', event.data ? event.data.text() : '(no payload)');

  let title = 'Уведомление';
  let body  = '';
  let data  = {};

  try {
    data  = event.data ? event.data.json() : {};
    title = data.title || title;
    body  = data.body  || body;
  } catch(e) {
    body = event.data ? event.data.text() : '';
  }

  const options = {
    body,
    icon:               '/icon-192.png',
    badge:              '/icon-96.png',
    tag:                data.tag || 'parking-crm',
    renotify:           true,
    requireInteraction: true,
    data:               { url: data.url || '/incidents' },
  };

  console.log('[SW] calling showNotification:', title, '|', body);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] notification shown OK'))
      .catch(err => {
        console.error('[SW] showNotification failed:', err);
        // fallback — без иконок, только текст
        return self.registration.showNotification(title, { body, requireInteraction: true });
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/incidents';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes(url) && 'focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
