import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useChannelStore } from '../stores/channelSlice'
import { useServerStore } from '../stores/serverSlice'

interface Reaction {
  emoji: string
  users: string[] //リアクションしたユーザーのuid配列
}

interface Messages {
  id: string
  photoId: string | null
  photoExtension: string | null
  photoURL: string
  timestamp: Timestamp
  message: string
  imageWidth?: number
  imageHeight?: number
  latitude?: number
  longitude?: number
  user: {
    uid: string
    photo: string
    email: string
    displayName: string
  }
  reactions: {
    [key: string]: Reaction //絵文字をkeyとしたリアクションデータ
  }
  replyTo?: {
    messageId: string
    message: string | null
    displayName: string | null
    photoId: string | null
    photoExtension?: string | null
  }
}

const useMessage = () => {
  const [subDocuments, setSubDocuments] = useState<Messages[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const channelId = useChannelStore((state) => state.channelId)
  const serverId = useServerStore((state) => state.serverId)

  useEffect(() => {
    // サーバー/チャンネルが変わったら、まずデータをクリア
    setSubDocuments([])
    
    if (serverId !== null && channelId !== null) {
      setIsLoading(true)
      const collectionRef = collection(
        db,
        'servers',
        serverId,
        'channels',
        String(channelId),
        'messages'
      )
      const collectionRefOrderBy = query(
        collectionRef,
        orderBy('timestamp', 'asc')
      )

      const unsubscribe = onSnapshot(collectionRefOrderBy, (snapshot) => {
        const results: Messages[] = []
        snapshot.docs.forEach((doc) => {
          const data = doc.data()

          // 既存のデータ構造との互換性を保つ
          let photoId = data.photoId || null
          let photoExtension = data.photoExtension || null

          // 古い形式のphotoIdから拡張子を抽出（移行期間中の対応）
          if (photoId && !photoExtension && photoId.includes('.')) {
            const lastDotIndex = photoId.lastIndexOf('.')
            if (lastDotIndex !== -1) {
              photoExtension = photoId.substring(lastDotIndex + 1)
              photoId = photoId.substring(0, lastDotIndex)
            }
          }

          // リプライ情報の処理
          const replyTo = data.replyTo || null
          if (
            replyTo &&
            replyTo.photoId &&
            replyTo.photoId.includes('.') &&
            !replyTo.photoExtension
          ) {
            const lastDotIndex = replyTo.photoId.lastIndexOf('.')
            if (lastDotIndex !== -1) {
              replyTo.photoExtension = replyTo.photoId.substring(
                lastDotIndex + 1
              )
              replyTo.photoId = replyTo.photoId.substring(0, lastDotIndex)
            }
          }

          results.push({
            id: doc.id,
            timestamp: data.timestamp,
            message: data.message,
            user: data.user,
            photoId: photoId,
            photoExtension: photoExtension,
            photoURL: data.photoURL,
            imageWidth: data.imageWidth,
            imageHeight: data.imageHeight,
            latitude: data.latitude,
            longitude: data.longitude,
            reactions: data.reactions || {},
            replyTo: replyTo,
          })
        })
        setSubDocuments(results)
        setIsLoading(false)
      })

      return () => unsubscribe()
    }
  }, [channelId, serverId])

  return { subDocuments, isLoading }
}

export default useMessage
