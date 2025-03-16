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
        // ユーザー通知処理部分の修正版（関連部分のみ抜粋）
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

              // デバイスごとのトークンマップがある場合は優先的に使用
              if (
                userData.fcmTokensMap &&
                typeof userData.fcmTokensMap === 'object'
              ) {
                Object.entries(userData.fcmTokensMap).forEach(
                  ([deviceId, deviceData]) => {
                    if (
                      deviceData &&
                      deviceData.token &&
                      deviceData.active !== false
                    ) {
                      uniqueTokens.add(deviceData.token)
                    }
                  }
                )
              }

              // fcmTokensMapが空の場合のみ従来の単一トークンを使用（後方互換性のため）
              if (uniqueTokens.size === 0 && userData.fcmToken) {
                uniqueTokens.add(userData.fcmToken)
              }

              // Setから配列に変換
              const tokensToSend = [...uniqueTokens]

              // デバッグログ
              logger.log(
                `Sending to ${tokensToSend.length} unique tokens for user ${uid}`
              )

              // 送信するトークンがない場合
              if (tokensToSend.length === 0) {
                logger.log(`User ${uid} has no FCM tokens`)
                return null
              }

              // 通知ペイロード（送信内容）を準備
              const payload = {
                notification: {
                  title: `${messageData.user.displayName} in ${channelName}`,
                  body: messageData.message || 'メッセージを確認してください',
                },
                data: {
                  serverId,
                  channelId,
                  messageId,
                  type: 'message',
                  timestamp: Date.now().toString(), // 通知の一意性を確保するためにタイムスタンプを追加
                },
                android: {
                  priority: 'high',
                  notification: {
                    icon: 'ic_notification',
                    color: '#4285F4',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    // Android専用の重複回避機能
                    tag: `message_${messageId}`, // 同じタグの通知は置き換えられる
                  },
                },
                webpush: {
                  notification: {
                    icon: messageData.user.photoURL || '/homeicon_512.png',
                    tag: `message_${messageId}`, // Web通知でも同じタグを使用して重複を防ぐ
                  },
                  fcmOptions: {
                    link: `/?serverId=${serverId}&channelId=${channelId}`,
                  },
                },
              }

              // マルチキャスト送信を使用（個別送信よりも効率的）
              try {
                const multicastMessage = {
                  tokens: tokensToSend,
                  ...payload,
                }

                const batchResponse =
                  await getMessaging().sendMulticast(multicastMessage)

                logger.log(
                  `Notification batch sent to ${uid}: ${batchResponse.successCount} successful, ${batchResponse.failureCount} failed`
                )

                // 無効なトークンの処理
                if (batchResponse.failureCount > 0) {
                  const invalidTokens = []
                  batchResponse.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                      invalidTokens.push(tokensToSend[idx])
                    }
                  })

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
                      updateData.fcmToken = null
                      updateData.lastTokenError = new Date()
                    }

                    // ユーザードキュメントを更新
                    if (Object.keys(updateData).length > 0) {
                      await firestore
                        .collection('users')
                        .doc(uid)
                        .update(updateData)
                      logger.log(`Updated invalid tokens for user ${uid}`)
                    }
                  }
                }
              } catch (err) {
                logger.error(`Error sending batch notification to ${uid}:`, err)
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
