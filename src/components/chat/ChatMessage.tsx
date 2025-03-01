import {
  deleteDoc,
  doc,
  runTransaction,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useAppSelector } from "../../app/hooks";
import { db, storage } from "../../firebase";
import DeleteIcon from "@mui/icons-material/Delete";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import EditIcon from "@mui/icons-material/Edit";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "../ui/input";
import { Avatar, AvatarImage } from "../ui/avatar";
import useUsers from "../../hooks/useUsers";

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
  reactions: {
    [key: string]: {
      emoji: string;
      users: string[];
    };
  };
  scrollToBottom: () => void;
};

const ChatMessage = (props: Props) => {
  const { timestamp, photoId, id } = props;
  const [fileURL, setFileURL] = useState<string>();
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);
  //絵文字ピッカーの表示/非表示を管理
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  //絵文字ピッカーのDOM要素への参照を作成
  //useRef コンポーネントのレンダリング間で値を保持するため
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [editedMessage, setEditedMessage] = useState(props.message);
  const user = useAppSelector((state) => state.user.user);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  // useUsersフックを使用して最新のユーザー情報を取得
  const { documents: users } = useUsers();

  // メッセージのユーザーIDに一致するユーザー情報を検索
  const currentUser = users.find((user) => user.uid === props.user.uid);

  // 最新のユーザー情報またはpropsのデータを使用
  const userPhoto = currentUser?.photoURL || props.user.photo;
  const userDisplayName = currentUser?.displayName || props.user.displayName;

  useEffect(() => {
    const fetchURL = async () => {
      // photoIdが存在し、空でない場合のみURLを取得
      if (photoId && photoId.trim() !== "") {
        try {
          const photoURL = await getDownloadURL(ref(storage, photoId));
          setFileURL(photoURL);

          // 画像が読み込まれたら画面の一番下までスクロール
          const img = new Image();
          img.onload = () => {
            props.scrollToBottom();
          };
          img.src = photoURL;
        } catch (error) {
          console.log("画像URLの取得に失敗しました:", error);
        }
      }
    };
    fetchURL();
  }, [photoId]);

  const deleteMessage = async () => {
    if (serverId !== null && channelId !== null && id !== null) {
      try {
        await deleteDoc(
          doc(
            db,
            "servers",
            serverId,
            "channels",
            String(channelId),
            "messages",
            props.id
          )
        );
        setDeleteDialogOpen(false);
      } catch (error) {
        console.log("メッセージの削除に失敗しました:", error);
      }
    }
  };

  const addReaction = async (emoji: string) => {
    if (serverId && channelId && id && user) {
      const messageRef = doc(
        db,
        "servers",
        serverId,
        "channels",
        String(channelId),
        "messages",
        id
      );
      await runTransaction(db, async (transaction) => {
        const messageDoc = await transaction.get(messageRef);
        const reactions = messageDoc.data()?.reactions || {};
        //リアクションは追加/削除の処理
        //Case1: この絵文字での初めてのリアクション
        if (!reactions[emoji]) {
          //新しいリアクションの追加
          reactions[emoji] = { emoji, users: [user.uid] };
          // Case2: 既存のリアクションだが、このユーザーは未リアクション
        } else if (!reactions[emoji].users.includes(user.uid)) {
          reactions[emoji].users.push(user.uid);
          //Case3: 既にリアクション済み(リアクションの取り消し)
        } else {
          reactions[emoji].users = reactions[emoji].users.filter(
            (uid: string) => uid !== user.uid
          );
          //リアクションしたユーザーがいなくなった場合、その絵文字を削除
          if (reactions[emoji].users.length === 0) {
            delete reactions[emoji];
          }
        }
        //更新を実行
        transaction.update(messageRef, { reactions });
      });
    }
  };

  const handleEdit = async () => {
    if (serverId && channelId && props.id) {
      try {
        const messageContentRef = doc(
          db,
          "servers",
          serverId,
          "channels",
          String(channelId),
          "messages",
          props.id
        );
        await updateDoc(messageContentRef, {
          message: editedMessage,
          isEdited: true,
        });
        setEditDialogOpen(false);
      } catch (error) {
        console.log("メッセージの更新に失敗しました:", error);
      }
    }
  };
  //画面全体のクリックイベントを監視するeffect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        //絵文字ピッカーが存在し
        emojiPickerRef.current &&
        //クリックされた場所が絵文字ピッカーの外である場合
        !emojiPickerRef.current.contains(event.target as Node) //event.targetはクリックされた要素
      ) {
        //絵文字ピッカーを閉じる
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex items-start p-2 px-4 relative text-black gap-4 hover:bg-gray-100 group bg-white border-b border-gray-200">
      <div className="flex-shrink-0">
        <Avatar className="w-11 h-11">
          <AvatarImage
            src={userPhoto}
            className="object-cover"
            key={userPhoto} // キーを追加して強制的に再レンダリング
          />
        </Avatar>
      </div>
      <div className="flex-1 p-2.5 overflow-hidden">
        <h4 className="flex items-center gap-2.5 mb-2">
          {userDisplayName}
          <span className="text-[#7b7c85] text-base font-normal">
            {new Date(timestamp?.toDate()).toLocaleString()}
          </span>
        </h4>
        <div className="relative">
          <div className="flex items-center gap-2 relative">
            <p className="m-0">{props.message}</p>
            {props.user.uid === user?.uid && (
              <div className="flex gap-1 opacity-0 invisible transition-all duration-200 ease-in-out lg:group-hover:opacity-100 group-hover:visible">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="inline-fle cursor-pointer items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                      <EditIcon fontSize="small" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white text-black border border-gray-200">
                    <DialogHeader>
                      <DialogTitle>メッセージを編集</DialogTitle>
                    </DialogHeader>

                    <Input
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="p-2 border border-[#dcddde] rounded text-sm w-full focus:outline-none focus:border-[#7983f5] bg-white"
                    />
                    <DialogFooter>
                      <Button
                        variant="default"
                        onClick={handleEdit}
                        className="cursor-pointer bg-black text-white"
                      >
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditDialogOpen(false)}
                        className="cursor-pointer bg-white text-black"
                      >
                        キャンセル
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center cursor-pointer justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 hover:text-[#ed4245] hover:bg-opacity-10">
                      <DeleteIcon fontSize="small" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white text-black border border-gray-200">
                    <DialogHeader>
                      <DialogTitle>メッセージを削除しますか？</DialogTitle>
                      <DialogDescription>
                        この操作は元に戻すことはできません。
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="default"
                        onClick={deleteMessage}
                        className="cursor-pointer bg-black text-white"
                      >
                        削除する
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(false)}
                        className="cursor-pointer bg-white text-black"
                      >
                        戻る
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
          {fileURL && (
            <Dialog
              open={isImagePreviewOpen}
              onOpenChange={setIsImagePreviewOpen}
            >
              <DialogTrigger asChild>
                <div className="mt-3 w-full md:w-4/5 lg:w-1/2">
                  <img
                    src={fileURL}
                    alt=""
                    className="w-full h-auto rounded cursor-pointer"
                    onClick={() => setIsImagePreviewOpen(true)}
                  />
                </div>
              </DialogTrigger>
              <DialogContent variant="image" hideCloseButton>
                <img
                  src={fileURL}
                  alt=""
                  className="w-full h-full object-contain rounded"
                />
              </DialogContent>
            </Dialog>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(props.reactions || {}).map(([emoji, reaction]) => (
              <button
                key={emoji}
                onClick={() => addReaction(emoji)}
                className={`flex items-center gap-1 p-1 px-2 rounded-lg bg-[#f2f3f5] border border-transparent cursor-pointer transition-all duration-200 ease-in-out text-sm hover:bg-[#e3e5e8] ${
                  reaction.users.includes(user?.uid || "")
                    ? "bg-[#e7e9fd] border-[#7983f5]"
                    : ""
                }`}
              >
                <span className="text-base">{emoji}</span>
                <span className="text-xs text-[#4f545c] min-w-3 text-center">
                  ({reaction.users.length})
                </span>
              </button>
            ))}
          </div>
          <div className="relative inline-block ml-1">
            <button
              className="p-1 text-gray-700 cursor-pointer border-none bg-transparent rounded opacity-80 transition-all duration-200 ease-in-out hover:text-black hover:bg-gray-200"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <SentimentSatisfiedAltIcon />
            </button>
            {showEmojiPicker && (
              <div
                className="rounded-2xl bg-[#f2f3f5] border border-transparent"
                ref={emojiPickerRef}
              >
                <EmojiPicker
                  onEmojiClick={(emoji) => {
                    addReaction(emoji.emoji);
                    setShowEmojiPicker(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
