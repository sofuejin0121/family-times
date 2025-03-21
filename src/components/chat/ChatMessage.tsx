/**
 * チャットメッセージコンポーネント
 * @module ChatMessage
 * @description チャットメッセージを表示するコンポーネント。メッセージの表示、編集、削除、リアクション機能を提供します。
 *
 * @requires firebase/firestore - Firestoreデータベース操作
 * @requires firebase/storage - Firebase Storageファイル操作
 * @requires react - Reactライブラリ
 * @requires @mui/icons-material - Material UIアイコン
 * @requires @/components/ui/* - UIコンポーネント
 * @requires ../../hooks/useUsers - ユーザー情報取得カスタムフック
 * @requires ../../app/hooks - Reduxカスタムフック
 */

import { deleteDoc, doc, runTransaction, updateDoc } from 'firebase/firestore'
import { useUserStore } from '../../stores/userSlice'
import { useServerStore } from '../../stores/serverSlice'
import { useChannelStore } from '../../stores/channelSlice'
import { db } from '../../firebase'
import DeleteIcon from '@mui/icons-material/Delete'
import { useEffect, useMemo, useRef, useState } from 'react'
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt'
import EditIcon from '@mui/icons-material/Edit'
import { Button } from '../ui/button'
import { Timestamp } from 'firebase/firestore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Avatar, AvatarImage } from '../ui/avatar'
import useUsers from '../../hooks/useUsers'
import { Ellipsis, Reply } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { getCachedImageUrl } from '../../utils/imageUtils'
import { X } from 'lucide-react' // Xアイコンをインポート
import { Textarea } from '../ui/textarea'
// 固定の絵文字リアクションを定義
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

/**
 * リアクション情報の型定義
 * @typedef {Object} Reaction
 * @property {string} emoji - リアクションの絵文字
 * @property {string[]} users - リアクションしたユーザーのID配列
 * @property {number} [count] - リアクション数(オプション)
 */
interface Reaction {
  emoji: string
  users: string[]
  count?: number
}

/**
 * ユーザー情報の型定義
 * @typedef {Object} User
 * @property {string} uid - ユーザーID
 * @property {string} [email] - メールアドレス(オプション)
 * @property {string} [photoURL] - プロフィール画像URL(オプション)
 * @property {string} [displayName] - 表示名(オプション)
 */
interface User {
  uid: string
  email?: string
  photoURL?: string
  displayName?: string
}

/**
 * ChatMessageコンポーネントのProps型定義
 * @typedef {Object} Props
 * @property {string} id - メッセージID
 * @property {string | null} message - メッセージ本文
 * @property {Timestamp} timestamp - 投稿日時
 * @property {User} user - 投稿者情報
 * @property {string | null} photoId - 添付画像のID
 * @property {string | null} photoExtension - 添付画像の拡張子
 * @property {string} [photoURL] - 添付画像のURL(オプション)
 * @property {number} [imageWidth] - 画像の幅(オプション)
 * @property {number} [imageHeight] - 画像の高さ(オプション)
 * @property {Object.<string, Reaction>} [reactions] - リアクション情報(オプション)
 * @property {number} [latitude] - 位置情報の緯度(オプション)
 * @property {number} [longitude] - 位置情報の経度(オプション)
 * @property {function} setIsImageDialogOpen - 画像ダイアログの表示状態を制御する関数
 * @property {function} onReply - リプライ機能の関数
 * @property {boolean} isReplied - リプライ対象かどうか
 * @property {Object} replyTo - リプライ先の情報
 */
interface Props {
  id: string
  message: string | null
  timestamp: Timestamp
  user: User
  photoId: string | null
  photoExtension: string | null
  photoURL?: string
  imageWidth?: number
  imageHeight?: number
  reactions?: {
    [key: string]: Reaction
  }
  latitude?: number
  longitude?: number
  setIsImageDialogOpen: (isOpen: boolean) => void
  onReply?: (
    messageId: string,
    message: string | null,
    displayName: string | null,
    photoId: string | null,
    photoExtension?: string | null
  ) => void
  isReplied?: boolean
  replyTo?: {
    messageId: string
    message: string | null
    displayName: string | null
    photoId: string | null
    photoExtension?: string | null
  }
}

/**
 * チャットメッセージを表示するコンポーネント
 * @param {Props} props - コンポーネントのプロパティ
 * @returns {JSX.Element} チャットメッセージのJSX
 *
 * @example
 * ```tsx
 * <ChatMessage
 *   id="message1"
 *   message="こんにちは"
 *   timestamp={new Timestamp(1234567890, 0)}
 *   user={{ uid: "user1", displayName: "山田太郎" }}
 *   photoId={null}
 *   setIsImageDialogOpen={(isOpen) => {}}
 * />
 * ```
 */
const ChatMessage = ({
  timestamp,
  photoId,
  photoExtension,
  id,
  message,
  reactions,
  user: userProps,
  imageWidth,
  imageHeight,
  setIsImageDialogOpen,
  onReply,
  isReplied,
  replyTo,
}: Props) => {
  const [fileURL, setFileURL] = useState<string>()
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const channelId = useChannelStore((state) => state.channelId)
  const serverId = useServerStore((state) => state.serverId)
  const [editedMessage, setEditedMessage] = useState(message)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const { documents: users } = useUsers()

  // 現在のユーザーのIDを取得
  const currentUser = useUserStore((state) => state.user)

  // メッセージの送信者かどうかをチェック
  const isMessageOwner = currentUser?.uid === userProps.uid

  const userPhoto = useMemo(
    () =>
      users.find((user) => {
        return user.uid === userProps.uid
      })?.photoURL,
    [userProps.uid, users]
  )
  const userDisplayName = useMemo(
    () =>
      users.find((user) => {
        return user.uid === userProps.uid
      })?.displayName,
    [userProps.uid, users]
  )

  // サーバーIDまたはチャンネルIDが変わったときに画像URLをリセット
  useEffect(() => {
    // サーバーまたはチャンネルが変わったら画像URLをクリア
    setFileURL(undefined)
  }, [serverId, channelId])

  // 画像URL取得処理（既存のuseEffect）
  useEffect(() => {
    if (!photoId) return

    const fetchURL = async () => {
      try {
        const url = await getCachedImageUrl(photoId, photoExtension, 'messages')
        if (url) {
          setFileURL(url)
        }
      } catch (error) {
        console.error('画像URLの取得に失敗しました:', error)
      }
    }

    fetchURL()
  }, [photoId, photoExtension])

  const deleteMessage = async () => {
    if (serverId !== null && channelId !== null && id !== null) {
      try {
        await deleteDoc(
          doc(
            db,
            'servers',
            serverId,
            'channels',
            String(channelId),
            'messages',
            id
          )
        )
        setDeleteDialogOpen(false)
      } catch (error) {
        console.log('メッセージの削除に失敗しました:', error)
      }
    }
  }

  const addReaction = async (emoji: string) => {
    if (serverId && channelId && id && userProps) {
      const messageRef = doc(
        db,
        'servers',
        serverId,
        'channels',
        String(channelId),
        'messages',
        id
      )
      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef)
        const reactions = messageDoc.data()?.reactions || {}
        //リアクションは追加/削除の処理
        //Case1: この絵文字での初めてのリアクション
        if (!reactions[emoji]) {
          //新しいリアクションの追加
          reactions[emoji] = { emoji, users: [userProps.uid] }
          // Case2: 既存のリアクションだが、このユーザーは未リアクション
        } else if (!reactions[emoji].users.includes(userProps.uid)) {
          reactions[emoji].users.push(userProps.uid)
          //Case3: 既にリアクション済み(リアクションの取り消し)
        } else {
          reactions[emoji].users = reactions[emoji].users.filter(
            (uid: string) => uid !== userProps.uid
          )
          //リアクションしたユーザーがいなくなった場合、その絵文字を削除
          if (reactions[emoji].users.length === 0) {
            delete reactions[emoji]
          }
        }
        //更新を実行
        transaction.update(messageRef, { reactions })
      })
    }
  }

  const handleEdit = async () => {
    if (serverId && channelId && id) {
      try {
        const messageContentRef = doc(
          db,
          'servers',
          serverId,
          'channels',
          String(channelId),
          'messages',
          id
        )
        await updateDoc(messageContentRef, {
          message: editedMessage,
          isEdited: true,
        })
        setEditDialogOpen(false)
      } catch (error) {
        console.log('メッセージの更新に失敗しました:', error)
      }
    }
  }

  // 絵文字リアクションパネルの表示/非表示を管理
  const [showReactionPanel, setShowReactionPanel] = useState<boolean>(false)
  // パネルの要素をを参照するための変数
  const reactionPanelRef = useRef<HTMLDivElement>(null)

  // リアクションパネルの外側をクリックした時に閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        // パネルが存在していて(reactionPanelRef.current)
        // かつ、クリックされた場所(event.target)がパネルの外側(reactionPanelRef.current.contains(event.target as Node))
        reactionPanelRef.current &&
        !reactionPanelRef.current.contains(event.target as Node)
      ) {
        setShowReactionPanel(false)
      }
    }
    // ページ全体にクリックイベントのリスナー追加
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      // コンポーネントがアンマウントされた時にリスナーを削除
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // スワイプ距離を追跡するstate
  const [swipeDistance, setSwipeDistance] = useState(0)
  const [touchStartX, setTouchStartX] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)

  // タッチ処理関数
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
    setSwipeDistance(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === 0) return

    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const diffX = touchStartX - currentX
    const diffY = Math.abs(touchStartY - currentY)

    // 横方向の移動が縦方向より大きい場合のみスワイプと判定
    if (diffX > 30 && diffX > diffY * 2) {
      // スワイプ距離を更新 (最大100pxまで)
      setSwipeDistance(Math.min(diffX, 100))
    } else {
      setSwipeDistance(0)
    }
  }

  const handleTouchEnd = () => {
    // スワイプ距離が50px以上の場合のみリプライを実行
    if (swipeDistance > 50 && onReply && userDisplayName) {
      onReply(
        id,
        message || '', // メッセージがnullの場合は空文字列を渡す
        userDisplayName,
        photoId || '',
        photoExtension
      )
    }

    // 状態をリセット
    setTouchStartX(0)
    setTouchStartY(0)
    setSwipeDistance(0)
  }

  return (
    <div
      id={`message-${id}`}
      className={`group relative flex items-start gap-4 border-b border-gray-200 bg-white text-black transition-colors hover:bg-gray-100 ${
        isReplied ? 'border-l-4 border-l-blue-500 bg-blue-50 pl-2' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${-swipeDistance}px)`,
        transition: swipeDistance === 0 ? 'transform 0.2s ease-in-out' : 'none',
      }}
    >
      {/* スワイプインジケーター */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500 transition-opacity duration-200"
        style={{
          opacity: swipeDistance > 0 ? swipeDistance / 100 : 0,
        }}
      />

      <div className="flex-shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarImage
            src={userPhoto}
            className="object-cover"
            key={userPhoto}
          />
        </Avatar>
      </div>

      <div className="flex-1 overflow-hidden p-2.5">
        <h4 className="mb-2 flex items-center gap-2.5">
          {userDisplayName}
          <span className="text-base font-normal text-[#7b7c85]">
            {new Date(timestamp?.toDate()).toLocaleString()}
          </span>
        </h4>

        <div className="relative">
          {/* 返信情報の表示 */}
          {replyTo && (
            <div className="mb-1.5 flex items-center gap-1.5 text-sm">
              <div className="flex items-center text-gray-500">
                <Reply className="mr-1 h-3.5 w-3.5" />
                <span>返信先:</span>
              </div>
              <span className="font-medium text-gray-600">
                {replyTo.displayName || '不明なユーザー'}
              </span>
              <button
                className="line-clamp-1 max-w-[200px] overflow-hidden text-ellipsis text-blue-500 hover:underline"
                onClick={() => {
                  // 返信元メッセージへスクロール
                  const originalMessage = document.getElementById(
                    `message-${replyTo.messageId}`
                  )
                  if (originalMessage) {
                    originalMessage.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    })
                    // ハイライト効果
                    originalMessage.classList.add('bg-blue-50')
                    setTimeout(() => {
                      originalMessage.classList.remove('bg-blue-50')
                    }, 2000)
                  }
                }}
              >
                {replyTo.message
                  ? `${replyTo.message}`
                  : replyTo.photoId
                    ? '「画像」'
                    : ''}
              </button>
            </div>
          )}

          {/* メッセージ本文と右端の操作ボタン */}
          <div className="relative flex items-center justify-between gap-2">
            <p className="m-0 break-words whitespace-pre-wrap">{message}</p>

            {/* 右端のボタン領域 - 編集/削除と返信ボタン */}
            <div className="ml-auto flex gap-1">
              {/* 返信ボタン - PCのみ表示 */}
              <button
                onClick={() =>
                  onReply &&
                  userDisplayName &&
                  onReply(
                    id,
                    message || '', // メッセージがnullの場合は空文字列を渡す
                    userDisplayName,
                    photoId || '',
                    photoExtension
                  )
                }
                className="focus-visible:ring-ring border-input bg-background hover:bg-accent hover:text-accent-foreground hidden h-10 cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 md:block md:opacity-0 md:transition-all md:duration-200 md:ease-in-out md:group-hover:opacity-100"
              >
                <Reply className="h-5 w-5" />
              </button>

              {/* 編集・削除ボタンを送信者のみに表示 - モバイルでは常に表示 */}
              {isMessageOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="focus-visible:ring-ring border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 md:opacity-0 md:transition-all md:duration-200 md:ease-in-out md:group-hover:opacity-100">
                      <Ellipsis fontSize="small" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuLabel>メッセージ操作</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setEditDialogOpen(true)}
                      className="hover:bg-accent cursor-pointer"
                    >
                      <EditIcon fontSize="small" />
                      編集
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="hover:bg-accent cursor-pointer"
                    >
                      <DeleteIcon fontSize="small" />
                      削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="border border-gray-200 bg-white text-black">
              <DialogHeader>
                <DialogTitle>メッセージを編集</DialogTitle>
              </DialogHeader>

              <Textarea
                value={editedMessage || ''}
                onChange={(e) => setEditedMessage(e.target.value)}
                className="box-border max-h-[150px] min-h-[38px] w-full resize-none overflow-hidden border border-gray-300 bg-white break-words whitespace-pre-wrap text-black disabled:opacity-50"
              />
              <DialogFooter>
                <Button
                  variant="default"
                  onClick={handleEdit}
                  className="cursor-pointer bg-black text-white"
                >
                  保存
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="cursor-pointer bg-white text-black"
                >
                  キャンセル
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="border border-gray-200 bg-white text-black">
              <DialogHeader>
                <DialogTitle>メッセージを削除しますか？</DialogTitle>
                <DialogDescription>
                  この操作は元に戻すことはできません。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="default"
                  onClick={deleteMessage}
                  className="cursor-pointer bg-black text-white"
                >
                  削除する
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  className="cursor-pointer bg-white text-black"
                >
                  戻る
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {fileURL ? (
            <Dialog
              open={isImagePreviewOpen}
              onOpenChange={(open) => {
                setIsImagePreviewOpen(open)
                setIsImageDialogOpen(open)
              }}
            >
              <DialogTrigger asChild>
                <div
                  className="mt-3 w-full max-w-sm cursor-pointer md:w-3/5 lg:w-2/5 xl:w-1/3"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    src={fileURL}
                    alt="メッセージ画像"
                    className="h-auto w-full rounded object-contain"
                    onClick={() => setIsImagePreviewOpen(true)}
                    loading="lazy"
                    onLoad={() => {
                      const messagesEnd = document.querySelector(
                        '[data-messages-end]'
                      )
                      messagesEnd?.scrollIntoView({
                        behavior: 'instant',
                        block: 'end',
                      })
                    }}
                    srcSet={`
                      ${fileURL}?w=480 480w,
                      ${fileURL}?w=800 800w,
                      ${fileURL} 1200w
                    `}
                    sizes="(max-width: 480px) 100vw,
                           (max-width: 768px) 60vw,
                           40vw"
                    style={{
                      aspectRatio:
                        imageWidth && imageHeight
                          ? `${imageWidth}/${imageHeight}`
                          : 'auto',
                    }}
                  />
                </div>
              </DialogTrigger>
              <DialogContent
                variant="image"
                hideCloseButton
                data-no-swipe="true"
              >
                <button
                  onClick={() => setIsImagePreviewOpen(false)}
                  className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
                <img
                  src={fileURL}
                  alt="メッセージ画像（拡大表示）"
                  className="h-full w-full rounded object-contain"
                />
              </DialogContent>
            </Dialog>
          ) : (
            imageWidth != null &&
            imageHeight != null && (
              <div
                className="mt-3 w-full max-w-sm md:w-3/5 lg:w-2/5 xl:w-1/3"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="w-full animate-pulse rounded bg-gray-200"
                  style={{
                    aspectRatio: `${imageWidth}/${imageHeight}`,
                  }}
                />
              </div>
            )
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(reactions || {}).map(([emoji, reaction]) => {
              const hasReacted = reaction.users.includes(userProps?.uid || '')
              return (
                <button
                  key={emoji}
                  onClick={() => addReaction(emoji)}
                  className={`flex cursor-pointer items-center gap-1 rounded-lg border p-1 px-2 text-sm transition-all duration-200 ease-in-out ${
                    hasReacted
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent bg-[#f2f3f5] hover:bg-[#e3e5e8]'
                  } `}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="min-w-3 text-center text-xs text-[#4f545c]">
                    ({reaction.users.length})
                  </span>
                </button>
              )
            })}
          </div>

          {/* 絵文字リアクションパネル */}
          <div className="relative flex">
            <button
              className="cursor-pointer rounded border-none bg-transparent p-1 text-gray-700 opacity-80 transition-all duration-200 ease-in-out hover:bg-gray-200 hover:text-black"
              onClick={() => setShowReactionPanel(!showReactionPanel)}
            >
              <SentimentSatisfiedAltIcon />
            </button>
            {showReactionPanel && (
              <div
                className="absolute bottom-10 left-0 z-10 flex flex-row gap-1 rounded-lg border border-gray-200 bg-white shadow-md"
                ref={reactionPanelRef}
              >
                {PRESET_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      addReaction(emoji)
                      setShowReactionPanel(false)
                    }}
                    className="cursor-pointer rounded-md p-2 text-xl hover:bg-gray-100"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatMessage
