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
import { Send } from 'lucide-react';
interface ChatProps {
  isMemberSidebarOpen: boolean;
  setIsMemberSidebarOpen: (isOpen: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

const Chat = ({
  isMemberSidebarOpen,
  setIsMemberSidebarOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: ChatProps) => {
  const [inputText, setInputText] = useState<string>("");
  const [searchMessage, setSearchMessage] = useState<string>("");
  const channelId = useAppSelector((state) => state.channel.channelId);
  const channelName = useAppSelector((state) => state.channel.channelName);
  const user = useAppSelector((state) => state.user.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  //カスタムフックを使用してメッセージデータを取得
  const { subDocuments: messages } = useMessage();
  const serverId = useAppSelector((state) => state.server.serverId);
  const isServerSelected = Boolean(serverId);
  const isChannelSelected = Boolean(channelId);
  //メッセージリストのコンテナへの参照作成
  const messagesEndRef = useRef<HTMLDivElement>(null);
  ///画面の一番下までスクロールする関数
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, []);

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      ///入力が空の場合は送信ボタンを無効化
      if (!inputText.trim()) {
        return;
      }
      //入力が空でない場合のみ送信処理実行
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
        scrollToBottom();
      }
    },
    [channelId, inputText, serverId, user, scrollToBottom]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("ファイルが選択されました", e.target.files);
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_FILE_SIZE) {
          alert(
            `ファイルサイズが大きすぎます (最大: 5MB)。現在のサイズ: ${(
              file.size /
              (1024 * 1024)
            ).toFixed(2)}MB`
          );
          e.target.value = "";
          return;
        }
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
            scrollToBottom();
          }
        } catch (error) {
          console.error("ファイルアップロードエラー:", error);
        }
      }
    },
    [channelId, serverId, user, scrollToBottom]
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

  //ファイル入力の参照が初期化されたらログを出力
  useEffect(() => {
    console.log(
      "fileInputRef初期化:",
      fileInputRef.current ? "存在します" : "nullです"
    );
  }, []);
  return (
    <div className="flex w-full h-full relative">
      <div
        className="flex flex-col flex-grow h-screen min-w-0"
        style={{ minWidth: 0, flexGrow: 1 }}
      >
        {/* chatHeader */}
        <ChatHeader
          channelName={channelName}
          onSearchMessage={setSearchMessage}
          onToggleMemberSidebar={() =>
            setIsMemberSidebarOpen(!isMemberSidebarOpen)
          }
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        {!isServerSelected ? (
          <div className="flex flex-col items-center justify-center h-[calc(100svh-77px-56px)] w-full">
            <div className="bg-grey-100 p-8 rounded-lg max-w-md text-black text-center transform -translate-x-[10%] md:-translate-x-[15%]">
              <h3 className="text-lg font-medium mb-2">
                サーバーが選択されていません
              </h3>
              <p className="text-sm text-white-400">
                サーバーを選択するかサーバーに参加してください
              </p>
            </div>
          </div>
        ) : !isChannelSelected ? (
          <div className="flex flex-col items-center justify-center h-[calc(100svh-77px-56px)] w-full">
            <div className="bg-grey-100 p-8 rounded-lg max-w-md text-black text-center transform -translate-x-[10%] md:-translate-x-[15%]">
              <h3 className="text-lg font-medium mb-2">
                チャンネルが選択されていません
              </h3>
              <p className="text-sm text-white-400">
                チャンネルを選択してメッセージを送信してください
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* chatMessage */}
            <div
              className="h-[calc(100svh-77px-56px)] overflow-y-auto px-4 
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
                  scrollToBottom={scrollToBottom}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            {/* chatInput */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-lg mx-4  text-gray-700">
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
              <form
                className="flex-grow flex items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputText.trim()) {
                    sendMessage(e);
                  }
                }}
              >
                <Input
                  type="text"
                  placeholder={
                    channelName
                      ? `${channelName}へメッセージを送信`
                      : "メッセージを送信"
                  }
                  onChange={(e) => {
                    setInputText(e.target.value);
                  }}
                  value={inputText}
                  className="bg-white text-black border border-gray-300"
                />
                <button
                  type="submit"
                  className="md:hidden"
                  onClick={(
                    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
                  ) => sendMessage(e)}
                  disabled={!inputText.trim()}
                >
                  <Send className="ml-2"/>
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* メンバーサイドバーのオーバーレイ（モバイル用） */}
      {isMemberSidebarOpen && isServerSelected && (
        <div
          className="md:hidden mobile-overlay"
          onClick={() => setIsMemberSidebarOpen(false)}
        />
      )}

      {/* メンバーサイドバー */}
      {isServerSelected && (
        <div
          className={`w-60 min-w-[240px] bg-white h-screen flex-shrink-0 border-l border-gray-200
                   md:relative md:translate-x-0 fixed top-0 bottom-0 right-0 z-40 transition-transform duration-300 ease-in-out
                   ${
                     isMemberSidebarOpen ? "translate-x-0" : "translate-x-full"
                   } md:translate-x-0`}
          style={{ minWidth: "240px", flexShrink: 0 }}
        >
          <MemberSidebar key={channelId} />
        </div>
      )}
    </div>
  );
};

export default Chat;
