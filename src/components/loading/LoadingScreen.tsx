import { useEffect } from 'react'
import { useUserStore } from '../../stores/userSlice'

const LoadingScreen = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      useUserStore.getState().finishAuthCheck()
    }, 1000)

    // クリーンアップ関数でtimerをクリア
    return () => clearTimeout(timer)
  }, [])

  // ローディング表示のJSXを返す
  return (
    <div className="bg-opacity-80 fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
    </div>
  )
}

export default LoadingScreen
