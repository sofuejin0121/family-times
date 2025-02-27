import "./ChatMessage.scss";
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

  useEffect(() => {
    const fetchURL = async () => {
      // photoIdが存在し、空でない場合のみURLを取得
      if (photoId && photoId.trim() !== '') {
        try {
          const photoURL = await getDownloadURL(ref(storage, photoId));
          setFileURL(photoURL);
        } catch (error) {
          console.log('画像URLの取得に失敗しました:', error);
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
    <div className="message">
      <div className="avatarContainer">
        <Avatar>
          <AvatarImage src={props.user.photo}/>
        </Avatar>
      </div>
      <div className="messageInfo">
        <h4>
          {props.user.displayName}
          <span className="messageTimestamp">
            {new Date(timestamp?.toDate()).toLocaleString()}
          </span>
        </h4>
        <div className="messageContent">
          <div className="messageText">
            <p>{props.message}</p>
            {props.user.uid === user?.uid && (
              <div className="messageActions">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                      <EditIcon fontSize="small" />
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>メッセージを編集</DialogTitle>
                    </DialogHeader>
                    <Input
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="editInput"
                      autoFocus
                    />
                    <DialogFooter>
                      <Button variant="default" onClick={handleEdit}>
                        保存
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditDialogOpen(false)}
                      >
                        キャンセル
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                      <DeleteIcon fontSize="small" />
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>メッセージを削除しますか？</DialogTitle>
                      <DialogDescription>
                        この操作は元に戻すことはできません。
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="default" onClick={deleteMessage}>
                        削除する
                      </Button>
                      <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                        戻る
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
          <div className="reactions">
            {/* オブジェクトのエントリー(キーと値のペア)を配列に変換してマップ */}
            {Object.entries(props.reactions || {}).map(([emoji, reaction]) => (
              <button
                key={emoji}
                onClick={() => addReaction(emoji)}
                className={`reactionButton ${
                  reaction.users.includes(user?.uid || "") ? "active" : ""
                }`}
              >
                <span className="reactionEmoji">{emoji}</span>
                <span className="reactionCount">({reaction.users.length})</span>
              </button>
            ))}
          </div>
          <div className="reactionControls">
            <button
              className="addReactionButton"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <SentimentSatisfiedAltIcon />
            </button>
            {showEmojiPicker && (
              <div className="emojiPicker" ref={emojiPickerRef}>
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
        <div className="imageMessage">
          {/* fileURLが存在する場合のみ画像を表示 */}
          {fileURL && <img src={fileURL} alt="" className="images" />}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
