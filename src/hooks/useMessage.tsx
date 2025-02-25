import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAppSelector } from "../app/hooks";

interface Reaction {
  emoji: string;
  users: string[]; //リアクションしたユーザーのuid配列
}

interface Messages {
  id: string;
  photoId: string;
  photoURL: string;
  timestamp: Timestamp;
  message: string;
  user: {
    uid: string;
    photo: string;
    email: string;
    displayName: string;
  };
  reactions: {
    [key: string]: Reaction; //絵文字をkeyとしたリアクションデータ
  };
}

const useMessage = () => {
  const [subDocuments, setSubDocuments] = useState<Messages[]>([]);
  const channelId = useAppSelector((state) => state.channel.channelId);
  const serverId = useAppSelector((state) => state.server.serverId);

  useEffect(() => {
    if (serverId !== null) {
      const collectionRef = collection(
        db,
        "servers",
        serverId,
        "channels",
        String(channelId),
        "messages"
      );
      const collectionRefOrderBy = query(
        collectionRef,
        orderBy("timestamp", "asc")
      );

      onSnapshot(collectionRefOrderBy, (snapshot) => {
        const results: Messages[] = [];
        snapshot.docs.forEach((doc) => {
          results.push({
            id: doc.id,
            timestamp: doc.data().timestamp,
            message: doc.data().message,
            user: doc.data().user,
            photoId: doc.data().photoId,
            photoURL: doc.data().photoURL,
            reactions: doc.data().reactions || {},
          });
        });
        setSubDocuments(results);
      });
    }
  }, [channelId, serverId]);

  return { subDocuments };
};

export default useMessage;
