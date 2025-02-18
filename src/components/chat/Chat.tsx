import "./Chat.scss";
import ChatHeader from "./ChatHeader";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import GifIcon from "@mui/icons-material/Gif";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import ChatMessage from "./ChatMessage";
import { useAppSelector } from "../../app/hooks";
import { useState } from "react";
import {
  addDoc,
  collection,
  CollectionReference,
  DocumentData,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import useMessage from "../../hooks/useMessage";
import MemberSidebar from "../sidebar/MemberSidebar";

const Chat = () => {
  const [inputText, setInputText] = useState<string>("");
  const channelId = useAppSelector((state) => state.channel.channelId);
  const channelName = useAppSelector((state) => state.channel.channelName);
  const user = useAppSelector((state) => state.user.user);
  const { subDocuments: messages } = useMessage();
  const serverId = useAppSelector((state) => state.server.serverId);
  const sendMessage = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault();

    if (serverId !== null) {
      //channelsコレクションの中にあるmessagesコレクションの中にメッセージ情報を入れる
      const collectionRef: CollectionReference<DocumentData> = collection(
        db,
        "servers",
        serverId,
        "channels",
        String(channelId),
        "messages"
      );
      await addDoc(collectionRef, {
        message: inputText,
        timestamp: serverTimestamp(),
        user: user,
      });
      setInputText("");
    }
  };

  return (
    <div className="content">
      <div className="chat">
        {/* chatHeader */}
        <ChatHeader channelName={channelName} />
        {/* chatMessage */}
        <div className="chatMessage">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message.message}
              timestamp={message.timestamp}
              user={message.user}
            />
          ))}
        </div>
        {/* chatInput */}
        <div className="chatInput">
          <AddCircleOutlineIcon />
          <form>
            <input
              type="text"
              placeholder={
                channelName
                  ? `${channelName}へメッセージを送信`
                  : "メッセージを送信"
              }
              onChange={(e) => setInputText(e.target.value)}
              value={inputText}
            />
            <button
              type="submit"
              className="chatInputButton"
              onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) =>
                sendMessage(e)
              }
            ></button>
          </form>

          <div className="chatInputIcons">
            <CardGiftcardIcon />
            <GifIcon />
            <SentimentSatisfiedAltIcon />
          </div>
        </div>
      </div>
      <div className="memberList">
        <MemberSidebar/>
      </div>
    </div>
  );
};

export default Chat;
