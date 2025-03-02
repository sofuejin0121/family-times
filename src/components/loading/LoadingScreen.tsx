import { useEffect } from "react";
import { useAppDispatch } from "../../app/hooks";
import { finishAuthCheck } from "../../features/userSlice";

const LoadingScreen = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(finishAuthCheck());
    }, 1000);

    // クリーンアップ関数でtimerをクリア
    return () => clearTimeout(timer);
  }, [dispatch]); 

  // ローディング表示のJSXを返す
  return (
    <div className="flex flex-col items-center justify-center h-full w-hull lg:w-5/6 ">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500">
      </div>
      <h1 className="mt-5 text-2xl text-center">サーバーを選択または<br/>作成してください</h1>
    </div>
  );
};

export default LoadingScreen;
