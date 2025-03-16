// Firebase Cloud Functions - Firebaseのサーバーサイド機能を実装するファイル

// 必要なFirebaseモジュールをインポート
const { initializeApp } = require('firebase-admin/app') // Firebase Adminアプリを初期化するための関数
const { getFirestore } = require('firebase-admin/firestore') // Firestoreデータベースにアクセスするための関数
const { getMessaging } = require('firebase-admin/messaging') // Firebase Cloud Messagingを使用するための関数
const {
  onDocumentCreated,
  onSchedule,
} = require('firebase-functions/v2/firestore') // Firestoreドキュメント作成時のトリガー関数とスケジュール関数
const { setGlobalOptions } = require('firebase-functions/v2') // Cloud Functionsのグローバル設定を行うための関数
const logger = require('firebase-functions/logger') // ログ出力用のロガー
const { getStorage } = require('firebase-admin/storage') // Firebase Storageにアクセスするための関数
const { onObjectFinalized } = require('firebase-functions/v2/storage') // Firebase Storageオブジェクト変更時のトリガー関数
const path = require('path') // パス操作を行うためのモジュール
const os = require('os') // オペレーティングシステムの情報を取得するためのモジュール
const fs = require('fs') // ファイル操作を行うためのモジュール
const sharp = require('sharp') // 画像処理を行うためのモジュール

// Firebase Adminアプリを初期化
initializeApp()
/**
 * ストレージバケットに画像がアップロードされたとき、
 * 最適化のためにAVIF形式に変換します
 */
exports.convertToAvif = onObjectFinalized(
  {
    cpu: 2,
    region: 'asia-northeast1',
    memory: '2GiB', // メモリ制限を2GBに増やす
    timeoutSeconds: 300,
  },
  async (event) => {
    // ファイル情報を取得
    const fileBucket = event.data.bucket
    const filePath = event.data.name
    const contentType = event.data.contentType

    // 画像でない場合は処理を終了
    if (!contentType || !contentType.startsWith('image/')) {
      return logger.log('これは画像ではありません。')
    }

    // すでにAVIF形式の場合は処理を終了
    const fileName = path.basename(filePath)
    if (fileName.endsWith('.avif')) {
      return logger.log('ファイルはすでにAVIF形式です。')
    }

    // 一時ディレクトリを作成
    const workingDir = path.join(os.tmpdir(), 'image-optimization')

    try {
      await fs.promises.mkdir(workingDir, { recursive: true })

      // メモリ使用量を最適化するために、ストリーム処理を使用
      const bucket = getStorage().bucket(fileBucket)
      const file = bucket.file(filePath)

      const outputFilePath = path.join(
        path.dirname(filePath),
        `${path.basename(fileName, path.extname(fileName))}.avif`
      )

      // Sharpのパイプラインを設定
      const transform = sharp({
        limitInputPixels: 268402689, // 制限を緩和（16384 x 16384）
        failOnError: false,
      }).toFormat('avif', {
        quality: 60,
        effort: 4,
      })

      // Cloud Storageに直接アップロード
      const outputFile = bucket.file(outputFilePath)
      const outputStream = outputFile.createWriteStream({
        resumable: false, // 小さいファイルの場合はfalseの方が高速
        metadata: {
          contentType: 'image/avif',
          cacheControl: 'public, max-age=31536000',
        },
      })

      // ストリームを接続してメモリ効率的に処理
      await new Promise((resolve, reject) => {
        file
          .createReadStream()
          .on('error', reject)
          .pipe(transform)
          .on('error', reject)
          .pipe(outputStream)
          .on('error', reject)
          .on('finish', resolve)
      })

      logger.log(`AVIF画像をアップロードしました: ${outputFilePath}`)
      return logger.log('画像変換が完了しました！')
    } catch (error) {
      logger.error('画像処理中にエラーが発生しました:', error)
      throw error
    } finally {
      // 一時ディレクトリのクリーンアップ
      if (workingDir) {
        try {
          await fs.promises.rm(workingDir, { recursive: true, force: true })
        } catch (error) {
          logger.error('クリーンアップ中にエラーが発生しました:', error)
        }
      }
    }
  }
)
// Firestoreデータベースへの参照を取得
const firestore = getFirestore()

// Cloud Functionsのグローバルオプションを設定
setGlobalOptions({
  maxInstances: 10, // 同時に実行できる最大インスタンス数（負荷分散のため）
  concurrency: 80, // 同時に処理できるリクエスト数
  region: 'asia-northeast1', // 東京リージョンを指定（低レイテンシーのため）
})

// チャンネルに新しいメッセージが作成されたときに通知を送信する関数
exports.sendMessageNotification = onDocumentCreated(
  {
    document: 'servers/{serverId}/channels/{channelId}/messages/{messageId}',
    region: 'asia-northeast1',
  },
  async (event) => {
    // イベントパラメータから必要な情報を取得
    const { serverId, channelId, messageId } = event.params // URLパラメータを分解
    const messageData = event.data.data() // 作成されたメッセージのデータを取得

    // メッセージデータが存在しない場合は処理を終了
    if (!messageData) {
      logger.log('メッセージデータがありません')
      return null
    }

    try {
      // サーバー情報を取得
      const serverDoc = await firestore
        .collection('servers') // serversコレクションを参照
        .doc(serverId) // 特定のサーバーIDのドキュメントを参照
        .get() // データを取得
      const serverData = serverDoc.data() // サーバーのデータを取得

      // サーバーデータまたはメンバー情報がない場合は処理を終了
      if (!serverData || !serverData.members) {
        logger.log('サーバーのメンバー情報がありません')
        return null
      }

      // チャンネル情報を取得
      const channelDoc = await firestore
        .collection('servers')
        .doc(serverId)
        .collection('channels') // channelsサブコレクションを参照
        .doc(channelId) // 特定のチャンネルIDのドキュメントを参照
        .get()
      const channelData = channelDoc.data()
      if (!channelData) {
        logger.log('チャンネルデータがありません')
        return null
      }
      const channelName = channelData.channelName // チャンネル名を取得

      // メッセージ送信者のUID（ユーザーID）を取得
      const senderUid = messageData.user.uid

      // メッセージ送信者以外のサーバーメンバー全員を取得
      // Object.keys()でオブジェクトのキー（UID）を配列として取得し、
      // filter()で送信者自身を除外
      const memberUids = Object.keys(serverData.members).filter(
        (uid) => uid !== senderUid
      )

      // バッチ処理で通知を送信（Firebaseの制限に対応するため）
      const batchSize = 10 // 一度に処理するユーザー数
      for (let i = 0; i < memberUids.length; i += batchSize) {
        // 現在のバッチのユーザーIDを取得
        const batch = memberUids.slice(i, i + batchSize)

        // 各ユーザーへの通知を並列処理
        await Promise.all(
          batch.map(async (uid) => {
            try {
              // ユーザードキュメントからFCMトークン情報を取得
              const userDoc = await firestore.collection('users').doc(uid).get()
              const userData = userDoc.data()

              // FCMトークン情報がない場合は通知を送信しない
              if (!userData) {
                logger.log(`User ${uid} has no data`)
                return null
              }
              // デバッグログ（問題特定後は削除可能）
              logger.log(`Processing notification for user ${uid}`)

              // 送信するトークンのリストを作成（重複を避けるためにSetを使用）
              const uniqueTokens = new Set()

              // 従来の単一トークン（後方互換性のため）
              if (userData.fcmToken) {
                uniqueTokens.add(userData.fcmToken)
              }

              // デバイスごとのトークンマップがある場合
              if (
                userData.fcmTokensMap &&
                typeof userData.fcmTokensMap === 'object'
              ) {
                // 各デバイスのトークンを追加
                Object.values(userData.fcmTokensMap).forEach((deviceData) => {
                  if (deviceData && deviceData.token) {
                    uniqueTokens.add(deviceData.token)
                  }
                })
              }

              // Setから配列に変換
              const tokensToSend = [...uniqueTokens]

              // 送信するトークンがない場合
              if (tokensToSend.length === 0) {
                logger.log(`User ${uid} has no FCM tokens`)
                return null
              }

              // 通知ペイロード（送信内容）を準備
              const payload = {
                // 基本通知情報（クロスプラットフォーム共通）
                notification: {
                  title: `${messageData.user.displayName} in ${channelName}`,
                  body: messageData.message || 'メッセージを確認してください',
                },
                // 通知に付加するデータ（アプリ内で使用）
                data: {
                  serverId,
                  channelId,
                  messageId,
                  type: 'message',
                  notificationId: `message_${messageId}`, // 識別用のIDを追加
                  badgeCount: String(userData.unreadCount || 1), //バッジカウント追加(文字列として)
                },
                // Android向け特有の設定
                android: {
                  priority: 'high',
                  notification: {
                    icon: 'ic_notification',
                    color: '#4285F4',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    tag: `message_${messageId}`, // Androidのtagはここだけに設定
                  },
                },
                // Web向けの設定
                webpush: {
                  notification: {
                    icon: messageData.user.photoURL || '/homeicon_512.png',
                    tag: `message_${messageId}`, // Webのtagはここだけに設定
                    badge: '/notification_badge.png', // 通知のバッジアイコン
                  },
                  fcmOptions: {
                    link: `/?serverId=${serverId}&channelId=${channelId}`,
                  },
                },
              }

              // 無効なトークンを記録する配列
              const invalidTokens = []
              // 有効なトークンを記録する配列
              const validTokens = []

              // 各トークンに通知を送信
              for (const token of tokensToSend) {
                try {
                  // FCM V1 API形式で通知を送信
                  await getMessaging().send({
                    token: token,
                    ...payload,
                  })
                  logger.log(
                    `Notification sent to ${uid} (token: ${token.substring(0, 10)}...)`
                  )
                  validTokens.push(token)
                } catch (err) {
                  logger.error(
                    `Error sending notification to ${uid} (token: ${token.substring(0, 10)}...):`,
                    err
                  )

                  // トークンが無効な場合
                  if (
                    err.code === 'messaging/invalid-registration-token' ||
                    err.code ===
                      'messaging/registration-token-not-registered' ||
                    err.message.includes('404') ||
                    err.message.includes('Not Found')
                  ) {
                    invalidTokens.push(token)
                    logger.error(
                      `[FCMError] 無効なトークンを検出 - ユーザー: ${uid}, トークン: ${token.substring(0, 10)}...`
                    )
                  }
                }
              }

              // 無効なトークンがある場合、ユーザードキュメントを更新
              if (invalidTokens.length > 0) {
                // 更新するデータを準備
                const updateData = {}

                // fcmTokensMapから無効なトークンを削除
                if (userData.fcmTokensMap) {
                  const updatedTokensMap = { ...userData.fcmTokensMap }
                  let mapUpdated = false

                  // 各デバイスのトークンをチェック
                  Object.entries(updatedTokensMap).forEach(
                    ([deviceId, deviceData]) => {
                      if (
                        deviceData &&
                        deviceData.token &&
                        invalidTokens.includes(deviceData.token)
                      ) {
                        // このデバイスのトークンが無効なので削除
                        delete updatedTokensMap[deviceId]
                        mapUpdated = true
                      }
                    }
                  )

                  if (mapUpdated) {
                    updateData.fcmTokensMap = updatedTokensMap
                  }
                }

                // メインのfcmTokenが無効な場合
                if (
                  userData.fcmToken &&
                  invalidTokens.includes(userData.fcmToken)
                ) {
                  // 有効なトークンがあれば、それをメインのトークンに設定
                  if (validTokens.length > 0) {
                    updateData.fcmToken = validTokens[0]
                  } else {
                    updateData.fcmToken = null
                    updateData.lastTokenError = new Date()
                    updateData.tokenErrorCode = 'all_tokens_invalid'
                    updateData.tokenErrorMessage = '全てのトークンが無効です'
                  }
                }

                // ユーザードキュメントを更新
                if (Object.keys(updateData).length > 0) {
                  await firestore
                    .collection('users')
                    .doc(uid)
                    .update(updateData)
                  logger.error(
                    `[FCMError] ユーザーのトークン情報を更新しました - ${uid}`
                  )
                }
              }
            } catch (err) {
              // ユーザー処理中のエラーをログに記録
              logger.error(`Error processing notification for ${uid}:`, err)
            }
          })
        )
      }
      return null // 正常終了
    } catch (err) {
      // 全体的なエラーをログに記録
      logger.error('エラーが発生しました:', err)
      return null
    }
  }
)
