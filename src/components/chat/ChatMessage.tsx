import "./ChatMessage.scss";
import { Avatar } from "@mui/material";
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
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import EmojiPicker from "emoji-picker-react";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import EditIcon from "@mui/icons-material/Edit";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

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
  const [openModal, setOpenModal] = useState<boolean>(false);
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);
  //絵文字ピッカーの表示/非表示を管理
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  //絵文字ピッカーのDOM要素への参照を作成
  //useRef コンポーネントのレンダリング間で値を保持するため
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(props.message);
  const user = useAppSelector((state) => state.user.user);

  useEffect(() => {
    const fetchURL = async () => {
      const photoURL = await getDownloadURL(ref(storage, photoId));
      setFileURL(photoURL);
    };
    fetchURL();
  }, [photoId]);

  const deleteMessage = async () => {
    if (serverId !== null && channelId !== null && id !== null) {
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
      handleCloseModal();
    }
  };

  const handleOpenModal = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
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
        setIsEditing(false);
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
  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    borderRadius: "8px",
    boxShadow: 24,
    p: 4,
  };

  return (
    <div className="message">
      <div className="avatarContainer">
        <Avatar src={user?.photo} />
      </div>
      <div className="messageInfo">
        <h4>
          {user?.displayName}
          <span className="messageTimestamp">
            {new Date(timestamp?.toDate()).toLocaleString()}
          </span>
        </h4>
        <div className="messageContent">
          <div className="messageText">
            <p>{props.message}</p>
            {props.user.uid === user?.uid && (
              <div className="messageActions">
                <button
                  onClick={() => setIsEditing(true)}
                  className="editButton"
                >
                  <EditIcon fontSize="small" />
                </button>
                <button onClick={handleOpenModal} className="deleteButton">
                  <DeleteIcon fontSize="small" />
                </button>
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
        <Modal open={openModal} onClose={handleCloseModal}>
          <Fade in={openModal}>
            <Box sx={style}>
              <Typography
                id="transition-modal-title"
                variant="h6"
                component="h2"
              >
                メッセージを削除しますか？
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 2,
                }}
              >
                <Button
                  onClick={deleteMessage}
                  variant="outlined"
                  color="error"
                >
                  削除する
                </Button>
                <Button
                  onClick={handleCloseModal}
                  variant="outlined"
                  color="primary"
                >
                  戻る
                </Button>
              </Box>
            </Box>
          </Fade>
        </Modal>
        <div className="imageMessage">
          <img src={fileURL} alt="" className="images" />
        </div>
      </div>

      <Modal
        open={isEditing}
        onClose={() => {
          setIsEditing(false);
          setEditedMessage(props.message);
        }}
      >
        <Box sx={modalStyle}>
          <div className="modalContent">
            <h2>メッセージを編集</h2>
            <div className="editContainer">
              <input
                type="text"
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                className="editInput"
                autoFocus
              />
              <div className="editButtons">
                <button onClick={handleEdit} className="saveButton">
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedMessage(props.message);
                  }}
                  className="cancelButton"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </Box>
      </Modal>
    </div>
  );
};

export default ChatMessage;
