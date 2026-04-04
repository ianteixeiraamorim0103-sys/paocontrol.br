importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDezizLByX7O-h5_T5STFoi3l33iSB19zY",
  authDomain: "paocontrol-d28ec.firebaseapp.com",
  projectId: "paocontrol-d28ec",
  storageBucket: "paocontrol-d28ec.firebasestorage.app",
  messagingSenderId: "853547255999",
  appId: "1:853547255999:web:7d0cb920e94de810c55e0a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png'
  });
});
