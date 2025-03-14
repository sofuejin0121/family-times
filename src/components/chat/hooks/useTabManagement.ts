// タブ管理関連のロジックを抽出したカスタムフック
import { useState, useCallback } from 'react'

interface UseTabManagementProps {
  setIsMapMode: (isMapMode: boolean) => void
  scrollToBottom: () => void
}

export const useTabManagement = ({
  setIsMapMode,
  scrollToBottom,
}: UseTabManagementProps) => {
  // タブのステート管理
  const [activeTab, setActiveTab] = useState<string>('chat')

  // タブが変更されたときの処理
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value)
      // マップモード状態を更新
      setIsMapMode(value === 'map')
    },
    [setIsMapMode]
  )

  // MapPinアイコンクリック時の処理を修正
  const handleMapClick = useCallback(() => {
    const newTabValue = activeTab === 'map' ? 'chat' : 'map'
    setActiveTab(newTabValue)
    // マップモード状態を更新
    setIsMapMode(newTabValue === 'map')
  }, [activeTab, setIsMapMode])

  // MessageCircleMoreアイコンクリック時の処理
  const handleChatClick = useCallback(() => {
    setActiveTab('chat')
    // マップモード状態を更新
    setIsMapMode(false)

    // タブ切り変え後、少し遅延させてスクロールを最下部に移動
    setTimeout(() => {
      scrollToBottom()
    }, 100)
  }, [setIsMapMode, scrollToBottom])

  return {
    activeTab,
    handleTabChange,
    handleMapClick,
    handleChatClick,
  }
}
