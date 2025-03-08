import { useAppSelector } from '../../app/hooks'
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
import { useAppDispatch } from '../../app/hooks'
import { setServerInfo } from '../../features/serverSlice'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { toast } from 'sonner'
import NoServerView from './NoServerView'
import LoadingScreen from '../loading/LoadingScreen'

interface AppSidebarProps {
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (isOpen: boolean) => void
}

export function AppSidebar({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: AppSidebarProps) {
  const user = useAppSelector((state) => state.user.user)
  const serverId = useAppSelector((state) => state.server.serverId)
  const { documents: channels } = useChannel()
  const { documents: servers, loading: serversLoading } = useServer()
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false)
  const [isUserEditOpen, setIsUserEditOpen] = useState(false)
  const [isJoinServerOpen, setIsJoinServerOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  // サーバーが選択されているかチェック
  const isServerSelected = Boolean(serverId)

  // サーバー一覧が取得されたら、最初のサーバーを自動選択
  useLayoutEffect(() => {
    if (!serversLoading && servers.length > 0 && !serverId) {
      const firstServer = servers[0]
      dispatch(
        setServerInfo({
          serverId: firstServer.id,
          serverName: firstServer.docData.name
        })
      )
    }
  }, [servers, serverId, dispatch, serversLoading])

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
              {!serversLoading && servers.map((server) => (
                <SidebarMenuItem
                  key={server.id}
                  className="flex justify-center"
                >
                  <Server
                    id={server.id}
                    name={server.docData.name}
                    imageUrl={server.docData.imageUrl}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LogOut
                      className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700"
                      onClick={() => auth.signOut()}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="tooltip-arrow">
                    <p>ログアウト</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
      
      {/* 招待コード入力ダイアログ */}
      <Dialog open={isJoinServerOpen} onOpenChange={setIsJoinServerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>サーバーに参加</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col space-y-4 py-4">
            <p className="text-sm text-gray-500">
              サーバーの招待コードを入力してください
            </p>
            <div className="flex items-center space-x-2">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="招待コード"
                className="flex-1"
              />
              <Button onClick={handleJoinServer}>参加</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
