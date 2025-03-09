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

// Firebase Adminアプリを初期化
initializeApp()
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

              // 送信するトークンのリストを作成
              const tokensToSend = []
              
              // 従来の単一トークン（後方互換性のため）
              if (userData.fcmToken) {
                tokensToSend.push(userData.fcmToken)
              }
              
              // デバイスごとのトークンマップがある場合
              if (userData.fcmTokensMap && typeof userData.fcmTokensMap === 'object') {
                // 各デバイスのトークンを追加（重複を避けるためにSet使用）
                const uniqueTokens = new Set(tokensToSend)
                Object.values(userData.fcmTokensMap).forEach(deviceData => {
                  if (deviceData && deviceData.token) {
                    uniqueTokens.add(deviceData.token)
                  }
                })
                tokensToSend.length = 0 // 配列をクリア
                tokensToSend.push(...uniqueTokens) // Setから配列に戻す
              }
              
              // 送信するトークンがない場合
              if (tokensToSend.length === 0) {
                logger.log(`User ${uid} has no FCM tokens`)
                return null
              }

              // 通知ペイロード（送信内容）を準備
              const payload = {
                // 基本通知情報（クロスプラットフォーム共通）
                notification: {
                  title: `${messageData.user.displayName} in ${channelName}`, // 通知タイトル
                  body: messageData.message || 'メッセージを確認してください', // 通知本文
                  // アイコンは各プラットフォーム固有設定で指定
                },
                // 通知に付加するデータ（アプリ内で使用）
                data: {
                  serverId, // サーバーID
                  channelId, // チャンネルID
                  messageId, // メッセージID
                  type: 'message', // 通知タイプ
                },
                // Android向け特有の設定
                android: {
                  priority: 'high', // 高優先度（すぐに表示）
                  notification: {
                    icon: 'ic_notification', // 通知アイコン
                    color: '#4285F4', // 通知の色
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK', // クリック時のアクション
                  },
                },
                // Web向けの設定
                webpush: {
                  notification: {
                    icon: messageData.user.photoURL || '/homeicon_512.png', // 通知アイコン
                  },
                  fcmOptions: {
                    link: `/?serverId=${serverId}&channelId=${channelId}`, // クリック時のリンク先
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
                  logger.log(`Notification sent to ${uid} (token: ${token.substring(0, 10)}...)`)
                  validTokens.push(token)
                } catch (err) {
                  logger.error(`Error sending notification to ${uid} (token: ${token.substring(0, 10)}...):`, err)
                  
                  // トークンが無効な場合
                  if (
                    err.code === 'messaging/invalid-registration-token' ||
                    err.code === 'messaging/registration-token-not-registered' ||
                    err.message.includes('404') ||
                    err.message.includes('Not Found')
                  ) {
                    invalidTokens.push(token)
                    logger.error(`[FCMError] 無効なトークンを検出 - ユーザー: ${uid}, トークン: ${token.substring(0, 10)}...`)
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
                  Object.entries(updatedTokensMap).forEach(([deviceId, deviceData]) => {
                    if (deviceData && deviceData.token && invalidTokens.includes(deviceData.token)) {
                      // このデバイスのトークンが無効なので削除
                      delete updatedTokensMap[deviceId]
                      mapUpdated = true
                    }
                  })
                  
                  if (mapUpdated) {
                    updateData.fcmTokensMap = updatedTokensMap
                  }
                }
                
                // メインのfcmTokenが無効な場合
                if (userData.fcmToken && invalidTokens.includes(userData.fcmToken)) {
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
                  await firestore.collection('users').doc(uid).update(updateData)
                  logger.error(`[FCMError] ユーザーのトークン情報を更新しました - ${uid}`)
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

// 新しい関数：無効なFCMトークンを持つユーザーのトークンを定期的にクリーンアップ
exports.cleanupInvalidFCMTokens = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'asia-northeast1',
  },
  async (event) => {
    try {
      logger.error(`[TokenCleanup] 定期クリーンアップ開始: ${new Date().toISOString()}`)
      
      // 最後のトークンエラーから24時間以上経過したユーザーを検索
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      // エラーフラグがあり、トークンがnullのユーザーを取得
      const usersWithErrors = await firestore
        .collection('users')
        .where('lastTokenError', '!=', null)
        .where('fcmToken', '==', null)
        .get()
      
      logger.error(`[TokenCleanup] トークンエラーユーザー数: ${usersWithErrors.size}人`)
      
      // 各ユーザーを処理
      const batch = firestore.batch()
      usersWithErrors.docs.forEach((doc) => {
        logger.error(`[TokenCleanup] ユーザー更新フラグを設定: ${doc.id}`)
        batch.update(doc.ref, {
          needTokenRefresh: true, // クライアント側で検出するフラグ
          lastTokenRefreshRequest: new Date(),
        })
      })
      
      await batch.commit()
      logger.error(`[TokenCleanup] 完了: ${usersWithErrors.size}人のトークン更新フラグを設定しました`)
      
      return null
    } catch (error) {
      logger.error('[TokenCleanup] クリーンアップ処理でエラー発生:', error)
      return null
    }
  }
)

// 以下はコメントアウトされた機能
// ユーザーがサーバーに追加された時通知を送信する関数
// exports.sendServerInviteNotification = onDocumentCreated(
//   {
//     document: 'servers/{serverId}/members/{userId}',
//     region: 'asia-northeast1', // リージョンを明示的に指定
//   },
//   async (event) => {
//     const { serverId, userId } = event.params
//
//     try {
//       // サーバードキュメントを取得
//       const serverDoc = await firestore
//         .collection('servers')
//         .doc(serverId)
//         .get()
//       const serverData = serverDoc.data()
//
//       if (!serverData) {
//         logger.log('サーバーデータがありません')
//         return null
//       }
//
//       // FCMトークンを取得するためのユーザードキュメント
//       const userDoc = await firestore.collection('users').doc(userId).get()
//       const userData = userDoc.data()
//
//       if (!userData || !userData.fcmToken) {
//         logger.log(`User ${userId} has no FCM token`)
//         return null
//       }
//
//       // 通知ペイロードを準備
//       const payload = {
//         notification: {
//           title: `${serverData.serverName}に招待されました`,
//           body: `サーバーに招待されました`,
//           icon: serverData.serverIcon || '/homeicon.png',
//           clickAction: `https://${process.env.VITE_DOMAIN}/servers/${serverId}`,
//         },
//         data: {
//           serverId,
//           type: 'serverInvite',
//         },
//       }
//       //通知を送信
//       await getMessaging().sendToDevice(userData.fcmToken, payload)
//       logger.log(`Notification sent to ${userId} for server invite`)
//     } catch (err) {
//       logger.error('エラーが発生しました:', err)
//       return null
//     }
//   }
// )

// メッセージでユーザーがメンションされたとき通知を送信する関数
// exports.sendMentionNotification = onDocumentCreated(
//   'servers/{serverId}/channels/{channelId}/messages/{messageId}',
//   async (event) => {
//     const { serverId, channelId, messageId } = event.params
//     const messageData = event.data.data()
//
//     if (!messageData || !messageData.message) {
//       return null
//     }
//
//     try {
//       // メッセージ内の@メンションをチェック
//       // これは単純な実装 - より洗練されたアプローチを使うかもしれません
//       const mentionRegex = /@(\S+)/g
//       const mentions = messageData.message.match(mentionRegex)
//
//       if (!mentions || mentions.length === 0) {
//         return null
//       }
//
//       // チャンネル名を取得
//       const channelDoc = await firestore
//         .collection('servers')
//         .doc(serverId)
//         .collection('channels')
//         .doc(channelId)
//         .get()
//
//       const channelData = channelDoc.data()
//       if (!channelData) {
//         logger.log('No channel data found')
//         return null
//       }
//
//       const channelName = channelData.channelName
//
//       // サーバー内のすべてのユーザーを取得
//       const usersSnapshot = await firestore.collection('users').get()
//       const users = usersSnapshot.docs.map(doc => ({
//         uid: doc.id,
//         ...doc.data()
//       }))
//
//       // 各メンションについて、一致するユーザーを見つけて通知を送信
//       for (const mention of mentions) {
//         // @メンションからユーザー名を抽出
//         const username = mention.substring(1) // @記号を削除
//
//         // メンションに一致するユーザーを見つける
//         // これは単純な実装 - 実際のアプリではユーザーを特定するためのより正確な方法があるでしょう
//         const matchedUsers = users.filter(user =>
//           user.displayName && user.displayName.toLowerCase() === username.toLowerCase())
//
//         // メッセージ作成者には通知しない
//         const filteredUsers = matchedUsers.filter(user => user.uid !== messageData.user.uid)
//
//         // メンションされたユーザーに通知を送信
//         for (const user of filteredUsers) {
//           if (!user.fcmToken) continue
//
//           const payload = {
//             notification: {
//               title: `${messageData.user.displayName} mentioned you in #${channelName}`,
//               body: messageData.message,
//               icon: messageData.user.photo || '/favicon.png',
//               clickAction: `https://${process.env.VITE_DOMAIN}/servers/${serverId}/channels/${channelId}`,
//             },
//             data: {
//               serverId: serverId,
//               channelId: channelId,
//               messageId: messageId,
//               type: 'mention'
//             }
//           }
//
//           await getMessaging().sendToDevice(user.fcmToken, payload)
//           logger.log(`Mention notification sent to user ${user.uid}`)
//         }
//       }
//
//       return null
//     } catch (error) {
//       logger.error('Error in sendMentionNotification:', error)
//       return null
//     }
//   }
// )
