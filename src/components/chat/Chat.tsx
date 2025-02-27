import ChatHeader from "./ChatHeader";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ChatMessage from "./ChatMessage";
import { useAppSelector } from "../../app/hooks";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuid4 } from "uuid";
import { Input } from "../ui/input";
const Chat = () => {
  const [inputText, setInputText] = useState<string>("");
  const [searchMessage, setSearchMessage] = useState<string>("");
  const channelId = useAppSelector((state) => state.channel.channelId);
  const channelName = useAppSelector((state) => state.channel.channelName);
  const user = useAppSelector((state) => state.user.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  //カスタムフックを使用してメッセージデータを取得
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

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("ファイルが選択されました", e.target.files);
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
          const photoId = uuid4();
          const fileName = photoId + file.name;
          const FileRef = ref(storage, fileName);

          // アップロード処理
          const uploadTask = await uploadBytes(FileRef, file);
          const downloadURL = await getDownloadURL(FileRef);
          console.log(
            "ファイルがアップロードされました",
            uploadTask,
            downloadURL
          );

          // アップロードが成功したらFirestoreにメッセージを追加
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
                photoId: fileName,
              }
            );
            console.log("メッセージが追加されました");
          }
        } catch (error) {
          console.error("ファイルアップロードエラー:", error);
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

  useEffect(() => {
    console.log(
      "fileInputRef初期化:",
      fileInputRef.current ? "存在します" : "nullです"
    );
  }, []);

  return (
    <div className="flex w-full h-full">
      <div className="flex flex-col flex-grow h-screen">
        {/* chatHeader */}
        <ChatHeader
          channelName={channelName}
          onSearchMessage={setSearchMessage}
        />
        {/* chatMessage */}
        <div
          className="h-[calc(100vh-120px)] overflow-y-scroll px-4 
          scrollbar scrollbar-w-2 
          scrollbar-track-[#2f3136] scrollbar-track-rounded-md
          scrollbar-thumb-[#202225] scrollbar-thumb-rounded-md 
          hover:scrollbar-thumb-[#2f3136]"
        >
          {filterMessages.map((message, index) => (
            <ChatMessage
              id={message.id}
              key={index}
              message={message.message}
              timestamp={message.timestamp}
              user={message.user}
              photoId={message.photoId}
              photoURL={message.photoURL}
              reactions={message.reactions}
            />
          ))}
        </div>
        {/* chatInput */}
        <div className="flex items-center justify-between p-2.5 bg-white rounded-lg mx-4 mb-6 text-gray-700">
          <input
            type="file"
            className="hidden"
            id="file-input"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
          />
          <label
            htmlFor="file-input"
            className="bg-transparent border-none text-gray-500 px-4 cursor-pointer transition-colors duration-200 flex items-center justify-center hover:text-gray-700"
          >
            <AddCircleOutlineIcon className="text-2xl" />
          </label>
          <form className="flex-grow">
            <Input
              type="text"
              placeholder={
                channelName
                  ? `${channelName}へメッセージを送信`
                  : "メッセージを送信"
              }
              onChange={(e) => setInputText(e.target.value)}
              value={inputText}
              className="bg-white text-black border border-gray-300"
            />
            <button
              type="submit"
              className="hidden"
              onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) =>
                sendMessage(e)
              }
            ></button>
          </form>
        </div>
      </div>
      <div className="w-60 bg-[#2f3136] h-screen">
        <MemberSidebar key={channelId} />
      </div>
    </div>
  );
};

export default Chat;
