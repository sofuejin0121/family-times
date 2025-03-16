import { useEffect, useLayoutEffect, useState } from 'react'
import Login from './components/login/Login'
import { auth, setupFCMListener } from './firebase'
import { useUserStore } from './stores/userSlice'
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useNavigate,
} from 'react-router-dom'
import { InvitePage } from './pages/InvitePage'
import { Toaster } from '@/components/ui/sonner'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import Chat from './components/chat/Chat'
import { SidebarProvider } from '@/components/ui/sidebar'
import LoadingScreen from './components/loading/LoadingScreen'
import NewUserProfile from './pages/NewUserProfile'
import { toast } from 'sonner'
import { InviteRedirect } from './pages/InviteRedirect'
import { Button } from '@/components/ui/button'
import { MapProvider } from 'react-map-gl'

// エラーハンドリング用コンポーネント
// URLが無効な形式の時に表示される画面
const InvalidInvitePath = () => {
  const navigate = useNavigate() // ここではRouterの中なので使用可能
  return (
    <div className="flex h-svh w-full items-center justify-center">
      <div className="p-4 text-center">
        <p className="mb-4 text-xl">無効なURLフォーマットです</p>
        <p className="mb-4 text-sm text-gray-500">
          正しい招待リンクを使用してください
        </p>
        {/* replace: trueは履歴を置き換える(戻るボタンでこの画面に戻れないようにする) */}
        <Button onClick={() => navigate('/', { replace: true })}>
          ホームに戻る
        </Button>
      </div>
    </div>
  )
}

// ディープリンクをチェックするコンポーネント
// URLの形式が正しくない場合に修正するためのコンポーネント
// 例: '/invite/https://...' のような形式を '/invite?invite=...' に修正
const DeepLinkChecker = () => {
  const navigate = useNavigate() // ここではRouterの中なので使用可能
  // コンポーネントがマウントされた時に実行される
  useLayoutEffect(() => {
    // 現在のURLパスとフルURLを取得
    // URLのパス部分（ドメインの後の/から始まる部分）
    const path = window.location.pathname
    //完全なURL全体を取得
    const fullUrl = window.location.href

    // 問題のある形式のURLパターンをチェック
    // '/invite/http' で始まるURLは不正な形式
    if (path.startsWith('/invite/http')) {
      console.log('問題のあるディープリンクを検出:', path)

      // URLから招待コードを抽出
      try {
        const match = fullUrl.match(/[?&]invite=([^&]+)/)
        if (match && match[1]) {
          const inviteCode = match[1]
          console.log('抽出された招待コード:', inviteCode)
          navigate(`/invite?invite=${inviteCode}`, { replace: true })
        } else {
          // 招待コードが見つからない場合はホームにリダイレクト
          navigate('/', { replace: true })
        }
      } catch (e) {
        console.error('深いリンク処理エラー:', e)
        navigate('/', { replace: true })
      }
    }
  }, [navigate])

  return null // UIはレンダリングしない
}

function App() {
  useEffect(() => {
    // FCMのリスナーのみ初期化
    setupFCMListener()
  }, [])
  const isAuthChecking = useUserStore((state) => state.isAuthChecking)
  const user = useUserStore((state) => state.user)
  const [isInitialized, setIsInitialized] = useState(false)
  // モバイルでは初期状態で非表示に設定
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false)
  // タップ時の誤動作を防ぐためのスワイプ時の処理を実行しない最小距離
  const minimumDistance = 30
  //  地図モードの状態
  const [isMapMode, setIsMapMode] = useState(false)
  // スワイプ状態を管理
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 })
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 })
  // スワイプ動作を検出するフラグを追加
  const [isSwiping, setIsSwiping] = useState(false)

  // タッチ開始時の処理
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // スワイプ不可領域のチェック
    // data-no-swipe属性がある要素ではスワイプを無効化
    if ((e.target as HTMLElement).closest('[data-no-swipe]')) {
      return
    }

    // タッチ開始時に両方の座標を同じ値に初期化
    const touchPosition = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
    setTouchStart(touchPosition)
    setTouchEnd(touchPosition) // 同じ値で初期化
    setIsSwiping(false) // スワイプフラグを初期化
  }

  // タッチ移動時の処理
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // タッチ開始が記録されていない場合は処理しない
    if (touchStart.x === 0 && touchStart.y === 0) return

    setTouchEnd({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    })

    // 最小移動距離を超えた場合のみスワイプとみなす
    const currentDistanceX = Math.abs(e.touches[0].clientX - touchStart.x)
    if (currentDistanceX > minimumDistance / 2) {
      setIsSwiping(true)
    }
  }

  // タッチ終了時の処理
  const handleTouchEnd = () => {
    // モバイルデバッグ用のログを追加
    console.log(
      'TouchEnd - isSwiping:',
      isSwiping,
      'isMapMode:',
      isMapMode,
      'isImageDialogOpen:',
      isImageDialogOpen
    )

    // スワイプ動作がない場合や無効化条件の場合は処理しない
    if (!isSwiping || isMapMode || isImageDialogOpen) return

    const distanceX = Math.abs(touchEnd.x - touchStart.x)
    const distanceY = Math.abs(touchEnd.y - touchStart.y)

    if (distanceX > distanceY && distanceX > minimumDistance) {
      // 既存のスワイプ処理
      if (touchEnd.x > touchStart.x) {
        // 右スワイプ
        if (isMemberSidebarOpen) {
          setIsMemberSidebarOpen(false)
        } else {
          setIsMobileMenuOpen(true)
        }
      } else {
        // 左スワイプ
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false)
        } else if (isMemberSidebarOpen) {
          setIsMemberSidebarOpen(false)
        }
      }
    }

    // タッチ終了後に状態をリセット
    setTouchStart({ x: 0, y: 0 })
    setTouchEnd({ x: 0, y: 0 })
    setIsSwiping(false)
  }

  // App.tsxに新しい状態を追加
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)

  // ログイン直後のフラグを管理
  const [isJustLoggedIn, setIsJustLoggedIn] = useState(false)

  // プロフィール設定が必要かどうかを判定
  const needsProfileSetup =
    user &&
    !isJustLoggedIn && // ログイン直後は判定しない
    (!user.displayName || user.displayName === user.email?.split('@')[0]) &&
    !user.photo &&
    user.email &&
    !user.email.includes('gmail.com') // Googleログイン以外の場合

  // 認証状態の確認を useLayoutEffect で行う
  useLayoutEffect(() => {
    useUserStore.getState().startAuthCheck()

    const unsubscribe = auth.onAuthStateChanged((loginUser) => {
      if (loginUser) {
        if (
          !loginUser.emailVerified &&
          loginUser.providerData[0]?.providerId === 'password'
        ) {
          toast.error(
            'メールアドレスの認証が完了していません。受信したメールのリンクをクリックしてください。'
          )
          auth.signOut()
          return
        }

        const displayName =
          loginUser.displayName ||
          (loginUser.email ? loginUser.email.split('@')[0] : '名称未設定')

        useUserStore.getState().login({
          uid: loginUser.uid,
          photo: loginUser.photoURL || '',
          email: loginUser.email || '',
          displayName: displayName,
        })

        setIsJustLoggedIn(true)
        setTimeout(() => setIsJustLoggedIn(false), 300)
      } else {
        useUserStore.getState().logout()
      }
      setIsInitialized(true)
    })

    return () => unsubscribe()
  }, [])

  // 初期化とサーバーデータのロードが完了するまでローディング画面を表示
  if (!isInitialized || isAuthChecking) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  return (
      <MapProvider>
        <BrowserRouter>
          <DeepLinkChecker />
          
          {/* モバイルデバッグ用のメッセージを追加 */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="fixed top-0 left-0 z-50 bg-black/50 p-1 text-xs text-white">
              {`Mobile: ${window.innerWidth}x${window.innerHeight}`}
            </div>
          )}
          {!user ? (
            // 未ログイン状態
            <>
              <Routes>
                <Route path="*" element={<Login />} />
              </Routes>
              <Toaster />
            </>
          ) : (
            // ログイン済み状態（プロフィール設定チェックを含む）
            <SidebarProvider>
              <div
                className="flex w-full items-center justify-center overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <Routes>
                  {needsProfileSetup ? (
                    <>
                      <Route path="/profile" element={<NewUserProfile />} />
                      <Route
                        path="*"
                        element={<Navigate to="/profile" replace />}
                      />
                    </>
                  ) : (
                    <>
                      <Route
                        path="/"
                        element={
                          <div className="flex h-screen w-full overflow-hidden">
                            <AppSidebar
                              isMobileMenuOpen={isMobileMenuOpen}
                              setIsMobileMenuOpen={setIsMobileMenuOpen}
                            />
                            <div className="min-w-0 flex-1">
                              <Chat
                                isMemberSidebarOpen={isMemberSidebarOpen}
                                setIsMemberSidebarOpen={setIsMemberSidebarOpen}
                                isMobileMenuOpen={isMobileMenuOpen}
                                setIsMobileMenuOpen={setIsMobileMenuOpen}
                                isMapMode={isMapMode}
                                setIsMapMode={setIsMapMode}
                                setIsImageDialogOpen={setIsImageDialogOpen}
                              />
                            </div>
                          </div>
                        }
                      />
                      <Route path="/invite" element={<InvitePage />} />
                      <Route
                        path="/invite/:inviteCode"
                        element={<InviteRedirect />}
                      />
                      <Route path="/profile" element={<NewUserProfile />} />

                      {/* URLエンコードされていない複雑なパスに対応するためのキャッチオールルート */}
                      <Route path="/invite/*" element={<InvalidInvitePath />} />
                    </>
                  )}
                </Routes>
                <Toaster />
              </div>
            </SidebarProvider>
          )}
        </BrowserRouter>
      </MapProvider>
  )
}

export default App
