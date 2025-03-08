import { initializeApp } from 'firebase/app'
import { doc, getFirestore, updateDoc } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth'
import {
  getMessaging,
  getToken,
  MessagePayload,
  onMessage,
} from 'firebase/messaging'
import { User } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_apiKey,
  authDomain: import.meta.env.VITE_authDomain,
  projectId: import.meta.env.VITE_projectId,
  storageBucket: import.meta.env.VITE_storageBucket,
  messagingSenderId: import.meta.env.VITE_messagingSenderId,
  appId: import.meta.env.VITE_appId,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)
const provider = new GoogleAuthProvider()
const storage = getStorage(app)
const messaging = getMessaging(app)

// FCMトークンを取得して保存する関数
export const initFCM = async (user: User) => {
  try {
    // FCMトークン取得
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_KEY,
      serviceWorkerRegistration:
        (await getServiceWorkerRegistration()) || undefined,
    })

    if (token) {
      console.log('FCMトークン取得成功:', token)
      //Firestoreにトークン保存
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token,
        lastUpdated: new Date(),
      })
      console.log('FCMトークンをFirestoreに保存しました')
    } else {
      console.log('FCMトークンの取得に失敗しました')
    }
  } catch (error) {
    console.error('FCMトークンの取得に失敗しました:', error)
  }
}

// ServiceWorker登録を取得する関数
const getServiceWorkerRegistration = async () => {
  if (!('serviceWorker' in navigator)) return null

  try {
    // 既存の登録を確認
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      if (registration.scope.includes('/firebase-cloud-messaging-push-scope')) {
        // すでにアクティブな場合はそれを返す
        if (registration.active) {
          return registration
        }
      }
    }

    // 新しい Service Worker を登録
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      {
        scope: '/firebase-cloud-messaging-push-scope',
      }
    )

    // Service Worker が確実にアクティブになるまで待つ
    if (!registration.active) {
      await new Promise((resolve) => {
        if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              resolve(true)
            }
          })
        } else if (registration.waiting) {
          registration.waiting.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              resolve(true)
            }
          })
        } else {
          // 既にアクティブな場合
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

// ユーザーのログイン状態変更を監視し、ログイン時にFCMを初期化
export const setupFCMWithAuth = () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // ユーザーがログインした時にFCMを初期化
      initFCM(user)
    }
  })
}

// 通知許可を要求する関数 - ユーザーアクションに応じて呼び出すべき
export const requestNotificationPermission = async () => {
  try {
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

// フォアグラウンドでメッセージを受信した時の処理
export const setupFCMListener = () => {
  onMessage(messaging, (payload: MessagePayload) => {
    console.log('フォアグラウンドでメッセージを受信しました', payload)

    // 通知をブラウザに表示 (オプション)
    if (payload.notification && Notification.permission === 'granted') {
      const { title, body, icon } = payload.notification
      new Notification(title || 'メッセージ通知', {
        body: body || '',
        icon: icon || '/homeicon.png',
      })
    }
  })
}

export { auth, provider, db, storage, app, messaging }
