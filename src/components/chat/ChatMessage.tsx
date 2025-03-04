import { deleteDoc, doc, runTransaction, updateDoc } from 'firebase/firestore'
import { useAppSelector } from '../../app/hooks'
import { db, storage } from '../../firebase'
import DeleteIcon from '@mui/icons-material/Delete'
import { getDownloadURL, ref } from 'firebase/storage'
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
import { Input } from '../ui/input'
import { Avatar, AvatarImage } from '../ui/avatar'
import useUsers from '../../hooks/useUsers'

// 固定の絵文字リアクションを定義
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Reaction {
  emoji: string
  users: string[]
  count?: number
}

// ユーザー情報の型定義
interface User {
  uid: string
  email?: string
  photoURL?: string
  displayName?: string
}

interface Props {
  id: string
  message: string | null
  timestamp: Timestamp
  user: User
  photoId: string | null
  photoURL?: string
  imageWidth?: number
  imageHeight?: number
  reactions?: {
    [key: string]: Reaction
  }
  latitude?: number
  longitude?: number
  setIsImageDialogOpen: (isOpen: boolean) => void
}

const ChatMessage = ({
  timestamp,
  photoId,
  id,
  message,
  reactions,
  user: userProps,
  imageWidth,
  imageHeight,
  setIsImageDialogOpen,
}: Props) => {
  const [fileURL, setFileURL] = useState<string>()
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
  const channelId = useAppSelector((state) => state.channel.channelId)
  const serverId = useAppSelector((state) => state.server.serverId)
  const [editedMessage, setEditedMessage] = useState(message)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const { documents: users } = useUsers()

  // 現在のユーザーのIDを取得
  const currentUser = useAppSelector((state) => state.user.user)

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

  useEffect(() => {
    const fetchURL = async () => {
      // photoIdが存在し、空でない場合のみURLを取得
      if (photoId && photoId.trim() !== '') {
        try {
          const photoURL = await getDownloadURL(ref(storage, photoId))
          setFileURL(photoURL)
        } catch (error) {
          console.log('画像URLの取得に失敗しました:', error)
        }
      }
    }
    fetchURL()
  }, [photoId])

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
  const reactionPanelRef = useRef<HTMLDivElement>(null)
  
  // リアクションパネルの外側をクリックした時に閉じる処理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        reactionPanelRef.current &&
        !reactionPanelRef.current.contains(event.target as Node)
      ) {
        setShowReactionPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="group relative flex items-start gap-4 border-b border-gray-200 bg-white  text-black hover:bg-gray-100">
      <div className="flex-shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarImage
            src={userPhoto}
            className="object-cover"
            key={userPhoto} // キーを追加して強制的に再レンダリング
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
          <div className="relative flex items-center gap-2">
            <p className="m-0">{message}</p>
            {/* 編集・削除ボタンを送信者のみに表示 */}
            {isMessageOwner && (
              <div className="flex gap-1 opacity-100 transition-all duration-200 ease-in-out md:invisible md:opacity-0 md:group-hover:visible md:group-hover:opacity-100">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="inline-fle ring-offset-background focus-visible:ring-ring border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
                      <EditIcon fontSize="small" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="border border-gray-200 bg-white text-black">
                    <DialogHeader>
                      <DialogTitle>メッセージを編集</DialogTitle>
                    </DialogHeader>

                    <Input
                      value={editedMessage || ''}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="w-full rounded border border-[#dcddde] bg-white p-2 text-sm focus:border-[#7983f5] focus:outline-none"
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

                <Dialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <button
                      className="ring-offset-background focus-visible:ring-ring border-input bg-background hover:bg-accent hover:bg-opacity-10 inline-flex h-10 cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:text-[#ed4245] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                    >
                      <DeleteIcon fontSize="small" />
                    </button>
                  </DialogTrigger>
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
              </div>
            )}
          </div>
          {fileURL ? (
            <Dialog
              open={isImagePreviewOpen}
              onOpenChange={(open) => {
                setIsImagePreviewOpen(open)
                setIsImageDialogOpen(open)
              }}
            >
              <DialogTrigger asChild>
                <div className="mt-3 w-full md:w-3/5 lg:w-2/5 xl:w-1/3 max-w-sm">
                  <img
                    src={fileURL}
                    alt=""
                    className="h-auto w-full cursor-pointer rounded"
                    onClick={() => setIsImagePreviewOpen(true)}
                  />
                </div>
              </DialogTrigger>
              <DialogContent
                variant="image"
                hideCloseButton
                data-no-swipe="true"
              >
                <img
                  src={fileURL}
                  alt=""
                  className="h-full w-full   rounded object-contain"
                />
              </DialogContent>
            </Dialog>
          ) : imageWidth != null && imageHeight != null ? (
            // 画像読み込み中のプレースホルダー
            <div
              className="mt-3 w-full animate-pulse rounded bg-gray-200 md:w-4/5 lg:w-1/2"
              style={{
                // アスペクト比を維持するためのスタイル
                aspectRatio: `${imageWidth}/${imageHeight}`,
                maxWidth: `${imageWidth}px`,
              }}
            />
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(reactions || {}).map(([emoji, reaction]) => {
              const hasReacted = reaction.users.includes(userProps?.uid || '');
              return (
                <button
                  key={emoji}
                  onClick={() => addReaction(emoji)}
                  className={`
                    flex cursor-pointer items-center gap-1 rounded-lg 
                    border p-1 px-2 text-sm transition-all duration-200 ease-in-out 
                    ${hasReacted
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent bg-[#f2f3f5] hover:bg-[#e3e5e8]'
                    }
                  `}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="min-w-3 text-center text-xs text-[#4f545c]">
                    ({reaction.users.length})
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* 絵文字リアクションパネル */}
          <div className="relative  flex">
            <button
              className="cursor-pointer rounded border-none bg-transparent p-1 text-gray-700 opacity-80 transition-all duration-200 ease-in-out hover:bg-gray-200 hover:text-black "
              onClick={() => setShowReactionPanel(!showReactionPanel)}
            >
              <SentimentSatisfiedAltIcon />
            </button>
            {showReactionPanel && (
              <div
                className="absolute bottom-10 left-0 z-10 flex flex-row gap-1 rounded-lg border border-gray-200 bg-white  shadow-md"
                ref={reactionPanelRef}
              >
                {PRESET_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      addReaction(emoji);
                      setShowReactionPanel(false);
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
