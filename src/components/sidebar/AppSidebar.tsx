import { auth } from '../../firebase'
import { useState, useLayoutEffect } from 'react'
import useChannel from '../../hooks/useChannel'
import useServer from '../../hooks/useServer'
import { LogOut, LogIn } from 'lucide-react'
import { Avatar, AvatarImage } from '../ui/avatar'
import Server from './Server'
import SidebarChannel from './SidebarChannel'
import { CreateInvite } from '../createInvite/CreateInvite'
import { CreateServer } from './CreateServer'
import UserEdit from './UserEdit'
import AddIcon from '@mui/icons-material/Add'
import { CreateChannel } from '../chat/CreateChannel'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { Button } from '../ui/button'
import { useNavigate } from 'react-router-dom'
import { useServerStore } from '../../stores/serverSlice'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { toast } from 'sonner'
import NoServerView from './NoServerView'
import LoadingScreen from '../loading/LoadingScreen'
import { NotificationSettings } from './NotificationSettings'
import { Bell } from 'lucide-react'
import { useUserStore } from '@/stores/userSlice'

interface AppSidebarProps {
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (isOpen: boolean) => void
}

export function AppSidebar({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: AppSidebarProps) {
  const user = useUserStore((state) => state.user)
  const serverId = useServerStore((state) => state.serverId)
  const { documents: channels } = useChannel()
  const { documents: servers, loading: serversLoading } = useServer()
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false)
  const [isUserEditOpen, setIsUserEditOpen] = useState(false)
  const [isJoinServerOpen, setIsJoinServerOpen] = useState(false)
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] =
    useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const navigate = useNavigate()

  // サーバーが選択されているかチェック
  const isServerSelected = Boolean(serverId)

  // サーバー一覧が取得されたら、最初のサーバーを自動選択
  useLayoutEffect(() => {
    if (!serversLoading && servers.length > 0 && !serverId) {
      const firstServer = servers[0]
      useServerStore.getState().setServerInfo({
        serverId: firstServer.id,
        serverName: firstServer.server.name,
      })
    }
  }, [servers, serverId, serversLoading])

  // 招待コードを処理する関数
  const handleJoinServer = () => {
    if (!inviteCode.trim()) {
      toast.error('招待コードを入力してください')
      return
    }

    // 簡易的なバリデーション - 最低5文字以上
    if (inviteCode.trim().length < 5) {
      toast.error('有効な招待コードを入力してください')
      return
    }

    navigate(`/invite/${inviteCode.trim()}`)
    setIsJoinServerOpen(false)
    setInviteCode('')
  }

  // サーバーのロード状態と空の状態を管理
  if (serversLoading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  // サーバーが存在しない場合のみNoServerViewを表示
  if (servers.length === 0) {
    return <NoServerView onCreateServer={() => setIsCreateServerOpen(true)} />
  }

  return (
    <>
      {/* モバイルメニューオーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="mobile-overlay md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバーコンテナ - モバイルでは一体化して表示 */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 flex transition-transform duration-300 ease-in-out md:relative ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* サーバーリスト（左側） */}
        <Sidebar
          collapsible="none"
          className="h-screen w-[72px] min-w-[72px] flex-shrink-0 border-r border-gray-200 bg-gray-100"
        >
          <SidebarContent className="scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 max-h-screen overflow-y-auto p-3">
            <SidebarMenu className="space-y-3">
              {!serversLoading &&
                servers.map((server) => (
                  <SidebarMenuItem
                    key={server.id}
                    className="flex justify-center"
                  >
                    <Server
                      id={server.id}
                      name={server.server.name}
                      photoId={server.server.photoId}
                      photoExtension={server.server.photoExtension}
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                  </SidebarMenuItem>
                ))}
              <SidebarMenuItem className="flex justify-center pt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCreateServerOpen(true)}
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gray-200 text-gray-700 transition-all hover:bg-gray-300"
                      >
                        <AddIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>サーバーを作成</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>

              {/* サーバー参加ボタン - 常に表示 */}
              <SidebarMenuItem className="flex justify-center pt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsJoinServerOpen(true)}
                        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-blue-200 text-blue-700 transition-all hover:bg-blue-300"
                      >
                        <LogIn className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>サーバーに参加</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* チャンネルリスト（右側） */}
        <Sidebar
          collapsible="none"
          className="h-screen w-[240px] min-w-[240px] flex-shrink-0 border-r border-gray-200 bg-white"
        >
          <SidebarHeader className="border-b border-gray-200 p-6.5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Family-Times</h3>
              <div className="flex items-center gap-2">
                {serverId && <CreateInvite />}
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {isServerSelected ? (
              <>
                <SidebarGroup>
                  <div className="flex items-center justify-between p-2">
                    <SidebarGroupLabel className="flex items-center gap-1">
                      <span>テキストチャンネル</span>
                    </SidebarGroupLabel>
                    {isServerSelected && <CreateChannel />}
                  </div>

                  <SidebarGroupContent>
                    <SidebarMenu>
                      {channels.map((channel) => (
                        <SidebarMenuItem key={channel.id}>
                          <SidebarChannel
                            channel={channel}
                            id={channel.id}
                            onClick={() => setIsMobileMenuOpen(false)}
                          />
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : (
              <></>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar
                  className="h-11 w-11 cursor-pointer rounded-full object-cover"
                  onClick={() => setIsUserEditOpen(true)}
                >
                  <AvatarImage src={user?.photo} className="object-cover" />
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user?.displayName}</p>
                  <p className="text-xs text-gray-500">
                    #{user?.uid?.substring(0, 4) || '0000'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => setIsNotificationSettingsOpen(true)}
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>通知設定</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => auth.signOut()}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>ログアウト</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>

      <CreateServer
        isOpen={isCreateServerOpen}
        onClose={() => setIsCreateServerOpen(false)}
      />

      <UserEdit
        isOpen={isUserEditOpen}
        onClose={() => setIsUserEditOpen(false)}
      />

      {/* 通知設定ダイアログ */}
      <Dialog
        open={isNotificationSettingsOpen}
        onOpenChange={setIsNotificationSettingsOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>通知設定</DialogTitle>
          </DialogHeader>
          <NotificationSettings />
        </DialogContent>
      </Dialog>

      {/* 招待コード入力ダイアログ */}
      <Dialog open={isJoinServerOpen} onOpenChange={setIsJoinServerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>サーバーに参加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 pb-4">
            <div className="space-y-2">
              <Input
                placeholder="招待コードを入力"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" onClick={handleJoinServer}>
              参加する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
