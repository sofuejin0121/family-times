import "./Sidebar.scss";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import SidebarChannel from "./SidebarChannel";
import MicIcon from "@mui/icons-material/Mic";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import SettingsIcon from "@mui/icons-material/Settings";
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

  return (
    <div className="sidebar">
      {/* sidebarLeft */}
      <div className="sidebarLeft  flex flex-col items-center space-y-2 p-3 w-[72px]">
        {servers.map((server) => (
          <Server
            key={server.id}
            id={server.id}
            name={server.docData.name}
            imageUrl={server.docData.imageUrl}
          />
        ))}
        <div
          className="serverAddIcon"
          onClick={() => setIsCreateServerOpen(true)}
        >
          <AddIcon />
        </div>
      </div>
      {/* sidebarRight */}
      <div className="sidebarRight">
        <div className="sidebarTop">
          <h3>Family-Times</h3>
          <ExpandMoreIcon />
          {serverId && <CreateInvite />}
        </div>

        {/* sidebarChannel */}
        <div className="sidebarChannels">
          <div className="sidebarChannelsHeader">
            <div className="sidebarHeader">
              <ExpandMoreIcon />
              <h3>テキストチャンネル</h3>
            </div>
            <AddIcon className="sidebarAddIcon" onClick={() => addChannel()} />
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
          <div className="sidebarFooter">
            <div className="sidebarAccount">
              <img
                src={user?.photo}
                alt=""
                onClick={() => setIsUserEditOpen(true)}
              />
              <div className="accoutName">
                <h4>{user?.displayName}</h4>
                <span>#{user?.uid.substring(0, 4)}</span>
              </div>
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
