import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import SidebarChannel from "./SidebarChannel";
import { db } from "../../firebase";
import { useAppSelector } from "../../app/hooks";
import { addDoc, collection } from "firebase/firestore";
import Server from "./Server";
import useServer from "../../hooks/useServer";
import { useCallback, useState } from "react";
import useChannel from "../../hooks/useChannel";
import { CreateInvite } from "../createInvite/CreateInvite";
import { CreateServer } from "./CreateServer";
import UserEdit from "./UserEdit";
import { LogOut } from "lucide-react";
import { auth } from "../../firebase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarImage } from "../ui/avatar";
const Sidebar = () => {
  // const serverName = useAppSelector((state) => state.server.serverName)
  const user = useAppSelector((state) => state.user.user);
  const serverId = useAppSelector((state) => state.server.serverId);
  const { documents: channels } = useChannel();
  const { documents: servers } = useServer();
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);

  const addChannel = useCallback(async () => {
    const channelName: string | null = prompt("新しいチャンネル作成");

    if (channelName && serverId !== null) {
      await addDoc(collection(db, "servers", serverId, "channels"), {
        channelName: channelName,
        timestamp: new Date(),
      });
    }
  }, [serverId]);
  //ログアウト処理

  return (
    <div className="flex flex-[0.3] h-screen bg-white">
      {/* sidebarLeft */}
      <div className="flex flex-col items-center space-y-2 p-3 w-[72px] bg-gray-100">
        {servers.map((server) => (
          <Server
            key={server.id}
            id={server.id}
            name={server.docData.name}
            imageUrl={server.docData.imageUrl}
          />
        ))}
        <div
          className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 cursor-pointer hover:bg-gray-300 transition-all"
          onClick={() => setIsCreateServerOpen(true)}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AddIcon />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>サーバーを作成</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {/* sidebarRight */}
      <div className="bg-white w-[300px] relative flex-grow border-r border-gray-200">
        <div className="text-black flex items-center justify-between p-5 border-b border-gray-200">
          <h3>Family-Times</h3>
          <ExpandMoreIcon />
          {serverId && <CreateInvite />}
        </div>

        {/* sidebarChannel */}
        <div className="p-[13px]">
          <div className="text-black flex justify-between items-center mt-[5px]">
            <div className="flex text-[0.9rem]">
              <ExpandMoreIcon />
              <h3>テキストチャンネル</h3>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AddIcon
                    className="cursor-pointer"
                    onClick={() => addChannel()}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>チャンネルを作成</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CreateServer
            isOpen={isCreateServerOpen}
            onClose={() => setIsCreateServerOpen(false)}
          />
          <div className="sidebarChannelList">
            {channels.map((channel) => (
              <SidebarChannel
                channel={channel}
                id={channel.id}
                key={channel.id}
              />
            ))}
          </div>
          <div className="absolute bottom-0 flex items-center justify-between w-[93%] pb-[10px] border-t border-gray-300 pt-[10px] -ml-[3px] bg-white">
            <div className="flex items-center">
              <Avatar className="w-11 h-11">
                <AvatarImage
                  src={user?.photo}
                  className="object-cover cursor-pointer"
                  onClick={() => setIsUserEditOpen(true)}
                />
              </Avatar>
              <div className="flex items-center justify-between w-full">
                <div className="ml-[5px] space-y-1">
                  <h4 className="text-black font-medium">
                    {user?.displayName}
                  </h4>
                  <span className="text-gray-500">
                    #{user?.uid.substring(0, 4)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LogOut
                      className="text-black cursor-pointer"
                      onClick={() => auth.signOut()}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>ログアウト</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <UserEdit
            isOpen={isUserEditOpen}
            onClose={() => setIsUserEditOpen(false)}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
