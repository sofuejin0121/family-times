import "./ChatMessage.scss";
import { Avatar } from "@mui/material";
import { deleteDoc, doc, Timestamp } from "firebase/firestore";
import { useAppSelector } from "../../app/hooks";
import { db, storage } from "../../firebase";
import DeleteIcon from "@mui/icons-material/Delete";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useState } from "react";
type Props = {
  timestamp: Timestamp;
  message: string;
  photoId: string;
  photoURL: string;
  id: string;
  user: {
    uid: string;
    photo: string;
    email: string;
    displayName: string;
  };
};
const ChatMessage = (props: Props) => {
  const { message, timestamp, user, photoId, id } = props;
  const [fileURL, setFileURL] = useState<string>()
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);
  useEffect(() => {
    const fetchURL = async() => {
      const photoURL = await getDownloadURL(ref(storage, photoId));
      setFileURL(photoURL)
    }
    fetchURL()
  }, [photoId])
  const deleteMessage = async () => {
    if (serverId !== null && channelId !== null) {
      await deleteDoc(
        doc(
          db,
          "servers",
          serverId,
          "channels",
          String(channelId),
          "messages",
          id
        )
      );
      alert();
    }
  };
  return (
    <div className="message">
      <div className="avatarContainer">
        <Avatar src={user.photo} />
      </div>
      <div className="messaegeInfo">
        <h4>
          {user?.displayName}
          <span className="messageTimestamp">
            {new Date(timestamp?.toDate()).toLocaleString()}
          </span>
        </h4>
        <p>{message}</p>
        <DeleteIcon onClick={deleteMessage} />
        <div className="imageMessage">
          <img src={fileURL} alt="" className="images" />
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
