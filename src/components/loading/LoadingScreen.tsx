import { useEffect } from "react";
import { useAppDispatch } from "../../app/hooks";
import { finishAuthCheck } from "../../features/userSlice";

const LoadingScreen = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(finishAuthCheck());
    }, 3000);

    // クリーンアップ関数でtimerをクリア
    return () => clearTimeout(timer);
  }, [dispatch]); 

  // ローディング表示のJSXを返す
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
};

export default LoadingScreen;
