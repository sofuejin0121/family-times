import ChatHeader from './ChatHeader'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ChatMessage from './ChatMessage'
import { useAppSelector } from '../../app/hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  CollectionReference,
  DocumentData,
  serverTimestamp,
} from 'firebase/firestore'
import { db, storage } from '../../firebase'
import useMessage from '../../hooks/useMessage'
import MemberSidebar from '../sidebar/MemberSidebar'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { v4 as uuid4 } from 'uuid'
import { Input } from '../ui/input'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import LoadingScreen from '../loading/LoadingScreen'

interface ChatProps {
  isMemberSidebarOpen: boolean
  setIsMemberSidebarOpen: (isOpen: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (isOpen: boolean) => void
}

const Chat = ({
  isMemberSidebarOpen,
  setIsMemberSidebarOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: ChatProps) => {
  const [inputText, setInputText] = useState<string>('')
  const [searchMessage, setSearchMessage] = useState<string>('')
  const channelId = useAppSelector((state) => state.channel.channelId)
  const channelName = useAppSelector((state) => state.channel.channelName)
  const user = useAppSelector((state) => state.user.user)
  const fileInputRef = useRef<HTMLInputElement>(null)
  //カスタムフックを使用してメッセージデータを取得
  const { subDocuments: messages } = useMessage()
  const serverId = useAppSelector((state) => state.server.serverId)
  const isServerSelected = Boolean(serverId)
  const isChannelSelected = Boolean(channelId)
  const { isLoading } = useMessage()

  //メッセージリストのコンテナへの参照作成
  const messagesEndRef = useRef<HTMLDivElement>(null)
  ///画面の一番下までスクロールする関数
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
    }
  }, [])
  useEffect(() => {
    if (!isLoading) {
      messagesEndRef?.current?.scrollIntoView()
    }
    console.log('isLoading', isLoading)
  }, [isLoading])

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      ///入力が空の場合は送信ボタンを無効化
      if (!inputText.trim()) {
        return
      }
      //入力が空でない場合のみ送信処理実行
      if (serverId !== null) {
        //channelsコレクションの中にあるmessagesコレクションの中にメッセージ情報を入れる
        const collectionRef: CollectionReference<DocumentData> = collection(
          db,
          'servers',
          serverId,
          'channels',
          String(channelId),
          'messages'
        )
        await addDoc(collectionRef, {
          photoId: null,
          message: inputText,
          timestamp: serverTimestamp(),
          user: user,
        })
        setInputText('')
        scrollToBottom()
      }
    },
    [channelId, inputText, serverId, user, scrollToBottom]
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log('ファイルが選択されました', e.target.files)
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0]
        const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
        if (file.size > MAX_FILE_SIZE) {
          toast.error('ファイルサイズが大きすぎます (最大: 5MB)', {
            duration: 3000,
          })
          e.target.value = ''
          return
        }
        try {
          const photoId = uuid4()
          const fileName = photoId + file.name
          const FileRef = ref(storage, fileName)

          // 画像のサイズを取得
          const imageWidth = await new Promise<number>((resolve) => {
            const img = new Image()
            img.onload = () => resolve(img.width)
            img.src = URL.createObjectURL(file)
          })

          const imageHeight = await new Promise<number>((resolve) => {
            const img = new Image()
            img.onload = () => resolve(img.height)
            img.src = URL.createObjectURL(file)
          })

          console.log({
            imageWidth,
            imageHeight,
          })

          // アップロード処理
          const uploadTask = await uploadBytes(FileRef, file)
          const downloadURL = await getDownloadURL(FileRef)
          console.log(
            'ファイルがアップロードされました',
            uploadTask,
            downloadURL
          )

          // アップロードが成功したらFirestoreにメッセージを追加
          if (serverId !== null && channelId !== null) {
            await addDoc(
              collection(
                db,
                'servers',
                serverId,
                'channels',
                String(channelId),
                'messages'
              ),
              {
                message: null,
                timestamp: serverTimestamp(),
                user: user,
                photoId: fileName,
                imageWidth: imageWidth,
                imageHeight: imageHeight,
              }
            )
            console.log('メッセージが追加されました')
            scrollToBottom()
          }
        } catch (error) {
          console.error('ファイルアップロードエラー:', error)
        }
      }
    },
    [channelId, serverId, user, scrollToBottom]
  )

  const filterMessages = messages.filter((message) => {
    if (searchMessage !== '') {
      return message.message
        ?.toLowerCase()
        .includes(searchMessage.toLowerCase())
    } else {
      return true
    }
  })

  //ファイル入力の参照が初期化されたらログを出力
  useEffect(() => {
    console.log(
      'fileInputRef初期化:',
      fileInputRef.current ? '存在します' : 'nullです'
    )
  }, [])

  return (
    <>
      {/* サーバーを選択していない場合はサーバー選択画面を表示 */}
      {!isServerSelected && (
        <div className="flex h-svh w-full items-center justify-center">
          <h1 className="mt-5 text-center text-2xl">
            サーバーを選択または
            <br />
            作成してください
          </h1>
        </div>
      )}
      {/* サーバーを選択していて、かつisLoadingがtrueの場合はLoadingScreenを表示 */}
      {isServerSelected && isLoading && <LoadingScreen />}
      {/* サーバーを選択していて、かつisLoadingがfalseの場合はチャット画面を表示 */}
      {isServerSelected && !isLoading && (
        <div className="relative flex h-full w-full">
          <div
            className="flex h-svh min-w-0 flex-col"
            style={{ minWidth: 0, flexGrow: 1 }}
          >
            {/* chatHeader */}
            <ChatHeader
              channelName={channelName}
              onSearchMessage={setSearchMessage}
              onToggleMemberSidebar={() =>
                setIsMemberSidebarOpen(!isMemberSidebarOpen)
              }
              onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
            {!isServerSelected ? (
              <div className="flex h-[calc(100svh-77px-56px)] w-full flex-col items-center justify-center">
                <div className="bg-grey-100 max-w-md -translate-x-[10%] transform rounded-lg p-8 text-center text-black md:-translate-x-[15%]">
                  <h3 className="mb-2 text-lg font-medium">
                    サーバーが選択されていません
                  </h3>
                  <p className="text-white-400 text-sm">
                    サーバーを選択するかサーバーに参加してください
                  </p>
                </div>
              </div>
            ) : !isChannelSelected ? (
              <div className="flex h-[calc(100svh-77px-56px)] w-full flex-col items-center justify-center">
                <div className="bg-grey-100 max-w-md -translate-x-[10%] transform rounded-lg p-8 text-center text-black md:-translate-x-[15%]">
                  <h3 className="mb-2 text-lg font-medium">
                    チャンネルが選択されていません
                  </h3>
                  <p className="text-white-400 text-sm">
                    チャンネルを選択してメッセージを送信してください
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* chatMessage */}
                <div className="scrollbar scrollbar-w-2 scrollbar-track-[#2f3136] scrollbar-track-rounded-md scrollbar-thumb-[#202225] scrollbar-thumb-rounded-md hover:scrollbar-thumb-[#2f3136] flex-1 overflow-y-auto px-4">
                  {filterMessages.map((message, index) => (
                    <ChatMessage
                      id={message.id}
                      key={index}
                      message={message.message}
                      timestamp={message.timestamp}
                      user={message.user}
                      photoId={message.photoId}
                      photoURL={message.photoURL}
                      imageWidth={message.imageWidth}
                      imageHeight={message.imageHeight}
                      reactions={message.reactions}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {/* chatInput */}
                <div className="mx-4 flex items-center justify-between rounded-lg bg-white p-2.5 text-gray-700">
                  <input
                    type="file"
                    className="hidden"
                    id="file-input"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                  <label
                    htmlFor="file-input"
                    className="flex cursor-pointer items-center justify-center border-none bg-transparent px-4 text-gray-500 transition-colors duration-200 hover:text-gray-700"
                  >
                    <AddCircleOutlineIcon className="text-2xl" />
                  </label>
                  <form
                    className="flex flex-grow items-center"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (inputText.trim()) {
                        sendMessage(e)
                      }
                    }}
                  >
                    <Input
                      type="text"
                      placeholder={
                        channelName
                          ? `${channelName}へメッセージを送信`
                          : 'メッセージを送信'
                      }
                      onChange={(e) => {
                        setInputText(e.target.value)
                      }}
                      value={inputText}
                      className="border border-gray-300 bg-white text-black"
                    />
                    <button
                      type="submit"
                      className="md:hidden"
                      onClick={(
                        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
                      ) => sendMessage(e)}
                      disabled={!inputText.trim()}
                    >
                      <Send className="ml-2" />
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* メンバーサイドバーのオーバーレイ（モバイル用） */}
          {isMemberSidebarOpen && isServerSelected && (
            <div
              className="mobile-overlay md:hidden"
              onClick={() => setIsMemberSidebarOpen(false)}
            />
          )}

          {/* メンバーサイドバー */}
          {isServerSelected && (
            <div
              className={`fixed top-0 right-0 bottom-0 z-40 h-screen w-60 min-w-[240px] flex-shrink-0 border-l border-gray-200 bg-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
                isMemberSidebarOpen ? 'translate-x-0' : 'translate-x-full'
              } md:translate-x-0`}
              style={{ minWidth: '240px', flexShrink: 0 }}
            >
              <MemberSidebar key={channelId} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default Chat
