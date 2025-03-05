import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import Login from './components/login/Login'
import { auth } from './firebase'
import { login, logout } from './features/userSlice'
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
import { startAuthCheck } from './features/userSlice'
import LoadingScreen from './components/loading/LoadingScreen'
import NewUserProfile from './pages/NewUserProfile'
import { toast } from 'sonner'
import { InviteRedirect } from './pages/InviteRedirect'
import { Button } from '@/components/ui/button'

// エラーハンドリング用コンポーネント
const InvalidInvitePath = () => {
  const navigate = useNavigate() // ここではRouterの中なので使用可能

  return (
    <div className="flex h-svh w-full items-center justify-center">
      <div className="p-4 text-center">
        <p className="mb-4 text-xl">無効なURLフォーマットです</p>
        <p className="mb-4 text-sm text-gray-500">
          正しい招待リンクを使用してください
        </p>
        <Button onClick={() => navigate('/', { replace: true })}>
          ホームに戻る
        </Button>
      </div>
    </div>
  )
}

// デープリンクをチェックするコンポーネント
const DeepLinkChecker = () => {
  const navigate = useNavigate() // ここではRouterの中なので使用可能

  useEffect(() => {
    const path = window.location.pathname
    const fullUrl = window.location.href

    // 問題のある形式のURLパターンをチェック
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
  const dispatch = useAppDispatch()
  const isAuthChecking = useAppSelector((state) => state.user.isAuthChecking)
  const user = useAppSelector((state) => state.user.user)
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
    setIsSwiping(false)
  }

  // 追加：ログイン直後のフラグを管理
  const [isJustLoggedIn, setIsJustLoggedIn] = useState(false)

  // プロフィール設定が必要かどうかを判定（条件を少し調整）
  const needsProfileSetup =
    user &&
    !isJustLoggedIn && // ログイン直後は判定しない
    (!user.displayName || user.displayName === user.email?.split('@')[0]) &&
    !user.photo &&
    user.email &&
    !user.email.includes('gmail.com') // Googleログイン以外の場合

  // App.tsxに新しい状態を追加
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)

  useEffect(() => {
    // 認証状態確認開始
    dispatch(startAuthCheck())

    const unsubscribe = auth.onAuthStateChanged((loginUser) => {
      if (loginUser) {
        // ユーザーがメール認証済みかチェック
        if (
          !loginUser.emailVerified &&
          loginUser.providerData[0]?.providerId === 'password'
        ) {
          // メール認証が完了していない場合は、ログイン状態にしない
          toast.error(
            'メールアドレスの認証が完了していません。受信したメールのリンクをクリックしてください。'
          )
          auth.signOut()
          return
        }

        // ユーザーの表示名が設定されていない場合の対応
        const displayName =
          loginUser.displayName ||
          (loginUser.email ? loginUser.email.split('@')[0] : '名称未設定')

        dispatch(
          login({
            uid: loginUser.uid,
            photo: loginUser.photoURL,
            email: loginUser.email,
            displayName: displayName,
          })
        )

        // ログイン状態変更を検知したら一時的にフラグを立てる
        setIsJustLoggedIn(true)
        // 少し遅延させてからフラグを戻す（画面ちらつき防止）
        setTimeout(() => setIsJustLoggedIn(false), 1000)
      } else {
        dispatch(logout())
      }
    })

    return () => unsubscribe()
  }, [dispatch])

  // 認証状態確認中はローディング表示
  if (isAuthChecking) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  // 単一のBrowserRouterを使用する
  return (
    <BrowserRouter>
      {/* DeepLinkCheckerはすべての状態で利用可能にする */}
      <DeepLinkChecker />

      {!user ? (
        // 未ログイン状態
        <>
          <Routes>
            <Route path="*" element={<Login />} />
          </Routes>
          <Toaster />
        </>
      ) : needsProfileSetup ? (
        // プロフィール設定が必要な状態
        <>
          <Routes>
            {/* 招待コードページへのアクセスの場合はクエリパラメータも含めてリダイレクト */}
            <Route
              path="/invite"
              element={
                <Navigate
                  to={`/profile?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  replace
                />
              }
            />
            {/* プロフィール設定ページそのもの */}
            <Route path="/profile" element={<NewUserProfile />} />
            {/* その他のパスはデフォルトでプロフィール設定に */}
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Routes>
          <Toaster />
        </>
      ) : (
        // 通常のログイン済み状態
        <SidebarProvider>
          <div
            className="flex w-full items-center justify-center overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Routes>
              <Route
                path="/"
                element={
                  <div
                    className="flex h-screen w-full overflow-hidden"
                    style={{ width: '100%' }}
                  >
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
              <Route path="/invite/:inviteCode" element={<InviteRedirect />} />
              <Route path="/profile" element={<NewUserProfile />} />

              {/* URLエンコードされていない複雑なパスに対応するためのキャッチオールルート */}
              <Route path="/invite/*" element={<InvalidInvitePath />} />
            </Routes>
            <Toaster />
          </div>
        </SidebarProvider>
      )}
    </BrowserRouter>
  )
}

export default App
