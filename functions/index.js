// firebase Cloud Functions
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const logger = require('firebase-functions/logger')

initializeApp()
const firestore = getFirestore()

// グローバルオプションの設定
setGlobalOptions({
  maxInstances: 10,
  concurrency: 80,
  region: 'asia-northeast1', // リージョンを明示的に指定
})

//チャンネルに新しいメッセージが作成されたとき通知を送信
exports.sendMessageNotification = onDocumentCreated(
  {
    document: 'servers/{serverId}/channels/{channelId}/messages/{messageId}',
    region: 'asia-northeast1', // リージョンを明示的に指定
  },
  async (event) => {
    const { serverId, channelId, messageId } = event.params
    const messageData = event.data.data()

    if (!messageData) {
      logger.log('メッセージデータがありません')
      return null
    }

    try {
      const serverDoc = await firestore
        .collection('servers')
        .doc(serverId)
        .get()
      const serverData = serverDoc.data()

      if (!serverData || !serverData.members) {
        logger.log('サーバーのメンバー情報がありません')
        return null
      }

      const channelDoc = await firestore
        .collection('servers')
        .doc(serverId)
        .collection('channels')
        .doc(channelId)
        .get()
      const channelData = channelDoc.data()
      if (!channelData) {
        logger.log('チャンネルデータがありません')
        return null
      }
      const channelName = channelData.channelName
      // メッセージ作成者には通知を送信しない
      const senderUid = messageData.user.uid
      // すべてのサーバーメンバーを取得
      const memberUids = Object.keys(serverData.members).filter(
        (uid) => uid !== senderUid
      )
      // パッチ処理して制限に達しないようにする
      const batchSize = 10
      for (let i = 0; i < memberUids.length; i += batchSize) {
        const batch = memberUids.slice(i, i + batchSize)

        await Promise.all(
          batch.map(async (uid) => {
            try {
              // ユーザードキュメントからFCMトークンを取得
              const userDoc = await firestore.collection('users').doc(uid).get()
              const userData = userDoc.data()

              if (!userData || !userData.fcmToken) {
                logger.log(`User ${uid} has no FCM token`)
                return null
              }

              // 通知ペイロードを準備
              const payload = {
                // 基本通知（クロスプラットフォーム）
                notification: {
                  title: `${messageData.user.displayName} in ${channelName}`,
                  body: messageData.message || 'メッセージを確認してください',
                  // icon フィールドを削除 - 各プラットフォーム固有設定に移動
                },
                data: {
                  serverId,
                  channelId,
                  messageId,
                  type: 'message',
                },
                // Android特有の設定
                android: {
                  priority: 'high',
                  notification: {
                    icon: 'ic_notification',
                    color: '#4285F4',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                  },
                },
                // Web向けの設定（アイコンはここで指定）
                webpush: {
                  notification: {
                    icon: messageData.user.photoURL || '/homeicon_512.png',
                  },
                  fcmOptions: {
                    link: `/?serverId=${serverId}&channelId=${channelId}`,
                  },
                },
              }

              try {
                // FCM V1 API形式で送信
                await getMessaging().send({
                  token: userData.fcmToken,
                  ...payload,
                })
                logger.log(`Notification sent to ${uid}`)
              } catch (err) {
                logger.error(`Error sending notification to ${uid}:`, err)

                // トークンが無効な場合、ユーザーのFCMトークンをクリア
                if (
                  err.code === 'messaging/invalid-registration-token' ||
                  err.code === 'messaging/registration-token-not-registered' ||
                  err.message.includes('404') ||
                  err.message.includes('Not Found')
                ) {
                  logger.log(`Removing invalid token for user ${uid}`)
                  await firestore.collection('users').doc(uid).update({
                    fcmToken: null,
                    lastTokenError: new Date(),
                    tokenErrorMessage: err.message,
                  })
                }
              }
            } catch (err) {
              logger.error(`Error processing notification for ${uid}:`, err)
            }
          })
        )
      }
      return null
    } catch (err) {
      logger.error('エラーが発生しました:', err)
      return null
    }
  }
)

// ユーザーがサーバーに追加された時通知を送信
// exports.sendServerInviteNotification = onDocumentCreated(
//   {
//     document: 'servers/{serverId}/members/{userId}',
//     region: 'asia-northeast1', // リージョンを明示的に指定
//   },
//   async (event) => {
//     const { serverId, userId } = event.params

//     try {
//       // サーバードキュメントを取得
//       const serverDoc = await firestore
//         .collection('servers')
//         .doc(serverId)
//         .get()
//       const serverData = serverDoc.data()

//       if (!serverData) {
//         logger.log('サーバーデータがありません')
//         return null
//       }

//       // FCMトークンを取得するためのユーザードキュメント
//       const userDoc = await firestore.collection('users').doc(userId).get()
//       const userData = userDoc.data()

//       if (!userData || !userData.fcmToken) {
//         logger.log(`User ${userId} has no FCM token`)
//         return null
//       }

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

// メッセージでユーザーがメンションされたとき通知を送信
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
