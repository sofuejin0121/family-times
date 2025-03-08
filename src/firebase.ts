/**
 * Firebase関連の設定と機能を提供するモジュール
 * このファイルではFirebaseの初期化、認証、Firestoreデータベース、
 * Cloud Messaging（FCM）などの機能を設定しています
 */

// 必要なFirebaseモジュールをインポート
import { initializeApp } from 'firebase/app' // Firebaseアプリケーションの初期化
import { doc, getFirestore, updateDoc } from 'firebase/firestore' // Firestoreデータベース操作
import { getStorage } from 'firebase/storage' // Firebaseストレージ
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth' // 認証関連
import {
  getMessaging,
  getToken,
  MessagePayload,
  onMessage,
} from 'firebase/messaging' // プッシュ通知関連
import { User } from 'firebase/auth' // ユーザー型定義

/**
 * Firebaseの設定情報
 * 環境変数から各種キーや識別子を取得します
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_apiKey, // APIキー
  authDomain: import.meta.env.VITE_authDomain, // 認証ドメイン
  projectId: import.meta.env.VITE_projectId, // プロジェクトID
  storageBucket: import.meta.env.VITE_storageBucket, // ストレージバケット
  messagingSenderId: import.meta.env.VITE_messagingSenderId, // FCM送信者ID
  appId: import.meta.env.VITE_appId, // アプリケーションID
}

// Firebaseの初期化と各サービスのインスタンス作成
const app = initializeApp(firebaseConfig) // Firebaseアプリケーションを初期化
const db = getFirestore(app) // Firestoreデータベースへの参照を取得
const auth = getAuth(app) // 認証サービスへの参照を取得
const provider = new GoogleAuthProvider() // Google認証プロバイダーを作成
const storage = getStorage(app) // ストレージサービスへの参照を取得
const messaging = getMessaging(app) // メッセージングサービスへの参照を取得

/**
 * Firebase Cloud Messaging (FCM)トークンを取得してFirestoreに保存する関数
 * このトークンはユーザーにプッシュ通知を送信するために必要です
 * 
 * @param user - 現在ログインしているユーザー
 */
export const initFCM = async (user: User) => {
  try {
    // FCMトークンを取得（VAPIDキーとServiceWorker登録情報を使用）
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_KEY, // Web Push通知用の公開鍵
      serviceWorkerRegistration:
        (await getServiceWorkerRegistration()) || undefined, // ServiceWorker登録情報
    })

    if (token) {
      console.log('FCMトークン取得成功:', token)
      // ユーザードキュメントにFCMトークンを保存
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token, // FCMトークン
        lastUpdated: new Date(), // 更新日時
      })
      console.log('FCMトークンをFirestoreに保存しました')
    } else {
      console.log('FCMトークンの取得に失敗しました')
    }
  } catch (error) {
    console.error('FCMトークンの取得に失敗しました:', error)
  }
}

/**
 * プッシュ通知用のServiceWorker登録を取得または作成する関数
 * ServiceWorkerはバックグラウンドでの通知受信を可能にします
 * 
 * @returns ServiceWorkerRegistration | null - 登録されたServiceWorkerまたはnull
 */
const getServiceWorkerRegistration = async () => {
  // ブラウザがServiceWorkerをサポートしていない場合はnullを返す
  if (!('serviceWorker' in navigator)) return null

  try {
    // 既存のServiceWorker登録を確認
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      // FCM用のスコープを持つServiceWorkerを探す
      if (registration.scope.includes('/firebase-cloud-messaging-push-scope')) {
        // すでにアクティブなServiceWorkerがある場合はそれを返す
        if (registration.active) {
          return registration
        }
      }
    }

    // 既存のServiceWorkerがない場合、新しいServiceWorkerを登録
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js', // ServiceWorkerファイルのパス
      {
        scope: '/firebase-cloud-messaging-push-scope', // ServiceWorkerのスコープ
      }
    )

    // ServiceWorkerが確実にアクティブになるまで待機
    if (!registration.active) {
      await new Promise((resolve) => {
        if (registration.installing) {
          // インストール中のServiceWorkerの状態変化を監視
          registration.installing.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              resolve(true)
            }
          })
        } else if (registration.waiting) {
          // 待機中のServiceWorkerの状態変化を監視
          registration.waiting.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              resolve(true)
            }
          })
        } else {
          // 既にアクティブな場合は即時解決
          resolve(true)
        }
      })
    }

    return registration
  } catch (err) {
    console.error('Service Worker登録エラー:', err)
    return null
  }
}

/**
 * ユーザーの認証状態を監視し、ログイン時にFCMを初期化する関数
 * アプリケーション起動時に呼び出すことで、ユーザーログイン時に自動的にFCMを設定します
 */
export const setupFCMWithAuth = () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // ユーザーがログインした時にFCMを初期化
      initFCM(user)
    }
  })
}

/**
 * ブラウザの通知許可を要求する関数
 * ユーザーアクション（ボタンクリックなど）に応じて呼び出す必要があります
 * 
 * @returns Promise<boolean> - 許可が得られたかどうかを示すブール値
 */
export const requestNotificationPermission = async () => {
  try {
    // ブラウザの通知許可ダイアログを表示
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      console.log('通知許可が付与されました')
      // ユーザーが現在ログインしていれば、FCMを初期化
      const currentUser = auth.currentUser
      if (currentUser) {
        await initFCM(currentUser)
      }
      return true
    } else {
      console.log('通知許可が拒否されました')
      return false
    }
  } catch (error) {
    console.error('通知許可の要求中にエラーが発生しました:', error)
    return false
  }
}

/**
 * フォアグラウンド（アプリ使用中）でのプッシュ通知受信リスナーを設定する関数
 * アプリケーション起動時に呼び出すことで、アプリ使用中の通知を処理できます
 */
export const setupFCMListener = () => {
  onMessage(messaging, (payload: MessagePayload) => {
    console.log('フォアグラウンドでメッセージを受信しました', payload)

    // 通知をブラウザに表示（ユーザーが許可している場合）
    if (payload.notification && Notification.permission === 'granted') {
      const { title, body, icon } = payload.notification
      new Notification(title || 'メッセージ通知', {
        body: body || '', // 通知の本文
        icon: icon || '/homeicon.png', // 通知のアイコン
      })
    }
  })
}

// 他のモジュールで使用するためにFirebaseサービスをエクスポート
export { auth, provider, db, storage, app, messaging }
