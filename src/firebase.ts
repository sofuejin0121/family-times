/**
 * Firebase関連の設定と機能を提供するモジュール
 * このファイルではFirebaseの初期化、認証、Firestoreデータベース、
 * Cloud Messaging（FCM）などの機能を設定しています
 */

// 必要なFirebaseモジュールをインポート
import { initializeApp } from 'firebase/app' // Firebaseアプリケーションの初期化
import { doc, getFirestore, updateDoc, getDoc } from 'firebase/firestore' // Firestoreデータベース操作
import { getStorage } from 'firebase/storage' // Firebaseストレージ
import { getAuth, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth' // 認証関連
import {
  getMessaging,
  getToken,
  MessagePayload,
  onMessage,
} from 'firebase/messaging' // プッシュ通知関連
import { User } from 'firebase/auth' // ユーザー型定義
import * as Sentry from '@sentry/react'

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
 * FCMトークンを取得または更新する関数
 * トークンが無効になった場合や定期的な更新に使用
 *
 * @param user - 現在ログインしているユーザー
 * @param forceRefresh - トークンを強制的に更新するかどうか
 */
export const refreshFCMToken = async (user: User, forceRefresh = false) => {
  try {
    console.log(
      `FCMトークン再取得開始 - ユーザー: ${user.uid}, 強制更新: ${forceRefresh}`
    )

    // ServiceWorker登録を取得
    const swRegistration = await getServiceWorkerRegistration()

    // 既存のトークンを削除（強制更新の場合）
    if (forceRefresh) {
      try {
        console.log(
          `[TokenRefresh] トークン強制更新を実行 - ユーザー: ${user.uid}`
        )
      } catch (err) {
        console.error(
          `[TokenRefresh] トークン処理エラー - ユーザー: ${user.uid}`,
          err
        )
        // Sentryにエラーを記録
        Sentry.captureException(err, {
          tags: {
            operation: 'tokenForceRefresh',
            userId: user.uid,
          },
          extra: {
            userId: user.uid,
          },
        })
      }
    }

    // 新しいトークンを取得（この処理が実質的に古いトークンを無効化する）
    console.log('新しいトークンの取得を試みます...')
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration || undefined,
    })

    if (token) {
      console.log(
        `[TokenRefresh] 新しいFCMトークン取得成功 - ユーザー: ${user.uid}, トークン: ${token.substring(0, 10)}...`
      )

      // デバイス識別子を取得
      const deviceId = await getDeviceIdentifier()

      // ユーザードキュメントを取得
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.data() || {}

      // fcmTokensマップを初期化または更新
      const fcmTokensMap = userData.fcmTokensMap || {}
      fcmTokensMap[deviceId] = {
        token,
        lastUpdated: new Date(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
      }

      // ユーザードキュメントにトークンを保存
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token, // 後方互換性のために残す
        fcmTokensMap, // デバイスごとのトークンマップ
        lastTokenUpdate: new Date(),
        tokenErrorCleared: true, // エラーがクリアされたことを示す
      })
      return token
    } else {
      const error = new Error(
        `[TokenRefresh] FCMトークンの取得に失敗 - ユーザー: ${user.uid}`
      )
      console.error(error.message)
      // Sentryにエラーを記録
      Sentry.captureException(error, {
        tags: {
          operation: 'tokenRetrieval',
          userId: user.uid,
        },
        extra: {
          userId: user.uid,
          result: 'null_token',
        },
      })
      return null
    }
  } catch (error) {
    console.error(`[TokenRefresh] 重大エラー - ユーザー: ${user.uid}`, error)
    // Sentryに重大エラーを記録
    Sentry.captureException(error, {
      tags: {
        operation: 'refreshFCMToken',
        userId: user.uid,
      },
      extra: {
        userId: user.uid,
        forceRefresh,
      },
    })
    return null
  }
}

/**
 * デバイス識別子を取得する関数
 * ブラウザのフィンガープリントを使用して一意のデバイスIDを生成
 */
const getDeviceIdentifier = async () => {
  try {
    // ローカルストレージからデバイスIDを取得
    let deviceId = localStorage.getItem('device_id')

    // デバイスIDがない場合は新しく生成
    if (!deviceId) {
      // 簡易的なフィンガープリントを生成
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        window.screen.width,
        window.screen.height,
        new Date().getTimezoneOffset(),
      ].join('|')

      // SHA-256ハッシュを生成
      const msgBuffer = new TextEncoder().encode(fingerprint)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      deviceId = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      // ローカルストレージに保存
      localStorage.setItem('device_id', deviceId)
    }

    return deviceId
  } catch (error) {
    console.error('デバイスID生成エラー:', error)
    // エラー時はランダムなIDを返す
    return `device_${Math.random().toString(36).substring(2, 15)}`
  }
}

/**
 * FCMトークンを手動で再発行する関数
 * 設定ページなどから呼び出すことを想定
 */
export const manuallyRefreshFCMToken = async () => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーがログインしていません')
  }

  try {
    // 通知許可を確認
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('通知許可が得られませんでした')
      }
    }

    // ServiceWorkerの登録を確認
    const swRegistration = await getServiceWorkerRegistration()
    if (!swRegistration) {
      // ServiceWorkerを再登録
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
      })
    }

    // トークンを強制的に更新
    const token = await refreshFCMToken(user, true)
    if (!token) {
      throw new Error('トークンの取得に失敗しました')
    }

    return {
      success: true,
      token: token.substring(0, 10) + '...',
    }
  } catch (error) {
    console.error('トークン再発行エラー:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
    }
  }
}

/**
 * ログイン時またはアプリ起動時にFCMトークンを初期化し、
 * 定期的な更新と無効トークンの検出を設定します
 *
 * @param user - 現在ログインしているユーザー
 */
export const initFCM = async (user: User) => {
  try {
    console.log(`[FCM初期化] 開始 - ユーザー: ${user.uid}`)

    // ユーザー情報を取得して前回のトークンエラーを確認
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const userData = userDoc.data()

    // トークン更新フラグのチェックを追加
    const needsForceRefresh =
      userData?.lastTokenError ||
      userData?.needTokenRefresh ||
      (userData?.lastTokenUpdate &&
        Date.now() - userData.lastTokenUpdate.toDate().getTime() >
          7 * 24 * 60 * 60 * 1000)

    console.log(
      `[FCM初期化] 強制更新フラグ: ${needsForceRefresh}, 理由: ${
        userData?.lastTokenError
          ? 'トークンエラーあり'
          : userData?.needTokenRefresh
            ? '更新フラグあり'
            : 'トークン期限切れ'
      }`
    )

    // トークンを更新（必要に応じて強制更新）
    await refreshFCMToken(user, needsForceRefresh)

    // トークン更新が成功したらフラグをクリア
    if (userData?.needTokenRefresh) {
      console.log(`[FCM初期化] 更新フラグをクリア - ユーザー: ${user.uid}`)
      await updateDoc(doc(db, 'users', user.uid), {
        needTokenRefresh: false,
      })
    }

    // トークン更新イベントのリスナーを設定
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data?.firebase?.msg?.type === 'token-refresh') {
        console.log('トークンの更新が必要です')
        await refreshFCMToken(user, true)
      }
    })

    // 定期的にトークンを更新（例: 一週間ごと）
    const tokenRefreshInterval = setInterval(
      async () => {
        if (auth.currentUser) {
          await refreshFCMToken(auth.currentUser, true)
        } else {
          clearInterval(tokenRefreshInterval)
        }
      },
      7 * 24 * 60 * 60 * 1000
    ) // 7日ごと
  } catch (error) {
    console.error(`[FCM初期化] 重大エラー - ユーザー: ${user.uid}`, error)
    // Sentryに重大エラーを記録
    Sentry.captureException(error, {
      tags: {
        operation: 'initFCM',
        userId: user.uid,
      },
      extra: {
        userId: user.uid,
      },
    })
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
  onMessage(messaging, async (payload: MessagePayload) => {
    console.log('フォアグラウンドでメッセージを受信しました', payload);

    // バッジカウントを更新
    if (payload.data?.badgeCount && 'setAppBadge' in navigator) {
      try {
        const count = parseInt(payload.data.badgeCount as string, 10);
        if (!isNaN(count)) {
          await navigator.setAppBadge(count);
          console.log(`バッジを${count}に設定しました`);
        }
      } catch (error) {
        console.error('バッジの設定に失敗しました:', error);
      }
    }

    // 通知をブラウザに表示（既存のコード）
    if (payload.notification && Notification.permission === 'granted') {
      // 既存の通知を閉じる（同じタグの通知がある場合）
      const notificationTag = (payload.notification as { tag?: string }).tag
      if (notificationTag) {
        navigator.serviceWorker.ready.then((registration) => {
          registration
            .getNotifications({ tag: notificationTag })
            .then((notifications) => {
              notifications.forEach((notification) => notification.close())
            })
        })
      }

      const { title, body, icon } = payload.notification
      new Notification(title || 'メッセージ通知', {
        body: body || '',
        icon: icon || '/homeicon.png',
        tag: notificationTag, // タグを設定して重複を防止
      })
    }
  })
}

export const setAppBadge = async (count: number): Promise<void> => {
  try {
    // バッジAPIが利用可能化チェック
    if ('setAppBadge' in navigator) {
      await navigator.setAppBadge(count)
      console.log(`バッジを${count}に設定しました`)
    } else {
      console.log('バッジAPIがサポートされていません')
    }
  } catch (error) {
    console.error('バッジの設定に失敗しました:', error)
  }
}

// バッジをクリアする関数
export const clearAppBadge = async (): Promise<void> => {
  try {
    // バッジAPIが利用可能化チェック
    if ('clearAppBadge' in navigator) {
      await navigator.clearAppBadge()
      console.log('アプリバッジをクリアしました')
    } else {
      console.log('バッジAPIがサポートされていません')
    }
  } catch (error) {
    console.error('バッジのクリアに失敗しました:', error)
  }
}

// 未読メッセージに基づいてバッジを更新する関数
export const updateAppBadge = async (user: User): Promise<void> => {
  try {
    // バッジAPIが利用可能化チェック
    if (!('setAppBadge' in navigator)) {
      return
    }

    // ユーザーの未読メッセージ数を取得
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const userData = userDoc.data() || {}

    if (userData && userData.unreadCount) {
      // 未読カウントがある場合はバッジを設定
      await setAppBadge(userData.unreadCount)
    } else {
      // 未読カウントがない場合はバッジクリア
      await clearAppBadge()
    }
  } catch (error) {
    console.error('バッジの更新に失敗しました:', error)
  }

  // バッジを更新
}

// 他のモジュールで使用するためにFirebaseサービスをエクスポート
export { auth, provider, db, storage, app, messaging }
