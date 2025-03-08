// このService Workerファイルはビルド時に処理され、環境変数が挿入されます
// バックグラウンドプッシュ通知を処理するためのService Worker

// Firebase SDKをインポート
importScripts(
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js'
)
importScripts(
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js'
)

// ビルド時に環境変数が置き換えられます
const firebaseConfig = {
  apiKey: 'FIREBASE_API_KEY_PLACEHOLDER',
  authDomain: 'FIREBASE_AUTH_DOMAIN_PLACEHOLDER',
  projectId: 'FIREBASE_PROJECT_ID_PLACEHOLDER',
  storageBucket: 'FIREBASE_STORAGE_BUCKET_PLACEHOLDER',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER',
  appId: 'FIREBASE_APP_ID_PLACEHOLDER',
}

firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

// バックグラウンドメッセージの処理
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] バックグラウンドメッセージを受信しました ',
    payload
  )

  const notificationTitle = payload.notification.title || '新しい通知'
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: payload.data,
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// 通知クリックイベントの処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const data = event.notification.data
        const channelId = data?.channelId
        const serverId = data?.serverId

        let url = '/'
        if (serverId && channelId) {
          url = `/?serverId=${serverId}&channelId=${channelId}`
        }

        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(url)
            return
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})
