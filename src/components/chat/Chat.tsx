import "./Chat.scss";
import ChatHeader from "./ChatHeader";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import GifIcon from "@mui/icons-material/Gif";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import ChatMessage from "./ChatMessage";
import { useAppSelector } from "../../app/hooks";
import { useCallback, useRef, useState } from "react";
import {
  addDoc,
  collection,
  CollectionReference,
  DocumentData,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import useMessage from "../../hooks/useMessage";
import MemberSidebar from "../sidebar/MemberSidebar";
import { ref, uploadBytes } from "firebase/storage";
import { v4 as uuid4 } from "uuid";
const Chat = () => {
  const [inputText, setInputText] = useState<string>("");
  const [searchMessage, setSearchMessage] = useState<string>("");
  const channelId = useAppSelector((state) => state.channel.channelId);
  const channelName = useAppSelector((state) => state.channel.channelName);
  const user = useAppSelector((state) => state.user.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { subDocuments: messages } = useMessage();
  const serverId = useAppSelector((state) => state.server.serverId);
  const sendMessage = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
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
          photoId: null,
          message: inputText,
          timestamp: serverTimestamp(),
          user: user,
        });
        setInputText("");
      }
    },
    [channelId, inputText, serverId, user]
  );

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const file = e.target.files[0];
        const photoId = uuid4();
        const FileRef = ref(storage, photoId + file.name);
        await uploadBytes(FileRef, file).then(() => {});

        if (serverId !== null && channelId !== null) {
          await addDoc(
            collection(
              db,
              "servers",
              serverId,
              "channels",
              String(channelId),
              "messages"
            ),
            {
              message: null,
              timestamp: serverTimestamp(),
              user: user,
              photoId: photoId + file.name,
            }
          );
        }
      }
    },
    [channelId, serverId, user]
  );

  const filterMessages = messages.filter((message) => {
    if (searchMessage !== "") {
      return message.message
        ?.toLowerCase()
        .includes(searchMessage.toLowerCase());
    } else {
      return true;
    }
  });
  return (
    <div className="content">
      <div className="chat">
        {/* chatHeader */}
        <ChatHeader
          channelName={channelName}
          onSearchMessage={setSearchMessage}
        />
        {/* chatMessage */}
        <div className="chatMessage">
          {filterMessages.map((message, index) => (
            <ChatMessage
              id={message.id}
              key={index}
              message={message.message}
              timestamp={message.timestamp}
              user={message.user}
              photoId={message.photoId}
              photoURL={message.photoURL}
            />
          ))}
        </div>
        {/* chatInput */}
        <div className="chatInput">
          <input
            type="file"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button onClick={handleButtonClick} className="addButton">
            <AddCircleOutlineIcon />
          </button>
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
        <MemberSidebar />
      </div>
    </div>
  );
};

export default Chat;
