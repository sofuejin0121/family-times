// このService Workerファイルはビルド時に処理され、環境変数が挿入されます
// バックグラウンドプッシュ通知を処理するためのService Worker
// Service Workerとは：ブラウザのバックグラウンドで実行される特殊なJavaScriptファイルで、
// オフライン機能やプッシュ通知などの機能を提供します

// Firebase SDKをインポート
// importScriptsはService Worker内で外部スクリプトを読み込むための特殊な関数です
// firebase-app-compatはFirebaseの基本機能を提供するライブラリです
importScripts(
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js'
)
// firebase-messaging-compatはFirebaseのメッセージング（通知）機能を提供するライブラリです
importScripts(
  'https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js'
)

// ビルド時に環境変数が置き換えられます
// これらのプレースホルダー（FIREBASE_XXX_PLACEHOLDER）は実際のFirebase設定値に置き換えられます
const firebaseConfig = {
  apiKey: 'FIREBASE_API_KEY_PLACEHOLDER', // Firebase APIキー
  authDomain: 'FIREBASE_AUTH_DOMAIN_PLACEHOLDER', // 認証ドメイン
  projectId: 'FIREBASE_PROJECT_ID_PLACEHOLDER', // プロジェクトID
  storageBucket: 'FIREBASE_STORAGE_BUCKET_PLACEHOLDER', // ストレージバケット
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER', // 送信者ID
  appId: 'FIREBASE_APP_ID_PLACEHOLDER', // アプリID
}

// Firebaseアプリを初期化します
// この設定によりFirebaseサービスとの接続が確立されます
firebase.initializeApp(firebaseConfig)

// Firebaseメッセージングのインスタンスを取得します
// このインスタンスを使ってプッシュ通知を処理します
const messaging = firebase.messaging()

// バックグラウンドメッセージの処理
// アプリがバックグラウンド（閉じている状態や最小化されている状態）の時に
// Firebaseから送信されたメッセージを処理するためのリスナーを設定します
// firebase-messaging-sw.js 内の変更
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] バックグラウンドメッセージを受信しました ',
    payload
  )

  // バッジカウントを更新（より堅牢な実装）
  if (payload.data && payload.data.badgeCount) {
    try {
      const count = parseInt(payload.data.badgeCount, 10);
      console.log(`[SW] バッジカウント設定試行: ${count}`);
      
      if (!isNaN(count) && 'setAppBadge' in self.navigator) {
        // Promise APIを使用
        self.navigator.setAppBadge(count)
          .then(() => console.log(`[SW] バッジを${count}に設定しました`))
          .catch(err => {
            console.error('[SW] バッジ設定エラー:', err);
            // エラー時にフォールバック通知
            self.registration.showNotification('新着メッセージ', {
              body: `${count}件の新着メッセージがあります`,
              icon: '/homeicon.png'
            });
          });
      } else {
        console.log('[SW] バッジAPIが利用できないか、無効な値です');
      }
    } catch (error) {
      console.error('[SW] バッジ処理エラー:', error);
    }
  }
})
// 通知クリックイベントの処理
// ユーザーが通知をクリックした時の動作を定義します
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 通知がクリックされました', event)

  // 通知を閉じます
  event.notification.close()

  // 通知をクリックしたらバッジをクリア
  if ('clearAppBadge' in self.navigator) {
    self.navigator
      .clearAppBadge()
      .then(() => console.log('[SW] バッジをクリアしました'))
      .catch((err) => console.error('[SW] バッジクリアエラー:', err))
  }

  // event.waitUntilはService Workerのライフサイクルを延長し、
  // 非同期処理が完了するまでService Workerを終了させません
  event.waitUntil(
    // clientsはService Workerに関連付けられたウィンドウ/タブのリストを取得します
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 通知データからチャンネルIDとサーバーIDを取得
      const data = event.notification.data || {}
      const channelId = data.channelId
      const serverId = data.serverId
      const messageId = data.messageId

      // リダイレクト先URLを設定
      let url = '/'
      if (serverId && channelId) {
        // サーバーIDとチャンネルIDがある場合は、それらをクエリパラメータとして追加
        url = `/?serverId=${serverId}&channelId=${channelId}`
        // メッセージIDがある場合は、特定のメッセージにフォーカスするためのパラメータを追加
        if (messageId) {
          url += `?messageId=${messageId}`
        }
      }

      // すでに開いているウィンドウがあるか確認
      for (const client of clientList) {
        // 同じオリジンのウィンドウがあり、focusメソッドが利用可能な場合
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          // そのウィンドウにフォーカスを当てる
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data,
          })
          return
        }
      }

      // 開いているウィンドウがない場合は新しいウィンドウを開く
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

// Service Workerのインストール時
self.addEventListener('install', function (event) {
  console.log('[SW] Service Workerをインストールしました');
  
  // バッジAPIのサポート状況を詳細に確認
  const badgeSupport = {
    setAppBadge: 'setAppBadge' in self.navigator,
    clearAppBadge: 'clearAppBadge' in self.navigator,
    navigatorType: typeof self.navigator,
    navigatorProps: Object.keys(self.navigator)
  };
  
  console.log('[SW] バッジAPIサポート詳細:', badgeSupport);
  self.skipWaiting();
});

// Service Workerのアクティベーション時
self.addEventListener('activate', function (event) {
  console.log(
    '[firebase-messaging-sw.js] Service Workerがアクティブになりました'
  )
  event.waitUntil(clients.claim()) // クライアントの制御を取得
})
