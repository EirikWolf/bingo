/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker
// Must live at the root to handle push notifications in background
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBreb3O7YfRoRHYkGOCqjjog0P73WnX1-I',
  authDomain: 'bingo-42fe1.firebaseapp.com',
  projectId: 'bingo-42fe1',
  storageBucket: 'bingo-42fe1.firebasestorage.app',
  messagingSenderId: '58246205061',
  appId: '1:58246205061:web:2285b34eaa68453a0123ec',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = payload.notification?.title ?? 'BingoPortalen';
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: { url: payload.fcmOptions?.link ?? '/' },
  };
  self.registration.showNotification(title, options);
});

// Open the app when notification is clicked
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      // Focus existing window if possible
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
