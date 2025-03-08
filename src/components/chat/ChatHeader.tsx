import { Input } from '../ui/input'
// import { Button } from '../ui/button'
// import { Menu } from 'lucide-react'
import { Users, MapPin, MessageCircleMore, Bell } from 'lucide-react'
import { useAppSelector } from '../../app/hooks'
import React, { useState } from 'react'
import { requestNotificationPermission } from '../../firebase'
import { Button } from '../ui/button'

interface Props {
  channelName: string | null
  onSearchMessage: React.Dispatch<React.SetStateAction<string>>
  onToggleMemberSidebar: () => void
  onToggleMobileMenu: () => void
  onMapClick: () => void
  onChatClick: () => void
  activeTab: string
}

const ChatHeader = (props: Props) => {
  const {
    channelName,
    onSearchMessage,
    onToggleMemberSidebar,
    // onToggleMobileMenu,
    onMapClick,
    onChatClick,
    activeTab,
  } = props
  const serverId = useAppSelector((state) => state.server.serverId)
  const isServerSelected = Boolean(serverId)
  const [notificationEnabled, setNotificationEnabled] = useState(
    Notification.permission === 'granted'
  )

  const handleMemberSidebarToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onToggleMemberSidebar()
  }

  const handleNotificationRequest = async () => {
    const granted = await requestNotificationPermission()
    setNotificationEnabled(granted)
  }

  return (
    <div className="flex min-h-[77px] w-full items-center justify-between border-b border-gray-200 bg-white">
      {/* 左側のメニューボタン（モバイル用）
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-gray-600"
        onClick={onToggleMobileMenu}
      >
        <Menu className="h-5 w-5" />
      </Button> */}

      {/* チャンネル名 */}
      <div>
        {isServerSelected ? (
          <h3 className="ml-2 font-medium text-gray-800">
            <span className="pr-[7px] text-gray-500">#</span>
            {channelName}
          </h3>
        ) : (
          <></>
        )}
      </div>

      {/* 右側のアイコン群 */}
      {isServerSelected ? (
        <div className="flex items-center gap-[13px] pr-[15px] text-gray-600">
          {/* チャットボタン */}
          <Button
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              activeTab === 'chat'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={onChatClick}
            title="チャットを表示"
          >
            <MessageCircleMore className="h-5 w-5" />
          </Button>

          {/* マップボタン */}
          <Button
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              activeTab === 'map'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={onMapClick}
            title="地図を表示"
          >
            <MapPin className="h-5 w-5" />
          </Button>

          {/* 通知許可ボタン */}
          {!notificationEnabled && (
            <Button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              onClick={handleNotificationRequest}
              title="通知を有効にする"
            >
              <Bell className="h-5 w-5" />
            </Button>
          )}

          {/* 検索入力欄 */}
          <div className="flex items-center rounded bg-gray-100 p-[3px]">
            <Input
              type="text"
              placeholder="検索"
              onChange={(e) => onSearchMessage(e.target.value)}
              className="w-[120px] border-none bg-transparent text-gray-700 placeholder:text-gray-400 focus-visible:ring-0 md:w-auto"
            />
          </div>

          {/* モバイル用メンバーリストトグルボタン */}
          <div className="md:hidden">
            <Button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent hover:bg-gray-100"
              onClick={handleMemberSidebarToggle}
              style={{
                touchAction: 'manipulation',
                pointerEvents: 'auto',
                zIndex: 10,
              }}
            >
              <Users className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
        </div>
      ) : (
        <></>
      )}
    </div>
  )
}

export default ChatHeader
