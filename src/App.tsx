// App.tsx
import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import Login from './components/login/Login'
import { auth } from './firebase'
import { login, logout } from './features/userSlice'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
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
// import './styles/map.css' // 削除
// import '@/components/ui/tabs.css' // 削除

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

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    )
  }

  // プロフィール設定が必要な場合
  if (needsProfileSetup) {
    return (
      <BrowserRouter>
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
      </BrowserRouter>
    )
  }

  return (
    <SidebarProvider>
      <div
        className="flex w-full items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <BrowserRouter>
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
          </Routes>
          <Toaster />
        </BrowserRouter>
      </div>
    </SidebarProvider>
  )
}

export default App
