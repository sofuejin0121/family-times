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
import { db, storage } from '../../firebase'
import useMessage from '../../hooks/useMessage'
import MemberSidebar from '../sidebar/MemberSidebar'
import { ref, uploadBytes } from 'firebase/storage'
import { v4 as uuid4 } from 'uuid'
import { Input } from '../ui/input'
import { Send, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import LoadingScreen from '../loading/LoadingScreen'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import NoServerView from '../sidebar/NoServerView'
import { CreateServer } from '../sidebar/CreateServer'
import { setChannelInfo } from '@/features/channelSlice'
import { setServerInfo } from '@/features/serverSlice'
import { useNavigate, useSearchParams } from 'react-router-dom'
import exifReadData from './exifReadData'

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
  imageWidth?: number
  imageHeight?: number
  latitude?: number
  longitude?: number
}

// GPSデータの型定義を追加
type GPSValue = string | number

// EXIFデータから位置情報を抽出する関数
const getImageLocation = async (
  file: File
): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    console.log('ファイル解析開始:', file.name, file.type, file.size)

    // exifReadDataを使用してEXIF情報を取得
    exifReadData(file)
      .then((exifData) => {
        // 解析できない場合や情報がない場合
        if (!exifData) {
          console.log('EXIF情報が見つかりませんでした')
          resolve(null)
          return
        }

        console.log('取得したEXIF情報:', exifData)

        // GPS情報がある場合
        if (exifData.GPS) {
          const gps = exifData.GPS
          console.log('GPS情報:', gps)

          // GPSデータの変換関数
          const convertDMSToDecimal = (dmsArray: GPSValue[]): number | null => {
            if (!Array.isArray(dmsArray) || dmsArray.length < 3) return null

            try {
              // "x/y" 形式の文字列から数値に変換する関数
              const parseRational = (rational: GPSValue): number => {
                if (typeof rational !== 'string') return Number(rational) || 0
                const parts = rational.split('/')
                if (parts.length !== 2) return 0
                const numerator = parseFloat(parts[0])
                const denominator = parseFloat(parts[1])
                return denominator !== 0 ? numerator / denominator : 0
              }

              // 度分秒を10進数に変換
              const degrees = parseRational(dmsArray[0])
              const minutes = parseRational(dmsArray[1])
              const seconds = parseRational(dmsArray[2])

              return degrees + minutes / 60 + seconds / 3600
            } catch (error) {
              console.error('DMS変換エラー:', error)
              return null
            }
          }

          // 標準形式のGPS情報をチェック
          if (
            gps.GPSLatitude &&
            gps.GPSLongitude &&
            Array.isArray(gps.GPSLatitude) &&
            Array.isArray(gps.GPSLongitude)
          ) {
            const latitude = convertDMSToDecimal(gps.GPSLatitude)
            const longitude = convertDMSToDecimal(gps.GPSLongitude)

            // 南緯・西経の場合、値を反転
            const latSign = gps.GPSLatitudeRef === 'S' ? -1 : 1
            const lonSign = gps.GPSLongitudeRef === 'W' ? -1 : 1

            if (latitude !== null && longitude !== null) {
              resolve({
                latitude: latitude * latSign,
                longitude: longitude * lonSign,
              })
              return
            }
          }
        }

        // COMPUTED内のGPS情報をチェック
        if (
          exifData.COMPUTED &&
          typeof exifData.COMPUTED.GPSLatitude !== 'undefined' &&
          typeof exifData.COMPUTED.GPSLongitude !== 'undefined'
        ) {
          const latitude = parseFloat(String(exifData.COMPUTED.GPSLatitude))
          const longitude = parseFloat(String(exifData.COMPUTED.GPSLongitude))

          if (!isNaN(latitude) && !isNaN(longitude)) {
            resolve({ latitude, longitude })
            return
          }
        }

        // 位置情報が見つからなかった場合
        console.log('GPS情報が見つかりませんでした')
        resolve(null)
      })
      .catch((error) => {
        console.error('EXIF情報の読み取りに失敗しました:', error)
        resolve(null)
      })
  })
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

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    try {
      let photoId = null
      let fileName = null
      let imageWidth = null
      let imageHeight = null
      let locationData = null // EXIF位置情報用

      // 画像がある場合のみ処理
      if (selectedFile) {
        photoId = uuid4()
        fileName = photoId + selectedFile.name
        const fileRef = ref(storage, fileName)

        // 画像のアップロード
        await uploadBytes(fileRef, selectedFile)

        // 画像サイズの取得
        if (fileImageDimensions) {
          imageWidth = fileImageDimensions.width
          imageHeight = fileImageDimensions.height
        }

        // EXIF位置情報の取得（imageLocationにはEXIFから取得した位置情報が入っている）
        if (imageLocation) {
          locationData = {
            latitude: imageLocation.latitude,
            longitude: imageLocation.longitude,
          }
        }
      }

      // Firestoreにメッセージを追加
      const messageData: MessageData = {
        message: inputText || null,
        timestamp: serverTimestamp(),
        user: user,
        photoId: fileName,
      }

      // 画像サイズがある場合のみ追加
      if (imageWidth) {
        messageData.imageWidth = imageWidth
      }
      if (imageHeight) {
        messageData.imageHeight = imageHeight
      }

      // EXIF位置情報がある場合のみ追加
      if (locationData) {
        messageData.latitude = locationData.latitude
        messageData.longitude = locationData.longitude
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
      } else {
        console.error('サーバーIDまたはチャンネルIDが無効です')
        toast.error('メッセージの保存に失敗しました')
      }

      // 入力フィールドをクリア
      setInputText('')
      clearSelectedFile()
      setImageLocation(null)

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
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // ファイルの詳細情報をログに出力
        try {
          const exifr = await import('exifr')
          // 全メタデータを取得して確認（デバッグ用）
          const allMetadata = await exifr.default.parse(file)
          console.log('すべてのメタデータ:', allMetadata)

          // 位置情報を取得
          const locationData = await getImageLocation(file)
          console.log('取得した位置情報:', locationData)

          if (locationData) {
            setImageLocation(locationData)
            toast.success('写真から位置情報を取得しました')
          } else {
            setImageLocation(null)
            console.log('位置情報は取得できませんでした')
          }
        } catch (error) {
          console.error('メタデータ取得エラー:', error)
          setImageLocation(null)
        }

        // 入力欄にフォーカスを当てる
        document.getElementById('message-input')?.focus()
      }
    },
    []
  )

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
                  {/* チャットメッセージ表示エリア（既存のコード） */}
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
                        photoURL={message.photoURL}
                        imageWidth={message.imageWidth}
                        imageHeight={message.imageHeight}
                        reactions={message.reactions}
                        latitude={message.latitude}
                        longitude={message.longitude}
                        setIsImageDialogOpen={setIsImageDialogOpen}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* チャット入力エリア（既存のコード） */}
                  <div className="mx-4 mb-4 flex flex-col rounded-lg text-gray-400">
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
                        accept="image/*"
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
      {/* 画面全体をカバーするスピナーオーバーレイ - ぼかし効果適用 */}
      {/* {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm">
          <div className="flex flex-col items-center rounded-lg bg-white/90 p-6 shadow-lg backdrop-blur-md">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-gray-700">画像をアップロード中...</p>
          </div>
        </div>
      )} */}

      {/* CreateServerコンポーネントをエクスポート */}
      <CreateServer
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
      />
    </>
  )
}

export default Chat
