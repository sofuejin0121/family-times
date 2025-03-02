import { useEffect } from 'react'
import { useAppDispatch } from '../../app/hooks'
import { finishAuthCheck } from '../../features/userSlice'

const LoadingScreen = () => {
  const dispatch = useAppDispatch()
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(finishAuthCheck())
    }, 1000)

    // クリーンアップ関数でtimerをクリア
    return () => clearTimeout(timer)
  }, [dispatch])

  // ローディング表示のJSXを返す
  return (
    <div className="w-hull flex h-full flex-col items-center justify-center lg:w-5/6">
      <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
    </div>
  )
}

export default LoadingScreen
