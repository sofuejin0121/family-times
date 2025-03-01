// App.tsx
import { useEffect, useState } from "react";
import "./App.scss";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import Login from "./components/login/Login";
import { auth } from "./firebase";
import { login, logout } from "./features/userSlice";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { InvitePage } from "./pages/InvitePage";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import Chat from "./components/chat/Chat";
import { SidebarProvider } from "@/components/ui/sidebar";
import { startAuthCheck } from "./features/userSlice";
import LoadingScreen from "./components/loading/LoadingScreen";
function App() {
  const dispatch = useAppDispatch();
  const isAuthChecking = useAppSelector((state) => state.user.isAuthChecking);
  const user = useAppSelector((state) => state.user.user);
  // モバイルでは初期状態で非表示に設定
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false);
  // タップ時の誤動作を防ぐためのスワイプ時の処理を実行しない最小距離
  const minimumDistance = 30;
  // スワイプ状態を管理
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });
  //タッチ開始時の処理
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };
  //タッチ移動時の処理
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEnd({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };
  //タッチ終了時の処理
  const handleTouchEnd = () => {
    // タッチ開始時とタッチ終了時の座標の差を計算
    const distanceX = Math.abs(touchEnd.x - touchStart.x);
    const distanceY = Math.abs(touchEnd.y - touchStart.y);

    // 左右のスワイプ距離の方が上下より長い && 小さなスワイプは検知しないようにする
    if (distanceX > distanceY && distanceX > minimumDistance) {
      // 右スワイプ
      if (touchEnd.x > touchStart.x) {
        // メンバーリストが表示されている場合は閉じる
        if (isMemberSidebarOpen) {
          setIsMemberSidebarOpen(false);
        } else {
          // メンバーリストが表示されていない場合のみサイドバーを表示
          setIsMobileMenuOpen(true);
        }
      } else {
        // 左スワイプ
        if (isMobileMenuOpen) {
          // サーバーサイドバーが表示されている場合は閉じる
          setIsMobileMenuOpen(false);
        } else if (isMemberSidebarOpen) {
          // メンバーリストが表示されている場合は閉じる
          setIsMemberSidebarOpen(false);
        }
      }
    }
  };

  useEffect(() => {
    // 認証状態確認開始
    dispatch(startAuthCheck());

    const unsubscribe = auth.onAuthStateChanged((loginUser) => {
      if (loginUser) {
        dispatch(
          login({
            uid: loginUser.uid,
            photo: loginUser.photoURL,
            email: loginUser.email,
            displayName: loginUser.displayName,
          })
        );
      } else {
        dispatch(logout());
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  // 認証状態確認中はローディング表示
  if (isAuthChecking) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  return (
    <SidebarProvider>
      <div
        className="app"
        style={{
          display: "flex",
          overflow: "hidden",
        }}
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
                  className="flex w-full h-screen overflow-hidden"
                  style={{ width: "100%" }}
                >
                  <AppSidebar
                    isMobileMenuOpen={isMobileMenuOpen}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                  />
                  <div className="flex-1 min-w-0">
                    <Chat
                      isMemberSidebarOpen={isMemberSidebarOpen}
                      setIsMemberSidebarOpen={setIsMemberSidebarOpen}
                      isMobileMenuOpen={isMobileMenuOpen}
                      setIsMobileMenuOpen={setIsMobileMenuOpen}
                    />
                  </div>
                </div>
              }
            />
            <Route path="/invite" element={<InvitePage />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </div>
    </SidebarProvider>
  );
}

export default App;
