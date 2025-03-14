// メッセージ送信関連のロジックを抽出したカスタムフック
import { useState, useCallback, RefObject, FormEvent } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../firebase'
import { toast } from 'sonner'
import { uploadImage } from '../../../utils/imageUtils'
import * as Sentry from '@sentry/react'
import { User, MessageData, ReplyInfo } from '../../../types/chat'

interface UseMessageSendingProps {
  serverId: string | null
  channelId: string | null
  user: User | null
  fileInputRef: RefObject<HTMLInputElement>
  replyingTo: ReplyInfo | null
  setReplyingTo: (reply: ReplyInfo | null) => void
  setRepliedMessageId: (id: string | null) => void
  scrollToBottom: () => void
}

export const useMessageSending = ({
  serverId,
  channelId,
  user,
  fileInputRef,
  replyingTo,
  setReplyingTo,
  setRepliedMessageId,
  scrollToBottom,
}: UseMessageSendingProps) => {
  const [inputText, setInputText] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(
    null
  )
  const [fileImageDimensions, setFileImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [imageLocation, setImageLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  const clearSelectedFile = useCallback(() => {
    if (selectedFilePreview) {
      // プレビュー用のURLを破棄
      URL.revokeObjectURL(selectedFilePreview)
    }
    setSelectedFile(null)
    setSelectedFilePreview(null)
    setFileImageDimensions(null)
    // ファイル選択時の入力フィールドをクリア
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [selectedFilePreview, fileInputRef])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ファイルが選択された場合
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      console.log('選択されたファイル:', file.name, file.type, file.size)

      // ファイルサイズのチェック
      const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
      // ファイルサイズが5MBを超える場合はエラー
      if (file.size > MAX_FILE_SIZE) {
        toast.error('ファイルサイズが大きすぎます (最大: 5MB)', {
          duration: 3000,
        })
        e.target.value = ''
        return
      }

      // 選択したファイルを状態に保存
      setSelectedFile(file)

      // プレビュー用のURLを作成
      const previewURL = URL.createObjectURL(file)
      setSelectedFilePreview(previewURL)

      // 画像のサイズを取得
      const img = new Image()
      img.onload = () => {
        setFileImageDimensions({
          width: img.width,
          height: img.height,
        })
      }
      img.src = previewURL

      // メタデータ処理を改善
      try {
        // exifrライブラリをインポート
        const exifr = await import('exifr')

        // 全メタデータを取得
        const allMetadata = await exifr.default.parse(file, { gps: true })
        console.log('すべてのメタデータ:', allMetadata)

        // 既に計算された緯度経度がメタデータに含まれている場合、それを直接使用
        if (
          typeof allMetadata?.latitude === 'number' &&
          typeof allMetadata?.longitude === 'number'
        ) {
          const locationData = {
            latitude: allMetadata.latitude,
            longitude: allMetadata.longitude,
          }

          // NaNチェックを追加
          if (isNaN(locationData.latitude) || isNaN(locationData.longitude)) {
            // Sentryにエラーログを送信
            Sentry.captureMessage(
              'EXIFから取得した位置情報にNaNが含まれています',
              {
                level: 'warning',
                extra: {
                  locationData,
                  allMetadata,
                  fileInfo: {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                  },
                  userAgent: navigator.userAgent,
                  platform: navigator.platform,
                  isAndroid: /android/i.test(navigator.userAgent),
                },
              }
            )
            console.error(
              'EXIFから取得した位置情報にNaNが含まれています:',
              locationData,
              allMetadata
            )
            setImageLocation(null)
          } else {
            console.log('exifrから直接緯度経度を取得:', locationData)
            setImageLocation(locationData)
            toast.success('写真から位置情報を取得しました')
          }
        }
      } catch (error) {
        console.error('メタデータ取得エラー:', error)
        // Sentryにエラーログを送信
        Sentry.captureException(error, {
          extra: {
            fileInfo: {
              name: file.name,
              type: file.type,
              size: file.size,
              lastModified: file.lastModified,
            },
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            isAndroid: /android/i.test(navigator.userAgent),
          },
        })
        setImageLocation(null)
      }

      // 入力欄にフォーカスを当てる
      document.getElementById('message-input')?.focus()
    }
  }

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    try {
      let photoId = null
      let photoExtension = null
      let imageWidth = null
      let imageHeight = null
      let locationData = null // EXIF位置情報用

      // 画像がある場合のみ処理
      if (selectedFile) {
        // 新しい画像アップロード関数を使用
        const result = await uploadImage(selectedFile, 'messages')
        photoId = result.photoId
        photoExtension = result.photoExtension

        // 画像サイズの取得
        if (fileImageDimensions) {
          imageWidth = fileImageDimensions.width
          imageHeight = fileImageDimensions.height
        }

        // 位置情報の取得
        if (imageLocation) {
          locationData = {
            latitude: imageLocation.latitude,
            longitude: imageLocation.longitude,
          }
          console.log('メッセージに位置情報を追加:', locationData)
        }
      }

      // Firestoreにメッセージを追加
      const messageData: MessageData = {
        message: inputText || null,
        timestamp: serverTimestamp(),
        user: user,
        photoId: photoId,
        photoExtension: photoExtension,
      }

      // 画像サイズが存在する場合のみ追加
      if (imageWidth !== null) {
        messageData.imageWidth = imageWidth
      }

      if (imageHeight !== null) {
        messageData.imageHeight = imageHeight
      }

      // 位置情報が存在する場合のみ追加
      if (locationData) {
        messageData.latitude = locationData.latitude
        messageData.longitude = locationData.longitude
      }

      // リプライ情報がある場合は追加
      if (replyingTo) {
        messageData.replyTo = {
          messageId: replyingTo.messageId,
          message: replyingTo.message,
          displayName: replyingTo.displayName,
          photoId: replyingTo.photoId,
          photoExtension: replyingTo.photoExtension,
        }
      }

      // Firestoreに保存
      if (serverId && channelId) {
        await addDoc(
          collection(
            db,
            'servers',
            serverId,
            'channels',
            String(channelId),
            'messages'
          ),
          messageData
        )
        console.log('メッセージを保存しました:', messageData)
      } else {
        console.error('サーバーIDまたはチャンネルIDが無効です')
        toast.error('メッセージの保存に失敗しました')
      }

      // 入力フィールドをクリア
      setInputText('')
      clearSelectedFile()
      setImageLocation(null)

      // リプライ情報をクリア
      setReplyingTo(null)
      setRepliedMessageId(null)

      // 処理終了
      setIsUploading(false)
      scrollToBottom()
    } catch (error) {
      console.error('メッセージの送信に失敗しました:', error)
      toast.error('メッセージの送信に失敗しました')
      setIsUploading(false)
    } finally {
      setIsUploading(false)
    }
  }

  return {
    inputText,
    setInputText,
    selectedFile,
    selectedFilePreview,
    fileImageDimensions,
    imageLocation,
    isUploading,
    handleFileChange,
    clearSelectedFile,
    sendMessage,
  }
}
