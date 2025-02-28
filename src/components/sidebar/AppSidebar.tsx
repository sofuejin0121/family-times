import { useAppSelector } from "../../app/hooks";
import { auth } from "../../firebase";
import { useState } from "react";
import useChannel from "../../hooks/useChannel";
import useServer from "../../hooks/useServer";
import { LogOut } from "lucide-react";
import { Avatar, AvatarImage } from "../ui/avatar";
import Server from "./Server";
import SidebarChannel from "./SidebarChannel";
import { CreateInvite } from "../createInvite/CreateInvite";
import { CreateServer } from "./CreateServer";
import UserEdit from "./UserEdit";
import AddIcon from "@mui/icons-material/Add";
import {CreateChannel} from "../chat/CreateChannel"
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
} from "@/components/ui/sidebar";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "../ui/button";

interface AppSidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

export function AppSidebar({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: AppSidebarProps) {
  const user = useAppSelector((state) => state.user.user);
  const serverId = useAppSelector((state) => state.server.serverId);
  const { documents: channels } = useChannel();
  const { documents: servers } = useServer();
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);

  // サーバーが選択されているかチェック
  const isServerSelected = Boolean(serverId);

  return (
    <>
      {/* モバイルメニューオーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden mobile-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバーコンテナ - モバイルでは一体化して表示 */}
      <div
        className={`flex md:relative fixed top-0 bottom-0 left-0 z-50 transition-transform duration-300 ease-in-out
                    ${
                      isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                    } md:translate-x-0`}
      >
        {/* サーバーリスト（左側） */}
        <Sidebar
          collapsible="none"
          className="w-[72px] min-w-[72px] bg-gray-100 border-r border-gray-200 flex-shrink-0 h-screen"
        >
          <SidebarContent className="p-3 max-h-screen overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300">
            <SidebarMenu className="space-y-3">
              {servers.map((server) => (
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
                        className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 cursor-pointer hover:bg-gray-300 transition-all"
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
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* チャンネルリスト（右側） */}
        <Sidebar
          collapsible="none"
          className="w-[240px] min-w-[240px] bg-white border-r border-gray-200 flex-shrink-0 h-screen"
        >
          <SidebarHeader className="p-6.5 border-b border-gray-200">
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
                  <div className="flex justify-between items-center p-2">
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

          <SidebarFooter className="p-2 border-t border-gray-200">
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
                    #{user?.uid?.substring(0, 4) || "0000"}
                  </p>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LogOut
                      className="h-5 w-5 text-gray-500 cursor-pointer hover:text-gray-700"
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
    </>
  );
}
