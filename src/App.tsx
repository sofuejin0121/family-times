// App.tsx
import { useEffect } from "react";
import "./App.scss";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import Login from "./components/login/Login";
import { auth } from "./firebase";
import { login, logout } from "./features/userSlice";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { InvitePage } from "./pages/InvitePage";

function App() {
  const user = useAppSelector((state) => state.user.user);
  const dispatch = useAppDispatch();

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
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<InvitePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
