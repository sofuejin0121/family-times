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
import { useSwipeable } from "react-swipeable";

function App() {
  const user = useAppSelector((state) => state.user.user);
  const dispatch = useAppDispatch();
  // モバイルでは初期状態で非表示に設定
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMemberSidebarOpen, setIsMemberSidebarOpen] = useState(false);

  // スワイプハンドラーの設定
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => {
      // メンバーリストが表示されている場合は、まずそれを閉じる
      if (isMemberSidebarOpen) {
        setIsMemberSidebarOpen(false);
        return;
      }
      // メンバーリストが表示されていない場合は、サーバー/チャンネルサイドバーを表示
      setIsMobileMenuOpen(true);
    },
    onSwipedLeft: () => {
      // サーバーサイドバーが表示されている場合は閉じる
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return;
      }
      
      // メンバーリストが表示されている場合は閉じる
      if (isMemberSidebarOpen) {
        setIsMemberSidebarOpen(false);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 50, // スワイプと認識される最小距離
  });

  useEffect(() => {
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
      <div className="app" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }} {...swipeHandlers}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <div 
                className="flex w-full h-screen overflow-hidden" 
                style={{ width: '100%' }}
                
              >
                <AppSidebar 
                  isMobileMenuOpen={isMobileMenuOpen} 
                  setIsMobileMenuOpen={setIsMobileMenuOpen} 
                />
                <div className="flex-1 min-w-0">
                  <Chat 
                    isMemberSidebarOpen={isMemberSidebarOpen}
                    setIsMemberSidebarOpen={setIsMemberSidebarOpen}
                  />
                </div>
              </div>
            } />
            <Route path="/invite" element={<InvitePage />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </div>
    </SidebarProvider>
  );
}

export default App;
