import ChatHeader from './ChatHeader'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ChatMessage from './ChatMessage'
import { useAppSelector } from '../../app/hooks'
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { db, storage } from '../../firebase'
import useMessage from '../../hooks/useMessage'
import MemberSidebar from '../sidebar/MemberSidebar'
import { ref, uploadBytes } from 'firebase/storage'
import { v4 as uuid4 } from 'uuid'
import { Input } from '../ui/input'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import LoadingScreen from '../loading/LoadingScreen'
import { Tabs, TabsContent } from "@/components/ui/tabs"

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
const MapView = lazy(() => import('./MapView'));

// ユーザー情報の型定義
interface User {
  uid: string;
  email?: string;
  photoURL?: string;
  displayName?: string;
}

// メッセージデータの型定義
interface MessageData {
  message: string | null;
  timestamp: ReturnType<typeof serverTimestamp>;
  user: User | null;
  photoId: string | null;
  imageWidth?: number;
  imageHeight?: number;
  latitude?: number;
  longitude?: number;
}

const Chat = ({
  isMemberSidebarOpen,
  setIsMemberSidebarOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  setIsMapMode,
  setIsImageDialogOpen,
}: ChatProps) => {
  // 状態を先に宣言
  const [inputText, setInputText] = useState<string>('')
  const [searchMessage, setSearchMessage] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [fileImageDimensions, setFileImageDimensions] = useState<{ width: number, height: number } | null>(null);

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
    
  }, [isLoading])

  // 関連するstateを宣言した後に関数を定義
  const clearSelectedFile = useCallback(() => {
    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFile(null);
    setSelectedFilePreview(null);
    setFileImageDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFilePreview]);

  // sendMessage関数はここで定義
  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      
      // テキストも画像も何もない場合は送信しない
      if (!inputText.trim() && !selectedFile) {
        return;
      }
      
      if (serverId !== null && channelId !== null) {
        try {
          // アップロード処理開始時のローディング表示
          if (selectedFile) {
            setIsUploading(true);
          }
          
          let photoId = null;
          let fileName = null;
          let imageWidth = null;
          let imageHeight = null;
          
          // 位置情報の取得を試みる
          const locationData = await new Promise<{ latitude: number, longitude: number } | null>((resolve) => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                  });
                  toast.success('位置情報を取得しました');
                },
                (error) => {
                  console.error('位置情報の取得に失敗しました:', error);
                  resolve(null);
                },
                { timeout: 10000, enableHighAccuracy: true }
              );
            } else {
              resolve(null);
            }
          });
          
          // 画像がある場合はアップロード
          if (selectedFile) {
            photoId = uuid4();
            fileName = photoId + selectedFile.name;
            const fileRef = ref(storage, fileName);
            
            await uploadBytes(fileRef, selectedFile);
            
            if (fileImageDimensions) {
              imageWidth = fileImageDimensions.width;
              imageHeight = fileImageDimensions.height;
            }
          }
          
          // Firestoreにメッセージを追加
          const messageData: MessageData = {
            message: inputText || null,
            timestamp: serverTimestamp(),
            user: user,
            photoId: fileName,
            imageWidth: imageWidth ?? undefined,
            imageHeight: imageHeight ?? undefined,
          };
          
          // 位置情報がある場合は追加
          if (locationData) {
            messageData.latitude = locationData.latitude;
            messageData.longitude = locationData.longitude;
          }
          
          // Firestoreに保存
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
          );
          
          // 入力フィールドをクリア
          setInputText('');
          clearSelectedFile();
          
          // 処理終了
          setIsUploading(false);
          scrollToBottom();
        } catch (error) {
          console.error('メッセージの送信に失敗しました:', error);
          toast.error('メッセージの送信に失敗しました');
          setIsUploading(false);
        }
      }
    },
    [channelId, inputText, serverId, user, selectedFile, fileImageDimensions, clearSelectedFile, scrollToBottom]
  )

  // ファイル選択時の処理を変更
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        
        if (file.size > MAX_FILE_SIZE) {
          toast.error('ファイルサイズが大きすぎます (最大: 5MB)', {
            duration: 3000,
          });
          e.target.value = '';
          return;
        }

        // 選択したファイルを状態に保存
        setSelectedFile(file);
        
        // プレビュー用のURLを作成
        const previewURL = URL.createObjectURL(file);
        setSelectedFilePreview(previewURL);
        
        // 画像のサイズを取得
        const img = new Image();
        img.onload = () => {
          setFileImageDimensions({
            width: img.width,
            height: img.height
          });
        };
        img.src = previewURL;
        
        // 入力欄にフォーカスを当てる
        document.getElementById('message-input')?.focus();
      }
    },
    []
  );

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
  // useEffect(() => {
  //   console.log(
  //     'fileInputRef初期化:',
  //     fileInputRef.current ? '存在します' : 'nullです'
  //   )
  // }, [])

  // タブのステートを追加
  const [activeTab, setActiveTab] = useState<string>("chat");

  // タブが変更されたときの処理
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    // マップモード状態を更新
    setIsMapMode(value === "map");
  }, [setIsMapMode]);

  // MapPinアイコンクリック時の処理を修正
  const handleMapClick = useCallback(() => {
    const newTabValue = activeTab === "map" ? "chat" : "map";
    setActiveTab(newTabValue);
    // マップモード状態を更新
    setIsMapMode(newTabValue === "map");
  }, [activeTab, setIsMapMode]);

  // MessageCircleMoreアイコンクリック時の処理を修正
  const handleChatClick = useCallback(() => {
    setActiveTab("chat");
    // マップモード状態を更新
    setIsMapMode(false);

    // タブ切り替え後、少し遅延させてスクロールを最下部に移動
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  }, [setIsMapMode, scrollToBottom]);

  // 明確な名前のハンドラー関数に変更
  const handleMobileMenuToggle = useCallback(() => {
    // console.log('モバイルメニュー切り替え');
    setIsMobileMenuOpen(!isMobileMenuOpen);
  }, [isMobileMenuOpen, setIsMobileMenuOpen]);

  const handleMemberSidebarToggle = useCallback(() => {
    // console.log('メンバーサイドバー切り替え');
    setIsMemberSidebarOpen(!isMemberSidebarOpen);
  }, [isMemberSidebarOpen, setIsMemberSidebarOpen]);

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
                className="flex-1 flex flex-col h-[calc(100svh-77px)]"
              >
                <TabsContent value="chat" className="flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col">
                  {/* チャットメッセージ表示エリア（既存のコード） */}
                  <div className="chat-messages flex-1 overflow-y-auto p-4">
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
                  <div className="mx-4 mb-4 flex flex-col rounded-lg bg-white text-gray-700">
                    {/* 選択した画像のプレビュー */}
                    {selectedFilePreview && (
                      <div className="relative m-2 inline-block max-w-xs">
                        <img 
                          src={selectedFilePreview} 
                          alt="プレビュー" 
                          className="max-h-32 rounded-md object-contain"
                        />
                        <button
                          onClick={clearSelectedFile}
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white hover:bg-gray-700"
                        >
                          &times;
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
                        className={`flex cursor-pointer items-center justify-center border-none bg-transparent px-4 transition-colors duration-200 ${isUploading
                          ? "text-blue-500 animate-pulse"
                          : "text-gray-500 hover:text-gray-700"
                          }`}
                      >
                        <AddCircleOutlineIcon className={`text-2xl ${isUploading ? "text-blue-500" : ""}`} />
                      </label>
                      <form
                        className="flex flex-grow items-center"
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendMessage(e);
                        }}
                      >
                        <Input
                          id="message-input"
                          type="text"
                          placeholder={
                            channelName
                              ? `${channelName}へメッセージを送信`
                              : 'メッセージを送信'
                          }
                          onChange={(e) => {
                            setInputText(e.target.value);
                          }}
                          value={inputText}
                          className="border border-gray-300 bg-white text-black"
                        />
                        <button
                          type="submit"
                          className={`ml-2 ${(inputText.trim() || selectedFile) ? "text-blue-500" : "text-grey-400"}`}
                          disabled={!inputText.trim() && !selectedFile}
                        >
                          <Send />
                        </button>
                      </form>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="map" className="flex-1 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="h-full w-full">
                    <Suspense fallback={<div className="flex items-center justify-center h-full">地図を読み込み中...</div>}>
                      {activeTab === "map" && (
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
              className={`fixed top-0 right-0 bottom-0 z-40 h-screen w-60 min-w-[240px] flex-shrink-0 border-l border-gray-200 bg-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMemberSidebarOpen ? 'translate-x-0' : 'translate-x-full'
                } md:translate-x-0`}
              style={{ minWidth: '240px', flexShrink: 0 }}
            >
              <MemberSidebar key={channelId} />
            </div>
          )}
        </div>
      )}

      {/* 画面全体をカバーするスピナーオーバーレイ - ぼかし効果適用 */}
      {isUploading && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
          <div className="bg-white/90 p-6 rounded-lg shadow-lg flex flex-col items-center backdrop-blur-md">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-700">画像をアップロード中...</p>
          </div>
        </div>
      )}
    </>
  )
}

export default Chat
