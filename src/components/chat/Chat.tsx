import ChatHeader from './ChatHeader'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ChatMessage from './ChatMessage'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  useCallback,
  useRef,
  useState,
  lazy,
  Suspense,
  useLayoutEffect,
  FormEvent,
  useEffect,
} from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import useMessage from '../../hooks/useMessage'
import MemberSidebar from '../sidebar/MemberSidebar'
import { Input } from '../ui/input'
import { Send, X, Loader2, Reply } from 'lucide-react'
import { toast } from 'sonner'
import LoadingScreen from '../loading/LoadingScreen'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import NoServerView from '../sidebar/NoServerView'
import { CreateServer } from '../sidebar/CreateServer'
import { setChannelInfo } from '@/features/channelSlice'
import { setServerInfo } from '@/features/serverSlice'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { uploadImage } from '../../utils/imageUtils'

interface ChatProps {
  isMemberSidebarOpen: boolean
  setIsMemberSidebarOpen: (isOpen: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (isOpen: boolean) => void
  isMapMode: boolean
  setIsMapMode: (isMapMode: boolean) => void
  setIsImageDialogOpen: (isOpen: boolean) => void
}

// 地図コンポーネントを動的にインポート

// 遅延インポート
const MapView = lazy(() => import('./MapView')) // 必要になった時に読み込まれる(地図タブを開いた時に初めて読み込む)

// ユーザー情報の型定義
interface User {
  uid: string
  email?: string
  photoURL?: string
  displayName?: string
}

// メッセージデータの型定義
interface MessageData {
  message: string | null
  timestamp: ReturnType<typeof serverTimestamp>
  user: User | null
  photoId: string | null
  photoExtension?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  latitude?: number | null
  longitude?: number | null
  replyTo?: {
    messageId: string
    message: string | null
    displayName: string | null
    photoId: string | null
    photoExtension?: string | null
  }
}

const Chat = ({
  isMemberSidebarOpen,
  setIsMemberSidebarOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setIsMapMode,
  setIsImageDialogOpen,
}: ChatProps) => {
  const [inputText, setInputText] = useState<string>('')
  const [searchMessage, setSearchMessage] = useState<string>('')
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  // チャットコンテナの参照を追加
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // URLパラメータからサーバーIDとチャンネルIDを取得する処理
  useEffect(() => {
    const urlServerId = searchParams.get('serverId')
    const urlChannelId = searchParams.get('channelId')
    const urlMessageId = searchParams.get('messageId')

    if (urlServerId && urlChannelId) {
      console.log('URLパラメータ:', { urlServerId, urlChannelId, urlMessageId })
      dispatch(setServerInfo({ serverId: urlServerId }))
      dispatch(setChannelInfo({ channelId: urlChannelId }))
    }
    // URLパラメータをクリア

    // 他の処理が終わった後にURLを整理するために、少し遅延させる
    setTimeout(() => {
      navigate('/', { replace: true })
    }, 500)
  }, [dispatch, navigate, searchParams])

  // スクロール処理を最適化（モバイル対応）
  useLayoutEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      // 通常のスクロール
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight

      // モバイル用の追加対応
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop =
            chatContainerRef.current.scrollHeight
          // window全体のスクロールも制御
          window.scrollTo(0, document.documentElement.scrollHeight)
        }
      })
    }
  }, [messages])

  // 既存のscrollToBottom処理も維持
  const scrollToBottom = useCallback(() => {
    const messageEnd = messagesEndRef.current
    if (!messageEnd) return

    messageEnd.scrollIntoView({
      behavior: 'instant',
      block: 'end',
    })
    // モバイル用の追加対応
    window.scrollTo(0, document.documentElement.scrollHeight)
  }, [])

  // メッセージが更新されたときにもスクロール
  useLayoutEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  // 初期表示時にスクロール位置を最下部に設定
  useLayoutEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // 画像アップロード完了時にスクロール
  useEffect(() => {
    if (!isUploading && messages.length > 0) {
      scrollToBottom()
    }
  }, [isUploading, messages.length, scrollToBottom])

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
  }, [selectedFilePreview])

  const [replyingTo, setReplyingTo] = useState<{
    messageId: string
    message: string | null
    displayName: string | null
    photoId: string | null
    photoExtension?: string | null
  } | null>(null)

  const [repliedMessageId, setRepliedMessageId] = useState<string | null>(null)

  const cancelReply = useCallback(() => {
    setReplyingTo(null)
    setRepliedMessageId(null)
  }, [])

  const handleReply = useCallback(
    (
      messageId: string,
      message: string | null,
      displayName: string | null,
      photoId: string | null,
      photoExtension?: string | null
    ) => {
      setReplyingTo({
        messageId,
        message,
        displayName,
        photoId,
        photoExtension,
      })
      setRepliedMessageId(messageId)
      // 入力フィールドにフォーカスを当てる
      document.getElementById('message-input')?.focus()
    },
    []
  )

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
        imageWidth: imageWidth ?? undefined,
        imageHeight: imageHeight ?? undefined,
        ...(locationData ? {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        } : {})
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

  // ファイル選択時の処理
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

  const filterMessages = messages.filter((message) => {
    // 検索ワードが入力されている場合
    if (searchMessage !== '') {
      return message.message
        ?.toLowerCase()
        .includes(searchMessage.toLowerCase())
    } else {
      // 検索ワードが入力されていない場合はすべてのメッセージを表示
      return true
    }
  })

  //ファイル入力の参照が初期化されたらログを出力
  // useEffect(() => {
  //   console.log(
  //     'fileInputRef初期化:',
  //     fileInputRef.current ? '存在します' : 'nullです'
  //   )
  // }, [])

  // タブのステートを追加
  const [activeTab, setActiveTab] = useState<string>('chat')

  // タブが変更されたときの処理
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value)
      // マップモード状態を更新
      setIsMapMode(value === 'map')
    },
    [setIsMapMode]
  )

  // MapPinアイコンクリック時の処理を修正
  const handleMapClick = useCallback(() => {
    const newTabValue = activeTab === 'map' ? 'chat' : 'map'
    setActiveTab(newTabValue)
    // マップモード状態を更新
    setIsMapMode(newTabValue === 'map')
  }, [activeTab, setIsMapMode])

  // MessageCircleMoreアイコンクリック時の処理を修正
  const handleChatClick = useCallback(() => {
    setActiveTab('chat')
    // マップモード状態を更新
    setIsMapMode(false)

    // タブ切り替え後、少し遅延させてスクロールを最下部に移動
    setTimeout(() => {
      scrollToBottom()
    }, 100)
  }, [setIsMapMode, scrollToBottom])

  // 明確な名前のハンドラー関数に変更
  const handleMobileMenuToggle = useCallback(() => {
    // console.log('モバイルメニュー切り替え');
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }, [isMobileMenuOpen, setIsMobileMenuOpen])

  const handleMemberSidebarToggle = useCallback(() => {
    // console.log('メンバーサイドバー切り替え');
    setIsMemberSidebarOpen(!isMemberSidebarOpen)
  }, [isMemberSidebarOpen, setIsMemberSidebarOpen])

  // CreateServerを開くための状態を追加
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false)

  return (
    <>
      {/* サーバーを選択していない場合はNoServerViewを表示 */}
      {!isServerSelected && (
        <NoServerView onCreateServer={() => setIsCreateServerOpen(true)} />
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
              onToggleMobileMenu={handleMobileMenuToggle}
              onToggleMemberSidebar={handleMemberSidebarToggle}
              onMapClick={handleMapClick}
              onChatClick={handleChatClick}
              activeTab={activeTab}
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
              // Tabsコンポーネントを使用
              <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex h-[calc(100svh-77px)] flex-1 flex-col"
              >
                <TabsContent
                  value="chat"
                  className="flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col"
                >
                  {/* チャットメッセージ表示エリアから削除 */}
                  <div
                    ref={chatContainerRef}
                    className="chat-messages h-[calc(100svh-77px-56px)] flex-1 overflow-y-auto overscroll-none p-4"
                  >
                    {filterMessages.map((message, index) => (
                      <ChatMessage
                        id={message.id}
                        key={index}
                        message={message.message}
                        timestamp={message.timestamp}
                        user={message.user}
                        photoId={message.photoId}
                        photoExtension={message.photoExtension}
                        photoURL={message.photoURL}
                        imageWidth={message.imageWidth}
                        imageHeight={message.imageHeight}
                        reactions={message.reactions}
                        latitude={message.latitude}
                        longitude={message.longitude}
                        setIsImageDialogOpen={setIsImageDialogOpen}
                        onReply={handleReply}
                        replyTo={message.replyTo}
                        isReplied={message.id === repliedMessageId}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* チャット入力エリアの上部にリプライ情報を追加 */}
                  <div className="mx-4 mb-4 flex flex-col rounded-lg text-gray-400">
                    {/* リプライ情報 */}
                    {replyingTo && (
                      <div className="mb-2 flex items-center justify-between rounded-t-md bg-gray-100 p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center text-gray-500">
                            <Reply className="mr-1 h-3.5 w-3.5" />
                            <span>返信先: </span>
                          </div>
                          <span className="font-medium text-gray-700">
                            {replyingTo.displayName}
                          </span>
                          <span className="line-clamp-1 max-w-[200px] overflow-hidden text-ellipsis text-gray-500">
                            {replyingTo.message ||
                              (replyingTo.photoId ? '「画像」' : '')}
                          </span>
                        </div>
                        <button
                          onClick={cancelReply}
                          className="rounded-full p-1 hover:bg-gray-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* 選択した画像のプレビュー */}
                    {selectedFilePreview && (
                      <div className="relative m-2 inline-block max-w-full">
                        <img
                          src={selectedFilePreview}
                          alt="プレビュー"
                          className="max-h-32 rounded-md object-contain p-3"
                        />
                        <button
                          onClick={clearSelectedFile}
                          className="absolute top-1 right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white/80 shadow-sm hover:bg-white"
                        >
                          <X className="h-4 w-4 text-gray-800 hover:text-gray-600" />
                        </button>
                      </div>
                    )}

                    {/* 入力フォーム */}
                    <div className="flex items-center justify-between p-2.5">
                      <input
                        type="file"
                        className="hidden"
                        id="file-input"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*;capture=camera"
                        disabled={isUploading}
                      />
                      <label
                        htmlFor="file-input"
                        className={`flex cursor-pointer items-center justify-center border-none bg-transparent px-4 transition-colors duration-200 ${
                          isUploading
                            ? 'cursor-not-allowed opacity-50'
                            : selectedFile // selectedFileの有無でスタイルを切り替え
                              ? 'text-blue-500 hover:text-blue-600' // ファイル選択時は青色
                              : 'text-gray-500 hover:text-gray-700' // 未選択時はグレー
                        }`}
                      >
                        <AddCircleOutlineIcon
                          className={`text-2xl ${isUploading ? 'opacity-50' : ''}`}
                        />
                      </label>
                      <form
                        className="flex flex-grow items-center"
                        onSubmit={sendMessage}
                      >
                        <Input
                          id="message-input"
                          type="text"
                          placeholder={
                            channelName
                              ? `${channelName}へメッセージを送信`
                              : 'メッセージを送信'
                          }
                          onChange={(e) => setInputText(e.target.value)}
                          value={inputText}
                          disabled={isUploading}
                          className="border border-gray-300 bg-white text-black disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={
                            (!inputText.trim() && !selectedFile) || isUploading
                          }
                          className={`ml-2 transition-opacity duration-200 ${
                            (!inputText.trim() && !selectedFile) || isUploading
                              ? 'cursor-not-allowed opacity-50'
                              : 'text-blue-500 hover:text-blue-600'
                          }`}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send />
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent
                  value="map"
                  className="flex-1 data-[state=active]:flex data-[state=active]:flex-col"
                >
                  <div className="h-full w-full">
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center">
                          地図を読み込み中...
                        </div>
                      }
                    >
                      {activeTab === 'map' && (
                        <MapView messages={filterMessages} />
                      )}
                    </Suspense>
                  </div>
                </TabsContent>
              </Tabs>
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

      {/* 送信フォーム部分 */}
      <div className="relative flex items-center gap-2 px-4 py-2">
        <form className="flex w-full items-center gap-2" onSubmit={sendMessage}>
          {selectedFile && (
            <div className="relative mb-2 flex items-center gap-2">
              <div className="relative">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="選択された画像"
                  className="h-20 w-20 rounded object-cover"
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded bg-black/20">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <Input
            type="text"
            placeholder={
              selectedFile ? '画像とメッセージを送信...' : 'メッセージを入力...'
            }
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(e as unknown as FormEvent)
              }
            }}
            value={inputText}
            className="border border-gray-300 bg-white text-black"
          />
          <button
            type="submit"
            className={`ml-2 ${
              inputText.trim() || selectedFile
                ? 'text-blue-500'
                : 'text-grey-400'
            }`}
            disabled={!inputText.trim() && !selectedFile}
          >
            <Send />
          </button>
        </form>
      </div>

      {/* CreateServerコンポーネントをエクスポート */}
      <CreateServer
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
      />
    </>
  )
}

export default Chat
