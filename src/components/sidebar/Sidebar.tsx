import "./Sidebar.scss";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import SidebarChannel from "./SidebarChannel";
import MicIcon from "@mui/icons-material/Mic";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import SettingsIcon from "@mui/icons-material/Settings";
import { auth, db } from "../../firebase";
import { useAppSelector } from "../../app/hooks";
import { addDoc, collection } from "firebase/firestore";
import Server from "./Server";
import useServer from "../../hooks/useServer";
import { useCallback } from "react";
import useChannel from "../../hooks/useChannel";
import { CreateInvite } from "../createInvite/CreateInvite";
const Sidebar = () => {
  // const serverName = useAppSelector((state) => state.server.serverName)
  const user = useAppSelector((state) => state.user.user);
  const serverId = useAppSelector((state) => state.server.serverId);
  const { documents: channels } = useChannel();
  const { documents: servers } = useServer();

  const addServer = useCallback(async () => {
    const serverName: string | null = prompt("新しいサーバー作成");

    if (serverName && user) {
      await addDoc(collection(db, "servers"), {
        serverName: serverName,
        createdBy: user.uid,
        members: {
          [user.uid]: {
            role: "admin",
            joinedAt: new Date(),
          }
        }
      });
    }
  }, [user]);

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
      <div className="sidebarLeft">
        {servers.map((server) => (
          <Server key={server.id} id={server.id} name={server.docData.serverName} />
        ))}
        <div className="serverAddIcon" onClick={() => addServer()}>
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
              <img src={user?.photo} alt="" onClick={() => auth.signOut()} />
              <div className="accoutName">
                <h4>{user?.displayName}</h4>
                <span>#{user?.uid.substring(0, 4)}</span>
              </div>
            </div>
            <div className="sidebarVoice">
              <MicIcon />
              <HeadphonesIcon />
              <SettingsIcon />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
