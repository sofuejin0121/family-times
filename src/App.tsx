import { useEffect } from "react";
import "./App.scss";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import Chat from "./components/chat/Chat";
import Login from "./components/login/Login";
import Sidebar from "./components/sidebar/Sidebar";
import { auth } from "./firebase";
import { login, logout } from "./features/userSlice";
function App() {
  //ユーザの状態を取得する
  const user = useAppSelector((state) => state.user.user);


  //型をしっかりチェックするuseAppDispatchを使う
  const dispatch = useAppDispatch();

  useEffect(() => {
    auth.onAuthStateChanged((loginUser) => {
      if (loginUser) {
        //reducerにdispatchで通知を送る→stateが更新される
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
  }, [dispatch]);
  return (
    <div className="App">
      {/* ユーザー情報がなければログイン画面へ */}
      {user ? (
        <>
          <Sidebar />
          <Chat />
          {/* <MemberSidebar /> */}
        </>
      ) : (
        <>
          <Login />
        </>
      )}
    </div>
  );
}

export default App;
