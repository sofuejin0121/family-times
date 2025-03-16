import ChatHeader from './ChatHeader'
import ChatMessage from './ChatMessage'
import {
  useCallback,
  useRef,
  useState,
  lazy,
  Suspense,
  useLayoutEffect,
  useEffect,
} from 'react'
import useMessage from '../../hooks/useMessage'
import MemberSidebar from '../sidebar/MemberSidebar'
import LoadingScreen from '../loading/LoadingScreen'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import NoServerView from '../sidebar/NoServerView'
import { CreateServer } from '../sidebar/CreateServer'
import { useChannelStore } from '../../stores/channelSlice'
import { useServerStore } from '../../stores/serverSlice'
import { useUserStore } from '../../stores/userSlice'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useServer from '../../hooks/useServer'
import { ChatProps, ReplyInfo } from '../../types/chat'
import { useMessageSending } from './hooks/useMessageSending'
import { useTabManagement } from './hooks/useTabManagement'
import ChatInputArea from './ChatInputArea'

// 地図コンポーネントを動的にインポート
const MapView = lazy(() => import('./MapView')) // 必要になった時に読み込まれる(地図タブを開いた時に初めて読み込む)

const Chat = ({
  isMemberSidebarOpen,
  setIsMemberSidebarOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setIsMapMode,
  setIsImageDialogOpen,
}: ChatProps) => {
  const [searchMessage, setSearchMessage] = useState<string>('')
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false)

  // リプライ関連の状態
  const [replyingTo, setReplyingTo] = useState<ReplyInfo | null>(null)
  const [repliedMessageId, setRepliedMessageId] = useState<string | null>(null)

  const channelId = useChannelStore((state) => state.channelId)
  const channelName = useChannelStore((state) => state.channelName)
  const user = useUserStore((state) => state.user)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { subDocuments: messages } = useMessage()
  const serverId = useServerStore((state) => state.serverId)
  const isServerSelected = Boolean(serverId)
  const { isLoading } = useMessage()
  const { initialLoadComplete } = useServer()

  // メッセージリストのコンテナへの参照作成
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  // チャットコンテナの参照を追加
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // スクロール処理
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

  // URLパラメータからサーバーIDとチャンネルIDを取得する処理
  useEffect(() => {
    const urlServerId = searchParams.get('serverId')
    const urlChannelId = searchParams.get('channelId')
    const urlMessageId = searchParams.get('messageId')

    if (urlServerId && urlChannelId) {
      console.log('URLパラメータ:', { urlServerId, urlChannelId, urlMessageId })
      useServerStore.getState().setServerInfo({
        serverId: urlServerId,
        serverName: '',
      })
      useChannelStore.getState().setChannelInfo({
        channelId: urlChannelId,
        channelName: '',
      })
    }
    // URLパラメータをクリア

    // 他の処理が終わった後にURLを整理するために、少し遅延させる
    setTimeout(() => {
      navigate('/', { replace: true })
    }, 500)
  }, [navigate, searchParams])

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

  // メッセージ送信関連のカスタムフックを使用
  const {
    inputText,
    setInputText,
    selectedFile,
    selectedFilePreview,
    isUploading,
    handleFileChange,
    clearSelectedFile,
    sendMessage,
  } = useMessageSending({
    serverId,
    channelId,
    user,
    fileInputRef,
    replyingTo,
    setReplyingTo,
    setRepliedMessageId,
    scrollToBottom,
  })

  // タブ管理のカスタムフックを使用
  const { activeTab, handleTabChange, handleMapClick, handleChatClick } =
    useTabManagement({
      setIsMapMode,
      scrollToBottom,
    })

  // リプライ処理
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

  // メッセージのフィルタリング
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

  // モバイルメニュー切り替え
  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }, [isMobileMenuOpen, setIsMobileMenuOpen])

  // メンバーサイドバー切り替え
  const handleMemberSidebarToggle = useCallback(() => {
    setIsMemberSidebarOpen(!isMemberSidebarOpen)
  }, [isMemberSidebarOpen, setIsMemberSidebarOpen])

  return (
    <>
      {/* サーバーを選択していない場合はNoServerViewを表示 */}
      {!isServerSelected && (
        <NoServerView onCreateServer={() => setIsCreateServerOpen(true)} />
      )}
      {/* 初期ロードが完了していない場合のみLoadingScreenを表示 */}
      {isServerSelected && isLoading && !initialLoadComplete && (
        <LoadingScreen />
      )}
      {/* サーバーを選択していて、初期ロードが完了しているか、ロード中でない場合はチャット画面を表示 */}
      {isServerSelected && (!isLoading || initialLoadComplete) && (
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
            ) : (
              // Tabsコンポーネントを使用
              <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="flex h-[calc(100svh-77px)] flex-1 flex-col"
              >
                <TabsContent
                  value="chat"
                  className="flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
                >
                  {/* チャットメッセージ表示エリア */}
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

                  {/* チャット入力エリア */}
                  <ChatInputArea
                    inputText={inputText}
                    setInputText={setInputText}
                    selectedFile={selectedFile}
                    selectedFilePreview={selectedFilePreview}
                    isUploading={isUploading}
                    fileInputRef={fileInputRef}
                    handleFileChange={handleFileChange}
                    clearSelectedFile={clearSelectedFile}
                    sendMessage={sendMessage}
                    channelName={channelName || ''}
                    replyingTo={replyingTo}
                    cancelReply={cancelReply}
                  />
                </TabsContent>

                <TabsContent
                  value="map"
                  className="flex-1 data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden"
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

      {/* CreateServerコンポーネント */}
      <CreateServer
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
      />
    </>
  )
}

export default Chat
