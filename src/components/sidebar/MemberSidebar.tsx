import useUsers from "../../hooks/useUsers";
import useServer from "../../hooks/useServer";
import { useAppSelector } from "../../app/hooks";
import { Avatar, AvatarImage } from "../ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

const MemberSidebar = () => {
  const { documents: users } = useUsers();
  const serverId = useAppSelector((state) => state.server.serverId);
  const { documents: servers } = useServer();
  // 現在選択しているサーバーのドキュメントを取得する
  const server = servers.find((server) => server.id === serverId);
  // 取得した単一のserver docからObject.keysを使って、membersオブジェクトのkeyの配列を取得する（これがuniqueIds）
  const uniqueIds = Object.keys(server?.server.members || {});


  return (
    
    <Sidebar
      collapsible="none"
      className="w-full h-screen flex flex-col border-l border-gray-200"
      side="right"
    >
      <SidebarHeader className="pl-[15px] border-b border-gray-200 min-h-[77px] flex items-center justify-center">
        <h3 className="text-black font-semibold">メンバーリスト</h3>
      </SidebarHeader>

      <SidebarContent className="flex-grow overflow-y-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 scrollbar-thumb-rounded hover:scrollbar-thumb-gray-400">
        {users
          .filter((user) => uniqueIds.includes(user.uid))
          .map((user) => (
            <div className="flex items-center p-[10px_15px]" key={user.uid}>
              <Avatar className="w-11 h-11">
                <AvatarImage src={user.photoURL} className="object-cover" />
              </Avatar>
              <div className="flex items-center gap-[5px]">
                <h4 className="text-black p-2">{user.displayName}</h4>
              </div>
            </div>
          ))}
      </SidebarContent>
    </Sidebar>
  );
};

export default MemberSidebar;
